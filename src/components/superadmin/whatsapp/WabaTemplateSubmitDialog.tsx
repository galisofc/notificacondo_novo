import { useState, useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import {
  Loader2,
  Send,
  Link2,
  FileText,
  CheckCircle,
  XCircle,
  Clock,
  AlertCircle,
  RefreshCw,
  Zap,
  ExternalLink,
  Plus,
  Trash2,
  Eye,
  Phone,
  MessageSquare,
  Variable,
} from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { VARIABLE_EXAMPLES } from "./TemplateCategories";

interface MetaTemplate {
  id: string;
  name: string;
  status: string;
  category: string;
  language: string;
  quality_score?: string;
  rejected_reason?: string;
}

interface WabaTemplateSubmitDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onTemplateLinked?: (templateName: string, language: string) => void;
}

const META_CATEGORIES = [
  { value: "UTILITY", label: "Utilitário", description: "Notificações, atualizações de conta, lembretes" },
  { value: "MARKETING", label: "Marketing", description: "Promoções, ofertas e campanhas" },
  { value: "AUTHENTICATION", label: "Autenticação", description: "Códigos de verificação e OTP" },
];

const LANGUAGES = [
  { value: "pt_BR", label: "Português (Brasil)" },
  { value: "en", label: "English" },
  { value: "es", label: "Español" },
];

// Predefined parameters grouped by context
const PREDEFINED_PARAMS = [
  { group: "Geral", params: ["nome", "condominio", "link", "data"] },
  { group: "Ocorrências", params: ["tipo", "titulo", "justificativa", "nome_morador"] },
  { group: "Salão de Festas", params: ["espaco", "horario_inicio", "horario_fim", "checklist", "link_checklist"] },
  { group: "Faturamento", params: ["valor", "numero_fatura", "periodo", "data_vencimento", "metodo_pagamento", "data_pagamento", "descricao_fatura"] },
  { group: "Trial", params: ["dias_restantes", "data_expiracao", "link_planos", "link_dashboard"] },
  { group: "Transferência", params: ["nome_novo_sindico", "nome_antigo_sindico", "data_transferencia", "observacoes"] },
  { group: "Encomendas", params: ["bloco", "apartamento", "codigo", "tipo_encomenda", "codigo_rastreio"] },
];

interface ButtonEntry {
  type: "url" | "quick_reply" | "phone";
  text: string;
  url_base?: string;
  has_dynamic_suffix?: boolean;
  phone_number?: string;
}

