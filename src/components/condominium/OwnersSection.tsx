import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Badge } from "@/components/ui/badge";
import { UserCog, Plus, ChevronRight, MoreVertical, Edit, Trash2, Phone, Mail } from "lucide-react";
import OwnerFormDialog, { PropertyOwner } from "./OwnerFormDialog";
import { formatPhone, formatCPF } from "@/components/ui/masked-input";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface OwnersSectionProps {
  condominiumId: string;
  owners: PropertyOwner[];
  tenantCountByOwner: Record<string, number>;
  onChanged: () => void;
}

const OwnersSection = ({ condominiumId, owners, tenantCountByOwner, onChanged }: OwnersSectionProps) => {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<PropertyOwner | null>(null);

  const handleDelete = async (owner: PropertyOwner) => {
    const linked = tenantCountByOwner[owner.id] || 0;
    if (linked > 0) {
      toast({
        title: "Não é possível excluir",
        description: `Existem ${linked} inquilino(s) vinculado(s). Desvincule-os antes.`,
        variant: "destructive",
      });
      return;
    }
    if (!confirm(`Excluir proprietário ${owner.full_name}?`)) return;
    const { error } = await (supabase as any).from("property_owners").delete().eq("id", owner.id);
    if (error) {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: "Sucesso", description: "Proprietário excluído." });
    onChanged();
  };

  return (
    <>
      <Collapsible open={open} onOpenChange={setOpen}>
        <div className="rounded-xl border border-border bg-card overflow-hidden">
          <div className="flex items-center justify-between p-4">
            <CollapsibleTrigger className="flex items-center gap-3 flex-1 text-left">
              <ChevronRight className={`w-4 h-4 transition-transform ${open ? "rotate-90" : ""}`} />
              <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                <UserCog className="w-5 h-5 text-primary" />
              </div>
              <div>
                <h3 className="font-semibold text-foreground">Proprietários</h3>
                <p className="text-xs text-muted-foreground">
                  {owners.length} cadastrado(s)
                </p>
              </div>
            </CollapsibleTrigger>
            <Button
              variant="hero"
              size="sm"
              onClick={() => {
                setEditing(null);
                setDialogOpen(true);
              }}
            >
              <Plus className="w-4 h-4 mr-1" />
              Novo Proprietário
            </Button>
          </div>

          <CollapsibleContent>
            <div className="border-t border-border">
              {owners.length === 0 ? (
                <div className="p-6 text-center text-sm text-muted-foreground">
                  Nenhum proprietário cadastrado ainda.
                </div>
              ) : (
                <div className="divide-y divide-border">
                  {owners.map((o) => {
                    const linked = tenantCountByOwner[o.id] || 0;
                    return (
                      <div key={o.id} className="flex items-center justify-between p-4 hover:bg-secondary/30">
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <p className="font-medium text-foreground truncate">{o.full_name}</p>
                            {linked > 0 && (
                              <Badge variant="secondary" className="text-[10px]">
                                {linked} inquilino(s)
                              </Badge>
                            )}
                          </div>
                          <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground mt-1">
                            {o.cpf && <span>CPF {formatCPF(o.cpf)}</span>}
                            {o.phone && (
                              <span className="flex items-center gap-1">
                                <Phone className="w-3 h-3" />
                                {formatPhone(o.phone.replace(/^55(?=\d{10,11}$)/, ""))}
                              </span>
                            )}
                            {o.email && (
                              <span className="flex items-center gap-1">
                                <Mail className="w-3 h-3" />
                                {o.email}
                              </span>
                            )}
                          </div>
                        </div>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-8 w-8">
                              <MoreVertical className="w-4 h-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem
                              onClick={() => {
                                setEditing(o);
                                setDialogOpen(true);
                              }}
                            >
                              <Edit className="w-4 h-4 mr-2" />
                              Editar
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() => handleDelete(o)}
                              className="text-destructive focus:text-destructive"
                            >
                              <Trash2 className="w-4 h-4 mr-2" />
                              Excluir
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </CollapsibleContent>
        </div>
      </Collapsible>

      <OwnerFormDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        condominiumId={condominiumId}
        editingOwner={editing}
        onSaved={() => onChanged()}
      />
    </>
  );
};

export default OwnersSection;
