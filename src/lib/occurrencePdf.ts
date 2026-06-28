import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { supabase } from "@/integrations/supabase/client";
import { fetchOccurrencePdfTemplate, interpolate } from "@/hooks/useOccurrencePdfTemplate";

export interface OccurrencePdfBundle {
  occurrence: any;
  evidences: any[];
  defenses: any[];
  decisions: any[];
  notifications: any[];
  accessLogs: any[];
  sindicoName: string;
  pdfTemplate: any;
}

const loadImageAsDataUrl = async (
  url: string
): Promise<{ dataUrl: string; format: "JPEG" | "PNG"; width: number; height: number } | null> => {
  try {
    const response = await fetch(url, { mode: "cors" });
    if (!response.ok) return null;
    const blob = await response.blob();
    const dataUrl: string = await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
    const dims: { width: number; height: number } = await new Promise((resolve) => {
      const img = new Image();
      img.onload = () => resolve({ width: img.naturalWidth, height: img.naturalHeight });
      img.onerror = () => resolve({ width: 0, height: 0 });
      img.src = dataUrl;
    });
    const isPng = blob.type.includes("png");
    return { dataUrl, format: isPng ? "PNG" : "JPEG", width: dims.width, height: dims.height };
  } catch {
    return null;
  }
};

export async function loadOccurrencePdfBundle(occurrenceId: string): Promise<OccurrencePdfBundle | null> {
  const { data: occurrence } = await supabase
    .from("occurrences")
    .select(`
      *,
      condominiums(name, defense_deadline_days, address, address_number, neighborhood, city, state, zip_code, owner_id, logo_url, sindico_name),
      blocks(name),
      apartments(number),
      residents(id, full_name, email, phone, bsuid)
    `)
    .eq("id", occurrenceId)
    .maybeSingle();
  if (!occurrence) return null;

  const [evRes, defRes, decRes, notRes, accRes] = await Promise.all([
    supabase.from("occurrence_evidences").select("*").eq("occurrence_id", occurrenceId).order("created_at", { ascending: true }),
    supabase.from("defenses").select(`*, residents(full_name), defense_attachments(id, file_url, file_type)`).eq("occurrence_id", occurrenceId).order("submitted_at", { ascending: true }),
    supabase.from("decisions").select("*").eq("occurrence_id", occurrenceId).order("decided_at", { ascending: true }),
    supabase.from("notifications_sent").select("*").eq("occurrence_id", occurrenceId).order("sent_at", { ascending: true }),
    supabase.from("magic_link_access_logs").select("id, ip_address, user_agent, created_at, resident_id").eq("occurrence_id", occurrenceId).eq("success", true).order("created_at", { ascending: true }),
  ]);

  let sindicoName: string = (occurrence as any).condominiums?.sindico_name || "";
  if (!sindicoName && (occurrence as any).condominiums?.owner_id) {
    const { data: ownerProfile } = await supabase
      .from("profiles")
      .select("full_name")
      .eq("user_id", (occurrence as any).condominiums.owner_id)
      .maybeSingle();
    if (ownerProfile?.full_name) sindicoName = ownerProfile.full_name;
  }
  if (!sindicoName) sindicoName = "Síndico(a)";

  const pdfTemplate = await fetchOccurrencePdfTemplate();

  return {
    occurrence,
    evidences: evRes.data || [],
    defenses: defRes.data || [],
    decisions: decRes.data || [],
    notifications: notRes.data || [],
    accessLogs: accRes.data || [],
    sindicoName,
    pdfTemplate,
  };
}

