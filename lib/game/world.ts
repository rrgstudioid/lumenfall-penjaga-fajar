import * as T from 'three';
import { getVisibleJobArchitecture } from './job-presentation';
import {usesHardTargeting,targetIdentity,validTarget,targetRequirement,needsSelectedTarget,targetDistance,ActionLock,type TargetIdentity,type TargetFailure} from './targeting';
import {TargetPresentation,type TargetView} from './target-presentation';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { cloneImportedMap, ImportedMapGround, SANDS_MAP_ANCHOR, SANDS_MAP_SCALE } from './imported-map';
import { isResourceEnabled } from './gameplay-config';
import { FIELD_TERRAINS, terrainHeight, nearestTerrainPoint, moveOnTerrain, terrainRoute, terrainRiverZ, terrainRiver, terrainPonds, insideBoundary, type GroundPoint } from './field-terrain';
import { buildFieldTerrain } from './field-terrain-renderer';
import { enhancePadangTerrainSurface } from './arunika-terrain-material';
import { ArunikaMaterials, addArunikaSurfaceUv, setArunikaShrineMaterials } from './arunika-surface-materials';
import { createBasicMapMaterial } from './basic-map-materials';
import { CAMERA_ZOOM, stepCameraZoom, wheelCameraFraming, type CameraZoomState } from './camera-zoom';
import { FOLLOW_CAMERA, createFollowCamera, followWheelDistance, stepFollowCamera, followImpactShake, type CameraMode } from './camera-follow';
import { CITY_SCALE, regionScale, fieldSpawns, isFieldSafe, regionHalfExtent, monsterRespawnKey, restoreRespawnDeadline } from './field-layout';
import { getNpcServiceLabel, forgeAccessReason } from './regions';
import { createMonsterBody } from './monster-models';
import { commitDrop, getInventorySlots, type DragSource, type DropTarget } from './drag-drop';
import { BgmPlayer, loadAudioSettings, saveAudioSettings, resolveBgmTrack, type AudioSettings, type BgmStatus } from './bgm';
import { createCharacterModel, disposeCharacterModel, updateCharacterAura, updateCharacterBillboards, type CharacterModel } from './character-model';
import { CITIES, FIELDS, FIELD_NPCS, travel, refreshUnlocks, monsterXP, acceptRegionQuest, completeRegionQuest, getQuestRegistry, regionQuestReward, regionQuestStatus, type MonsterDefinition, type NpcDefinition } from './regions';
import { buildStylizedTreeDecor } from './stylized-tree-map';
import { moveWithTreeCollisions, type TreeCollider } from './tree-collision';
import { buyShopItem, buyFieldShopItem, sellInventoryItem, transferStorage, healAtCity } from './city-services';
import { addItemToInventory, createItem, sortInventory, type ItemData } from './items';
import {
  attackPower,
  basicAttackPower,
  equippedWeaponType,
  applyStatPreview,
  collectPendingLoot,
  chooseCoreJob,
  chooseV2CoreJob,
  chooseMastery,
  chooseSpecialization,
  manaResourceName,
  deleteCharacter,
  discardItem as discardInventoryItem,
  derivedStats,
  combatModifiersFor,combatSupportFor,modifierContextFor,
  enhancementPreview,
  enhanceItem,
  equipItem as equipInventoryItem,
  evolvePet as evolvePetRules,
  freshHero,
  rollMonsterLootDrops,
  gainXP,
  hasEquippedGear,
  activeSkills,
  combatProfile,
  createNewCharacter,
  isSkillUnlocked,
  itemById,
  learnPassive,
  learnSkill,
  maxHP,
  loadCharacter,
  listCharacters,
  resetCharacterStats,
  resetSkillPoints as resetSkillPointsRules,
  allocateStatPoint as allocateStatPointRules,
  unlockUniqueStats as unlockUniqueStatsRules,
  resolveHeroSkill,
  type DerivedStats,
  skillHealingPreview,
  mitigateDamage,
  skillCosts,
  canCastSkill as canCastSkillRules,
  getSkillManaCost as skillManaCostRules,
  consumeMana as consumeManaRules,
  restoreMana as restoreManaRules,
  saveCharacter,
  type CharacterAppearance,
  socketRune as socketInventoryRune,
  removeSocketedRune as removeInventoryRune,
  beginRuneForge,
  resolveRuneForge,
  craftRuneOptimizer as craftInventoryRuneOptimizer,
  unequipItem as unequipInventoryItem,
  consumeInventoryItem,
  type CoreJobId,
  type Hero,
  type AllocatedStats,
  type EquipSlot,
  type JobId,
  type MasteryChoice,
  type RuneForgeRequest,
  type SpecializationId,
} from './rules';
import { MASTERY_EFFECTS, type SkillDefinition } from './skills';
import { COMBAT_MECHANICS, criticalChance, evasionChance, blockChance, barrierAmount, resolveHitAgainstEvasion } from './combat-mechanics';
import { SkillHitQueue, selectSkillTargets, skillHitDamage, inFrontalArc, type ResolvedSkillAction } from './skill-action';
import { applySourceOwnedStatus, applyStatus, clearExpiredSourceStatuses, effectiveArmorBreakStrength, getActiveStatusApplications, hasActiveStatusFromSource, hasStatus, getStatus, DefenseEvents, counterContextAllowed, type DefenseResult, type SourceOwnedStatus } from './combat-status';
import {addTemporaryModifier,tickTemporaryModifiers,receivedMultiplier,resolveTargetHit,NO_COUNTER,setManualGuard} from './combat-modifiers';
import {forwardFromYaw} from './combat-position';
import {enterStealth,exitStealth,isStealthed,breakStealth} from './stealth';
import {PersonalMarks,personalMark} from './personal-mark';
import {directionalVector,moveDirectional,moveCollisionSafeTo,passThroughEndpoint} from './directional-movement';
import {relativePosition} from './combat-position';
import {TransientCombatState} from './combat-transient';
import { WARRIOR_COUNTER_WINDOW_MS } from './warrior-v2';
import { FURY_HARVEST_RECOVERY_PERCENT } from './berserker-v3';
import { applyStun, chargeStunEligible, clearExpiredStun, isStunned, remainingStun, stunChanceForRank, type StunState } from './stun';
import { BLADE_FOCUS_FLOW_DURATION, bladeMasterDualWieldActive } from './blade-master-v3';
import { BladeMasterImpactSession } from './blade-master-impact';
import { resolveWeaponAttackContext } from './dual-wield';

const sandsLocationLoader = new GLTFLoader();
let sandsLocationSource: Promise<T.Group> | undefined;
const goldCoinLoader = new GLTFLoader();
let goldCoinSource: Promise<T.Group> | undefined;
function loadGoldCoin() {
  goldCoinSource ??= goldCoinLoader.loadAsync('/assets/Items/Gold%20Coin.glb')
    .then(asset => asset.scene)
    .catch(error => {
      goldCoinSource = undefined;
      console.warn('Gold Coin GLB belum tersedia; memakai visual fallback.', error);
      throw error;
    });
  return goldCoinSource;
}
function loadSandsLocation() {
  sandsLocationSource ??= sandsLocationLoader.loadAsync('/assets/maps/sands-location.glb')
    .then(asset => asset.scene)
    .catch(error => {
      // Allow a later region visit to retry if the asset was unavailable.
      sandsLocationSource = undefined;
      throw error;
    });
  return sandsLocationSource;
}
import {
  assignPrimaryHotbarSlot as assignHotbarSlot,
  swapPrimaryHotbarSlots as swapHotbarSlots,
  removePrimaryHotbarSlot as removeHotbarSlot,
  validatePrimaryHotbar,
  resolvePrimaryHotbarEntry,
  primaryHotbarAssignmentReason,
  primaryHotbarKeyIndex,
  quickHotbarKey,
  hotbarAssignment,
  isHotbarSlot,
  assignQuickHotbarSlot as assignQuickSlot,
  removeQuickHotbarSlot as removeQuickSlot,
  moveQuickHotbarEntry as moveQuickEntry,
  resetHotbarLayouts as resetLayouts,
  type QuickHotbarId,
  type HotbarSlot,
  type HotbarLayout,
} from './hotbar';
export type EnemyView = {
  id: number;
  x: number;
  z: number;
  hp: number;
  max: number;
  boss: boolean;
  variant: string;
  name: string;
  level: number;
  respawn: number;
};
export type Snapshot = {
  currentTarget?:TargetView|null;
  combatFeedback?: CombatFeedbackSnapshot;
  cameraMode: CameraMode;
  forgeNpcId?: string | null;
  hotbarEditMode?: boolean;
  audioSettings: AudioSettings;
  bgmStatus: BgmStatus;
  hotbarRuntime: { attackRemaining: number; itemCooldowns: Record<string,number>; lastUsedIndex: number; useSequence: number };
  hero: Hero;
  started: boolean;
  paused: boolean;
  dead: boolean;
  stamina: number;
  cooldown: number;
  notice: string;
  noticeItem?: Pick<ItemData, 'templateId' | 'rarity'> | null;
  noticeId: number;
  saved: boolean;
  nearShrine: boolean;
  enemies: EnemyView[];
  groundLoot?: Array<{ id: string; x: number; z: number; name: string; quantity: number }>;
  bossActive: boolean;
  bossRespawn: number;
  bossName: string;
  combo: number;
  mana: number;
  maxMana: number;
  manaName: string;
  skillPoints: number;
  skillViews: Array<{
    id: string;
    name: string;
    description: string;
    slot: 1 | 2 | 3 | 4;
    manaCost: number;
    cooldown: number;
    remaining: number;
    level: number;
    unlocked: boolean;
    unlockLevel: number;
    visualEffect: string;
  }>;
  classQuest: string;
  cityName: string;
  fieldName: string;
  recommendedLevel: string;
  mapId: string;
  inCity: boolean;
};
export type CombatFeedbackIndicator = {
  id: string;
  label: string;
  remaining?: number;
  stacks?: number;
  maxStacks?: number;
  iconSkillId?: string;
  tone?: 'defensive' | 'offensive' | 'ready' | 'counter';
};
export type CombatFeedbackSnapshot = {
  indicators: CombatFeedbackIndicator[];
  event?: { label: string; tone: 'block' | 'parry' | 'break' | 'payoff'; remaining: number };
};
type Enemy = {
  spawnGeneration?:number;
  pickBounds?:T.Box3;
  statusEffects?: Record<string,number>;
  sourceOwnedStatuses?: Record<string, SourceOwnedStatus[]>;
  stunState?: StunState;
  stunImmune?: boolean;
  navigation?: { route:GroundPoint[]; until:number; target:GroundPoint };
  definition?: MonsterDefinition;
  respawnKey: string;
  respawnDeadline: number;
  id: number;
  group: T.Group;
  hp: number;
  max: number;
  boss: boolean;
  home: T.Vector3;
  cooldown: number;
  windup: number;
  respawn: number;
  flash: number;
  ring: T.Mesh;
  stun: number;
  slow: number;
  slowPotency?: number;
  root: number;
  poison: number;
  poisonTick: number;
  marked: boolean;
  weakPoint: boolean;
  defenseDown: number;
  /** Optional development/future actor stat; current monster definitions omit it and resolve as 0. */
  evasion?: number;
  attack: number;
  attackRange: number;
  movementSpeed: number;
};
type GroundLoot = { id: string; item: ItemData; group: T.Group; label: HTMLSpanElement };
type GroundGold = { id: string; amount: number; group: T.Group; label: HTMLSpanElement };
type Particle = {
  mesh: T.Mesh;
  velocity: T.Vector3;
  life: number;
  total: number;
};
type Ring = { mesh: T.Mesh; life: number; total: number; grow: number };
type Beam = { line: T.Line; life: number; total: number };
type Floating = { element: HTMLSpanElement; position: T.Vector3; life: number };
export class Game {
  /** Development-only observer for headed smoke diagnostics. Never used by gameplay. */
  developmentTrace?: (event: { system: string; stage: string; time: number; [key: string]: unknown }) => void;
  private traceDevelopment(stage: string, data: Record<string, unknown> = {}) {
    this.developmentTrace?.({ system: 'iron-charge', stage, time: this.combatTime, ...data });
  }
  private traceV3Damage(skillId: string, stage: string, data: Record<string, unknown> = {}) {
    if (skillId !== 'v3-blade-master-twin-assault') return;
    this.developmentTrace?.({ system: 'v3-live-damage', skillId, stage, time: this.combatTime, ...data });
  }
  portalLabels: Array<{element:HTMLDivElement;x:number;z:number;name:string;labelHeight?:number}> = [];
  terrainSurface: T.Mesh | null = null;
  arunikaMaterials: ArunikaMaterials | null = null;
  sandsGround: ImportedMapGround | null = null;
  get isSandsLocation() { return !this.hero.inCity && this.hero.currentField === 'sands-location'; }
  get fieldTerrain() { return this.hero.inCity ? undefined : FIELD_TERRAINS[this.hero.currentField]; }
  get nearSanctuary() {const p=this.fieldTerrain?.sanctuary??{x:0,z:0};return Math.hypot(this.hero.x-p.x,this.hero.z-p.z)<5.3;}
  groundHeight(x:number,z:number) {
    if(this.isSandsLocation)return this.sandsGround?.heightAt(x,z)??0;
    const t=this.fieldTerrain;return t?terrainHeight(t,x,z):0;
  }
  groundDistance(a:T.Vector3,b:T.Vector3) {
    // Preserve the old flat-ground combat ranges when actors stand on different elevations.
    return this.fieldTerrain||this.isSandsLocation?Math.hypot(a.x-b.x,a.z-b.z):a.distanceTo(b);
  }
  placeActor() {
    const t=this.fieldTerrain;
    if(t)Object.assign(this.hero,nearestTerrainPoint(t,{x:this.hero.x,z:this.hero.z}));
    if(this.isSandsLocation&&this.sandsGround)Object.assign(this.hero,this.sandsGround.nearestPoint(this.hero,FIELDS['sands-location'].entry));
    this.actor.position.set(this.hero.x,this.groundHeight(this.hero.x,this.hero.z),this.hero.z);
  }
  moveEnemy(e:Enemy,dx:number,dz:number) {
    const t=this.fieldTerrain;
    if(this.isSandsLocation&&!this.sandsGround)return;
    const radius=e.boss?1.8:.55;
    const p=moveWithTreeCollisions(e.group.position,dx,dz,this.treeColliders,(from,mx,mz)=>{
      if(t)return moveOnTerrain(t,from,mx,mz,radius,true);
      if(this.isSandsLocation&&this.sandsGround)return this.sandsGround.move(from,mx,mz);
      return {x:from.x+mx,z:from.z+mz};
    },(x,z)=>this.groundHeight(x,z),radius);
    e.group.position.set(p.x,this.groundHeight(p.x,p.z),p.z);
  }
  followTerrain(e:Enemy,target:GroundPoint,speed:number,dt:number) {
    const t=this.fieldTerrain,radius=e.boss?1.8:.55;
    let waypoint=target;
    if(t) {
      if(!e.navigation||e.navigation.until<this.elapsed) {
        const direct=moveOnTerrain(t,e.group.position,target.x-e.group.position.x,target.z-e.group.position.z,radius,true);
        e.navigation={route:Math.hypot(direct.x-target.x,direct.z-target.z)<.4?[]:terrainRoute(t,e.group.position,target,radius),until:this.elapsed+1,target:{...target}};
      }
      while(e.navigation.route.length&&Math.hypot(e.navigation.route[0].x-e.group.position.x,e.navigation.route[0].z-e.group.position.z)<.45)e.navigation.route.shift();
      waypoint=e.navigation.route[0]??target;
    }
    const dx=waypoint.x-e.group.position.x,dz=waypoint.z-e.group.position.z,length=Math.hypot(dx,dz);
    if(length){const step=Math.min(length,speed*dt);this.moveEnemy(e,dx/length*step,dz/length*step);}
  }
  regionDecor = new T.Group();
  treeColliders: TreeCollider[] = [];
  terrain = new T.Group();
  transitioning = false;
  currentNpc: NpcDefinition | null = null;
  forgeNpcId: string | null = null;
  activeNpcMenu = false;
  npcInteractionMode = false;
  shopMode: 'buy' | 'sell' = 'buy';
  hero: Hero = freshHero();
  slotId = 'slot-1';
  started = false;
  paused = false;
  dead = false;
  stamina = 100;
  cooldown = 0;
  scene = new T.Scene();
  worldLightRig = new T.Group();
  sandsLightRig = new T.Group();
  freeCamera = new T.OrthographicCamera(-25, 25, 20, -20, 0.1, 160);
  followCamera = new T.PerspectiveCamera(FOLLOW_CAMERA.fov, 1, 0.1, 160);
  camera: T.OrthographicCamera | T.PerspectiveCamera = this.freeCamera;
  cameraMode: CameraMode = 'free';
  followView = createFollowCamera(0);
  savedFreeYaw = 0.62;
  followInitialized = false;
  impactShakeRemaining = 0;
  renderer: T.WebGLRenderer;
  actor = new T.Group();
  legs: T.Object3D[] = [];
  characterModel!: CharacterModel;
  arm = new T.Group();
  aura = new T.Group();
  enemies: Enemy[] = [];
  groundLoot: GroundLoot[] = [];
  groundGold: GroundGold[] = [];
  particles: Particle[] = [];
  rings: Ring[] = [];
  beams: Beam[] = [];
  floating: Floating[] = [];
  keys = new Set<string>();
  direction = new T.Vector3(0, 0, -1);
  raycaster = new T.Raycaster();
  pointer = new T.Vector2();
  aim = new T.Vector3();
  ground = new T.Plane(new T.Vector3(0, 1, 0), 0);
  pointerActive = false;
  attacking = false;
  dragging = false;
  pointerStart = 0;
  pointerStartY = 0;
  yaw = 0.62;
  pitch = 0.55;
  cameraZoom: CameraZoomState = {
    targetFraming: CAMERA_ZOOM.defaultFraming,
    currentFraming: CAMERA_ZOOM.defaultFraming,
    rmbFramingTarget: CAMERA_ZOOM.defaultFraming,
    rmbFraming: CAMERA_ZOOM.defaultFraming,
    rmbFramingActive: false,
    manualOrbitPitchOffset: CAMERA_ZOOM.farPitchOffset,
    manualOrbitPitchLocked: false,
    pitchOffset: CAMERA_ZOOM.farPitchOffset,
    targetHeight: CAMERA_ZOOM.farTargetHeight,
    yaw: this.yaw,
    halfHeight: CAMERA_ZOOM.default,
    distance: CAMERA_ZOOM.default,
  };
  cameraFocus = new T.Vector3();
  enemyLabels = new Map<number, HTMLDivElement>();
  npcLabels: Array<{npc:NpcDefinition;element:HTMLDivElement;nameElement:HTMLDivElement}> = [];
  playerStatusLabel: HTMLDivElement | null = null;
  playerBarValues = { hp: -1, mana: -1, stamina: -1 };
  invincible = 0;
  rmbHeld = false;
  attackTimer = 0;
  swing = 0;
  combo = 0;
  comboWindow = 0;
  /** Transient only: the next valid Blade Master basic attack hand. */
  dualBasicNextHand: 'MAIN' | 'OFF' = 'MAIN';
  dualBasicEquipmentSignature = '';
  elapsed = 0;
  lastTime = 0;
  frame = 0;
  emitTimer = 0;
  lastEmitX = 0;
  lastEmitZ = 0;
  saveTimer = 0;
  notice = '';
  noticeItem: Pick<ItemData, 'templateId' | 'rarity'> | null = null;
  noticeId = 0;
  noticeTimer = 0;
  saved = true;
  skillCooldowns: Record<string, number> = {};
  skillHits = new SkillHitQueue();
  defenseEvents = new DefenseEvents();
  combatTime = 0;
  currentTarget:TargetIdentity|null=null;
  targetEntities=new Map<number,Enemy>();
  targetPresentation?:TargetPresentation;
  private targetRemoval?:{group:T.Group;listener:()=>void};
  actionLock=new ActionLock();
  lastActionFailure:TargetFailure|'ACTION_LOCKED'|'TEMPO_REQUIRED'|null=null;
  registerTargetEnemy(enemy:Enemy){
    this.targetEntities??=new Map();
    this.targetEntities.set(enemy.id,enemy);
    enemy.group.updateWorldMatrix(true,true);
    const body=enemy.group.children[0];
    const box=body?new T.Box3().setFromObject(body):new T.Box3();
    if(box.isEmpty())box.set(new T.Vector3(-.6,0,-.6),new T.Vector3(.6,2.4,.6)).translate(enemy.group.position);
    box.translate(enemy.group.position.clone().negate());
    const size=box.getSize(new T.Vector3()),center=box.getCenter(new T.Vector3());
    size.x=Math.max(.9,size.x);size.y=Math.max(1.5,size.y);size.z=Math.max(.9,size.z);
    enemy.pickBounds=box.setFromCenterAndSize(center,size).expandByVector(new T.Vector3(.15,.1,.15));
    this.validateCurrentTarget();
  }
  unregisterTargetEnemy(enemy:Enemy){
    if(this.targetEntities?.get(enemy.id)===enemy){this.targetEntities.delete(enemy.id);enemy.spawnGeneration=(enemy.spawnGeneration??0)+1;}
    this.validateCurrentTarget();
  }
  getCastTarget(identity:TargetIdentity|undefined){return validTarget(identity,id=>this.targetEntities?.get(id),this.regionBuildToken,this.scene);}
  getCurrentTarget(){
    const enemy=this.getCastTarget(this.currentTarget??undefined);
    if(!enemy&&this.currentTarget)this.clearCurrentTarget();
    return enemy;
  }
  isCurrentTargetValid(){return !!this.getCurrentTarget();}
  validateCurrentTarget(){return this.getCurrentTarget();}
  setCurrentTarget(enemy:Enemy){
    if(!usesHardTargeting(this.hero))return false;
    const identity=targetIdentity(enemy,this.regionBuildToken);
    if(!this.getCastTarget(identity))return false;
    this.clearCurrentTarget();this.currentTarget=identity;
    const listener=()=>this.clearCurrentTarget();enemy.group.addEventListener('removed',listener);this.targetRemoval={group:enemy.group,listener};
    this.updateTargetPresentation();return true;
  }
  clearCurrentTarget(){
    if(this.targetRemoval)this.targetRemoval.group.removeEventListener('removed',this.targetRemoval.listener);
    this.targetRemoval=undefined;this.currentTarget=null;this.targetPresentation?.clear();
  }
  currentTargetView():TargetView|null{
    const e=this.getCurrentTarget();
    if(!e)return null;
    return {id:e.id,instanceId:e.group.uuid,name:e.definition?.name??'Lumut Liar',level:e.definition?.level,hp:e.hp,maxHP:e.max,
      armorBreakRemaining:Number(getStatus(e,'armor_break')??0),
      marked:!!personalMark(e,this.markSource())||hasStatus(e,'mark'),
      markRemaining:personalMark(e,this.markSource())?.remaining??(typeof getStatus(e,'mark')==='number'?Number(getStatus(e,'mark')):undefined)};
  }
  updateTargetPresentation(){
    const enemy=this.getCurrentTarget(),view=this.currentTargetView();
    if(!enemy||!view){this.targetPresentation?.clear();return;}
    if(!this.labelHost)return;
    this.targetPresentation??=new TargetPresentation(this.labelHost);
    const size=enemy.pickBounds?.getSize(new T.Vector3());
    this.targetPresentation.show(enemy.group,view,size?Math.max(size.x,size.z)*.55:1);
  }
  resolveCurrentTarget(range:number):{target?:Enemy;reason?:TargetFailure}{
    const had=!!this.currentTarget,target=this.getCurrentTarget();
    if(!target)return {reason:had?'TARGET_INVALID':'NO_TARGET'};
    if(targetDistance(this.actor.position,target.group.position)>range)return {reason:'TARGET_OUT_OF_RANGE'};
    return {target};
  }
  failTarget(reason:TargetFailure|'ACTION_LOCKED'|'TEMPO_REQUIRED'){
    this.lastActionFailure=reason;this.message(({NO_TARGET:'Pilih target terlebih dahulu.',TARGET_INVALID:'Target sudah tidak valid.',TARGET_OUT_OF_RANGE:'Target di luar jangkauan.',ACTION_LOCKED:'Tunggu aksi saat ini selesai.',TEMPO_REQUIRED:'Tempo Drive membutuhkan minimal 1 Tempo.'})[reason]);return false;
  }
  faceTarget(enemy:Enemy){
    const direction=enemy.group.position.clone().sub(this.actor.position).setY(0);
    if(direction.lengthSq()>1e-8){this.direction.copy(direction.normalize());this.actor.rotation.y=Math.atan2(-this.direction.x,-this.direction.z);}
  }
  handleEnemySelection(enemy?:Enemy){
    this.attacking=false;
    if(!enemy){this.clearCurrentTarget();return;}
    if(this.getCurrentTarget()===enemy)this.attack();else this.setCurrentTarget(enemy);
  }
  pickEnemy(){
    this.raycaster.setFromCamera(this.pointer,this.camera);
    const box=new T.Box3(),point=new T.Vector3();let nearest:Enemy|undefined,distance=Infinity;
    // Bounds test only on clicks; never scan the roster to maintain a selected target.
    for(const enemy of this.targetEntities.values()){
      if(enemy.hp<=0||!enemy.group.visible||enemy.group.parent!==this.scene||!enemy.pickBounds)continue;
      enemy.group.updateWorldMatrix(true,false);box.copy(enemy.pickBounds).applyMatrix4(enemy.group.matrixWorld);
      if(this.raycaster.ray.intersectBox(box,point)){const d=point.distanceTo(this.raycaster.ray.origin);if(d<distance){distance=d;nearest=enemy;}}
    }
    return nearest;
  }
  transientCombat = new TransientCombatState();
  personalMarks = new PersonalMarks();
  markSource() {return {sourceActorId:this.hero.characterId??this.hero.slotId,sourceGeneration:this.regionBuildToken};}
  syncCombatModifiers() {
    this.transientCombat??=new TransientCombatState();
    const support=combatSupportFor(this.hero),style=modifierContextFor(this.hero,derivedStats(this.hero)).weaponStyle;
    this.transientCombat.update(this.combatTime,style,support);
    this.transientCombat.updateBladeTempo(this.combatTime, this.hero.specialization === 'blade_master' && bladeMasterDualWieldActive(this.hero) && style === 'dual_sword');
    const drive = this.transientCombat.bladeTempoDrive;
    this.hero.combatStateModifiers=[...this.transientCombat.stackModifiers(support), ...(drive ? [{ id:'v3-blade-master-tempo-drive-speed', stats: { percent: { attackSpeed: drive.attackSpeedPercent } } }] : [])];
  }
  combatFeedbackSnapshot(): CombatFeedbackSnapshot {
    const indicators: CombatFeedbackIndicator[] = [];
    if(isStealthed(this.hero))indicators.push({id:'stealth',label:'STEALTH',remaining:Number(getStatus(this.hero,'stealth')),tone:'defensive'});
    const buffs: Array<[string,string,string,'defensive'|'offensive'|'ready']> = [
      ['v2-warrior-guard-stance','Guard Stance','v2-warrior-guard-stance','defensive'],
      ['v2-warrior-battle-cry','Battle Cry','v2-warrior-battle-cry','offensive'],
      ['v2-warrior-battle-focus','Battle Focus','v2-warrior-battle-focus','offensive'],
      ['v2-warrior-unbroken-stance','Unbroken Stance','v2-warrior-unbroken-stance','defensive'],
      ['v2-warrior-awakening','Warrior Awakening','v2-warrior-awakening','ready'],
      ['v2-thief-instinct','Thief Instinct','v2-thief-instinct','ready'],
      ['v2-thief-evasive-feint','Evasive Feint','v2-thief-evasive-feint','defensive'],
    ];
    for(const [id,label,iconSkillId,tone] of buffs){
      const remaining=Number(this.hero.activeBuffs[id]??0);
      if(remaining>0)indicators.push({id,label,remaining,iconSkillId,tone});
    }
    const support=combatSupportFor(this.hero), style=modifierContextFor(this.hero,derivedStats(this.hero)).weaponStyle;
    this.transientCombat.update(this.combatTime,style,support);
    const stackLabels: Record<string,[string,string,'offensive'|'ready']> = {
      'v2-warrior-battle-momentum':['Momentum','v2-warrior-battle-momentum','offensive'],
      'v2-warrior-twin-blade-rhythm':['Rhythm','v2-warrior-twin-blade-rhythm','offensive'],
    };
    for(const [id,s] of this.transientCombat.stacks){
      const meta=stackLabels[id];
      if(meta)indicators.push({id,label:meta[0],stacks:s.stackCount,maxStacks:s.maxStacks,remaining:Math.max(0,s.expiresAt-this.combatTime),iconSkillId:meta[1],tone:meta[2]});
    }
    if (this.hero.specialization === 'blade_master' && (this.hero.skillProgressionV3?.skillRanks['v3-blade-master-twin-blade-mastery'] ?? 0) > 0) {
      const tempo = this.transientCombat.bladeTempo;
      indicators.push({ id:'v3-blade-master-tempo', label:'TEMPO', stacks:this.transientCombat.tempoCount(this.combatTime), maxStacks:3, remaining:tempo ? Math.max(0,tempo.expiresAt-this.combatTime) : 0, iconSkillId:'v3-blade-master-twin-assault', tone:'offensive' });
    }
    const heavy=this.transientCombat.windows.get('v2-warrior-great-weapon-momentum');
    if(heavy)indicators.push({id:'v2-warrior-great-weapon-momentum',label:'HEAVY READY',remaining:Math.max(0,heavy.expiresAt-this.combatTime),iconSkillId:'v2-warrior-great-weapon-momentum',tone:'ready'});
    const defense=this.defenseEvents.lastDefenseEvent;
    let event: CombatFeedbackSnapshot['event'];
    if(defense && defense.result==='blocked' || defense && defense.result==='parried'){
      const age=Math.max(0,this.combatTime*1000-defense.timestamp);
      const counterRemaining=Math.max(0,WARRIOR_COUNTER_WINDOW_MS-age)/1000;
      if(!defense.consumed && counterRemaining>0) indicators.push({id:`${defense.result}-counter`,label:`${defense.result==='parried'?'PARRY':'BLOCK'} COUNTER`,remaining:counterRemaining,iconSkillId:defense.result==='parried'?'v2-warrior-iron-reversal':'v2-warrior-counter-slash',tone:'counter'});
      if(age<900)event={label:defense.result==='parried'?'PARRY':'BLOCK',tone:defense.result==='parried'?'parry':'block',remaining:(900-age)/1000};
    }
    return {indicators,event};
  }
  // Transient combat state: never part of Hero or the save format.
  private stealthWasVisible = false;
  skillImpactContext(target?: Enemy) {
    return {source:this.markSource(),attackerStealthed:isStealthed(this.hero),target,now:this.combatTime,
      position:target?{attackerPosition:{x:this.actor.position.x,z:this.actor.position.z},targetPosition:{x:target.group.position.x,z:target.group.position.z},targetForward:forwardFromYaw(target.group.rotation.y)}:undefined};
  }
  updateStealthPresentation() {
    const active=isStealthed(this.hero);
    if(active===!!this.stealthWasVisible)return;
    this.stealthWasVisible=active;
    this.float(this.actor.position,active?'STEALTH':'STEALTH ENDED','reward');
    this.ring(this.actor.position,active?'#a8a2ed':'#c5d0de',1.3,.4);
  }
  stepSkillRuntime(dt:number) {
    if(this.disposed||!this.started||this.dead){this.clearSkillRuntime();return;}
    if(this.paused)return;
    this.updateStealthPresentation();
    this.combatTime+=dt;
    this.transientCombat?.updateBerserker(this.combatTime);
    this.personalMarks?.update(dt);
    this.updateTargetPresentation();
    tickTemporaryModifiers(this.hero,dt);
    this.hero.hp = Math.min(this.hero.hp, maxHP(this.hero));
    this.syncCombatModifiers();
    this.hero.hp=Math.min(this.hero.hp,derivedStats(this.hero).maxHP);
    this.skillHits.update(dt);
  }
  clearSkillRuntime() {
    this.personalMarks?.clear();
    exitStealth(this.hero);this.stealthWasVisible=false;
    for(const key of Object.keys(this.hero.activeBuffs))if(key.startsWith('v2-thief-'))delete this.hero.activeBuffs[key];
    setManualGuard(this.hero,false);
    this.clearCurrentTarget();this.actionLock?.clear();this.lastActionFailure=null;
    this.skillHits.clear(); this.defenseEvents.clear();
    this.transientCombat?.clear();delete this.hero.temporaryModifiers;delete this.hero.combatStateModifiers;
  }
  wasRecentlyParried(windowMs:number) { return this.defenseEvents.recent('parried',windowMs,this.combatTime*1000); }
  consumeRecentDefenseEvent(result:DefenseResult,windowMs:number) { return this.defenseEvents.consume(result,windowMs,this.combatTime*1000); }
  hotbarInteracting = false;
  hotbarEditMode = false;
  lastHotbarSlot = -1;
  hotbarUseSequence = 0;
  blocking = false;
  shrine = new T.Group();
  crystal!: T.Mesh;
  bossSpawned = false;
  regionBuildToken = 0;
  private regionLoads: Promise<unknown>[] = [];
  private regionLoadError: unknown = null;
  muted = true;
  bgm = new BgmPlayer();
  audio: AudioContext | null = null;
  disposed = false;
  seed = 491;
  resizeObserver: ResizeObserver;
  constructor(
    public host: HTMLElement,
    public labelHost: HTMLElement,
    public minimap: HTMLCanvasElement,
    public onSnapshot: (snapshot: Snapshot) => void,
    public onPause: () => void,
    initialSlot = 'slot-1',
  ) {
    try {
      this.slotId = initialSlot;
      this.hero = loadCharacter(initialSlot);
    } catch {
      this.saved = false;
    }
    this.restoreSavedPosition();
    this.stamina = this.hero.stamina;
    this.renderer = new T.WebGLRenderer({
      antialias: true,
      powerPreference: 'high-performance',
    });
    // Keep high-DPI displays from multiplying the full-screen fill cost. The
    // game remains sharp while capping the drawing buffer at a practical
    // browser-MMORPG resolution.
    this.renderer.setPixelRatio(Math.min(devicePixelRatio, 1.25));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = T.PCFSoftShadowMap;
    this.renderer.outputColorSpace = T.SRGBColorSpace;
    this.renderer.toneMapping = T.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 0.95;
    this.renderer.domElement.setAttribute('aria-label', 'Dunia 3D Lumenfall');
    this.renderer.domElement.tabIndex = 0;
    host.appendChild(this.renderer.domElement);
    try { this.bgm.configure(loadAudioSettings(window.localStorage)); } catch { /* Keep default audio preferences. */ }
    this.muted = this.bgm.settings.muted;
    this.scene.background = new T.Color('#e7edd4');
    this.scene.fog = null;
    this.scene.add(this.worldLightRig);
    this.scene.add(this.sandsLightRig);
    this.worldLightRig.add(new T.HemisphereLight('#f2f8d6', '#3f5d45', 2.2));
    const sun = new T.DirectionalLight('#fff0bd', 2.6);
    sun.position.set(-20, 40, 15);
    sun.castShadow = true;
    // A 1024 shadow atlas is sufficient for the low-poly world and is much
    // cheaper to filter than the previous 2048 atlas.
    sun.shadow.mapSize.set(1024, 1024);
    Object.assign(sun.shadow.camera, {
      left: -42,
      right: 42,
      top: 42,
      bottom: -42,
      far: 130,
    });
    sun.shadow.normalBias = 0.045;
    sun.shadow.bias = -0.0001;
    this.worldLightRig.add(sun);
    // Sands Location gets its own neutral rig. It changes only illumination;
    // the supplied GLB materials, textures, terrain, and normals stay intact.
    const sandsHemisphere=new T.HemisphereLight('#fff6d8','#8d6b4a',1.8);
    const sandsSun=new T.DirectionalLight('#ffe9ac',2.1);
    sandsSun.position.set(-18,36,12);
    sandsSun.castShadow=false;
    this.sandsLightRig.add(sandsHemisphere,sandsSun);
    this.sandsLightRig.visible=false;

    this.buildTerrain();
    this.buildShrine();
    this.buildHero();
    this.buildEnemies();
    this.buildRegionDecor();
    this.placeActor();
    this.createPlayerStatusLabel();
    this.cameraFocus.copy(this.actor.position);
    this.resizeObserver = new ResizeObserver(this.resize);
    this.resizeObserver.observe(host);
    this.resize();
    window.addEventListener('keydown', this.keydown);
    window.addEventListener('keyup', this.keyup);
    window.addEventListener('blur', this.blur);
    document.addEventListener('visibilitychange', this.visibility);
    window.addEventListener('pagehide', this.pagehide);
    window.addEventListener('pointerdown', this.audioGesture, true);
    window.addEventListener('keydown', this.audioGesture, true);
    const c = this.renderer.domElement;
    c.addEventListener('pointerdown', this.pointerdown);
    window.addEventListener('pointerup', this.pointerup);
    window.addEventListener('pointercancel', this.pointerup);
    c.addEventListener('pointermove', this.pointermove);
    c.addEventListener('contextmenu', this.contextmenu);
    c.addEventListener('wheel', this.wheel, { passive: false });
    this.emit();
  }

