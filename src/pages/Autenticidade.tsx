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
      <div className="w-full max-w-2xl space-y-8">
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
                <div className="flex gap-2">
                  <Input
                    id="verificationCode"
                    placeholder="Ex: 3XRB - 98RTG"
                    value={verificationCode}
                    onChange={(e) => setVerificationCode(e.target.value)}
                    className="uppercase font-mono"
                  />
                  <Button type="submit" disabled={isValidating}>
                    {isValidating ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Search className="h-4 w-4" />
                    )}
                  </Button>
                </div>
              </div>
            </form>
          </CardContent>
        </Card>

        {isValidating && (
          <div className="flex flex-col items-center justify-center p-12 space-y-4">
            <Loader2 className="w-8 h-8 text-primary animate-spin" />
            <p className="text-sm text-muted-foreground italic">Consultando base de dados oficial...</p>
          </div>
        )}

        {error && (
          <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-6 flex items-start gap-4 animate-in fade-in slide-in-from-top-4">
            <XCircle className="w-6 h-6 text-destructive shrink-0 mt-0.5" />
            <div>
              <h3 className="font-semibold text-destructive">Documento Inválido</h3>
              <p className="text-sm text-destructive/80 mt-1">{error}</p>
            </div>
          </div>
        )}

        {occurrence && (
          <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-6 space-y-6 animate-in fade-in slide-in-from-top-4">
            <div className="flex items-start gap-4">
              <CheckCircle2 className="w-8 h-8 text-emerald-600 shrink-0" />
              <div>
                <h3 className="text-xl font-bold text-emerald-900">Documento Autêntico</h3>
                <p className="text-emerald-700">Este documento foi emitido e registrado em nossa plataforma.</p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-4 border-t border-emerald-100">
              <div className="flex items-center gap-3">
                <FileText className="w-5 h-5 text-emerald-600" />
                <div>
                  <p className="text-xs text-emerald-600 uppercase font-bold">Título da Ocorrência</p>
                  <p className="font-medium text-emerald-900">{occurrence.title}</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <Building2 className="w-5 h-5 text-emerald-600" />
                <div>
                  <p className="text-xs text-emerald-600 uppercase font-bold">Condomínio</p>
                  <p className="font-medium text-emerald-900">{occurrence.condominium?.name}</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <Calendar className="w-5 h-5 text-emerald-600" />
                <div>
                  <p className="text-xs text-emerald-600 uppercase font-bold">Data de Registro</p>
                  <p className="font-medium text-emerald-900">
                    {format(new Date(occurrence.created_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <ShieldCheck className="w-5 h-5 text-emerald-600" />
                <div>
                  <p className="text-xs text-emerald-600 uppercase font-bold">Protocolo de Verificação</p>
                  <p className="font-mono font-medium text-emerald-900">{occurrence.protocol}</p>
                </div>
              </div>
            </div>

            <div className="bg-white/50 p-4 rounded border border-emerald-100 mt-4">
              <p className="text-xs text-emerald-600 uppercase font-bold mb-1">Descrição Registrada</p>
              <p className="text-sm text-emerald-900 whitespace-pre-wrap">{occurrence.description}</p>
            </div>
          </div>
        )}

        <p className="text-center text-xs text-gray-500 pt-8">
          © {new Date().getFullYear()} NotificaCondo - Todos os direitos reservados.
        </p>
      </div>
    </div>
  );
}
