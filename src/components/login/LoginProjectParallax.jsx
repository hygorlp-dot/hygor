import { useEffect, useRef, useState } from "react";
import {
  LazyMotion,
  domAnimation,
  m,
  useMotionValue,
  useReducedMotion,
  useSpring,
} from "motion/react";
import projectHouse from "../../assets/login-projects-depth.webp";
import architecturalLandscape from "../../assets/login-architectural-landscape.webp";

const loginBackgroundVideoUrl=(import.meta.env.VITE_LOGIN_BACKGROUND_VIDEO_URL||"/media/login-background.webm").trim();

export default function LoginProjectParallax({logoSrc=""}){
  const reduceMotion=useReducedMotion();
  const [videoFailed,setVideoFailed]=useState(false);
  const saveData=typeof navigator!=="undefined"&&navigator.connection?.saveData;
  const showVideo=Boolean(loginBackgroundVideoUrl)&&!reduceMotion&&!saveData&&!videoFailed;
  const landscapeTargetX=useMotionValue(0);
  const landscapeTargetY=useMotionValue(0);
  const houseTargetX=useMotionValue(0);
  const houseTargetY=useMotionValue(0);
  const houseTargetRotateX=useMotionValue(0);
  const houseTargetRotateY=useMotionValue(0);
  const visualRef=useRef(null);
  const landscapeX=useSpring(landscapeTargetX,{stiffness:48,damping:30,mass:1.15});
  const landscapeY=useSpring(landscapeTargetY,{stiffness:48,damping:30,mass:1.15});
  const houseX=useSpring(houseTargetX,{stiffness:58,damping:28,mass:.9});
  const houseY=useSpring(houseTargetY,{stiffness:58,damping:28,mass:.9});
  const houseRotateX=useSpring(houseTargetRotateX,{stiffness:62,damping:30,mass:.85});
  const houseRotateY=useSpring(houseTargetRotateY,{stiffness:62,damping:30,mass:.85});

  useEffect(()=>{
    if(reduceMotion||window.matchMedia("(pointer: coarse)").matches)return undefined;
    const visual=visualRef.current;
    if(!visual)return undefined;
    let rect=visual.getBoundingClientRect();
    const updateRect=()=>{rect=visual.getBoundingClientRect();};
    const reset=()=>{
      landscapeTargetX.set(0);landscapeTargetY.set(0);
      houseTargetX.set(0);houseTargetY.set(0);
      houseTargetRotateX.set(0);houseTargetRotateY.set(0);
    };
    const move=event=>{
      const horizontal=(event.clientX-rect.left)/rect.width-.5;
      const vertical=(event.clientY-rect.top)/rect.height-.5;
      // A camada distante acompanha a câmera de forma mínima. A casa reage um
      // pouco mais ao olhar para comunicar profundidade, sem girar no eixo Z.
      landscapeTargetX.set(horizontal*5);landscapeTargetY.set(vertical*3);
      houseTargetX.set(horizontal*-9);houseTargetY.set(vertical*-5);
      houseTargetRotateY.set(horizontal*-1.25);houseTargetRotateX.set(vertical*.85);
    };
    visual.addEventListener("pointermove",move,{passive:true});
    visual.addEventListener("pointerleave",reset);
    window.addEventListener("resize",updateRect);
    return ()=>{
      visual.removeEventListener("pointermove",move);
      visual.removeEventListener("pointerleave",reset);
      window.removeEventListener("resize",updateRect);
    };
  },[reduceMotion,landscapeTargetX,landscapeTargetY,houseTargetX,houseTargetY,houseTargetRotateX,houseTargetRotateY]);

  return <LazyMotion features={domAnimation} strict>
    <div ref={visualRef} className="login-project-visual" aria-hidden="true">
      {showVideo?<m.video
        className="login-project-image login-project-landscape login-project-video"
        src={loginBackgroundVideoUrl}
        poster={architecturalLandscape}
        autoPlay muted loop playsInline preload="metadata"
        onError={()=>setVideoFailed(true)}
        style={{
          x:landscapeX,y:landscapeY,
          transformPerspective:1100,
        }}
        initial={{opacity:0,scale:1.1}}
        animate={{opacity:1,scale:1.065}}
        transition={{duration:1.25,ease:[.22,1,.36,1]}}
      />:<m.img
        className="login-project-image login-project-landscape"
        src={architecturalLandscape}
        alt=""
        draggable="false"
        style={{
          x:reduceMotion?0:landscapeX,y:reduceMotion?0:landscapeY,
          transformPerspective:1100,
        }}
        initial={reduceMotion?false:{opacity:0,scale:1.1}}
        animate={{opacity:1,scale:1.065}}
        transition={{duration:1.25,ease:[.22,1,.36,1]}}
      />}
      {!showVideo&&<div className="login-project-house-layer">
        <m.img
          className="login-project-image login-project-house"
          src={projectHouse}
          alt=""
          draggable="false"
          style={{
            x:reduceMotion?0:houseX,y:reduceMotion?0:houseY,
            rotateX:reduceMotion?0:houseRotateX,rotateY:reduceMotion?0:houseRotateY,
            transformPerspective:1300,
          }}
          initial={false}
          animate={{opacity:1,scale:1.075}}
          transition={{duration:1.25,ease:[.22,1,.36,1]}}
        />
      </div>}
      {logoSrc&&<img className="login-project-brand-watermark" src={logoSrc} alt="" draggable="false"/>}
    </div>
  </LazyMotion>;
}
