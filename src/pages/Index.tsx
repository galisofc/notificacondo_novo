import { Helmet } from "react-helmet-async";
import { CSSProperties } from "react";
import Header from "@/components/landing/Header";
import Hero from "@/components/landing/Hero";
import Features from "@/components/landing/Features";
import Workflow from "@/components/landing/Workflow";
import Testimonials from "@/components/landing/Testimonials";
import Pricing from "@/components/landing/Pricing";
import FAQ from "@/components/landing/FAQ";
import CTA from "@/components/landing/CTA";
import Footer from "@/components/landing/Footer";

// Midnight Indigo palette override, scoped to the landing wrapper
const midnightTokens = {
  "--background": "230 60% 4%",
  "--foreground": "210 40% 98%",
  "--card": "230 40% 8%",
  "--card-foreground": "210 40% 98%",
  "--popover": "230 40% 8%",
  "--popover-foreground": "210 40% 98%",
  "--primary": "243 75% 59%",
  "--primary-foreground": "210 40% 98%",
  "--secondary": "230 30% 14%",
  "--secondary-foreground": "210 40% 98%",
  "--muted": "230 30% 14%",
  "--muted-foreground": "215 20% 65%",
  "--accent": "243 75% 59%",
  "--accent-foreground": "210 40% 98%",
  "--border": "230 30% 15%",
  "--input": "230 30% 15%",
  "--ring": "243 75% 59%",
} as CSSProperties;

const Index = () => {
  return (
    <>
      <Helmet>
        <title>NotificaCondo - Sistema de Multas e Notificações para Condomínios</title>
        <meta 
          name="description" 
          content="Plataforma SaaS para gestão de notificações, advertências e multas condominiais com prova jurídica automática, conformidade LGPD e integração WhatsApp." 
        />
        <meta name="keywords" content="notificação condomínio, multa condominial, gestão condominial, síndico, LGPD, prova jurídica" />
        <link rel="canonical" href="https://notificacondo.com.br" />
      </Helmet>
      
      <div className="dark min-h-screen bg-background text-foreground" style={midnightTokens}>
        <Header />
        <main>
          <Hero />
          <Features />
          <Workflow />
          <Testimonials />
          <Pricing />
          <FAQ />
          <CTA />
        </main>
        <Footer />
      </div>
    </>
  );
};

export default Index;
