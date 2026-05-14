import { useEffect, useState } from "react";
import Auth from "./Auth";
import { getCurrentUser, onAuthStateChange, logout } from "./supabase";

const C = {
  bg: "#080808",
  border: "#1f1f1f",
  yellow: "#f0df00",
  text: "#f5f5f5",
  muted: "#999999",
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
    const confirmed = window.confirm("Deseja sair do sistema?");
    if (!confirmed) return;

    setSigningOut(true);
    await logout();
    setUser(null);
    setSigningOut(false);
  };

  if (checking) {
    return (
      <div
        style={{
          minHeight: "100vh",
          background: C.bg,
          color: C.text,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontFamily: "'Barlow', Arial, sans-serif",
        }}
      >
        <div style={{ textAlign: "center" }}>
          <h1
            style={{
              color: C.yellow,
              fontFamily: "'Barlow Condensed', Arial, sans-serif",
              fontSize: 28,
              letterSpacing: 1,
              textTransform: "uppercase",
              marginBottom: 8,
            }}
          >
            ArcD Obras
          </h1>

          <p style={{ color: C.muted }}>Carregando acesso...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return <Auth />;
  }

  return (
    <>
      <div
        style={{
          padding: "10px 16px",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          borderBottom: `1px solid ${C.border}`,
          background: C.bg,
          color: C.text,
          fontFamily: "'Barlow', Arial, sans-serif",
        }}
      >
        <strong
          style={{
            color: C.yellow,
            fontFamily: "'Barlow Condensed', Arial, sans-serif",
            fontSize: 18,
            letterSpacing: 1,
            textTransform: "uppercase",
          }}
        >
          ArcD Obras
        </strong>

        <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
          <span style={{ fontSize: 13, color: C.muted }}>
            {user?.email}
          </span>

          <button
            type="button"
            onClick={handleLogout}
            disabled={signingOut}
            style={{
              background: C.yellow,
              color: C.bg,
              border: "none",
              padding: "8px 14px",
              cursor: signingOut ? "not-allowed" : "pointer",
              opacity: signingOut ? 0.7 : 1,
              fontFamily: "'Barlow Condensed', Arial, sans-serif",
              fontWeight: 800,
              letterSpacing: 0.8,
              textTransform: "uppercase",
            }}
          >
            {signingOut ? "Saindo..." : "Sair"}
          </button>
        </div>
      </div>

      {children}
    </>
  );
}
