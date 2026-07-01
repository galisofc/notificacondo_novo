import { useState } from "react";
import { ArrowRight, Play } from "lucide-react";
import { Link } from "react-router-dom";
import ScreenshotsModal from "./ScreenshotsModal";

const sora = { fontFamily: "'Sora', sans-serif" };
const manrope = { fontFamily: "'Manrope', sans-serif" };

const Hero = () => {
  const [screenshotsOpen, setScreenshotsOpen] = useState(false);

  return (
    <section
      className="relative bg-[#020617] text-slate-200 overflow-hidden pt-32 pb-24 px-6"
      style={manrope}
    >
      {/* Glow */}
      <div className="absolute -top-40 left-1/2 -translate-x-1/2 w-[600px] h-[600px] bg-indigo-600/20 blur-[120px] rounded-full pointer-events-none" />
      {/* Grid */}
      <div
        className="absolute inset-0 opacity-[0.04] pointer-events-none"
        style={{
          backgroundImage:
            "linear-gradient(#fff 1px, transparent 1px), linear-gradient(90deg, #fff 1px, transparent 1px)",
          backgroundSize: "60px 60px",
        }}
      />

      <div className="relative z-10 max-w-6xl mx-auto text-center">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-300 text-xs font-medium mb-8">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-indigo-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-2 w-2 bg-indigo-500" />
          </span>
          Novo: Livro de Recados em tempo real
        </div>

        <h1
          style={sora}
          className="text-5xl md:text-7xl font-extrabold tracking-tight text-white mb-6 leading-[1.05]"
        >
          Gestão condominial{" "}
          <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 to-violet-400">
            sem ruídos.
          </span>
        </h1>

        <p className="max-w-2xl mx-auto text-lg md:text-xl text-slate-400 mb-10 leading-relaxed">
          Ocorrências com validade jurídica, encomendas, portaria e manutenção —
          tudo integrado ao WhatsApp em uma única plataforma.
        </p>

        <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
          <Link
            to="/auth"
            className="px-8 py-4 bg-indigo-600 hover:bg-indigo-500 text-white font-semibold rounded-xl transition-all shadow-lg shadow-indigo-600/25 hover:scale-105 active:scale-95 inline-flex items-center gap-2"
          >
            Teste grátis 7 dias
            <ArrowRight className="w-4 h-4" />
          </Link>
          <button
            onClick={() => setScreenshotsOpen(true)}
            className="px-8 py-4 bg-slate-900/60 hover:bg-slate-800 border border-slate-700 text-white font-semibold rounded-xl transition-all inline-flex items-center gap-2"
          >
            <Play className="w-4 h-4" />
            Ver demonstração
          </button>
        </div>

        <ScreenshotsModal open={screenshotsOpen} onOpenChange={setScreenshotsOpen} />

        <p className="mt-8 text-xs text-slate-500 uppercase tracking-widest">
          Sem cartão de crédito • WhatsApp WABA oficial • LGPD
        </p>
      </div>
    </section>
  );
};

export default Hero;
