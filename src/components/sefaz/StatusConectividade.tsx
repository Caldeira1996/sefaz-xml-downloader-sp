
import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/components/auth/AuthProvider';
import { CheckCircle, XCircle, Loader2, RefreshCw, Wifi, WifiOff, Server, AlertTriangle } from 'lucide-react';
import { makeBackendRequest, getBackendUrl } from '@/utils/backendProxy';

interface StatusConectividade {
  conectado: boolean;
  ambiente: string;
  ultimaVerificacao: string;
  detalhes?: string;
  servidor?: string;
  errorType?: string;
}

export const StatusConectividade = () => {
  const [status, setStatus] = useState<StatusConectividade | null>(null);
  const [verificando, setVerificando] = useState(false);
  const [servidorOnline, setServidorOnline] = useState(false);
  const { toast } = useToast();
  const { user, session } = useAuth();

  const verificarServidorBackend = async () => {
    try {
      console.log('🔍 Verificando servidor backend...');
      const response = await makeBackendRequest('/health');
      
      if (response.ok) {
        const data = await response.json();
        console.log('✅ Servidor backend online:', data);
        setServidorOnline(true);
        return true;
      } else {
        console.error('❌ Servidor retornou erro:', response.status, response.statusText);
        setServidorOnline(false);
        return false;
      }
    } catch (error) {
      console.error('❌ Servidor backend offline:', error);
      setServidorOnline(false);
      
      // Identificar o tipo de erro
      let errorType = 'CONNECTION_ERROR';
      if (error.message.includes('net::ERR_CERT') || error.message.includes('SSL')) {
        errorType = 'SSL_ERROR';
      } else if (error.message.includes('Mixed Content')) {
        errorType = 'MIXED_CONTENT';
      } else if (error.message.includes('CORS')) {
        errorType = 'CORS_ERROR';
      } else if (error.message.includes('Failed to fetch')) {
        errorType = 'NETWORK_ERROR';
      }
      
      return { error: error.message, type: errorType };
    }
  };

  const verificarConectividade = async () => {
    if (!user || !session) return;

    setVerificando(true);
    
    try {
      console.log('🔍 Verificando conectividade com SEFAZ via backend...');
      
      // Primeiro verificar se o servidor backend está online
      const backendResult = await verificarServidorBackend();
      
      if (backendResult !== true) {
        const backendUrl = getBackendUrl();
        const isHttps = backendUrl.startsWith('https');
        const porta = isHttps ? '3002' : '3001';
        const protocolo = isHttps ? 'HTTPS' : 'HTTP';
        const isLovable = window.location.hostname.endsWith('.lovableproject.com');
        
        let detalhes = `Servidor backend offline (${protocolo}:${porta}).`;
        
        if (typeof backendResult === 'object' && backendResult.error) {
          if (backendResult.type === 'SSL_ERROR') {
            detalhes = `⚠️ Erro SSL/TLS: Certificado inválido ou auto-assinado. ${isLovable ? 'Usando proxy como fallback.' : 'Configure certificados válidos.'}`;
          } else if (backendResult.type === 'MIXED_CONTENT') {
            detalhes = `Mixed Content Error: Frontend HTTPS não pode acessar servidor HTTP.`;
          } else if (backendResult.type === 'CORS_ERROR') {
            detalhes = `CORS Error: Servidor não permite requisições cross-origin.`;
          } else if (backendResult.type === 'NETWORK_ERROR') {
            detalhes = `Network Error: Não foi possível conectar ao servidor na porta ${porta}.`;
          } else {
            detalhes = `Erro de conexão: ${backendResult.error}`;
          }
        }
        
        setStatus({
          conectado: false,
          ambiente: 'N/A',
          ultimaVerificacao: new Date().toLocaleString('pt-BR'),
          detalhes,
          servidor: 'Offline',
          errorType: typeof backendResult === 'object' ? backendResult.type : 'CONNECTION_ERROR'
        });

        toast({
          title: "🔌 Servidor Backend Offline",
          description: detalhes,
          variant: "destructive",
        });
        return;
      }

      // Se chegou aqui, o backend está online, agora testar SEFAZ
      const response = await makeBackendRequest('/api/sefaz/status', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`
        },
        body: JSON.stringify({
          ambiente: 'producao'
        })
      });

      console.log('📡 Resposta da verificação SEFAZ:', response);

      if (!response.ok) {
        throw new Error(`Erro HTTP: ${response.status}`);
      }

      const data = await response.json();
      const backendUrl = getBackendUrl();
      const protocolo = backendUrl.startsWith('https') ? 'HTTPS' : 'HTTP';
      
      setStatus({
        conectado: data.success,
        ambiente: 'Produção',
        ultimaVerificacao: new Date().toLocaleString('pt-BR'),
        detalhes: data.success 
          ? `Servidor SEFAZ acessível via backend ${protocolo} (${data.conectividade?.statusCode})` 
          : data.error,
        servidor: 'Online'
      });

      if (data.success) {
        toast({
          title: "✅ Conectividade OK",
          description: `Servidor backend ${protocolo} conectado com SEFAZ SP`,
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

  if (!user) return null;

  const backendUrl = getBackendUrl();
  const isHttps = backendUrl.startsWith('https');
  const porta = isHttps ? '3002' : '3001';
  const protocolo = isHttps ? 'HTTPS' : 'HTTP';
  const isLovable = window.location.hostname.endsWith('.lovableproject.com');

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
          {isLovable && status?.errorType === 'SSL_ERROR' && (
            <AlertTriangle className="h-4 w-4 text-orange-500" title="Usando proxy devido a certificado SSL" />
          )}
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

        {/* Informações de diagnóstico */}
        {!servidorOnline && status && (
          <div className="mt-3 p-3 bg-red-50 border border-red-200 rounded text-xs text-red-700">
            <div className="font-semibold mb-2">🔍 Diagnóstico:</div>
            
            <div className="space-y-1">
              <div><strong>🌐 Ambiente:</strong> {isLovable ? 'Lovable' : 'Produção/Local'}</div>
              <div><strong>📡 Protocolo:</strong> {protocolo}</div>
              <div><strong>🔌 Porta:</strong> {porta}</div>
              <div><strong>🎯 URL:</strong> {backendUrl}</div>
              
              {status.errorType === 'SSL_ERROR' && isLovable && (
                <div className="mt-2 p-2 bg-orange-100 border border-orange-300 rounded">
                  <div><strong>⚠️ Certificado SSL Inválido</strong></div>
                  <div>• Seu servidor usa certificado auto-assinado</div>
                  <div>• Lovable está tentando usar proxy como fallback</div>
                  <div>• Para produção, use certificados válidos (Let's Encrypt)</div>
                </div>
              )}
              
              {status.errorType === 'NETWORK_ERROR' && (
                <div className="mt-2 p-2 bg-red-100 border border-red-300 rounded">
                  <div><strong>📡 Erro de Rede</strong></div>
                  <div>• Verifique se o servidor está rodando</div>
                  <div>• Comando: <code>npm run start:https</code></div>
                  <div>• Teste local: <code>curl -k https://localhost:3002/health</code></div>
                </div>
              )}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
