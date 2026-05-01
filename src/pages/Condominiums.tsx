import { useState, useEffect } from "react";
import { Helmet } from "react-helmet-async";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { MaskedInput } from "@/components/ui/masked-input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Building2,
  Plus,
  Edit,
  Trash2,
  Loader2,
  MapPin,
  FileText,
  Search,
  Crown,
  Phone,
  Wand2,
} from "lucide-react";
import { BulkCondominiumWizard } from "@/components/condominium/BulkCondominiumWizard";
import { useNavigate } from "react-router-dom";
import { useToast } from "@/hooks/use-toast";
import DashboardLayout from "@/components/layouts/DashboardLayout";
import SindicoBreadcrumbs from "@/components/sindico/SindicoBreadcrumbs";
import { isValidCNPJ, formatCNPJ, formatPhone, formatCEP } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";

interface Plan {
  id: string;
  name: string;
  slug: string;
  price: number;
  color: string;
  notifications_limit: number;
  warnings_limit: number;
  fines_limit: number;
}

interface Condominium {
  id: string;
  name: string;
  cnpj: string | null;
  phone: string | null;
  gatehouse_phone: string | null;
  address: string | null;
  address_number: string | null;
  city: string | null;
  state: string | null;
  zip_code: string | null;
  created_at: string;
  defense_deadline_days: number;
  logo_url: string | null;
  sindico_name: string | null;
  default_fine_percentage?: number | null;
  subscription?: {
    plan: string;
  } | null;
}

