import { useEffect, useState } from "react";
import { Helmet } from "react-helmet-async";
import { supabase } from "@/integrations/supabase/client";
import DashboardLayout from "@/components/layouts/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Mail, Send, Save } from "lucide-react";

interface SmtpConfig {
  id?: string;
  host: string;
  port: number;
  secure: boolean;
  username: string;
  password: string;
  from_email: string;
  from_name: string;
  is_active: boolean;
}

const empty: SmtpConfig = {
  host: "",
  port: 587,
  secure: false,
  username: "",
  password: "",
  from_email: "",
  from_name: "NotificaCondo",
  is_active: true,
};

export default function SmtpConfigPage() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testEmail, setTestEmail] = useState("");
  const [config, setConfig] = useState<SmtpConfig>(empty);

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("smtp_config" as any)
        .select("*")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (data) setConfig(data as any);
      setLoading(false);
    })();
  }, []);

  const handleSave = async () => {
    if (!config.host || !config.username || !config.password || !config.from_email) {
      toast({ title: "Preencha os campos obrigatórios.", variant: "destructive" });
      return;
    }
    setSaving(true);
    try {
      const payload = { ...config, updated_at: new Date().toISOString() };
      const op = config.id
        ? supabase.from("smtp_config" as any).update(payload).eq("id", config.id).select().single()
        : supabase.from("smtp_config" as any).insert(payload).select().single();
      const { data, error } = await op;
      if (error) throw error;
      setConfig(data as any);
      toast({ title: "Configuração SMTP salva." });
    } catch (e: any) {
      toast({ title: "Erro ao salvar", description: e.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const handleTest = async () => {
    if (!testEmail) {
      toast({ title: "Informe um e-mail para teste.", variant: "destructive" });
      return;
    }
    setTesting(true);
    try {
      const { data, error } = await supabase.functions.invoke("send-expired-defense-email", {
        body: { mode: "test", to: testEmail },
      });
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);
      toast({ title: "E-mail de teste enviado!", description: `Para ${testEmail}` });
    } catch (e: any) {
      toast({ title: "Falha no teste", description: e.message, variant: "destructive" });
    } finally {
      setTesting(false);
    }
  };

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center min-h-[40vh]">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <Helmet><title>NotificaCondo - Configuração SMTP</title></Helmet>
      <div className="max-w-3xl mx-auto space-y-6">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2"><Mail className="w-6 h-6 text-primary" /> Configuração SMTP</h1>
          <p className="text-sm text-muted-foreground">Configure o servidor de e-mail usado para envio das multas com defesa expirada.</p>
        </div>

        <Card>
          <CardHeader><CardTitle>Servidor SMTP</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="grid md:grid-cols-3 gap-4">
              <div className="md:col-span-2 space-y-2">
                <Label>Host *</Label>
                <Input value={config.host} onChange={(e) => setConfig({ ...config, host: e.target.value })} placeholder="smtp.gmail.com" />
              </div>
              <div className="space-y-2">
                <Label>Porta *</Label>
                <Input type="number" value={config.port} onChange={(e) => setConfig({ ...config, port: Number(e.target.value) })} />
              </div>
            </div>

            <div className="flex items-center justify-between rounded-lg border p-3">
              <div>
                <Label>Conexão segura (SSL/TLS)</Label>
                <p className="text-xs text-muted-foreground">Ative para porta 465. Deixe desativado para STARTTLS (587).</p>
              </div>
              <Switch checked={config.secure} onCheckedChange={(v) => setConfig({ ...config, secure: v })} />
            </div>

            <div className="grid md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Usuário *</Label>
                <Input value={config.username} onChange={(e) => setConfig({ ...config, username: e.target.value })} autoComplete="off" />
              </div>
              <div className="space-y-2">
                <Label>Senha *</Label>
                <Input type="password" value={config.password} onChange={(e) => setConfig({ ...config, password: e.target.value })} autoComplete="new-password" />
              </div>
            </div>

            <div className="grid md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>E-mail remetente *</Label>
                <Input type="email" value={config.from_email} onChange={(e) => setConfig({ ...config, from_email: e.target.value })} placeholder="naoresponda@seudominio.com" />
              </div>
              <div className="space-y-2">
                <Label>Nome remetente</Label>
                <Input value={config.from_name} onChange={(e) => setConfig({ ...config, from_name: e.target.value })} />
              </div>
            </div>

            <div className="flex items-center justify-between rounded-lg border p-3">
              <div>
                <Label>Ativo</Label>
                <p className="text-xs text-muted-foreground">Quando desativado, nenhum envio será realizado.</p>
              </div>
              <Switch checked={config.is_active} onCheckedChange={(v) => setConfig({ ...config, is_active: v })} />
            </div>

            <div className="flex justify-end">
              <Button onClick={handleSave} disabled={saving}>
                {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Save className="w-4 h-4 mr-2" />}
                Salvar
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Enviar e-mail de teste</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <div className="flex gap-2">
              <Input type="email" placeholder="destinatario@exemplo.com" value={testEmail} onChange={(e) => setTestEmail(e.target.value)} />
              <Button onClick={handleTest} disabled={testing || !config.id}>
                {testing ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Send className="w-4 h-4 mr-2" />}
                Testar
              </Button>
            </div>
            {!config.id && <p className="text-xs text-muted-foreground">Salve a configuração antes de enviar um teste.</p>}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
