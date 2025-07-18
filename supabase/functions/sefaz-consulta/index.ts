
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.52.0'
import { DOMParser } from 'https://deno.land/x/deno_dom/deno-dom-wasm.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface ConsultaRequest {
  certificadoId: string
  cnpjConsultado: string
  tipoConsulta: 'manifestacao' | 'download_nfe'
  ambiente: 'producao' | 'homologacao'
  dataInicio?: string
  dataFim?: string
}

const rateLimitMap = new Map<string, { count: number; resetTime: number }>()
const RATE_LIMIT = 5
const RATE_WINDOW = 60000

function checkRateLimit(userId: string): boolean {
  const now = Date.now()
  const userLimit = rateLimitMap.get(userId)
  
  if (!userLimit || now > userLimit.resetTime) {
    rateLimitMap.set(userId, { count: 1, resetTime: now + RATE_WINDOW })
    return true
  }
  
  if (userLimit.count >= RATE_LIMIT) {
    return false
  }
  
  userLimit.count++
  return true
}

function validateCnpj(cnpj: string): boolean {
  const cleanCnpj = cnpj.replace(/\D/g, '')
  return cleanCnpj.length === 14 && !/^(\d)\1{13}$/.test(cleanCnpj)
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

    if (!checkRateLimit(user.id)) {
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Muitas tentativas. Aguarde 1 minuto.'
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 429,
        }
      )
    }

    const requestData: ConsultaRequest = await req.json()
    const { certificadoId, cnpjConsultado, tipoConsulta, ambiente } = requestData

    if (!certificadoId || !cnpjConsultado || !tipoConsulta || !ambiente) {
      throw new Error('Parâmetros obrigatórios não fornecidos')
    }

    if (!validateCnpj(cnpjConsultado)) {
      throw new Error('CNPJ inválido')
    }

    console.log(`🚀 Iniciando consulta SEFAZ: ${tipoConsulta} para CNPJ ${cnpjConsultado}`)

    const { data: certificado, error: certError } = await supabaseClient
      .from('certificados')
      .select('*')
      .eq('id', certificadoId)
      .eq('user_id', user.id)
      .eq('ativo', true)
      .single()

    if (certError || !certificado) {
      throw new Error('Certificado não encontrado ou inativo')
    }

    // URLs atualizadas para consulta
    const urlsConsulta = {
      producao: [
        'https://nfe.fazenda.sp.gov.br/ws/nfeconsultadest.asmx',
        'https://www.nfe.fazenda.gov.br/NFeConsultaDest/NFeConsultaDest.asmx'
      ],
      homologacao: [
        'https://homologacao.nfe.fazenda.sp.gov.br/ws/nfeconsultadest.asmx',
        'https://hom.nfe.fazenda.gov.br/NFeConsultaDest/NFeConsultaDest.asmx'
      ]
    }

    const { data: consulta, error: consultaError } = await supabaseClient
      .from('consultas_sefaz')
      .insert({
        user_id: user.id,
        certificado_id: certificadoId,
        cnpj_consultado: cnpjConsultado.replace(/\D/g, ''),
        tipo_consulta: tipoConsulta,
        status: 'processando'
      })
      .select()
      .single()

    if (consultaError) {
      throw new Error(`Erro ao criar consulta: ${consultaError.message}`)
    }

    let resultado
    let xmlsBaixados = 0

    if (tipoConsulta === 'manifestacao') {
      const urls = urlsConsulta[ambiente]
      let consultaSuccess = false

      for (const url of urls) {
        try {
          console.log(`🌐 Tentando consulta em: ${url}`)
          
          resultado = await consultarManifestacoesPendentes(
            url,
            certificado,
            cnpjConsultado.replace(/\D/g, ''),
            ambiente
          )
          
          if (resultado.success) {
            consultaSuccess = true
            break
          }
          
        } catch (error) {
          console.error(`❌ Falha na URL ${url}:`, error.message)
        }
      }

      if (!consultaSuccess) {
        resultado = {
          success: false,
          error: 'Não foi possível conectar ao SEFAZ após tentar todas as URLs',
          details: 'Verifique sua conexão e tente novamente em alguns minutos'
        }
      } else if (resultado.success && resultado.data?.chavesNfe?.length > 0) {
        xmlsBaixados = resultado.data.chavesNfe.length
        console.log(`✅ Encontradas ${xmlsBaixados} NFe(s)`)
      }
    }

    await supabaseClient
      .from('consultas_sefaz')
      .update({
        status: 'concluido',
        resultado: resultado,
        total_xmls: resultado.data?.chavesNfe?.length || 0,
        xmls_baixados: xmlsBaixados
      })
      .eq('id', consulta.id)

    return new Response(
      JSON.stringify({
        success: resultado.success,
        consultaId: consulta.id,
        totalXmls: resultado.data?.chavesNfe?.length || 0,
        xmlsBaixados,
        detalhes: resultado.success ? 'Consulta realizada com sucesso' : resultado.error,
        diagnostico: resultado.diagnostico
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    )

  } catch (error) {
    console.error('❌ Erro na consulta:', error)
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message || 'Erro interno do servidor'
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      }
    )
  }
})

