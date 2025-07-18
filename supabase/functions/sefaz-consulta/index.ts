
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// URLs atualizadas dos webservices SEFAZ SP
const SEFAZ_URLS = {
  producao: [
    'https://nfe.fazenda.sp.gov.br/ws/nfestatusservico4.asmx',
    'https://nfe.fazenda.sp.gov.br/ws/nfestatusservico2.asmx'
  ],
  homologacao: [
    'https://homologacao.nfe.fazenda.sp.gov.br/ws/nfestatusservico4.asmx',
    'https://homologacao.nfe.fazenda.sp.gov.br/ws/nfestatusservico2.asmx'
  ]
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      throw new Error('Token de autorização necessário')
    }

    const token = authHeader.replace('Bearer ', '')
    const { data: { user }, error: authError } = await supabaseClient.auth.getUser(token)
    
    if (authError || !user) {
      throw new Error('Usuário não autenticado')
    }

    const { 
      certificadoId, 
      cnpjConsultado, 
      tipoConsulta, 
      ambiente = 'homologacao',
      dataInicio,
      dataFim 
    } = await req.json()

    console.log(`🔍 Iniciando consulta SEFAZ - Tipo: ${tipoConsulta}, Ambiente: ${ambiente}`)

    // Buscar certificado
    const { data: certificado, error: certError } = await supabaseClient
      .from('certificados')
      .select('*')
      .eq('id', certificadoId)
      .eq('user_id', user.id)
      .single()

    if (certError || !certificado) {
      throw new Error('Certificado não encontrado ou não autorizado')
    }

    // Registrar consulta no banco
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
      throw new Error(`Erro ao registrar consulta: ${consultaError.message}`)
    }

    // **SIMULAÇÃO** para demonstrar que o sistema funcionaria
    // Em produção, aqui seria feita a consulta real ao SEFAZ
    console.log('🔄 Simulando consulta ao SEFAZ SP...')
    
    // Simular delay de processamento
    await new Promise(resolve => setTimeout(resolve, 2000))
    
    // URLs que seriam utilizadas
    const urls = SEFAZ_URLS[ambiente as keyof typeof SEFAZ_URLS] || SEFAZ_URLS.producao
    const selectedUrl = urls[0]
    
    // Resultado simulado
    const totalXmls = Math.floor(Math.random() * 10) + 1
    const xmlsBaixados = totalXmls
    
    const resultado = {
      success: true,
      totalXmls,
      xmlsBaixados,
      detalhes: `Consulta simulada realizada com sucesso para CNPJ ${cnpjConsultado}`,
      diagnostico: {
        url: selectedUrl,
        ambiente: ambiente,
        timestamp: new Date().toISOString(),
        cStat: '107',
        xMotivo: 'Serviço em operação',
        simulacao: true,
        nota: 'Esta é uma simulação. Em produção, seria feita consulta real ao SEFAZ SP'
      }
    }

    // Simular alguns XMLs de exemplo
    const xmlsSimulados = []
    for (let i = 0; i < totalXmls; i++) {
      const chaveNfe = `35${new Date().getFullYear()}${cnpjConsultado.padStart(14, '0')}55001${String(i + 1).padStart(9, '0')}${Math.floor(Math.random() * 10)}`
      
      xmlsSimulados.push({
        consulta_id: consulta.id,
        user_id: user.id,
        chave_nfe: chaveNfe,
        numero_nfe: String(1000 + i),
        cnpj_emitente: '12345678000199',
        razao_social_emitente: `Empresa Exemplo ${i + 1} Ltda`,
        data_emissao: new Date().toISOString(),
        valor_total: (Math.random() * 1000 + 100).toFixed(2),
        xml_content: `<NFe><infNFe Id="NFe${chaveNfe}"><ide><cNF>${String(i + 1).padStart(8, '0')}</cNF></ide></infNFe></NFe>`,
        status_manifestacao: 'pendente'
      })
    }

    // Inserir XMLs simulados
    if (xmlsSimulados.length > 0) {
      const { error: xmlError } = await supabaseClient
        .from('xmls_nfe')
        .insert(xmlsSimulados)
      
      if (xmlError) {
        console.error('Erro ao inserir XMLs:', xmlError)
      }
    }

    // Atualizar status da consulta
    await supabaseClient
      .from('consultas_sefaz')
      .update({
        status: 'concluido',
        resultado: resultado,
        total_xmls: totalXmls,
        xmls_baixados: xmlsBaixados
      })
      .eq('id', consulta.id)

    console.log(`✅ Consulta simulada concluída: ${totalXmls} XMLs encontrados`)

    return new Response(
      JSON.stringify(resultado),
      { 
        headers: { 
          'Content-Type': 'application/json',
          ...corsHeaders 
        } 
      }
    )

  } catch (error) {
    console.error('❌ Erro na consulta SEFAZ:', error)
    
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message,
        details: 'Verifique os logs da função para mais detalhes',
        timestamp: new Date().toISOString()
      }),
      { 
        headers: { 
          'Content-Type': 'application/json',
          ...corsHeaders 
        },
        status: 500
      }
    )
  }
})
