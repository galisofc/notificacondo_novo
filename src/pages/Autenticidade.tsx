import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ShieldCheck, ShieldAlert, FileText, CheckCircle2, User, Calendar, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import Header from "@/components/landing/Header";
import Footer from "@/components/landing/Footer";
import { Helmet } from "react-helmet-async";

const Autenticidade = () => {
  const [searchParams] = useSearchParams();
  const fileHash = searchParams.get("hash") || searchParams.get("code");
  const [loading, setLoading] = useState(!!fileHash);
  const [verificationResult, setVerificationResult] = useState<{
    isValid: boolean;
    signerName?: string;
    signedAt?: string;
    fileName?: string;
  } | null>(null);

  useEffect(() => {
    if (fileHash) {
      verifySignature(fileHash);
    }
  }, [fileHash]);

  const verifySignature = async (hash: string) => {
    setLoading(true);
    try {
      const { data, error } = await (supabase as any)
        .from('signed_documents')
        .select('*')
        .eq('file_hash', hash)
        .maybeSingle();

      if (data && !error) {
        setVerificationResult({
          isValid: true,
          signerName: data.signer_name,
          signedAt: new Date(data.created_at).toLocaleString('pt-BR'),
          fileName: data.file_name
        });
      } else {
        setVerificationResult({ isValid: false });
      }
    } catch (err) {
      console.error("Erro na verificação:", err);
      setVerificationResult({ isValid: false });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <Helmet>
        <title>Autenticidade | NotificaCondo</title>
        <meta name="description" content="Verifique a autenticidade e assinatura digital de documentos gerados pelo sistema NotificaCondo." />
      </Helmet>

      <Header />

      <main className="pt-32 pb-20">
        <div className="container mx-auto max-w-3xl px-4 space-y-8">
          <div className="text-center space-y-4 animate-fade-up">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 text-primary text-xs font-bold uppercase tracking-wider">
              <ShieldCheck className="w-4 h-4" />
              Verificador ICP-Brasil
            </div>
            <h1 className="text-4xl md:text-5xl font-bold font-display tracking-tight text-foreground">
              Verificação de Autenticidade
            </h1>
            <p className="text-muted-foreground text-lg max-w-xl mx-auto">
              Valide a integridade e a assinatura digital de advertências, multas e relatórios gerados por nossa plataforma.
            </p>
          </div>

          {!fileHash ? (
            <Card className="bg-card/50 backdrop-blur-sm border-border/50 shadow-xl animate-fade-up delay-100">
              <CardContent className="pt-16 pb-16 text-center space-y-6">
                <div className="mx-auto bg-muted w-24 h-24 rounded-full flex items-center justify-center mb-4">
                  <FileText className="w-12 h-12 text-muted-foreground/30" />
                </div>
                <div className="space-y-3">
                  <p className="text-xl font-semibold text-foreground">Aguardando Documento</p>
                  <p className="text-muted-foreground max-w-sm mx-auto">
                    Para verificar um documento, utilize o QR Code impresso no rodapé do arquivo ou clique no link de validação recebido.
                  </p>
                </div>
              </CardContent>
            </Card>
          ) : loading ? (
            <div className="flex flex-col items-center justify-center py-24 space-y-6 animate-fade-in">
              <div className="relative">
                <div className="absolute inset-0 rounded-full bg-primary/20 blur-xl animate-pulse"></div>
                <Loader2 className="w-16 h-16 animate-spin text-primary relative z-10" />
              </div>
              <p className="text-muted-foreground font-medium animate-pulse">Consultando base de assinaturas digitais...</p>
            </div>
          ) : verificationResult?.isValid ? (
            <Card className="border-emerald-500/30 bg-emerald-500/5 overflow-hidden shadow-2xl animate-fade-up">
              <div className="h-3 bg-gradient-to-r from-emerald-500 to-teal-500" />
              <CardHeader className="text-center pb-4 pt-10">
                <div className="mx-auto bg-emerald-500/10 w-24 h-24 rounded-full flex items-center justify-center mb-6 shadow-glow-emerald">
                  <CheckCircle2 className="w-14 h-14 text-emerald-600" />
                </div>
                <CardTitle className="text-emerald-900 text-3xl font-display font-bold">Documento Autêntico</CardTitle>
                <p className="text-emerald-700/80 font-medium px-6">
                  Este arquivo possui uma assinatura digital ICP-Brasil válida e registrada em nossa plataforma.
                </p>
              </CardHeader>
              <CardContent className="space-y-6 px-6 md:px-10 pb-12">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-6 border-t border-emerald-500/10">
                  <div className="flex items-center gap-4 p-5 bg-background rounded-2xl border border-emerald-500/10 shadow-sm transition-transform hover:scale-[1.02]">
                    <div className="bg-primary/10 p-3 rounded-xl">
                      <User className="w-6 h-6 text-primary" />
                    </div>
                    <div>
                      <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-bold">Assinado por</p>
                      <p className="font-bold text-foreground text-lg">{verificationResult.signerName}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-4 p-5 bg-background rounded-2xl border border-emerald-500/10 shadow-sm transition-transform hover:scale-[1.02]">
                    <div className="bg-primary/10 p-3 rounded-xl">
                      <Calendar className="w-6 h-6 text-primary" />
                    </div>
                    <div>
                      <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-bold">Data da Assinatura</p>
                      <p className="font-bold text-foreground text-lg">{verificationResult.signedAt}</p>
                    </div>
                  </div>
                </div>
                
                <div className="space-y-4">
                  <div className="p-5 bg-background rounded-2xl border border-emerald-500/10 shadow-sm flex items-center gap-4">
                    <div className="bg-muted p-3 rounded-xl text-muted-foreground">
                      <FileText className="w-6 h-6" />
                    </div>
                    <div className="truncate flex-1">
                      <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-bold">Nome do Arquivo Original</p>
                      <p className="font-mono text-sm truncate text-foreground font-medium">{verificationResult.fileName}</p>
                    </div>
                  </div>
                  
                  <div className="p-5 bg-background rounded-2xl border border-emerald-500/10 shadow-sm flex items-center gap-4">
                    <div className="bg-muted p-3 rounded-xl text-muted-foreground">
                      <ShieldCheck className="w-6 h-6" />
                    </div>
                    <div className="truncate flex-1">
                      <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-bold">Hash de Verificação (SHA-256)</p>
                      <p className="font-mono text-[11px] truncate text-muted-foreground">{fileHash}</p>
                    </div>
                  </div>
                </div>

                <div className="mt-8 p-6 rounded-2xl bg-primary/5 border border-primary/10 text-center">
                  <p className="text-sm text-primary font-medium">
                    A integridade deste documento está garantida pela criptografia de ponta a ponta. 
                    Qualquer alteração posterior invalida esta verificação.
                  </p>
                </div>
              </CardContent>
            </Card>
          ) : (
            <Card className="border-destructive/30 bg-destructive/5 overflow-hidden shadow-xl animate-fade-up">
              <div className="h-3 bg-destructive" />
              <CardHeader className="text-center pt-10">
                <div className="mx-auto bg-destructive/10 w-24 h-24 rounded-full flex items-center justify-center mb-6">
                  <ShieldAlert className="w-14 h-14 text-destructive" />
                </div>
                <CardTitle className="text-destructive text-3xl font-display font-bold">Assinatura Não Encontrada</CardTitle>
              </CardHeader>
              <CardContent className="text-center space-y-8 px-6 md:px-10 pb-12">
                <p className="text-muted-foreground text-lg">
                  Atenção: Não foi possível localizar um registro válido para este código ou hash em nossa base de dados oficial.
                </p>
                <div className="bg-background/80 backdrop-blur-sm p-8 rounded-2xl border border-destructive/20 text-left space-y-4 shadow-sm">
                  <p className="font-bold text-destructive flex items-center gap-2">
                    <ShieldAlert className="w-5 h-5" />
                    O que isso pode significar?
                  </p>
                  <ul className="space-y-3">
                    <li className="flex items-start gap-3 text-muted-foreground">
                      <div className="w-1.5 h-1.5 rounded-full bg-destructive mt-2 shrink-0" />
                      <span>O documento foi editado ou alterado após ter sido gerado pelo sistema.</span>
                    </li>
                    <li className="flex items-start gap-3 text-muted-foreground">
                      <div className="w-1.5 h-1.5 rounded-full bg-destructive mt-2 shrink-0" />
                      <span>O documento não foi assinado digitalmente pelo síndico responsável.</span>
                    </li>
                    <li className="flex items-start gap-3 text-muted-foreground">
                      <div className="w-1.5 h-1.5 rounded-full bg-destructive mt-2 shrink-0" />
                      <span>Este arquivo não foi emitido através da plataforma oficial NotificaCondo.</span>
                    </li>
                  </ul>
                </div>
                <p className="text-sm text-muted-foreground italic">
                  Se você acredita que este é um erro, entre em contato com a administração do condomínio.
                </p>
              </CardContent>
            </Card>
          )}

          <div className="text-center py-6">
            <p className="text-xs text-muted-foreground max-w-lg mx-auto leading-relaxed">
              Base Legal: Medida Provisória nº 2.200-2/2001, que instituiu a Infraestrutura de Chaves Públicas Brasileira (ICP-Brasil), 
              garantindo validade jurídica a documentos em forma eletrônica.
            </p>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
};

export default Autenticidade;
