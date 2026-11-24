import { describe, expect, it } from 'vitest';
import { inspectUiContractCss, inspectUiContractJsx } from './check-ui-contracts.mjs';
import { findOverrides, legacyKey } from './ui-contract-legacy.mjs';

describe('contratos visuais do ERP', () => {
  it('barra substituições locais para cada família e permite compor a largura', () => {
    const source = `
      .obras .arcd-page-header__title { font-size: var(--arcd-type-kpi); }
      .compras { .mrc-button:hover { background: var(--arcd-surface-card); width: 100%; } }
      .filtros .arcd-filter-bar { gap: var(--arcd-space-1); }
      .obra .dashboard-kpi__value { color: var(--arcd-info-text); }
      .rh .arcd-data-table__table { padding: var(--arcd-space-1); }
      .pagamento .arcd-dialog__title { @apply font-bold; }
      .obras { --arcd-box-gap: var(--arcd-space-2); }
    `;
    const findings = inspectUiContractCss(source, 'src/features/obras/visual.css');
    expect(findings.map(({ family }) => family)).toEqual([
      'Cabeçalhos e filtros', 'Botões e campos', 'Cabeçalhos e filtros',
      'Caixas e indicadores', 'Tabelas e listas responsivas', 'Tokens de aparência',
      'Diálogos e estados de tela',
    ]);
    expect(findOverrides(findings)).toEqual(findings);
  });

  it('aceita mudanças na receita compartilhada e na escala de densidade', () => {
    expect(inspectUiContractCss('.mrc-button { padding: var(--arcd-space-2); }', 'src/design-system/primitives/button-contract.css')).toEqual([]);
    expect(inspectUiContractCss('.arcd-filter-bar { gap: var(--arcd-space-3); }', 'src/design-system/themes/module-standard.css')).toEqual([]);
    expect(inspectUiContractCss('[data-density="compact"] { --arcd-control-height: 2rem; }', 'src/design-system/tokens/density.css')).toEqual([]);
  });

  it('protege o tamanho das caixas de seleção e o recuo das linhas clicáveis', () => {
    const local = `.licenca .arcd-choice-control { height: 12px; }
      .compras .mrc-record-action[data-record-layout="row"] { padding: 2px; }`;
    const findings = inspectUiContractCss(local, 'src/domains/obras/app.css');
    expect(findOverrides(findings).map(({ note }) => note)).toEqual(['height: 12px', 'padding: 2px']);
  });

  it('protege a caixa e as faixas de indicadores, inclusive nos seletores de fila', () => {
    const source = `
      .obras .mrc-box__header { padding: 0; }
      .resumo .mrc-kpi-strip { border-radius: 0; }
      .purchase-queue-metrics strong { font-size: 32px; }
      .finance-today__filters button { background: transparent; }
      .payroll-summary-strip__net strong { font-size: 24px; }
      .arcd-chart-panel__header { padding: 0; }
      .arcd-summary-card__value { font-family: var(--arcd-font-mono); }
    `;
    const findings = inspectUiContractCss(source, 'src/Tela.css');
    expect(findings.map(({ family }) => family)).toEqual(Array(7).fill('Caixas e indicadores'));
  });

  it('exige a fonte da base em telas e aceita a declaração de arquivo de fonte', () => {
    const source = `@font-face { font-family: Inter; src: url(fonte.woff2); }
      .painel { font-family: Inter; } .botao { font-family: var(--arcd-font-sans); }`;
    expect(inspectUiContractCss(source, 'src/tela.css').map(({ family }) => family)).toEqual(['Tipografia compartilhada']);
    expect(inspectUiContractJsx('<span style={{fontFamily:"Inter"}} />', 'src/Tela.jsx').map(({ family }) => family)).toEqual(['Tipografia compartilhada']);
  });

  it('barra ajustes inline de apresentação e permite composição e dados visuais locais', () => {
    const source = `<>
      <Button style={{ fontSize: size, width: '100%' }}>Abrir</Button>
      <Input style={{ padding: 'var(--arcd-space-1)' }} />
      <div style={{ '--arcd-type-body': '1rem', '--progresso': progress }} />
      <div style={{ gridTemplateColumns: columns }} />
    </>`;
    expect(inspectUiContractJsx(source, 'src/Area.jsx').map(({ note }) => note)).toEqual([
      '<Button> usa fontSize no estilo inline', '<Input> usa padding no estilo inline',
      '<div> usa --arcd-type-body no estilo inline',
    ]);
  });

  it('permite remover uma exceção legada e rejeita alteração de valor no mesmo arquivo', () => {
    const file = 'src/features/obras/styles.css';
    const before = inspectUiContractCss('.mrc-screen-header { gap: 0; }', file);
    const inventory = before.map(({ signature }) => legacyKey(signature));
    const after = inspectUiContractCss('.mrc-screen-header { gap: 1rem; }', file);
    expect(findOverrides(before, inventory)).toEqual([]);
    expect(findOverrides([], inventory)).toEqual([]);
    expect(findOverrides(after, inventory)).toEqual(after);
  });

  it('mantém rodapés e grupos de campos sob o contrato dos diálogos', () => {
    const source = `.compras .arcd-dialog__footer { padding: 0; }
      .mrc-dialog-actions { gap: 0; }
      .orcamento .mrc-dialog-fields__row { gap: 0; }`;
    const findings = inspectUiContractCss(source, 'src/Tela.css');
    expect(findings.map(({family}) => family)).toEqual(Array(3).fill('Diálogos e estados de tela'));
  });

  it('protege a densidade e a tipografia de impressão fora da base de tokens', () => {
    const density = '.filtros { --arcd-layout-gap: 0; --arcd-panel-padding: 0; }';
    const print = '@media print { :root { --arcd-font-sans: Arial; } }';
    expect(inspectUiContractCss(density, 'src/Area.css').map(({family})=>family)).toEqual(Array(2).fill('Tokens de aparência'));
    expect(inspectUiContractCss(print, 'src/Area.css').map(({family})=>family)).toEqual(['Tokens de aparência']);
    expect(inspectUiContractCss(density, 'src/design-system/tokens/density.css')).toEqual([]);
    expect(inspectUiContractCss(print, 'src/design-system/tokens/print.css')).toEqual([]);
  });

  it('protege a espessura das bordas fora da base de tokens', () => {
    const stroke = '.painel { --arcd-border-width: 2px; }';
    expect(inspectUiContractCss(stroke, 'src/Area.css').map(({family})=>family)).toEqual(['Tokens de aparência']);
    expect(inspectUiContractCss(stroke, 'src/design-system/tokens/semantic.css')).toEqual([]);
  });

  it('exige a receita de tabela e protege caixas e indicadores compostos em JSX', () => {
    const source = `<>
      <table data-report-table-name="Cópia"><tbody /></table>
      <table className="arcd-data-table__table" data-table-layout="matrix"><tbody /></table>
      <section className="mrc-box mrc-box--padded" style={{padding: 0}} />
      <strong className="mrc-kpi__value" style={{fontSize: 24}} />
    </>`;
    expect(inspectUiContractJsx(source, 'src/Area.jsx').map(({family})=>family)).toEqual([
      'Tabelas e listas responsivas', 'Caixas e indicadores', 'Caixas e indicadores',
    ]);
    expect(inspectUiContractJsx('<table data-report-table-name="Folha principal" />',
      'src/domains/ponto/components/FolhaView.jsx')).toEqual([]);
    expect(inspectUiContractCss('.mrc-kpi__value { font-size: 24px; }', 'src/Area.css')).toHaveLength(1);
    expect(inspectUiContractCss('.mrc-box--padded { padding: 0; }', 'src/Area.css')).toHaveLength(1);
  });
});
