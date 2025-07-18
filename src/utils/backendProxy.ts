
// Configuração do backend com suporte a HTTP/HTTPS
const BACKEND_IP = '56.124.22.200';

// Detectar ambiente baseado no hostname específico do Lovable
const isLovableEnvironment = window.location.hostname.endsWith('.lovableproject.com') || window.location.hostname.endsWith('.lovable.app');

export const getBackendUrl = () => {
  if (isLovableEnvironment) {
    // Em ambiente Lovable, tentar primeiro HTTPS na porta padrão (443)
    // Se não funcionar, tentar porta 3002 direta
    return `https://${BACKEND_IP}`;
  } else {
    // Em outros ambientes, usar HTTP na porta 3001
    return `http://${BACKEND_IP}:3001`;
  }
};

export const makeBackendRequest = async (endpoint: string, options: RequestInit = {}) => {
  const baseUrl = getBackendUrl();
  let url = `${baseUrl}${endpoint}`;
  
  console.log(`🔗 Fazendo requisição para: ${url}`);
  console.log(`🌐 Ambiente detectado: ${isLovableEnvironment ? 'Lovable (HTTPS:443)' : 'Local/Produção (HTTP:3001)'}`);
  console.log(`📍 Hostname atual: ${window.location.hostname}`);
  
  const headers = {
    ...options.headers,
    'Content-Type': 'application/json',
  };

  // Função para tentar uma URL específica
  const tryRequest = async (requestUrl: string, description: string) => {
    console.log(`🔄 Tentando ${description}: ${requestUrl}`);
    
    try {
      const response = await fetch(requestUrl, {
        ...options,
        headers,
        mode: 'cors',
      });
      
      console.log(`✅ Sucesso ${description}: ${response.status} ${response.statusText}`);
      return response;
    } catch (error) {
      console.log(`❌ Falhou ${description}:`, error.message);
      throw error;
    }
  };

  try {
    // Tentativa 1: HTTPS porta padrão (443) - para proxy reverso
    return await tryRequest(url, 'HTTPS porta 443');
  } catch (error) {
    if (isLovableEnvironment) {
      try {
        // Tentativa 2: HTTPS porta 3002 direta
        const directUrl = `https://${BACKEND_IP}:3002${endpoint}`;
        console.log(`🔄 Fallback para porta direta 3002...`);
        return await tryRequest(directUrl, 'HTTPS porta 3002');
      } catch (directError) {
        try {
          // Tentativa 3: HTTP porta 3001 como último recurso
          const httpUrl = `http://${BACKEND_IP}:3001${endpoint}`;
          console.log(`🔄 Último recurso: HTTP porta 3001...`);
          return await tryRequest(httpUrl, 'HTTP porta 3001');
        } catch (httpError) {
          console.error('❌ Todas as tentativas falharam');
          console.error('📋 Resumo dos erros:', {
            https443: error.message,
            https3002: directError.message,
            http3001: httpError.message
          });
          
          throw new Error(`Não foi possível conectar ao servidor. Tentamos HTTPS:443, HTTPS:3002 e HTTP:3001. Último erro: ${httpError.message}`);
        }
      }
    }
    
    // Se não é ambiente Lovable, apenas retorna o erro original
    throw error;
  }
};
