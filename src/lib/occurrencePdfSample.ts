import jsPDF from "jspdf";
import { interpolate, type OccurrencePdfTemplate } from "@/hooks/useOccurrencePdfTemplate";

/**
 * Generates a sample occurrence PDF using the provided template and fictitious
 * data. Mirrors the visual layout of the real generator in OccurrenceDetails.tsx
 * (top block, ref line, body paragraphs, yellow legal block, signature),
 * but without touching the database or fetching evidences.
 */
export function generateSampleOccurrencePdf(template: OccurrencePdfTemplate): jsPDF {
  const SAMPLE = {
    data: "15/04/2026",
    hora: "14h30",
    bloco: "Bloco A",
    apartamento: "302",
    morador: "João da Silva",
    descricao_ocorrencia:
      "Som em volume elevado proveniente do apartamento, após as 22h, perturbando o sossego dos demais condôminos.",
    local: "Área da piscina",
    condominio: "Residencial Exemplo",
    sindico: "Maria Santos",
    prazo_defesa: "10 (dez)",
  };
  const refType = "NOTIFICAÇÃO – Infração a Convenção";
  const condominiumName = SAMPLE.condominio;
  const sindicoName = SAMPLE.sindico;
  const headerCity = "São Paulo";

  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 20;
  const contentWidth = pageWidth - margin * 2;
  const footerReserve = 30;
  const bottomLimit = pageHeight - footerReserve;
  let yPos = margin;

  const formatFullDate = (d: Date) => {
    const months = [
      "janeiro", "fevereiro", "março", "abril", "maio", "junho",
      "julho", "agosto", "setembro", "outubro", "novembro", "dezembro",
    ];
    return `${String(d.getDate()).padStart(2, "0")} de ${months[d.getMonth()]} de ${d.getFullYear()}`;
  };

  const renderTopBlock = (): number => {
    const topStartY = margin;
    const rightColX = pageWidth - margin;

    doc.setFontSize(11);
    doc.setTextColor(33, 33, 33);
    doc.setFont("helvetica", "normal");
    doc.text(`${headerCity}, ${formatFullDate(new Date())}`, rightColX, topStartY, { align: "right" });

    let leftY = topStartY + 12;
    doc.setFontSize(11);
    doc.setFont("helvetica", "normal");
    doc.text("Ao Senhor(a):", margin, leftY);
    leftY += 6;
    doc.setFont("helvetica", "bold");
    doc.text(SAMPLE.morador.toUpperCase(), margin, leftY);
    leftY += 6;

    doc.setFont("helvetica", "bold");
    doc.text(SAMPLE.bloco, margin, leftY);
    const blockWidth = doc.getTextWidth(SAMPLE.bloco);
    doc.setFont("helvetica", "normal");
    doc.text("APTO: ", margin + blockWidth + 6, leftY);
    doc.setFont("helvetica", "bold");
    doc.text(SAMPLE.apartamento, margin + blockWidth + 6 + doc.getTextWidth("APTO: "), leftY);
    leftY += 6;

    doc.setFont("helvetica", "normal");
    doc.text(condominiumName.toUpperCase(), margin, leftY);
    leftY += 5;
    doc.text("Rua das Flores, 123 – Centro – São Paulo/SP", margin, leftY);
    leftY += 5;
    doc.text("CEP: 01000-000", margin, leftY);
    leftY += 5;

    return leftY + 8;
  };

  const ensureSpace = (needed: number) => {
    if (yPos + needed > bottomLimit) {
      doc.addPage();
      yPos = renderTopBlock();
    }
  };

  const drawJustifiedPaginated = (text: string, lineHeight = 5, firstLineIndent = 0) => {
    const paragraphs = String(text).split(/\n/);
    for (const para of paragraphs) {
      ensureSpace(lineHeight);
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
        ensureSpace(lineHeight);
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

  yPos = renderTopBlock();

  // Reference
  ensureSpace(10);
  doc.setFontSize(11);
  doc.setFont("helvetica", "bolditalic");
  doc.text(`Ref.: 2026/EXEMPLO - ${refType}`, margin, yPos);
  yPos += 10;

  // Greeting
  ensureSpace(8);
  doc.setFont("helvetica", "normal");
  doc.text("Prezado Condômino,", margin, yPos);
  yPos += 8;

  const indent = 12;

  // Intro
  const introParagraph = interpolate(template.intro_paragraph, SAMPLE);
  if (introParagraph.trim()) {
    drawJustifiedPaginated(introParagraph, 5, indent);
    yPos += 6;
  }

  // Sample yellow legal block
  {
    const legalText =
      "Conforme Convenção - Art. 9º, § 1º: É vedado aos condôminos usar suas unidades autônomas de modo prejudicial ao sossego, salubridade e segurança dos demais.";
    const padY = 4;
    const lineH = 5;
    doc.setFont("helvetica", "bolditalic");
    doc.setFontSize(11);
    const legalLines = doc.splitTextToSize(legalText, contentWidth);
    const blockHeight = legalLines.length * lineH + padY * 2;
    ensureSpace(blockHeight + 2);
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

  // Description (dynamic)
  const descriptionParagraph =
    `No dia ${SAMPLE.data}, por volta das ${SAMPLE.hora}, no local: ${SAMPLE.local}, foi constatado que: ${SAMPLE.descricao_ocorrencia}`;
  drawJustifiedPaginated(descriptionParagraph, 5, indent);
  yPos += 6;

  // Role
  const rolePara = interpolate(template.syndic_role_paragraph, SAMPLE);
  if (rolePara.trim()) {
    drawJustifiedPaginated(rolePara, 5, indent);
    yPos += 6;
  }

  // Penalty (use notificacao for sample)
  const penaltyParagraph = interpolate(template.penalty_notificacao_paragraph, SAMPLE);
  if (penaltyParagraph.trim()) {
    drawJustifiedPaginated(penaltyParagraph, 5, indent);
    yPos += 6;
  }

  // Defense deadline
  const defenseParagraph = interpolate(template.defense_deadline_paragraph, SAMPLE);
  if (defenseParagraph.trim()) {
    drawJustifiedPaginated(defenseParagraph, 5, indent);
    yPos += 6;
  }

  // Closing
  const closingPara = interpolate(template.closing_remarks, SAMPLE);
  if (closingPara.trim()) {
    drawJustifiedPaginated(closingPara, 5, indent);
    yPos += 10;
  }

  // Signature
  ensureSpace(35);
  doc.text(template.signature_label || "Atenciosamente;", margin, yPos);
  yPos += 18;
  doc.setFont("helvetica", "bold");
  doc.text(condominiumName.toUpperCase(), margin, yPos);
  yPos += 5;
  doc.text("SÍNDICO", margin, yPos);
  yPos += 5;
  doc.text(sindicoName.toUpperCase(), margin, yPos);

  // Footer on all pages: condominium name + address + CEP + page number
  const addressLine = "Rua das Flores, 123 – Centro – São Paulo/SP";
  const cepLine = "CEP: 01000-000";
  const totalPages = doc.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    doc.setDrawColor(200, 200, 200);
    doc.line(margin, pageHeight - 25, pageWidth - margin, pageHeight - 25);
    doc.setFontSize(9);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(33, 33, 33);
    doc.text(condominiumName.toUpperCase(), pageWidth / 2, pageHeight - 18, { align: "center" });
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(100, 100, 100);
    doc.text(addressLine, pageWidth / 2, pageHeight - 13, { align: "center" });
    doc.text(cepLine, pageWidth / 2, pageHeight - 9, { align: "center" });
    doc.text(`Página ${i} de ${totalPages}`, pageWidth - margin, pageHeight - 5, { align: "right" });
  }

  return doc;
}
