import { useEffect, useRef } from "react";
import {
  LazyMotion,
  domAnimation,
  m,
  useMotionValue,
  useReducedMotion,
  useSpring,
} from "motion/react";
import projectHouse from "../../assets/login-projects.png";

export default function LoginProjectParallax(){
  const reduceMotion=useReducedMotion();
  const targetX=useMotionValue(0);
  const targetY=useMotionValue(0);
  const targetRotateX=useMotionValue(0);
  const targetRotateY=useMotionValue(0);
  const targetRotateZ=useMotionValue(0);
  const x=useSpring(targetX,{stiffness:72,damping:24,mass:.8});
  const y=useSpring(targetY,{stiffness:72,damping:24,mass:.8});
  const rotateX=useSpring(targetRotateX,{stiffness:96,damping:19,mass:.7});
  const rotateY=useSpring(targetRotateY,{stiffness:96,damping:19,mass:.7});
  const rotateZ=useSpring(targetRotateZ,{stiffness:110,damping:17,mass:.65});
  const previousPointer=useRef(null);
  const settleTimer=useRef(null);

  useEffect(()=>{
    if(reduceMotion||window.matchMedia("(pointer: coarse)").matches)return undefined;
    const reset=()=>{
      targetX.set(0);targetY.set(0);
      targetRotateX.set(0);targetRotateY.set(0);targetRotateZ.set(0);
      previousPointer.current=null;
    };
    const settle=(horizontal,vertical)=>{
      targetRotateY.set(horizontal*-3.4);
      targetRotateX.set(vertical*2.5);
      targetRotateZ.set(0);
    };
    const move=event=>{
      const horizontal=event.clientX/window.innerWidth-.5;
      const vertical=event.clientY/window.innerHeight-.5;
      targetX.set(horizontal*-34);
      targetY.set(vertical*-22);
      const previous=previousPointer.current;
      if(previous){
        const deltaX=Math.max(-1,Math.min(1,(event.clientX-previous.x)/70));
        const deltaY=Math.max(-1,Math.min(1,(event.clientY-previous.y)/70));
        // A casa "inclina" para o lado em que o cursor viaja. A posição do
        // cursor mantém uma perspectiva discreta quando o mouse para.
        targetRotateY.set(Math.max(-7,Math.min(7,horizontal*-3.4-deltaX*5.5)));
        targetRotateX.set(Math.max(-5,Math.min(5,vertical*2.5+deltaY*4.2)));
        targetRotateZ.set(Math.max(-2.2,Math.min(2.2,deltaX*1.7)));
      }else settle(horizontal,vertical);
      previousPointer.current={x:event.clientX,y:event.clientY};
      window.clearTimeout(settleTimer.current);
      settleTimer.current=window.setTimeout(()=>settle(horizontal,vertical),90);
    };
    window.addEventListener("pointermove",move,{passive:true});
    document.documentElement.addEventListener("mouseleave",reset);
    return ()=>{
      window.removeEventListener("pointermove",move);
      document.documentElement.removeEventListener("mouseleave",reset);
      window.clearTimeout(settleTimer.current);
    };
  },[reduceMotion,targetX,targetY]);

  return <LazyMotion features={domAnimation} strict>
    <div className="login-project-visual" aria-hidden="true">
      <m.img
        className="login-project-image"
        src={projectHouse}
        alt=""
        draggable="false"
        style={{
          x:reduceMotion?0:x,y:reduceMotion?0:y,
          rotateX:reduceMotion?0:rotateX,rotateY:reduceMotion?0:rotateY,
          rotateZ:reduceMotion?0:rotateZ,transformPerspective:1100,
        }}
        initial={reduceMotion?false:{opacity:0,scale:1.1}}
        animate={{opacity:1,scale:1.065}}
        transition={{duration:1.25,ease:[.22,1,.36,1]}}
      />
    </div>
  </LazyMotion>;
}
