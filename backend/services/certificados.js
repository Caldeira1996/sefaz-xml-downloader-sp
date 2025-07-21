const certificados = {};

function setCertificado(nome, certificadoBuffer, senha) {
  certificados[nome] = {
    pfx: certificadoBuffer,
    password: senha
  };
}

function getCertificado(nome) {
  return certificados[nome];
}

module.exports = {
  setCertificado,
  getCertificado
};
