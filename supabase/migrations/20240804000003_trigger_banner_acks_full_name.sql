-- Função para preencher automaticamente o full_name ao inserir ciência de banner
CREATE OR REPLACE FUNCTION public.handle_banner_ack_full_name()
RETURNS TRIGGER AS $$
DECLARE
    profile_name TEXT;
BEGIN
    -- Se o full_name vier nulo, vazio ou "Porteiro", tentamos buscar do perfil
    IF (NEW.full_name IS NULL OR NEW.full_name = '' OR NEW.full_name = 'Porteiro') THEN
        SELECT full_name INTO profile_name FROM public.profiles WHERE id = NEW.user_id;
        
        IF (profile_name IS NOT NULL AND profile_name <> '') THEN
            NEW.full_name := profile_name;
        END IF;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger disparada antes de qualquer INSERT na tabela banner_acknowledgments
DROP TRIGGER IF EXISTS on_banner_ack_insert ON public.banner_acknowledgments;
CREATE TRIGGER on_banner_ack_insert
    BEFORE INSERT ON public.banner_acknowledgments
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_banner_ack_full_name();

-- Garante permissões de execução
GRANT EXECUTE ON FUNCTION public.handle_banner_ack_full_name() TO authenticated;
GRANT EXECUTE ON FUNCTION public.handle_banner_ack_full_name() TO service_role;
