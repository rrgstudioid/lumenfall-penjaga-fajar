import type { Game } from './world';
type Listener = (event: Readonly<{type:'created'|'disposed';game:Game}>) => void;
let listener: Listener | null = null;
/** Explicit isolated development harness enrollment, never a saved/query flag. */
export function registerDevelopmentHomeLifecycle(next: Listener): () => void {
  if(process.env.NODE_ENV!=='development')return ()=>{};
  if(listener)throw new Error('Development Home lifecycle already registered');
  listener=next;
  return ()=>{if(listener===next)listener=null;};
}
export function notifyDevelopmentHomeLifecycle(type:'created'|'disposed',game:Game) {
  if(process.env.NODE_ENV==='development')listener?.(Object.freeze({type,game}));
}
