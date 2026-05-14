import { useEffect, useState } from 'react';
import Auth from './Auth';
import { getCurrentUser, onAuthStateChange, logout } from './supabase';

const colors = {
  primary: '#111111',
  secondary: '#D6A84F',
  background: '#F7F2E8',
  card: '#FFFFFF',
  text: '#1C1C1C',
  muted: '#777777',
  border: '#E6DDCC',
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
    const confirmed = window.confirm('Deseja sair do sistema?');

    if (!confirmed) return;

    setSigningOut(true);
    await logout();
    setUser(null);
    setSigningOut(false);
  };

  if (checking) {
    return (
      <main
        style={{
          minHeight: '100vh',
          background: colors.background,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontFamily: 'Arial, sans-serif',
          color: colors.text,
          padding: 20,
        }}
      >
        <div
          style={{
            width: '100%',
            maxWidth: 340,
            background: colors.card,
            borderRadius: 20,
            padding: 24,
            textAlign: 'center',
            border: `1px solid ${colors.border}`,
            boxShadow: '0 12px 34px rgba(0,0,0,0.08)',
          }}
        >
          <img
            src="/logo-arcd.png"
            alt="Logomarca ArcD"
            style={{
              width: 82,
              height: 82,
              objectFit: 'contain',
              marginBottom: 10,
            }}
          />

          <strong>Ponto ArcD</strong>

          <p style={{ margin: '8px 0 0', color: colors.muted, fontSize: 13 }}>
            Carregando acesso...
          </p>
        </div>
      </main>
    );
  }

  if (!user) {
    return <Auth />;
  }

  return (
    <>
      <header
        style={{
          position: 'sticky',
          top: 0,
          zIndex: 50,
          background: colors.card,
          borderBottom: `1px solid ${colors.border}`,
          padding: '10px 14px',
          fontFamily: 'Arial, sans-serif',
          boxShadow: '0 6px 20px rgba(0,0,0,0.05)',
        }}
      >
        <div
          style={{
            maxWidth: 480,
            margin: '0 auto',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 10,
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 9,
              minWidth: 0,
            }}
          >
            <img
              src="/logo-arcd.png"
              alt="Logomarca ArcD"
              style={{
                width: 38,
                height: 38,
                objectFit: 'contain',
                flex: '0 0 auto',
              }}
            />

            <div style={{ minWidth: 0 }}>
              <strong
                style={{
                  display: 'block',
                  color: colors.primary,
                  fontSize: 15,
                  lineHeight: 1.1,
                }}
              >
                Ponto ArcD
              </strong>

              <span
                style={{
                  display: 'block',
                  color: colors.muted,
                  fontSize: 11,
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  maxWidth: 150,
                }}
              >
                {user.email}
              </span>
            </div>
          </div>

          <button
            type="button"
            onClick={handleLogout}
            disabled={signingOut}
            style={{
              border: 0,
              borderRadius: 999,
              padding: '9px 13px',
              background: colors.primary,
              color: '#FFFFFF',
              fontSize: 12,
              fontWeight: 800,
              cursor: signingOut ? 'not-allowed' : 'pointer',
              opacity: signingOut ? 0.7 : 1,
              flex: '0 0 auto',
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
