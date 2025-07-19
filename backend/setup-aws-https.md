
# Configuração HTTPS no Servidor AWS

## Pré-requisitos
- Servidor AWS Ubuntu com IP: 56.124.22.200
- Node.js instalado
- Acesso SSH ao servidor

## Passo a Passo

### 1. Conectar ao servidor
```bash
ssh -i sua-chave.pem ubuntu@56.124.22.200
```

### 2. Navegar para o diretório do projeto
```bash
cd ~/sefaz-proxy
```

### 3. Configurar HTTPS

#### Opção A: Certificado Auto-assinado (Mais Rápido)
```bash
# Tornar o script executável
chmod +x generate-ssl.sh

# Executar configuração
./generate-ssl.sh

# Escolher opção 1 (certificado auto-assinado)
```

#### Opção B: Let's Encrypt (Produção com Domínio)
```bash
# Primeiro, configure um domínio apontando para 56.124.22.200
# Exemplo: sefaz.seudominio.com

# Executar configuração
./generate-ssl.sh

# Escolher opção 2 e informar seu domínio
```

### 4. Configurar variáveis de ambiente
```bash
# Editar .env
nano .env

# Adicionar:
HTTPS_PORT=3001
SERVER_HOST=0.0.0.0
CORS_ORIGIN=https://www.xmlprodownloader.com.br
```

### 5. Configurar firewall
```bash
# Liberar porta HTTPS
sudo ufw allow 3001
sudo ufw status
```

### 6. Iniciar servidor HTTPS
```bash
# Testar primeiro
npm run start:https

# Para produção com PM2
pm2 start server-https.js --name sefaz-https
pm2 startup
pm2 save
```

### 7. Verificar funcionamento
```bash
# Teste local
curl -k https://localhost:3001/health

# Teste externo (substitua pelo seu domínio ou IP)
curl -k https://56.124.22.200:3001/health
```

## Após Configuração

1. **Atualize o frontend**: O IP do backend será `https://56.124.22.200:3001`
2. **Certificado auto-assinado**: Você verá um aviso de segurança no navegador - clique em "Avançado" e "Prosseguir"
3. **Let's Encrypt**: Funcionará sem avisos de segurança

## Troubleshooting

### Problema: "Certificate verification failed"
- **Solução**: Use certificado auto-assinado para desenvolvimento
- No navegador, aceite o certificado quando solicitado

### Problema: "Port already in use"
- **Solução**: Pare outros serviços na porta 3001
```bash
sudo lsof -i :3001
sudo kill -9 <PID>
```

### Problema: "Permission denied"
- **Solução**: Execute com sudo se necessário
```bash
sudo npm run start:https
```

## Renovação Automática (Let's Encrypt)

Se usar Let's Encrypt, a renovação é automática. Para verificar:
```bash
sudo certbot renew --dry-run
```

## Segurança Adicional

### Firewall rigoroso
```bash
# Bloquear HTTP e permitir apenas HTTPS
sudo ufw deny 80
sudo ufw allow 443
sudo ufw allow 3001
```

### Redirecionamento HTTP -> HTTPS
Adicione no servidor um redirecionamento automático de HTTP para HTTPS.
