import { Link } from "react-router-dom";
import { Mail, MessageCircle, ShieldCheck } from "lucide-react";
import logoImage from "@/assets/logo.webp";

const linkClass =
  "text-sm text-indigo-100/70 hover:text-white transition-colors";
const headingClass = "text-white font-semibold mb-4";

const Footer = () => {
  return (
    <footer
      id="contato"
      className="relative overflow-hidden border-t border-white/10"
      style={{
        background:
          "radial-gradient(ellipse at bottom, hsl(240 60% 12%) 0%, hsl(240 60% 6%) 60%, hsl(240 65% 4%) 100%)",
        fontFamily: "'Manrope', sans-serif",
      }}
    >
      {/* Glow */}
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -top-24 left-1/3 w-[520px] h-[520px] rounded-full bg-indigo-500/15 blur-[140px]" />
        <div className="absolute bottom-0 right-0 w-[420px] h-[420px] rounded-full bg-violet-500/15 blur-[120px]" />
      </div>

      <div className="container relative mx-auto px-4 py-16">
        <div className="grid md:grid-cols-4 gap-10 mb-12">
          {/* Brand */}
          <div className="md:col-span-1">
            <Link to="/" className="flex items-center mb-4">
              <img
                src={logoImage}
                alt="NotificaCondo"
                className="h-14 w-auto object-contain"
                width={126}
                height={56}
              />
            </Link>
            <p className="text-sm text-indigo-100/70 leading-relaxed mb-5">
              Plataforma SaaS completa para gestão condominial: ocorrências,
              encomendas, salão de festas, portaria e manutenção com WhatsApp
              integrado.
            </p>
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/5 border border-white/10 text-xs text-indigo-200">
              <ShieldCheck className="w-3.5 h-3.5" />
              LGPD compliant
            </div>
          </div>

          {/* Product */}
          <div>
            <h4 className={headingClass} style={{ fontFamily: "'Sora', sans-serif" }}>
              Produto
            </h4>
            <ul className="space-y-2.5">
              <li><a href="#funcionalidades" className={linkClass}>Funcionalidades</a></li>
              <li><a href="#fluxo" className={linkClass}>Como Funciona</a></li>
              <li><a href="#planos" className={linkClass}>Planos e Preços</a></li>
              <li><a href="#faq" className={linkClass}>Perguntas Frequentes</a></li>
            </ul>
          </div>

          {/* Company */}
          <div>
            <h4 className={headingClass} style={{ fontFamily: "'Sora', sans-serif" }}>
              Empresa
            </h4>
            <ul className="space-y-2.5">
              <li><Link to="/contato" className={linkClass}>Contato</Link></li>
              <li><Link to="/autenticidade" className={linkClass}>Autenticidade</Link></li>
              <li><a href="#depoimentos" className={linkClass}>Depoimentos</a></li>
            </ul>
          </div>

          {/* Legal */}
          <div>
            <h4 className={headingClass} style={{ fontFamily: "'Sora', sans-serif" }}>
              Legal
            </h4>
            <ul className="space-y-2.5">
              <li><Link to="/termos" className={linkClass}>Termos de Uso</Link></li>
              <li><Link to="/privacidade" className={linkClass}>Política de Privacidade</Link></li>
              <li><Link to="/privacidade#direitos" className={linkClass}>LGPD</Link></li>
              <li><Link to="/codigo-civil" className={linkClass}>Código Civil</Link></li>
            </ul>
          </div>
        </div>

        {/* Contact chips */}
        <div className="flex flex-wrap gap-3 mb-10">
          <a
            href="mailto:contato@notificacondo.com.br"
            className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/[0.04] border border-white/10 text-sm text-indigo-100/80 hover:text-white hover:border-indigo-400/40 transition-all"
          >
            <Mail className="w-4 h-4" />
            contato@notificacondo.com.br
          </a>
          <a
            href="https://wa.me/5511999999999"
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/[0.04] border border-white/10 text-sm text-indigo-100/80 hover:text-white hover:border-indigo-400/40 transition-all"
          >
            <MessageCircle className="w-4 h-4" />
            Fale no WhatsApp
          </a>
        </div>

        {/* Bottom */}
        <div className="pt-8 border-t border-white/10 flex flex-col md:flex-row items-center justify-between gap-4">
          <p className="text-sm text-indigo-100/60">
            © {new Date().getFullYear()} NotificaCondo. Todos os direitos reservados.
          </p>
          <p className="text-xs text-indigo-100/50 max-w-xl text-center md:text-right leading-relaxed">
            O NotificaCondo é uma plataforma de apoio à gestão condominial. As
            decisões administrativas e jurídicas são de responsabilidade
            exclusiva do síndico do condomínio.
          </p>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
