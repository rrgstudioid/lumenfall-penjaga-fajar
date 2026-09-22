# REPORT B — Phase 2D Technical Report

Tanggal: 19 September 2026. Scope: runtime foundation, compatibility, tests, dan laporan. Tidak ada content/job activation atau deploy.

## 1. Files audited / runtime before changes

Audit berpusat pada `lib/game/world.ts`: canvas pointer listeners, `pointerdown`, `pointermove`, `tryNpcInteraction`, `targetNearest`, `attack`, `nova`, `findSkillTarget`, `castSkill`, `applySkill`, `makeEnemy`, `hurtEnemy`, `updateEnemy`, `changeRegion`, `selectCharacter`, `returnToMainMenu`, `hurtHero`, `dispose`, `snapshot`, `labelHost`, dan lifecycle skill queue.

Dependencies yang ditinjau: `skills.ts`, `skill-action.ts`, `rules.ts`, `combat-modifiers.ts`, `combat-transient.ts`, `combat-status.ts`, `stagger.ts`, `combat-power.ts`, `combat-power-config.ts`, `combat-mechanics.ts`, serta regression suite. UI/input consumers: `app/page.tsx`, `app/globals.css`, `components/game/primary-hotbar.tsx`, `components/game/inventory-grid.tsx`, dan browser harness existing.

Temuan sebelum perubahan:

- Three Raycaster dan normalized pointer sudah ada; NPC memakai picking existing.
- Klik kiri langsung mengaktifkan `attacking` dan memanggil basic attack. Hold dapat mengulang attack di tick.
- Basic attack mempunyai auto-facing nearest dan sweep existing; skill memakai nearest enemy dalam range.
- Belum ada satu authoritative selected enemy, panel target, atau selection ring khusus.
- Enemy punya numeric ID, Group UUID, respawn key/deadline; object enemy dapat dipakai ulang ketika respawn.
- World sudah memiliki region build token, simulation clock, queue hit dan cleanup terpusat.
- Nameplate/HP existing dan overlay label host bisa digunakan tanpa rewrite UI.
- ESC sudah memiliki fungsi menu/panel. Tidak diubah.

## 2. Files changed / added

Daftar ini hanya perubahan Phase 2D, bukan seluruh dirty worktree dari phase sebelumnya.

| File | Perubahan |
|---|---|
| `lib/game/targeting.ts` — baru | Identity, validity, target classification, horizontal distance, ActionLock |
| `lib/game/target-presentation.ts` — baru | Reusable selection ring dan DOM target frame |
| `lib/game/world.ts` | Target state/index, picking, input, cast/basic/dash/arc integration, cleanup |
| `lib/game/skills.ts` | Optional lock/movement/composition metadata; tidak menambah skill registry |
| `lib/game/skill-action.ts` | Resolved target identity, lock defaults, V2 composition context |
| `lib/game/rules.ts` | Mengirim architecture V2 ke resolver yang sama |
| `lib/game/combat-modifiers.ts` | Additive normal bucket, explicit payoff layer, target recent-break condition |
| `lib/game/stagger.ts` | Pure recent-break predicate |
| `lib/game/combat-power.ts` | Architecture-aware cache, V2 self-action semantics dan per-action lock rate ceiling |
| `lib/game/combat-power-config.ts` | Cache calculation version 5 → 6; tidak mengubah balance constants |
| `app/globals.css` | Target-frame styling |
| `lib/game/phase-2d.test.ts` — baru | 6 pure/presentation tests |
| `lib/game/skill-runtime-v2.test.ts` | 15 additional runtime tests; update fixture registration |
| `tests/browser/hard-target.html`, `hard-target.ts` — baru | Isolated visual fixture, production methods/presentation, no save access |
| Dua laporan Phase 2D di `docs/` | Owner summary dan laporan ini |

## 3. Picking implementation

Menggunakan `this.raycaster` dan `this.pointer` existing. Saat spawn, body pertama enemy diukur dengan Three Box3; ukuran minimal x/z 0,9, y 1,5 unit, lalu padding x/z 0,15 dan y 0,1. Jika body tidak tersedia, fallback bounds x/z ±0,6, y 0–2,4. Bounds disimpan local relatif posisi Group, lalu ditransformasi matrixWorld saat klik.

