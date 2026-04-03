import { useState, useEffect, useRef, useCallback } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { CheckCircle2, XCircle, MapPin, Loader2, AlertTriangle, PartyPopper } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface ChecklistItem {
  name: string;
  category: string;
  is_ok: boolean;
  observation: string;
}

const DEFAULT_CHECKLIST_ITEMS: ChecklistItem[] = [
  { name: "Iluminação geral", category: "Estrutura", is_ok: true, observation: "" },
  { name: "Ar condicionado / Ventilação", category: "Estrutura", is_ok: true, observation: "" },
  { name: "Tomadas elétricas", category: "Estrutura", is_ok: true, observation: "" },
  { name: "Portas e janelas", category: "Estrutura", is_ok: true, observation: "" },
  { name: "Piso e paredes", category: "Estrutura", is_ok: true, observation: "" },
  { name: "Banheiros", category: "Limpeza", is_ok: true, observation: "" },
  { name: "Área da cozinha", category: "Limpeza", is_ok: true, observation: "" },
  { name: "Limpeza geral do espaço", category: "Limpeza", is_ok: true, observation: "" },
  { name: "Mesas e cadeiras", category: "Mobiliário", is_ok: true, observation: "" },
  { name: "Equipamentos de som", category: "Equipamentos", is_ok: true, observation: "" },
  { name: "Geladeira / Freezer", category: "Equipamentos", is_ok: true, observation: "" },
  { name: "Fogão / Churrasqueira", category: "Equipamentos", is_ok: true, observation: "" },
];

