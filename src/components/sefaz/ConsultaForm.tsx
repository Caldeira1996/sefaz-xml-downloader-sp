import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/components/auth/AuthProvider';

interface Certificado {
  id: string;
  nome: string;
  cnpj: string;
  ambiente: string;
}

export const ConsultaForm = ({ onConsultaIniciada }: { onConsultaIniciada: () => void }) => {
  const [certificados, setCertificados] = useState<Certificado[]>([]);
  const [certificadoSelecionado, setCertificadoSelecionado] = useState('');
  const [cnpjConsulta, setCnpjConsulta] = useState('');
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();
  const { user } = useAuth();

  useEffect(() => {
    if (user) {
      carregarCertificados();
    }
  }, [user]);

  const carregarCertificados = async () => {
    try {
      const { data, error } = await supabase
        .from('certificados')
        .select('id, nome, cnpj, ambiente')
        .eq('ativo', true)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setCertificados(data || []);
    } catch (error: any) {
      toast({
        title: "Erro ao carregar certificados",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const handleConsulta = async (tipoConsulta: 'manifestacao' | 'download_nfe') => {
    if (!certificadoSelecionado || !cnpjConsulta) {
      toast({
        title: "Dados incompletos",
        description: "Selecione um certificado e informe o CNPJ",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);

    try {
      const certificado = certificados.find(c => c.id === certificadoSelecionado);
      
      const response = await supabase.functions.invoke('sefaz-consulta', {
        body: {
          certificadoId: certificadoSelecionado,
          cnpjConsultado: cnpjConsulta.replace(/\D/g, ''),
          tipoConsulta,
          ambiente: certificado?.ambiente || 'homologacao'
        }
      });

      if (response.error) throw response.error;

      const { data } = response;
      
      toast({
        title: "Consulta iniciada com sucesso!",
        description: `${data.totalXmls} XMLs encontrados, ${data.xmlsBaixados} baixados com sucesso.`,
      });

      onConsultaIniciada();
    } catch (error: any) {
      toast({
        title: "Erro na consulta",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const formatCnpj = (value: string) => {
    const numbers = value.replace(/\D/g, '');
    return numbers.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, '$1.$2.$3/$4-$5');
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Consultar SEFAZ SP</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <Label htmlFor="certificado">Certificado Digital</Label>
          <Select value={certificadoSelecionado} onValueChange={setCertificadoSelecionado}>
            <SelectTrigger>
              <SelectValue placeholder="Selecione um certificado" />
            </SelectTrigger>
            <SelectContent>
              {certificados.map((cert) => (
                <SelectItem key={cert.id} value={cert.id}>
                  {cert.nome} - {formatCnpj(cert.cnpj)} ({cert.ambiente})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div>
          <Label htmlFor="cnpjConsulta">CNPJ para Consulta</Label>
          <Input
            id="cnpjConsulta"
            value={formatCnpj(cnpjConsulta)}
            onChange={(e) => setCnpjConsulta(e.target.value)}
            placeholder="00.000.000/0000-00"
            maxLength={18}
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Button
            onClick={() => handleConsulta('manifestacao')}
            disabled={loading}
            className="w-full"
          >
            {loading ? 'Consultando...' : 'Consultar Manifestações'}
          </Button>
          
          <Button
            onClick={() => handleConsulta('download_nfe')}
            disabled={loading}
            variant="secondary"
            className="w-full"
          >
            {loading ? 'Baixando...' : 'Baixar XMLs'}
          </Button>
        </div>

        {certificados.length === 0 && (
          <div className="text-center text-muted-foreground p-4">
            Nenhum certificado encontrado. Adicione um certificado primeiro.
          </div>
        )}
      </CardContent>
    </Card>
  );
};