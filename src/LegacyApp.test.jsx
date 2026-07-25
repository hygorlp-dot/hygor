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
},20000);
