import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface OccurrencePdfTemplate {
  id: string;
  intro_paragraph: string;
  syndic_role_paragraph: string;
  penalty_multa_paragraph: string;
  penalty_advertencia_paragraph: string;
  penalty_notificacao_paragraph: string;
  defense_deadline_paragraph: string;
  closing_remarks: string;
  signature_label: string;
  footer_text: string;
  updated_at: string;
  updated_by: string | null;
}

export const TEMPLATE_PLACEHOLDERS = [
  { key: "data", label: "Data da ocorrência" },
  { key: "hora", label: "Hora da ocorrência" },
  { key: "bloco", label: "Bloco" },
  { key: "apartamento", label: "Apartamento" },
  { key: "morador", label: "Nome do morador" },
  { key: "descricao_ocorrencia", label: "Descrição da ocorrência" },
  { key: "local", label: "Local" },
  { key: "condominio", label: "Nome do condomínio" },
  { key: "sindico", label: "Nome do síndico" },
  { key: "prazo_defesa", label: "Prazo de defesa (dias por extenso)" },
  { key: "percentual_multa", label: "Percentual da multa (somente Multa)" },
] as const;

export function interpolate(template: string, vars: Record<string, string | number | null | undefined>): string {
  if (!template) return "";
  return template.replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (_match, key) => {
    const v = vars[key];
    if (v === null || v === undefined) return "";
    return String(v);
  });
}

const DEFAULT_TEMPLATE: OccurrencePdfTemplate = {
  id: "00000000-0000-0000-0000-000000000001",
  intro_paragraph:
    "Na qualidade de síndico deste Condomínio, no uso de minhas atribuições legais e conforme determinação do corpo diretivo, sirvo-me da presente para notificá-lo(a) acerca do descumprimento das normas previstas no Regulamento Interno.",
  syndic_role_paragraph:
    "Ressaltamos que o cargo de síndico tem por finalidade a gestão do condomínio e o fiel cumprimento do Regimento Interno, cuja versão atualizada está disponível para consulta de todos os condôminos, conforme aprovado em assembleia.",
  penalty_multa_paragraph:
    "Diante do ocorrido, torna-se necessária a aplicação da penalidade prevista no Regimento Interno deste Condomínio, a qual será lançada juntamente com sua quota condominial no total de {{percentual_multa}}% da taxa condominial.",
  penalty_advertencia_paragraph:
    "Diante do ocorrido, esta notificação está sendo emitida como advertência formal, sendo o próximo passo, em caso de reincidência, a aplicação da multa prevista no Regimento Interno.",
  penalty_notificacao_paragraph:
    "Diante do ocorrido, serve a presente como NOTIFICAÇÃO FORMAL sobre o descumprimento das normas condominiais.",
  defense_deadline_paragraph:
    "Fica estipulado o prazo de {{prazo_defesa}} dias para que V. Sa. apresente, se assim desejar, suas razões mediante defesa por escrito, a qual será submetida à análise do Conselho Consultivo.",
  closing_remarks:
    "Contamos com a sua compreensão e colaboração no sentido de mantermos o respeito às normas e a boa convivência entre os moradores.",
  signature_label: "Atenciosamente;",
  footer_text: "",
  updated_at: new Date().toISOString(),
  updated_by: null,
};

export function getDefaultPdfTemplate(): OccurrencePdfTemplate {
  return { ...DEFAULT_TEMPLATE };
}

export function useOccurrencePdfTemplate() {
  return useQuery({
    queryKey: ["occurrence-pdf-template"],
    queryFn: async (): Promise<OccurrencePdfTemplate> => {
      const { data, error } = await (supabase as any)
        .from("occurrence_pdf_template")
        .select("*")
        .order("updated_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) {
        console.warn("Failed to load occurrence pdf template, using defaults", error);
        return DEFAULT_TEMPLATE;
      }
      if (!data) return DEFAULT_TEMPLATE;
      return data as OccurrencePdfTemplate;
    },
    staleTime: 5 * 60 * 1000,
  });
}

export async function fetchOccurrencePdfTemplate(): Promise<OccurrencePdfTemplate> {
  const { data, error } = await (supabase as any)
    .from("occurrence_pdf_template")
    .select("*")
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error || !data) return DEFAULT_TEMPLATE;
  return data as OccurrencePdfTemplate;
}
