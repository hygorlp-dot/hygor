import { useState } from 'react';
import { signInEmail, signUpEmail } from './supabase';

const brand = {
  name: 'Ponto ArcD',
  subtitle: 'Acesso ao sistema',
  logo: '/logo-arcd.png',
};

const colors = {
  primary: '#111111',
  secondary: '#D6A84F',
  background: '#F7F2E8',
  card: '#FFFFFF',
  text: '#1C1C1C',
  muted: '#777777',
  border: '#E6DDCC',
  error: '#B42318',
  success: '#1F7A4D',
};

function friendlyError(errorMessage) {
  const msg = String(errorMessage || '').toLowerCase();

  if (msg.includes('invalid login credentials')) {
    return 'E-mail ou senha incorretos.';
  }

  if (msg.includes('email not confirmed')) {
    return 'Confirme seu e-mail antes de entrar.';
  }

  if (msg.includes('password')) {
    return 'A senha precisa ter pelo menos 6 caracteres.';
  }

  return errorMessage || 'Não foi possível concluir. Tente novamente.';
}

export default function Auth() {
  const [mode, setMode] = useState('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [message, setMessage] = useState(null);
  const [loading, setLoading] = useState(false);

  const isSignup = mode === 'signup';

  const handleSubmit = async (event) => {
    event.preventDefault();

    setLoading(true);
    setMessage(null);

    const cleanEmail = email.trim().toLowerCase();

    const result = isSignup
      ? await signUpEmail(cleanEmail, password)
      : await signInEmail(cleanEmail, password);

    setLoading(false);

    if (result.error) {
      setMessage({
        type: 'error',
        text: friendlyError(result.error.message),
      });
      return;
    }

    if (isSignup) {
      setMessage({
        type: 'success',
        text: 'Conta criada. Agora faça login.',
      });
      setMode('login');
      setPassword('');
      return;
    }

    setMessage({
      type: 'success',
      text: 'Login realizado com sucesso.',
    });
  };

  return (
    <main
      style={{
        minHeight: '100vh',
        background: colors.background,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 18,
        fontFamily: 'Arial, sans-serif',
      }}
    >
      <section
        style={{
          width: '100%',
          maxWidth: 390,
          background: colors.card,
          borderRadius: 22,
          padding: 24,
          boxShadow: '0 14px 40px rgba(0,0,0,0.10)',
          border: `1px solid ${colors.border}`,
        }}
      >
        <div style={{ textAlign: 'center', marginBottom: 24 }}>
          <img
            src={brand.logo}
            alt="Logomarca ArcD"
            style={{
              width: 96,
              height: 96,
              objectFit: 'contain',
              marginBottom: 12,
            }}
          />

          <h1
            style={{
              margin: 0,
              fontSize: 26,
              color: colors.primary,
              letterSpacing: -0.6,
            }}
          >
            {brand.name}
          </h1>

          <p
            style={{
              margin: '6px 0 0',
              color: colors.muted,
              fontSize: 14,
            }}
          >
            {brand.subtitle}
          </p>
        </div>

        <div
          style={{
            display: 'flex',
            background: '#F4EFE5',
            borderRadius: 14,
            padding: 4,
            marginBottom: 22,
          }}
        >
          <button
            type="button"
            onClick={() => {
              setMode('login');
              setMessage(null);
            }}
            style={{
              flex: 1,
              border: 0,
              borderRadius: 11,
              padding: 10,
              background: !isSignup ? colors.primary : 'transparent',
              color: !isSignup ? '#FFFFFF' : colors.primary,
              fontWeight: 700,
              cursor: 'pointer',
            }}
          >
            Entrar
          </button>

          <button
            type="button"
            onClick={() => {
              setMode('signup');
              setMessage(null);
            }}
            style={{
              flex: 1,
              border: 0,
              borderRadius: 11,
              padding: 10,
              background: isSignup ? colors.primary : 'transparent',
              color: isSignup ? '#FFFFFF' : colors.primary,
              fontWeight: 700,
              cursor: 'pointer',
            }}
          >
            Criar conta
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <label
            htmlFor="email"
            style={{
              display: 'block',
              fontSize: 13,
              fontWeight: 700,
              marginBottom: 6,
              color: colors.text,
            }}
          >
            E-mail
          </label>

          <input
            id="email"
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="seuemail@empresa.com"
            style={{
              width: '100%',
              boxSizing: 'border-box',
              padding: '14px 13px',
              borderRadius: 13,
              border: `1px solid ${colors.border}`,
              fontSize: 15,
              marginBottom: 14,
              outline: 'none',
              background: '#FFFCF7',
            }}
          />

          <label
            htmlFor="password"
            style={{
              display: 'block',
              fontSize: 13,
              fontWeight: 700,
              marginBottom: 6,
              color: colors.text,
            }}
          >
            Senha
          </label>

          <div style={{ position: 'relative', marginBottom: 18 }}>
            <input
              id="password"
              type={showPassword ? 'text' : 'password'}
              autoComplete={isSignup ? 'new-password' : 'current-password'}
              required
              minLength={6}
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="mínimo 6 caracteres"
              style={{
                width: '100%',
                boxSizing: 'border-box',
                padding: '14px 76px 14px 13px',
                borderRadius: 13,
                border: `1px solid ${colors.border}`,
                fontSize: 15,
                outline: 'none',
                background: '#FFFCF7',
              }}
            />

            <button
              type="button"
              onClick={() => setShowPassword((value) => !value)}
              style={{
                position: 'absolute',
                right: 8,
                top: 8,
                border: 0,
                background: 'transparent',
                color: colors.muted,
                fontSize: 12,
                fontWeight: 700,
                cursor: 'pointer',
                padding: 7,
              }}
            >
              {showPassword ? 'Ocultar' : 'Mostrar'}
            </button>
          </div>

          <button
            type="submit"
            disabled={loading}
            style={{
              width: '100%',
              border: 0,
              borderRadius: 14,
              padding: 15,
              background: colors.primary,
              color: '#FFFFFF',
              fontWeight: 800,
              fontSize: 15,
              cursor: loading ? 'not-allowed' : 'pointer',
              opacity: loading ? 0.72 : 1,
              boxShadow: '0 10px 24px rgba(0,0,0,0.18)',
            }}
          >
            {loading
              ? 'Processando...'
              : isSignup
                ? 'Criar conta'
                : 'Entrar no sistema'}
          </button>
        </form>

        {message && (
          <div
            style={{
              marginTop: 16,
              padding: 12,
              borderRadius: 13,
              fontSize: 13,
              lineHeight: 1.45,
              color: message.type === 'error' ? colors.error : colors.success,
              background: message.type === 'error' ? '#FFF0EE' : '#EEF8F2',
              border: `1px solid ${
                message.type === 'error' ? '#F2B8B5' : '#B8E2C8'
              }`,
            }}
          >
            {message.text}
          </div>
        )}

        <p
          style={{
            margin: '18px 0 0',
            color: colors.muted,
            fontSize: 12,
            textAlign: 'center',
            lineHeight: 1.45,
          }}
        >
          Acesso exclusivo por e-mail e senha.
        </p>
      </section>
    </main>
  );
}
}
