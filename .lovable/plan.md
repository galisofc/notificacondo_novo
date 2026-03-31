

# Chat/Inbox WhatsApp no SuperAdmin

## Resumo

Criar um sistema de chat WhatsApp dentro do painel SuperAdmin que permite ver mensagens recebidas dos moradores e responder diretamente pela Meta Cloud API.

## Limitações Importantes

A Meta Cloud API tem restrições:
- **Mensagens de texto livre** só podem ser enviadas dentro da **janela de 24 horas** após a última mensagem do usuário
- Fora da janela, só é possível enviar **templates aprovados**
- O webhook atual (`whatsapp-webhook`) já recebe mensagens incoming mas **descarta o conteúdo** — só captura BSUIDs

## O que será feito

### 1. Nova tabela `whatsapp_messages`
Armazena todas as mensagens (recebidas e enviadas):
- `id`, `created_at`, `direction` (inbound/outbound), `from_phone`, `to_phone`, `bsuid`
- `message_type` (text, image, template, etc.), `content` (texto da mensagem)
- `meta_message_id`, `status` (sent, delivered, read)
- `resident_id` (FK opcional para `residents`), `condominium_id`
- `conversation_window_expires_at` (para controlar janela de 24h)
- RLS: super_admin pode SELECT; service_role pode INSERT/UPDATE

### 2. Atualizar `whatsapp-webhook` edge function
- Salvar mensagens incoming na tabela `whatsapp_messages` (tipo, texto, telefone, BSUID)
- Calcular `conversation_window_expires_at` (timestamp da mensagem + 24h)
- Vincular automaticamente ao `resident_id` pelo telefone/BSUID

### 3. Nova edge function `send-whatsapp-reply`
- Recebe: `to_phone`, `message`, `bsuid` (opcional)
- Verifica se está dentro da janela de 24h
- Se sim: envia texto livre via `sendMetaText`
- Se não: retorna erro pedindo para usar template
- Salva mensagem outbound na tabela `whatsapp_messages`

### 4. Nova página `src/pages/superadmin/WhatsAppChat.tsx`
- Lista de conversas à esquerda (agrupadas por telefone/contato)
- Painel de mensagens à direita (estilo chat, com balões in/out)
- Campo de resposta na parte inferior
- Indicador de janela de 24h (aberta/fechada)
- Badge com nome do morador quando vinculado
- Realtime via Supabase subscription na tabela `whatsapp_messages`

### 5. Rota e navegação
- Nova rota `/superadmin/whatsapp/chat` protegida para `super_admin`
- Link na página de WhatsApp existente e no dashboard SuperAdmin

## Detalhes Técnicos

- **Realtime**: usar `supabase.channel('whatsapp-messages').on('postgres_changes', ...)` para atualizar o chat em tempo real
- **Migração**: 1 migration para criar tabela + políticas RLS + índices (phone, bsuid, created_at)
- **Edge function**: reutiliza `sendMetaText` do `_shared/meta-whatsapp.ts`
- **UI**: componentes shadcn/ui existentes (Card, ScrollArea, Input, Button, Badge)

