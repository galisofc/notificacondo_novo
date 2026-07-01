import { Button } from "@/components/ui/button";
import { Menu, X, LayoutDashboard, LogIn, UserPlus } from "lucide-react";
import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import logoImage from "@/assets/logo-branco.png.asset.json";

const navLinkClass =
  "text-sm text-indigo-100/70 hover:text-white transition-colors";

const Header = () => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const { user } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const goToPricing = () => {
    if (window.location.pathname === "/") {
      const el = document.getElementById("pricing");
      if (el) {
        el.scrollIntoView({ behavior: "smooth" });
        window.location.hash = "pricing";
      }
    } else {
      navigate("/#pricing");
    }
    setIsMenuOpen(false);
  };

  return (
    <header
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 border-b ${
        isMenuOpen
          ? "bg-[#0b0b1f] border-white/10"
          : scrolled
          ? "bg-[#0b0b1f]/80 backdrop-blur-xl border-white/10 shadow-[0_8px_30px_-12px_rgba(79,70,229,0.35)]"
          : "bg-[#0b0b1f]/40 backdrop-blur-md border-white/5"
      }`}
      style={{ fontFamily: "'Manrope', sans-serif" }}
    >
      <div className="container mx-auto px-4">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <Link to="/" className="flex items-center">
            <img
              src={logoImage}
              alt="NotificaCondo"
              className="h-14 w-auto object-contain"
              width={126}
              height={56}
            />
          </Link>

          {/* Desktop Nav */}
          <nav
            className="hidden md:flex items-center gap-1 rounded-full border border-white/10 bg-white/[0.03] backdrop-blur-xl px-2 py-1.5"
            style={{ fontFamily: "'Sora', sans-serif" }}
          >
            <a href="#funcionalidades" className={`${navLinkClass} px-3 py-1.5 rounded-full hover:bg-white/5`}>
              Funcionalidades
            </a>
            <a href="#fluxo" className={`${navLinkClass} px-3 py-1.5 rounded-full hover:bg-white/5`}>
              Como Funciona
            </a>
            <Link to="/planos" className={`${navLinkClass} px-3 py-1.5 rounded-full hover:bg-white/5`}>
              Planos
            </Link>
            <Link to="/contato" className={`${navLinkClass} px-3 py-1.5 rounded-full hover:bg-white/5`}>
              Contato
            </Link>
            <a href="#faq" className={`${navLinkClass} px-3 py-1.5 rounded-full hover:bg-white/5`}>
              FAQ
            </a>
          </nav>

          {/* CTA Buttons */}
          <div className="hidden md:flex items-center gap-2">
            {user ? (
              <Button
                size="sm"
                onClick={() => navigate("/dashboard")}
                className="rounded-full bg-gradient-to-r from-indigo-500 to-violet-500 hover:from-indigo-400 hover:to-violet-400 text-white border-0 shadow-[0_0_20px_-4px_rgba(129,140,248,0.6)]"
              >
                Painel
              </Button>
            ) : (
              <>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => navigate("/auth")}
                  className="rounded-full text-indigo-100/80 hover:text-white hover:bg-white/5"
                >
                  Entrar
                </Button>
                <Button
                  size="sm"
                  onClick={goToPricing}
                  className="rounded-full bg-gradient-to-r from-indigo-500 to-violet-500 hover:from-indigo-400 hover:to-violet-400 text-white border-0 shadow-[0_0_20px_-4px_rgba(129,140,248,0.6)]"
                >
                  Teste grátis 7 dias
                </Button>
              </>
            )}
          </div>

          {/* Mobile Menu Toggle */}
          <button
            className="md:hidden p-2 text-white h-10 w-10 flex items-center justify-center rounded-lg hover:bg-white/5 transition-colors"
            onClick={() => setIsMenuOpen(!isMenuOpen)}
            aria-label={isMenuOpen ? "Fechar menu" : "Abrir menu"}
          >
            {isMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
          </button>
        </div>

        {/* Mobile Menu */}
        {isMenuOpen && (
          <div className="md:hidden py-6 border-t border-white/10 animate-fade-in">
            <nav className="flex flex-col gap-1" style={{ fontFamily: "'Sora', sans-serif" }}>
              {[
                { label: "Funcionalidades", href: "#funcionalidades", type: "anchor" as const },
                { label: "Como Funciona", href: "#fluxo", type: "anchor" as const },
                { label: "Planos", href: "/planos", type: "link" as const },
                { label: "Contato", href: "/contato", type: "link" as const },
                { label: "Autenticidade", href: "/autenticidade", type: "link" as const },
                { label: "FAQ", href: "#faq", type: "anchor" as const },
              ].map((item) =>
                item.type === "anchor" ? (
                  <a
                    key={item.label}
                    href={item.href}
                    onClick={() => setIsMenuOpen(false)}
                    className="px-3 py-3 rounded-xl text-indigo-100/80 hover:text-white hover:bg-white/5 transition-colors"
                  >
                    {item.label}
                  </a>
                ) : (
                  <Link
                    key={item.label}
                    to={item.href}
                    onClick={() => setIsMenuOpen(false)}
                    className="px-3 py-3 rounded-xl text-indigo-100/80 hover:text-white hover:bg-white/5 transition-colors"
                  >
                    {item.label}
                  </Link>
                )
              )}

              <div className="flex flex-col gap-3 pt-6 mt-2 border-t border-white/10">
                {user ? (
                  <Button
                    className="w-full justify-center h-12 text-base font-semibold gap-2 rounded-full bg-gradient-to-r from-indigo-500 to-violet-500 hover:from-indigo-400 hover:to-violet-400 text-white border-0"
                    onClick={() => {
                      setIsMenuOpen(false);
                      navigate("/dashboard");
                    }}
                  >
                    <LayoutDashboard className="w-5 h-5" />
                    Acessar Painel
                  </Button>
                ) : (
                  <>
                    <Button
                      variant="outline"
                      className="w-full justify-center h-12 text-base gap-2 rounded-full border-white/15 bg-white/[0.03] text-white hover:bg-white/5 hover:text-white"
                      onClick={() => {
                        setIsMenuOpen(false);
                        navigate("/auth");
                      }}
                    >
                      <LogIn className="w-5 h-5" />
                      Entrar
                    </Button>
                    <Button
                      className="w-full justify-center h-12 text-base font-semibold gap-2 rounded-full bg-gradient-to-r from-indigo-500 to-violet-500 hover:from-indigo-400 hover:to-violet-400 text-white border-0 shadow-[0_0_25px_-4px_rgba(129,140,248,0.7)]"
                      onClick={goToPricing}
                    >
                      <UserPlus className="w-5 h-5" />
                      Teste grátis 7 dias
                    </Button>
                  </>
                )}
              </div>
            </nav>
          </div>
        )}
      </div>
    </header>
  );
};

export default Header;
