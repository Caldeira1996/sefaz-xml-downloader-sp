import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { CheckCircle, XCircle, Loader2, RefreshCw, Wifi, WifiOff, Server, AlertTriangle } from 'lucide-react';

interface StatusConectividade {
  conectado: boolean;
  ambiente: string;
  ultimaVerificacao: string;
  detalhes?: string;
  servidor?: string;
  errorType?: string;
  urlUsada?: string;
}

export const StatusConectividade = () => {
  const [status, setStatus] = useState<StatusConectividade | null>(null);
  const [verificando, setVerificando] = useState(false);
  const [servidorOnline, setServidorOnline] = useState(false);
  const { toast } = useToast();

  const backendBaseUrl = process.env.NEXT_PUBLIC_BACKEND_URL || 'https://www.xmlprodownloader.com.br';

  const verificarServidorBackend = async () => {
    try {
      console.log('🔍 Verificando servidor backend...');
      const response = await fetch(`${backendBaseUrl}/health`);

      if (response.ok) {
        const data = await response.json();
        console.log('✅ Servidor backend online:', data);
        setServidorOnline(true);
        return { success: true, data, url: response.url };
      } else {
        console.error('❌ Servidor retornou erro:', response.status, response.statusText);
        setServidorOnline(false);
        return { success: false, error: `HTTP ${response.status}`, url: response.url };
      }
    } catch (error: any) {
      console.error('❌ Servidor backend offline:', error);
      setServidorOnline(false);

      let errorType = 'CONNECTION_ERROR';
      const msg = error.message || '';
      if (msg.includes('net::ERR_CERT') || msg.includes('SSL')) {
        errorType = 'SSL_ERROR';
      } else if (msg.includes('Mixed Content')) {
        errorType = 'MIXED_CONTENT';
      } else if (msg.includes('CORS')) {
        errorType = 'CORS_ERROR';
      } else if (msg.includes('Failed to fetch')) {
        errorType = 'NETWORK_ERROR';
      } else if (msg.includes('ERR_CONNECTION_TIMED_OUT')) {
        errorType = 'TIMEOUT_ERROR';
      }

      return { success: false, error: msg, type: errorType };
    }
  };

  const verificarConectividade = async () => {
    setVerificando(true);

    try {
      console.log('🔍 Verificando conectividade com SEFAZ via backend...');

      const backendResult = await verificarServidorBackend();

      if (!backendResult.success) {
        let detalhes = `Servidor backend offline.`;
        switch (backendResult.type) {
          case 'TIMEOUT_ERROR':
            detalhes = `⏱️ Timeout ao conectar: verifique firewall e Security Groups da AWS.`;
            break;
          case 'SSL_ERROR':
            detalhes = `⚠️ Erro SSL/TLS: Certificado inválido ou auto-assinado.`;
            break;
          case 'MIXED_CONTENT':
            detalhes = `Erro Mixed Content: Frontend HTTPS não pode acessar servidor HTTP.`;
            break;
          case 'CORS_ERROR':
            detalhes = `Erro CORS: Servidor não permite requisições cross-origin.`;
            break;
          case 'NETWORK_ERROR':
            detalhes = `Erro de rede: não foi possível conectar ao servidor.`;
            break;
          default:
            detalhes = `Erro: ${backendResult.error}`;
        }

        setStatus({
          conectado: false,
          ambiente: 'N/A',
          ultimaVerificacao: new Date().toLocaleString('pt-BR'),
          detalhes,
          servidor: 'Offline',
          errorType: backendResult.type,
          urlUsada: backendBaseUrl,
        });

        toast({
          title: "🔌 Servidor Backend Offline",
          description: detalhes,
          variant: "destructive",
        });

        return;
      }

      // Backend online, consultar status SEFAZ (sem token)
      const response = await fetch(`${backendBaseUrl}/api/sefaz/status`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ ambiente: 'producao' }),
      });

      if (!response.ok) {
        throw new Error(`Erro HTTP: ${response.status}`);
      }

      const data = await response.json();

      setStatus({
        conectado: data.success,
        ambiente: 'Produção',
        ultimaVerificacao: new Date().toLocaleString('pt-BR'),
        detalhes: data.success
          ? `✅ Conectado via ${backendResult.url || 'backend'} (${data.conectividade?.statusCode || 'sem código'})`
          : data.error || 'Erro desconhecido',
        servidor: 'Online',
        urlUsada: backendResult.url || backendBaseUrl,
      });

      if (data.success) {
        toast({
          title: "✅ Conectividade OK",
          description: `Backend conectado com SEFAZ SP via ${backendResult.url || backendBaseUrl}`,
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
        servidor: servidorOnline ? 'Online' : 'Offline',
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

  // Verificar ao montar o componente
  useEffect(() => {
    verificarConectividade();
  }, []);

  const backendUrl = backendBaseUrl;
  const isHttps = backendUrl.startsWith('https');
  const hostname = window.location.hostname;
  const isLovable = hostname.endsWith('.lovableproject.com') || hostname.endsWith('.lovable.app');

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
          {isLovable && status?.errorType === 'TIMEOUT_ERROR' && (
            <AlertTriangle className="h-4 w-4 text-orange-500" />
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
                  Última verificação: {status.ultimaVerificacao} | UTC: {new Date().toISOString()}
                </p>
              )}

              {status?.detalhes && (
                <p className={`text-xs mt-1 ${status.conectado ? 'text-green-600' : 'text-red-600'}`}>
                  {status.detalhes}
                </p>
              )}

              {status?.urlUsada && (
                <p className="text-xs text-blue-600 mt-1">
                  URL: {status.urlUsada}
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

        {!servidorOnline && status && (
          <div className="mt-3 p-3 bg-red-50 border border-red-200 rounded text-xs text-red-700">
            <div className="font-semibold mb-2">🔍 Diagnóstico:</div>

            <div className="space-y-1">
              <div><strong>🌐 Ambiente:</strong> {isLovable ? 'Lovable' : 'Produção/Local'}</div>
              <div><strong>📡 Protocolo:</strong> {isHttps ? 'HTTPS' : 'HTTP'}</div>
              <div><strong>🎯 URL Testada:</strong> {status.urlUsada || backendUrl}</div>

              {status.errorType === 'TIMEOUT_ERROR' && (
                <div className="mt-2 p-2 bg-orange-100 border border-orange-300 rounded">
                  <div><strong>⏱️ Erro de Timeout</strong></div>
                  <div>• Verifique Security Groups da AWS (porta 443 e 3002)</div>
                  <div>• Verifique firewall: <code>sudo ufw status</code></div>
                  <div>• Libere portas: <code>sudo ufw allow 443 && sudo ufw allow 3002</code></div>
                  <div>• Configure nginx para proxy reverso na porta 443</div>
                </div>
              )}

              {status.errorType === 'SSL_ERROR' && (
                <div className="mt-2 p-2 bg-orange-100 border border-orange-300 rounded">
                  <div><strong>⚠️ Certificado SSL Inválido</strong></div>
                  <div>• Use certificado válido (Let's Encrypt)</div>
                  <div>• Configure nginx com SSL adequado</div>
                </div>
              )}

              {status.errorType === 'NETWORK_ERROR' && (
                <div className="mt-2 p-2 bg-red-100 border border-red-300 rounded">
                  <div><strong>📡 Erro de Rede</strong></div>
                  <div>• Verifique se o servidor está rodando</div>
                  <div>• Verifique firewall: <code>sudo ufw status</code></div>
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
