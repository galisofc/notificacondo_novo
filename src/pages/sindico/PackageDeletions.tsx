import { useEffect, useMemo, useState } from "react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Trash2, CheckCircle2, XCircle, Loader2, Clock, User, Building2, Package as PackageIcon } from "lucide-react";
import { Helmet } from "react-helmet-async";
import DashboardLayout from "@/components/layouts/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

type Status = "pendente" | "aprovada" | "rejeitada";

interface DeletionRequest {
  id: string;
  package_id: string;
  condominium_id: string;
  requested_by: string;
  requested_by_name: string | null;
  reason: string;
  status: Status;
  reviewed_by: string | null;
  reviewed_by_name: string | null;
  review_notes: string | null;
  reviewed_at: string | null;
  created_at: string;
  package?: {
    id: string;
    pickup_code: string;
    status: string;
    received_at: string;
    condominium?: { name: string };
    block?: { name: string };
    apartment?: { number: string };
  };
}

export default function PackageDeletions() {
  const { user } = useAuth();
  const [items, setItems] = useState<DeletionRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<Status>("pendente");
  const [approveTarget, setApproveTarget] = useState<DeletionRequest | null>(null);
  const [rejectTarget, setRejectTarget] = useState<DeletionRequest | null>(null);
  const [rejectNotes, setRejectNotes] = useState("");
  const [processing, setProcessing] = useState(false);

  const fetchAll = async () => {
    setLoading(true);
    try {
      const { data, error } = await (supabase as any)
        .from("package_deletion_requests")
        .select(
          `*, package:packages(
            id, pickup_code, status, received_at,
            condominium:condominiums(name),
            block:blocks(name),
            apartment:apartments(number)
          )`
        )
        .order("created_at", { ascending: false });
      if (error) throw error;
      setItems((data as DeletionRequest[]) || []);
    } catch (err: any) {
      console.error(err);
      toast.error("Erro ao carregar solicitações");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAll();
    const channel = supabase
      .channel("pkg-del-req")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "package_deletion_requests" },
        () => fetchAll()
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const filtered = useMemo(() => items.filter((i) => i.status === tab), [items, tab]);
  const counts = useMemo(
    () => ({
      pendente: items.filter((i) => i.status === "pendente").length,
      aprovada: items.filter((i) => i.status === "aprovada").length,
      rejeitada: items.filter((i) => i.status === "rejeitada").length,
    }),
    [items]
  );

  const reviewerName = user?.user_metadata?.full_name || user?.email || null;

  const handleApprove = async () => {
    if (!approveTarget || !user) return;
    setProcessing(true);
    try {
      // Soft-delete package
      const { error: pkgErr } = await (supabase as any)
        .from("packages")
        .update({
          deleted_at: new Date().toISOString(),
          deletion_reason: approveTarget.reason,
        })
        .eq("id", approveTarget.package_id);
      if (pkgErr) throw pkgErr;

      const { error: reqErr } = await (supabase as any)
        .from("package_deletion_requests")
        .update({
          status: "aprovada",
          reviewed_by: user.id,
          reviewed_by_name: reviewerName,
          reviewed_at: new Date().toISOString(),
        })
        .eq("id", approveTarget.id);
      if (reqErr) throw reqErr;

      toast.success("Solicitação aprovada — encomenda excluída");
      setApproveTarget(null);
      fetchAll();
    } catch (err: any) {
      console.error(err);
      toast.error(err?.message || "Erro ao aprovar");
    } finally {
      setProcessing(false);
    }
  };

  const handleReject = async () => {
    if (!rejectTarget || !user) return;
    setProcessing(true);
    try {
      const { error } = await (supabase as any)
        .from("package_deletion_requests")
        .update({
          status: "rejeitada",
          reviewed_by: user.id,
          reviewed_by_name: reviewerName,
          reviewed_at: new Date().toISOString(),
          review_notes: rejectNotes.trim() || null,
        })
        .eq("id", rejectTarget.id);
      if (error) throw error;

      toast.success("Solicitação rejeitada");
      setRejectTarget(null);
      setRejectNotes("");
      fetchAll();
    } catch (err: any) {
      console.error(err);
      toast.error(err?.message || "Erro ao rejeitar");
    } finally {
      setProcessing(false);
    }
  };

  return (
    <DashboardLayout>
      <Helmet>
        <title>NotificaCondo - Exclusões de Encomendas</title>
      </Helmet>
      <div className="space-y-6 p-4 md:p-6">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Trash2 className="w-6 h-6" />
            Exclusões de Encomendas
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            Aprove ou rejeite solicitações de exclusão enviadas pela portaria.
          </p>
        </div>

        <Tabs value={tab} onValueChange={(v) => setTab(v as Status)}>
          <TabsList>
            <TabsTrigger value="pendente" className="gap-2">
              Pendentes
              {counts.pendente > 0 && (
                <Badge variant="destructive" className="ml-1">
                  {counts.pendente}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="aprovada">Aprovadas ({counts.aprovada})</TabsTrigger>
            <TabsTrigger value="rejeitada">Rejeitadas ({counts.rejeitada})</TabsTrigger>
          </TabsList>

          <TabsContent value={tab} className="mt-4 space-y-3">
            {loading ? (
              <div className="flex items-center justify-center py-12 text-muted-foreground">
                <Loader2 className="w-5 h-5 animate-spin mr-2" />
                Carregando...
              </div>
            ) : filtered.length === 0 ? (
              <Card>
                <CardContent className="py-10 text-center text-muted-foreground">
                  Nenhuma solicitação {tab === "pendente" ? "pendente" : tab === "aprovada" ? "aprovada" : "rejeitada"}.
                </CardContent>
              </Card>
            ) : (
              filtered.map((req) => (
                <Card key={req.id} className="overflow-hidden">
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between gap-3 flex-wrap">
                      <CardTitle className="text-base flex items-center gap-2">
                        <PackageIcon className="w-4 h-4 text-primary" />
                        <span className="font-mono">{req.package?.pickup_code ?? "—"}</span>
                        {req.package && (
                          <span className="text-sm font-normal text-muted-foreground">
                            {req.package.block?.name} - Apto {req.package.apartment?.number}
                          </span>
                        )}
                      </CardTitle>
                      <Badge
                        variant={
                          req.status === "pendente"
                            ? "secondary"
                            : req.status === "aprovada"
                            ? "default"
                            : "destructive"
                        }
                      >
                        {req.status}
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {req.package?.condominium?.name && (
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Building2 className="w-4 h-4" />
                        {req.package.condominium.name}
                      </div>
                    )}
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <User className="w-4 h-4" />
                      Solicitado por: <strong>{req.requested_by_name || "—"}</strong>
                    </div>
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Clock className="w-4 h-4" />
                      {format(new Date(req.created_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                    </div>

                    <div className="p-3 rounded-lg bg-muted/40 border">
                      <p className="text-xs uppercase tracking-wide text-muted-foreground mb-1">
                        Motivo
                      </p>
                      <p className="text-sm whitespace-pre-wrap">{req.reason}</p>
                    </div>

                    {req.status !== "pendente" && (
                      <div className="text-xs text-muted-foreground space-y-0.5">
                        <p>
                          Revisado por <strong>{req.reviewed_by_name || "—"}</strong>
                          {req.reviewed_at &&
                            ` em ${format(new Date(req.reviewed_at), "dd/MM/yyyy HH:mm", {
                              locale: ptBR,
                            })}`}
                        </p>
                        {req.review_notes && (
                          <p className="italic">Observação: {req.review_notes}</p>
                        )}
                      </div>
                    )}

                    {req.status === "pendente" && (
                      <div className="flex gap-2 pt-2">
                        <Button
                          onClick={() => setApproveTarget(req)}
                          className="gap-2"
                        >
                          <CheckCircle2 className="w-4 h-4" />
                          Aprovar
                        </Button>
                        <Button
                          variant="outline"
                          onClick={() => setRejectTarget(req)}
                          className="gap-2"
                        >
                          <XCircle className="w-4 h-4" />
                          Rejeitar
                        </Button>
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))
            )}
          </TabsContent>
        </Tabs>
      </div>

      {/* Approve confirm */}
      <AlertDialog
        open={!!approveTarget}
        onOpenChange={(o) => !o && setApproveTarget(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Aprovar exclusão?</AlertDialogTitle>
            <AlertDialogDescription>
              A encomenda <strong>{approveTarget?.package?.pickup_code}</strong> será
              marcada como excluída e não aparecerá mais nas listagens. Esta ação pode
              ser auditada posteriormente.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={processing}>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleApprove} disabled={processing}>
              {processing ? "Processando..." : "Sim, aprovar"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Reject dialog */}
      <Dialog
        open={!!rejectTarget}
        onOpenChange={(o) => {
          if (!o) {
            setRejectTarget(null);
            setRejectNotes("");
          }
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Rejeitar solicitação</DialogTitle>
            <DialogDescription>
              Adicione uma observação (opcional) explicando o motivo da rejeição.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="notes">Observação</Label>
            <Textarea
              id="notes"
              value={rejectNotes}
              onChange={(e) => setRejectNotes(e.target.value)}
              rows={4}
              maxLength={500}
              placeholder="Ex.: encomenda ainda em uso..."
            />
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setRejectTarget(null);
                setRejectNotes("");
              }}
              disabled={processing}
            >
              Cancelar
            </Button>
            <Button
              variant="destructive"
              onClick={handleReject}
              disabled={processing}
            >
              {processing ? "Processando..." : "Rejeitar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}
