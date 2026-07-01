import {
  Check,
  Sparkles,
  Loader2,
  MessageCircle,
  Clock,
  Flame,
  Scale,
  Package,
  PartyPopper,
  ArrowRight,
  Star,
  Zap,
  Crown,
  Shield,
  DoorOpen,
  Wrench,
} from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { useTrialDays } from "@/hooks/useTrialDays";

const sora = { fontFamily: "'Sora', sans-serif" };
const manrope = { fontFamily: "'Manrope', sans-serif" };

const containerVariants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.1, delayChildren: 0.2 } },
};

const cardVariants = {
  hidden: { opacity: 0, y: 30, scale: 0.95 },
  visible: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: { type: "spring" as const, stiffness: 100, damping: 15 },
  },
};

const modules = [
  { icon: Scale, label: "Ocorrências" },
  { icon: Package, label: "Encomendas" },
  { icon: PartyPopper, label: "Espaços" },
  { icon: DoorOpen, label: "Portaria" },
  { icon: Wrench, label: "Manutenção" },
];

const Pricing = () => {
  const navigate = useNavigate();
  const { trialDays } = useTrialDays();

  const [timeLeft, setTimeLeft] = useState({ hours: 0, minutes: 0, seconds: 0 });

  useEffect(() => {
    const tick = () => {
      const now = new Date();
      const end = new Date();
      end.setHours(23, 59, 59, 999);
      const diff = end.getTime() - now.getTime();
      if (diff > 0) {
        setTimeLeft({
          hours: Math.floor(diff / (1000 * 60 * 60)),
          minutes: Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60)),
          seconds: Math.floor((diff % (1000 * 60)) / 1000),
        });
      }
    };
    tick();
    const t = setInterval(tick, 1000);
    return () => clearInterval(t);
  }, []);

  const { data: plans, isLoading } = useQuery({
    queryKey: ["landing-plans"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("plans")
        .select("*")
        .eq("is_active", true)
        .order("display_order", { ascending: true });
      if (error) throw error;
      return data;
    },
  });

  const formatPrice = (price: number) =>
    price === 0
      ? "Consulte"
      : price.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  const isPopular = (slug: string) => slug === "profissional";

  const getPlanIcon = (slug: string) => {
    switch (slug) {
      case "start":
        return Star;
      case "essencial":
        return Zap;
      case "profissional":
        return Crown;
      case "enterprise":
        return Shield;
      default:
        return Star;
    }
  };

  const pad = (n: number) => String(n).padStart(2, "0");

  return (
    <section id="pricing" className="relative py-28 px-6 bg-[#020617] overflow-hidden" style={manrope}>
      {/* Glow */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[900px] h-[500px] bg-indigo-600/15 blur-[140px] rounded-full pointer-events-none" />
      {/* Grid */}
      <div
        className="absolute inset-0 opacity-[0.03] pointer-events-none"
        style={{
          backgroundImage:
            "linear-gradient(#fff 1px, transparent 1px), linear-gradient(90deg, #fff 1px, transparent 1px)",
          backgroundSize: "60px 60px",
        }}
      />

      <div className="container mx-auto relative z-10">
        {/* Countdown */}
        <div className="flex items-center justify-center gap-3 mb-12 px-5 py-3 rounded-2xl bg-white/5 border border-white/10 max-w-xl mx-auto">
          <Flame className="w-4 h-4 text-orange-400" />
          <span className="text-sm text-slate-300">Oferta expira em</span>
          <div className="flex items-center gap-1 font-mono">
            <span className="bg-indigo-600 text-white px-2 py-1 rounded text-sm font-bold">{pad(timeLeft.hours)}</span>
            <span className="text-indigo-400 font-bold">:</span>
            <span className="bg-indigo-600 text-white px-2 py-1 rounded text-sm font-bold">{pad(timeLeft.minutes)}</span>
            <span className="text-indigo-400 font-bold">:</span>
            <span className="bg-indigo-600 text-white px-2 py-1 rounded text-sm font-bold">{pad(timeLeft.seconds)}</span>
          </div>
          <Clock className="w-4 h-4 text-indigo-300" />
        </div>

        {/* Header */}
        <div className="text-center max-w-2xl mx-auto mb-10">
          <span className="inline-block px-3 py-1 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-300 text-xs font-semibold uppercase tracking-widest">
            Planos
          </span>
          <h2 style={sora} className="text-4xl md:text-6xl font-extrabold tracking-tight text-white mt-6 mb-5 leading-[1.05]">
            Preço justo,{" "}
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 to-violet-400">
              tudo incluso.
            </span>
          </h2>
          <p className="text-slate-400 text-lg">
            <span className="text-indigo-300 font-semibold">{trialDays} dias grátis</span> para testar. Cancele quando quiser.
          </p>
        </div>

        {/* Modules included */}
        <div className="flex flex-col items-center gap-4 mb-14">
          <p className="text-xs uppercase tracking-widest text-slate-500">Todos os planos incluem os 5 módulos</p>
          <div className="flex flex-wrap items-center justify-center gap-2">
            {modules.map(({ icon: Icon, label }) => (
              <div
                key={label}
                className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/5 border border-white/10 text-slate-300 text-sm"
              >
                <Icon className="w-3.5 h-3.5 text-indigo-400" />
                {label}
              </div>
            ))}
          </div>
        </div>

        {isLoading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-indigo-400" />
          </div>
        ) : (
          <motion.div
            className={`grid md:grid-cols-2 ${
              plans && plans.length >= 4 ? "lg:grid-cols-4" : plans && plans.length === 3 ? "lg:grid-cols-3" : "lg:grid-cols-2"
            } gap-5 max-w-7xl mx-auto`}
            variants={containerVariants}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: "-50px" }}
          >
            {plans?.map((plan) => {
              const PlanIcon = getPlanIcon(plan.slug);
              const popular = isPopular(plan.slug);
              return (
                <motion.div
                  key={plan.id}
                  variants={cardVariants}
                  whileHover={{ y: -6, transition: { type: "spring", stiffness: 300, damping: 20 } }}
                  className="relative"
                >
                  {popular && (
                    <div className="absolute -inset-px rounded-2xl bg-gradient-to-br from-indigo-500/60 via-violet-500/40 to-indigo-500/60 blur-sm pointer-events-none" />
                  )}
                  <div
                    className={`relative h-full flex flex-col rounded-2xl p-6 transition-all ${
                      popular
                        ? "bg-[#0a0f2c] border border-indigo-500/40 shadow-xl shadow-indigo-600/20"
                        : "bg-white/[0.03] border border-white/10 hover:border-indigo-500/30"
                    }`}
                  >
                    {popular && (
                      <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-1 rounded-full bg-gradient-to-r from-indigo-500 to-violet-500 text-[10px] font-bold text-white tracking-widest uppercase flex items-center gap-1 shadow-lg shadow-indigo-600/40">
                        <Sparkles className="w-3 h-3" />
                        Mais Popular
                      </div>
                    )}

                    {/* Header */}
                    <div className="text-center mb-6">
                      <div
                        className={`w-12 h-12 rounded-xl flex items-center justify-center mx-auto mb-4 ${
                          popular
                            ? "bg-gradient-to-br from-indigo-500 to-violet-500 shadow-lg shadow-indigo-600/40"
                            : "bg-white/5 border border-white/10"
                        }`}
                      >
                        <PlanIcon className={`w-6 h-6 ${popular ? "text-white" : "text-indigo-300"}`} />
                      </div>
                      <h3 style={sora} className="text-xl font-bold text-white mb-1">
                        {plan.name}
                      </h3>
                      <p className="text-xs text-slate-400">{plan.description || `Plano ${plan.name}`}</p>
                    </div>

                    {/* Price */}
                    <div className="text-center mb-6 pb-6 border-b border-white/5">
                      {plan.price === 0 ? (
                        <span style={sora} className="text-3xl font-bold text-white">
                          Consulte
                        </span>
                      ) : (
                        <div className="flex items-baseline justify-center gap-1">
                          <span className="text-slate-400 text-sm">R$</span>
                          <span style={sora} className="text-4xl font-extrabold text-white">
                            {formatPrice(plan.price)}
                          </span>
                          <span className="text-slate-400 text-sm">/mês</span>
                        </div>
                      )}
                    </div>

                    {/* Limits */}
                    <div className="space-y-2.5 mb-6 flex-1">
                      {[
                        { label: "Notificações", value: plan.notifications_limit },
                        { label: "Advertências", value: plan.warnings_limit },
                        { label: "Multas", value: plan.fines_limit },
                        {
                          label: "Notif. Encomendas",
                          value: (plan as { package_notifications_limit?: number }).package_notifications_limit ?? 50,
                        },
                      ].map((item) => (
                        <div key={item.label} className="flex items-center justify-between text-sm">
                          <span className="text-slate-400">{item.label}</span>
                          <span className="font-medium text-white">
                            {item.value === -1
                              ? "Ilimitadas"
                              : item.value === 0
                              ? "—"
                              : `${item.value}/mês`}
                          </span>
                        </div>
                      ))}
                      <p className="text-[11px] text-slate-500 pt-2 border-t border-white/5">
                        Envios extras: R$ 0,10 cada
                      </p>
                    </div>

                    {/* Highlights */}
                    <div className="space-y-2 mb-6">
                      <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-indigo-500/10 border border-indigo-500/20">
                        <Check className="w-4 h-4 text-indigo-300" />
                        <span className="text-xs text-indigo-200 font-medium">5 módulos inclusos</span>
                      </div>
                      <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-emerald-500/10 border border-emerald-500/20">
                        <MessageCircle className="w-4 h-4 text-emerald-400" />
                        <span className="text-xs text-emerald-300 font-medium">WhatsApp WABA oficial</span>
                      </div>
                    </div>

                    <button
                      onClick={() => {
                        if (plan.price === 0) {
                          window.open(
                            "mailto:contato@notificacondo.com.br?subject=Interesse no plano Enterprise",
                            "_blank"
                          );
                        } else {
                          navigate(`/auth?plano=${plan.slug}`);
                        }
                      }}
                      className={`w-full px-5 py-3 rounded-xl font-semibold text-sm inline-flex items-center justify-center gap-2 transition-all ${
                        popular
                          ? "bg-indigo-600 hover:bg-indigo-500 text-white shadow-lg shadow-indigo-600/30 hover:scale-[1.02]"
                          : "bg-white/5 hover:bg-white/10 border border-white/10 text-white"
                      }`}
                    >
                      {plan.price === 0 ? "Fale Conosco" : `Começar ${trialDays} dias grátis`}
                      <ArrowRight className="w-4 h-4" />
                    </button>
                  </div>
                </motion.div>
              );
            })}
          </motion.div>
        )}

        {/* Payment */}
        <div className="text-center mt-16">
          <p className="text-xs uppercase tracking-widest text-slate-500 mb-4">Pagamento seguro via</p>
          <div className="flex items-center justify-center gap-2 flex-wrap">
            {["Mercado Pago", "PIX", "Cartão de Crédito", "Boleto"].map((m) => (
              <div
                key={m}
                className="px-4 py-2 rounded-lg bg-white/5 border border-white/10 text-sm text-slate-300"
              >
                {m}
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
};

export default Pricing;
