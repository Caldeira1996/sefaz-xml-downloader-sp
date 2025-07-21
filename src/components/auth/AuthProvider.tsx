import React, { createContext, useContext, useState, useEffect } from 'react';

interface AuthContextType {
  token: string | null;
  userEmail: string | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<boolean>;
  signOut: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within AuthProvider');
  return context;
};

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [token, setToken] = useState<string | null>(null);
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  // Simula carregamento inicial buscando token no localStorage
  useEffect(() => {
    const storedToken = localStorage.getItem('token');
    const storedEmail = localStorage.getItem('userEmail');
    if (storedToken) {
      setToken(storedToken);
      setUserEmail(storedEmail);
    }
    setLoading(false);
  }, []);

  // Função fake de login, só aceita email/senha fixos, por exemplo
  const signIn = async (email: string, password: string): Promise<boolean> => {
    // Aqui você pode validar contra um backend, mas vamos simular sucesso se senha == "123456"
    if (password === '123456') {
      const fakeToken = 'mock-token-123456';
      setToken(fakeToken);
      setUserEmail(email);
      localStorage.setItem('token', fakeToken);
      localStorage.setItem('userEmail', email);
      return true;
    }
    return false;
  };

  const signOut = () => {
    setToken(null);
    setUserEmail(null);
    localStorage.removeItem('token');
    localStorage.removeItem('userEmail');
  };

  return (
    <AuthContext.Provider value={{ token, userEmail, loading, signIn, signOut }}>
      {children}
    </AuthContext.Provider>
  );
};