Ray memilih bounds hidup/visible di scene yang paling dekat sepanjang ray kamera, bukan musuh terdekat terhadap pemain. Tidak membuat mesh collider transparan yang memenuhi layar. Ring dikecualikan dari raycast dan tidak masuk body bounds.

Scan O(N) hanya pada klik. Pemeliharaan target memakai direct Map lookup O(1). Body geometry dihitung saat registration, bukan setiap frame. Picking belum mempunyai occlusion terhadap terrain/dekorasi, dan bounds bukan skeletal hitbox presisi. NPC interaction tetap mendapat prioritas existing.

## 4. CurrentTarget state

Authoritative state berada di World/Game, bukan Hero/save:

```ts
currentTarget: Readonly<{
  id: number;
  instanceId: string; // Three Group UUID
  generation: number; // increment on respawn / unregister
  regionToken: number;
}> | null
```

`targetEntities: Map<number, Enemy>` adalah index lookup, bukan target state kedua. `getCurrentTarget`, `setCurrentTarget`, `clearCurrentTarget`, `isCurrentTargetValid`, `validateCurrentTarget`, `resolveCurrentTarget`, dan `getCastTarget` berbagi validation helper.

Valid berarti HP > 0, visible, parent masih scene aktif, UUID/generation/token cocok. `TargetIdentity` dibuat frozen. Tidak menambah field permanen pada save.

## 5. Lifecycle / cleanup

- Damage membarui target UI segera; HP nol membuat target clear sebelum proses death berikutnya.
- Selected Group memiliki satu listener `removed`, dilepas saat clear/switch/dispose.
- `unregisterTargetEnemy` menghapus index dan meningkatkan generation. Register ulang object yang sama tidak menghidupkan cast snapshot lama.
- Respawn meningkatkan generation; tidak melakukan reselection.
- `clearSkillRuntime` membersihkan target dan action lock bersama queue/transient state existing.
- Jalur region change, character selection, menu, player death, dan world disposal memakai cleanup tersebut.
- Region/character/disposal juga membersihkan index. Region token menolak identity dari dunia lama.
- Future individual despawn harus menggunakan unregister helper; `enemies.splice()` saja bukan kontrak lifecycle yang aman.
- Ring dipindahkan antar-parent, frame dipakai ulang. Dispose melepas geometry/material, DOM frame, selected listener; canvas listener existing tetap dibersihkan oleh `dispose`.

Tidak ada polling world-wide untuk mencari target pengganti. Target lama tidak diteruskan ke save atau respawn instance baru.

## 6. Click behavior / UI conflict

Untuk `v2_test`, canvas `pointerdown` memanggil handler selection. Unselected → select only; same selected → existing `attack()`; other enemy → switch only; empty → clear. `attacking=false` pada jalur ini mencegah first-click/hold accidental attack.

Handler hanya menerima event yang target-nya canvas renderer dan belum `defaultPrevented`. Existing paused/dead/hotbar-interaction checks tetap aktif. DOM panel/hotbar/inventory bukan canvas children; target frame mempunyai `pointer-events:auto`. Klik frame tidak meneruskan input ke world. Tidak menambah listener global pemilih target.

Legacy tetap memakai old click/hold attack. Right mouse camera behavior tidak diubah. Tidak menambah tombol serang alternatif, TAB atau clear hotkey. ESC tetap existing.

## 7. Basic attack resolver

V2 memvalidasi selected enemy sebelum mengurangi ammo, mengubah attack timer atau menjalankan damage. Horizontal range tetap berdasarkan existing combatProfile; bow memakai existing minimum range 11, boss melee existing 4,3. Tidak mengubah angka tersebut. Hanya selected enemy masuk jalur damage V2; musuh lebih dekat diabaikan.

Setelah valid, actor menghadap sekali. Existing damage, crit, combo, attack speed, cooldown, mitigation, arrow handling tetap digunakan. `targetNearest` langsung return pada V2. Legacy sweep/nearest tetap berlaku pada jalur legacy.

## 8. Skill target resolver / classification

Tidak membuat enum targeting kedua di registry. `targetRequirement` menginterpretasi existing metadata:

