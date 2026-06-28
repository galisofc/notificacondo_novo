import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { Helmet } from "react-helmet-async";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import DashboardLayout from "@/components/layouts/DashboardLayout";
import SindicoBreadcrumbs from "@/components/sindico/SindicoBreadcrumbs";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ChevronRight, Search, Building2 } from "lucide-react";
import { differenceInDays, parseISO } from "date-fns";

interface CondoRow {
  id: string;
  name: string;
  city: string | null;
  neighborhood: string | null;
}

export default function ManutencoesCondominios() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [search, setSearch] = useState("");
  const [orderBy, setOrderBy] = useState<"name" | "vencidas" | "pendentes" | "concluidas">("name");

  const { data: condominiums = [], isLoading: loadingCondos } = useQuery({
    queryKey: ["manut-condos", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("condominiums")
        .select("id, name, city, neighborhood")
        .eq("owner_id", user!.id)
        .order("name");
      if (error) throw error;
      return (data || []) as CondoRow[];
    },
    enabled: !!user?.id,
  });

  const condoIds = useMemo(() => condominiums.map((c) => c.id), [condominiums]);

  const { data: tasks = [], isLoading: loadingTasks } = useQuery({
    queryKey: ["manut-condos-tasks", condoIds],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("maintenance_tasks")
        .select("id, condominium_id, next_due_date, last_completed_at, maintenance_type")
        .in("condominium_id", condoIds)
        .eq("is_active", true);
      if (error) throw error;
      return data || [];
    },
    enabled: condoIds.length > 0,
  });

  const { data: executions = [], isLoading: loadingExec } = useQuery({
    queryKey: ["manut-condos-execs", condoIds],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("maintenance_executions")
        .select("id, condominium_id, status")
        .in("condominium_id", condoIds);
      if (error) throw error;
      return data || [];
    },
    enabled: condoIds.length > 0,
  });

  const loading = loadingCondos || loadingTasks || loadingExec;

  const stats = useMemo(() => {
    const today = new Date();
    const map = new Map<string, { concluidas: number; pendentes: number; vencidas: number; total: number }>();
    condominiums.forEach((c) => map.set(c.id, { concluidas: 0, pendentes: 0, vencidas: 0, total: 0 }));

    tasks.forEach((t: any) => {
      const s = map.get(t.condominium_id);
      if (!s) return;
      s.total += 1;
      if (!t.next_due_date) {
        s.pendentes += 1;
        return;
      }
      const diff = differenceInDays(parseISO(t.next_due_date), today);
      if (diff < 0) s.vencidas += 1;
      else s.pendentes += 1;
    });

    executions.forEach((e: any) => {
      const s = map.get(e.condominium_id);
      if (!s) return;
      if (e.status === "concluida") s.concluidas += 1;
    });

    return map;
  }, [condominiums, tasks, executions]);

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    const list = condominiums.filter((c) => {
      if (!term) return true;
      return (
        c.name.toLowerCase().includes(term) ||
        (c.city || "").toLowerCase().includes(term) ||
        (c.neighborhood || "").toLowerCase().includes(term)
      );
    });
    const get = (id: string) => stats.get(id) || { concluidas: 0, pendentes: 0, vencidas: 0, total: 0 };
    return [...list].sort((a, b) => {
      if (orderBy === "name") return a.name.localeCompare(b.name, "pt-BR");
      return get(b.id)[orderBy] - get(a.id)[orderBy];
    });
  }, [condominiums, search, orderBy, stats]);

  return (
    <DashboardLayout>
      <Helmet>
        <title>NotificaCondo - Condomínios (Manutenção)</title>
      </Helmet>
      <SindicoBreadcrumbs
        items={[
          { label: "Manutenção", href: "/sindico/manutencoes" },
          { label: "Condomínios" },
        ]}
      />

      <div className="flex flex-col gap-4 mb-6 md:flex-row md:items-center md:justify-between">
        <div className="flex items-center gap-3">
          <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-primary/10 text-primary">
            <Building2 className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-foreground">Condomínios</h1>
            <p className="text-sm text-muted-foreground">Visão geral de manutenções por condomínio</p>
          </div>
        </div>

        <div className="flex gap-2 w-full md:w-auto">
          <Select value={orderBy} onValueChange={(v) => setOrderBy(v as typeof orderBy)}>
            <SelectTrigger className="w-full md:w-48">
              <SelectValue placeholder="Ordenar por" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="name">Nome (A-Z)</SelectItem>
              <SelectItem value="vencidas">Mais vencidas</SelectItem>
              <SelectItem value="pendentes">Mais pendentes</SelectItem>
              <SelectItem value="concluidas">Mais concluídas</SelectItem>
            </SelectContent>
          </Select>
          <div className="relative flex-1 md:w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Procurar"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
        </div>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-32 rounded-xl" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <Card className="p-12 text-center text-muted-foreground">
          Nenhum condomínio encontrado.
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {filtered.map((c) => {
            const s = stats.get(c.id) || { concluidas: 0, pendentes: 0, vencidas: 0, total: 0 };
            const local = [c.neighborhood, c.city].filter(Boolean).join(", ") || "—";
            return (
              <Card
                key={c.id}
                role="button"
                tabIndex={0}
                onClick={() => navigate(`/sindico/manutencoes/condominios/${c.id}`)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    navigate(`/sindico/manutencoes/condominios/${c.id}`);
                  }
                }}
                className="p-4 cursor-pointer hover:shadow-md transition-all hover:-translate-y-0.5 group"
              >
                <div className="flex items-start justify-between gap-2 mb-1">
                  <h3 className="font-semibold text-foreground line-clamp-1">{c.name}</h3>
                  <ChevronRight className="w-4 h-4 text-muted-foreground group-hover:text-primary transition-colors flex-shrink-0" />
                </div>
                <p className="text-xs text-muted-foreground mb-4 line-clamp-1">{local}</p>
                <div className="grid grid-cols-4 gap-2 text-center">
                  <Stat value={s.concluidas} label="Concluídas" color="text-emerald-600 dark:text-emerald-400" />
                  <Stat value={s.pendentes} label="Pendentes" color="text-amber-600 dark:text-amber-400" />
                  <Stat value={s.vencidas} label="Vencidas" color="text-red-600 dark:text-red-400" />
                  <Stat value={s.total} label="Total" color="text-foreground" />
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </DashboardLayout>
  );
}

function Stat({ value, label, color }: { value: number; label: string; color: string }) {
  return (
    <div className="flex flex-col">
      <span className={`text-lg font-bold leading-none ${color}`}>{value}</span>
      <span className="text-[10px] text-muted-foreground mt-1 leading-tight">{label}</span>
    </div>
  );
}
