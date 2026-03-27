import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

type WhatsAppProvider = "zpro" | "zapi" | "evolution" | "wppconnect";

interface ProviderSettings {
  apiUrl: string;
  apiKey: string;
  instanceId: string;
}

interface SendResult {
  success: boolean;
  messageId?: string;
  error?: string;
}

// Z-PRO Provider
async function sendZproMessage(phone: string, message: string, config: ProviderSettings): Promise<SendResult> {
  const baseUrl = config.apiUrl.replace(/\/$/, "");
  const phoneClean = phone.replace(/\D/g, "");
  
  // If instance_id is empty or placeholder, fallback to api_key
  let externalKey = config.instanceId || "";
  if (!externalKey || externalKey === "zpro-embedded") {
    externalKey = config.apiKey;
  }
  const params = new URLSearchParams({
    body: message,
    number: phoneClean,
    externalKey,
    bearertoken: config.apiKey,
    isClosed: "false",
  });
  
  const sendUrl = `${baseUrl}/params/?${params.toString()}`;
  
  try {
    const response = await fetch(sendUrl, {
      method: "GET",
      headers: { "Content-Type": "application/json" },
    });
    
    const responseText = await response.text();
    let data;
    try {
      data = JSON.parse(responseText);
    } catch (e) {
      return { success: false, error: `Resposta inválida da API` };
    }
    
    if (response.ok) {
      if (data.id || data.messageId || data.zapiMessageId || data.message_id || data.key?.id) {
        return { success: true, messageId: data.id || data.messageId || data.zapiMessageId || data.message_id || data.key?.id };
      }
      if (data.status === "success" || data.success === true || data.status === "PENDING") {
        return { success: true, messageId: data.id || "sent" };
      }
      return { success: true, messageId: "sent" };
    }
    
    return { success: false, error: data.message || data.error || `Erro ${response.status}` };
  } catch (error: any) {
    return { success: false, error: `Erro de conexão: ${error.message}` };
  }
}

// Z-API Provider
async function sendZapiMessage(phone: string, message: string, config: ProviderSettings): Promise<SendResult> {
  const baseUrl = config.apiUrl.replace(/\/$/, "");
  const phoneClean = phone.replace(/\D/g, "");
  
  const sendUrl = `${baseUrl}/instances/${config.instanceId}/token/${config.apiKey}/send-text`;
  
  try {
    const response = await fetch(sendUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ phone: phoneClean, message }),
    });
    
    const data = await response.json();
    
    if (response.ok && (data.zapiMessageId || data.messageId || data.id)) {
      return { success: true, messageId: data.zapiMessageId || data.messageId || data.id };
    }
    
    return { success: false, error: data.message || data.error || `Erro ${response.status}` };
  } catch (error: any) {
    return { success: false, error: `Erro de conexão: ${error.message}` };
  }
}

// Evolution API Provider
async function sendEvolutionMessage(phone: string, message: string, config: ProviderSettings): Promise<SendResult> {
  const baseUrl = config.apiUrl.replace(/\/$/, "");
  const phoneClean = phone.replace(/\D/g, "");
  
  const sendUrl = `${baseUrl}/message/sendText/${config.instanceId}`;
  
  try {
    const response = await fetch(sendUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "apikey": config.apiKey,
      },
      body: JSON.stringify({
        number: phoneClean,
        text: message,
      }),
    });
    
    const data = await response.json();
    
    if (response.ok && (data.key?.id || data.messageId || data.id)) {
      return { success: true, messageId: data.key?.id || data.messageId || data.id };
    }
    
    return { success: false, error: data.message || data.error || `Erro ${response.status}` };
  } catch (error: any) {
    return { success: false, error: `Erro de conexão: ${error.message}` };
  }
}

