import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import QRCode from "qrcode";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { supabase } from "@/integrations/supabase/client";
import { getSignedPackagePhotoUrl } from "@/lib/packageStorage";
import { DEFAULT_TEMPLATES } from "@/components/superadmin/whatsapp/DefaultTemplates";

function renderPackageArrivalMessage(pkg: PackageData): string {
  const template = DEFAULT_TEMPLATES.package_arrival;
  const vars: Record<string, string> = {
    nome: pkg.resident?.full_name || "",
    bloco: pkg.block?.name || "",
    apartamento: pkg.apartment?.number || "",
    tipo_encomenda: pkg.package_type?.name || "Encomenda",
    codigo_rastreio: pkg.tracking_code || "—",
    porteiro: pkg.received_by_name || pkg.received_by_profile?.full_name || "—",
    numeropedido: pkg.pickup_code || "",
    condominio: pkg.condominium?.name || "",
  };
  return template.replace(/\{(\w+)\}/g, (_, k) => vars[k] ?? `{${k}}`);
}

/** Draws a WhatsApp-like message bubble with *bold* markdown support. Returns final Y. */
function drawWhatsAppBubble(
  doc: jsPDF,
  text: string,
  x: number,
  y: number,
  width: number,
): number {
  const paddingX = 4;
  const paddingY = 4;
  const lineHeight = 4.2;
  const fontSize = 9;
  doc.setFontSize(fontSize);

  const rawLines = text.split("\n");
  // Wrap each line, preserving blank lines
  const wrapped: string[] = [];
  for (const line of rawLines) {
    if (line.trim() === "") {
      wrapped.push("");
      continue;
    }
    // splitTextToSize handles wrapping using currently set font
    doc.setFont("helvetica", "normal");
    const parts = doc.splitTextToSize(line, width - paddingX * 2) as string[];
    wrapped.push(...parts);
  }

  const bubbleHeight = paddingY * 2 + wrapped.length * lineHeight;
  // Bubble background (WhatsApp light green)
  doc.setFillColor(220, 248, 198);
  doc.setDrawColor(200, 230, 180);
  doc.roundedRect(x, y, width, bubbleHeight, 2, 2, "FD");

  doc.setTextColor(20, 20, 20);
  let cursorY = y + paddingY + lineHeight - 1;

  for (const line of wrapped) {
    // Render with *bold* segments
    const segments = line.split(/(\*[^*]+\*)/g).filter(Boolean);
    let cursorX = x + paddingX;
    for (const seg of segments) {
      if (seg.startsWith("*") && seg.endsWith("*") && seg.length > 2) {
        doc.setFont("helvetica", "bold");
        const clean = seg.slice(1, -1);
        doc.text(clean, cursorX, cursorY);
        cursorX += doc.getTextWidth(clean);
      } else {
        doc.setFont("helvetica", "normal");
        doc.text(seg, cursorX, cursorY);
        cursorX += doc.getTextWidth(seg);
      }
    }
    cursorY += lineHeight;
  }
  doc.setTextColor(0, 0, 0);
  return y + bubbleHeight;
}

const generateSignatureHash = () => {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  return Array.from({ length: 9 }, () => chars.charAt(Math.floor(Math.random() * chars.length))).join("");
};

interface PackageData {
  id: string;
  pickup_code: string;
  received_at: string;
  picked_up_at: string | null;
  picked_up_by_name: string | null;
  description: string | null;
  tracking_code: string | null;
  photo_url: string | null;
  block: { id: string; name: string } | null;
  apartment: { id: string; number: string } | null;
  condominium: { id: string; name: string } | null;
  resident: { id: string; full_name: string; phone: string | null } | null;
  package_type: { name: string } | null;
  received_by_name?: string | null;
  received_by_profile?: { full_name: string } | null;
}

const fmt = (iso: string | null | undefined) =>
  iso ? format(parseISO(iso), "dd/MM/yyyy HH:mm", { locale: ptBR }) : "—";