  /** Loading screen owns this stage. No simulation, combat or autosave runs here. */
  async prepareWorld() {
    const characterReady = await this.characterModel.ready;
    if (this.disposed) return;
    if (!characterReady) throw new Error('Character model could not be loaded');
    // Loading an imported map can enqueue foliage/collision work of its own.
    let settled = 0;
    while (!this.disposed && settled < this.regionLoads.length) {
      const pending = this.regionLoads.slice(settled);
      settled += pending.length;
      await Promise.all(pending);
    }
    if (this.disposed) return;
    if (this.regionLoadError) throw this.regionLoadError;
    this.placeActor();
    this.cameraFocus.copy(this.actor.position);
    this.setCameraMode('follow');
    await this.renderer.compileAsync(this.scene, this.camera);
    if (!this.disposed) this.renderer.render(this.scene, this.camera);
  }

  createPlayerStatusLabel() {
    const label = document.createElement('div');
    label.className = 'player-hunt-bars';
    label.setAttribute('aria-label', isResourceEnabled(this.hero, 'stamina') ? 'HP, Mana, dan Stamina karakter' : 'HP dan Mana karakter');

    for (const [resource, title] of [
      ['hp', 'HP karakter'],
      ['mana', 'Mana karakter'],
      ['stamina', 'Stamina karakter'],
    ] as const) {
      if (resource === 'stamina' && !isResourceEnabled(this.hero, 'stamina')) continue;
      const bar = document.createElement('div');
      bar.className = `player-resource-bar ${resource}`;
      bar.title = title;
      bar.setAttribute('aria-label', title);
      bar.appendChild(document.createElement('i'));
      label.appendChild(bar);
    }

    this.labelHost.appendChild(label);
    this.playerStatusLabel = label;
  }

