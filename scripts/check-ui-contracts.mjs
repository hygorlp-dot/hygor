import { readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';
import { findOverrides, visitCssStyles } from './ui-contract-legacy.mjs';

const sharedTokens = /^--arcd-(?:type-|font-|button-|box-|space-|radius-|border-width$|page-padding|touch-target|control-height|panel-padding|layout-gap|table-row-height|row-height|density-)/;
const visualCss = /^(?:font(?:-|$)|line-height$|letter-spacing$|color$|background|border|outline|box-shadow$|text-transform$|(?:row-|column-)?gap$|padding|(?:min-|max-)?(?:height|block-size)$|text-align$)/;
const inlineStyle = /^(?:font|lineHeight$|letterSpacing$|color$|background|border|outline|boxShadow$|textTransform$|(?:rowGap|columnGap|gap)$|padding|(?:minHeight|maxHeight|height)$|textAlign$)/;
const inheritedFont = /^(?:var\(|inherit\b|unset\b|revert\b)/;
const shared = 'src/design-system/';
const families = [
  {
    name: 'Cabeçalhos e filtros',
    hooks: /\.(?:mrc-screen-header|mrc-section-heading|arcd-page-header[\w-]*|arcd-filter-bar|workspace-heading|workspace-command-bar[\w-]*|workspace-filters[\w-]*)(?![\w-])/,
    components: /^(?:PageHeader|WorkspaceHeading|FilterBar|WorkspaceCommandBar|WorkspaceFilters)$/,
    sources: ['themes/module-standard.css', 'themes/box-contract.css', 'patterns/styles.css', 'patterns/command-bar.css'],
  },
  {
    name: 'Botões e campos',
    hooks: /(?:\.mrc-button(?:__spinner)?|\.mrc-record-action|\.arcd-choice-control|\.arcd-field(?:__[\w-]+)?|\[data-mrc-(?:role|size|control|field)\b)(?![\w-])/,
    components: /^(?:Button|StandardButton|CoreButton|Btn|RecordAction|Input|Inp|Select|Sel|SelectControl|InputControl|Textarea|Field|Checkbox|ChoiceControl)$/,
    sources: ['primitives/button-contract.css', 'primitives/control-contract.css', 'primitives/choice-control.css', 'primitives/record-action.css', 'primitives/styles.css', 'patterns/submenus.css'],
  },
  {
    name: 'Caixas e indicadores',
    hooks: /\.(?:mrc-command-workspace|mrc-kpi[\w-]*|finance-today__filters|purchase-queue-metrics|payroll-summary-strip(?:__[\w-]+)?|mrc-box[\w-]*|arcd-summary-card[\w-]*|arcd-chart-(?:panel(?:__[\w-]+)?|tooltip)|page-hero__stat[\w-]*|dashboard-kpi[\w-]*|dre-kpi-(?:grid|card|footer)|dashboard-executive-grid)(?![\w-])/,
    components: /^(?:SummaryCard|PageHero|ModuleLayout)$/,
    sources: ['themes/box-contract.css', 'themes/vidro-erp.css', 'themes/module-standard.css', 'patterns/kpi-strip.css', 'patterns/styles.css'],
  },
  {
    name: 'Tabelas e listas responsivas',
    hooks: /\.(?:arcd-data-table[\w-]*|arcd-mobile-record-(?:card|actions)[\w-]*|arcd-record-card[\w-]*)(?![\w-])/,
    components: /^(?:DataTable|MobileRecordCard|ResponsiveRecordCard|RecordListPagination)$/,
    sources: ['data/styles.css', 'themes/box-contract.css'],
  },
  {
    name: 'Diálogos e estados de tela',
    hooks: /\.(?:arcd-modal-panel|arcd-dialog[\w-]*|arcd-drawer[\w-]*|arcd-feedback-state[\w-]*|mrc-empty-state|mrc-loading-state|mrc-dialog-(?:actions|fields(?:__[\w-]+)?))(?![\w-])/,
    components: /^(?:Modal|Drawer|Dialog|DialogSurface|ConfirmDialog|LoadingState|EmptyState|ErrorState)$/,
    sources: ['primitives/styles.css', 'patterns/styles.css', 'themes/module-standard.css', 'patterns/submenus.css'],
  },
];

export function inspectUiContractCss(source, file) {
  const findings = [];
  visitCssStyles(source, file, ({ property, value, selectors, context, line }) => {
    const note = property === '@apply' ? `@apply ${value}` : `${property}: ${value}`;
    function record(family) {
      findings.push({ family, note, line, signature: [family, ...context, note].join(' / ') });
    }
    if (sharedTokens.test(property) && !file.startsWith(`${shared}tokens/`)) record('Tokens de aparência');
    if (property === 'font-family' && !inheritedFont.test(value) && !context.some(part => part.startsWith('@font-face'))) record('Tipografia compartilhada');
    if (property !== '@apply' && !visualCss.test(property)) return;
    const selector = selectors.join(' ');
    const matching = families.filter(({ hooks }) => hooks.test(selector));
    // In a shared recipe, a selector can intentionally combine several patterns.
    if (matching.some(({ sources }) => sources.some(path => file === shared + path))) return;
    for (const { name } of matching) record(name);
  });
  return findings;
}

export function inspectUiContractJsx(source, file) {
  const ast = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const findings = [];
  function visit(node) {
    if (ts.isJsxOpeningElement(node) || ts.isJsxSelfClosingElement(node)) {
      const tag = node.tagName.getText(ast).split('.').at(-1);
      const attributes = node.attributes.properties.filter(ts.isJsxAttribute);
      const classAttribute = attributes.find(attribute => attribute.name.getText(ast) === 'className');
      const classNames = classAttribute?.initializer?.getText(ast) ?? '';
      const exportedPayrollTable = file === 'src/domains/ponto/components/FolhaView.jsx' &&
        attributes.some(attribute => attribute.name.getText(ast) === 'data-report-table-name');
      if (tag === 'table' && !exportedPayrollTable && !/\barcd-data-table__table\b/.test(classNames)) {
        const family = 'Tabelas e listas responsivas';
        const note = '<table> precisa da classe arcd-data-table__table';
        const line = ast.getLineAndCharacterOfPosition(node.getStart(ast)).line + 1;
        findings.push({ family, note, line, signature: `${family} / ${note}` });
      }
      const style = node.attributes.properties.find(attribute => ts.isJsxAttribute(attribute) && attribute.name.getText(ast) === 'style');
      const value = style?.initializer && ts.isJsxExpression(style.initializer) ? style.initializer.expression : undefined;
      if (value && ts.isObjectLiteralExpression(value)) {
        const family = families.find(item => item.components.test(tag) ||
          ((/\bmrc-(?:box|kpi)/.test(classNames)) && item.name === 'Caixas e indicadores'));
        for (const property of value.properties) {
          if (!property.name) continue;
          const key = property.name.getText(ast).replace(/^['"]|['"]$/g, '');
          const fixedFont = key === 'fontFamily' && ts.isPropertyAssignment(property) &&
            ts.isStringLiteralLike(property.initializer) && !inheritedFont.test(property.initializer.text);
          const name = fixedFont ? 'Tipografia compartilhada' : sharedTokens.test(key) ? 'Tokens de aparência' : inlineStyle.test(key) ? family?.name : undefined;
          if (!name) continue;
          const note = `<${tag}> usa ${key} no estilo inline`;
          const line = ast.getLineAndCharacterOfPosition(property.getStart(ast)).line + 1;
          findings.push({ family: name, note, line, signature: `${name} / ${tag} / ${property.getText(ast).trim()}` });
        }
      }
    }
    ts.forEachChild(node, visit);
  }
  visit(ast);
  return findings;
}

export function scanUiContracts() {
  const result = {};
  const files = readdirSync('src', { recursive: true }).map(path => `src/${String(path).replaceAll('\\', '/')}`).sort();
  for (const file of files) {
    const css = file.endsWith('.css');
    const jsx = /\.[jt]sx$/.test(file) && !/\.(?:test|spec|stories)\./.test(file) && !file.startsWith(shared) && !file.startsWith('src/components/ui/');
    if (!css && !jsx) continue;
    const inspect = css ? inspectUiContractCss : inspectUiContractJsx;
    const findings = inspect(readFileSync(file, 'utf8'), file);
    if (findings.length) result[file] = findings;
  }
  return result;
}

function main() {
  const existing = JSON.parse(readFileSync('scripts/ui-contract-legacy.json', 'utf8'));
  const findingsByFile = scanUiContracts();
  const counts = {};
  const errors = [];
  for (const [file, findings] of Object.entries(findingsByFile)) {
    for (const { family } of findings) counts[family] = (counts[family] ?? 0) + 1;
    for (const { line, family, note } of findOverrides(findings, existing[file])) {
      errors.push(`${file}:${line} — ${family}: ${note}. Use a base compartilhada em src/design-system.`);
    }
  }
  if (errors.length) {
    console.error(errors.join('\n'));
    process.exitCode = 1;
    return;
  }
  console.log('Contratos visuais: sem novas exceções.');
  for (const [family, count] of Object.entries(counts).sort()) console.log(`  ${family}: ${count} ocorrências legadas`);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();
