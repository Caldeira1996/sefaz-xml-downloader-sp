
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

    // URLs simplificadas para teste de conectividade
    const urlsStatus = {
      producao: 'https://www1.nfe.fazenda.gov.br/NFeConsultaDest/NFeConsultaDest.asmx?wsdl',
      homologacao: 'https://hom1.nfe.fazenda.gov.br/NFeConsultaDest/NFeConsultaDest.asmx?wsdl'
    }

    const url = urlsStatus[ambiente]
    
    console.log(`🌐 Testando conectividade: ${url}`)

    try {
      // Teste de conectividade simples - verificar se conseguimos acessar o WSDL
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), 10000) // 10 segundos

      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; SEFAZ-Client/1.0)'
        },
        signal: controller.signal
      })

      clearTimeout(timeoutId)

      console.log(`📡 Status da resposta: ${response.status} ${response.statusText}`)

      if (response.ok) {
        const content = await response.text()
        
        // Verificar se é um WSDL válido
        if (content.includes('wsdl:definitions') || content.includes('soap') || content.includes('NFeConsultaDest')) {
          console.log('✅ Conectividade OK - Serviço SEFAZ acessível')
          
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
          throw new Error('Resposta inválida do serviço SEFAZ')
        }
      } else {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`)
      }

    } catch (error) {
      console.error(`❌ Erro de conectividade: ${error.message}`)
      
      let errorMessage = 'Falha na conectividade com SEFAZ'
      
      if (error.name === 'AbortError') {
        errorMessage = 'Timeout na conexão com SEFAZ (>10s)'
      } else if (error.message.includes('network')) {
        errorMessage = 'Erro de rede - verifique sua conexão'
      } else if (error.message.includes('DNS')) {
        errorMessage = 'Erro de DNS - serviço indisponível'
      } else if (error.message.includes('fetch')) {
        errorMessage = 'Não foi possível conectar ao SEFAZ'
      }

      return new Response(
        JSON.stringify({
          success: false,
          status: 'desconectado',
          ambiente,
          timestamp: new Date().toISOString(),
          error: errorMessage,
          detalhes: error.message,
          diagnostico: {
            url,
            errorType: error.name,
            errorMessage: error.message
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
