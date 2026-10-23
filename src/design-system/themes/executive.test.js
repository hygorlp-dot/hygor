import {readFileSync} from "node:fs";
import {resolve} from "node:path";
import {expect,it} from "vitest";

const source=readFileSync(resolve(process.cwd(),"src/design-system/tokens/primitives.css"),"utf8");
const color=name=>source.match(new RegExp(`--arcd-${name}:\\s*(#[a-f0-9]{6})`,"i"))[1];
function luminance(hex){const c=hex.slice(1).match(/../g).map(x=>parseInt(x,16)/255).map(x=>x<=.04045?x/12.92:((x+.055)/1.055)**2.4);return .2126*c[0]+.7152*c[1]+.0722*c[2];}
function contrast(a,b){const x=luminance(a),y=luminance(b);return (Math.max(x,y)+.05)/(Math.min(x,y)+.05);}
it("preserva contraste de texto, seleção e estados sobre branco e marfim",()=>{
  for(const ink of ["gray-900","gray-500","gray-600","gold-400","green-500","red-500","orange-500","blue-500"]){
    for(const paper of ["gray-0","gray-50"]){expect(contrast(color(ink),color(paper)),`${ink} sobre ${paper}`).toBeGreaterThanOrEqual(4.5);}
  }
  expect(contrast(color("gold-400"),color("gold-300"))).toBeGreaterThanOrEqual(4.5);
});
