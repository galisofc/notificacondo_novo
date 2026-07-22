import { useState } from "react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Package, Clock, Building2, MoreVertical, Info, RefreshCw, Trash2 } from "lucide-react";
import { PackageDeleteRequestDialog } from "./PackageDeleteRequestDialog";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
import { PackageStatusBadge } from "./PackageStatusBadge";
import { PackageCardImage } from "./PackageCardImage";
import { PackageStatus } from "@/lib/packageConstants";
import { cn } from "@/lib/utils";
import { DeliveryStatusTracker, type DeliveryTimestamps } from "./DeliveryStatusTracker";

interface PackageCardProps {
  id: string;
  photoUrl: string;
  pickupCode: string;
  status: PackageStatus;
  apartmentNumber: string;
  blockName: string;
  condominiumName?: string;
  condominiumId?: string;
  receivedAt: string;
  description?: string;
  notificationStatus?: string | null;
  notificationTimestamps?: DeliveryTimestamps;
  onClick?: () => void;
  onResendNotification?: () => void;
  onViewDetails?: () => void;
  onRequestDeletion?: () => void;
  showCondominium?: boolean;
  compact?: boolean;
  showPickupCode?: boolean;
  canRequestDeletion?: boolean;
}

export function PackageCard({
  id,
  photoUrl,
  pickupCode,
  status,
  apartmentNumber,
  blockName,
  condominiumName,
  condominiumId,
  notificationStatus,
  notificationTimestamps,
  receivedAt,
  description,
  onClick,
  onResendNotification,
  onViewDetails,
  onRequestDeletion,
  showCondominium = false,
  compact = false,
  showPickupCode = true,
  canRequestDeletion = false,
}: PackageCardProps) {
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const canResend = Boolean(onResendNotification);
  const canDelete = canRequestDeletion && Boolean(condominiumId) && status !== "retirada";

  const formattedDate = format(new Date(receivedAt), "dd/MM/yyyy 'às' HH:mm", {
    locale: ptBR,
  });

  const handleConfirm = () => {
    setConfirmOpen(false);
    onResendNotification?.();
  };

  const ResendButton = ({ className }: { className?: string }) => (
    <Button
      variant="outline"
      size="sm"
      className={cn("w-full gap-2 text-xs", className)}
      onClick={(e) => {
        e.stopPropagation();
        setConfirmOpen(true);
      }}
    >
      <RefreshCw className="h-3.5 w-3.5" />
      Reenviar notificação WhatsApp
    </Button>
  );

  const DeleteButton = ({ className }: { className?: string }) => (
    <Button
      variant="outline"
      size="sm"
      className={cn(
        "w-full gap-2 text-xs border-destructive/40 text-destructive hover:bg-destructive/10 hover:text-destructive",
        className,
      )}
      onClick={(e) => {
        e.stopPropagation();
        setDeleteOpen(true);
      }}
    >
      <Trash2 className="h-3.5 w-3.5" />
      Solicitar exclusão
    </Button>
  );

  if (compact) {
    return (
      <>
        <div className="flex flex-col gap-1">
          <Card
            className={cn(
              "overflow-hidden transition-all hover:shadow-md",
              onClick && "cursor-pointer"
            )}
            onClick={onClick}
          >
            <CardContent className="p-3">
              <div className="flex items-center gap-3">
                <div className="shrink-0 relative">
                  <PackageCardImage src={photoUrl} compact />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    {showPickupCode && (
                      <span className="font-mono font-bold text-sm text-primary">
                        {pickupCode}
                      </span>
                    )}
                    <PackageStatusBadge status={status} />
                  </div>
                  <p className="text-sm text-muted-foreground truncate uppercase">
                    {blockName} - {apartmentNumber}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {formattedDate}
                  </p>
                  {notificationStatus && (
                    <DeliveryStatusTracker status={notificationStatus} timestamps={notificationTimestamps} className="mt-1" />
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
          {canResend && <ResendButton />}
          {canDelete && <DeleteButton />}
        </div>

        <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle className="flex items-center gap-2">
                <RefreshCw className="w-5 h-5 text-primary" />
                Reenviar Notificação
              </AlertDialogTitle>
              <AlertDialogDescription>
                Deseja enviar uma nova notificação via WhatsApp para os moradores do{" "}
                <strong>{blockName} - Apto {apartmentNumber}</strong>?
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancelar</AlertDialogCancel>
              <AlertDialogAction onClick={handleConfirm}>
                Sim, reenviar
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </>
    );
  }

  return (
    <>
      <div className="flex flex-col gap-1">
        <Card
          className={cn(
            "overflow-hidden transition-all hover:shadow-lg group",
            onClick && "cursor-pointer"
          )}
          onClick={onClick}
        >
          <div className="relative overflow-hidden bg-muted">
            <PackageCardImage src={photoUrl} />
            <div className="absolute top-3 right-3 flex items-center gap-2">
              <PackageStatusBadge status={status} />
              {(onViewDetails || canDelete) && (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                    <Button
                      variant="secondary"
                      size="icon"
                      className="h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <MoreVertical className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
                    {onViewDetails && (
                      <DropdownMenuItem onClick={onViewDetails}>
                        <Info className="w-4 h-4 mr-2" />
                        Ver Detalhes
                      </DropdownMenuItem>
                    )}
                    {canDelete && (
                      <DropdownMenuItem
                        onClick={() => setDeleteOpen(true)}
                        className="text-destructive focus:text-destructive"
                      >
                        <Trash2 className="w-4 h-4 mr-2" />
                        Solicitar exclusão
                      </DropdownMenuItem>
                    )}
                  </DropdownMenuContent>
                </DropdownMenu>
              )}
            </div>
          </div>
          <CardContent className="p-4 space-y-3">
            {showPickupCode && (
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 bg-primary/10 px-3 py-1.5 rounded-lg">
                  <Package className="w-4 h-4 text-primary" />
                  <span className="font-mono font-bold text-lg text-primary tracking-widest">
                    {pickupCode}
                  </span>
                </div>
              </div>
            )}

            <div className="space-y-1.5">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Building2 className="w-4 h-4" />
                <span className="uppercase">
                  {blockName} - {apartmentNumber}
                </span>
                {showCondominium && condominiumName && <span> • {condominiumName}</span>}
              </div>
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Clock className="w-4 h-4" />
                <span>{formattedDate}</span>
              </div>
              {notificationStatus && (
                <DeliveryStatusTracker status={notificationStatus} timestamps={notificationTimestamps} className="mt-1" />
              )}
            </div>

            {description && (
              <p className="text-sm text-muted-foreground line-clamp-2">
                {description}
              </p>
            )}
          </CardContent>
        </Card>
        {canResend && <ResendButton />}
        {canDelete && <DeleteButton />}
      </div>

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <RefreshCw className="w-5 h-5 text-primary" />
              Reenviar Notificação
            </AlertDialogTitle>
            <AlertDialogDescription>
              Deseja enviar uma nova notificação via WhatsApp para os moradores do{" "}
              <strong>{blockName} - Apto {apartmentNumber}</strong>?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirm}>
              Sim, reenviar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {canDelete && condominiumId && (
        <PackageDeleteRequestDialog
          open={deleteOpen}
          onOpenChange={setDeleteOpen}
          packageId={id}
          condominiumId={condominiumId}
          packageLabel={`${pickupCode} — ${blockName} Apto ${apartmentNumber}`}
          onSubmitted={onRequestDeletion}
        />
      )}
    </>
  );
}
