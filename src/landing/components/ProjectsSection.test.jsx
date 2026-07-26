import { createRoot } from "react-dom/client";
import { act } from "react";
import ProjectsSection from "./ProjectsSection";
import { landingMedia } from "../data/landingMedia";

test("mostra placeholder elegante e link do Instagram quando não há imagem local ainda", () => {
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);
  act(() => { root.render(<ProjectsSection/>); });

  // Nenhum projeto tem localSource configurado neste estágio - todos devem
  // cair no placeholder, nunca numa imagem quebrada ou simulada.
  expect(container.querySelectorAll("img").length).toBe(0);
  expect(container.textContent).toContain("Imagem do projeto em breve");

  const linksInstagram = [...container.querySelectorAll("a")].filter(a => a.href.includes("instagram.com"));
  expect(linksInstagram.length).toBeGreaterThanOrEqual(landingMedia.projects.length);
  linksInstagram.forEach(link => {
    expect(link.getAttribute("target")).toBe("_blank");
    expect(link.getAttribute("rel")).toContain("noopener");
  });

  act(() => { root.unmount(); });
});
