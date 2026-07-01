import { useEffect, useMemo, useState } from "react";
import { Helmet } from "react-helmet-async";
import { useAuth } from "@/hooks/useAuth";
import { useUserRole } from "@/hooks/useUserRole";
import { supabase } from "@/integrations/supabase/client";
import DashboardLayout from "@/components/layouts/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { BookOpen, Send, Trash2 } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { toast } from "sonner";

export default function SindicoPortariaMessageBook() {
  const { user } = useAuth();
  const { profileInfo } = useUserRole();
  const queryClient = useQueryClient();

  const [condominiums, setCondominiums] = useState<{ id: string; name: string }[]>([]);
  const [selectedCondominium, setSelectedCondominium] = useState<string>("");
  const [newMessage, setNewMessage] = useState("");

  useEffect(() => {
    const load = async () => {
      if (!user) return;
      const { data } = await supabase
        .from("condominiums")
        .select("id, name")
        .eq("owner_id", user.id)
        .order("name");
      if (data) {
        setCondominiums(data);
        const saved = localStorage.getItem("sindico-msgbook-cond");
        if (saved && data.some((c) => c.id === saved)) setSelectedCondominium(saved);
        else if (data.length >= 1) setSelectedCondominium(data[0].id);
      }
    };
    load();
  }, [user]);

  useEffect(() => {
    if (selectedCondominium) localStorage.setItem("sindico-msgbook-cond", selectedCondominium);
  }, [selectedCondominium]);

  const { data: messages = [], isLoading } = useQuery({
    queryKey: ["sindico-porter-messages", selectedCondominium],
    queryFn: async () => {
      if (!selectedCondominium) return [];
      const { data, error } = await supabase
        .from("porter_messages")
        .select("*")
        .eq("condominium_id", selectedCondominium)
        .order("created_at", { ascending: false })
        .limit(50);
      if (error) throw error;
      return data || [];
    },
    enabled: !!selectedCondominium,
  });

  useEffect(() => {
    if (!selectedCondominium) return;
    const channel = supabase
      .channel(`sindico-porter-messages-${selectedCondominium}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "porter_messages", filter: `condominium_id=eq.${selectedCondominium}` },
        () => queryClient.invalidateQueries({ queryKey: ["sindico-porter-messages", selectedCondominium] })
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [selectedCondominium, queryClient]);

  const authorIds = useMemo(
    () => Array.from(new Set(messages.map((m: any) => m.author_id).filter(Boolean))),
    [messages]
  );

  const { data: authorProfiles = {} } = useQuery({
    queryKey: ["sindico-msgbook-authors", authorIds],
    queryFn: async () => {
      if (authorIds.length === 0) return {};
      const { data } = await supabase
        .from("profiles")
        .select("user_id, full_name, avatar_url")
        .in("user_id", authorIds as string[]);
      const map: Record<string, { full_name: string; avatar_url: string | null }> = {};
      (data || []).forEach((p: any) => {
        map[p.user_id] = { full_name: p.full_name, avatar_url: p.avatar_url };
      });
      return map;
    },
    enabled: authorIds.length > 0,
  });

  const { data: authorRoles = {} } = useQuery({
    queryKey: ["sindico-msgbook-author-roles", authorIds],
    queryFn: async () => {
      if (authorIds.length === 0) return {};
      const { data } = await supabase
        .from("user_roles")
        .select("user_id, role")
        .in("user_id", authorIds as string[]);
      const map: Record<string, string[]> = {};
      (data || []).forEach((r: any) => {
        (map[r.user_id] ||= []).push(r.role);
      });
      return map;
    },
    enabled: authorIds.length > 0,
  });

  const sendMutation = useMutation({
    mutationFn: async () => {
      if (!user || !newMessage.trim() || !selectedCondominium) return;
      const { error } = await supabase.from("porter_messages").insert({
        condominium_id: selectedCondominium,
        author_id: user.id,
        author_name: profileInfo?.full_name || "Síndico",
        content: newMessage.trim(),
      });
      if (error) throw error;
    },
    onSuccess: () => {
      setNewMessage("");
      queryClient.invalidateQueries({ queryKey: ["sindico-porter-messages", selectedCondominium] });
      toast.success("Recado enviado");
    },
    onError: (err: any) => toast.error(err.message || "Erro ao enviar recado"),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("porter_messages").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["sindico-porter-messages", selectedCondominium] });
      toast.success("Recado removido");
    },
    onError: (err: any) => toast.error(err.message || "Erro ao remover"),
  });

  const getInitials = (name: string) =>
    name.split(" ").filter(Boolean).slice(0, 2).map((n) => n[0]?.toUpperCase()).join("") || "?";

  return (
    <DashboardLayout>
      <Helmet>
        <title>NotificaCondo - Livro de Recados</title>
      </Helmet>
      <div className="max-w-4xl mx-auto space-y-4">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-2xl font-bold">Livro de Recados da Portaria</h1>
            <p className="text-sm text-muted-foreground">
              Deixe recados para os porteiros e acompanhe a comunicação entre plantões.
            </p>
          </div>
          {condominiums.length > 1 && (
            <Select value={selectedCondominium} onValueChange={setSelectedCondominium}>
              <SelectTrigger className="w-full sm:w-[280px]">
                <SelectValue placeholder="Selecione o condomínio" />
              </SelectTrigger>
              <SelectContent>
                {condominiums.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>

        <Card className="overflow-hidden">
          <CardHeader className="pb-3 bg-gradient-to-r from-primary/5 to-transparent border-b">
            <CardTitle className="text-lg flex items-center gap-2">
              <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center">
                <BookOpen className="w-5 h-5 text-primary" />
              </div>
              <div>
                <p className="leading-tight">Livro de Recados</p>
                <p className="text-xs font-normal text-muted-foreground">Comunicação entre síndico e portaria</p>
              </div>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 pt-4">
            {!selectedCondominium ? (
              <p className="text-sm text-muted-foreground text-center py-8">
                Selecione um condomínio para ver os recados.
              </p>
            ) : isLoading ? (
              <p className="text-sm text-muted-foreground text-center py-4">Carregando...</p>
            ) : messages.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8 text-center">
                <BookOpen className="w-10 h-10 text-muted-foreground/40 mb-2" />
                <p className="text-sm text-muted-foreground">Nenhum recado registrado.</p>
                <p className="text-xs text-muted-foreground/70">Seja o primeiro a deixar um recado.</p>
              </div>
            ) : (
              <div className="flex flex-col gap-3 max-h-[500px] overflow-y-auto pr-1 py-1 scrollbar-thin">
                {[...messages].reverse().map((msg: any) => {
                  const isMe = user && msg.author_id === user.id;
                  const profile = authorProfiles[msg.author_id];
                  const displayName = profile?.full_name || msg.author_name || "Usuário";
                  const avatarUrl = profile?.avatar_url;
                  return (
                    <div
                      key={msg.id}
                      className={`flex items-end gap-2 group ${isMe ? "flex-row-reverse" : "flex-row"}`}
                    >
                      <Avatar className="w-8 h-8 shrink-0 border-2 border-background shadow-sm">
                        {avatarUrl && <AvatarImage src={avatarUrl} alt={displayName} />}
                        <AvatarFallback
                          className={`text-[10px] font-semibold ${
                            isMe ? "bg-primary text-primary-foreground" : "bg-muted"
                          }`}
                        >
                          {getInitials(displayName)}
                        </AvatarFallback>
                      </Avatar>
                      <div
                        className={`max-w-[75%] rounded-2xl px-3.5 py-2 shadow-sm ${
                          isMe
                            ? "bg-primary text-primary-foreground rounded-br-sm"
                            : "bg-muted rounded-bl-sm"
                        }`}
                      >
                        <p
                          className={`text-xs font-semibold mb-0.5 ${
                            isMe ? "text-primary-foreground/90" : "text-primary"
                          }`}
                        >
                          {displayName}
                        </p>
                        <p
                          className={`text-sm whitespace-pre-line ${
                            isMe ? "text-primary-foreground" : "text-foreground"
                          }`}
                        >
                          {msg.content}
                        </p>
                        <div className={`flex items-center mt-1 ${isMe ? "justify-end" : "justify-start"}`}>
                          <span
                            className={`text-[10px] ${
                              isMe ? "text-primary-foreground/70" : "text-muted-foreground"
                            }`}
                          >
                            {format(new Date(msg.created_at), "dd/MM HH:mm", { locale: ptBR })}
                          </span>
                        </div>
                      </div>
                      <button
                        onClick={() => deleteMutation.mutate(msg.id)}
                        className="opacity-0 group-hover:opacity-100 transition-opacity text-destructive hover:text-destructive/80 self-center"
                        aria-label="Excluir recado"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  );
                })}
              </div>
            )}

            <div className="flex gap-2 pt-2 border-t">
              <Avatar className="w-9 h-9 shrink-0 mt-1">
                {profileInfo?.avatar_url && (
                  <AvatarImage src={profileInfo.avatar_url} alt={profileInfo.full_name || ""} />
                )}
                <AvatarFallback className="bg-primary text-primary-foreground text-xs font-semibold">
                  {getInitials(profileInfo?.full_name || "Eu")}
                </AvatarFallback>
              </Avatar>
              <Textarea
                value={newMessage}
                onChange={(e) => setNewMessage(e.target.value)}
                placeholder="Deixe um recado para a portaria..."
                rows={2}
                className="resize-none"
                maxLength={500}
                disabled={!selectedCondominium}
              />
              <Button
                size="icon"
                className="shrink-0 self-end h-10 w-10"
                disabled={!newMessage.trim() || sendMutation.isPending || !selectedCondominium}
                onClick={() => sendMutation.mutate()}
              >
                <Send className="w-4 h-4" />
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
