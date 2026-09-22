import { FIELDS } from './regions.ts';

export type BgmTrack = {
  id: string;
  src: string;
  title: string;
  temporary: boolean;
};

const FIELD_BGM_SOURCE = '/audio/bgm/fields/bgm-02.mp3';
const FIELD_MUSIC_IDS = Object.values(FIELDS).map(field=>field.musicId);

const fieldTracks = Object.fromEntries(
  FIELD_MUSIC_IDS.map((id) => [
    id,
    {
      id,
      src: FIELD_BGM_SOURCE,
      title: 'BGM_02 · field soundtrack sementara',
      temporary: true,
    } satisfies BgmTrack,
  ]),
);

// Keys match the existing city/field musicId configuration, not their shared cityId.
export const BGM_TRACKS: Readonly<Record<string, BgmTrack>> = {
  'city-arunika': {
    id: 'city-arunika',
    src: '/audio/bgm/arunika/yokohama-town.mp3',
    title: 'BGM_01 · soundtrack sementara',
    temporary: true,
  },
  ...fieldTracks,
};

export type AudioSettings = { muted: boolean; bgmVolume: number };
export const DEFAULT_AUDIO_SETTINGS: AudioSettings = {
  muted: true,
  bgmVolume: 0.35,
};
export const AUDIO_SETTINGS_KEY = 'lumenfall:audio:v1';
export type BgmStatus =
  | 'idle'
  | 'muted'
  | 'loading'
  | 'playing'
  | 'paused'
  | 'blocked'
  | 'error';
type AudioStorage = Pick<Storage, 'getItem' | 'setItem'>;

export function normalizeAudioSettings(value: unknown): AudioSettings {
  const saved =
    value && typeof value === 'object' ? (value as Partial<AudioSettings>) : {};
  return {
    muted:
      typeof saved.muted === 'boolean'
        ? saved.muted
        : DEFAULT_AUDIO_SETTINGS.muted,
    bgmVolume:
      typeof saved.bgmVolume === 'number' && Number.isFinite(saved.bgmVolume)
        ? Math.max(0, Math.min(1, saved.bgmVolume))
        : DEFAULT_AUDIO_SETTINGS.bgmVolume,
  };
}

export function loadAudioSettings(storage?: AudioStorage): AudioSettings {
  try {
    return normalizeAudioSettings(
      JSON.parse(storage?.getItem(AUDIO_SETTINGS_KEY) ?? 'null'),
    );
  } catch {
    return { ...DEFAULT_AUDIO_SETTINGS };
  }
}

export function saveAudioSettings(
  settings: AudioSettings,
  storage?: AudioStorage,
): void {
  // Device preference only. Never read or rewrite character/progress save keys.
  try {
    storage?.setItem(
      AUDIO_SETTINGS_KEY,
      JSON.stringify(normalizeAudioSettings(settings)),
    );
  } catch {
    /* Audio continues when browser storage is unavailable. */
  }
}

export function resolveBgmTrack(
  musicId: string | null,
  started: boolean,
): BgmTrack | null {
  return started && musicId ? (BGM_TRACKS[musicId] ?? null) : null;
}

export interface BgmMedia {
  loop: boolean;
  volume: number;
  preload: string;
  currentTime: number;
  play(): Promise<void>;
  pause(): void;
  load(): void;
  removeAttribute(name: string): void;
  addEventListener(type: 'error', callback: () => void): void;
  removeEventListener(type: 'error', callback: () => void): void;
}

/** Optional audio layer: no render-loop decoding, external libraries or game-state writes. */
export class BgmPlayer {
  settings: AudioSettings;
  status: BgmStatus = 'idle';
  track: BgmTrack | null = null;
  private media: BgmMedia | null = null;
  private pending: object | null = null;
  private hidden = false;
  private disposed = false;
  private createMedia: (src: string) => BgmMedia;

  constructor(
    settings = DEFAULT_AUDIO_SETTINGS,
    createMedia: (src: string) => BgmMedia = (src) => new Audio(src),
  ) {
    this.settings = normalizeAudioSettings(settings);
    this.createMedia = createMedia;
  }

  setTrack(track: BgmTrack | null): void {
    if (this.disposed) return;
    if (this.track?.src !== track?.src) {
      this.releaseMedia();
      this.track = track;
      this.status = 'idle';
    }
    this.reconcile();
  }

  configure(settings: Partial<AudioSettings>): void {
    if (this.disposed) return;
    this.settings = normalizeAudioSettings({ ...this.settings, ...settings });
    this.reconcile();
  }

  setHidden(hidden: boolean): void {
    if (this.hidden === hidden || this.disposed) return;
    this.hidden = hidden;
    this.reconcile();
  }

  resumeFromGesture(): void {
    if (this.disposed) return;
    if (this.status === 'blocked') this.status = 'idle';
    this.reconcile();
  }

  retry(): void {
    if (this.disposed) return;
    this.releaseMedia();
    this.status = 'idle';
    this.reconcile();
  }

  private mediaError = (): void => {
    this.pending = null;
    this.media?.pause();
    this.status = 'error';
  };

  private reconcile(): void {
    if (this.disposed) return;
    if (!this.track) {
      this.status = 'idle';
      return;
    }
    if (this.media) this.media.volume = this.settings.bgmVolume;
    if (this.hidden || this.settings.muted || this.settings.bgmVolume === 0) {
      // Preserve playback position on mute/tab hiding, reset only when leaving the map.
      this.pending = null;
      this.media?.pause();
      this.status = this.hidden ? 'paused' : 'muted';
      return;
    }
    if (
      this.pending ||
      this.status === 'playing' ||
      this.status === 'blocked' ||
      this.status === 'error'
    )
      return;
    try {
      if (!this.media) {
        this.media = this.createMedia(this.track.src);
        this.media.loop = true;
        this.media.preload = 'none';
        this.media.addEventListener('error', this.mediaError);
      }
      const media = this.media;
      media.volume = this.settings.bgmVolume;
      const request = {};
      this.pending = request;
      this.status = 'loading';
      void media
        .play()
        .then(() => {
          if (this.pending !== request) {
            // A late play resolution must not revive music after teleport/dispose/mute.
            if (
              this.media !== media ||
              (!this.pending && this.status !== 'playing')
            )
              media.pause();
            return;
          }
          this.pending = null;
          this.status = 'playing';
        })
        .catch((error: unknown) => {
          if (this.pending !== request) return;
          this.pending = null;
          this.status =
            error &&
            typeof error === 'object' &&
            'name' in error &&
            error.name === 'NotAllowedError'
              ? 'blocked'
              : 'error';
        });
    } catch {
      this.pending = null;
      this.status = 'error';
    }
  }

  private releaseMedia(): void {
    this.pending = null;
    if (!this.media) return;
    this.media.removeEventListener('error', this.mediaError);
    this.media.pause();
    this.media.removeAttribute('src');
    this.media.load();
    this.media = null;
  }

  dispose(): void {
    this.disposed = true;
    this.releaseMedia();
    this.track = null;
    this.status = 'idle';
  }
}
