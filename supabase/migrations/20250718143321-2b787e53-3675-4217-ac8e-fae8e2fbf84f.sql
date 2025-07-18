
-- Corrigir a função para ter search_path seguro
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- Adicionar campo para marcar certificado como principal
ALTER TABLE public.certificados 
ADD COLUMN IF NOT EXISTS is_principal BOOLEAN DEFAULT false;

-- Garantir que apenas um certificado por usuário seja principal
CREATE OR REPLACE FUNCTION public.ensure_single_principal_certificate()
RETURNS TRIGGER 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Se está marcando como principal, desmarcar todos os outros do mesmo usuário
  IF NEW.is_principal = true THEN
    UPDATE public.certificados 
    SET is_principal = false 
    WHERE user_id = NEW.user_id AND id != NEW.id;
  END IF;
  
  RETURN NEW;
END;
$$;

-- Criar trigger para garantir certificado principal único
DROP TRIGGER IF EXISTS ensure_single_principal_certificate_trigger ON public.certificados;
CREATE TRIGGER ensure_single_principal_certificate_trigger
  BEFORE INSERT OR UPDATE ON public.certificados
  FOR EACH ROW
  EXECUTE FUNCTION public.ensure_single_principal_certificate();