| Existing metadata | Semantics V2 |
|---|---|
| `targetType: self` | Self, no selected target |
| `targetType: area` | Area around self, no selected target |
| `targetType: frontal_arc` | Arc from cast-start facing, no selected target required |
| `effect: dash_damage` pada enemy-target action | Dash to current target |
| Other enemy-target types, termasuk single | Current target required |

Placeholder legacy `line` tidak menjadi true line raycast; pada V2 diperlakukan sebagai selected-enemy action. Tidak ada mass migration definisi existing.

`castSkill` melakukan structural/weapon validation, rank/modifier preview, target/range validation, lalu resolve contextual action, pembayaran Mana sekali, commit counter/windows, cooldown dan execution. Target failure terjadi sebelum pembayaran/consumption. Target-derived conditions dievaluasi pada enemy cast, bukan nearest.

## 9. Failure reasons

`NO_TARGET`, `TARGET_INVALID`, `TARGET_OUT_OF_RANGE`, dan `ACTION_LOCKED` tersedia lewat `lastActionFailure` dengan pesan player yang sesuai. Target invalid dibersihkan; out-of-range tetap dipilih. Bila lifecycle sudah membersihkan target sebelum command berikutnya, reason wajar menjadi `NO_TARGET`.

Tidak ada auto-approach, auto-switch atau nearest fallback. Mana insufficiency, weapon restriction, cooldown dan existing validation tetap memberi reason existing.

## 10. Cast snapshot / multi-hit

Setelah cast valid, resolved action menyimpan `targetIdentity` dari pilihan saat cast start. Execution mengambil entity dari identity tersebut dan queue mempertahankan target asal. Mengganti currentTarget tidak mengganti identity milik cast.

Per-hit validation mempertahankan existing started/dead/disposed/build-token/enemy-alive/respawn guards, ditambah snapshot identity check untuk V2. Targeted cast memakai identity pilihan; area/arc menyimpan identity masing-masing enemy yang masuk hasil area saat cast. Mati, unregister, replaced UUID, generation berubah atau world invalid → hit tersisa tidak berjalan. Target baru hanya dipakai cast baru.

CounterContext tetap terpisah. Incoming block/parry tidak memilih attacker. Armor break/stagger/recent-break predicate membaca target cast yang sedang dieksekusi.

## 11. Frontal arc facing

Tanpa selected target, current direction dipakai. Dengan target valid, `faceTarget` menulis actor direction/rotation sekali setelah cast diterima. Daftar target arc dihitung memakai existing horizontal distance dan dot/angle helper Phase 1A. Selection saja tidak mengubah arah; tidak ada continuous tracking atau kamera lock.

## 12. Dash targeting

Dash menggunakan selected target snapshot dan existing `move`/collision path. No-target/out-of-range menolak tanpa bergerak. Jarak langkah existing masih `min(4, skill.range)` sepanjang arah ke target; ini bukan pathfinding/auto-approach baru atau jaminan berhenti tepat di tepi collider target. Penyempurnaan stopping-distance bila dibutuhkan Iron Charge dibahas saat konten/feel skill, tidak diam-diam diubah di foundation ini.

## 13. Target UI

`TargetPresentation` memiliki satu RingGeometry 48 segments, gold material, dan satu DOM frame di existing labelHost. Frame menampilkan nama, optional level, native progress HP dan current/max angka. Update immediate saat damage; update selected target O(1) pada simulation tick untuk perubahan lain. Payload snapshot optional `currentTarget` juga tersedia untuk consumer UI berikutnya.

Frame disembunyikan pada clear, dilepas pada dispose. Ring dilepas dari parent lama sebelum berpindah. JSON view cache menghindari penulisan text DOM yang identik. Tidak mengganti nameplate, model monster atau boss UI.

## 14. Recent stagger break

`recentStaggerBreakWithin(target, windowSeconds, now)` membaca `target.staggerState.lastBreak.timestamp` dalam simulation seconds. Timestamp 0 valid. Valid bila `0 <= now - timestamp <= windowSeconds`, dengan finite-value checks. Gunakan window 1,5 sesuai future design.

Condition modifier optional `recentStaggerBreakWithin` memakai helper yang sama saat actual impact. Status `staggered` boleh sudah berakhir; predicate tidak memperpanjang CC. Target lain tanpa lastBreak tidak mendapat bonus. Tidak mengubah threshold, recovery, resistance, atau stagger damage balance.

