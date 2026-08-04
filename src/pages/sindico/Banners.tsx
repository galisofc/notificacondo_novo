import { useState, useEffect } from "react";
import DashboardLayout from "@/components/layouts/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useUserRole } from "@/hooks/useUserRole";
import { Plus, Pencil, Trash2, Eye, GripVertical, Megaphone, Upload, X, Loader2 } from "lucide-react";
import SindicoBreadcrumbs from "@/components/sindico/SindicoBreadcrumbs";

interface Banner {
  id: string;
  image_url?: string | null;
  show_as_modal?: boolean;
  condominium_id: string;
  title: string;
  content: string;
  bg_color: string;
  text_color: string;
  is_active: boolean;
  display_order: number;
  created_at: string;
}

interface BannerForm {
  title: string;
  content: string;
  bg_color: string;
  text_color: string;
  is_active: boolean;
  image_url: string | null;
  show_as_modal: boolean;
}

const COLOR_PRESETS = [
  { label: "Azul", bg: "#3b82f6", text: "#ffffff" },
  { label: "Verde", bg: "#22c55e", text: "#ffffff" },
  { label: "Amarelo", bg: "#eab308", text: "#1a1a1a" },
  { label: "Vermelho", bg: "#ef4444", text: "#ffffff" },
  { label: "Roxo", bg: "#8b5cf6", text: "#ffffff" },
  { label: "Laranja", bg: "#f97316", text: "#ffffff" },
  { label: "Cinza", bg: "#6b7280", text: "#ffffff" },
  { label: "Escuro", bg: "#1e293b", text: "#ffffff" },
];

const defaultForm: BannerForm = {
  title: "",
  content: "",
  bg_color: "#3b82f6",
  text_color: "#ffffff",
  is_active: true,
  image_url: null,
  show_as_modal: true,
};

