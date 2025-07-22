import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useToast } from '@/hooks/use-toast';
import { Trash2, Star, ShieldCheck } from 'lucide-react';
import { formatCnpj } from '@/utils/cnpjValidation';

interface Certificado {
  id: string;
  nome: string;
  cnpj: string;
  ambiente: 'producao' | 'homologacao';
  ativo: boolean;
  is_principal: boolean;
  created_at: string;
}

export const CertificadosList = ({ shouldRefresh }: { shouldRefresh?: boolean }) => {
  const [certificados, setCertificados] = useState<Certificado[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    carregarCertificados();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shouldRefresh]);

  const carregarCertificados = async () => {
    setLoading(true);
    try {
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_BACKEND_URL || 'https://www.xmlprodownloader.com.br'}/certificados`,
        {
          headers: {
            'Content-Type': 'application/json',
            // sem Authorization pois não há autenticação
          },
        }
      );

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.message || 'Erro ao carregar certificados');
      }

      const data: Certificado[] = await res.json();

      // Ordena por is_principal (desc) e created_at (desc)
      data.sort((a, b) => {
        if (a.is_principal === b.is_principal) {
          return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
        }
        return a.is_principal ? -1 : 1;
      });

      setCertificados(data);
    } catch (error: any) {
      toast({
        title: 'Erro ao carregar certificados',
        description: error.message,
        variant: 'destructive',
      });
      setCertificados([]);
    } finally {
      setLoading(false);
    }
  };

  // Marcar como principal - aqui provavelmente API requer auth,
  // se não houver, talvez não funcione sem token
  const marcarComoPrincipal = async (certificadoId: string) => {
    try {
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_BACKEND_URL || 'https://www.xmlprodownloader.com.br'}/certificados/${certificadoId}/principal`,
        {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
          },
        }
      );
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.message || 'Erro ao atualizar certificado principal');
      }
      toast({
        title: 'Certificado principal atualizado',
        description: 'O certificado foi marcado como principal com sucesso.',
      });
      carregarCertificados();
    } catch (error: any) {
      toast({
        title: 'Erro ao marcar certificado como principal',
        description: error.message,
        variant: 'destructive',
      });
    }
  };

  const excluirCertificado = async (certificadoId: string, nomeCertificado: string) => {
    if (!confirm(`Tem certeza que deseja excluir o certificado "${nomeCertificado}"?`)) {
      return;
    }

    try {
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_BACKEND_URL || 'https://www.xmlprodownloader.com.br'}/certificados/${certificadoId}`,
        {
          method: 'DELETE',
          headers: {
            'Content-Type': 'application/json',
          },
        }
      );

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.message || 'Erro ao excluir certificado');
      }

      toast({
        title: 'Certificado excluído',
        description: `O certificado "${nomeCertificado}" foi excluído com sucesso.`,
      });

      carregarCertificados();
    } catch (error: any) {
      toast({
        title: 'Erro ao excluir certificado',
        description: error.message,
        variant: 'destructive',
      });
    }
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Certificados Digitais</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center p-6">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary"></div>
            <span className="ml-2">Carregando certificados...</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Certificados Digitais</CardTitle>
      </CardHeader>
      <CardContent>
        {certificados.length === 0 ? (
          <Alert>
            <AlertDescription>
              Nenhum certificado encontrado. Adicione um certificado para começar.
            </AlertDescription>
          </Alert>
        ) : (
          <div className="space-y-4">
            {certificados.map((certificado) => (
              <div
                key={certificado.id}
                className={`border rounded-lg p-4 ${
                  certificado.is_principal 
                    ? 'border-primary bg-primary/5' 
                    : 'border-border'
                }`}
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <h3 className="font-medium">{certificado.nome}</h3>
                      {certificado.is_principal && (
                        <Badge variant="default" className="text-xs">
                          <ShieldCheck className="h-3 w-3 mr-1" />
                          Principal
                        </Badge>
                      )}
                      <Badge 
                        variant={certificado.ambiente === 'producao' ? 'destructive' : 'secondary'}
                        className="text-xs"
                      >
                        {certificado.ambiente === 'producao' ? 'Produção' : 'Homologação'}
                      </Badge>
                      {!certificado.ativo && (
                        <Badge variant="outline" className="text-xs">
                          Inativo
                        </Badge>
                      )}
                    </div>
                    
                    <div className="text-sm text-muted-foreground space-y-1">
                      <p><strong>CNPJ:</strong> {formatCnpj(certificado.cnpj)}</p>
                      <p><strong>Adicionado em:</strong> {new Date(certificado.created_at).toLocaleDateString('pt-BR')}</p>
                    </div>
                  </div>

                  <div className="flex gap-2 ml-4">
                    {!certificado.is_principal && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => marcarComoPrincipal(certificado.id)}
                        className="text-xs"
                      >
                        <Star className="h-3 w-3 mr-1" />
                        Marcar como Principal
                      </Button>
                    )}
                    
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => excluirCertificado(certificado.id, certificado.nome)}
                      className="text-destructive hover:text-destructive text-xs"
                    >
                      <Trash2 className="h-3 w-3 mr-1" />
                      Excluir
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
};