async function fetchImageAsDataUrl(url: string): Promise<string | null> {
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const blob = await res.blob();
    return await new Promise((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.onerror = () => resolve(null);
      reader.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
}

export async function generatePackageReceiptPdf(pkg: PackageData): Promise<void> {
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 15;
  let y = margin;

  // Header
  doc.setFillColor(30, 41, 59);
  doc.rect(0, 0, pageWidth, 28, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.text("COMPROVANTE DE ENTREGA DE ENCOMENDA", pageWidth / 2, 12, { align: "center" });
  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.text(pkg.condominium?.name || "Condomínio", pageWidth / 2, 20, { align: "center" });
  doc.text(`Emitido em ${format(new Date(), "dd/MM/yyyy HH:mm", { locale: ptBR })}`, pageWidth / 2, 25, {
    align: "center",
  });

  y = 38;
  doc.setTextColor(0, 0, 0);

  // Resident info
  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.text("Destinatário", margin, y);
  y += 2;
  doc.setDrawColor(200);
  doc.line(margin, y, pageWidth - margin, y);
  y += 5;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  const apt = `${pkg.block?.name ? `Bloco ${pkg.block.name} - ` : ""}Apto ${pkg.apartment?.number || "—"}`;
  doc.text(`Morador: ${pkg.resident?.full_name || "—"}`, margin, y); y += 5;
  doc.text(`Unidade: ${apt}`, margin, y); y += 5;
  if (pkg.resident?.phone) { doc.text(`Telefone: ${pkg.resident.phone}`, margin, y); y += 5; }

  y += 4;
  // Package info
  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.text("Dados da Encomenda", margin, y);
  y += 2;
  doc.line(margin, y, pageWidth - margin, y);
  y += 5;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.text(`Tipo: ${pkg.package_type?.name || "Encomenda"}`, margin, y); y += 5;
  doc.text(`Código de retirada: ${pkg.pickup_code}`, margin, y); y += 5;
  if (pkg.tracking_code) { doc.text(`Rastreio: ${pkg.tracking_code}`, margin, y); y += 5; }
  if (pkg.description) { doc.text(`Descrição: ${pkg.description}`, margin, y); y += 5; }
  doc.text(`Recebida em: ${fmt(pkg.received_at)}`, margin, y); y += 5;
  doc.text(
    `Recebida por: ${pkg.received_by_name || pkg.received_by_profile?.full_name || "—"}`,
    margin,
    y,
  );
  y += 5;

  y += 4;
  // Delivery section
  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.text("Entrega", margin, y);
  y += 2;
  doc.setDrawColor(200);
  doc.line(margin, y, pageWidth - margin, y);
  y += 5;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.text(`Entregue em: ${fmt(pkg.picked_up_at)}`, margin, y); y += 5;
  doc.text(`Retirada por: ${pkg.picked_up_by_name || "—"}`, margin, y); y += 5;

  // Photo (right side)
  if (pkg.photo_url) {
    try {
      const signed = await getSignedPackagePhotoUrl(pkg.photo_url);
      if (signed) {
        const dataUrl = await fetchImageAsDataUrl(signed);
        if (dataUrl) {
          const imgW = 50;
          const imgH = 50;
          doc.addImage(dataUrl, "JPEG", pageWidth - margin - imgW, 40, imgW, imgH, undefined, "FAST");
        }
      }
    } catch (err) {
      console.warn("Failed to embed package photo", err);
    }
  }

  y += 6;

  // WhatsApp timeline
  let afterTableY = y;


  const { data: waLogs } = await supabase
    .from("whatsapp_notification_logs")
    .select("created_at, success, template_name, status, error_message, accepted_at, sent_at, delivered_at, read_at")
    .eq("package_id", pkg.id)
    .order("created_at", { ascending: true });

  const timeline: Array<{ when: string; label: string; detail: string }> = [];
  (waLogs || []).forEach((log: any, idx: number) => {
    const prefix = `Envio #${idx + 1}`;
    timeline.push({
      when: fmt(log.created_at),
      label: `${prefix} — ${log.success ? "Enviada" : "Falhou"}`,
      detail: log.template_name || log.error_message || "",
    });
    if (log.accepted_at) timeline.push({ when: fmt(log.accepted_at), label: `${prefix} — Aceita pela Meta`, detail: "" });
    if (log.sent_at) timeline.push({ when: fmt(log.sent_at), label: `${prefix} — Enviada ao WhatsApp`, detail: "" });
    if (log.delivered_at) timeline.push({ when: fmt(log.delivered_at), label: `${prefix} — Entregue`, detail: "" });
    if (log.read_at) timeline.push({ when: fmt(log.read_at), label: `${prefix} — Lida`, detail: "" });
  });

  const pageHeight = doc.internal.pageSize.getHeight();
  if (afterTableY + 20 > pageHeight - margin) {
    doc.addPage();
    afterTableY = margin;
  }

  // Rendered WhatsApp message sent to resident
  const messageText = renderPackageArrivalMessage(pkg);
  const bubbleWidth = pageWidth - margin * 2;
  // Estimate bubble height for pagination
  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  const approxLines = messageText.split("\n").reduce((acc, line) => {
    if (!line.trim()) return acc + 1;
    return acc + (doc.splitTextToSize(line, bubbleWidth - 8) as string[]).length;
  }, 0);
  const estBubbleH = 8 + approxLines * 4.2 + 20;
  if (afterTableY + estBubbleH > pageHeight - margin) {
    doc.addPage();
    afterTableY = margin;
  }

  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.text("Mensagem enviada ao morador", margin, afterTableY + 10);
  doc.setDrawColor(200);
  doc.line(margin, afterTableY + 12, pageWidth - margin, afterTableY + 12);
  const bubbleEndY = drawWhatsAppBubble(doc, messageText, margin, afterTableY + 16, bubbleWidth);
  afterTableY = bubbleEndY + 4;

  if (afterTableY + 20 > pageHeight - margin) {
    doc.addPage();
    afterTableY = margin;
  }

  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.text("Linha do tempo — Notificações WhatsApp", margin, afterTableY + 10);
  doc.setDrawColor(200);
  doc.line(margin, afterTableY + 12, pageWidth - margin, afterTableY + 12);

  if (timeline.length === 0) {
    doc.setFont("helvetica", "italic");
    doc.setFontSize(10);
    doc.setTextColor(120);
    doc.text("Nenhuma notificação registrada para esta encomenda.", margin, afterTableY + 20);
    doc.setTextColor(0);
  } else {
    autoTable(doc, {
      startY: afterTableY + 14,
      head: [["Data/Hora", "Evento", "Detalhes"]],
      body: timeline.map((t) => [t.when, t.label, t.detail]),
      styles: { fontSize: 8, cellPadding: 2 },
      headStyles: { fillColor: [16, 185, 129], textColor: 255 },
      margin: { left: margin, right: margin },
    });
  }

  // Authenticity signature: register in signed_documents and render QR + hash
  const signatureHash = generateSignatureHash();
  const fileName = `comprovante_encomenda_${pkg.pickup_code}.pdf`;

  try {
    const { data: userRes } = await supabase.auth.getUser();
    const signerId = userRes?.user?.id ?? null;
    let signerName = "Sistema NotificaCondo";
    if (signerId) {
      const { data: profile } = await supabase
        .from("profiles")
        .select("full_name")
        .eq("user_id", signerId)
        .maybeSingle();
      if (profile?.full_name) signerName = profile.full_name;
    }

    await (supabase as any).from("signed_documents").insert({
      signer_id: signerId,
      signer_name: signerName,
      file_hash: signatureHash,
      file_name: fileName,
    });
  } catch (err) {
    console.warn("Falha ao registrar autenticidade do comprovante", err);
  }

  // QR + hash block
  try {
    const pageHeight2 = doc.internal.pageSize.getHeight();
    // @ts-expect-error lastAutoTable injected by plugin
    let cursorY = doc.lastAutoTable?.finalY ? doc.lastAutoTable.finalY + 10 : afterTableY + 20;
    const qrSize = 30;
    const blockHeight = qrSize + 14;
    if (cursorY + blockHeight > pageHeight2 - margin) {
      doc.addPage();
      cursorY = margin;
    }
    const authUrl = `https://notificacondo.com.br/autenticidade?code=${signatureHash}`;
    const qrDataUrl = await QRCode.toDataURL(authUrl, { margin: 1, width: 200 });
    const qrX = (pageWidth - qrSize) / 2;
    doc.addImage(qrDataUrl, "PNG", qrX, cursorY, qrSize, qrSize);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(7);
    doc.setTextColor(33, 33, 33);
    doc.text("Autenticação", pageWidth / 2, cursorY + qrSize + 3, { align: "center" });
    doc.setFont("helvetica", "normal");
    doc.setFontSize(6);
    doc.text("notificacondo.com.br/autenticidade", pageWidth / 2, cursorY + qrSize + 5.5, { align: "center" });
    doc.setFont("helvetica", "bold");
    doc.setFontSize(7);
    doc.text(`HASH: ${signatureHash}`, pageWidth / 2, cursorY + qrSize + 9, { align: "center" });
  } catch (err) {
    console.warn("Falha ao gerar QR Code de autenticidade", err);
  }

  doc.save(`comprovante-encomenda-${pkg.pickup_code}.pdf`);
}
