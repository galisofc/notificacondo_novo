-- =====================================================
-- SEED do template `gatehouse_party_hall_release`
-- Rode este SQL no Supabase SQL Editor
-- =====================================================

INSERT INTO public.whatsapp_templates (name, slug, description, content, variables, is_active)
VALUES (
  'Liberação Salão para Portaria',
  'gatehouse_party_hall_release',
  'Notificação enviada à portaria no dia da reserva do salão de festas (libera chave para o morador)',
  '🔑 *LIBERAÇÃO DE SALÃO DE FESTAS*

🏢 *{condominio}*

Hoje há reserva confirmada do *{espaco}*.

👤 Morador: *{morador}*
🏠 Unidade: *{apartamento}*
📅 Data: {data}
⏰ Horário: {horario_inicio} às {horario_fim}

Por favor, libere a chave do salão para o morador no horário previsto.',
  ARRAY['condominio', 'morador', 'apartamento', 'espaco', 'data', 'horario_inicio', 'horario_fim'],
  true
)
ON CONFLICT (slug) DO UPDATE
SET name = EXCLUDED.name,
    description = EXCLUDED.description,
    content = EXCLUDED.content,
    variables = EXCLUDED.variables,
    is_active = EXCLUDED.is_active;
