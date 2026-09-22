import * as T from 'three';

export type TargetView = {
  id: number;
  instanceId: string;
  name: string;
  level?: number;
  hp: number;
  maxHP: number;
  armorBreakRemaining?: number;
  marked?: boolean;
  markRemaining?: number;
};
/** One reusable ring/frame per world; no new input listeners or model materials. */
export class TargetPresentation {
  readonly ring = new T.Mesh(
    new T.RingGeometry(0.86, 1, 48),
    new T.MeshBasicMaterial({
      color: 0xffda72,
      transparent: true,
      opacity: 0.95,
      depthWrite: false,
      side: T.DoubleSide,
    }),
  );
  readonly frame: HTMLDivElement;
  private name: HTMLDivElement;
  private hp: HTMLDivElement;
  private bar: HTMLProgressElement;
  private status: HTMLDivElement;
  private last = '';
  constructor(host: HTMLElement) {
    this.ring.rotation.x = -Math.PI / 2;
    this.ring.position.y = 0.11;
    this.ring.name = 'current-target-ring';
    this.ring.raycast = () => {};
    this.frame = document.createElement('div');
    this.frame.className = 'current-target-frame';
    this.frame.dataset.gameUi = 'target-frame';
    this.frame.setAttribute('role', 'status');
    this.frame.setAttribute('aria-label', 'Selected enemy');
    this.name = document.createElement('div');
    this.hp = document.createElement('div');
    this.bar = document.createElement('progress');
    this.bar.setAttribute('aria-label', 'Target HP');
    this.status = document.createElement('div');
    this.status.className = 'target-status-row';
    for (const element of [this.name, this.bar, this.hp, this.status])
      this.frame.appendChild(element);
    this.frame.hidden = true;
    host.appendChild(this.frame);
  }
  show(group: T.Group, view: TargetView, radius = 1) {
    if (this.ring.parent !== group) group.add(this.ring);
    this.ring.scale.setScalar(Math.max(0.8, radius));
    this.ring.visible = true;
    this.frame.hidden = false;
    const key = JSON.stringify(view);
    if (this.last === key) return;
    this.last = key;
    this.name.textContent =
      view.name + (view.level !== undefined ? ` · Lv${view.level}` : '');
    this.bar.max = Math.max(1, view.maxHP);
    this.bar.value = Math.max(0, view.hp);
    this.hp.textContent = `${Math.ceil(view.hp).toLocaleString('en-US')} / ${Math.ceil(view.maxHP).toLocaleString('en-US')} HP`;
    const statuses: string[] = [];
    if(view.marked)statuses.push('MARKED'+((view.markRemaining??0)>0?` · ${view.markRemaining!.toFixed(1)}s`:''));
    if ((view.armorBreakRemaining ?? 0) > 0) statuses.push(`ARMOR BREAK · ${view.armorBreakRemaining!.toFixed(1)}s`);
    this.status.textContent = statuses.join('  ·  ');
    this.status.hidden = statuses.length === 0;
    this.frame.dataset.targetId = String(view.id);
  }
  clear() {
    this.ring.removeFromParent();
    this.ring.visible = false;
    this.frame.hidden = true;
    this.last = '';
    delete this.frame.dataset.targetId;
  }
  dispose() {
    this.clear();
    this.ring.geometry.dispose();
    this.ring.material.dispose();
    this.frame.remove();
  }
}
