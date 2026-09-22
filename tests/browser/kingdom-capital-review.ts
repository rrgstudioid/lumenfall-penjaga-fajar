import * as T from 'three';

export type ReviewMode = 'PIN' | 'AREA' | 'OBJECT' | 'MEASURE';
export type ReviewCategory =
  | 'GENERAL'
  | 'ADD'
  | 'REMOVE'
  | 'MOVE'
  | 'TERRAIN'
  | 'ROAD'
  | 'BUILDING'
  | 'PROP'
  | 'VEGETATION'
  | 'GAMEPLAY'
  | 'BUG';
export type ReviewStatus = 'OPEN' | 'IMPLEMENTED' | 'HOLD' | 'REJECTED';

export type ReviewObjectRecord = {
  center: [number, number, number];
  size: [number, number, number];
  rotation: number;
  assetId: string;
  assetName: string;
  family: string;
  chunk: string;
  zone: string;
  sourcePack: string;
};

type Point = { x: number; y: number; z: number };
type Pin = Point & {
  id: string;
  mapId: string;
  zone: string;
  category: ReviewCategory;
  note: string;
  status: ReviewStatus;
  createdAt: string;
  reviewRevision: string;
};
type Area = {
  id: string;
  mapId: string;
  zone: string;
  category: ReviewCategory;
  note: string;
  status: ReviewStatus;
  createdAt: string;
  reviewRevision: string;
  points: Point[];
  areaM2: number;
};
type ObjectReview = ReviewObjectRecord & { id: string; mapId: string };
type Measurement = {
  id: string;
  points: Point[];
  horizontalM: number;
  deltaYM: number;
  distance3dM: number;
};

const COLORS = {
  pin: 0xe8c96c,
  area: 0x78b79d,
  object: 0xd58a62,
  anchor: 0x96b5ef,
  grid: 0x8da395,
};

function fmt(n: number) {
  return n.toFixed(1);
}
function asPoint(v: T.Vector3): Point {
  return { x: v.x, y: v.y, z: v.z };
}
function dist(a: Point, b: Point) {
  return Math.hypot(a.x - b.x, a.z - b.z);
}
function areaOf(points: Point[]) {
  let total = 0;
  for (let i = 0; i < points.length; i++) {
    const a = points[i],
      b = points[(i + 1) % points.length];
    total += a.x * b.z - b.x * a.z;
  }
  return Math.abs(total) / 2;
}

export class MapReviewMode {
  readonly root = new T.Group();
  private readonly labels = new Map<string, HTMLDivElement>();
  private readonly pickRoot = new T.Group();
  private readonly raycaster = new T.Raycaster();
  private readonly pointer = new T.Vector2();
  private readonly reviewRevision = 'R001';
  private enabled = false;
  private mode: ReviewMode = 'PIN';
  private category: ReviewCategory = 'GENERAL';
  private status: ReviewStatus = 'OPEN';
  private pins: Pin[] = [];
  private areas: Area[] = [];
  private objects: ObjectReview[] = [];
  private measurements: Measurement[] = [];
  private areaDraft: Point[] = [];
  private measureDraft: Point[] = [];
  private selected: { kind: 'PIN' | 'AREA' | 'OBJECT'; id: string } | null = null;
  private nextPinNumber = 1;
  private nextAreaNumber = 1;
  private nextObjectNumber = 1;
  private cursor: Point | null = null;
  private show = {
    pins: true,
    areas: true,
    objects: true,
    zones: false,
    anchors: false,
    grid: false,
    hud: true,
  };
  private grid: T.Object3D | null = null;
  private zonesRoot: T.Object3D | null = null;
  private anchorsRoot: T.Object3D | null = null;
  private selectionHelper: T.Box3Helper | null = null;
  private readonly ui = {
    panel: document.querySelector<HTMLElement>('#review-panel')!,
    hud: document.querySelector<HTMLElement>('#review-hud')!,
    inspector: document.querySelector<HTMLElement>('#review-inspector')!,
    status: document.querySelector<HTMLElement>('#review-status')!,
    edit: document.querySelector<HTMLElement>('#review-edit')!,
    category: document.querySelector('#review-category') as unknown as HTMLSelectElement,
    itemStatus: document.querySelector('#review-item-status') as unknown as HTMLSelectElement,
    note: document.querySelector<HTMLTextAreaElement>('#review-note')!,
  };

