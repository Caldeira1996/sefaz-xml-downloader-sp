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
}

// Rate limiting simples (em produção, usar Redis)
const rateLimitMap = new Map<string, { count: number; resetTime: number }>();
const RATE_LIMIT = 10; // 10 requests por minuto
const RATE_WINDOW = 60000; // 1 minuto

function checkRateLimit(userId: string): boolean {
  const now = Date.now();
  const userLimit = rateLimitMap.get(userId);
  
  if (!userLimit || now > userLimit.resetTime) {
    rateLimitMap.set(userId, { count: 1, resetTime: now + RATE_WINDOW });
    return true;
  }
  
  if (userLimit.count >= RATE_LIMIT) {
    return false;
  }
  
  userLimit.count++;
  return true;
}

function sanitizeXmlContent(xmlContent: string): string {
  // Remover declaração XML externa para prevenir XXE
  return xmlContent.replace(/<!DOCTYPE[^>]*>/gi, '');
}

function validateCnpj(cnpj: string): boolean {
  const cleanCnpj = cnpj.replace(/\D/g, '');
  if (cleanCnpj.length !== 14) return false;
  if (/^(\d)\1{13}$/.test(cleanCnpj)) return false;
  
  // Validação dos dígitos verificadores
  let sum = 0;
  const weights1 = [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
  
  for (let i = 0; i < 12; i++) {
    sum += parseInt(cleanCnpj[i]) * weights1[i];
  }
  
  const remainder1 = sum % 11;
  const digit1 = remainder1 < 2 ? 0 : 11 - remainder1;
  
  if (parseInt(cleanCnpj[12]) !== digit1) return false;
  
  sum = 0;
  const weights2 = [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
  
  for (let i = 0; i < 13; i++) {
    sum += parseInt(cleanCnpj[i]) * weights2[i];
  }
  
  const remainder2 = sum % 11;
  const digit2 = remainder2 < 2 ? 0 : 11 - remainder2;
  
  return parseInt(cleanCnpj[13]) === digit2;
}

Deno.serve(async (req) => {
  // Handle CORS preflight
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

    // Verificar autenticação
    const { data: { user } } = await supabaseClient.auth.getUser()
    if (!user) {
      throw new Error('Usuário não autenticado')
    }

    // Rate limiting
    if (!checkRateLimit(user.id)) {
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Muitas tentativas. Tente novamente em alguns minutos.'
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 429,
        }
      )
    }

    const requestData: ConsultaRequest = await req.json()
    const { certificadoId, cnpjConsultado, tipoConsulta, ambiente } = requestData

    // Validações de entrada
    if (!certificadoId || !cnpjConsultado || !tipoConsulta || !ambiente) {
      throw new Error('Parâmetros obrigatórios não fornecidos')
    }

    if (!validateCnpj(cnpjConsultado)) {
      throw new Error('CNPJ inválido')
    }

    if (!['manifestacao', 'download_nfe'].includes(tipoConsulta)) {
      throw new Error('Tipo de consulta inválido')
    }

    if (!['producao', 'homologacao'].includes(ambiente)) {
      throw new Error('Ambiente inválido')
    }

    console.log(`Iniciando consulta SEFAZ: ${tipoConsulta} para CNPJ ${cnpjConsultado}`)

    // Buscar certificado do usuário
    const { data: certificado, error: certError } = await supabaseClient
      .from('certificados')
      .select('*')
      .eq('id', certificadoId)
      .eq('user_id', user.id)
      .eq('ativo', true)
      .single()

    if (certError || !certificado) {
      throw new Error('Certificado não encontrado, inativo ou não autorizado')
    }

    // Verificar se o CNPJ do certificado corresponde ao consultado
    if (certificado.cnpj !== cnpjConsultado.replace(/\D/g, '')) {
      throw new Error('CNPJ consultado não corresponde ao certificado')
    }

    // Criar registro da consulta
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

    // URLs dos webservices SEFAZ SP
    const urls = {
      producao: {
        manifestacao: 'https://nfe.fazenda.sp.gov.br/ws/nfedownload.asmx',
        download: 'https://nfe.fazenda.sp.gov.br/ws/nfedownload.asmx'
      },
      homologacao: {
        manifestacao: 'https://homologacao.nfe.fazenda.sp.gov.br/ws/nfedownload.asmx',
        download: 'https://homologacao.nfe.fazenda.sp.gov.br/ws/nfedownload.asmx'
      }
    }

    let resultado
    let xmlsBaixados = 0

    if (tipoConsulta === 'manifestacao') {
      // Consultar manifestações pendentes
      resultado = await consultarManifestacoesPendentes(
        urls[ambiente].manifestacao,
        certificado,
        cnpjConsultado.replace(/\D/g, '')
      )
      
      if (resultado.success && resultado.data?.chavesNfe) {
        // Baixar XMLs das notas encontradas (máximo 50 por vez)
        const chavesLimitadas = resultado.data.chavesNfe.slice(0, 50);
        
        for (const chaveNfe of chavesLimitadas) {
          try {
            const xmlResult = await baixarXmlNfe(
              urls[ambiente].download,
              certificado,
              chaveNfe
            )
            
            if (xmlResult.success && xmlResult.xmlContent) {
              // Sanitizar XML antes de salvar
              const sanitizedXml = sanitizeXmlContent(xmlResult.xmlContent);
              
              // Salvar XML no banco
              await salvarXmlNoBanco(
                supabaseClient,
                consulta.id,
                user.id,
                chaveNfe,
                sanitizedXml
              )
              xmlsBaixados++
            }
          } catch (error) {
            console.error(`Erro ao baixar XML ${chaveNfe}:`, error)
          }
        }
      }
    }

    // Atualizar status da consulta
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
        success: true,
        consultaId: consulta.id,
        totalXmls: resultado.data?.chavesNfe?.length || 0,
        xmlsBaixados
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    )

  } catch (error) {
    console.error('Erro na consulta SEFAZ:', error)
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

async function consultarManifestacoesPendentes(url: string, certificado: any, cnpj: string) {
  const soapEnvelope = `<?xml version="1.0" encoding="utf-8"?>
    <soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/">
      <soap:Body>
        <nfeDownloadNF xmlns="http://www.portalfiscal.inf.br/nfe/wsdl/NfeDownload">
          <nfeDadosMsg>
            <downloadNFe xmlns="http://www.portalfiscal.inf.br/nfe" versao="1.00">
              <tpAmb>2</tpAmb>
              <xServ>DOWNLOAD NFE</xServ>
              <CNPJ>${cnpj}</CNPJ>
            </downloadNFe>
          </nfeDadosMsg>
        </nfeDownloadNF>
      </soap:Body>
    </soap:Envelope>`

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'text/xml; charset=utf-8',
        'SOAPAction': 'http://www.portalfiscal.inf.br/nfe/wsdl/NfeDownload/nfeDownloadNF'
      },
      body: soapEnvelope
    })

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`)
    }

    const xmlResponse = await response.text()
    console.log('Resposta SEFAZ recebida')

    // Parse da resposta XML para extrair chaves das NFe
    const parser = new DOMParser()
    const doc = parser.parseFromString(xmlResponse, 'text/xml')
    
    const chavesNfe = []
    const infNFes = doc.querySelectorAll('infNFe')
    
    for (const infNFe of infNFes) {
      const chave = infNFe.getAttribute('chNFe')
      if (chave && /^[0-9]{44}$/.test(chave)) { // Validar formato da chave
        chavesNfe.push(chave)
      }
    }

    return {
      success: true,
      data: {
        chavesNfe,
        xmlResponse: xmlResponse.substring(0, 1000) // Limitar log
      }
    }
  } catch (error) {
    console.error('Erro na consulta SEFAZ:', error)
    return {
      success: false,
      error: error.message
    }
  }
}

async function baixarXmlNfe(url: string, certificado: any, chaveNfe: string) {
  // Validar chave NFe
  if (!/^[0-9]{44}$/.test(chaveNfe)) {
    throw new Error('Chave NFE inválida')
  }

  const soapEnvelope = `<?xml version="1.0" encoding="utf-8"?>
    <soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/">
      <soap:Body>
        <nfeDownloadNF xmlns="http://www.portalfiscal.inf.br/nfe/wsdl/NfeDownload">
          <nfeDadosMsg>
            <downloadNFe xmlns="http://www.portalfiscal.inf.br/nfe" versao="1.00">
              <tpAmb>2</tpAmb>
              <xServ>DOWNLOAD NFE</xServ>
              <chNFe>${chaveNfe}</chNFe>
            </downloadNFe>
          </nfeDadosMsg>
        </nfeDownloadNF>
      </soap:Body>
    </soap:Envelope>`

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'text/xml; charset=utf-8',
        'SOAPAction': 'http://www.portalfiscal.inf.br/nfe/wsdl/NfeDownload/nfeDownloadNF'
      },
      body: soapEnvelope
    })

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`)
    }

    const xmlContent = await response.text()
    
    return {
      success: true,
      xmlContent
    }
  } catch (error) {
    return {
      success: false,
      error: error.message
    }
  }
}

