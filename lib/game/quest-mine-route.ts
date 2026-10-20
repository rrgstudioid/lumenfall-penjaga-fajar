import {MINE_ROUTES,MINE_ROOMS,MineNavigation,type MinePoint} from './ironveil-interior-layout';
// Read-only wayfinding over the existing mine's routes and collision. No movement or terrain edits.
const nav=new MineNavigation(),distance=(a:MinePoint,b:MinePoint)=>Math.hypot(a.x-b.x,a.z-b.z);
const clear=(a:MinePoint,b:MinePoint)=>{
 const n=Math.max(1,Math.ceil(distance(a,b)/.3));
 for(let i=0;i<=n;i++)if(!nav.valid({x:a.x+(b.x-a.x)*i/n,z:a.z+(b.z-a.z)*i/n},.55))return false;
 return true;
};
let cached:{points:MinePoint[];edges:Array<Array<{to:number;cost:number}>>}|undefined;
function graph(){
 if(cached)return cached;
 const points:MinePoint[]=[];
 for(const r of MINE_ROUTES)for(let i=1;i<r.points.length;i++){
  const a=r.points[i-1],b=r.points[i],n=Math.ceil(distance(a,b)/35);
  for(let j=0;j<=n;j++){const p={x:a.x+(b.x-a.x)*j/n,z:a.z+(b.z-a.z)*j/n};if(nav.valid(p,.55)&&!points.some(q=>distance(q,p)<.1))points.push(p);}
 }
 for(const r of MINE_ROOMS)if(nav.valid(r,.55))points.push({x:r.x,z:r.z});
 const edges=points.map(()=>[] as Array<{to:number;cost:number}>);
 for(let a=0;a<points.length;a++)for(let b=a+1;b<points.length;b++){const cost=distance(points[a],points[b]);if(cost<=150&&clear(points[a],points[b])){edges[a].push({to:b,cost});edges[b].push({to:a,cost});}}
 return cached={points,edges};
}
export function questMineRoute(from:MinePoint,to:MinePoint):MinePoint[]{
 if(!nav.valid(from,.55)||!nav.valid(to,.55))return [];
 if(clear(from,to))return [{...to}];
 const g=graph(),points=[...g.points,{...from},{...to}],start=points.length-2,end=start+1;
 const edges=g.edges.map(e=>[...e]);edges.push([],[]);
 for(const index of [start,end])for(let j=0;j<g.points.length;j++){const cost=distance(points[index],points[j]);if(cost<=220&&clear(points[index],points[j])){edges[index].push({to:j,cost});edges[j].push({to:index,cost});}}
 const costs=points.map(()=>Infinity),parent=points.map(()=>-1),done=new Set<number>();costs[start]=0;
 for(let step=0;step<points.length;step++){
  let best=-1;for(let i=0;i<points.length;i++)if(!done.has(i)&&Number.isFinite(costs[i])&&(best<0||costs[i]<costs[best]))best=i;
  if(best<0)break;if(best===end){const route:MinePoint[]=[];for(let i=end;i!==start;i=parent[i])route.unshift({...points[i]});return route;}
  done.add(best);for(const edge of edges[best])if(costs[best]+edge.cost<costs[edge.to]){costs[edge.to]=costs[best]+edge.cost;parent[edge.to]=best;}
 }
 return [];
}
