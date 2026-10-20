// Own fresh origin: never read native local/session storage.
const local=new Map(),session=new Map();
const memory=v=>({get length(){return v.size;},key:i=>[...v.keys()][i]??null,getItem:k=>v.get(String(k))??null,setItem:(k,x)=>v.set(String(k),String(x)),removeItem:k=>v.delete(String(k)),clear:()=>v.clear()});
Object.defineProperty(window,'localStorage',{value:memory(local),configurable:true});
Object.defineProperty(window,'sessionStorage',{value:memory(session),configurable:true});
window.__equipmentStorage={local,session};
const response=await fetch('/fixture-handoff'),handoff=await response.json();
for(const [key,value]of handoff.entries??[])local.set(key,value);
await import('./fixture.tsx');
