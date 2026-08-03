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
        className="max-w-lg [&>button]:hidden"
        onPointerDownOutside={(event) => event.preventDefault()}
        onEscapeKeyDown={(event) => event.preventDefault()}
      >
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Megaphone className="w-5 h-5" />
            Aviso da Portaria
            {pending.length > 1 && (
              <span className="text-xs font-normal text-muted-foreground">
                ({index + 1}/{pending.length})
              </span>
            )}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {current.image_url && (
            <img
              src={current.image_url}
              alt={current.title}
              className="w-full rounded-lg object-contain max-h-[320px] bg-muted"
              loading="lazy"
            />
          )}
          <div
            className="rounded-lg p-4"
            style={{ backgroundColor: current.bg_color, color: current.text_color }}
          >
            <p className="font-semibold text-sm">{current.title}</p>
            <p className="text-sm mt-1 whitespace-pre-line">{current.content}</p>
          </div>
        </div>

        <DialogFooter>
          <Button
            onClick={handleAcknowledge}
            disabled={acknowledgeMutation.isPending}
            className="gap-2 w-full sm:w-auto"
          >
            {acknowledgeMutation.isPending ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Check className="w-4 h-4" />
            )}
            Estou ciente
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
