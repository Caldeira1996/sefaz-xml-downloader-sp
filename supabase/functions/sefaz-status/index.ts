import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const SEFAZ_URLS = {
  producao: [
    'https://nfe.fazenda.sp.gov.br/ws/nfestatusservico4.asmx',
    'https://nfe.fazenda.sp.gov.br/ws/nfestatusservico2.asmx',
    'https://www.fazenda.sp.gov.br/nfe/ws/nfestatusservico4.asmx',
  ],
  homologacao: [
    'https://homologacao.nfe.fazenda.sp.gov.br/ws/nfestatusservico4.asmx',
    'https://homologacao.nfe.fazenda.sp.gov.br/ws/nfestatusservico2.asmx',
  ],
};

async function testSefazConnection(url: string): Promise<{ success: boolean; details: any }> {
  try {
    console.log(`🔍 Testando conectividade: ${url}`);

    const soapEnvelope = `<?xml version="1.0" encoding="utf-8"?>
<soap:Envelope xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" 
               xmlns:xsd="http://www.w3.org/2001/XMLSchema" 
               xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/">
  <soap:Body>
    <nfeStatusServicoNF xmlns="http://www.portalfiscal.inf.br/nfe/wsdl/NFeStatusServico4">
      <nfeDadosMsg>
        <consStatServ xmlns="http://www.portalfiscal.inf.br/nfe" versao="4.00">
          <tpAmb>2</tpAmb>
          <cUF>35</cUF>
          <xServ>STATUS</xServ>
        </consStatServ>
      </nfeDadosMsg>
    </nfeStatusServicoNF>
  </soap:Body>
</soap:Envelope>`;

    // Tenta SOAP POST
    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'text/xml; charset=utf-8',
          'SOAPAction': 'http://www.portalfiscal.inf.br/nfe/wsdl/NFeStatusServico4/nfeStatusServicoNF',
          'User-Agent': 'Mozilla/5.0 (compatible; SEFAZ-Client/1.0)',
        },
        body: soapEnvelope,
        signal: AbortSignal.timeout(15000),
      });

      const responseText = await response.text();

      console.log(`📡 Resposta SOAP (${response.status}):`, responseText.substring(0, 500));

      if (responseText.includes('retConsStatServ') || response.status === 200) {
        return { success: true, details: { method: 'SOAP', status: response.status } };
      }
    } catch (soapError) {
      console.log(`❌ Erro SOAP: ${soapError.message}`);
    }

    // Tenta GET fallback
    try {
      const response = await fetch(url, {
        method: 'GET',
        headers: { 'User-Agent': 'Mozilla/5.0 (compatible; SEFAZ-Client/1.0)' },
        signal: AbortSignal.timeout(10000),
      });

      console.log(`📡 Resposta GET (${response.status})`);

      if (response.status === 200 || response.status === 405) {
        return {
          success: true,
          details: {
            method: 'GET',
            status: response.status,
            note: response.status === 405 ? 'Endpoint ativo (Method Not Allowed esperado)' : 'Endpoint acessível',
          },
        };
      }
    } catch (getError) {
      console.log(`❌ Erro GET: ${getError.message}`);
    }

    return { success: false, details: { error: 'Nenhum método de conexão foi bem-sucedido', url } };
  } catch (error) {
    console.error(`❌ Erro geral testando ${url}:`, error);
    return { success: false, details: { error: error.message, url } };
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { ambiente = 'producao' } = await req.json();

    console.log(`🚀 Testando SEFAZ SP ambiente: ${ambiente}`);

    const urls = SEFAZ_URLS[ambiente as keyof typeof SEFAZ_URLS] || SEFAZ_URLS.producao;

    const results = [];
    let successCount = 0;

    for (const url of urls) {
      const result = await testSefazConnection(url);
      results.push({ url, ...result });
      if (result.success) successCount++;
    }

    const isConnected = successCount > 0;
    const bestResult = results.find(r => r.success) || results[0];

    console.log(`📊 Resultado: ${successCount}/${urls.length} URLs conectadas`);

    return new Response(
      JSON.stringify({
        success: isConnected,
        ambiente,
        timestamp: new Date().toISOString(),
        connectionDetails: {
          successfulConnections: successCount,
          totalTested: urls.length,
          results,
        },
        message: isConnected
          ? `SEFAZ SP ${ambiente} está acessível (${successCount}/${urls.length} URLs)`
          : `SEFAZ SP ${ambiente} não está acessível`,
        error: !isConnected ? 'Nenhuma URL respondeu adequadamente' : null,
        recommendedUrl: bestResult?.url,
        diagnostics: {
          testMethod: 'SOAP + GET fallback',
          timeout: '15s SOAP / 10s GET',
          userAgent: 'Mozilla/5.0 (compatible; SEFAZ-Client/1.0)',
        },
      }),
      { headers: { 'Content-Type': 'application/json', ...corsHeaders } },
    );
  } catch (error) {
    console.error('❌ Erro na função sefaz-status:', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message,
        timestamp: new Date().toISOString(),
        diagnostics: { functionError: true, details: 'Erro interno da função de teste' },
      }),
      { headers: { 'Content-Type': 'application/json', ...corsHeaders }, status: 500 },
    );
  }
});
