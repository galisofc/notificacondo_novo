import { useState, useEffect, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import DashboardLayout from "@/components/layouts/DashboardLayout";
import SuperAdminBreadcrumbs from "@/components/superadmin/SuperAdminBreadcrumbs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Loader2, Save, RotateCcw, FileText, Eye, FileDown } from "lucide-react";
import {
  useOccurrencePdfTemplate,
  getDefaultPdfTemplate,
  interpolate,
  TEMPLATE_PLACEHOLDERS,
  type OccurrencePdfTemplate,
} from "@/hooks/useOccurrencePdfTemplate";
import { generateSampleOccurrencePdf, type SamplePenaltyType } from "@/lib/occurrencePdfSample";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ChevronDown } from "lucide-react";

const FIELDS: { key: keyof OccurrencePdfTemplate; label: string; description: string; rows: number }[] = [
  { key: "intro_paragraph", label: "Parágrafo de introdução", description: "Texto de abertura da notificação.", rows: 4 },
  { key: "syndic_role_paragraph", label: "Papel do síndico", description: "Explica a função do síndico.", rows: 4 },
  { key: "penalty_notificacao_paragraph", label: "Penalidade — Notificação", description: "Texto exibido quando o tipo é Notificação.", rows: 3 },
  { key: "penalty_advertencia_paragraph", label: "Penalidade — Advertência", description: "Texto exibido quando o tipo é Advertência.", rows: 3 },
  { key: "penalty_multa_paragraph", label: "Penalidade — Multa", description: "Texto exibido quando o tipo é Multa.", rows: 3 },
  { key: "defense_deadline_paragraph", label: "Prazo de defesa", description: "Use {{prazo_defesa}} para o número de dias por extenso.", rows: 3 },
  { key: "closing_remarks", label: "Encerramento", description: "Frase final antes da assinatura.", rows: 3 },
  { key: "signature_label", label: "Linha de assinatura", description: "Ex.: \"Atenciosamente;\"", rows: 1 },
  { key: "footer_text", label: "Rodapé (opcional)", description: "Texto pequeno no rodapé do PDF.", rows: 2 },
];

const SAMPLE_VARS: Record<string, string> = {
  data: "15/04/2026",
  hora: "14h30",
  bloco: "Bloco A",
  apartamento: "302",
  morador: "João da Silva",
  descricao_ocorrencia: "Som alto após as 22h.",
  local: "Área da piscina",
  condominio: "Residencial Exemplo",
  sindico: "Maria Santos",
  prazo_defesa: "10 (dez)",
};

