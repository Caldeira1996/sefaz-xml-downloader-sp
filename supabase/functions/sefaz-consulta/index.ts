
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// URLs atualizadas dos webservices SEFAZ SP
const SEFAZ_URLS = {
  producao: {
    status: [
      'https://nfe.fazenda.sp.gov.br/ws/nfestatusservico4.asmx',
      'https://nfe.fazenda.sp.gov.br/ws/nfestatusservico2.asmx'
    ],
    consulta: [
      'https://nfe.fazenda.sp.gov.br/ws/recepcaoevento.asmx',
      'https://nfe.fazenda.sp.gov.br/ws/recepcao.asmx'
    ]
  },
  homologacao: {
    status: [
      'https://homologacao.nfe.fazenda.sp.gov.br/ws/nfestatusservico4.asmx',
      'https://homologacao.nfe.fazenda.sp.gov.br/ws/nfestatusservico2.asmx'
    ],
    consulta: [
      'https://homologacao.nfe.fazenda.sp.gov.br/ws/recepcaoevento.asmx',
      'https://homologacao.nfe.fazenda.sp.gov.br/ws/recepcao.asmx'
    ]
  }
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

    // Buscar certificado - declare antes para clareza
    async function buscarCertificado(certificadoId: string, user: any) {
      const { data: certificado, error: certError } = await supabaseClient
        .from('certificados')
        .select('*')
        .eq('id', certificadoId)
        .eq('user_id', user.id)
        .single()

      if (certError || !certificado) {
        throw new Error('Certificado não encontrado ou não autorizado')
      }
      return certificado
    }

    const authHeader = req.headers.get('Authorization')
    if (!authHeader) throw new Error('Token de autorização necessário')

    const token = authHeader.replace('Bearer ', '')
    const { data: { user }, error: authError } = await supabaseClient.auth.getUser(token)
    if (authError || !user) throw new Error('Usuário não autenticado')

    const { certificadoId, cnpjConsultado, tipoConsulta, ambiente = 'homologacao' } = await req.json()

    console.log(`🔍 Iniciando consulta SEFAZ - Tipo: ${tipoConsulta}, Ambiente: ${ambiente}`)

    const certificado = await buscarCertificado(certificadoId, user)
    console.log('Certificado encontrado:', certificado)

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

    if (consultaError) throw new Error(`Erro ao registrar consulta: ${consultaError.message}`)

    const urlsSet = SEFAZ_URLS[ambiente] || SEFAZ_URLS.producao
    const urls = tipoConsulta === 'status' ? urlsSet.status : urlsSet.consulta
    const selectedUrl = urls[0]

    console.log('🔄 Simulando consulta ao SEFAZ SP...')
    await new Promise(resolve => setTimeout(resolve, 2000))

    const totalXmls = Math.floor(Math.random() * 10) + 1
    const xmlsBaixados = totalXmls

    const resultado = {
      success: true,
      totalXmls,
      xmlsBaixados,
      detalhes: `Consulta simulada realizada com sucesso para CNPJ ${cnpjConsultado}`,
      diagnostico: {
        url: selectedUrl,
        ambiente,
        timestamp: new Date().toISOString(),
        cStat: '107',
        xMotivo: 'Serviço em operação',
        simulacao: true,
        nota: 'Esta é uma simulação. Em produção, seria feita consulta real ao SEFAZ SP'
      }
    }

    await supabaseClient
      .from('consultas_sefaz')
      .update({
        status: 'concluido',
        resultado,
        total_xmls: totalXmls,
        xmls_baixados: xmlsBaixados
      })
      .eq('id', consulta.id)

    console.log(`✅ Consulta simulada concluída: ${totalXmls} XMLs encontrados`)

    return new Response(JSON.stringify(resultado), {
      headers: {
        'Content-Type': 'application/json',
        ...corsHeaders
      }
    })

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
