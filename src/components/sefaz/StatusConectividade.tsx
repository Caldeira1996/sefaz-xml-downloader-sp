
import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/components/auth/AuthProvider';
import { CheckCircle, XCircle, Loader2, RefreshCw, Wifi, WifiOff, Server } from 'lucide-react';

interface StatusConectividade {
  conectado: boolean;
  ambiente: string;
  ultimaVerificacao: string;
  detalhes?: string;
  servidor?: string;
}

// URL do servidor backend local
const BACKEND_URL = 'http://localhost:3001';

export const StatusConectividade = () => {
  const [status, setStatus] = useState<StatusConectividade | null>(null);
  const [verificando, setVerificando] = useState(false);
  const [servidorOnline, setServidorOnline] = useState(false);
  const { toast } = useToast();
  const { user, session } = useAuth();

  const verificarServidorBackend = async () => {
    try {
      const response = await fetch(`${BACKEND_URL}/health`);
      const data = await response.json();
      setServidorOnline(response.ok);
      return response.ok;
    } catch (error) {
      console.error('Servidor backend offline:', error);
      setServidorOnline(false);
      return false;
    }
  };

  const verificarConectividade = async () => {
    if (!user || !session) return;

    setVerificando(true);
    
    try {
      console.log('🔍 Verificando conectividade com SEFAZ via backend...');
      
      // Primeiro verificar se o servidor backend está online
      const backendOnline = await verificarServidorBackend();
      
      if (!backendOnline) {
        setStatus({
          conectado: false,
          ambiente: 'N/A',
          ultimaVerificacao: new Date().toLocaleString('pt-BR'),
          detalhes: 'Servidor backend offline. Inicie o servidor Node.js na porta 3001.',
          servidor: 'Offline'
        });

        toast({
          title: "🔌 Servidor Backend Offline",
          description: "Inicie o servidor Node.js para conectar com SEFAZ",
          variant: "destructive",
        });
        return;
      }

      const response = await fetch(`${BACKEND_URL}/api/sefaz/status`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`
        },
        body: JSON.stringify({
          ambiente: 'producao'
        })
      });

      console.log('📡 Resposta da verificação:', response);

      if (!response.ok) {
        throw new Error(`Erro HTTP: ${response.status}`);
      }

      const data = await response.json();
      
      setStatus({
        conectado: data.success,
        ambiente: 'Produção',
        ultimaVerificacao: new Date().toLocaleString('pt-BR'),
        detalhes: data.success 
          ? `Servidor SEFAZ acessível via backend (${data.conectividade?.statusCode})` 
          : data.error,
        servidor: 'Online'
      });

      if (data.success) {
        toast({
          title: "✅ Conectividade OK",
          description: "Servidor backend conectado com SEFAZ SP",
        });
      } else {
        toast({
          title: "⚠️ Conectividade Limitada",
          description: data.error || "Verifique a conexão com SEFAZ",
          variant: "destructive",
        });
      }

    } catch (error: any) {
      console.error('❌ Erro na verificação:', error);
      
      setStatus({
        conectado: false,
        ambiente: 'Produção',
        ultimaVerificacao: new Date().toLocaleString('pt-BR'),
        detalhes: error.message,
        servidor: servidorOnline ? 'Online' : 'Offline'
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
    if (user && session) {
      verificarConectividade();
    }
  }, [user, session]);

  // Verificar a cada 2 minutos
  useEffect(() => {
    if (!user || !session) return;

    const interval = setInterval(() => {
      verificarConectividade();
    }, 2 * 60 * 1000); // 2 minutos

    return () => clearInterval(interval);
  }, [user, session]);

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
          Status SEFAZ SP
          <Server className={`h-4 w-4 ml-auto ${servidorOnline ? 'text-green-500' : 'text-red-500'}`} />
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
                <Badge 
                  variant={servidorOnline ? "default" : "destructive"}
                  className="text-xs"
                >
                  Backend: {servidorOnline ? 'Online' : 'Offline'}
                </Badge>
              </div>
              
              {status && (
                <p className="text-xs text-muted-foreground mt-1">
                  Última verificação: {status.ultimaVerificacao}
                </p>
              )}
              
              {status?.detalhes && (
                <p className={`text-xs mt-1 ${status.conectado ? 'text-green-600' : 'text-red-600'}`}>
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

        {!servidorOnline && (
          <div className="mt-3 p-2 bg-orange-50 border border-orange-200 rounded text-xs text-orange-700">
            <strong>🔌 Servidor Backend Offline:</strong> Inicie o servidor Node.js executando:
            <code className="block mt-1 bg-orange-100 p-1 rounded">cd backend && npm run dev</code>
          </div>
        )}

        {servidorOnline && !status?.conectado && status && (
          <div className="mt-3 p-2 bg-red-50 border border-red-200 rounded text-xs text-red-700">
            <strong>⚠️ Atenção:</strong> Backend online mas há problemas na conectividade com SEFAZ.
            Verifique sua conexão com a internet e configurações de certificado.
          </div>
        )}
      </CardContent>
    </Card>
  );
};
