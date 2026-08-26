// Garante que LegacyApp.jsx continua reexportando exatamente as mesmas
// funções do motor legado extraído para ./legacy-engine.js (Onda 2 do
// raio-X, 26/08/2026) - sem isso, quem importa de "../../LegacyApp"
// (PlanejamentoView.jsx, o teste de caracterização) poderia silenciosamente
// passar a usar uma cópia divergente.
vi.mock("../../components/ui/button", () => ({ Button: () => null }));
vi.mock("../../components/ui/input", () => ({ Input: () => null }));
vi.mock("../../components/ui/label", () => ({ Label: () => null }));
vi.mock("../../components/ui/card", () => ({
  Card: () => null, CardHeader: () => null, CardTitle: () => null,
  CardDescription: () => null, CardContent: () => null, CardFooter: () => null,
}));
vi.mock("../../components/ui/tabs", () => ({
  Tabs: () => null, TabsList: () => null, TabsTrigger: () => null, TabsContent: () => null,
}));
vi.mock("../../components/ui/alert", () => ({ Alert: () => null, AlertDescription: () => null }));

import { describe, expect, it } from "vitest";
import * as legacyEngine from "./legacy-engine.js";

describe("fronteira do motor de cronograma legado", () => {
  it("LegacyApp.jsx reexporta exatamente as mesmas funções (mesma referência)", async () => {
    const legacyApp = await import("../../LegacyApp.jsx");
    for (const name of Object.keys(legacyEngine)) {
      expect(legacyApp[name]).toBe(legacyEngine[name]);
    }
  }, 60000);
});
