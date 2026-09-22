export type PositionRelation = 'front' | 'side' | 'rear';
export type WorldPoint = { x: number; z: number };
export type PositionContext = {
  attackerPosition: WorldPoint;
  targetPosition: WorldPoint;
  targetForward: WorldPoint;
};
export type PositionAngles = { frontAngle?: number; rearAngle?: number };
/** Geometric defaults only, not a Thief bonus. Full cone angles in degrees.
 * Invalid/overlapping positions have no relation and cannot award rear payoff. */
export function relativePosition(context: PositionContext, angles: PositionAngles = {}): PositionRelation | undefined {
  const {attackerPosition:a,targetPosition:t,targetForward:f}=context;
  const x=a.x-t.x,z=a.z-t.z,d=Math.hypot(x,z),length=Math.hypot(f.x,f.z);
  if(!Number.isFinite(d+length)||d<1e-8||length<1e-8)return undefined;
  const cone=(value:number|undefined)=>Number.isFinite(value)?Math.min(180,Math.max(0,value!)):90;
  const dot=Math.min(1,Math.max(-1,(x*f.x+z*f.z)/(d*length)));
  if(dot>=Math.cos(cone(angles.frontAngle)*Math.PI/360)-1e-10)return 'front';
  if(-dot>=Math.cos(cone(angles.rearAngle)*Math.PI/360)-1e-10)return 'rear';
  return 'side';
}
/** Runtime actors face local -Z; camera orientation is deliberately not an input. */
export const forwardFromYaw = (yaw: number): WorldPoint => ({x:-Math.sin(yaw),z:-Math.cos(yaw)});
