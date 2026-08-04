import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Megaphone, Check, Loader2 } from "lucide-react";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

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
  const queryClient = useQueryClient();
  const [index, setIndex] = useState(0);
  const [dismissed, setDismissed] = useState(false);

  const { data: banners = [] } = useQuery({
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
    staleTime: 1000 * 60,
  });

  const { data: acknowledgedIds = [] } = useQuery({
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
    staleTime: 1000 * 60,
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
        .insert({ banner_id: bannerId, user_id: user.id });
      // 23505 = já existe ciência registrada, tratamos como sucesso
      if (error && error.code !== "23505") throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["banner-acknowledgments", user?.id] });
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
    <Dialog open onOpenChange={() => undefined}>
      <DialogContent
        className="max-w-2xl sm:max-w-3xl lg:max-w-4xl max-h-[90vh] overflow-y-auto [&>button]:hidden"
        onPointerDownOutside={(event) => event.preventDefault()}
        onEscapeKeyDown={(event) => event.preventDefault()}
      >
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-2xl lg:text-3xl font-bold py-2">
            <Megaphone className="w-8 h-8 text-primary animate-bounce" />
            Aviso da Portaria
            {pending.length > 1 && (
              <span className="text-sm font-normal text-muted-foreground ml-2">
                ({index + 1} de {pending.length})
              </span>
            )}
          </DialogTitle>
        </DialogHeader>

        <div className="flex flex-col gap-6 py-2">
          {current.image_url && (
            <div className="w-full overflow-hidden rounded-xl border bg-muted/30 shadow-sm">
              <img
                src={current.image_url}
                alt={current.title || "Imagem do aviso"}
                className="w-full h-auto object-contain max-h-[450px] mx-auto transition-all"
                loading="lazy"
              />
            </div>
          )}
          
          <div
            className="rounded-xl p-6 lg:p-10 shadow-md border border-white/10 flex flex-col gap-4"
            style={{ backgroundColor: current.bg_color, color: current.text_color }}
          >
            {current.title && (
              <h2 className="font-extrabold text-2xl lg:text-4xl tracking-tight leading-tight">
                {current.title}
              </h2>
            )}
            {current.content && (
              <div className="text-lg lg:text-3xl leading-relaxed whitespace-pre-line opacity-90 font-medium">
                {current.content}
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
  );
}
