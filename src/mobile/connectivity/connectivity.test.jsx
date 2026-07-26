import React from "react";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, describe, expect, it } from "vitest";
import { NetworkStatus } from "./NetworkStatus.jsx";
import { OfflineBanner } from "./OfflineBanner.jsx";
import { SyncStatus } from "./SyncStatus.jsx";

const mounted = [];
function render(ui) { const container = document.createElement("div"); document.body.append(container); const root = createRoot(container); act(() => root.render(ui)); mounted.push({ container, root }); return container; }
afterEach(() => { while (mounted.length) { const { root, container } = mounted.pop(); act(() => root.unmount()); container.remove(); } });

describe("mobile connectivity presentation", () => {
  it("communicates network state without claiming a server save", () => {
    const container = render(<><NetworkStatus status="offline" /><OfflineBanner status="offline" /><SyncStatus state="pending" /></>);
    expect(container.textContent).toContain("Offline");
    expect(container.textContent).toContain("não foram confirmados no servidor");
    expect(container.textContent).toContain("Salvo neste aparelho. Aguardando conexão.");
  });

  it("shows a confirmed synchronization only when explicitly informed", () => {
    const container = render(<SyncStatus state="synced" updatedAt="14:32" />);
    expect(container.textContent).toBe("Sincronizado às 14:32.");
  });
});
