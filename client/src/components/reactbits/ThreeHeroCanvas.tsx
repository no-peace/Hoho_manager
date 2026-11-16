import React, { useEffect, useRef } from "react";

interface ConstellationNode {
  xRatio: number; yRatio: number; radius: number; color: string;
  alpha: number; phase: number; speed: number;
}

const CONSTELLATION_NODES: ConstellationNode[] = [
  { xRatio:.08,yRatio:.14,radius:2.2,color:"129, 140, 248",alpha:.55,phase:.2,speed:.9 },
  { xRatio:.19,yRatio:.09,radius:1.8,color:"167, 139, 250",alpha:.42,phase:1.1,speed:.7 },
  { xRatio:.15,yRatio:.26,radius:2.5,color:"129, 140, 248",alpha:.62,phase:2,speed:1.1 },
  { xRatio:.28,yRatio:.19,radius:1.7,color:"96, 165, 250",alpha:.38,phase:.7,speed:.8 },
  { xRatio:.36,yRatio:.11,radius:2.1,color:"129, 140, 248",alpha:.48,phase:1.6,speed:1 },
  { xRatio:.48,yRatio:.16,radius:1.9,color:"167, 139, 250",alpha:.4,phase:2.5,speed:.85 },
  { xRatio:.63,yRatio:.10,radius:2.4,color:"129, 140, 248",alpha:.58,phase:.4,speed:.95 },
  { xRatio:.74,yRatio:.18,radius:2.6,color:"52, 211, 153",alpha:.52,phase:1.9,speed:.75 },
  { xRatio:.86,yRatio:.12,radius:2,color:"129, 140, 248",alpha:.48,phase:2.8,speed:1.05 },
  { xRatio:.91,yRatio:.27,radius:2.3,color:"167, 139, 250",alpha:.54,phase:.9,speed:.8 },
  { xRatio:.79,yRatio:.33,radius:1.8,color:"96, 165, 250",alpha:.4,phase:1.4,speed:.9 },
  { xRatio:.11,yRatio:.44,radius:2.1,color:"52, 211, 153",alpha:.46,phase:2.2,speed:.7 },
  { xRatio:.24,yRatio:.38,radius:1.9,color:"129, 140, 248",alpha:.42,phase:3,speed:.85 },
  { xRatio:.88,yRatio:.48,radius:2.2,color:"129, 140, 248",alpha:.5,phase:1.2,speed:.95 },
];
const CONSTELLATION_EDGES: Array<[number,number]> = [[0,1],[0,2],[1,3],[2,3],[3,4],[4,5],[5,6],[6,7],[7,8],[7,9],[7,10],[9,10],[2,11],[2,12],[3,12],[10,13]];

export const ThreeHeroCanvas: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const context = canvas.getContext("2d", { alpha: true });
    if (!context) return;
    const mediaQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    let frame = 0, idleId: number | null = null, timeoutId: number | null = null;
    let width = 0, height = 0, lastFrame = 0, disposed = false;
    const resize = () => {
      const parent = canvas.parentElement;
      width = parent?.clientWidth || window.innerWidth;
      height = parent?.clientHeight || window.innerHeight;
      const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
      canvas.width = Math.max(1, Math.floor(width*dpr));
      canvas.height = Math.max(1, Math.floor(height*dpr));
      canvas.style.width = width+"px"; canvas.style.height = height+"px";
      context.setTransform(dpr,0,0,dpr,0,0);
    };
    const draw = (time: number) => {
      context.clearRect(0,0,width,height);
      const nodes = CONSTELLATION_NODES.map(n => ({...n,x:n.xRatio*width+Math.sin(time*n.speed+n.phase)*10,y:n.yRatio*height+Math.cos(time*n.speed*.85+n.phase)*8}));
      context.lineWidth = 1;
      for (const [a,b] of CONSTELLATION_EDGES) {
        const from=nodes[a],to=nodes[b]; if(!from||!to) continue;
        const gradient=context.createLinearGradient(from.x,from.y,to.x,to.y);
        gradient.addColorStop(0,`rgba(${from.color},.16)`); gradient.addColorStop(1,`rgba(${to.color},.16)`);
        context.strokeStyle=gradient; context.beginPath(); context.moveTo(from.x,from.y); context.lineTo(to.x,to.y); context.stroke();
      }
      for (const n of nodes) {
        const alpha=n.alpha*(.85+.15*Math.sin(time*1.6+n.phase));
        context.fillStyle=`rgba(${n.color},${alpha*.24})`; context.beginPath(); context.arc(n.x,n.y,n.radius*3.4,0,Math.PI*2); context.fill();
        context.fillStyle=`rgba(${n.color},${alpha})`; context.beginPath(); context.arc(n.x,n.y,n.radius,0,Math.PI*2); context.fill();
      }
      const cols=width<640?14:24, rows=width<640?7:10, horizon=height*.52;
      for(let row=0;row<rows;row++){
        const depth=row/Math.max(1,rows-1), scale=.42+depth*.78;
        for(let col=0;col<cols;col++){
          const nx=(col-(cols-1)/2)/((cols-1)/2);
          const wave=Math.sin(col*.42+time*1.15+row*.35)*12+Math.cos(row*.55-time*.9)*8;
          const x=width*.5+nx*(width*.56)*scale, y=horizon+depth*(height*.44)+wave*scale;
          const rgb=(row+col)%7===0?"52, 211, 153":row%2===0?"129, 140, 248":"167, 139, 250";
          context.fillStyle=`rgba(${rgb},${Math.min(.58,.16+depth*.36)})`; context.beginPath(); context.arc(x,y,Math.max(1,1.15+depth*1.35),0,Math.PI*2); context.fill();
        }
      }
    };
    const tick=(timestamp:number)=>{
      if(disposed)return;
      if(timestamp-lastFrame>=34){lastFrame=timestamp;draw(timestamp*.001);}
      frame=window.requestAnimationFrame(tick);
    };
    const start=()=>{if(!disposed&&!mediaQuery.matches&&!frame)frame=window.requestAnimationFrame(tick);};
    resize(); draw(1.25);
    const win=window as Window & {requestIdleCallback?:(cb:()=>void,opts?:{timeout:number})=>number;cancelIdleCallback?:(id:number)=>void};
    if(!mediaQuery.matches && window.innerWidth>=640 && (navigator.hardwareConcurrency||8)>4){
      if(typeof win.requestIdleCallback==="function") idleId=win.requestIdleCallback(start,{timeout:1200});
      else timeoutId=window.setTimeout(start,450);
    }
    window.addEventListener("resize",resize);
    return ()=>{
      disposed=true; window.cancelAnimationFrame(frame);
      if(idleId!==null&&typeof win.cancelIdleCallback==="function")win.cancelIdleCallback(idleId);
      if(timeoutId!==null)window.clearTimeout(timeoutId);
      window.removeEventListener("resize",resize);
    };
  },[]);
  return <canvas ref={canvasRef} aria-hidden="true" className="pointer-events-none absolute inset-0 h-full w-full opacity-90" />;
};
