import { useEffect, useState } from 'react';
import Auth from './Auth';
import { getCurrentUser, onAuthStateChange, logout } from './supabase';

export default function AuthGate({ children }) {
  const [user, setUser] = useState(null);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    getCurrentUser().then((currentUser) => {
      setUser(currentUser);
      setChecking(false);
    });

    const { data } = onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });

    return () => {
      data?.subscription?.unsubscribe();
    };
  }, []);

  if (checking) {
    return <div style={{ padding: 30 }}>Carregando...</div>;
  }

  if (!user) {
    return <Auth />;
  }

  return (
    <>
      <div style={{
        padding: '10px 16px',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        borderBottom: '1px solid #ddd',
        background: '#fff'
      }}>
        <strong>ArcD Ponto PRO</strong>

        <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
          <span style={{ fontSize: 14 }}>{user.email}</span>
          <button onClick={logout}>
            Sair
          </button>
        </div>
      </div>

      {children}
    </>
  );
}
