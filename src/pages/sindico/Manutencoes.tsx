import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import DashboardLayout from "@/components/layouts/DashboardLayout";
import SindicoBreadcrumbs from "@/components/sindico/SindicoBreadcrumbs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Printer, Wrench, Activity, ShieldCheck, AlertTriangle, ListChecks } from "lucide-react";
import { format, parseISO, subMonths, startOfMonth, endOfMonth, isWithinInterval, differenceInDays } from "date-fns";
import { ptBR } from "date-fns/locale";
import { PieChart, Pie, Cell, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, Legend, CartesianGrid } from "recharts";

const COLORS = {
  concluida: "#22c55e",
  vencida: "#ef4444",
  pendente: "#f59e0b",
  andamento: "#3b82f6",
};

function formatBRL(n: number) {
  return n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

export default function SindicoManutencoesDashboard() {
  const { user } = useAuth();

  const [condominium, setCondominium] = useState<string>("all");
  const [category, setCategory] = useState<string>("all");
  const [startDate, setStartDate] = useState<string>(format(subMonths(new Date(), 3), "yyyy-MM-dd"));
  const [endDate, setEndDate] = useState<string>(format(new Date(), "yyyy-MM-dd"));

  const { data: condominiums = [] } = useQuery({
    queryKey: ["sindico-dash-condos", user?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("condominiums")
        .select("id, name")
        .eq("owner_id", user!.id)
        .order("name");
      return data || [];
    },
    enabled: !!user?.id,
  });

  const condoIds = condominium === "all" ? condominiums.map((c) => c.id) : [condominium];

  const { data: categories = [] } = useQuery({
    queryKey: ["sindico-dash-categories", condoIds],
    queryFn: async () => {
      const { data } = await supabase
        .from("maintenance_categories")
        .select("id, name, condominium_id")
        .in("condominium_id", condoIds)
        .eq("is_active", true)
        .order("display_order");
      return data || [];
    },
    enabled: condoIds.length > 0,
  });

  const { data: tasks = [], isLoading: loadingTasks } = useQuery({
    queryKey: ["sindico-dash-tasks", condoIds, category, startDate, endDate],
    queryFn: async () => {
      let q = supabase
        .from("maintenance_tasks")
        .select("id, title, next_due_date, last_completed_at, notification_days_before, periodicity, estimated_cost, category_id, condominium_id, maintenance_type, maintenance_categories(name)")
        .in("condominium_id", condoIds)
        .eq("is_active", true);
      if (category !== "all") q = q.eq("category_id", category);
      const { data, error } = await q;
      if (error) throw error;
      return data || [];
    },
    enabled: condoIds.length > 0,
  });

  const { data: executions = [], isLoading: loadingExec } = useQuery({
    queryKey: ["sindico-dash-execs", condoIds, startDate, endDate],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("maintenance_executions")
        .select("id, executed_at, status, cost, executed_by, executed_by_name, maintenance_tasks(title, maintenance_type, category_id)")
        .in("condominium_id", condoIds)
        .gte("executed_at", startDate)
        .lte("executed_at", `${endDate}T23:59:59`);
      if (error) throw error;
      return data || [];
    },
    enabled: condoIds.length > 0,
  });

  const loading = loadingTasks || loadingExec;

  // Filter execs by category if set
  const filteredExecs = useMemo(() => {
    if (category === "all") return executions;
    return executions.filter((e: any) => e.maintenance_tasks?.category_id === category);
  }, [executions, category]);

  // KPIs
  const totalTasks = tasks.length;
  const preventivas = tasks.filter((t: any) => (t.maintenance_type || "preventiva") === "preventiva");
  const corretivas = tasks.filter((t: any) => t.maintenance_type === "corretiva");
  const totalCost = filteredExecs.reduce((s, e: any) => s + (Number(e.cost) || 0), 0);
  const preventivasCost = preventivas.reduce((s, t: any) => s + (Number(t.estimated_cost) || 0), 0);
  const corretivasCost = corretivas.reduce((s, t: any) => s + (Number(t.estimated_cost) || 0), 0);

  const today = new Date();
  const atrasadas = tasks.filter((t: any) => {
    if (t.maintenance_type === "corretiva" && t.last_completed_at) return false;
    return differenceInDays(parseISO(t.next_due_date), today) < 0;
  }).length;

  // Score donuts (concluídas / vencidas / pendentes)
  const computeScore = (type: "preventiva" | "corretiva") => {
    const typed = tasks.filter((t: any) => (t.maintenance_type || "preventiva") === type);
    const completedIds = new Set(
      filteredExecs
        .filter((e: any) => e.status === "concluida" && (e.maintenance_tasks?.maintenance_type || "preventiva") === type)
        .map((e: any) => e.maintenance_tasks?.title)
    );
    const concluidas = filteredExecs.filter((e: any) => e.status === "concluida" && (e.maintenance_tasks?.maintenance_type || "preventiva") === type).length;
    let vencidas = 0;
    let pendentes = 0;
    typed.forEach((t: any) => {
      if (completedIds.has(t.title)) return;
      const diff = differenceInDays(parseISO(t.next_due_date), today);
      if (diff < 0) vencidas++;
      else pendentes++;
    });
    const total = concluidas + vencidas + pendentes;
    const data = [
      { name: "Concluídas", value: concluidas, fill: COLORS.concluida },
      { name: "Vencidas", value: vencidas, fill: COLORS.vencida },
      { name: "Pendentes", value: pendentes, fill: COLORS.pendente },
    ].filter((d) => d.value > 0);
    const dominant = data.sort((a, b) => b.value - a.value)[0];
    const dominantPct = total > 0 && dominant ? Math.round((dominant.value / total) * 100) : 0;
    return { data, total, dominant: dominant?.name || "—", dominantPct };
  };

  const scorePrev = useMemo(() => computeScore("preventiva"), [tasks, filteredExecs]);
  const scoreCorr = useMemo(() => computeScore("corretiva"), [tasks, filteredExecs]);

  // Timeline (last 4 months in range)
  const timelineData = useMemo(() => {
    const months: Array<{ month: string; start: Date; end: Date }> = [];
    const monthsCount = 4;
    for (let i = monthsCount - 1; i >= 0; i--) {
      const d = subMonths(parseISO(endDate), i);
      months.push({ month: format(d, "MMM/yyyy", { locale: ptBR }), start: startOfMonth(d), end: endOfMonth(d) });
    }
    return months.map(({ month, start, end }) => {
      const monthExecs = filteredExecs.filter((e: any) => isWithinInterval(parseISO(e.executed_at), { start, end }) && e.status === "concluida");
      const completedTitles = new Set(monthExecs.map((e: any) => e.maintenance_tasks?.title));
      const monthTasks = tasks.filter((t: any) => isWithinInterval(parseISO(t.next_due_date), { start, end }));
      const concluidas = monthExecs.length;
      const vencidas = monthTasks.filter((t: any) => !completedTitles.has(t.title) && parseISO(t.next_due_date) < today).length;
      const pendentes = monthTasks.filter((t: any) => !completedTitles.has(t.title) && parseISO(t.next_due_date) >= today).length;
      return { month, Concluídas: concluidas, Vencidas: vencidas, Pendentes: pendentes };
    });
  }, [tasks, filteredExecs, endDate]);

  // Category lists
  const buildCategoryList = (type: "preventiva" | "corretiva") => {
    const map = new Map<string, number>();
    tasks.filter((t: any) => (t.maintenance_type || "preventiva") === type).forEach((t: any) => {
      const name = t.maintenance_categories?.name || "Sem categoria";
      map.set(name, (map.get(name) || 0) + 1);
    });
    return Array.from(map.entries()).map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count);
  };
  const catsPrev = useMemo(() => buildCategoryList("preventiva"), [tasks]);
  const catsCorr = useMemo(() => buildCategoryList("corretiva"), [tasks]);

  // Activities per user (based on executions)
  const userActivity = useMemo(() => {
    const map = new Map<string, number>();
    filteredExecs.forEach((e: any) => {
      const name = e.executed_by_name || "—";
      map.set(name, (map.get(name) || 0) + 1);
    });
    return Array.from(map.entries()).map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count);
  }, [filteredExecs]);

  const clearFilters = () => {
    setCondominium("all");
    setCategory("all");
    setStartDate(format(subMonths(new Date(), 3), "yyyy-MM-dd"));
    setEndDate(format(new Date(), "yyyy-MM-dd"));
  };

  return (
    <DashboardLayout>
      <div className="flex-1 space-y-4 p-4 md:p-6 lg:p-8 pt-6 print:p-0">
        <div className="print:hidden">
          <SindicoBreadcrumbs items={[{ label: "Manutenção", href: "/sindico/manutencoes" }, { label: "Dashboard" }]} />
        </div>

        <div className="flex items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold tracking-tight flex items-center gap-2">
              <Wrench className="w-6 h-6 text-primary" />
              Dashboard de Manutenções
            </h1>
            <p className="text-muted-foreground text-sm">Visão geral das tarefas, custos e execuções</p>
          </div>
          <Button variant="outline" onClick={() => window.print()} className="print:hidden">
            <Printer className="w-4 h-4 mr-2" /> Imprimir
          </Button>
        </div>

        {/* Filters */}
        <Card className="print:hidden">
          <CardContent className="pt-6">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div>
                <Label className="mb-1.5 block text-xs text-muted-foreground">Edificação</Label>
                <Select value={condominium} onValueChange={setCondominium}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todas</SelectItem>
                    {condominiums.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="mb-1.5 block text-xs text-muted-foreground">Categoria</Label>
                <Select value={category} onValueChange={setCategory}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todas</SelectItem>
                    {categories.map((c: any) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="mb-1.5 block text-xs text-muted-foreground">Data inicial</Label>
                <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
              </div>
              <div>
                <Label className="mb-1.5 block text-xs text-muted-foreground">Data final</Label>
                <Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
              </div>
            </div>
            <div className="flex justify-end mt-4">
              <Button variant="ghost" onClick={clearFilters}>Limpar filtros</Button>
            </div>
          </CardContent>
        </Card>

        {/* KPIs */}
        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {[1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-28 w-full" />)}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Total de manutenções</CardTitle>
                <ListChecks className="w-5 h-5 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold">{totalTasks}</div>
                <p className="text-xs text-muted-foreground mt-1">Investido nas execuções: {formatBRL(totalCost)}</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Preventivas</CardTitle>
                <ShieldCheck className="w-5 h-5 text-emerald-600" />
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold">{preventivas.length}</div>
                <p className="text-xs text-muted-foreground mt-1">Custo estimado: {formatBRL(preventivasCost)}</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Corretivas</CardTitle>
                <Activity className="w-5 h-5 text-amber-600" />
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold">{corretivas.length}</div>
                <p className="text-xs text-muted-foreground mt-1">Custo estimado: {formatBRL(corretivasCost)}</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Atrasadas</CardTitle>
                <AlertTriangle className="w-5 h-5 text-destructive" />
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold text-destructive">{atrasadas}</div>
                <p className="text-xs text-muted-foreground mt-1">Tarefas com vencimento expirado</p>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Charts */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <Card className="lg:col-span-1">
            <CardHeader>
              <CardTitle className="text-base">Linha do tempo de manutenções</CardTitle>
            </CardHeader>
            <CardContent>
              {loading ? (
                <Skeleton className="h-64 w-full" />
              ) : (
                <ResponsiveContainer width="100%" height={320}>
                  <BarChart data={timelineData} layout="vertical" margin={{ left: 10, right: 20 }}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-border" horizontal={false} />
                    <XAxis type="number" allowDecimals={false} tick={{ fontSize: 11 }} className="fill-muted-foreground" />
                    <YAxis dataKey="month" type="category" width={70} tick={{ fontSize: 11 }} className="fill-muted-foreground" />
                    <Tooltip contentStyle={{ backgroundColor: "hsl(var(--popover))", border: "1px solid hsl(var(--border))", borderRadius: "8px" }} />
                    <Legend wrapperStyle={{ fontSize: 12 }} />
                    <Bar dataKey="Concluídas" fill={COLORS.concluida} radius={[0, 4, 4, 0]} />
                    <Bar dataKey="Vencidas" fill={COLORS.vencida} radius={[0, 4, 4, 0]} />
                    <Bar dataKey="Pendentes" fill={COLORS.pendente} radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>

          {[
            { title: "Score de manutenções preventivas", score: scorePrev },
            { title: "Score de manutenções corretivas", score: scoreCorr },
          ].map(({ title, score }) => (
            <Card key={title}>
              <CardHeader>
                <CardTitle className="text-base">{title}</CardTitle>
              </CardHeader>
              <CardContent>
                {loading ? (
                  <Skeleton className="h-64 w-full" />
                ) : score.total === 0 ? (
                  <div className="flex items-center justify-center h-64 text-sm text-muted-foreground">Sem dados no período</div>
                ) : (
                  <div className="relative">
                    <ResponsiveContainer width="100%" height={240}>
                      <PieChart>
                        <Pie data={score.data} cx="50%" cy="50%" innerRadius={60} outerRadius={95} paddingAngle={2} dataKey="value" strokeWidth={0}>
                          {score.data.map((entry, i) => <Cell key={i} fill={entry.fill} />)}
                        </Pie>
                        <Tooltip contentStyle={{ backgroundColor: "hsl(var(--popover))", border: "1px solid hsl(var(--border))", borderRadius: "8px" }} />
                      </PieChart>
                    </ResponsiveContainer>
                    <div className="absolute inset-0 flex items-center justify-center pointer-events-none" style={{ marginBottom: 20 }}>
                      <div className="text-center">
                        <div className="text-xl font-bold">{score.dominant}</div>
                        <div className="text-sm text-muted-foreground">{score.dominantPct}%</div>
                      </div>
                    </div>
                    <div className="flex flex-wrap justify-center gap-3 mt-2">
                      {score.data.map((entry, i) => (
                        <div key={i} className="flex items-center gap-1.5 text-xs">
                          <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: entry.fill }} />
                          <span className="text-muted-foreground">{entry.name} ({entry.value})</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Bottom lists */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <Card>
            <CardHeader><CardTitle className="text-base">Manutenções preventivas <span className="text-muted-foreground font-normal text-sm">(Categorias)</span></CardTitle></CardHeader>
            <CardContent>
              {catsPrev.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-6">Sem categorias</p>
              ) : (
                <div className="space-y-2">
                  {catsPrev.map((c) => (
                    <div key={c.name} className="flex items-center justify-between py-2 px-3 bg-muted/50 rounded-lg">
                      <span className="text-sm font-medium">{c.name}</span>
                      <Badge variant="secondary">{c.count}</Badge>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle className="text-base">Manutenções corretivas <span className="text-muted-foreground font-normal text-sm">(Categorias)</span></CardTitle></CardHeader>
            <CardContent>
              {catsCorr.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-6">Sem categorias</p>
              ) : (
                <div className="space-y-2">
                  {catsCorr.map((c) => (
                    <div key={c.name} className="flex items-center justify-between py-2 px-3 bg-muted/50 rounded-lg">
                      <span className="text-sm font-medium">{c.name}</span>
                      <Badge variant="secondary">{c.count}</Badge>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Atividades por usuário <span className="text-muted-foreground font-normal text-sm">Total: {filteredExecs.length}</span></CardTitle>
            </CardHeader>
            <CardContent>
              {userActivity.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-6">Sem execuções no período</p>
              ) : (
                <div className="space-y-2">
                  {userActivity.map((u) => (
                    <div key={u.name} className="flex items-center justify-between py-2 px-3 bg-muted/50 rounded-lg">
                      <span className="text-sm font-medium">{u.name}</span>
                      <Badge variant="secondary">{u.count}</Badge>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </DashboardLayout>
  );
}
