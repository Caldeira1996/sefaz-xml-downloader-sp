
// Proxy para contornar Mixed Content em desenvolvimento
const BACKEND_IP = '56.124.22.200:3001';

// Para desenvolvimento, usamos um proxy CORS público
// Em produção, configure HTTPS no servidor
const isDevelopment = window.location.hostname.includes('lovableproject.com');

export const getBackendUrl = () => {
  if (isDevelopment) {
    // Usar proxy CORS para desenvolvimento
    return `https://cors-anywhere.herokuapp.com/http://${BACKEND_IP}`;
  }
  return `http://${BACKEND_IP}`;
};

export const makeBackendRequest = async (endpoint: string, options: RequestInit = {}) => {
  const baseUrl = getBackendUrl();
  const url = `${baseUrl}${endpoint}`;
  
  // Adicionar headers necessários para o proxy CORS
  const headers = {
    ...options.headers,
    'X-Requested-With': 'XMLHttpRequest',
  };

  if (isDevelopment) {
    headers['X-CORS-Anywhere-Host'] = BACKEND_IP.split(':')[0];
  }

  return fetch(url, {
    ...options,
    headers,
  });
};
