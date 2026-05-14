import { useState } from 'react';
import { signInEmail, signUpEmail } from './supabase';

const BRAND = {
  name: 'Ponto ArcD',
  company: 'ArcD Obras',
  subtitle: 'Gestão de pessoas, obras e frequência',
  slogan: 'Controle sua equipe de obra com mais segurança, clareza e velocidade.',
};

const colors = {
  dark: '#111317',
  dark2: '#1C1F26',
  gold: '#D6A84F',
  gold2: '#F3D68B',
  cream: '#F7F2E8',
  muted: '#7B7F8A',
  border: '#E8DDC8',
  white: '#FFFFFF',
  error: '#B42318',
  success: '#1F7A4D',
};

const styles = {
  page: {
    minHeight: '100vh',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    fontFamily: 'Inter, Arial, sans-serif',
    background:
      'radial-gradient(circle at top left, rgba(214,168,79,0.28), transparent 34%), linear-gradient(135deg, #111317 0%, #1C1F26 48%, #F7F2E8 48%, #F7F2E8 100%)',
  },
  shell: {
    width: '100%',
    maxWidth: 1080,
    display: 'flex',
    flexWrap: 'wrap',
    background: 'rgba(255,255,255,0.94)',
    borderRadius: 28,
    overflow: 'hidden',
    boxShadow: '0 24px 80px rgba(0,0,0,0.24)',
    border: '1px solid rgba(255,255,255,0.42)',
  },
  brandPanel: {
    flex: '1 1 430px',
    minHeight: 560,
    padding: 42,
    color: colors.white,
    background:
      'linear-gradient(160deg, rgba(17,19,23,0.98), rgba(28,31,38,0.96)), radial-gradient(circle at top right, rgba(214,168,79,0.35), transparent 36%)',
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'space-between',
  },
  brandTop: {
    display: 'flex',
    alignItems: 'center',
    gap: 14,
  },
  logo: {
    width: 54,
    height: 54,
    borderRadius: 18,
    background: `linear-gradient(135deg, ${colors.gold}, ${colors.gold2})`,
    color: colors.dark,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontWeight: 900,
    fontSize: 20,
    letterSpacing: -1,
    boxShadow: '0 12px 30px rgba(214,168,79,0.28)',
  },
  brandName: {
    margin: 0,
    fontSize: 23,
    letterSpacing: -0.6,
  },
  brandCompany: {
    margin: '3px 0 0',
    color: 'rgba(255,255,255,0.64)',
    fontSize: 13,
    textTransform: 'uppercase',
    letterSpacing: 1.6,
  },
  heroTitle: {
    margin: '56px 0 12px',
    fontSize: 42,
    lineHeight: 1.05,
    letterSpacing: -1.5,
    maxWidth: 460,
  },
  heroText: {
    margin: 0,
    color: 'rgba(255,255,255,0.72)',
    fontSize: 17,
    lineHeight: 1.6,
    maxWidth: 460,
  },
  stats: {
    display: 'grid',
    gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
    gap: 12,
    marginTop: 34,
  },
  statCard: {
    padding: 16,
    borderRadius: 18,
    background: 'rgba(255,255,255,0.08)',
    border: '1px solid rgba(255,255,255,0.12)',
  },
  statValue: {
    display: 'block',
    color: colors.gold2,
    fontWeight: 800,
    fontSize: 19,
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.68)',
  },
  footerText: {
    marginTop: 42,
    fontSize: 13,
    color: 'rgba(255,255,255,0.52)',
  },
  formPanel: {
    flex: '1 1 380px',
    padding: 42,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: colors.cream,
  },
  card: {
    width: '100%',
    maxWidth: 420,
    background: colors.white,
    padding: 34,
    borderRadius: 24,
    border: `1px solid ${colors.border}`,
    boxShadow: '0 18px 50px rgba(17,19,23,0.10)',
  },
  pill: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 8,
    padding: '8px 12px',
    borderRadius: 999,
    background: '#FFF8E7',
    color: '#7A5B19',
    border: '1px solid #F0DCA8',
    fontSize: 12,
    fontWeight: 700,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  title: {
    margin: '22px 0 8px',
    fontSize: 30,
    lineHeight: 1.1,
    color: colors.dark,
    letterSpacing: -0.8,
  },
  desc: {
    margin: '0 0 26px',
    color: colors.muted,
    fontSize: 15,
    lineHeight: 1.5,
  },
  label: {
    display: 'block',
    fontSize: 13,
    fontWeight: 800,
    color: colors.dark2,
    marginBottom: 7,
  },
  input: {
    width: '100%',
    boxSizing: 'border-box',
    padding: '13px 14px',
    borderRadius: 14,
    border: `1px solid ${colors.border}`,
    background: '#FFFCF7',
    color: colors.dark,
    outline: 'none',
    fontSize: 15,
    marginBottom: 16,
  },
  passwordWrap: {
    position: 'relative',
  },
  showButton: {
    position: 'absolute',
    right: 8,
    top: 8,
    border: 0,
    background: 'transparent',
    color: colors.muted,
    cursor: 'pointer',
    padding: '6px 8px',
    fontSize: 12,
    fontWeight: 700,
  },
  primaryButton: {
    width: '100%',
    padding: '14px 16px',
    border: 0,
    borderRadius: 16,
    background: `linear-gradient(135deg, ${colors.dark}, ${colors.dark2})`,
    color: colors.white,
    cursor: 'pointer',
    fontWeight: 900,
    fontSize: 15,
    boxShadow: '0 14px 32px rgba(17,19,23,0.22)',
  },
  secondaryButton: {
    width: '100%',
    padding: '12px 16px',
    marginTop: 14,
    border: `1px solid ${colors.border}`,
    borderRadius: 16,
    background: '#FFFCF7',
    color: colors.dark,
    cursor: 'pointer',
    fontWeight: 800,
    fontSize: 14,
  },
  message: {
    marginTop: 18,
    padding: 12,
    borderRadius: 14,
    fontSize: 13,
    lineHeight: 1.45,
  },
  small: {
    margin: '18px 0 0',
    color: colors.muted,
    fontSize: 12,
    lineHeight: 1.45,
  },
};

