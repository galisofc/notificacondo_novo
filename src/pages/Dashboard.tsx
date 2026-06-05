import { useEffect, useState } from "react";
import { Helmet } from "react-helmet-async";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Building2,
  FileText,
  DollarSign,
  Users,
  Plus,
  ChevronRight,
  ArrowUpRight,
  AlertTriangle,
  Shield,
  Calendar,
  Package,
  PackageCheck,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import DashboardLayout from "@/components/layouts/DashboardLayout";
import SindicoBreadcrumbs from "@/components/sindico/SindicoBreadcrumbs";
import TrialBanner from "@/components/sindico/TrialBanner";
import { Skeleton } from "@/components/ui/skeleton";
import { subDays, subMonths, subYears, startOfDay } from "date-fns";
import { SindicoOnboardingModal } from "@/components/onboarding/SindicoOnboardingModal";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type PeriodFilter = "today" | "7d" | "1m" | "1y";

interface DashboardStats {
  condominiums: number;
  residents: number;
  occurrences: number;
  pendingFines: number;
  pendingDefenses: number;
  packagesRegistered: number;
  packagesPending: number;
  packagesPickedUp: number;
}

interface ProfileData {
  full_name: string;
  onboarding_completed: boolean | null;
}

interface Condominium {
  id: string;
  name: string;
}

