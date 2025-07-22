const BACKEND_DOMAIN = 'xmlprodownloader.com.br';

export const getBackendUrl = () => {
  return `https://${BACKEND_DOMAIN}`;
};

export const makeBackendRequest = async (endpoint: string, options: RequestInit = {}) => {
  const baseUrl = getBackendUrl();
  const url = `${baseUrl}${endpoint}`;

  console.log(`🔗 Fazendo requisição para: ${url}`);

  const headers = {
    'Content-Type': 'application/json',
    ...options.headers,
  };

  try {
    const response = await fetch(url, {
      ...options,
      headers,
      mode: 'cors',
    });

    console.log(`✅ Sucesso: ${response.status} ${response.statusText}`);
    return response; // quem chamar pode fazer response.json() se quiser
  } catch (error) {
    console.error('❌ Erro ao conectar backend:', error);
    throw error;
  }
};
