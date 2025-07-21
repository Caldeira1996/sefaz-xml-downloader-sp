import React from "react";
import { useAuth } from "@/components/auth/AuthProvider";

export default function Index() {
  const { user, loading } = useAuth();

  if (loading) {
    return <div>Carregando...</div>;
  }

  return (
    <div className="p-4">
      {user ? (
        <h1>Olá, {user.email}! Bem-vindo(a) ao sistema.</h1>
      ) : (
        <h1>Você não está logado. Por favor, faça login.</h1>
      )}
    </div>
  );
}