const Dashboard = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [periodFilter, setPeriodFilter] = useState<PeriodFilter>("today");
  const [selectedCondominium, setSelectedCondominium] = useState<string>("all");
  const [condominiums, setCondominiums] = useState<Condominium[]>([]);
  const [stats, setStats] = useState<DashboardStats>({
    condominiums: 0,
    residents: 0,
    occurrences: 0,
    pendingFines: 0,
    pendingDefenses: 0,
    packagesRegistered: 0,
    packagesPending: 0,
    packagesPickedUp: 0,
  });
  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [loading, setLoading] = useState(true);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [firstCondominiumId, setFirstCondominiumId] = useState<string | undefined>();

  const getDateFilter = (period: PeriodFilter): Date => {
    const now = new Date();
    switch (period) {
      case "today":
        return startOfDay(now);
      case "7d":
        return startOfDay(subDays(now, 7));
      case "1m":
        return startOfDay(subMonths(now, 1));
      case "1y":
        return startOfDay(subYears(now, 1));
      default:
        return startOfDay(subMonths(now, 1));
    }
  };

  const periodOptions: { value: PeriodFilter; label: string }[] = [
    { value: "today", label: "Hoje" },
    { value: "7d", label: "7 dias" },
    { value: "1m", label: "1 mês" },
    { value: "1y", label: "1 ano" },
  ];

  // Fetch condominiums list
  useEffect(() => {
    const fetchCondominiums = async () => {
      if (!user) return;

      const { data: condos } = await supabase
        .from("condominiums")
        .select("id, name")
        .eq("owner_id", user.id)
        .order("name");

      setCondominiums(condos || []);
      
      // Store the first condominium ID for onboarding navigation
      if (condos && condos.length > 0) {
        setFirstCondominiumId(condos[0].id);
      }
    };

    fetchCondominiums();
  }, [user]);

  useEffect(() => {
    const fetchData = async () => {
      if (!user) return;

      setLoading(true);
      const dateFilter = getDateFilter(periodFilter);

      try {
        const { data: profileData } = await supabase
          .from("profiles")
          .select("full_name, onboarding_completed")
          .eq("user_id", user.id)
          .maybeSingle();

        setProfile(profileData);

        // Show onboarding modal if not completed
        if (profileData && !profileData.onboarding_completed) {
          setShowOnboarding(true);
        }

        // Determine which condominium IDs to filter by
        let condoIds: string[] = [];
        let condoCount = 0;

        if (selectedCondominium === "all") {
          const { data: condos, count } = await supabase
            .from("condominiums")
            .select("id", { count: "exact" })
            .eq("owner_id", user.id);

          condoIds = condos?.map((c) => c.id) || [];
          condoCount = count || 0;
        } else {
          condoIds = [selectedCondominium];
          condoCount = 1;
        }

        let residentsCount = 0;
        let occurrencesCount = 0;
        let finesCount = 0;
        let defensesCount = 0;
        let packagesRegisteredCount = 0;
        let packagesPendingCount = 0;
        let packagesPickedUpCount = 0;

        if (condoIds.length > 0) {
          const { data: blocks } = await supabase
            .from("blocks")
            .select("id")
            .in("condominium_id", condoIds);

          const blockIds = blocks?.map((b) => b.id) || [];

          if (blockIds.length > 0) {
            const { data: apartments } = await supabase
              .from("apartments")
              .select("id")
              .in("block_id", blockIds);

            const apartmentIds = apartments?.map((a) => a.id) || [];

            if (apartmentIds.length > 0) {
              const { count: resCount } = await supabase
                .from("residents")
                .select("*", { count: "exact", head: true })
                .in("apartment_id", apartmentIds);

              residentsCount = resCount || 0;
            }
          }

          // Count occurrences within the period
          const { count: occCount } = await supabase
            .from("occurrences")
            .select("*", { count: "exact", head: true })
            .in("condominium_id", condoIds)
            .gte("created_at", dateFilter.toISOString());

          occurrencesCount = occCount || 0;

          // Count pending defenses within the period
          const { count: defCount } = await supabase
            .from("occurrences")
            .select("*", { count: "exact", head: true })
            .in("condominium_id", condoIds)
            .eq("status", "em_defesa")
            .gte("created_at", dateFilter.toISOString());

          defensesCount = defCount || 0;

          const { data: occurrencesData } = await supabase
            .from("occurrences")
            .select("id")
            .in("condominium_id", condoIds)
            .gte("created_at", dateFilter.toISOString());

          if (occurrencesData && occurrencesData.length > 0) {
            const { count: fCount } = await supabase
              .from("fines")
              .select("*", { count: "exact", head: true })
              .in(
                "occurrence_id",
                occurrencesData.map((o) => o.id)
              )
              .eq("status", "em_aberto");

            finesCount = fCount || 0;
          }

          // Count packages registered within the period
          const { count: pkgRegisteredCount } = await supabase
            .from("packages")
            .select("*", { count: "exact", head: true })
            .in("condominium_id", condoIds)
            .gte("received_at", dateFilter.toISOString());

          packagesRegisteredCount = pkgRegisteredCount || 0;

          // Count pending packages (all time, not filtered by period)
          const { count: pkgPendingCount } = await supabase
            .from("packages")
            .select("*", { count: "exact", head: true })
            .in("condominium_id", condoIds)
            .eq("status", "pendente");

          packagesPendingCount = pkgPendingCount || 0;

          // Count picked up packages within the period
          const { count: pkgPickedUpCount } = await supabase
            .from("packages")
            .select("*", { count: "exact", head: true })
            .in("condominium_id", condoIds)
            .eq("status", "retirada")
            .gte("picked_up_at", dateFilter.toISOString());

          packagesPickedUpCount = pkgPickedUpCount || 0;
        }

        setStats({
          condominiums: condoCount,
          residents: residentsCount,
          occurrences: occurrencesCount,
          pendingFines: finesCount,
          pendingDefenses: defensesCount,
          packagesRegistered: packagesRegisteredCount,
          packagesPending: packagesPendingCount,
          packagesPickedUp: packagesPickedUpCount,
        });
      } catch (error) {
        console.error("Error fetching dashboard data:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [user, periodFilter, selectedCondominium]);

  const statCards = [
    {
      title: "Condomínios",
      value: stats.condominiums,
      icon: Building2,
      gradient: "from-primary to-blue-600",
      action: () => navigate("/condominiums"),
    },
    {
      title: "Moradores",
      value: stats.residents,
      icon: Users,
      gradient: "from-accent to-emerald-600",
      action: () => navigate("/condominiums"),
    },
    {
      title: "Livro de Ocorrências",
      value: stats.occurrences,
      icon: FileText,
      gradient: "from-amber-500 to-orange-500",
      action: () => navigate("/occurrences"),
    },
    {
      title: "Defesas Pendentes",
      value: stats.pendingDefenses,
      icon: Shield,
      gradient: "from-violet-500 to-purple-600",
      action: () => navigate("/defenses"),
    },
    {
      title: "Multas Aplicadas",
      value: stats.pendingFines,
      icon: DollarSign,
      gradient: "from-rose-500 to-red-500",
      action: () => navigate("/occurrences"),
    },
    {
      title: "Encomendas Cadastradas",
      value: stats.packagesRegistered,
      icon: Package,
      gradient: "from-cyan-500 to-teal-500",
      action: () => navigate("/sindico/packages"),
    },
    {
      title: "Encomendas Pendentes",
      value: stats.packagesPending,
      icon: Package,
      gradient: "from-orange-500 to-amber-500",
      action: () => navigate("/sindico/packages"),
    },
    {
      title: "Encomendas Retiradas",
      value: stats.packagesPickedUp,
      icon: PackageCheck,
      gradient: "from-emerald-500 to-green-600",
      action: () => navigate("/sindico/packages"),
    },
  ];

  const quickActions = [
    {
      icon: Building2,
      label: "Gerenciar Condomínios",
      description: "Cadastrar e editar condomínios",
      action: () => navigate("/condominiums"),
    },
    {
      icon: AlertTriangle,
      label: "Nova Ocorrência",
      description: "Registrar uma nova ocorrência",
      action: () => navigate("/occurrences"),
    },
    {
      icon: Shield,
      label: "Analisar Defesas",
      description: `${stats.pendingDefenses} defesa${stats.pendingDefenses !== 1 ? "s" : ""} pendente${stats.pendingDefenses !== 1 ? "s" : ""}`,
      action: () => navigate("/defenses"),
    },
    {
      icon: Package,
      label: "Encomendas",
      description: "Estatísticas e histórico de encomendas",
      action: () => navigate("/sindico/packages"),
    },
  ];

  return (
    <DashboardLayout>
      <Helmet>
        <title>NotificaCondo - Dashboard</title>
        <meta name="description" content="Painel de gestão condominial" />
      </Helmet>

      <div className="space-y-6 md:space-y-8 animate-fade-up">
        <SindicoBreadcrumbs items={[]} />

        {/* Trial Banner */}
        <TrialBanner />

        {/* Welcome Section */}
        <div className="px-1">
          <h1 className="font-display text-3xl font-bold text-foreground">
            Olá, {profile?.full_name?.split(" ")[0] || "Síndico"}! 👋
          </h1>
          <p className="text-muted-foreground mt-1">
            Bem-vindo ao seu painel de gestão condominial.
          </p>
        </div>

        {/* Period Filter + Stats Grid */}
        <div className="space-y-4 px-1">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
            <h2 className="font-display text-lg font-semibold text-foreground flex items-center gap-2">
              <Calendar className="w-5 h-5 text-primary" />
              Estatísticas
            </h2>
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
              {/* Condominium Selector */}
              <Select value={selectedCondominium} onValueChange={setSelectedCondominium}>
                <SelectTrigger className="w-full sm:w-[200px]">
                  <Building2 className="w-4 h-4 mr-2 text-muted-foreground" />
                  <SelectValue placeholder="Selecione o condomínio" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos os condomínios</SelectItem>
                  {condominiums.map((condo) => (
                    <SelectItem key={condo.id} value={condo.id}>
                      {condo.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {/* Period Filter */}
              <div className="flex items-center gap-1 p-1 bg-muted rounded-lg overflow-x-auto no-scrollbar">
                {periodOptions.map((option) => (
                  <button
                    key={option.value}
                    onClick={() => setPeriodFilter(option.value)}
                    className={`flex-1 sm:flex-none px-3 py-1.5 text-xs sm:text-sm font-medium rounded-md transition-all whitespace-nowrap ${
                      periodFilter === option.value
                        ? "bg-primary text-primary-foreground shadow-sm"
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Visual indicator for selected condominium */}
          {selectedCondominium !== "all" && (
            <div className="flex items-center gap-2 px-3 py-2 bg-primary/10 border border-primary/20 rounded-lg">
              <Building2 className="w-4 h-4 text-primary" />
              <span className="text-sm font-medium text-foreground">
                Exibindo dados de:{" "}
                <span className="text-primary">
                  {condominiums.find((c) => c.id === selectedCondominium)?.name || "Condomínio selecionado"}
                </span>
              </span>
            </div>
          )}

          <div className="grid grid-cols-1 xs:grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
            {statCards.map((stat, index) => (
              <Card
                key={index}
                className="bg-card border-border/50 shadow-sm hover:shadow-md transition-all duration-300 cursor-pointer group relative overflow-hidden"
                onClick={stat.action}
              >
                <div className={`absolute top-0 left-0 w-1 h-full bg-gradient-to-b ${stat.gradient}`} />
                <CardContent className="p-5">
                  <div className="flex items-center justify-between mb-4">
                    <div
                      className={`w-10 h-10 rounded-xl bg-gradient-to-br ${stat.gradient} flex items-center justify-center shadow-md group-hover:scale-110 transition-transform duration-300`}
                    >
                      <stat.icon className="w-5 h-5 text-white" />
                    </div>
                    <ArrowUpRight className="w-4 h-4 text-muted-foreground group-hover:text-primary transition-colors" />
                  </div>
                  <div>
                    {loading ? (
                      <Skeleton className="h-8 w-16 mb-1" />
                    ) : (
                      <p className="font-display text-2xl sm:text-3xl font-bold text-foreground">
                        {stat.value}
                      </p>
                    )}
                    <p className="text-sm font-medium text-muted-foreground mt-1">{stat.title}</p>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>

        {/* Quick Actions */}
        <div>
          <h2 className="font-display text-lg md:text-xl font-semibold text-foreground mb-3 md:mb-4">
            Ações Rápidas
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 md:gap-4">
            {quickActions.map((action, index) => (
              <button
                key={index}
                onClick={action.action}
                className="p-4 rounded-xl bg-card border border-border shadow-card hover:shadow-elevated transition-all text-left group"
              >
                <div className="flex items-start justify-between">
                  <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center mb-3">
                    <action.icon className="w-5 h-5 text-primary" />
                  </div>
                  <ChevronRight className="w-4 h-4 text-muted-foreground group-hover:text-primary transition-colors" />
                </div>
                <h3 className="font-semibold text-foreground mb-1">{action.label}</h3>
                <p className="text-sm text-muted-foreground">{action.description}</p>
              </button>
            ))}
          </div>
        </div>

        {/* Empty State */}
        {stats.condominiums === 0 && !loading && (
          <Card className="bg-card border-border shadow-card">
            <CardContent className="text-center py-8 md:py-12">
              <div className="w-14 h-14 md:w-16 md:h-16 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-4">
                <Building2 className="w-7 h-7 md:w-8 md:h-8 text-primary" />
              </div>
              <h3 className="font-display text-lg md:text-xl font-semibold text-foreground mb-2">
                Nenhum condomínio cadastrado
              </h3>
              <p className="text-sm md:text-base text-muted-foreground mb-6 max-w-md mx-auto">
                Comece cadastrando seu primeiro condomínio para gerenciar ocorrências,
                notificações e multas.
              </p>
              <Button onClick={() => navigate("/condominiums")}>
                <Plus className="w-4 h-4 mr-2" />
                Cadastrar Condomínio
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Onboarding Modal */}
        {user && (
          <SindicoOnboardingModal
            open={showOnboarding}
            onOpenChange={setShowOnboarding}
            userId={user.id}
            condominiumId={firstCondominiumId}
          />
        )}
      </div>
    </DashboardLayout>
  );
};

export default Dashboard;
