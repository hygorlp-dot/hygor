import { useEffect, useState } from 'react';
import Auth from './Auth';
import { getCurrentUser, onAuthStateChange, logout } from './supabase';

const C = {
  bg: '#111317',
  bg2: '#1C1F26',
  yellow: '#D6A84F',
  yellowD: '#B8892E',
  cream: '#F7F2E8',
  white: '#FFFFFF',
  mutedWhite: 'rgba(255,255,255,0.70)',
  borderDark: 'rgba(255,255,255,0.14)',
};

const font = "'Barlow Condensed', Arial, sans-serif";

function BrandMark({ size = 42 }) {
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
          fontSize: size * 0.46,
          letterSpacing: -0.5,
          flex: '0 0 auto',
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
        flex: '0 0 auto',
      }}
    />
  );
}

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
          background: C.bg,
          color: C.white,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: 20,
          fontFamily: font,
        }}
      >
        <div
          style={{
            width: '100%',
            maxWidth: 340,
            textAlign: 'center',
            padding: 26,
            border: `1px solid ${C.borderDark}`,
            background: C.bg2,
          }}
        >
          <BrandMark size={74} />

          <strong
            style={{
              display: 'block',
              marginTop: 14,
              fontSize: 24,
              color: C.white,
              letterSpacing: 0.4,
              textTransform: 'uppercase',
            }}
          >
            Ponto ArcD
          </strong>

          <p
            style={{
              margin: '8px 0 0',
              color: C.mutedWhite,
              fontSize: 15,
              letterSpacing: 0.4,
            }}
          >
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
      <main>{children}</main>

      <footer
        style={{
          background: C.bg,
          color: C.white,
          borderTop: `3px solid ${C.yellow}`,
          padding: '18px 16px 22px',
          fontFamily: font,
        }}
      >
        <div
          style={{
            width: '100%',
            maxWidth: 520,
            margin: '0 auto',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 14,
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              minWidth: 0,
            }}
          >
            <BrandMark size={40} />

            <div style={{ minWidth: 0 }}>
              <strong
                style={{
                  display: 'block',
                  color: C.white,
                  fontSize: 18,
                  lineHeight: 1,
                  fontWeight: 900,
                  textTransform: 'uppercase',
                  letterSpacing: 0.5,
                }}
              >
                Ponto ArcD
              </strong>

              <span
                style={{
                  display: 'block',
                  marginTop: 4,
                  color: C.mutedWhite,
                  fontSize: 13,
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  maxWidth: 190,
                  letterSpacing: 0.3,
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
              border: 'none',
              borderRadius: 0,
              padding: '10px 18px',
              background: `linear-gradient(135deg, ${C.yellow}, ${C.yellowD})`,
              color: C.bg,
              fontFamily: font,
              fontWeight: 900,
              fontSize: 15,
              letterSpacing: 0.6,
              textTransform: 'uppercase',
              cursor: signingOut ? 'not-allowed' : 'pointer',
              opacity: signingOut ? 0.7 : 1,
              flex: '0 0 auto',
            }}
          >
            {signingOut ? 'Saindo...' : 'Sair'}
          </button>
        </div>
      </footer>
    </>
  );
}
