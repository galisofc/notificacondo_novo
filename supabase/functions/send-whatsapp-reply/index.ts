import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { sendMetaText, getMetaConfig } from "../_shared/meta-whatsapp.ts";

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

    // Validate auth - only super_admin
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

    // Check super_admin role
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

    const { to_phone, message, bsuid } = await req.json();

    if (!to_phone || !message) {
      return new Response(JSON.stringify({ error: "to_phone e message são obrigatórios" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Check 24h conversation window
    const { data: lastInbound } = await supabase
      .from("whatsapp_messages")
      .select("conversation_window_expires_at")
      .eq("from_phone", to_phone.replace(/\D/g, ""))
      .eq("direction", "inbound")
      .order("created_at", { ascending: false })
      .limit(1)
      .single();

    const now = new Date();
    const windowExpires = lastInbound?.conversation_window_expires_at
      ? new Date(lastInbound.conversation_window_expires_at)
      : null;

    if (!windowExpires || windowExpires < now) {
      return new Response(JSON.stringify({
        error: "Janela de 24h expirada. Use um template aprovado para iniciar a conversa.",
        window_expired: true,
      }), {
        status: 422, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Send via Meta API
    const config = getMetaConfig();
    const result = await sendMetaText({ phone: to_phone, message, bsuid }, config);

    if (!result.success) {
      return new Response(JSON.stringify({ error: result.error, details: result.debug }), {
        status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Save outbound message
    const cleanPhone = to_phone.replace(/\D/g, "");
    await supabase.from("whatsapp_messages").insert({
      direction: "outbound",
      from_phone: config.phoneNumberId,
      to_phone: cleanPhone,
      bsuid: bsuid || null,
      message_type: "text",
      content: message,
      meta_message_id: result.messageId,
      status: "sent",
    });

    return new Response(JSON.stringify({
      success: true,
      message_id: result.messageId,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("[REPLY] Error:", error);
    return new Response(JSON.stringify({
      error: error instanceof Error ? error.message : "Erro desconhecido",
    }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
