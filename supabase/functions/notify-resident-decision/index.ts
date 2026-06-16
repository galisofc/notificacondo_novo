import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { sendMetaTemplate, buildParamsArray } from "../_shared/meta-whatsapp.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface NotifyResidentRequest {
  occurrence_id: string;
  decision: "arquivada" | "advertido" | "multado";
  justification: string;
  responsible_party?: "inquilino" | "proprietario";
  responsible_name?: string;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  let notificationId: string | null = null;

  try {
    const { occurrence_id, decision, justification, responsible_party, responsible_name }: NotifyResidentRequest = await req.json();
    console.log("Notify resident decision:", { occurrence_id, decision });

    if (!occurrence_id || !decision) {
      return new Response(
        JSON.stringify({ error: "occurrence_id e decision são obrigatórios" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Fetch occurrence with resident info (includes owner data for tenant scenarios)
    const { data: occurrence, error: occError } = await supabase
      .from("occurrences")
      .select(`
        id, title, type, condominium_id,
        residents!inner (
          id, full_name, phone, email, resident_type, owner_name, owner_phone,
          apartments!inner (
            number,
            blocks!inner (
              name,
              condominiums!inner ( id, name )
            )
          )
        )
      `)
      .eq("id", occurrence_id)
      .single();

    if (occError || !occurrence) {
      console.error("Occurrence not found:", occError);
      return new Response(
        JSON.stringify({ error: "Ocorrência não encontrada" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const resident = occurrence.residents as any;
    const condoName = resident.apartments.blocks.condominiums.name;
    const condoId = occurrence.condominium_id;

    // Map decision to template slug
    const templateSlugMap: Record<string, string> = {
      arquivada: "decision_archived",
      advertido: "decision_warning",
      multado: "decision_fine",
    };
    const templateSlug = templateSlugMap[decision];

    // Fetch WABA template config
    const { data: template } = await supabase
      .from("whatsapp_templates")
      .select("waba_template_name, waba_language, params_order, variables, button_config")
      .eq("slug", templateSlug)
      .eq("is_active", true)
      .maybeSingle();

    const wabaTemplateName = template?.waba_template_name;
    const wabaLanguage = template?.waba_language || "pt_BR";
    const paramsOrder = template?.params_order || template?.variables || [];

    if (!wabaTemplateName) {
      console.error(`No WABA template linked for slug: ${templateSlug}`);
      return new Response(
        JSON.stringify({ error: `Template WABA não vinculado para ${templateSlug}` }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Build link
    const appBaseUrl = "https://notificacondo.com.br";
    const link = `${appBaseUrl}/resident/occurrences/${occurrence_id}`;

    // Build button params if template has URL buttons with dynamic suffix
    let buttonParams: any[] | undefined;
    if (template?.button_config) {
      const btnConfigs = Array.isArray(template.button_config) ? template.button_config : [template.button_config];
      const urlButtons = btnConfigs
        .map((btn: any, idx: number) => ({ btn, idx }))
        .filter(({ btn }: any) => btn.type === "url" && btn.has_dynamic_suffix);

      if (urlButtons.length > 0) {
        buttonParams = urlButtons.map(({ idx }: any) => ({
          type: "button",
          subType: "url",
          index: idx,
          parameters: [{ type: "text", text: link }],
        }));
      }
    }

    // Build recipient list: always the resident, plus owner if tenant
    type Recipient = { role: "inquilino" | "proprietario" | "morador"; phone: string; name: string };
    const recipients: Recipient[] = [];

    const residentIsTenant =
      resident.resident_type === "inquilino" || responsible_party === "inquilino";
    const baseRole: "inquilino" | "morador" = residentIsTenant ? "inquilino" : "morador";

    if (resident.phone) {
      recipients.push({
        role: baseRole,
        phone: resident.phone,
        name: resident.full_name || "Morador",
      });
    }

    if (residentIsTenant && resident.owner_phone && resident.owner_phone !== resident.phone) {
      recipients.push({
        role: "proprietario",
        phone: resident.owner_phone,
        name: resident.owner_name || "Proprietário",
      });
    }

    if (recipients.length === 0) {
      console.log("No recipient phone available, skipping");
      return new Response(
        JSON.stringify({ success: true, skipped: true, reason: "Sem telefone para notificar" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const results: any[] = [];
    let anyFailure = false;

    for (const r of recipients) {
      const variables: Record<string, string> = {
        nome: r.name,
        titulo: occurrence.title,
        condominio: condoName,
        justificativa: justification || "Sem justificativa adicional.",
        link,
      };
      const { values: bodyParams, names: bodyParamNames } = buildParamsArray(variables, paramsOrder);

      const { data: logEntry } = await supabase
        .from("whatsapp_notification_logs")
        .insert({
          function_name: "notify-resident-decision",
          phone: r.phone,
          template_name: wabaTemplateName,
          template_language: wabaLanguage,
          condominium_id: condoId,
          resident_id: resident.id,
          recipient_role: r.role,
          success: false,
        })
        .select("id")
        .single();

      const logId = logEntry?.id || null;
      console.log(`Sending Meta template "${wabaTemplateName}" to ${r.phone} (${r.role})`);

      const result = await sendMetaTemplate({
        phone: r.phone,
        templateName: wabaTemplateName,
        language: wabaLanguage,
        bodyParams,
        bodyParamNames,
        buttonParams,
      });

      if (logId) {
        await supabase
          .from("whatsapp_notification_logs")
          .update({
            success: result.success,
            message_id: result.messageId || null,
            response_status: result.debug?.status || null,
            response_body: typeof result.debug?.response === "string" ? result.debug.response.substring(0, 2000) : null,
            request_payload: result.debug?.payload || null,
            error_message: result.error || null,
          })
          .eq("id", logId);
      }

      if (!result.success) {
        anyFailure = true;
        console.error(`Meta send failed for ${r.role}:`, result.error);
      }

      results.push({
        role: r.role,
        phone: r.phone,
        success: result.success,
        messageId: result.messageId,
        error: result.error,
        notification_id: logId,
      });
    }

    return new Response(
      JSON.stringify({ success: !anyFailure, results, responsible_party, responsible_name }),
      { status: anyFailure ? 207 : 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    console.error("Unexpected error:", error);

    if (notificationId) {
      await supabase
        .from("whatsapp_notification_logs")
        .update({ error_message: error.message || "Erro interno" })
        .eq("id", notificationId);
    }

    return new Response(
      JSON.stringify({ error: "Erro interno do servidor", details: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
