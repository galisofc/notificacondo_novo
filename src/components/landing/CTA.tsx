import { ArrowRight, Shield, Zap } from "lucide-react";
import { Link } from "react-router-dom";

const sora = { fontFamily: "'Sora', sans-serif" };
const manrope = { fontFamily: "'Manrope', sans-serif" };

const CTA = () => {
  return (
    <section className="relative py-28 px-6 overflow-hidden bg-[#020617]" style={manrope}>
      {/* Glow */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[700px] h-[700px] bg-indigo-600/20 rounded-full blur-[140px] pointer-events-none" />
      {/* Grid */}
      <div
        className="absolute inset-0 opacity-[0.04] pointer-events-none"
        style={{
          backgroundImage:
            "linear-gradient(#fff 1px, transparent 1px), linear-gradient(90deg, #fff 1px, transparent 1px)",
          backgroundSize: "60px 60px",
        }}
      />

      <div className="container mx-auto relative z-10">
        <div className="max-w-3xl mx-auto text-center">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-300 text-xs font-medium mb-8">
            <Zap className="w-3.5 h-3.5" />
            Comece em menos de 5 minutos
          </div>

          <h2
            style={sora}
            className="text-4xl md:text-6xl font-extrabold tracking-tight text-white mb-6 leading-[1.05]"
          >
            Pronto para uma portaria{" "}
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 to-violet-400">
              sem ruídos?
            </span>
          </h2>

          <p className="text-lg text-slate-400 mb-10 max-w-xl mx-auto">
            Ative os 5 módulos em minutos. Cancele quando quiser.
            Sem cartão de crédito no teste.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link
              to="/auth"
              className="group px-8 py-4 bg-indigo-600 hover:bg-indigo-500 text-white font-semibold rounded-xl transition-all shadow-lg shadow-indigo-600/25 hover:scale-105 active:scale-95 inline-flex items-center gap-2"
            >
              Teste grátis 7 dias
              <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
            </Link>
            <Link
              to="/contato"
              className="px-8 py-4 bg-white/5 hover:bg-white/10 border border-white/10 text-white font-semibold rounded-xl transition-all"
            >
              Agendar demonstração
            </Link>
          </div>

          <div className="mt-10 inline-flex items-center gap-2 text-slate-500 text-sm">
            <Shield className="w-4 h-4" />
            Conformidade LGPD • WhatsApp WABA oficial
          </div>
        </div>
      </div>
    </section>
  );
};

export default CTA;
