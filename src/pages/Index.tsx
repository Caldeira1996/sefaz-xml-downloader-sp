import React, { useState } from "react";
import axios from 'axios';
import { useAuth } from "@/components/auth/AuthProvider";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { FileText, LogOut, Search, Settings, List, Plus } from "lucide-react";

import { ConsultaForm } from "@/components/sefaz/ConsultaForm";
import { CertificadosList } from "@/components/sefaz/CertificadosList";
import { CertificadoForm } from "@/components/sefaz/CertificadoForm";
import { XmlsList } from "@/components/sefaz/XmlsList";

export default function Index() {
  const { user, loading, signOut } = useAuth();
  return <div>Usuário: {user?.email || "não logado"}</div>;

  const [certificadosTab, setCertificadosTab] = useState<"listar" | "adicionar">("listar");
  const [refreshCertificados, setRefreshCertificados] = useState(false);
  const [refreshXmls, setRefreshXmls] = useState(false);

  // dentro do componente Index
  const fetchXmls = async () => {
    try {
      const response = await axios.get('/api/xmls'); // ajuste a URL conforme sua API
      return response.data; // deve ser XmlNfe[]
    } catch (error) {
      throw new Error('Falha ao buscar XMLs');
    }
  };


  const handleConsultaIniciada = () => {
    setRefreshXmls(true);
    // reinicia para falso após renderizar
    setTimeout(() => setRefreshXmls(false), 100);
  };

  const handleCertificadoSalvo = () => {
    setRefreshCertificados(true);
    setCertificadosTab("listar");
    setTimeout(() => setRefreshCertificados(false), 100);
  };

  if (loading) {
    return <div className="p-8 text-center">Carregando...</div>;
  }

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
            <span className="text-sm text-muted-foreground">{user?.email}</span>
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
                  variant={certificadosTab === "listar" ? "default" : "ghost"}
                  size="sm"
                  onClick={() => setCertificadosTab("listar")}
                  className="flex items-center gap-2"
                >
                  <List className="h-4 w-4" />
                  Lista
                </Button>
                <Button
                  variant={certificadosTab === "adicionar" ? "default" : "ghost"}
                  size="sm"
                  onClick={() => setCertificadosTab("adicionar")}
                  className="flex items-center gap-2"
                >
                  <Plus className="h-4 w-4" />
                  Adicionar
                </Button>
              </div>
            </div>

            {certificadosTab === "listar" ? (
              <CertificadosList shouldRefresh={refreshCertificados} />
            ) : (
              <CertificadoForm onSuccess={handleCertificadoSalvo} />
            )}
          </TabsContent>

          <TabsContent value="xmls" className="space-y-6">
            <XmlsList shouldRefresh={refreshXmls} fetchXmls={fetchXmls} />
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}
