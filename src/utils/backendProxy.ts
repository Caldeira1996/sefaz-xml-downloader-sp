
// Configuração do backend com suporte a HTTPS
const BACKEND_IP = '56.124.22.200:3002'; // Atualizado para porta 3002

// Detectar se estamos em desenvolvimento ou produção
const isDevelopment = window.location.hostname.includes('lovableproject.com');

export const getBackendUrl = () => {
  // Sempre tentar HTTPS primeiro
  return `https://${BACKEND_IP}`;
};

export const makeBackendRequest = async (endpoint: string, options: RequestInit = {}) => {
  const baseUrl = getBackendUrl();
  const url = `${baseUrl}${endpoint}`;
  
  console.log(`🔗 Fazendo requisição para: ${url}`);
  
  const headers = {
    ...options.headers,
    'Content-Type': 'application/json',
  };

  try {
    return fetch(url, {
      ...options,
      headers,
    });
  } catch (error) {
    console.error('❌ Erro na requisição:', error);
    throw error;
  }
};
