import React from "react";
import { logout } from "./supabase";

export default function AuthGate({ user, children }) {
  return (
    <>
      <div style={{
        padding: "10px 16px",
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        borderBottom: "1px solid #1f1f1f",
        background: "#080808",
        color: "#f5f5f5",
        fontFamily: "'Barlow', Arial, sans-serif",
      }}>
        <strong style={{
          color: "#f0df00",
          fontFamily: "'Barlow Condensed', Arial, sans-serif",
          fontSize: 18,
          letterSpacing: 1,
          textTransform: "uppercase",
        }}>
          ArcD Obras
        </strong>

        <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
          <span style={{ fontSize: 13, color: "#999" }}>
            {user?.email}
          </span>

          <button
            onClick={logout}
            style={{
              background: "#f0df00",
              color: "#080808",
              border: "none",
              padding: "8px 14px",
              cursor: "pointer",
              fontFamily: "'Barlow Condensed', Arial, sans-serif",
              fontWeight: 800,
              letterSpacing: .8,
              textTransform: "uppercase",
            }}
          >
            Sair
          </button>
        </div>
      </div>

      {children}
    </>
  );
}
}
