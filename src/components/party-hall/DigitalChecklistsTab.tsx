import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { FileCheck2, Eye, Mail, User, Clock } from "lucide-react";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useState } from "react";

interface DigitalChecklist {
  id: string;
  booking_id: string;
  token: string;
  signer_name: string;
  signer_email: string;
  signature_image: string;
  items: Array<{ name: string; category: string; is_ok: boolean; observation: string }>;
  general_observations: string | null;
  signed_at: string;
  created_at: string;
  booking?: {
    booking_date: string;
    start_time: string;
    end_time: string;
    resident: {
      full_name: string;
      apartment: {
        number: string;
        block: { name: string };
      };
    };
    party_hall_setting: { name: string };
    condominium: { name: string };
  };
}

interface DigitalChecklistsTabProps {
  condominiumIds: string[];
}

export default function DigitalChecklistsTab({ condominiumIds }: DigitalChecklistsTabProps) {
  const [selectedChecklist, setSelectedChecklist] = useState<DigitalChecklist | null>(null);

  const { data: checklists = [], isLoading } = useQuery({
    queryKey: ["digital-checklists", condominiumIds],
    queryFn: async () => {
      if (condominiumIds.length === 0) return [];
      
      const { data, error } = await (supabase
        .from("party_hall_digital_checklists" as any)
        .select(`
          id,
          booking_id,
          token,
          signer_name,
          signer_email,
          signature_image,
          items,
          general_observations,
          signed_at,
          created_at
        `) as any)
        .in("condominium_id", condominiumIds)
        .order("signed_at", { ascending: false })
        .limit(50);

      if (error) throw error;
      
      // Fetch booking details for each checklist
      const bookingIds = (data || []).map((c: any) => c.booking_id);
      if (bookingIds.length === 0) return [];

      const { data: bookings } = await supabase
        .from("party_hall_bookings")
        .select(`
          id,
          booking_date,
          start_time,
          end_time,
          resident:residents!inner(
            full_name,
            apartment:apartments!inner(
              number,
              block:blocks!inner(name)
            )
          ),
          party_hall_setting:party_hall_settings!inner(name),
          condominium:condominiums!inner(name)
        `)
        .in("id", bookingIds);

      const bookingsMap = new Map((bookings || []).map((b: any) => [b.id, b]));

      return (data || []).map((c: any) => ({
        ...c,
        booking: bookingsMap.get(c.booking_id),
      })) as DigitalChecklist[];
    },
    enabled: condominiumIds.length > 0,
  });

  if (isLoading) {
    return <div className="text-center py-8 text-muted-foreground">Carregando checklists...</div>;
  }

  if (checklists.length === 0) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center py-12">
          <FileCheck2 className="h-12 w-12 text-muted-foreground mb-4" />
          <p className="text-muted-foreground">Nenhum checklist digital assinado</p>
        </CardContent>
      </Card>
    );
  }

  const problemItems = (items: DigitalChecklist["items"]) => items.filter(i => !i.is_ok);

  return (
    <>
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {checklists.map((checklist) => (
          <Card key={checklist.id} className="overflow-hidden">
            <CardHeader className="pb-2">
              <div className="flex items-start justify-between">
                <div>
                  <CardTitle className="text-base flex items-center gap-2">
                    <FileCheck2 className="h-4 w-4 text-primary" />
                    {checklist.booking?.party_hall_setting?.name || "Salão de Festas"}
                  </CardTitle>
                  <CardDescription className="mt-1">
                    {checklist.booking?.condominium?.name || ""}
                  </CardDescription>
                </div>
                {problemItems(checklist.items).length > 0 ? (
                  <Badge variant="destructive">
                    {problemItems(checklist.items).length} problema(s)
                  </Badge>
                ) : (
                  <Badge variant="default">Tudo OK</Badge>
                )}
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div>
                  <p className="text-muted-foreground">Data da Reserva</p>
                  <p className="font-medium">
                    {checklist.booking?.booking_date
                      ? format(parseISO(checklist.booking.booking_date), "dd/MM/yyyy", { locale: ptBR })
                      : "-"}
                  </p>
                </div>
                <div>
                  <p className="text-muted-foreground">Assinado em</p>
                  <p className="font-medium">
                    {format(parseISO(checklist.signed_at), "dd/MM/yyyy HH:mm", { locale: ptBR })}
                  </p>
                </div>
                <div>
                  <p className="text-muted-foreground">Assinante</p>
                  <p className="font-medium">{checklist.signer_name}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Morador</p>
                  <p className="font-medium">{checklist.booking?.resident?.full_name || "-"}</p>
                </div>
              </div>

              <div className="flex gap-2 pt-2 border-t">
                <Button size="sm" variant="outline" onClick={() => setSelectedChecklist(checklist)}>
                  <Eye className="h-4 w-4 mr-1" />
                  Ver Detalhes
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Details Dialog */}
      <Dialog open={!!selectedChecklist} onOpenChange={(open) => !open && setSelectedChecklist(null)}>
        <DialogContent className="max-w-2xl max-h-[90vh]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileCheck2 className="h-5 w-5 text-primary" />
              Checklist de Entrada Digital
            </DialogTitle>
          </DialogHeader>
          {selectedChecklist && (
            <ScrollArea className="max-h-[70vh] pr-4">
              <div className="space-y-6">
                {/* Booking Info */}
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <p className="text-muted-foreground">Espaço</p>
                    <p className="font-medium">{selectedChecklist.booking?.party_hall_setting?.name}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Data da Reserva</p>
                    <p className="font-medium">
                      {selectedChecklist.booking?.booking_date
                        ? format(parseISO(selectedChecklist.booking.booking_date), "dd/MM/yyyy", { locale: ptBR })
                        : "-"}
                    </p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Morador</p>
                    <p className="font-medium">{selectedChecklist.booking?.resident?.full_name}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Unidade</p>
                    <p className="font-medium">
                      {selectedChecklist.booking?.resident?.apartment?.block?.name} - {selectedChecklist.booking?.resident?.apartment?.number}
                    </p>
                  </div>
                </div>

                {/* Signer Info */}
                <div className="border rounded-lg p-4 space-y-2">
                  <h3 className="font-semibold text-sm">Dados do Assinante</h3>
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div className="flex items-center gap-2">
                      <User className="h-4 w-4 text-muted-foreground" />
                      <span>{selectedChecklist.signer_name}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Mail className="h-4 w-4 text-muted-foreground" />
                      <span>{selectedChecklist.signer_email}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Clock className="h-4 w-4 text-muted-foreground" />
                      <span>{format(parseISO(selectedChecklist.signed_at), "dd/MM/yyyy HH:mm:ss", { locale: ptBR })}</span>
                    </div>
                  </div>
                </div>

                {/* Checklist Items */}
                <div className="space-y-3">
                  <h3 className="font-semibold text-sm">Itens do Checklist</h3>
                  {[...new Set(selectedChecklist.items.map(i => i.category))].map(category => (
                    <div key={category} className="border rounded-lg p-3">
                      <h4 className="font-medium text-sm mb-2">{category}</h4>
                      <div className="space-y-2">
                        {selectedChecklist.items
                          .filter(i => i.category === category)
                          .map((item, idx) => (
                            <div key={idx} className="flex items-start justify-between text-sm">
                              <span>{item.name}</span>
                              <div className="text-right">
                                <Badge variant={item.is_ok ? "default" : "destructive"} className="text-xs">
                                  {item.is_ok ? "OK" : "Problema"}
                                </Badge>
                                {item.observation && (
                                  <p className="text-xs text-muted-foreground mt-1 max-w-[200px]">{item.observation}</p>
                                )}
                              </div>
                            </div>
                          ))}
                      </div>
                    </div>
                  ))}
                </div>

                {/* General Observations */}
                {selectedChecklist.general_observations && (
                  <div className="border rounded-lg p-4">
                    <h3 className="font-semibold text-sm mb-2">Observações Gerais</h3>
                    <p className="text-sm text-muted-foreground">{selectedChecklist.general_observations}</p>
                  </div>
                )}

                {/* Signature */}
                <div className="border rounded-lg p-4">
                  <h3 className="font-semibold text-sm mb-2">Assinatura Digital</h3>
                  <div className="bg-white rounded border p-2">
                    <img 
                      src={selectedChecklist.signature_image} 
                      alt="Assinatura digital" 
                      className="max-h-24 mx-auto"
                    />
                  </div>
                </div>
              </div>
            </ScrollArea>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
