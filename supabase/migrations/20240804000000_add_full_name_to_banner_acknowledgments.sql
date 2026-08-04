-- Adiciona a coluna full_name à tabela banner_acknowledgments se ela não existir
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE table_name = 'banner_acknowledgments' AND column_name = 'full_name') THEN
        ALTER TABLE public.banner_acknowledgments ADD COLUMN full_name TEXT;
    END IF;
END $$;

-- Garante que o síndico e admin possam ver o nome
GRANT SELECT ON public.banner_acknowledgments TO authenticated;
