import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Download, Eye, RefreshCw } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/components/auth/AuthProvider';

interface XmlNfe {
  id: string;
  chave_nfe: string;
  numero_nfe: string;
  cnpj_emitente: string;
  razao_social_emitente: string;
  data_emissao: string;
  valor_total: number;
  status_manifestacao: string;
  xml_content: string;
}

export const XmlsList = ({ shouldRefresh }: { shouldRefresh: boolean }) => {
  const [xmls, setXmls] = useState<XmlNfe[]>([]);
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();
  const { user } = useAuth();

  useEffect(() => {
    if (user) {
      carregarXmls();
    }
  }, [user, shouldRefresh]);

  const carregarXmls = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('xmls_nfe')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(100);

      if (error) throw error;
      setXmls(data || []);
    } catch (error: any) {
      toast({
        title: "Erro ao carregar XMLs",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const downloadXml = (xml: XmlNfe) => {
    const blob = new Blob([xml.xml_content], { type: 'application/xml' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.style.display = 'none';
    a.href = url;
    a.download = `NFe_${xml.chave_nfe}.xml`;
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(url);
    document.body.removeChild(a);

    toast({
      title: "Download iniciado",
      description: `XML da NFe ${xml.numero_nfe} baixado com sucesso.`,
    });
  };

  const downloadTodosXmls = () => {
    if (xmls.length === 0) return;

    // Criar ZIP com todos os XMLs (implementação simplificada)
    xmls.forEach((xml, index) => {
      setTimeout(() => {
        downloadXml(xml);
      }, index * 100); // Delay para não sobrecarregar o browser
    });

    toast({
      title: "Download em lote iniciado",
      description: `Baixando ${xmls.length} XMLs...`,
    });
  };

  const formatCnpj = (cnpj: string) => {
    if (!cnpj) return '';
    return cnpj.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, '$1.$2.$3/$4-$5');
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(value);
  };

  const formatDate = (dateString: string) => {
    if (!dateString) return '';
    return new Date(dateString).toLocaleDateString('pt-BR');
  };

  const getStatusBadge = (status: string) => {
    const statusConfig = {
      'pendente': { label: 'Pendente', variant: 'default' as const },
      'confirmada': { label: 'Confirmada', variant: 'default' as const },
      'desconhecida': { label: 'Desconhecida', variant: 'secondary' as const },
      'nao_realizada': { label: 'Não Realizada', variant: 'destructive' as const },
    };

    const config = statusConfig[status as keyof typeof statusConfig] || statusConfig.pendente;
    return <Badge variant={config.variant}>{config.label}</Badge>;
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>XMLs das NFe Baixados</CardTitle>
        <div className="flex gap-2">
          <Button 
            onClick={carregarXmls} 
            variant="outline" 
            size="sm"
            disabled={loading}
          >
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            Atualizar
          </Button>
          {xmls.length > 0 && (
            <Button 
              onClick={downloadTodosXmls}
              size="sm"
            >
              <Download className="h-4 w-4 mr-2" />
              Baixar Todos
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="text-center py-8">
            <RefreshCw className="h-8 w-8 animate-spin mx-auto mb-4" />
            Carregando XMLs...
          </div>
        ) : xmls.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            Nenhum XML encontrado. Realize uma consulta primeiro.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Número NFe</TableHead>
                  <TableHead>Chave</TableHead>
                  <TableHead>Emitente</TableHead>
                  <TableHead>CNPJ Emitente</TableHead>
                  <TableHead>Data Emissão</TableHead>
                  <TableHead>Valor Total</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {xmls.map((xml) => (
                  <TableRow key={xml.id}>
                    <TableCell className="font-medium">{xml.numero_nfe}</TableCell>
                    <TableCell className="font-mono text-xs">{xml.chave_nfe}</TableCell>
                    <TableCell className="max-w-48 truncate" title={xml.razao_social_emitente}>
                      {xml.razao_social_emitente}
                    </TableCell>
                    <TableCell>{formatCnpj(xml.cnpj_emitente)}</TableCell>
                    <TableCell>{formatDate(xml.data_emissao)}</TableCell>
                    <TableCell>{formatCurrency(xml.valor_total)}</TableCell>
                    <TableCell>{getStatusBadge(xml.status_manifestacao)}</TableCell>
                    <TableCell>
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => downloadXml(xml)}
                        >
                          <Download className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
};