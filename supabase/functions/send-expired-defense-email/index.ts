import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import nodemailer from "npm:nodemailer@6.9.14";
import { jsPDF } from "npm:jspdf@2.5.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const TYPE_LABELS: Record<string, string> = {
  multa: "Multa",
  advertencia: "Advertência",
  notificacao: "Notificação",
};

interface Body {
  mode: "auto" | "manual" | "test";
  occurrence_id?: string;
  to?: string;
}

const json = (status: number, data: unknown) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

const fmtDate = (iso: string | null | undefined) => {
  if (!iso) return "-";
  try {
    return new Date(iso).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" });
  } catch {
    return iso;
  }
};

function buildPdf(occ: any): Uint8Array {
  const doc = new jsPDF();
  const condo = occ.condominiums || {};
  doc.setFontSize(16);
  doc.text(condo.name || "Condomínio", 14, 18);
  doc.setFontSize(11);
  doc.text(`${TYPE_LABELS[occ.type] || occ.type} — Defesa com prazo expirado`, 14, 26);
  if (occ.protocol) doc.text(`Protocolo: #${occ.protocol}`, 14, 33);

  doc.setLineWidth(0.3);
  doc.line(14, 37, 196, 37);

  const lines: [string, string][] = [
    ["Título", String(occ.title || "-")],
    ["Tipo", TYPE_LABELS[occ.type] || occ.type],
    ["Status", String(occ.status || "-")],
    ["Bloco / Apartamento", `${occ.blocks?.name || "-"} / ${occ.apartments?.number || "-"}`],
    ["Morador", String(occ.residents?.full_name || occ.resident_name || "-")],
    ["Responsável", String(occ.responsible_name || "-")],
    ["Data da ocorrência", fmtDate(occ.occurred_at)],
    ["Notificada em", fmtDate(occ.notified_at)],
    ["Prazo de defesa (dias)", String(condo.defense_deadline_days || "-")],
  ];

  let y = 46;
  doc.setFontSize(10);
  for (const [k, v] of lines) {
    doc.setFont("helvetica", "bold");
    doc.text(`${k}:`, 14, y);
    doc.setFont("helvetica", "normal");
    const wrapped = doc.splitTextToSize(v, 130);
    doc.text(wrapped, 60, y);
    y += Math.max(7, wrapped.length * 5);
    if (y > 270) { doc.addPage(); y = 20; }
  }

  doc.setFont("helvetica", "bold");
  doc.text("Descrição:", 14, y + 4);
  doc.setFont("helvetica", "normal");
  const desc = doc.splitTextToSize(String(occ.description || "-"), 180);
  doc.text(desc, 14, y + 10);

  const ab = doc.output("arraybuffer");
  return new Uint8Array(ab);
}

