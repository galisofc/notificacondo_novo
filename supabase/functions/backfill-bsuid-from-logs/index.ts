import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const BACKFILL_VERSION = "phone-normalizer-v3-2026-05-02";

function isMissingBsuid(bsuid: unknown): boolean {
  return String(bsuid ?? "").trim() === "";
}

function addPhoneVariantsFromDigits(digits: string, set: Set<string>) {
  if (!digits) return;
  set.add(digits);

  let local = digits;
  if (digits.startsWith("55") && digits.length >= 12) {
    local = digits.slice(2);
    set.add(local);
  }

  if (local.length >= 10 && !local.startsWith("55")) set.add(`55${local}`);
  if (digits.length >= 11) set.add(digits.slice(-11));
  if (digits.length >= 10) set.add(digits.slice(-10));
  if (digits.length >= 9) set.add(digits.slice(-9));
  if (digits.length >= 8) set.add(digits.slice(-8));

  // mobile with/without leading 9 (BR): DDD + 8 or 9 digits
  if (local.length === 11 && local[2] === "9") {
    const withoutNine = local.slice(0, 2) + local.slice(3);
    set.add(withoutNine);
    set.add(`55${withoutNine}`);
  } else if (local.length === 10) {
    const withNine = local.slice(0, 2) + "9" + local.slice(2);
    set.add(withNine);
    set.add(`55${withNine}`);
  }
}

// Generate all digit-only variants of every phone found in a field. This avoids
// concatenating multiple masked phones into one impossible number.
function phoneVariants(value: unknown): string[] {
  const set = new Set<string>();
  const raw = String(value ?? "");
  const matches = raw.match(/\+?\d[\d\s().-]{6,}\d/g) || [];
  const sequences = matches.map((m) => m.replace(/\D/g, "")).filter(Boolean);
  const allDigits = raw.replace(/\D/g, "");
  if (allDigits && (sequences.length === 0 || allDigits.length <= 13)) sequences.push(allDigits);

  for (const digits of sequences) addPhoneVariantsFromDigits(digits, set);
  return Array.from(set).filter((v) => v.length >= 8);
}

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
              const bsuid = m?.from_user_id || m?.user_id || (contacts[0]?.user_id ?? null);
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
    const samples: Array<{ phone: string; bsuid: string; resident_id?: string; raw_phone?: string; matched: boolean; matched_variant?: string; payload_variants?: string[] }> = [];

    // Load ALL residents (regardless of bsuid status) once and build a digits-only index.
    // We will only update those whose bsuid is missing, but we want to count matches even for
    // residents that already have a bsuid (so the diagnostics make sense).
    const residentsByDigits = new Map<string, { id: string; missing: boolean; rawPhone: string }>(); // digitsKey -> info
    let totalResidentsLoaded = 0;
    let residentsWithDigits = 0;
    let resFrom = 0;
    while (true) {
      const { data: rs, error } = await supabase
        .from("residents")
        .select("id, phone, bsuid")
        .range(resFrom, resFrom + PAGE - 1);
      if (error || !rs || rs.length === 0) break;
      totalResidentsLoaded += rs.length;
      for (const r of rs) {
        const d = String(r.phone || "").replace(/\D/g, "");
        if (!d) continue;
        residentsWithDigits++;
        const info = { id: r.id, missing: isMissingBsuid(r.bsuid), rawPhone: String(r.phone || "") };
        // Index by ALL variants (with/without 55, last 10/11, with/without leading 9)
        for (const v of phoneVariants(r.phone)) {
          if (!residentsByDigits.has(v)) residentsByDigits.set(v, info);
        }
      }
      if (rs.length < PAGE) break;
      resFrom += PAGE;
      if (resFrom > 100000) break;
    }
    console.log(`[BACKFILL-BSUID] Residents loaded: ${totalResidentsLoaded}, with digits: ${residentsWithDigits}, index keys: ${residentsByDigits.size}`);

    let alreadyHadBsuidCount = 0;
    for (const [phone, bsuid] of phoneToBsuid.entries()) {
      const candidates = phoneVariants(phone);

      let info: { id: string; missing: boolean; rawPhone: string } | undefined;
      let matchedVariant: string | undefined;
      for (const c of candidates) {
        if (residentsByDigits.has(c)) {
          info = residentsByDigits.get(c);
          matchedVariant = c;
          break;
        }
      }

      let matched = false;
      let residentId: string | undefined = info?.id;
      if (info) {
        if (info.missing) {
          const { error: upErr } = await supabase
            .from("residents")
            .update({ bsuid })
            .eq("id", info.id);
          if (!upErr) {
            updatedCount++;
            matched = true;
          }
        } else {
          alreadyHadBsuidCount++;
          matched = true;
        }
      }
      if (!info) notFoundCount++;
      if (samples.length < 30) {
        samples.push({
          phone,
          bsuid,
          resident_id: residentId,
          raw_phone: info?.rawPhone,
          matched,
          matched_variant: matchedVariant,
          payload_variants: candidates.slice(0, 8),
        });
      }
    }

    return new Response(JSON.stringify({
      success: true,
      version: BACKFILL_VERSION,
      payloads_scanned: payloadsScanned,
      payloads_with_bsuid: payloadsWithBsuid,
      unique_phones_with_bsuid: phoneToBsuid.size,
      residents_loaded: totalResidentsLoaded,
      residents_with_digits: residentsWithDigits,
      residents_index_keys: residentsByDigits.size,
      residents_updated: updatedCount,
      residents_already_had_bsuid: alreadyHadBsuidCount,
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
