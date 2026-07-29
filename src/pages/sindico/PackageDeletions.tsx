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
import { getSignedPackagePhotoUrl, deletePackagePhoto } from "@/lib/packageStorage";

type Status = "pendente" | "aprovada" | "rejeitada";

interface DeletionRequest {
  id: string;
  package_id: string | null;
  condominium_id: string;
  requested_by: string;
  requested_by_name: string | null;
  package_pickup_code: string | null;
  package_block_name: string | null;
  package_apartment_number: string | null;
  package_condominium_name: string | null;
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
    photo_url: string | null;
    tracking_code: string | null;
    description: string | null;
    received_by_name: string | null;
    picked_up_at: string | null;
    picked_up_by_name: string | null;
    condominium?: { name: string };
    block?: { name: string };
    apartment?: { number: string };
    resident?: { full_name: string; phone: string | null };
    package_type?: { name: string; icon: string | null };
  };
}

interface PackageDisplayInfo {
  pickupCode: string;
  location: string | null;
  condominiumName: string | null;
}

function getPackageDisplayInfo(req: DeletionRequest): PackageDisplayInfo {
  const blockName = req.package?.block?.name ?? req.package_block_name;
  const apartmentNumber = req.package?.apartment?.number ?? req.package_apartment_number;
  const location = blockName || apartmentNumber
    ? `${blockName ?? "Bloco —"} - Apto ${apartmentNumber ?? "—"}`
    : null;

  return {
    pickupCode: req.package?.pickup_code ?? req.package_pickup_code ?? "—",
    location,
    condominiumName: req.package?.condominium?.name ?? req.package_condominium_name,
  };
}


