import { useMemo } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Helmet } from "react-helmet-async";
import { supabase } from "@/integrations/supabase/client";
import DashboardLayout from "@/components/layouts/DashboardLayout";
import SindicoBreadcrumbs from "@/components/sindico/SindicoBreadcrumbs";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import {
  ArrowLeft,
  Smartphone,
  QrCode,
  Edit,
  Plus,
  CheckCircle2,
  AlertCircle,
  KeyRound,
  ClipboardList,
  Eye,
} from "lucide-react";
import { differenceInDays, parseISO, format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { formatCEP, formatCNPJ } from "@/lib/utils";

interface Condo {
  id: string;
  name: string;
  address: string | null;
  address_number: string | null;
  neighborhood: string | null;
  city: string | null;
  state: string | null;
  zip_code: string | null;
  cnpj: string | null;
  phone: string | null;
  created_at: string;
}

interface ResponsibleUser {
  user_id: string;
  full_name: string | null;
  email: string | null;
  phone: string | null;
  role: string;
}

export default function ManutencoesCondominioDetalhes() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const { data: condo, isLoading: loadingCondo } = useQuery({
    queryKey: ["manut-condo-details", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("condominiums")
        .select(
          "id, name, address, address_number, neighborhood, city, state, zip_code, cnpj, phone, created_at"
        )
        .eq("id", id!)
        .maybeSingle();
      if (error) throw error;
      return data as Condo | null;
    },
    enabled: !!id,
  });

  const { data: tasks = [] } = useQuery({
    queryKey: ["manut-condo-tasks", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("maintenance_tasks")
        .select("id, next_due_date, last_completed_at")
        .eq("condominium_id", id!)
        .eq("is_active", true);
      if (error) throw error;
      return data || [];
    },
    enabled: !!id,
  });

  const { data: executions = [] } = useQuery({
    queryKey: ["manut-condo-execs", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("maintenance_executions")
        .select("id, status")
        .eq("condominium_id", id!);
      if (error) throw error;
      return data || [];
    },
    enabled: !!id,
  });

  const { data: responsibles = [], isLoading: loadingResp } = useQuery({
    queryKey: ["manut-condo-responsibles", id],
    queryFn: async () => {
      const { data: uc, error: ucErr } = await supabase
        .from("user_condominiums")
        .select("user_id")
        .eq("condominium_id", id!);
      if (ucErr) throw ucErr;
      const userIds = (uc || []).map((u) => u.user_id);
      if (userIds.length === 0) return [] as ResponsibleUser[];

      const { data: roles } = await supabase
        .from("user_roles")
        .select("user_id, role")
        .in("user_id", userIds)
        .eq("role", "zelador");

      const zeladorIds = (roles || []).map((r: any) => r.user_id);
      if (zeladorIds.length === 0) return [] as ResponsibleUser[];

      const { data: profiles } = await supabase
        .from("profiles")
        .select("user_id, full_name, email, phone")
        .in("user_id", zeladorIds);

      return (profiles || []).map((p: any) => ({
        user_id: p.user_id,
        full_name: p.full_name,
        email: p.email,
        phone: p.phone,
        role: "zelador",
      })) as ResponsibleUser[];
    },
    enabled: !!id,
  });

  const stats = useMemo(() => {
    const today = new Date();
    let pendentes = 0;
    let vencidas = 0;
    tasks.forEach((t: any) => {
      if (!t.next_due_date) {
        pendentes += 1;
        return;
      }
      const diff = differenceInDays(parseISO(t.next_due_date), today);
      if (diff < 0) vencidas += 1;
      else pendentes += 1;
    });
    const concluidas = executions.filter((e: any) => e.status === "concluida").length;
    const chamados = executions.length;
    return { concluidas, pendentes, vencidas, chamados };
  }, [tasks, executions]);

  const fullAddress = useMemo(() => {
    if (!condo) return "—";
    return [condo.address, condo.address_number].filter(Boolean).join(", ") || "—";
  }, [condo]);

  if (loadingCondo) {
    return (
      <DashboardLayout>
        <div className="space-y-4">
          <Skeleton className="h-8 w-64" />
          <Skeleton className="h-32 rounded-xl" />
          <Skeleton className="h-48 rounded-xl" />
        </div>
      </DashboardLayout>
    );
  }

  if (!condo) {
    return (
      <DashboardLayout>
        <Card className="p-8 text-center text-muted-foreground">
          Condomínio não encontrado.
        </Card>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <Helmet>
        <title>NotificaCondo - Detalhes - {condo.name}</title>
      </Helmet>

      <SindicoBreadcrumbs
        items={[
          { label: "Manutenção", href: "/sindico/manutencoes" },
          { label: "Condomínios", href: "/sindico/manutencoes/condominios" },
          { label: condo.name },
        ]}
      />

      <div className="mb-4">
        <h1 className="text-2xl font-bold text-foreground">
          Detalhes de edificação – {condo.name}
        </h1>
        <button
          onClick={() => navigate(-1)}
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mt-1"
        >
          <ArrowLeft className="w-4 h-4" /> Voltar
        </button>
      </div>

      {/* Manutenções */}
      <Card className="p-5 mb-4">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h2 className="font-semibold text-foreground mb-3">Manutenções</h2>
            <div className="flex flex-wrap gap-6">
              <StatItem value={stats.concluidas} label="Concluídas" color="text-emerald-600 dark:text-emerald-400" />
              <StatItem value={stats.pendentes} label="Pendentes" color="text-amber-600 dark:text-amber-400" />
              <StatItem value={stats.vencidas} label="Vencidas" color="text-red-600 dark:text-red-400" />
              <StatItem value={stats.chamados} label="Chamados" color="text-foreground" />
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="default" className="gap-2">
              <Smartphone className="w-4 h-4" /> Tela do Morador
            </Button>
            <Button variant="default" className="gap-2">
              <QrCode className="w-4 h-4" /> QR Code
            </Button>
          </div>
        </div>
      </Card>

      {/* Dados da edificação */}
      <Card className="p-5 mb-4">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-semibold text-foreground">Dados da edificação</h2>
          <div className="flex gap-4 text-sm">
            <button
              onClick={() => navigate(`/condominiums/${condo.id}`)}
              className="inline-flex items-center gap-1 text-muted-foreground hover:text-primary"
            >
              Editar <Edit className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => navigate(`/condominiums/${condo.id}`)}
              className="inline-flex items-center gap-1 text-muted-foreground hover:text-primary"
            >
              Apartamentos <Plus className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-2 text-sm">
          <Field label="Nome" value={condo.name} />
          <Field label="CEP" value={condo.zip_code ? formatCEP(condo.zip_code) : "—"} />
          <Field label="CNPJ" value={condo.cnpj ? formatCNPJ(condo.cnpj) : "—"} />
          <Field
            label="Local"
            value={
              [condo.city, condo.state].filter(Boolean).join(", ") || "—"
            }
          />
          <Field label="Bairro" value={condo.neighborhood || "—"} />
          <Field label="Logradouro" value={fullAddress} />
          <Field
            label="Cadastrado em"
            value={
              condo.created_at
                ? format(parseISO(condo.created_at), "dd/MM/yyyy", { locale: ptBR })
                : "—"
            }
          />
          <Field label="Telefone" value={condo.phone || "—"} />
        </div>
      </Card>

      {/* Usuários responsáveis */}
      <Card className="p-5 mb-4">
        <h2 className="font-semibold text-foreground mb-4">Usuários responsáveis</h2>
        {loadingResp ? (
          <Skeleton className="h-24 w-full" />
        ) : responsibles.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhum responsável cadastrado.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-muted-foreground">
                  <th className="py-2 font-medium">Nome do responsável</th>
                  <th className="py-2 font-medium">E-mail</th>
                  <th className="py-2 font-medium">Telefone</th>
                  <th className="py-2 font-medium">Função</th>
                </tr>
              </thead>
              <tbody>
                {responsibles.map((r) => (
                  <tr key={r.user_id} className="border-b last:border-0">
                    <td className="py-2.5 text-foreground">{r.full_name || "—"}</td>
                    <td className="py-2.5 text-foreground">
                      <span className="inline-flex items-center gap-1">
                        {r.email || "—"}
                        {r.email && <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />}
                      </span>
                    </td>
                    <td className="py-2.5 text-foreground">
                      <span className="inline-flex items-center gap-1">
                        {r.phone || "—"}
                        {r.phone && <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />}
                      </span>
                    </td>
                    <td className="py-2.5">
                      <Badge variant="secondary" className="capitalize">
                        {r.role}
                      </Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* Senhas + Plano */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card className="p-5">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <KeyRound className="w-4 h-4 text-muted-foreground" />
              <h2 className="font-semibold text-foreground">Senhas de acesso</h2>
            </div>
            <button className="text-sm text-muted-foreground hover:text-primary inline-flex items-center gap-1">
              Adicionar <Plus className="w-3.5 h-3.5" />
            </button>
          </div>
          <p className="text-sm text-muted-foreground">
            Nenhuma senha cadastrada.
          </p>
        </Card>

        <Card className="p-5">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <ClipboardList className="w-4 h-4 text-muted-foreground" />
              <h2 className="font-semibold text-foreground">Plano de manutenção</h2>
            </div>
            <div className="flex gap-3 text-sm">
              <button
                onClick={() => navigate(`/sindico/manutencoes/tarefas?condominium=${condo.id}`)}
                className="inline-flex items-center gap-1 text-muted-foreground hover:text-primary"
              >
                Editar <Edit className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => navigate(`/sindico/manutencoes/tarefas?condominium=${condo.id}`)}
                className="inline-flex items-center gap-1 text-muted-foreground hover:text-primary"
              >
                Visualizar <Eye className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
          <div className="text-sm text-muted-foreground flex items-center gap-2">
            {tasks.length === 0 ? (
              <>
                <AlertCircle className="w-4 h-4 text-amber-500" />
                Nenhuma tarefa cadastrada.
              </>
            ) : (
              <>
                <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                {tasks.length} tarefa{tasks.length > 1 ? "s" : ""} ativa
                {tasks.length > 1 ? "s" : ""}
              </>
            )}
          </div>
        </Card>
      </div>
    </DashboardLayout>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <span className="text-muted-foreground">{label}: </span>
      <span className="text-foreground">{value}</span>
    </div>
  );
}

function StatItem({
  value,
  label,
  color,
}: {
  value: number;
  label: string;
  color: string;
}) {
  return (
    <div className="flex flex-col">
      <span className={`text-2xl font-bold leading-none ${color}`}>{value}</span>
      <span className="text-xs text-muted-foreground mt-1">{label}</span>
    </div>
  );
}
