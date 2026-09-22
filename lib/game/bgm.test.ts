import { test } from 'node:test';
import assert from 'node:assert/strict';
import { statSync } from 'node:fs';
import {
  BGM_TRACKS,
  BgmPlayer,
  DEFAULT_AUDIO_SETTINGS,
  AUDIO_SETTINGS_KEY,
  loadAudioSettings,
  saveAudioSettings,
  normalizeAudioSettings,
  resolveBgmTrack,
  type BgmMedia,
} from './bgm.ts';
import { CITIES, FIELDS } from './regions.ts';

class FakeMedia implements BgmMedia {
  loop = false;
  volume = 1;
  preload = '';
  currentTime = 0;
  playing = false;
  playCalls = 0;
  pauseCalls = 0;
  released = false;
  listeners = new Set<() => void>();
  nextPlay: (() => Promise<void>) | null = null;
  play() {
    this.playCalls++;
    this.playing = true;
    return this.nextPlay?.() ?? Promise.resolve();
  }
  pause() {
    this.pauseCalls++;
    this.playing = false;
  }
  load() {
    this.currentTime = 0;
  }
  removeAttribute(name: string) {
    if (name === 'src') this.released = true;
  }
  addEventListener(_type: 'error', callback: () => void) {
    this.listeners.add(callback);
  }
  removeEventListener(_type: 'error', callback: () => void) {
    this.listeners.delete(callback);
  }
}

const track = BGM_TRACKS['city-arunika'];
const fieldTrack = BGM_TRACKS[FIELDS['verdant-plains'].musicId];
const flush = async () => {
  await Promise.resolve();
  await Promise.resolve();
};
function setup(muted = false) {
  const media: FakeMedia[] = [];
  const sources: string[] = [];
  const player = new BgmPlayer({ muted, bgmVolume: 0.35 }, (src) => {
    sources.push(src);
    const element = new FakeMedia();
    media.push(element);
    return element;
  });
  return { player, media, sources };
}

await test('Arunika keeps its city music while every monster field resolves BGM_02', () => {
  assert.equal(resolveBgmTrack(CITIES.arunika.musicId, true), track);
  assert.equal(resolveBgmTrack(CITIES.arunika.musicId, false), null);
  assert.equal(resolveBgmTrack(CITIES.jayantara.musicId, true), null);
  for (const field of Object.values(FIELDS)) {
    const resolved = resolveBgmTrack(field.musicId, true);
    assert.ok(resolved, field.id);
    assert.equal(resolved.src, '/audio/bgm/fields/bgm-02.mp3');
    assert.ok(resolved.temporary);
  }
  assert.equal(resolveBgmTrack('unknown', true), null);
  assert.equal(resolveBgmTrack(null, true), null);
  assert.ok(track.temporary);
  assert.equal(
    statSync(new URL(`../../public${track.src}`, import.meta.url)).size,
    4862005,
  );
  assert.equal(
    statSync(new URL(`../../public${fieldTrack.src}`, import.meta.url)).size,
    4458277,
  );
});

await test('title screen and existing default mute do not create or download an audio element', () => {
  const { player, media } = setup(DEFAULT_AUDIO_SETTINGS.muted);
  player.setTrack(resolveBgmTrack(CITIES.arunika.musicId, false));
  player.resumeFromGesture();
  assert.equal(media.length, 0);
  player.setTrack(track);
  assert.equal(player.status, 'muted');
  assert.equal(media.length, 0);
  player.configure({ muted: false });
  assert.equal(media.length, 1);
  assert.equal(player.status, 'loading');
});

await test('music loops and repeated snapshots or menu interactions never layer or restart it', async () => {
  const { player, media, sources } = setup();
  player.setTrack(track);
  for (let i = 0; i < 100; i++) player.setTrack(track);
  assert.equal(media[0].playCalls, 1);
  await flush();
  media[0].currentTime = 32;
  for (let i = 0; i < 100; i++) {
    player.setTrack(track);
    player.resumeFromGesture();
  }
  assert.equal(media.length, 1);
  assert.equal(media[0].loop, true);
  assert.equal(media[0].volume, 0.35);
  assert.equal(media[0].playCalls, 1);
  assert.equal(media[0].currentTime, 32);
  assert.deepEqual(sources, [track.src]);
  assert.equal(player.status, 'playing');
});

await test('city/field teleport swaps tracks while field-to-field travel never layers or restarts BGM_02', async () => {
  const { player, media } = setup();
  player.setTrack(track);
  await flush();
  player.setTrack(fieldTrack);
  assert.equal(media[0].playing, false);
  assert.equal(media[0].released, true);
  assert.equal(media[0].listeners.size, 0);
  await flush();
  assert.equal(media.length, 2);
  assert.equal(media[1].playing, true);
  media[1].currentTime = 41;
  player.setTrack(resolveBgmTrack(FIELDS['meteorfall-citadel'].musicId, true));
  await flush();
  assert.equal(media.length, 2);
  assert.equal(media[1].playCalls, 1);
  assert.equal(media[1].currentTime, 41);
  player.setTrack(track);
  await flush();
  assert.equal(media.length, 3);
  assert.equal(media[2].currentTime, 0);
  assert.equal(media.filter((item) => item.playing).length, 1);
});