  rand() {
    this.seed = (Math.imul(1664525, this.seed) + 1013904223) >>> 0;
    return this.seed / 4294967296;
  }
  mat(
    color: T.ColorRepresentation,
    extra: T.MeshStandardMaterialParameters = {},
  ) {
    return new T.MeshStandardMaterial({
      color,
      flatShading: true,
      roughness: 0.9,
      ...extra,
    });
  }
  mesh(
    geo: T.BufferGeometry,
    material: T.Material,
    parent: T.Object3D,
    x = 0,
    y = 0,
    z = 0,
  ) {
    const m = new T.Mesh(geo, material);
    m.position.set(x, y, z);
    m.castShadow = true;
    m.receiveShadow = true;
    parent.add(m);
    return m;
  }
  buildTerrain() {
    this.scene.add(this.terrain);
    const geo = new T.PlaneGeometry(116, 116, 38, 38).toNonIndexed();
    geo.rotateX(-Math.PI / 2);
    const colors: number[] = [];
    const color = new T.Color();
    for (let i = 0; i < geo.attributes.position.count; i += 3) {
      color.setHSL(
        0.245 + this.rand() * 0.045,
        0.25 + this.rand() * 0.16,
        0.32 + this.rand() * 0.1,
      );
      for (let j = 0; j < 3; j++) colors.push(color.r, color.g, color.b);
    }
    geo.setAttribute('color', new T.Float32BufferAttribute(colors, 3));
    this.mesh(
      geo,
      this.mat('#ffffff', { vertexColors: true }),
      this.terrain,
    ).castShadow = false;
    const pathMat = createBasicMapMaterial('path');
    const path = (x: number, z: number, w: number, d: number, angle = 0) => {
      const m = this.mesh(
        new T.PlaneGeometry(w, d),
        pathMat,
        this.terrain,
        x,
        0.035,
        z,
      );
      m.rotation.set(-Math.PI / 2, 0, angle);
      m.castShadow = false;
    };
    path(0, 0, 5, 91);
    path(0, 5, 70, 3.3, 0.2);
    path(5, -17, 38, 3, 0.43);
    const stones = createBasicMapMaterial('rock', { color: '#b0b9a0' });
    const darkStone = createBasicMapMaterial('rock', { color: '#68756a' });
    const transform = new T.Object3D();
    const rocks = new T.InstancedMesh(
      new T.DodecahedronGeometry(1, 0),
      stones,
      105,
    );
    rocks.castShadow = false;
    rocks.receiveShadow = false;
    for (let i = 0; i < 105; i++) {
      let x = (this.rand() - 0.5) * 99;
      const z = (this.rand() - 0.5) * 99;
      if (Math.abs(x) < 6) x += 9;
      const s = 0.35 + this.rand() * 1.1;
      transform.position.set(x, s * 0.45, z);
      transform.scale.set(s, s * 0.7, s * 0.8);
      transform.rotation.set(this.rand(), this.rand() * 6, this.rand());
      transform.updateMatrix();
      rocks.setMatrixAt(i, transform.matrix);
    }
    this.terrain.add(rocks);
    const grass = new T.InstancedMesh(
      new T.ConeGeometry(0.12, 0.65, 3),
      createBasicMapMaterial('grass', { color: '#b1bb65' }),
      650,
    );
    grass.castShadow = false;
    grass.receiveShadow = false;
    for (let i = 0; i < 650; i++) {
      let x = (this.rand() - 0.5) * 100;
      const z = (this.rand() - 0.5) * 100;
      if (Math.abs(x) < 3) x += 4;
      transform.position.set(x, 0.25, z);
      transform.rotation.set(0, this.rand() * 6, 0);
      transform.scale.setScalar(0.6 + this.rand());
      transform.updateMatrix();
      grass.setMatrixAt(i, transform.matrix);
    }
    this.terrain.add(grass);
    const flowers = new T.InstancedMesh(
      new T.IcosahedronGeometry(0.16, 0),
      createBasicMapMaterial('sand', { color: '#e7d6a2' }),
      180,
    );
    flowers.castShadow = false;
    flowers.receiveShadow = false;
    for (let i = 0; i < 180; i++) {
      transform.position.set(
        (this.rand() - 0.5) * 72,
        0.3,
        (this.rand() - 0.5) * 72,
      );
      transform.scale.setScalar(0.7 + this.rand());
      transform.updateMatrix();
      flowers.setMatrixAt(i, transform.matrix);
    }
    this.terrain.add(flowers);
    const water = this.mesh(
      new T.CircleGeometry(11, 32),
      createBasicMapMaterial('water', { color: '#3c8e8a', metalness: 0.28, roughness: 0.35 }),
      this.terrain,
      24,
      0.06,
      -3,
    );
    water.rotation.x = -Math.PI / 2;
    water.scale.y = 0.62;
    water.castShadow = false;
    const pondEdge = this.mesh(
      new T.RingGeometry(10.7, 11.6, 32),
      this.mat('#8b9d79'),
      this.terrain,
      24,
      0.05,
      -3,
    );
    pondEdge.rotation.x = -Math.PI / 2;
    pondEdge.scale.y = 0.62;
    pondEdge.castShadow = false;
    for (let i = 0; i < 10; i++) {
      const a = i * 2.4;
      const rock = this.mesh(
        new T.DodecahedronGeometry(0.7 + this.rand()),
        darkStone,
        this.terrain,
        24 + Math.cos(a) * 10.9,
        0.45,
        -3 + Math.sin(a) * 6.8,
      );
      rock.scale.y = 0.6;
    }
    for (const x of [-6, 6])
      for (const z of [-27, -35]) {
        this.mesh(
          new T.CylinderGeometry(0.85, 1, 0.55, 6),
          stones,
          this.terrain,
          x,
          0.3,
          z,
        );
        this.mesh(
          new T.CylinderGeometry(0.55, 0.72, 3.7, 6),
          stones,
          this.terrain,
          x,
          2.1,
          z,
        );
        this.mesh(
          new T.CylinderGeometry(0.9, 0.85, 0.4, 6),
          stones,
          this.terrain,
          x,
          4,
          z,
        );
      }
    this.mesh(new T.BoxGeometry(13, 1, 1.6), stones, this.terrain, 0, 4.5, -35);
    const arena = this.mesh(
      new T.CircleGeometry(8, 12),
      this.mat('#76846a'),
      this.terrain,
      0,
      0.045,
      -32,
    );
    arena.rotation.x = -Math.PI / 2;
    arena.castShadow = false;
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      this.mesh(
        new T.BoxGeometry(0.6, 0.15, 1.3),
        this.mat('#bec19a'),
        this.terrain,
        Math.sin(a) * 7,
        0.12,
        -32 + Math.cos(a) * 7,
      ).rotation.y = a;
    }
  }
  buildShrine() {
    this.scene.add(this.shrine);
    const stone = this.mat('#a4b2a1');
    for (let i = 0; i < 3; i++)
      this.mesh(
        new T.CylinderGeometry(3.6 - i * 0.7, 3.9 - i * 0.7, 0.3, 8),
        stone,
        this.shrine,
        0,
        0.15 + i * 0.3,
        0,
      );
    const rim = this.mesh(
      new T.TorusGeometry(3.8, 0.28, 5, 12),
      stone,
      this.shrine,
      0,
      4.6,
      -1.9,
    );
    rim.rotation.y = 0.1;
    this.mesh(new T.BoxGeometry(0.8, 3, 1), stone, this.shrine, -3, 1.5, -1.9);
    this.mesh(new T.BoxGeometry(0.8, 3, 1), stone, this.shrine, 3, 1.5, -1.9);
    this.crystal = this.mesh(
      new T.OctahedronGeometry(0.75, 0),
      this.mat('#a2f1d1', {
        emissive: '#5be2bf',
        emissiveIntensity: 1.4,
        metalness: 0.3,
        roughness: 0.2,
      }),
      this.shrine,
      0,
      2.6,
      0,
    );
    this.crystal.scale.y = 1.7;
    const ring = this.mesh(
      new T.TorusGeometry(1.35, 0.045, 5, 32),
      this.mat('#e4d69e', { emissive: '#ccbb74', emissiveIntensity: 0.5 }),
      this.shrine,
      0,
      1.4,
      0,
    );
    ring.rotation.x = Math.PI / 2;
    const light = new T.PointLight('#8cf9cd', 15, 12, 2);
    light.position.set(0, 3, 0);
    this.shrine.add(light);
    const floor = this.mesh(
      new T.RingGeometry(4, 4.07, 64),
      this.mat('#bedbbb'),
      this.shrine,
      0,
      0.065,
      0,
    );
    floor.rotation.x = -Math.PI / 2;
    floor.castShadow = false;
  }
  buildHero() {
    const model=createCharacterModel(this.hero);
    this.characterModel = model;
    this.actor=model.actor;this.arm=model.arm;this.legs=model.legs;this.aura=model.aura;
    this.scene.add(this.actor);
  }
  buildEnemies() {
    if (this.hero.inCity) return;
    for (const spawn of fieldSpawns(FIELDS[this.hero.currentField])) {
      this.makeEnemy(spawn.id, spawn.x, spawn.z, spawn.definition.variant === 'boss', spawn.definition);
    }
    this.bossSpawned = true;
  }
  makeEnemy(id: number, x: number, z: number, boss: boolean, definition?: MonsterDefinition) {
    const g = new T.Group();
    g.position.set(x, this.groundHeight(x,z), z);
    this.scene.add(g);
    const variant = definition?.variant ?? (boss ? 'boss' : 'normal');
    const body = createMonsterBody(definition ?? {id:'verdant-plains-0',variant,visualScale:boss?2.35:1});
    g.add(body);
    if (variant !== 'normal') {
      const aura = this.mesh(new T.RingGeometry(boss?2.5:1.1,boss?2.65:1.22,24),
        new T.MeshBasicMaterial({color:definition?.nameColor??'#e8a4ee',transparent:true,opacity:.4,depthWrite:false,side:T.DoubleSide}),g,0,.07,0);
      aura.rotation.x=-Math.PI/2;aura.castShadow=false;aura.receiveShadow=false;
    }
    const ring = this.mesh(
      new T.RingGeometry(0.1, variant === 'boss' ? 5.6 : variant === 'elite' ? 2.2 : 1.4, 40),
      new T.MeshBasicMaterial({
        color: definition?.nameColor ?? (boss ? '#d3a5e8' : '#ecaa78'),
        transparent: true,
        opacity: 0,
        depthWrite: false,
        side: T.DoubleSide,
      }),
      g,
      0,
      0.08,
      0,
    );
    ring.rotation.x = -Math.PI / 2;
    ring.castShadow = false;
    const levelScale = 1 + (this.hero.level - 1) * 0.05;
    const enemyMax = definition?.maxHP ?? Math.round((boss ? 360 : 48) * levelScale);
    const respawnKey = monsterRespawnKey(definition?.id ?? this.hero.currentField, id, this.hero.currentField);
    const savedRespawn = definition ? restoreRespawnDeadline(this.hero.monsterRespawnState,definition.id,id,this.hero.currentField) : 0;
    if (savedRespawn > Date.now()) this.hero.monsterRespawnState[respawnKey] = savedRespawn;
    const respawn = savedRespawn > Date.now() ? (savedRespawn - Date.now()) / 1000 : 0;
    this.enemies.push({
      id,
      definition,
      respawnKey,
      respawnDeadline: savedRespawn,
      group: g,
      hp: respawn > 0 ? 0 : enemyMax,
      max: enemyMax,
      boss,
      home: g.position.clone(),
      cooldown: 0.8 + (id % 3) * 0.4,
      windup: 0,
      respawn,
      flash: 0,
      ring,
      stun: 0,
      slow: 0,
      root: 0,
      poison: 0,
      poisonTick: 0,
      marked: false,
      weakPoint: false,
      defenseDown: 0,
      attack: definition?.attack ?? (boss ? 26 : 10),
      attackRange: definition?.attackRange ?? (boss ? 5.6 : 1.8),
      movementSpeed: definition?.movementSpeed ?? (boss ? 1.3 : 2.1),
    });
    this.registerTargetEnemy(this.enemies[this.enemies.length-1]);
    if (respawn > 0) g.visible = false;
    if (!boss) {
      const label = document.createElement('div');
      label.className = 'enemy-label';
      const name = document.createElement('small');
      name.textContent = definition ? `${definition.name} · Lv${definition.level} · ${definition.statusLabel}` : 'Lumut Liar · Normal';
      name.style.color = definition?.nameColor ?? '#d6e5bd';
      const track = document.createElement('div');
      const fill = document.createElement('i');
      track.appendChild(fill);
      label.appendChild(name);
      label.appendChild(track);
      this.labelHost.appendChild(label);
      this.enemyLabels.set(id, label);
    }
  }
  spawnGroundLoot(item: ItemData, position: T.Vector3) {
    const group = new T.Group();
    const color = item.rarity === 'mythic' || item.rarity === 'ancient'
      ? '#f2c66d'
      : item.rarity === 'legendary' ? '#e8a4ee' : '#9ed8c5';
    const crystal = new T.Mesh(
      new T.OctahedronGeometry(0.3, 0),
      new T.MeshBasicMaterial({ color, transparent: true, opacity: 0.92 }),
    );
    crystal.position.y = 0.55;
    group.add(crystal);
    const ring = new T.Mesh(
      new T.TorusGeometry(0.55, 0.045, 6, 20),
      new T.MeshBasicMaterial({ color, transparent: true, opacity: 0.7 }),
    );
    ring.rotation.x = -Math.PI / 2;
    ring.position.y = 0.08;
    group.add(ring);
    group.position.set(position.x, this.groundHeight(position.x, position.z), position.z);
    this.scene.add(group);
    const label = document.createElement('span');
    label.className = 'floating reward';
    label.textContent = `${item.name}${item.quantity > 1 ? ` x${item.quantity}` : ''}`;
    const rarityColors: Record<string, string> = {
      common: '#dfe9d0',
      uncommon: '#9cdc7c',
      rare: '#7bb7ff',
      epic: '#b88cff',
      legendary: '#ffcb69',
      mythic: '#ff8d5b',
      ancient: '#ffd36a',
    };
    const rarityColor = rarityColors[item.rarity ?? 'common'] ?? '#dfe9d0';
    label.style.color = rarityColor;
    label.style.textShadow = `0 0 8px ${rarityColor}66, 0 0 18px ${rarityColor}4d`;
    label.style.fontWeight = '700';
    label.style.letterSpacing = '0.08em';
    this.labelHost.appendChild(label);
    this.groundLoot.push({ id: item.id, item, group, label });
  }
  spawnGoldDrop(amount: number, position: T.Vector3) {
    const group = new T.Group();
    group.position.set(position.x, this.groundHeight(position.x, position.z), position.z);
    const fallback = new T.Mesh(
      new T.CylinderGeometry(0.32, 0.32, 0.1, 24),
      new T.MeshStandardMaterial({ color: '#f4c542', emissive: '#a66d08', emissiveIntensity: 0.55, metalness: 0.8, roughness: 0.25 }),
    );
    fallback.rotation.z = Math.PI / 2;
    fallback.position.y = 0.35;
    group.add(fallback);
    this.scene.add(group);
    const label = document.createElement('span');
    label.className = 'floating reward';
    label.textContent = `${amount} Gold Coins`;
    this.labelHost.appendChild(label);
    const drop: GroundGold = { id: `gold-${Date.now()}-${this.groundGold.length}`, amount, group, label };
    this.groundGold.push(drop);
    loadGoldCoin().then(source => {
      if (this.disposed || !this.groundGold.includes(drop)) return;
      const model = source.clone(true);
      const bounds = new T.Box3().setFromObject(model);
      const size = bounds.getSize(new T.Vector3());
      const largestDimension = Math.max(size.x, size.y, size.z);
      if (largestDimension > 0) model.scale.setScalar(0.65 / largestDimension);
      model.traverse(object => {
        if (!(object instanceof T.Mesh)) return;
        const goldMaterial = new T.MeshStandardMaterial({
          color: '#f5b402',
          emissive: '#f2b949',
          emissiveIntensity: 0.45,
          metalness: 0.9,
          roughness: 0.0,
        });
        object.material = Array.isArray(object.material)
          ? object.material.map(() => goldMaterial)
          : goldMaterial;
      });
      model.position.y = 0.28;
      group.remove(fallback);
      group.add(model);
    }).catch(() => undefined);
  }
  pickupGroundLoot() {
    if (!this.started || this.paused || this.dead) return false;
    const pickupRadius = 4;
    let nearestItem: GroundLoot | undefined;
    let nearestGold: GroundGold | undefined;
    let nearestDistance = pickupRadius;
    for (const loot of this.groundLoot) {
      const distance = Math.hypot(this.actor.position.x - loot.group.position.x, this.actor.position.z - loot.group.position.z);
      if (distance < nearestDistance) { nearestItem = loot; nearestGold = undefined; nearestDistance = distance; }
    }
    for (const gold of this.groundGold) {
      const distance = Math.hypot(this.actor.position.x - gold.group.position.x, this.actor.position.z - gold.group.position.z);
      if (distance < nearestDistance) { nearestGold = gold; nearestItem = undefined; nearestDistance = distance; }
    }
    if (nearestGold) {
      this.hero.gold += nearestGold.amount;
      this.scene.remove(nearestGold.group);
      nearestGold.label.remove();
      this.groundGold = this.groundGold.filter(drop => drop !== nearestGold);
      this.message(`${nearestGold.amount} GOLD diambil.`);
      this.save();
      this.emit();
      return true;
    }
    if (!nearestItem) return false;
    const result = addItemToInventory(this.hero.inventory, nearestItem.item, this.hero.inventoryCapacity);
    this.hero.inventory = result.inventory;
    if (result.remaining) {
      nearestItem.item = { ...nearestItem.item, quantity: result.remaining };
      this.message('Inventory penuh. Kosongkan slot terlebih dahulu.');
      return false;
    }
    nearestItem.label.remove();
    this.scene.remove(nearestItem.group);
    nearestItem.group.traverse(object => {
      if (object instanceof T.Mesh) {
        object.geometry.dispose();
        const materials = Array.isArray(object.material) ? object.material : [object.material];
        materials.forEach(material => material.dispose());
      }
    });
    this.groundLoot = this.groundLoot.filter(loot => loot !== nearestItem);
    this.message(`${nearestItem.item.name}${nearestItem.item.quantity > 1 ? ` x${nearestItem.item.quantity}` : ''} diambil.`, nearestItem.item);
    this.save();
    this.emit();
    return true;
  }
  clearGroundLoot() {
    for (const loot of this.groundLoot) {
      this.scene.remove(loot.group);
      loot.label.remove();
      loot.group.traverse(object => {
        if (object instanceof T.Mesh) {
          object.geometry.dispose();
          const materials = Array.isArray(object.material) ? object.material : [object.material];
          materials.forEach(material => material.dispose());
        }
      });
    }
    this.groundLoot = [];
    for (const gold of this.groundGold) {
      this.scene.remove(gold.group);
      gold.label.remove();
    }
    this.groundGold = [];
  }
  spawnBoss(notify = true) {
    if (this.hero.inCity) return;
    const existing = this.enemies.find(enemy => enemy.boss);
    if (existing) { this.bossSpawned = true; return; }
    this.bossSpawned = true;
    const spawn=fieldSpawns(FIELDS[this.hero.currentField]).find(s=>s.id===100)!;
    this.makeEnemy(spawn.id, spawn.x, spawn.z, true, spawn.definition);
    if (notify)
      this.message(`${FIELDS[this.hero.currentField].fieldBoss.name} terbangun. Cari arena di utara.`);
  }
  snapshot(): Snapshot {
    const derived = derivedStats(this.hero);
    const skillViews = activeSkills(this.hero).map((skill) => ({
      id: skill.id,
      name: skill.name,
      description: skill.description,
      slot: skill.slot,
      ...skillCosts(this.hero,skill),
      remaining: Math.max(0, this.skillCooldowns[skill.id] ?? 0),
      level: this.hero.skillLevels[skill.id] ?? 0,
      unlocked: isSkillUnlocked(this.hero, skill),
      unlockLevel: skill.unlockLevel,
      visualEffect: skill.visualEffect,
    }));
    const classQuest = getVisibleJobArchitecture(this.hero).hint ?? (
      this.hero.level < 10
        ? `Level ${this.hero.level}/10 · Latih diri sebagai Adventurer`
        : !this.hero.coreJob
          ? 'Class Quest siap · pilih Core Job'
          : this.hero.level < 25
            ? `Level ${this.hero.level}/25 · Persiapkan Specialization Quest`
            : !this.hero.specialization
              ? 'Specialization Quest siap · pilih Special Job'
              : this.hero.level < 40
                ? `Level ${this.hero.level}/40 · Buka Mastery`
                : !this.hero.masteryQuestClaimed
                  ? 'Mastery Quest siap · pilih modifikasi skill'
                  : 'Mastery aktif · capstone level 50 menanti');
    return {
      cameraMode: this.cameraMode,
      currentTarget:this.currentTargetView(),
      combatFeedback:this.combatFeedbackSnapshot(),
      forgeNpcId: this.forgeNpcId && !forgeAccessReason(this.hero, this.forgeNpcId) ? this.forgeNpcId : null,
      audioSettings: { ...this.bgm.settings },
      bgmStatus: this.bgm.status,
      hotbarEditMode: this.hotbarEditMode,
      hotbarRuntime: {
        attackRemaining: this.attackTimer,
        itemCooldowns: Object.fromEntries(Object.entries(this.hero.itemCooldowns).map(([id,until])=>[id,Math.max(0,(until-Date.now())/1000)])),
        lastUsedIndex: this.lastHotbarSlot,
        useSequence: this.hotbarUseSequence,
      },
      hero: { ...this.hero },
      started: this.started,
      paused: this.paused,
      dead: this.dead,
      stamina: this.stamina,
      cooldown: this.cooldown,
      notice: this.notice,
      noticeId: this.noticeId,
      noticeItem: this.noticeItem,
      saved: this.saved,
      nearShrine: this.nearSanctuary,
      enemies: this.enemies
        .filter((e) => e.hp > 0)
        .map((e) => ({
          id: e.id,
          x: e.group.position.x,
          z: e.group.position.z,
          hp: e.hp,
          max: e.max,
          boss: e.boss,
          variant: e.definition?.variant ?? (e.boss ? 'boss' : 'normal'),
          name: e.definition?.name ?? 'Lumut Liar',
          level: e.definition?.level ?? 1,
          respawn: Math.max(0, e.respawn),
        })),
      groundLoot: this.groundLoot.map(loot => ({
        id: loot.id,
        x: loot.group.position.x,
        z: loot.group.position.z,
        name: loot.item.name,
        quantity: loot.item.quantity,
      })),
      bossActive: this.enemies.some(e => e.boss && e.hp > 0),
      bossRespawn: Math.ceil(this.enemies.find(e => e.boss)?.respawn ?? 0),
      bossName: FIELDS[this.hero.currentField]?.fieldBoss.name ?? 'Field Boss',
      combo: this.combo,
      mana: this.hero.mana,
      maxMana: derived.maxMana,
      manaName: manaResourceName(),
      skillPoints: this.hero.skillPoints,
      skillViews,
      classQuest,
      cityName: CITIES[this.hero.currentCity].displayName,
      fieldName: FIELDS[this.hero.currentField].displayName,
      recommendedLevel: FIELDS[this.hero.currentField].recommendedLevel,
      mapId: this.hero.inCity ? this.hero.currentCity : this.hero.currentField,
      inCity: this.hero.inCity,
    };
  }
  buildRegionDecor() {
    const buildToken=++this.regionBuildToken;
    this.regionLoads = [];
    this.regionLoadError = null;
    setArunikaShrineMaterials(this.shrine,null);
    this.arunikaMaterials?.dispose();
    this.arunikaMaterials=this.fieldTerrain?.id==='verdant-plains'?new ArunikaMaterials():null;
    setArunikaShrineMaterials(this.shrine,this.arunikaMaterials);
    this.treeColliders=[];
    this.portalLabels.forEach(p=>p.element.remove());this.portalLabels=[];
    this.npcLabels.forEach(entry=>entry.element.remove());this.npcLabels=[];
    this.scene.remove(this.regionDecor);
    this.regionDecor.traverse(object => { if(object instanceof T.Mesh){object.geometry.dispose(); const materials=Array.isArray(object.material)?object.material:[object.material]; materials.forEach(material=>material.dispose());} });
    this.regionDecor = new T.Group(); this.scene.add(this.regionDecor);
    const city = CITIES[this.hero.currentCity];
    const field = FIELDS[this.hero.currentField];
    const color = this.hero.inCity ? this.hero.currentCity==='arunika'?'#dfe9bb':'#d8d9d0' : field.color;
    this.scene.background = new T.Color(color); this.scene.fog = null;
    const isSandsLocation=this.isSandsLocation;
    this.worldLightRig.visible=!isSandsLocation;
    this.sandsLightRig.visible=isSandsLocation;
    this.renderer.toneMappingExposure = isSandsLocation ? 1.35 : 1.1;
    const scale=regionScale(this.hero.inCity);
    this.terrain.scale.set(scale,1,scale);
    this.terrain.visible=!this.fieldTerrain;
    this.terrainSurface=null;
    this.sandsGround=null;
    const sanctuary=this.fieldTerrain?.sanctuary??{x:0,z:0};
    this.shrine.position.set(sanctuary.x,this.groundHeight(sanctuary.x,sanctuary.z),sanctuary.z);
    this.shrine.visible=true;
    if(isSandsLocation) {
      this.terrain.visible=false;
      this.shrine.visible=false;
      this.scene.background=new T.Color('#e7d9a8');this.scene.fog=null;
      this.buildSandsLocation(buildToken);
      return;
    }
    if(this.fieldTerrain) {
      const built=buildFieldTerrain(this.fieldTerrain,this.arunikaMaterials??undefined);this.regionDecor.add(built.group);this.terrainSurface=built.surface;
      if(this.fieldTerrain.id==='verdant-plains') this.regionLoads.push(enhancePadangTerrainSurface(built.surface).catch(error=>console.warn('Material terrain Padang Arunika gagal dimuat; memakai material dasar.',error)));
      this.regionLoads.push(built.ready);
      this.scene.background=new T.Color('#dfeed7');this.scene.fog=null;
      const camp=FIELD_NPCS[this.hero.currentField];
      const person=new T.Group();person.position.set(camp.x,this.groundHeight(camp.x,camp.z),camp.z);person.userData.npcId=camp.id;this.regionDecor.add(person);
      this.mesh(new T.CylinderGeometry(.35,.45,1.2,6),this.mat('#d0a95c'),person,0,.65,0);
      this.mesh(new T.SphereGeometry(.3,8,6),this.mat('#cda07a'),person,0,1.5,0);
      this.addNpcLabel(camp);
      const eastern=this.fieldTerrain.theme==='eastern-frontier';
      const portals=[{...this.fieldTerrain.cityGate,destination:field.cityId,name:CITIES[field.cityId].displayName,yaw:this.fieldTerrain.cityGateYaw??0,blue:false,labelHeight:7.5},
        ...(field.nextMap?[{...field.exit,destination:field.nextMap,name:`${eastern?'Portal Travel · ':''}${FIELDS[field.nextMap].displayName} · Lv${FIELDS[field.nextMap].minLevel}`,yaw:0,blue:eastern,labelHeight:eastern?7.4:5}]:[])];
      for(const p of portals) {
        const radius=p.blue?2.4:1.7,center=p.blue?2.8:2;
        const portal=this.mesh(new T.TorusGeometry(radius,.14,6,p.blue?32:24),this.mat(p.blue?'#7bddff':'#d0d98e',{emissive:p.blue?'#35a7ff':'#93c9a8',emissiveIntensity:.7}),this.regionDecor,p.x,this.groundHeight(p.x,p.z)+center,p.z);
        if(this.arunikaMaterials) {
          addArunikaSurfaceUv(portal.geometry);(portal.material as T.Material).dispose();
          portal.material=this.arunikaMaterials.get('portal_effect');
        }
        portal.rotation.y=p.yaw;
        portal.userData.destination=p.destination;
        if(p.blue){
          const energy=this.mesh(new T.CircleGeometry(radius-.12,32),new T.MeshBasicMaterial({color:'#48aaff',transparent:true,opacity:.38,side:T.DoubleSide,depthWrite:false}),this.regionDecor,p.x,this.groundHeight(p.x,p.z)+center,p.z);
          energy.userData.destination=p.destination;energy.castShadow=false;
          for(const r of [.55,1.3,1.9])this.mesh(new T.TorusGeometry(r,.055,4,32),new T.MeshBasicMaterial({color:'#b2f3ff',transparent:true,opacity:.85}),this.regionDecor,p.x,this.groundHeight(p.x,p.z)+center,p.z+.05);
        }
        const trigger=this.mesh(new T.BoxGeometry(radius*2,p.blue?5.6:3.8,.6),new T.MeshBasicMaterial({transparent:true,opacity:0,depthWrite:false}),this.regionDecor,p.x,this.groundHeight(p.x,p.z)+(p.blue?center:1.9),p.z);
        trigger.rotation.y=p.yaw;
        trigger.castShadow=false;trigger.receiveShadow=false;trigger.userData.destination=p.destination;
        const element=document.createElement('div');element.className='npc-label';
        const badge=document.createElement('div');badge.className='npc-service-badge';badge.textContent=`${p.name} · Click to travel`;element.appendChild(badge);this.labelHost.appendChild(element);
        this.portalLabels.push({...p,element});
      }
      this.buildTreeDecor(buildToken);
      return;
    }
    const ground=this.mesh(new T.PlaneGeometry(92*scale,92*scale),this.mat(color),this.regionDecor,0,0.025,0);ground.rotation.x=-Math.PI/2;
    // Render-only city backdrop. The playable ground remains unchanged; this
    // prevents the finite legacy city mesh edge from becoming a hard horizon
    // when the orthographic camera looks beyond it.
    const backdrop=this.mesh(new T.PlaneGeometry(260*scale,260*scale),this.mat(color),this.regionDecor,0,-0.08,0);
    backdrop.rotation.x=-Math.PI/2;
    backdrop.receiveShadow=true;
    if(this.hero.inCity) {
      const frontier=this.hero.currentCity==='jayantara';
      for(const npc of city.npcList) {
        const house=new T.Group();this.regionDecor.add(house);house.position.set(npc.x,0,npc.z-3*CITY_SCALE);
        this.mesh(new T.BoxGeometry(5,2.6,4),this.mat(frontier?'#353c46':'#805634'),house,0,1.3,0);
        const roof=this.mesh(new T.ConeGeometry(4,2,4),this.mat(frontier?'#222836':'#733e30'),house,0,3.4,0);roof.rotation.y=Math.PI/4;
        for(const side of [-1,1]) this.mesh(new T.CylinderGeometry(.12,.12,3,6),this.mat('#b49148'),house,side*2.1,1.5,2);
        const person=new T.Group();this.regionDecor.add(person);person.position.set(npc.x,0,npc.z);
        this.mesh(new T.CylinderGeometry(.35,.45,1.2,6),this.mat('#c5a659'),person,0,.65,0);
        this.mesh(new T.SphereGeometry(.3,8,6),this.mat('#cda07a'),person,0,1.5,0);
        const marker=this.mesh(new T.OctahedronGeometry(.23),this.mat('#ffe39a',{emissive:'#b68b22',emissiveIntensity:.6}),person,0,2.5,0);marker.userData.npcId=npc.id;
        person.userData.npcId=npc.id;
        this.addNpcLabel(npc);
      }
      // Pendopo/candi at the back of the town.
      for(let tier=0;tier<3;tier++) this.mesh(new T.BoxGeometry((14-tier*3)*CITY_SCALE,1.2,(9-tier*2)*CITY_SCALE),this.mat(frontier?'#444650':'#a28253'),this.regionDecor,0,tier*1.2+.6,-34*CITY_SCALE);
      const river=this.mesh(new T.PlaneGeometry(4*CITY_SCALE,80*CITY_SCALE),this.mat('#477c89'),this.regionDecor,24*CITY_SCALE,.12,0);river.rotation.x=-Math.PI/2;
      for(let i=0;i<5;i++) this.mesh(new T.BoxGeometry(6*CITY_SCALE,.12,2*CITY_SCALE),this.mat('#929347'),this.regionDecor,-30*CITY_SCALE,.2,(i*4-10)*CITY_SCALE);
    } else {
      const camp = FIELD_NPCS[this.hero.currentField];
      if (camp) {
        const tent = new T.Group(); this.regionDecor.add(tent); tent.position.set(camp.x-2,0,camp.z);
        this.mesh(new T.CylinderGeometry(2.6,2.6,2.4,5),this.mat('#8b6848'),tent,0,1.2,0);
        const fire = this.mesh(new T.SphereGeometry(.35,8,6),this.mat('#e5a64a',{emissive:'#e56c22',emissiveIntensity:1.2}),tent,0,2.6,0); fire.userData.npcId=camp.id;
        const person = new T.Group(); this.regionDecor.add(person); person.position.set(camp.x,0,camp.z);
        this.mesh(new T.CylinderGeometry(.35,.45,1.2,6),this.mat('#d0a95c'),person,0,.65,0);
        this.mesh(new T.SphereGeometry(.3,8,6),this.mat('#cda07a'),person,0,1.5,0);
        const marker=this.mesh(new T.OctahedronGeometry(.25),this.mat('#ffe39a',{emissive:'#b68b22',emissiveIntensity:.8}),person,0,2.5,0); marker.userData.npcId=camp.id; person.userData.npcId=camp.id;
        this.addNpcLabel(camp);
      }
      for(let i=0;i<12;i++) {
        const x=(i%2?1:-1)*(20+i%3*4),z=-30+i*5;
        const geometry=this.hero.currentField==='whispering-wilds'?new T.CylinderGeometry(.4,.6,8,6):new T.BoxGeometry(2+i%3,3+i%4,2);
        this.mesh(geometry,this.mat(field.color),this.regionDecor,x*scale,2,z*scale);
      }
    }
    const portal=this.mesh(new T.TorusGeometry(2,.25,6,16),this.mat('#dfc26d',{emissive:'#ac752f',emissiveIntensity:.7}),this.regionDecor,0,2,34*(this.hero.inCity?CITY_SCALE:1));
    portal.userData.portal=true;
    this.buildTreeDecor(buildToken);
  }
  buildSandsLocation(buildToken:number) {
    // A transparent surface keeps pointer targeting and combat working while
    // the imported static scene streams in. Movement is bounded separately.
    const ground=this.mesh(new T.PlaneGeometry(28,80),new T.MeshBasicMaterial({transparent:true,opacity:0,depthWrite:false}),this.regionDecor,0,0.01,0);
    ground.rotation.x=-Math.PI/2;ground.castShadow=false;ground.receiveShadow=false;
    this.terrainSurface=ground;
    const camp=FIELD_NPCS['sands-location'];
    const person=new T.Group();this.regionDecor.add(person);person.position.set(camp.x,0,camp.z);person.userData.npcId=camp.id;
    this.mesh(new T.CylinderGeometry(.35,.45,1.2,6),this.mat('#c29a58'),person,0,.65,0);
    this.mesh(new T.SphereGeometry(.3,8,6),this.mat('#cda07a'),person,0,1.5,0);
    const marker=this.mesh(new T.OctahedronGeometry(.25),this.mat('#ffe39a',{emissive:'#c47d26',emissiveIntensity:.8}),person,0,2.5,0);
    marker.userData.npcId=camp.id;
    this.addNpcLabel(camp);
    const portal={...FIELDS['sands-location'].exit,destination:'arunika',name:CITIES.arunika.displayName,labelHeight:5};
    const ring=this.mesh(new T.TorusGeometry(1.35,.16,6,24),this.mat('#dfc26d',{emissive:'#ac752f',emissiveIntensity:.8}),this.regionDecor,portal.x,1.55,portal.z);
    ring.userData.destination=portal.destination;
    const trigger=this.mesh(new T.BoxGeometry(2.7,3.2,.7),new T.MeshBasicMaterial({transparent:true,opacity:0,depthWrite:false}),this.regionDecor,portal.x,1.7,portal.z);
    trigger.userData.destination=portal.destination;
    const element=document.createElement('div');element.className='npc-label';
    const badge=document.createElement('div');badge.className='npc-service-badge';badge.textContent=`${portal.name} · Click to travel`;element.appendChild(badge);this.labelHost.appendChild(element);
    this.portalLabels.push({x:portal.x,z:portal.z,name:portal.name,element,labelHeight:portal.labelHeight});
    this.regionLoads.push(loadSandsLocation().then(source=>{
      if(this.disposed||buildToken!==this.regionBuildToken||!this.isSandsLocation) return;
      const map=cloneImportedMap(source);
      // Keep the supplied scene hierarchy, transforms, materials, textures,
      // normals, and terrain exactly as loaded. Only clone disposable GPU
      // containers so changing region cannot destroy the cached source.
      map.name='SandsLocationStaticMap';
      map.scale.set(SANDS_MAP_SCALE,1,SANDS_MAP_SCALE);
      map.position.set(
        SANDS_MAP_ANCHOR.x * (1 - SANDS_MAP_SCALE),
        0,
        SANDS_MAP_ANCHOR.z * (1 - SANDS_MAP_SCALE),
      );
      this.regionDecor.add(map);
      // The island mesh is scenery, not a walkable road. The supplied object
      // mesh also contains the bridge deck, so it must join terrain collision
      // or the player falls through the bridge to the terrain below.
      this.sandsGround=new ImportedMapGround(map,['map_2_terrain1','map_2_object1']);
      this.regionDecor.remove(ground);ground.geometry.dispose();(ground.material as T.Material).dispose();
      this.terrainSurface=this.sandsGround.surfaces[0]??null;
      this.buildTreeDecor(buildToken);
      this.placeActor();this.cameraFocus.copy(this.actor.position);
      for(const enemy of this.enemies) {
        const p=this.sandsGround.nearestPoint(enemy.group.position,FIELDS['sands-location'].entry);
        enemy.group.position.set(p.x,this.groundHeight(p.x,p.z),p.z);
        enemy.home.copy(enemy.group.position);
      }
      person.position.y=this.groundHeight(camp.x,camp.z);
      const portalHeight=this.groundHeight(portal.x,portal.z);
      ring.position.y=portalHeight+1.55;trigger.position.y=portalHeight+1.7;
    }).catch(error=>{
      if(!this.disposed&&buildToken===this.regionBuildToken) {
        this.regionLoadError = error;
        console.warn('Sands Location gagal dimuat',error);
      }
    }));
  }
  buildTreeDecor(buildToken:number) {
    const regionId=this.hero.inCity?this.hero.currentCity:this.hero.currentField;
    const terrain=this.fieldTerrain;
    this.regionLoads.push(buildStylizedTreeDecor(regionId,this.hero.inCity,(x,z)=>this.groundHeight(x,z),terrain).then(group=>{
      if(this.disposed||buildToken!==this.regionBuildToken)return;
      this.regionDecor.add(group);
      this.treeColliders=group.children.flatMap(tree=>tree.userData.trunkCollider?[tree.userData.trunkCollider as TreeCollider]:[]);
      // A saved actor/enemy can already stand here before the GLBs finish loading.
      this.move(0,0);
      for(const enemy of this.enemies)this.moveEnemy(enemy,0,0);
    }).catch(error=>{
      if(!this.disposed&&buildToken===this.regionBuildToken) {
        this.regionLoadError = error;
        console.warn('Stylized Tree gagal dimuat',error);
      }
    }));
  }
  changeRegion(id:string) {
    if(this.transitioning) return false;
    const result=travel(this.hero,id); if(!result.ok){this.message(result.reason);return false;}
    this.clearSkillRuntime();
    this.closeNpcMenu();
    this.transitioning=true;this.clearInput();
    try {
      this.clearGroundLoot();
      for(const enemy of this.enemies){this.scene.remove(enemy.group);enemy.group.traverse(object=>{if(object instanceof T.Mesh){object.geometry.dispose();const materials=Array.isArray(object.material)?object.material:[object.material];materials.forEach(material=>material.dispose());}});}
      this.enemyLabels.forEach(label=>label.remove());this.enemyLabels.clear();this.enemies=[];this.targetEntities.clear();this.bossSpawned=false;
      this.buildEnemies();this.buildRegionDecor();this.placeActor();this.cameraFocus.copy(this.actor.position);
      this.invincible=2;this.save();this.message(result.reason);return true;
    } finally {this.transitioning=false;this.emit();}
  }
  openNpc(id:string) {
    const npc=this.hero.inCity?CITIES[this.hero.currentCity].npcList.find(entry=>entry.id===id):FIELD_NPCS[this.hero.currentField]?.id===id?FIELD_NPCS[this.hero.currentField]:undefined;
    if(!npc)return false;
    if(Math.hypot(this.hero.x-npc.x,this.hero.z-npc.z)>npc.interactionRange){this.message('Terlalu jauh dari NPC');return false;}
    this.closeForge();
    // NPC services are overlays in the online world; opening one must not
    // freeze simulation, combat timers, or other players.
    this.currentNpc=npc;this.activeNpcMenu=true;this.npcInteractionMode=true;this.shopMode='buy';
    window.dispatchEvent(new CustomEvent('lumenfall:npc',{detail:id}));
    return true;
  }
  addNpcLabel(npc:NpcDefinition) {
    const element=document.createElement('div');element.className='npc-label';
    const serviceElement=document.createElement('div');serviceElement.className='npc-service-badge';serviceElement.textContent=getNpcServiceLabel(npc,this.hero);
    const nameElement=document.createElement('div');nameElement.className='npc-name';nameElement.textContent=`◆ ${npc.name}`;
    element.appendChild(serviceElement);element.appendChild(nameElement);
    this.labelHost.appendChild(element);this.npcLabels.push({npc,element,nameElement});
  }
  closeNpcMenu() {
    this.closeForge();
    this.currentNpc=null;this.activeNpcMenu=false;this.npcInteractionMode=false;this.shopMode='buy';
  }
  openForge() {
    const id = this.currentNpc?.id;
    const reason = !this.started || this.dead || !this.activeNpcMenu
      ? 'Klik NPC Forge Master terlebih dahulu.'
      : forgeAccessReason(this.hero, id);
    if (reason) { this.message(reason); return false; }
    this.closeNpcMenu();
    this.forgeNpcId = id!;
    this.emit();
    return true;
  }
  closeForge() {
    const wasOpen=Boolean(this.forgeNpcId);
    this.forgeNpcId=null;
    if(wasOpen&&this.hero.runeForgePending){
      const next={...this.hero,runeForgePending:null};
      try {saveCharacter(next,true);this.hero=next;}
      catch {this.message('Hasil Rune belum dapat ditutup karena save gagal. Biaya roll tetap sudah terpakai.');}
    }
  }
  npcBuy(templateId:string,quantity=1) {
    const npc=this.currentNpc;if(!npc||!this.activeNpcMenu||!npc.services.includes('buy')){this.message('NPC ini tidak menyediakan layanan beli.');return false;}
    const result=npc.fieldId?buyFieldShopItem(this.hero,npc.fieldId,templateId,quantity):buyShopItem(this.hero,templateId,npc.service,quantity);
    this.save();this.message(result.reason);return result.ok;
  }
  npcSell(itemId:string,quantity:number) {
    const npc=this.currentNpc;if(!npc||!this.activeNpcMenu||!npc.services.includes('sell')){this.message('NPC ini tidak menyediakan layanan jual.');return false;}
    const categories=npc.service==='equipment'?['weapon','armor','accessory']:undefined;
    const result=sellInventoryItem(this.hero,itemId,quantity,categories);
    this.save();this.message(result.reason);return result.ok;
  }
  cityAction(action:string,id='',quantity=1) {
    if(!this.hero.inCity&&!['accept','complete'].includes(action)){this.message('Kembali ke kota untuk layanan ini.');return false;}
    const services=this.currentNpc?.services ?? [];
    const requiredService=action==='heal'?'heal':action==='tutorial'?'tutorial':action==='deposit'||action==='withdraw'?'storage':action.startsWith('buy-')?'buy':action==='accept'||action==='complete'||action==='claim-main'?'quest':null;
    if(requiredService&&(!this.activeNpcMenu||!services.includes(requiredService))){this.message('Klik NPC dengan layanan yang sesuai terlebih dahulu.');return false;}
    let result={ok:false,reason:'Layanan tidak tersedia.'};
    if(action==='heal'){healAtCity(this.hero);if(isResourceEnabled(this.hero, 'stamina'))this.stamina=derivedStats(this.hero).staminaMax;result={ok:true,reason:isResourceEnabled(this.hero, 'stamina')?'HP, Mana, stamina, dan status dipulihkan.':'HP, Mana, dan status dipulihkan.'};}
    if(action==='tutorial'){this.hero.activeBuffs.damageReduction=300;result={ok:true,reason:'Berkah Pijar aktif selama 5 menit. WASD bergerak dengan lari otomatis berkecepatan sedang, klik kiri menyerang, klik kanan-drag kamera, F guard, 1–0 PrimaryHotbar (awal: skill di 1–4). C Character Overview, J Jurnal Misi, K Job Skill. Klik tombol Edit Mode di hotbar untuk mengatur shortcut.'};}
    if(action==='deposit'||action==='withdraw')result=transferStorage(this.hero,id,action==='withdraw',quantity);
    if(action.startsWith('buy-'))result=buyShopItem(this.hero,id,action.slice(4));
    if(action==='accept'){
      const accepted=acceptRegionQuest(this.hero,id);
      const entry=getQuestRegistry().find(quest=>quest.id===id);
      result={ok:accepted,reason:accepted?`Quest berhasil diambil: ${entry?.title??id}`:id==='main-verdant-bisikan'?'Quest sudah selesai atau sedang aktif.':'Quest tidak dapat diterima. Periksa level, prerequisite, map, dan job.'};
    }
    if(action==='claim-main'){
      action='complete';
      id='main-verdant-bisikan';
    }
    if(action==='complete'){
      const planned=regionQuestReward(id);
      const rewardItems=planned.items.map(reward=>createItem(reward.templateId,{quantity:reward.quantity}));
      let simulatedInventory=this.hero.inventory;
      for(const rewardItem of rewardItems){
        const preview=addItemToInventory(simulatedInventory,rewardItem,this.hero.inventoryCapacity);
        if(preview.remaining){
          result={ok:false,reason:'Inventory penuh. Kosongkan ruang sebelum mengklaim reward quest.'};
          this.save();this.message(result.reason);return false;
        }
        simulatedInventory=preview.inventory;
      }
      const quest=completeRegionQuest(this.hero,id);
      result={ok:quest.ok,reason:quest.reason};
      if(quest.ok){
        for(const rewardItem of rewardItems)this.hero.inventory=addItemToInventory(this.hero.inventory,rewardItem,this.hero.inventoryCapacity).inventory;
        this.hero.gold+=quest.reward.gold;
        gainXP(this.hero,quest.reward.xp);
        const itemSummary=rewardItems.map(item=>`${item.name} x${item.quantity}`).join(', ');
        const rewardSummary=[quest.reward.xp?`${quest.reward.xp} EXP`:'',quest.reward.gold?`${quest.reward.gold} GOLD`:'',itemSummary].filter(Boolean).join(' dan ');
        result.reason=`Quest selesai! Kamu mendapatkan ${rewardSummary}.`;
        refreshUnlocks(this.hero);
      }
    }
    this.save();this.message(result.reason);return result.ok;
  }
  fieldAction(action:string,id='') {
    if(this.hero.inCity){this.message('Field camp hanya tersedia di field map.');return false;}
    if(!this.currentNpc||!this.activeNpcMenu){this.message('Klik NPC field terlebih dahulu.');return false;}
    let result={ok:false,reason:'Layanan field camp tidak tersedia.'};
    if(action==='buy'&&this.currentNpc.services.includes('buy')) result=buyFieldShopItem(this.hero,this.hero.currentField,id);
    if(action==='city'&&this.currentNpc.services.includes('teleport')) return this.changeRegion(this.hero.currentCity);
    if(action==='teleport'&&this.currentNpc.services.includes('teleport')) { this.message('Buka peta dengan M untuk memilih field yang sudah terbuka.'); return true; }
    this.save();this.message(result.reason);return result.ok;
  }
  emit() {
    const musicId = this.hero.inCity ? CITIES[this.hero.currentCity]?.musicId : FIELDS[this.hero.currentField]?.musicId;
    this.bgm.setHidden(document.hidden);
    this.bgm.setTrack(resolveBgmTrack(musicId ?? null, this.started));
    this.onSnapshot(this.snapshot());
  }
  setAudioSettings(settings: Partial<AudioSettings>) {
    this.bgm.configure(settings);
    this.muted = this.bgm.settings.muted;
    try { saveAudioSettings(this.bgm.settings, window.localStorage); } catch { /* Device preferences are optional. */ }
    this.bgm.resumeFromGesture();
    this.emit();
  }
  retryBgm() {
    this.bgm.retry();
    this.emit();
  }
  audioGesture = () => { this.bgm.resumeFromGesture(); };
  message(text: string, item?: Pick<ItemData, 'templateId' | 'rarity'>) {
    this.notice = text;
    this.noticeItem = item ? { templateId: item.templateId, rarity: item.rarity } : null;
    this.noticeId++;
    this.noticeTimer = 4.5;
    this.emit();
  }
  selectCharacter(slotId: string, _job: JobId = 'adventurer', gender: 'male'|'female' = 'male') {
    if (this.started) return;
    this.clearSkillRuntime();
    this.closeNpcMenu();
    this.slotId = slotId;
    this.hero = loadCharacter(slotId);
    // Appearance can only be chosen for an empty slot. Existing saves are never converted.
    if (!listCharacters().some(slot=>slot.id===slotId&&slot.hero)) this.hero.gender=gender==='female'?'female':'male';
    this.hero.appearance = { ...this.hero.appearance, gender: this.hero.gender };
    this.restoreSavedPosition();
    this.dead = false;
    this.paused = false;
    this.stamina = this.hero.stamina;
    this.cooldown = 0;
    this.skillCooldowns = {};
    this.clearInput();
    for (const enemy of this.enemies) {
      this.scene.remove(enemy.group);
      enemy.group.traverse(object=>{if(object instanceof T.Mesh){object.geometry.dispose();const materials=Array.isArray(object.material)?object.material:[object.material];materials.forEach(material=>material.dispose());}});
      this.enemyLabels.get(enemy.id)?.remove();
    }
    this.enemies = [];
    this.targetEntities.clear();
    this.enemyLabels.clear();
    this.bossSpawned = false;
    this.scene.remove(this.actor);
    disposeCharacterModel(this.actor);
    this.actor = new T.Group();
    this.legs = [];
    this.arm = new T.Group();
    this.buildHero();
    this.buildEnemies();
    this.buildRegionDecor();
    this.placeActor();
    this.cameraFocus.copy(this.actor.position);
    this.emit();
  }
  createCharacter(characterName: string, appearance: Partial<CharacterAppearance>) {
    if (this.started) return false;
    this.hero = createNewCharacter(this.slotId, characterName, appearance);
    this.saveCharacterDraft();
    this.selectCharacter(this.slotId, 'adventurer', this.hero.gender);
    return true;
  }
  saveCharacterDraft() {
    try { saveCharacter(this.hero); } catch { this.saved = false; }
  }
  restoreSavedPosition() {
    const valid = (position: { x: number; z: number }) => {
      if (!Number.isFinite(position.x) || !Number.isFinite(position.z)) return false;
      const extent = regionHalfExtent(this.hero.inCity);
      if (Math.abs(position.x) > extent - 1 || Math.abs(position.z) > extent - 1) return false;
      if (!this.hero.inCity && this.fieldTerrain) {
        const nearest = nearestTerrainPoint(this.fieldTerrain, position);
        return Math.hypot(nearest.x - position.x, nearest.z - position.z) < 3;
      }
      return true;
    };
    const current = { x: this.hero.x, z: this.hero.z };
    if (valid(current)) {
      this.hero.lastSafePosition = current;
      return;
    }
    if (valid(this.hero.lastSafePosition)) {
      this.hero.x = this.hero.lastSafePosition.x;
      this.hero.z = this.hero.lastSafePosition.z;
      return;
    }
    const fallback = this.hero.inCity
      ? { x: 0, z: 8 }
      : (FIELDS[this.hero.currentField]?.entry ?? FIELDS['verdant-plains'].entry);
    this.hero.x = fallback.x;
    this.hero.z = fallback.z;
    this.hero.lastSafePosition = { x: fallback.x, z: fallback.z };
  }
  removeCharacter(slotId: string) {
    if (this.started) return false;
    const removed = deleteCharacter(slotId);
    if (removed && this.slotId === slotId)
      this.selectCharacter(slotId, 'adventurer');
    return removed;
  }
  start() {
    if (this.disposed) return;
    this.closeNpcMenu();
    // Entering gameplay from character selection always starts in third-person.
    // Reuse the existing switch; manual camera choices remain available in play.
    if (!this.started) this.setCameraMode('follow');
    this.started = true;
    this.paused = false;
    this.clearInput();
    this.save();
    this.renderer.domElement.focus({ preventScroll: true });
    this.emit();
    this.lastTime = 0;
    if (!this.frame) this.frame = requestAnimationFrame(this.tick);
  }
  returnToCharacterSelection() {
    this.returnToMainMenu();
  }
  returnToMainMenu() {
    if (!this.started) return;
    this.clearSkillRuntime();
    this.save();
    this.closeNpcMenu();
    this.closeForge();
    this.clearInput();
    this.started = false;
    this.paused = false;
    this.dead = false;
    cancelAnimationFrame(this.frame);
    this.frame = 0;
    this.lastTime = 0;
    this.emit();
  }
  pause(value: boolean) {
    this.paused = value;
    this.clearInput();
    if (value) this.save();
    this.emit();
  }
  clearInput() {
    this.keys.clear();
    this.attacking = false;
    this.dragging = false;
    this.blocking = false;
    setManualGuard(this.hero,false);
  }
  setMove(key: string, active: boolean) {
    if (active) this.keys.add(key);
    else this.keys.delete(key);
  }
  save() {
    if (!this.started || this.dead) return;
    this.hero.stamina = this.stamina;
    this.hero.lastPlayedAt = Date.now();
    this.hero.lastSafePosition = { x: this.hero.x, z: this.hero.z };
    try {
      saveCharacter(this.hero);
      this.saved = true;
    } catch {
      this.saved = false;
    }
  }
  respawn() {
    this.closeNpcMenu();
    this.hero.hp = maxHP(this.hero);
    this.hero.x = 0;
    this.hero.z = this.hero.inCity ? 7 : 26;
    if(this.fieldTerrain)Object.assign(this.hero,FIELDS[this.hero.currentField].entry);
    this.placeActor();
    this.cameraFocus.copy(this.actor.position);
    this.dead = false;
    this.characterModel.animator.reset();
    this.paused = false;
    this.stamina = 100;
    this.cooldown = 0;
    this.invincible = 2;
    this.clearInput();
    for (const e of this.enemies) {
      e.group.position.copy(e.home);
      e.windup = 0;
      e.cooldown = 2;
      e.hp = e.max;
      e.group.visible = true;
      e.respawn = 0;
    }
    this.save();
    this.message('Kamu kembali di Kuil Fajar. Progresmu tetap tersimpan.');
  }
  chooseCoreJob(coreJob: CoreJobId) {
    if (!this.atJobTrainer('core')) return false;
    if (hasEquippedGear(this.hero)) {
      this.message('Job tidak dapat diubah. Lepaskan seluruh equipment terlebih dahulu.');
      return false;
    }
    const changed = this.hero.progressionArchitecture === 'v2_test'
      ? chooseV2CoreJob(this.hero, coreJob)
      : chooseCoreJob(this.hero, coreJob);
    if (changed) {
      this.skillCooldowns = {};
      this.rebuildHeroAppearance();
      this.save();
      this.message(`Core Job terbuka: ${combatProfile(this.hero).label}.`);
      this.emit();
      return true;
    }
    this.message(
      this.hero.progressionArchitecture === 'v2_test' && this.hero.level < 15
        ? 'Core Job Warrior terbuka mulai level 15.'
        : this.hero.level < 10
          ? 'Core Job terbuka mulai level 10.'
        : 'Core Job sudah dipilih.',
    );
    return false;
  }
  chooseSpecialization(specialization: SpecializationId) {
    if (!this.atJobTrainer('special')) return false;
    if (chooseSpecialization(this.hero, specialization)) {
      this.skillCooldowns = {};
      this.rebuildHeroAppearance();
      this.save();
      this.message(`Special Job dipilih: ${combatProfile(this.hero).label}.`);
      this.emit();
      return true;
    }
    this.message(
      this.hero.level < (this.hero.skillArchitectureVersion === 3 ? 60 : 25)
        ? `Specialization terbuka mulai level ${this.hero.skillArchitectureVersion === 3 ? 60 : 25}.`
        : this.hero.specialization
          ? `Specialization ${combatProfile(this.hero).label} sudah dipilih dan tidak dapat digabung dengan cabang saudaranya.`
        : 'Pilihan Special Job tidak sesuai Core Job.',
    );
    return false;
  }
  chooseMastery(skillId: string, choice: MasteryChoice) {
    if (!this.hero.masteryQuestClaimed && !this.atJobTrainer('special')) return false;
    if (chooseMastery(this.hero, skillId, choice)) {
      this.save();
      this.message(`Mastery ${choice} diterapkan pada skill.`);
      this.emit();
      return true;
    }
    this.message(
      'Mastery terbuka mulai level 40 dan hanya berlaku pada skill aktif.',
    );
    return false;
  }
  learnSkill(skillId: string) {
    this.hero={...this.hero};
    if (learnSkill(this.hero, skillId)) {
      this.save();
      this.message('Skill level meningkat.');
      this.emit();
      return true;
    }
    this.message(
      'Skill belum terbuka, sudah maksimal, atau Skill Point tidak cukup.',
    );
    return false;
  }
  learnPassive(passiveId?: string) {
    this.hero={...this.hero};
    if (learnPassive(this.hero,passiveId)) {
      this.save();
      this.message('Passive job meningkat.');
      this.emit();
      return true;
    }
    this.message(
      'Passive belum terbuka, sudah maksimal, atau Skill Point tidak cukup.',
    );
    return false;
  }
  equipItem(itemId: string, targetSlot?: EquipSlot) {
    const result = equipInventoryItem(this.hero, itemId, targetSlot);
    this.message(result.reason);
    if (result.ok) {
      this.syncCombatModifiers();
      this.rebuildHeroAppearance();
      this.save();
      this.emit();
    }
    return result.ok;
  }
  sortInventoryLayout() {
    if (!this.started || this.dead) return false;
    const slots = getInventorySlots(this.hero);
    const available = this.hero.inventory.filter(item => !item.isEquipped);
    const sorted = sortInventory(available, 'combined');
    // Sorting is also a compact operation: empty gaps from the previous
    // manual layout must move to the end, never remain between items.
    const nextLayout: Array<string | null> = slots.map((_, index) =>
      sorted[index]?.id ?? null,
    );
    this.hero = { ...this.hero, inventoryLayout: nextLayout };
    this.save();
    this.emit();
    return true;
  }
  unequipItem(slot: EquipSlot) {
    const result = unequipInventoryItem(this.hero, slot);
    this.message(result.reason);
    if (result.ok) {
      this.syncCombatModifiers();
      this.rebuildHeroAppearance();
      this.save();
      this.emit();
    }
    return result.ok;
  }
  private commitRuneAction(action:(hero:Hero)=>{ok:boolean;reason:string}){
    if(!this.started||this.dead){this.message('Rune Forge tidak tersedia saat ini.');return false;}
    const next=structuredClone(this.hero),result=action(next);
    if(!result.ok){this.message(result.reason);return false;}
    try { saveCharacter(next,true); }
    catch {this.message('Save gagal. Transaksi Rune dibatalkan; periksa penyimpanan browser.');return false;}
    this.hero=next;this.saved=true;this.message(result.reason);this.emit();return true;
  }
  socketRune(equipmentId:string,runeId:string,socketIndex:number){
    return this.commitRuneAction(hero=>socketInventoryRune(hero,equipmentId,runeId,socketIndex,this.forgeNpcId));
  }
  removeRune(equipmentId:string,socketIndex:number){
    return this.commitRuneAction(hero=>removeInventoryRune(hero,equipmentId,socketIndex,this.forgeNpcId));
  }
  useItem(itemId: string) {
    this.hero={...this.hero,stamina:this.stamina};
    const result = consumeInventoryItem(this.hero, itemId);
    this.message(result.reason);
    if (result.ok) {
      this.stamina=this.hero.stamina;
      this.sound(600,0.18);
      this.effect(this.actor.position,'#a3f1b3',8);
      this.save();
      this.emit();
    }
    return result.ok;
  }
  commitUIDrop(source: DragSource, target: DropTarget) {
    if (!this.started || this.dead) return false;
    const result = commitDrop(this.hero, source, target, this.hotbarEditMode);
    if (result.ok) {
      this.hero = result.hero;
      if (target.type === 'equipment') this.rebuildHeroAppearance();
      this.save();
      this.emit();
      if (target.type === 'inventory')
        window.dispatchEvent(new CustomEvent('lumenfall:inventory-layout-changed'));
    }
    this.message(result.reason);
    return result.ok;
  }
  savePrimaryHotbar() {
    this.hero=validatePrimaryHotbar(this.hero);
    this.save();this.emit();
  }
  assignPrimaryHotbarSlot(slotIndex:number,entryId:string) {
    if(!this.hotbarEditMode)return false;
    const result=assignHotbarSlot(this.hero,slotIndex,entryId);
    if(result.ok){this.hero=result.hero;this.savePrimaryHotbar();}
    this.message(result.reason);return result.ok;
  }
  swapPrimaryHotbarSlots(source:number,target:number) {
    if(!this.hotbarEditMode)return;
    this.hero=swapHotbarSlots(this.hero,source,target);this.savePrimaryHotbar();
  }
  removePrimaryHotbarSlot(index:number) {
    if(!this.hotbarEditMode)return;
    this.hero=removeHotbarSlot(this.hero,index);this.savePrimaryHotbar();
  }
  savePrimaryHotbarLayout(layout:HotbarLayout) {
    if(!this.hotbarEditMode)return;
    if(layout&&(!Number.isFinite(layout.x)||!Number.isFinite(layout.y)))return;
    this.hero={...this.hero,primaryHotbarLayout:layout?{x:Math.max(0,layout.x),y:Math.max(0,layout.y)}:null};
    this.savePrimaryHotbar();
  }
  setHotbarEditMode(active:boolean) {
    if(!this.started||this.dead)return;
    this.hotbarEditMode=active;
    this.clearInput();this.emit();
  }
  assignQuickHotbarSlot(id:QuickHotbarId,entryId:string) {
    if(!this.hotbarEditMode)return false;
    const result=assignQuickSlot(this.hero,id,entryId);
    if(result.ok){this.hero=result.hero;this.savePrimaryHotbar();}
    this.message(result.reason);return result.ok;
  }
  removeQuickHotbarSlot(id:QuickHotbarId) {
    if(!this.hotbarEditMode)return;
    this.hero=removeQuickSlot(this.hero,id);this.savePrimaryHotbar();
  }
  moveQuickHotbarEntry(source:QuickHotbarId,target:QuickHotbarId) {
    if(!this.hotbarEditMode)return;
    this.hero=moveQuickEntry(this.hero,source,target);this.savePrimaryHotbar();
  }
  saveQuickHotbarLayout(id:QuickHotbarId,position:HotbarLayout) {
    if(!this.hotbarEditMode || (position && (!Number.isFinite(position.x)||!Number.isFinite(position.y))))return;
    this.hero={...this.hero,quickHotbars:{...this.hero.quickHotbars,[id]:{...this.hero.quickHotbars[id],position}}};
    this.savePrimaryHotbar();
  }
  resetHotbarLayouts() {
    if(!this.hotbarEditMode)return;
    this.hero=resetLayouts(this.hero);this.save();this.emit();
  }
  setHotbarInteraction(active:boolean) {
    this.hotbarInteracting=active;
    this.clearInput();
  }
  usePrimaryHotbarSlot(index:number) {
    return this.useHotbarSlot(index);
  }
  useQuickHotbarSlot(id:QuickHotbarId) { return this.useHotbarSlot(id); }
  activateQuickHotbarSlot(id:QuickHotbarId) { return this.useQuickHotbarSlot(id); }
  useHotbarSlot(slot:HotbarSlot) {
    if(!isHotbarSlot(slot)||!this.started||this.paused||this.dead||this.hotbarEditMode||this.hotbarInteracting||document.querySelector('[role="dialog"],[role="alertdialog"]'))return false;
    const id=hotbarAssignment(this.hero,slot);
    if(!id){this.message('Slot hotbar kosong. Klik tombol Edit Mode di hotbar untuk mengisinya.');return false;}
    const entry=resolvePrimaryHotbarEntry(this.hero,id);
    const reason=primaryHotbarAssignmentReason(this.hero,entry);
    if(reason||!entry){this.message(reason??'Assignment tidak tersedia.');return false;}
    let used=false;
    if(entry.skill)used=this.castSkill(entry.skill.id);
    else if(entry.kind==='item'){
      const item=this.hero.inventory.find(item=>item.templateId===id&&item.quantity>0);
      used=!!item&&this.useItem(item.id);
    } else if(id==='basic-attack') {
      if(this.attackTimer>0){this.message('Basic Attack masih cooldown.');return false;}
      this.action('attack');used=this.attackTimer>0;
    } else if(id==='rest') {this.action('heal');used=this.hero.inCity||this.nearSanctuary;}
    if(used){this.lastHotbarSlot=typeof slot==='number'?slot:slot==='q'?10:11;this.hotbarUseSequence++;this.save();this.emit();}
    return used;
  }
  activatePrimaryHotbarSlot(index:number) { return this.usePrimaryHotbarSlot(index); }
  rollRune(request:RuneForgeRequest){
    return this.commitRuneAction(hero=>beginRuneForge(hero,request,this.forgeNpcId));
  }
  resolveRune(receiptId:string,accept:boolean){
    return this.commitRuneAction(hero=>resolveRuneForge(hero,receiptId,accept,this.forgeNpcId));
  }
  craftRuneOptimizer(templateId:string){
    const id=this.forgeNpcId??(this.activeNpcMenu?this.currentNpc?.id:null)??null;
    return this.commitRuneAction(hero=>craftInventoryRuneOptimizer(hero,templateId,id));
  }
  discardItem(itemId: string, quantity = 1) {
    const result = discardInventoryItem(this.hero, itemId, quantity);
    this.message(result.reason);
    if (result.ok) {
      this.save();
      this.emit();
    }
    return result.ok;
  }
  moveInventoryItem(sourceId: string, targetId: string) {
    const slots = getInventorySlots(this.hero);
    const inventorySlot = slots.indexOf(sourceId);
    const targetSlot = targetId ? slots.indexOf(targetId) : slots.indexOf(null);
    return this.commitUIDrop({ dragType: 'item', refId: sourceId, inventorySlot }, { type: 'inventory', slot: targetSlot, expectedId: targetId || null });
  }
  collectLoot() {
    const count = collectPendingLoot(this.hero);
    this.save();
    this.message(
      count
        ? `${count} item tersimpan masuk ke Inventory.`
        : 'Inventory masih penuh. Kosongkan slot terlebih dahulu.',
    );
  }
  enhancementPreview(itemId: string, useSeal = this.hero.enhancementSealEnabled !== false, useFateRune = false) {
    return enhancementPreview(this.hero, itemId, useSeal, useFateRune);
  }
  setEnhancementSealEnabled(enabled: boolean) {
    this.hero.enhancementSealEnabled = enabled;
    this.save();
    this.emit();
  }
  enhanceItem(itemId: string, expectedLevel?: number, useSeal = this.hero.enhancementSealEnabled !== false, useFateRune = false) {
    const reason = !this.started || this.dead
      ? 'Tempa tidak tersedia saat ini.'
      : forgeAccessReason(this.hero, this.forgeNpcId);
    if (reason) {
      this.message(reason);
      return { ok: false, attempted: false, reason, preview: null };
    }
    const equipped = Object.values(this.hero.equipment).includes(itemId);
    const result = enhanceItem(this.hero, itemId, Math.random(), expectedLevel, useSeal, useFateRune);
    this.message(result.reason);
    if (result.attempted) {
      // Apply +10 VFX immediately, including removal on downgrade/destruction.
      if (equipped) this.rebuildHeroAppearance();
      if (isResourceEnabled(this.hero, 'stamina')) this.stamina = Math.min(this.stamina, derivedStats(this.hero).staminaMax);
      this.save();
      this.emit();
    }
    return result;
  }
  evolvePet() {
    const result = evolvePetRules(this.hero);
    this.message(result.reason);
    if (result.ok) {
      this.save();
      this.emit();
    }
    return result.ok;
  }
  applyStatPreview(preview: AllocatedStats) {
    const ok = applyStatPreview(this.hero, preview);
    this.message(
      ok
        ? 'Atribut berhasil diperbarui.'
        : 'Status Point tidak cukup untuk preview ini.',
    );
    if (ok) {
      this.save();
      this.emit();
    }
    return ok;
  }
  respecStats() {
    const result = resetCharacterStats(this.hero);
    this.message(result.reason);
    if (result.ok) {
      this.hero=result.hero;
      this.save();
      this.emit();
    }
    return result.ok;
  }
  allocateStatPoint(stat: keyof AllocatedStats) {
    const result=allocateStatPointRules(this.hero,stat);
    if(result.ok){this.hero=result.hero;this.save();}
    this.message(result.reason);this.emit();return result.ok;
  }
  resetSkillPoints() {
    const result=resetSkillPointsRules(this.hero);
    if(result.ok){this.clearSkillRuntime();this.hero=validatePrimaryHotbar(result.hero);this.save();}
    this.message(result.reason);this.emit();return result.ok;
  }
  unlockUniqueStats(itemId:string) {
    this.hero={...this.hero};const result=unlockUniqueStatsRules(this.hero,itemId);
    if(result.ok)this.save();this.message(result.reason);this.emit();return result.ok;
  }
  atJobTrainer(service:'core'|'special') {
    const npc=this.currentNpc;
    const valid=npc?.service===service&&this.hero.inCity&&this.actor.position.distanceTo(new T.Vector3(npc.x,0,npc.z))<=npc.interactionRange;
    if(!valid)this.message(service==='core'?'Temui Mahaguru Aksara di Kota Arunika.':'Temui Mahaguru Silsilah di Kota Jayantara.');
    return !!valid;
  }
  rebuildHeroAppearance() {
    this.scene.remove(this.actor);
    const rotation=this.actor.rotation.y;
    const animation = this.characterModel.animator.snapshot();
    const { enabled, bodyEnabled, weaponEnabled } = this.aura.userData;
    disposeCharacterModel(this.actor);
    this.actor = new T.Group();
    this.legs = [];
    this.arm = new T.Group();
    this.buildHero();
    this.characterModel.animator.restore(animation);
    Object.assign(this.aura.userData, { enabled, bodyEnabled, weaponEnabled });
    this.actor.rotation.y=rotation;
    this.placeActor();
  }
  canCastSkill(skillId:string) {return canCastSkillRules(this.hero,skillId,this.skillCooldowns,this.equippedWeaponType());}
  getSkillManaCost(skillId:string) {
    const skill=activeSkills(this.hero).find(candidate=>candidate.id===skillId);
    if(skill&&this.hero.skillArchitectureVersion===3&&this.hero.specialization==='blade_master'){
      const drive=this.transientCombat.bladeTempoDrive;
      const reduction=drive&&drive.expiresAt>this.combatTime&&bladeMasterDualWieldActive(this.hero)&&modifierContextFor(this.hero,derivedStats(this.hero)).weaponStyle==='dual_sword'?drive.manaReductionPercent:0;
      return resolveHeroSkill(this.hero,skill,this.hero.skillLevels[skillId]??1,derivedStats(this.hero),undefined,[],undefined,reduction).manaCost;
    }
    return skillManaCostRules(this.hero,skillId);
  }
  consumeMana(amount:number) {return consumeManaRules(this.hero,amount);}
  restoreMana(amount:number) {return restoreManaRules(this.hero,amount);}
  castSkill(idOrSlot: string | 1 | 2 | 3 | 4) {
    if(this.actionLock?.active(this.combatTime))return this.failTarget('ACTION_LOCKED');
    if(isStunned(this.hero,this.combatTime)){this.message('Karakter sedang Stun.');return false;}
    if (!this.started || this.paused || this.dead || this.hotbarInteracting) return false;
    const skill = activeSkills(this.hero).find(candidate => typeof idOrSlot==='string' ? candidate.id===idOrSlot : candidate.slot===idOrSlot);
    if (!skill) return false;
    const isTwinAssault = skill.id === 'v3-blade-master-twin-assault';
    if (skill.id === 'v3-berserker-breaker-entry' && !this.transientCombat.breakerEntryActive(this.combatTime)) {
      this.message('Breaker Entry hanya dapat digunakan setelah Iron Charge berhasil mengenai target.');
      return false;
    }
    const isIronCharge = skill.id === 'v3-warrior-iron-charge';
    const level = this.hero.skillLevels[skill.id] ?? 0;
    if (isTwinAssault) {
      const main = itemById(this.hero.inventory, this.hero.equipment.mainHand);
      const off = itemById(this.hero.inventory, this.hero.equipment.offHand);
      this.traceV3Damage(skill.id, 'cast_request', {
        actorId: this.hero.characterId ?? this.hero.slotId,
        masteryRank: this.hero.skillProgressionV3?.skillRanks['v3-blade-master-twin-blade-mastery'] ?? 0,
        rank: level,
        mainHandInstanceId: main?.id ?? null,
        mainHandType: main?.equipmentType ?? null,
        offHandInstanceId: off?.id ?? null,
        offHandType: off?.equipmentType ?? null,
        resolvedWeaponStyle: this.equippedWeaponType(),
        manaBefore: this.hero.mana,
        cooldownReady: (this.skillCooldowns[skill.id] ?? 0) <= 0,
      });
    }
    // Structural validation first; mana is paid against the final contextual action below.
    const validation=canCastSkillRules(this.hero,skill.id,this.skillCooldowns,this.equippedWeaponType(),0);
    if(!validation.ok){this.message(validation.reason);return false;}
    this.syncCombatModifiers();
    if (skill.id === 'v3-blade-master-tempo-drive' && this.transientCombat.tempoCount(this.combatTime) === 0) return this.failTarget('TEMPO_REQUIRED');
    const tempoReduction=this.transientCombat.bladeTempoDrive?.manaReductionPercent ?? 0;
    const stats=derivedStats(this.hero), preview=resolveHeroSkill(this.hero,skill,level,stats,undefined,[],undefined,tempoReduction);
    this.traceV3Damage(skill.id, 'skill_resolved', {
      weaponAllowed: preview.weaponAllowed,
      resolvedHitCount: preview.hitSequence.length,
      physicalCoefficients: preview.hitSequence.map(hit => hit.physicalCoefficient),
      statScaling: preview.statScaling ?? null,
      manaCost: preview.manaCost,
      cooldown: preview.cooldown,
      targetType: preview.targetType,
      range: preview.range,
    });
    if(!preview.weaponAllowed)return false;
    const requiresSelectedTarget = needsSelectedTarget(preview);
    // A selected target may be outside the current skill range: targeted active
    // skills own the approach step below. Non-target skills keep their existing
    // frontal/area/self behavior and never auto-approach anything.
    const selection=requiresSelectedTarget?this.resolveCurrentTarget(Infinity):{};
    if(selection.reason)return this.failTarget(selection.reason);
    if (isIronCharge) this.traceDevelopment('target_snapshot', {
      targetId: selection.target?.id ?? null,
      targetValid: Boolean(selection.target),
      actorPosition: { x: this.actor.position.x, z: this.actor.position.z },
      targetPosition: selection.target ? { x: selection.target.group.position.x, z: selection.target.group.position.z } : null,
    });
    if (requiresSelectedTarget && selection.target && preview.effect !== 'dash_damage') {
      const reached = this.autoApproachTarget(selection.target, preview.range);
      if (!reached) return this.failTarget('TARGET_OUT_OF_RANGE');
    }
    this.traceV3Damage(skill.id, 'target_validation', {
      targetId: selection.target?.id ?? null,
      targetValid: Boolean(selection.target),
      targetAlive: selection.target ? selection.target.hp > 0 : false,
      distance: selection.target ? targetDistance(this.actor.position, selection.target.group.position) : null,
      range: preview.range,
    });
    if(skill.counterPolicy&&!this.findSkillTarget(preview))return false;
    const counter=skill.counterPolicy?this.defenseEvents.snapshot(skill.counterPolicy.accepted,skill.counterPolicy.windowMs,this.combatTime*1000):NO_COUNTER;
    if (skill.counterPolicy && !counterContextAllowed(counter, skill.counterPolicy.accepted)) {
      this.message('Skill ini membutuhkan CounterContext dari Block atau Parry yang masih aktif.');
      return false;
    }
    const support=combatSupportFor(this.hero);
    const windows=this.transientCombat.windowModifiers(preview,support,this.combatTime);
    const action=resolveHeroSkill(this.hero,skill,level,stats,counter,windows,this.skillImpactContext(selection.target),tempoReduction);
    if(!this.consumeMana(action.manaCost)){this.message('Mana tidak cukup.');return false;}
    this.lastActionFailure=null;
    if(targetRequirement(action)!=='self'&&action.hitSequence.some(hit=>skillHitDamage(hit,stats)>0))breakStealth(this.hero,'offensive_skill');
    this.updateStealthPresentation();
    if(selection.target)action.targetIdentity=targetIdentity(selection.target,this.regionBuildToken);
    const movement=action.directionalMovement?directionalVector(action.directionalMovement.direction,this.direction,this.moveVector()):undefined;
    const facing=selection.target??(action.targetType==='frontal_arc'?this.getCurrentTarget():undefined);
    if(facing)this.faceTarget(facing);
    this.actionLock??=new ActionLock();this.actionLock.start(this.combatTime,action.actionLockDuration??0,action.movementAllowedDuringLock);
    if(counter.result!=='none')this.defenseEvents.consume(counter.result,skill.counterPolicy!.windowMs,this.combatTime*1000);
    const consumedWindows=this.transientCombat.commitWindows(action,support,this.combatTime);
    const mastery = this.hero.masteryChoices[skill.id];
    const cooldown = action.cooldown;
    this.skillCooldowns[skill.id] = cooldown;
    this.applySkill(skill, level, mastery, action, stats,consumedWindows);
    this.traceV3Damage(skill.id, 'cast_accepted', {
      targetId: selection.target?.id ?? null,
      manaAfter: this.hero.mana,
      cooldown: action.cooldown,
      hitCount: action.hitSequence.length,
    });
    if(movement)moveDirectional(action.movementDistance??0,movement,(x,z)=>this.move(x,z));
    this.save();
    this.emit();
    if (isIronCharge) this.traceDevelopment('cast_accepted', { targetId: selection.target?.id ?? null });
    return true;
  }
  equippedWeaponType() {
    return equippedWeaponType(this.hero);
  }
  applySkill(definition: SkillDefinition, level: number, mastery?: MasteryChoice, action?: ResolvedSkillAction, stats=derivedStats(this.hero),consumedWindows:readonly string[]=[]) {
    const skill=action??resolveHeroSkill(this.hero,definition,level,stats);
    this.transientCombat??=new TransientCombatState();
    const castId=this.transientCombat.nextCastId(),support=combatSupportFor(this.hero);
    let successful=false;
    let successfulTargets=0;
    const successfulTargetIds = new Set<string>();
    const isBerserkerTrance = skill.skillId === 'v3-berserker-trance';
    const isBreakerEntry = skill.skillId === 'v3-berserker-breaker-entry';
    const isBerserkerDamage = skill.tags.includes('v3-berserker');
    const bladeImpact = new BladeMasterImpactSession(skill.skillId,this.transientCombat,this.combatTime);
    const maxBeforeBuff = maxHP(this.hero);
    for(const buff of skill.temporaryBuffs??[])addTemporaryModifier(this.hero,buff.modifier,buff.duration);
    if (skill.skillId === 'v3-berserker-iron-blood') this.hero.hp = Math.min(maxHP(this.hero), Math.round(this.hero.hp * maxHP(this.hero) / Math.max(1, maxBeforeBuff)));
    if (isBerserkerTrance) {
      const tranceRank = Math.max(1, Math.min(3, level));
      const duration = [0, 12, 14, 16][tranceRank];
      this.transientCombat.activateBerserkerTrance(this.combatTime, tranceRank, duration);
      this.hero.activeBuffs[skill.skillId] = duration;
    }
    if (skill.skillId === 'v3-blade-master-tempo-drive') this.transientCombat.activateBladeTempoDrive(this.combatTime,Math.max(1,Math.min(5,level)));
    if(skill.progressionMode==='rank_values'&&skill.targetType==='self')for(const status of skill.statuses)applyStatus(this.hero,status.id,status.duration);
    const cast = ['heal', 'buff', 'barrier', 'parry', 'elemental', 'chain', 'illusion'].includes(skill.effect) || ['holy', 'nova', 'meteor', 'thunder', 'barrier'].includes(skill.visualEffect) || ['wizard', 'acolyte'].includes(skill.job);
    const ranged = ['bow', 'bow_trap'].includes(this.equippedWeaponType());
    this.characterModel.animator.play(skill.effect === 'dash_damage' ? 'dash' : cast ? 'magic_cast' : ranged ? 'ranged_attack' : 'basic_attack', Math.max(.35, Math.min(.8, skill.castingTime || .5)));
    const target = this.getCastTarget(skill.targetIdentity);
    let chargeTravelDistance = 0;
    let bladeRushPassDirection: T.Vector3 | undefined;
    let bladeRushPassCompleted = false;
    if(skill.personalMark&&target) {
      this.personalMarks??=new PersonalMarks();
      const identity=skill.targetIdentity!,source=this.markSource();
      this.personalMarks.apply(target,source,skill.skillId,skill.duration,()=>!this.disposed&&!this.dead&&this.hero.hp>0&&this.markSource().sourceActorId===source.sourceActorId&&this.markSource().sourceGeneration===source.sourceGeneration&&this.getCastTarget(identity)===target);
      this.float(target.group.position,'MARKED','reward');
      this.updateTargetPresentation();return;
    }
    const targetCandidate = target ? {
      target,
      id: target.id,
      position: { x: target.group.position.x, z: target.group.position.z },
      alive: target.hp > 0,
    } : null;
    const targets = selectSkillTargets({
      action: skill,
      origin: { x: this.actor.position.x, z: this.actor.position.z },
      forward: { x: this.direction.x, z: this.direction.z },
      candidates: this.enemies.map((enemy) => ({
        target: enemy,
        id: enemy.id,
        position: { x: enemy.group.position.x, z: enemy.group.position.z },
        alive: enemy.hp > 0,
      })),
      selected: targetCandidate,
    });
    this.traceV3Damage(skill.skillId, 'impact_scheduled', {
      targetIds: targets.map(enemy => enemy.id),
      scheduledImpacts: skill.hitSequence.length,
      hands: skill.hitSequence.map(hit => hit.weaponHand ?? null),
      targetIdentity: skill.targetIdentity ?? null,
    });
    if (
      skill.effect === 'heal' ||
      skill.effect === 'buff' ||
      skill.effect === 'barrier' ||
      skill.effect === 'parry'
    ) {
      if (skill.effect === 'heal')
        this.hero.hp = Math.min(
          maxHP(this.hero),
          this.hero.hp + skillHealingPreview(this.hero, definition, level),
        );
      if (skill.effect === 'barrier')
        this.hero.barrier = Math.max(
          this.hero.barrier,
          barrierAmount(maxHP(this.hero)),
        );
      if (skill.effect === 'parry')
        applyStatus(this.hero,'parry',skill.duration);
      if (skill.effect === 'buff' && skill.skillId !== 'v3-blade-master-tempo-drive')
        this.hero.activeBuffs[skill.id] = skill.duration;
      this.effect(
        this.actor.position,
        skill.visualEffect === 'holy' ? '#ffe9a9' : '#a6f3cb',
        18,
      );
      this.ring(
        this.actor.position,
        skill.visualEffect === 'holy' ? '#f6d58b' : '#baf5dc',
        skill.areaRadius || 3.8,
        0.55,
      );
    }
    if (skill.effect === 'dash_damage' && target) {
      const isIronCharge = skill.skillId === 'v3-warrior-iron-charge';
      const chargeStart = this.actor.position.clone();
      if (isIronCharge) this.traceDevelopment('movement_command', {
        targetId: target.id,
        start: { x: chargeStart.x, z: chargeStart.z },
        stopDistance: skill.dash?.stopDistance ?? null,
        impactRange: skill.dash?.impactRange ?? null,
      });
      const dir = target.group.position
        .clone()
        .sub(this.actor.position)
        .setY(0)
        .normalize();
      if (skill.skillId === 'v3-blade-master-blade-rush') bladeRushPassDirection = dir.clone();
      if(skill.dash){
        // Small steps reuse terrain/tree collision; never teleport through blockers.
        let remaining=Math.max(0,this.groundDistance(target.group.position,this.actor.position)-skill.dash.stopDistance);
        remaining=Math.min(remaining,skill.range);
        while(remaining>0){const step=Math.min(.25,remaining);this.move(dir.x*step,dir.z*step);remaining-=step;}
      }else this.move(dir.x*Math.min(4,skill.range),dir.z*Math.min(4,skill.range));
      chargeTravelDistance = this.groundDistance(this.actor.position, chargeStart);
      this.direction.copy(dir);
      if (isIronCharge) this.traceDevelopment('movement_complete', {
        targetId: target.id,
        end: { x: this.actor.position.x, z: this.actor.position.z },
        travelDistance: chargeTravelDistance,
        remainingTargetDistance: this.groundDistance(target.group.position, this.actor.position),
      });
    }
    if (skill.effect === 'stealth') {
      enterStealth(this.hero,skill.duration,skill.stealthPolicy);
      this.updateStealthPresentation();
    }
    if (skill.effect === 'ultimate') {
      this.hero.statusEffects.superArmor = skill.duration;
      // Reuse the existing temporary-buff timer so the HUD can present the
      // named ultimate without creating a second timer or gameplay state.
      this.hero.activeBuffs[skill.id] = skill.duration;
      this.hero.activeBuffs.damageReduction = skill.duration;
      this.ring(
        this.actor.position,
        skill.visualEffect === 'holy' ? '#ffe9a9' : '#c6ffe4',
        skill.areaRadius || 6,
        0.75,
      );
      this.effect(
        this.actor.position,
        skill.visualEffect === 'thunder' ? '#bbd9ff' : '#c6ffe4',
        34,
      );
    }
    const buildToken=this.regionBuildToken;
    const attackerLevel=this.hero.level;
    for (const enemy of targets) {
      let alive=true;
      const spawn=enemy.respawnDeadline;
      const castTargetIdentity=skill.targetIdentity??targetIdentity(enemy,buildToken);
      const isIronCharge = skill.skillId === 'v3-warrior-iron-charge';
      const dashImpactRange = skill.dash ? Math.max(skill.dash.impactRange, skill.dash.stopDistance) : 0;
      let impactInvalidReported = false;
      const validImpact = () => {
        const checks = {
          alive,
          started: this.started,
          targetAlive: enemy.hp > 0,
          targetStillRegistered: this.enemies.includes(enemy),
          targetIdentityValid: this.getCastTarget(castTargetIdentity) === enemy,
          impactRangeValid: !skill.dash || this.hasClearDashImpact(enemy.group.position, dashImpactRange),
        };
        const valid = Object.values(checks).every(Boolean);
        if (isIronCharge && !valid && !impactInvalidReported) {
          impactInvalidReported = true;
          this.traceDevelopment('impact_rejected', { targetId: enemy.id, checks, configuredImpactRange: skill.dash?.impactRange ?? null, effectiveImpactRange: dashImpactRange, actorPosition: { x: this.actor.position.x, z: this.actor.position.z }, targetPosition: { x: enemy.group.position.x, z: enemy.group.position.z } });
        }
        return valid;
      };
      this.skillHits.schedule(skill.hitSequence,
        ()=>alive&&!this.disposed&&!this.dead&&buildToken===this.regionBuildToken&&enemy.respawnDeadline===spawn&&validImpact(),
        snapshotHit=>{
      this.traceV3Damage(skill.skillId, 'impact_callback', {
        targetId: enemy.id,
        impactIndex: skill.hitSequence.indexOf(snapshotHit),
        hand: snapshotHit.weaponHand ?? null,
        targetHpBefore: enemy.hp,
      });
      if (isIronCharge) this.traceDevelopment('impact_callback', { targetId: enemy.id, travelDistance: chargeTravelDistance, targetDistance: this.groundDistance(enemy.group.position, this.actor.position) });
      if (skill.skillId === 'v3-blade-master-blade-rush' && bladeRushPassDirection && !bladeRushPassCompleted) {
        bladeRushPassCompleted = true;
        const endpoint = passThroughEndpoint(
          { x: enemy.group.position.x, z: enemy.group.position.z },
          { x: bladeRushPassDirection.x, z: bladeRushPassDirection.z },
        );
        moveCollisionSafeTo(
          endpoint,
          () => ({ x: this.actor.position.x, z: this.actor.position.z }),
          (x, z) => this.move(x, z),
        );
      }
      const impactContext=this.skillImpactContext(enemy);
      const hit=bladeImpact.prepare(resolveTargetHit(snapshotHit,skill.targetModifiers,enemy,this.combatTime,impactContext),skill.hitSequence.indexOf(snapshotHit),skill.hitSequence.length-1,enemy,this.hero.characterId??this.hero.slotId,this.combatTime);
      const hitResolution = resolveHitAgainstEvasion({ attackerAccuracy: hit.accuracy, targetEvasion: enemy.evasion ?? 0, rng: () => this.rand() });
      if (hitResolution.result === 'EVADED') {
        this.traceV3Damage(skill.skillId, 'hit_result', {
          targetId: enemy.id,
          impactIndex: skill.hitSequence.indexOf(snapshotHit),
          result: 'EVADED',
          accuracy: hit.accuracy,
          targetEvasion: enemy.evasion ?? 0,
          hitChance: hitResolution.hitChance,
          roll: hitResolution.roll,
        });
        this.float(enemy.group.position, 'EVADE', 'reward');
        if (isIronCharge) this.traceDevelopment('hit_evaded', { targetId: enemy.id, ...hitResolution });
        return;
      }
      if (isIronCharge) this.traceDevelopment('damage_resolver', { targetId: enemy.id, amountBeforeMitigation: skillHitDamage(hit,stats), hpBefore: enemy.hp });
      if(skill.tree?.id==='thief'&&skill.tree.architecture==='v2') {
        const rear=skill.tags.includes('rear_synergy')&&!!impactContext.position&&relativePosition(impactContext.position,{rearAngle:90})==='rear';
        if(rear)this.float(enemy.group.position,'REAR','reward');
        if(skill.tags.includes('stealth_opener')&&snapshotHit.criticalRate>stats.criticalRate)this.effect(enemy.group.position,'#cbb0ff',18);
        if(skill.tags.includes('finisher')&&hit.damageMultiplier>snapshotHit.damageMultiplier)this.effect(enemy.group.position,'#f5d887',22);
        if(skill.tags.includes('multi_hit'))this.effect(enemy.group.position,snapshotHit.delay===skill.hitSequence.at(-1)!.delay?'#f1d89f':'#bfafff',snapshotHit.delay===skill.hitSequence.at(-1)!.delay?16:8);
      }
      if (skill.skillId === 'v2-warrior-relentless-assault') {
        // Each queued impact gets its own lightweight cue; damage timing and
        // hit geometry remain owned by SkillHitQueue and are not changed here.
        const cue = snapshotHit.delay >= 0.4 ? '#ffe0a0' : '#c6e8ff';
        this.effect(enemy.group.position, cue, snapshotHit.delay >= 0.4 ? 18 : 10);
      }
      let amount = skillHitDamage(hit,stats);
      this.traceV3Damage(skill.skillId, 'damage_resolver', {
        targetId: enemy.id,
        impactIndex: skill.hitSequence.indexOf(snapshotHit),
        hand: snapshotHit.weaponHand ?? null,
        accuracy: hit.accuracy,
        result: 'HIT',
        rawDamage: amount,
        physicalCoefficient: hit.physicalCoefficient,
        composedPhysicalPower: hit.composedPhysicalPower ?? null,
        baseDamage: hit.baseDamage,
      });
      if(hit.canCrit&&this.rand()<criticalChance(hit.criticalRate))amount*=hit.criticalDamage/100;
      if (
        skill.effect === 'execute' &&
        (enemy.hp < enemy.max * 0.4 || hasStatus(enemy,'mark'))
      )
        amount *= 1.8;
      if (
        hasStatus(enemy,'mark') &&
        (this.hero.specialization === 'anom' ||
          this.hero.specialization === 'pujangga')
      )
        amount *= 1.25;
      if (hasStatus(enemy,'weakPoint') && this.hero.specialization === 'srikandi')
        amount *= 1.3;
      if (skill.skillId === 'v3-berserker-ruinous-arc' && hasActiveStatusFromSource(enemy, 'armor_break', this.hero.characterId ?? this.hero.slotId, this.combatTime))
        amount *= 1.08;
      const beforeHP=enemy.hp;
      const appliedDamage = this.hurtEnemy(
        enemy,
        Math.round(amount),
        hit.knockbackStrength,
        hit.damageType, stats, attackerLevel,
      );
      this.traceV3Damage(skill.skillId, 'hp_mutation', {
        targetId: enemy.id,
        impactIndex: skill.hitSequence.indexOf(snapshotHit),
        hpBefore: beforeHP,
        appliedDamage,
        hpAfter: enemy.hp,
      });
      if (isIronCharge) this.traceDevelopment('target_hp_changed', { targetId: enemy.id, hpBefore: beforeHP, hpAfter: enemy.hp, damage: Math.max(0, beforeHP - enemy.hp) });
      if(amount>0&&enemy.hp<beforeHP){
        const firstSuccessfulImpact = !successful;
        successful=true;
        if (!successfulTargetIds.has(enemy.id)) {
          successfulTargetIds.add(enemy.id);
          successfulTargets++;
        }
        if (firstSuccessfulImpact) {
        if (isIronCharge && this.hero.specialization === 'berserker') this.transientCombat.openBreakerEntry(this.combatTime, 4);
        if (skill.skillId === 'v3-blade-master-blade-rush' || skill.skillId === 'v3-blade-master-counterflow') {
          const focusRank = Math.max(0, Math.min(5, this.hero.skillProgressionV3?.skillRanks['v3-blade-master-blade-focus'] ?? 0));
          const focusActive = Number(this.hero.activeBuffs['v3-blade-master-blade-focus'] ?? 0) > 0;
          this.transientCombat.openBladeFlow(this.combatTime, focusActive && focusRank > 0 ? BLADE_FOCUS_FLOW_DURATION[focusRank - 1] : 3);
        }
        bladeImpact.commitDamagingImpact(this.combatTime,this.hero.skillProgressionV3?.skillRanks['v3-blade-master-twin-blade-mastery'] ?? 0,
          true,
          bladeMasterDualWieldActive(this.hero)&&modifierContextFor(this.hero,stats).weaponStyle==='dual_sword');
        if (isBreakerEntry) this.transientCombat.consumeBreakerEntry(this.combatTime);
        const currentStyle=modifierContextFor(this.hero,stats).weaponStyle;
        // Equipment must still support an equipped-style stack at impact.
        const eligibleSupport={...support,stacks:support.stacks?.filter(s=>!s.weaponStyle||s.weaponStyle===skill.resolvedWeaponStyle&&s.weaponStyle===currentStyle),windows:support.windows?.filter(w=>w.weaponStyle===skill.resolvedWeaponStyle&&w.weaponStyle===currentStyle)};
        this.transientCombat.successfulCast(castId,this.combatTime,currentStyle,eligibleSupport,skill,consumedWindows);
        this.syncCombatModifiers();
        }
      }
      if(enemy.hp<=0){alive=false;return;}
      for(const status of hit.statuses){
        const rear=!!impactContext.position&&relativePosition(impactContext.position,{rearAngle:90})==='rear';
        const duration=status.duration+(rear?(status.rearDurationBonus??0):0);
        if (status.id === 'armor_break' && skill.skillId === 'v3-warrior-armor-breaker') {
          applySourceOwnedStatus(enemy, 'armor_break', { sourceActorId: this.hero.characterId ?? this.hero.slotId, sourceSkillId: skill.skillId, strength: skill.armorBreakStrengthByRank?.[Math.max(0, skill.rank - 1)] ?? status.potency ?? 20, appliedAt: this.combatTime, duration });
          continue;
        }
        if(status.id==='slow'&&status.potency!==undefined){
          enemy.slowPotency=enemy.slow>0?Math.max(enemy.slowPotency??.58,status.potency):status.potency;
        }
        applyStatus(enemy,status.id,duration);
        if(status.id==='poison')enemy.poisonTick=COMBAT_MECHANICS.poisonInterval;
      }
      if (skill.effect === 'mark') enemy.marked = true;
      if (skill.statusEffect === 'weakPoint') enemy.weakPoint = true;
      if (skill.statusEffect === 'stun' || skill.effect === 'stun')
        enemy.stun = Math.max(
          enemy.stun,
          mastery === 'control' ? skill.duration * MASTERY_EFFECTS.control.duration : skill.duration,
        );
      const stunProfile = skill.stunProfile;
      if (isIronCharge) this.traceDevelopment('stun_eligibility', {
        targetId: enemy.id,
        travelDistance: chargeTravelDistance,
        minimumTravelDistance: stunProfile?.minimumTravelDistance ?? null,
        eligible: Boolean(stunProfile && chargeStunEligible(chargeTravelDistance, stunProfile.minimumTravelDistance)),
        immune: Boolean(enemy.stunImmune),
      });
      if (
        stunProfile &&
        (skill.skillId === 'v3-warrior-iron-charge' || skill.skillId === 'v3-berserker-earth-splitter' || skill.skillId === 'v3-blade-master-counterflow') &&
        chargeStunEligible(chargeTravelDistance, stunProfile.minimumTravelDistance) &&
        this.rand() < stunChanceForRank(stunProfile.chance, skill.rank)
      ) {
        const applied = applyStun(enemy, {
          sourceActorId: this.hero.characterId,
          sourceSkillId: skill.skillId,
          chance: stunChanceForRank(stunProfile.chance, skill.rank),
          pveDuration: stunProfile.pveDuration,
          pvpDuration: stunProfile.pvpDuration,
          targetPolicy: stunProfile.targetPolicy,
          now: this.combatTime,
        });
        if (applied) {
          enemy.stun = remainingStun(enemy, this.combatTime);
          this.float(enemy.group.position, 'STUN', 'reward');
          if (isIronCharge) this.traceDevelopment('stun_applied', { targetId: enemy.id, expiresAt: enemy.stunState?.expiresAt ?? null });
        }
      }
      if (skill.statusEffect === 'slow' || skill.effect === 'slow') {
        enemy.slow = Math.max(enemy.slow, skill.duration);
        enemy.slowPotency = Math.max(enemy.slowPotency ?? 0, .58);
      }
      if (skill.statusEffect === 'root' || skill.effect === 'root')
        enemy.root = Math.max(enemy.root, skill.duration);
      if (skill.statusEffect === 'poison' || skill.effect === 'poison') {
        enemy.poison = Math.max(enemy.poison, skill.duration + 3);
        enemy.poisonTick = COMBAT_MECHANICS.poisonInterval;
      }
      if (skill.statusEffect === 'defenseDown' || skill.effect === 'debuff')
        enemy.defenseDown = Math.max(enemy.defenseDown, skill.duration);
      if (skill.effect === 'parry') enemy.stun = Math.max(enemy.stun, 0.6);
      });
    }
    if (skill.skillId === 'v3-berserker-fury-harvest' && successfulTargets > 0) {
      const recoveryRank = Math.max(1, Math.min(5, level));
      const heal = Math.round(maxHP(this.hero) * FURY_HARVEST_RECOVERY_PERCENT[recoveryRank - 1] / 100 * Math.min(5, successfulTargets));
      this.hero.hp = Math.min(maxHP(this.hero), this.hero.hp + heal);
    }
    const berserkerTrance = this.transientCombat.berserkerTrance;
    if (isBerserkerDamage && successfulTargets >= 3 && berserkerTrance && berserkerTrance.expiresAt > this.combatTime) {
      const rank = berserkerTrance.rank;
      this.transientCombat.triggerFrenzyGuard(this.combatTime, [0, 4, 5, 6][Math.min(3, rank)], 2);
    }
    if (skill.tree?.architecture === 'v2' && skill.tree.id === 'warrior') {
      const point = target?.group.position ?? this.actor.position;
      switch (skill.skillId) {
        case 'v2-warrior-sweeping-slash':
          this.ring(this.actor.position, '#b9e7ff', Math.max(3, skill.range), 0.42);
          break;
        case 'v2-warrior-severing-arc':
          this.ring(this.actor.position, '#ffd58a', Math.max(2.2, skill.range * .7), 0.34);
          this.effect(point, '#fff0bf', 20);
          break;
        case 'v2-warrior-rising-slash':
          this.effect(point, '#e8c4ff', 22);
          break;
        case 'v2-warrior-ground-breaker':
          this.ring(point, '#d8b57d', Math.max(3.5, skill.areaRadius || 3.5), 0.68);
          this.effect(point, '#ead39a', 24);
          break;
        case 'v2-warrior-counter-slash':
          if (skill.counterContext.result !== 'none') this.effect(point, skill.counterContext.result === 'parried' ? '#bdeaff' : '#ffe39d', 24);
          break;
        case 'v2-warrior-iron-reversal':
          if (skill.counterContext.result === 'parried') {
            this.ring(point, '#c8eaff', 3.5, 0.5);
            this.effect(point, '#e0f6ff', 30);
          }
          break;
        case 'v2-warrior-crushing-finale':
          this.ring(point, '#ffd08a', 3.8, 0.8);
          this.effect(point, '#fff0bd', 32);
          break;
      }
    }
    if (skill.visualEffect === 'thunder') {
      const point = target?.group.position ?? this.actor.position;
      this.beam(point, '#b8d9ff');
      this.sound(880, 0.18);
    } else if (skill.visualEffect === 'meteor') {
      const point = target?.group.position ?? this.actor.position;
      this.ring(point, '#ffbf8a', skill.areaRadius || 5, 0.55);
      this.effect(point, '#ffcf9e', 28);
      this.sound(120, 0.22);
    } else {
      const color =
        skill.visualEffect === 'poison'
          ? '#95d46e'
          : skill.visualEffect === 'holy'
            ? '#ffe29b'
            : '#c6ffe4';
      if (target) this.effect(target.group.position, color, 16);
      this.ring(
        target?.group.position ?? this.actor.position,
        color,
        skill.areaRadius || 3,
        0.45,
      );
    }
    this.message(`${skill.name} digunakan.`);
  }
  /** Probe the final Charge gap without moving the actor. Being inside impact
   * range must not permit a hit through a trunk/rock that blocked the approach.
   * Reuses ground/trunk collision; this is not pathfinding or global melee LOS. */
  hasClearDashImpact(target: GroundPoint, range: number) {
    const start = { x: this.actor.position.x, z: this.actor.position.z };
    const distance = targetDistance(start, target);
    if (distance > range + 1e-6) return false;
    const steps = Math.max(1, Math.ceil(distance / .25));
    const dx = (target.x - start.x) / steps, dz = (target.z - start.z) / steps;
    let probe = start;
    for (let i = 0; i < steps; i++) {
      const next = moveWithTreeCollisions(probe, dx, dz, this.treeColliders,
        (from, mx, mz) => this.moveHeroOnGround(from, mx, mz),
        (x, z) => this.groundHeight(x, z));
      if (Math.hypot(next.x - probe.x - dx, next.z - probe.z - dz) > 1e-5) return false;
      probe = next;
    }
    return true;
  }
  findSkillTarget(skill: SkillDefinition) {
    return needsSelectedTarget(skill)?this.resolveCurrentTarget(skill.range).target:undefined;
  }
  action(kind: 'attack' | 'nova' | 'potion' | 'heal') {
    if (!this.started || this.paused || this.dead || this.hotbarInteracting) return;
    if (kind === 'attack') this.attack(true);
    if (kind === 'nova') this.nova();
    if (kind === 'potion') {
      const potion = this.hero.inventory.find(
        (item) => item.itemType === 'potion' && item.quantity > 0,
      );
      if(potion)this.useItem(potion.id);
      else this.message('Potion habis. Isi persediaan di menu tas.');
    }
    if (kind === 'heal') {
      if (this.hero.inCity) {
        healAtCity(this.hero);
        if (isResourceEnabled(this.hero, 'stamina')) this.stamina = derivedStats(this.hero).staminaMax;
        this.save();
        this.message(isResourceEnabled(this.hero, 'stamina') ? 'Tabib kota memulihkan HP, Mana, stamina, dan statusmu.' : 'Tabib kota memulihkan HP, Mana, dan statusmu.');
        return;
      }
      if (this.nearSanctuary) {
        this.hero.hp = maxHP(this.hero);
        if (isResourceEnabled(this.hero, 'stamina')) this.stamina = 100;
        this.effect(this.actor.position, '#b6f3ce', 20);
        this.save();
        this.message('Cahaya kuil memulihkanmu.');
      } else this.message('Dekati kristal di Kuil Fajar untuk beristirahat.');
    }
    this.emit();
  }
  purchase(kind: 'potion' | 'upgrade') {
    if (!this.started || this.dead) return false;
    if (kind === 'upgrade')
      return this.enhanceItem(this.hero.equipment.mainHand ?? '').ok;
    return this.npcBuy('health-potion-1');
  }
  targetNearest() {
    if(usesHardTargeting(this.hero))return;
    let target: Enemy | undefined;
    let best = 6;
    for (const e of this.enemies) {
      const d =
        e.hp > 0 ? this.groundDistance(e.group.position,this.actor.position) : Infinity;
      if (d < best) {
        target = e;
        best = d;
      }
    }
    if (target)
      this.direction
        .subVectors(target.group.position, this.actor.position)
        .setY(0)
        .normalize();
  }
  attack(autoAim = false) {
    if(isStunned(this.hero,this.combatTime)){this.message('Karakter sedang Stun.');return;}
    if(this.actionLock?.active(this.combatTime))return this.failTarget('ACTION_LOCKED');
    if (this.attackTimer > 0) return;
    const equippedWeapon=itemById(this.hero.inventory,this.hero.equipment.mainHand);
    const offhandWeapon=itemById(this.hero.inventory,this.hero.equipment.offHand);
    const dualBasicActive = bladeMasterDualWieldActive(this.hero) && Boolean(
      equippedWeapon?.equipmentType === 'one_hand_sword' && offhandWeapon?.equipmentType === 'one_hand_sword' && equippedWeapon.id !== offhandWeapon.id,
    );
    const equipmentSignature = `${this.hero.equipment.mainHand ?? ''}:${this.hero.equipment.offHand ?? ''}`;
    if (equipmentSignature !== this.dualBasicEquipmentSignature) {
      this.dualBasicEquipmentSignature = equipmentSignature;
      this.dualBasicNextHand = 'MAIN';
    }
    const basicHand = dualBasicActive ? this.dualBasicNextHand : 'MAIN';
    const isBow=equippedWeapon?.equipmentType==='bow'||equippedWeapon?.attackType==='ranged';
    const hard=usesHardTargeting(this.hero);
    const selection=hard?this.resolveCurrentTarget(Infinity):{};
    if(selection.target&&targetDistance(this.actor.position,selection.target.group.position)>(isBow?Math.max(11,combatProfile(this.hero).range):selection.target.boss?4.3:combatProfile(this.hero).range))selection.reason='TARGET_OUT_OF_RANGE';
    if(selection.reason)return this.failTarget(selection.reason);
    this.lastActionFailure=null;
    if(isBow){
      const arrows=this.hero.inventory.find(item=>item.templateId===(this.hero.selectedAmmo??'arrows')&&item.quantity>0);
      if(!arrows){this.message('Anak Panah habis. Bow tidak dapat menyerang.');return;}
      arrows.quantity--;
      if(arrows.quantity<=0)this.hero.inventory=this.hero.inventory.filter(item=>item.id!==arrows.id);
    }
    if(hard&&selection.target)this.faceTarget(selection.target);
    else if (autoAim || !this.pointerActive) this.targetNearest();
    else {
      this.raycaster.setFromCamera(this.pointer, this.camera);
      const hit=this.isSandsLocation&&this.sandsGround
        ?this.raycaster.intersectObjects(this.sandsGround.surfaces,false)[0]?.point
        :this.terrainSurface?this.raycaster.intersectObject(this.terrainSurface)[0]?.point:this.raycaster.ray.intersectPlane(this.ground,this.aim);
      if (hit) {
        this.aim.copy(hit);
        const d = this.aim.clone().sub(this.actor.position).setY(0);
        if (d.length() > 0.1) this.direction.copy(d.normalize());
      }
    }
    breakStealth(this.hero,'basic_attack');this.updateStealthPresentation();
    this.actor.rotation.y = Math.atan2(-this.direction.x, -this.direction.z);
    this.combo = this.comboWindow > 0 ? (this.combo % 3) + 1 : 1;
    this.comboWindow = 1.1;
    const profile = combatProfile(this.hero);
    this.attackTimer =
      this.combo === 3 ? profile.cooldown + COMBAT_MECHANICS.comboFinisherDelay : profile.cooldown;
    this.attackTimer /= derivedStats(this.hero).attackSpeed / 100;
    this.swing = 0.3;
    this.characterModel.animator.play(isBow ? 'ranged_attack' : 'basic_attack', .3);
    const stats = derivedStats(this.hero);
    const attackPowerForHand = dualBasicActive
      ? (() => { const context = resolveWeaponAttackContext(equippedWeapon, offhandWeapon, basicHand === 'MAIN' ? 'SINGLE_MAIN' : 'SINGLE_OFF'); const shared = stats.physicalAttack - context.mainHandWeaponAttack - context.offHandWeaponAttack; return Math.max(0, shared + (basicHand === 'MAIN' ? context.mainHandWeaponAttack : context.offHandWeaponAttack)); })()
      : basicAttackPower(this.hero);
    const baseDamage =
      attackPowerForHand *
      (this.combo === 3 ? COMBAT_MECHANICS.comboFinisherDamage : 1);
    const resolveBasicDamage = (enemy: Enemy) => {
      const hitResolution = resolveHitAgainstEvasion({ attackerAccuracy: stats.accuracy, targetEvasion: enemy.evasion ?? 0, rng: () => this.rand() });
      if (hitResolution.result === 'EVADED') {
        this.float(enemy.group.position, 'EVADE', 'reward');
        return null;
      }
      const critical = this.rand() < criticalChance(stats.criticalRate);
      return baseDamage * (critical ? stats.criticalDamage / 100 : 1);
    };
    this.sound(150 + this.combo * 90, 0.065);
    const strike = this.actor.position.clone().addScaledVector(this.direction,isBow?3.6:1.2);
    this.ring(strike,isBow?'#8ee7ff':'#f2e2a4',isBow?1.2:2.2,0.24);
    if(isBow)this.effect(strike,'#b6f1ff',9);
    for (const e of (hard&&selection.target?[selection.target]:this.enemies)) {
      if (e.hp <= 0) continue;
      if(hard){const damage=resolveBasicDamage(e);if(damage===null)continue;this.hurtEnemy(e,Math.round(damage),this.hero.skillArchitectureVersion===3?0:.8,'physical');continue;}
      const v = e.group.position.clone().sub(this.actor.position);
      if(this.fieldTerrain||this.isSandsLocation)v.y=0;
      const d = v.length();
      if (
        d < (isBow?Math.max(11,profile.range):(e.boss ? 4.3 : profile.range)) &&
        v.normalize().dot(this.direction) > -0.2
      ) {
        const damage=resolveBasicDamage(e);if(damage===null)continue;
        this.hurtEnemy(e, Math.round(damage), this.hero.skillArchitectureVersion===3?0:0.8, 'physical');
      }
    }
    if (dualBasicActive) this.dualBasicNextHand = basicHand === 'MAIN' ? 'OFF' : 'MAIN';
  }
  nova() {
    if(this.actionLock?.active(this.combatTime))return this.failTarget('ACTION_LOCKED');
    if (!this.started || this.paused || this.dead || this.hotbarInteracting || this.cooldown > 0) return;
    if(!this.consumeMana(35)){this.message('Mana tidak cukup.');return;}
    this.cooldown = 8;
    this.characterModel.animator.play('magic_cast', .65);
    this.ring(this.actor.position, '#baf5dc', 6.5, 0.6);
    this.effect(this.actor.position, '#c6ffe4', 30);
    this.sound(760, 0.22);
    for (const e of this.enemies)
      if (e.hp > 0 && this.groundDistance(e.group.position,this.actor.position) < 7)
        this.hurtEnemy(e, derivedStats(this.hero).magicAttack * 2, 2, 'magic');
    this.save();
    this.emit();
  }
  hurtEnemy(e: Enemy, damage: number, knock: number, damageType: 'physical' | 'magic' = 'physical', snapshot?:DerivedStats, attackerLevel=this.hero.level) {
    if (e.hp <= 0) return 0;
    const playerStats=snapshot??derivedStats(this.hero);
    if(e.boss)damage*=1+playerStats.bossDamage/100;
    else if(e.definition?.variant==='elite')damage*=1+playerStats.eliteDamage/100;
    const defense = damageType === 'magic' ? (e.definition?.magicDefense ?? 0) : (e.definition?.defense ?? 0);
    const penetration = damageType === 'magic' ? playerStats.magicPenetration : playerStats.physicalPenetration;
    const armorBreakStrength = effectiveArmorBreakStrength(e, this.combatTime);
    const finalDamage = mitigateDamage(damage, defense * (armorBreakStrength > 0 ? Math.max(0, 1 - armorBreakStrength / 100) : 1), attackerLevel, penetration);
    e.hp = Math.max(0, e.hp - finalDamage);
    if(finalDamage>0){breakStealth(this.hero,'damage_dealt');this.updateStealthPresentation();}
    if(this.currentTarget?.instanceId===e.group.uuid)this.updateTargetPresentation();
    if (this.cameraMode === 'follow' && finalDamage > 0 && knock > 0) {
      this.impactShakeRemaining = FOLLOW_CAMERA.shakeDuration;
    }
    e.flash = 0.14;
    const v = e.group.position.clone().sub(this.actor.position);
    if(this.fieldTerrain||this.isSandsLocation)v.y=0;
    v.normalize();
    const knockDistance=e.boss?knock*.15:knock;
    this.moveEnemy(e,v.x*knockDistance,v.z*knockDistance);
    if(!this.fieldTerrain&&!this.isSandsLocation&&!this.isCityOfLight) {
      const extent=regionHalfExtent(false);
      e.group.position.x=T.MathUtils.clamp(e.group.position.x,-extent,extent);
      e.group.position.z=T.MathUtils.clamp(e.group.position.z,-extent,extent);
    }
    this.float(e.group.position, String(Math.round(finalDamage)), 'damage');
    this.effect(e.group.position, e.boss ? '#ddb7e8' : '#c0da78', 8);
    if (e.hp === 0) {
      e.group.visible = false;
      e.respawn = e.definition?.respawnTime ?? (e.boss ? 120 : 25);
      e.respawnDeadline = Date.now() + e.respawn * 1000;
      this.hero.monsterRespawnState[e.respawnKey] = e.respawnDeadline;
      if (e.boss && e.definition) this.hero.defeatedBossTimestamp[this.hero.currentField] = Date.now();
      const rewardStats=derivedStats(this.hero);
      const xp = Math.floor((e.definition ? monsterXP(e.definition, this.hero.level) : e.boss ? 160 : 35)*(1+rewardStats.expGain/100));
      const monsterLevel = e.definition?.level ?? this.hero.level;
      const goldMultiplier = e.definition?.variant === 'boss' || e.boss ? 1.8 : e.definition?.variant === 'elite' ? 1.5 : 1;
      const goldReward=Math.floor((8 + monsterLevel * 1.5) * goldMultiplier * (1 + rewardStats.goldDropRate / 100));
      this.hero.kills += 1;
      this.hero.fieldProgress[this.hero.currentField] = (this.hero.fieldProgress[this.hero.currentField] ?? 0) + 1;
      const goldPosition = e.group.position.clone().add(new T.Vector3(0.85, 0, 0));
      this.spawnGoldDrop(goldReward, goldPosition);
      const levels = gainXP(this.hero, xp);
      const loots = e.definition ? rollMonsterLootDrops(this.hero, e.definition, () => this.rand()) : [];
      const lootPositions = [
        new T.Vector3(-0.85, 0, 0),
        new T.Vector3(-0.6, 0, 0.72),
        new T.Vector3(-0.6, 0, -0.72),
      ];
      loots.forEach((loot, index) => this.spawnGroundLoot(loot, e.group.position.clone().add(lootPositions[index] ?? new T.Vector3(-0.45 - index * 0.2, 0, 0))));
      this.float(
        e.group.position,
        `+${xp} EXP  +${goldReward} G${loots.length ? ` · ${loots.length} item${loots.length > 1 ? 's' : ''}` : ''}`,
        'reward',
      );
      if (loots.length) {
        this.message(`${loots.map(loot => loot.name).join(', ')} jatuh. Tekan Space untuk mengambil.`, loots[0]);
        this.float(e.group.position, 'DROP · SPACE', 'reward');
      }
      if (levels) {
        this.ring(this.actor.position, '#ffe4a1', 4, 0.8);
        this.message(`Level ${this.hero.level}! Kekuatan dan HP bertambah.`);
      }
      if (!this.hero.questClaimed && this.hero.kills >= 6)
        this.message('Objective misi selesai. Temui Quest NPC untuk mengklaim reward.');
      if (e.boss) {
        if (!this.hero.defeatedFieldBosses.includes(this.hero.currentField))
          this.hero.defeatedFieldBosses.push(this.hero.currentField);
        if (this.hero.currentField === 'whispering-wilds' && !this.hero.completedQuests.includes('story-whispering-wilds')) {
          this.hero.cityProgress.arunika = Math.max(this.hero.cityProgress.arunika ?? 0, 1);
          this.message('Objective Rimba Bisik selesai. Kembali ke Quest NPC untuk turn-in dan membuka Kota Jayantara.');
        } else {
          this.message(`${FIELDS[this.hero.currentField].displayName} kembali tenang. Boss telah tumbang!`);
        }
        this.sound(1000, 0.4);
      }
      this.save();
      this.emit();
    }
  }
  hurtHero(damage: number, sourceId?:string, displacement?:{x:number;z:number}) {
    setManualGuard(this.hero,this.blocking);
    if (this.invincible > 0 || this.dead) return;
    if(hasStatus(this.hero,'parry')){
      this.defenseEvents.record(this.hero,false,this.combatTime*1000,sourceId);
      this.float(this.actor.position,'PARRY','reward');
      return;
    }
    const stats = derivedStats(this.hero);
    if (this.rand() < evasionChance(stats.evasion)) {
      this.float(this.actor.position, 'EVADE', 'reward');
      return;
    }
    damage = mitigateDamage(damage, stats.physicalDefense, this.hero.level, 0);
    this.transientCombat?.updateBerserker(this.combatTime);
    if (this.transientCombat?.frenzyGuard && this.transientCombat.frenzyGuard.expiresAt > this.combatTime)
      damage *= Math.max(0, 1 - this.transientCombat.frenzyGuard.reductionPercent / 100);
    const blocked=this.rand() < blockChance(stats.blockRate);
    this.defenseEvents.record(this.hero,blocked||this.blocking,this.combatTime*1000,sourceId);
    const context=modifierContextFor(this.hero,stats),modifiers=combatModifiersFor(this.hero);
    const defenseMultiplier=(1-stats.damageReduction/100)*(blocked?1-COMBAT_MECHANICS.blockDamageReduction:1)*(this.blocking?.3:1);
    damage *= receivedMultiplier(modifiers,context,'damageMultiplier',defenseMultiplier);
    const absorbed = Math.min(this.hero.barrier, damage);
    this.hero.barrier -= absorbed;
    damage -= absorbed;
    this.hero.hp = Math.max(0, this.hero.hp - damage);
    if(damage>0){breakStealth(this.hero,'received_damage');this.updateStealthPresentation();}
    if(this.hero.hp>0&&displacement){const factor=receivedMultiplier(modifiers,context,'knockbackMultiplier');this.move(displacement.x*factor,displacement.z*factor);}
    if (damage > 0) this.characterModel.animator.play('hit', .24);
    this.invincible = 0.45;
    this.float(this.actor.position, `−${damage}`, 'hurt');
    this.sound(95, 0.13);
    if (this.hero.hp === 0) {
      this.dead = true;
      this.clearSkillRuntime();
      this.clearInput();
      this.message('Cahayamu meredup. Kuil Fajar menantimu.');
    }
    this.emit();
  }
  moveVector() {
    if(this.actionLock?.active(this.combatTime)&&!this.actionLock.movementAllowed)return new T.Vector3();
    const right =
        (this.keys.has('d') || this.keys.has('arrowright') ? 1 : 0) -
        (this.keys.has('a') || this.keys.has('arrowleft') ? 1 : 0),
      forward =
        (this.keys.has('s') || this.keys.has('arrowdown') ? 1 : 0) -
        (this.keys.has('w') || this.keys.has('arrowup') ? 1 : 0);
    return new T.Vector3(
      Math.cos(this.yaw) * right + Math.sin(this.yaw) * forward,
      0,
      -Math.sin(this.yaw) * right + Math.cos(this.yaw) * forward,
    ).normalize();
  }
  move(dx: number, dz: number) {
    if(isStunned(this.hero,this.combatTime))return;
    const p=moveWithTreeCollisions(this.hero,dx,dz,this.treeColliders,(from,mx,mz)=>this.moveHeroOnGround(from,mx,mz),(x,z)=>this.groundHeight(x,z));
    this.hero.x=p.x;this.hero.z=p.z;
    const targetY = this.groundHeight(p.x,p.z);
    this.actor.position.set(p.x, this.actor.position.y, p.z);
    this.actor.position.y = T.MathUtils.lerp(this.actor.position.y, targetY, 0.32);
  }
  /** Move the player into range for a selected-target active skill only. */
  autoApproachTarget(target: Enemy, range: number) {
    const desiredRange = Math.max(0, Number.isFinite(range) ? range : 0);
    const direction = target.group.position.clone().sub(this.actor.position).setY(0);
    let remaining = Math.max(0, direction.length() - desiredRange);
    if (remaining <= 1e-6) return true;
    direction.normalize();
    while (remaining > 1e-6) {
      const before = this.actor.position.clone();
      this.move(direction.x * Math.min(0.25, remaining), direction.z * Math.min(0.25, remaining));
      const progressed = this.groundDistance(before, this.actor.position);
      if (progressed <= 1e-7) break;
      remaining -= progressed;
    }
    return this.groundDistance(this.actor.position, target.group.position) <= desiredRange + 1e-4;
  }
  moveHeroOnGround(from:GroundPoint,dx:number,dz:number):GroundPoint {
    if(this.fieldTerrain) {
      return moveOnTerrain(this.fieldTerrain,from,dx,dz);
    }
    if(this.isSandsLocation) {
      return this.sandsGround?this.sandsGround.move(from,dx,dz):{...from};
    }
    const extent = regionHalfExtent(this.hero.inCity);
    const terrainScale = regionScale(this.hero.inCity);
    let x = T.MathUtils.clamp(from.x + dx, -extent, extent),
      z = T.MathUtils.clamp(from.z + dz, -extent, extent);
    const px = (x / terrainScale - 24) / 11.8,
      pz = (z / terrainScale + 3) / 7.5;
    if (px * px + pz * pz < 1) {
      if (((x / terrainScale - 24) / 11.8) ** 2 + ((from.z / terrainScale + 3) / 7.5) ** 2 >= 1)
        z = from.z;
      else if (((from.x / terrainScale - 24) / 11.8) ** 2 + ((z / terrainScale + 3) / 7.5) ** 2 >= 1)
        x = from.x;
      else {
        x = from.x;
        z = from.z;
      }
    }
    return {x,z};
  }
  tick = (time: number) => {
    if (this.disposed || !this.started) { this.frame = 0; return; }
    const dt = Math.min((time - (this.lastTime || time)) / 1000, 0.04);
    this.lastTime = time;
    this.elapsed += dt;
    if(this.arunikaMaterials)this.arunikaMaterials.time.value=this.elapsed;
    this.crystal.rotation.y += dt * 0.6;
    this.crystal.position.y = 2.6 + Math.sin(this.elapsed * 1.5) * 0.2;
    let moving = false;
    let running = false;
    let animationMoveSpeed=0;
    if (this.started && !this.paused && !this.dead) {
      this.stepSkillRuntime(dt);
      this.cooldown = Math.max(0, this.cooldown - dt);
      for (const id of Object.keys(this.skillCooldowns))
        this.skillCooldowns[id] = Math.max(0, this.skillCooldowns[id] - dt);
      for (const key of Object.keys(this.hero.statusEffects)) {
        this.hero.statusEffects[key] = Math.max(
          0,
          this.hero.statusEffects[key] - dt,
        );
        if (this.hero.statusEffects[key] <= 0)
          delete this.hero.statusEffects[key];
      }
      for (const key of Object.keys(this.hero.activeBuffs)) {
        this.hero.activeBuffs[key] = Math.max(
          0,
          this.hero.activeBuffs[key] - dt,
        );
        if (this.hero.activeBuffs[key] <= 0) delete this.hero.activeBuffs[key];
      }
      this.attackTimer = Math.max(0, this.attackTimer - dt);
      const manaStats=derivedStats(this.hero);
      this.hero.mana=Math.min(this.hero.mana,manaStats.maxMana);
      this.hero.maxMana=manaStats.maxMana;
      if(manaStats.manaRecovery>0)this.restoreMana(dt*manaStats.manaRecovery);
      this.invincible = Math.max(0, this.invincible - dt);
      this.comboWindow = Math.max(0, this.comboWindow - dt);
      this.swing = Math.max(0, this.swing - dt);
      const m = this.moveVector();
      if (m.lengthSq() && !isStunned(this.hero,this.combatTime)) {
        // Movement is always a moderate run. Shift no longer changes the speed.
        const sprinting = true;
        const speedMultiplier = 1.22;
        const speed =
          (6.2 * derivedStats(this.hero).movementSpeed * speedMultiplier) / 100;
        const previousX = this.actor.position.x, previousZ = this.actor.position.z;
        this.move(m.x * dt * speed, m.z * dt * speed);
        moving = Math.hypot(this.actor.position.x - previousX, this.actor.position.z - previousZ) > .0001;
        animationMoveSpeed=dt>0?Math.hypot(this.actor.position.x-previousX,this.actor.position.z-previousZ)/dt:0;
        running = moving && sprinting;
        if (this.swing === 0) {
          this.direction.copy(m);
          this.actor.rotation.y = Math.atan2(-m.x, -m.z);
        }
      }
      if (isResourceEnabled(this.hero, 'stamina')) {
        const staminaMax = derivedStats(this.hero).staminaMax;
        this.stamina = Math.min(staminaMax, this.stamina + dt * 18);
      }
      this.hero.playTimeSeconds += dt;
      if (this.attacking) this.attack();
      this.actor.visible =
        this.invincible <= 0 || Math.floor(this.elapsed * 18) % 2 === 0;
      for (const e of this.enemies) this.updateEnemy(e, dt);
      this.saveTimer += dt;
      if (this.saveTimer > 30) {
        this.saveTimer = 0;
        this.save();
      }
    }
    if (!this.paused) {
      this.characterModel.animator.update(dt, { moving, sprinting: running, blocking: this.blocking, dead: this.dead, speed:animationMoveSpeed });
      updateCharacterAura(this.aura, this.elapsed, dt);
    }
    if (this.noticeTimer > 0) {
      this.noticeTimer -= dt;
      if (this.noticeTimer <= 0) this.notice = '';
    }
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.life -= dt;
      p.velocity.y -= dt * 6;
      p.mesh.position.addScaledVector(p.velocity, dt);
      p.mesh.scale.setScalar(Math.max(0, p.life / p.total));
      if (p.life <= 0) {
        this.scene.remove(p.mesh);
        p.mesh.geometry.dispose();
        (p.mesh.material as T.Material).dispose();
        this.particles.splice(i, 1);
      }
    }
    for (let i = this.rings.length - 1; i >= 0; i--) {
      const r = this.rings[i];
      r.life -= dt;
      const f = 1 - r.life / r.total;
      r.mesh.scale.setScalar(0.15 + f * r.grow);
      (r.mesh.material as T.MeshBasicMaterial).opacity = Math.max(0, 1 - f);
      if (r.life <= 0) {
        this.scene.remove(r.mesh);
        r.mesh.geometry.dispose();
        (r.mesh.material as T.Material).dispose();
        this.rings.splice(i, 1);
      }
    }
    for (let i = this.beams.length - 1; i >= 0; i--) {
      const beam = this.beams[i];
      beam.life -= dt;
      (beam.line.material as T.LineBasicMaterial).opacity = Math.max(
        0,
        beam.life / beam.total,
      );
      if (beam.life <= 0) {
        this.scene.remove(beam.line);
        beam.line.geometry.dispose();
        (beam.line.material as T.Material).dispose();
        this.beams.splice(i, 1);
      }
    }
    this.cameraFocus.lerp(this.actor.position, 1 - Math.exp(-dt * 6));
    const targetGroundY = this.groundHeight(this.actor.position.x, this.actor.position.z);
    this.actor.position.y = T.MathUtils.lerp(this.actor.position.y, targetGroundY, 0.18);
    this.updateCamera(dt);
    this.camera.updateMatrixWorld();
    updateCharacterBillboards(this.aura, this.camera);
    this.updateFloating(dt);
    this.renderer.render(this.scene, this.camera);
    this.emitTimer += dt;
    const moved = Math.hypot(this.hero.x - this.lastEmitX, this.hero.z - this.lastEmitZ) > 0.25;
    if (this.emitTimer > 0.5 && (moved || this.emitTimer > 2)) {
      this.emitTimer = 0;
      this.lastEmitX = this.hero.x;
      this.lastEmitZ = this.hero.z;
      this.drawMap();
      this.emit();
    }
    this.frame = requestAnimationFrame(this.tick);
  };
  updateCamera(dt: number) {
    if (this.cameraMode === 'follow') {
      this.followView = stepFollowCamera(this.followView, dt);
      const view = this.followView;
      const near = T.MathUtils.smoothstep(view.distance, FOLLOW_CAMERA.minDistance, 5);
      const targetY = this.cameraFocus.y + T.MathUtils.lerp(1.82, 1.35, near);
      const horizontal = Math.cos(view.pitch) * view.distance;
      this.camera.position.set(
        this.cameraFocus.x + Math.sin(view.yaw) * horizontal,
        targetY + Math.sin(view.pitch) * view.distance,
        this.cameraFocus.z + Math.cos(view.yaw) * horizontal,
      );
      if(this.fieldTerrain&&insideBoundary(this.fieldTerrain,this.camera.position))this.camera.position.y=Math.max(this.camera.position.y,this.groundHeight(this.camera.position.x,this.camera.position.z)+1.2);
      if(this.isSandsLocation&&this.sandsGround){const height=this.sandsGround.heightAt(this.camera.position.x,this.camera.position.z);if(height!==undefined)this.camera.position.y=Math.max(this.camera.position.y,height+1.2);}
      this.camera.lookAt(this.cameraFocus.x, targetY, this.cameraFocus.z);
      this.impactShakeRemaining = Math.max(0, this.impactShakeRemaining - dt);
      const shake = followImpactShake(this.impactShakeRemaining);
      this.camera.rotateX(shake.x);
      this.camera.rotateY(shake.y);
      this.updateCameraProjection();
      return;
    }
    const view = stepCameraZoom(this.cameraZoom, this.yaw, dt, true);
    this.cameraZoom = view.state;
    // Reduce follow lag in the portrait so movement cannot leave the face off-center.
    const x = T.MathUtils.lerp(this.cameraFocus.x, this.actor.position.x, view.framing),
      z = T.MathUtils.lerp(this.cameraFocus.z, this.actor.position.z, view.framing);
    const targetY = this.actor.position.y + view.targetHeight;
    const finalPitch = T.MathUtils.clamp(this.pitch + view.pitchOffset, 0.08, 1.38);
    const horizontalDistance = Math.cos(finalPitch) * view.distance;
    const verticalDistance = Math.sin(finalPitch) * view.distance;
    this.camera.position.set(
      x + Math.sin(view.state.yaw) * horizontalDistance,
      targetY + verticalDistance,
      z + Math.cos(view.state.yaw) * horizontalDistance,
    );
    if(this.fieldTerrain&&insideBoundary(this.fieldTerrain,this.camera.position))this.camera.position.y=Math.max(this.camera.position.y,this.groundHeight(this.camera.position.x,this.camera.position.z)+1.2);
    if(this.isSandsLocation&&this.sandsGround){const height=this.sandsGround.heightAt(this.camera.position.x,this.camera.position.z);if(height!==undefined)this.camera.position.y=Math.max(this.camera.position.y,height+1.2);}
    this.camera.lookAt(x, targetY, z);
    this.updateCameraProjection();
  }
  updateEnemy(e: Enemy, dt: number) {
    if (e.hp <= 0) {
      if(this.currentTarget?.instanceId===e.group.uuid)this.clearCurrentTarget();
      e.respawn = Math.max(0,(e.respawnDeadline-Date.now())/1000);
      if (e.respawn <= 0) {
          delete this.hero.monsterRespawnState[e.respawnKey];
          // Retire only this migrated legacy species deadline.
          if (e.definition && !FIELDS[this.hero.currentField].contentFamilyId && this.hero.monsterRespawnState[e.definition.id] <= Date.now()) delete this.hero.monsterRespawnState[e.definition.id];
          e.respawnDeadline=0;
          e.spawnGeneration=(e.spawnGeneration??0)+1;
          e.hp = e.max;
          e.group.position.copy(e.home);
          e.navigation=undefined;
          e.group.visible = true;
          e.windup = 0;
          e.cooldown = 2;
          e.stun = e.slow = e.root = e.poison = e.defenseDown = 0;
          e.marked = e.weakPoint = false;
          e.statusEffects = {};
          e.sourceOwnedStatuses = {};
      }
      return;
    }
    const v = this.actor.position.clone().sub(e.group.position).setY(0),
      dist = v.length(),
      safe = this.hero.inCity || isFieldSafe(this.hero.currentField,this.hero.x,this.hero.z);
    e.cooldown -= dt;
    e.flash = Math.max(0, e.flash - dt);
    const body = e.group.children[0] as T.Mesh;
    const material = body.material as T.MeshStandardMaterial;
    material.emissiveIntensity = e.flash > 0 ? 1.7 : 0.12;
    clearExpiredStun(e, this.combatTime);
    clearExpiredSourceStatuses(e, this.combatTime);
    if (e.sourceOwnedStatuses?.armor_break) {
      const armor = getActiveStatusApplications(e, 'armor_break', this.combatTime);
      e.defenseDown = armor.length ? Math.max(...armor.map(entry => Math.max(0, entry.expiresAt - this.combatTime))) : 0;
      if (!armor.length) delete e.statusEffects?.defenseDown;
    }
    e.stun = Math.max(0, remainingStun(e, this.combatTime), e.stun - dt);
    for(const key of Object.keys(e.statusEffects??{})){
      e.statusEffects![key]=Math.max(0,e.statusEffects![key]-dt);
      if(e.statusEffects![key]===0)delete e.statusEffects![key];
    }
    e.slow = Math.max(0, e.slow - dt);
    if(e.slow<=0)delete e.slowPotency;
    e.root = Math.max(0, e.root - dt);
    e.defenseDown = Math.max(0, e.defenseDown - dt);
    if (e.poison > 0) {
      e.poison = Math.max(0, e.poison - dt);
      e.poisonTick -= dt;
      if (e.poisonTick <= 0) {
        e.poisonTick = COMBAT_MECHANICS.poisonInterval;
        this.hurtEnemy(e, Math.max(COMBAT_MECHANICS.poisonMinimumDamage, attackPower(this.hero) * COMBAT_MECHANICS.poisonAttackCoefficient), 0);
      }
    }
    if (e.hp <= 0) return;
    if (e.stun > 0 || e.root > 0) {
      (e.ring.material as T.MeshBasicMaterial).opacity = 0.28;
      return;
    }
    if (e.windup > 0) {
      e.windup -= dt;
      (e.ring.material as T.MeshBasicMaterial).opacity =
        0.2 + Math.sin(this.elapsed * 15) * 0.1;
      if (e.windup <= 0) {
        (e.ring.material as T.MeshBasicMaterial).opacity = 0;
        if (!safe && dist < e.attackRange)
          this.hurtHero(e.attack,String(e.id));
        this.ring(
          e.group.position,
          e.boss ? '#b88ac8' : '#c3ce8c',
          e.boss ? 5.6 : 1.5,
          0.35,
        );
        e.cooldown = e.boss ? 2.2 : 1.65;
      }
      return;
    }
    (e.ring.material as T.MeshBasicMaterial).opacity = 0;
    if (
      !safe &&
      dist < (e.boss ? 15 : e.definition?.variant === 'elite' ? 12 : 10) &&
      this.groundDistance(e.group.position,e.home) < 20
    ) {
      if (dist > (e.boss ? 3.7 : 1.4)) {
        v.normalize();
        if(this.fieldTerrain)this.followTerrain(e,this.actor.position,e.movementSpeed*(e.slow>0?1-(e.slowPotency??.58):1),dt);
        else {const step=dt*e.movementSpeed*(e.slow>0?1-(e.slowPotency??.58):1);this.moveEnemy(e,v.x*step,v.z*step);}
        e.group.rotation.y = Math.atan2(-v.x, -v.z);
      } else if (e.cooldown <= 0) e.windup = e.boss ? 1.1 : e.definition?.attackSpeed ?? 0.65;
    } else if (this.groundDistance(e.group.position,e.home) > 1) {
      if(this.fieldTerrain)this.followTerrain(e,e.home,1.6,dt);
      else {const homeDirection=e.home.clone().sub(e.group.position).setY(0).normalize();this.moveEnemy(e,homeDirection.x*dt*1.6,homeDirection.z*dt*1.6);}
    }
    body.position.y =
      Math.abs(Math.sin(this.elapsed * (e.boss ? 2 : 4) + e.id)) *
        (e.boss ? 0.12 : 0.22);
  }
  beam(target: T.Vector3, color: string) {
    const surfaceHeight=this.groundHeight(target.x,target.z);
    const points = [new T.Vector3(target.x, surfaceHeight+13, target.z)];
    for (let i = 1; i < 6; i++) {
      const t = i / 6;
      points.push(
        new T.Vector3(
          target.x + (this.rand() - 0.5) * 1.3,
          surfaceHeight + 13 * (1 - t) + 1.2,
          target.z + (this.rand() - 0.5) * 1.3,
        ),
      );
    }
    points.push(target.clone().setY(surfaceHeight+0.65));
    const line = new T.Line(
      new T.BufferGeometry().setFromPoints(points),
      new T.LineBasicMaterial({
        color,
        transparent: true,
        opacity: 1,
        linewidth: 2,
      }),
    );
    this.scene.add(line);
    this.beams.push({ line, life: 0.3, total: 0.3 });
  }
  effect(position: T.Vector3, color: string, count: number) {
    for (let i = 0; i < count; i++) {
      const m = this.mesh(
        new T.IcosahedronGeometry(0.1 + this.rand() * 0.08, 0),
        new T.MeshBasicMaterial({ color }),
        this.scene,
        position.x,
        this.groundHeight(position.x,position.z)+1,
        position.z,
      );
      const life = 0.35 + this.rand() * 0.4;
      this.particles.push({
        mesh: m,
        velocity: new T.Vector3(
          (this.rand() - 0.5) * 5,
          2 + this.rand() * 3,
          (this.rand() - 0.5) * 5,
        ),
        life,
        total: life,
      });
    }
  }
  ring(position: T.Vector3, color: string, grow: number, total: number) {
    const m = this.mesh(
      new T.RingGeometry(0.92, 1, 40),
      new T.MeshBasicMaterial({
        color,
        transparent: true,
        opacity: 0.8,
        side: T.DoubleSide,
        depthWrite: false,
      }),
      this.scene,
      position.x,
      this.groundHeight(position.x,position.z)+0.12,
      position.z,
    );
    m.rotation.x = -Math.PI / 2;
    m.castShadow = false;
    this.rings.push({ mesh: m, life: total, total, grow });
  }
  float(position: T.Vector3, text: string, kind: string) {
    const element = document.createElement('span');
    element.className = `floating ${kind}`;
    element.textContent = text;
    this.labelHost.appendChild(element);
    this.floating.push({
      element,
      position: position.clone().add(new T.Vector3(0, 2, 0)),
      life: 1.4,
    });
  }
  updateFloating(dt: number) {
    const playerLabel = this.playerStatusLabel;
    // Keep the character resource bars attached to the player in every region,
    // including cities. They are UI-only and do not depend on monster combat.
    const playerVisible = this.started && !this.dead;
    if (playerLabel) {
      playerLabel.style.display = playerVisible ? 'block' : 'none';
      if (playerVisible) {
        const p = this.actor.position
          .clone()
          .add(new T.Vector3(0, 0.12, 0))
          .project(this.camera);
        const validProjection = Number.isFinite(p.x) && Number.isFinite(p.y) && p.z > -1;
        playerLabel.style.display = validProjection ? 'block' : 'none';
        if (validProjection) {
          playerLabel.style.left = `${(p.x * 0.5 + 0.5) * 100}%`;
          playerLabel.style.top = `${(-p.y * 0.5 + 0.5) * 100}%`;
          const stats = derivedStats(this.hero);
          const staminaMax = Math.max(1, Number(stats.staminaMax) || 100);
          const normalized = (value: number, maximum: number) => {
            const current = Number.isFinite(value) ? value : maximum;
            return Math.max(0, Math.min(1, current / Math.max(1, maximum)));
          };
          const values: Record<string, number> = {
            hp: normalized(this.hero.hp, maxHP(this.hero)),
            mana: normalized(this.hero.mana, stats.maxMana),
            ...(isResourceEnabled(this.hero, 'stamina') ? { stamina: normalized(this.stamina, staminaMax) } : {}),
          };
          for (const [resource, value] of Object.entries(values)) {
            if (Math.abs(this.playerBarValues[resource as keyof typeof this.playerBarValues] - value) < 0.001) continue;
            const fill = playerLabel.querySelector(`.${resource} i`) as HTMLElement | null;
            if (fill) fill.style.width = `${value * 100}%`;
            this.playerBarValues[resource as keyof typeof this.playerBarValues] = value;
          }
        }
      }
    }
    for(const portal of this.portalLabels) {
      const visible=this.started&&Math.hypot(this.hero.x-portal.x,this.hero.z-portal.z)<16;
      portal.element.style.display=visible?'block':'none';
      if(visible){const p=new T.Vector3(portal.x,this.groundHeight(portal.x,portal.z)+(portal.labelHeight??5),portal.z).project(this.camera);portal.element.style.left=`${(p.x*.5+.5)*100}%`;portal.element.style.top=`${(-p.y*.5+.5)*100}%`;}
    }
    for(const {npc,element,nameElement} of this.npcLabels) {
      const position=new T.Vector3(npc.x,this.groundHeight(npc.x,npc.z)+2.8,npc.z);
      const visible=this.started&&position.distanceTo(this.actor.position)<18;
      const trackedStatus=npc.services.includes('quest')?this.hero.activeQuests.map(id=>regionQuestStatus(this.hero,id)).find(status=>status==='ready_to_complete'||status==='active'):undefined;
      const name=`${trackedStatus==='ready_to_complete'?'?':trackedStatus==='active'?'!':'◆'} ${npc.name}`;
      if(nameElement.textContent!==name) nameElement.textContent=name;
      element.style.display=visible?'block':'none';
      if(visible){const p=position.project(this.camera);element.style.display=p.z>=-1&&p.z<=1?'block':'none';element.style.left=`${(p.x*.5+.5)*100}%`;element.style.top=`${(-p.y*.5+.5)*100}%`;}
    }
    for (const loot of this.groundLoot) {
      const visible = this.started && loot.group.position.distanceTo(this.actor.position) < 18;
      loot.label.style.display = visible ? 'block' : 'none';
      if (visible) {
        const p = loot.group.position.clone().add(new T.Vector3(0, 1.05, 0)).project(this.camera);
        loot.label.style.left = `${(p.x * 0.5 + 0.5) * 100}%`;
        loot.label.style.top = `${(-p.y * 0.5 + 0.5) * 100}%`;
      }
    }
    for (const gold of this.groundGold) {
      const visible = this.started && gold.group.position.distanceTo(this.actor.position) < 18;
      gold.label.style.display = visible ? 'block' : 'none';
      if (visible) {
        const p = gold.group.position.clone().add(new T.Vector3(0, 1.05, 0)).project(this.camera);
        gold.label.style.left = `${(p.x * 0.5 + 0.5) * 100}%`;
        gold.label.style.top = `${(-p.y * 0.5 + 0.5) * 100}%`;
      }
    }
    for (const e of this.enemies) {
      const label = this.enemyLabels.get(e.id);
      if (!label) continue;
      const visible =
        this.started &&
        e.hp > 0 &&
        e.group.position.distanceTo(this.actor.position) < 15;
      label.style.display = visible ? 'block' : 'none';
      if (visible) {
        const p = e.group.position
          .clone()
          .add(new T.Vector3(0, e.group.children[0].userData.labelHeight ?? 1.8, 0))
          .project(this.camera);
        label.style.left = `${(p.x * 0.5 + 0.5) * 100}%`;
        label.style.top = `${(-p.y * 0.5 + 0.5) * 100}%`;
        const fill = label.querySelector('i');
        if (fill) fill.style.width = `${(e.hp / e.max) * 100}%`;
      }
    }
    for (let i = this.floating.length - 1; i >= 0; i--) {
      const f = this.floating[i];
      f.life -= dt;
      f.position.y += dt;
      const p = f.position.clone().project(this.camera);
      f.element.style.left = `${(p.x * 0.5 + 0.5) * 100}%`;
      f.element.style.top = `${(-p.y * 0.5 + 0.5) * 100}%`;
      f.element.style.opacity = String(Math.min(1, f.life * 2));
      if (f.life <= 0) {
        f.element.remove();
        this.floating.splice(i, 1);
      }
    }
  }
  drawMap() {
    const ctx = this.minimap.getContext('2d');
    if (!ctx) return;
    const size = this.minimap.width;
    ctx.clearRect(0, 0, size, size);
    ctx.fillStyle = '#173d34';
    ctx.fillRect(0, 0, size, size);

    const cityFootprint = null;

    const mapScale = this.fieldTerrain?.id === 'verdant-plains' ? 2 : regionScale(this.hero.inCity);
    const p = (v: number) => size / 2 + (v * size) / (106 * mapScale);
    const toCityPoint = (x: number, z: number) => {
      if (!cityFootprint) return { x: size / 2, y: size / 2 };
      const width = cityFootprint.maxX - cityFootprint.minX;
      const height = cityFootprint.maxZ - cityFootprint.minZ;
      const fit = Math.max(width, height) || 1;
      const scale = (size * 0.76) / fit;
      const centerX = (cityFootprint.minX + cityFootprint.maxX) / 2;
      const centerZ = (cityFootprint.minZ + cityFootprint.maxZ) / 2;
      return { x: size / 2 + (x - centerX) * scale, y: size / 2 + (z - centerZ) * scale };
    };

    if(this.fieldTerrain) {
      const t=this.fieldTerrain;
      ctx.fillStyle='#38685b';ctx.beginPath();t.boundary.forEach((q,i)=>i?ctx.lineTo(p(q.x),p(q.z)):ctx.moveTo(p(q.x),p(q.z)));ctx.closePath();ctx.fill();
      ctx.save();ctx.clip();
      ctx.strokeStyle='#71b3b1';ctx.lineWidth=size*terrainRiver(t).halfWidth*2/(106*mapScale);ctx.beginPath();
      const riverExtent = t.id === 'verdant-plains' ? 148 : 74;
      for(let x=-riverExtent;x<=riverExtent;x+=2){if(x===-riverExtent)ctx.moveTo(p(x),p(terrainRiverZ(t,x)));else ctx.lineTo(p(x),p(terrainRiverZ(t,x)));}ctx.stroke();
      ctx.fillStyle='#71b3b1';for(const pond of terrainPonds(t)){ctx.beginPath();ctx.ellipse(p(pond.x),p(pond.z),size*pond.rx/(106*mapScale),size*pond.rz/(106*mapScale),0,0,Math.PI*2);ctx.fill();}
      ctx.strokeStyle='#b6b488';ctx.lineWidth=1.8;
      for(const path of t.paths){ctx.beginPath();path.forEach((q,i)=>i?ctx.lineTo(p(q.x),p(q.z)):ctx.moveTo(p(q.x),p(q.z)));ctx.stroke();}
      ctx.fillStyle='#ead18d';ctx.fillRect(p(t.camp.x)-2,p(t.camp.z)-2,4,4);
      ctx.fillStyle='#c3cc9a';for(const landmark of t.props.filter(prop=>prop.kind==='temple'||prop.kind==='ruins'))ctx.fillRect(p(landmark.x)-3,p(landmark.z)-3,6,6);
      for(const q of [t.cityGate,t.exit]){ctx.strokeStyle='#edd599';ctx.beginPath();ctx.arc(p(q.x),p(q.z),3,0,Math.PI*2);ctx.stroke();}
      ctx.restore();
    } else if (cityFootprint) {
      const cityPath = cityFootprint.hull.map(point => {
        const project = toCityPoint(point.x, point.z);
        return { x: project.x, y: project.y };
      });
      ctx.beginPath();
      cityPath.forEach((point, index) => {
        if (index === 0) ctx.moveTo(point.x, point.y);
        else ctx.lineTo(point.x, point.y);
      });
      ctx.closePath();
      ctx.fillStyle = '#345d5d';
      ctx.fill();
      ctx.save();
      ctx.clip();
      ctx.strokeStyle = 'rgba(145, 196, 166, 0.28)';
      ctx.lineWidth = 1;
      const roadStep = Math.max(12, (cityFootprint.maxX - cityFootprint.minX) / 10);
      for (let x = cityFootprint.minX; x <= cityFootprint.maxX; x += roadStep) {
        const start = toCityPoint(x, cityFootprint.minZ);
        const end = toCityPoint(x, cityFootprint.maxZ);
        ctx.beginPath();
        ctx.moveTo(start.x, start.y);
        ctx.lineTo(end.x, end.y);
        ctx.stroke();
      }
      for (let z = cityFootprint.minZ; z <= cityFootprint.maxZ; z += roadStep) {
        const start = toCityPoint(cityFootprint.minX, z);
        const end = toCityPoint(cityFootprint.maxX, z);
        ctx.beginPath();
        ctx.moveTo(start.x, start.y);
        ctx.lineTo(end.x, end.y);
        ctx.stroke();
      }
      ctx.restore();
      ctx.strokeStyle = '#e7d78e';
      ctx.lineWidth = 2;
      ctx.stroke();
    } else {
      ctx.strokeStyle = '#658675';
      ctx.lineWidth = 5;
      ctx.beginPath();
      ctx.moveTo(p(0), p(-48*mapScale));
      ctx.lineTo(p(0), p(48*mapScale));
      ctx.stroke();
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(p(-45*mapScale), p(14*mapScale));
      ctx.lineTo(p(45*mapScale), p(-4*mapScale));
      ctx.stroke();
      ctx.fillStyle = '#3d7774';
      ctx.beginPath();
      ctx.ellipse(p(24*mapScale), p(-3*mapScale), size * 0.104, size * 0.064, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#93ddb8';
      ctx.fillRect(p(0) - 3, p(0) - 3, 6, 6);
    }
    for (const e of this.enemies) {
      if (e.hp <= 0) continue;
      const enemyPoint = cityFootprint ? toCityPoint(e.group.position.x, e.group.position.z) : { x: p(e.group.position.x), y: p(e.group.position.z) };
      ctx.fillStyle = e.boss ? '#dda4e9' : '#d6a871';
      ctx.beginPath();
      ctx.arc(
        enemyPoint.x,
        enemyPoint.y,
        e.boss ? 4 : 2,
        0,
        Math.PI * 2,
      );
      ctx.fill();
    }
    const heroPoint = cityFootprint ? toCityPoint(this.hero.x, this.hero.z) : { x: p(this.hero.x), y: p(this.hero.z) };
    ctx.save();
    ctx.translate(heroPoint.x, heroPoint.y);
    ctx.rotate(Math.atan2(this.direction.x, -this.direction.z));
    ctx.fillStyle = '#fff1b6';
    ctx.beginPath();
    ctx.moveTo(0, -6);
    ctx.lineTo(4, 4);
    ctx.lineTo(0, 2);
    ctx.lineTo(-4, 4);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }
  sound(freq: number, length: number) {
    if (this.muted) return;
    try {
      this.audio ??= new AudioContext();
      if (this.audio.state === 'suspended') void this.audio.resume().catch(() => {});
      const o = this.audio.createOscillator(),
        g = this.audio.createGain();
      o.type = 'sine';
      o.frequency.setValueAtTime(freq, this.audio.currentTime);
      o.frequency.exponentialRampToValueAtTime(
        Math.max(40, freq * 0.5),
        this.audio.currentTime + length,
      );
      g.gain.setValueAtTime(0.045, this.audio.currentTime);
      g.gain.exponentialRampToValueAtTime(
        0.0001,
        this.audio.currentTime + length,
      );
      o.connect(g);
      g.connect(this.audio.destination);
      o.start();
      o.stop(this.audio.currentTime + length);
    } catch {
      /* Audio is optional. */
    }
  }
  setCameraMode(mode: CameraMode) {
    if (mode === this.cameraMode) return;
    this.rmbHeld = false;
    this.dragging = false;
    this.impactShakeRemaining = 0;
    if (mode === 'follow') {
      this.savedFreeYaw = this.yaw;
      if (!this.followInitialized) {
        this.followView = createFollowCamera(this.actor.rotation.y);
        this.followInitialized = true;
      }
      this.camera = this.followCamera;
      this.yaw = this.followView.yaw;
    } else {
      this.camera = this.freeCamera;
      this.yaw = this.savedFreeYaw;
    }
    this.cameraMode = mode;
    this.cameraFocus.copy(this.actor.position);
    this.updateCamera(0);
    this.camera.updateMatrixWorld();
    this.message(mode === 'follow'
      ? 'Follow Camera · klik kanan-drag untuk orbit, scroll untuk zoom.'
      : 'Free Camera · kontrol kamera bebas aktif.');
    this.emit();
  }
  updateCameraProjection() {
    const w = this.host.clientWidth,
      h = this.host.clientHeight;
    if (!w || !h) return;
    const a = w / h;
    if (this.camera instanceof T.PerspectiveCamera) {
      if (this.camera.aspect !== a) {
        this.camera.aspect = a;
        this.camera.updateProjectionMatrix();
      }
      return;
    }
    const size = this.cameraZoom.halfHeight;
    if (Math.abs(this.camera.top - size) < 0.00001 && Math.abs(this.camera.right - size * a) < 0.00001) return;
    this.camera.left = -size * a;
    this.camera.right = size * a;
    this.camera.top = size;
    this.camera.bottom = -size;
    this.camera.updateProjectionMatrix();
  }
  resize = () => {
    const w = this.host.clientWidth, h = this.host.clientHeight;
    if (!w || !h) return;
    this.updateCameraProjection();
    // CSS owns the canvas footprint; Three.js updates only the drawing buffer.
    // This keeps the WebGL surface at the full overlay size without affecting HUD layout.
    this.renderer.setSize(w, h, false);
  };
  keydown = (e: KeyboardEvent) => {
    if (!this.started || e.defaultPrevented || this.hotbarInteracting) return;
    if (
      (e.target as HTMLElement)?.closest(
        'input,textarea,select,[contenteditable="true"],[role="dialog"],[role="alertdialog"]',
      )
    )
      return;
    const k = e.key.toLowerCase();
    if(e.ctrlKey||e.metaKey||e.altKey)return;
    if(document.querySelector('[role="dialog"],[role="alertdialog"]'))return;
    if ([' ', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright'].includes(k))
      e.preventDefault();
    if (k === 'escape' && !e.repeat) {
      this.clearInput();
      this.onPause();
      return;
    }
    if (!this.started || this.paused || this.dead) return;
    if (k === ' ' && !e.repeat) {
      this.pickupGroundLoot();
      return;
    }
    this.keys.add(k);
    if (k === 'f') {this.blocking = true;setManualGuard(this.hero,true);}
    if (e.repeat) return;
    const hotbarIndex=primaryHotbarKeyIndex(e);
    if(hotbarIndex>=0){e.preventDefault();this.usePrimaryHotbarSlot(hotbarIndex);}
    const quick=quickHotbarKey(e);
    if(quick){e.preventDefault();this.useQuickHotbarSlot(quick);}
  };
  keyup = (e: KeyboardEvent) => {
    const key = e.key.toLowerCase();
    this.keys.delete(key);
    if (key === 'f') {this.blocking = false;setManualGuard(this.hero,false);}
  };
  blur = () => {
    this.rmbHeld = false;
    this.cameraZoom.rmbFramingActive = false;
    this.clearInput();
    if (this.started && !this.paused && !this.dead) {
      this.pause(true);
      this.onPause();
    }
  };
  visibility = () => {
    this.bgm.setHidden(document.hidden);
    if (document.hidden) this.blur();
  };
  pagehide = () => {
    this.bgm.setHidden(true);
    this.save();
  };
  contextmenu = (e: Event) => e.preventDefault();
  tryNpcInteraction() {
    this.raycaster.setFromCamera(this.pointer,this.camera);
    for(const hit of this.raycaster.intersectObjects(this.regionDecor.children,true)) {
      let object:T.Object3D|null=hit.object;
      while(object&&object!==this.regionDecor) {
        if(typeof object.userData.npcId==='string') {this.openNpc(object.userData.npcId);return true;}
        if((this.fieldTerrain||this.isSandsLocation)&&typeof object.userData.destination==='string') {
          if(Math.hypot(this.hero.x-object.position.x,this.hero.z-object.position.z)>4.5)this.message('Dekati gerbang untuk berpindah wilayah.');
          else this.changeRegion(object.userData.destination);
          return true;
        }
        object=object.parent;
      }
    }
    return false;
  }
  pointerdown = (e: PointerEvent) => {
    this.handleWorldPointerDown(e);
  };
  handleWorldPointerDown(e:PointerEvent) {
    // Listener belongs to canvas only. Never accept a bubbled/synthetic UI click-through.
    if(e.defaultPrevented||e.target!==this.renderer.domElement)return;
    if (!this.started || this.paused || this.dead || this.hotbarInteracting) return;
    if (e.button === 2) {
      this.rmbHeld = true;
      // A plain RMB click must not become a camera drag until it crosses a
      // small threshold.
      this.dragging = false;
      if (this.cameraMode === 'free' && !this.cameraZoom.rmbFramingActive) {
        this.cameraZoom.rmbFramingTarget = this.cameraZoom.currentFraming;
        this.cameraZoom.rmbFraming = this.cameraZoom.currentFraming;
      }
      this.pointerStart = e.clientX;
      this.pointerStartY = e.clientY;
      e.preventDefault();
      return;
    }
    this.pointermove(e);
    if (e.button === 0) {
      if(this.tryNpcInteraction()) return;
      if(usesHardTargeting(this.hero)){this.handleEnemySelection(this.pickEnemy());return;}
      this.attacking = true;
      this.attack();
    }
  };
  pointerup = (e: PointerEvent) => {
    if (e.button === 2) {
      this.rmbHeld = false;
    }
    this.attacking = false;
    this.dragging = false;
  };
  pointermove = (e: PointerEvent) => {
    const r = this.renderer.domElement.getBoundingClientRect();
    this.pointer.set(
      ((e.clientX - r.left) / r.width) * 2 - 1,
      (-(e.clientY - r.top) / r.height) * 2 + 1,
    );
    this.pointerActive = true;
    if (e.buttons & 2) {
      const deltaX = e.clientX - this.pointerStart;
      const deltaY = e.clientY - this.pointerStartY;
      if (!this.dragging && Math.hypot(deltaX, deltaY) < 4) return;
      if (this.cameraMode === 'follow') {
        if (!this.rmbHeld || !this.started || this.paused || this.dead || this.hotbarInteracting) return;
        if (!this.dragging) this.followView.targetYaw = this.followView.yaw;
        this.dragging = true;
        this.followView.targetYaw -= deltaX * 0.005;
        this.yaw = this.followView.targetYaw;
        this.followView.targetPitch = T.MathUtils.clamp(
          this.followView.targetPitch + deltaY * 0.004,
          FOLLOW_CAMERA.minPitch, FOLLOW_CAMERA.maxPitch,
        );
        this.pointerStart = e.clientX;
        this.pointerStartY = e.clientY;
        return;
      }
      this.dragging = true;
      // A plain RMB click keeps the last wheel pose. Only an actual drag
      // enters the RMB vertical framing path.
      if (!this.cameraZoom.rmbFramingActive) {
        this.cameraZoom.rmbFramingTarget = this.cameraZoom.currentFraming;
        this.cameraZoom.rmbFraming = this.cameraZoom.currentFraming;
        this.cameraZoom.rmbFramingActive = true;
      }
      // Horizontal camera drag is intentionally inverted for the requested feel.
      this.yaw -= deltaX * 0.005;
      // Vertical RMB drag and wheel both modify the same adaptive framing target.
      // Dragging upward moves toward the close/low-angle framing.
      this.cameraZoom.rmbFramingTarget = Math.max(0, Math.min(1,
        this.cameraZoom.rmbFramingTarget - deltaY * 0.004));
      this.pointerStart = e.clientX;
      this.pointerStartY = e.clientY;
    }
  };
  wheel = (e: WheelEvent) => {
    e.preventDefault();
    if (!this.started || this.paused || this.dead || this.hotbarInteracting) return;
    if (this.cameraMode === 'follow') {
      this.followView.targetDistance = followWheelDistance(this.followView.targetDistance, e.deltaY, e.deltaMode, this.host.clientHeight);
      return;
    }
    const framingSource = this.rmbHeld
      ? this.cameraZoom.rmbFramingTarget
      : this.cameraZoom.targetFraming;
    const nextFraming = wheelCameraFraming(
      framingSource,
      e.deltaY,
      e.deltaMode,
      this.host.clientHeight,
    );
    if (this.rmbHeld) {
      // Keep RMB mode alive while the button is held. Wheel input feeds the
      // same adaptive framing target instead of switching camera modes mid-drag.
      this.cameraZoom.rmbFramingTarget = nextFraming;
      this.cameraZoom.targetFraming = nextFraming;
      this.cameraZoom.rmbFramingActive = true;
      // Re-anchor the orbit drag at the exact pointer position that produced
      // the wheel event. The next RMB movement therefore starts from the
      // post-scroll camera pose instead of replaying stale pointer movement.
      if (Number.isFinite(e.clientX) && Number.isFinite(e.clientY)) {
        this.pointerStart = e.clientX;
        this.pointerStartY = e.clientY;
        this.dragging = false;
      }
    } else {
      // Wheel remains the authoritative zoom input until the next RMB drag.
      this.cameraZoom.targetFraming = nextFraming;
      this.cameraZoom.rmbFramingActive = false;
    }
  };
  dispose() {
    if (this.disposed) return;
    this.clearSkillRuntime();
    this.clearGroundLoot();
    this.targetPresentation?.dispose();this.targetPresentation=undefined;this.targetEntities?.clear();
    this.disposed = true;
    setArunikaShrineMaterials(this.shrine,null);
    this.arunikaMaterials?.dispose();this.arunikaMaterials=null;
    this.treeColliders=[];
    this.bgm.dispose();
    this.save();
    cancelAnimationFrame(this.frame);
    this.frame = 0;
    this.resizeObserver.disconnect();
    window.removeEventListener('keydown', this.keydown);
    window.removeEventListener('keyup', this.keyup);
    window.removeEventListener('blur', this.blur);
    document.removeEventListener('visibilitychange', this.visibility);
    window.removeEventListener('pagehide', this.pagehide);
    window.removeEventListener('pointerdown', this.audioGesture, true);
    window.removeEventListener('keydown', this.audioGesture, true);
    window.removeEventListener('pointerup', this.pointerup);
    window.removeEventListener('pointercancel', this.pointerup);
    const c = this.renderer.domElement;
    c.removeEventListener('pointerdown', this.pointerdown);
    c.removeEventListener('pointermove', this.pointermove);
    c.removeEventListener('contextmenu', this.contextmenu);
    c.removeEventListener('wheel', this.wheel);
    this.scene.remove(this.actor);
    disposeCharacterModel(this.actor);
    this.scene.traverse((o) => {
      if (o instanceof T.Mesh) {
        o.geometry.dispose();
        const mats = Array.isArray(o.material) ? o.material : [o.material];
        mats.forEach((m) => m.dispose());
      }
    });
    this.renderer.dispose();
    this.renderer.forceContextLoss();
    c.remove();
    this.floating.forEach((f) => f.element.remove());
    this.enemyLabels.forEach((label) => label.remove());
    this.enemyLabels.clear();
    this.npcLabels.forEach(entry=>entry.element.remove());
    this.npcLabels=[];
    this.playerStatusLabel?.remove();
    this.playerStatusLabel = null;
    this.portalLabels.forEach(p=>p.element.remove());this.portalLabels=[];
    void this.audio?.close().catch(() => {});
  }
}