async function consultarManifestacoesPendentes(
  url: string, 
  certificado: any, 
  cnpj: string, 
  ambiente: string
) {
  const tpAmb = ambiente === 'producao' ? '1' : '2'
  
  const soapEnvelope = `<?xml version="1.0" encoding="utf-8"?>
<soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/" xmlns:nfe="http://www.portalfiscal.inf.br/nfe/wsdl/NFeConsultaDest">
  <soap:Header />
  <soap:Body>
    <nfe:nfeConsultaNFDest>
      <nfe:nfeDadosMsg>
        <consNFeDest xmlns="http://www.portalfiscal.inf.br/nfe" versao="1.01">
          <tpAmb>${tpAmb}</tpAmb>
          <xServ>CONSULTAR NFE DEST</xServ>
          <CNPJ>${cnpj}</CNPJ>
          <indNFe>0</indNFe>
          <indEmi>1</indEmi>
          <cUF>35</cUF>
        </consNFeDest>
      </nfe:nfeDadosMsg>
    </nfe:nfeConsultaNFDest>
  </soap:Body>
</soap:Envelope>`

  const diagnostico = {
    url,
    cnpj,
    ambiente,
    timestamp: new Date().toISOString()
  }

  try {
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 30000) // 30 segundos

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'text/xml; charset=utf-8',
        'SOAPAction': 'http://www.portalfiscal.inf.br/nfe/wsdl/NFeConsultaDest/nfeConsultaNFDest',
        'User-Agent': 'XML-PRO/1.0'
      },
      body: soapEnvelope,
      signal: controller.signal
    })
    
    clearTimeout(timeoutId)
    console.log(`📡 Resposta: ${response.status}`)

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`)
    }

    const xmlResponse = await response.text()
    return parseResponse(xmlResponse, diagnostico)

  } catch (error) {
    console.error('❌ Erro na consulta:', error.message)
    diagnostico.error = error.message
    
    throw new Error(`Falha na comunicação: ${error.message}`)
  }
}

function parseResponse(xmlResponse: string, diagnostico: any) {
  console.log(`🔍 Analisando resposta XML`)

  const parser = new DOMParser()
  const doc = parser.parseFromString(xmlResponse, 'text/xml')
  
  const faultString = doc.querySelector('faultstring')?.textContent
  if (faultString) {
    console.error(`❌ Erro SOAP: ${faultString}`)
    throw new Error(`Erro SOAP: ${faultString}`)
  }

  const chavesNfe = []
  
  // Buscar chaves NFe no XML
  const chaveElements = doc.querySelectorAll('chNFe, resNFe chNFe')
  for (const element of chaveElements) {
    const chave = element.textContent?.trim()
    if (chave && /^[0-9]{44}$/.test(chave)) {
      chavesNfe.push(chave)
    }
  }

  // Regex para encontrar chaves no texto
  if (chavesNfe.length === 0) {
    const chaveRegex = /\b(\d{44})\b/g
    let match
    while ((match = chaveRegex.exec(xmlResponse)) !== null) {
      const chave = match[1]
      const uf = chave.substring(0, 2)
      if (['35', '11', '12', '13', '14', '15', '16', '17'].includes(uf)) {
        chavesNfe.push(chave)
      }
    }
  }

  const cStat = doc.querySelector('cStat')?.textContent
  const xMotivo = doc.querySelector('xMotivo')?.textContent
  
  console.log(`📊 Status: ${cStat}, Chaves: ${chavesNfe.length}`)

  return {
    success: true,
    data: {
      chavesNfe: [...new Set(chavesNfe)],
      codigoStatus: cStat,
      motivo: xMotivo
    },
    diagnostico
  }
}