## 15. Action lock

Optional `actionLockDuration` dan `movementAllowedDuringLock` berada pada definition/resolved action. Default duration 0; movement default true. Lock mulai hanya pada cast V2 yang diterima, setelah Mana berhasil dibayar, memakai simulation time. Pause membekukan clock sebagaimana existing hit queue.

Saat lock aktif, `castSkill`, basic `attack`, dan convenience active `nova` ditolak. `moveVector` menghasilkan zero hanya bila movement disallowed. Skill dash sendiri tetap boleh menjalankan displacement aksinya; movement lock berarti input gerak pemain. Cleanup world menghapus lock.

Tidak menggandakan lock dengan animation duration, tidak membuat GCD/channel/cancel/buffer. Legacy tanpa property tetap berperilaku lama. Phase ini memang opt-in di jalur V2; tidak mengaktifkan lock pada skill legacy production.

## 16. Modifier composition / CP

V2 resolver menggunakan `modifierComposition: scoped_additive`. Legacy memakai product behavior lama. Modifier normal adalah default; payoff harus eksplisit `layer: payoff`.

```text
Raw = baseDamage + PhysicalAttack*physicalCoefficient
      + MagicAttack*magicCoefficient + SkillPower*skillPowerCoefficient
NormalFactor = max(0, 1 + sum(normal scoped damagePercent)/100)
PayoffFactor = product(max(0, 1 + payoff damagePercent/100))
Damage = Raw * existing rank/mastery/equipment/SkillDamage factor
         * NormalFactor * PayoffFactor
→ existing critical / effect stages / mitigation / HP
```

Counter payoff mengalikan total Raw, bukan ditambahkan ke physicalCoefficient. Contoh fixture +4,5%, +4%, +10% menjadi 1,185; payoff +55% menjadi pengali terpisah 1,55. Tidak ada angka ini yang masuk production skill content.

Normal modifier target-conditional memakai bucket yang sama dengan normal modifier cast-start. Base/normal/payoff provenance dibawa oleh resolved hit sehingga delayed target condition tidak membuat perkalian normal bucket kedua atau memodifikasi registry. Stagger dan knockback mempunyai channel terpisah. Generic final-stat `Skill Damage` dan legacy equipment/mastery stage tidak direbalance.

Runtime dan CP tetap memakai resolved action/hit dan target modifier helper yang sama. Cache CP memasukkan progressionArchitecture agar hasil V2/legacy tidak tertukar. V2 self actions tidak mendapat offensive enemy-hit rating. Per-action rate dibatasi `1 / max(minimumCooldown, cooldown, actionLockDuration)` untuk V2. Shared rotation occupancy antar-skill/basic tidak disimulasikan; dilaporkan limited.

CP tidak mensimulasikan posisi/klik pemain, peluang counter atau recent-break window. Tidak ada lastBreak benchmark yang dikarang; conditional effects tersebut tetap dilaporkan unsupported/limited, bukan bonus palsu. Single-target expected damage dan mitigation formulas tidak diganti.

## 17. Legacy / save / Stamina compatibility

Semua target behavior baru dibatasi oleh `usesHardTargeting(hero)` untuk `v2_test`. Tidak mengganti legacy save, ID job, skillLevels, SP, stat allocation atau progression. Current target, entity index, lock dan generation berada pada world/actor runtime, bukan permanent Hero save.

Tidak mengubah no-Stamina policy Phase 2C. Targeting dan lock tidak membaca atau membayar Stamina. Mana/cooldown tetap skill resource. Test Phase 2C dash pada Stamina 0 kini memilih target fixture terlebih dahulu; assertion Mana, cooldown, Stamina dan insufficient Mana dipertahankan. Ini adaptasi prasyarat targeting baru, bukan penghapusan coverage.

## 18. Tests added (21)

Enam tests di `phase-2d.test.ts`:

1. Recent break 1,5 detik, timestamp 0, expiry, target-local, independent CC.
2. Additive V2 normal + explicit total-raw counter payoff; legacy product unchanged; immutable definition.
3. Deferred target normal shares bucket, payoff separate, no mutation, CP no invented recent state.
4. Action lock clock dan classification existing target types.
5. Frozen identity, invalid region/generation/group.
6. Frame HP/name/level updates, single reused ring, hidden clear, disposal material/geometry/DOM.

