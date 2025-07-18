
// Configuração do backend com suporte a HTTP/HTTPS
const BACKEND_IP = '56.124.22.200';

// Detectar se estamos em desenvolvimento ou produção
const isDevelopment = window.location.hostname.includes('lovableproject.com');

export const getBackendUrl = () => {
  if (isDevelopment) {
    // Em desenvolvimento, usar HTTP na porta 3001
    return `http://${BACKEND_IP}:3001`;
  } else {
    // Em produção, usar HTTPS na porta 3002
    return `https://${BACKEND_IP}:3002`;
  }
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
