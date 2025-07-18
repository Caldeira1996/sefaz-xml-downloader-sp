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

// Rate limiting mais relaxado para testes
const rateLimitMap = new Map<string, { count: number; resetTime: number }>();
const RATE_LIMIT = 50; // Aumentar limite para testes
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
  return xmlContent.replace(/<!DOCTYPE[^>]*>/gi, '');
}

function validateCnpj(cnpj: string): boolean {
  const cleanCnpj = cnpj.replace(/\D/g, '');
  if (cleanCnpj.length !== 14) return false;
  if (/^(\d)\1{13}$/.test(cleanCnpj)) return false;
  
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

function formatDateForSefaz(dateString: string): string {
  const date = new Date(dateString);
  return date.toISOString().split('T')[0];
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
          error: 'Muitas tentativas. Tente novamente em alguns minutos.'
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 429,
        }
      )
    }

    const requestData: ConsultaRequest = await req.json()
    const { certificadoId, cnpjConsultado, tipoConsulta, ambiente, dataInicio, dataFim } = requestData

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

    console.log(`Iniciando consulta SEFAZ: ${tipoConsulta} para CNPJ ${cnpjConsultado} no ambiente ${ambiente}`)
    if (dataInicio) console.log(`Período: ${dataInicio} até ${dataFim || dataInicio}`)

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

    console.log(`Certificado encontrado: ${certificado.nome} para CNPJ ${certificado.cnpj}`)

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

    // URLs corrigidas para consulta de NFe destinadas - usando serviços alternativos
    const urlsConsultaDest = {
      producao: [
        // Tentar primeiro o webservice do AN (Ambiente Nacional)
        'https://www.nfe.fazenda.gov.br/NFeConsultaDest/NFeConsultaDest.asmx',
        // Backup: webservice estadual do RS (mais estável)
        'https://nfe.sefaz.rs.gov.br/ws/NfeConsulta/NfeConsulta4.asmx',
        // Backup: webservice do PR
        'https://nfe.sfa.pr.gov.br/ws/NFeConsultaDest/NFeConsultaDest.asmx',
        // Última tentativa: SP (mesmo sabendo que pode não ter o serviço)
        'https://nfe.fazenda.sp.gov.br/ws/nfestatusservico4.asmx'
      ],
      homologacao: [
        'https://hom.nfe.fazenda.gov.br/NFeConsultaDest/NFeConsultaDest.asmx',
        'https://nfe-homologacao.sefaz.rs.gov.br/ws/NfeConsulta/NfeConsulta4.asmx',
        'https://homologacao.nfe.sfa.pr.gov.br/ws/NFeConsultaDest/NFeConsultaDest.asmx',
        'https://homologacao.nfe.fazenda.sp.gov.br/ws/nfestatusservico4.asmx'
      ]
    }

    let resultado
    let xmlsBaixados = 0

    if (tipoConsulta === 'manifestacao') {
      const urls = urlsConsultaDest[ambiente];
      let ultimoErro = null;
      
      console.log(`Testando ${urls.length} URLs diferentes para consulta de NFe...`)
      
      for (const [index, url] of urls.entries()) {
        console.log(`Tentativa ${index + 1}/${urls.length}: ${url}`)
        
        try {
          resultado = await consultarManifestacoesPendentes(
            url,
            certificado,
            cnpjConsultado.replace(/\D/g, ''),
            ambiente,
            dataInicio,
            dataFim
          )
          
          if (resultado.success) {
            console.log(`✅ Sucesso com URL ${index + 1}: ${url}`)
            break;
          } else {
            console.log(`❌ Falha com URL ${index + 1}:`, resultado.error)
            ultimoErro = resultado;
          }
        } catch (error) {
          console.error(`❌ Erro com URL ${index + 1}:`, error.message)
          ultimoErro = { success: false, error: error.message };
        }
      }
      
      // Se todas as URLs falharam, usar o último erro
      if (!resultado || !resultado.success) {
        console.log('❌ Todas as URLs falharam. Retornando último erro.')
        resultado = ultimoErro || { success: false, error: 'Todas as URLs de conexão falharam. Verifique se o webservice da SEFAZ está operacional.' };
      }
      
      console.log('📊 Resultado final da consulta:', JSON.stringify(resultado, null, 2))
      
      if (resultado.success && resultado.data?.chavesNfe && resultado.data.chavesNfe.length > 0) {
        console.log(`🎯 Encontradas ${resultado.data.chavesNfe.length} NFe(s)`)
        
        // Baixar XMLs das notas encontradas
        const chavesLimitadas = resultado.data.chavesNfe.slice(0, 100);
        
        for (const chaveNfe of chavesLimitadas) {
          try {
            console.log(`📥 Baixando XML para chave: ${chaveNfe}`)
            const xmlResult = await baixarXmlNfe(
              urls[0].replace(/NFeConsultaDest|nfestatusservico/, 'nfedownload'),
              certificado,
              chaveNfe,
              ambiente
            )
            
            if (xmlResult.success && xmlResult.xmlContent) {
              const sanitizedXml = sanitizeXmlContent(xmlResult.xmlContent);
              
              await salvarXmlNoBanco(
                supabaseClient,
                consulta.id,
                user.id,
                chaveNfe,
                sanitizedXml
              )
              xmlsBaixados++
              console.log(`✅ XML salvo com sucesso para chave: ${chaveNfe}`)
            } else {
              console.log(`❌ Erro ao baixar XML ${chaveNfe}:`, xmlResult.error)
            }
          } catch (error) {
            console.error(`❌ Erro ao processar XML ${chaveNfe}:`, error)
          }
        }
      } else {
        console.log('ℹ️ Nenhuma NFe encontrada ou erro na consulta')
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

    console.log(`✅ Consulta finalizada: ${xmlsBaixados} XMLs baixados de ${resultado.data?.chavesNfe?.length || 0} encontrados`)

    return new Response(
      JSON.stringify({
        success: true,
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
    console.error('❌ Erro na consulta SEFAZ:', error)
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message || 'Erro interno do servidor',
        diagnostico: {
          timestamp: new Date().toISOString(),
          errorType: error.constructor.name,
          stack: error.stack
        }
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
  ambiente: string,
  dataInicio?: string,
  dataFim?: string
) {
  const tpAmb = ambiente === 'producao' ? '1' : '2';
  
  let filtroData = '';
  if (dataInicio) {
    const dataInicioFormatada = formatDateForSefaz(dataInicio);
    const dataFimFormatada = dataFim ? formatDateForSefaz(dataFim) : dataInicioFormatada;
    
    filtroData = `
      <dhInicio>${dataInicioFormatada}T00:00:00-03:00</dhInicio>
      <dhFim>${dataFimFormatada}T23:59:59-03:00</dhFim>`;
  }
  
  // SOAP envelope para consulta de NFe destinadas
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
          <cUF>35</cUF>${filtroData}
        </consNFeDest>
      </nfe:nfeDadosMsg>
    </nfe:nfeConsultaNFDest>
  </soap:Body>
</soap:Envelope>`

  const diagnostico = {
    url,
    cnpj,
    ambiente,
    tpAmb,
    dataInicio: dataInicio || 'sem filtro',
    dataFim: dataFim || 'sem filtro',
    timestamp: new Date().toISOString()
  };

  try {
    console.log(`🌐 Enviando requisição SOAP para: ${url}`)
    console.log(`📋 CNPJ consultado: ${cnpj}, Ambiente: ${ambiente} (${tpAmb})`)
    
    // Configuração otimizada para SEFAZ com timeout maior
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 120000); // 2 minutos
    
    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'text/xml; charset=utf-8',
          'SOAPAction': 'http://www.portalfiscal.inf.br/nfe/wsdl/NFeConsultaDest/nfeConsultaNFDest',
          'User-Agent': 'Mozilla/5.0 (compatible; NFe-Client/1.0)',
          'Accept': 'text/xml, application/soap+xml, application/xml',
          'Accept-Encoding': 'gzip, deflate',
          'Connection': 'keep-alive',
          'Cache-Control': 'no-cache',
          'Content-Length': soapEnvelope.length.toString()
        },
        body: soapEnvelope,
        signal: controller.signal
      });
      
      clearTimeout(timeoutId);
      
      console.log(`📡 Status da resposta: ${response.status} ${response.statusText}`)

      if (!response.ok) {
        const errorText = await response.text()
        console.error(`❌ Erro HTTP ${response.status}: ${errorText.substring(0, 1000)}`)
        throw new Error(`HTTP ${response.status}: ${response.statusText}`)
      }

      const xmlResponse = await response.text()
      console.log(`📄 Resposta recebida (${xmlResponse.length} caracteres)`)
      
      return parseResponse(xmlResponse, diagnostico)

    } catch (error) {
      clearTimeout(timeoutId);
      throw error;
    }

  } catch (error) {
    console.error('❌ Erro na consulta SEFAZ:', error)
    diagnostico.error = error.message;
    
    const errorDetails = {
      errorName: error.name,
      errorMessage: error.message,
      possibleCause: 
        error.message.includes('AbortError') || error.message.includes('timeout') ? 'Timeout de conexão - servidor SEFAZ não respondeu' :
        error.message.includes('DNS') || error.message.includes('getaddrinfo') ? 'Erro de resolução DNS - verifique conectividade' :
        error.message.includes('refused') || error.message.includes('ECONNREFUSED') ? 'Conexão recusada - servidor pode estar indisponível' :
        error.message.includes('certificate') || error.message.includes('SSL') ? 'Erro de certificado SSL/TLS' :
        error.message.includes('network') || error.message.includes('fetch') ? 'Erro de conectividade de rede' :
        error.message.includes('404') ? 'Endpoint não encontrado - URL pode estar desatualizada' :
        'Erro desconhecido de conectividade',
      suggestions: [
        'Verificar se a SEFAZ está operacional',
        'Tentar novamente em alguns minutos',
        'Verificar conectividade de rede',
        'Contatar suporte técnico se o problema persistir'
      ]
    };
    
    return {
      success: false,
      error: error.message,
      details: `Falha na comunicação com ${url}`,
      diagnostico: { ...diagnostico, errorDetails }
    }
  }
}

function parseResponse(xmlResponse: string, diagnostico: any) {
  console.log(`🔍 Analisando resposta XML (${xmlResponse.length} caracteres)`)
  console.log(`📝 Primeiros 2000 chars: ${xmlResponse.substring(0, 2000)}`)

  const parser = new DOMParser()
  const doc = parser.parseFromString(xmlResponse, 'text/xml')
  
  const faultString = doc.querySelector('faultstring')?.textContent
  if (faultString) {
    console.error(`❌ Erro SOAP: ${faultString}`)
    diagnostico.soapError = faultString;
    throw new Error(`Erro SOAP: ${faultString}`)
  }

  const chavesNfe = []
  
  // Seletores mais abrangentes para encontrar chaves de NFe
  const possibleSelectors = [
    'chNFe',
    'infNFe',
    'nfe chNFe',
    'retConsNFeDest chNFe',
    'resNFe chNFe',
    'resNFe[chNFe]',
    'ret chNFe',
    'NFe chNFe',
    'resNFe > chNFe',
    'consNFeDest chNFe'
  ]
  
  for (const selector of possibleSelectors) {
    const elements = doc.querySelectorAll(selector)
    console.log(`🔍 Seletor '${selector}' encontrou ${elements.length} elementos`)
    
    for (const element of elements) {
      let chave = element.textContent?.trim()
      if (!chave && element.hasAttribute('chNFe')) {
        chave = element.getAttribute('chNFe')
      }
      
      if (chave && /^[0-9]{44}$/.test(chave)) {
        chavesNfe.push(chave)
        console.log(`🔑 Chave NFe encontrada: ${chave}`)
      }
    }
  }

  // Busca por regex mais agressiva no XML
  if (chavesNfe.length === 0) {
    console.log('🔍 Procurando chaves no XML bruto com regex...')
    const chaveRegex = /\b(\d{44})\b/g;
    let match;
    while ((match = chaveRegex.exec(xmlResponse)) !== null) {
      const chave = match[1];
      if (chave && !chavesNfe.includes(chave)) {
        // Validar se é uma chave NFe válida (verificar UF)
        const uf = chave.substring(0, 2);
        if (['11', '12', '13', '14', '15', '16', '17', '21', '22', '23', '24', '25', '26', '27', '28', '29', '31', '32', '33', '35', '41', '42', '43', '50', '51', '52', '53'].includes(uf)) {
          chavesNfe.push(chave);
          console.log(`🔑 Chave NFe encontrada via regex: ${chave}`);
        }
      }
    }
  }

  const cStat = doc.querySelector('cStat')?.textContent
  const xMotivo = doc.querySelector('xMotivo')?.textContent
  
  console.log(`📊 Código de status: ${cStat}, Motivo: ${xMotivo}`)
  console.log(`📈 Total de chaves encontradas: ${chavesNfe.length}`)
  
  diagnostico.cStat = cStat;
  diagnostico.xMotivo = xMotivo;
  diagnostico.chavesEncontradas = chavesNfe.length;

  // Códigos de sucesso da SEFAZ: 138 = consulta realizada com sucesso
  if (cStat && ['138', '137'].includes(cStat)) {
    console.log(`✅ Consulta bem-sucedida: ${cStat} - ${xMotivo}`)
  } else if (cStat) {
    console.log(`ℹ️ Status SEFAZ: ${cStat} - ${xMotivo}`)
  }

  return {
    success: true,
    data: {
      chavesNfe: [...new Set(chavesNfe)],
      codigoStatus: cStat,
      motivo: xMotivo,
      xmlResponse: xmlResponse.substring(0, 3000)
    },
    diagnostico
  }
}

async function baixarXmlNfe(url: string, certificado: any, chaveNfe: string, ambiente: string) {
  if (!/^[0-9]{44}$/.test(chaveNfe)) {
    throw new Error('Chave NFE inválida')
  }

  const tpAmb = ambiente === 'producao' ? '1' : '2';

  const soapEnvelope = `<?xml version="1.0" encoding="utf-8"?>
<soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/" xmlns:nfe="http://www.portalfiscal.inf.br/nfe/wsdl/NfeDownload">
  <soap:Header />
  <soap:Body>
    <nfe:nfeDownloadNF>
      <nfe:nfeDadosMsg>
        <downloadNFe xmlns="http://www.portalfiscal.inf.br/nfe" versao="1.00">
          <tpAmb>${tpAmb}</tpAmb>
          <xServ>DOWNLOAD NFE</xServ>
          <chNFe>${chaveNfe}</chNFe>
        </downloadNFe>
      </nfe:nfeDadosMsg>
    </nfe:nfeDownloadNF>
  </soap:Body>
</soap:Envelope>`

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 90000);
    
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'text/xml; charset=utf-8',
        'SOAPAction': 'http://www.portalfiscal.inf.br/nfe/wsdl/NfeDownload/nfeDownloadNF',
        'User-Agent': 'PostmanRuntime/7.29.2',
        'Accept': '*/*',
        'Accept-Encoding': 'identity',
        'Connection': 'keep-alive'
      },
      body: soapEnvelope,
      signal: controller.signal
    })

    clearTimeout(timeoutId);

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
      error: error.name === 'AbortError' ? 'Timeout ao baixar XML' : error.message
    }
  }
}

async function salvarXmlNoBanco(supabaseClient: any, consultaId: string, userId: string, chaveNfe: string, xmlContent: string) {
  const parser = new DOMParser()
  const doc = parser.parseFromString(xmlContent, 'text/xml')
  
  const numeroNfe = doc.querySelector('nNF')?.textContent?.trim() || ''
  const cnpjEmitente = doc.querySelector('emit CNPJ')?.textContent?.trim() || ''
  const razaoSocialEmitente = doc.querySelector('emit xNome')?.textContent?.trim() || ''
  const dataEmissao = doc.querySelector('dhEmi')?.textContent?.trim() || ''
  const valorTotal = doc.querySelector('vNF')?.textContent?.trim() || '0'

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
