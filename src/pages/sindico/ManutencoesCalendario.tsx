import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
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
  periodicity: string | null;
  periodicity_days: number | null;
  condominiums?: { name: string } | null;
};

type ExecItem = {
  id: string;
  task_id: string | null;
  executed_at: string;
  status: string;
  condominium_id: string;
  maintenance_tasks: { title: string; category_id: string | null } | null;
};

type CalendarEvent = {
  key: string;
  taskId: string | null;
  kind: "pendente" | "vencida" | "concluida";
  title: string;
  condoName: string;
  ref: string;
  type: "preventiva" | "corretiva";
  periodicityLabel: string;
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
        .select("id, title, next_due_date, last_completed_at, condominium_id, category_id, maintenance_type, periodicity, periodicity_days, condominiums(name)")
        .in("condominium_id", condoIds)
        .eq("is_active", true);
      if (category !== "all") q = q.eq("category_id", category);
      const { data, error } = await q;
      if (error) throw error;
      return (data || []) as unknown as TaskItem[];
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
    const map = new Map<string, CalendarEvent[]>();
    const push = (k: string, ev: CalendarEvent) => {
      if (!map.has(k)) map.set(k, []);
      map.get(k)!.push(ev);
    };
    const periodicityLabel = (t: TaskItem) => {
      const p = t.periodicity || "";
      const map: Record<string, string> = {
        diaria: "Diária", semanal: "A cada 1 semana", quinzenal: "A cada 15 dias",
        mensal: "A cada 1 mês", bimestral: "A cada 2 meses", trimestral: "A cada 3 meses",
        semestral: "A cada 6 meses", anual: "Anual",
      };
      if (map[p]) return map[p];
      if (t.periodicity_days) return `A cada ${t.periodicity_days} dias`;
      return p || "—";
    };
    tasks.forEach((t) => {
      if (!t.next_due_date) return;
      const d = parseISO(t.next_due_date);
      const k = format(d, "yyyy-MM-dd");
      push(k, {
        key: t.id,
        taskId: t.id,
        kind: d < today ? "vencida" : "pendente",
        title: t.title,
        condoName: t.condominiums?.name || "—",
        ref: `#${t.id.slice(0, 4).toUpperCase()}`,
        type: (t.maintenance_type === "corretiva" ? "corretiva" : "preventiva"),
        periodicityLabel: periodicityLabel(t),
      });
    });
    filteredExecs.forEach((e) => {
      if (!e.executed_at || e.status !== "concluida") return;
      const k = format(parseISO(e.executed_at), "yyyy-MM-dd");
      push(k, {
        key: e.id,
        taskId: e.task_id,
        kind: "concluida",
        title: e.maintenance_tasks?.title || "Concluída",
        condoName: "—",
        ref: `#${e.id.slice(0, 4).toUpperCase()}`,
        type: "preventiva",
        periodicityLabel: "",
      });
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

const KIND_BAR: Record<CalendarEvent["kind"], string> = {
  pendente: "bg-amber-500",
  vencida: "bg-red-500",
  concluida: "bg-emerald-500",
};
const KIND_BADGE: Record<CalendarEvent["kind"], string> = {
  pendente: "bg-amber-500 text-white",
  vencida: "bg-red-500 text-white",
  concluida: "bg-emerald-500 text-white",
};
const KIND_LABEL: Record<CalendarEvent["kind"], string> = {
  pendente: "Pendente",
  vencida: "Vencida",
  concluida: "Concluída",
};

function EventCard({ ev, compact = false }: { ev: CalendarEvent; compact?: boolean }) {
  return (
    <div className="flex bg-muted/40 rounded-sm overflow-hidden">
      <span className={cn("w-1 shrink-0", KIND_BAR[ev.kind])} />
      <div className="flex-1 min-w-0 px-1.5 py-1">
        <div className="flex items-center justify-between gap-1">
          <span className="text-[11px] font-semibold truncate text-foreground">{ev.condoName}</span>
          <span className="text-[10px] text-muted-foreground">{ev.ref}</span>
        </div>
        {!compact && (
          <div className="flex flex-wrap gap-1 my-0.5">
            <span className={cn("text-[9px] px-1 rounded", KIND_BADGE[ev.kind])}>{KIND_LABEL[ev.kind]}</span>
            <span className="text-[9px] px-1 rounded bg-blue-500 text-white capitalize">{ev.type}</span>
          </div>
        )}
        <div className="text-[11px] leading-tight text-foreground line-clamp-2">{ev.title}</div>
        {!compact && ev.periodicityLabel && (
          <div className="text-[10px] text-muted-foreground mt-0.5">{ev.periodicityLabel}</div>
        )}
      </div>
    </div>
  );
}

function MonthGrid({ cursor, eventsByDay }: { cursor: Date; eventsByDay: Map<string, CalendarEvent[]> }) {
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
      <div className="grid grid-cols-7 auto-rows-[130px]">
        {days.map((day) => {
          const key = format(day, "yyyy-MM-dd");
          const inMonth = isSameMonth(day, cursor);
          const isToday = isSameDay(day, today);
          const evs = eventsByDay.get(key) || [];
          const shown = evs.slice(0, 2);
          const extra = evs.length - shown.length;
          return (
            <div
              key={key}
              className={cn(
                "border-r border-b border-border p-1 overflow-hidden flex flex-col gap-1",
                !inMonth && "bg-muted/20 text-muted-foreground",
              )}
            >
              <div className={cn("text-xs text-right px-1", isToday && "font-bold text-primary")}>{format(day, "d")}</div>
              <div className="flex flex-col gap-0.5 overflow-hidden">
                {shown.map((ev) => <EventCard key={ev.key} ev={ev} compact />)}
                {extra > 0 && <div className="text-[10px] text-muted-foreground px-1">+{extra} mais</div>}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function WeekGrid({ cursor, eventsByDay }: { cursor: Date; eventsByDay: Map<string, CalendarEvent[]> }) {
  const start = startOfWeek(cursor, { weekStartsOn: 0 });
  const end = endOfWeek(cursor, { weekStartsOn: 0 });
  const days = eachDayOfInterval({ start, end });
  const today = new Date();
  return (
    <div className="grid grid-cols-7 border border-border rounded-md overflow-hidden">
      {days.map((day) => {
        const key = format(day, "yyyy-MM-dd");
        const isToday = isSameDay(day, today);
        const evs = eventsByDay.get(key) || [];
        return (
          <div key={key} className="border-r border-border last:border-r-0 min-h-[500px] p-2 bg-card">
            <div className="text-center pb-2 border-b border-border mb-2">
              <div className={cn("text-sm font-medium capitalize", isToday && "text-primary")}>
                {format(day, "EEE dd/MM", { locale: ptBR })}
              </div>
            </div>
            <div className="flex flex-col gap-2">
              {evs.map((ev) => <EventCard key={ev.key} ev={ev} />)}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function YearGrid({ cursor, eventsByDay }: { cursor: Date; eventsByDay: Map<string, CalendarEvent[]> }) {
  const months = eachMonthOfInterval({ start: startOfYear(cursor), end: endOfYear(cursor) });
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
      {months.map((m) => {
        let pendentes = 0, vencidas = 0, concluidas = 0;
        eachDayOfInterval({ start: startOfMonth(m), end: endOfMonth(m) }).forEach((d) => {
          const evs = eventsByDay.get(format(d, "yyyy-MM-dd")) || [];
          evs.forEach((e) => {
            if (e.kind === "pendente") pendentes++;
            else if (e.kind === "vencida") vencidas++;
            else concluidas++;
          });
        });
        return (
          <Card key={m.toISOString()} className="p-3">
            <div className="text-sm font-semibold capitalize text-foreground mb-2">
              {format(m, "MMMM", { locale: ptBR })}
            </div>
            <div className="space-y-1 text-xs">
              {vencidas > 0 && <div className="flex items-center gap-2"><span className="w-2 h-2 rounded-full bg-red-500" />{vencidas} vencida{vencidas > 1 ? "s" : ""}</div>}
              {pendentes > 0 && <div className="flex items-center gap-2"><span className="w-2 h-2 rounded-full bg-amber-500" />{pendentes} a fazer</div>}
              {concluidas > 0 && <div className="flex items-center gap-2"><span className="w-2 h-2 rounded-full bg-emerald-500" />{concluidas} concluída{concluidas > 1 ? "s" : ""}</div>}
              {vencidas + pendentes + concluidas === 0 && <div className="text-muted-foreground">Sem eventos</div>}
            </div>
          </Card>
        );
      })}
    </div>
  );
}

