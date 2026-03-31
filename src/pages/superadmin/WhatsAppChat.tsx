import { useState, useEffect, useRef, useCallback } from "react";
import { Helmet } from "react-helmet-async";
import DashboardLayout from "@/components/layouts/DashboardLayout";
import SuperAdminBreadcrumbs from "@/components/superadmin/SuperAdminBreadcrumbs";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Loader2, Send, MessageSquare, Clock, User, AlertCircle } from "lucide-react";
import { formatDistanceToNow, format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useToast } from "@/hooks/use-toast";

interface WhatsAppMessage {
  id: string;
  created_at: string;
  direction: "inbound" | "outbound";
  from_phone: string | null;
  to_phone: string | null;
  bsuid: string | null;
  message_type: string;
  content: string | null;
  meta_message_id: string | null;
  status: string | null;
  resident_id: string | null;
  resident_name: string | null;
  conversation_window_expires_at: string | null;
}

interface Conversation {
  phone: string;
  lastMessage: WhatsAppMessage;
  unreadCount: number;
  residentName: string | null;
  windowOpen: boolean;
}

export default function WhatsAppChat() {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selectedPhone, setSelectedPhone] = useState<string | null>(null);
  const [messages, setMessages] = useState<WhatsAppMessage[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, []);

  // Load conversations
  const loadConversations = useCallback(async () => {
    const { data, error } = await (supabase as any)
      .from("whatsapp_messages")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Error loading conversations:", error);
      return;
    }

    // Group by phone number
    const grouped = new Map<string, WhatsAppMessage[]>();
    for (const msg of (data || [])) {
      const phone = msg.direction === "inbound" ? msg.from_phone : msg.to_phone;
      if (!phone) continue;
      if (!grouped.has(phone)) grouped.set(phone, []);
      grouped.get(phone)!.push(msg as WhatsAppMessage);
    }

    const convos: Conversation[] = [];
    grouped.forEach((msgs, phone) => {
      const lastMsg = msgs[0];
      const lastInbound = msgs.find(m => m.direction === "inbound");
      const windowExpires = lastInbound?.conversation_window_expires_at;
      const windowOpen = windowExpires ? new Date(windowExpires) > new Date() : false;

      convos.push({
        phone,
        lastMessage: lastMsg as WhatsAppMessage,
        unreadCount: msgs.filter(m => m.direction === "inbound" && m.status === "received").length,
        residentName: msgs.find(m => m.resident_name)?.resident_name || null,
        windowOpen,
      });
    });

    convos.sort((a, b) => new Date(b.lastMessage.created_at).getTime() - new Date(a.lastMessage.created_at).getTime());
    setConversations(convos);
    setLoading(false);
  }, []);

  // Load messages for selected conversation
  const loadMessages = useCallback(async (phone: string) => {
    setLoadingMessages(true);
    const { data, error } = await (supabase as any)
      .from("whatsapp_messages")
      .select("*")
      .or(`from_phone.eq.${phone},to_phone.eq.${phone}`)
      .order("created_at", { ascending: true });

    if (!error && data) {
      setMessages(data as WhatsAppMessage[]);
    }
    setLoadingMessages(false);
    setTimeout(scrollToBottom, 100);
  }, [scrollToBottom]);

  useEffect(() => {
    loadConversations();
  }, [loadConversations]);

  useEffect(() => {
    if (selectedPhone) {
      loadMessages(selectedPhone);
    }
  }, [selectedPhone, loadMessages]);

  // Realtime subscription
  useEffect(() => {
    const channel = supabase
      .channel("whatsapp-messages-realtime")
      .on("postgres_changes", {
        event: "INSERT",
        schema: "public",
        table: "whatsapp_messages",
      }, (payload) => {
        const newMsg = payload.new as WhatsAppMessage;
        const msgPhone = newMsg.direction === "inbound" ? newMsg.from_phone : newMsg.to_phone;

        if (msgPhone === selectedPhone) {
          setMessages(prev => [...prev, newMsg]);
          setTimeout(scrollToBottom, 100);
        }
        loadConversations();
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [selectedPhone, loadConversations, scrollToBottom]);

  const handleSend = async () => {
    if (!newMessage.trim() || !selectedPhone || sending) return;
    setSending(true);

    try {
      const convo = conversations.find(c => c.phone === selectedPhone);
      const { data, error } = await supabase.functions.invoke("send-whatsapp-reply", {
        body: {
          to_phone: selectedPhone,
          message: newMessage.trim(),
          bsuid: convo?.lastMessage?.bsuid || undefined,
        },
      });

      if (error) throw error;
      if (data?.error) {
        toast({
          title: "Erro ao enviar",
          description: data.error,
          variant: "destructive",
        });
      } else {
        setNewMessage("");
      }
    } catch (err: any) {
      toast({
        title: "Erro",
        description: err.message || "Erro ao enviar mensagem",
        variant: "destructive",
      });
    } finally {
      setSending(false);
    }
  };

  const formatPhone = (phone: string) => {
    if (phone.length === 13) {
      return `+${phone.substring(0, 2)} (${phone.substring(2, 4)}) ${phone.substring(4, 9)}-${phone.substring(9)}`;
    }
    return phone;
  };

  const selectedConvo = conversations.find(c => c.phone === selectedPhone);

  return (
    <DashboardLayout>
      <Helmet>
        <title>Chat WhatsApp | Super Admin</title>
      </Helmet>
      <div className="space-y-4 animate-fade-up">
        <SuperAdminBreadcrumbs items={[{ label: "WhatsApp" }, { label: "Chat" }]} />

        <div>
          <h1 className="font-display text-lg sm:text-xl md:text-3xl font-bold text-foreground">
            Chat WhatsApp
          </h1>
          <p className="text-xs sm:text-sm text-muted-foreground mt-1">
            Visualize e responda mensagens recebidas via WhatsApp
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-[320px_1fr] gap-4 h-[calc(100vh-220px)] min-h-[500px]">
          {/* Conversations sidebar */}
          <Card className="flex flex-col overflow-hidden">
            <div className="p-3 border-b">
              <h2 className="font-semibold text-sm flex items-center gap-2">
                <MessageSquare className="w-4 h-4" />
                Conversas ({conversations.length})
              </h2>
            </div>
            <ScrollArea className="flex-1">
              {loading ? (
                <div className="flex items-center justify-center p-8">
                  <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
                </div>
              ) : conversations.length === 0 ? (
                <div className="p-6 text-center text-muted-foreground text-sm">
                  Nenhuma mensagem recebida ainda
                </div>
              ) : (
                conversations.map(convo => (
                  <button
                    key={convo.phone}
                    onClick={() => setSelectedPhone(convo.phone)}
                    className={`w-full text-left p-3 border-b transition-colors hover:bg-muted/50 ${
                      selectedPhone === convo.phone ? "bg-muted" : ""
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <p className="font-medium text-sm truncate">
                          {convo.residentName || formatPhone(convo.phone)}
                        </p>
                        {convo.residentName && (
                          <p className="text-xs text-muted-foreground truncate">
                            {formatPhone(convo.phone)}
                          </p>
                        )}
                        <p className="text-xs text-muted-foreground truncate mt-0.5">
                          {convo.lastMessage.direction === "inbound" ? "" : "Você: "}
                          {convo.lastMessage.content?.substring(0, 50)}
                        </p>
                      </div>
                      <div className="flex flex-col items-end gap-1 shrink-0">
                        <span className="text-[10px] text-muted-foreground">
                          {formatDistanceToNow(new Date(convo.lastMessage.created_at), {
                            addSuffix: true,
                            locale: ptBR,
                          })}
                        </span>
                        {convo.windowOpen ? (
                          <Badge variant="outline" className="text-[10px] px-1 py-0 text-green-600 border-green-300">
                            24h
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="text-[10px] px-1 py-0 text-destructive border-destructive/30">
                            Fechada
                          </Badge>
                        )}
                      </div>
                    </div>
                  </button>
                ))
              )}
            </ScrollArea>
          </Card>

          {/* Chat area */}
          <Card className="flex flex-col overflow-hidden">
            {!selectedPhone ? (
              <div className="flex-1 flex items-center justify-center text-muted-foreground">
                <div className="text-center space-y-2">
                  <MessageSquare className="w-12 h-12 mx-auto opacity-30" />
                  <p className="text-sm">Selecione uma conversa</p>
                </div>
              </div>
            ) : (
              <>
                {/* Chat header */}
                <div className="p-3 border-b flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                      <User className="w-4 h-4 text-primary" />
                    </div>
                    <div>
                      <p className="font-medium text-sm">
                        {selectedConvo?.residentName || formatPhone(selectedPhone)}
                      </p>
                      {selectedConvo?.residentName && (
                        <p className="text-xs text-muted-foreground">{formatPhone(selectedPhone)}</p>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {selectedConvo?.windowOpen ? (
                      <Badge variant="outline" className="text-xs text-primary border-primary/30">
                        <Clock className="w-3 h-3 mr-1" />
                        Janela aberta
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="text-xs text-destructive border-destructive/30">
                        <AlertCircle className="w-3 h-3 mr-1" />
                        Janela fechada
                      </Badge>
                    )}
                  </div>
                </div>

                {/* Messages */}
                <ScrollArea className="flex-1 p-4">
                  {loadingMessages ? (
                    <div className="flex items-center justify-center h-full">
                      <Loader2 className="w-5 h-5 animate-spin" />
                    </div>
                  ) : messages.length === 0 ? (
                    <div className="text-center text-muted-foreground text-sm py-8">
                      Nenhuma mensagem nesta conversa
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {messages.map(msg => (
                        <div
                          key={msg.id}
                          className={`flex ${msg.direction === "outbound" ? "justify-end" : "justify-start"}`}
                        >
                          <div
                            className={`max-w-[75%] rounded-2xl px-4 py-2 ${
                              msg.direction === "outbound"
                                ? "bg-primary text-primary-foreground rounded-br-md"
                                : "bg-muted rounded-bl-md"
                            }`}
                          >
                            <p className="text-sm whitespace-pre-wrap break-words">
                              {msg.content || `[${msg.message_type}]`}
                            </p>
                            <p className={`text-[10px] mt-1 ${
                              msg.direction === "outbound" ? "text-primary-foreground/70" : "text-muted-foreground"
                            }`}>
                              {format(new Date(msg.created_at), "HH:mm", { locale: ptBR })}
                              {msg.direction === "outbound" && msg.status && (
                                <span className="ml-1">• {msg.status}</span>
                              )}
                            </p>
                          </div>
                        </div>
                      ))}
                      <div ref={messagesEndRef} />
                    </div>
                  )}
                </ScrollArea>

                {/* Input area */}
                <div className="p-3 border-t">
                  {selectedConvo?.windowOpen ? (
                    <div className="flex gap-2">
                      <Input
                        placeholder="Digite uma mensagem..."
                        value={newMessage}
                        onChange={e => setNewMessage(e.target.value)}
                        onKeyDown={e => e.key === "Enter" && !e.shiftKey && handleSend()}
                        disabled={sending}
                        className="flex-1"
                      />
                      <Button onClick={handleSend} disabled={sending || !newMessage.trim()} size="icon">
                        {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                      </Button>
                    </div>
                  ) : (
                    <div className="text-center text-sm text-muted-foreground py-2">
                      <AlertCircle className="w-4 h-4 inline mr-1" />
                      Janela de 24h expirada. O morador precisa enviar uma mensagem para reabrir.
                    </div>
                  )}
                </div>
              </>
            )}
          </Card>
        </div>
      </div>
    </DashboardLayout>
  );
}
