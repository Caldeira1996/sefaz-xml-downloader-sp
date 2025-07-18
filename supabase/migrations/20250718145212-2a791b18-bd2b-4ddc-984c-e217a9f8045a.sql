
-- Permitir exclusão de certificados removendo a restrição de chave estrangeira
-- e adicionando CASCADE para quando um certificado for excluído
ALTER TABLE public.consultas_sefaz 
DROP CONSTRAINT IF EXISTS consultas_sefaz_certificado_id_fkey;

ALTER TABLE public.consultas_sefaz 
ADD CONSTRAINT consultas_sefaz_certificado_id_fkey 
FOREIGN KEY (certificado_id) 
REFERENCES public.certificados(id) 
ON DELETE CASCADE;

ALTER TABLE public.xmls_nfe 
DROP CONSTRAINT IF EXISTS xmls_nfe_consulta_id_fkey;

ALTER TABLE public.xmls_nfe 
ADD CONSTRAINT xmls_nfe_consulta_id_fkey 
FOREIGN KEY (consulta_id) 
REFERENCES public.consultas_sefaz(id) 
ON DELETE CASCADE;