  constructor(private readonly options: {
    mapId: string;
    root: T.Object3D;
    scene: T.Scene;
    camera: T.PerspectiveCamera;
    canvas: HTMLCanvasElement;
    groundHeight: (x: number, z: number) => number;
    player: () => { x: number; y: number; z: number };
    setView: (name: string) => void;
    setReviewCamera: (position: T.Vector3, lookAt: T.Vector3) => void;
    clearReviewCamera: () => void;
    objectRecords: ReviewObjectRecord[];
    districts: { name: string; x: number; z: number; tier: number }[];
  }) {
    options.root.add(this.root);
    this.root.add(this.pickRoot);
    this.root.visible = false;
    this.buildPickGeometry();
    this.bindUI();
    options.canvas.addEventListener('pointermove', this.onPointerMove);
    options.canvas.addEventListener('click', this.onCanvasClick);
    addEventListener('keydown', this.onKeyDown);
  }

  private buildPickGeometry() {
    const pickMaterial = new T.MeshBasicMaterial({
      transparent: true,
      opacity: 0,
      depthWrite: false,
    });
    for (const record of this.options.objectRecords) {
      const mesh = new T.Mesh(new T.BoxGeometry(1, 1, 1), pickMaterial);
      mesh.position.set(...record.center);
      mesh.scale.set(...record.size);
      mesh.rotation.y = record.rotation;
      mesh.userData.reviewRecord = record;
      mesh.userData.reviewPick = true;
      this.pickRoot.add(mesh);
    }
  }

  private bindUI() {
    document.querySelector<HTMLButtonElement>('#review-pin')!.onclick = () => this.setMode('PIN');
    document.querySelector<HTMLButtonElement>('#review-area')!.onclick = () => this.setMode('AREA');
    document.querySelector<HTMLButtonElement>('#review-object')!.onclick = () => this.setMode('OBJECT');
    document.querySelector<HTMLButtonElement>('#review-measure')!.onclick = () => this.setMode('MEASURE');
    document.querySelector<HTMLButtonElement>('#review-finish-area')!.onclick = () => this.finishArea();
    document.querySelector<HTMLButtonElement>('#review-clear-measure')!.onclick = () => {
      this.measureDraft = [];
      this.redraw();
    };
    document.querySelector<HTMLButtonElement>('#review-export')!.onclick = () => this.download();
    document.querySelector<HTMLButtonElement>('#review-focus-go')!.onclick = () => {
      const id = document.querySelector<HTMLInputElement>('#review-focus-id')!.value.trim().toUpperCase();
      this.focusId(id);
    };
    document.querySelector<HTMLButtonElement>('#review-save-item')!.onclick = () => this.saveSelectedItem();
    document.querySelector<HTMLButtonElement>('#review-delete-item')!.onclick = () => this.deleteSelectedItem();
    for (const input of ['pins', 'areas', 'objects', 'zones', 'anchors', 'grid', 'hud'] as const) {
      document.querySelector<HTMLInputElement>(`#review-${input}`)!.onchange = (e) => {
        this.show[input] = (e.target as HTMLInputElement).checked;
        if (input === 'zones') this.renderZones();
        if (input === 'anchors') this.renderAnchors();
        if (input === 'grid') this.renderGrid();
        if (input === 'hud') this.ui.hud.hidden = !this.show.hud || !this.enabled;
        if (input === 'objects') this.pickRoot.visible = this.show.objects;
        this.redraw();
      };
    }
    document.querySelectorAll<HTMLButtonElement>('[data-review-camera]').forEach((button) => {
      button.onclick = () => this.camera(button.dataset.reviewCamera!);
    });
  }

  private onKeyDown = (event: KeyboardEvent) => {
    if (event.key === 'F8') {
      event.preventDefault();
      this.toggle();
    }
    if (!this.enabled || event.key !== 'Escape') return;
    this.areaDraft = [];
    this.measureDraft = [];
    this.redraw();
  };

  toggle() {
    this.enabled = !this.enabled;
    this.root.visible = this.enabled;
    this.ui.panel.hidden = !this.enabled;
    this.ui.hud.hidden = !this.enabled || !this.show.hud;
    if (!this.enabled) this.options.clearReviewCamera();
    for (const element of this.labels.values()) element.style.display = this.enabled ? 'block' : 'none';
    if (this.enabled) this.redraw();
    this.updateHUD();
    return this.enabled;
  }
  isEnabled() {
    return this.enabled;
  }
  private setMode(mode: ReviewMode) {
    this.mode = mode;
    document.querySelectorAll<HTMLButtonElement>('[data-review-mode]').forEach((button) => {
      button.dataset.active = String(button.dataset.reviewMode === mode);
    });
    this.ui.status.textContent = `Mode ${mode} · klik terrain atau objek.`;
  }

