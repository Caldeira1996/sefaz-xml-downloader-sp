import React, { useState } from 'react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';

export const LoginForm = () => {
  const [isSignUp, setIsSignUp] = useState(false);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  // Simula API de login
  const fakeApiLogin = (email: string, password: string): Promise<{ token: string }> => {
    return new Promise((resolve, reject) => {
      setTimeout(() => {
        if (email === 'admin@example.com' && password === '123456') {
          resolve({ token: 'fake-jwt-token' });
        } else {
          reject(new Error('Credenciais inválidas'));
        }
      }, 1000);
    });
  };

  // Simula API de cadastro
  const fakeApiSignUp = (email: string, password: string): Promise<{ token: string }> => {
    return new Promise((resolve, reject) => {
      setTimeout(() => {
        if (password.length >= 6) {
          resolve({ token: 'fake-jwt-token' });
        } else {
          reject(new Error('Senha muito curta'));
        }
      }, 1000);
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      if (isSignUp) {
        await fakeApiSignUp(email, password);
        alert('Cadastro realizado com sucesso!');
      } else {
        await fakeApiLogin(email, password);
        alert('Login realizado com sucesso!');
      }
      // Aqui você pode fazer algo após login/cadastro, tipo resetar formulário
      setEmail('');
      setPassword('');
    } catch (error: any) {
      alert(error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>XML PRO - SEFAZ SP</CardTitle>
          <CardDescription>
            {isSignUp ? 'Criar nova conta' : 'Acesse sua conta'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <Input
                type="email"
                placeholder="Email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                maxLength={255}
                required
              />
            </div>
            <div>
              <Input
                type="password"
                placeholder="Senha (mínimo 6 caracteres)"
                value={password}
                onChange={e => setPassword(e.target.value)}
                minLength={6}
                maxLength={128}
                required
              />
            </div>
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? 'Carregando...' : (isSignUp ? 'Cadastrar' : 'Entrar')}
            </Button>
            <Button
              type="button"
              variant="ghost"
              className="w-full"
              onClick={() => setIsSignUp(!isSignUp)}
              disabled={loading}
            >
              {isSignUp ? 'Já tem conta? Entrar' : 'Não tem conta? Cadastrar'}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
};

export default LoginForm;
