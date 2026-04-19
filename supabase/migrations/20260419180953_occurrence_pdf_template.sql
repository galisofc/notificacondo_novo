-- Occurrence PDF template (singleton table for centralized PDF text editing)
CREATE TABLE IF NOT EXISTS public.occurrence_pdf_template (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  intro_paragraph text NOT NULL DEFAULT '',
  syndic_role_paragraph text NOT NULL DEFAULT '',
  penalty_multa_paragraph text NOT NULL DEFAULT '',
  penalty_advertencia_paragraph text NOT NULL DEFAULT '',
  penalty_notificacao_paragraph text NOT NULL DEFAULT '',
  defense_deadline_paragraph text NOT NULL DEFAULT '',
  closing_remarks text NOT NULL DEFAULT '',
  signature_label text NOT NULL DEFAULT 'Atenciosamente;',
  footer_text text NOT NULL DEFAULT '',
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid REFERENCES auth.users(id) ON DELETE SET NULL
);

ALTER TABLE public.occurrence_pdf_template ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Read occurrence pdf template" ON public.occurrence_pdf_template;
CREATE POLICY "Read occurrence pdf template"
  ON public.occurrence_pdf_template
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Super admins insert pdf template" ON public.occurrence_pdf_template;
CREATE POLICY "Super admins insert pdf template"
  ON public.occurrence_pdf_template
  FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'super_admin'));

DROP POLICY IF EXISTS "Super admins update pdf template" ON public.occurrence_pdf_template;
CREATE POLICY "Super admins update pdf template"
  ON public.occurrence_pdf_template
  FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'super_admin'))
  WITH CHECK (public.has_role(auth.uid(), 'super_admin'));

DROP POLICY IF EXISTS "Super admins delete pdf template" ON public.occurrence_pdf_template;
CREATE POLICY "Super admins delete pdf template"
  ON public.occurrence_pdf_template
  FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'super_admin'));

INSERT INTO public.occurrence_pdf_template (
  id, intro_paragraph, syndic_role_paragraph,
  penalty_multa_paragraph, penalty_advertencia_paragraph, penalty_notificacao_paragraph,
  defense_deadline_paragraph, closing_remarks, signature_label, footer_text
)
SELECT
  '00000000-0000-0000-0000-000000000001'::uuid,
  'Na qualidade de síndico deste Condomínio, no uso de minhas atribuições legais e conforme determinação do corpo diretivo, sirvo-me da presente para notificá-lo(a) acerca do descumprimento das normas previstas no Regulamento Interno.',
  'Ressaltamos que o cargo de síndico tem por finalidade a gestão do condomínio e o fiel cumprimento do Regimento Interno, cuja versão atualizada está disponível para consulta de todos os condôminos, conforme aprovado em assembleia.',
  'Diante do ocorrido, torna-se necessária a aplicação da multa prevista no Regimento Interno deste Condomínio, a qual será lançada juntamente com a quota condominial.',
  'Diante do ocorrido, esta notificação está sendo emitida como advertência formal, sendo o próximo passo, em caso de reincidência, a aplicação da multa prevista no Regimento Interno.',
  'Diante do ocorrido, serve a presente como NOTIFICAÇÃO FORMAL sobre o descumprimento das normas condominiais.',
  'Fica estipulado o prazo de {{prazo_defesa}} dias para que V. Sa. apresente, se assim desejar, suas razões mediante defesa por escrito, a qual será submetida à análise do Conselho Consultivo.',
  'Contamos com a sua compreensão e colaboração no sentido de mantermos o respeito às normas e a boa convivência entre os moradores.',
  'Atenciosamente;',
  ''
WHERE NOT EXISTS (SELECT 1 FROM public.occurrence_pdf_template);
