
const fs = require('fs');
const path = require('path');
const https = require('https');
const express = require('express');

// Script para configurar HTTPS no servidor
const setupHTTPS = () => {
  console.log('🔧 Configurando HTTPS para o servidor SEFAZ...');
  
  const certDir = path.join(__dirname, 'ssl');
  
  // Verificar se o diretório SSL existe
  if (!fs.existsSync(certDir)) {
    fs.mkdirSync(certDir, { recursive: true });
    console.log('📁 Diretório SSL criado:', certDir);
  }
  
  const certPath = path.join(certDir, 'cert.pem');
  const keyPath = path.join(certDir, 'key.pem');
  
  // Verificar se os certificados existem
  if (fs.existsSync(certPath) && fs.existsSync(keyPath)) {
    console.log('✅ Certificados SSL encontrados!');
    return {
      cert: fs.readFileSync(certPath),
      key: fs.readFileSync(keyPath)
    };
  } else {
    console.log('❌ Certificados SSL não encontrados.');
    console.log('Execute o script de geração de certificados primeiro.');
    return null;
  }
};

module.exports = { setupHTTPS };