export function WabaTemplateSubmitDialog({ 
  open, 
  onOpenChange,
  onTemplateLinked 
}: WabaTemplateSubmitDialogProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const bodyRef = useRef<HTMLTextAreaElement>(null);
  const [activeTab, setActiveTab] = useState<"create" | "link">("link");
  const [showPreview, setShowPreview] = useState(false);
  
  // Create new template state
  const [templateName, setTemplateName] = useState("");
  const [templateCategory, setTemplateCategory] = useState<string>("UTILITY");
  const [templateLanguage, setTemplateLanguage] = useState("pt_BR");
  const [headerText, setHeaderText] = useState("");
  const [bodyText, setBodyText] = useState("");
  const [footerText, setFooterText] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  // Tracked parameters (mapped to {{1}}, {{2}}, etc.)
  const [paramsList, setParamsList] = useState<string[]>([]);
  
  // Multiple buttons state (Meta allows up to 3)
  const [buttons, setButtons] = useState<ButtonEntry[]>([]);
  
  // Link existing template state
  const [metaTemplates, setMetaTemplates] = useState<MetaTemplate[]>([]);
  const [isLoadingTemplates, setIsLoadingTemplates] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState<MetaTemplate | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [isSyncing, setIsSyncing] = useState(false);
  const [localTemplates, setLocalTemplates] = useState<Array<{ id: string; slug: string; waba_template_name: string | null }>>([]);

  useEffect(() => {
    if (open && activeTab === "link") {
      loadMetaTemplates();
      loadLocalTemplates();
    }
  }, [open, activeTab]);

  const loadLocalTemplates = async () => {
    const { data } = await supabase
      .from("whatsapp_templates")
      .select("id, slug, waba_template_name");
    if (data) setLocalTemplates(data);
  };

  const loadMetaTemplates = async () => {
    setIsLoadingTemplates(true);
    try {
      const { data, error } = await supabase.functions.invoke("list-waba-templates");
      if (error) throw error;
      if (data?.success) {
        setMetaTemplates(data.templates || []);
      } else {
        toast({ title: "Erro ao carregar templates", description: data?.error || "Falha ao buscar templates da Meta", variant: "destructive" });
      }
    } catch (err: any) {
      toast({ title: "Erro", description: err.message || "Erro ao carregar templates", variant: "destructive" });
    } finally {
      setIsLoadingTemplates(false);
    }
  };

  // Insert a variable at cursor position in body
  const insertVariable = (paramName: string) => {
    let paramIndex = paramsList.indexOf(paramName);
    if (paramIndex === -1) {
      setParamsList(prev => [...prev, paramName]);
      paramIndex = paramsList.length;
    }
    const varTag = `{{${paramIndex + 1}}}`;
    
    if (bodyRef.current) {
      const textarea = bodyRef.current;
      const start = textarea.selectionStart;
      const end = textarea.selectionEnd;
      const newBody = bodyText.substring(0, start) + varTag + bodyText.substring(end);
      setBodyText(newBody);
      setTimeout(() => {
        textarea.focus();
        textarea.setSelectionRange(start + varTag.length, start + varTag.length);
      }, 0);
    } else {
      setBodyText(prev => prev + varTag);
    }
  };

  // Remove a parameter and re-index
  const removeParam = (index: number) => {
    const oldNum = index + 1;
    const newParams = paramsList.filter((_, i) => i !== index);
    setParamsList(newParams);
    
    // Re-index variables in body text
    let newBody = bodyText;
    // Remove references to the deleted param
    newBody = newBody.replace(new RegExp(`\\{\\{${oldNum}\\}\\}`, 'g'), `[REMOVIDO]`);
    // Re-index higher params
    for (let i = paramsList.length; i > oldNum; i--) {
      newBody = newBody.replace(new RegExp(`\\{\\{${i}\\}\\}`, 'g'), `{{${i - 1}}}`);
    }
    setBodyText(newBody);
  };

  // Button management
  const addButton = (type: "url" | "quick_reply" | "phone") => {
    if (buttons.length >= 3) {
      toast({ title: "Limite atingido", description: "A Meta permite no máximo 3 botões por template", variant: "destructive" });
      return;
    }
    setButtons(prev => [...prev, { type, text: "", url_base: "", has_dynamic_suffix: false, phone_number: "" }]);
  };

  const updateButton = (index: number, updates: Partial<ButtonEntry>) => {
    setButtons(prev => prev.map((b, i) => i === index ? { ...b, ...updates } : b));
  };

  const removeButton = (index: number) => {
    setButtons(prev => prev.filter((_, i) => i !== index));
  };

  // Build preview text
  const getPreviewText = () => {
    let preview = bodyText;
    paramsList.forEach((param, i) => {
      const example = VARIABLE_EXAMPLES[param] || `[${param}]`;
      preview = preview.replace(new RegExp(`\\{\\{${i + 1}\\}\\}`, 'g'), example);
    });
    return preview;
  };

  const handleCreateTemplate = async () => {
    if (!templateName.trim() || !bodyText.trim()) {
      toast({ title: "Campos obrigatórios", description: "Nome e conteúdo do corpo são obrigatórios", variant: "destructive" });
      return;
    }

    const namePattern = /^[a-z0-9_]+$/;
    if (!namePattern.test(templateName)) {
      toast({ title: "Nome inválido", description: "Use apenas letras minúsculas, números e underscores", variant: "destructive" });
      return;
    }

    // Validate buttons
    for (const btn of buttons) {
      if (!btn.text.trim()) {
        toast({ title: "Botão incompleto", description: "Preencha o texto de todos os botões", variant: "destructive" });
        return;
      }
      if (btn.type === "url" && !btn.url_base?.trim()) {
        toast({ title: "Botão incompleto", description: "Preencha a URL base do botão", variant: "destructive" });
        return;
      }
      if (btn.type === "phone" && !btn.phone_number?.trim()) {
        toast({ title: "Botão incompleto", description: "Preencha o número de telefone do botão", variant: "destructive" });
        return;
      }
    }

    setIsSubmitting(true);
    try {
      const components: any[] = [];
      
      if (headerText.trim()) {
        components.push({ type: "HEADER", format: "TEXT", text: headerText });
      }
      
      const bodyVariables = bodyText.match(/\{\{(\d+)\}\}/g) || [];
      const bodyComponent: any = { type: "BODY", text: bodyText };
      
      if (bodyVariables.length > 0) {
        bodyComponent.example = {
          body_text: [paramsList.map((param) => VARIABLE_EXAMPLES[param] || `exemplo_${param}`)],
        };
      }
      components.push(bodyComponent);
      
      if (footerText.trim()) {
        components.push({ type: "FOOTER", text: footerText });
      }

      // Build buttons component
      if (buttons.length > 0) {
        const buttonComponent: any = {
          type: "BUTTONS",
          buttons: buttons.map((btn) => {
            if (btn.type === "url") {
              const button: any = {
                type: "URL",
                text: btn.text,
                url: btn.has_dynamic_suffix ? `${btn.url_base}{{1}}` : btn.url_base!,
              };
              if (btn.has_dynamic_suffix) {
                button.example = ["exemplo_token_123"];
              }
              return button;
            }
            if (btn.type === "phone") {
              return {
                type: "PHONE_NUMBER",
                text: btn.text,
                phone_number: btn.phone_number,
              };
            }
            // quick_reply
            return {
              type: "QUICK_REPLY",
              text: btn.text,
            };
          }),
        };
        components.push(buttonComponent);
      }

      const { data, error } = await supabase.functions.invoke("create-waba-template", {
        body: {
          name: templateName,
          category: templateCategory,
          language: templateLanguage,
          components,
        },
      });

      if (error) throw error;

      if (data?.success) {
        toast({ title: "✅ Template enviado para aprovação!", description: `Template "${templateName}" foi enviado para análise da Meta.` });
        onOpenChange(false);
        resetForm();
        loadMetaTemplates();
      } else {
        toast({ title: "Erro ao criar template", description: data?.error || "Falha ao enviar template", variant: "destructive" });
      }
    } catch (err: any) {
      toast({ title: "Erro", description: err.message || "Erro ao criar template", variant: "destructive" });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleLinkTemplate = () => {
    if (!selectedTemplate) {
      toast({ title: "Selecione um template", description: "Escolha um template da lista para vincular", variant: "destructive" });
      return;
    }
    onTemplateLinked?.(selectedTemplate.name, selectedTemplate.language);
    toast({ title: "✅ Template vinculado!", description: `Template "${selectedTemplate.name}" foi selecionado. Salve para confirmar.` });
    onOpenChange(false);
  };

  const TEMPLATE_MAPPING: Record<string, string> = {
    "package_arrival": "encomenda_management_5",
    "notification_occurrence": "notificacao_ocorrencia",
    "notify_sindico_defense": "nova_defesa",
  };

  const handleAutoSync = async () => {
    setIsSyncing(true);
    try {
      const approvedMeta = metaTemplates.filter(t => t.status === "APPROVED");
      const matches: { localId: string; localSlug: string; metaName: string; metaLanguage: string }[] = [];
      
      for (const local of localTemplates) {
        if (local.waba_template_name) continue;
        
        const explicitMapping = TEMPLATE_MAPPING[local.slug];
        if (explicitMapping) {
          const metaMatch = approvedMeta.find(m => m.name === explicitMapping);
          if (metaMatch) {
            matches.push({ localId: local.id, localSlug: local.slug, metaName: metaMatch.name, metaLanguage: metaMatch.language });
            continue;
          }
        }
        
        const match = approvedMeta.find(meta => {
          const metaNameNormalized = meta.name.toLowerCase();
          const slugNormalized = local.slug.toLowerCase();
          return metaNameNormalized === slugNormalized || metaNameNormalized.includes(slugNormalized) || slugNormalized.includes(metaNameNormalized);
        });
        
        if (match) {
          matches.push({ localId: local.id, localSlug: local.slug, metaName: match.name, metaLanguage: match.language });
        }
      }
      
      if (matches.length === 0) {
        toast({ title: "Nenhum match encontrado", description: "Nenhum template local corresponde a templates aprovados na Meta" });
        setIsSyncing(false);
        return;
      }
      
      let successCount = 0;
      for (const match of matches) {
        const { error } = await supabase
          .from("whatsapp_templates")
          .update({ waba_template_name: match.metaName, waba_language: match.metaLanguage })
          .eq("id", match.localId);
        if (!error) successCount++;
      }
      
      await loadLocalTemplates();
      queryClient.invalidateQueries({ queryKey: ["whatsapp-templates"] });
      toast({ title: "✅ Sincronização concluída!", description: `${successCount} de ${matches.length} templates foram vinculados automaticamente` });
    } catch (err: any) {
      toast({ title: "Erro na sincronização", description: err.message || "Erro ao sincronizar templates", variant: "destructive" });
    } finally {
      setIsSyncing(false);
    }
  };

  const resetForm = () => {
    setTemplateName("");
    setTemplateCategory("UTILITY");
    setTemplateLanguage("pt_BR");
    setHeaderText("");
    setBodyText("");
    setFooterText("");
    setParamsList([]);
    setButtons([]);
    setShowPreview(false);
    setSelectedTemplate(null);
    setSearchQuery("");
  };

  const getStatusBadge = (status: string) => {
    const configs: Record<string, { icon: typeof CheckCircle; label: string; className: string }> = {
      APPROVED: { icon: CheckCircle, label: "Aprovado", className: "bg-green-500/10 text-green-600 border-green-500/20" },
      PENDING: { icon: Clock, label: "Pendente", className: "bg-yellow-500/10 text-yellow-600 border-yellow-500/20" },
      REJECTED: { icon: XCircle, label: "Rejeitado", className: "bg-red-500/10 text-red-600 border-red-500/20" },
    };
    const config = configs[status] || { icon: AlertCircle, label: status, className: "" };
    const Icon = config.icon;
    return (
      <Badge className={`${config.className} gap-1`} variant={configs[status] ? undefined : "secondary"}>
        <Icon className="h-3 w-3" />
        {config.label}
      </Badge>
    );
  };

  const linkedWabaNames = new Set(
    localTemplates.filter(lt => lt.waba_template_name).map(lt => lt.waba_template_name!.toLowerCase())
  );

  const filteredTemplates = metaTemplates.filter((t) =>
    t.name.toLowerCase().includes(searchQuery.toLowerCase()) && !linkedWabaNames.has(t.name.toLowerCase())
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Gerenciar Templates WABA
          </DialogTitle>
          <DialogDescription>
            Crie novos templates para aprovação ou vincule templates já aprovados na Meta
          </DialogDescription>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as "create" | "link")} className="flex-1 overflow-hidden flex flex-col">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="link" className="gap-2">
              <Link2 className="h-4 w-4" />
              Vincular Existente
            </TabsTrigger>
            <TabsTrigger value="create" className="gap-2">
              <Send className="h-4 w-4" />
              Criar Novo
            </TabsTrigger>
          </TabsList>

          {/* Link Tab */}
          <TabsContent value="link" className="flex-1 overflow-hidden flex flex-col mt-4">
            <div className="flex items-center gap-2 mb-3">
              <Input
                placeholder="Buscar template..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="flex-1"
              />
              <Button variant="outline" size="icon" onClick={loadMetaTemplates} disabled={isLoadingTemplates}>
                <RefreshCw className={`h-4 w-4 ${isLoadingTemplates ? "animate-spin" : ""}`} />
              </Button>
            </div>

            {isLoadingTemplates ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            ) : (
              <ScrollArea className="flex-1 -mx-6 px-6">
                <div className="space-y-2">
                  {filteredTemplates.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">
                      {searchQuery ? "Nenhum template encontrado" : "Nenhum template disponível na conta Meta"}
                    </div>
                  ) : (
                    filteredTemplates.map((template) => (
                      <div
                        key={template.id}
                        onClick={() => setSelectedTemplate(template)}
                        className={`p-3 rounded-lg border cursor-pointer transition-colors ${
                          selectedTemplate?.id === template.id ? "border-primary bg-primary/5" : "border-border hover:bg-muted/50"
                        }`}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0 flex-1">
                            <p className="font-mono text-sm font-medium truncate">{template.name}</p>
                            <div className="flex items-center gap-2 mt-1 flex-wrap">
                              {getStatusBadge(template.status)}
                              <Badge variant="outline" className="text-xs">{template.language}</Badge>
                              <Badge variant="secondary" className="text-xs">{template.category}</Badge>
                            </div>
                            {template.rejected_reason && (
                              <p className="text-xs text-red-500 mt-1.5">Motivo: {template.rejected_reason}</p>
                            )}
                          </div>
                          {selectedTemplate?.id === template.id && (
                            <CheckCircle className="h-5 w-5 text-primary shrink-0" />
                          )}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </ScrollArea>
            )}

            <div className="flex flex-col sm:flex-row justify-between gap-2 pt-4 border-t mt-4">
              <Button variant="secondary" onClick={handleAutoSync} disabled={isSyncing || isLoadingTemplates || metaTemplates.length === 0} className="gap-2">
                {isSyncing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Zap className="h-4 w-4" />}
                Sincronizar por Slug
              </Button>
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
                <Button onClick={handleLinkTemplate} disabled={!selectedTemplate || selectedTemplate.status !== "APPROVED"}>
                  <Link2 className="h-4 w-4 mr-2" />
                  Vincular
                </Button>
              </div>
            </div>
          </TabsContent>

          {/* Create Tab */}
          <TabsContent value="create" className="flex-1 overflow-hidden flex flex-col mt-4">
            <ScrollArea className="flex-1 -mx-6 px-6">
              <div className="space-y-4">
                {/* Tip */}
                <div className="rounded-lg border border-amber-200 bg-amber-50 dark:bg-amber-950/20 dark:border-amber-800 p-3">
                  <p className="text-xs text-amber-700 dark:text-amber-300">
                    <strong>Dica:</strong> Templates devem seguir as políticas da Meta. Use os parâmetros predefinidos abaixo para inserir variáveis.
                    O template será analisado e pode levar de minutos a horas para aprovação.
                  </p>
                </div>

                {/* Name + Category + Language */}
                <div className="grid gap-4 sm:grid-cols-3">
                  <div className="space-y-2">
                    <Label>Nome do Template *</Label>
                    <Input
                      value={templateName}
                      onChange={(e) => setTemplateName(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, "_"))}
                      placeholder="meu_template_v1"
                      className="font-mono"
                    />
                    <p className="text-xs text-muted-foreground">Letras minúsculas, números e _</p>
                  </div>
                  <div className="space-y-2">
                    <Label>Categoria *</Label>
                    <Select value={templateCategory} onValueChange={setTemplateCategory}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {META_CATEGORIES.map((cat) => (
                          <SelectItem key={cat.value} value={cat.value}>
                            <div>
                              <p>{cat.label}</p>
                              <p className="text-xs text-muted-foreground">{cat.description}</p>
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Idioma</Label>
                    <Select value={templateLanguage} onValueChange={setTemplateLanguage}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {LANGUAGES.map((lang) => (
                          <SelectItem key={lang.value} value={lang.value}>{lang.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {/* Header */}
                <div className="space-y-2">
                  <Label>Cabeçalho (opcional)</Label>
                  <Input value={headerText} onChange={(e) => setHeaderText(e.target.value)} placeholder="Título do template" />
                </div>

                {/* Predefined Parameters */}
                <div className="space-y-3 rounded-lg border p-4">
                  <div className="flex items-center gap-2">
                    <Variable className="h-4 w-4 text-primary" />
                    <Label className="text-base font-medium">Parâmetros Predefinidos</Label>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Clique para inserir a variável no corpo da mensagem. A posição do cursor será usada.
                  </p>

                  {/* Active params */}
                  {paramsList.length > 0 && (
                    <div className="flex flex-wrap gap-2 pb-2">
                      {paramsList.map((param, index) => (
                        <Badge key={param} variant="secondary" className="gap-1.5 pl-2 pr-1 py-1">
                          <span className="text-xs font-mono text-primary">{`{{${index + 1}}}`}</span>
                          <span className="text-xs">{param}</span>
                          <button onClick={() => removeParam(index)} className="ml-0.5 rounded-full hover:bg-destructive/20 p-0.5">
                            <XCircle className="h-3 w-3 text-muted-foreground hover:text-destructive" />
                          </button>
                        </Badge>
                      ))}
                    </div>
                  )}

                  <Separator />

                  {/* Parameter groups */}
                  <div className="space-y-2 max-h-[200px] overflow-y-auto">
                    {PREDEFINED_PARAMS.map((group) => (
                      <div key={group.group}>
                        <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-1">{group.group}</p>
                        <div className="flex flex-wrap gap-1">
                          {group.params.map((param) => {
                            const isActive = paramsList.includes(param);
                            return (
                              <Button
                                key={param}
                                type="button"
                                variant={isActive ? "default" : "outline"}
                                size="sm"
                                className="h-6 px-2 text-[11px] font-mono"
                                disabled={isActive}
                                onClick={() => insertVariable(param)}
                              >
                                {param}
                              </Button>
                            );
                          })}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Body */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label>Corpo da Mensagem *</Label>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-7 gap-1 text-xs"
                      onClick={() => setShowPreview(!showPreview)}
                    >
                      <Eye className="h-3 w-3" />
                      {showPreview ? "Editar" : "Preview"}
                    </Button>
                  </div>

                  {showPreview ? (
                    <div className="rounded-lg border bg-[#e5ddd5] dark:bg-[#0b141a] p-4 min-h-[160px]">
                      <div className="max-w-[85%] rounded-lg bg-[#dcf8c6] dark:bg-[#005c4b] p-3 shadow-sm">
                        {headerText && (
                          <p className="font-bold text-sm mb-1 text-foreground">{headerText}</p>
                        )}
                        <p className="text-sm whitespace-pre-wrap text-foreground">{getPreviewText()}</p>
                        {footerText && (
                          <p className="text-[11px] text-muted-foreground mt-2">{footerText}</p>
                        )}
                      </div>
                      {buttons.length > 0 && (
                        <div className="max-w-[85%] mt-1 space-y-1">
                          {buttons.map((btn, i) => (
                            <div key={i} className="rounded-lg bg-background border p-2 text-center text-sm text-primary font-medium flex items-center justify-center gap-1.5">
                              {btn.type === "url" && <ExternalLink className="h-3.5 w-3.5" />}
                              {btn.type === "phone" && <Phone className="h-3.5 w-3.5" />}
                              {btn.type === "quick_reply" && <MessageSquare className="h-3.5 w-3.5" />}
                              {btn.text || "Botão"}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  ) : (
                    <Textarea
                      ref={bodyRef}
                      value={bodyText}
                      onChange={(e) => setBodyText(e.target.value)}
                      placeholder="Olá {{1}}, sua reserva no {{2}} está confirmada para {{3}}..."
                      className="min-h-[160px] font-mono text-sm"
                    />
                  )}
                </div>

                {/* Footer */}
                <div className="space-y-2">
                  <Label>Rodapé (opcional)</Label>
                  <Input value={footerText} onChange={(e) => setFooterText(e.target.value)} placeholder="Mensagem automática - NotificaCondo" />
                </div>

                {/* Buttons Section */}
                <div className="space-y-3 rounded-lg border p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <Label className="text-base font-medium flex items-center gap-2">
                        <ExternalLink className="h-4 w-4" />
                        Botões de Ação
                      </Label>
                      <p className="text-xs text-muted-foreground mt-0.5">Até 3 botões por template (regra da Meta)</p>
                    </div>
                    <Badge variant="secondary">{buttons.length}/3</Badge>
                  </div>

                  {buttons.map((btn, index) => (
                    <div key={index} className="rounded-lg border p-3 space-y-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Badge variant="outline" className="text-xs">
                            {btn.type === "url" ? "🔗 URL" : btn.type === "phone" ? "📞 Telefone" : "💬 Resposta Rápida"}
                          </Badge>
                          <span className="text-xs text-muted-foreground">Botão {index + 1}</span>
                        </div>
                        <Button type="button" variant="ghost" size="sm" className="h-7 w-7 p-0 text-destructive hover:text-destructive" onClick={() => removeButton(index)}>
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>

                      <div className="space-y-2">
                        <Label className="text-xs">Texto do Botão *</Label>
                        <Input
                          value={btn.text}
                          onChange={(e) => updateButton(index, { text: e.target.value })}
                          placeholder={btn.type === "url" ? "Ver Detalhes" : btn.type === "phone" ? "Ligar Agora" : "Confirmar"}
                          className="h-8 text-sm"
                        />
                      </div>

                      {btn.type === "url" && (
                        <>
                          <div className="space-y-2">
                            <Label className="text-xs">URL Base *</Label>
                            <Input
                              value={btn.url_base}
                              onChange={(e) => updateButton(index, { url_base: e.target.value })}
                              placeholder="https://notificacondo.com.br/acesso/"
                              className="h-8 text-sm font-mono"
                            />
                          </div>
                          <div className="flex items-center justify-between rounded-lg border p-2.5">
                            <div>
                              <Label className="text-xs font-medium">Sufixo Dinâmico</Label>
                              <p className="text-[10px] text-muted-foreground">Adiciona {"{{1}}"} ao final da URL</p>
                            </div>
                            <Switch
                              checked={btn.has_dynamic_suffix}
                              onCheckedChange={(checked) => updateButton(index, { has_dynamic_suffix: checked })}
                            />
                          </div>
                          {btn.has_dynamic_suffix && (
                            <div className="rounded-lg bg-primary/5 border border-primary/20 p-2.5">
                              <p className="text-[10px] font-medium text-primary">Preview:</p>
                              <code className="text-[11px] bg-background px-2 py-0.5 rounded mt-0.5 block truncate">
                                {btn.url_base || "https://..."}{"{{1}}"}
                              </code>
                            </div>
                          )}
                        </>
                      )}

                      {btn.type === "phone" && (
                        <div className="space-y-2">
                          <Label className="text-xs">Número de Telefone *</Label>
                          <Input
                            value={btn.phone_number}
                            onChange={(e) => updateButton(index, { phone_number: e.target.value })}
                            placeholder="+5511999999999"
                            className="h-8 text-sm font-mono"
                          />
                        </div>
                      )}
                    </div>
                  ))}

                  {buttons.length < 3 && (
                    <div className="flex gap-2">
                      <Button type="button" variant="outline" size="sm" className="gap-1.5 text-xs flex-1" onClick={() => addButton("url")}>
                        <ExternalLink className="h-3.5 w-3.5" />
                        Link URL
                      </Button>
                      <Button type="button" variant="outline" size="sm" className="gap-1.5 text-xs flex-1" onClick={() => addButton("phone")}>
                        <Phone className="h-3.5 w-3.5" />
                        Telefone
                      </Button>
                      <Button type="button" variant="outline" size="sm" className="gap-1.5 text-xs flex-1" onClick={() => addButton("quick_reply")}>
                        <MessageSquare className="h-3.5 w-3.5" />
                        Resposta Rápida
                      </Button>
                    </div>
                  )}
                </div>
              </div>
            </ScrollArea>

            <div className="flex justify-end gap-2 pt-4 border-t mt-4">
              <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
              <Button onClick={handleCreateTemplate} disabled={isSubmitting || !templateName.trim() || !bodyText.trim()}>
                {isSubmitting ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Send className="h-4 w-4 mr-2" />}
                Enviar para Aprovação
              </Button>
            </div>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
