import { useState } from 'react';
import { signInEmail, signUpEmail } from './supabase';

const C = {
  bg: '#111317',
  bg2: '#1C1F26',
  yellow: '#D6A84F',
  yellowD: '#B8892E',
  white: '#FFFFFF',
  mutedWhite: 'rgba(255,255,255,0.68)',
  borderDark: 'rgba(255,255,255,0.16)',
  inputBg: 'rgba(255,255,255,0.06)',
  error: '#FFB4AB',
  success: '#B8E2C8',
};

const font = "'Barlow Condensed', Arial, sans-serif";

function BrandMark({ size = 86 }) {
  const [logoError, setLogoError] = useState(false);

  if (logoError) {
    return (
      <div
        style={{
          width: size,
          height: size,
          background: C.yellow,
          color: C.bg,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontFamily: font,
          fontWeight: 900,
          fontSize: size * 0.44,
          letterSpacing: -0.5,
          margin: '0 auto',
        }}
      >
        A
      </div>
    );
  }

  return (
    <img
      src="/logo-arcd.png"
      alt="Logomarca ArcD"
      onError={() => setLogoError(true)}
      style={{
        width: size,
        height: size,
        objectFit: 'contain',
        display: 'block',
        margin: '0 auto',
      }}
    />
  );
}

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
        background: C.bg,
        color: C.white,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 18,
        fontFamily: font,
      }}
    >
      <section
        style={{
          width: '100%',
          maxWidth: 390,
          background: C.bg2,
          border: `1px solid ${C.borderDark}`,
          padding: 24,
          boxShadow: '0 18px 44px rgba(0,0,0,0.32)',
        }}
      >
        <div style={{ textAlign: 'center', marginBottom: 24 }}>
          <BrandMark size={92} />

          <h1
            style={{
              margin: '16px 0 4px',
              fontSize: 32,
              color: C.white,
              fontWeight: 900,
              textTransform: 'uppercase',
              letterSpacing: 0.8,
              lineHeight: 1,
            }}
          >
            Ponto ArcD
          </h1>

          <p
            style={{
              margin: 0,
              color: C.mutedWhite,
              fontSize: 15,
              letterSpacing: 0.5,
              textTransform: 'uppercase',
            }}
          >
            Gestão de pessoas e obras
          </p>
        </div>

        <div
          style={{
            display: 'flex',
            border: `1px solid ${C.borderDark}`,
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
              padding: 12,
              background: !isSignup ? C.yellow : 'transparent',
              color: !isSignup ? C.bg : C.white,
              fontFamily: font,
              fontWeight: 900,
              fontSize: 15,
              textTransform: 'uppercase',
              letterSpacing: 0.6,
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
              padding: 12,
              background: isSignup ? C.yellow : 'transparent',
              color: isSignup ? C.bg : C.white,
              fontFamily: font,
              fontWeight: 900,
              fontSize: 15,
              textTransform: 'uppercase',
              letterSpacing: 0.6,
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
              fontSize: 15,
              fontWeight: 900,
              marginBottom: 6,
              color: C.white,
              textTransform: 'uppercase',
              letterSpacing: 0.5,
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
              padding: '13px 12px',
              border: `1px solid ${C.borderDark}`,
              fontSize: 16,
              marginBottom: 14,
              outline: 'none',
              background: C.inputBg,
              color: C.white,
              fontFamily: font,
              letterSpacing: 0.4,
            }}
          />

          <label
            htmlFor="password"
            style={{
              display: 'block',
              fontSize: 15,
              fontWeight: 900,
              marginBottom: 6,
              color: C.white,
              textTransform: 'uppercase',
              letterSpacing: 0.5,
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
                padding: '13px 76px 13px 12px',
                border: `1px solid ${C.borderDark}`,
                fontSize: 16,
                outline: 'none',
                background: C.inputBg,
                color: C.white,
                fontFamily: font,
                letterSpacing: 0.4,
              }}
            />

            <button
              type="button"
              onClick={() => setShowPassword((value) => !value)}
              style={{
                position: 'absolute',
                right: 8,
                top: 7,
                border: 0,
                background: 'transparent',
                color: C.yellow,
                fontFamily: font,
                fontSize: 13,
                fontWeight: 900,
                textTransform: 'uppercase',
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
              padding: 14,
              background: `linear-gradient(135deg, ${C.yellow}, ${C.yellowD})`,
              color: C.bg,
              fontFamily: font,
              fontWeight: 900,
              fontSize: 17,
              textTransform: 'uppercase',
              letterSpacing: 0.7,
              cursor: loading ? 'not-allowed' : 'pointer',
              opacity: loading ? 0.72 : 1,
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
              fontSize: 15,
              lineHeight: 1.35,
              color: message.type === 'error' ? C.error : C.success,
              background:
                message.type === 'error'
                  ? 'rgba(255,180,171,0.10)'
                  : 'rgba(184,226,200,0.10)',
              border: `1px solid ${
                message.type === 'error'
                  ? 'rgba(255,180,171,0.35)'
                  : 'rgba(184,226,200,0.35)'
              }`,
              fontFamily: font,
              letterSpacing: 0.4,
            }}
          >
            {message.text}
          </div>
        )}

        <p
          style={{
            margin: '18px 0 0',
            color: C.mutedWhite,
            fontSize: 13,
            textAlign: 'center',
            lineHeight: 1.35,
            letterSpacing: 0.4,
          }}
        >
          Acesso exclusivo por e-mail e senha.
        </p>
      </section>
    </main>
  );
}