// WPPConnect Provider
async function sendWppconnectMessage(phone: string, message: string, config: ProviderSettings): Promise<SendResult> {
  const baseUrl = config.apiUrl.replace(/\/$/, "");
  const phoneClean = phone.replace(/\D/g, "");
  
  const sendUrl = `${baseUrl}/api/${config.instanceId}/send-message`;
  
  try {
    const response = await fetch(sendUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${config.apiKey}`,
      },
      body: JSON.stringify({
        phone: phoneClean,
        message: message,
        isGroup: false,
      }),
    });
    
    const data = await response.json();
    
    if (response.ok && (data.id || data.messageId || data.status === "success")) {
      return { success: true, messageId: data.id || data.messageId || "sent" };
    }
    
    return { success: false, error: data.message || data.error || `Erro ${response.status}` };
  } catch (error: any) {
    return { success: false, error: `Erro de conexão: ${error.message}` };
  }
}

const providers: Record<WhatsAppProvider, (phone: string, message: string, config: ProviderSettings) => Promise<SendResult>> = {
  zpro: sendZproMessage,
  zapi: sendZapiMessage,
  evolution: sendEvolutionMessage,
  wppconnect: sendWppconnectMessage,
};

serve(async (req: Request) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    // Verify authentication
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "Authorization header required" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);

    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: "Invalid token" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get request body
    const body = await req.json();
    const { porter_user_id, condominium_id } = body;

    if (!porter_user_id || !condominium_id) {
      return new Response(
        JSON.stringify({ error: "porter_user_id and condominium_id are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`Resending credentials for porter ${porter_user_id} in condominium ${condominium_id}`);

    // Verify user owns the condominium
    const { data: condominium, error: condoError } = await supabase
      .from("condominiums")
      .select("id, name, owner_id")
      .eq("id", condominium_id)
      .single();

    if (condoError || !condominium) {
      return new Response(
        JSON.stringify({ error: "Condominium not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check if user is the owner or super_admin
    const { data: userRoles } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id);

    const isSuperAdmin = userRoles?.some(r => r.role === "super_admin");
    
    if (condominium.owner_id !== user.id && !isSuperAdmin) {
      return new Response(
        JSON.stringify({ error: "Not authorized to manage this condominium" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get porter profile
    const { data: porterProfile, error: profileError } = await supabase
      .from("profiles")
      .select("full_name, email, phone")
      .eq("user_id", porter_user_id)
      .single();

    if (profileError || !porterProfile) {
      return new Response(
        JSON.stringify({ error: "Porter profile not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check if porter has a phone number
    if (!porterProfile.phone) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: "O porteiro não possui telefone cadastrado. Adicione um telefone antes de reenviar as credenciais." 
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Generate new password and update user
    const generatePassword = (): string => {
      const chars = "ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789";
      let password = "";
      for (let i = 0; i < 10; i++) {
        password += chars.charAt(Math.floor(Math.random() * chars.length));
      }
      return password;
    };

    const newPassword = generatePassword();

    // Update user password
    const { error: updateError } = await supabase.auth.admin.updateUserById(
      porter_user_id,
      { password: newPassword }
    );

    if (updateError) {
      console.error("Error updating password:", updateError);
      return new Response(
        JSON.stringify({ error: "Failed to reset password" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get WhatsApp config
    const { data: whatsappConfig, error: whatsappError } = await supabase
      .from("whatsapp_config")
      .select("*")
      .eq("is_active", true)
      .limit(1)
      .single();

    if (whatsappError || !whatsappConfig) {
      return new Response(
        JSON.stringify({ 
          success: true, 
          whatsapp_sent: false, 
          password: newPassword,
          message: "Senha resetada. WhatsApp não configurado, anote a nova senha."
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get app_url from settings
    const { data: appSettings } = await supabase
      .from("app_settings")
      .select("value")
      .eq("key", "app_url")
      .single();

    const appUrl = appSettings?.value || "https://notificacondo.com.br";

    // Get WABA template for credentials
    const { data: wabaTemplate } = await supabase
      .from("whatsapp_templates")
      .select("*, waba_template_name, waba_language, params_order")
      .eq("slug", "resend_porter_credentials")
      .eq("is_active", true)
      .maybeSingle();

    // Format phone
    const cleanPhone = porterProfile.phone.replace(/\D/g, "");
    const formattedPhone = cleanPhone.startsWith("55") ? cleanPhone : `55${cleanPhone}`;

    let whatsappSent = false;
    let whatsappErrorMsg = "";

    // Try WABA template first (nova_credencial)
    if (whatsappConfig.use_waba_templates && wabaTemplate?.waba_template_name) {
      const metaPhoneId = Deno.env.get("META_WHATSAPP_PHONE_ID");
      const metaToken = Deno.env.get("META_WHATSAPP_ACCESS_TOKEN");

      if (!metaPhoneId || !metaToken) {
        console.error("META_WHATSAPP_PHONE_ID or META_WHATSAPP_ACCESS_TOKEN not configured");
        whatsappErrorMsg = "Variáveis META_WHATSAPP_PHONE_ID ou META_WHATSAPP_ACCESS_TOKEN não configuradas.";
      } else {
        console.log(`Sending WABA template: ${wabaTemplate.waba_template_name} to ${formattedPhone}`);
        
        const wabaTemplateUrl = `https://graph.facebook.com/v25.0/${metaPhoneId}/messages`;
        
        const paramsOrder = wabaTemplate.params_order || ["condominio", "nome", "email", "senha", "link"];
        const values: Record<string, string> = {
          condominio: condominium.name,
          nome: porterProfile.full_name,
          email: porterProfile.email,
          senha: newPassword,
          link: appUrl,
        };

        const wabaPayload = {
          messaging_product: "whatsapp",
          recipient_type: "individual",
          to: formattedPhone,
          type: "template",
          template: {
            name: wabaTemplate.waba_template_name,
            language: { code: wabaTemplate.waba_language || "pt_BR" },
            components: [
              {
                type: "body",
                parameters: paramsOrder.map((param: string) => ({
                  type: "text",
                  text: values[param] || "",
                })),
              },
            ],
          },
        };

        try {
          const wabaResponse = await fetch(wabaTemplateUrl, {
            method: "POST",
            headers: {
              "Authorization": `Bearer ${metaToken}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify(wabaPayload),
          });

          if (wabaResponse.ok) {
            whatsappSent = true;
            console.log("WhatsApp WABA template sent successfully");
          } else {
            const errorText = await wabaResponse.text();
            console.error("WABA send error:", errorText);
            whatsappErrorMsg = `Erro WABA API: ${errorText}`;
          }
        } catch (wabaErr: any) {
          console.error("WABA request failed:", wabaErr);
          whatsappErrorMsg = `Erro de conexão WABA: ${wabaErr.message}`;
        }
      }
    }

    // Fallback to provider ONLY if WABA is not enabled and provider has valid config
    if (!whatsappSent && !whatsappConfig.use_waba_templates && whatsappConfig.api_url) {
      const provider = whatsappConfig.provider as WhatsAppProvider;
      const sendMessage = providers[provider];

      if (sendMessage) {
        const message = `🔐 *Notifica Condo - Novas Credenciais*

Olá, *${porterProfile.full_name}*!

Suas novas credenciais de acesso:

📧 *E-mail:* ${porterProfile.email}
🔑 *Senha:* ${newPassword}

🏢 *Condomínio:* ${condominium.name}

🔒 Recomendamos que você altere sua senha após o primeiro acesso.

Acesse: ${appUrl}`;

        const config: ProviderSettings = {
          apiUrl: whatsappConfig.api_url,
          apiKey: whatsappConfig.api_key,
          instanceId: whatsappConfig.instance_id,
        };

        const result = await sendMessage(porterProfile.phone, message, config);
        if (result.success) {
          whatsappSent = true;
          console.log("WhatsApp text message sent successfully:", result.messageId);
        } else {
          console.error("WhatsApp text send failed:", result.error);
          whatsappErrorMsg = result.error || "Falha ao enviar via provedor";
        }
      }
    }

    if (whatsappSent) {
      return new Response(
        JSON.stringify({ 
          success: true, 
          whatsapp_sent: true,
          message: "Novas credenciais enviadas por WhatsApp com sucesso!"
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    } else {
      return new Response(
        JSON.stringify({ 
          success: true, 
          whatsapp_sent: false, 
          password: newPassword,
          message: `Senha resetada. Falha no WhatsApp: ${whatsappErrorMsg || "Template WABA não encontrado ou configuração incompleta"}`
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

  } catch (error: any) {
    console.error("Error in resend-porter-credentials:", error);
    return new Response(
      JSON.stringify({ error: error.message || "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
