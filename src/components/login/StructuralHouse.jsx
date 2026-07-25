import {
  LazyMotion,
  domAnimation,
  m,
  useMotionValue,
  useReducedMotion,
  useSpring,
  useTransform,
} from "motion/react";

const draw = (delay = 0, duration = 1.2) => ({
  initial:{pathLength:0,opacity:0},
  animate:{pathLength:1,opacity:1},
  transition:{delay,duration,ease:[0.22,1,0.36,1]},
});

const structuralLines = [
  ["M164 436 L466 506 L665 374 L349 302 Z",.15],
  ["M164 436 L164 290 M466 506 L466 354 M665 374 L665 225 M349 302 L349 151",.28],
  ["M164 290 L466 354 L665 225 L349 151 Z",.42],
  ["M164 290 L349 151 L535 217 L665 225",.58],
  ["M466 354 L535 217 M349 151 L466 354",.66],
  ["M225 450 L225 303 M287 464 L287 316 M405 492 L405 340",.76],
  ["M507 478 L507 327 M557 445 L557 293 M612 409 L612 257",.84],
];

const floorLines = [
  "M224 450 L409 323 L608 368",
  "M285 464 L470 337 L558 445",
  "M405 492 L590 365",
  "M164 388 L466 456 L665 324",
];

const dimensionLines = [
  {d:"M140 454 L449 526",label:"12,40 m",x:286,y:510},
  {d:"M690 376 L690 217",label:"6,20 m",x:712,y:300},
  {d:"M342 126 L544 197",label:"8,75 m",x:452,y:146},
];

