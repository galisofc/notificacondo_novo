import { Helmet } from "react-helmet-async";
import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import BlockApartmentDisplay from "@/components/common/BlockApartmentDisplay";
import { DeliveryStatusTracker } from "@/components/packages/DeliveryStatusTracker";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  ArrowLeft,
  Loader2,
  Calendar,
  MapPin,
  User,
  Building2,
  Home,
  Scale,
  FileText,
  Image as ImageIcon,
  Video,
  Clock,
  CheckCircle2,
  AlertTriangle,
  Send,
  MessageSquare,
  Gavel,
  Download,
  X,
  MessageCircle,
  FileDown,
  Smartphone,
  Monitor,
  Eye,
  Globe,
  ChevronDown,
  ChevronsUpDown,
} from "lucide-react";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { useToast } from "@/hooks/use-toast";
import DashboardLayout from "@/components/layouts/DashboardLayout";
import SindicoBreadcrumbs from "@/components/sindico/SindicoBreadcrumbs";
import { useDateFormatter } from "@/hooks/useFormattedDate";
import { fetchOccurrencePdfTemplate, interpolate } from "@/hooks/useOccurrencePdfTemplate";

interface Occurrence {
  id: string;
  protocol?: string | null;
  title: string;
  description: string;
  type: "advertencia" | "notificacao" | "multa";
  status: string;
  occurred_at: string;
  created_at: string;
  location: string | null;
  convention_article: string | null;
  internal_rules_article: string | null;
  civil_code_article: string | null;
  legal_basis: string | null;
  apartment_id: string | null;
  resident_id: string | null;
  condominium_id: string;
  condominiums: {
    name: string;
    defense_deadline_days: number;
    address: string | null;
    address_number: string | null;
    neighborhood: string | null;
    city: string | null;
    state: string | null;
    zip_code: string | null;
    owner_id: string;
    logo_url: string | null;
    sindico_name: string | null;
  } | null;
  blocks: { name: string } | null;
  apartments: { number: string } | null;
  residents: { id: string; full_name: string; email: string; phone: string | null; bsuid: string | null } | null;
}

interface Evidence {
  id: string;
  file_url: string;
  file_type: string;
  description: string | null;
  created_at: string;
}

interface Defense {
  id: string;
  content: string;
  deadline: string;
  submitted_at: string;
  residents: { full_name: string } | null;
  defense_attachments: { id: string; file_url: string; file_type: string }[];
}

interface Decision {
  id: string;
  decision: string;
  justification: string;
  decided_at: string;
}

interface Notification {
  id: string;
  sent_at: string;
  sent_via: string;
  delivered_at: string | null;
  read_at: string | null;
  acknowledged_at: string | null;
  accepted_at: string | null;
  device_info: unknown;
  location_info: unknown;
  ip_address: string | null;
  user_agent: string | null;
  zpro_status: string | null;
}

interface AccessLog {
  id: string;
  ip_address: string | null;
  user_agent: string | null;
  created_at: string;
  resident_id: string | null;
}

interface TimelineItem {
  id: string;
  type: "created" | "notification" | "defense" | "decision" | "evidence" | "read" | "acknowledged" | "accessed";
  title: string;
  description: React.ReactNode;
  date: string;
  icon: React.ReactNode;
  color: string;
  deliveryStatus?: string | null;
  deliveryTimestamps?: import("@/components/packages/DeliveryStatusTracker").DeliveryTimestamps;
}

