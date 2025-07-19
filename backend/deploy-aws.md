
# Deploy HTTPS no Servidor AWS

## Servidor: 56.124.22.200

### 🔐 Configuração HTTPS Completa

#### 1. Conectar ao servidor
```bash
ssh -i sua-chave.pem ubuntu@56.124.22.200
```

#### 2. Preparar aplicação
```bash
# Criar diretório
mkdir -p ~/sefaz-proxy
cd ~/sefaz-proxy

# Fazer upload de todos os arquivos do backend/
# Incluindo: package.json, server.js, server-https.js, generate-ssl.sh, etc.
```

#### 3. Instalar dependências
```bash
npm install
```

#### 4. Configurar SSL/HTTPS
```bash
# Tornar script executável
chmod +x generate-ssl.sh

# Executar configuração SSL
./generate-ssl.sh

# Escolher opção 1 (certificado auto-assinado) para início rápido
```

#### 5. Configurar ambiente
```bash
# Copiar e editar .env
cp .env.example .env
nano .env

# Configurar:
HTTPS_PORT=3002
SERVER_HOST=0.0.0.0
CORS_ORIGIN=https://www.xmlprodownloader.com.br
```

#### 6. Configurar firewall AWS
```bash
# Liberar porta HTTPS
sudo ufw allow 3001

# Opcional: Bloquear HTTP
sudo ufw deny 80
```

#### 7. Iniciar servidor HTTPS
```bash
# Teste manual
npm run start:https

# Para produção
sudo npm install -g pm2
pm2 start server-https.js --name sefaz-https
pm2 startup
pm2 save
```

#### 8. Verificar funcionamento
```bash
# Teste local
curl -k https://localhost:3001/health

# Teste externo
curl -k https://56.124.22.200:3001/health
```

### ✅ Resultado Final

- **Backend URL**: `https://56.124.22.200:3001`
- **Health Check**: `https://56.124.22.200:3001/health`
- **Status SEFAZ**: `https://56.124.22.200:3001/api/sefaz/status`
- **Consulta SEFAZ**: `https://56.124.22.200:3001/api/sefaz/consulta`

### 🔧 Próximos Passos

1. **Frontend atualizado**: Já configurado para usar HTTPS
2. **Certificados SEFAZ**: Coloque seus arquivos .pfx na pasta `certificates/`
3. **Domínio (opcional)**: Configure um domínio para usar Let's Encrypt

### 🚨 Importante

- **Certificado auto-assinado**: O navegador mostrará aviso de segurança - aceite para continuar
- **Let's Encrypt**: Para domínio real, sem avisos de segurança
- **Firewall AWS**: Configure o Security Group para permitir porta 3001

### 🔄 Comando Rápido

Execute tudo de uma vez:
```bash
cd ~/sefaz-proxy && \
chmod +x generate-ssl.sh && \
./generate-ssl.sh && \
npm run start:https
```
