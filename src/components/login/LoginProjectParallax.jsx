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
  const landscapeTargetX=useMotionValue(0);
  const landscapeTargetY=useMotionValue(0);
  const houseTargetX=useMotionValue(0);
  const houseTargetY=useMotionValue(0);
  const houseTargetRotateX=useMotionValue(0);
  const houseTargetRotateY=useMotionValue(0);
  const houseTargetRotateZ=useMotionValue(0);
  const landscapeX=useSpring(landscapeTargetX,{stiffness:55,damping:28,mass:1.1});
  const landscapeY=useSpring(landscapeTargetY,{stiffness:55,damping:28,mass:1.1});
  const houseX=useSpring(houseTargetX,{stiffness:82,damping:22,mass:.75});
  const houseY=useSpring(houseTargetY,{stiffness:82,damping:22,mass:.75});
  const houseRotateX=useSpring(houseTargetRotateX,{stiffness:96,damping:19,mass:.7});
  const houseRotateY=useSpring(houseTargetRotateY,{stiffness:96,damping:19,mass:.7});
  const houseRotateZ=useSpring(houseTargetRotateZ,{stiffness:110,damping:17,mass:.65});
  const previousPointer=useRef(null);
  const settleTimer=useRef(null);

  useEffect(()=>{
    if(reduceMotion||window.matchMedia("(pointer: coarse)").matches)return undefined;
    const reset=()=>{
      landscapeTargetX.set(0);landscapeTargetY.set(0);
      houseTargetX.set(0);houseTargetY.set(0);
      houseTargetRotateX.set(0);houseTargetRotateY.set(0);houseTargetRotateZ.set(0);
      previousPointer.current=null;
    };
    const settle=(horizontal,vertical)=>{
      // A paisagem recua; a casa é a camada que o olhar acompanha.
      landscapeTargetX.set(horizontal*10);
      landscapeTargetY.set(vertical*7);
      houseTargetX.set(horizontal*-24);
      houseTargetY.set(vertical*-15);
      houseTargetRotateY.set(horizontal*-4.2);
      houseTargetRotateX.set(vertical*3.1);
      houseTargetRotateZ.set(0);
    };
    const move=event=>{
      const horizontal=event.clientX/window.innerWidth-.5;
      const vertical=event.clientY/window.innerHeight-.5;
      landscapeTargetX.set(horizontal*10);
      landscapeTargetY.set(vertical*7);
      houseTargetX.set(horizontal*-24);
      houseTargetY.set(vertical*-15);
      const previous=previousPointer.current;
      if(previous){
        const deltaX=Math.max(-1,Math.min(1,(event.clientX-previous.x)/70));
        const deltaY=Math.max(-1,Math.min(1,(event.clientY-previous.y)/70));
        // A casa "inclina" para o lado em que o cursor viaja. A posição do
        // cursor mantém uma perspectiva discreta quando o mouse para.
        houseTargetRotateY.set(Math.max(-7,Math.min(7,horizontal*-4.2-deltaX*5.5)));
        houseTargetRotateX.set(Math.max(-5,Math.min(5,vertical*3.1+deltaY*4.2)));
        houseTargetRotateZ.set(Math.max(-2.2,Math.min(2.2,deltaX*1.7)));
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
  },[reduceMotion,landscapeTargetX,landscapeTargetY,houseTargetX,houseTargetY,houseTargetRotateX,houseTargetRotateY,houseTargetRotateZ]);

  return <LazyMotion features={domAnimation} strict>
    <div className="login-project-visual" aria-hidden="true">
      <m.img
        className="login-project-image login-project-landscape"
        src={projectHouse}
        alt=""
        draggable="false"
        style={{
          x:reduceMotion?0:landscapeX,y:reduceMotion?0:landscapeY,
          transformPerspective:1100,
        }}
        initial={reduceMotion?false:{opacity:0,scale:1.1}}
        animate={{opacity:1,scale:1.065}}
        transition={{duration:1.25,ease:[.22,1,.36,1]}}
      />
      <div className="login-project-house-layer">
        <m.img
          className="login-project-image login-project-house"
          src={projectHouse}
          alt=""
          draggable="false"
          style={{
            x:reduceMotion?0:houseX,y:reduceMotion?0:houseY,
            rotateX:reduceMotion?0:houseRotateX,rotateY:reduceMotion?0:houseRotateY,
            rotateZ:reduceMotion?0:houseRotateZ,transformPerspective:1100,
          }}
          initial={false}
          animate={{opacity:1,scale:1.075}}
          transition={{duration:1.25,ease:[.22,1,.36,1]}}
        />
      </div>
    </div>
  </LazyMotion>;
}
