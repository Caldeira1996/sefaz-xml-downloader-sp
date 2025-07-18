
import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/components/auth/AuthProvider';
import { AlertCircle, CheckCircle, Info } from 'lucide-react';

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
  const [ultimoResultado, setUltimoResultado] = useState<any>(null);
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
    setUltimoResultado(null);

    try {
      const certificado = certificados.find(c => c.id === certificadoSelecionado);
      
      console.log('Iniciando consulta SEFAZ...', {
        certificadoId: certificadoSelecionado,
        cnpjConsultado: cnpjConsulta.replace(/\D/g, ''),
        tipoConsulta,
        ambiente: certificado?.ambiente
      });
      
      const response = await supabase.functions.invoke('sefaz-consulta', {
        body: {
          certificadoId: certificadoSelecionado,
          cnpjConsultado: cnpjConsulta.replace(/\D/g, ''),
          tipoConsulta,
          ambiente: certificado?.ambiente || 'homologacao'
        }
      });

      console.log('Resposta da função:', response);

      if (response.error) {
        console.error('Erro na função:', response.error);
        throw new Error(response.error.message || 'Erro desconhecido');
      }

      const { data } = response;
      setUltimoResultado(data);
      
      if (data.success) {
        toast({
          title: "Consulta realizada com sucesso!",
          description: `${data.totalXmls} XMLs encontrados, ${data.xmlsBaixados} baixados com sucesso.`,
        });
      } else {
        toast({
          title: "Consulta realizada com avisos",
          description: data.detalhes || "Verifique os detalhes abaixo.",
          variant: "destructive",
        });
      }

      onConsultaIniciada();
    } catch (error: any) {
      console.error('Erro na consulta:', error);
      toast({
        title: "Erro na consulta",
        description: error.message,
        variant: "destructive",
      });
      setUltimoResultado({
        success: false,
        error: error.message
      });
    } finally {
      setLoading(false);
    }
  };

  const formatCnpj = (value: string) => {
    const numbers = value.replace(/\D/g, '');
    return numbers.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, '$1.$2.$3/$4-$5');
  };

  const certificadoSelecionadoObj = certificados.find(c => c.id === certificadoSelecionado);
  const cnpjDiferente = certificadoSelecionadoObj && 
    cnpjConsulta.replace(/\D/g, '') !== certificadoSelecionadoObj.cnpj.replace(/\D/g, '');

  return (
    <div className="space-y-4">
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
            {certificadoSelecionadoObj && (
              <p className="text-sm text-muted-foreground mt-1">
                Ambiente: <span className="font-medium">{certificadoSelecionadoObj.ambiente}</span>
              </p>
            )}
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
            {cnpjDiferente && (
              <Alert className="mt-2">
                <Info className="h-4 w-4" />
                <AlertDescription>
                  <strong>Atenção:</strong> O CNPJ consultado é diferente do CNPJ do certificado.
                  Você está consultando NFes direcionadas ao CNPJ <strong>{formatCnpj(cnpjConsulta)}</strong>
                  usando o certificado do CNPJ <strong>{formatCnpj(certificadoSelecionadoObj?.cnpj || '')}</strong>.
                </AlertDescription>
              </Alert>
            )}
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

      {/* Resultado da última consulta */}
      {ultimoResultado && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              {ultimoResultado.success ? (
                <CheckCircle className="h-5 w-5 text-green-500" />
              ) : (
                <AlertCircle className="h-5 w-5 text-red-500" />
              )}
              Resultado da Consulta
            </CardTitle>
          </CardHeader>
          <CardContent>
            {ultimoResultado.success ? (
              <div className="space-y-2">
                <p><strong>XMLs encontrados:</strong> {ultimoResultado.totalXmls}</p>
                <p><strong>XMLs baixados:</strong> {ultimoResultado.xmlsBaixados}</p>
                {ultimoResultado.detalhes && (
                  <p><strong>Detalhes:</strong> {ultimoResultado.detalhes}</p>
                )}
              </div>
            ) : (
              <div className="space-y-2">
                <p className="text-red-600"><strong>Erro:</strong> {ultimoResultado.error}</p>
                {ultimoResultado.details && (
                  <p className="text-sm text-muted-foreground">{ultimoResultado.details}</p>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
};
