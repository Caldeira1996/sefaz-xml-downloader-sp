import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/components/auth/AuthProvider';

export const CertificadoForm = ({ onSuccess }: { onSuccess: () => void }) => {
  const [nome, setNome] = useState('');
  const [cnpj, setCnpj] = useState('');
  const [certificadoFile, setCertificadoFile] = useState<File | null>(null);
  const [senha, setSenha] = useState('');
  const [ambiente, setAmbiente] = useState<'producao' | 'homologacao'>('homologacao');
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();
  const { user } = useAuth();

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setCertificadoFile(file);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !certificadoFile) return;

    setLoading(true);

    try {
      // Converter certificado para base64
      const reader = new FileReader();
      const base64Promise = new Promise<string>((resolve, reject) => {
        reader.onload = () => {
          const result = reader.result as string;
          const base64 = result.split(',')[1]; // Remove data:*/*;base64, prefix
          resolve(base64);
        };
        reader.onerror = reject;
      });
      
      reader.readAsDataURL(certificadoFile);
      const certificadoBase64 = await base64Promise;

      // Salvar certificado no banco
      const { error } = await supabase
        .from('certificados')
        .insert({
          user_id: user.id,
          nome,
          cnpj: cnpj.replace(/\D/g, ''), // Remove caracteres não numéricos
          certificado_base64: certificadoBase64,
          senha_certificado: senha, // Em produção, criptografar a senha
          ambiente
        });

      if (error) throw error;

      toast({
        title: "Certificado salvo com sucesso!",
        description: `Certificado ${nome} foi adicionado.`,
      });

      // Limpar formulário
      setNome('');
      setCnpj('');
      setCertificadoFile(null);
      setSenha('');
      setAmbiente('homologacao');
      
      onSuccess();
    } catch (error: any) {
      toast({
        title: "Erro ao salvar certificado",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const formatCnpj = (value: string) => {
    const numbers = value.replace(/\D/g, '');
    return numbers.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, '$1.$2.$3/$4-$5');
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Adicionar Certificado Digital</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label htmlFor="nome">Nome do Certificado</Label>
            <Input
              id="nome"
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              placeholder="Ex: Certificado Empresa XYZ"
              required
            />
          </div>

          <div>
            <Label htmlFor="cnpj">CNPJ</Label>
            <Input
              id="cnpj"
              value={formatCnpj(cnpj)}
              onChange={(e) => setCnpj(e.target.value)}
              placeholder="00.000.000/0000-00"
              maxLength={18}
              required
            />
          </div>

          <div>
            <Label htmlFor="certificado">Arquivo do Certificado (.p12 ou .pfx)</Label>
            <Input
              id="certificado"
              type="file"
              onChange={handleFileChange}
              accept=".p12,.pfx"
              required
            />
          </div>

          <div>
            <Label htmlFor="senha">Senha do Certificado</Label>
            <Input
              id="senha"
              type="password"
              value={senha}
              onChange={(e) => setSenha(e.target.value)}
              placeholder="Senha do certificado digital"
              required
            />
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