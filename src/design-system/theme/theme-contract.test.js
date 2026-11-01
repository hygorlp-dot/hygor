import {describe,it,expect} from 'vitest';
import {themeRegistry} from '../themes/themeRegistry.js';
import {validateThemeTokens} from './themeValidation.js';

const luminance=hex=>{
  const rgb=hex.match(/[a-f0-9]{2}/gi).map(c=>parseInt(c,16)/255).map(c=>c<=.04045?c/12.92:((c+.055)/1.055)**2.4);
  return rgb[0]*.2126+rgb[1]*.7152+rgb[2]*.0722;
};
const contrast=(a,b)=>{const values=[luminance(a),luminance(b)].sort((x,y)=>y-x);return (values[0]+.05)/(values[1]+.05);};
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
      for(const [text,surface] of pairs)expect(contrast(theme.tokens[`--arcd-${text}`],theme.tokens[`--arcd-${surface}`]),`${text} / ${surface}`).toBeGreaterThanOrEqual(4.5);
    });
  }
});
