
import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/components/auth/AuthProvider';
import { CheckCircle, XCircle, Loader2, RefreshCw, Wifi, WifiOff } from 'lucide-react';

interface StatusConectividade {
  conectado: boolean;
  ambiente: string;
  ultimaVerificacao: string;
  detalhes?: string;
}

export const StatusConectividade = () => {
  const [status, setStatus] = useState<StatusConectividade | null>(null);
  const [verificando, setVerificando] = useState(false);
  const { toast } = useToast();
  const { user } = useAuth();

  const verificarConectividade = async () => {
    if (!user) return;

    setVerificando(true);
    
    try {
      console.log('🔍 Verificando conectividade com SEFAZ...');
      
      const response = await supabase.functions.invoke('sefaz-status', {
        body: {
          ambiente: 'producao'
        }
      });

      console.log('📡 Resposta da verificação:', response);

      if (response.error) {
        throw new Error(response.error.message || 'Erro desconhecido');
      }

      const { data } = response;
      
      setStatus({
        conectado: data.success,
        ambiente: 'Produção',
        ultimaVerificacao: new Date().toLocaleString('pt-BR'),
        detalhes: data.success ? 'Serviços SEFAZ operacionais' : data.error
      });

      if (data.success) {
        toast({
          title: "✅ SEFAZ Conectado",
          description: "Serviços operacionais - consultas podem ser realizadas",
        });
      } else {
        toast({
          title: "❌ SEFAZ Desconectado",
          description: data.error || "Falha na conectividade",
          variant: "destructive",
        });
      }

    } catch (error: any) {
      console.error('❌ Erro na verificação:', error);
      
      setStatus({
        conectado: false,
        ambiente: 'Produção',
        ultimaVerificacao: new Date().toLocaleString('pt-BR'),
        detalhes: error.message
      });

      toast({
        title: "Erro na verificação",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setVerificando(false);
    }
  };

  // Verificar automaticamente ao carregar
  useEffect(() => {
    if (user) {
      verificarConectividade();
    }
  }, [user]);

  // Verificar a cada 5 minutos
  useEffect(() => {
    if (!user) return;

    const interval = setInterval(() => {
      verificarConectividade();
    }, 5 * 60 * 1000); // 5 minutos

    return () => clearInterval(interval);
  }, [user]);

  if (!user) return null;

  return (
    <Card className="mb-4">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm flex items-center gap-2">
          {status?.conectado ? (
            <Wifi className="h-4 w-4 text-green-500" />
          ) : (
            <WifiOff className="h-4 w-4 text-red-500" />
          )}
          Status SEFAZ
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-0">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            {verificando ? (
              <Loader2 className="h-5 w-5 animate-spin text-blue-500" />
            ) : status?.conectado ? (
              <CheckCircle className="h-5 w-5 text-green-500" />
            ) : (
              <XCircle className="h-5 w-5 text-red-500" />
            )}
            
            <div>
              <div className="flex items-center gap-2">
                <Badge 
                  variant={status?.conectado ? "default" : "destructive"}
                  className="text-xs"
                >
                  {verificando ? 'Verificando...' : status?.conectado ? 'Conectado' : 'Desconectado'}
                </Badge>
                {status && (
                  <span className="text-xs text-muted-foreground">
                    {status.ambiente}
                  </span>
                )}
              </div>
              
              {status && (
                <p className="text-xs text-muted-foreground mt-1">
                  Última verificação: {status.ultimaVerificacao}
                </p>
              )}
              
              {status?.detalhes && !status.conectado && (
                <p className="text-xs text-red-600 mt-1">
                  {status.detalhes}
                </p>
              )}
            </div>
          </div>

          <Button
            variant="outline"
            size="sm"
            onClick={verificarConectividade}
            disabled={verificando}
            className="h-8"
          >
            <RefreshCw className={`h-3 w-3 mr-1 ${verificando ? 'animate-spin' : ''}`} />
            Verificar
          </Button>
        </div>

        {!status?.conectado && status && (
          <div className="mt-3 p-2 bg-red-50 border border-red-200 rounded text-xs text-red-700">
            <strong>⚠️ Atenção:</strong> Não é possível realizar consultas enquanto o SEFAZ estiver desconectado.
            Verifique sua conexão com a internet ou tente novamente em alguns minutos.
          </div>
        )}
      </CardContent>
    </Card>
  );
};
