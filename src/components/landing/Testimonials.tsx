import { Star, Quote } from "lucide-react";

const sora = { fontFamily: "'Sora', sans-serif" };
const manrope = { fontFamily: "'Manrope', sans-serif" };

const testimonials = [
  {
    name: "Carlos Silva",
    role: "Síndico",
    condominium: "Residencial Vista Verde",
    location: "São Paulo, SP",
    image: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=100&h=100&fit=crop&crop=face",
    content:
      "O NotificaCondo transformou a gestão do nosso condomínio. Antes, os moradores sempre alegavam não ter recebido as notificações. Agora temos prova jurídica de tudo!",
    rating: 5,
    featured: true,
  },
  {
    name: "Maria Santos",
    role: "Síndica",
    condominium: "Edifício Aurora",
    location: "Rio de Janeiro, RJ",
    image: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=100&h=100&fit=crop&crop=face",
    content:
      "A integração com WhatsApp é incrível. Os moradores recebem as notificações instantaneamente e eu tenho o registro de ciência automático.",
    rating: 5,
  },
  {
    name: "Roberto Almeida",
    role: "Síndico Profissional",
    condominium: "Condomínio Solar",
    location: "Belo Horizonte, MG",
    image: "https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=100&h=100&fit=crop&crop=face",
    content:
      "Administro 5 condomínios e economizo horas por semana. O sistema de defesa e contraditório é perfeito para evitar problemas jurídicos.",
    rating: 5,
  },
  {
    name: "Ana Paula Costa",
    role: "Síndica",
    condominium: "Torres do Parque",
    location: "Curitiba, PR",
    image: "https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=100&h=100&fit=crop&crop=face",
    content:
      "Uma solução que respeita a LGPD e facilita toda a comunicação. 7 dias de teste foram suficientes para me apaixonar pela plataforma.",
    rating: 5,
  },
  {
    name: "Fernando Lima",
    role: "Síndico",
    condominium: "Residencial Monte Azul",
    location: "Porto Alegre, RS",
    image: "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=100&h=100&fit=crop&crop=face",
    content:
      "O suporte é excepcional e a plataforma é intuitiva. Reduzi em 80% as reclamações sobre notificações não recebidas.",
    rating: 5,
  },
  {
    name: "Juliana Mendes",
    role: "Administradora",
    condominium: "Edifício Central",
    location: "Brasília, DF",
    image: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100&h=100&fit=crop&crop=face",
    content:
      "Conformidade com o Código Civil e defesa pelo morador trouxeram muito mais transparência para nossa gestão.",
    rating: 5,
  },
];

const stats = [
  { value: "500+", label: "Condomínios" },
  { value: "50k+", label: "Notificações" },
  { value: "99.8%", label: "Entrega" },
  { value: "4.9", label: "Avaliação" },
];

const Testimonials = () => {
  const featured = testimonials.find((t) => t.featured)!;
  const rest = testimonials.filter((t) => !t.featured);

  return (
    <section className="relative py-28 px-6 bg-[#020617] overflow-hidden" style={manrope}>
      {/* Glow */}
      <div className="absolute top-1/2 left-0 -translate-y-1/2 w-[500px] h-[500px] bg-violet-600/10 blur-[140px] rounded-full pointer-events-none" />
      <div className="absolute top-1/2 right-0 -translate-y-1/2 w-[500px] h-[500px] bg-indigo-600/10 blur-[140px] rounded-full pointer-events-none" />
      {/* Grid */}
      <div
        className="absolute inset-0 opacity-[0.03] pointer-events-none"
        style={{
          backgroundImage:
            "linear-gradient(#fff 1px, transparent 1px), linear-gradient(90deg, #fff 1px, transparent 1px)",
          backgroundSize: "60px 60px",
        }}
      />

      <div className="container mx-auto relative z-10 max-w-6xl">
        {/* Header */}
        <div className="text-center max-w-2xl mx-auto mb-14">
          <span className="inline-block px-3 py-1 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-300 text-xs font-semibold uppercase tracking-widest">
            Depoimentos
          </span>
          <h2
            style={sora}
            className="text-4xl md:text-6xl font-extrabold tracking-tight text-white mt-6 mb-5 leading-[1.05]"
          >
            Síndicos que{" "}
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 to-violet-400">
              dormem tranquilos.
            </span>
          </h2>
          <p className="text-slate-400 text-lg">
            Mais de 500 condomínios já transformaram a gestão com o NotificaCondo.
          </p>
        </div>

        {/* Bento Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-12">
          {/* Featured (md: 2x2) */}
          <div className="md:col-span-2 md:row-span-2 relative rounded-2xl bg-gradient-to-br from-indigo-600/20 via-[#0a0f2c] to-violet-600/10 border border-indigo-500/30 p-8 md:p-10 overflow-hidden group">
            <Quote className="absolute top-6 right-6 w-20 h-20 text-indigo-500/10" />
            <div className="flex gap-1 mb-5">
              {Array.from({ length: featured.rating }).map((_, i) => (
                <Star key={i} className="w-4 h-4 fill-amber-400 text-amber-400" />
              ))}
            </div>
            <p
              style={sora}
              className="text-white text-xl md:text-2xl font-medium leading-relaxed mb-8 relative z-10"
            >
              &ldquo;{featured.content}&rdquo;
            </p>
            <div className="flex items-center gap-3">
              <img
                src={featured.image}
                alt={featured.name}
                className="w-12 h-12 rounded-full object-cover ring-2 ring-indigo-500/40"
              />
              <div>
                <h4 className="font-semibold text-white text-sm">{featured.name}</h4>
                <p className="text-xs text-slate-400">
                  {featured.role} · {featured.condominium}
                </p>
                <p className="text-xs text-indigo-300">{featured.location}</p>
              </div>
            </div>
          </div>

          {/* Rest */}
          {rest.slice(0, 4).map((t, i) => (
            <div
              key={i}
              className="rounded-2xl bg-white/[0.03] border border-white/10 hover:border-indigo-500/30 hover:bg-white/[0.05] transition-all p-5 flex flex-col"
            >
              <div className="flex gap-0.5 mb-3">
                {Array.from({ length: t.rating }).map((_, j) => (
                  <Star key={j} className="w-3 h-3 fill-amber-400 text-amber-400" />
                ))}
              </div>
              <p className="text-slate-300 text-sm leading-relaxed mb-4 flex-1">
                &ldquo;{t.content}&rdquo;
              </p>
              <div className="flex items-center gap-2.5 pt-3 border-t border-white/5">
                <img
                  src={t.image}
                  alt={t.name}
                  className="w-9 h-9 rounded-full object-cover ring-1 ring-white/10"
                />
                <div className="min-w-0">
                  <h4 className="font-semibold text-white text-xs truncate">{t.name}</h4>
                  <p className="text-[11px] text-slate-500 truncate">
                    {t.role} · {t.location}
                  </p>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {stats.map((s) => (
            <div
              key={s.label}
              className="rounded-2xl bg-white/[0.03] border border-white/10 px-5 py-6 text-center"
            >
              <div
                style={sora}
                className="text-3xl md:text-4xl font-extrabold text-transparent bg-clip-text bg-gradient-to-br from-indigo-300 to-violet-400"
              >
                {s.value}
              </div>
              <div className="text-xs text-slate-400 uppercase tracking-widest mt-2">
                {s.label}
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default Testimonials;
