import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import DashboardLayout from "@/components/layouts/DashboardLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useToast } from "@/hooks/use-toast";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, CheckCircle2, Clock, Search, AlertTriangle, ClipboardList, ArrowUpRight, CalendarIcon, X, Building2, Home, Camera, ImagePlus, Loader2, FileDown, Trash2, UserCheck, UserX } from "lucide-react";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import SubscriptionGate from "@/components/sindico/SubscriptionGate";
import BlockApartmentDisplay from "@/components/common/BlockApartmentDisplay";
import { format, isWithinInterval, startOfDay, endOfDay } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";
import type { DateRange } from "react-day-picker";

const DEFAULT_CATEGORIES = ["Barulho", "Entrega", "Manutenção", "Outros", "Segurança", "Visitante"];

const PRIORITIES = [
  { value: "baixa", label: "Baixa", color: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200" },
  { value: "media", label: "Média", color: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200" },
  { value: "alta", label: "Alta", color: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200" },
];

interface Occurrence {
  id: string;
  condominium_id: string;
  registered_by: string;
  title: string;
  description: string;
  category: string;
  priority: string;
  status: string;
  occurred_at: string;
  resolved_at: string | null;
  resolved_by: string | null;
  resolved_by_name?: string | null;
  registered_by_name?: string | null;
  resolution_notes: string | null;
  created_at: string;
  reporter_block_id: string | null;
  reporter_apartment_id: string | null;
  target_block_id: string | null;
  target_apartment_id: string | null;
  reporter_block_name?: string | null;
  reporter_apartment_number?: string | null;
  target_block_name?: string | null;
  target_apartment_number?: string | null;
  photos?: string[] | null;
  protocol?: string | null;
}

interface Category {
  id: string;
  name: string;
  display_order: number;
  is_active: boolean;
}

interface Block {
  id: string;
  name: string;
}

interface Apartment {
  id: string;
  number: string;
  block_id: string;
}

export default function PortariaOccurrences() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [condominiums, setCondominiums] = useState<{ id: string; name: string }[]>([]);
  const [selectedCondominium, setSelectedCondominium] = useState<string>("");
  const [filterStatus, setFilterStatus] = useState<string>(() => {
    return localStorage.getItem("porteiro_portaria_status_filter") || "aberta";
  });
  const [filterCategory, setFilterCategory] = useState<string>("all");
  const [searchTerm, setSearchTerm] = useState("");
  const [dateRange, setDateRange] = useState<DateRange | undefined>(undefined);
  const [filterBlockId, setFilterBlockId] = useState<string>("all");
  const [filterApartmentId, setFilterApartmentId] = useState<string>("all");

  // New occurrence form
  const [dialogOpen, setDialogOpen] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newDescription, setNewDescription] = useState("");
  const [newCategory, setNewCategory] = useState("");
  const [newPriority, setNewPriority] = useState("");
  const [reporterBlockId, setReporterBlockId] = useState<string>("");
  const [reporterApartmentId, setReporterApartmentId] = useState<string>("");
  const [targetBlockId, setTargetBlockId] = useState<string>("");
  const [targetApartmentId, setTargetApartmentId] = useState<string>("");
  const [photos, setPhotos] = useState<string[]>([]);
  const [uploadingPhotos, setUploadingPhotos] = useState(false);
  const [previewPhoto, setPreviewPhoto] = useState<string | null>(null);
  const [occurredDate, setOccurredDate] = useState<string>(format(new Date(), "yyyy-MM-dd"));
  const [occurredTime, setOccurredTime] = useState<string>(format(new Date(), "HH:mm"));
  const [identifySelf, setIdentifySelf] = useState<string>("nao");

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0 || !user) return;
    setUploadingPhotos(true);
    try {
      const uploaded: string[] = [];
      for (const file of files) {
        if (!file.type.startsWith("image/")) continue;
        if (file.size > 10 * 1024 * 1024) {
          toast({ title: `Arquivo muito grande: ${file.name}`, description: "Máximo 10MB por foto.", variant: "destructive" });
          continue;
        }
        const ext = file.name.split(".").pop() || "jpg";
        const path = `${user.id}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
        const { error: upErr } = await supabase.storage
          .from("porter-occurrence-photos")
          .upload(path, file, { contentType: file.type, upsert: false });
        if (upErr) throw upErr;
        const { data } = supabase.storage.from("porter-occurrence-photos").getPublicUrl(path);
        uploaded.push(data.publicUrl);
      }
      setPhotos((prev) => [...prev, ...uploaded]);
      if (uploaded.length > 0) toast({ title: `${uploaded.length} foto(s) anexada(s)` });
    } catch (err: any) {
      toast({ title: "Erro ao enviar foto", description: err?.message || "Tente novamente.", variant: "destructive" });
    } finally {
      setUploadingPhotos(false);
      e.target.value = "";
    }
  };

  const removePhoto = (url: string) => {
    setPhotos((prev) => prev.filter((p) => p !== url));
  };

  // Resolve dialog
  const [resolveDialogOpen, setResolveDialogOpen] = useState(false);
  const [resolveOccurrenceId, setResolveOccurrenceId] = useState<string | null>(null);
  const [resolutionNotes, setResolutionNotes] = useState("");

  // Fetch condominiums
  useEffect(() => {
    const fetchCondominiums = async () => {
      if (!user) return;
      const { data } = await supabase
        .from("user_condominiums")
        .select("condominium_id, condominiums:condominium_id(id, name)")
        .eq("user_id", user.id);

      if (data) {
        const condos = data.map((d: any) => ({
          id: d.condominiums.id,
          name: d.condominiums.name,
        }));
        setCondominiums(condos);
        if (condos.length === 1) setSelectedCondominium(condos[0].id);
      }
    };
    fetchCondominiums();
  }, [user]);

  useEffect(() => {
    localStorage.setItem("porteiro_portaria_status_filter", filterStatus);
  }, [filterStatus]);

  // Fetch blocks for selected condominium
  const { data: blocks = [] } = useQuery({
    queryKey: ["blocks", selectedCondominium],
    queryFn: async () => {
      if (!selectedCondominium) return [];
      const { data, error } = await supabase
        .from("blocks")
        .select("id, name")
        .eq("condominium_id", selectedCondominium)
        .order("name");
      if (error) throw error;
      return (data as Block[]).sort((a, b) => 
        a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' })
      );
    },
    enabled: !!selectedCondominium,
    staleTime: 1000 * 60 * 5,
  });

  // Fetch apartments for reporter block
  const { data: reporterApartments = [] } = useQuery({
    queryKey: ["apartments", reporterBlockId],
    queryFn: async () => {
      if (!reporterBlockId) return [];
      const { data, error } = await supabase
        .from("apartments")
        .select("id, number, block_id")
        .eq("block_id", reporterBlockId)
        .order("number");
      if (error) throw error;
      return data as Apartment[];
    },
    enabled: !!reporterBlockId,
    staleTime: 1000 * 60 * 5,
  });

  // Fetch apartments for target block
  const { data: targetApartments = [] } = useQuery({
    queryKey: ["apartments", targetBlockId],
    queryFn: async () => {
      if (!targetBlockId) return [];
      const { data, error } = await supabase
        .from("apartments")
        .select("id, number, block_id")
        .eq("block_id", targetBlockId)
        .order("number");
      if (error) throw error;
      return data as Apartment[];
    },
    enabled: !!targetBlockId,
    staleTime: 1000 * 60 * 5,
  });

  // Fetch categories
  const { data: categories = [] } = useQuery({
    queryKey: ["porter-occurrence-categories", selectedCondominium],
    queryFn: async () => {
      if (!selectedCondominium) return [];
      const { data, error } = await supabase
        .from("porter_occurrence_categories")
        .select("*")
        .eq("condominium_id", selectedCondominium)
        .eq("is_active", true)
        .order("name");
      if (error) throw error;
      return data as Category[];
    },
    enabled: !!selectedCondominium,
  });

  // Default category is now empty to force selection
  useEffect(() => {
    if (categories.length > 0 && !newCategory) {
      setNewCategory(categories[0].name);
    }
    if (!newPriority) {
      setNewPriority(PRIORITIES[1].value); // Média
    }
  }, [categories, newCategory, newPriority]);

  // Seed default categories when a condominium is first selected and has no categories
  useEffect(() => {
    if (!selectedCondominium || !user) return;
    const seedIfNeeded = async () => {
      const { data, error } = await supabase
        .from("porter_occurrence_categories")
        .select("id")
        .eq("condominium_id", selectedCondominium)
        .limit(1);
      if (error || (data && data.length > 0)) return;

      await supabase.from("porter_occurrence_categories").insert(
        DEFAULT_CATEGORIES.map((name, idx) => ({
          condominium_id: selectedCondominium,
          name,
          display_order: idx,
        }))
      );
      queryClient.invalidateQueries({ queryKey: ["porter-occurrence-categories"] });
    };
    seedIfNeeded();
  }, [selectedCondominium, user, queryClient]);

  // Fetch occurrences with block/apartment names
  const { data: occurrences = [], isLoading } = useQuery({
    queryKey: ["porter-occurrences", selectedCondominium],
    queryFn: async () => {
      if (!selectedCondominium) return [];
      let query = supabase
        .from("porter_occurrences")
        .select("*")
        .eq("condominium_id", selectedCondominium)
        .order("created_at", { ascending: false });

      // We no longer filter by status/category at the database level to ensure stat cards are correct
      // but we still fetch everything for the selected condominium.


      const { data, error } = await query;
      if (error) throw error;

      // Fetch profile names for resolved_by and registered_by
      const resolvedByIds = [...new Set((data || []).map((o) => o.resolved_by).filter(Boolean))];
      const registeredByIds = [...new Set((data || []).map((o) => o.registered_by).filter(Boolean))];
      const allUserIds = [...new Set([...resolvedByIds, ...registeredByIds])];
      
      let profileMap: Record<string, string> = {};
      if (allUserIds.length > 0) {
        const { data: profiles } = await supabase
          .from("profiles")
          .select("id, user_id, full_name")
          .in("user_id", allUserIds);
        profileMap = Object.fromEntries((profiles || []).map((p) => [p.user_id || p.id, p.full_name]));
      }

      // Collect block/apartment IDs for name resolution
      const blockIds = [...new Set((data || []).flatMap((o) => [o.reporter_block_id, o.target_block_id]).filter(Boolean))] as string[];
      const aptIds = [...new Set((data || []).flatMap((o) => [o.reporter_apartment_id, o.target_apartment_id]).filter(Boolean))] as string[];

      let blockMap: Record<string, string> = {};
      let aptMap: Record<string, string> = {};

      if (blockIds.length > 0) {
        const { data: blocksData } = await supabase.from("blocks").select("id, name").in("id", blockIds);
        blockMap = Object.fromEntries((blocksData || []).map((b) => [b.id, b.name]));
      }
      if (aptIds.length > 0) {
        const { data: aptsData } = await supabase.from("apartments").select("id, number").in("id", aptIds);
        aptMap = Object.fromEntries((aptsData || []).map((a) => [a.id, a.number]));
      }

      return (data || []).map((o: any) => ({
        ...o,
        resolved_by_name: o.resolved_by_name ?? (o.resolved_by ? (profileMap[o.resolved_by] ?? null) : null),
        registered_by_name: o.registered_by_name ?? (o.registered_by ? (profileMap[o.registered_by] ?? null) : null),
        reporter_block_name: o.reporter_block_id ? (blockMap[o.reporter_block_id] ?? null) : null,
        reporter_apartment_number: o.reporter_apartment_id ? (aptMap[o.reporter_apartment_id] ?? null) : null,
        target_block_name: o.target_block_id ? (blockMap[o.target_block_id] ?? null) : null,
        target_apartment_number: o.target_apartment_id ? (aptMap[o.target_apartment_id] ?? null) : null,
      })) as Occurrence[];

    },
    enabled: !!selectedCondominium,
  });

  // Apartments for filter (depends on filterBlockId)
  const { data: filterApartments = [] } = useQuery({
    queryKey: ["apartments-filter", filterBlockId],
    queryFn: async () => {
      if (!filterBlockId || filterBlockId === "all") return [];
      const { data, error } = await supabase
        .from("apartments")
        .select("id, number, block_id")
        .eq("block_id", filterBlockId)
        .order("number");
      if (error) throw error;
      return data as Apartment[];
    },
    enabled: !!filterBlockId && filterBlockId !== "all",
    staleTime: 1000 * 60 * 5,
  });

  const filteredOccurrences = occurrences.filter((o) => {
    if (filterStatus !== "all" && o.status !== filterStatus) return false;
    if (filterCategory !== "all" && o.category !== filterCategory) return false;
    if (searchTerm && !o.title.toLowerCase().includes(searchTerm.toLowerCase()) && !o.description.toLowerCase().includes(searchTerm.toLowerCase())) return false;
    if (dateRange?.from) {
      const date = new Date(o.created_at);
      const from = startOfDay(dateRange.from);
      const to = dateRange.to ? endOfDay(dateRange.to) : endOfDay(dateRange.from);
      if (!isWithinInterval(date, { start: from, end: to })) return false;
    }
    if (filterBlockId && filterBlockId !== "all") {
      if (o.reporter_block_id !== filterBlockId && o.target_block_id !== filterBlockId) return false;
    }
    if (filterApartmentId && filterApartmentId !== "all") {
      if (o.reporter_apartment_id !== filterApartmentId && o.target_apartment_id !== filterApartmentId) return false;
    }
    return true;
  });

  // Create occurrence
  const createMutation = useMutation({
    mutationFn: async () => {
      const occurredAt = new Date(`${occurredDate}T${occurredTime}:00`);
      
      const reporterBlock = reporterBlockId === "none" ? null : (reporterBlockId || null);
      const reporterApartment = reporterApartmentId === "none" ? null : (reporterApartmentId || null);
      const targetBlock = targetBlockId === "none" ? null : (targetBlockId || null);
      const targetApartment = targetApartmentId === "none" ? null : (targetApartmentId || null);

      // Generate a protocol like ANO0029 (collision-safe)
      const generateProtocol = async () => {
        const year = new Date().getFullYear();
        const { count } = await supabase
          .from("porter_occurrences")
          .select("id", { count: "exact", head: true })
          .eq("condominium_id", selectedCondominium);
        const sequence = (count || 0) + 1;
        return `${year}${sequence.toString().padStart(4, "0")}`;
      };

      // Captura o nome do porteiro para denormalização (evita problemas de RLS de profiles)
      let registeredByName: string | null = null;
      const { data: ownProfile } = await supabase
        .from("profiles")
        .select("full_name")
        .eq("user_id", user!.id)
        .maybeSingle();
      registeredByName = ownProfile?.full_name || user?.user_metadata?.full_name || user?.email || null;

      const basePayload: Record<string, any> = {
        condominium_id: selectedCondominium,
        registered_by: user!.id,
        title: newTitle,
        description: newDescription,
        category: newCategory,
        priority: newPriority,
        occurred_at: isNaN(occurredAt.getTime()) ? new Date().toISOString() : occurredAt.toISOString(),
        reporter_block_id: identifySelf === "sim" ? reporterBlock : null,
        reporter_apartment_id: identifySelf === "sim" ? reporterApartment : null,
        target_block_id: targetBlock,
        target_apartment_id: targetApartment,
        photos: photos,
      };

      let protocol = await generateProtocol();
      let includeName = true;
      let lastError: any = null;
      for (let attempt = 0; attempt < 8; attempt++) {
        const payload: Record<string, any> = { ...basePayload, protocol };
        if (includeName) payload.registered_by_name = registeredByName;
        const { error } = await supabase.from("porter_occurrences").insert(payload as any);
        if (!error) { lastError = null; break; }
        lastError = error;
        // Coluna registered_by_name não existe no schema cache: tenta sem ela
        if (includeName && (error.code === "PGRST204" || error.code === "42703" || /registered_by_name/i.test(error.message))) {
          includeName = false;
          continue;
        }
        // Protocolo duplicado: incrementa e tenta novamente
        if (error.code === "23505" && /protocol/i.test(error.message)) {
          const year = new Date().getFullYear();
          const currentSeq = parseInt(protocol.slice(String(year).length), 10) || 0;
          protocol = `${year}${(currentSeq + 1 + attempt).toString().padStart(4, "0")}`;
          continue;
        }
        break;
      }
      if (lastError) throw lastError;


    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["porter-occurrences"] });
      toast({ title: "Ocorrência registrada com sucesso!" });
      setDialogOpen(false);
      setNewTitle("");
      setNewDescription("");
      setNewCategory(categories.length > 0 ? categories[0].name : "");
      setNewPriority(PRIORITIES[1].value);
      setReporterBlockId("");
      setReporterApartmentId("");
      setTargetBlockId("");
      setTargetApartmentId("");
      setPhotos([]);
      setOccurredDate(format(new Date(), "yyyy-MM-dd"));
      setOccurredTime(format(new Date(), "HH:mm"));
    },
    onError: () => toast({ title: "Erro ao registrar ocorrência", variant: "destructive" }),
  });

  // Resolve occurrence
  const resolveMutation = useMutation({
    mutationFn: async () => {
      const { data: ownProfile } = await supabase
        .from("profiles")
        .select("full_name")
        .eq("user_id", user!.id)
        .maybeSingle();
      const resolvedByName = ownProfile?.full_name || user?.user_metadata?.full_name || user?.email || null;

      const baseUpdate: Record<string, any> = {
        status: "resolvida",
        resolved_at: new Date().toISOString(),
        resolved_by: user!.id,
        resolution_notes: resolutionNotes || null,
      };
      let { error } = await supabase
        .from("porter_occurrences")
        .update({ ...baseUpdate, resolved_by_name: resolvedByName } as any)
        .eq("id", resolveOccurrenceId!);
      if (error && (error.code === "PGRST204" || error.code === "42703" || /resolved_by_name/i.test(error.message))) {
        ({ error } = await supabase
          .from("porter_occurrences")
          .update(baseUpdate as any)
          .eq("id", resolveOccurrenceId!));
      }
      if (error) throw error;
    },

    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["porter-occurrences"] });
      toast({ title: "Ocorrência marcada como resolvida!" });
      setResolveDialogOpen(false);
      setResolveOccurrenceId(null);
      setResolutionNotes("");
    },
    onError: () => toast({ title: "Erro ao resolver ocorrência", variant: "destructive" }),
  });

  const getPriorityBadge = (priority: string) => {
    const p = PRIORITIES.find((pr) => pr.value === priority);
    return <Badge className={p?.color || ""}>{p?.label || priority}</Badge>;
  };

  const openCount = occurrences.filter((o) => o.status === "aberta").length;
  const resolvedCount = occurrences.filter((o) => o.status === "resolvida").length;

  const statCards = [
    { title: "Em Aberto", value: openCount, icon: Clock, gradient: "from-amber-500 to-orange-500" },
    { title: "Resolvidas", value: resolvedCount, icon: CheckCircle2, gradient: "from-accent to-emerald-600" },
    { title: "Total", value: occurrences.length, icon: ClipboardList, gradient: "from-primary to-blue-600" },
  ];

  const renderBlockApartmentSelectors = (
    prefix: string,
    blockId: string,
    setBlockId: (v: string) => void,
    apartmentId: string,
    setApartmentId: (v: string) => void,
    apartments: Apartment[]
  ) => (
    <div className="space-y-2">
      <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{prefix}</Label>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label className="text-xs">Bloco</Label>
          <Select value={blockId} onValueChange={(v) => { setBlockId(v); setApartmentId(""); }}>
            <SelectTrigger><SelectValue placeholder="Selecionar..." /></SelectTrigger>
            <SelectContent>
              <SelectItem value="none">Nenhum</SelectItem>
              {blocks.map((b) => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label className="text-xs">Apartamento</Label>
          <Select value={apartmentId} onValueChange={setApartmentId} disabled={!blockId || blockId === "none"}>
            <SelectTrigger><SelectValue placeholder="Selecionar..." /></SelectTrigger>
            <SelectContent>
              <SelectItem value="none">Nenhum</SelectItem>
              {apartments.map((a) => <SelectItem key={a.id} value={a.id}>{a.number}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </div>
    </div>
  );

  return (
    <DashboardLayout>
      <SubscriptionGate>
      <div className="space-y-8 animate-fade-up">

        {/* Header */}
        <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div>
            <h1 className="font-display text-3xl font-bold text-foreground flex items-center gap-3">
              Registro de Ocorrências
              {openCount > 0 && (
                <Badge variant="destructive" className="text-xs">
                  {openCount} em aberto
                </Badge>
              )}
            </h1>
            <p className="text-muted-foreground mt-1">
              Registre e acompanhe ocorrências operacionais do condomínio
            </p>
          </div>
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button className="gap-2 shrink-0" disabled={!selectedCondominium}>
                <Plus className="w-4 h-4" /> Registrar Ocorrência
              </Button>
            </DialogTrigger>
            <DialogContent className="w-[95vw] max-w-lg max-h-[90vh] overflow-y-auto p-4 sm:p-6">
              <DialogHeader>
                <DialogTitle className="text-left">Registrar Ocorrência</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>Título</Label>
                  <Input value={newTitle} onChange={(e) => setNewTitle(e.target.value)} placeholder="Ex: Visitante suspeito no estacionamento" />
                </div>
                <div className="space-y-2">
                  <Label>Descrição</Label>
                  <Textarea value={newDescription} onChange={(e) => setNewDescription(e.target.value)} placeholder="Descreva o ocorrido..." rows={4} />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Categoria</Label>
                    <Select value={newCategory} onValueChange={setNewCategory}>
                      <SelectTrigger><SelectValue placeholder="Selecionar..." /></SelectTrigger>
                      <SelectContent>
                        {[...categories, ...(!categories.some(c => c.name === "Barulho") ? [{ id: "temp-barulho", name: "Barulho" }] : [])]
                          .sort((a, b) => a.name.localeCompare(b.name))
                          .map((c) => <SelectItem key={c.id} value={c.name}>{c.name}</SelectItem>)
                        }
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Prioridade</Label>
                    <Select value={newPriority} onValueChange={setNewPriority}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {PRIORITIES.map((p) => <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Data da Ocorrência</Label>
                    <Input type="date" value={occurredDate} onChange={(e) => setOccurredDate(e.target.value)} />
                  </div>
                  <div className="space-y-2">
                    <Label>Horário</Label>
                    <Input type="time" value={occurredTime} onChange={(e) => setOccurredTime(e.target.value)} />
                  </div>
                </div>

                {/* Target unit */}
                <div className="animate-fade-down">
                  {renderBlockApartmentSelectors(
                    "Ocorrência sobre (Unidade)",
                    targetBlockId,
                    setTargetBlockId,
                    targetApartmentId,
                    setTargetApartmentId,
                    targetApartments
                  )}
                </div>

                <div className="space-y-3 bg-slate-50/50 p-4 rounded-xl border border-slate-100">
                  <Label className="text-sm font-semibold text-slate-900 flex items-center gap-2">
                    <UserCheck className="w-4 h-4 text-primary" />
                    Identificar solicitante (Unidade)?
                  </Label>
                  <RadioGroup 
                    value={identifySelf} 
                    onValueChange={(v) => {
                      setIdentifySelf(v);
                      if (v === "nao") {
                        setReporterBlockId("");
                        setReporterApartmentId("");
                      }
                    }}
                    className="flex gap-4"
                  >
                    <div className="flex items-center space-x-2 bg-white px-4 py-2 rounded-lg border border-slate-200 cursor-pointer hover:bg-slate-50 transition-colors">
                      <RadioGroupItem value="sim" id="identify-sim" />
                      <Label htmlFor="identify-sim" className="cursor-pointer font-medium">Sim</Label>
                    </div>
                    <div className="flex items-center space-x-2 bg-white px-4 py-2 rounded-lg border border-slate-200 cursor-pointer hover:bg-slate-50 transition-colors">
                      <RadioGroupItem value="nao" id="identify-nao" />
                      <Label htmlFor="identify-nao" className="cursor-pointer font-medium">Não</Label>
                    </div>
                  </RadioGroup>
                </div>

                {identifySelf === "sim" && (
                  <div className="animate-fade-down">
                    {renderBlockApartmentSelectors(
                      "Registrado por (Unidade)",
                      reporterBlockId,
                      setReporterBlockId,
                      reporterApartmentId,
                      setReporterApartmentId,
                      reporterApartments
                    )}
                  </div>
                )}

                {/* Photo upload */}
                <div className="space-y-2">
                  <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                    Fotos (provas)
                  </Label>
                  <div className="flex flex-wrap gap-2">
                    {photos.map((url) => (
                      <div key={url} className="relative w-20 h-20 rounded-lg overflow-hidden border border-border group">
                        <img
                          src={url}
                          alt="Foto da ocorrência"
                          className="w-full h-full object-cover cursor-pointer"
                          onClick={() => setPreviewPhoto(url)}
                        />
                        <button
                          type="button"
                          onClick={() => removePhoto(url)}
                          className="absolute top-0.5 right-0.5 bg-destructive text-destructive-foreground rounded-full w-5 h-5 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                          aria-label="Remover foto"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </div>
                    ))}
                    <label
                      className={cn(
                        "w-20 h-20 rounded-lg border-2 border-dashed border-border flex flex-col items-center justify-center gap-1 cursor-pointer hover:border-primary hover:bg-secondary/50 transition-colors text-muted-foreground",
                        uploadingPhotos && "pointer-events-none opacity-50"
                      )}
                    >
                      {uploadingPhotos ? (
                        <Loader2 className="w-5 h-5 animate-spin" />
                      ) : (
                        <>
                          <ImagePlus className="w-5 h-5" />
                          <span className="text-[10px]">Adicionar</span>
                        </>
                      )}
                      <input
                        type="file"
                        accept="image/*"
                        multiple
                        capture="environment"
                        className="hidden"
                        onChange={handlePhotoUpload}
                        disabled={uploadingPhotos}
                      />
                    </label>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    JPG, PNG ou HEIC. Máx. 10MB por foto. Toque para tirar foto ou escolher da galeria.
                  </p>
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
                <Button onClick={() => createMutation.mutate()} disabled={!newTitle || !newDescription || !newCategory || !newPriority || !occurredDate || !occurredTime || createMutation.isPending}>
                  {createMutation.isPending ? "Registrando..." : "Registrar"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>

        {/* Stat Cards */}
        {selectedCondominium && (
          <div className="grid grid-cols-1 xs:grid-cols-2 sm:grid-cols-3 gap-3 md:gap-4">
            {statCards.map((stat, index) => (
              <Card key={index} className="bg-card border-border shadow-card hover:shadow-elevated transition-all duration-300 relative group">
                <CardContent className="p-3 sm:p-4 md:p-5">
                  <div className="flex items-center gap-3 sm:flex-col sm:items-start">
                    <div className={`w-9 h-9 sm:w-10 sm:h-10 md:w-11 md:h-11 rounded-xl bg-gradient-to-br ${stat.gradient} flex items-center justify-center shadow-lg shrink-0`}>
                      <stat.icon className="w-4 h-4 sm:w-5 sm:h-5 text-white" />
                    </div>
                    <div className="flex-1 min-w-0 sm:mt-3 sm:w-full">
                      {isLoading ? (
                        <Skeleton className="h-6 sm:h-8 w-10 sm:w-16 mb-1" />
                      ) : (
                        <p className="font-display text-lg sm:text-2xl md:text-3xl font-bold text-foreground">{stat.value}</p>
                      )}
                      <p className="text-[11px] sm:text-xs md:text-sm text-muted-foreground leading-tight">{stat.title}</p>
                    </div>
                  </div>
                  <ArrowUpRight className="hidden sm:block w-4 h-4 text-muted-foreground group-hover:text-primary transition-colors absolute top-3 right-3 md:top-4 md:right-4" />
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {/* Filters */}
        <div className="space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <h2 className="font-display text-lg font-semibold text-foreground flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-primary" />
              Ocorrências
            </h2>
            <div className="flex flex-wrap items-center gap-2">
              {condominiums.length > 1 && (
                <Select value={selectedCondominium} onValueChange={setSelectedCondominium}>
                  <SelectTrigger className="w-[200px]"><SelectValue placeholder="Selecionar condomínio" /></SelectTrigger>
                  <SelectContent>
                    {condominiums.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              )}
              <Select value={filterCategory} onValueChange={setFilterCategory}>
                <SelectTrigger className="w-full sm:w-[150px]"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas categorias</SelectItem>
                  {[...categories, ...(!categories.some(c => c.name === "Barulho") ? [{ id: "temp-barulho-filter", name: "Barulho" }] : [])]
                    .sort((a, b) => a.name.localeCompare(b.name))
                    .map((c) => <SelectItem key={c.id} value={c.name}>{c.name}</SelectItem>)
                  }
                </SelectContent>
              </Select>
              <Select
                value={filterBlockId}
                onValueChange={(v) => { setFilterBlockId(v); setFilterApartmentId("all"); }}
              >
                <SelectTrigger className="w-full sm:w-[140px]">
                  <Building2 className="w-3.5 h-3.5 mr-1 text-muted-foreground" />
                  <SelectValue placeholder="Bloco" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos blocos</SelectItem>
                  {blocks.map((b) => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}
                </SelectContent>
              </Select>
              <Select
                value={filterApartmentId}
                onValueChange={setFilterApartmentId}
                disabled={filterBlockId === "all"}
              >
                <SelectTrigger className="w-[140px]">
                  <Home className="w-3.5 h-3.5 mr-1 text-muted-foreground" />
                  <SelectValue placeholder="Apartamento" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos apartamentos</SelectItem>
                  {filterApartments.map((a) => <SelectItem key={a.id} value={a.id}>{a.number}</SelectItem>)}
                </SelectContent>
              </Select>
              <div className="flex bg-slate-100/80 p-1 rounded-2xl border border-slate-200/50 shadow-inner w-full sm:w-auto overflow-x-auto no-scrollbar">
                {[
                  { value: "all", label: "Todas" },
                  { value: "aberta", label: "Abertas" },
                  { value: "resolvida", label: "Resolvidas" },
                ].map((opt) => (
                  <button
                    key={opt.value}
                    onClick={() => setFilterStatus(opt.value)}
                    className={`flex-1 sm:flex-none px-4 py-2 text-xs font-bold rounded-xl transition-all duration-300 whitespace-nowrap ${
                      filterStatus === opt.value
                        ? "bg-white text-primary shadow-md transform scale-[1.02]"
                        : "text-slate-500 hover:text-slate-700 hover:bg-white/50"
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input className="pl-9" placeholder="Buscar por título ou descrição..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
            </div>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn("w-full sm:w-auto justify-start text-left font-normal", !dateRange && "text-muted-foreground")}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {dateRange?.from ? (
                    dateRange.to ? (
                      <>{format(dateRange.from, "dd/MM/yy")} – {format(dateRange.to, "dd/MM/yy")}</>
                    ) : format(dateRange.from, "dd/MM/yyyy")
                  ) : "Filtrar por data"}
                  {dateRange && (
                    <X className="ml-2 h-3 w-3 opacity-60 hover:opacity-100" onClick={(e) => { e.stopPropagation(); setDateRange(undefined); }} />
                  )}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="end">
                <Calendar
                  mode="range"
                  selected={dateRange}
                  onSelect={setDateRange}
                  locale={ptBR}
                  initialFocus
                  className={cn("p-3 pointer-events-auto")}
                />
              </PopoverContent>
            </Popover>
          </div>
        </div>

        {/* List */}
        {!selectedCondominium ? (
          <Card>
            <CardContent className="py-16 text-center">
              <ClipboardList className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
              <p className="text-muted-foreground">Selecione um condomínio para visualizar as ocorrências.</p>
            </CardContent>
          </Card>
        ) : isLoading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => <Skeleton key={i} className="h-24 w-full rounded-xl" />)}
          </div>
        ) : filteredOccurrences.length === 0 ? (
          <Card>
            <CardContent className="py-16 text-center">
              <CheckCircle2 className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
              <p className="text-muted-foreground">Nenhuma ocorrência encontrada.</p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {filteredOccurrences.map((occ) => (
              <Card key={occ.id} className="group bg-white border-slate-200/60 shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all duration-500 overflow-hidden">
                <div className={cn(
                  "h-1.5 w-full transition-colors duration-500",
                  occ.status === "aberta" ? "bg-amber-500 group-hover:bg-amber-400" : "bg-emerald-500 group-hover:bg-emerald-400"
                )} />
                <CardContent className="p-5 md:p-6">
                  <div className="flex flex-col gap-4">
                    <div className="flex items-start gap-4">
                      <div className={`w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 shadow-lg transition-transform duration-500 group-hover:scale-110 ${
                        occ.status === "aberta"
                          ? "bg-gradient-to-br from-amber-400 to-orange-600 shadow-amber-200"
                          : "bg-gradient-to-br from-emerald-400 to-teal-600 shadow-emerald-200"
                      }`}>
                        {occ.status === "aberta"
                          ? <Clock className="w-6 h-6 text-white animate-pulse-subtle" />
                          : <CheckCircle2 className="w-6 h-6 text-white" />
                        }
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap mb-2">
                          {occ.protocol && (
                            <Badge variant="secondary" className="font-mono text-[10px] bg-slate-100 text-slate-600 border-slate-200 px-2 py-0.5 rounded-md">
                              Protocolo: {occ.protocol}
                            </Badge>
                          )}
                          <h3 className="font-bold text-slate-900 text-lg tracking-tight group-hover:text-primary transition-colors uppercase">{occ.title}</h3>
                          {getPriorityBadge(occ.priority)}
                          <Badge variant="outline" className="text-[10px] font-bold uppercase tracking-wider bg-slate-50">{occ.category}</Badge>
                        </div>
                        <p className="text-slate-600 leading-relaxed text-sm md:text-base text-justify break-words hyphens-auto">{occ.description}</p>

                        {/* Photos */}
                        {occ.photos && occ.photos.length > 0 && (
                          <div className="flex flex-wrap gap-2 mt-3">
                            {occ.photos.map((url) => (
                              <button
                                key={url}
                                type="button"
                                onClick={() => setPreviewPhoto(url)}
                                className="w-16 h-16 rounded-lg overflow-hidden border border-border hover:ring-2 hover:ring-primary transition-all"
                              >
                                <img src={url} alt="Foto" className="w-full h-full object-cover" />
                              </button>
                            ))}
                          </div>
                        )}

                        {/* Block/Apartment info */}
                        {(occ.reporter_block_name || occ.target_block_name || occ.registered_by_name) && (
                          <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2 text-xs">
                            {occ.registered_by_name && (
                              <div className="flex items-center gap-1.5 bg-slate-50 px-2 py-1 rounded-md border border-slate-100">
                                <span className="text-slate-500 font-medium">Registrado por:</span>
                                <span className="font-bold text-slate-700">{occ.registered_by_name}</span>
                              </div>
                            )}
                            {occ.reporter_block_name && (
                              <div className="flex items-center gap-1.5 bg-slate-50 px-2 py-1 rounded-md border border-slate-100">
                                <span className="text-slate-500 font-medium">Solicitante:</span>
                                <BlockApartmentDisplay
                                  blockName={occ.reporter_block_name}
                                  apartmentNumber={occ.reporter_apartment_number}
                                  variant="inline"
                                  showIcons
                                  valueClassName="font-bold text-slate-700"
                                />
                              </div>
                            )}
                            {occ.target_block_name && (
                              <div className="flex items-center gap-1.5 bg-slate-50 px-2 py-1 rounded-md border border-slate-100">
                                <span className="text-slate-500 font-medium">Sobre:</span>
                                <BlockApartmentDisplay
                                  blockName={occ.target_block_name}
                                  apartmentNumber={occ.target_apartment_number}
                                  variant="inline"
                                  showIcons
                                  valueClassName="font-bold text-slate-700"
                                />
                              </div>
                            )}
                          </div>
                        )}

                        <div className="flex flex-col sm:flex-row sm:items-center justify-between mt-4 pt-4 border-t border-slate-100 gap-4">
                          <div className="flex flex-col gap-1">
                            <div className="flex items-center gap-2 text-xs text-slate-500">
                              <CalendarIcon className="w-3.5 h-3.5 text-primary/60" />
                              <span>{format(new Date(occ.created_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}</span>
                            </div>
                            
                            {occ.status === "resolvida" && (
                              <div className="flex flex-col gap-1.5 mt-2 p-3 bg-emerald-50/50 rounded-xl border border-emerald-100/50">
                                {occ.resolution_notes && (
                                  <div className="flex gap-2">
                                    <ClipboardList className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                                    <p className="text-sm text-emerald-800 italic">"{occ.resolution_notes}"</p>
                                  </div>
                                )}
                                <div className="flex items-center gap-2 text-xs text-emerald-700 font-medium">
                                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                                  <span>Finalizado por <span className="uppercase">{occ.resolved_by_name}</span> {occ.resolved_at && `em ${format(new Date(occ.resolved_at), "dd/MM/yy 'às' HH:mm")}`}</span>
                                </div>
                              </div>
                            )}
                          </div>

                          <div className="flex gap-2 items-center self-end sm:self-auto">
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {/* Resolve Dialog */}
        <Dialog open={resolveDialogOpen} onOpenChange={setResolveDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Resolver Ocorrência</DialogTitle>
            </DialogHeader>
            <div>
              <Label>Observações da resolução (opcional)</Label>
              <Textarea value={resolutionNotes} onChange={(e) => setResolutionNotes(e.target.value)} placeholder="Descreva como foi resolvido..." rows={3} />
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setResolveDialogOpen(false)}>Cancelar</Button>
              <Button onClick={() => resolveMutation.mutate()} disabled={resolveMutation.isPending}>
                {resolveMutation.isPending ? "Resolvendo..." : "Marcar como Resolvida"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Photo Preview Dialog */}
        <Dialog open={!!previewPhoto} onOpenChange={(open) => !open && setPreviewPhoto(null)}>
          <DialogContent className="max-w-3xl p-2 bg-background">
            <DialogHeader className="sr-only">
              <DialogTitle>Visualizar foto</DialogTitle>
            </DialogHeader>
            {previewPhoto && (
              <img src={previewPhoto} alt="Visualização" className="w-full max-h-[80vh] object-contain rounded-lg" />
            )}
          </DialogContent>
        </Dialog>
      </div>
      </SubscriptionGate>
    </DashboardLayout>
  );
}
