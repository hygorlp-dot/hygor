import { useEffect, useState } from 'react';
import Auth from './Auth';
import { getCurrentUser, onAuthStateChange, logout } from './supabase';

const colors = {
  dark: '#111317',
  dark2: '#1C1F26',
  gold: '#D6A84F',
  gold2: '#F3D68B',
  cream: '#F7F2E8',
  border: '#E8DDC8',
  muted: '#7B7F8A',
  white: '#FFFFFF',
};

const styles = {
  loadingPage: {
    minHeight: '100vh',
    display: 'grid',
    placeItems: 'center',
    background: colors.cream,
    fontFamily: 'Inter, Arial, sans-serif',
    color: colors.dark,
  },
  loadingCard: {
    padding: 28,
    borderRadius: 22,
    background: colors.white,
    border: `1px solid ${colors.border}`,
    boxShadow: '0 18px 50px rgba(17,19,23,0.10)',
    textAlign: 'center',
  },
  header: {
    position: 'sticky',
    top: 0,
    zIndex: 50,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 18,
    padding: '12px 20px',
    background: 'rgba(255,255,255,0.92)',
    backdropFilter: 'blur(14px)',
    borderBottom: `1px solid ${colors.border}`,
    boxShadow: '0 8px 30px rgba(17,19,23,0.06)',
    fontFamily: 'Inter, Arial, sans-serif',
  },
  brand: {
    display: 'flex',
    alignItems: 'center',
    gap: 12,
    minWidth: 0,
  },
  logo: {
    width: 42,
    height: 42,
    borderRadius: 15,
    background: `linear-gradient(135deg, ${colors.gold}, ${colors.gold2})`,
    color: colors.dark,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontWeight: 900,
    fontSize: 17,
    boxShadow: '0 10px 24px rgba(214,168,79,0.22)',
  },
  brandTitle: {
    margin: 0,
    color: colors.dark,
    fontWeight: 900,
    fontSize: 18,
    letterSpacing: -0.4,
  },
  brandSub: {
    margin: '2px 0 0',
    color: colors.muted,
    fontSize: 12,
  },
  account: {
    display: 'flex',
    alignItems: 'center',
    gap: 12,
    flexWrap: 'wrap',
    justifyContent: 'flex-end',
  },
  emailPill: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 8,
    padding: '9px 12px',
    borderRadius: 999,
    background: colors.cream,
    border: `1px solid ${colors.border}`,
    color: colors.dark2,
    fontSize: 13,
    fontWeight: 700,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 999,
    background: '#1F7A4D',
  },
  logoutButton: {
    border: 0,
    borderRadius: 999,
    padding: '10px 16px',
    background: colors.dark,
    color: colors.white,
    cursor: 'pointer',
    fontWeight: 900,
    fontSize: 13,
    boxShadow: '0 10px 22px rgba(17,19,23,0.18)',
  },
};

export default function AuthGate({ children }) {
  const [user, setUser] = useState(null);
  const [checking, setChecking] = useState(true);
  const [signingOut, setSigningOut] = useState(false);

  useEffect(() => {
    let active = true;

    getCurrentUser().then((currentUser) => {
      if (!active) return;
      setUser(currentUser);
      setChecking(false);
    });

    const { data } = onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
      setChecking(false);
    });

    return () => {
      active = false;
      data?.subscription?.unsubscribe();
    };
  }, []);

  const handleLogout = async () => {
    const confirmed = window.confirm('Deseja sair do Ponto ArcD?');

    if (!confirmed) return;

    setSigningOut(true);
    await logout();
    setUser(null);
    setSigningOut(false);
  };

  if (checking) {
    return (
      <div style={styles.loadingPage}>
        <div style={styles.loadingCard}>
          <strong>Ponto ArcD</strong>
          <p style={{ margin: '8px 0 0', color: colors.muted }}>
            Carregando acesso seguro...
          </p>
        </div>
      </div>
    );
  }

  if (!user) {
    return <Auth />;
  }

  return (
    <>
      <header style={styles.header}>
        <div style={styles.brand}>
          <div style={styles.logo}>A</div>
          <div>
            <h1 style={styles.brandTitle}>Ponto ArcD</h1>
            <p style={styles.brandSub}>Gestão de pessoas e obras</p>
          </div>
        </div>

        <div style={styles.account}>
          <span style={styles.emailPill}>
            <span style={styles.dot} />
            {user.email}
          </span>

          <button
            type="button"
            onClick={handleLogout}
            disabled={signingOut}
            style={{
              ...styles.logoutButton,
              opacity: signingOut ? 0.7 : 1,
              cursor: signingOut ? 'not-allowed' : 'pointer',
            }}
          >
            {signingOut ? 'Saindo...' : 'Sair'}
          </button>
        </div>
      </header>

      {children}
    </>
  );
}