function AcknowledgeList({ bannerId, condominiumId }: { bannerId: string; condominiumId: string }) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: totalPorteiros = 0 } = useQuery({
    queryKey: ["condominium-porteiros-count", condominiumId],
    queryFn: async () => {
      const { data, error } = await (supabase as any).rpc('get_condominium_porteiros_count', { 
        _condominium_id: condominiumId 
      });
      
      if (error) {
        // Fallback para contagem via user_roles se RPC falhar
        const { count, error: countError } = await (supabase as any)
          .from("user_roles")
          .select("*", { count: 'exact', head: true })
          .eq("role", "porteiro"); // Nota: idealmente filtrado por condomínio, mas depende da estrutura
        return count || 0;
      }
      return data || 0;
    },
    enabled: !!condominiumId,
  });

  const { data: cientes = [], isLoading, refetch } = useQuery({
    queryKey: ["banner-acknowledged-users", bannerId],
    queryFn: async () => {
      // 1) Tenta RPC security definer (ignora RLS restritiva por user_id)
      const rpc = await (supabase as any).rpc("get_banner_acknowledgments", {
        _banner_id: bannerId,
      });

      if (!rpc.error && Array.isArray(rpc.data)) {
        return (rpc.data as any[]).map((row) => ({
          user_id: row.user_id,
          profiles: { full_name: row.full_name, email: row.email },
        }));
      }

      // 2) Fallback: busca ciências e perfis separadamente (sem join embutido,
      //    que falha silenciosamente quando não há FK declarada)
      const { data: acks, error } = await (supabase as any)
        .from("banner_acknowledgments")
        .select("user_id")
        .eq("banner_id", bannerId);
      if (error) throw error;

      const userIds = [...new Set((acks || []).map((a: any) => a.user_id))];
      if (userIds.length === 0) return [];

      const { data: profiles } = await (supabase as any)
        .from("profiles")
        .select("id, full_name, email")
        .in("id", userIds);

      const profileMap = new Map(
        (profiles || []).map((p: any) => [p.id, p])
      );

      return userIds.map((id: string) => ({
        user_id: id,
        profiles: profileMap.get(id) || null,
      }));
    },
    staleTime: 0,
    refetchOnWindowFocus: true,
  });


  const deleteAcknowledgeMutation = useMutation({
    mutationFn: async (userId: string) => {
      const { error } = await (supabase as any)
        .from("banner_acknowledgments")
        .delete()
        .eq("banner_id", bannerId)
        .eq("user_id", userId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["banner-acknowledged-users", bannerId] });
      queryClient.invalidateQueries({ queryKey: ["condominium-porteiros-count"] });
      refetch();
      toast({ title: "Ciência removida!" });
    },
    onError: (error: any) => {
      toast({ title: "Erro ao remover ciência", description: error.message, variant: "destructive" });
    },
  });

  const resetAllAcknowledgeMutation = useMutation({
    mutationFn: async () => {
      const { error } = await (supabase as any)
        .from("banner_acknowledgments")
        .delete()
        .eq("banner_id", bannerId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["banner-acknowledged-users", bannerId] });
      queryClient.invalidateQueries({ queryKey: ["condominium-porteiros-count"] });
      refetch();
      toast({ title: "Ciências resetadas para todos!" });
    },
    onError: (error: any) => {
      toast({ title: "Erro ao resetar ciências", description: error.message, variant: "destructive" });
    },
  });

  useEffect(() => {
    const channel = supabase
      .channel(`banner-acks-${bannerId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'banner_acknowledgments',
          filter: `banner_id=eq.${bannerId}`
        },
        () => {
          queryClient.invalidateQueries({ queryKey: ["banner-acknowledged-users", bannerId] });
          refetch();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [bannerId, refetch]);

  if (isLoading) return <div className="text-xs text-muted-foreground">Carregando cientes...</div>;
  if (cientes.length === 0) return <div className="text-xs text-muted-foreground">Ninguém ciente ainda.</div>;

  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between mb-1">
        <p className="text-[10px] font-bold uppercase text-muted-foreground">
          Lido por {cientes.length} de {totalPorteiros > 0 ? totalPorteiros : cientes.length} porteiros:
        </p>
        <Button 
          variant="ghost" 
          size="sm" 
          className="h-5 text-[10px] text-destructive hover:text-destructive hover:bg-destructive/10 px-1 gap-1"
          onClick={() => {
            if (confirm("Deseja resetar a ciência de TODOS os porteiros para este banner? Ele voltará a aparecer para todos.")) {
              resetAllAcknowledgeMutation.mutate();
            }
          }}
          disabled={resetAllAcknowledgeMutation.isPending}
        >
          {resetAllAcknowledgeMutation.isPending ? (
            <Loader2 className="w-3 h-3 animate-spin" />
          ) : (
            <Trash2 className="w-3 h-3" />
          )}
          Resetar Todos
        </Button>
      </div>
      <div className="flex flex-wrap gap-1">
        {cientes.map((item) => (
          <Badge key={item.user_id} variant="secondary" className="text-[10px] pr-1 gap-1 h-5">
            {item.profiles?.full_name || item.profiles?.email || "Porteiro"}
            <button
              onClick={() => {
                if (confirm(`Remover ciência de ${item.profiles?.full_name || "este porteiro"}?`)) {
                  deleteAcknowledgeMutation.mutate(item.user_id);
                }
              }}
              className="hover:text-destructive transition-colors"
              title="Remover ciência (banner voltará a aparecer para ele)"
            >
              <X className="w-3 h-3" />
            </button>
          </Badge>
        ))}
      </div>
    </div>
  );
}

export default function SindicoBanners() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { profileInfo } = useUserRole();

  const [selectedCondominium, setSelectedCondominium] = useState<string>("");
  const [showDialog, setShowDialog] = useState(false);
  const [editingBanner, setEditingBanner] = useState<Banner | null>(null);
  const [form, setForm] = useState<BannerForm>(defaultForm);
  const [uploading, setUploading] = useState(false);
  // Tipo de aviso escolhido pelo síndico: "texto" (título + mensagem) ou "imagem" (somente imagem)
  const [mode, setMode] = useState<"texto" | "imagem">("texto");

  // Faz upload da imagem para o bucket público "banners" e guarda a URL no form
  const handleImageUpload = async (file: File | undefined) => {
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      toast({ title: "Arquivo inválido", description: "Selecione uma imagem.", variant: "destructive" });
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast({ title: "Imagem muito grande", description: "O limite é de 5MB.", variant: "destructive" });
      return;
    }

    setUploading(true);
    try {
      const ext = file.name.split(".").pop()?.toLowerCase() || "jpg";
      const path = `${selectedCondominium || "geral"}/${crypto.randomUUID()}.${ext}`;
      const { error: uploadError } = await supabase.storage
        .from("banners")
        .upload(path, file, { cacheControl: "3600", upsert: false, contentType: file.type });
      if (uploadError) throw uploadError;

      const { data } = supabase.storage.from("banners").getPublicUrl(path);
      setForm((prev) => ({ ...prev, image_url: data.publicUrl }));
      toast({ title: "Imagem enviada!" });
    } catch (error: any) {
      toast({ title: "Erro ao enviar imagem", description: error.message, variant: "destructive" });
    } finally {
      setUploading(false);
    }
  };

  // Fetch condominiums
  const { data: condominiums = [] } = useQuery({
    queryKey: ["sindico-condominiums-banners"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("condominiums")
        .select("id, name")
        .order("name");
      if (error) throw error;
      return data;
    },
    staleTime: 1000 * 60 * 5,
  });

  // Auto-select first condominium
  if (condominiums.length > 0 && !selectedCondominium) {
    setSelectedCondominium(condominiums[0].id);
  }

  // Fetch banners
  const { data: banners = [], isLoading } = useQuery({
    queryKey: ["condominium-banners", selectedCondominium],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("condominium_banners")
        .select("*")
        .eq("condominium_id", selectedCondominium)
        .order("display_order", { ascending: true });
      if (error) throw error;
      return data as Banner[];
    },
    enabled: !!selectedCondominium,
    staleTime: 1000 * 60 * 2,
  });

  // Create/Update mutation
  const saveMutation = useMutation({
    mutationFn: async () => {
      // Normaliza o payload conforme o tipo escolhido:
      // - "imagem": grava a imagem e limpa a mensagem de texto
      // - "texto": grava a mensagem e limpa a imagem
      const payload = {
        title: form.title,
        content: mode === "imagem" ? "" : form.content,
        bg_color: form.bg_color,
        text_color: form.text_color,
        is_active: form.is_active,
        image_url: mode === "imagem" ? form.image_url : null,
        show_as_modal: form.show_as_modal,
      };

      if (editingBanner) {
        const { error } = await supabase
          .from("condominium_banners" as any)
          .update({ ...payload, updated_at: new Date().toISOString() })
          .eq("id", editingBanner.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("condominium_banners" as any)
          .insert({
            condominium_id: selectedCondominium,
            ...payload,
            display_order: banners.length,
          });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["condominium-banners", selectedCondominium] });
      toast({ title: editingBanner ? "Banner atualizado!" : "Banner criado!" });
      closeDialog();
    },
    onError: (error: any) => {
      toast({ title: "Erro ao salvar banner", description: error.message, variant: "destructive" });
    },
  });

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("condominium_banners").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["condominium-banners", selectedCondominium] });
      toast({ title: "Banner excluído!" });
    },
  });

  // Toggle active mutation
  const toggleMutation = useMutation({
    mutationFn: async ({ id, is_active }: { id: string; is_active: boolean }) => {
      const { error } = await supabase
        .from("condominium_banners")
        .update({ is_active, updated_at: new Date().toISOString() })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["condominium-banners", selectedCondominium] });
    },
  });

  const openCreate = () => {
    setEditingBanner(null);
    setForm(defaultForm);
    setMode("texto");
    setShowDialog(true);
  };

  const openEdit = (banner: Banner) => {
    setEditingBanner(banner);
    setForm({
      title: banner.title,
      content: banner.content,
      bg_color: banner.bg_color,
      text_color: banner.text_color,
      is_active: banner.is_active,
      image_url: banner.image_url ?? null,
      show_as_modal: banner.show_as_modal ?? true,
    });
    setMode(banner.image_url ? "imagem" : "texto");
    setShowDialog(true);
  };

  const closeDialog = () => {
    setShowDialog(false);
    setEditingBanner(null);
    setForm(defaultForm);
    setMode("texto");
  };

  // Validação depende do tipo escolhido
  const canSave =
    mode === "imagem"
      ? !!form.image_url && !!form.title.trim()
      : !!form.title.trim() && !!form.content.trim();


  return (
    <DashboardLayout>
      <div className="space-y-6">
        <SindicoBreadcrumbs items={[{ label: "Banners" }]} />

        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
              <Megaphone className="w-6 h-6" />
              Banners da Portaria
            </h1>
            <p className="text-muted-foreground">Crie avisos que aparecem no painel do porteiro</p>
          </div>
          <div className="flex gap-2 flex-wrap">
            {condominiums.length > 1 && (
              <Select value={selectedCondominium} onValueChange={setSelectedCondominium}>
                <SelectTrigger className="w-[220px]">
                  <SelectValue placeholder="Selecione o condomínio" />
                </SelectTrigger>
                <SelectContent>
                  {condominiums.map((c) => (
                    <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
            <Button onClick={openCreate} className="gap-2">
              <Plus className="w-4 h-4" />
              Novo Banner
            </Button>
          </div>
        </div>

        {/* Banner List */}
        {isLoading ? (
          <Card><CardContent className="py-8 text-center text-muted-foreground">Carregando...</CardContent></Card>
        ) : banners.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <Megaphone className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
              <p className="text-muted-foreground">Nenhum banner cadastrado para este condomínio.</p>
              <Button variant="outline" className="mt-4" onClick={openCreate}>
                Criar primeiro banner
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {banners.map((banner) => (
              <Card key={banner.id}>
                <CardContent className="p-4">
                  <div className="flex items-start gap-4">
                    {/* Preview */}
                    <div
                      className="flex-1 rounded-lg p-4 min-h-[60px] flex items-start gap-3"
                      style={{ backgroundColor: banner.bg_color, color: banner.text_color }}
                    >
                      {banner.image_url && (
                        <img
                          src={banner.image_url}
                          alt={banner.title}
                          className="w-20 h-20 rounded-md object-cover shrink-0"
                          loading="lazy"
                        />
                      )}
                      <div className="min-w-0">
                        <p className="font-semibold text-sm">{banner.title}</p>
                        <p className="text-sm mt-1 whitespace-pre-line">{banner.content}</p>
                      </div>
                    </div>
                    {/* Actions */}
                    <div className="flex flex-col items-center gap-2 shrink-0">
                      <Switch
                        checked={banner.is_active}
                        onCheckedChange={(checked) =>
                          toggleMutation.mutate({ id: banner.id, is_active: checked })
                        }
                      />
                      <Badge variant={banner.is_active ? "default" : "secondary"} className="text-xs">
                        {banner.is_active ? "Ativo" : "Inativo"}
                      </Badge>
                      {banner.show_as_modal !== false && (
                        <Badge variant="outline" className="text-xs">Modal</Badge>
                      )}
                      <div className="flex gap-1 mt-1">
                        <Button size="icon" variant="ghost" onClick={() => openEdit(banner)}>
                          <Pencil className="w-4 h-4" />
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="text-destructive"
                          onClick={() => {
                            if (confirm("Deseja excluir este banner?")) {
                              deleteMutation.mutate(banner.id);
                            }
                          }}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                      <div className="mt-2 border-t pt-2 w-full">
                        <AcknowledgeList bannerId={banner.id} condominiumId={banner.condominium_id} />
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {/* Create/Edit Dialog */}
        <Dialog open={showDialog} onOpenChange={setShowDialog}>
          <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{editingBanner ? "Editar Banner" : "Novo Banner"}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 pr-2">
              {/* Tipo de aviso: texto ou imagem */}
              <div>
                <Label>Tipo de aviso</Label>
                <div className="grid grid-cols-2 gap-2 mt-2">
                  <button
                    type="button"
                    onClick={() => setMode("texto")}
                    className={`rounded-lg border p-3 text-sm font-medium transition-colors ${
                      mode === "texto"
                        ? "border-primary bg-primary/10 text-primary"
                        : "border-border bg-muted/30 text-muted-foreground hover:bg-muted/60"
                    }`}
                  >
                    Aviso em texto
                  </button>
                  <button
                    type="button"
                    onClick={() => setMode("imagem")}
                    className={`rounded-lg border p-3 text-sm font-medium transition-colors ${
                      mode === "imagem"
                        ? "border-primary bg-primary/10 text-primary"
                        : "border-border bg-muted/30 text-muted-foreground hover:bg-muted/60"
                    }`}
                  >
                    Aviso em imagem
                  </button>
                </div>
              </div>

              <div>
                <Label>Título {mode === "imagem" && <span className="text-xs text-muted-foreground">(uso interno)</span>}</Label>
                <Input
                  value={form.title}
                  onChange={(e) => setForm({ ...form, title: e.target.value })}
                  placeholder="Ex: Aviso importante"
                  maxLength={100}
                />
              </div>

              {mode === "texto" && (
                <div>
                  <Label>Mensagem</Label>
                  <Textarea
                    value={form.content}
                    onChange={(e) => setForm({ ...form, content: e.target.value })}
                    placeholder="Escreva a mensagem do banner..."
                    rows={3}
                    maxLength={500}
                  />
                </div>
              )}

              {/* Imagem do banner */}
              {mode === "imagem" && (
                <div>
                  <Label>Imagem do aviso</Label>
                  {form.image_url ? (
                    <div className="space-y-2 mt-2">
                      <div className="relative w-fit">
                        <img
                          src={form.image_url}
                          alt="Imagem do banner"
                          className="max-h-40 rounded-lg object-contain bg-muted"
                        />
                        <Button
                          type="button"
                          size="icon"
                          variant="destructive"
                          className="absolute -top-2 -right-2 h-7 w-7 rounded-full shadow-lg"
                          onClick={() => setForm({ ...form, image_url: null })}
                        >
                          <X className="w-4 h-4" />
                        </Button>
                      </div>
                      <p className="text-xs text-muted-foreground bg-muted/50 p-2 rounded border border-border">
                        Somente a imagem será exibida para o porteiro (sem texto).
                      </p>
                    </div>
                  ) : (
                    <label className="mt-2 flex cursor-pointer items-center justify-center gap-2 rounded-lg border border-dashed border-border bg-muted/30 p-4 text-sm text-muted-foreground transition-colors hover:bg-muted/60">
                      {uploading ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <Upload className="w-4 h-4" />
                      )}
                      {uploading ? "Enviando imagem..." : "Selecionar imagem (até 5MB)"}
                      <input
                        type="file"
                        accept="image/*"
                        className="hidden"
                        disabled={uploading}
                        onChange={(e) => handleImageUpload(e.target.files?.[0])}
                      />
                    </label>
                  )}
                </div>
              )}


              {/* Color presets */}
              <div>
                <Label>Cor do banner</Label>
                <div className="flex flex-wrap gap-2 mt-2">
                  {COLOR_PRESETS.map((preset) => (
                    <button
                      key={preset.bg}
                      type="button"
                      className={`w-8 h-8 rounded-full border-2 transition-all ${
                        form.bg_color === preset.bg ? "border-foreground scale-110" : "border-transparent"
                      }`}
                      style={{ backgroundColor: preset.bg }}
                      onClick={() => setForm({ ...form, bg_color: preset.bg, text_color: preset.text })}
                      title={preset.label}
                    />
                  ))}
                </div>
              </div>

              {/* Custom colors */}
              <div className="flex gap-4">
                <div className="flex-1">
                  <Label className="text-xs">Cor de fundo (hex)</Label>
                  <div className="flex gap-2 items-center">
                    <input
                      type="color"
                      value={form.bg_color}
                      onChange={(e) => setForm({ ...form, bg_color: e.target.value })}
                      className="w-8 h-8 rounded cursor-pointer border-0"
                    />
                    <Input
                      value={form.bg_color}
                      onChange={(e) => setForm({ ...form, bg_color: e.target.value })}
                      className="font-mono text-sm"
                      maxLength={7}
                    />
                  </div>
                </div>
                <div className="flex-1">
                  <Label className="text-xs">Cor do texto (hex)</Label>
                  <div className="flex gap-2 items-center">
                    <input
                      type="color"
                      value={form.text_color}
                      onChange={(e) => setForm({ ...form, text_color: e.target.value })}
                      className="w-8 h-8 rounded cursor-pointer border-0"
                    />
                    <Input
                      value={form.text_color}
                      onChange={(e) => setForm({ ...form, text_color: e.target.value })}
                      className="font-mono text-sm"
                      maxLength={7}
                    />
                  </div>
                </div>
              </div>

              {/* Preview */}
              <div>
                <Label className="text-xs text-muted-foreground">Pré-visualização</Label>
                <div
                  className="rounded-lg p-4 mt-1"
                  style={{ backgroundColor: form.bg_color, color: form.text_color }}
                >
                  {mode === "imagem" ? (
                    form.image_url ? (
                      <img
                        src={form.image_url}
                        alt="Pré-visualização"
                        className="max-h-40 w-full rounded-md object-contain"
                      />
                    ) : (
                      <p className="text-sm opacity-80">Selecione uma imagem para o aviso...</p>
                    )
                  ) : (
                    <>
                      <p className="font-semibold text-sm">{form.title || "Título do banner"}</p>
                      <p className="text-sm mt-1">{form.content || "Mensagem do banner..."}</p>
                    </>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-2">
                <Switch
                  checked={form.is_active}
                  onCheckedChange={(checked) => setForm({ ...form, is_active: checked })}
                />
                <Label>Banner ativo</Label>
              </div>

              <div className="flex items-start gap-2">
                <Switch
                  checked={form.show_as_modal}
                  onCheckedChange={(checked) => setForm({ ...form, show_as_modal: checked })}
                />
                <div>
                  <Label>Exibir em modal no login da portaria</Label>
                  <p className="text-xs text-muted-foreground">
                    O porteiro precisa clicar em "Estou ciente"; depois disso o modal não aparece mais para ele.
                  </p>
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={closeDialog}>Cancelar</Button>
              <Button
                onClick={() => saveMutation.mutate()}
                disabled={!canSave || saveMutation.isPending || uploading}
              >
                {saveMutation.isPending ? "Salvando..." : editingBanner ? "Salvar" : "Criar"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
}