const Condominiums = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [condominiums, setCondominiums] = useState<Condominium[]>([]);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [loading, setLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingCondo, setEditingCondo] = useState<Condominium | null>(null);
  const [formData, setFormData] = useState({
    name: "",
    cnpj: "",
    phone: "",
    gatehouse_phone: "",
    zip_code: "",
    address: "",
    address_number: "",
    neighborhood: "",
    city: "",
    state: "",
    plan_slug: "start",
    defense_deadline_days: "10",
    logo_url: "",
    sindico_name: "",
    default_fine_percentage: "50",
  });
  const [saving, setSaving] = useState(false);
  const [fetchingCNPJ, setFetchingCNPJ] = useState(false);
  const [fetchingCEP, setFetchingCEP] = useState(false);
  const [isWizardOpen, setIsWizardOpen] = useState(false);
  const [uploadingLogo, setUploadingLogo] = useState(false);

  const handleLogoUpload = async (file: File) => {
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) {
      toast({ title: "Arquivo muito grande", description: "O logo deve ter no máximo 2MB.", variant: "destructive" });
      return;
    }
    setUploadingLogo(true);
    try {
      const ext = file.name.split(".").pop();
      const fileName = `${user?.id}/${Date.now()}.${ext}`;
      const { error: upErr } = await supabase.storage
        .from("condominium-logos")
        .upload(fileName, file, { upsert: true, contentType: file.type });
      if (upErr) throw upErr;
      const { data: pub } = supabase.storage.from("condominium-logos").getPublicUrl(fileName);
      setFormData((prev) => ({ ...prev, logo_url: pub.publicUrl }));
      toast({ title: "Logo enviado", description: "O logo foi carregado com sucesso." });
    } catch (err: any) {
      console.error("Logo upload error", err);
      toast({ title: "Erro", description: err.message || "Não foi possível enviar o logo.", variant: "destructive" });
    } finally {
      setUploadingLogo(false);
    }
  };

  const fetchPlans = async () => {
    try {
      const { data, error } = await supabase
        .from("plans")
        .select("*")
        .eq("is_active", true)
        .order("display_order", { ascending: true });

      if (error) throw error;
      setPlans(data || []);
    } catch (error) {
      console.error("Error fetching plans:", error);
    }
  };

  const fetchCondominiums = async () => {
    if (!user) return;
    
    try {
      const { data, error } = await supabase
        .from("condominiums")
        .select(`
          *,
          subscription:subscriptions(plan)
        `)
        .eq("owner_id", user.id)
        .order("created_at", { ascending: false });

      if (error) throw error;
      setCondominiums((data || []) as unknown as Condominium[]);
    } catch (error) {
      console.error("Error fetching condominiums:", error);
      toast({
        title: "Erro",
        description: "Não foi possível carregar os condomínios.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPlans();
    fetchCondominiums();
  }, [user]);

  const fetchCNPJData = async (cnpj: string) => {
    const cleanCNPJ = cnpj.replace(/\D/g, "");
    
    if (cleanCNPJ.length !== 14) return;
    
    if (!isValidCNPJ(cleanCNPJ)) {
      toast({
        title: "CNPJ inválido",
        description: "Por favor, verifique o número do CNPJ.",
        variant: "destructive",
      });
      return;
    }

    setFetchingCNPJ(true);
    try {
      const response = await fetch(`https://brasilapi.com.br/api/cnpj/v1/${cleanCNPJ}`);
      
      if (!response.ok) {
        throw new Error("CNPJ não encontrado");
      }

      const data = await response.json();
      
      setFormData((prev) => ({
        ...prev,
        name: data.razao_social || data.nome_fantasia || prev.name,
        phone: data.ddd_telefone_1 ? data.ddd_telefone_1.replace(/\D/g, "") : prev.phone,
        zip_code: data.cep ? data.cep.replace(/\D/g, "") : prev.zip_code,
        address: data.logradouro || prev.address,
        address_number: data.numero || prev.address_number,
        neighborhood: data.bairro || prev.neighborhood,
        city: data.municipio || prev.city,
        state: data.uf || prev.state,
      }));

      toast({
        title: "Dados encontrados",
        description: `Dados de "${data.razao_social || data.nome_fantasia}" preenchidos automaticamente.`,
      });
    } catch (error) {
      console.error("Error fetching CNPJ:", error);
      toast({
        title: "Erro ao consultar CNPJ",
        description: "Não foi possível consultar os dados. Preencha manualmente.",
        variant: "destructive",
      });
    } finally {
      setFetchingCNPJ(false);
    }
  };

  const fetchCEPData = async (cep: string) => {
    const cleanCEP = cep.replace(/\D/g, "");
    if (cleanCEP.length !== 8) return;

    setFetchingCEP(true);
    try {
      const response = await fetch(`https://viacep.com.br/ws/${cleanCEP}/json/`);
      const data = await response.json();

      if (data.erro) {
        toast({
          title: "CEP não encontrado",
          description: "Verifique o CEP informado.",
          variant: "destructive",
        });
        return;
      }

      setFormData((prev) => ({
        ...prev,
        address: data.logradouro || prev.address,
        neighborhood: data.bairro || prev.neighborhood,
        city: data.localidade || prev.city,
        state: data.uf || prev.state,
      }));

      toast({
        title: "Endereço encontrado",
        description: "Os dados foram preenchidos automaticamente.",
      });
    } catch (error) {
      toast({
        title: "Erro ao buscar CEP",
        description: "Tente novamente mais tarde.",
        variant: "destructive",
      });
    } finally {
      setFetchingCEP(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    // Validate CNPJ if provided
    if (formData.cnpj && formData.cnpj.replace(/\D/g, "").length > 0) {
      if (!isValidCNPJ(formData.cnpj)) {
        toast({ title: "Erro", description: "CNPJ inválido", variant: "destructive" });
        return;
      }
    }

    setSaving(true);
    try {
      if (editingCondo) {
        // Update condominium
        const { error } = await supabase
          .from("condominiums")
          .update({
            name: formData.name,
            cnpj: formData.cnpj.replace(/\D/g, "") || null,
            phone: formData.phone.replace(/\D/g, "") || null,
            gatehouse_phone: formData.gatehouse_phone.replace(/\D/g, "") || null,
            zip_code: formData.zip_code.replace(/\D/g, "") || null,
            address: formData.address || null,
            address_number: formData.address_number || null,
            neighborhood: formData.neighborhood || null,
            city: formData.city || null,
            state: formData.state || null,
            defense_deadline_days: parseInt(formData.defense_deadline_days) || 10,
            logo_url: formData.logo_url || null,
            sindico_name: formData.sindico_name || null,
            default_fine_percentage: formData.default_fine_percentage
              ? Number(formData.default_fine_percentage)
              : null,
          } as any)
          .eq("id", editingCondo.id);

        if (error) throw error;

        // Update subscription plan if changed
        const selectedPlan = plans.find((p) => p.slug === formData.plan_slug);
        if (selectedPlan) {
          const { error: subError } = await supabase
            .from("subscriptions")
            .update({
              plan: formData.plan_slug as "start" | "essencial" | "profissional" | "enterprise",
              notifications_limit: selectedPlan.notifications_limit,
              warnings_limit: selectedPlan.warnings_limit,
              fines_limit: selectedPlan.fines_limit,
            })
            .eq("condominium_id", editingCondo.id);

          if (subError) throw subError;
        }

        toast({ title: "Sucesso", description: "Condomínio atualizado!" });
      } else {
        // Create condominium
        const { data: newCondo, error } = await supabase
          .from("condominiums")
          .insert({
            owner_id: user.id,
            name: formData.name,
            cnpj: formData.cnpj.replace(/\D/g, "") || null,
            phone: formData.phone.replace(/\D/g, "") || null,
            gatehouse_phone: formData.gatehouse_phone.replace(/\D/g, "") || null,
            zip_code: formData.zip_code.replace(/\D/g, "") || null,
            address: formData.address || null,
            address_number: formData.address_number || null,
            neighborhood: formData.neighborhood || null,
            city: formData.city || null,
            state: formData.state || null,
            defense_deadline_days: parseInt(formData.defense_deadline_days) || 10,
            logo_url: formData.logo_url || null,
            sindico_name: formData.sindico_name || null,
            default_fine_percentage: formData.default_fine_percentage
              ? Number(formData.default_fine_percentage)
              : null,
          } as any)
          .select()
          .single();

        if (error) throw error;

        // Update subscription with selected plan (trigger already creates the subscription)
        const selectedPlan = plans.find((p) => p.slug === formData.plan_slug);
        if (selectedPlan && newCondo) {
          const { error: subError } = await supabase
            .from("subscriptions")
            .update({
              plan: formData.plan_slug as "start" | "essencial" | "profissional" | "enterprise",
              notifications_limit: selectedPlan.notifications_limit,
              warnings_limit: selectedPlan.warnings_limit,
              fines_limit: selectedPlan.fines_limit,
            })
            .eq("condominium_id", newCondo.id);

          if (subError) throw subError;
        }

        toast({ title: "Sucesso", description: "Condomínio cadastrado!" });
      }

      setIsDialogOpen(false);
      setEditingCondo(null);
      setFormData({ 
        name: "", 
        cnpj: "", 
        phone: "",
        gatehouse_phone: "",
        zip_code: "",
        address: "", 
        address_number: "",
        neighborhood: "",
        city: "", 
        state: "", 
        plan_slug: "start",
        default_fine_percentage: "50",
        defense_deadline_days: "10",
        logo_url: "",
        sindico_name: "",
      });
      fetchCondominiums();
    } catch (error: any) {
      console.error("Error saving condominium:", error);
      toast({
        title: "Erro",
        description: error.message || "Não foi possível salvar o condomínio.",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const handleEdit = (condo: Condominium) => {
    setEditingCondo(condo);
    setFormData({
      name: condo.name,
      cnpj: condo.cnpj ? formatCNPJ(condo.cnpj) : "",
      phone: condo.phone ? formatPhone(condo.phone) : "",
      gatehouse_phone: condo.gatehouse_phone ? formatPhone(condo.gatehouse_phone) : "",
      zip_code: condo.zip_code ? formatCEP(condo.zip_code) : "",
      address: condo.address || "",
      address_number: condo.address_number || "",
      neighborhood: (condo as any).neighborhood || "",
      city: condo.city || "",
      state: condo.state || "",
      plan_slug: condo.subscription?.plan || "start",
      defense_deadline_days: String(condo.defense_deadline_days || 10),
      logo_url: condo.logo_url || "",
      sindico_name: condo.sindico_name || "",
      default_fine_percentage:
        condo.default_fine_percentage != null ? String(condo.default_fine_percentage) : "50",
    });
    setIsDialogOpen(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Tem certeza que deseja excluir este condomínio? Todos os blocos, apartamentos e moradores serão excluídos.")) {
      return;
    }

    try {
      const { error } = await supabase
        .from("condominiums")
        .delete()
        .eq("id", id);

      if (error) throw error;
      toast({ title: "Sucesso", description: "Condomínio excluído!" });
      fetchCondominiums();
    } catch (error: any) {
      console.error("Error deleting condominium:", error);
      toast({
        title: "Erro",
        description: "Não foi possível excluir o condomínio.",
        variant: "destructive",
      });
    }
  };

  const openNewDialog = () => {
    setEditingCondo(null);
    setFormData({ 
      name: "", 
      cnpj: "", 
      phone: "",
      gatehouse_phone: "",
      zip_code: "",
      address: "", 
      address_number: "",
      neighborhood: "",
      city: "", 
      state: "", 
      plan_slug: "start",
      defense_deadline_days: "10",
      logo_url: "",
      sindico_name: "",
      default_fine_percentage: "50",
    });
    setIsDialogOpen(true);
  };

  const getPlanColor = (planSlug: string) => {
    const plan = plans.find((p) => p.slug === planSlug);
    return plan?.color || "bg-gray-500";
  };

  const getPlanName = (planSlug: string) => {
    const plan = plans.find((p) => p.slug === planSlug);
    return plan?.name || planSlug;
  };

  return (
    <DashboardLayout>
      <Helmet>
        <title>Condomínios | CondoManager</title>
      </Helmet>
      <div className="space-y-4 md:space-y-6 animate-fade-up">
        <SindicoBreadcrumbs items={[{ label: "Condomínios" }]} />
        <div>
          <h1 className="font-display text-2xl md:text-3xl font-bold text-foreground">
            Condomínios
          </h1>
          <p className="text-sm md:text-base text-muted-foreground mt-1">
            Gerencie seus condomínios cadastrados
          </p>
        </div>

        {/* Add Buttons */}
        <div className="flex flex-col sm:flex-row justify-end gap-2 mb-4 md:mb-6">
          <Button
            variant="outline"
            onClick={() => setIsWizardOpen(true)}
            className="w-full sm:w-auto"
          >
            <Wand2 className="w-4 h-4 mr-2" />
            Cadastro Rápido
          </Button>
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button variant="hero" onClick={openNewDialog} className="w-full sm:w-auto">
                <Plus className="w-4 h-4 mr-2" />
                Novo Condomínio
              </Button>
            </DialogTrigger>
            <DialogContent className="bg-card border-border">
              <DialogHeader>
                <DialogTitle className="font-display text-xl">
                  {editingCondo ? "Editar Condomínio" : "Novo Condomínio"}
                </DialogTitle>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4 max-h-[60vh] overflow-y-auto py-2">
                <div className="space-y-2">
                  <Label htmlFor="gatehouse_phone">WhatsApp da Portaria</Label>
                  <MaskedInput
                    id="gatehouse_phone"
                    mask="phone"
                    value={formData.gatehouse_phone}
                    onChange={(value) => setFormData({ ...formData, gatehouse_phone: value })}
                    className="bg-secondary/50"
                    placeholder="(00) 00000-0000"
                  />
                  <p className="text-xs text-muted-foreground">
                    Número que receberá os avisos do salão de festas no dia da reserva.
                  </p>
                </div>

                {/* CNPJ com busca automática */}
                <div className="space-y-2">
                  <Label htmlFor="cnpj">CNPJ (busca automática)</Label>
                  <div className="relative">
                    <MaskedInput
                      id="cnpj"
                      mask="cnpj"
                      value={formData.cnpj}
                      onChange={(value) => {
                        setFormData({ ...formData, cnpj: value });
                        const cleanCnpj = value.replace(/\D/g, "");
                        if (cleanCnpj.length === 14) {
                          fetchCNPJData(value);
                        }
                      }}
                      className="bg-secondary/50"
                      placeholder="00.000.000/0000-00"
                    />
                    {fetchingCNPJ && (
                      <div className="absolute right-3 top-1/2 -translate-y-1/2">
                        <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
                      </div>
                    )}
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="name">Nome do Condomínio *</Label>
                  <Input
                    id="name"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    required
                    className="bg-secondary/50"
                    placeholder="Nome do condomínio"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="phone">Telefone</Label>
                  <MaskedInput
                    id="phone"
                    mask="phone"
                    value={formData.phone}
                    onChange={(value) => setFormData({ ...formData, phone: value })}
                    className="bg-secondary/50"
                    placeholder="(00) 00000-0000"
                  />
                </div>



                {/* CEP com busca automática */}
                <div className="space-y-2">
                  <Label htmlFor="zip_code">CEP (busca automática)</Label>
                  <div className="relative">
                    <MaskedInput
                      id="zip_code"
                      mask="cep"
                      value={formData.zip_code}
                      onChange={(value) => {
                        setFormData({ ...formData, zip_code: value });
                        const cleanCep = value.replace(/\D/g, "");
                        if (cleanCep.length === 8) {
                          fetchCEPData(value);
                        }
                      }}
                      className="bg-secondary/50"
                      placeholder="00000-000"
                    />
                    {fetchingCEP && (
                      <div className="absolute right-3 top-1/2 -translate-y-1/2">
                        <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
                      </div>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="address">Logradouro</Label>
                    <Input
                      id="address"
                      value={formData.address}
                      onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                      className="bg-secondary/50"
                      placeholder="Rua, Avenida, etc."
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="address_number">Número</Label>
                    <Input
                      id="address_number"
                      value={formData.address_number}
                      onChange={(e) => setFormData({ ...formData, address_number: e.target.value })}
                      className="bg-secondary/50"
                      placeholder="Nº"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="neighborhood">Bairro</Label>
                  <Input
                    id="neighborhood"
                    value={formData.neighborhood}
                    onChange={(e) => setFormData({ ...formData, neighborhood: e.target.value })}
                    className="bg-secondary/50"
                    placeholder="Bairro"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="city">Cidade</Label>
                    <Input
                      id="city"
                      value={formData.city}
                      onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                      className="bg-secondary/50"
                      placeholder="Cidade"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="state">UF</Label>
                    <Input
                      id="state"
                      value={formData.state}
                      onChange={(e) => setFormData({ ...formData, state: e.target.value.toUpperCase().slice(0, 2) })}
                      className="bg-secondary/50"
                      placeholder="UF"
                      maxLength={2}
                    />
                  </div>
                </div>

                {/* Nome do Síndico */}
                <div className="space-y-2">
                  <Label htmlFor="sindico_name">Nome do Síndico</Label>
                  <Input
                    id="sindico_name"
                    value={formData.sindico_name}
                    onChange={(e) => setFormData({ ...formData, sindico_name: e.target.value })}
                    className="bg-secondary/50"
                    placeholder="Nome completo do síndico"
                  />
                  <p className="text-xs text-muted-foreground">
                    Aparecerá na assinatura do PDF de ocorrências
                  </p>
                </div>

                {/* Logo do Condomínio */}
                <div className="space-y-2">
                  <Label htmlFor="logo">Logo do Condomínio</Label>
                  <div className="flex items-center gap-3">
                    {formData.logo_url && (
                      <img
                        src={formData.logo_url}
                        alt="Logo"
                        className="w-16 h-16 object-contain rounded-lg border border-border bg-background"
                      />
                    )}
                    <div className="flex-1 space-y-2">
                      <Input
                        id="logo"
                        type="file"
                        accept="image/*"
                        disabled={uploadingLogo}
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) handleLogoUpload(file);
                        }}
                        className="bg-secondary/50"
                      />
                      {formData.logo_url && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => setFormData({ ...formData, logo_url: "" })}
                        >
                          Remover logo
                        </Button>
                      )}
                    </div>
                    {uploadingLogo && <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    PNG ou JPG, máximo 2MB. Aparecerá no topo do PDF de ocorrências.
                  </p>
                </div>

                {/* Plano - seleção ao criar, visualização ao editar */}
                {!editingCondo ? (
                  <div className="space-y-2">
                    <Label htmlFor="plan">Plano *</Label>
                    <Select
                      value={formData.plan_slug}
                      onValueChange={(value) => setFormData({ ...formData, plan_slug: value })}
                    >
                      <SelectTrigger className="bg-secondary/50">
                        <SelectValue placeholder="Selecione um plano" />
                      </SelectTrigger>
                      <SelectContent>
                        {plans.map((plan) => (
                          <SelectItem key={plan.id} value={plan.slug}>
                            <div className="flex items-center gap-2">
                              <Crown className="w-4 h-4" />
                              <span>{plan.name}</span>
                              <span className="text-muted-foreground">
                                - R$ {plan.price.toFixed(2)}/mês
                              </span>
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <p className="text-xs text-muted-foreground">
                      O plano define os limites de notificações, advertências e multas
                    </p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <Label>Plano Atual</Label>
                    <div className="flex items-center gap-2 p-3 rounded-lg bg-secondary/50 border border-border">
                      <Crown className="w-4 h-4 text-primary" />
                      <span className="font-medium">
                        {editingCondo.subscription?.plan 
                          ? editingCondo.subscription.plan.charAt(0).toUpperCase() + editingCondo.subscription.plan.slice(1)
                          : "Sem plano"}
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Para alterar o plano, acesse a página de Assinaturas
                    </p>
                  </div>
                )}

                {/* Percentual padrão de multa */}
                <div className="space-y-2">
                  <Label htmlFor="default_fine_percentage">Percentual padrão de multa (%)</Label>
                  <Input
                    id="default_fine_percentage"
                    type="number"
                    min="0"
                    step="0.01"
                    value={formData.default_fine_percentage}
                    onChange={(e) => setFormData({ ...formData, default_fine_percentage: e.target.value })}
                    className="bg-secondary/50"
                    placeholder="50"
                  />
                  <p className="text-xs text-muted-foreground">
                    Valor padrão (% da taxa condominial) que será pré-preenchido ao cadastrar uma ocorrência do tipo Multa.
                  </p>
                </div>

                {/* Prazo para defesa */}
                <div className="space-y-2">
                  <Label htmlFor="defense_deadline_days">Prazo para Defesa (dias) *</Label>
                  <Input
                    id="defense_deadline_days"
                    type="number"
                    min="1"
                    max="90"
                    value={formData.defense_deadline_days}
                    onChange={(e) => setFormData({ ...formData, defense_deadline_days: e.target.value })}
                    className="bg-secondary/50"
                    placeholder="10"
                    required
                  />
                  <p className="text-xs text-muted-foreground">
                    Prazo em dias para o morador apresentar defesa após receber uma notificação
                  </p>
                </div>

                <div className="flex justify-end gap-3 pt-4 border-t border-border">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setIsDialogOpen(false)}
                  >
                    Cancelar
                  </Button>
                  <Button type="submit" variant="hero" disabled={saving}>
                    {saving ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin mr-2" />
                        Salvando...
                      </>
                    ) : (
                      "Salvar"
                    )}
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        {/* List */}
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
          </div>
        ) : condominiums.length === 0 ? (
          <div className="text-center py-8 md:py-12 px-4 rounded-2xl bg-card border border-border shadow-card">
            <div className="w-14 h-14 md:w-16 md:h-16 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-4">
              <Building2 className="w-7 h-7 md:w-8 md:h-8 text-primary" />
            </div>
            <h3 className="font-display text-lg md:text-xl font-semibold text-foreground mb-2">
              Nenhum condomínio cadastrado
            </h3>
            <p className="text-sm md:text-base text-muted-foreground mb-6">
              Cadastre seu primeiro condomínio para começar.
            </p>
            <Button variant="hero" onClick={openNewDialog} className="w-full sm:w-auto">
              <Plus className="w-4 h-4 mr-2" />
              Cadastrar Condomínio
            </Button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 md:gap-4">
            {condominiums.map((condo) => (
              <div
                key={condo.id}
                className="p-4 md:p-6 rounded-2xl bg-card border border-border shadow-card hover:shadow-elevated transition-all"
              >
                <div className="flex items-start justify-between mb-3 md:mb-4">
                  <div className="flex items-center gap-2 md:gap-3">
                    <div className="w-10 h-10 md:w-12 md:h-12 rounded-xl bg-primary/10 flex items-center justify-center">
                      <Building2 className="w-5 h-5 md:w-6 md:h-6 text-primary" />
                    </div>
                    {condo.subscription?.plan && (
                      <Badge className={`${getPlanColor(condo.subscription.plan)} text-white text-xs`}>
                        {getPlanName(condo.subscription.plan)}
                      </Badge>
                    )}
                  </div>
                  <div className="flex gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleEdit(condo)}
                      className="h-8 w-8"
                    >
                      <Edit className="w-4 h-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleDelete(condo.id)}
                      className="h-8 w-8"
                    >
                      <Trash2 className="w-4 h-4 text-destructive" />
                    </Button>
                  </div>
                </div>

                <h3 className="font-display text-base md:text-lg font-semibold text-foreground mb-2">
                  {condo.name}
                </h3>
                
                {condo.address && (
                  <div className="flex items-center gap-2 text-xs md:text-sm text-muted-foreground mb-1">
                    <MapPin className="w-3 h-3" />
                    <span className="truncate">
                      {condo.address}{condo.address_number ? `, ${condo.address_number}` : ""}
                    </span>
                  </div>
                )}
                
                {condo.city && (
                  <p className="text-xs md:text-sm text-muted-foreground mb-3">
                    {condo.city}{condo.state ? `, ${condo.state}` : ""}
                  </p>
                )}

                {condo.cnpj && (
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <FileText className="w-3 h-3" />
                    <span>CNPJ: {formatCNPJ(condo.cnpj)}</span>
                  </div>
                )}

                {condo.phone && (
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <Phone className="w-3 h-3" />
                    <span>{formatPhone(condo.phone)}</span>
                  </div>
                )}

                {condo.zip_code && (
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <MapPin className="w-3 h-3" />
                    <span>CEP: {formatCEP(condo.zip_code)}</span>
                  </div>
                )}

                <div className="mt-4 pt-4 border-t border-border">
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full text-xs md:text-sm"
                    onClick={() => navigate(`/condominiums/${condo.id}`)}
                  >
                    Gerenciar Blocos e Unidades
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Bulk Condominium Wizard */}
        <BulkCondominiumWizard
          open={isWizardOpen}
          onOpenChange={setIsWizardOpen}
          plans={plans}
          onSuccess={fetchCondominiums}
        />
      </div>
    </DashboardLayout>
  );
};

export default Condominiums;