await test('volume, mute and tab visibility preserve position and do not change save preferences implicitly', async () => {
  const { player, media } = setup();
  player.setTrack(track);
  await flush();
  media[0].currentTime = 21;
  player.configure({ bgmVolume: 0.7 });
  assert.equal(media[0].volume, 0.7);
  assert.equal(media[0].playCalls, 1);
  player.configure({ muted: true });
  assert.equal(media[0].playing, false);
  assert.equal(media[0].currentTime, 21);
  player.configure({ muted: false });
  await flush();
  player.setHidden(true);
  assert.equal(player.status, 'paused');
  assert.equal(media[0].playing, false);
  player.resumeFromGesture();
  assert.equal(media[0].playing, false);
  player.setHidden(false);
  await flush();
  assert.equal(player.status, 'playing');
  player.configure({ bgmVolume: 0 });
  assert.equal(media[0].playing, false);
  assert.equal(
    player.settings.muted,
    false,
    'zero music volume does not mute SFX',
  );
  assert.equal(media[0].currentTime, 21);
});

await test('autoplay rejection is handled without repeated frame retries and resumes on interaction', async () => {
  const element = new FakeMedia();
  element.nextPlay = () =>
    Promise.reject(
      Object.assign(new Error('Autoplay blocked'), { name: 'NotAllowedError' }),
    );
  const player = new BgmPlayer(
    { muted: false, bgmVolume: 0.35 },
    () => element,
  );
  player.setTrack(track);
  await flush();
  assert.equal(player.status, 'blocked');
  for (let i = 0; i < 10; i++) player.setTrack(track);
  assert.equal(element.playCalls, 1);
  element.nextPlay = null;
  player.resumeFromGesture();
  await flush();
  assert.equal(player.status, 'playing');
  assert.equal(element.playCalls, 2);
});

await test('load errors are optional, expose retry, and cannot recreate music after disposal', async () => {
  const { player, media } = setup();
  player.setTrack(track);
  await flush();
  for (const error of media[0].listeners) error();
  assert.equal(player.status, 'error');
  player.setTrack(track);
  player.resumeFromGesture();
  assert.equal(media[0].playCalls, 1);
  player.retry();
  await flush();
  assert.equal(player.status, 'playing');
  assert.equal(media.length, 2);
  player.dispose();
  player.setTrack(track);
  player.retry();
  player.configure({ muted: false });
  player.resumeFromGesture();
  assert.equal(media.length, 2);
  assert.equal(media[1].released, true);
  assert.equal(player.status, 'idle');
});

await test('late playback completion cannot revive audio after teleport, mute or disposal', async () => {
  for (const action of ['teleport', 'mute', 'dispose']) {
    const element = new FakeMedia();
    let resolve!: () => void;
    element.nextPlay = () =>
      new Promise<void>((done) => {
        resolve = done;
      });
    const player = new BgmPlayer(
      { muted: false, bgmVolume: 0.35 },
      () => element,
    );
    player.setTrack(track);
    if (action === 'teleport') player.setTrack(null);
    else if (action === 'mute') player.configure({ muted: true });
    else player.dispose();
    element.playing = true; // Simulate a delayed media completion after cancellation.
    resolve();
    await flush();
    assert.equal(element.playing, false, action);
    assert.notEqual(player.status, 'playing');
  }
});

await test('audio preferences survive reload separately from character saves, with safe defaults', () => {
  const data = new Map([['lumenfall:save', 'untouched progress']]);
  const storage = {
    getItem: (key: string) => data.get(key) ?? null,
    setItem: (key: string, value: string) => {
      data.set(key, value);
    },
  };
  assert.deepEqual(loadAudioSettings(storage), DEFAULT_AUDIO_SETTINGS);
  saveAudioSettings({ muted: false, bgmVolume: 0.62 }, storage);
  assert.deepEqual(loadAudioSettings(storage), {
    muted: false,
    bgmVolume: 0.62,
  });
  assert.equal(data.get('lumenfall:save'), 'untouched progress');
  assert.equal(data.size, 2);
  data.set(AUDIO_SETTINGS_KEY, '{bad json');
  assert.deepEqual(loadAudioSettings(storage), DEFAULT_AUDIO_SETTINGS);
  assert.deepEqual(
    normalizeAudioSettings({ muted: 'yes', bgmVolume: Infinity }),
    DEFAULT_AUDIO_SETTINGS,
  );
  assert.equal(normalizeAudioSettings({ bgmVolume: 9 }).bgmVolume, 1);
  assert.equal(normalizeAudioSettings({ bgmVolume: -1 }).bgmVolume, 0);
  const blocked = {
    getItem: (): string => {
      throw new Error('blocked');
    },
    setItem: () => {
      throw new Error('blocked');
    },
  };
  assert.deepEqual(loadAudioSettings(blocked), DEFAULT_AUDIO_SETTINGS);
  assert.doesNotThrow(() => saveAudioSettings(DEFAULT_AUDIO_SETTINGS, blocked));
});
