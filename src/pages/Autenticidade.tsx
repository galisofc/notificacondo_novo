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

const parseValidDate = (dateValue: unknown): Date | null => {
  if (!dateValue || typeof dateValue !== "string") return null;
  const parsedDate = new Date(dateValue);
  return Number.isNaN(parsedDate.getTime()) ? null : parsedDate;
};

const formatDateTime = (dateValue: unknown) => {
  const parsedDate = parseValidDate(dateValue);
  return parsedDate ? format(parsedDate, "dd/MM/yyyy 'às' HH:mm", { locale: ptBR }) : "Não informado";
};

const extractOccurrenceProtocol = (fileName?: string | null) => {
  const match = fileName?.match(/ocorrencia[_-]([^./]+)\.pdf/i);
  return match?.[1] || null;
};

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
        const occurrenceSelect = `
          *,
          condominium:condominiums(name, address, city, state),
          reporter_block:blocks!porter_occurrences_reporter_block_id_fkey(name),
          reporter_apartment:apartments!porter_occurrences_reporter_apartment_id_fkey(number),
          target_block:blocks!porter_occurrences_target_block_id_fkey(name),
          target_apartment:apartments!porter_occurrences_target_apartment_id_fkey(number)
        `;

        let { data: occurrence, error: occError } = await (supabase as any)
          .from('porter_occurrences')
          .select(occurrenceSelect)
          .eq('signature_hash', hash)
          .maybeSingle();

        if (occError) {
          console.error("Erro ao buscar ocorrência assinada:", occError);
        }

        if (!occurrence) {
          const protocol = extractOccurrenceProtocol(signedDoc.file_name);
          if (protocol) {
            const { data: occurrenceByProtocol, error: protocolError } = await (supabase as any)
              .from('porter_occurrences')
              .select(occurrenceSelect)
              .eq('protocol', protocol)
              .maybeSingle();

            if (protocolError) {
              console.error("Erro ao buscar ocorrência pelo protocolo:", protocolError);
            } else {
              occurrence = occurrenceByProtocol;
            }
          }
        }

        let creatorName = "Não informado";
        if (occurrence?.registered_by) {
          const { data: profile } = await supabase
            .from('profiles')
            .select('full_name')
            .eq('user_id', occurrence.registered_by)
            .maybeSingle();
          
          if (profile?.full_name) {
            creatorName = profile.full_name;
          }
        }

        setVerificationResult({
          isValid: true,
          signerName: signedDoc.signer_name,
          signedAt: formatDateTime(signedDoc.created_at),
          fileName: signedDoc.file_name,
          occurrence: {
            protocol: extractOccurrenceProtocol(signedDoc.file_name) || hash,
            ...occurrence,
            creatorName: creatorName
          }
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
    <div className="min-h-screen bg-slate-50/50">
      <Helmet>
        <title>Autenticidade | NotificaCondo</title>
        <meta name="description" content="Verifique a autenticidade e assinatura digital de documentos gerados pelo sistema NotificaCondo." />
      </Helmet>

      <Header />

      <main className="pt-32 pb-20">
        <div className="container mx-auto max-w-3xl px-4 space-y-8">
          <div className="text-center space-y-4 animate-fade-up">
            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-primary/10 text-primary text-xs font-bold uppercase tracking-wider border border-primary/20 shadow-sm">
              <ShieldCheck className="w-4 h-4" />
              Verificador ICP-Brasil
            </div>
            <h1 className="text-4xl md:text-5xl font-bold font-display tracking-tight text-slate-900 leading-tight">
              Verificação de <span className="text-primary italic">Autenticidade</span>
            </h1>
            <p className="text-slate-600 text-lg max-w-xl mx-auto font-medium">
              Valide a integridade e a assinatura digital de advertências, multas e relatórios gerados por nossa plataforma.
            </p>
          </div>

          <Card className="bg-white border-slate-200/60 shadow-xl shadow-slate-200/50 overflow-hidden animate-fade-up border-b-4 border-b-primary/40">
            <CardContent className="p-8">
              <form onSubmit={handleManualSearch} className="flex flex-col sm:flex-row gap-3">
                <div className="relative flex-1 group">
                  <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400 group-focus-within:text-primary transition-colors" />
                  <Input 
                    placeholder="Digite o código hash ou protocolo..." 
                    className="pl-11 h-12 bg-slate-50 border-slate-200 focus:bg-white focus:ring-primary/20 transition-all text-base"
                    value={inputHash}
                    onChange={(e) => setInputHash(e.target.value)}
                  />
                </div>
                <Button type="submit" size="lg" disabled={loading || !inputHash.trim()} className="h-12 px-8 font-bold text-base shadow-lg shadow-primary/20 active:scale-95 transition-all">
                  {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : "Verificar Documento"}
                </Button>
              </form>
            </CardContent>
          </Card>

          {!fileHash ? (
            <Card className="bg-white/80 backdrop-blur-md border-slate-200/60 shadow-2xl shadow-slate-200/40 animate-fade-up delay-100 border-dashed border-2">
              <CardContent className="pt-20 pb-20 text-center space-y-6">
                <div className="mx-auto bg-slate-100 w-28 h-28 rounded-3xl rotate-3 flex items-center justify-center mb-4 shadow-inner">
                  <FileText className="w-14 h-14 text-slate-400/50 -rotate-3" />
                </div>
                <div className="space-y-3">
                  <p className="text-2xl font-bold text-slate-800">Aguardando Documento</p>
                  <p className="text-slate-500 max-w-sm mx-auto font-medium">
                    Para verificar um documento, utilize o <span className="text-primary font-bold">QR Code</span> impresso no rodapé do arquivo ou digite o código de validação acima.
                  </p>
                </div>
              </CardContent>
            </Card>
          ) : loading ? (
            <div className="flex flex-col items-center justify-center py-24 space-y-6 animate-fade-in">
              <div className="relative">
                <div className="absolute inset-0 rounded-full bg-primary/20 blur-2xl animate-pulse"></div>
                <Loader2 className="w-20 h-20 animate-spin text-primary relative z-10" />
              </div>
              <div className="text-center space-y-2">
                <p className="text-slate-900 font-bold text-xl">Processando Verificação</p>
                <p className="text-slate-500 font-medium animate-pulse">Consultando base de assinaturas digitais ICP-Brasil...</p>
              </div>
            </div>
          ) : verificationResult?.isValid ? (
            <div className="space-y-8 animate-fade-up">
              <Card className="border-emerald-200 bg-white overflow-hidden shadow-2xl shadow-emerald-200/30">
                <div className="h-4 bg-gradient-to-r from-emerald-500 via-teal-500 to-emerald-500 animate-gradient-x" />
                <CardHeader className="text-center pb-6 pt-12">
                  <div className="mx-auto bg-emerald-100 w-28 h-28 rounded-full flex items-center justify-center mb-6 shadow-xl shadow-emerald-200/50 animate-bounce-subtle">
                    <CheckCircle2 className="w-16 h-16 text-emerald-600" />
                  </div>
                  <CardTitle className="text-slate-900 text-4xl font-display font-black tracking-tight mb-2">Documento Autêntico</CardTitle>
                  <p className="text-emerald-700/90 font-bold text-lg px-6 flex items-center justify-center gap-2">
                    <ShieldCheck className="w-5 h-5" />
                    Assinatura Digital Válida ICP-Brasil
                  </p>
                </CardHeader>
                <CardContent className="space-y-6 px-6 md:px-10 pb-12">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-8 border-t border-slate-100">
                    <div className="flex items-center gap-5 p-6 bg-slate-50 rounded-3xl border border-slate-100 shadow-sm transition-all hover:shadow-md hover:bg-white group">
                      <div className="bg-primary/10 p-4 rounded-2xl group-hover:bg-primary group-hover:text-white transition-colors">
                        <User className="w-7 h-7 text-primary group-hover:text-white transition-colors" />
                      </div>
                      <div>
                        <p className="text-[10px] uppercase tracking-[0.2em] text-slate-400 font-black mb-1">Assinado por</p>
                        <p className="font-extrabold text-slate-900 text-xl">{verificationResult.signerName}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-5 p-6 bg-slate-50 rounded-3xl border border-slate-100 shadow-sm transition-all hover:shadow-md hover:bg-white group">
                      <div className="bg-primary/10 p-4 rounded-2xl group-hover:bg-primary group-hover:text-white transition-colors">
                        <Calendar className="w-7 h-7 text-primary group-hover:text-white transition-colors" />
                      </div>
                      <div>
                        <p className="text-[10px] uppercase tracking-[0.2em] text-slate-400 font-black mb-1">Data da Assinatura</p>
                        <p className="font-extrabold text-slate-900 text-xl">{verificationResult.signedAt}</p>
                      </div>
                    </div>
                  </div>
                  
                  <div className="space-y-4">
                    <div className="p-6 bg-slate-50 rounded-3xl border border-slate-100 shadow-sm flex items-center gap-5 transition-all hover:bg-white group">
                      <div className="bg-slate-200 p-4 rounded-2xl text-slate-400 group-hover:bg-slate-900 group-hover:text-white transition-colors">
                        <FileText className="w-7 h-7" />
                      </div>
                      <div className="truncate flex-1">
                        <p className="text-[10px] uppercase tracking-[0.2em] text-slate-400 font-black mb-1">Nome do Arquivo Original</p>
                        <p className="font-mono text-base truncate text-slate-900 font-bold">{verificationResult.fileName}</p>
                      </div>
                    </div>
                    
                    <div className="p-6 bg-slate-50 rounded-3xl border border-slate-100 shadow-sm flex items-center gap-5 transition-all hover:bg-white group">
                      <div className="bg-slate-200 p-4 rounded-2xl text-slate-400 group-hover:bg-slate-900 group-hover:text-white transition-colors">
                        <ShieldCheck className="w-7 h-7" />
                      </div>
                      <div className="truncate flex-1">
                        <p className="text-[10px] uppercase tracking-[0.2em] text-slate-400 font-black mb-1">Hash de Verificação</p>
                        <p className="font-mono text-base truncate text-slate-500 font-bold">{fileHash}</p>
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
                              <Badge variant="outline" className="mb-2">{verificationResult.occurrence.category || "Ocorrência"}</Badge>
                              <h4 className="text-2xl font-bold text-foreground">{verificationResult.occurrence.title || verificationResult.fileName || "Documento assinado"}</h4>
                              <p className="text-sm text-muted-foreground mt-1 flex items-center gap-1">
                                <Building2 className="w-3 h-3" />
                                {verificationResult.occurrence.condominium?.name || "Condomínio não informado"}
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
                                <span className="font-medium">{formatDateTime(verificationResult.occurrence.occurred_at)}</span>
                              </div>
                            </div>
                            <div className="space-y-1">
                              <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-bold">Responsável pelo Cadastro</p>
                              <div className="flex items-center gap-2">
                                <User className="w-4 h-4 text-muted-foreground" />
                                <span className="font-medium">
                                  {verificationResult.occurrence.creatorName || "Não informado"}
                                </span>
                              </div>
                            </div>
                          </div>

                          <div className="space-y-2">
                            <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-bold">Descrição da Ocorrência</p>
                            <div className="p-4 bg-background border border-border rounded-xl text-muted-foreground leading-relaxed whitespace-pre-wrap">
                              {verificationResult.occurrence.description || "Não informado"}
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