export default function OccurrencePdfTemplatePage() {
  const { data: template, isLoading } = useOccurrencePdfTemplate();
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [form, setForm] = useState<OccurrencePdfTemplate | null>(null);
  const [saving, setSaving] = useState(false);
  const focusedField = useRef<keyof OccurrencePdfTemplate | null>(null);
  const cursorPos = useRef<number>(0);

  useEffect(() => {
    if (template && !form) setForm(template);
  }, [template, form]);

  const update = (key: keyof OccurrencePdfTemplate, value: string) => {
    setForm((prev) => (prev ? { ...prev, [key]: value } : prev));
  };

  const insertPlaceholder = (placeholder: string) => {
    if (!form || !focusedField.current) {
      toast({ title: "Clique em um campo primeiro", description: "Selecione onde inserir o placeholder.", variant: "destructive" });
      return;
    }
    const key = focusedField.current;
    const current = String(form[key] ?? "");
    const pos = cursorPos.current ?? current.length;
    const tag = `{{${placeholder}}}`;
    const next = current.slice(0, pos) + tag + current.slice(pos);
    update(key, next);
  };

  const handleRestoreDefaults = () => {
    if (!confirm("Restaurar todos os campos para os textos padrão? Suas alterações não salvas serão perdidas.")) return;
    const def = getDefaultPdfTemplate();
    setForm((prev) => (prev ? { ...def, id: prev.id } : def));
  };

  const handleSave = async () => {
    if (!form) return;
    setSaving(true);
    try {
      const payload = {
        id: form.id || "00000000-0000-0000-0000-000000000001",
        intro_paragraph: form.intro_paragraph,
        syndic_role_paragraph: form.syndic_role_paragraph,
        penalty_multa_paragraph: form.penalty_multa_paragraph,
        penalty_advertencia_paragraph: form.penalty_advertencia_paragraph,
        penalty_notificacao_paragraph: form.penalty_notificacao_paragraph,
        defense_deadline_paragraph: form.defense_deadline_paragraph,
        closing_remarks: form.closing_remarks,
        signature_label: form.signature_label,
        footer_text: form.footer_text,
        updated_at: new Date().toISOString(),
        updated_by: user?.id ?? null,
      };
      const { error } = await (supabase as any)
        .from("occurrence_pdf_template")
        .upsert(payload, { onConflict: "id" });
      if (error) throw error;
      await queryClient.invalidateQueries({ queryKey: ["occurrence-pdf-template"] });
      toast({ title: "Template salvo com sucesso", description: "As alterações já estão ativas em todo o sistema." });
    } catch (e: any) {
      toast({ title: "Erro ao salvar template", description: e.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const handleGenerateSamplePdf = (penaltyType: SamplePenaltyType) => {
    if (!form) return;
    try {
      const doc = generateSampleOccurrencePdf(form, penaltyType);
      doc.save(`exemplo-${penaltyType}-ocorrencia.pdf`);
    } catch (e: any) {
      toast({ title: "Erro ao gerar PDF de exemplo", description: e.message, variant: "destructive" });
    }
  };

  if (isLoading || !form) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center min-h-[60vh]">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="container mx-auto px-4 py-6 space-y-6">
        <SuperAdminBreadcrumbs items={[{ label: "Template do PDF de Ocorrência" }]} />

        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold flex items-center gap-2">
              <FileText className="w-7 h-7 text-primary" />
              Template do PDF de Ocorrência
            </h1>
            <p className="text-muted-foreground text-sm mt-1">
              Edite os textos padrão usados na geração do PDF. As alterações refletem em todo o sistema.
            </p>
          </div>
          <div className="flex gap-2">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" disabled={saving}>
                  <FileDown className="w-4 h-4 mr-2" />
                  Gerar PDF de exemplo
                  <ChevronDown className="w-4 h-4 ml-2" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => handleGenerateSamplePdf("notificacao")}>
                  Notificação
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => handleGenerateSamplePdf("advertencia")}>
                  Advertência
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => handleGenerateSamplePdf("multa")}>
                  Multa
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            <Button variant="outline" onClick={handleRestoreDefaults} disabled={saving}>
              <RotateCcw className="w-4 h-4 mr-2" />
              Restaurar padrão
            </Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
              Salvar
            </Button>
          </div>
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          {/* Editor */}
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Placeholders disponíveis</CardTitle>
                <CardDescription>
                  Clique em um campo abaixo, posicione o cursor onde deseja inserir, e clique no placeholder.
                </CardDescription>
              </CardHeader>
              <CardContent className="flex flex-wrap gap-2">
                {TEMPLATE_PLACEHOLDERS.map((p) => (
                  <Badge
                    key={p.key}
                    variant="secondary"
                    className="cursor-pointer hover:bg-primary hover:text-primary-foreground transition-colors"
                    onClick={() => insertPlaceholder(p.key)}
                    title={p.label}
                  >
                    {`{{${p.key}}}`}
                  </Badge>
                ))}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Textos do PDF</CardTitle>
                <CardDescription>Conteúdo dos parágrafos exibidos na notificação gerada.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-5">
                {FIELDS.map((f) => (
                  <div key={f.key} className="space-y-2">
                    <Label htmlFor={f.key as string}>{f.label}</Label>
                    <Textarea
                      id={f.key as string}
                      rows={f.rows}
                      value={String(form[f.key] ?? "")}
                      onChange={(e) => update(f.key, e.target.value)}
                      onFocus={(e) => {
                        focusedField.current = f.key;
                        cursorPos.current = e.target.selectionStart ?? 0;
                      }}
                      onSelect={(e) => {
                        cursorPos.current = (e.target as HTMLTextAreaElement).selectionStart ?? 0;
                      }}
                      onKeyUp={(e) => {
                        cursorPos.current = (e.target as HTMLTextAreaElement).selectionStart ?? 0;
                      }}
                      onClick={(e) => {
                        cursorPos.current = (e.target as HTMLTextAreaElement).selectionStart ?? 0;
                      }}
                    />
                    <p className="text-xs text-muted-foreground">{f.description}</p>
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>

          {/* Preview */}
          <div className="lg:sticky lg:top-4 space-y-4 self-start">
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <Eye className="w-4 h-4 text-primary" />
                  Pré-visualização
                </CardTitle>
                <CardDescription>Placeholders substituídos por valores de exemplo.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4 text-sm leading-relaxed text-foreground">
                <p className="text-justify indent-8">{interpolate(form.intro_paragraph, SAMPLE_VARS)}</p>
                <Separator />
                <p className="text-justify indent-8">{interpolate(form.syndic_role_paragraph, SAMPLE_VARS)}</p>
                <Separator />
                <div className="space-y-2">
                  <p className="text-xs uppercase font-semibold text-muted-foreground">Notificação</p>
                  <p className="text-justify indent-8">{interpolate(form.penalty_notificacao_paragraph, SAMPLE_VARS)}</p>
                  <p className="text-xs uppercase font-semibold text-muted-foreground">Advertência</p>
                  <p className="text-justify indent-8">{interpolate(form.penalty_advertencia_paragraph, SAMPLE_VARS)}</p>
                  <p className="text-xs uppercase font-semibold text-muted-foreground">Multa</p>
                  <p className="text-justify indent-8">{interpolate(form.penalty_multa_paragraph, SAMPLE_VARS)}</p>
                </div>
                <Separator />
                <p className="text-justify indent-8">{interpolate(form.defense_deadline_paragraph, SAMPLE_VARS)}</p>
                <Separator />
                <p className="text-justify indent-8">{interpolate(form.closing_remarks, SAMPLE_VARS)}</p>
                <Separator />
                <p className="font-medium">{form.signature_label}</p>
                {form.footer_text ? (
                  <>
                    <Separator />
                    <p className="text-xs text-muted-foreground text-center">{interpolate(form.footer_text, SAMPLE_VARS)}</p>
                  </>
                ) : null}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
