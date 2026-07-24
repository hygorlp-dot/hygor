import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import ErrorBoundary from "./ErrorBoundary";
import "./index.css";

// Sem AuthGate e sem Auth: não existe mais login de e-mail/senha do Supabase.
// O PIN do próprio app é a credencial, e ele é conferido no servidor, dentro
// de /api/data. O navegador não guarda chave de banco nenhuma.
//
// Escrito com React.createElement em vez de JSX de propósito: não há uma única
// tag "<" neste arquivo, então nada pode ser engolido ao copiar e colar.
// É exatamente no que o JSX vira depois de compilado — mesmo resultado.
//
// O ErrorBoundary fica por fora: assim ele segura até um erro na tela de login,
// em vez de deixar o usuário diante de uma tela branca sem explicação.

const root = ReactDOM.createRoot(document.getElementById("root"));

root.render(
  React.createElement(
    React.StrictMode,
    null,
    React.createElement(
      ErrorBoundary,
      null,
      React.createElement(App, null)
    )
  )
);
