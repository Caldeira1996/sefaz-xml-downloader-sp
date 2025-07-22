import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { StatusConectividade } from './StatusConectividade';
import { AlertCircle, CheckCircle, Info, Calendar as CalendarIcon, ShieldCheck, Server } from 'lucide-react';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';

interface Certificado {
  id: string;
  nome: string;
  cnpj: string;
  ambiente: string;
  is_principal: boolean;
}

export const ConsultaForm = ({ onConsultaIniciada }: { onConsultaIniciada: () => void }) => {
  const [certificados, setCertificados] = useState<Certificado[]>([]);
  const [certificadoSelecionado, setCertificadoSelecionado] = useState('');
  const [cnpjConsulta, setCnpjConsulta] = useState('');
  const [dataInicio, setDataInicio] = useState<Date>();
  const [dataFim, setDataFim] = useState<Date>();
  const [loading, setLoading] = useState(false);
  const [ultimoResultado, setUltimoResultado] = useState<any>(null);
  const { toast } = useToast();

  useEffect(() => {
    carregarCertificados();
  }, []);

  const carregarCertificados = async () => {
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_BACKEND_URL || 'https://xmlprodownloader.com.br'}/api/certificados`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.message || 'Erro ao carregar certificados');
      }

      const data: Certificado[] = await res.json();

      data.sort((a, b) => {
        if (a.is_principal === b.is_principal) {
          return 0;
        }
        return a.is_principal ? -1 : 1;
      });

      setCertificados(data);

      const certificadoPrincipal = data.find(cert => cert.is_principal);
      if (certificadoPrincipal && !certificadoSelecionado) {
        setCertificadoSelecionado(certificadoPrincipal.id);
      }
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

    // REMOVIDO verificação de sessão (sem autenticação)

    setLoading(true);
    setUltimoResultado(null);

    try {
      const certificado = certificados.find(c => c.id === certificadoSelecionado);

      const requestBody = {
        certificadoId: certificadoSelecionado,
        cnpjConsultado: cnpjConsulta.replace(/\D/g, ''),
        tipoConsulta,
        ambiente: certificado?.ambiente || 'homologacao',
        ...(dataInicio && { dataInicio: dataInicio.toISOString().split('T')[0] }),
        ...(dataFim && { dataFim: dataFim.toISOString().split('T')[0] }),
      };

      const res = await fetch(`${process.env.NEXT_PUBLIC_BACKEND_URL || 'https://xmlprodownloader.com.br'}/api/sefaz/consulta`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          // REMOVIDO Authorization
        },
        body: JSON.stringify(requestBody),
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.error || `Erro HTTP: ${res.status}`);
      }

      const data = await res.json();
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

      let errorMessage = error.message;
      if (error.message.includes('Failed to fetch')) {
        errorMessage = 'Erro de conectividade. Verifique se o servidor backend está online e se HTTPS está configurado.';
      }

      toast({
        title: "Erro na consulta",
        description: errorMessage,
        variant: "destructive",
      });

      setUltimoResultado({
        success: false,
        error: errorMessage,
        servidor: 'Backend Node.js',
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
  const cnpjDiferente =
    certificadoSelecionadoObj &&
    cnpjConsulta.replace(/\D/g, '') !== certificadoSelecionadoObj.cnpj.replace(/\D/g, '');

  return (
    <div className="space-y-4">
      {/* Componente de Status de Conectividade */}
      <StatusConectividade />

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Server className="h-5 w-5" />
            Consultar SEFAZ SP (via Backend)
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Alert sobre nova arquitetura */}
          <Alert>
            <Info className="h-4 w-4" />
            <AlertDescription>
              <strong>Mixed Content Fix:</strong> Usando proxy CORS temporário para contornar limitações HTTPS/HTTP.
              Para produção, configure HTTPS no servidor AWS.
            </AlertDescription>
          </Alert>

          <div>
            <Label htmlFor="certificado">Certificado Digital</Label>
            <Select value={certificadoSelecionado} onValueChange={setCertificadoSelecionado}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione um certificado" />
              </SelectTrigger>
              <SelectContent>
                {certificados.map((cert) => (
                  <SelectItem key={cert.id} value={cert.id}>
                    <div className="flex items-center gap-2">
                      {cert.is_principal && <ShieldCheck className="h-4 w-4 text-primary" />}
                      <span>{cert.nome} - {formatCnpj(cert.cnpj)} ({cert.ambiente})</span>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {certificadoSelecionadoObj && (
              <p className="text-sm text-muted-foreground mt-1 flex items-center gap-1">
                {certificadoSelecionadoObj.is_principal && <ShieldCheck className="h-3 w-3 text-primary" />}
                Ambiente: <span className="font-medium">{certificadoSelecionadoObj.ambiente}</span>
                {certificadoSelecionadoObj.is_principal && <span className="text-primary font-medium">(Principal)</span>}
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

          {/* Filtros de Data */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label>Data Início (opcional)</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "w-full justify-start text-left font-normal",
                      !dataInicio && "text-muted-foreground"
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {dataInicio ? format(dataInicio, "dd/MM/yyyy") : "Selecionar data"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0">
                  <Calendar
                    mode="single"
                    selected={dataInicio}
                    onSelect={setDataInicio}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
            </div>

            <div>
              <Label>Data Fim (opcional)</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "w-full justify-start text-left font-normal",
                      !dataFim && "text-muted-foreground"
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {dataFim ? format(dataFim, "dd/MM/yyyy") : "Selecionar data"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0">
                  <Calendar
                    mode="single"
                    selected={dataFim}
                    onSelect={setDataFim}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
            </div>
          </div>

          {(dataInicio || dataFim) && (
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setDataInicio(undefined)}
                disabled={!dataInicio}
              >
                Limpar Data Início
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setDataFim(undefined)}
                disabled={!dataFim}
              >
                Limpar Data Fim
              </Button>
            </div>
          )}

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
              {ultimoResultado.servidor && (
                <Badge variant="outline" className="ml-auto">
                  {ultimoResultado.servidor}
                </Badge>
              )}
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
                {ultimoResultado.ambiente && (
                  <p><strong>Ambiente:</strong> {ultimoResultado.ambiente}</p>
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

            {/* Informações de diagnóstico */}
            {ultimoResultado.diagnostico && (
              <details className="mt-4">
                <summary className="cursor-pointer text-sm font-medium">Informações de Diagnóstico</summary>
                <div className="mt-2 p-3 bg-muted rounded text-xs space-y-1">
                  <p><strong>Servidor:</strong> {ultimoResultado.diagnostico.servidor}</p>
                  <p><strong>Timestamp:</strong> {ultimoResultado.diagnostico.timestamp}</p>
                  {ultimoResultado.diagnostico.observacao && (
                    <p><strong>Observação:</strong> {ultimoResultado.diagnostico.observacao}</p>
                  )}
                  {ultimoResultado.diagnostico.url && (
                    <p><strong>URL SEFAZ:</strong> {ultimoResultado.diagnostico.url}</p>
                  )}
                </div>
              </details>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
};
