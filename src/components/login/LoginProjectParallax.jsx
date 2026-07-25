import { useEffect } from "react";
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
  const x=useSpring(targetX,{stiffness:72,damping:24,mass:.8});
  const y=useSpring(targetY,{stiffness:72,damping:24,mass:.8});

  useEffect(()=>{
    if(reduceMotion||window.matchMedia("(pointer: coarse)").matches)return undefined;
    const move=event=>{
      const horizontal=event.clientX/window.innerWidth-.5;
      const vertical=event.clientY/window.innerHeight-.5;
      targetX.set(horizontal*-34);
      targetY.set(vertical*-22);
    };
    const reset=()=>{targetX.set(0);targetY.set(0);};
    window.addEventListener("pointermove",move,{passive:true});
    document.documentElement.addEventListener("mouseleave",reset);
    return ()=>{
      window.removeEventListener("pointermove",move);
      document.documentElement.removeEventListener("mouseleave",reset);
    };
  },[reduceMotion,targetX,targetY]);

  return <LazyMotion features={domAnimation} strict>
    <div className="login-project-visual" aria-hidden="true">
      <m.img
        className="login-project-image"
        src={projectHouse}
        alt=""
        draggable="false"
        style={{x:reduceMotion?0:x,y:reduceMotion?0:y}}
        initial={reduceMotion?false:{opacity:0,scale:1.1}}
        animate={{opacity:1,scale:1.065}}
        transition={{duration:1.25,ease:[.22,1,.36,1]}}
      />
    </div>
  </LazyMotion>;
}
