import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { MaskedInput, formatPhone, formatCPF } from "@/components/ui/masked-input";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { isValidCPF } from "@/lib/utils";

export interface PropertyOwner {
  id: string;
  condominium_id: string;
  full_name: string;
  cpf: string | null;
  phone: string | null;
  email: string | null;
  address: string | null;
}

interface OwnerFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  condominiumId: string;
  editingOwner?: PropertyOwner | null;
  onSaved?: (owner: PropertyOwner) => void;
}

const stripPhone = (v: string | null | undefined) =>
  (v || "").replace(/\D/g, "").replace(/^55(?=\d{10,11}$)/, "");

const OwnerFormDialog = ({
  open,
  onOpenChange,
  condominiumId,
  editingOwner,
  onSaved,
}: OwnerFormDialogProps) => {
  const { toast } = useToast();
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    full_name: "",
    cpf: "",
    phone: "",
    email: "",
    address: "",
  });

  useEffect(() => {
    if (open) {
      setForm({
        full_name: editingOwner?.full_name || "",
        cpf: editingOwner?.cpf ? formatCPF(editingOwner.cpf) : "",
        phone: editingOwner?.phone ? formatPhone(stripPhone(editingOwner.phone)) : "",
        email: editingOwner?.email || "",
        address: editingOwner?.address || "",
      });
    }
  }, [open, editingOwner]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.full_name.trim()) {
      toast({ title: "Erro", description: "Informe o nome do proprietário.", variant: "destructive" });
      return;
    }
    const cleanCpf = form.cpf.replace(/\D/g, "");
    if (cleanCpf && !isValidCPF(cleanCpf)) {
      toast({ title: "Erro", description: "CPF inválido.", variant: "destructive" });
      return;
    }
    const cleanPhone = form.phone.replace(/\D/g, "");

    setSaving(true);
    try {
      const payload = {
        condominium_id: condominiumId,
        full_name: form.full_name.toUpperCase().trim(),
        cpf: cleanCpf || null,
        phone: cleanPhone || null,
        email: form.email.trim() || null,
        address: form.address.trim() || null,
      };

      if (editingOwner) {
        const { data, error } = await (supabase as any)
          .from("property_owners")
          .update(payload)
          .eq("id", editingOwner.id)
          .select()
          .single();
        if (error) throw error;
        toast({ title: "Sucesso", description: "Proprietário atualizado." });
        onSaved?.(data as PropertyOwner);
      } else {
        const { data, error } = await (supabase as any)
          .from("property_owners")
          .insert(payload)
          .select()
          .single();
        if (error) throw error;
        toast({ title: "Sucesso", description: "Proprietário cadastrado." });
        onSaved?.(data as PropertyOwner);
      }
      onOpenChange(false);
    } catch (error: any) {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{editingOwner ? "Editar Proprietário" : "Cadastrar Proprietário"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="ownerFullName">Nome Completo *</Label>
            <Input
              id="ownerFullName"
              value={form.full_name}
              onChange={(e) => setForm({ ...form, full_name: e.target.value })}
              placeholder="Nome do proprietário"
              required
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="ownerCpf">CPF</Label>
              <MaskedInput
                id="ownerCpf"
                mask="cpf"
                value={form.cpf}
                onChange={(v) => setForm({ ...form, cpf: v })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="ownerPhoneInput">Telefone</Label>
              <MaskedInput
                id="ownerPhoneInput"
                mask="phone"
                value={form.phone}
                onChange={(v) => setForm({ ...form, phone: v })}
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="ownerEmailInput">E-mail</Label>
            <Input
              id="ownerEmailInput"
              type="email"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              placeholder="proprietario@email.com"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="ownerAddress">Endereço</Label>
            <Input
              id="ownerAddress"
              value={form.address}
              onChange={(e) => setForm({ ...form, address: e.target.value })}
              placeholder="Endereço completo"
            />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
              Cancelar
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Salvando...
                </>
              ) : editingOwner ? (
                "Atualizar"
              ) : (
                "Cadastrar"
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default OwnerFormDialog;
