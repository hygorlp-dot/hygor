import {describe,it,expect} from 'vitest';
import {themeRegistry,DISTANCE_VIEW_COLORS} from '../themes/themeRegistry.js';
import {validateThemeTokens} from './themeValidation.js';

const color=value=>{
  if(value.startsWith('#'))return [...value.match(/[a-f0-9]{2}/gi).map(c=>parseInt(c,16)),1];
  const values=value.match(/[\d.]+%?/g),alpha=values[3];
  return [...values.slice(0,3).map(Number),alpha?(alpha.endsWith('%')?parseFloat(alpha)/100:Number(alpha)):1];
};
const composite=(foreground,background)=>foreground.slice(0,3).map((channel,index)=>channel*foreground[3]+background[index]*(1-foreground[3]));
const luminance=channels=>{
  const rgb=channels.map(c=>c/255).map(c=>c<=.04045?c/12.92:((c+.055)/1.055)**2.4);
  return rgb[0]*.2126+rgb[1]*.7152+rgb[2]*.0722;
};
const contrast=(a,b,backdrop=[255,255,255])=>{const surface=composite(color(b),backdrop);const values=[luminance(composite(color(a),surface)),luminance(surface)].sort((x,y)=>y-x);return (values[0]+.05)/(values[1]+.05);};

it('Modo TV conserva leitura das cores semânticas sobre sua superfície escura',()=>{
  for(const [role,value] of Object.entries(DISTANCE_VIEW_COLORS)){
    for(const surface of ['#111412','#2c2d1d'])expect(contrast(value,surface),role).toBeGreaterThanOrEqual(4.5);
  }
});
describe('contrato visual dos temas',()=>{
  it('todos os temas implementam os mesmos papéis semânticos',()=>{
    const themes=Object.values(themeRegistry);
    for(const theme of themes){
      expect(Object.keys(theme.tokens).sort()).toEqual(Object.keys(themes[0].tokens).sort());
      expect(validateThemeTokens(token=>theme.tokens[token]).valid).toBe(true);
    }
  });
  for(const theme of Object.values(themeRegistry)){
    it(`${theme.label} mantém contraste de texto e ações nos pares previstos`,()=>{
      const pairs=[['text-primary','surface-page'],['text-secondary','surface-card'],['text-muted','surface-page'],['action-primary-text','action-primary'],['nav-text','nav-surface'],['nav-active-text','nav-active-surface'],...['success','warning','danger','info'].map(tone=>[`${tone}-text`,`${tone}-surface`])];
      for(const [text,surface] of pairs)for(const backdrop of [[0,0,0],[255,255,255]])expect(contrast(theme.tokens[`--arcd-${text}`],theme.tokens[`--arcd-${surface}`],backdrop),`${text} / ${surface}`).toBeGreaterThanOrEqual(4.5);
      if(theme.id==="vidro")for(const role of ["primary","secondary","muted"])for(const backdrop of [[0,0,0],[255,255,255]])expect(contrast(theme.tokens[`--arcd-text-${role}`],theme.tokens["--arcd-material-panel-surface"],backdrop),`texto ${role} sobre vidro`).toBeGreaterThanOrEqual(4.5);
      if(theme.id==="vidro")for(const role of ["success","danger"])for(const backdrop of [[0,0,0],[255,255,255]])expect(contrast(theme.tokens[`--arcd-${role}-text`],theme.tokens["--arcd-surface-card"],composite(color(theme.tokens["--arcd-material-panel-surface"]),backdrop)),`valor ${role} sobre cartão translúcido`).toBeGreaterThanOrEqual(4.5);
      expect(contrast(theme.tokens['--arcd-nav-focus'],theme.tokens['--arcd-nav-surface']),'foco da lateral').toBeGreaterThanOrEqual(3);
    });
  }
});
