import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ShieldCheck, ShieldAlert, FileText, CheckCircle2, User, Calendar, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import DashboardLayout from "@/components/layouts/DashboardLayout";

const Autenticidade = () => {
  const [searchParams] = useSearchParams();
  const fileHash = searchParams.get("hash");
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
      // Usamos uma query genérica para evitar erros de tipagem do TS enquanto a tabela não é reconhecida no schema local
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
    <DashboardLayout>
      <div className="max-w-3xl mx-auto py-10 px-4 space-y-6">
        <div className="text-center space-y-2">
          <h1 className="text-3xl font-bold font-display">Verificação de Autenticidade</h1>
          <p className="text-muted-foreground">Valide a assinatura digital de documentos gerados pelo sistema.</p>
        </div>

        {!fileHash ? (
          <Card className="bg-gradient-card border-border/50">
            <CardContent className="pt-10 pb-10 text-center space-y-4">
              <FileText className="w-16 h-16 mx-auto text-muted-foreground/20" />
              <div className="space-y-2">
                <p className="font-medium">Nenhum hash de documento fornecido.</p>
                <p className="text-sm text-muted-foreground max-w-sm mx-auto">
                  Para verificar um documento, utilize o QR Code ou o link de verificação impresso no rodapé do arquivo PDF.
                </p>
              </div>
            </CardContent>
          </Card>
        ) : loading ? (
          <div className="flex flex-col items-center justify-center py-20 space-y-4">
            <Loader2 className="w-12 h-12 animate-spin text-primary" />
            <p className="text-muted-foreground animate-pulse">Consultando base de assinaturas...</p>
          </div>
        ) : verificationResult?.isValid ? (
          <Card className="border-green-500/30 bg-green-500/5 overflow-hidden">
            <div className="h-2 bg-green-500" />
            <CardHeader className="text-center pb-2">
              <div className="mx-auto bg-green-500/10 w-20 h-20 rounded-full flex items-center justify-center mb-4">
                <CheckCircle2 className="w-12 h-12 text-green-600" />
              </div>
              <CardTitle className="text-green-800 text-2xl font-display">Documento Autêntico</CardTitle>
              <p className="text-green-600/80 text-sm">Este arquivo possui uma assinatura digital válida registrada em nossa plataforma.</p>
            </CardHeader>
            <CardContent className="space-y-6 pt-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="flex items-center gap-3 p-4 bg-background rounded-xl border border-green-500/10 shadow-sm">
                  <div className="bg-primary/10 p-2 rounded-lg">
                    <User className="w-5 h-5 text-primary" />
                  </div>
                  <div>
                    <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-bold">Assinado por</p>
                    <p className="font-semibold text-foreground">{verificationResult.signerName}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3 p-4 bg-background rounded-xl border border-green-500/10 shadow-sm">
                  <div className="bg-primary/10 p-2 rounded-lg">
                    <Calendar className="w-5 h-5 text-primary" />
                  </div>
                  <div>
                    <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-bold">Data da Assinatura</p>
                    <p className="font-semibold text-foreground">{verificationResult.signedAt}</p>
                  </div>
                </div>
              </div>
              <div className="p-4 bg-background rounded-xl border border-green-500/10 shadow-sm flex items-center gap-3">
                <div className="bg-muted p-2 rounded-lg">
                  <FileText className="w-5 h-5 text-muted-foreground" />
                </div>
                <div className="truncate flex-1">
                  <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-bold">Nome do Arquivo</p>
                  <p className="font-mono text-xs truncate text-foreground">{verificationResult.fileName}</p>
                </div>
              </div>
              <div className="p-4 bg-background rounded-xl border border-green-500/10 shadow-sm flex items-center gap-3">
                <div className="bg-muted p-2 rounded-lg">
                  <ShieldCheck className="w-5 h-5 text-muted-foreground" />
                </div>
                <div className="truncate flex-1">
                  <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-bold">Hash de Verificação (SHA-256)</p>
                  <p className="font-mono text-[10px] truncate text-muted-foreground">{fileHash}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        ) : (
          <Card className="border-destructive/30 bg-destructive/5 overflow-hidden">
            <div className="h-2 bg-destructive" />
            <CardHeader className="text-center">
              <div className="mx-auto bg-destructive/10 w-20 h-20 rounded-full flex items-center justify-center mb-4">
                <ShieldAlert className="w-12 h-12 text-destructive" />
              </div>
              <CardTitle className="text-destructive font-display">Assinatura Não Encontrada</CardTitle>
            </CardHeader>
            <CardContent className="text-center space-y-4">
              <p className="text-muted-foreground">
                Não foi possível validar este documento em nossa base de dados.
              </p>
              <div className="bg-background/50 p-4 rounded-lg border text-sm text-left space-y-2">
                <p className="font-bold text-destructive">Possíveis causas:</p>
                <ul className="list-disc list-inside space-y-1 text-muted-foreground">
                  <li>O documento foi alterado após ser gerado.</li>
                  <li>O documento não foi assinado digitalmente.</li>
                  <li>O link ou QR Code está incorreto.</li>
                </ul>
              </div>
            </CardContent>
          </Card>
        )}
        
        <div className="text-center">
          <p className="text-xs text-muted-foreground">
            A assinatura digital ICP-Brasil garante a integridade e a autenticidade deste documento conforme a MP 2.200-2/2001.
          </p>
        </div>
      </div>
    </DashboardLayout>
  );
};

export default Autenticidade;
