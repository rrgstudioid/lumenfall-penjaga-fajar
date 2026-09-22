/// <reference types="vite/client" />
// Isolated browser regression fixture: imports the production provider and domain actions.
// Does not read/write the player's storage or expose a production route.
import { useState } from 'react';
import { createRoot } from 'react-dom/client';
import { flushSync } from 'react-dom';
import {
  GameDragDropProvider,
  useGameDrag,
} from '../../components/game/drag-drop-provider';
import {
  commitDrop,
  getInventorySlots,
  type DragSource,
  type DropTarget,
} from '../../lib/game/drag-drop';
import { freshHero, createItem, parseSave } from '../../lib/game/rules';
import type { Game } from '../../lib/game/world';
import { dragPreviewPosition } from '../../lib/game/drag-geometry';
import '../../app/drag-drop.css';

const host = {
  hero: freshHero(),
  started: true,
  dead: false,
  blocked: false,
  hotbarEditMode: true,
  commits: 0,
  setHotbarInteraction(value: boolean) {
    this.blocked = value;
  },
  message(_text: string) {},
  commitUIDrop(source: DragSource, target: DropTarget) {
    const result = commitDrop(this.hero, source, target, this.hotbarEditMode);
    if (result.ok) {
      this.hero = result.hero;
      this.commits++;
    }
    return result.ok;
  },
};
const frame = () =>
  new Promise<void>((resolve) =>
    requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
  );
