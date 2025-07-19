const fs = require('fs');
const path = require('path');
const https = require('https');
const express = require('express');

// Script para configurar HTTPS no servidor
const setupHTTPS = () => {
  const certDir = path.join(__dirname, 'certs'); // use 'certs' para padronizar

  if (!fs.existsSync(certDir)) {
    fs.mkdirSync(certDir, { recursive: true });
  }

  const certPath = path.join(certDir, 'client-cert.pem');
  const keyPath = path.join(certDir, 'client-key.pem');
  const caPath = path.join(certDir, 'sefaz-intermediate.pem');

  if (fs.existsSync(certPath) && fs.existsSync(keyPath) && fs.existsSync(caPath)) {
    return {
      cert: fs.readFileSync(certPath),
      key: fs.readFileSync(keyPath),
      ca: fs.readFileSync(caPath)
    };
  } else {
    console.log('❌ Alguns certificados SSL não foram encontrados em certs/');
    return null;
  }
};

module.exports = { setupHTTPS };
