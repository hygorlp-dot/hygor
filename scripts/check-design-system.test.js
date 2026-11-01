import {describe,it,expect} from 'vitest';
import {inspectUiSource,growthAgainstBaseline} from './check-design-system.mjs';

describe('contrato de introdução de interface',()=>{
  it('aceita componentes compartilhados e tokens',()=>{
    expect(inspectUiSource('<PageHeader title="Obras"/><Button>Salvar</Button><div style={{gap:"var(--arcd-space-4)",margin:0,color:"var(--arcd-text-primary)"}}/>')).toEqual([]);
  });
  it('detecta controles próprios e apresentação fixa na tela',()=>{
    const findings=inspectUiSource('<button style={{fontSize:15,gap:12,color:"#fff"}}>Salvar</button>');
    expect(findings.map(f=>f.rule)).toEqual(['native-control','literal-typography','literal-spacing','literal-color']);
    expect(findings.every(f=>f.line===1)).toBe(true);
  });
  it('inspeciona apenas atributos JSX, sem confundir dados do negócio',()=>{
    expect(inspectUiSource('const material={color:"#fff",fontSize:15}; <span>{material.color}</span>')).toEqual([]);
  });
  it('preserva o mecanismo nativo de arquivos e campos invisíveis',()=>{
    expect(inspectUiSource('<input type="file" hidden/><input type="hidden"/>')).toEqual([]);
  });
  it('bloqueia novos arquivos e aumento do legado sem bloquear sua redução',()=>{
    const base={'old.jsx':{'native-control':2}};
    expect(growthAgainstBaseline({'old.jsx':{'native-control':1}},base)).toEqual([]);
    expect(growthAgainstBaseline({'old.jsx':{'native-control':3},'new.jsx':{'native-control':1}},base)).toEqual([
      {file:'old.jsx',rule:'native-control',count:3,allowed:2},
      {file:'new.jsx',rule:'native-control',count:1,allowed:0},
    ]);
  });
});