const settle = () => new Promise((resolve) => setTimeout(resolve, 220));
const element = (id: string) => document.getElementById(id)!;
const center = (node: Element) => {
  const r = node.getBoundingClientRect();
  return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
};
function pointer(
  type: string,
  node: Element | Window,
  at: { x: number; y: number },
) {
  node.dispatchEvent(
    new PointerEvent(type, {
      bubbles: true,
      cancelable: true,
      pointerId: 1,
      pointerType: 'mouse',
      button: 0,
      buttons: type === 'pointerup' ? 0 : 1,
      isPrimary: true,
      clientX: at.x,
      clientY: at.y,
    }),
  );
}
function Sources() {
  const { begin } = useGameDrag();
  return (
    <div id="scale-root" style={{ transformOrigin: 'top left' }}>
      <button
        id="skill"
        data-drag-source="skill"
        onPointerDown={(event) =>
          begin(event, { dragType: 'skill', refId: 'fajar-step' })
        }
      >
        Learned skill
      </button>
      <button
        id="locked"
        data-drag-source="skill"
        onPointerDown={(event) =>
          begin(event, { dragType: 'skill', refId: 'nova-fajar' })
        }
      >
        Locked skill
      </button>
      <button
        id="passive"
        data-drag-source="skill"
        onPointerDown={(event) =>
          begin(event, { dragType: 'skill', refId: 'adventurer-resolve' })
        }
      >
        Passive
      </button>
      <button
        id="item"
        data-drag-source="item"
        onPointerDown={(event) =>
          begin(event, {
            dragType: 'item',
            refId: host.hero.inventory[0].id,
            inventorySlot: 0,
          })
        }
      >
        Inventory potion
      </button>
      <button
        id="binding"
        data-drag-source="hotbar-binding"
        onPointerDown={(event) =>
          begin(event, {
            dragType: 'hotbar-binding',
            refId: host.hero.primaryHotbar[0]!,
            hotbarSlot: 0,
          })
        }
      >
        Hotbar source 1
      </button>
      <button id="target" data-drop-type="hotbar" data-drop-slot="4">
        Target hotbar 5
      </button>
      {(['q', 'e'] as const).map((id) => (
        <button
          key={id}
          id={`quick-${id}`}
          data-drop-type="hotbar"
          data-drop-slot={id}
          data-drag-source="hotbar-binding"
          onPointerDown={(event) => {
            const refId = host.hero.quickHotbars[id].assignment;
            if (refId)
              begin(event, {
                dragType: 'hotbar-binding',
                hotbarSlot: id,
                refId,
              });
          }}
        >
          Quick {id.toUpperCase()}
        </button>
      ))}
      <button
        id="inv-target"
        data-drop-type="inventory"
        data-drop-slot="29"
        data-drop-item=""
      >
        Inventory empty
      </button>
      <div id="invalid" style={{ padding: 25, background: '#384b45' }}>
        Invalid panel
      </div>
    </div>
  );
}
function Fixture() {
  const [results, setResults] = useState<string[]>([]);
  const [running, setRunning] = useState(false);
  const [mounted, setMounted] = useState(true);
  const run = async () => {
    setRunning(true);
    setResults([]);
    const output: string[] = [];
    const check = (ok: boolean, label: string) => {
      if (!ok) throw new Error(label);
    };
    const reset = async () => {
      host.hero = freshHero();
      host.hero.inventory = [createItem('mana-potion-1', { quantity: 3 })];
      host.commits = 0;
      host.hotbarEditMode = true;
      flushSync(() => setMounted(true));
      element('scale-root').style.transform = 'scale(1)';
      element('scale-root').style.fontSize = '16px';
      await settle();
    };
    const start = async (id: string, targetId = 'target') => {
      const source = element(id);
      const end = center(element(targetId));
      pointer('pointerdown', source, center(source));
      pointer('pointermove', source, end);
      await frame();
      return { source, end };
    };
    const release = ({ source, end }: Awaited<ReturnType<typeof start>>) =>
      pointer('pointerup', source, end);
    const test = async (name: string, fn: () => Promise<void>) => {
      try {
        await reset();
        await fn();
        output.push(`PASS ${name}`);
      } catch (error) {
        output.push(`FAIL ${name}: ${String(error)}`);
      } finally {
        window.dispatchEvent(new Event('blur'));
        await settle();
      }
      setResults([...output]);
    };
    for (const scale of [0.75, 1, 1.5]) {
      await test(`skill assignment + pointer precision at ${scale * 100}%`, async () => {
        element('scale-root').style.transform = `scale(${scale})`;
        await frame();
        const input = await start('skill');
        check(
          element('target').dataset.dropFeedback === 'valid',
          'valid target missing',
        );
        const ghost = document
          .querySelector('.game-drag-preview')!
          .getBoundingClientRect();
        const expected = dragPreviewPosition(
          input.end,
          { width: innerWidth, height: innerHeight },
          ghost,
        );
        check(
          Math.abs(ghost.x - expected.x) < 1 &&
            Math.abs(ghost.y - expected.y) < 1,
          'preview offset',
        );
        release(input);
        check(
          host.hero.primaryHotbar[4] === 'fajar-step' && host.commits === 1,
          'assignment',
        );
        check(host.hero.skillLevels['fajar-step'] === 1, 'skill lost');
      });
    }
    await test('font enlargement preserves pointer precision', async () => {
      element('scale-root').style.fontSize = '24px';
      await frame();
      release(await start('skill'));
      check(host.hero.primaryHotbar[4] === 'fajar-step', 'font-scaled drop');
    });
    for (const id of ['locked', 'passive'])
      await test(`${id} skill rejected`, async () => {
        release(await start(id));
        check(host.commits === 0, 'invalid skill committed');
      });
    await test('below-threshold click remains click', async () => {
      let clicks = 0;
      const source = element('skill');
      source.onclick = () => clicks++;
      const point = center(source);
      pointer('pointerdown', source, point);
      pointer('pointermove', source, { x: point.x + 3, y: point.y });
      pointer('pointerup', source, point);
      source.click();
      check(
        clicks === 1 && host.commits === 0 && !host.blocked,
        'click swallowed',
      );
      source.onclick = null;
    });
    await test('drag suppresses activation click and releases input', async () => {
      let clicks = 0;
      element('skill').onclick = () => clicks++;
      const input = await start('skill');
      check(host.blocked, 'input not blocked');
      release(input);
      element('skill').click();
      check(clicks === 0 && !host.blocked, 'accidental action or stuck input');
      element('skill').onclick = null;
    });
    await test('item assignment preserves ownership and quantity', async () => {
      const inventory = host.hero.inventory;
      release(await start('item'));
      check(
        host.hero.inventory === inventory &&
          inventory[0].quantity === 3 &&
          host.hero.primaryHotbar[4] === 'mana-potion-1',
        'item copy/move',
      );
    });
    await test('a new deliberate click immediately after dragging is not swallowed', async () => {
      release(await start('skill'));
      const node = element('invalid');
      let clicks = 0;
      node.onclick = () => clicks++;
      pointer('pointerdown', node, center(node));
      pointer('pointerup', node, center(node));
      node.click();
      check(clicks === 1, 'next user click was suppressed');
      node.onclick = null;
    });
    await test('inventory empty move persists through save parsing', async () => {
      const inventory = host.hero.inventory;
      release(await start('item', 'inv-target'));
      check(
        host.hero.inventory === inventory &&
          getInventorySlots(host.hero)[0] === null,
        'ownership or empty gap',
      );
      check(
        getInventorySlots(parseSave(JSON.stringify(host.hero))!)[29] ===
          inventory[0].id,
        'lost saved position',
      );
    });
    await test('hotbar swap only changes references', async () => {
      const inventory = host.hero.inventory;
      release(await start('binding'));
      check(
        host.hero.primaryHotbar[0] === 'basic-attack' &&
          host.hero.primaryHotbar[4] === 'fajar-step' &&
          host.hero.inventory === inventory,
        'swap',
      );
    });
    await test('intentional outside release unbinds shortcut only', async () => {
      const input = await start('binding', 'empty');
      release(input);
      check(
        host.hero.primaryHotbar[0] === null &&
          host.hero.skillLevels['fajar-step'] === 1,
        'unbind',
      );
    });
    for (const id of ['skill', 'item', 'binding'])
      await test(`${id} invalid UI drop snaps back`, async () => {
        const before = JSON.stringify(host.hero);
        release(await start(id, 'invalid'));
        check(
          JSON.stringify(host.hero) === before && host.commits === 0,
          'invalid mutation',
        );
      });
    for (const cause of [
      'Escape',
      'pointercancel',
      'lostpointercapture',
      'blur',
      'resize',
      'source-close',
      'scale-change',
    ])
      await test(`${cause} cancels, never unbinds`, async () => {
        const before = JSON.stringify(host.hero);
        const input = await start('binding', 'empty');
        if (cause === 'Escape')
          window.dispatchEvent(
            new KeyboardEvent('keydown', {
              key: 'Escape',
              bubbles: true,
              cancelable: true,
            }),
          );
        else if (cause === 'source-close') flushSync(() => setMounted(false));
        else if (cause === 'scale-change')
          element('scale-root').style.transform = 'scale(1.2)';
        else if (cause === 'pointercancel' || cause === 'lostpointercapture')
          pointer(cause, input.source, input.end);
        else window.dispatchEvent(new Event(cause));
        await frame();
        release(input);
        check(
          JSON.stringify(host.hero) === before &&
            host.commits === 0 &&
            !host.blocked,
          'cancel committed/stuck',
        );
      });
    for (const cause of [
      'item-consumed',
      'skill-unlearned',
      'character-changed',
      'slot-changed',
    ])
      await test(`stale ${cause} rejected`, async () => {
        const input = await start(
          cause === 'item-consumed'
            ? 'item'
            : cause === 'slot-changed'
              ? 'binding'
              : 'skill',
        );
        if (cause === 'item-consumed') host.hero.inventory = [];
        if (cause === 'skill-unlearned')
          host.hero.skillLevels['fajar-step'] = 0;
        if (cause === 'character-changed')
          host.hero.slotId = 'another-character';
        if (cause === 'slot-changed') host.hero.primaryHotbar[0] = null;
        release(input);
        check(host.commits === 0 && !host.blocked, 'stale commit');
      });
    await test('rapid repeated drags commit once per gesture', async () => {
      release(await start('skill'));
      release(await start('skill'));
      check(
        host.commits === 2 &&
          host.hero.primaryHotbar.filter((id) => id === 'fajar-step').length ===
            1,
        'duplicate',
      );
    });
    await test('lost capture from an unrelated control does not cancel the current source', async () => {
      const input = await start('binding');
      pointer('lostpointercapture', element('invalid'), input.end);
      release(input);
      check(host.commits === 1, 'unrelated capture cancelled drag');
    });
    await test('preview stays inside the viewport at bottom-right', async () => {
      const source = element('binding');
      const end = { x: innerWidth - 5, y: innerHeight - 5 };
      pointer('pointerdown', source, center(source));
      pointer('pointermove', source, end);
      await frame();
      const ghost = document
        .querySelector('.game-drag-preview')!
        .getBoundingClientRect();
      check(
        ghost.right <= innerWidth && ghost.bottom <= innerHeight,
        'preview outside viewport',
      );
      window.dispatchEvent(new Event('blur'));
    });
    await test('Edit OFF rejects skill drop into Q without changing state', async () => {
      host.hotbarEditMode = false;
      release(await start('skill', 'quick-q'));
      check(
        host.commits === 0 && host.hero.quickHotbars.q.assignment === null,
        'edited while locked',
      );
    });
    await test('Edit OFF cannot drag a primary binding', async () => {
      host.hotbarEditMode = false;
      release(await start('binding', 'quick-q'));
      check(
        host.commits === 0 && host.hero.primaryHotbar[0] === 'fajar-step',
        'locked source moved',
      );
    });
    await test('skill to Q and inventory to E share the existing provider', async () => {
      const inventory = JSON.stringify(host.hero.inventory);
      release(await start('skill', 'quick-q'));
      release(await start('item', 'quick-e'));
      check(
        host.commits === 2 &&
          host.hero.quickHotbars.q.assignment === 'fajar-step' &&
          host.hero.quickHotbars.e.assignment === 'mana-potion-1',
        'quick assignment missing',
      );
      check(
        JSON.stringify(host.hero.inventory) === inventory,
        'ownership changed',
      );
    });
    await test('Q and E swap references through pointer hit testing', async () => {
      release(await start('skill', 'quick-q'));
      release(await start('item', 'quick-e'));
      release(await start('quick-q', 'quick-e'));
      check(
        host.commits === 3 &&
          host.hero.quickHotbars.q.assignment === 'mana-potion-1' &&
          host.hero.quickHotbars.e.assignment === 'fajar-step',
        'swap failed',
      );
    });
    await test('quick source invalid drop returns; background release unbinds only', async () => {
      release(await start('skill', 'quick-q'));
      release(await start('quick-q', 'invalid'));
      check(
        host.commits === 1 &&
          host.hero.quickHotbars.q.assignment === 'fajar-step',
        'invalid drop removed binding',
      );
      release(await start('quick-q', 'empty'));
      check(
        host.commits === 2 &&
          host.hero.quickHotbars.q.assignment === null &&
          host.hero.skillLevels['fajar-step'] === 1,
        'background changed ownership',
      );
    });
    await test('Escape cancels quick source rather than unbinding', async () => {
      release(await start('skill', 'quick-q'));
      const input = await start('quick-q', 'empty');
      window.dispatchEvent(
        new KeyboardEvent('keydown', {
          key: 'Escape',
          bubbles: true,
          cancelable: true,
        }),
      );
      release(input);
      check(
        host.commits === 1 &&
          host.hero.quickHotbars.q.assignment === 'fajar-step',
        'Escape unbound Q',
      );
    });
    await test('Q returns to an occupied primary slot by swapping', async () => {
      release(await start('skill', 'quick-q'));
      release(await start('quick-q', 'target'));
      check(
        host.commits === 2 &&
          host.hero.primaryHotbar[4] === 'fajar-step' &&
          host.hero.quickHotbars.q.assignment === 'basic-attack',
        'reverse swap failed',
      );
    });
    setRunning(false);
  };
  return (
    <>
      <h1>Production drag provider · isolated regression</h1>
      <button disabled={running} onClick={() => void run()}>
        Run interaction regression
      </button>
      <p>
        {running
          ? 'Running'
          : results.length
            ? `${results.filter((result) => result.startsWith('PASS')).length}/${results.length} passed`
            : 'Ready'}
      </p>
      <GameDragDropProvider game={host as unknown as Game}>
        {mounted && <Sources />}
      </GameDragDropProvider>
      <div
        id="empty"
        data-world-surface
        style={{
          position: 'fixed',
          left: 12,
          bottom: 12,
          width: 150,
          height: 80,
          background: '#1b2a26',
        }}
      >
        Empty world background
      </div>
      <pre>{results.join('\n')}</pre>
      <style>{`body{background:#12211b;color:#eee;font:16px sans-serif;padding:16px}#scale-root{display:grid;grid-template-columns:repeat(4,150px);gap:12px;margin:30px 0;width:max-content}button{padding:12px;font:inherit}pre{font-size:13px;line-height:1.5}`}</style>
    </>
  );
}
const fixtureRoot = createRoot(document.getElementById('root')!);
fixtureRoot.render(<Fixture />);
if (import.meta.hot) import.meta.hot.dispose(() => fixtureRoot.unmount());
