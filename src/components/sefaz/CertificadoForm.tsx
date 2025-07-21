'use client'; 

import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
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
  const { user } = useAuth();

  const buffer = Uint8Array.from(atob(certificadoBase64), c => c.charCodeAt(0));
  const blob = new Blob([buffer], { type: 'application/x-pkcs12' });

  const validateCertificateFile = (file: File): boolean => {
    // Verificar extensão
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

    // Verificar tamanho (máximo 5MB)
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
      e.target.value = ''; // Limpar input
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !certificadoFile) return;

    // Validações de entrada
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
      // Criptografar senha antes de armazenar
      const encryptedPassword = await encryptPassword(sanitizedSenha);

      // Converter certificado para base64
      const reader = new FileReader();
      const base64Promise = new Promise<string>((resolve, reject) => {
        reader.onload = () => {
          const result = reader.result as string;
          const base64 = result.split(',')[1]; // Remove data:*/*;base64, prefix
          resolve(base64);
        };
        reader.onerror = () => reject(new Error('Erro ao ler arquivo'));
      });
      
      reader.readAsDataURL(certificadoFile);
      const certificadoBase64 = await base64Promise;

      // Salvar certificado no banco com senha criptografada
      const { error } = await supabase
        .from('certificados')
        .insert({
          user_id: user.id,
          nome: sanitizedNome,
          cnpj: sanitizedCnpj,
          certificado_base64: certificadoBase64,
          senha_certificado: encryptedPassword, // Senha criptografada
          ambiente
        });

      if (error) {
        if (error.code === '23505') { // Unique constraint violation
          toast({
            title: "Certificado já existe",
            description: "Já existe um certificado para este CNPJ.",
            variant: "destructive",
          });
        } else {
          throw error;
        }
      } else {
        toast({
          title: "Certificado salvo com sucesso!",
          description: `Certificado ${sanitizedNome} foi adicionado com segurança.`,
        });

        // Limpar formulário
        setNome('');
        setCnpj('');
        setCertificadoFile(null);
        setSenha('');
        setAmbiente('homologacao');
        
        // Reset file input
        const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
        if (fileInput) fileInput.value = '';
        
        onSuccess();
      }
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

    // envia para o backend
      const backendFormData = new FormData();
      backendFormData.append('file', blob, `${sanitizedCnpj}.pfx`);
      backendFormData.append('senha', sanitizedSenha);
      backendFormData.append('nome', sanitizedNome);

      await fetch(`${process.env.NEXT_PUBLIC_BACKEND_URL || 'https://www.xmlprodownloader.com.br'}/upload-cert`, {
        method: 'POST',
        body: backendFormData,
      });
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
