import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { supabase } from "@/integrations/supabase/client";
import { getSignedPackagePhotoUrl } from "@/lib/packageStorage";

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

  // History
  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.text("Histórico de Recebimentos do Morador", margin, y);
  y += 2;
  doc.line(margin, y, pageWidth - margin, y);
  y += 4;

  let history: Array<{
    received_at: string;
    picked_up_at: string | null;
    pickup_code: string;
    status: string;
    type: string;
    picked_up_by_name: string | null;
  }> = [];

  if (pkg.resident?.id) {
    const { data } = await supabase
      .from("packages")
      .select("received_at, picked_up_at, pickup_code, status, picked_up_by_name, package_type:package_types(name)")
      .eq("resident_id", pkg.resident.id)
      .order("received_at", { ascending: false })
      .limit(50);
    history = (data || []).map((r: any) => ({
      received_at: r.received_at,
      picked_up_at: r.picked_up_at,
      pickup_code: r.pickup_code,
      status: r.status,
      type: r.package_type?.name || "Encomenda",
      picked_up_by_name: r.picked_up_by_name,
    }));
  }

  autoTable(doc, {
    startY: y,
    head: [["Recebida", "Tipo", "Código", "Status", "Retirada", "Retirado por"]],
    body: history.map((h) => [
      fmt(h.received_at),
      h.type,
      h.pickup_code,
      h.status === "retirada" ? "Entregue" : "Pendente",
      fmt(h.picked_up_at),
      h.picked_up_by_name || "—",
    ]),
    styles: { fontSize: 8, cellPadding: 2 },
    headStyles: { fillColor: [30, 41, 59], textColor: 255 },
    margin: { left: margin, right: margin },
  });

  // WhatsApp timeline
  // @ts-expect-error lastAutoTable injected by plugin
  let afterTableY = doc.lastAutoTable?.finalY || y + 30;

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


  doc.save(`comprovante-encomenda-${pkg.pickup_code}.pdf`);
}