function friendlyError(errorMessage) {
  const msg = String(errorMessage || '').toLowerCase();

  if (msg.includes('invalid login credentials')) {
    return 'E-mail ou senha incorretos. Confira os dados e tente novamente.';
  }

  if (msg.includes('email not confirmed')) {
    return 'Este e-mail ainda não foi confirmado. Verifique sua caixa de entrada.';
  }

  if (msg.includes('password')) {
    return 'A senha precisa ter pelo menos 6 caracteres.';
  }

  if (msg.includes('rate limit')) {
    return 'Muitas tentativas em pouco tempo. Aguarde alguns minutos e tente novamente.';
  }

  return errorMessage || 'Não foi possível concluir a operação. Tente novamente.';
}

export default function Auth() {
  const [mode, setMode] = useState('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [message, setMessage] = useState(null);
  const [loading, setLoading] = useState(false);

  const isSignup = mode === 'signup';

  const handleEmailAuth = async (event) => {
    event.preventDefault();

    const cleanEmail = email.trim().toLowerCase();

    setLoading(true);
    setMessage(null);

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
        text: 'Conta criada com sucesso. Se a confirmação de e-mail estiver ativa no Supabase, confirme o e-mail antes de entrar.',
      });
      setMode('login');
      setPassword('');
      return;
    }

    setMessage({
      type: 'success',
      text: 'Login realizado com sucesso. Carregando o painel...',
    });
  };

  const toggleMode = () => {
    setMode(isSignup ? 'login' : 'signup');
    setMessage(null);
    setPassword('');
  };

  return (
    <main style={styles.page}>
      <section style={styles.shell}>
        <aside style={styles.brandPanel}>
          <div>
            <div style={styles.brandTop}>
              <div style={styles.logo}>A</div>
              <div>
                <h1 style={styles.brandName}>{BRAND.name}</h1>
                <p style={styles.brandCompany}>{BRAND.company}</p>
              </div>
            </div>

            <h2 style={styles.heroTitle}>{BRAND.slogan}</h2>
            <p style={styles.heroText}>
              Acompanhe funcionários, obras, presença, status e movimentações em um painel único para sua rotina de construtora.
            </p>

            <div style={styles.stats}>
              <div style={styles.statCard}>
                <span style={styles.statValue}>RH</span>
                <span style={styles.statLabel}>cadastros e vínculos</span>
              </div>
              <div style={styles.statCard}>
                <span style={styles.statValue}>Ponto</span>
                <span style={styles.statLabel}>frequência por obra</span>
              </div>
              <div style={styles.statCard}>
                <span style={styles.statValue}>Gestão</span>
                <span style={styles.statLabel}>controle em tempo real</span>
              </div>
            </div>
          </div>

          <p style={styles.footerText}>
            Sistema interno protegido por login individual. Cada conta acessa seus próprios dados no Supabase.
          </p>
        </aside>

        <section style={styles.formPanel}>
          <div style={styles.card}>
            <span style={styles.pill}>
              {isSignup ? 'Novo acesso' : 'Acesso restrito'}
            </span>

            <h2 style={styles.title}>
              {isSignup ? 'Criar conta' : 'Entrar no painel'}
            </h2>

            <p style={styles.desc}>
              {isSignup
                ? 'Cadastre um e-mail e uma senha para acessar o Ponto ArcD.'
                : 'Informe suas credenciais para continuar para o sistema.'}
            </p>

            <form onSubmit={handleEmailAuth}>
              <label style={styles.label} htmlFor="email">
                E-mail
              </label>
              <input
                id="email"
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="seuemail@empresa.com"
                style={styles.input}
              />

              <label style={styles.label} htmlFor="password">
                Senha
              </label>
              <div style={styles.passwordWrap}>
                <input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete={isSignup ? 'new-password' : 'current-password'}
                  required
                  minLength={6}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="mínimo 6 caracteres"
                  style={{ ...styles.input, paddingRight: 78 }}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((value) => !value)}
                  style={styles.showButton}
                >
                  {showPassword ? 'Ocultar' : 'Mostrar'}
                </button>
              </div>

              <button
                type="submit"
                disabled={loading}
                style={{
                  ...styles.primaryButton,
                  opacity: loading ? 0.72 : 1,
                  cursor: loading ? 'not-allowed' : 'pointer',
                }}
              >
                {loading
                  ? 'Processando...'
                  : isSignup
                    ? 'Criar minha conta'
                    : 'Entrar no sistema'}
              </button>
            </form>

            <button type="button" onClick={toggleMode} style={styles.secondaryButton}>
              {isSignup
                ? 'Já tenho conta. Fazer login'
                : 'Não tenho conta. Criar conta'}
            </button>

            {message && (
              <div
                style={{
                  ...styles.message,
                  color: message.type === 'error' ? colors.error : colors.success,
                  background: message.type === 'error' ? '#FFF0EE' : '#EEF8F2',
                  border: `1px solid ${message.type === 'error' ? '#F2B8B5' : '#B8E2C8'}`,
                }}
              >
                {message.text}
              </div>
            )}

            <p style={styles.small}>
              Acesso exclusivo por e-mail e senha. O login com Gmail/Google não foi incluído.
            </p>
          </div>
        </section>
      </section>
    </main>
  );
}
