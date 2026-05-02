import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Auth: super_admin only
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Não autorizado" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Token inválido" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const { data: roleData } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .eq("role", "super_admin")
      .single();
    if (!roleData) {
      return new Response(JSON.stringify({ error: "Acesso negado" }), {
        status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Index: phone -> bsuid extracted from any payload
    const phoneToBsuid = new Map<string, string>();
    let payloadsScanned = 0;
    let payloadsWithBsuid = 0;

    // Page through webhook_raw_logs
    const PAGE = 500;
    let from = 0;
    while (true) {
      const { data: logs, error } = await supabase
        .from("webhook_raw_logs")
        .select("id, payload")
        .eq("source", "meta")
        .order("created_at", { ascending: false })
        .range(from, from + PAGE - 1);
      if (error) throw error;
      if (!logs || logs.length === 0) break;

      for (const log of logs) {
        payloadsScanned++;
        const payload: any = log.payload;
        const entries = payload?.entry || [];
        let foundInThis = false;
        for (const entry of entries) {
          for (const change of (entry.changes || [])) {
            const v = change.value || {};
            const contacts = v.contacts || [];
            const messages = v.messages || [];
            const statuses = v.statuses || [];

            // Build candidate (phone -> bsuid) from contacts
            const contactPairs: Array<{ phone: string; bsuid: string }> = [];
            for (const c of contacts) {
              if (c?.user_id && c?.wa_id) {
                contactPairs.push({ phone: String(c.wa_id).replace(/\D/g, ""), bsuid: String(c.user_id) });
              }
            }

            // From inbound messages
            for (const m of messages) {
              const phone = String(m?.from || "").replace(/\D/g, "");
              const bsuid = m?.user_id || (contacts[0]?.user_id ?? null);
              if (phone && bsuid) {
                phoneToBsuid.set(phone, String(bsuid));
                foundInThis = true;
              }
            }

            // From statuses
            for (const s of statuses) {
              const phone = String(s?.recipient_id || contacts[0]?.wa_id || "").replace(/\D/g, "");
              const bsuid = s?.user_id || s?.recipient_user_id || (contacts[0]?.user_id ?? null);
              if (phone && bsuid) {
                phoneToBsuid.set(phone, String(bsuid));
                foundInThis = true;
              }
            }

            // From contacts directly (last resort)
            for (const cp of contactPairs) {
              if (cp.phone && cp.bsuid) {
                phoneToBsuid.set(cp.phone, cp.bsuid);
                foundInThis = true;
              }
            }
          }
        }
        if (foundInThis) payloadsWithBsuid++;
      }

      if (logs.length < PAGE) break;
      from += PAGE;
      if (from > 50000) break; // safety
    }

    console.log(`[BACKFILL-BSUID] Scanned ${payloadsScanned} payloads, ${payloadsWithBsuid} with BSUID. Unique phones: ${phoneToBsuid.size}`);

    // Also scan whatsapp_messages for any saved bsuid (in case webhook stored it but resident wasn't matched)
    let msgFrom = 0;
    while (true) {
      const { data: msgs, error } = await supabase
        .from("whatsapp_messages")
        .select("from_phone, bsuid")
        .not("bsuid", "is", null)
        .range(msgFrom, msgFrom + PAGE - 1);
      if (error) break;
      if (!msgs || msgs.length === 0) break;
      for (const m of msgs) {
        const phone = String(m.from_phone || "").replace(/\D/g, "");
        if (phone && m.bsuid && !phoneToBsuid.has(phone)) {
          phoneToBsuid.set(phone, String(m.bsuid));
        }
      }
      if (msgs.length < PAGE) break;
      msgFrom += PAGE;
      if (msgFrom > 50000) break;
    }

    // Update residents
    let updatedCount = 0;
    let notFoundCount = 0;
    const samples: Array<{ phone: string; bsuid: string; resident_id?: string; matched: boolean }> = [];

    for (const [phone, bsuid] of phoneToBsuid.entries()) {
      const variants = [phone];
      if (phone.startsWith("55") && phone.length > 11) variants.push(phone.substring(2));

      let matched = false;
      let residentId: string | undefined;
      for (const pv of variants) {
        const { data: residents } = await supabase
          .from("residents")
          .select("id, bsuid")
          .or(`phone.like.%${pv}`)
          .is("bsuid", null)
          .limit(5);

        if (residents && residents.length > 0) {
          for (const r of residents) {
            const { error: upErr } = await supabase
              .from("residents")
              .update({ bsuid })
              .eq("id", r.id);
            if (!upErr) {
              updatedCount++;
              residentId = r.id;
              matched = true;
            }
          }
          break;
        }
      }
      if (!matched) notFoundCount++;
      if (samples.length < 20) samples.push({ phone, bsuid, resident_id: residentId, matched });
    }

    return new Response(JSON.stringify({
      success: true,
      payloads_scanned: payloadsScanned,
      payloads_with_bsuid: payloadsWithBsuid,
      unique_phones_with_bsuid: phoneToBsuid.size,
      residents_updated: updatedCount,
      phones_without_resident: notFoundCount,
      samples,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("[BACKFILL-BSUID] Error:", err);
    return new Response(JSON.stringify({
      error: err instanceof Error ? err.message : "Erro desconhecido",
    }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
