
# Deploy no Servidor AWS

## Comandos para deploy no servidor 56.124.22.200

### 1. Conectar ao servidor
```bash
ssh -i sua-chave.pem ubuntu@56.124.22.200
```

### 2. Instalar dependências (se necessário)
```bash
# Atualizar sistema
sudo apt update && sudo apt upgrade -y

# Instalar Node.js (se não tiver)
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs

# Verificar versão
node --version
npm --version
```

### 3. Preparar aplicação
```bash
# Criar diretório para a aplicação
mkdir -p ~/sefaz-proxy
cd ~/sefaz-proxy

# Clonar ou fazer upload dos arquivos do backend
# Copie os arquivos: package.json, server.js, .env.example
```

### 4. Instalar dependências e configurar
```bash
# Instalar dependências
npm install

# Configurar variáveis de ambiente
cp .env.example .env
nano .env

# Criar pasta de certificados
mkdir certificates
```

### 5. Configurar firewall (se necessário)
```bash
# Permitir porta 3001
sudo ufw allow 3001
sudo ufw status
```

### 6. Executar aplicação
```bash
# Teste
npm start

# Para produção (com PM2)
sudo npm install -g pm2
pm2 start server.js --name sefaz-proxy
pm2 startup
pm2 save
```

### 7. Verificar se está funcionando
```bash
curl http://localhost:3001/health
```

## Configurações importantes

1. **Certificados**: Coloque seus arquivos .pfx/.p12 na pasta `certificates/`
2. **Firewall**: Libere a porta 3001 no security group da AWS
3. **DNS**: Configure um domínio para o IP 56.124.22.200 (opcional)
4. **HTTPS**: Para produção, configure SSL/TLS

