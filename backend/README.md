
# Servidor Proxy SEFAZ SP

Este servidor Node.js atua como proxy entre o frontend React e os Web Services da SEFAZ SP, possibilitando o uso de certificados digitais para autenticação.

## Instalação

1. Entre na pasta do backend:
```bash
cd backend
```

2. Instale as dependências:
```bash
npm install
```

3. Configure as variáveis de ambiente:
```bash
cp .env.example .env
```

4. Inicie o servidor:
```bash
# Desenvolvimento
npm run dev

# Produção
npm start
```

## Estrutura de Pastas

```
backend/
├── server.js          # Servidor principal
├── package.json        # Dependências
├── .env.example       # Exemplo de configuração
├── certificates/      # Pasta para certificados PFX/P12
└── README.md          # Esta documentação
```

## Endpoints

### GET /health
Verifica se o servidor está funcionando.

### POST /api/sefaz/status
Verifica o status dos serviços SEFAZ SP.

### POST /api/sefaz/consulta
Realiza consultas de NFe na SEFAZ SP.

### POST /api/certificados/upload
Upload de certificados digitais (a implementar).

## Próximos Passos

1. **Colocar certificados**: Adicione seus certificados .pfx/.p12 na pasta `certificates/`
2. **Configurar HTTPS**: Para produção, configure certificados SSL
3. **Implementar upload**: Adicionar interface para upload seguro de certificados
4. **Logs**: Implementar sistema de logs mais robusto

## Observações

- O servidor valida tokens do Supabase para autenticação
- Certificados são carregados do sistema de arquivos local
- Comunicação SOAP com a SEFAZ usando biblioteca especializada
- Compatível com certificados A1 (PFX/P12)
