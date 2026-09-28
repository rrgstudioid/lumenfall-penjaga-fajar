/** Independent UI owners must never release another owner's input lock. */
export class UIInputBlockers {
  private owners = new Set<string>();
  set(owner: string, blocked: boolean) {
    if (blocked) this.owners.add(owner);
    else this.owners.delete(owner);
  }
  get blocked() {
    return this.owners.size > 0;
  }
  has(owner: string) {
    return this.owners.has(owner);
  }
}
export function isEditableTarget(target: EventTarget | null): boolean {
  return (
    typeof HTMLElement !== 'undefined' &&
    target instanceof HTMLElement &&
    !!target.closest(
      'input,textarea,select,[contenteditable="true"],[contenteditable="plaintext-only"]',
    )
  );
}
