import { Scale, Package, PartyPopper, DoorOpen, Wrench, ArrowUpRight } from "lucide-react";
import { Link } from "react-router-dom";

const sora = { fontFamily: "'Sora', sans-serif" };
const manrope = { fontFamily: "'Manrope', sans-serif" };

const Features = () => {
  return (
    <section
      id="funcionalidades"
      className="relative bg-[#020617] text-slate-200 py-24 px-6"
      style={manrope}
    >
      <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-indigo-500/40 to-transparent" />

      <div className="max-w-6xl mx-auto">
        <div className="text-center mb-16">
          <span className="text-indigo-400 text-xs font-semibold uppercase tracking-[0.2em]">
            Módulos
          </span>
          <h2
            style={sora}
            className="text-3xl md:text-5xl font-bold text-white mt-4 mb-4"
          >
            Cinco módulos.{" "}
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 to-violet-400">
              Uma única plataforma.
            </span>
          </h2>
          <p className="text-slate-400 max-w-2xl mx-auto">
            Tudo o que síndico, portaria e moradores precisam — integrado ao WhatsApp
            e com validade jurídica de ponta a ponta.
          </p>
        </div>

        {/* Bento grid */}
        <div className="grid grid-cols-1 md:grid-cols-12 gap-4 auto-rows-[180px]">
          {/* Big: Ocorrências */}
          <div className="md:col-span-8 md:row-span-2 group relative overflow-hidden rounded-3xl border border-slate-800 bg-slate-900/50 p-8 flex flex-col justify-between hover:border-indigo-500/50 transition-colors">
            <div className="absolute inset-0 bg-gradient-to-br from-indigo-500/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
            <div className="absolute top-0 right-0 w-40 h-40 bg-indigo-500/20 blur-3xl pointer-events-none" />
            <div className="relative z-10">
              <div className="w-12 h-12 rounded-2xl bg-indigo-500/20 border border-indigo-500/30 flex items-center justify-center mb-6">
                <Scale className="w-6 h-6 text-indigo-300" />
              </div>
              <h3 style={sora} className="text-2xl font-bold text-white mb-2">
                Ocorrências &amp; Multas
              </h3>
              <p className="text-slate-400 max-w-md">
                Notificações via WhatsApp WABA, contraditório, ampla defesa e dossiê
                jurídico exportável. Base legal (Art. 1.336/1.337) vinculada.
              </p>
            </div>
            <div className="relative z-10 mt-6 bg-slate-950/80 rounded-xl border border-slate-800 p-4">
              <div className="flex items-center gap-3 mb-3">
                <div className="h-2 flex-1 bg-indigo-500/20 rounded-full overflow-hidden">
                  <div className="h-full w-[72%] bg-gradient-to-r from-indigo-500 to-violet-500" />
                </div>
                <span className="text-[10px] text-slate-500 uppercase tracking-wider">
                  Ciência 72%
                </span>
              </div>
              <div className="grid grid-cols-4 gap-2">
                <div className="h-8 bg-slate-900 rounded" />
                <div className="h-8 bg-indigo-500/30 rounded" />
                <div className="h-8 bg-slate-900 rounded" />
                <div className="h-8 bg-slate-900 rounded" />
              </div>
            </div>
          </div>

          {/* Encomendas */}
          <div className="md:col-span-4 md:row-span-2 group relative overflow-hidden rounded-3xl border border-slate-800 bg-[#0f172a] p-8 flex flex-col justify-end hover:border-blue-500/50 transition-colors">
            <div className="absolute top-8 left-8 w-12 h-12 rounded-2xl bg-blue-500/20 border border-blue-500/30 flex items-center justify-center">
              <Package className="w-6 h-6 text-blue-300" />
            </div>
            <div className="absolute top-24 left-8 right-8 bg-slate-950/60 border border-slate-800 rounded-xl p-3 text-xs">
              <div className="text-slate-500 mb-1">Código de retirada</div>
              <div style={sora} className="text-white text-2xl tracking-[0.3em] font-bold">
                7 2 4 9
              </div>
            </div>
            <div className="relative">
              <h3 style={sora} className="text-xl font-bold text-white mb-2">
                Encomendas
              </h3>
              <p className="text-slate-400 text-sm">
                Foto, código de 6 dígitos e notificação WhatsApp instantânea ao morador.
              </p>
            </div>
          </div>

          {/* Portaria */}
          <div className="md:col-span-7 group relative overflow-hidden rounded-3xl border border-slate-800 bg-slate-900/50 p-6 flex items-center gap-6 hover:border-emerald-500/50 transition-colors">
            <div className="w-12 h-12 rounded-2xl bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center shrink-0">
              <DoorOpen className="w-6 h-6 text-emerald-300" />
            </div>
            <div className="flex-1 min-w-0">
              <h3 style={sora} className="text-lg font-bold text-white">
                Portaria Inteligente
              </h3>
              <p className="text-slate-400 text-sm">
                Passagem de plantão, livro de recados em tempo real e banners informativos.
              </p>
            </div>
            <div className="hidden sm:flex -space-x-2 shrink-0">
              <div className="w-9 h-9 rounded-full bg-emerald-500/30 border-2 border-slate-900" />
              <div className="w-9 h-9 rounded-full bg-indigo-500/30 border-2 border-slate-900" />
              <div className="w-9 h-9 rounded-full bg-slate-800 border-2 border-slate-900 flex items-center justify-center text-[10px] text-slate-400">
                +6
              </div>
            </div>
          </div>

          {/* Espaços */}
          <div className="md:col-span-5 group relative overflow-hidden rounded-3xl border border-slate-800 bg-slate-900/50 p-6 flex items-center justify-between hover:border-violet-500/50 transition-colors">
            <div>
              <h3 style={sora} className="text-lg font-bold text-white">
                Reserva de Espaços
              </h3>
              <p className="text-slate-400 text-sm">Checklist digital &amp; termo assinado.</p>
            </div>
            <div className="w-12 h-12 rounded-2xl bg-violet-500/20 border border-violet-500/30 flex items-center justify-center group-hover:scale-110 transition-transform">
              <PartyPopper className="w-6 h-6 text-violet-300" />
            </div>
          </div>

          {/* Manutenção */}
          <div className="md:col-span-12 group relative overflow-hidden rounded-3xl border border-slate-800 bg-slate-900/50 p-6 flex flex-col md:flex-row items-start md:items-center gap-6 hover:border-amber-500/50 transition-colors">
            <div className="w-12 h-12 rounded-2xl bg-amber-500/20 border border-amber-500/30 flex items-center justify-center shrink-0">
              <Wrench className="w-6 h-6 text-amber-300" />
            </div>
            <div className="flex-1">
              <h3 style={sora} className="text-lg font-bold text-white">
                Manutenção Preventiva
              </h3>
              <p className="text-slate-400 text-sm">
                Dashboard de chamados, atribuição a zeladores e agendamento com alertas automáticos.
              </p>
            </div>
            <Link
              to="/auth"
              className="inline-flex items-center gap-2 text-sm text-indigo-300 hover:text-indigo-200 font-medium"
            >
              Começar agora <ArrowUpRight className="w-4 h-4" />
            </Link>
          </div>
        </div>

        {/* Stats strip */}
        <div className="mt-16 grid grid-cols-2 md:grid-cols-4 gap-px bg-slate-800 rounded-2xl overflow-hidden border border-slate-800">
          {[
            { v: "5", l: "Módulos integrados" },
            { v: "50k+", l: "Notificações enviadas" },
            { v: "10k+", l: "Encomendas geridas" },
            { v: "100%", l: "Conformidade LGPD" },
          ].map((s) => (
            <div key={s.l} className="bg-[#020617] p-6 text-center">
              <div
                style={sora}
                className="text-3xl md:text-4xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 to-violet-400 mb-1"
              >
                {s.v}
              </div>
              <div className="text-xs text-slate-500 uppercase tracking-wider">{s.l}</div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default Features;
