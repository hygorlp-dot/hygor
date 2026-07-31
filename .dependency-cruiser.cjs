/**
 * Guardas deliberadamente pequenas: só fronteiras que não possuem exceção de
 * negócio. Regras novas só entram após uma POC independente e revisão humana.
 */
module.exports = {
  forbidden: [
    {
      name: "client-portal-must-not-import-legacy-app",
      severity: "error",
      comment: "O portal do cliente é uma superfície isolada do ERP legado.",
      from: { path: "^src/client-portal/" },
      to: { path: "^src/LegacyApp\\.jsx$" },
    },
    {
      name: "design-system-must-not-import-domains",
      severity: "error",
      comment: "Componentes reutilizáveis não dependem de regras de domínio.",
      from: { path: "^src/design-system/" },
      to: { path: "^src/domains/" },
    },
    {
      name: "api-must-not-import-react-ui",
      severity: "error",
      comment: "Handlers Vercel não podem depender da camada de interface.",
      from: { path: "^api/" },
      to: { path: "^src/(components|design-system)/" },
    },
    {
      name: "browser-src-must-not-import-postgres",
      severity: "error",
      comment: "Código de navegador não pode carregar o cliente de banco.",
      from: { path: "^src/" },
      to: { path: "^postgres$" },
    },
  ],
  options: {
    doNotFollow: {
      path: "node_modules",
      dependencyTypes: [
        "npm",
        "npm-dev",
        "npm-optional",
        "npm-peer",
        "npm-bundled",
        "npm-no-pkg",
      ],
    },
    enhancedResolveOptions: {
      extensions: [".js", ".jsx", ".mjs", ".cjs", ".json"],
    },
  },
};