  private onPointerMove = (event: PointerEvent) => {
    if (!this.enabled) return;
    const hit = this.pickTerrain(event);
    this.cursor = hit ? asPoint(hit) : null;
    this.updateHUD();
  };

  private onCanvasClick = (event: MouseEvent) => {
    if (!this.enabled) return;
    event.preventDefault();
    if (this.mode === 'OBJECT') {
      const object = this.pickObject(event);
      if (object) this.selectObject(object);
      return;
    }
    const hit = this.pickTerrain(event);
    if (!hit) {
      this.ui.status.textContent = 'Tidak menemukan permukaan terrain.';
      return;
    }
    const point = asPoint(hit);
    if (this.mode === 'PIN') this.addPin(point);
    else if (this.mode === 'AREA') {
      this.areaDraft.push(point);
      this.ui.status.textContent = `Area sementara: ${this.areaDraft.length} titik. Minimal 3, lalu Selesaikan area.`;
      this.redraw();
    } else {
      this.measureDraft.push(point);
      if (this.measureDraft.length >= 2) this.commitMeasurement();
      this.redraw();
    }
  };

  private pickTerrain(event: MouseEvent | PointerEvent) {
    const rect = this.options.canvas.getBoundingClientRect();
    this.pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    this.pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
    this.raycaster.setFromCamera(this.pointer, this.options.camera);
    const terrain = this.options.root.children.filter((o) => o.userData.reviewTerrain);
    const hits = this.raycaster.intersectObjects(terrain, false);
    if (hits[0]) return hits[0].point;
    const ray = this.raycaster.ray;
    for (let distance = 0; distance < 2400; distance += 4) {
      const p = ray.at(distance, new T.Vector3());
      if (Math.abs(p.x) > 800 || Math.abs(p.z) > 800) continue;
      const y = this.options.groundHeight(p.x, p.z);
      if (p.y <= y + 2 && p.y >= y - 4) {
        p.y = y;
        return p;
      }
    }
    return null;
  }
  private pickObject(event: MouseEvent) {
    const rect = this.options.canvas.getBoundingClientRect();
    this.pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    this.pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
    this.raycaster.setFromCamera(this.pointer, this.options.camera);
    const hit = this.raycaster.intersectObjects(this.pickRoot.children, true)[0];
    return hit?.object.userData.reviewRecord as ReviewObjectRecord | undefined;
  }

  private addPin(point: Point) {
    const id = `P-${String(this.nextPinNumber++).padStart(3, '0')}`;
    this.pins.push({ id, mapId: this.options.mapId, ...point, zone: this.zoneAt(point), category: this.category, note: '', status: this.status, createdAt: new Date().toISOString(), reviewRevision: this.reviewRevision });
    this.selected = { kind: 'PIN', id };
    this.ui.status.textContent = `${id} dibuat. Klik Focus ID atau ubah detail di panel.`;
    this.redraw();
  }
  private finishArea() {
    if (this.areaDraft.length < 3) {
      this.ui.status.textContent = 'Area membutuhkan minimal 3 titik terrain.';
      return;
    }
    const id = `A-${String(this.nextAreaNumber++).padStart(3, '0')}`;
    this.areas.push({ id, mapId: this.options.mapId, zone: this.zoneAt(this.areaDraft[0]), category: this.category, note: '', status: this.status, createdAt: new Date().toISOString(), reviewRevision: this.reviewRevision, points: this.areaDraft.splice(0), areaM2: areaOf(this.areaDraft) });
    const created = this.areas[this.areas.length - 1];
    created.areaM2 = areaOf(created.points);
    this.selected = { kind: 'AREA', id };
    this.ui.status.textContent = `${id} dibuat · ${created.areaM2.toFixed(0)} m².`;
    this.redraw();
  }
  private commitMeasurement() {
    if (this.measureDraft.length < 2) return;
    const points = this.measureDraft.splice(0);
    const a = points[0], b = points[points.length - 1];
    const h = dist(a, b);
    this.measurements.push({ id: `M-${String(this.measurements.length + 1).padStart(3, '0')}`, points, horizontalM: h, deltaYM: b.y - a.y, distance3dM: Math.hypot(h, b.y - a.y) });
  }
  private selectObject(record: ReviewObjectRecord) {
    let found = this.objects.find((o) => o.assetId === record.assetId && o.center.join(',') === record.center.join(','));
    if (!found) {
      found = { ...record, id: `O-${String(this.nextObjectNumber++).padStart(3, '0')}`, mapId: this.options.mapId };
      this.objects.push(found);
    }
    this.selected = { kind: 'OBJECT', id: found.id };
    const box = new T.Box3().setFromCenterAndSize(new T.Vector3(...found.center), new T.Vector3(...found.size));
    this.selectionHelper?.removeFromParent();
    this.selectionHelper = new T.Box3Helper(box, COLORS.object);
    this.root.add(this.selectionHelper);
    this.ui.inspector.textContent = `${found.id} · ${found.assetName}\nasset: ${found.assetId}\nfamily: ${found.family}\npos: ${found.center.map(fmt).join(', ')}\nrotY: ${fmt(found.rotation)} · scale: ${found.size.map(fmt).join(' × ')}\nchunk: ${found.chunk}\nzone: ${found.zone}\nsource: ${found.sourcePack}`;
    this.ui.status.textContent = `${found.id} dipilih. Inspector membaca registry scene dev.`;
    this.redraw();
  }

