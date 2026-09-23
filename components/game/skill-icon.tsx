import {
  ArrowRight,
  ArrowUpRight,
  ArrowDown,
  ArrowDownToLine,
  Anvil,
  BookOpen,
  Castle,
  CloudLightning,
  Compass,
  Cross,
  Crosshair,
  Crown,
  Eye,
  Footprints,
  Hand,
  Heart,
  HeartHandshake,
  HeartPulse,
  Hexagon,
  Link,
  Moon,
  Mountain,
  Orbit,
  Pentagon,
  ScanEye,
  ScrollText,
  Shield,
  ShieldCheck,
  ShieldOff,
  Skull,
  Snowflake,
  Spline,
  Sun,
  Sunrise,
  Sword,
  Swords,
  Tornado,
  Trees,
  Unplug,
  Waves,
  Webhook,
  Wind,
  Zap,
  HandFist,
  Music,
  Sprout,
  Leaf,
  Drama,
  FlaskConical,
  Flame,
  type LucideIcon,
} from 'lucide-react';
import { SKILL_VISUALS, type SkillGlyph } from '@/lib/game/skill-visuals';

const glyphs: Record<SkillGlyph, LucideIcon> = {
  dash: ArrowRight,
  dawn: Sunrise,
  sword: Sword,
  guard: ShieldCheck,
  burst: Sun,
  hammer: Anvil,
  impact: Waves,
  shield: Shield,
  steel: Hexagon,
  swords: Swords,
  flame: Flame,
  footprints: Footprints,
  moon: Moon,
  daggers: Swords,
  speed: Wind,
  vanish: Unplug,
  target: Crosshair,
  arrow: ArrowUpRight,
  arrows: ArrowDownToLine,
  leaf: Leaf,
  chains: Link,
  bolt: Zap,
  arcane: Orbit,
  orbit: Orbit,
  meteor: ArrowDown,
  hand: Hand,
  heart: Heart,
  leap: ArrowUpRight,
  fist: HandFist,
  earth: Mountain,
  shockwave: Waves,
  storm: CloudLightning,
  fracture: ShieldOff,
  castle: Castle,
  dagger: Sword,
  spiral: Tornado,
  eye: Eye,
  mark: ScanEye,
  skull: Skull,
  snow: Snowflake,
  trap: Webhook,
  root: Sprout,
  poison: FlaskConical,
  net: Spline,
  forest: Trees,
  pentagon: Pentagon,
  scroll: ScrollText,
  masks: Drama,
  music: Music,
  cross: Cross,
  prayer: HeartHandshake,
  parry: ShieldCheck,
  compass: Compass,
  anvil: Anvil,
  book: BookOpen,
  pulse: HeartPulse,
  crown: Crown,
};

/** Canonical vector used by cards, detail, hotbar, tooltip and drag preview. */
export function SkillIcon({ id, size = 28 }: { id: string; size?: number }) {
  if (id === 'v3-berserker-earth-splitter') {
    return (
      <span
        className="skill-icon skill-icon-custom"
        style={{ width: size, height: size }}
        aria-hidden="true"
        data-skill-icon={id}
      >
        <img src="/assets/icons/skills/earth-splitter.svg" alt="" />
      </span>
    );
  }
  if (id === 'v3-blade-master-twin-assault') {
    return (
      <span
        className="skill-icon skill-icon-custom"
        style={{ width: size, height: size }}
        aria-hidden="true"
        data-skill-icon={id}
      >
        <img src="/assets/icons/skills/twin-assault-source.png" alt="" />
      </span>
    );
  }
  const visual = SKILL_VISUALS[id as keyof typeof SKILL_VISUALS];
  const Glyph = visual ? glyphs[visual[0]] : BookOpen;
  const Motif = visual ? glyphs[visual[1]] : null;
  return (
    <span
      className="skill-icon"
      style={{ width: size, height: size }}
      aria-hidden="true"
      data-skill-icon={id}
    >
      <Glyph size={size} strokeWidth={1.6} />
      {Motif && (
        <Motif
          className="skill-icon-motif"
          size={Math.round(size * 0.42)}
          strokeWidth={2}
        />
      )}
    </span>
  );
}
