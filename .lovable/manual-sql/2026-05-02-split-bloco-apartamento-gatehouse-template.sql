-- =====================================================
-- Atualiza template `gatehouse_party_hall_release`
-- separando "bloco" e "apartamento" em variáveis distintas
-- Rode no Supabase SQL Editor
-- =====================================================

UPDATE public.whatsapp_templates
SET
  content = '🔑 *LIBERAÇÃO DE SALÃO DE FESTAS*

🏢 *{condominio}*

Hoje há reserva confirmada do *{espaco}*.

👤 Morador: *{morador}*
🏠 Bloco: *{bloco}* — Apartamento: *{apartamento}*
📅 Data: {data}
⏰ Horário: {horario_inicio} às {horario_fim}

Por favor, libere a chave do salão para o morador no horário previsto.',
  variables = ARRAY['condominio', 'morador', 'bloco', 'apartamento', 'espaco', 'data', 'horario_inicio', 'horario_fim'],
  -- Mantém compatibilidade: se o template WABA aprovado ainda tiver 7 params,
  -- ajuste params_order via UI após reaprovar o template na Meta.
  params_order = ARRAY['condominio', 'morador', 'bloco', 'apartamento', 'espaco', 'data', 'horario_inicio', 'horario_fim']
WHERE slug = 'gatehouse_party_hall_release';
