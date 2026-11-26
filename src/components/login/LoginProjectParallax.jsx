import { Suspense, useEffect, useRef, useState } from "react";
import { BRAND } from "../../brand/identity.js";
import { lazyWithCssRetry } from "../../lib/lazy-with-css-retry.js";
import DraftPlan from "./LoginDraftPlan.jsx";

// A cena usa o mesmo recorte em themes/marcell.css.
const NARROW_LOGIN = "(max-width:900px)";
const DesktopDraftingSet = lazyWithCssRetry(() => import("./LoginDraftingSet.jsx"));

function useShowDraftingSet() {
  const [visible, setVisible] = useState(() => !window.matchMedia?.(NARROW_LOGIN)?.matches);
  useEffect(() => {
    const query = window.matchMedia?.(NARROW_LOGIN);
    if (!query) return undefined;
    const update = () => setVisible(!query.matches);
    update();
    query.addEventListener("change", update);
    return () => query.removeEventListener("change", update);
  }, []);
  return visible;
}

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
  const showDraftingSet=useShowDraftingSet();
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
        <DraftPlan/>
        <span className="mrc-login-scan"/>
      </div>
      {showDraftingSet&&<Suspense fallback={null}><DesktopDraftingSet/></Suspense>}
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
