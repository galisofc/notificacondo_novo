import { useState, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ShieldCheck, Search, Loader2, CheckCircle2, XCircle, FileText, Calendar, Building2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

export default function Autenticidade() {
  const [verificationCode, setVerificationCode] = useState("");
  const [isValidating, setIsValidating] = useState(false);
  const [occurrence, setOccurrence] = useState<any>(null);
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

    try {
      const cleanCode = code.trim().toUpperCase();
      
      const { data, error: fetchError } = await supabase
        .from("porter_occurrences")
        .select(`
          *,
          condominium:condominiums(name)
        `)
        .eq("protocol", cleanCode)
        .single();

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
    <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-md space-y-8">
        <div className="text-center">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-primary/10 mb-4">
            <ShieldCheck className="w-8 h-8 text-primary" />
          </div>
          <h1 className="text-3xl font-bold tracking-tight text-gray-900">
            Autenticidade NotificaCondo
          </h1>
          <p className="mt-2 text-sm text-gray-600">
            Valide a veracidade de documentos emitidos pela nossa plataforma.
          </p>
        </div>

        <Card className="border-2">
          <CardHeader>
            <CardTitle>Validar Documento</CardTitle>
            <CardDescription>
              Insira o código alfanumérico impresso no documento.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleValidate} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="verificationCode">Código de verificação</Label>
                <Input
                  id="verificationCode"
                  placeholder="Ex: 3XRB - 98RTG"
                  value={verificationCode}
                  onChange={(e) => setVerificationCode(e.target.value)}
                  className="uppercase"
                />
              </div>
              <Button type="submit" className="w-full" disabled={isValidating}>
                {isValidating ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Validando...
                  </>
                ) : (
                  <>
                    <Search className="mr-2 h-4 w-4" />
                    Verificar Autenticidade
                  </>
                )}
              </Button>
            </form>
          </CardContent>
        </Card>

        <p className="text-center text-xs text-gray-500">
          © {new Date().getFullYear()} NotificaCondo - Todos os direitos reservados.
        </p>
      </div>
    </div>
  );
}
