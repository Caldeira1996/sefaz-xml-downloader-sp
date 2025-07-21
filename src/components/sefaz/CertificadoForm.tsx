'use client';

import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { toast } from '@/components/ui/use-toast';
import { encryptPassword } from '@/lib/crypto';
import { createClient } from '@/utils/supabase/client';
import { useUser } from '@/hooks/useUser';

export function CertificateManager({ onSuccess }: { onSuccess: () => void }) {
  const supabase = createClient();
  const { user } = useUser();

  const [nome, setNome] = useState('');
  const [cnpj, setCnpj] = useState('');
  const [senha, setSenha] = useState('');
  const [ambiente, setAmbiente] = useState<'producao' | 'homologacao'>('homologacao');
  const [certificadoFile, setCertificadoFile] = useState<File | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (!user?.id) {
      toast({ title: 'Erro', description: 'Usuário não autenticado.' });
      return;
    }

    if (!certificadoFile || !senha || !nome || !cnpj) {
      toast({ title: 'Erro', description: 'Todos os campos são obrigatórios.' });
      return;
    }

    try {
      const reader = new FileReader();
      const base64Promise = new Promise<string>((resolve, reject) => {
        reader.onload = () => resolve((reader.result as string).split(',')[1]);
        reader.onerror = reject;
        reader.readAsDataURL(certificadoFile);
      });

      const certificadoBase64 = await base64Promise;
      const encryptedPassword = await encryptPassword(senha);
      const sanitizedCnpj = cnpj.replace(/\D/g, '');
      const sanitizedNome = nome.trim();
      const sanitizedSenha = senha.trim();

      const { error } = await supabase.from('certificados').insert({
        user_id: user.id,
        nome: sanitizedNome,
        cnpj: sanitizedCnpj,
        certificado_base64: certificadoBase64,
        senha_certificado: encryptedPassword,
        ambiente
      });

      if (error) {
        toast({ title: 'Erro ao salvar certificado', description: error.message });
        return;
      }

      toast({
        title: 'Certificado salvo com sucesso!',
        description: `Certificado ${sanitizedNome} foi adicionado com segurança.`,
      });

      setNome('');
      setCnpj('');
      setSenha('');
      setAmbiente('homologacao');
      setCertificadoFile(null);
      const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
      if (fileInput) fileInput.value = '';

      onSuccess();

      // Envia certificado para o backend
      const binaryBuffer = Uint8Array.from(atob(certificadoBase64), c => c.charCodeAt(0));
      const blob = new Blob([binaryBuffer], { type: 'application/x-pkcs12' });

      const backendFormData = new FormData();
      backendFormData.append('file', blob, `${sanitizedCnpj}.pfx`);
      backendFormData.append('senha', sanitizedSenha);
      backendFormData.append('nome', sanitizedNome);

      await fetch(`${process.env.NEXT_PUBLIC_BACKEND_URL || 'https://www.xmlprodownloader.com.br'}/upload-cert`, {
        method: 'POST',
        body: backendFormData,
      });

    } catch (err: any) {
      toast({ title: 'Erro', description: 'Falha ao processar o certificado.' });
      console.error(err);
    }
  }

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="outline">Adicionar Certificado</Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Adicionar Certificado Digital</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label>Nome</Label>
            <Input value={nome} onChange={(e) => setNome(e.target.value)} required />
          </div>
          <div>
            <Label>CNPJ</Label>
            <Input value={cnpj} onChange={(e) => setCnpj(e.target.value)} required />
          </div>
          <div>
            <Label>Senha do Certificado</Label>
            <Input type="password" value={senha} onChange={(e) => setSenha(e.target.value)} required />
          </div>
          <div>
            <Label>Arquivo (.pfx)</Label>
            <Input type="file" accept=".pfx,.p12" onChange={(e) => setCertificadoFile(e.target.files?.[0] || null)} required />
          </div>
          <div>
            <Label>Ambiente</Label>
            <select value={ambiente} onChange={(e) => setAmbiente(e.target.value as 'producao' | 'homologacao')} className="w-full p-2 border rounded">
              <option value="homologacao">Homologação</option>
              <option value="producao">Produção</option>
            </select>
          </div>
          <div className="pt-4">
            <Button type="submit" className="w-full">Salvar Certificado</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
