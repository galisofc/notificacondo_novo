-- Insert WhatsApp template for party hall entry checklist
INSERT INTO public.whatsapp_templates (
  slug, 
  name, 
  description, 
  content, 
  variables, 
  is_active,
  waba_template_name,
  waba_language,
  params_order,
  button_config
) VALUES (
  'party_hall_checklist_entrada',
  'Checklist de Entrada - Salão de Festas',
  'Enviado ao morador quando a reserva do salão de festas entra em uso, com link para preencher o checklist de entrada',
  '🏢 *{condominio}*

Olá, *{nome}*!

Sua reserva do *{espaco}* para o dia *{data}* está ativa! 🎉

Por favor, preencha o checklist de entrada clicando no link abaixo:
👉 {link_checklist}

Este checklist é obrigatório para registro das condições do espaço.',
  ARRAY['condominio', 'nome', 'espaco', 'data', 'link_checklist'],
  true,
  'party_hall_checklist_entrada',
  'pt_BR',
  ARRAY['condominio', 'nome', 'espaco', 'data', 'link_checklist'],
  NULL
);
