import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { isMetaConfigured, getMetaConfig, sendMetaText, formatPhoneForMeta } from "../_shared/meta-whatsapp.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const MAX_ATTEMPTS_PER_EMAIL = 3;
const RATE_LIMIT_WINDOW_MINUTES = 15;

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { email } = await req.json();

    if (!email) {
      return new Response(
        JSON.stringify({ error: "Email é obrigatório" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check Meta WhatsApp config
    if (!isMetaConfigured()) {
      return new Response(
        JSON.stringify({ error: "Meta WhatsApp não configurado. Configure META_WHATSAPP_PHONE_ID e META_WHATSAPP_ACCESS_TOKEN." }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const normalizedEmail = email.toLowerCase().trim();
    const clientIp = req.headers.get("x-forwarded-for")?.split(",")[0] || req.headers.get("cf-connecting-ip") || "unknown";

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Check rate limiting
    const windowStart = new Date(Date.now() - RATE_LIMIT_WINDOW_MINUTES * 60 * 1000).toISOString();
    
    const { count: attemptCount, error: countError } = await supabase
      .from("password_recovery_attempts")
      .select("*", { count: "exact", head: true })
      .eq("email", normalizedEmail)
      .gte("attempted_at", windowStart);

    if (countError) {
      console.error("Error checking rate limit:", countError);
    }

    // Log the attempt
    await supabase.from("password_recovery_attempts").insert({
      email: normalizedEmail,
      ip_address: clientIp,
      success: false,
    });

    if (attemptCount !== null && attemptCount >= MAX_ATTEMPTS_PER_EMAIL) {
      console.log(`Rate limit exceeded for email: ${normalizedEmail}, attempts: ${attemptCount}`);
      return new Response(
        JSON.stringify({ 
          error: `Muitas tentativas. Aguarde ${RATE_LIMIT_WINDOW_MINUTES} minutos antes de tentar novamente.` 
        }),
        { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Find profile by email
    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("user_id, full_name, email, phone")
      .eq("email", normalizedEmail)
      .maybeSingle();

    if (profileError) {
      console.error("Error finding profile:", profileError);
      return new Response(
        JSON.stringify({ error: "Erro ao buscar perfil" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!profile || !profile.phone) {
      console.log("Profile not found or no phone for email:", normalizedEmail);
      return new Response(
        JSON.stringify({ success: true, message: "Se o email estiver cadastrado, você receberá a nova senha." }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check if user is sindico
    const { data: userRole } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", profile.user_id)
      .eq("role", "sindico")
      .maybeSingle();

    if (!userRole) {
      console.log("User is not a sindico:", profile.user_id);
      return new Response(
        JSON.stringify({ success: true, message: "Se o email estiver cadastrado, você receberá a nova senha." }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Generate temporary password
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';
    let newPassword = '';
    for (let i = 0; i < 8; i++) {
      newPassword += chars.charAt(Math.floor(Math.random() * chars.length));
    }

    // Update user password
    const { error: updateError } = await supabase.auth.admin.updateUserById(
      profile.user_id,
      { password: newPassword }
    );

    if (updateError) {
      console.error("Error updating password:", updateError);
      return new Response(
        JSON.stringify({ error: "Erro ao gerar nova senha" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Send via Meta WABA Cloud API
    const formattedPhone = formatPhoneForMeta(profile.phone);
    const appUrl = "https://notificacondo.com.br";
    const message = `🔐 *NotificaCondo - Nova Senha*\n\nOlá, ${profile.full_name}!\n\nSua nova senha temporária é:\n\n*${newPassword}*\n\n⚠️ Por segurança, altere sua senha após o primeiro acesso.\n\nAcesse: ${appUrl}/auth`;

    console.log("Sending password recovery via Meta WABA to:", formattedPhone);

    const result = await sendMetaText({
      phone: formattedPhone,
      message: message,
    });

    if (!result.success) {
      console.error("Meta WhatsApp error:", result.error, result.debug);
      return new Response(
        JSON.stringify({ error: "Erro ao enviar mensagem via WhatsApp" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Update attempt as successful
    await supabase
      .from("password_recovery_attempts")
      .update({ success: true })
      .eq("email", normalizedEmail)
      .order("attempted_at", { ascending: false })
      .limit(1);

    console.log("Password recovery sent successfully to:", formattedPhone);

    return new Response(
      JSON.stringify({ success: true, message: "Nova senha enviada com sucesso" }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error: unknown) {
    console.error("Error in send-password-recovery:", error);
    const errorMessage = error instanceof Error ? error.message : "Erro interno do servidor";
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});