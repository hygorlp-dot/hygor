vi.mock("./components/ui/button", () => ({ Button: () => null }));
vi.mock("./components/ui/input", () => ({ Input: () => null }));
vi.mock("./components/ui/label", () => ({ Label: () => null }));
vi.mock("./components/ui/card", () => ({
  Card: () => null, CardHeader: () => null, CardTitle: () => null,
  CardDescription: () => null, CardContent: () => null, CardFooter: () => null,
}));
vi.mock("./components/ui/tabs", () => ({
  Tabs: () => null, TabsList: () => null, TabsTrigger: () => null, TabsContent: () => null,
}));
vi.mock("./components/ui/alert", () => ({ Alert: () => null, AlertDescription: () => null }));

test("módulo operacional inicializa sem referência circular", async () => {
  const modulo = await import("./LegacyApp");
  expect(typeof modulo.default).toBe("function");
// Timeout elevado de propósito: com --coverage, a instrumentação do v8 sobre
// os 20 mil+ linhas de LegacyApp.jsx (e tudo que ele importa) faz o import
// dinâmico sozinho passar de 20s, mesmo sem nenhum problema de lógica.
},60000);
