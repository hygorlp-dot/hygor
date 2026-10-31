import {useEffect} from 'react';
export function useVisualViewportBounds(ref){
 useEffect(()=>{
  const viewport=window.visualViewport;let frame;
  const apply=()=>{const node=ref.current;if(!node)return;node.style.setProperty('--mrc-viewport-height',`${viewport?.height||window.innerHeight}px`);node.style.setProperty('--mrc-viewport-offset-top',`${viewport?.offsetTop||0}px`);};
  const update=()=>{cancelAnimationFrame(frame);frame=requestAnimationFrame(apply);};
  apply();viewport?.addEventListener('resize',update);viewport?.addEventListener('scroll',update);window.addEventListener('resize',update);
  return()=>{cancelAnimationFrame(frame);viewport?.removeEventListener('resize',update);viewport?.removeEventListener('scroll',update);window.removeEventListener('resize',update);};
 },[ref]);
}
