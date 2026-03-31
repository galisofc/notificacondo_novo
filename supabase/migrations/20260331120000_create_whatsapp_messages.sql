-- WhatsApp Messages table for Chat/Inbox feature
create table if not exists public.whatsapp_messages (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  direction text not null check (direction in ('inbound', 'outbound')),
  from_phone text,
  to_phone text,
  bsuid text,
  message_type text not null default 'text',
  content text,
  meta_message_id text,
  status text default 'sent',
  resident_id uuid references public.residents(id) on delete set null,
  condominium_id uuid references public.condominiums(id) on delete set null,
  conversation_window_expires_at timestamptz,
  resident_name text,
  error_message text
);

-- Indexes
create index idx_whatsapp_messages_from_phone on public.whatsapp_messages(from_phone);
create index idx_whatsapp_messages_to_phone on public.whatsapp_messages(to_phone);
create index idx_whatsapp_messages_bsuid on public.whatsapp_messages(bsuid);
create index idx_whatsapp_messages_created_at on public.whatsapp_messages(created_at desc);
create index idx_whatsapp_messages_meta_message_id on public.whatsapp_messages(meta_message_id);

-- RLS
alter table public.whatsapp_messages enable row level security;

create policy "Super admins can view all messages"
  on public.whatsapp_messages for select
  to authenticated
  using (public.has_role(auth.uid(), 'super_admin'));

create policy "Service role can insert messages"
  on public.whatsapp_messages for insert
  to service_role
  with check (true);

create policy "Service role can update messages"
  on public.whatsapp_messages for update
  to service_role
  using (true);

-- Enable realtime
alter publication supabase_realtime add table public.whatsapp_messages;
