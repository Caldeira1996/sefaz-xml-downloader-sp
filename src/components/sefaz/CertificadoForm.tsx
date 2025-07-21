'use client';

import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/components/auth/AuthProvider';
import { encryptPassword } from '@/utils/encryption';
import { validateCnpj, formatCnpj, sanitizeInput } from '@/utils/cnpjValidation';

export const CertificadoForm = ({ onSuccess }: { onSuccess: () => void }) => {
  const [nome, setNome] = useState('');
  const [cnpj, setCnpj] = useState('');
  const [certificadoFile, setCertificadoFile] = useState<File | null>(null);
  const [senha, setSenha] = useState('');
  const [ambiente, setAmbiente] = useState<'producao' | 'homologacao'>('homologacao');
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();
  const { user, token } = useAuth();

  const validateCertificateFile = (file: File): boolean => {
    const validExtensions = ['.p12', '.pfx'];
    const fileExtension = file.name.toLowerCase().substring(file.name.lastIndexOf('.'));
    if (!validExtensions.includes(fileExtension)) {
      toast({
        title: "Arquivo inválido",
        description: "Por favor, selecione um arquivo .p12 ou .pfx.",
        variant: "destructive",
      });
      return false;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast({
        title: "Arquivo muito grande",
        description: "O certificado deve ter no máximo 5MB.",
        variant: "destructive",
      });
      return false;
    }
    return true;
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && validateCertificateFile(file)) {
      setCertificadoFile(file);
    } else {
      e.target.value = '';
      setCertificadoFile(null);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!user || !token) {
      toast({
        title: "Usuário não autenticado",
        description: "Por favor, faça login para continuar.",
        variant: "destructive",
      });
      return;
    }

    if (!certificadoFile) {
      toast({
        title: "Arquivo do certificado necessário",
        description: "Por favor, selecione o arquivo do certificado.",
        variant: "destructive",
      });
      return;
    }

    const sanitizedNome = sanitizeInput(nome);
    const sanitizedCnpj = cnpj.replace(/\D/g, '');
    const sanitizedSenha = senha.trim();

    if (!sanitizedNome || sanitizedNome.length < 3) {
      toast({
        title: "Nome inválido",
        description: "O nome deve ter pelo menos 3 caracteres.",
        variant: "destructive",
      });
      return;
    }

    if (!validateCnpj(sanitizedCnpj)) {
      toast({
        title: "CNPJ inválido",
        description: "Por favor, insira um CNPJ válido.",
        variant: "destructive",
      });
      return;
    }

    if (!sanitizedSenha || sanitizedSenha.length < 4) {
      toast({
        title: "Senha inválida",
        description: "A senha do certificado deve ter pelo menos 4 caracteres.",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);

    try {
      const encryptedPassword = await encryptPassword(sanitizedSenha);

      const reader = new FileReader();
      const base64Promise = new Promise<string>((resolve, reject) => {
        reader.onload = () => {
          const result = reader.result as string;
          const base64 = result.split(',')[1];
          resolve(base64);
        };
        reader.onerror = () => reject(new Error('Erro ao ler arquivo'));
      });
      reader.readAsDataURL(certificadoFile);
      const certificadoBase64 = await base64Promise;

      const response = await fetch(`${process.env.NEXT_PUBLIC_BACKEND_URL || 'https://www.xmlprodownloader.com.br'}/certificados`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          user_id: user.id,
          nome: sanitizedNome,
          cnpj: sanitizedCnpj,
          certificado_base64: certificadoBase64,
          senha_certificado: encryptedPassword,
          ambiente,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        if (errorData?.code === '23505') {
          toast({
            title: "Certificado já existe",
            description: "Já existe um certificado para este CNPJ.",
            variant: "destructive",
          });
        } else {
          throw new Error(errorData?.message || 'Erro desconhecido ao salvar certificado');
        }
        setLoading(false);
        return;
      }

      toast({
        title: "Certificado salvo com sucesso!",
        description: `Certificado ${sanitizedNome} foi adicionado com segurança.`,
      });

      // Resetar formulário
      setNome('');
      setCnpj('');
      setCertificadoFile(null);
      setSenha('');
      setAmbiente('homologacao');
      const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
      if (fileInput) fileInput.value = '';

      onSuccess();

    } catch (error: any) {
      console.error('Erro ao salvar certificado:', error);
      toast({
        title: "Erro ao salvar certificado",
        description: error.message || "Ocorreu um erro inesperado.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleCnpjChange = (value: string) => {
    const formatted = formatCnpj(value);
    setCnpj(formatted);
  };

return (
    <Card>
      <CardHeader>
        <CardTitle>Adicionar Certificado Digital</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label htmlFor="nome">Nome do Certificado *</Label>
            <Input
              id="nome"
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              placeholder="Ex: Certificado Empresa XYZ"
              maxLength={100}
              required
            />
          </div>

          <div>
            <Label htmlFor="cnpj">CNPJ *</Label>
            <Input
              id="cnpj"
              value={cnpj}
              onChange={(e) => handleCnpjChange(e.target.value)}
              placeholder="00.000.000/0000-00"
              maxLength={18}
              required
            />
          </div>

          <div>
            <Label htmlFor="certificado">Arquivo do Certificado (.p12 ou .pfx) *</Label>
            <Input
              id="certificado"
              type="file"
              onChange={handleFileChange}
              accept=".p12,.pfx"
              required
            />
            <p className="text-sm text-muted-foreground mt-1">
              Máximo 5MB. Apenas arquivos .p12 ou .pfx são aceitos.
            </p>
          </div>

          <div>
            <Label htmlFor="senha">Senha do Certificado *</Label>
            <Input
              id="senha"
              type="password"
              value={senha}
              onChange={(e) => setSenha(e.target.value)}
              placeholder="Senha do certificado digital"
              minLength={4}
              maxLength={50}
              required
            />
            <p className="text-sm text-muted-foreground mt-1">
              A senha será criptografada antes do armazenamento.
            </p>
          </div>

          <div>
            <Label htmlFor="ambiente">Ambiente</Label>
            <Select value={ambiente} onValueChange={(value: 'producao' | 'homologacao') => setAmbiente(value)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="homologacao">Homologação</SelectItem>
                <SelectItem value="producao">Produção</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? 'Salvando...' : 'Salvar Certificado'}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
};