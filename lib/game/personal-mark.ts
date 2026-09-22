/** Source-aware runtime marks. Never serialized, never overwrite legacy marked/status timers. */
export type MarkSource = Readonly<{
  sourceActorId: string;
  sourceGeneration: number;
}>;
export type PersonalMark = MarkSource & {
  sourceSkillId: string;
  remaining: number;
};
type Entry = { target: object; mark: PersonalMark; valid: () => boolean };
const marks = new WeakMap<object, Map<string, Entry>>();
const key = (source: MarkSource) =>
  JSON.stringify([source.sourceActorId, source.sourceGeneration]);
export function personalMark(target: object, source: MarkSource) {
  const entry = marks.get(target)?.get(key(source));
  return entry && entry.mark.remaining > 0 && entry.valid()
    ? entry.mark
    : undefined;
}
export const markedBy = (target: object, source: MarkSource) =>
  !!personalMark(target, source);
export const markedBySelf = markedBy;
export class PersonalMarks {
  private entries = new Map<string, Entry>();
  apply(
    target: object,
    source: MarkSource,
    sourceSkillId: string,
    duration: number,
    valid: () => boolean = () => true,
  ) {
    if (!Number.isFinite(duration) || duration <= 0 || !valid()) return false;
    this.clearSource(source);
    const entry = {
      target,
      mark: { ...source, sourceSkillId, remaining: duration },
      valid,
    };
    const bucket = marks.get(target) ?? new Map<string, Entry>();
    bucket.set(key(source), entry);
    marks.set(target, bucket);
    this.entries.set(key(source), entry);
    return true;
  }
  clearSource(source: MarkSource) {
    const id = key(source),
      entry = this.entries.get(id);
    if (entry && marks.get(entry.target)?.get(id) === entry)
      marks.get(entry.target)!.delete(id);
    this.entries.delete(id);
  }
  update(dt: number) {
    if (!Number.isFinite(dt) || dt < 0) return;
    for (const entry of this.entries.values()) {
      entry.mark.remaining -= dt;
      if (entry.mark.remaining <= 0 || !entry.valid())
        this.clearSource(entry.mark);
    }
  }
  clear() {
    for (const entry of this.entries.values()) this.clearSource(entry.mark);
  }
}
