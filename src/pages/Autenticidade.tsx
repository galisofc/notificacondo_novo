import { useState, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { Helmet } from "react-helmet-async";
import Header from "@/components/landing/Header";
import Footer from "@/components/landing/Footer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ShieldCheck, Search, Loader2, CheckCircle2, XCircle, FileText, Calendar, Building2, User } from "lucide-react";
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
          .select("full_name")
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
            <div className="max-w-2xl mx-auto space-y-8">
              <div className="text-center space-y-4">
                <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-primary/10 mb-2">
                  <ShieldCheck className="w-8 h-8 text-primary" />
                </div>
                <h1 className="text-4xl font-bold tracking-tight text-foreground">
                  Autenticidade de Documentos
                </h1>
                <p className="text-lg text-muted-foreground max-w-lg mx-auto">
                  Utilize esta ferramenta oficial para validar a veracidade de ocorrências e notificações emitidas pela nossa plataforma.
                </p>
              </div>

              <Card className="border-border shadow-lg">
                <CardHeader>
                  <CardTitle>Validar Código</CardTitle>
                  <CardDescription>
                    Insira o código alfanumérico ou protocolo impresso no documento para verificação imediata.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <form onSubmit={handleValidate} className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="verificationCode">Código de verificação</Label>
                      <div className="flex gap-2">
                        <Input
                          id="verificationCode"
                          placeholder="Ex: 2026/0029"
                          value={verificationCode}
                          onChange={(e) => setVerificationCode(e.target.value)}
                          className="uppercase font-mono h-12 text-lg"
                        />
                        <Button type="submit" size="lg" disabled={isValidating} className="px-6">
                          {isValidating ? (
                            <Loader2 className="h-5 w-5 animate-spin" />
                          ) : (
                            <Search className="h-5 w-5" />
                          )}
                        </Button>
                      </div>
                    </div>
                  </form>
                </CardContent>
              </Card>

              {isValidating && (
                <div className="flex flex-col items-center justify-center p-12 space-y-4">
                  <Loader2 className="w-10 h-10 text-primary animate-spin" />
                  <p className="text-muted-foreground font-medium">Consultando base de dados oficial...</p>
                </div>
              )}

              {error && (
                <div className="bg-destructive/10 border border-destructive/20 rounded-xl p-8 flex items-start gap-5 animate-in fade-in slide-in-from-top-4">
                  <XCircle className="w-8 h-8 text-destructive shrink-0" />
                  <div>
                    <h3 className="text-lg font-bold text-destructive">Documento não autenticado</h3>
                    <p className="text-destructive/80 mt-1 leading-relaxed">
                      {error} Verifique se o código foi digitado corretamente. Caso o erro persista, este documento pode não ter sido emitido pela nossa plataforma oficial.
                    </p>
                  </div>
                </div>
              )}

              {occurrence && (
                <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-8 space-y-8 animate-in fade-in slide-in-from-top-4 shadow-sm">
                  <div className="flex items-start gap-5">
                    <div className="bg-emerald-100 p-2 rounded-full">
                      <CheckCircle2 className="w-10 h-10 text-emerald-600 shrink-0" />
                    </div>
                    <div>
                      <h3 className="text-2xl font-bold text-emerald-900 leading-tight">Documento Autêntico</h3>
                      <p className="text-emerald-700 mt-1">Este documento foi emitido e registrado em nossa plataforma NotificaCondo sob total conformidade.</p>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-6 border-t border-emerald-200/50">
                    <div className="flex items-center gap-4">
                      <div className="p-2 bg-emerald-100/50 rounded-lg">
                        <FileText className="w-5 h-5 text-emerald-600" />
                      </div>
                      <div>
                        <p className="text-xs text-emerald-600 uppercase font-bold tracking-wider">Título</p>
                        <p className="font-semibold text-emerald-950">{occurrence.title}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      <div className="p-2 bg-emerald-100/50 rounded-lg">
                        <Building2 className="w-5 h-5 text-emerald-600" />
                      </div>
                      <div>
                        <p className="text-xs text-emerald-600 uppercase font-bold tracking-wider">Condomínio</p>
                        <p className="font-semibold text-emerald-950">{occurrence.condominium?.name}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      <div className="p-2 bg-emerald-100/50 rounded-lg">
                        <Calendar className="w-5 h-5 text-emerald-600" />
                      </div>
                      <div>
                        <p className="text-xs text-emerald-600 uppercase font-bold tracking-wider">Data de Registro</p>
                        <p className="font-semibold text-emerald-950">
                          {format(new Date(occurrence.created_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      <div className="p-2 bg-emerald-100/50 rounded-lg">
                        <User className="w-5 h-5 text-emerald-600" />
                      </div>
                      <div>
                        <p className="text-xs text-emerald-600 uppercase font-bold tracking-wider">Registrado por</p>
                        <p className="font-semibold text-emerald-950">
                          {profile?.full_name || "Sistema"}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-4 md:col-span-2">
                      <div className="p-2 bg-emerald-100/50 rounded-lg">
                        <ShieldCheck className="w-5 h-5 text-emerald-600" />
                      </div>
                      <div>
                        <p className="text-xs text-emerald-600 uppercase font-bold tracking-wider">Protocolo de Verificação</p>
                        <p className="font-mono font-bold text-emerald-900 text-lg">{occurrence.protocol || occurrence.id}</p>
                      </div>
                    </div>
                  </div>

                  <div className="bg-white/60 p-6 rounded-lg border border-emerald-100">
                    <p className="text-xs text-emerald-600 uppercase font-bold tracking-wider mb-2">Conteúdo do Documento</p>
                    <p className="text-emerald-950 leading-relaxed whitespace-pre-wrap">{occurrence.description}</p>
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
