const path = require('path');
const fs = require('fs');

async function validarCertificado({ certificadoPath, senhaCertificado }) {
  try {
    // Log do certificadoPath recebido
    console.log('Recebido certificadoPath:', certificadoPath);

    // Confirma se arquivo existe no local esperado
    const fullPath = path.isAbsolute(certificadoPath)
      ? certificadoPath
      : path.join(__dirname, 'certificates', `${certificadoPath}.pfx`);

    console.log('Caminho completo do certificado:', fullPath);

    if (!fs.existsSync(fullPath)) {
      console.error('Certificado não encontrado no caminho informado');
      return { valido: false, erro: 'Certificado não encontrado' };
    }

    // Só pra garantir que a senha veio (não logar senha em texto! só confirmação)
    if (!senhaCertificado || senhaCertificado.length === 0) {
      console.error('Senha do certificado não informada');
      return { valido: false, erro: 'Senha do certificado não informada' };
    }

    // Cria agente HTTPS a partir do certificado e senha
    const httpsAgent = createAgentFromPfx(certificadoPath, senhaCertificado);

    // URL de homologação para teste
    const url = 'https://homologacao.nfe.fazenda.sp.gov.br/ws/NfeStatusServico4.asmx';

    // Corpo XML para consulta de status (simples)
    const xmlEnvelope = createStatusEnvelope();

    // Tenta fazer a requisição
    const response = await axios.post(url, xmlEnvelope, {
      httpsAgent,
      headers: {
        'Content-Type': 'text/xml; charset=utf-8',
        'SOAPAction': 'http://www.portalfiscal.inf.br/nfe/wsdl/NFeStatusServico4/nfeStatusServicoNF',
      },
      timeout: 10000,
    });

    console.log('Requisição realizada com sucesso, resposta:', response.status);

    return { valido: true, resposta: response.data };
  } catch (err) {
    console.error('Erro na validação do certificado:', err.message);
    return { valido: false, erro: err.message || err.toString() };
  }
}
