-- Rodar no SQL Editor do Supabase Dashboard.
-- Cria policies de RLS no storage.objects para o bucket 'certificates'.
-- Cada usuário (síndico) acessa apenas arquivos dentro da sua própria pasta: <user_id>/...

DROP POLICY IF EXISTS "Sindicos podem ler seus certificados" ON storage.objects;
DROP POLICY IF EXISTS "Sindicos podem enviar seus certificados" ON storage.objects;
DROP POLICY IF EXISTS "Sindicos podem atualizar seus certificados" ON storage.objects;
DROP POLICY IF EXISTS "Sindicos podem remover seus certificados" ON storage.objects;

CREATE POLICY "Sindicos podem ler seus certificados"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'certificates'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

CREATE POLICY "Sindicos podem enviar seus certificados"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'certificates'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

CREATE POLICY "Sindicos podem atualizar seus certificados"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'certificates'
  AND (storage.foldername(name))[1] = auth.uid()::text
)
WITH CHECK (
  bucket_id = 'certificates'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

CREATE POLICY "Sindicos podem remover seus certificados"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'certificates'
  AND (storage.foldername(name))[1] = auth.uid()::text
);
