
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.52.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface StatusRequest {
  ambiente: 'producao' | 'homologacao'
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        global: {
          headers: { Authorization: req.headers.get('Authorization')! },
        },
      }
    )

    const { data: { user } } = await supabaseClient.auth.getUser()
    if (!user) {
      throw new Error('Usuário não autenticado')
    }

    const requestData: StatusRequest = await req.json()
    const { ambiente } = requestData

    console.log(`🔍 Verificando status do SEFAZ - Ambiente: ${ambiente}`)

    // URLs atualizadas e múltiplas opções para teste
    const urlsStatus = {
      producao: [
        'https://nfe.fazenda.sp.gov.br/ws/nfestatusservico4.asmx',
        'https://nfe.fazenda.gov.br/ws/NfeStatusServico/NfeStatusServico4.asmx',
        'https://www.nfe.fazenda.gov.br/NFeStatusServico4/NFeStatusServico4.asmx'
      ],
      homologacao: [
        'https://homologacao.nfe.fazenda.sp.gov.br/ws/nfestatusservico4.asmx',
        'https://hom.nfe.fazenda.gov.br/ws/NfeStatusServico/NfeStatusServico4.asmx',
        'https://hom.nfe.fazenda.gov.br/NFeStatusServico4/NFeStatusServico4.asmx'
      ]
    }

    const urls = urlsStatus[ambiente]
    let conectivitySuccess = false
    let lastError = ''

    for (const url of urls) {
      console.log(`🌐 Testando conectividade: ${url}`)

      try {
        const controller = new AbortController()
        const timeoutId = setTimeout(() => controller.abort(), 15000) // 15 segundos

        const response = await fetch(url, {
          method: 'POST',
          headers: {
            'Content-Type': 'text/xml; charset=utf-8',
            'SOAPAction': 'http://www.portalfiscal.inf.br/nfe/wsdl/NFeStatusServico4/nfeStatusServicoNF',
            'User-Agent': 'XML-PRO/1.0'
          },
          body: `<?xml version="1.0" encoding="utf-8"?>
<soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/" xmlns:nfe="http://www.portalfiscal.inf.br/nfe/wsdl/NFeStatusServico4">
  <soap:Header />
  <soap:Body>
    <nfe:nfeStatusServicoNF>
      <nfe:nfeDadosMsg>
        <consStatServ xmlns="http://www.portalfiscal.inf.br/nfe" versao="4.00">
          <tpAmb>${ambiente === 'producao' ? '1' : '2'}</tpAmb>
          <cUF>35</cUF>
          <xServ>STATUS</xServ>
        </consStatServ>
      </nfe:nfeDadosMsg>
    </nfe:nfeStatusServicoNF>
  </soap:Body>
</soap:Envelope>`,
          signal: controller.signal
        })

        clearTimeout(timeoutId)

        console.log(`📡 Status da resposta: ${response.status} ${response.statusText}`)

        if (response.ok) {
          const content = await response.text()
          console.log(`📄 Resposta recebida: ${content.substring(0, 500)}...`)
          
          // Verificar se há resposta válida do SEFAZ
          if (content.includes('cStat') || content.includes('STATUS') || content.includes('nfeStatusServicoNFResult')) {
            console.log('✅ Conectividade OK - Serviço SEFAZ respondeu')
            conectivitySuccess = true
            break
          }
        }

      } catch (error) {
        console.error(`❌ Erro na URL ${url}: ${error.message}`)
        lastError = error.message
      }
    }

    if (conectivitySuccess) {
      return new Response(
        JSON.stringify({
          success: true,
          status: 'conectado',
          ambiente,
          timestamp: new Date().toISOString(),
          detalhes: 'Serviço SEFAZ acessível e operacional'
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200,
        }
      )
    } else {
      return new Response(
        JSON.stringify({
          success: false,
          status: 'desconectado',
          ambiente,
          timestamp: new Date().toISOString(),
          error: 'Não foi possível conectar ao SEFAZ',
          detalhes: `Todas as URLs falharam. Último erro: ${lastError}`,
          diagnostico: {
            urlsTentadas: urls.length,
            ultimoErro: lastError
          }
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200,
        }
      )
    }

  } catch (error) {
    console.error('❌ Erro interno:', error)
    
    return new Response(
      JSON.stringify({
        success: false,
        status: 'erro',
        error: error.message || 'Erro interno do servidor',
        timestamp: new Date().toISOString()
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      }
    )
  }
})