  private zoneAt(p: Point) {
    if (p.z > 270) return 'MAIN_GATE';
    if (p.x > 120 && p.z > 150) return 'CRAFT_DISTRICT';
    if (p.z > 120) return 'RESIDENTIAL_SOUTH';
    if (Math.hypot(p.x, p.z - 20) < 62) return 'CENTRAL_PLAZA';
    if (p.z < -235) return 'CASTLE_HILL';
    if (p.z < -80 && p.x > 0) return 'UPPER_CITY';
    if (p.z < -80) return 'UPPER_RESIDENTIAL';
    return 'MARKET';
  }
  private label(id: string, text: string, point: T.Vector3, color: string) {
    let element = this.labels.get(id);
    if (!element) {
      element = document.createElement('div');
      element.className = 'review-label';
      document.body.appendChild(element);
      this.labels.set(id, element);
    }
    element.textContent = text;
    element.style.borderColor = color;
    const p = point.clone().project(this.options.camera);
    element.style.left = `${(p.x * 0.5 + 0.5) * innerWidth}px`;
    element.style.top = `${(-p.y * 0.5 + 0.5) * innerHeight}px`;
    element.style.display = this.enabled ? 'block' : 'none';
  }
  private clearLabels(prefix?: string) {
    for (const [id, element] of this.labels) {
      if (!prefix || id.startsWith(prefix)) element.remove();
      if (!prefix) this.labels.delete(id);
    }
  }
  private redraw() {
    const reviewChildren = this.root.children.slice();
    for (const child of reviewChildren) {
      if (child === this.pickRoot || child === this.selectionHelper) continue;
      child.removeFromParent();
    }
    this.clearLabels();
    const pinRoot = new T.Group();
    for (const pin of this.pins) {
      const marker = new T.Mesh(new T.CylinderGeometry(0.8, 0.8, 4, 12), new T.MeshBasicMaterial({ color: COLORS.pin }));
      marker.position.set(pin.x, pin.y + 2, pin.z);
      pinRoot.add(marker);
      if (this.show.pins) this.label(pin.id, `${pin.id} · ${pin.zone}`, new T.Vector3(pin.x, pin.y + 5, pin.z), '#e8c96c');
    }
    pinRoot.visible = this.show.pins;
    this.root.add(pinRoot);
    const areaRoot = new T.Group();
    for (const area of this.areas) {
      const vertices = area.points.flatMap((p) => [p.x, p.y + 0.2, p.z]);
      const geometry = new T.BufferGeometry();
      geometry.setAttribute('position', new T.Float32BufferAttribute(vertices, 3));
      const line = new T.LineLoop(geometry, new T.LineBasicMaterial({ color: COLORS.area }));
      areaRoot.add(line);
      const fill = new T.Mesh(new T.ShapeGeometry(new T.Shape(area.points.map((p) => new T.Vector2(p.x, p.z)))), new T.MeshBasicMaterial({ color: COLORS.area, transparent: true, opacity: 0.16, side: T.DoubleSide }));
      fill.rotation.x = -Math.PI / 2;
      fill.position.y = Math.min(...area.points.map((p) => p.y)) + 0.15;
      areaRoot.add(fill);
      if (this.show.areas) this.label(area.id, `${area.id} · ${area.areaM2.toFixed(0)}m²`, new T.Vector3(area.points[0].x, area.points[0].y + 4, area.points[0].z), '#78b79d');
    }
    areaRoot.visible = this.show.areas;
    this.root.add(areaRoot);
    const measureRoot = new T.Group();
    for (const m of this.measurements) {
      const geometry = new T.BufferGeometry().setFromPoints(m.points.map((p) => new T.Vector3(p.x, p.y + 0.4, p.z)));
      measureRoot.add(new T.Line(geometry, new T.LineBasicMaterial({ color: 0xf0a66b })));
      const p = m.points[0];
      if (this.show.hud) this.label(m.id, `${m.horizontalM.toFixed(1)}m / ΔY ${m.deltaYM.toFixed(1)}m`, new T.Vector3(p.x, p.y + 3, p.z), '#f0a66b');
    }
    this.root.add(measureRoot);
    this.renderGrid();
    this.renderZones();
    this.renderAnchors();
    this.updateHUD();
    this.updateInspector();
  }
  private renderGrid() {
    this.grid?.removeFromParent();
    this.grid = null;
    if (!this.show.grid) return;
    const vertices: number[] = [];
    for (let i = -800; i <= 800; i += 25) {
      vertices.push(-800, this.options.groundHeight(-800, i) + 0.12, i, 800, this.options.groundHeight(800, i) + 0.12, i);
      vertices.push(i, this.options.groundHeight(i, -800) + 0.12, -800, i, this.options.groundHeight(i, 800) + 0.12, 800);
    }
    const geometry = new T.BufferGeometry().setAttribute('position', new T.Float32BufferAttribute(vertices, 3));
    this.grid = new T.LineSegments(geometry, new T.LineBasicMaterial({ color: COLORS.grid, transparent: true, opacity: 0.38 }));
    this.root.add(this.grid);
  }
  private renderZones() {
    this.zonesRoot?.removeFromParent();
    this.zonesRoot = null;
    if (!this.show.zones) return;
    const root = new T.Group();
    const zones = [
      ['MAIN_GATE', 0, 320, 180, 130], ['MARKET', 50, 200, 180, 150], ['CRAFT_DISTRICT', 205, 245, 150, 120],
      ['RESIDENTIAL_SOUTH', -190, 170, 220, 190], ['CENTRAL_PLAZA', 0, 20, 190, 150], ['UPPER_RESIDENTIAL', -160, -145, 220, 170],
      ['UPPER_CITY', 155, -180, 220, 170], ['CASTLE_HILL', 35, -310, 170, 150], ['SOUTH_FIELD', -380, 520, 360, 280],
      ['WEST_FIELD', -520, 0, 300, 760], ['NORTH_FIELD', 0, -570, 760, 300], ['EAST_FIELD', 520, 0, 300, 760],
    ] as const;
    for (const [name, x, z, w, d] of zones) {
      const geometry = new T.PlaneGeometry(w, d);
      geometry.rotateX(-Math.PI / 2);
      const mesh = new T.Mesh(geometry, new T.MeshBasicMaterial({ color: 0x6a9c8a, transparent: true, opacity: 0.05, side: T.DoubleSide }));
      mesh.position.set(x, this.options.groundHeight(x, z) + 0.3, z);
      root.add(mesh);
      this.label(`zone-${name}`, name, new T.Vector3(x, mesh.position.y + 5, z), '#8bc7a7');
    }
    this.zonesRoot = root;
    this.root.add(root);
  }
  private renderAnchors() {
    this.anchorsRoot?.removeFromParent();
    this.anchorsRoot = null;
    if (!this.show.anchors) return;
    const root = new T.Group();
    const anchors: [string, number, number][] = [
      ['MAIN_GATE_CENTER', 0, 335], ['MARKET_CENTER', 50, 200], ['CRAFT_CENTER', 200, 245], ['PLAZA_CENTER', 0, 20],
      ['GRAND_STAIR_BOTTOM', 125, -80], ['GRAND_STAIR_TOP', 80, -170], ['UPPER_CITY_CENTER', 155, -180], ['CASTLE_CENTER', 35, -310],
      ['CASTLE_ENTRY', 35, -294], ['RIVER_CROSSING', 455, 270],
    ];
    for (const [name, x, z] of anchors) {
      const y = this.options.groundHeight(x, z);
      const marker = new T.Mesh(new T.SphereGeometry(2, 10, 8), new T.MeshBasicMaterial({ color: COLORS.anchor }));
      marker.position.set(x, y + 2, z);
      root.add(marker);
      this.label(`anchor-${name}`, name, new T.Vector3(x, y + 7, z), '#96b5ef');
    }
    this.anchorsRoot = root;
    this.root.add(root);
  }

