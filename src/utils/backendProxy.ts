
// Configuração do backend com suporte a HTTP/HTTPS
const BACKEND_IP = '56.124.22.200';

// Detectar se estamos em desenvolvimento ou produção
const isDevelopment = window.location.hostname.includes('lovableproject.com');

export const getBackendUrl = () => {
  if (isDevelopment) {
    // Em desenvolvimento (Lovable), usar HTTPS na porta 3002
    return `https://${BACKEND_IP}:3002`;
  } else {
    // Em produção local, usar HTTP na porta 3001
    return `http://${BACKEND_IP}:3001`;
  }
};

export const makeBackendRequest = async (endpoint: string, options: RequestInit = {}) => {
  const baseUrl = getBackendUrl();
  const url = `${baseUrl}${endpoint}`;
  
  console.log(`🔗 Fazendo requisição para: ${url}`);
  console.log(`🌐 Ambiente detectado: ${isDevelopment ? 'Desenvolvimento (Lovable)' : 'Produção Local'}`);
  console.log(`📍 Hostname atual: ${window.location.hostname}`);
  
  const headers = {
    ...options.headers,
    'Content-Type': 'application/json',
  };

  try {
    const response = await fetch(url, {
      ...options,
      headers,
      // Adicionar mode para CORS se necessário
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
    
    // Se for erro de CORS ou Mixed Content, tentar proxy público temporário
    if (error.message.includes('Mixed Content') || 
        error.message.includes('CORS') || 
        error.message.includes('Failed to fetch')) {
      
      console.log('🔄 Tentando usar proxy CORS para contornar limitações...');
      
      try {
        const proxyUrl = `https://cors-anywhere.herokuapp.com/${url}`;
        console.log(`🔗 URL do proxy: ${proxyUrl}`);
        
        const proxyResponse = await fetch(proxyUrl, {
          ...options,
          headers: {
            ...headers,
            'X-Requested-With': 'XMLHttpRequest'
          },
        });
        
        console.log(`✅ Resposta via proxy: ${proxyResponse.status} ${proxyResponse.statusText}`);
        return proxyResponse;
      } catch (proxyError) {
        console.error('❌ Erro também no proxy:', proxyError);
        throw new Error(`Erro de conectividade: ${error.message}. Proxy também falhou: ${proxyError.message}`);
      }
    }
    
    throw error;
  }
};