const OccurrenceDetails = () => {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { dateTime: formatDateTime, dateTimeLong: formatDateTimeLong } = useDateFormatter();

  const [occurrence, setOccurrence] = useState<Occurrence | null>(null);
  const [evidences, setEvidences] = useState<Evidence[]>([]);
  const [defenses, setDefenses] = useState<Defense[]>([]);
  const [decisions, setDecisions] = useState<Decision[]>([]);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [timeline, setTimeline] = useState<TimelineItem[]>([]);
  const [accessLogs, setAccessLogs] = useState<AccessLog[]>([]);
  const [unitHistory, setUnitHistory] = useState<{ advertencia: number; notificacao: number; multa: number; items: any[] }>({ advertencia: 0, notificacao: 0, multa: 0, items: [] });

  // Decision dialog
  const [isDecisionDialogOpen, setIsDecisionDialogOpen] = useState(false);
  const [decisionData, setDecisionData] = useState({
    decision: "" as "arquivada" | "advertido" | "multado" | "",
    justification: "",
  });
  const [savingDecision, setSavingDecision] = useState(false);

  // Image preview
  const [previewImage, setPreviewImage] = useState<string | null>(null);

  // WhatsApp notification
  const [sendingWhatsApp, setSendingWhatsApp] = useState(false);
  
  // Notifications collapse state
  const [expandedNotifications, setExpandedNotifications] = useState<Set<string>>(new Set());
  const [allExpanded, setAllExpanded] = useState(false);

  const toggleAllNotifications = () => {
    if (allExpanded) {
      setExpandedNotifications(new Set());
    } else {
      setExpandedNotifications(new Set(notifications.map(n => n.id)));
    }
    setAllExpanded(!allExpanded);
  };

  const toggleNotification = (id: string) => {
    const newSet = new Set(expandedNotifications);
    if (newSet.has(id)) {
      newSet.delete(id);
    } else {
      newSet.add(id);
    }
    setExpandedNotifications(newSet);
    setAllExpanded(newSet.size === notifications.length);
  };

  useEffect(() => {
    if (id) fetchData();
  }, [id]);

  // Realtime: update zpro_status on notifications_sent changes
  useEffect(() => {
    if (!id) return;
    const channel = supabase
      .channel(`occ-notif-status-${id}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "notifications_sent",
          filter: `occurrence_id=eq.${id}`,
        },
        (payload) => {
          const updated = payload.new as any;
          setNotifications((prev) => {
            const next = prev.map((n) =>
              n.id === updated.id
                ? { ...n, zpro_status: updated.zpro_status, delivered_at: updated.delivered_at, read_at: updated.read_at, accepted_at: updated.accepted_at }
                : n
            
            if (occurrence) {
              buildTimeline(occurrence, evidences, defenses, decisions, next, accessLogs);
            }
            return next;
          });
        }
      )
      .subscribe();

    return (
      <Helmet>
        <title>NotificaCondo - Detalhes da Ocorrência</title>
      </Helmet>
    <>
      < ImageIcon className="w-5 h-5" />;
    if (type === "video") return <Video className="w-5 h-5" />;
    return <FileText className="w-5 h-5" />;
  };

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center py-24">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      </DashboardLayout>
    
    <>
  );
  }

  if (!occurrence) {
    return (
      <DashboardLayout>
        <div className="container mx-auto px-4 py-8">
          <p className="text-center text-muted-foreground">Ocorrência não encontrada.</p>
        </div>
      </DashboardLayout>
    
    <>
  );
  }

  return (
    <DashboardLayout>
      <div className="space-y-4 md:space-y-6 animate-fade-up">
        <SindicoBreadcrumbs 
          items={[
            { label: "Ocorrências", href: "/occurrences" },
            { label: occurrence.title }
          ]} 
        />

        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-start gap-4 mb-4 md:mb-8">
          <Button variant="ghost" size="icon" onClick={() => navigate("/occurrences")} className="self-start shrink-0">
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div className="flex-1 min-w-0">
            <div className="flex flex-wrap items-center gap-2 mb-2">
              {occurrence.protocol && (
                <span className="px-2 py-1 rounded-md text-xs font-mono bg-muted text-foreground border border-border">
                  Protocolo {occurrence.protocol}
                </span>
              )}
              {getTypeBadge(occurrence.type)}
              {getStatusBadge(occurrence.status)}
            </div>
            <h1 className="font-display text-xl md:text-2xl lg:text-3xl font-bold text-foreground break-words">
              {occurrence.title}
            </h1>
          </div>
          <div className="flex items-center gap-2 flex-wrap shrink-0">
            <Button 
              variant="outline" 
              onClick={generatePDF}
              className="border-primary/50 text-primary hover:bg-primary/10 text-xs md:text-sm"
              size="sm"
            >
              <FileDown className="w-4 h-4 mr-1 md:mr-2" />
              Baixar PDF
            </Button>
            {occurrence.residents && !["arquivada", "advertido", "multado"].includes(occurrence.status) && (
              <Button 
                variant="outline" 
                onClick={handleSendWhatsApp}
                disabled={sendingWhatsApp}
                className="border-green-500/50 text-green-500 hover:bg-green-500/10 hover:text-green-400"
              >
                {sendingWhatsApp ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <MessageCircle className="w-4 h-4 mr-2" />
                )}
                Notificar via WhatsApp
              </Button>
            )}
            {!["arquivada", "advertido", "multado"].includes(occurrence.status) && (
              <Button variant="hero" onClick={() => setIsDecisionDialogOpen(true)}>
                <Gavel className="w-4 h-4 mr-2" />
                Registrar Decisão
              </Button>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Column - Main Info */}
          <div className="lg:col-span-2 space-y-6">
            {/* Location & Date */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Card className="bg-gradient-card border-border/50">
                <CardContent className="pt-6">
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
                      <Calendar className="w-5 h-5 text-primary" />
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Data da Ocorrência</p>
                      <p className="font-medium text-foreground">{formatDateLocal(occurrence.occurred_at)}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {occurrence.location && (
                <Card className="bg-gradient-card border-border/50">
                  <CardContent className="pt-6">
                    <div className="flex items-start gap-3">
                      <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
                        <MapPin className="w-5 h-5 text-primary" />
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground">Local</p>
                        <p className="font-medium text-foreground">{occurrence.location}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>

            {/* Description */}
            <Card className="bg-gradient-card border-border/50">
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <AlertTriangle className="w-5 h-5 text-primary" />
                  Descrição
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-foreground whitespace-pre-line text-justify">{occurrence.description}</p>
              </CardContent>
            </Card>

            {/* Legal Basis */}
            {(occurrence.convention_article || occurrence.internal_rules_article || occurrence.civil_code_article || occurrence.legal_basis) && (
              <Card className="bg-gradient-card border-border/50">
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Scale className="w-5 h-5 text-primary" />
                    Fundamentação Legal
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {occurrence.convention_article && (
                    <div>
                      <p className="text-sm text-muted-foreground">Artigo da Convenção</p>
                      <p className="font-medium text-foreground whitespace-pre-line text-justify">{occurrence.convention_article}</p>
                    </div>
                  )}
                  {occurrence.internal_rules_article && (
                    <div>
                      <p className="text-sm text-muted-foreground">Artigo do Regimento Interno</p>
                      <p className="font-medium text-foreground whitespace-pre-line text-justify">{occurrence.internal_rules_article}</p>
                    </div>
                  )}
                  {occurrence.civil_code_article && (
                    <div>
                      <p className="text-sm text-muted-foreground">Artigo do Código Civil</p>
                      <p className="font-medium text-foreground whitespace-pre-line text-justify">{occurrence.civil_code_article}</p>
                    </div>
                  )}
                  {occurrence.legal_basis && (
                    <div>
                      <p className="text-sm text-muted-foreground">Observações Legais</p>
                      <p className="font-medium text-foreground whitespace-pre-line text-justify">{occurrence.legal_basis}</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

            {/* Evidences */}
            <Card className="bg-gradient-card border-border/50">
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <FileText className="w-5 h-5 text-primary" />
                  Provas ({evidences.length})
                </CardTitle>
              </CardHeader>
              <CardContent>
                {evidences.length === 0 ? (
                  <p className="text-muted-foreground text-sm">Nenhuma prova anexada.</p>
                ) : (
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                    {evidences.map((ev) => (
                      <div
                        key={ev.id}
                        className="relative group rounded-xl overflow-hidden border border-border/50 bg-muted/30"
                      >
                        {ev.file_type === "image" ? (
                          <img
                            src={ev.file_url}
                            alt={ev.description || "Prova"}
                            className="w-full h-32 object-cover cursor-pointer"
                            onClick={() => setPreviewImage(ev.file_url)}
                          />
                        ) : ev.file_type === "video" ? (
                          <video
                            src={ev.file_url}
                            className="w-full h-32 object-cover"
                            controls
                          />
                        ) : (
                          <a
                            href={ev.file_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center justify-center w-full h-32 bg-muted"
                          >
                            <FileText className="w-8 h-8 text-muted-foreground" />
                          </a>
                        )}
                        <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                          {ev.file_type === "image" && (
                            <Button
                              size="sm"
                              variant="secondary"
                              onClick={() => setPreviewImage(ev.file_url)}
                            >
                              Ver
                            </Button>
                          )}
                          <a href={ev.file_url} download target="_blank" rel="noopener noreferrer">
                            <Button size="sm" variant="secondary">
                              <Download className="w-4 h-4" />
                            </Button>
                          </a>
                        </div>
                        {ev.description && (
                          <p className="p-2 text-xs text-muted-foreground truncate">
                            {ev.description}
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Defenses */}
            <Card className="bg-gradient-card border-border/50">
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <MessageSquare className="w-5 h-5 text-primary" />
                  Defesas ({defenses.length})
                </CardTitle>
              </CardHeader>
              <CardContent>
                {defenses.length === 0 ? (
                  <p className="text-muted-foreground text-sm">Nenhuma defesa apresentada.</p>
                ) : (
                  <div className="space-y-4">
                    {defenses.map((def) => (
                      <div
                        key={def.id}
                        className="p-4 rounded-xl bg-muted/30 border border-border/50"
                      >
                        <div className="flex items-center justify-between mb-2">
                          <span className="font-medium text-foreground">
                            {def.residents?.full_name || "Morador"}
                          </span>
                          <span className="text-xs text-muted-foreground">
                            {formatDateLocal(def.submitted_at)}
                          </span>
                        </div>
                        <p className="text-foreground whitespace-pre-line text-justify mb-3">{def.content}</p>
                        {def.defense_attachments && def.defense_attachments.length > 0 && (
                          <div className="flex flex-wrap gap-2">
                            {def.defense_attachments.map((att) => (
                              <a
                                key={att.id}
                                href={att.file_url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="flex items-center gap-1 px-2 py-1 rounded-lg bg-muted text-xs text-muted-foreground hover:text-foreground transition-colors"
                              >
                                {getFileIcon(att.file_type)}
                                Anexo
                              </a>
                            ))}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Decisions */}
            <Card className="bg-gradient-card border-border/50">
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Gavel className="w-5 h-5 text-primary" />
                  Decisões ({decisions.length})
                </CardTitle>
              </CardHeader>
              <CardContent>
                {decisions.length === 0 ? (
                  <p className="text-muted-foreground text-sm">Nenhuma decisão registrada.</p>
                ) : (
                  <div className="space-y-4">
                    {decisions.map((dec) => {
                      const decisionLabels: Record<string, string> = {
                        arquivada: "Arquivada",
                        advertido: "Advertência Aplicada",
                        multado: "Multa Aplicada",
                      };
                      const decisionColors: Record<string, string> = {
                        arquivada: "bg-muted text-muted-foreground",
                        advertido: "bg-orange-500/10 text-orange-500",
                        multado: "bg-red-500/10 text-red-500",
                      };
                      return (
                        <div
                          key={dec.id}
                          className="p-4 rounded-xl bg-muted/30 border border-border/50"
                        >
                          <div className="flex items-center justify-between mb-2">
                            <span className={`px-2 py-1 rounded-full text-xs font-medium ${decisionColors[dec.decision] || ""}`}>
                              {decisionLabels[dec.decision] || dec.decision}
                            </span>
                            <span className="text-xs text-muted-foreground">
                              {formatDateLocal(dec.decided_at)}
                            </span>
                          </div>
                          <p className="text-foreground whitespace-pre-line text-justify">{dec.justification}</p>
                        </div>
                      
    <>
  );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Right Column - Timeline & Info */}
          <div className="space-y-6">
            {/* Involved Parties */}
            <Card className="bg-gradient-card border-border/50">
              <CardHeader>
                <CardTitle className="text-lg">Envolvidos</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
                    <Building2 className="w-5 h-5 text-primary" />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Condomínio</p>
                    <p className="font-medium text-foreground">{occurrence.condominiums?.name}</p>
                  </div>
                </div>

                {occurrence.blocks?.name && (
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
                      <Home className="w-5 h-5 text-primary" />
                    </div>
                    <div>
                      <BlockApartmentDisplay
                        blockName={occurrence.blocks.name}
                        apartmentNumber={occurrence.apartments?.number}
                        variant="label"
                      />
                    </div>
                  </div>
                )}

                {occurrence.residents?.full_name && (
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
                      <User className="w-5 h-5 text-primary" />
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Morador</p>
                      <p className="font-medium text-foreground">{occurrence.residents.full_name}</p>
                      <p className="text-xs text-muted-foreground">{occurrence.residents.email}</p>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Unit History */}
            {occurrence.apartment_id && (unitHistory.advertencia > 0 || unitHistory.notificacao > 0 || unitHistory.multa > 0) && (
              <Card className="bg-gradient-card border-border/50">
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <AlertTriangle className="w-5 h-5 text-amber-500" />
                    Histórico da Unidade
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-3 gap-2">
                    {unitHistory.advertencia > 0 && (
                      <div className="text-center p-2 rounded-lg bg-amber-500/10">
                        <p className="text-lg font-bold text-amber-600 dark:text-amber-400">{unitHistory.advertencia}</p>
                        <p className="text-xs text-muted-foreground">Advertência{unitHistory.advertencia !== 1 ? 's' : ''}</p>
                      </div>
                    )}
                    {unitHistory.notificacao > 0 && (
                      <div className="text-center p-2 rounded-lg bg-blue-500/10">
                        <p className="text-lg font-bold text-blue-600 dark:text-blue-400">{unitHistory.notificacao}</p>
                        <p className="text-xs text-muted-foreground">Notificação{unitHistory.notificacao !== 1 ? 'ões' : ''}</p>
                      </div>
                    )}
                    {unitHistory.multa > 0 && (
                      <div className="text-center p-2 rounded-lg bg-red-500/10">
                        <p className="text-lg font-bold text-red-600 dark:text-red-400">{unitHistory.multa}</p>
                        <p className="text-xs text-muted-foreground">Multa{unitHistory.multa !== 1 ? 's' : ''}</p>
                      </div>
                    )}
                  </div>
                  {unitHistory.items.length > 0 && (
                    <div className="space-y-2">
                      <p className="text-xs font-medium text-muted-foreground">Ocorrências anteriores:</p>
                      {unitHistory.items.map((item) => {
                        const typeColors: Record<string, string> = {
                          advertencia: "text-amber-500",
                          notificacao: "text-blue-500",
                          multa: "text-red-500",
                        };
                        const typeLabels: Record<string, string> = {
                          advertencia: "Adv.",
                          notificacao: "Not.",
                          multa: "Multa",
                        };
                        return (
                          <div key={item.id} className="flex items-center gap-2 text-xs p-2 rounded-lg bg-muted/30 cursor-pointer hover:bg-muted/50 transition-colors" onClick={() => navigate(`/occurrences/${item.id}`)}>
                            <span className={`font-medium ${typeColors[item.type] || ""}`}>{typeLabels[item.type] || item.type}</span>
                            <span className="flex-1 truncate text-foreground">{item.title}</span>
                            <span className="text-muted-foreground shrink-0">{formatDateTime(item.created_at)}</span>
                          </div>
                        
    <>
  );
                      })}
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

            {/* Timeline */}
            <Collapsible defaultOpen>
              <Card className="bg-gradient-card border-border/50">
                <CardHeader className="pb-3">
                  <CollapsibleTrigger asChild>
                    <button className="w-full flex items-center justify-between text-left hover:bg-muted/20 -m-2 p-2 rounded-md transition-colors">
                      <CardTitle className="text-lg flex items-center gap-2">
                        <Clock className="w-5 h-5 text-primary" />
                        Timeline
                        <Badge variant="secondary" className="text-xs font-semibold ml-2">
                          {timeline.length} {timeline.length === 1 ? 'evento' : 'eventos'}
                        </Badge>
                      </CardTitle>
                      <ChevronDown className="w-5 h-5 text-muted-foreground transition-transform duration-200 [[data-state=open]>&]:rotate-180" />
                    </button>
                  </CollapsibleTrigger>
                </CardHeader>
                <CollapsibleContent className="overflow-hidden data-[state=closed]:animate-accordion-up data-[state=open]:animate-accordion-down">
                  <CardContent>
                    {timeline.length === 0 ? (
                      <p className="text-muted-foreground text-sm">Sem eventos.</p>
                    ) : (
                      <div className="relative">
                        <div className="absolute left-[17px] top-0 bottom-0 w-0.5 bg-border" />
                        <div className="space-y-6">
                          {timeline.map((item, index) => (
                            <div key={item.id} className="relative flex gap-4">
                              <div className={`w-9 h-9 rounded-full ${item.color} flex items-center justify-center text-white z-10`}>
                                {item.icon}
                              </div>
                              <div className="flex-1 pt-1">
                                <p className="font-medium text-foreground text-sm">{item.title}</p>
                                <p className="text-xs text-muted-foreground mb-1">{item.description}</p>
                                <p className="text-xs text-muted-foreground/70">
                                  {formatDateLocal(item.date)}
                                </p>
                                {item.type === "notification" && item.deliveryStatus && (
                                  <DeliveryStatusTracker status={item.deliveryStatus} timestamps={item.deliveryTimestamps} className="mt-1.5" />
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </CardContent>
                </CollapsibleContent>
              </Card>
            </Collapsible>

          </div>
        </div>
      </div>

      {/* Decision Dialog */}
      <Dialog open={isDecisionDialogOpen} onOpenChange={setIsDecisionDialogOpen}>
        <DialogContent className="bg-card border-border">
          <DialogHeader>
            <DialogTitle className="font-display text-xl flex items-center gap-2">
              <Gavel className="w-5 h-5 text-primary" />
              Registrar Decisão
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Decisão</label>
              <Select
                value={decisionData.decision}
                onValueChange={(v: "arquivada" | "advertido" | "multado") => setDecisionData({ ...decisionData, decision: v })}
              >
                <SelectTrigger className="bg-background">
                  <SelectValue placeholder="Selecione a decisão" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="arquivada">Arquivar</SelectItem>
                  <SelectItem value="advertido">Aplicar Advertência</SelectItem>
                  <SelectItem value="multado">Aplicar Multa</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Justificativa</label>
              <Textarea
                value={decisionData.justification}
                onChange={(e) => setDecisionData({ ...decisionData, justification: e.target.value })}
                placeholder="Descreva a justificativa para a decisão..."
                rows={5}
                className="bg-background"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDecisionDialogOpen(false)}>
              Cancelar
            </Button>
            <Button variant="hero" onClick={handleSubmitDecision} disabled={savingDecision}>
              {savingDecision && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Confirmar Decisão
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Image Preview Dialog */}
      <Dialog open={!!previewImage} onOpenChange={() => setPreviewImage(null)}>
        <DialogContent className="bg-card border-border max-w-4xl p-0">
          <div className="relative">
            <Button
              variant="ghost"
              size="icon"
              className="absolute top-2 right-2 z-10 bg-black/50 hover:bg-black/70"
              onClick={() => setPreviewImage(null)}
            >
              <X className="w-4 h-4 text-white" />
            </Button>
            {previewImage && (
              <img
                src={previewImage}
                alt="Preview"
                className="w-full h-auto max-h-[80vh] object-contain"
              />
            )}
          </div>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
};

export default OccurrenceDetails;
