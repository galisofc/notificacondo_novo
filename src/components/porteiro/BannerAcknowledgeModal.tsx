import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Megaphone, Check, Loader2, Maximize2, X } from "lucide-react";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useUserRole } from "@/hooks/useUserRole";

interface BannerRecord {
  id: string;
  title: string;
  content: string;
  bg_color: string;
  text_color: string;
  image_url: string | null;
  display_order: number;
}

interface BannerAcknowledgeModalProps {
  condominiumIds: string[];
}

/**
 * Exibe, em modal, os banners ativos marcados como "modal" que o usuário logado
 * ainda não deu ciência. Após a ciência, o banner deixa de aparecer para ele.
 */
export default function BannerAcknowledgeModal({ condominiumIds }: BannerAcknowledgeModalProps) {
  const { user } = useAuth();
  const { profileInfo, role } = useUserRole();
  const queryClient = useQueryClient();
  const [index, setIndex] = useState(0);
  const [dismissed, setDismissed] = useState(false);
  const [zoomImage, setZoomImage] = useState<string | null>(null);

  const { data: banners = [], refetch: refetchBanners } = useQuery({
    queryKey: ["banner-modal-banners", condominiumIds],
    queryFn: async () => {
      if (condominiumIds.length === 0) return [] as BannerRecord[];
      const { data, error } = await (supabase as any)
        .from("condominium_banners")
        .select("id, title, content, bg_color, text_color, image_url, display_order, show_as_modal")
        .in("condominium_id", condominiumIds)
        .eq("is_active", true)
        .eq("show_as_modal", true)
        .order("display_order", { ascending: true });
      if (error) throw error;
      return (data || []) as BannerRecord[];
    },
    enabled: condominiumIds.length > 0 && !!user?.id,
    staleTime: 0, 
  });

  const { data: acknowledgedIds = [], refetch: refetchAcknowledge } = useQuery({
    queryKey: ["banner-acknowledgments", user?.id],
    queryFn: async () => {
      if (!user?.id) return [] as string[];
      const { data, error } = await (supabase as any)
        .from("banner_acknowledgments")
        .select("banner_id")
        .eq("user_id", user.id);
      if (error) throw error;
      return ((data || []) as { banner_id: string }[]).map((row) => row.banner_id);
    },
    enabled: !!user?.id,
    staleTime: 0,
  });

  const pending = useMemo(
    () => banners.filter((banner) => !acknowledgedIds.includes(banner.id)),
    [banners, acknowledgedIds]
  );

  useEffect(() => {
    setIndex(0);
  }, [pending.length]);

  const acknowledgeMutation = useMutation({
    mutationFn: async (bannerId: string) => {
      if (!user?.id) throw new Error("Usuário não autenticado");
      const { error } = await (supabase as any)
        .from("banner_acknowledgments")
        .insert({ 
          banner_id: bannerId, 
          user_id: user.id,
          full_name: profileInfo?.full_name || (role === 'porteiro' ? 'Porteiro' : null) 
        });
      if (error && error.code !== "23505") throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["banner-acknowledgments", user?.id] });
      queryClient.invalidateQueries({ queryKey: ["banner-modal-banners"] });
      refetchAcknowledge();
      refetchBanners();
    },
  });

  if (dismissed || pending.length === 0) return null;

  const current = pending[Math.min(index, pending.length - 1)];
  if (!current) return null;

  const isLast = pending.length === 1;

  const handleAcknowledge = async () => {
    await acknowledgeMutation.mutateAsync(current.id);
    if (isLast) setDismissed(true);
  };

  return (
    <>
      <Dialog open onOpenChange={() => undefined}>
        <DialogContent
          className="max-w-2xl sm:max-w-3xl lg:max-w-4xl max-h-[90vh] overflow-y-auto [&>button]:hidden"
          onPointerDownOutside={(event) => event.preventDefault()}
          onEscapeKeyDown={(event) => event.preventDefault()}
        >
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-2xl lg:text-3xl font-bold py-2">
              <Megaphone className="w-8 h-8 text-primary animate-bounce" />
              {profileInfo?.full_name ? `Aviso para ${profileInfo.full_name}` : "Aviso da Portaria"}
              {pending.length > 1 && (
                <span className="text-sm font-normal text-muted-foreground ml-2">
                  ({index + 1} de {pending.length})
                </span>
              )}
            </DialogTitle>
          </DialogHeader>

          <div className="flex flex-col gap-6 py-2 overflow-y-auto max-h-[75vh] pr-2 scrollbar-thin scrollbar-thumb-muted">
            <div 
              className="flex flex-col overflow-hidden rounded-2xl border-0 shadow-2xl bg-card transition-all duration-300"
              style={!current.image_url ? { backgroundColor: current.bg_color, color: current.text_color } : {}}
            >
              {current.image_url && (
                <div className="w-full bg-black/5 flex items-center justify-center p-1 relative group">
                  <img
                    src={current.image_url}
                    alt={current.title || "Imagem do aviso"}
                    className="w-full h-auto object-contain max-h-[600px] rounded-xl shadow-inner cursor-pointer transition-opacity hover:opacity-90"
                    loading="eager"
                    onClick={() => setZoomImage(current.image_url)}
                  />
                  <Button
                    variant="secondary"
                    size="icon"
                    className="absolute top-4 right-4 opacity-0 group-hover:opacity-100 transition-opacity rounded-full bg-background/80 backdrop-blur-sm"
                    onClick={() => setZoomImage(current.image_url)}
                  >
                    <Maximize2 className="w-5 h-5" />
                  </Button>
                </div>
              )}
              
              {(current.title || current.content) && (!current.image_url) && (
                <div className="p-8 lg:p-14 flex flex-col gap-8 text-center items-center justify-center min-h-[300px]">
                  {current.title && (
                    <h2 className="font-black text-3xl lg:text-6xl tracking-tighter leading-none uppercase drop-shadow-sm">
                      {current.title}
                    </h2>
                  )}
                  {current.content && (
                    <div className="text-2xl lg:text-5xl leading-tight opacity-95 font-semibold max-w-[90%] mx-auto">
                      {current.content}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          <DialogFooter className="pt-4 border-t mt-4">
            <Button
              onClick={handleAcknowledge}
              disabled={acknowledgeMutation.isPending}
              className="gap-3 w-full py-6 text-xl lg:text-2xl h-auto font-bold transition-all hover:scale-[1.02]"
              size="lg"
            >
              {acknowledgeMutation.isPending ? (
                <Loader2 className="w-6 h-6 animate-spin" />
              ) : (
                <Check className="w-6 h-6 stroke-[3]" />
              )}
              ESTOU CIENTE E LI TODAS AS INFORMAÇÕES
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal de Zoom da Imagem */}
      <Dialog open={!!zoomImage} onOpenChange={() => setZoomImage(null)}>
        <DialogContent className="max-w-[95vw] w-fit p-0 overflow-hidden border-none bg-transparent shadow-none">
          <div className="relative group flex items-center justify-center">
            <img 
              src={zoomImage || ""} 
              alt="Zoom do aviso" 
              className="max-w-full max-h-[90vh] object-contain rounded-lg shadow-2xl"
            />
            <Button
              variant="destructive"
              size="icon"
              className="absolute top-4 right-4 rounded-full shadow-lg"
              onClick={() => setZoomImage(null)}
            >
              <X className="w-6 h-6" />
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}