export async function buildOccurrencePdf(
  bundle: OccurrencePdfBundle
): Promise<{ doc: jsPDF; filename: string }> {
  const { occurrence, evidences, defenses, decisions, notifications, accessLogs, sindicoName, pdfTemplate } = bundle;

  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 20;
  const contentWidth = pageWidth - margin * 2;
  let yPos = margin;

  const drawJustified = (
    text: string,
    x: number,
    y: number,
    maxWidth: number,
    lineHeight = 5,
    firstLineIndent = 0
  ): number => {
    const paragraphs = String(text).split(/\n/);
    let cursorY = y;
    paragraphs.forEach((para) => {
      const firstLineWidth = Math.max(10, maxWidth - firstLineIndent);
      const words = para.split(/\s+/).filter(Boolean);
      const lines: { text: string; indent: number; width: number }[] = [];
      let current: string[] = [];
      let isFirst = true;
      const widthOf = (s: string) => doc.getTextWidth(s);
      const flush = () => {
        lines.push({
          text: current.join(" "),
          indent: isFirst ? firstLineIndent : 0,
          width: isFirst ? firstLineWidth : maxWidth,
        });
        current = [];
        isFirst = false;
      };
      words.forEach((w) => {
        const tentative = current.length ? current.join(" ") + " " + w : w;
        const limit = isFirst ? firstLineWidth : maxWidth;
        if (widthOf(tentative) > limit && current.length) {
          flush();
          current = [w];
        } else {
          current.push(w);
        }
      });
      if (current.length) flush();

      lines.forEach((line, idx) => {
        const isLast = idx === lines.length - 1;
        const lineWords = line.text.split(" ").filter(Boolean);
        const drawX = x + line.indent;
        if (isLast || lineWords.length < 2) {
          doc.text(line.text, drawX, cursorY);
        } else {
          const wordsWidth = lineWords.reduce((s, w) => s + widthOf(w), 0);
          const gap = (line.width - wordsWidth) / (lineWords.length - 1);
          let cx = drawX;
          lineWords.forEach((w) => {
            doc.text(w, cx, cursorY);
            cx += widthOf(w) + gap;
          });
        }
        cursorY += lineHeight;
      });
    });
    return cursorY;
  };

  const typeLabels: Record<string, string> = {
    advertencia: "Advertência",
    notificacao: "Notificação",
    multa: "Multa",
  };

  const refLabels: Record<string, string> = {
    advertencia: "ADVERTÊNCIA – Infração a Convenção",
    notificacao: "NOTIFICAÇÃO – Infração a Convenção",
    multa: "MULTA – Infração a Convenção",
  };

  const formatFullDate = (dateStr: string) => {
    const date = new Date(dateStr);
    const months = [
      "janeiro", "fevereiro", "março", "abril", "maio", "junho",
      "julho", "agosto", "setembro", "outubro", "novembro", "dezembro",
    ];
    return `${date.getDate().toString().padStart(2, "0")} de ${months[date.getMonth()]} de ${date.getFullYear()}`;
  };

  const numberToPortugueseWords = (num: number): string => {
    const units = ["", "um", "dois", "três", "quatro", "cinco", "seis", "sete", "oito", "nove"];
    const teens = ["dez", "onze", "doze", "treze", "quatorze", "quinze", "dezesseis", "dezessete", "dezoito", "dezenove"];
    const tens = ["", "", "vinte", "trinta", "quarenta", "cinquenta", "sessenta", "setenta", "oitenta", "noventa"];
    if (num < 10) return units[num];
    if (num < 20) return teens[num - 10];
    if (num < 100) {
      const ten = Math.floor(num / 10);
      const unit = num % 10;
      return unit === 0 ? tens[ten] : `${tens[ten]} e ${units[unit]}`;
    }
    return String(num);
  };

  const formatShortDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return `${date.getDate().toString().padStart(2, "0")}/${(date.getMonth() + 1).toString().padStart(2, "0")}/${date.getFullYear()}`;
  };

  const formatTime = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
  };

  const condo = occurrence.condominiums;
  const condominiumName = condo?.name || "Condomínio";
  const city = condo?.city || "";
  const stateUf = condo?.state || "";
  const cityState = [city, stateUf].filter(Boolean).join("/");
  const fullAddress = [
    [condo?.address, condo?.address_number].filter(Boolean).join(", "),
    condo?.neighborhood,
  ]
    .filter(Boolean)
    .join(" – ");
  const addressLine = [fullAddress, cityState].filter(Boolean).join(" – ");
  const cepLine = condo?.zip_code ? `CEP: ${condo.zip_code}` : "";

  const refNumber = `${new Date().getFullYear()}/${occurrence.id.slice(-4).toUpperCase()}`;

  const footerReserve = 27;
  const bottomLimit = pageHeight - footerReserve;

  const today = occurrence.created_at || new Date().toISOString();
  const headerCity = city || "São Paulo";
  const blockName = occurrence.blocks?.name || "-";
  const aptNumber = occurrence.apartments?.number || "-";

  const renderTopBlock = async (): Promise<number> => {
    let topY = margin;
    const topStartY = topY;
    const rightColX = pageWidth - margin;

    doc.setFontSize(11);
    doc.setTextColor(33, 33, 33);
    doc.setFont("helvetica", "normal");
    doc.text(`${headerCity}, ${formatFullDate(today)}`, rightColX, topStartY, { align: "right" });

    let rightYAfter = topStartY;
    if (condo?.logo_url) {
      const logoData = await loadImageAsDataUrl(condo.logo_url);
      if (logoData && logoData.width > 0) {
        const maxLogoH = 22;
        const maxLogoW = 55;
        const ratio = logoData.width / logoData.height;
        let logoH = maxLogoH;
        let logoW = logoH * ratio;
        if (logoW > maxLogoW) {
          logoW = maxLogoW;
          logoH = logoW / ratio;
        }
        const logoX = rightColX - logoW;
        const logoY = topStartY + 6;
        try {
          doc.addImage(logoData.dataUrl, logoData.format, logoX, logoY, logoW, logoH);
          rightYAfter = logoY + logoH;
        } catch (e) {
          console.warn("Failed to add logo to PDF", e);
        }
      }
    }

    let leftY = topStartY + 12;
    doc.setFontSize(11);
    doc.setFont("helvetica", "normal");
    doc.text("Ao Senhor(a):", margin, leftY);
    leftY += 6;
    doc.setFont("helvetica", "bold");
    doc.text((occurrence.residents?.full_name || "Não identificado").toUpperCase(), margin, leftY);
    leftY += 6;

    doc.setFont("helvetica", "bold");
    doc.text(blockName, margin, leftY);
    const blockWidth = doc.getTextWidth(blockName);
    doc.setFont("helvetica", "normal");
    doc.text("APTO: ", margin + blockWidth + 6, leftY);
    doc.setFont("helvetica", "bold");
    doc.text(aptNumber, margin + blockWidth + 6 + doc.getTextWidth("APTO: "), leftY);
    leftY += 6;

    doc.setFont("helvetica", "normal");
    doc.text(condominiumName.toUpperCase(), margin, leftY);
    leftY += 5;
    if (addressLine) {
      doc.setFontSize(10);
      doc.text(addressLine, margin, leftY);
      leftY += 5;
    }
    if (cepLine) {
      doc.text(cepLine, margin, leftY);
      leftY += 5;
    }

    return Math.max(leftY, rightYAfter) + 8;
  };

  yPos = await renderTopBlock();

  const ensureSpace = async (needed: number) => {
    if (yPos + needed > bottomLimit) {
      doc.addPage();
      yPos = await renderTopBlock();
    }
  };

  const drawJustifiedPaginated = async (
    text: string,
    lineHeight = 5,
    firstLineIndent = 0
  ): Promise<void> => {
    const paragraphs = String(text).split(/\n/);
    for (const para of paragraphs) {
      await ensureSpace(lineHeight);
      const words = para.split(/\s+/).filter(Boolean);
      let current: string[] = [];
      let isFirst = true;
      const firstLineWidth = Math.max(10, contentWidth - firstLineIndent);
      const widthOf = (s: string) => doc.getTextWidth(s);
      const lines: { text: string; indent: number; width: number }[] = [];
      const flush = () => {
        lines.push({
          text: current.join(" "),
          indent: isFirst ? firstLineIndent : 0,
          width: isFirst ? firstLineWidth : contentWidth,
        });
        current = [];
        isFirst = false;
      };
      words.forEach((w) => {
        const tentative = current.length ? current.join(" ") + " " + w : w;
        const limit = isFirst ? firstLineWidth : contentWidth;
        if (widthOf(tentative) > limit && current.length) {
          flush();
          current = [w];
        } else {
          current.push(w);
        }
      });
      if (current.length) flush();

      for (let idx = 0; idx < lines.length; idx++) {
        await ensureSpace(lineHeight);
        const line = lines[idx];
        const isLast = idx === lines.length - 1;
        const lineWords = line.text.split(" ").filter(Boolean);
        const drawX = margin + line.indent;
        if (isLast || lineWords.length < 2) {
          doc.text(line.text, drawX, yPos);
        } else {
          const wordsWidth = lineWords.reduce((s, w) => s + widthOf(w), 0);
          const gap = (line.width - wordsWidth) / (lineWords.length - 1);
          let cx = drawX;
          lineWords.forEach((w) => {
            doc.text(w, cx, yPos);
            cx += widthOf(w) + gap;
          });
        }
        yPos += lineHeight;
      }
    }
  };

  await ensureSpace(10);
  doc.setFontSize(11);
  doc.setFont("helvetica", "bolditalic");
  doc.text(`Ref.: ${refNumber} - ${refLabels[occurrence.type] || "Ocorrência"}`, margin, yPos);
  yPos += 10;

  await ensureSpace(8);
  doc.setFont("helvetica", "normal");
  doc.text("Prezado Condômino,", margin, yPos);
  yPos += 8;

  const indent = 12;

  const occurrenceDate = formatShortDate(occurrence.occurred_at);
  const occurrenceTime = formatTime(occurrence.occurred_at);
  const deadlineDays = occurrence.condominiums?.defense_deadline_days || 10;
  const deadlineWritten =
    deadlineDays === 10 ? "10 (dez)" : `${deadlineDays} (${numberToPortugueseWords(deadlineDays)})`;
  const templateVars: Record<string, string> = {
    data: occurrenceDate,
    hora: occurrenceTime,
    bloco: occurrence.blocks?.name || "",
    apartamento: occurrence.apartments?.number || "",
    morador: occurrence.residents?.full_name || "",
    descricao_ocorrencia: occurrence.description || "",
    local: occurrence.location || "",
    condominio: occurrence.condominiums?.name || "",
    sindico: sindicoName || "",
    prazo_defesa: deadlineWritten,
    percentual_multa: String(
      (occurrence as any)?.fine_percentage ??
        (occurrence.condominiums as any)?.fine_percentage ??
        50,
    ),
  };

  const introParagraph = interpolate(pdfTemplate.intro_paragraph, templateVars);
  if (introParagraph.trim()) {
    await drawJustifiedPaginated(introParagraph, 5, indent);
    yPos += 6;
  }

  const legalParts: string[] = [];
  if (occurrence.civil_code_article) legalParts.push(`Código Civil - Art. ${occurrence.civil_code_article}`);
  if (occurrence.convention_article) legalParts.push(`Convenção - Art. ${occurrence.convention_article}`);
  if (occurrence.internal_rules_article) legalParts.push(`Art. ${occurrence.internal_rules_article} do Regimento Interno`);

  if (legalParts.length > 0 || occurrence.legal_basis) {
    const prefix = legalParts.length > 0 ? `Conforme ${legalParts.join(", ")}: ` : "";
    const legalText = `${prefix}${occurrence.legal_basis || ""}`.trim();
    const padY = 4;
    const lineH = 5;
    doc.setFont("helvetica", "bolditalic");
    doc.setFontSize(11);
    const legalLines = doc.splitTextToSize(legalText, contentWidth);
    const blockHeight = legalLines.length * lineH + padY * 2;
    await ensureSpace(blockHeight + 2);
    doc.setFillColor(255, 249, 196);
    doc.rect(margin, yPos, contentWidth, blockHeight, "F");
    doc.setTextColor(33, 33, 33);
    let ty = yPos + padY + 4;
    legalLines.forEach((ln: string) => {
      doc.text(ln, margin + 2, ty);
      ty += lineH;
    });
    yPos += blockHeight + 8;
    doc.setFont("helvetica", "normal");
  }

  let descriptionParagraph = `No dia ${occurrenceDate}, por volta das ${occurrenceTime}`;
  if (occurrence.location) descriptionParagraph += `, no local: ${occurrence.location}`;
  descriptionParagraph += `, foi constatado que: ${occurrence.description}`;
  await drawJustifiedPaginated(descriptionParagraph, 5, indent);
  yPos += 6;

  const rolePara = interpolate(pdfTemplate.syndic_role_paragraph, templateVars);
  if (rolePara.trim()) {
    await drawJustifiedPaginated(rolePara, 5, indent);
    yPos += 6;
  }

  let penaltyTemplate = pdfTemplate.penalty_notificacao_paragraph;
  if (occurrence.type === "multa") penaltyTemplate = pdfTemplate.penalty_multa_paragraph;
  else if (occurrence.type === "advertencia") penaltyTemplate = pdfTemplate.penalty_advertencia_paragraph;
  const penaltyParagraph = interpolate(penaltyTemplate, templateVars);
  if (penaltyParagraph.trim()) {
    await drawJustifiedPaginated(penaltyParagraph, 5, indent);
    yPos += 6;
  }

  const defenseParagraph = interpolate(pdfTemplate.defense_deadline_paragraph, templateVars);
  if (defenseParagraph.trim()) {
    await drawJustifiedPaginated(defenseParagraph, 5, indent);
    yPos += 6;
  }

  const closingPara = interpolate(pdfTemplate.closing_remarks, templateVars);
  if (closingPara.trim()) {
    await drawJustifiedPaginated(closingPara, 5, indent);
    yPos += 10;
  }

  const signatureGapAfterLabel = 8;
  const signatureLineHeight = 5;
  const signatureBlockHeight = signatureGapAfterLabel + signatureLineHeight * 2;
  const signatureBottomLimit = pageHeight - 27;
  if (yPos + signatureBlockHeight > signatureBottomLimit) {
    doc.addPage();
    yPos = await renderTopBlock();
  }
  doc.text(pdfTemplate.signature_label || "Atenciosamente;", margin, yPos);
  yPos += signatureGapAfterLabel;

  doc.setFont("helvetica", "bold");
  doc.text(condominiumName.toUpperCase(), margin, yPos);
  yPos += 5;
  doc.text("SÍNDICO", margin, yPos);
  yPos += 5;
  doc.text(sindicoName.toUpperCase(), margin, yPos);

  const imageEvidences = evidences.filter((e: any) => e.file_type?.toLowerCase().startsWith("image"));
  if (imageEvidences.length > 0) {
    doc.addPage();
    yPos = await renderTopBlock();

    doc.setFontSize(13);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(33, 33, 33);
    doc.text("AUTO DE INFRAÇÃO:", margin, yPos);
    yPos += 8;

    doc.setFontSize(11);
    doc.setFont("helvetica", "normal");
    doc.text(`DATA: ${occurrenceDate}`, margin, yPos);
    yPos += 6;
    if (occurrence.location) {
      doc.text(`LOCAL: ${occurrence.location}`, margin, yPos);
      yPos += 6;
    }
    yPos += 4;

    const targetW = contentWidth * 0.6;
    for (let i = 0; i < imageEvidences.length; i++) {
      const ev = imageEvidences[i];
      const imgData = await loadImageAsDataUrl(ev.file_url);
      if (!imgData || imgData.width <= 0) continue;
      const ratio = imgData.width / imgData.height;
      let drawW = targetW;
      let drawH = drawW / ratio;
      const maxH = (pageHeight - margin - 35) * 0.55;
      if (drawH > maxH) {
        drawH = maxH;
        drawW = drawH * ratio;
      }
      const captionH = 6;
      if (yPos + drawH + captionH + 4 > pageHeight - 35) {
        doc.addPage();
        yPos = await renderTopBlock();
      }
      const xCenter = margin + (contentWidth - drawW) / 2;
      try {
        doc.addImage(imgData.dataUrl, imgData.format, xCenter, yPos, drawW, drawH);
        yPos += drawH + 2;
        doc.setFontSize(9);
        doc.setTextColor(100, 100, 100);
        doc.text(`Evidência ${i + 1} de ${imageEvidences.length}`, pageWidth / 2, yPos + 4, { align: "center" });
        doc.setFontSize(11);
        doc.setTextColor(33, 33, 33);
        yPos += captionH + 6;
      } catch (err) {
        console.error("Erro ao embedar imagem:", err);
      }
    }
  }

  if (defenses.length > 0) {
    doc.addPage();
    yPos = margin;
    doc.setFontSize(14);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(33, 33, 33);
    doc.text("DEFESA(S) APRESENTADA(S)", pageWidth / 2, yPos, { align: "center" });
    yPos += 12;

    defenses.forEach((defense: any, index: number) => {
      if (yPos > pageHeight - 50) {
        doc.addPage();
        yPos = margin;
      }
      doc.setFontSize(11);
      doc.setFont("helvetica", "bold");
      doc.text(`Defesa ${index + 1} - ${defense.residents?.full_name || "Morador"}`, margin, yPos);
      yPos += 6;
      doc.setFontSize(9);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(100, 100, 100);
      doc.text(
        `Prazo: ${formatShortDate(defense.deadline)} | Enviada em: ${formatShortDate(defense.submitted_at)}`,
        margin,
        yPos
      );
      yPos += 8;
      doc.setFontSize(10);
      doc.setTextColor(33, 33, 33);
      const dl = doc.splitTextToSize(defense.content, contentWidth);
      doc.text(dl, margin, yPos);
      yPos += dl.length * 5 + 12;
    });
  }

  if (decisions.length > 0) {
    doc.addPage();
    yPos = margin;
    doc.setFontSize(14);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(33, 33, 33);
    doc.text("DECISÃO", pageWidth / 2, yPos, { align: "center" });
    yPos += 12;

    const statusLabels: Record<string, string> = {
      arquivada: "ARQUIVADA",
      advertido: "ADVERTÊNCIA MANTIDA",
      multado: "MULTA APLICADA",
    };

    decisions.forEach((decision: any) => {
      if (yPos > pageHeight - 50) {
        doc.addPage();
        yPos = margin;
      }
      doc.setFontSize(12);
      doc.setFont("helvetica", "bold");
      doc.text(`Resultado: ${statusLabels[decision.decision] || decision.decision}`, margin, yPos);
      yPos += 8;
      doc.setFontSize(9);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(100, 100, 100);
      doc.text(`Data da decisão: ${formatShortDate(decision.decided_at)}`, margin, yPos);
      yPos += 8;
      doc.setFontSize(10);
      doc.setTextColor(33, 33, 33);
      doc.text("Justificativa:", margin, yPos);
      yPos += 6;
      const jl = doc.splitTextToSize(decision.justification, contentWidth);
      doc.text(jl, margin, yPos);
      yPos += jl.length * 5 + 12;
    });
  }

  {
    type TLRow = { date: string; title: string; detail: string };
    const tlRows: TLRow[] = [];

    tlRows.push({
      date: occurrence.created_at,
      title: "Ocorrência Registrada",
      detail: occurrence.title || "",
    });

    evidences.forEach((ev: any, i: number) => {
      tlRows.push({
        date: ev.created_at,
        title: `Prova Adicionada #${i + 1}`,
        detail: ev.description || `Arquivo ${ev.file_type || ""}`.trim(),
      });
    });

    const statusLabelMap: Record<string, string> = {
      accepted: "Aceita pelo provedor",
      sent: "Enviada",
      delivered: "Entregue no aparelho",
      read: "Lida pelo morador",
      failed: "Falha no envio",
    };

    notifications.forEach((n: any) => {
      tlRows.push({
        date: n.sent_at,
        title: "Notificação Enviada (WhatsApp)",
        detail: `Via: ${n.sent_via || "WhatsApp"}`,
      });
      if (n.accepted_at)
        tlRows.push({ date: n.accepted_at, title: "Notificação Aceita pelo Provedor", detail: "" });
      if (n.delivered_at) {
        const phone = occurrence.residents?.phone || "";
        const bsuid = occurrence.residents?.bsuid || "";
        const parts: string[] = [];
        if (phone) parts.push(`Celular: ${phone}`);
        if (bsuid) parts.push(`BSUID: ${bsuid}`);
        tlRows.push({
          date: n.delivered_at,
          title: "Notificação Entregue no Aparelho",
          detail: parts.join(" | "),
        });
      }
      if (n.read_at)
        tlRows.push({ date: n.read_at, title: "Notificação Lida pelo Morador", detail: "" });
      if (n.acknowledged_at)
        tlRows.push({
          date: n.acknowledged_at,
          title: "Notificação Confirmada (Ciência)",
          detail: "Morador confirmou ciência da notificação",
        });
      if (n.zpro_status === "failed") {
        tlRows.push({
          date: n.sent_at,
          title: "Falha na Entrega",
          detail: statusLabelMap.failed,
        });
      }
    });

    accessLogs.forEach((log: any) => {
      const ip = (log.ip_address || "").split(",")[0].trim();
      tlRows.push({
        date: log.created_at,
        title: "Ocorrência Aberta e Lida",
        detail: ip ? `IP: ${ip}` : "Acessada pelo morador",
      });
    });

    defenses.forEach((def: any, i: number) => {
      tlRows.push({
        date: def.submitted_at,
        title: `Defesa Apresentada #${i + 1}`,
        detail: (def.residents?.full_name ? `${def.residents.full_name} — ` : "") +
          (def.content || ""),
      });
    });

    decisions.forEach((dec: any) => {
      const decLabels: Record<string, string> = {
        arquivada: "Arquivada",
        advertido: "Advertência Aplicada",
        multado: "Multa Aplicada",
      };
      tlRows.push({
        date: dec.decided_at,
        title: `Decisão: ${decLabels[dec.decision] || dec.decision}`,
        detail: dec.justification?.slice(0, 200) || "",
      });
    });

    tlRows.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

    if (tlRows.length > 0) {
      doc.addPage();
      yPos = margin;
      doc.setFontSize(14);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(33, 33, 33);
      doc.text("LINHA DO TEMPO (PROVAS)", pageWidth / 2, yPos, { align: "center" });
      yPos += 6;
      doc.setFontSize(9);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(100, 100, 100);
      doc.text(
        "Registro cronológico de todos os eventos relacionados a esta ocorrência.",
        pageWidth / 2,
        yPos + 4,
        { align: "center" }
      );
      yPos += 10;

      autoTable(doc, {
        startY: yPos,
        head: [["Data/Hora", "Evento", "Detalhes"]],
        body: tlRows.map((r) => [
          `${formatShortDate(r.date)} ${formatTime(r.date)}`,
          r.title,
          r.detail,
        ]),
        styles: { fontSize: 9, cellPadding: 2, textColor: [33, 33, 33], overflow: "linebreak" },
        headStyles: { fillColor: [33, 33, 33], textColor: 255, fontStyle: "bold" },
        alternateRowStyles: { fillColor: [245, 245, 245] },
        columnStyles: {
          0: { cellWidth: 32 },
          1: { cellWidth: 55, fontStyle: "bold" },
          2: { cellWidth: "auto" },
        },
        margin: { left: margin, right: margin, bottom: 30 },
        theme: "grid",
      });
    }
  }

  const totalPages = doc.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    doc.setDrawColor(200, 200, 200);
    doc.line(margin, pageHeight - 25, pageWidth - margin, pageHeight - 25);
    doc.setFontSize(9);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(33, 33, 33);
    doc.text(condominiumName, pageWidth / 2, pageHeight - 18, { align: "center" });
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(100, 100, 100);
    if (addressLine) {
      doc.text(addressLine, pageWidth / 2, pageHeight - 13, { align: "center" });
    }
    if (cepLine) {
      doc.text(cepLine, pageWidth / 2, pageHeight - 9, { align: "center" });
    }
    doc.text(`Página ${i} de ${totalPages}`, pageWidth - margin, pageHeight - 5, { align: "right" });
  }

  const residentName =
    occurrence.residents?.full_name?.replace(/[^a-zA-Z0-9]/g, "_").substring(0, 20) || "morador";
  const blockApt = `BL_${blockName}_APTO_${aptNumber}`;
  const typeLabel = typeLabels[occurrence.type]?.toUpperCase() || "OCORRENCIA";
  const filename = `${typeLabel}_-_${blockApt}_-_${residentName}.pdf`;

  return { doc, filename };
}

export async function generateOccurrencePdfBase64(
  occurrenceId: string
): Promise<{ base64: string; filename: string } | null> {
  const bundle = await loadOccurrencePdfBundle(occurrenceId);
  if (!bundle) return null;
  const { doc, filename } = await buildOccurrencePdf(bundle);
  // jsPDF datauristring returns "data:application/pdf;filename=...;base64,XXXX"
  const dataUri = doc.output("datauristring");
  const base64 = dataUri.split(",")[1] || "";
  return { base64, filename };
}

export async function downloadOccurrencePdf(occurrenceId: string): Promise<string | null> {
  const bundle = await loadOccurrencePdfBundle(occurrenceId);
  if (!bundle) return null;
  const { doc, filename } = await buildOccurrencePdf(bundle);
  doc.save(filename);
  return filename;
}
