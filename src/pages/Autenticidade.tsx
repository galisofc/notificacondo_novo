import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ShieldCheck, ShieldAlert, FileText, CheckCircle2, User, Calendar } from "lucide-react";
import { Button } from "@/components/ui/button";
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
      // Aqui faremos a chamada para o Supabase para verificar o registro da assinatura
      // Por enquanto, simulamos uma busca na tabela de logs de assinaturas que criaremos
      const { data, error } = await supabase
        .from('signed_documents')
        .select('*')
        .eq('file_hash', hash)
        .single();

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
      setVerificationResult({ isValid: false });
    } finally {
      setLoading(false);
    }
  };

  return (
    <DashboardLayout>
      <div className="max-w-3xl mx-auto py-10 space-y-6">
        <div className="text-center space-y-2">
          <h1 className="text-3xl font-bold">Verificação de Autenticidade</h1>
          <p className="text-muted-foreground">Valide a assinatura digital de documentos gerados pelo sistema.</p>
        </div>

        {!fileHash ? (
          <Card>
            <CardContent className="pt-6 text-center">
              <FileText className="w-12 h-12 mx-auto text-muted-foreground/30 mb-4" />
              <p>Para verificar um documento, utilize o QR Code ou link impresso no rodapé do PDF.</p>
            </CardContent>
          </Card>
        ) : loading ? (
          <div className="flex justify-center py-20">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
          </div>
        ) : verificationResult?.isValid ? (
          <Card className="border-green-500/50 bg-green-500/5">
            <CardHeader className="text-center">
              <CheckCircle2 className="w-16 h-16 mx-auto text-green-500 mb-2" />
              <CardTitle className="text-green-700 text-2xl">Documento Autêntico</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="flex items-center gap-3 p-3 bg-white rounded-lg border">
                  <User className="text-primary" />
                  <div>
                    <p className="text-xs text-muted-foreground">Assinado por</p>
                    <p className="font-semibold">{verificationResult.signerName}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3 p-3 bg-white rounded-lg border">
                  <Calendar className="text-primary" />
                  <div>
                    <p className="text-xs text-muted-foreground">Data da Assinatura</p>
                    <p className="font-semibold">{verificationResult.signedAt}</p>
                  </div>
                </div>
              </div>
              <div className="p-4 bg-white rounded-lg border flex items-center gap-3">
                <FileText className="text-muted-foreground" />
                <div className="truncate">
                  <p className="text-xs text-muted-foreground">Arquivo</p>
                  <p className="font-mono text-sm truncate">{verificationResult.fileName}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        ) : (
          <Card className="border-destructive/50 bg-destructive/5">
            <CardHeader className="text-center">
              <ShieldAlert className="w-16 h-16 mx-auto text-destructive mb-2" />
              <CardTitle className="text-destructive">Assinatura Não Encontrada</CardTitle>
            </CardHeader>
            <CardContent className="text-center">
              <p>Não foi possível validar este documento em nossa base de dados. Ele pode ter sido alterado ou não foi gerado pelo sistema.</p>
            </CardContent>
          </Card>
        )}
      </div>
    </DashboardLayout>
  );
};

export default Autenticidade;
