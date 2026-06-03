import { useState, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { Helmet } from "react-helmet-async";
import Header from "@/components/landing/Header";
import Footer from "@/components/landing/Footer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ShieldCheck, Search, Loader2, CheckCircle2, XCircle, FileText, Calendar, Building2, User, Lock } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

export default function Autenticidade() {
  const [verificationCode, setVerificationCode] = useState("");
  const [isValidating, setIsValidating] = useState(false);
  const [occurrence, setOccurrence] = useState<any>(null);
  const [profile, setProfile] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [searchParams] = useSearchParams();
  const { toast } = useToast();

  useEffect(() => {
    const code = searchParams.get("code");
    if (code) {
      setVerificationCode(code.toUpperCase());
      validateCode(code.toUpperCase());
    }
  }, [searchParams]);

  const validateCode = async (code: string) => {
    if (!code.trim()) return;

    setIsValidating(true);
    setError(null);
    setOccurrence(null);
    setProfile(null);

    try {
      const cleanCode = code.trim().toUpperCase();
      
      // Try fetching by protocol first
      let { data, error: fetchError } = await supabase
        .from("porter_occurrences")
        .select(`
          *,
          condominium:condominiums(name)
        `)
        .filter("protocol", "eq", cleanCode)
        .maybeSingle();

      // If not found by protocol, try by ID (checking if it is a valid UUID first)
      const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(cleanCode);
      if (!data && isUuid) {
        const { data: idData, error: idError } = await supabase
          .from("porter_occurrences")
          .select(`
            *,
            condominium:condominiums(name)
          `)
          .eq("id", cleanCode.toLowerCase())
          .maybeSingle();
        
        if (idData) {
          data = idData;
          fetchError = idError;
        }
      }

      // If data was found, fetch the profile separately to avoid RLS/Join issues on public page
      if (data && data.registered_by) {
        const { data: profileData } = await supabase
          .from("profiles")
          .select("full_name, has_certificate")
          .eq("user_id", data.registered_by)
          .maybeSingle();
        
        setProfile(profileData);
      }

      if (fetchError || !data) {
        setError("Documento não encontrado ou código inválido.");
      } else {
        setOccurrence(data);
      }
    } catch (err) {
      console.error("Erro ao validar código:", err);
      setError("Ocorreu um erro ao validar o documento.");
    } finally {
      setIsValidating(false);
    }
  };

  const handleCodeChange = (value: string) => {
    // Remove everything that is not a number or /
    let cleanValue = value.replace(/[^\d/]/g, "");
    
    // Automatically add / after 4 digits if not present
    if (cleanValue.length > 4 && !cleanValue.includes("/")) {
      cleanValue = cleanValue.slice(0, 4) + "/" + cleanValue.slice(4);
    }
    
    // Limit size if necessary (YYYY/XXXX is usually 9 chars)
    setVerificationCode(cleanValue.toUpperCase());
  };

  const handleValidate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!verificationCode.trim()) {
      toast({
        title: "Campo obrigatório",
        description: "Por favor, insira o código de verificação.",
        variant: "destructive",
      });
      return;
    }
    validateCode(verificationCode);
  };

  return (
    <>
      <Helmet>
        <title>Autenticidade de Documentos - NotificaCondo</title>
        <meta name="description" content="Valide a veracidade de documentos emitidos pela plataforma NotificaCondo." />
      </Helmet>

      <div className="min-h-screen bg-background">
        <Header />
        
        <main className="pt-24 pb-16">
          <div className="container mx-auto px-4">
            <div className="max-w-2xl mx-auto space-y-10">
              <div className="text-center space-y-6 animate-in fade-in slide-in-from-bottom-6 duration-700">
                <div className="inline-flex items-center justify-center w-20 h-20 rounded-3xl bg-primary/10 mb-2 transform transition-transform hover:rotate-6 duration-300">
                  <ShieldCheck className="w-10 h-10 text-primary" />
                </div>
                <div className="space-y-3">
                  <h1 className="text-4xl md:text-5xl font-extrabold tracking-tight text-foreground">
                    Autenticidade de Documentos
                  </h1>
                  <p className="text-lg text-muted-foreground max-w-lg mx-auto leading-relaxed">
                    Utilize esta ferramenta oficial para validar a veracidade de ocorrências e notificações emitidas pela nossa plataforma.
                  </p>
                </div>
              </div>

              <Card className="border-border/50 shadow-xl shadow-primary/5 overflow-hidden transition-all duration-300 hover:shadow-primary/10 group animate-in fade-in slide-in-from-bottom-8 duration-700 delay-100">
                <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
                <CardHeader className="relative">
                  <CardTitle className="text-2xl">Validar Código</CardTitle>
                  <CardDescription className="text-base">
                    Insira o código alfanumérico ou protocolo impresso no documento para verificação imediata.
                  </CardDescription>
                </CardHeader>
                <CardContent className="relative">
                  <form onSubmit={handleValidate} className="space-y-6">
                    <div className="space-y-3">
                      <Label htmlFor="verificationCode" className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
                        Código de verificação
                      </Label>
                      <div className="flex flex-col sm:flex-row gap-3">
                        <div className="relative flex-1 group">
                          <Input
                            id="verificationCode"
                            placeholder="Ex: 2026/0029"
                            value={verificationCode}
                            onChange={(e) => handleCodeChange(e.target.value)}
                            className="uppercase font-mono h-14 text-xl px-5 border-2 transition-all duration-300 focus-visible:ring-primary/20 focus-visible:border-primary group-hover:border-primary/50"
                          />
                        </div>
                        <Button 
                          type="submit" 
                          size="lg" 
                          disabled={isValidating} 
                          className="h-14 px-8 text-lg font-bold shadow-lg shadow-primary/20 hover:shadow-primary/30 active:scale-95 transition-all duration-200"
                        >
                          {isValidating ? (
                            <Loader2 className="h-6 w-6 animate-spin" />
                          ) : (
                            <>
                              <Search className="mr-2 h-5 w-5" />
                              Validar
                            </>
                          )}
                        </Button>
                      </div>
                    </div>
                  </form>
                </CardContent>
              </Card>

              {isValidating && (
                <div className="flex flex-col items-center justify-center p-12 space-y-6 animate-in fade-in duration-500">
                  <div className="relative">
                    <div className="absolute inset-0 rounded-full bg-primary/20 animate-ping" />
                    <Loader2 className="w-12 h-12 text-primary animate-spin relative" />
                  </div>
                  <p className="text-muted-foreground font-medium text-lg animate-pulse">Consultando base de dados oficial...</p>
                </div>
              )}

              {error && (
                <div className="bg-destructive/5 border-2 border-destructive/20 rounded-2xl p-8 flex items-start gap-6 animate-in zoom-in-95 duration-500 shadow-lg shadow-destructive/5">
                  <div className="bg-destructive/10 p-3 rounded-xl">
                    <XCircle className="w-8 h-8 text-destructive shrink-0" />
                  </div>
                  <div>
                    <h3 className="text-xl font-bold text-destructive">Documento não autenticado</h3>
                    <p className="text-destructive/80 mt-2 leading-relaxed text-lg">
                      {error} Verifique se o código foi digitado corretamente. Caso o erro persista, este documento pode não ter sido emitido pela nossa plataforma oficial.
                    </p>
                  </div>
                </div>
              )}

              {occurrence && (
                <div className="bg-card border-2 border-emerald-500/20 rounded-2xl overflow-hidden animate-in zoom-in-95 duration-700 shadow-2xl shadow-emerald-500/10">
                  <div className="bg-emerald-500/10 p-8 border-b border-emerald-500/10">
                    <div className="flex items-start gap-6">
                      <div className="bg-emerald-500 p-3 rounded-2xl shadow-lg shadow-emerald-500/20 animate-bounce-subtle">
                        <CheckCircle2 className="w-10 h-10 text-white shrink-0" />
                      </div>
                      <div>
                        <h3 className="text-3xl font-black text-emerald-900 leading-tight tracking-tight">Documento Autêntico</h3>
                        <p className="text-emerald-700 mt-2 text-lg font-medium opacity-90">Este documento foi emitido e registrado em nossa plataforma NotificaCondo sob total conformidade.</p>
                      </div>
                    </div>
                  </div>

                  <div className="p-8 space-y-8">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                      <div className="flex items-center gap-5 group transition-transform duration-300 hover:translate-x-1">
                        <div className="p-3 bg-secondary rounded-xl group-hover:bg-primary/10 transition-colors">
                          <FileText className="w-6 h-6 text-primary" />
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground uppercase font-black tracking-widest mb-0.5">Título</p>
                          <p className="font-bold text-foreground text-lg">{occurrence.title}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-5 group transition-transform duration-300 hover:translate-x-1">
                        <div className="p-3 bg-secondary rounded-xl group-hover:bg-primary/10 transition-colors">
                          <Building2 className="w-6 h-6 text-primary" />
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground uppercase font-black tracking-widest mb-0.5">Condomínio</p>
                          <p className="font-bold text-foreground text-lg">{occurrence.condominium?.name}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-5 group transition-transform duration-300 hover:translate-x-1">
                        <div className="p-3 bg-secondary rounded-xl group-hover:bg-primary/10 transition-colors">
                          <Calendar className="w-6 h-6 text-primary" />
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground uppercase font-black tracking-widest mb-0.5">Data de Registro</p>
                          <p className="font-bold text-foreground text-lg">
                            {format(new Date(occurrence.created_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-5 group transition-transform duration-300 hover:translate-x-1">
                        <div className="p-3 bg-secondary rounded-xl group-hover:bg-primary/10 transition-colors">
                          <User className="w-6 h-6 text-primary" />
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground uppercase font-black tracking-widest mb-0.5">Registrado por</p>
                          <p className="font-bold text-foreground text-lg">
                            {profile?.full_name || "Sistema"}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-5 md:col-span-2 p-5 bg-primary/5 rounded-2xl border border-primary/10 group hover:border-primary/30 transition-all duration-300">
                        <div className="p-3 bg-primary/10 rounded-xl">
                          <ShieldCheck className="w-8 h-8 text-primary" />
                        </div>
                        <div>
                          <p className="text-xs text-primary/70 uppercase font-black tracking-widest mb-0.5">Protocolo de Verificação</p>
                          <p className="font-mono font-black text-primary text-2xl tracking-tighter">{occurrence.protocol || occurrence.id}</p>
                        </div>
                      </div>
                    </div>
                    
                    {profile?.has_certificate && (
                      <div className="mt-8 p-6 bg-emerald-600/5 border-2 border-emerald-600/20 rounded-2xl flex items-center gap-6 group hover:border-emerald-600/40 transition-all duration-300">
                        <div className="bg-emerald-600 p-4 rounded-xl shadow-lg shadow-emerald-600/20">
                          <Lock className="w-8 h-8 text-white" />
                        </div>
                        <div>
                          <h4 className="text-xl font-black text-emerald-900 leading-tight">Assinatura Digital ICP-Brasil</h4>
                          <p className="text-emerald-700/80 mt-1 font-medium">Este documento possui assinatura digital válida vinculada ao certificado do Síndico.</p>
                        </div>
                      </div>
                    )}

                    <div className="space-y-4 pt-4 border-t border-border/50">
                      <div className="flex items-center gap-2">
                        <div className="h-1 w-6 bg-primary rounded-full" />
                        <p className="text-xs text-muted-foreground uppercase font-black tracking-widest">Conteúdo do Documento</p>
                      </div>
                      <div className="bg-secondary/50 p-6 rounded-2xl border border-border/50 hover:border-primary/20 transition-colors duration-300">
                        <p className="text-foreground/90 leading-relaxed text-lg whitespace-pre-wrap">{occurrence.description}</p>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </main>

        <Footer />
      </div>
    </>
  );
}