Lima belas tambahan di `skill-runtime-v2.test.ts` menjalankan real World methods headless:

7. CP V2 self/rate/cache compatibility.
8. Actual canvas handler first/second/switch, UI/defaultPrevented rejection.
9. Actual player death dan return-to-menu cleanup.
10. Selection/switch/second attack/empty, no auto replacement.
11. Basic no-target/range/dead rejects, ignores closer target, no timer spend.
12. Removal/unregister/replacement/respawn generation/region token validity.
13. Single skill target/range validation before Mana/cooldown/counter consume.
14. Self/circle/arc without target; arc faces once, no camera mutation.
15. Dash selected target rather than nearer enemy; no-target no movement.
16. Three-hit A snapshot remains A after selection B; new cast B.
17. Killed original target cancels remaining hits, no redirect, immediate clear.
18. Unregister/re-register same object cannot resurrect old cast snapshot, untuk single dan area.
19. Lock skill/basic/movement true/false/expiry; legacy no lock preserved.
20. Target-condition original cast enemy; incoming attack does not retaliate/select.
21. Actual Three ray/bounds picking selects clicked enemy, ignores dead/removed.

Browser fixture, bukan tambahan Node test count: rendered A/B, first click A=1000HP, second=970HP; switch B=1000HP/ring count1; target-frame click retains B; empty clears; despawn clears. Tidak ada error/warn console tercatat. Browser tab dan test server ditutup setelah pengujian; tidak membaca/menulis save. Visual fixture memakai production targeting/presentation tetapi bukan full-map gameplay/AI. Semua map transition tidak dimainkan manual; lifecycle integration diaudit dan shared cleanup/token paths diuji headless.

## 19. Full regression result

Baseline sebelum Phase 2D: 357 passed, 0 failed. Final: **378 passed, 0 failed, 0 skipped**, seluruh `lib/game/*.test.ts`. Phase 0/1A/1B/2B/2C tests tetap termasuk. Tidak menghapus test/coverage. Focused lint modules baru/terkait dan browser fixture exit0. `git diff --check` tidak menemukan whitespace error.

## 20. Production build

`node node_modules/vinext/dist/cli.js build` selesai semua lima tahap, exit0. Warning chunk >500kB, plugin timing, dan route classification unknown tetap berupa warning; tidak diklaim build tanpa warning. Tidak ada publish.

## 21. TypeScript before / after

**Before 6, after 6, new 0.** Full `tsc --noEmit` masih gagal karena enam issue existing, bukan clean build typecheck:

- `rules.ts:356–359`: empat string/literal union appearance fallback.
- `ui-layout.ts:64`: property `scale` pada inferred `{x,y}`.
- `tests/browser/real-components.tsx:177`: snapshot fixture missing `cameraMode`.

Tidak ditutupi atau diturunkan coverage-nya agar lulus. Production bundling success berbeda dari typecheck success.

## 22. Remaining blockers / boundaries

Tidak ditemukan blocker yang membutuhkan stop-condition rewrite untuk foundation Warrior V2. Yang masih dibatasi:

- No wall/decor occlusion dalam enemy picking; belum full collision hitbox.
- Target range horizontal, mempertahankan convention combat existing; tidak menambah vertical/line-of-sight requirement.
- Targeted dash mempertahankan existing step/collision behavior; tuning stop distance bukan auto-approach.
- Future despawn/reuse paths wajib mengikuti unregister/generation contract.
- CP shared action occupancy dan probabilitas conditional payoff tidak diberi estimasi spekulatif.
- Full game HUD/map/mobile-layout visual matrix belum diuji; browser check ini isolated fixture.
- Enam TypeScript baseline errors belum diperbaiki oleh task ini.
- No TAB, retaliation targeting, cancel/channel/GCD/full animation machine, resource baru, balance changes atau registration Warrior nodes.

Engine sekarang memiliki foundation selected target, snapshot multi-hit, recent break, action lock dan composition ordering. Warrior Skill Tree V2 belum dibuat/diaktifkan. STOP setelah laporan ini; tunggu task berikutnya.
