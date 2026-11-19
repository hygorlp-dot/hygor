import { useEffect, useRef } from "react";
import { BRAND } from "../../brand/identity.js";

// Cena "Planta em vidro" da tela de acesso. O parallax só escreve --px/--py
// (de -0,5 a 0,5) no contêiner .login-tech-shell; as camadas e a inclinação do
// cartão leem essas variáveis no CSS (themes/marcell.css). Sem mouse fino ou com
// "reduzir movimento" ativo, nada é ligado e a cena fica parada.
function useLoginParallax(ref){
  useEffect(()=>{
    const shell=ref.current?.closest(".login-tech-shell");
    if(!shell||typeof window.matchMedia!=="function")return undefined;
    const reduce=window.matchMedia("(prefers-reduced-motion: reduce)");
    const finePointer=window.matchMedia("(hover: hover) and (pointer: fine)");
    if(reduce.matches||!finePointer.matches)return undefined;
    let frame=0;
    const apply=(x,y)=>{
      cancelAnimationFrame(frame);
      frame=requestAnimationFrame(()=>{
        shell.style.setProperty("--px",x.toFixed(3));
        shell.style.setProperty("--py",y.toFixed(3));
      });
    };
    const onMove=event=>{
      const box=shell.getBoundingClientRect();
      if(!box.width||!box.height)return;
      apply((event.clientX-box.left)/box.width-.5,(event.clientY-box.top)/box.height-.5);
    };
    const onLeave=()=>apply(0,0);
    shell.addEventListener("pointermove",onMove,{passive:true});
    shell.addEventListener("pointerleave",onLeave);
    return ()=>{
      cancelAnimationFrame(frame);
      shell.removeEventListener("pointermove",onMove);
      shell.removeEventListener("pointerleave",onLeave);
      shell.style.removeProperty("--px");
      shell.style.removeProperty("--py");
    };
  },[ref]);
}

export default function LoginBrandPanel(){
  const ref=useRef(null);
  useLoginParallax(ref);
  return <>
    <div ref={ref} className="mrc-login-scene" aria-hidden="true">
      <div className="mrc-login-layer mrc-login-layer--grid">
        <span className="mrc-login-grid"/>
        <span className="mrc-login-grid mrc-login-grid--major"/>
      </div>
      <div className="mrc-login-layer mrc-login-layer--far">
        <span className="mrc-login-orb mrc-login-orb--steel-xl"/>
        <span className="mrc-login-orb mrc-login-orb--gold-xl"/>
      </div>
      <div className="mrc-login-layer mrc-login-layer--emblem">
        <img src={BRAND.emblemOnDark} alt="" className="mrc-login-emblem" width="1180" height="1088"/>
        <span className="mrc-login-scan"/>
      </div>
      <div className="mrc-login-layer mrc-login-layer--near">
        <span className="mrc-login-pane mrc-login-pane--tall"/>
        <span className="mrc-login-pane mrc-login-pane--wide"/>
        <span className="mrc-login-orb mrc-login-orb--gold"/>
        <span className="mrc-login-orb mrc-login-orb--ice"/>
        <span className="mrc-login-orb mrc-login-orb--steel"/>
      </div>
    </div>
    <section className="mrc-login-brand" aria-label="MARCELL Engenharia e construção">
      <div className="mrc-login-mark">
        <img src={BRAND.fullLogoOnDark} alt="MARCELL" width="400" height="369" className="mrc-login-signature"/>
      </div>
      <p className="mrc-login-statement">Engenharia que dá forma <span>à confiança.</span></p>
      <span className="mrc-login-rule" aria-hidden="true"/>
    </section>
  </>;
}
