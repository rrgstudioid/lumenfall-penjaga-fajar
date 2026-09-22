import {applyStatus,hasStatus,removeStatus,type StatusTarget} from './combat-status.ts';
export type StealthBreakReason = 'offensive_skill' | 'damage_dealt' | 'basic_attack' | 'received_damage';
export type StealthPolicy = { breakOn: readonly StealthBreakReason[] };
// Policy is runtime-only; duration remains in the EXISTING simulation-ticked status store.
const policies = new WeakMap<StatusTarget, StealthPolicy>();
export const STEALTH_CAPABILITIES = Object.freeze({ combatCondition:true, enemyDetection:false, lineOfSight:false });
export function isStealthed(host: StatusTarget) {
  const active=hasStatus(host,'stealth');
  if(!active)policies.delete(host);
  return active;
}
export function enterStealth(host: StatusTarget, duration: number, policy: StealthPolicy = {breakOn:[]}) {
  if(!Number.isFinite(duration)||duration<=0)return false;
  // Recast replaces duration, preserving the legacy stealth assignment semantics.
  applyStatus(host,'stealth',duration);
  host.statusEffects!.stealth=duration;
  policies.set(host,{breakOn:[...policy.breakOn]});
  return true;
}
export function exitStealth(host: StatusTarget) {
  const wasActive=isStealthed(host);
  removeStatus(host,'stealth');policies.delete(host);
  return wasActive;
}
export function breakStealth(host: StatusTarget, reason: StealthBreakReason) {
  return isStealthed(host)&&policies.get(host)?.breakOn.includes(reason) ? exitStealth(host) : false;
}