async function salvarXmlNoBanco(supabaseClient: any, consultaId: string, userId: string, chaveNfe: string, xmlContent: string) {
  // Parse do XML para extrair informações
  const parser = new DOMParser()
  const doc = parser.parseFromString(xmlContent, 'text/xml')
  
  // Extrair dados básicos da NFe (implementação simplificada)
  const numeroNfe = doc.querySelector('nNF')?.textContent?.trim() || ''
  const cnpjEmitente = doc.querySelector('emit CNPJ')?.textContent?.trim() || ''
  const razaoSocialEmitente = doc.querySelector('emit xNome')?.textContent?.trim() || ''
  const dataEmissao = doc.querySelector('dhEmi')?.textContent?.trim() || ''
  const valorTotal = doc.querySelector('vNF')?.textContent?.trim() || '0'

  // Sanitizar dados extraídos
  const sanitizedNumeroNfe = numeroNfe.replace(/[^\d]/g, '').substring(0, 20)
  const sanitizedCnpjEmitente = cnpjEmitente.replace(/[^\d]/g, '').substring(0, 14)
  const sanitizedRazaoSocial = razaoSocialEmitente.substring(0, 255)

  await supabaseClient
    .from('xmls_nfe')
    .insert({
      consulta_id: consultaId,
      user_id: userId,
      chave_nfe: chaveNfe,
      numero_nfe: sanitizedNumeroNfe || null,
      cnpj_emitente: sanitizedCnpjEmitente || null,
      razao_social_emitente: sanitizedRazaoSocial || null,
      data_emissao: dataEmissao ? new Date(dataEmissao).toISOString() : null,
      valor_total: parseFloat(valorTotal) || 0,
      xml_content: xmlContent,
      status_manifestacao: 'pendente'
    })
}
