import { readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import postcss from 'postcss';
import ts from 'typescript';
import { findOverrides, visitCssStyles } from './ui-contract-legacy.mjs';

export { findOverrides as findSubmenuOverrides };

const sharedStyle = 'src/design-system/patterns/submenus.css';
const entry = 'src/index.js';
const sharedImport = './design-system/patterns/submenus.css';
const sharedMenuClasses = [
  'tab-row', 'workflow-tabs', 'workflow-tools', 'workspace-navigation__desktop',
  'workspace-navigation__tools', 'mrc-submenu', 'works-category-tabs', 'works-view-toggle',
  'ro-segments', 'app-help-modes', 'box-memory__tabs', 'dashboard-action-filters',
  'dashboard-queue-filters', 'annual-dre__view-switch', 'arcd-client-subnav',
];
// Internal elements and hooks of tablists covered by role.
const internalMenuClass = /^(?:tab-row__[\w-]+|workflow-(?:tabs|tools)__[\w-]+|workspace-navigation(?:__[\w-]+)?|works-category-count|ro-(?:segment|mono)|pe-tabs|bc-views|purchase-panel-views|arcd-tv-visoes)$/;
const roleSelector = /\[\s*role\s*=\s*["']?tab(?:list)?\b/i;
const visualProperty = /^(?:--submenu-|(?:min-|max-)?(?:height|block-size)$|color$|background|mask|font|line-height$|letter-spacing$|border|(?:row-|column-)?gap$|padding|box-shadow$|outline|text-decoration)/i;

const isMenuClass = name => sharedMenuClasses.includes(name) || internalMenuClass.test(name);
const selectorClasses = selector => [...selector.matchAll(/\.([\w-]+)/g)].map(([, name]) => name);

function mentionsSubmenu(selector) {
  return roleSelector.test(selector) || selectorClasses(selector).some(isMenuClass);
}

export function inspectSubmenuCss(source, file) {
  const findings = [];
  visitCssStyles(source, file, ({ property, value, selectors, context, line }) => {
    if (property !== '@apply' && !visualProperty.test(property)) return;
    if (!property.startsWith('--submenu-') && !selectors.some(mentionsSubmenu)) return;
    const note = property === '@apply' ? `@apply ${value}` : `${property}: ${value}`;
    findings.push({ line, note, signature: [...context, note].join(' / ') });
  });
  return findings;
}

export function inspectSharedSubmenuCss(source) {
  // Every destination must use the same base rule. State and theme rules can
  // still be composed below it.
  const stylesheet = postcss.parse(source);
  const globalScopes = new Set(['arcd-main', 'arcd-dialog', 'arcd-modal-panel', 'arcd-drawer', 'arcd-client-shell', 'arcd-access-shell', 'arcd-tv']);
  let classes = [];
  let hasTablist = false;
  stylesheet.walkDecls('--submenu-height', declaration => {
    const rule = declaration.parent;
    if (rule.type !== 'rule' || !/\[\s*role\s*=\s*["']?tablist\b/i.test(rule.selector)) return;
    classes = selectorClasses(rule.selector);
    hasTablist = true;
    return false;
  });
  const missing = [...(hasTablist ? [] : ['role="tablist"']), ...sharedMenuClasses.filter(name => !classes.includes(name))];
  const local = [];
  stylesheet.walkRules(rule => {
    if (selectorClasses(rule.selector).some(name => !isMenuClass(name) && !globalScopes.has(name)) || /#[\w-]+|\[\s*data-tab\s*[*~^$|]?=/i.test(rule.selector)) {
      local.push({ line: rule.source.start.line, selector: rule.selector.trim().replace(/\s+/g, ' ') });
    }
  });
  return { missing, local };
}

export function inspectSubmenuJsx(source, file) {
  const ast = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const findings = [];
  function visit(node, insideMenu) {
    const element = ts.isJsxElement(node) ? node.openingElement : node;
    let inMenu = insideMenu;
    if (ts.isJsxOpeningElement(element) || ts.isJsxSelfClosingElement(element)) {
      const tag = element.tagName.getText(ast);
      const attrs = new Map(element.attributes.properties.filter(ts.isJsxAttribute).map(attribute => [attribute.name.getText(ast), attribute]));
      const classAttr = attrs.get('className');
      const classValue = classAttr?.initializer?.getText(ast) ?? '';
      const classes = classValue.match(/[\w-]+/g) ?? [];
      const knownClass = classes.some(isMenuClass);
      const roleAttribute = attrs.get('role')?.initializer;
      const roleValue = roleAttribute && ts.isJsxExpression(roleAttribute) ? roleAttribute.expression : roleAttribute;
      const role = roleValue && ts.isStringLiteralLike(roleValue) ? roleValue.text : '';
      const kind = tag.split('.').at(-1);
      const isMenu = kind === 'TabsList' || role === 'tablist' || knownClass;
      const isOption = kind === 'TabsTrigger' || role === 'tab' || (insideMenu && /^(?:button|\w*Button|summary|small)$/.test(kind));
      const add = (attribute, note) => findings.push({
        line: ast.getLineAndCharacterOfPosition(attribute.getStart(ast)).line + 1,
        note,
        signature: `${tag} ${attribute.getText(ast).replace(/\s+/g, ' ')}`,
      });
      if (isMenu || isOption) {
        if (attrs.has('style')) add(attrs.get('style'), 'estilo inline no submenu');
        if (classAttr && !(classAttr.initializer && ts.isStringLiteral(classAttr.initializer) && classes.every(isMenuClass))) {
          add(classAttr, 'classe local no submenu');
        }
      }
      inMenu ||= isMenu;
    }
    ts.forEachChild(node, child => {
      if (!ts.isJsxOpeningElement(child)) visit(child, inMenu);
    });
  }
  visit(ast, false);
  return findings;
}

export function hasSharedImport(source) {
  const ast = ts.createSourceFile(entry, source, ts.ScriptTarget.Latest, false);
  return ast.statements.some(node => ts.isImportDeclaration(node) && node.moduleSpecifier.text === sharedImport);
}

function main() {
  const existing = JSON.parse(readFileSync('scripts/submenu-legacy.json', 'utf8'));
  const files = readdirSync('src', { recursive: true }).map(path => `src/${String(path).replaceAll('\\', '/')}`).sort();
  const errors = [];
  if (!files.includes(sharedStyle) || !hasSharedImport(readFileSync(entry, 'utf8'))) {
    errors.push(`${entry} — importe o estilo compartilhado ${sharedImport}.`);
  }
  if (files.includes(sharedStyle)) {
    const { missing, local } = inspectSharedSubmenuCss(readFileSync(sharedStyle, 'utf8'));
    if (missing.length) errors.push(`${sharedStyle} — inclua ${missing.join(', ')} na regra comum dos submenus.`);
    for (const { line, selector } of local) {
      errors.push(`${sharedStyle}:${line} — seletor específico ${selector}. Use o mesmo estilo em todas as páginas.`);
    }
  }
  for (const file of files) {
    if (file === sharedStyle || /\.(?:test|spec|stories)\.[jt]sx?$/.test(file)) continue;
    const inspect = file.endsWith('.css') ? inspectSubmenuCss : /\.[jt]sx?$/.test(file) ? inspectSubmenuJsx : null;
    if (!inspect) continue;
    const source = readFileSync(file, 'utf8');
    for (const { line, note } of findOverrides(inspect(source, file), existing[file])) {
      errors.push(`${file}:${line} — ${note}. Aplique mudanças de aparência em ${sharedStyle}.`);
    }
  }
  if (errors.length) {
    console.error(errors.join('\n'));
    process.exitCode = 1;
  } else {
    console.log('Submenus: contrato compartilhado carregado e sem novas exceções locais.');
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();
