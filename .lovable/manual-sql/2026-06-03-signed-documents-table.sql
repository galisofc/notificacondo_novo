-- Tabela para log de auditoria de documentos assinados
CREATE TABLE IF NOT EXISTS signed_documents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    signer_id UUID REFERENCES auth.users(id),
    signer_name TEXT NOT NULL,
    file_hash TEXT UNIQUE NOT NULL, -- Hash SHA-256 do arquivo original
    file_name TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Habilitar RLS
ALTER TABLE signed_documents ENABLE ROW LEVEL SECURITY;

-- Política: Qualquer um pode ler para verificar autenticidade (público)
CREATE POLICY "Qualquer um pode verificar assinaturas"
ON signed_documents FOR SELECT
TO public
USING (true);

-- Política: Apenas o próprio sistema/síndico pode registrar uma assinatura
CREATE POLICY "Síndicos podem registrar suas assinaturas"
ON signed_documents FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = signer_id);

-- Recarregar cache
NOTIFY pgrst, 'reload schema';