export default function ChecklistEntrada() {
  const { token } = useParams<{ token: string }>();
  const { toast } = useToast();

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [bookingInfo, setBookingInfo] = useState<any>(null);

  const [items, setItems] = useState<ChecklistItem[]>(DEFAULT_CHECKLIST_ITEMS);
  const [signerName, setSignerName] = useState("");
  const [signerEmail, setSignerEmail] = useState("");
  const [generalObservations, setGeneralObservations] = useState("");
  const [geolocation, setGeolocation] = useState<{ lat: number; lng: number } | null>(null);
  const [geoStatus, setGeoStatus] = useState<"idle" | "loading" | "success" | "denied">("idle");

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [hasSignature, setHasSignature] = useState(false);

  // Validate token
  useEffect(() => {
    async function validateToken() {
      if (!token) {
        setError("Token não fornecido");
        setLoading(false);
        return;
      }

      // Check if already submitted
      const { data: existingChecklist } = await supabase
        .from("party_hall_digital_checklists" as any)
        .select("id")
        .eq("token", token)
        .maybeSingle();

      if (existingChecklist) {
        setSubmitted(true);
        setLoading(false);
        return;
      }

      // Validate booking
      const { data: booking, error: bookingError } = await (supabase
        .from("party_hall_bookings")
        .select("id, booking_date, start_time, end_time, status, condominium_id") as any)
        .eq("checklist_token", token)
        .single();

      if (bookingError || !booking) {
        setError("Token inválido ou reserva não encontrada");
        setLoading(false);
        return;
      }

      setBookingInfo(booking);
      setLoading(false);
    }

    validateToken();
  }, [token]);

  // Request geolocation
  useEffect(() => {
    if (!loading && !error && !submitted) {
      setGeoStatus("loading");
      if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
          (pos) => {
            setGeolocation({ lat: pos.coords.latitude, lng: pos.coords.longitude });
            setGeoStatus("success");
          },
          () => setGeoStatus("denied"),
          { timeout: 10000 }
        );
      } else {
        setGeoStatus("denied");
      }
    }
  }, [loading, error, submitted]);

  // Canvas drawing
  const getCanvasCoords = useCallback((e: React.MouseEvent | React.TouchEvent) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;

    if ("touches" in e) {
      return {
        x: (e.touches[0].clientX - rect.left) * scaleX,
        y: (e.touches[0].clientY - rect.top) * scaleY,
      };
    }
    return {
      x: (e.clientX - rect.left) * scaleX,
      y: (e.clientY - rect.top) * scaleY,
    };
  }, []);

  const startDrawing = useCallback((e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault();
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const { x, y } = getCanvasCoords(e);
    ctx.beginPath();
    ctx.moveTo(x, y);
    setIsDrawing(true);
    setHasSignature(true);
  }, [getCanvasCoords]);

  const draw = useCallback((e: React.MouseEvent | React.TouchEvent) => {
    if (!isDrawing) return;
    e.preventDefault();
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const { x, y } = getCanvasCoords(e);
    ctx.lineWidth = 2;
    ctx.lineCap = "round";
    ctx.strokeStyle = "#000";
    ctx.lineTo(x, y);
    ctx.stroke();
  }, [isDrawing, getCanvasCoords]);

  const stopDrawing = useCallback(() => setIsDrawing(false), []);

  const clearSignature = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    setHasSignature(false);
  };

  const toggleItem = (index: number) => {
    setItems(prev => prev.map((item, i) => i === index ? { ...item, is_ok: !item.is_ok } : item));
  };

  const updateItemObservation = (index: number, observation: string) => {
    setItems(prev => prev.map((item, i) => i === index ? { ...item, observation } : item));
  };

  const handleSubmit = async () => {
    if (!signerName.trim()) {
      toast({ title: "Nome obrigatório", variant: "destructive" });
      return;
    }
    if (!signerEmail.trim() || !signerEmail.includes("@")) {
      toast({ title: "E-mail válido obrigatório", variant: "destructive" });
      return;
    }
    if (!hasSignature) {
      toast({ title: "Assinatura obrigatória", variant: "destructive" });
      return;
    }

    setSubmitting(true);

    try {
      const canvas = canvasRef.current;
      const signatureImage = canvas?.toDataURL("image/png") || "";

      const { data, error: fnError } = await supabase.functions.invoke("submit-checklist-entrada", {
        body: {
          token,
          items,
          signer_name: signerName.trim(),
          signer_email: signerEmail.trim(),
          signature_image: signatureImage,
          geolocation,
          general_observations: generalObservations.trim() || null,
        },
      });

      if (fnError) throw fnError;
      if (data && !data.success) throw new Error(data.error);

      setSubmitted(true);
      toast({ title: "Checklist assinado com sucesso!" });
    } catch (err: any) {
      toast({ title: "Erro ao enviar", description: err.message, variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <Card className="max-w-md w-full">
          <CardContent className="pt-6 text-center">
            <AlertTriangle className="h-12 w-12 text-destructive mx-auto mb-4" />
            <h2 className="text-xl font-semibold mb-2">Link Inválido</h2>
            <p className="text-muted-foreground">{error}</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (submitted) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <Card className="max-w-md w-full">
          <CardContent className="pt-6 text-center">
            <CheckCircle2 className="h-12 w-12 text-green-500 mx-auto mb-4" />
            <h2 className="text-xl font-semibold mb-2">Checklist Assinado!</h2>
            <p className="text-muted-foreground">O checklist de entrada foi registrado com sucesso. Aproveite o evento!</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const categories = [...new Set(items.map(i => i.category))];

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-2xl mx-auto p-4 space-y-6">
        {/* Header */}
        <div className="text-center pt-4">
          <PartyPopper className="h-10 w-10 text-primary mx-auto mb-2" />
          <h1 className="text-2xl font-bold">Checklist de Entrada</h1>
          <p className="text-muted-foreground">Salão de Festas</p>
          {bookingInfo && (
            <Badge variant="outline" className="mt-2">
              {bookingInfo.booking_date} • {bookingInfo.start_time} - {bookingInfo.end_time}
            </Badge>
          )}
        </div>

        {/* Geolocation Status */}
        <div className="flex items-center gap-2 text-sm">
          <MapPin className="h-4 w-4" />
          {geoStatus === "loading" && <span className="text-muted-foreground">Obtendo localização...</span>}
          {geoStatus === "success" && <span className="text-primary">Localização capturada</span>}
          {geoStatus === "denied" && <span className="text-muted-foreground">Localização não disponível</span>}
        </div>

        {/* Checklist Items by Category */}
        {categories.map(category => (
          <Card key={category}>
            <CardHeader className="pb-3">
              <CardTitle className="text-lg">{category}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {items
                .map((item, originalIndex) => ({ item, originalIndex }))
                .filter(({ item }) => item.category === category)
                .map(({ item, originalIndex }) => (
                  <div key={originalIndex} className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="font-medium text-sm">{item.name}</span>
                      <div className="flex items-center gap-2">
                        <span className={`text-xs ${item.is_ok ? "text-primary" : "text-destructive"}`}>
                          {item.is_ok ? "OK" : "Problema"}
                        </span>
                        <Switch
                          checked={item.is_ok}
                          onCheckedChange={() => toggleItem(originalIndex)}
                        />
                      </div>
                    </div>
                    {!item.is_ok && (
                      <Input
                        placeholder="Descreva o problema encontrado..."
                        value={item.observation}
                        onChange={(e) => updateItemObservation(originalIndex, e.target.value)}
                        className="text-sm"
                      />
                    )}
                  </div>
                ))}
            </CardContent>
          </Card>
        ))}

        {/* General Observations */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-lg">Observações Gerais</CardTitle>
          </CardHeader>
          <CardContent>
            <Textarea
              placeholder="Observações adicionais sobre o estado do espaço..."
              value={generalObservations}
              onChange={(e) => setGeneralObservations(e.target.value)}
              rows={3}
            />
          </CardContent>
        </Card>

        {/* Signer Info */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-lg">Dados do Responsável</CardTitle>
            <CardDescription>Preencha seus dados para assinar o checklist</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label htmlFor="name">Nome Completo *</Label>
              <Input
                id="name"
                value={signerName}
                onChange={(e) => setSignerName(e.target.value)}
                placeholder="Seu nome completo"
              />
            </div>
            <div>
              <Label htmlFor="email">E-mail *</Label>
              <Input
                id="email"
                type="email"
                value={signerEmail}
                onChange={(e) => setSignerEmail(e.target.value)}
                placeholder="seu@email.com"
              />
            </div>
          </CardContent>
        </Card>

        {/* Digital Signature */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-lg">Assinatura Digital *</CardTitle>
            <CardDescription>Assine no campo abaixo com o dedo ou mouse</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="border-2 border-dashed border-border rounded-lg overflow-hidden">
              <canvas
                ref={canvasRef}
                width={600}
                height={200}
                className="w-full bg-white cursor-crosshair touch-none"
                onMouseDown={startDrawing}
                onMouseMove={draw}
                onMouseUp={stopDrawing}
                onMouseLeave={stopDrawing}
                onTouchStart={startDrawing}
                onTouchMove={draw}
                onTouchEnd={stopDrawing}
              />
            </div>
            <Button variant="outline" size="sm" className="mt-2" onClick={clearSignature}>
              Limpar Assinatura
            </Button>
          </CardContent>
        </Card>

        {/* Submit */}
        <Button
          className="w-full"
          size="lg"
          onClick={handleSubmit}
          disabled={submitting || !signerName || !signerEmail || !hasSignature}
        >
          {submitting ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Enviando...
            </>
          ) : (
            "Assinar e Enviar Checklist"
          )}
        </Button>

        <p className="text-xs text-muted-foreground text-center pb-8">
          Ao assinar, você confirma que verificou todos os itens acima e que as informações são verdadeiras.
          {geolocation && ` Localização: ${geolocation.lat.toFixed(4)}, ${geolocation.lng.toFixed(4)}`}
        </p>
      </div>
    </div>
  );
}
