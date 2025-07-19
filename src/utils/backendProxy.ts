const BACKEND_DOMAIN = 'xmlprodownloader.com.br';

export const getBackendUrl = () => {
  // Usar sempre HTTPS e domínio configurado no proxy reverso
  return `https://${BACKEND_DOMAIN}`;
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
    const response = await fetch(url, {
      ...options,
      headers,
      mode: 'cors',
    });

    console.log(`✅ Sucesso: ${response.status} ${response.statusText}`);
    return response;
  } catch (error) {
    console.error('❌ Erro ao conectar backend:', error);
    throw error;
  }
};