export default function PackageDeletions() {
  const { user } = useAuth();
  const [items, setItems] = useState<DeletionRequest[]>([]);
  const [nameByUserId, setNameByUserId] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<Status>("pendente");
  const [approveTarget, setApproveTarget] = useState<DeletionRequest | null>(null);
  const [rejectTarget, setRejectTarget] = useState<DeletionRequest | null>(null);
  const [rejectNotes, setRejectNotes] = useState("");
  const [processing, setProcessing] = useState(false);
  const [photoByRequestId, setPhotoByRequestId] = useState<Record<string, string>>({});

  const fetchAll = async () => {
    setLoading(true);
    try {
      const { data, error } = await (supabase as any)
        .from("package_deletion_requests")
        .select(
          `*, package:packages(
            id, pickup_code, status, received_at, photo_url, tracking_code,
            description, received_by_name, picked_up_at, picked_up_by_name,
            condominium:condominiums(name),
            block:blocks(name),
            apartment:apartments(number),
            resident:residents(full_name, phone),
            package_type:package_types(name, icon)
          )`
        )
        .order("created_at", { ascending: false });
      if (error) throw error;
      const list = (data as DeletionRequest[]) || [];
      setItems(list);

      // Assinaturas temporárias para as fotos ainda existentes no Storage
      const withPhotos = list.filter((r) => r.package?.photo_url);
      if (withPhotos.length > 0) {
        const entries = await Promise.all(
          withPhotos.map(async (r) => {
            const signed = await getSignedPackagePhotoUrl(r.package!.photo_url as string);
            return [r.id, signed] as const;
          })
        );
        const photoMap: Record<string, string> = {};
        entries.forEach(([id, url]) => {
          if (url) photoMap[id] = url;
        });
        setPhotoByRequestId(photoMap);
      } else {
        setPhotoByRequestId({});
      }


      const userIds = Array.from(new Set(list.map((r) => r.requested_by).filter(Boolean)));
      if (userIds.length > 0) {
        const { data: profiles } = await (supabase as any)
          .from("profiles")
          .select("id, full_name")
          .in("id", userIds);
        const map: Record<string, string> = {};
        (profiles || []).forEach((p: any) => {
          if (p?.full_name) map[p.id] = p.full_name;
        });
        setNameByUserId(map);
      } else {
        setNameByUserId({});
      }
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
      // Guardamos a foto ANTES da exclusão do registro — ela só será apagada
      // do Storage depois que a aprovação for confirmada com sucesso.
      const photoUrlToDelete = approveTarget.package?.photo_url ?? null;

      const { error: approveError } = await (supabase as any).rpc(
        "approve_package_deletion_request",
        {
          _request_id: approveTarget.id,
          _reviewer_name: reviewerName,
        }
      );
      if (approveError) throw approveError;

      if (approveTarget.package_id) {
        const { data: packageStillExists, error: verifyError } = await (supabase as any)
          .from("packages")
          .select("id")
          .eq("id", approveTarget.package_id)
          .maybeSingle();

        if (verifyError) throw verifyError;
        if (packageStillExists) {
          throw new Error("A solicitação foi aprovada, mas a encomenda ainda existe no banco de dados.");
        }
      }

      // Somente após a aprovação confirmada removemos a imagem do Storage.
      if (photoUrlToDelete) {
        const result = await deletePackagePhoto(photoUrlToDelete);
        if (!result.success) {
          console.warn("Falha ao excluir a foto da encomenda:", result.error);
          toast.warning("Encomenda excluída, mas a foto não pôde ser removida do armazenamento.");
        }
      }

      toast.success("Solicitação aprovada — encomenda e foto excluídas");
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
              filtered.map((req) => {
                const packageInfo = getPackageDisplayInfo(req);

                return (
                <Card key={req.id} className="overflow-hidden">
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between gap-3 flex-wrap">
                      <CardTitle className="text-base flex items-center gap-2">
                        <PackageIcon className="w-4 h-4 text-primary" />
                        <span className="font-mono">{packageInfo.pickupCode}</span>
                        {packageInfo.location && (
                          <span className="text-sm font-normal text-muted-foreground">
                            {packageInfo.location}
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
                    {packageInfo.condominiumName && (
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Building2 className="w-4 h-4" />
                        {packageInfo.condominiumName}
                      </div>
                    )}

                    {req.package && (
                      <div className="rounded-lg border bg-card p-3 flex flex-col sm:flex-row gap-3">
                        <div className="sm:w-32 shrink-0">
                          {photoByRequestId[req.id] ? (
                            <img
                              src={photoByRequestId[req.id]}
                              alt={`Foto da encomenda ${packageInfo.pickupCode}`}
                              loading="lazy"
                              className="w-full h-28 sm:h-24 object-cover rounded-md border"
                            />
                          ) : (
                            <div className="w-full h-28 sm:h-24 rounded-md border bg-muted/40 flex items-center justify-center">
                              <ImageOff className="w-5 h-5 text-muted-foreground" />
                            </div>
                          )}
                        </div>
                        <div className="flex-1 grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-1.5 text-sm">
                          <div>
                            <span className="text-muted-foreground">Destinatário: </span>
                            <strong>{req.package.resident?.full_name || "—"}</strong>
                          </div>
                          <div>
                            <span className="text-muted-foreground">Tipo: </span>
                            <strong>{req.package.package_type?.name || "—"}</strong>
                          </div>
                          <div>
                            <span className="text-muted-foreground">Rastreio: </span>
                            <strong className="font-mono">{req.package.tracking_code || "—"}</strong>
                          </div>
                          <div>
                            <span className="text-muted-foreground">Situação: </span>
                            <strong>{req.package.status}</strong>
                          </div>
                          <div>
                            <span className="text-muted-foreground">Recebida em: </span>
                            <strong>
                              {format(new Date(req.package.received_at), "dd/MM/yyyy HH:mm", { locale: ptBR })}
                            </strong>
                          </div>
                          <div>
                            <span className="text-muted-foreground">Recebida por: </span>
                            <strong>{req.package.received_by_name || "—"}</strong>
                          </div>
                          {req.package.picked_up_at && (
                            <div className="sm:col-span-2">
                              <span className="text-muted-foreground">Retirada: </span>
                              <strong>
                                {format(new Date(req.package.picked_up_at), "dd/MM/yyyy HH:mm", { locale: ptBR })}
                                {req.package.picked_up_by_name ? ` por ${req.package.picked_up_by_name}` : ""}
                              </strong>
                            </div>
                          )}
                          {req.package.description && (
                            <div className="sm:col-span-2">
                              <span className="text-muted-foreground">Observações: </span>
                              <span className="whitespace-pre-wrap">{req.package.description}</span>
                            </div>
                          )}
                        </div>
                      </div>
                    )}

                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <User className="w-4 h-4" />
                      Solicitado por: <strong>{nameByUserId[req.requested_by] || (req.requested_by_name && !req.requested_by_name.includes("@") ? req.requested_by_name : null) || "Porteiro"}</strong>
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
                );
              })
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
              A encomenda <strong>{approveTarget ? getPackageDisplayInfo(approveTarget).pickupCode : "—"}</strong> será
              removida definitivamente da tabela de encomendas. A solicitação ficará
              preservada para auditoria.
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