  private updateInspector() {
    if (this.selected?.kind === 'PIN') {
      const pin = this.pins.find((p) => p.id === this.selected!.id);
      if (pin) {
        this.ui.inspector.textContent = `${pin.id} · ${pin.zone}\npos: ${[pin.x, pin.y, pin.z].map(fmt).join(', ')}\ncategory: ${pin.category} · status: ${pin.status}\nnote: ${pin.note || '(belum ada catatan)'}`;
        this.loadEdit(pin.category, pin.status, pin.note);
      }
    } else if (this.selected?.kind === 'AREA') {
      const area = this.areas.find((a) => a.id === this.selected!.id);
      if (area) {
        this.ui.inspector.textContent = `${area.id} · ${area.zone}\n${area.points.length} titik · ${area.areaM2.toFixed(0)} m²\ncategory: ${area.category} · status: ${area.status}`;
        this.loadEdit(area.category, area.status, area.note);
      }
    } else {
      this.ui.edit.hidden = true;
    }
  }
  private loadEdit(category: ReviewCategory, status: ReviewStatus, note: string) {
    this.ui.edit.hidden = false;
    this.ui.category.value = category;
    this.ui.itemStatus.value = status;
    this.ui.note.value = note;
  }
  private saveSelectedItem() {
    if (!this.selected || this.selected.kind === 'OBJECT') return;
    const item = this.selected.kind === 'PIN'
      ? this.pins.find((p) => p.id === this.selected!.id)
      : this.areas.find((a) => a.id === this.selected!.id);
    if (!item) return;
    item.category = this.ui.category.value as ReviewCategory;
    item.status = this.ui.itemStatus.value as ReviewStatus;
    item.note = this.ui.note.value;
    this.ui.status.textContent = `${item.id} diperbarui.`;
    this.redraw();
  }
  private deleteSelectedItem() {
    if (!this.selected || this.selected.kind === 'OBJECT') return;
    const { kind, id } = this.selected;
    if (kind === 'PIN') this.pins = this.pins.filter((p) => p.id !== id);
    else this.areas = this.areas.filter((a) => a.id !== id);
    this.selected = null;
    this.ui.edit.hidden = true;
    this.ui.status.textContent = `${id} dihapus. Nomor ID tidak akan dipakai ulang dalam sesi ini.`;
    this.redraw();
  }
  private updateHUD() {
    if (!this.enabled) return;
    const p = this.options.player();
    this.ui.hud.textContent = `MAP ${this.options.mapId}\nPLAYER  ${fmt(p.x)}, ${fmt(p.y)}, ${fmt(p.z)}\nCURSOR  ${this.cursor ? `${fmt(this.cursor.x)}, ${fmt(this.cursor.y)}, ${fmt(this.cursor.z)}` : '—'}\nZONE    ${this.cursor ? this.zoneAt(this.cursor) : '—'}\nMODE    ${this.mode} · ${this.selected?.id ?? 'none'}`;
  }
  private camera(kind: string) {
    if (kind === 'player' || kind === 'return') {
      this.options.clearReviewCamera();
      this.options.setView('player');
      return;
    }
    if (kind === 'overview') {
      this.options.setReviewCamera(new T.Vector3(680, 650, 900), new T.Vector3(0, 45, -10));
    } else if (kind === 'top') {
      this.options.setReviewCamera(new T.Vector3(0, 1550, 1), new T.Vector3(0, 0, 0));
    } else if (kind === 'focus') {
      const target = this.focusPoint();
      if (target) this.options.setReviewCamera(target.clone().add(new T.Vector3(45, 38, 55)), target);
    }
  }
  private focusPoint() {
    if (!this.selected) return null;
    if (this.selected.kind === 'PIN') {
      const p = this.pins.find((x) => x.id === this.selected!.id);
      return p ? new T.Vector3(p.x, p.y, p.z) : null;
    }
    if (this.selected.kind === 'AREA') {
      const a = this.areas.find((x) => x.id === this.selected!.id);
      return a ? new T.Vector3(a.points[0].x, a.points[0].y, a.points[0].z) : null;
    }
    const o = this.objects.find((x) => x.id === this.selected!.id);
    return o ? new T.Vector3(...o.center) : null;
  }
  private focusId(id: string) {
    const pin = this.pins.find((p) => p.id === id), area = this.areas.find((a) => a.id === id), object = this.objects.find((o) => o.id === id);
    if (pin) this.selected = { kind: 'PIN', id };
    else if (area) this.selected = { kind: 'AREA', id };
    else if (object) {
      this.selected = { kind: 'OBJECT', id };
      const box = new T.Box3().setFromCenterAndSize(new T.Vector3(...object.center), new T.Vector3(...object.size));
      this.selectionHelper?.removeFromParent();
      this.selectionHelper = new T.Box3Helper(box, COLORS.object);
      this.root.add(this.selectionHelper);
    } else {
      this.ui.status.textContent = `ID ${id || '(kosong)'} tidak ditemukan.`;
      return;
    }
    this.camera('focus');
    this.redraw();
  }
  exportData() {
    return {
      schemaVersion: 'map-review-v1',
      revision: this.reviewRevision,
      mapId: this.options.mapId,
      exportedAt: new Date().toISOString(),
      pins: this.pins.map(({ x, y, z, ...pin }) => ({ ...pin, position: { x, y, z } })),
      areas: this.areas,
      objects: this.objects.map(({ center, size, ...object }) => ({ ...object, position: center, scale: size })),
      measurements: this.measurements,
      toggles: this.show,
      zones: ['MAIN_GATE', 'MARKET', 'CRAFT_DISTRICT', 'RESIDENTIAL_SOUTH', 'CENTRAL_PLAZA', 'UPPER_RESIDENTIAL', 'UPPER_CITY', 'CASTLE_HILL', 'SOUTH_FIELD', 'WEST_FIELD', 'NORTH_FIELD', 'EAST_FIELD'],
      anchors: ['MAIN_GATE_CENTER', 'MARKET_CENTER', 'CRAFT_CENTER', 'PLAZA_CENTER', 'GRAND_STAIR_BOTTOM', 'GRAND_STAIR_TOP', 'UPPER_CITY_CENTER', 'CASTLE_CENTER', 'CASTLE_ENTRY', 'RIVER_CROSSING'],
    };
  }
  private download() {
    const json = JSON.stringify(this.exportData(), null, 2);
    const url = URL.createObjectURL(new Blob([json], { type: 'application/json' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = `mahkota-fajar-review-${this.reviewRevision.toLowerCase()}.json`;
    a.click();
    URL.revokeObjectURL(url);
    this.ui.status.textContent = 'Review JSON diunduh. Sesi tetap memory-only.';
  }
  update() {
    if (!this.enabled) return;
    this.updateHUD();
    for (const [id, element] of this.labels) {
      const kind = id.startsWith('zone-') ? 'zone' : id.startsWith('anchor-') ? 'anchor' : id;
      let point: T.Vector3 | null = null;
      const pin = this.pins.find((p) => p.id === kind);
      const area = this.areas.find((a) => a.id === kind);
      const object = this.objects.find((o) => o.id === kind);
      if (pin) point = new T.Vector3(pin.x, pin.y + 5, pin.z);
      else if (area) point = new T.Vector3(area.points[0].x, area.points[0].y + 4, area.points[0].z);
      else if (object) point = new T.Vector3(...object.center).add(new T.Vector3(0, object.size[1] / 2 + 2, 0));
      if (point) {
        const p = point.project(this.options.camera);
        element.style.left = `${(p.x * 0.5 + 0.5) * innerWidth}px`;
        element.style.top = `${(-p.y * 0.5 + 0.5) * innerHeight}px`;
      }
    }
  }
  destroy() {
    this.options.canvas.removeEventListener('pointermove', this.onPointerMove);
    this.options.canvas.removeEventListener('click', this.onCanvasClick);
    removeEventListener('keydown', this.onKeyDown);
    for (const element of this.labels.values()) element.remove();
    this.root.removeFromParent();
  }
}
