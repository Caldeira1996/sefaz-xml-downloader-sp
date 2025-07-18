
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

// Rate limiting simples (em produção, usar Redis)
const rateLimitMap = new Map<string, { count: number; resetTime: number }>();
const RATE_LIMIT = 10; // Aumentar limite para testes
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

function formatDateForSefaz(dateString: string): string {
  // Converte data para formato AAAA-MM-DD
  const date = new Date(dateString);
  return date.toISOString().split('T')[0];
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
    const { certificadoId, cnpjConsultado, tipoConsulta, ambiente, dataInicio, dataFim } = requestData

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

    console.log(`Iniciando consulta SEFAZ: ${tipoConsulta} para CNPJ ${cnpjConsultado} no ambiente ${ambiente}`)
    if (dataInicio) console.log(`Período: ${dataInicio} até ${dataFim || dataInicio}`)

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

    console.log(`Certificado encontrado: ${certificado.nome} para CNPJ ${certificado.cnpj}`)

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
        manifestacao: 'https://nfe.fazenda.sp.gov.br/ws/nfeconsultadest.asmx',
        download: 'https://nfe.fazenda.sp.gov.br/ws/nfedownload.asmx'
      },
      homologacao: {
        manifestacao: 'https://homologacao.nfe.fazenda.sp.gov.br/ws/nfeconsultadest.asmx',
        download: 'https://homologacao.nfe.fazenda.sp.gov.br/ws/nfedownload.asmx'
      }
    }

    let resultado
    let xmlsBaixados = 0

    console.log(`Usando URL: ${urls[ambiente].manifestacao}`)

    if (tipoConsulta === 'manifestacao') {
      // Consultar manifestações pendentes usando o serviço correto
      resultado = await consultarManifestacoesPendentes(
        urls[ambiente].manifestacao,
        certificado,
        cnpjConsultado.replace(/\D/g, ''),
        ambiente,
        dataInicio,
        dataFim
      )
      
      console.log('Resultado da consulta:', JSON.stringify(resultado, null, 2))
      
      if (resultado.success && resultado.data?.chavesNfe && resultado.data.chavesNfe.length > 0) {
        console.log(`Encontradas ${resultado.data.chavesNfe.length} NFe(s)`)
        
        // Baixar XMLs das notas encontradas (máximo 10 por vez para teste)
        const chavesLimitadas = resultado.data.chavesNfe.slice(0, 10);
        
        for (const chaveNfe of chavesLimitadas) {
          try {
            console.log(`Baixando XML para chave: ${chaveNfe}`)
            const xmlResult = await baixarXmlNfe(
              urls[ambiente].download,
              certificado,
              chaveNfe,
              ambiente
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
              console.log(`XML salvo com sucesso para chave: ${chaveNfe}`)
            } else {
              console.log(`Erro ao baixar XML ${chaveNfe}:`, xmlResult.error)
            }
          } catch (error) {
            console.error(`Erro ao processar XML ${chaveNfe}:`, error)
          }
        }
      } else {
        console.log('Nenhuma NFe encontrada ou erro na consulta')
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

    console.log(`Consulta finalizada: ${xmlsBaixados} XMLs baixados de ${resultado.data?.chavesNfe?.length || 0} encontrados`)

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
    console.error('Erro na consulta SEFAZ:', error)
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
  
  // Preparar filtros de data se fornecidos
  let filtroData = '';
  if (dataInicio) {
    const dataInicioFormatada = formatDateForSefaz(dataInicio);
    const dataFimFormatada = dataFim ? formatDateForSefaz(dataFim) : dataInicioFormatada;
    
    filtroData = `
      <dhInicio>${dataInicioFormatada}T00:00:00-03:00</dhInicio>
      <dhFim>${dataFimFormatada}T23:59:59-03:00</dhFim>`;
  }
  
  const soapEnvelope = `<?xml version="1.0" encoding="utf-8"?>
<soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/" xmlns:nfe="http://www.portalfiscal.inf.br/nfe/wsdl/NfeConsultaDest">
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
    console.log(`Enviando requisição SOAP para: ${url}`)
    console.log(`CNPJ consultado: ${cnpj}, Ambiente: ${ambiente} (${tpAmb})`)
    console.log(`SOAP Envelope:`, soapEnvelope.substring(0, 500) + '...')
    
    // Primeira tentativa: usar fetch nativo do Deno com configurações específicas
    const fetchWithConfig = async (options: any) => {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 45000); // 45 segundos
      
      try {
        // Usar fetch com configurações específicas para Edge Functions
        const response = await fetch(url, {
          method: 'POST',
          headers: {
            'Content-Type': 'text/xml; charset=utf-8',
            'SOAPAction': 'http://www.portalfiscal.inf.br/nfe/wsdl/NfeConsultaDest/nfeConsultaNFDest',
            'User-Agent': 'EdgeFunction-SEFAZ/1.0',
            'Accept': 'text/xml, application/soap+xml',
            'Connection': 'close',
            'Cache-Control': 'no-cache',
            ...options.headers
          },
          body: soapEnvelope,
          signal: controller.signal
        });
        
        clearTimeout(timeoutId);
        return response;
      } catch (error) {
        clearTimeout(timeoutId);
        throw error;
      }
    };

    console.log('Tentativa 1: Fetch padrão')
    let response = await fetchWithConfig({});
    
    console.log(`Status da resposta: ${response.status} ${response.statusText}`)
    console.log(`Headers da resposta:`, JSON.stringify([...response.headers.entries()]))

    if (!response.ok) {
      const errorText = await response.text()
      console.error(`Erro HTTP ${response.status}: ${errorText.substring(0, 500)}`)
      
      if (response.status >= 400 && response.status < 500) {
        // Tentar com headers mais simples
        console.log('Tentativa 2: Headers simplificados')
        response = await fetchWithConfig({
          headers: {
            'Content-Type': 'text/xml',
            'SOAPAction': '"http://www.portalfiscal.inf.br/nfe/wsdl/NfeConsultaDest/nfeConsultaNFDest"'
          }
        });
        
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`)
        }
      } else {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`)
      }
    }

    const xmlResponse = await response.text()
    console.log(`Resposta recebida (${xmlResponse.length} caracteres)`)
    
    return parseResponse(xmlResponse, diagnostico)

  } catch (error) {
    console.error('Erro na consulta SEFAZ:', error)
    diagnostico.error = error.message;
    
    // Diagnosticar tipo de erro
    const errorDetails = {
      errorName: error.name,
      errorMessage: error.message,
      possibleCause: 
        error.message.includes('AbortError') || error.message.includes('timeout') ? 'Timeout de conexão' :
        error.message.includes('DNS') || error.message.includes('getaddrinfo') ? 'Erro de resolução DNS' :
        error.message.includes('refused') || error.message.includes('ECONNREFUSED') ? 'Conexão recusada pelo servidor' :
        error.message.includes('certificate') || error.message.includes('SSL') ? 'Erro de certificado SSL/TLS' :
        error.message.includes('network') || error.message.includes('fetch') ? 'Erro de conectividade de rede' :
        'Erro desconhecido de conectividade',
      suggestions: [
        'Verificar se o ambiente Supabase permite conexões externas',
        'Confirmar se os URLs da SEFAZ estão corretos',
        'Testar conectividade com outros webservices',
        'Verificar logs detalhados no Supabase Dashboard'
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
  console.log(`Analisando resposta XML (${xmlResponse.length} caracteres)`)
  console.log(`Primeiros 1000 chars: ${xmlResponse.substring(0, 1000)}`)

  // Parse da resposta XML para extrair informações
  const parser = new DOMParser()
  const doc = parser.parseFromString(xmlResponse, 'text/xml')
  
  // Verificar se há erros na resposta
  const faultString = doc.querySelector('faultstring')?.textContent
  if (faultString) {
    console.error(`Erro SOAP: ${faultString}`)
    diagnostico.soapError = faultString;
    throw new Error(`Erro SOAP: ${faultString}`)
  }

  // Procurar por chaves de NFe na resposta
  const chavesNfe = []
  
  // Tentar diferentes seletores para encontrar as chaves
  const possibleSelectors = [
    'chNFe',
    'infNFe',
    'nfe chNFe',
    'retConsNFeDest chNFe',
    'resNFe chNFe',
    'resNFe[chNFe]'
  ]
  
  for (const selector of possibleSelectors) {
    const elements = doc.querySelectorAll(selector)
    console.log(`Seletor '${selector}' encontrou ${elements.length} elementos`)
    
    for (const element of elements) {
      let chave = element.textContent?.trim()
      if (!chave && element.hasAttribute('chNFe')) {
        chave = element.getAttribute('chNFe')
      }
      
      // Verificar se é uma chave válida (44 dígitos)
      if (chave && /^[0-9]{44}$/.test(chave)) {
        chavesNfe.push(chave)
        console.log(`Chave NFe encontrada: ${chave}`)
      }
    }
  }

  // Se não encontrou chaves nos seletores padrão, procurar no XML bruto
  if (chavesNfe.length === 0) {
    console.log('Procurando chaves no XML bruto...')
    const chaveRegex = /(\d{44})/g;
    let match;
    while ((match = chaveRegex.exec(xmlResponse)) !== null) {
      const chave = match[1];
      if (chave && !chavesNfe.includes(chave)) {
        chavesNfe.push(chave);
        console.log(`Chave NFe encontrada via regex: ${chave}`);
      }
    }
  }

  // Verificar códigos de retorno
  const cStat = doc.querySelector('cStat')?.textContent
  const xMotivo = doc.querySelector('xMotivo')?.textContent
  
  console.log(`Código de status: ${cStat}, Motivo: ${xMotivo}`)
  console.log(`Total de chaves encontradas: ${chavesNfe.length}`)
  
  diagnostico.cStat = cStat;
  diagnostico.xMotivo = xMotivo;
  diagnostico.chavesEncontradas = chavesNfe.length;

  // Códigos de sucesso da SEFAZ: 138 = consulta realizada com sucesso
  if (cStat && ['138'].includes(cStat)) {
    console.log(`Consulta bem-sucedida: ${cStat} - ${xMotivo}`)
  } else if (cStat) {
    console.log(`Status não esperado: ${cStat} - ${xMotivo}`)
  }

  return {
    success: true,
    data: {
      chavesNfe: [...new Set(chavesNfe)], // Remove duplicatas
      codigoStatus: cStat,
      motivo: xMotivo,
      xmlResponse: xmlResponse.substring(0, 2000) // Limitar para log
    },
    diagnostico
  }
}

async function baixarXmlNfe(url: string, certificado: any, chaveNfe: string, ambiente: string) {
  // Validar chave NFe
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
    const timeoutId = setTimeout(() => controller.abort(), 45000);
    
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'text/xml; charset=utf-8',
        'SOAPAction': 'http://www.portalfiscal.inf.br/nfe/wsdl/NfeDownload/nfeDownloadNF',
        'User-Agent': 'EdgeFunction-SEFAZ/1.0',
        'Connection': 'close'
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
    if (error.name === 'AbortError') {
      return {
        success: false,
        error: 'Timeout ao baixar XML'
      }
    }
    
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
