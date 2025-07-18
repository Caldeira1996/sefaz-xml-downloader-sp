
import React, { useState } from 'react';
import { useAuth } from '@/components/auth/AuthProvider';
import { LoginForm } from '@/components/auth/LoginForm';
import { CertificadoForm } from '@/components/sefaz/CertificadoForm';
import { CertificadosList } from '@/components/sefaz/CertificadosList';
import { ConsultaForm } from '@/components/sefaz/ConsultaForm';
import { XmlsList } from '@/components/sefaz/XmlsList';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { LogOut, FileText, Settings, Search, Plus, List } from 'lucide-react';

const Index = () => {
  const { user, loading, signOut } = useAuth();
  const [refreshXmls, setRefreshXmls] = useState(false);
  const [refreshCertificados, setRefreshCertificados] = useState(false);
  const [certificadosTab, setCertificadosTab] = useState<'adicionar' | 'listar'>('listar');

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Carregando...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return <LoginForm />;
  }

  const handleConsultaIniciada = () => {
    setRefreshXmls(!refreshXmls);
  };

  const handleCertificadoSalvo = () => {
    setRefreshCertificados(!refreshCertificados);
    setCertificadosTab('listar');
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b bg-card">
        <div className="container mx-auto px-4 py-4 flex justify-between items-center">
          <div className="flex items-center gap-2">
            <FileText className="h-6 w-6 text-primary" />
            <h1 className="text-xl font-bold">XML PRO - SEFAZ SP</h1>
          </div>
          <div className="flex items-center gap-4">
            <span className="text-sm text-muted-foreground">{user.email}</span>
            <Button variant="outline" size="sm" onClick={signOut}>
              <LogOut className="h-4 w-4 mr-2" />
              Sair
            </Button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-8">
        <Tabs defaultValue="consulta" className="space-y-6">
          <TabsList className="grid grid-cols-3 w-full max-w-md mx-auto">
            <TabsTrigger value="consulta" className="flex items-center gap-2">
              <Search className="h-4 w-4" />
              Consulta
            </TabsTrigger>
            <TabsTrigger value="certificados" className="flex items-center gap-2">
              <Settings className="h-4 w-4" />
              Certificados
            </TabsTrigger>
            <TabsTrigger value="xmls" className="flex items-center gap-2">
              <FileText className="h-4 w-4" />
              XMLs
            </TabsTrigger>
          </TabsList>

          <TabsContent value="consulta" className="space-y-6">
            <ConsultaForm onConsultaIniciada={handleConsultaIniciada} />
          </TabsContent>

          <TabsContent value="certificados" className="space-y-6">
            <div className="flex justify-center mb-4">
              <div className="inline-flex rounded-lg border p-1">
                <Button
                  variant={certificadosTab === 'listar' ? 'default' : 'ghost'}
                  size="sm"
                  onClick={() => setCertificadosTab('listar')}
                  className="flex items-center gap-2"
                >
                  <List className="h-4 w-4" />
                  Lista
                </Button>
                <Button
                  variant={certificadosTab === 'adicionar' ? 'default' : 'ghost'}
                  size="sm"
                  onClick={() => setCertificadosTab('adicionar')}
                  className="flex items-center gap-2"
                >
                  <Plus className="h-4 w-4" />
                  Adicionar
                </Button>
              </div>
            </div>

            {certificadosTab === 'listar' ? (
              <CertificadosList shouldRefresh={refreshCertificados} />
            ) : (
              <CertificadoForm onSuccess={handleCertificadoSalvo} />
            )}
          </TabsContent>

          <TabsContent value="xmls" className="space-y-6">
            <XmlsList shouldRefresh={refreshXmls} />
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
};

export default Index;
