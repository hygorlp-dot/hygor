import { createRoot } from "react-dom/client";
import { act } from "react";
import VideoModal from "./VideoModal";

function render(props) {
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);
  act(() => { root.render(<VideoModal {...props}/>); });
  return { container, root };
}

test("não renderiza nada quando fechado", () => {
  const { container } = render({ open: false, onClose: () => {} });
  expect(container.querySelector('[role="dialog"]')).toBeNull();
});

test("abre com foco no botão de fechar e fecha ao pressionar Escape", () => {
  const onClose = vi.fn();
  const { container } = render({ open: true, onClose, videoSource: "", posterSource: "" });
  const dialog = container.querySelector('[role="dialog"]');
  expect(dialog).toBeTruthy();
  expect(document.activeElement?.getAttribute("aria-label")).toBe("Fechar vídeo");

  act(() => {
    document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
  });
  expect(onClose).toHaveBeenCalledTimes(1);
});

test("botão de fechar aciona onClose", () => {
  const onClose = vi.fn();
  const { container } = render({ open: true, onClose, videoSource: "", posterSource: "" });
  const botaoFechar = container.querySelector('[aria-label="Fechar vídeo"]');
  act(() => { botaoFechar.click(); });
  expect(onClose).toHaveBeenCalledTimes(1);
});

test("mostra mensagem de fallback quando não há vídeo configurado ainda", () => {
  const { container } = render({ open: true, onClose: () => {}, videoSource: "", posterSource: "" });
  expect(container.textContent).toContain("Vídeo em breve.");
});
