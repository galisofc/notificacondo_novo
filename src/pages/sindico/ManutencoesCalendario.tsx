import { useMemo, useState } from "react";
import { Helmet } from "react-helmet-async";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import DashboardLayout from "@/components/layouts/DashboardLayout";
import SindicoBreadcrumbs from "@/components/sindico/SindicoBreadcrumbs";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Filter } from "lucide-react";
import {
  addMonths,
  addWeeks,
  addYears,
  endOfMonth,
  endOfWeek,
  endOfYear,
  format,
  isSameDay,
  isSameMonth,
  parseISO,
  startOfMonth,
  startOfWeek,
  startOfYear,
  eachDayOfInterval,
  eachMonthOfInterval,
} from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";

type ViewMode = "month" | "week" | "year";

type TaskItem = {
  id: string;
  title: string;
  next_due_date: string;
  last_completed_at: string | null;
  condominium_id: string;
  category_id: string | null;
  maintenance_type: string | null;
};

type ExecItem = {
  id: string;
  executed_at: string;
  status: string;
  condominium_id: string;
  maintenance_tasks: { title: string; category_id: string | null } | null;
};

type DayEvents = {
  pendentes: number;
  concluidas: number;
  vencidas: number;
};

export default function ManutencoesCalendario() {
  const { user } = useAuth();
  const [view, setView] = useState<ViewMode>("month");
  const [cursor, setCursor] = useState<Date>(new Date());
  const [condominium, setCondominium] = useState<string>("all");
  const [category, setCategory] = useState<string>("all");

  const { data: condominiums = [] } = useQuery({
    queryKey: ["cal-condos", user?.id],
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
    queryKey: ["cal-cats", condoIds],
    queryFn: async () => {
      const { data } = await supabase
        .from("maintenance_categories")
        .select("id, name")
        .in("condominium_id", condoIds)
        .eq("is_active", true)
        .order("display_order");
      return data || [];
    },
    enabled: condoIds.length > 0,
  });

  const { data: tasks = [] } = useQuery({
    queryKey: ["cal-tasks", condoIds, category],
    queryFn: async () => {
      let q = supabase
        .from("maintenance_tasks")
        .select("id, title, next_due_date, last_completed_at, condominium_id, category_id, maintenance_type")
        .in("condominium_id", condoIds)
        .eq("is_active", true);
      if (category !== "all") q = q.eq("category_id", category);
      const { data, error } = await q;
      if (error) throw error;
      return (data || []) as TaskItem[];
    },
    enabled: condoIds.length > 0,
  });

  const { data: executions = [] } = useQuery({
    queryKey: ["cal-execs", condoIds],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("maintenance_executions")
        .select("id, executed_at, status, condominium_id, maintenance_tasks(title, category_id)")
        .in("condominium_id", condoIds);
      if (error) throw error;
      return (data || []) as unknown as ExecItem[];
    },
    enabled: condoIds.length > 0,
  });

  const filteredExecs = useMemo(
    () =>
      category === "all"
        ? executions
        : executions.filter((e) => e.maintenance_tasks?.category_id === category),
    [executions, category],
  );

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const eventsByDay = useMemo(() => {
    const map = new Map<string, DayEvents>();
    const get = (k: string) => {
      if (!map.has(k)) map.set(k, { pendentes: 0, concluidas: 0, vencidas: 0 });
      return map.get(k)!;
    };
    tasks.forEach((t) => {
      if (!t.next_due_date) return;
      const d = parseISO(t.next_due_date);
      const k = format(d, "yyyy-MM-dd");
      const bucket = get(k);
      if (d < today) bucket.vencidas++;
      else bucket.pendentes++;
    });
    filteredExecs.forEach((e) => {
      if (!e.executed_at || e.status !== "concluida") return;
      const k = format(parseISO(e.executed_at), "yyyy-MM-dd");
      get(k).concluidas++;
    });
    return map;
  }, [tasks, filteredExecs, today]);

  const goPrev = () => {
    if (view === "month") setCursor(addMonths(cursor, -1));
    else if (view === "week") setCursor(addWeeks(cursor, -1));
    else setCursor(addYears(cursor, -1));
  };
  const goNext = () => {
    if (view === "month") setCursor(addMonths(cursor, 1));
    else if (view === "week") setCursor(addWeeks(cursor, 1));
    else setCursor(addYears(cursor, 1));
  };

  const headerLabel =
    view === "year"
      ? format(cursor, "yyyy", { locale: ptBR })
      : view === "week"
        ? `${format(startOfWeek(cursor, { weekStartsOn: 0 }), "dd/MM", { locale: ptBR })} – ${format(endOfWeek(cursor, { weekStartsOn: 0 }), "dd/MM/yyyy", { locale: ptBR })}`
        : format(cursor, "MMMM 'de' yyyy", { locale: ptBR });

  return (
    <DashboardLayout>
      <Helmet>
        <title>NotificaCondo - Calendário de Manutenções</title>
      </Helmet>
      <div className="p-4 sm:p-6 space-y-4">
        <SindicoBreadcrumbs items={[{ label: "Manutenções", href: "/sindico/manutencoes" }, { label: "Calendário" }]} />

        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-foreground">Calendário</h1>
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="ghost" size="sm" className="gap-2 text-muted-foreground">
                  Filtros <Filter className="h-4 w-4" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-80 space-y-3">
                <div className="space-y-1">
                  <Label>Edificação</Label>
                  <Select value={condominium} onValueChange={setCondominium}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todas</SelectItem>
                      {condominiums.map((c) => (
                        <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label>Categoria</Label>
                  <Select value={category} onValueChange={setCategory}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todas</SelectItem>
                      {categories.map((c) => (
                        <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </PopoverContent>
            </Popover>
          </div>
        </div>

        <Card className="p-4 space-y-4">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={goPrev}>Anterior</Button>
              <Button variant="outline" size="sm" onClick={goNext}>Próximo</Button>
              <Button variant="outline" size="sm" onClick={() => setCursor(new Date())}>Hoje</Button>
            </div>
            <div className="font-semibold capitalize text-foreground">{headerLabel}</div>
            <div className="inline-flex rounded-md border border-border overflow-hidden">
              {(["month", "week", "year"] as ViewMode[]).map((v) => (
                <button
                  key={v}
                  onClick={() => setView(v)}
                  className={cn(
                    "px-4 py-1.5 text-sm transition-colors",
                    view === v ? "bg-primary text-primary-foreground" : "bg-background text-foreground hover:bg-muted",
                  )}
                >
                  {v === "month" ? "Mês" : v === "week" ? "Semana" : "Ano"}
                </button>
              ))}
            </div>
          </div>

          {view === "month" && <MonthGrid cursor={cursor} eventsByDay={eventsByDay} />}
          {view === "week" && <WeekGrid cursor={cursor} eventsByDay={eventsByDay} />}
          {view === "year" && <YearGrid cursor={cursor} eventsByDay={eventsByDay} />}
        </Card>
      </div>
    </DashboardLayout>
  );
}

function DayCellContent({ events }: { events?: DayEvents }) {
  if (!events) return null;
  const items: Array<{ label: string; color: string }> = [];
  if (events.vencidas > 0) items.push({ label: `${events.vencidas} vencida${events.vencidas > 1 ? "s" : ""}`, color: "bg-red-500" });
  if (events.pendentes > 0) items.push({ label: `${events.pendentes} a fazer`, color: "bg-amber-500" });
  if (events.concluidas > 0) items.push({ label: `${events.concluidas} concluída${events.concluidas > 1 ? "s" : ""}`, color: "bg-emerald-500" });
  return (
    <div className="mt-1 space-y-1">
      {items.map((it, i) => (
        <div key={i} className="flex items-center gap-1.5 text-[11px] bg-muted/50 rounded-sm pr-1 overflow-hidden">
          <span className={cn("w-1 h-3.5 shrink-0", it.color)} />
          <span className="truncate">{it.label}</span>
        </div>
      ))}
    </div>
  );
}

function MonthGrid({ cursor, eventsByDay }: { cursor: Date; eventsByDay: Map<string, DayEvents> }) {
  const start = startOfWeek(startOfMonth(cursor), { weekStartsOn: 0 });
  const end = endOfWeek(endOfMonth(cursor), { weekStartsOn: 0 });
  const days = eachDayOfInterval({ start, end });
  const weekDays = ["dom.", "seg.", "ter.", "qua.", "qui.", "sex.", "sáb."];
  const today = new Date();

  return (
    <div className="border border-border rounded-md overflow-hidden">
      <div className="grid grid-cols-7 bg-muted/30">
        {weekDays.map((d) => (
          <div key={d} className="px-3 py-2 text-xs text-muted-foreground text-center border-r border-border last:border-r-0">{d}</div>
        ))}
      </div>
      <div className="grid grid-cols-7 auto-rows-[110px]">
        {days.map((day) => {
          const key = format(day, "yyyy-MM-dd");
          const inMonth = isSameMonth(day, cursor);
          const isToday = isSameDay(day, today);
          return (
            <div
              key={key}
              className={cn(
                "border-r border-b border-border p-1.5 overflow-hidden",
                !inMonth && "bg-muted/20 text-muted-foreground",
              )}
            >
              <div className={cn("text-xs text-right", isToday && "font-bold text-primary")}>{format(day, "d")}</div>
              <DayCellContent events={eventsByDay.get(key)} />
            </div>
          );
        })}
      </div>
    </div>
  );
}

function WeekGrid({ cursor, eventsByDay }: { cursor: Date; eventsByDay: Map<string, DayEvents> }) {
  const start = startOfWeek(cursor, { weekStartsOn: 0 });
  const end = endOfWeek(cursor, { weekStartsOn: 0 });
  const days = eachDayOfInterval({ start, end });
  const today = new Date();
  return (
    <div className="grid grid-cols-7 border border-border rounded-md overflow-hidden">
      {days.map((day) => {
        const key = format(day, "yyyy-MM-dd");
        const isToday = isSameDay(day, today);
        return (
          <div key={key} className="border-r border-border last:border-r-0 min-h-[280px] p-2">
            <div className="text-xs text-muted-foreground">{format(day, "EEE", { locale: ptBR })}</div>
            <div className={cn("text-lg font-semibold", isToday && "text-primary")}>{format(day, "d")}</div>
            <DayCellContent events={eventsByDay.get(key)} />
          </div>
        );
      })}
    </div>
  );
}

function YearGrid({ cursor, eventsByDay }: { cursor: Date; eventsByDay: Map<string, DayEvents> }) {
  const months = eachMonthOfInterval({ start: startOfYear(cursor), end: endOfYear(cursor) });
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
      {months.map((m) => {
        const totals: DayEvents = { pendentes: 0, concluidas: 0, vencidas: 0 };
        eachDayOfInterval({ start: startOfMonth(m), end: endOfMonth(m) }).forEach((d) => {
          const ev = eventsByDay.get(format(d, "yyyy-MM-dd"));
          if (!ev) return;
          totals.pendentes += ev.pendentes;
          totals.concluidas += ev.concluidas;
          totals.vencidas += ev.vencidas;
        });
        return (
          <Card key={m.toISOString()} className="p-3">
            <div className="text-sm font-semibold capitalize text-foreground mb-2">
              {format(m, "MMMM", { locale: ptBR })}
            </div>
            <DayCellContent events={totals} />
          </Card>
        );
      })}
    </div>
  );
}