export default function StructuralHouse(){
  const reduceMotion=useReducedMotion();
  const tiltX=useMotionValue(0);
  const tiltY=useMotionValue(0);
  const rotateX=useSpring(tiltX,{stiffness:90,damping:22,mass:.7});
  const rotateY=useSpring(tiltY,{stiffness:90,damping:22,mass:.7});
  const lightX=useTransform(rotateY,[-5,5],["42%","58%"]);

  const mover=event=>{
    if(reduceMotion||event.pointerType==="touch")return;
    const rect=event.currentTarget.getBoundingClientRect();
    tiltY.set(((event.clientX-rect.left)/rect.width-.5)*8);
    tiltX.set(-((event.clientY-rect.top)/rect.height-.5)*6);
  };
  const reset=()=>{tiltX.set(0);tiltY.set(0);};

  return <LazyMotion features={domAnimation} strict><div className="login-house-viewport" aria-hidden="true" onPointerMove={mover} onPointerLeave={reset}>
    <m.div
      className="login-house-stage"
      style={{rotateX:reduceMotion?0:rotateX,rotateY:reduceMotion?0:rotateY,"--house-light-x":lightX}}
      initial={reduceMotion?false:{opacity:0,scale:.94,y:18}}
      animate={{opacity:1,scale:1,y:0}}
      transition={{duration:.9,ease:[.22,1,.36,1]}}
    >
      <m.div
        className="login-house-orbit login-house-orbit-a"
        animate={reduceMotion?undefined:{rotate:360}}
        transition={{duration:28,repeat:Infinity,ease:"linear"}}
      />
      <m.div
        className="login-house-orbit login-house-orbit-b"
        animate={reduceMotion?undefined:{rotate:-360}}
        transition={{duration:38,repeat:Infinity,ease:"linear"}}
      />

      <svg className="login-house-svg" viewBox="70 70 700 500" role="presentation">
        <defs>
          <linearGradient id="house-glass-front" x1="0" x2="1">
            <stop offset="0" stopColor="#e8edf0" stopOpacity=".03"/>
            <stop offset=".55" stopColor="#cad5db" stopOpacity=".15"/>
            <stop offset="1" stopColor="#d4af37" stopOpacity=".08"/>
          </linearGradient>
          <linearGradient id="house-glass-side" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#dce5e9" stopOpacity=".14"/>
            <stop offset="1" stopColor="#97a8b0" stopOpacity=".025"/>
          </linearGradient>
          <linearGradient id="house-floor" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#d4af37" stopOpacity=".13"/>
            <stop offset="1" stopColor="#d4af37" stopOpacity=".01"/>
          </linearGradient>
          <filter id="house-soft-glow" x="-30%" y="-30%" width="160%" height="160%">
            <feGaussianBlur stdDeviation="3" result="blur"/>
            <feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>
          </filter>
        </defs>

        <m.ellipse className="login-house-ground" cx="414" cy="479" rx="292" ry="72"
          initial={reduceMotion?false:{opacity:0,scale:.75}}
          animate={{opacity:1,scale:1}}
          transition={{delay:.2,duration:1.1,ease:[.22,1,.36,1]}}
        />

        <m.polygon points="164,436 466,506 665,374 349,302" fill="url(#house-floor)"
          initial={reduceMotion?false:{opacity:0}}
          animate={{opacity:1}}
          transition={{delay:.2,duration:.9}}
        />

        <m.g className="login-house-glass"
          initial={reduceMotion?false:{opacity:0,y:10}}
          animate={{opacity:1,y:0}}
          transition={{delay:.88,duration:1}}
        >
          <polygon points="164,290 466,354 466,506 164,436" fill="url(#house-glass-front)"/>
          <polygon points="466,354 665,225 665,374 466,506" fill="url(#house-glass-side)"/>
          <polygon points="164,290 349,151 535,217 466,354" fill="url(#house-glass-front)"/>
          <polygon points="349,151 535,217 665,225 466,354" fill="url(#house-glass-side)"/>
        </m.g>

        <g className="login-house-floor-lines">
          {floorLines.map((d,index)=><m.path key={d} d={d} {...(reduceMotion?{}:draw(.45+index*.08,.9))}/>)}
        </g>

        <g className="login-house-structure" filter="url(#house-soft-glow)">
          {structuralLines.map(([d,delay],index)=><m.path
            key={d} d={d} className={index<3?"login-house-primary":"login-house-secondary"}
            {...(reduceMotion?{}:draw(delay,1.05))}
          />)}
        </g>

        <m.g className="login-house-core"
          initial={reduceMotion?false:{opacity:0,scaleY:.2}}
          animate={{opacity:1,scaleY:1}}
          transition={{delay:.72,duration:.65,ease:[.22,1,.36,1]}}
          style={{transformOrigin:"300px 395px"}}
        >
          <path d="M256 458 L256 340 L326 355 L326 474 Z"/>
          <path d="M273 445 L273 385 L308 392 L308 453 Z" className="login-house-door"/>
        </m.g>

        <g className="login-house-dimensions">
          {dimensionLines.map((item,index)=><m.g key={item.d}
            initial={reduceMotion?false:{opacity:0}}
            animate={{opacity:1}}
            transition={{delay:1.05+index*.13,duration:.5}}
          >
            <path d={item.d}/>
            <text x={item.x} y={item.y}>{item.label}</text>
          </m.g>)}
        </g>

        <m.g className="login-house-project-points"
          initial={reduceMotion?false:{opacity:0}}
          animate={{opacity:1}}
          transition={{delay:1.25,duration:.5}}
        >
          {[[164,436],[466,506],[665,374],[349,302],[164,290],[466,354],[665,225],[349,151],[535,217]]
            .map(([cx,cy],index)=><m.circle key={`${cx}-${cy}`} cx={cx} cy={cy} r="3"
              animate={reduceMotion?undefined:{opacity:[.35,1,.35],r:[2.5,4,2.5]}}
              transition={{duration:2.8,delay:index*.18,repeat:Infinity,ease:"easeInOut"}}
            />)}
        </m.g>

        <m.g className="login-house-callout"
          initial={reduceMotion?false:{opacity:0,x:-8}}
          animate={{opacity:1,x:0}}
          transition={{delay:1.48,duration:.55}}
        >
          <path d="M535 217 L598 154 L682 154"/>
          <text x="605" y="143">ESTRUTURA BIM</text>
          <text x="605" y="164" className="login-house-callout-sub">MODELO COORDENADO</text>
        </m.g>
      </svg>

      <m.div className="login-house-scan"
        animate={reduceMotion?undefined:{y:["-10%","510%"],opacity:[0,.65,0]}}
        transition={{duration:6.5,repeat:Infinity,ease:"linear",times:[0,.14,1]}}
      />
      <div className="login-house-status"><span/> MODELO SINCRONIZADO · LOD 300</div>
    </m.div>
  </div></LazyMotion>;
}
