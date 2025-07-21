import React, { useState } from 'react';
import { useAuth } from './AuthProvider';

export const LoginForm = () => {
  const { signIn } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const { token } = await fakeApiLogin(email, password);
      signIn(email, token);
    } catch (error: any) {
      alert(error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} style={{ maxWidth: 320, margin: 'auto', padding: 20 }}>
      <input
        type="email"
        placeholder="Email"
        value={email}
        onChange={e => setEmail(e.target.value)}
        required
        style={{ width: '100%', marginBottom: 12, padding: 8 }}
      />
      <input
        type="password"
        placeholder="Senha"
        value={password}
        onChange={e => setPassword(e.target.value)}
        required
        style={{ width: '100%', marginBottom: 12, padding: 8 }}
      />
      <button type="submit" disabled={loading} style={{ width: '100%', padding: 10 }}>
        {loading ? 'Entrando...' : 'Entrar'}
      </button>
    </form>
  );
};
