# Original male revision 02

`male-revision-02.glb` is an unchanged copy of `work/male-base/lumenfall_male_base.glb`, assetVersion `male-base-02`.
`male-revision-02-dual-sword.glb` keeps the same mesh, materials, rig and sockets, and adds the native Unreal Dual Sword animation clips used by the game.

- Total including original blond hair: 20,394 triangles.
- Excluding hair: 19,134 triangles; hair: 1,260 triangles.
- Original 20-bone rig, sockets and geometry preserved.
- No 100k, HD, or contour-revision mesh is used.

The added clips are `DualSword_Attack_01`, `DualSword_Attack_02`, and `DualSword_Attack_03`, exported from the supplied Unreal project and retargeted onto the original 20-bone Lumenfall skeleton. Each basic-attack click plays one clip; consecutive clicks advance through the three-hit sequence and reset to the first hit after a short pause. The original Lumenfall procedural idle pose remains active when stopped, while the supplied `Walk` and `Run` clips drive a more grounded in-place gait during movement. Lumenfall scales the visual to the previous player height and rotates authored +Z forward to game -Z. Equipment follows the actual hand/limb anchors; the actor's gameplay position and hitbox are unchanged. Assets are cloned per actor for safe world/preview disposal. The old procedural character remains the loading/error fallback, while non-dual-sword actions keep their existing gameplay behavior. No character stats, saves, enhancement thresholds or camera settings are changed.
