import type { Game } from './world';
import { isResourceEnabled } from './gameplay-config';

type Tool = {
  name: string;
  title: string;
  description: string;
  inputSchema: object;
  annotations: { readOnlyHint: boolean; untrustedContentHint: boolean };
  execute: (input: unknown) => unknown;
};
type Context = {
  registerTool: (
    tool: Tool,
    options: { signal: AbortSignal },
  ) => void | Promise<void>;
};
const emptySchema = {
  type: 'object',
  properties: {},
  additionalProperties: false,
};
function object(input: unknown) {
  if (!input || typeof input !== 'object' || Array.isArray(input))
    throw new Error('Expected an object.');
  return input as Record<string, unknown>;
}
function empty(input: unknown) {
  if (Object.keys(object(input)).length)
    throw new Error('This tool accepts an empty object only.');
}

export function registerGameTools(
  getGame: () => Game | null,
  closePanel: () => void,
) {
  const context = (document as Document & { modelContext?: Context })
    .modelContext;
  if (!context?.registerTool) return () => {};
  const lifecycle = new AbortController();
  let playing = false;
  const current = () => {
    const game = getGame();
    if (!game || game.disposed) throw new Error('The 3D world is not ready.');
    return game;
  };
  const progress = () => {
    const s = current().snapshot();
    return {
      hero: s.hero,
      started: s.started,
      paused: s.paused,
      dead: s.dead,
      staminaEnabled: isResourceEnabled(s.hero, 'stamina'),
      stamina: isResourceEnabled(s.hero, 'stamina') ? Math.round(s.stamina) : null,
      novaCooldown: Math.ceil(s.cooldown),
      nearShrine: s.nearShrine,
      enemies: s.enemies.map((e) => ({
        ...e,
        x: Math.round(e.x * 10) / 10,
        z: Math.round(e.z * 10) / 10,
      })),
      savedLocally: s.saved,
    };
  };
  const settle = () =>
    new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
  const register = (tool: Tool) => {
    try {
      void Promise.resolve(
        context.registerTool(tool, { signal: lifecycle.signal }),
      ).catch(() => console.warn('Optional game tools unavailable.'));
    } catch {
      console.warn('Optional game tools unavailable.');
    }
  };
  register({
    name: 'get_adventure_progress',
    title: 'Read adventure progress',
    description:
      'Read this browser’s current Lumenfall character, health, position, quest and visible enemies. Does not change the game.',
    inputSchema: emptySchema,
    annotations: { readOnlyHint: true, untrustedContentHint: false },
    execute(input) {
      empty(input);
      return progress();
    },
  });
  register({
    name: 'start_adventure',
    title: 'Start or resume adventure',
    description:
      'Start the adventure using the saved local character, or resume a paused adventure. Closes menus and enables combat. Does not reset progress; a defeated character must use the visible respawn button.',
    inputSchema: emptySchema,
    annotations: { readOnlyHint: false, untrustedContentHint: false },
    async execute(input) {
      empty(input);
      const g = current();
      if (g.dead) throw new Error('Use the visible respawn button first.');
      closePanel();
      g.start();
      await settle();
      return progress();
    },
  });
  register({
    name: 'play_guardian',
    title: 'Move or use a combat action',
    description:
      'Control the living guardian for a short turn using the same WASD movement and skills as the interface. Directions are camera-relative. Attack holds the normal attack button with nearest-target aim; other skills trigger once. Combat can spend Mana or potions and may damage or defeat the character. Requires an active, unpaused game. No teleporting or rewards are granted.',
    inputSchema: {
      type: 'object',
      properties: {
        directions: {
          type: 'array',
          items: { type: 'string', enum: ['w', 'a', 's', 'd'] },
          maxItems: 2,
          uniqueItems: true,
        },
        action: {
          type: 'string',
          enum: ['attack', 'nova', 'potion', 'heal'],
        },
        durationMs: { type: 'integer', minimum: 100, maximum: 2500 },
      },
      required: ['durationMs'],
      additionalProperties: false,
    },
    annotations: { readOnlyHint: false, untrustedContentHint: false },
    async execute(input) {
      const value = object(input);
      if (
        Object.keys(value).some(
          (k) => !['directions', 'action', 'durationMs'].includes(k),
        )
      )
        throw new Error('Unknown input field.');
      const directions = value.directions ?? [];
      if (
        !Array.isArray(directions) ||
        directions.length > 2 ||
        directions.some((d) => !['w', 'a', 's', 'd'].includes(d)) ||
        new Set(directions).size !== directions.length ||
        (directions.includes('w') && directions.includes('s')) ||
        (directions.includes('a') && directions.includes('d'))
      )
        throw new Error('Choose up to two non-opposing WASD directions.');
      if (
        !Number.isInteger(value.durationMs) ||
        Number(value.durationMs) < 100 ||
        Number(value.durationMs) > 2500
      )
        throw new Error('durationMs must be an integer between 100 and 2500.');
      const action = value.action as
        | 'attack'
        | 'nova'
        | 'potion'
        | 'heal'
        | undefined;
      if (
        action !== undefined &&
        !['attack', 'nova', 'potion', 'heal'].includes(action)
      )
        throw new Error('Unknown combat action.');
      const g = current();
      if (!g.started || g.paused || g.dead)
        throw new Error('Start or resume a living guardian first.');
      if (playing) throw new Error('Another control turn is still running.');
      playing = true;
      g.clearInput();
      const oldAim = g.pointerActive;
      g.pointerActive = false;
      try {
        for (const d of directions) g.setMove(d, true);
        if (action === 'attack') g.attacking = true;
        else if (action) g.action(action);
        await new Promise<void>((resolve) => {
          const timeout = setTimeout(done, Number(value.durationMs));
          function done() {
            clearTimeout(timeout);
            lifecycle.signal.removeEventListener('abort', done);
            resolve();
          }
          lifecycle.signal.addEventListener('abort', done, { once: true });
        });
      } finally {
        g.clearInput();
        g.pointerActive = oldAim;
        playing = false;
      }
      g.emit();
      await settle();
      return progress();
    },
  });
  return () => {
    lifecycle.abort();
  };
}
