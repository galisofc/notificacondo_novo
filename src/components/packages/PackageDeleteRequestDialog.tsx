import { useEffect, useState } from "react";
import { z } from "zod";
import { Trash2, Loader2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

const reasonSchema = z
  .string()
  .trim()
  .min(10, "Descreva o motivo com pelo menos 10 caracteres")
  .max(500, "Máximo de 500 caracteres");

interface PackageDeleteRequestDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  packageId: string;
  condominiumId: string;
  packageLabel?: string;
  onSubmitted?: () => void;
}

export function PackageDeleteRequestDialog({
  open,
  onOpenChange,
  packageId,
  condominiumId,
  packageLabel,
  onSubmitted,
}: PackageDeleteRequestDialogProps) {
  const { user } = useAuth();
  const [reason, setReason] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [existingPending, setExistingPending] = useState(false);
  const [checking, setChecking] = useState(false);

  useEffect(() => {
    if (!open) {
      setReason("");
      setExistingPending(false);
      return;
    }
    let cancelled = false;
    setChecking(true);
    (supabase as any)
      .from("package_deletion_requests")
      .select("id")
      .eq("package_id", packageId)
      .eq("status", "pendente")
      .limit(1)
      .maybeSingle()
      .then(({ data }: any) => {
        if (!cancelled) setExistingPending(Boolean(data));
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setChecking(false);
      });
    return () => {
      cancelled = true;
    };
  }, [open, packageId]);

  const handleSubmit = async () => {
    const parsed = reasonSchema.safeParse(reason);
    if (!parsed.success) {
      toast.error(parsed.error.issues[0]?.message ?? "Motivo inválido");
      return;
    }
    if (!user) {
      toast.error("Sessão expirada");
      return;
    }
    setSubmitting(true);
    try {
      // Try to grab requester name from profiles
      let requesterName: string | null = null;
      const { data: profile } = await (supabase as any)
        .from("profiles")
        .select("full_name")
        .eq("id", user.id)
        .maybeSingle();
      requesterName = profile?.full_name ?? user.email ?? null;

      const { error } = await (supabase as any)
        .from("package_deletion_requests")
        .insert({
          package_id: packageId,
          condominium_id: condominiumId,
          requested_by: user.id,
          requested_by_name: requesterName,
          reason: parsed.data,
          status: "pendente",
        });

      if (error) throw error;

      toast.success("Solicitação enviada ao síndico");
      onSubmitted?.();
      onOpenChange(false);
    } catch (err: any) {
      console.error("Erro ao solicitar exclusão:", err);
      toast.error(err?.message || "Erro ao enviar solicitação");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Trash2 className="w-5 h-5 text-destructive" />
            Solicitar exclusão
          </DialogTitle>
          <DialogDescription>
            {packageLabel ? (
              <>
                A exclusão de <strong>{packageLabel}</strong> depende da aprovação
                do síndico. Descreva o motivo.
              </>
            ) : (
              "A exclusão depende da aprovação do síndico. Descreva o motivo."
            )}
          </DialogDescription>
        </DialogHeader>

        {existingPending ? (
          <div className="p-3 rounded-lg border border-amber-500/30 bg-amber-500/10 text-sm">
            Já existe uma solicitação pendente para esta encomenda.
          </div>
        ) : (
          <div className="space-y-2">
            <Label htmlFor="reason">Motivo da exclusão</Label>
            <Textarea
              id="reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Ex.: encomenda cadastrada em duplicidade..."
              maxLength={500}
              rows={5}
              disabled={submitting || checking}
            />
            <p className="text-xs text-muted-foreground text-right">
              {reason.length}/500
            </p>
          </div>
        )}

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={submitting}
          >
            Cancelar
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={submitting || existingPending || checking}
            className="gap-2"
          >
            {submitting ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Enviando...
              </>
            ) : (
              "Enviar solicitação"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
