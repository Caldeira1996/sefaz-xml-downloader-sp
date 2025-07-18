
#!/bin/bash

echo "🔐 Configurando HTTPS para servidor SEFAZ SP"
echo "=========================================="

# Criar diretório SSL se não existir
mkdir -p ssl
cd ssl

echo "📋 Escolha o tipo de certificado:"
echo "1) Certificado auto-assinado (desenvolvimento/teste)"
echo "2) Let's Encrypt (produção com domínio)"
read -p "Opção (1 ou 2): " opcao

if [ "$opcao" = "1" ]; then
    echo "🔧 Gerando certificado auto-assinado..."
    
    # Gerar chave privada
    openssl genrsa -out key.pem 2048
    
    # Gerar certificado auto-assinado válido por 365 dias
    openssl req -new -x509 -key key.pem -out cert.pem -days 365 -subj "/C=BR/ST=SP/L=SaoPaulo/O=SEFAZ/CN=56.124.22.200"
    
    echo "✅ Certificado auto-assinado criado!"
    echo "⚠️  ATENÇÃO: Você precisará aceitar o aviso de segurança no navegador"
    echo "📁 Arquivos criados:"
    echo "   - ssl/key.pem (chave privada)"
    echo "   - ssl/cert.pem (certificado)"
    
elif [ "$opcao" = "2" ]; then
    echo "🌐 Configurando Let's Encrypt..."
    echo "⚠️  IMPORTANTE: Você precisa ter um domínio apontando para este servidor!"
    
    read -p "Digite seu domínio (ex: sefaz.seudominio.com): " dominio
    
    if [ -z "$dominio" ]; then
        echo "❌ Domínio não informado. Abortando."
        exit 1
    fi
    
    # Instalar Certbot se não estiver instalado
    if ! command -v certbot &> /dev/null; then
        echo "📦 Instalando Certbot..."
        sudo apt update
        sudo apt install -y certbot
    fi
    
    # Gerar certificado Let's Encrypt
    echo "🔐 Gerando certificado Let's Encrypt para $dominio..."
    sudo certbot certonly --standalone -d $dominio --email admin@$dominio --agree-tos --non-interactive
    
    # Copiar certificados para nossa pasta
    sudo cp /etc/letsencrypt/live/$dominio/fullchain.pem cert.pem
    sudo cp /etc/letsencrypt/live/$dominio/privkey.pem key.pem
    
    # Ajustar permissões
    sudo chown $USER:$USER cert.pem key.pem
    
    echo "✅ Certificado Let's Encrypt configurado!"
    echo "📁 Arquivos copiados para ssl/"
    
    # Configurar renovação automática
    echo "⏰ Configurando renovação automática..."
    echo "0 12 * * * /usr/bin/certbot renew --quiet" | sudo crontab -
    
else
    echo "❌ Opção inválida. Execute o script novamente."
    exit 1
fi

echo ""
echo "🎉 Configuração concluída!"
echo "🚀 Execute 'npm run start:https' para iniciar o servidor com HTTPS"

cd ..
