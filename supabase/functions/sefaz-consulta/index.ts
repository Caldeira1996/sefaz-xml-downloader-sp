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

    const { certificadoId, cnpjConsultado, tipoConsulta, ambiente }: ConsultaRequest = await req.json()

    console.log(`Iniciando consulta SEFAZ: ${tipoConsulta} para CNPJ ${cnpjConsultado}`)

    // Buscar certificado do usuário
    const { data: certificado, error: certError } = await supabaseClient
      .from('certificados')
      .select('*')
      .eq('id', certificadoId)
      .eq('user_id', user.id)
      .single()

    if (certError || !certificado) {
      throw new Error('Certificado não encontrado ou não autorizado')
    }

    // Criar registro da consulta
    const { data: consulta, error: consultaError } = await supabaseClient
      .from('consultas_sefaz')
      .insert({
        user_id: user.id,
        certificado_id: certificadoId,
        cnpj_consultado: cnpjConsultado,
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
        cnpjConsultado
      )
      
      if (resultado.success && resultado.data?.chavesNfe) {
        // Baixar XMLs das notas encontradas
        for (const chaveNfe of resultado.data.chavesNfe) {
          try {
            const xmlResult = await baixarXmlNfe(
              urls[ambiente].download,
              certificado,
              chaveNfe
            )
            
            if (xmlResult.success && xmlResult.xmlContent) {
              // Salvar XML no banco
              await salvarXmlNoBanco(
                supabaseClient,
                consulta.id,
                user.id,
                chaveNfe,
                xmlResult.xmlContent
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
        error: error.message
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      }
    )
  }
})

async function consultarManifestacoesPendentes(url: string, certificado: any, cnpj: string) {
  // Criar SOAP envelope para consulta de manifestações
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

    const xmlResponse = await response.text()
    console.log('Resposta SEFAZ:', xmlResponse)

    // Parse da resposta XML para extrair chaves das NFe
    const parser = new DOMParser()
    const doc = parser.parseFromString(xmlResponse, 'text/xml')
    
    // Extrair chaves das NFe da resposta (implementação simplificada)
    const chavesNfe = []
    const infNFes = doc.querySelectorAll('infNFe')
    
    for (const infNFe of infNFes) {
      const chave = infNFe.getAttribute('chNFe')
      if (chave) {
        chavesNfe.push(chave)
      }
    }

    return {
      success: true,
      data: {
        chavesNfe,
        xmlResponse
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
  const numeroNfe = doc.querySelector('nNF')?.textContent || ''
  const cnpjEmitente = doc.querySelector('emit CNPJ')?.textContent || ''
  const razaoSocialEmitente = doc.querySelector('emit xNome')?.textContent || ''
  const dataEmissao = doc.querySelector('dhEmi')?.textContent || ''
  const valorTotal = doc.querySelector('vNF')?.textContent || '0'

  await supabaseClient
    .from('xmls_nfe')
    .insert({
      consulta_id: consultaId,
      user_id: userId,
      chave_nfe: chaveNfe,
      numero_nfe: numeroNfe,
      cnpj_emitente: cnpjEmitente,
      razao_social_emitente: razaoSocialEmitente,
      data_emissao: dataEmissao ? new Date(dataEmissao).toISOString() : null,
      valor_total: parseFloat(valorTotal),
      xml_content: xmlContent,
      status_manifestacao: 'pendente'
    })
}