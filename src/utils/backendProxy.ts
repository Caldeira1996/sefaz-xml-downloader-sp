
// Configuração do backend com suporte a HTTP/HTTPS
const BACKEND_IP = '56.124.22.200';

// Detectar ambiente baseado no hostname específico do Lovable
const isLovableEnvironment = window.location.hostname.endsWith('.lovableproject.com') || window.location.hostname.endsWith('.lovable.app');

export const getBackendUrl = () => {
  if (isLovableEnvironment) {
    // Em ambiente Lovable, usar HTTPS na porta 3002
    return `https://${BACKEND_IP}:3002`;
  } else {
    // Em outros ambientes, usar HTTP na porta 3001
    return `http://${BACKEND_IP}:3001`;
  }
};

export const makeBackendRequest = async (endpoint: string, options: RequestInit = {}) => {
  const baseUrl = getBackendUrl();
  const url = `${baseUrl}${endpoint}`;
  
  console.log(`🔗 Fazendo requisição para: ${url}`);
  console.log(`🌐 Ambiente detectado: ${isLovableEnvironment ? 'Lovable (HTTPS:3002)' : 'Local/Produção (HTTP:3001)'}`);
  console.log(`📍 Hostname atual: ${window.location.hostname}`);
  
  const headers = {
    ...options.headers,
    'Content-Type': 'application/json',
  };

  try {
    const response = await fetch(url, {
      ...options,
      headers,
      mode: 'cors',
    });
    
    console.log(`✅ Resposta recebida: ${response.status} ${response.statusText}`);
    return response;
  } catch (error) {
    console.error('❌ Erro detalhado na requisição:', {
      error: error.message,
      url,
      tipo: error.name,
      stack: error.stack
    });
    
    // Para ambiente Lovable, se HTTPS falhar, tentar fallback via proxy
    if (isLovableEnvironment && 
        (error.message.includes('Failed to fetch') || 
         error.message.includes('net::ERR_CERT') ||
         error.message.includes('SSL'))) {
      
      console.log('🔄 HTTPS falhou, tentando proxy CORS como fallback...');
      
      try {
        // Usar proxy público temporário
        const proxyUrl = `https://api.allorigins.win/get?url=${encodeURIComponent(url)}`;
        console.log(`🔗 URL do proxy: ${proxyUrl}`);
        
        const proxyResponse = await fetch(proxyUrl, {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
          },
        });
        
        if (proxyResponse.ok) {
          const proxyData = await proxyResponse.json();
          // Simular resposta original
          const mockResponse = new Response(proxyData.contents, {
            status: 200,
            statusText: 'OK via Proxy',
            headers: new Headers({
              'Content-Type': 'application/json',
            }),
          });
          
          console.log(`✅ Sucesso via proxy!`);
          return mockResponse;
        }
      } catch (proxyError) {
        console.error('❌ Proxy também falhou:', proxyError);
      }
    }
    
    throw error;
  }
};
