import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  findSubmenuOverrides,
  hasSharedImport,
  inspectSharedSubmenuCss,
  inspectSubmenuCss,
  inspectSubmenuJsx,
} from './check-submenus.mjs';

const sharedCss = readFileSync('src/design-system/patterns/submenus.css', 'utf8');

describe('trava do padrão visual dos submenus', () => {
  it('permite mudar o espaçamento pela regra compartilhada', () => {
    const updated = sharedCss.replace('column-gap: var(--arcd-space-1)', 'column-gap: var(--arcd-space-2)');
    expect(updated).not.toBe(sharedCss);
    expect(inspectSharedSubmenuCss(updated)).toEqual({ missing: [], local: [] });
  });

  it('rejeita uma família removida da base e uma exceção por página', () => {
    const updated = sharedCss.replace('    .works-category-tabs,', '') +
      '\n[data-tab="obras"] .mrc-submenu > button { gap: 0; }';
    const { missing, local } = inspectSharedSubmenuCss(updated);
    expect(missing).toContain('works-category-tabs');
    expect(local.map(item => item.selector)).toEqual(['[data-tab="obras"] .mrc-submenu > button']);
  });

  it('exige a importação da base no ERP', () => {
    expect(hasSharedImport('import "./design-system/patterns/submenus.css"')).toBe(true);
    expect(hasSharedImport('// import "./design-system/patterns/submenus.css"')).toBe(false);
  });

  it('barra ajustes em CSS aninhado, estados e utilitários do submenu', () => {
    const css = `
      .obras { .works-category-tabs { & > button:hover { border-radius: 1rem; } } }
      [role='tab'][aria-selected=true] { @apply font-bold; }
      .outra-area { --submenu-ink: red; }
      .obras-panel { padding: var(--arcd-space-2); }
    `;
    const notes = inspectSubmenuCss(css, 'src/obras.css').map(item => item.note);
    expect(notes).toEqual(['border-radius: 1rem', '--submenu-ink: red', '@apply font-bold']);
  });

  it('barra estilo JSX no grupo e nas opções e aceita posicionamento pelo contêiner', () => {
    const source = `
      const view = <div className="obras-panel">
        <div role={'tablist'} style={{gap: 12}}>
          <Button className="font-bold">Obras</Button>
        </div>
        <TabsList><TabsTrigger className={localClass}>Obras</TabsTrigger></TabsList>
        <div className="mrc-submenu"><Button aria-pressed={true}>Obras</Button></div>
        <Button className="font-bold">Salvar</Button>
      </div>;
    `;
    expect(inspectSubmenuJsx(source, 'src/Obras.jsx').map(item => item.note)).toEqual([
      'estilo inline no submenu', 'classe local no submenu', 'classe local no submenu',
    ]);
  });

  it('aceita manter ou remover uma regra legada e barra mudanças ou duplicatas', () => {
    const old = inspectSubmenuCss('.tab-row { gap: 1rem; }', 'src/old.css');
    const inventory = [createHash('sha256').update(old[0].signature).digest('hex').slice(0, 16)];
    const changed = inspectSubmenuCss('.tab-row { gap: 2rem; }', 'src/old.css');
    expect(findSubmenuOverrides(old, inventory)).toEqual([]);
    expect(findSubmenuOverrides([], inventory)).toEqual([]);
    expect(findSubmenuOverrides(changed, inventory)).toEqual(changed);
    expect(findSubmenuOverrides([...old, ...old], inventory)).toEqual(old);
  });
});
