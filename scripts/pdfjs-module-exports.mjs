import MagicString from "magic-string";

const declaration = /^var __webpack_exports__ = globalThis\.pdfjsLib = \{\};\r?\n\r?\n\/\/ EXPORTS\r?\n__webpack_require__\.d\(__webpack_exports__, \{\r?\n([\s\S]*?)\r?\n\}\);/m;
const binding = /^  (\w+): \(\) => \(\/\* reexport \*\/ (\w+)\),?$/;

// O ERP usa os exports ESM do PDF.js. O objeto global da distribuição também
// referencia as camadas do visualizador web, impedindo que o build descarte
// as que o ERP não importa. Preserve os bindings ESM e o worker original.
export function pdfjsModuleExports() {
  return {
    name: "pdfjs-module-exports",
    apply: "build",
    enforce: "pre",
    transform(source, id) {
      if (!id.replaceAll("\\", "/").endsWith("/node_modules/pdfjs-dist/build/pdf.mjs")) return;

      const header = declaration.exec(source);
      const entries = header?.[1].split(/\r?\n/).map(line => binding.exec(line));
      const fail = () => { throw new Error("O contrato de exports do PDF.js mudou. Confira o adaptador antes de atualizar a dependência."); };
      if (!entries?.length || entries.some(entry => !entry)) fail();

      const names = entries.map(([, name]) => name);
      if (new Set(names).size !== names.length || !["getDocument", "GlobalWorkerOptions"].every(name => names.includes(name))) fail();
      const newline = header[0].includes("\r\n") ? "\r\n" : "\n";
      const aliases = names.map(name => `var __webpack_exports__${name} = __webpack_exports__.${name};`);
      const footer = [...aliases, `export { ${names.map(name => `__webpack_exports__${name} as ${name}`).join(", ")} };`].join(newline);
      const footerStart = source.lastIndexOf(footer);
      const headerEnd = header.index + header[0].length;
      if (footerStart < headerEnd) fail();

      const unchanged = source.slice(0, header.index) + source.slice(headerEnd, footerStart) + source.slice(footerStart + footer.length);
      if (/__webpack_exports__|pdfjsLib/.test(unchanged)) fail();

      const code = new MagicString(source);
      code.remove(header.index, headerEnd);
      code.overwrite(footerStart, footerStart + footer.length, `export { ${entries.map(([, name, local]) => local === name ? local : `${local} as ${name}`).join(", ")} };`);
      return {code: code.toString(), map: code.generateMap({hires: true, source: id, includeContent: true})};
    },
  };
}
