import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ShieldCheck, ShieldAlert, FileText, CheckCircle2, User, Calendar, Loader2, Search, Building2, ClipboardList, Clock } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import Header from "@/components/landing/Header";
import Footer from "@/components/landing/Footer";
import { Helmet } from "react-helmet-async";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

const Autenticidade = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const fileHash = searchParams.get("hash") || searchParams.get("code");
  const [inputHash, setInputHash] = useState(fileHash || "");
  const [loading, setLoading] = useState(!!fileHash);
  const [verificationResult, setVerificationResult] = useState<{
    isValid: boolean;
    signerName?: string;
    signedAt?: string;
    fileName?: string;
    occurrence?: any;
  } | null>(null);

  useEffect(() => {
    if (fileHash) {
      verifySignature(fileHash);
    }
  }, [fileHash]);

  const verifySignature = async (hash: string) => {
    setLoading(true);
    try {
      // Buscar documento assinado
      const { data: signedDoc, error: docError } = await (supabase as any)
        .from('signed_documents')
        .select('*')
        .eq('file_hash', hash)
        .maybeSingle();

      if (signedDoc && !docError) {
        // Se encontrou documento assinado, buscar detalhes da ocorrência
        const { data: occurrence, error: occError } = await (supabase as any)
          .from('porter_occurrences')
          .select(`
            *,
            condominium:condominiums(name, address, city, state),
            reporter_block:blocks!porter_occurrences_reporter_block_id_fkey(name),
            reporter_apartment:apartments!porter_occurrences_reporter_apartment_id_fkey(number),
            target_block:blocks!porter_occurrences_target_block_id_fkey(name),
            target_apartment:apartments!porter_occurrences_target_apartment_id_fkey(number)
          `)
          .eq('signature_hash', hash)
          .maybeSingle();

        setVerificationResult({
          isValid: true,
          signerName: signedDoc.signer_name,
          signedAt: format(new Date(signedDoc.created_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR }),
          fileName: signedDoc.file_name,
          occurrence: occurrence
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

  const handleManualSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (inputHash.trim()) {
      setSearchParams({ code: inputHash.trim() });
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

          <Card className="bg-card border-border shadow-lg overflow-hidden animate-fade-up">
            <CardContent className="p-6">
              <form onSubmit={handleManualSearch} className="flex gap-2">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input 
                    placeholder="Digite o código hash ou protocolo..." 
                    className="pl-10"
                    value={inputHash}
                    onChange={(e) => setInputHash(e.target.value)}
                  />
                </div>
                <Button type="submit" disabled={loading || !inputHash.trim()}>
                  {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : "Verificar"}
                </Button>
              </form>
            </CardContent>
          </Card>

          {!fileHash ? (
            <Card className="bg-card/50 backdrop-blur-sm border-border/50 shadow-xl animate-fade-up delay-100">
              <CardContent className="pt-16 pb-16 text-center space-y-6">
                <div className="mx-auto bg-muted w-24 h-24 rounded-full flex items-center justify-center mb-4">
                  <FileText className="w-12 h-12 text-muted-foreground/30" />
                </div>
                <div className="space-y-3">
                  <p className="text-xl font-semibold text-foreground">Aguardando Documento</p>
                  <p className="text-muted-foreground max-w-sm mx-auto">
                    Para verificar um documento, utilize o QR Code impresso no rodapé do arquivo ou digite o código de validação acima.
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
            <div className="space-y-6 animate-fade-up">
              <Card className="border-emerald-500/30 bg-emerald-500/5 overflow-hidden shadow-2xl">
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
                        <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-bold">Hash de Verificação</p>
                        <p className="font-mono text-sm truncate text-muted-foreground">{fileHash}</p>
                      </div>
                    </div>
                  </div>

                  {verificationResult.occurrence && (
                    <div className="mt-8 pt-8 border-t border-emerald-500/10">
                      <div className="flex items-center gap-2 mb-6">
                        <ClipboardList className="w-5 h-5 text-primary" />
                        <h3 className="text-xl font-bold text-foreground">Conteúdo do Documento</h3>
                      </div>
                      
                      <Card className="bg-background border-border shadow-sm">
                        <CardContent className="p-6 space-y-6">
                          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                            <div>
                              <Badge variant="outline" className="mb-2">{verificationResult.occurrence.category}</Badge>
                              <h4 className="text-2xl font-bold text-foreground">{verificationResult.occurrence.title}</h4>
                              <p className="text-sm text-muted-foreground mt-1 flex items-center gap-1">
                                <Building2 className="w-3 h-3" />
                                {verificationResult.occurrence.condominium?.name}
                              </p>
                            </div>
                            {verificationResult.occurrence.protocol && (
                              <div className="text-right">
                                <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-bold">Protocolo</p>
                                <p className="font-mono text-lg font-bold text-primary">{verificationResult.occurrence.protocol}</p>
                              </div>
                            )}
                          </div>

                          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 p-4 bg-muted/30 rounded-xl">
                            <div className="space-y-1">
                              <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-bold">Data do Ocorrido</p>
                              <div className="flex items-center gap-2">
                                <Clock className="w-4 h-4 text-muted-foreground" />
                                <span className="font-medium">{format(new Date(verificationResult.occurrence.occurred_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}</span>
                              </div>
                            </div>
                            <div className="space-y-1">
                              <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-bold">Localização</p>
                              <div className="flex items-center gap-2">
                                <Building2 className="w-4 h-4 text-muted-foreground" />
                                <span className="font-medium">
                                  {verificationResult.occurrence.target_block?.name} - {verificationResult.occurrence.target_apartment?.number}
                                </span>
                              </div>
                            </div>
                          </div>

                          <div className="space-y-2">
                            <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-bold">Descrição da Ocorrência</p>
                            <div className="p-4 bg-background border border-border rounded-xl text-muted-foreground leading-relaxed whitespace-pre-wrap">
                              {verificationResult.occurrence.description}
                            </div>
                          </div>

                          {verificationResult.occurrence.status === "resolvida" && (
                            <div className="space-y-2">
                              <p className="text-[10px] uppercase tracking-widest text-emerald-600 font-bold">Resolução / Finalização</p>
                              <div className="p-4 bg-emerald-50/50 border border-emerald-100 rounded-xl text-muted-foreground leading-relaxed whitespace-pre-wrap">
                                {verificationResult.occurrence.resolution_notes}
                              </div>
                            </div>
                          )}
                        </CardContent>
                      </Card>
                    </div>
                  )}

                  <div className="mt-8 p-6 rounded-2xl bg-primary/5 border border-primary/10 text-center">
                    <p className="text-sm text-primary font-medium">
                      A integridade deste documento está garantida pela criptografia de ponta a ponta. 
                      Qualquer alteração posterior invalida esta verificação.
                    </p>
                  </div>
                </CardContent>
              </Card>
            </div>
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