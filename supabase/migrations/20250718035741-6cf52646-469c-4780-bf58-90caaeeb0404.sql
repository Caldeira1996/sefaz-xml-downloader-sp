-- Criar tabela para armazenar certificados digitais dos usuários
CREATE TABLE public.certificados (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  nome TEXT NOT NULL,
  cnpj TEXT NOT NULL,
  certificado_base64 TEXT NOT NULL, -- Certificado A1 em base64
  senha_certificado TEXT NOT NULL, -- Senha do certificado (criptografada)
  ambiente TEXT NOT NULL DEFAULT 'homologacao' CHECK (ambiente IN ('producao', 'homologacao')),
  ativo BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Criar tabela para armazenar consultas realizadas
CREATE TABLE public.consultas_sefaz (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  certificado_id UUID NOT NULL REFERENCES public.certificados(id),
  cnpj_consultado TEXT NOT NULL,
  tipo_consulta TEXT NOT NULL, -- 'manifestacao', 'download_nfe', etc.
  status TEXT NOT NULL DEFAULT 'processando' CHECK (status IN ('processando', 'concluido', 'erro')),
  resultado JSONB,
  erro_mensagem TEXT,
  total_xmls INTEGER DEFAULT 0,
  xmls_baixados INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Criar tabela para armazenar XMLs baixados
CREATE TABLE public.xmls_nfe (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  consulta_id UUID NOT NULL REFERENCES public.consultas_sefaz(id),
  user_id UUID NOT NULL,
  chave_nfe TEXT NOT NULL UNIQUE,
  numero_nfe TEXT,
  cnpj_emitente TEXT,
  razao_social_emitente TEXT,
  data_emissao TIMESTAMP WITH TIME ZONE,
  valor_total DECIMAL(15,2),
  xml_content TEXT NOT NULL, -- Conteúdo do XML
  status_manifestacao TEXT, -- 'pendente', 'confirmada', 'desconhecida', etc.
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Habilitar RLS em todas as tabelas
ALTER TABLE public.certificados ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.consultas_sefaz ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.xmls_nfe ENABLE ROW LEVEL SECURITY;

-- Políticas RLS para certificados
CREATE POLICY "Usuários podem ver seus próprios certificados" 
ON public.certificados 
FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Usuários podem criar seus próprios certificados" 
ON public.certificados 
FOR INSERT 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Usuários podem atualizar seus próprios certificados" 
ON public.certificados 
FOR UPDATE 
USING (auth.uid() = user_id);

CREATE POLICY "Usuários podem deletar seus próprios certificados" 
ON public.certificados 
FOR DELETE 
USING (auth.uid() = user_id);

-- Políticas RLS para consultas
CREATE POLICY "Usuários podem ver suas próprias consultas" 
ON public.consultas_sefaz 
FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Usuários podem criar suas próprias consultas" 
ON public.consultas_sefaz 
FOR INSERT 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Usuários podem atualizar suas próprias consultas" 
ON public.consultas_sefaz 
FOR UPDATE 
USING (auth.uid() = user_id);

-- Políticas RLS para XMLs
CREATE POLICY "Usuários podem ver seus próprios XMLs" 
ON public.xmls_nfe 
FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Usuários podem criar seus próprios XMLs" 
ON public.xmls_nfe 
FOR INSERT 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Usuários podem atualizar seus próprios XMLs" 
ON public.xmls_nfe 
FOR UPDATE 
USING (auth.uid() = user_id);

-- Função para atualizar timestamps
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Triggers para timestamps
CREATE TRIGGER update_certificados_updated_at
BEFORE UPDATE ON public.certificados
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_consultas_sefaz_updated_at
BEFORE UPDATE ON public.consultas_sefaz
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_xmls_nfe_updated_at
BEFORE UPDATE ON public.xmls_nfe
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Índices para performance
CREATE INDEX idx_certificados_user_id ON public.certificados(user_id);
CREATE INDEX idx_certificados_cnpj ON public.certificados(cnpj);
CREATE INDEX idx_consultas_user_id ON public.consultas_sefaz(user_id);
CREATE INDEX idx_consultas_certificado_id ON public.consultas_sefaz(certificado_id);
CREATE INDEX idx_xmls_user_id ON public.xmls_nfe(user_id);
CREATE INDEX idx_xmls_consulta_id ON public.xmls_nfe(consulta_id);
CREATE INDEX idx_xmls_chave_nfe ON public.xmls_nfe(chave_nfe);