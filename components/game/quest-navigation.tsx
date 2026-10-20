'use client';
import {useEffect,useRef} from 'react';
import {Vector3} from 'three';
import type {Game} from '@/lib/game/world';
import {readDevelopmentQuestNavigation} from '@/lib/game/quest-navigation-game';
import './quest-navigation.css';

/** DOM is presentation only. The journal remains the sole quest state source. */
export function QuestNavigation({game,questId,onComplete}:{game:Game|null;questId:string|null;onComplete:()=>void}) {
  const element=useRef<HTMLDivElement>(null);
  useEffect(()=>{
    if(process.env.NODE_ENV==='production'||!game||!questId)return;
    const root=element.current!;
    let frame=0,last=-Infinity,previousId:string|undefined,region='',result:ReturnType<typeof readDevelopmentQuestNavigation>|undefined;
    const origin=new Vector3(),ahead=new Vector3(),head=new Vector3();
    const update=(now:number)=>{
      frame=requestAnimationFrame(update);
      if(game.disposed||game.transitioning||game.dead||!game.started||!game.actor.visible){root.hidden=true;result=undefined;previousId=undefined;last=-Infinity;return;}
      if(region!==game.activeLocationId){region=game.activeLocationId;previousId=undefined;last=-Infinity;}
      if(now-last>=250){result=readDevelopmentQuestNavigation(game,questId,previousId);last=now;previousId=result.target?.id;}
      if(!result)return;
      if(result.status==='complete'){root.hidden=true;onComplete();return;}
      const host=game.renderer.domElement.getBoundingClientRect();
      head.copy(game.actor.position);head.y+=2.2;head.project(game.camera);
      root.hidden=!Number.isFinite(head.x)||!Number.isFinite(head.y)||head.z < -1||head.z>1;
      if(root.hidden)return;
      root.style.left=`${host.left+(head.x*.5+.5)*host.width}px`;
      root.style.top=`${host.top+(-head.y*.5+.5)*host.height-18}px`;
      const arrow=root.querySelector<HTMLElement>('[data-quest-arrow]')!,label=root.querySelector<HTMLElement>('[data-quest-label]')!;
      arrow.hidden=result.status!=='route';
      label.textContent=result.target?`${result.target.label} · jalur ${Math.ceil(result.pathDistance!)} m`:result.reason;
      root.title=result.target?`Jarak lurus ${Math.ceil(result.straightDistance!)} m; jalur ${Math.ceil(result.pathDistance!)} m. Penunjuk tidak menggerakkan karakter.`:result.reason;
      root.dataset.status=result.status;root.dataset.target=result.target?.id??'';
      if(result.waypoint){
        const dx=result.waypoint.x-game.hero.x,dz=result.waypoint.z-game.hero.z,d=Math.hypot(dx,dz);
        origin.copy(game.actor.position);ahead.copy(origin);if(d){ahead.x+=dx/d;ahead.z+=dz/d;}
        origin.project(game.camera);ahead.project(game.camera);
        const sx=(ahead.x-origin.x)*host.width,sy=-(ahead.y-origin.y)*host.height;
        arrow.style.transform=`rotate(${Math.atan2(sy,sx)*180/Math.PI+90}deg)`;
        arrow.hidden=d<.6;
      }
    };
    frame=requestAnimationFrame(update);
    return()=>cancelAnimationFrame(frame);
  },[game,questId,onComplete]);
  if(process.env.NODE_ENV==='production'||!game||!questId)return null;
  return <div ref={element} className="development-quest-navigation" aria-label="Arah quest development" hidden>
    <span data-quest-arrow aria-hidden="true">↑</span><span data-quest-label />
  </div>;
}