async function sendOne(opts: {
  supabase: any;
  smtpConfig: any;
  occurrence: any;
  recipient: string;
  triggered_by: "auto" | "manual";
  triggered_by_user: string | null;
}) {
  const { supabase, smtpConfig, occurrence, recipient, triggered_by, triggered_by_user } = opts;
  const condo = occurrence.condominiums || {};

  const transporter = nodemailer.createTransport({
    host: smtpConfig.host,
    port: Number(smtpConfig.port) || 587,
    secure: !!smtpConfig.secure,
    auth: { user: smtpConfig.username, pass: smtpConfig.password },
  });

  const pdf = buildPdf(occurrence);
  const subject = `[${condo.name || "Condomínio"}] Defesa expirada — ${TYPE_LABELS[occurrence.type] || occurrence.type} ${occurrence.protocol ? `#${occurrence.protocol}` : ""}`.trim();

  const html = `
    <div style="font-family:Arial,sans-serif;color:#111;max-width:640px;margin:0 auto">
      <h2 style="margin:0 0 8px">Defesa com prazo expirado</h2>
      <p style="margin:0 0 16px;color:#555">Encaminhamento automático à administradora do condomínio.</p>
      <table style="width:100%;border-collapse:collapse;font-size:14px">
        <tbody>
          ${[
            ["Condomínio", condo.name],
            ["Tipo", TYPE_LABELS[occurrence.type] || occurrence.type],
            ["Protocolo", occurrence.protocol ? `#${occurrence.protocol}` : "-"],
            ["Título", occurrence.title],
            ["Morador", occurrence.residents?.full_name || occurrence.resident_name || "-"],
            ["Responsável", occurrence.responsible_name || "-"],
            ["Bloco / Apto", `${occurrence.blocks?.name || "-"} / ${occurrence.apartments?.number || "-"}`],
            ["Data da ocorrência", fmtDate(occurrence.occurred_at)],
            ["Notificada em", fmtDate(occurrence.notified_at)],
            ["Prazo (dias)", condo.defense_deadline_days || "-"],
          ].map(([k, v]) => `
            <tr>
              <td style="padding:6px 8px;border-bottom:1px solid #eee;color:#666;width:180px"><b>${k}</b></td>
              <td style="padding:6px 8px;border-bottom:1px solid #eee">${String(v ?? "-")}</td>
            </tr>`).join("")}
        </tbody>
      </table>
      <p style="margin:16px 0 4px"><b>Descrição:</b></p>
      <p style="margin:0;white-space:pre-wrap;background:#f7f7f8;padding:12px;border-radius:6px;font-size:14px">${
        String(occurrence.description || "-").replace(/[<>&]/g, (c) => ({ "<":"&lt;",">":"&gt;","&":"&amp;" } as any)[c])
      }</p>
      <p style="margin:24px 0 0;color:#888;font-size:12px">PDF da ${TYPE_LABELS[occurrence.type] || "ocorrência"} segue em anexo.</p>
    </div>`;

  const result = await transporter.sendMail({
    from: `"${smtpConfig.from_name}" <${smtpConfig.from_email}>`,
    to: recipient,
    subject,
    html,
    attachments: [{
      filename: `${(TYPE_LABELS[occurrence.type] || "ocorrencia").toLowerCase()}_${occurrence.protocol || occurrence.id.slice(0,8)}.pdf`,
      content: pdf,
      contentType: "application/pdf",
    }],
  });

  await supabase.from("expired_defense_email_logs").insert({
    occurrence_id: occurrence.id,
    condominium_id: occurrence.condominium_id,
    recipient_email: recipient,
    success: true,
    message_id: result?.messageId || null,
    triggered_by,
    triggered_by_user,
  });

  return { success: true, messageId: result?.messageId };
}

async function logFailure(supabase: any, occurrence: any, recipient: string | null, err: string, triggered_by: "auto"|"manual", triggered_by_user: string | null) {
  try {
    await supabase.from("expired_defense_email_logs").insert({
      occurrence_id: occurrence.id,
      condominium_id: occurrence.condominium_id,
      recipient_email: recipient,
      success: false,
      error_message: err.slice(0, 1000),
      triggered_by,
      triggered_by_user,
    });
  } catch (e) {
    console.error("Failed to log failure:", e);
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    let body: Body = { mode: "auto" };
    try { body = await req.json(); } catch { /* default */ }

    // Quem disparou?
    let triggered_by_user: string | null = null;
    const authHeader = req.headers.get("Authorization");
    if (authHeader && body.mode !== "auto") {
      try {
        const token = authHeader.replace(/^Bearer\s+/i, "");
        const { data } = await supabase.auth.getUser(token);
        triggered_by_user = data.user?.id || null;
      } catch { /* ignore */ }
    }

    // Carrega SMTP ativo
    const { data: smtpConfig, error: smtpErr } = await supabase
      .from("smtp_config")
      .select("*")
      .eq("is_active", true)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (smtpErr || !smtpConfig) {
      return json(400, { error: "SMTP não configurado. Cadastre em /superadmin/smtp." });
    }

    // Modo teste
    if (body.mode === "test") {
      if (!body.to) return json(400, { error: "Informe o e-mail destinatário ('to')." });
      const transporter = nodemailer.createTransport({
        host: smtpConfig.host,
        port: Number(smtpConfig.port) || 587,
        secure: !!smtpConfig.secure,
        auth: { user: smtpConfig.username, pass: smtpConfig.password },
      });
      const result = await transporter.sendMail({
        from: `"${smtpConfig.from_name}" <${smtpConfig.from_email}>`,
        to: body.to,
        subject: "Teste SMTP — NotificaCondo",
        html: `<p>Este é um e-mail de teste enviado pela configuração SMTP do NotificaCondo.</p><p>Host: <b>${smtpConfig.host}</b><br/>Porta: <b>${smtpConfig.port}</b></p>`,
      });
      return json(200, { success: true, messageId: result?.messageId });
    }

    // Helper: busca ocorrência completa
    const occSelect = `
      *,
      condominiums!inner(id, name, administradora_email, defense_deadline_days),
      blocks(name),
      apartments(number),
      residents(full_name)
    `;

    if (body.mode === "manual") {
      if (!body.occurrence_id) return json(400, { error: "occurrence_id obrigatório." });
      const { data: occ, error: occErr } = await supabase
        .from("occurrences")
        .select(occSelect)
        .eq("id", body.occurrence_id)
        .maybeSingle();
      if (occErr || !occ) return json(404, { error: "Ocorrência não encontrada." });

      const recipient = occ.condominiums?.administradora_email;
      if (!recipient) {
        await logFailure(supabase, occ, null, "Condomínio sem e-mail da administradora cadastrado.", "manual", triggered_by_user);
        return json(400, { error: "Condomínio sem e-mail da administradora cadastrado." });
      }
      try {
        const r = await sendOne({ supabase, smtpConfig, occurrence: occ, recipient, triggered_by: "manual", triggered_by_user });
        return json(200, r);
      } catch (e: any) {
        const msg = e?.message || String(e);
        await logFailure(supabase, occ, recipient, msg, "manual", triggered_by_user);
        return json(500, { error: msg });
      }
    }

    // mode = auto
    const { data: candidates, error: listErr } = await supabase
      .from("occurrences")
      .select(occSelect)
      .eq("type", "multa")
      .in("status", ["notificado", "em_defesa"]);

    if (listErr) return json(500, { error: listErr.message });

    const now = Date.now();
    const sent: any[] = [];
    const skipped: any[] = [];
    const failed: any[] = [];

    for (const occ of candidates || []) {
      const days = occ.condominiums?.defense_deadline_days;
      const start = occ.notified_at || occ.created_at;
      if (!days || !start) { skipped.push({ id: occ.id, reason: "sem prazo/notificado_at" }); continue; }
      const deadline = new Date(start).getTime() + Number(days) * 86400000;
      if (deadline > now) { continue; }

      const recipient = occ.condominiums?.administradora_email;
      if (!recipient) {
        skipped.push({ id: occ.id, reason: "sem administradora_email" });
        continue;
      }

      // já enviado com sucesso?
      const { data: existing } = await supabase
        .from("expired_defense_email_logs")
        .select("id")
        .eq("occurrence_id", occ.id)
        .eq("success", true)
        .limit(1);
      if (existing && existing.length > 0) { skipped.push({ id: occ.id, reason: "já enviado" }); continue; }

      try {
        const r = await sendOne({ supabase, smtpConfig, occurrence: occ, recipient, triggered_by: "auto", triggered_by_user: null });
        sent.push({ id: occ.id, messageId: r.messageId });
      } catch (e: any) {
        const msg = e?.message || String(e);
        await logFailure(supabase, occ, recipient, msg, "auto", null);
        failed.push({ id: occ.id, error: msg });
      }
    }

    return json(200, { success: true, sent: sent.length, skipped: skipped.length, failed: failed.length, details: { sent, skipped, failed } });
  } catch (e: any) {
    console.error("send-expired-defense-email error:", e);
    return json(500, { error: e?.message || "Erro interno" });
  }
});
