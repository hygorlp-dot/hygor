import { useState } from 'react';
import { signInEmail, signUpEmail } from './supabase';

export default function Auth() {
  const [mode, setMode] = useState('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);

  const handleEmailAuth = async (event) => {
    event.preventDefault();

    setLoading(true);
    setMessage('');

    const result =
      mode === 'login'
        ? await signInEmail(email, password)
        : await signUpEmail(email, password);

    setLoading(false);

    if (result.error) {
      setMessage(result.error.message);
      return;
    }

    if (mode === 'signup') {
      setMessage('Conta criada com sucesso. Agora faça login.');
      setMode('login');
    } else {
      setMessage('Login realizado com sucesso.');
    }
  };

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: '#f5f5f5',
      fontFamily: 'Arial, sans-serif'
    }}>
      <div style={{
        width: '100%',
        maxWidth: 420,
        background: '#fff',
        padding: 32,
        borderRadius: 12,
        boxShadow: '0 10px 30px rgba(0,0,0,0.08)'
      }}>
        <h1 style={{ marginBottom: 8 }}>ArcD Ponto PRO</h1>

        <p style={{ marginBottom: 24, color: '#666' }}>
          {mode === 'login' ? 'Entre com seu e-mail e senha' : 'Crie sua conta'}
        </p>

        <form onSubmit={handleEmailAuth}>
          <label>E-mail</label>
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            style={{
              width: '100%',
              padding: 12,
              marginTop: 6,
              marginBottom: 14,
              borderRadius: 8,
              border: '1px solid #ccc'
            }}
          />

          <label>Senha</label>
          <input
            type="password"
            required
            minLength={6}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            style={{
              width: '100%',
              padding: 12,
              marginTop: 6,
              marginBottom: 18,
              borderRadius: 8,
              border: '1px solid #ccc'
            }}
          />

          <button
            type="submit"
            disabled={loading}
            style={{
              width: '100%',
              padding: 12,
              border: 0,
              borderRadius: 8,
              background: '#111',
              color: '#fff',
              cursor: 'pointer',
              fontWeight: 'bold'
            }}
          >
            {loading
              ? 'Aguarde...'
              : mode === 'login'
                ? 'Entrar'
                : 'Criar conta'}
          </button>
        </form>

        <button
          onClick={() => {
            setMode(mode === 'login' ? 'signup' : 'login');
            setMessage('');
          }}
          style={{
            width: '100%',
            padding: 10,
            marginTop: 14,
            border: 0,
            background: 'transparent',
            cursor: 'pointer',
            color: '#333'
          }}
        >
          {mode === 'login'
            ? 'Não tenho conta. Criar conta'
            : 'Já tenho conta. Fazer login'}
        </button>

        {message && (
          <p style={{ marginTop: 16, color: '#444' }}>
            {message}
          </p>
        )}
      </div>
    </div>
  );
}
