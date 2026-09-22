import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { spawnSync } from 'node:child_process';

// Writes derived development metadata only. Source archives are read for hashes.
const root = process.cwd();
const stage = 'dev-assets/kingdom-city-pilot-a3';
const read = name => JSON.parse(fs.readFileSync(path.join(root, name), 'utf8'));
const write = (name, value) => {
  const dest = path.resolve(root, name);
  if (!dest.startsWith(root + path.sep)) throw Error('Output outside workspace');
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.writeFileSync(dest, typeof value === 'string' ? value : JSON.stringify(value, null, 2) + '\n');
};
const manifest = read(stage + '/manifest.json');
const audit = read(stage + '/evidence/model-audit.json');
const browser = read(stage + '/evidence/browser-result.json');
if (Object.values(browser.checks).some(x => !x) || browser.errors.length || browser.failed.length)
  throw Error('Browser gate failed; do not finalize as validated');
const families = [...new Set(audit.materialBindings.map(x => x.family))];
if (families.length !== 6) throw Error('Six controlled material examples required');

const hashes = manifest.sourceHashes.map(h => {
  const finalHash = crypto.createHash('sha256').update(fs.readFileSync(h.path)).digest('hex');
  return { ...h, sha256Final: finalHash, unchanged: finalHash === h.sha256Before };
});
if (hashes.some(h => !h.unchanged)) throw Error('Source hash changed');
const measured = id => audit.models.find(x => x.id === id);
const assets = manifest.assets.map(a => {
  const model = measured(a.id);
  const nature = a.id.startsWith('env_package_');
  const blockers = [];
  if (a.licenseStatus !== 'LICENSE_OK') blockers.push('LICENSE_UNKNOWN');
  if (nature) blockers.push('HIGH_POLY_REPEATED_USE_NOT_APPROVED');
  if (a.id.includes('tree')) blockers.push('DERIVED_FOLIAGE_LOD_NEEDS_ART_REVIEW');
  if (a.id.includes('boulder')) blockers.push('CONSERVATIVE_BOX_NOT_FINAL_CONVEX_COLLISION');
  if (model.degenerate) blockers.push('TWO_SOURCE_DEGENERATE_TRIANGLES_RETAINED');
  if (/roof|wall|corner|frame/.test(a.id)) blockers.push('SIMPLIFIED_LOD_HOLD_USE_SOURCE_LOD0');
  return {
    ...a, status: 'TECH_VALIDATED', productionReadyCandidate: false,
    validationScope: 'Local load, source-material rendering, geometry inspection, uniform pack scale and documented collision policy; not production certification',
    blockers, performanceClass: nature ? 'HEAVY' : model.triangles > 2000 ? 'MEDIUM' : 'LIGHT',
    measurements: model,
    pivotPolicy: /barrel|crate|bench|banner|boulder/.test(a.id)
      ? 'source hierarchy intact; runtime wrapper offsets bbox minimum Y to ground'
      : a.id.includes('lantern') ? 'source mounting pivot; wall-mounted wrapper' : 'source pivot preserved',
    collisionPolicy: a.id.includes('tree') ? 'sampled lower trunk cylinder'
      : a.id.includes('boulder') ? 'conservative AABB; refinement pending'
      : /stairs|floor/.test(a.id) ? 'ImportedMapGround floor/ramp; source landing'
      : /wall|doorframe|corner/.test(a.id) ? 'composed wall/jamb/lintel boxes; no automatic per-mesh collision'
      : 'none (decorative/roof/small prop)',
  };
});
const scale = {
  schemaVersion: 1, status: 'PILOT_CALIBRATED_NOT_GLOBAL_CONTENT_MIGRATION',
  units: 'LUMENFALL world units; no independent real-world metre calibration implied',
  character: { ...manifest.character, observed: browser.initial.character, capsuleRadius: .45 },
  packFactors: { Medieval_Village_MegaKit: 1.5, Fantasy_Props_MegaKit: 1.5, tree_small_02_2k: 1, boulder_01_2k: 1 },
  basis: '1.5 is an authored pilot pack calibration against the actual 2.4-unit character and sampled gate clearance; BLEND nature uses METRIC unit_scale=1 and exporter axis conversion. No individual scale correction.',
  sourceScaleConsistency: 'No unrelated per-object scale factors required; oversized decorative roof and long bench are authored proportions, not corrected silently',
  measured: {
    doorwayFrameHeight: measured('env_model_doorframe_round_brick').dimensions[1],
    testedDoorClearance: { width: audit.aperture.width, height: 2.6, note: 'sampled central clear rectangle, not full arch height; actual WASD traversal passed' },
    wallDimensions: measured('env_model_wall_plaster_straight').dimensions,
    floorSlabThickness: measured('env_model_floor_brick').dimensions[1],
    houseWallFootprint: [6, 6], houseStoreyHeight: 4.5,
    houseRoofFootprint: [measured('env_model_roof_tower_roundtiles').dimensions[0], measured('env_model_roof_tower_roundtiles').dimensions[2]],
    houseOverallHeight: 4.5 + measured('env_model_roof_tower_roundtiles').bounds.max[1],
    towerWallFootprint: [6, 6], towerBodyHeight: 9,
    towerOverallHeight: 9 + measured('env_model_roof_tower_roundtiles').bounds.max[1],
    stairs: audit.stairs,
  },
  designReferences: {
    normalDoor: { width: 1.65, minimumClearHeight: 2.6, state: 'tested pilot' },
    largeGate: { width: 3, minimumClearHeight: 4.8, state: 'future design recommendation, not built/tested' },
    houseStorey: { height: 4.5, state: 'pilot assembly' },
    mainRoadWidth: { value: 6, state: 'pilot neutral street; final city traffic not tested' },
    alleyWidth: { value: 3, state: 'proposed 3-unit module, not traversal stress-tested' },
    cityWall: { value: 4.687, state: 'pilot visual wall height only, not finalized defensible city wall' },
    defensiveTower: { bodyHeight: 9, state: 'pilot two-storey composition; tall roof not a final fortification asset' },
  },
};
const collision = {
  schemaVersion: 1, devOnly: true, source: 'tests/browser/kingdom-pilot-scene.ts',
  boxes: audit.boxes, trunk: audit.trunk, stairs: audit.stairs,
  checks: browser.checks, walks: browser.walks.map(x => ({name:x.name,start:x.start,end:x.position})), camera: browser.camera,
  limitations: ['Rock AABB is conservative at corners, not a fitted convex hull', 'Camera probe covers authored boxes, not every roof/foliage triangle', 'No furniture collision', 'Small pilot only; no large-city navigation or crowd proof'],
};
const materials = {
  schemaVersion: 1, defaultPolicy: 'KEEP_SOURCE_MATERIAL',
  examples: manifest.materialExamples, bindings: audit.materialBindings,
  decision: 'Remap examples are local technical proofs, not final art approval. Source trim-atlas UVs retained; texel density/seams need authored UV or trim-compatible remap.',
  texturePolicy: { architectureProps: 'derived 1K PNG maps, shared by pack', nature: '2K staged maps', examples: '1K RGB PNG; EXR normal/roughness/metal data decoded as Non-Color', future: 'Evaluate KTX2 and per-material memory budget before city scale. Do not copy all source maps.' },
  resourceEstimate: browser.benchmarks[0].resources,
};
const tsc = spawnSync(process.execPath, ['node_modules/typescript/bin/tsc', '--noEmit', '--pretty', 'false', '--incremental', 'false'], {cwd:root,encoding:'utf8',maxBuffer:20*1024*1024});
write(stage + '/evidence/typescript-after.log', (tsc.stdout || '') + (tsc.stderr || ''));
const diagnostics = (tsc.stdout || '').split(/\r?\n/).filter(x=>x.includes('error TS'));
const primary = diagnostics.filter(x=>/^lib\/game\//.test(x));
const newFiles = diagnostics.filter(x=>x.includes('kingdom-pilot'));
const build = spawnSync(process.execPath, ['node_modules/vite/bin/vite.js','build','--config','tests/browser/kingdom-pilot.vite.config.ts'], {cwd:root,encoding:'utf8',maxBuffer:10*1024*1024});
write(stage + '/evidence/build.log', (build.stdout || '') + (build.stderr || ''));
const checks = {
  browser: { headed:browser.headed, version:browser.browser, checks:browser.checks, errors:browser.errors, warnings:browser.warnings, failed:browser.failed },
  typescript: { observedPrimaryBefore:5, primaryAfter:primary.length, primaryDiagnostics:primary, newPilotDiagnostics:newFiles, fullWorkspaceDiagnosticCount:diagnostics.length, note:'Prior historical six-error claim is not substituted for current baseline. Other existing old dev/output trees included in whole-workspace diagnostics.' },
  isolatedBuild: { exitCode:build.status, note:'DEV guard produces production rejection stub; assets excluded (copyPublicDir=false). Not a full gameplay production build.' },
  fullGameRegression: 'NOT_RUN; no production game code changes in A3',
};
if (newFiles.length || build.status !== 0) throw Error('New pilot diagnostics or build failure; inspect evidence logs');
const allFiles = fs.readdirSync(path.join(root,stage),{recursive:true,withFileTypes:true}).filter(x=>x.isFile());
const diskBytes = allFiles.reduce((n,x)=>n+fs.statSync(path.join(x.parentPath ?? x.path,x.name)).size,0);
const output = {
  schemaVersion:1, phase:'A3', devOnly:true, generatedAt:new Date().toISOString(),
  sourceRoot:manifest.sourceRoot, style:'STYLE_A_MEDIEVAL_VILLAGE_MODULAR',
  status:'TECH_VALIDATED_WITH_EXPLICIT_PRODUCTION_HOLDS',
  productionReadyCandidateCount:0, assetCount:assets.length, assets,
  scaleStandard:'data/assets/lumenfall-scale-standard-a3.json', collision:'data/assets/kingdom-city-pilot-collision-a3.json', materials:'data/assets/kingdom-city-pilot-materials-a3.json',
  sourceHashes:hashes, licenseRecords:manifest.licenseRecords, benchmarks:browser.benchmarks, verification:checks,
  stagingBytesAtAudit:diskBytes, stagingIncludes:'selected source copies, derivatives, LODs, evidence and local build; not production payload',
  sourceVaultUntouched:hashes.every(x=>x.unchanged), productionMapsChanged:false, published:false,
  evidenceDirectory:stage+'/evidence',
};
write('data/assets/kingdom-city-pilot-a3.json',output);
write('data/assets/lumenfall-scale-standard-a3.json',scale);
write('data/assets/kingdom-city-pilot-collision-a3.json',collision);
write('data/assets/kingdom-city-pilot-materials-a3.json',materials);
write(stage+'/evidence/final-verification.json',checks);

const f=n=>Number(n).toFixed(2);
const assetRows=assets.map(a=>`| ${a.id} | ${a.pack ?? 'nature BLEND'} | ${a.scale} | ${a.measurements.triangles.toLocaleString('en-US')} | ${a.measurements.dimensions.map(f).join(' × ')} | ${a.licenseStatus} |`).join('\n');
const perfRows=browser.benchmarks.map(b=>`| LOD${b.lod} / ${b.mode} | ${f(b.fps)} | ${b.drawCalls} | ${b.triangles.toLocaleString('en-US')} | ${f(b.p95FrameMs)} |`).join('\n');
const report = `# LUMENFALL — A3 Kingdom City Production-Readiness Pilot

## Keputusan untuk owner

Pilot lokal selesai: **15 aset TECH_VALIDATED dalam lingkup uji teknis, 0 PRODUCTION_READY_CANDIDATE**. Status ini berarti bisa dimuat, diperiksa, diskalakan konsisten, dan digunakan sesuai kebijakan collision yang dicatat; bukan sertifikat kelayakan seluruh kebutuhan produksi. Kit bangunan/props cukup untuk greybox bertahap. **Kit lengkap belum aman untuk kota besar dengan semua aset detail asli.** Pohon, LOD, lisensi nature/material remap, dan collision batu masih menjadi hold.

Tidak dibangun kota final, NPC, monster, quest, shop, ataupun district. Arunika/Jayantara, terrain prototype, save, balance dan progression tidak diubah. Tidak dipublikasikan. Perubahan kotor lama pada workspace bukan bagian pekerjaan A3.

## 1. Pilihan pilot dan sumber

Gaya dominan STYLE_A_MEDIEVAL_VILLAGE_MODULAR. Medieval Village MegaKit dipakai untuk dinding, doorway/frame, floor, corner, tangga/landing, dan roof cap. Fantasy Props MegaKit memberi lima props: barrel, crate, bench, wall lantern, banner. Nature memakai tree_small_02 dan boulder_01 dari pustaka lokal.

**Tidak ada tower lengkap yang dipaksakan:** tower disusun dua storey dari modul dinding dan roof cap. Rumah adalah komposisi satu storey dengan roof cap yang sama, bukan castle shell. Ukuran roof yang tinggi adalah proporsi sumber; belum disetujui sebagai rumah umum/menara pertahanan final.

| Asset ID | Pack | Faktor | Triangles LOD0 | Dimensi X×Y×Z, unit game | Lisensi |
|---|---|---:|---:|---|---|
${assetRows}

Referensi arsip dan entry persis, hierarki, pivot, material slots, texture dependencies, batas model dan blocker per-ID ada di [catalog A3](../data/assets/kingdom-city-pilot-a3.json). Catalog A3 adalah overlay status pilot; tidak mempromosikan seluruh 47 approval A2 atau menghapus audit A1/A2.

## 2. Skala yang dipakai

- Karakter **Astra Hunyuan asli dari Game runtime**, tinggi teramati **2.4 unit**, bukan proxy A2 1.75m. Model karakter dan scale global tidak diubah.
- Medieval Village dan Fantasy Props: **1.5 seragam per pack**. Ini keputusan kalibrasi pilot terhadap karakter/door clearance, bukan klaim metadata sumber membuktikan 1 unit=1 meter.
- Tree dan boulder: **1.0**, metadata BLEND METRIC/unit_scale=1; ekspor glTF mengubah Z-up Blender menjadi Y-up. Tidak ada koreksi skala terpisah per-object.
- Doorframe luar tinggi ${f(scale.measured.doorwayFrameHeight)}; rectangle kosong yang disampling aman **${f(audit.aperture.width)} lebar × 2.60 tinggi**, dibanding avatar2.4. Itu bukan tinggi penuh lengkung pintu.
- Wall **3.00 ×4.69 ×0.61**; floor slab sekitar0.03; storey rumah4.5.
- Footprint badan rumah dan tower6×6; roof overhang ${scale.measured.houseRoofFootprint.map(f).join('×')}. Rumah termasuk roof ${f(scale.measured.houseOverallHeight)} tinggi; tower badan9, total ${f(scale.measured.towerOverallHeight)}.
- Stair flight naik **${f(audit.stairs.rise)}**, run **${f(audit.stairs.run)}**, lebar3. Sampling permukaan horizontal menunjukkan detail anak tangga tidak seragam: ${audit.stairs.horizontalSurfaceHeights.join(', ')}. Selisih kecil termasuk permukaan dekorasi, **bukan semua interval riser**. Riser utama sekitar0.26–0.31; bukan standar konstruksi final. Collision berupa ramp mencapai landing, bukan step solver baru.
- Bench4.17 panjang, lantern2.01 tinggi beserta gantungan, banner3.59 tinggi. Proporsi ini besar/stylized tetapi tidak memerlukan faktor scale berbeda. Tidak ditemukan bukti BAD_SOURCE_SCALE_CONSISTENCY dari subset ini.

Standar awal tercatat di [scale standard](../data/assets/lumenfall-scale-standard-a3.json): normaldoor1.65×2.6 yang telah diuji; usulan largegate3×4.8, jalanutama6, gang3, storey4.5. Largegate/gang dan defensible wall/tower tetap **referensi desain yang perlu diuji**, bukan asset final yang sudah ada.

## 3. Clean model dan material

Seluruh15 model memuat geometry, normals, UV dan materials; tidak ada nonfinite attribute atau index di luar vertex buffer. Batas geometry dan hierarki disimpan, tidak ada missing mesh yang terlihat. Barrel mengandung **2 triangle degenerat sumber**, tidak menyebabkan crash dan sengaja belum dibersihkan. Roof besar adalah geometry sumber, bukan transform liar.

LOD0 geometry tidak dioptimasi. BLEND nature diekspor dari collection sumber yang lengkap. Tekstur grayscale16-bit yang tidak cocok jalur decode diperbaiki hanya pada staging menjadi RGB; image datablock Blender di-remap ke hasil decode sehingga foliage alpha/albedo tidak hilang. Source tidak disentuh.

Enam controlled remap benar-benar tampil: stone_architecture, wood, plaster_brick, roof_tile, metal, fabric_banner. Banner menggunakan slot sumber **MI_Banner**, tidak mengganti material kayu seluruh banner. Semua slot/model tetap memakai UV sumber. Default tetap **KEEP_SOURCE_MATERIAL**; toggle menampilkan REMAP_TO_LUMENFALL sebagai proof teknis. Stone/wood/roof remap kehilangan detail trim-atlas dan memperlihatkan peregangan/perulangan: **belum final art approval**. Perlu UV/trim-compatible treatment dan texel density konsisten. Tidak dilakukan remap massal47 aset.

Tekstur sumber tak ditimpa: architecture/props dan contoh remap diturunkan ke1K PNG; nature tetap2K. Color sRGB; data normal/roughness/metal Non-Color. Material shared, tidak menduplikasi texture per rumah. Rekomendasi produksi: tetapkan budget material, KTX2 bila valid, ukur 1K nature versus2K pada kamera pemain. Belum diimplementasikan massal.

## 4. Collision dan actual WASD

Chrome headed ${browser.browser}, viewport1600×950. Game runtime asli, input WASD asli, player model asli, storage in-memory, enemy0. Collision tambahan di subclass/scene dev saja; tidak mengganti sistem game global.

| Cek | Hasil dan batasan |
|---|---|
| Wall | PASS: karakter berhenti di depan compound box |
| Gate | PASS: menyeberangi doorway tanpa menembus jamb |
| Rumah | PASS: masuk dari doorway dan tertahan sisi belakang |
| Tangga | PASS: naik ke sekitar1.48 lewat ImportedMapGround ramp/landing |
| Pohon | PASS: trunk radius${f(audit.trunk.radius)} memblokir; canopy bukan collider |
| Batu | PASS anti-penetrasi; AABB konservatif, jarak sisi/sudut belum sepresisi hull |
| Kamera | PASS drag kanan dan posisi finite dekat struktur; probe box lokal, roof/canopy belum sepenuhnya covered |

Tidak semua render mesh dijadikan collision. Wall/jamb/lintel: simple volumes; rumah/tower: compound; tree: lower trunk; batu: conservative box sebagai pilot; props kecil: none; walk surfaces: ImportedMapGround. Step sweep0.12 dan radiusavatar0.45 untuk probe box dev. Hasil angka dan volume disimpan di [collision metadata](../data/assets/kingdom-city-pilot-collision-a3.json). Ini belum stress test crowd, interior lengkap, city navigation atau camera roof occlusion.

## 5. LOD: hasil nyata, bukan sekadar file berhasil diekspor

- Source architecture GLTF pilot tidak memberi chain LOD siap pakai. LOD1/2 turunan diuji hanya modul house/wall/tower. SimplifyModifier merusak seam/roof, terlihat lubang/tiles terpisah: **HOLD kedua level architecture**, gunakan originalLOD0. Wall86tri terlalu ringan untuk perlu simplifikasi ini.
- Nature BLEND punya bagian daun bernamaLOD, tetapi itu bukan bukti tiga complete-tree runtime LOD. Tree lengkap sumber **2,062,487tri**. Turunan treeLOD1 **134,817tri**, LOD2 **70,415tri**. Decimation terpisah trunk/branches/leaves mempertahankan batang; uniform decimation awal yang merusak batang tidak dipakai.
- LOD1 tree dapat digunakan untuk eksperimen performa, tetapi canopy berkurang; LOD2 jelas terlalu jarang untuk dekat. **Keduanya perlu art review sebelum produksi**, tidak ditentukan jarak auto-LOD/impostor final.
- Rock66,122tri belum dioptimasi karena di luar scope LOD terbatas. TetapHEAVY untuk pengulangan kota.

## 6. Performance block

Blok uji:10 house assemblies,24 wall standalone,4 towers,20 trees,40 props. Modul wall internal rumah/tower merupakan tambahan di luar24. Bukan layout kota. Pengukuran90 frame sesudah warm-up1.5detik; shadow aktif; browser yang sama. Tidak ada klaim lintas GPU atau minimum hardware.

| Mode | FPS sampel | Draw calls | Rendered triangles/frame | p95 ms |
|---|---:|---:|---:|---:|
${perfRows}

Instancing mengurangi **662→36 draw calls**, tetapi tidak mengurangi triangles. LOD0 tetap sekitar38FPS: bottleneck geometry/foliage, bukan hanya submit calls. LOD1 sekitar60FPS, tetapi itu **bukan persetujuan kualitas visual LOD**. Rendered triangle counters dapat mencakup shadow/material passes, bukan unique source geometry. Frame limit/vsync sekitar60 ikut memengaruhi hasil.

Material switch aktual **belum diinstrumentasi**; dicatat16 material unik,38 texture dan draw calls, tidak menyebutnya jumlahswitch. Perkiraan referenced RGBA8+mip texture **390.67MiB**, bukan VRAM terukur; mengecualikan driver/framebuffer/karakter. PNG kecil di disk tidak berarti hemat VRAM. Seluruh staging terpilih+source-copy+evidence saat audit sekitar${f(diskBytes/1048576)}MiB, bukan production payload.

## 7. Repeated assets dan city chunking — rencana saja

Instance menurut asset+material+LOD **per spatial chunk**, cocok untuk wall, trunk/tree yang telah disederhanakan, rock, barrel, crate, lamp dan banner statis. House/tower tetap prefab modular; part identik dapat dibatch, perubahan pintu/interior unik tetap object biasa. Collision tetap representasi sederhana terpisah, bukan perinstance render raycast.

Usulan awal: spatial cell64–96unit (perlu profil), logical district outer_gate/market/craft/residential/upper_city/castle sebagai manifest kepemilikan, **tidak dibangun sekarang**. Load chunk terlihat dan tetangganya, collider dekat pemain, cull perchunk, material/geometry reference-counted. Jangan satu global InstancedMesh ribuan object karena menghilangkan granularitas culling. Tetapkan budget texture/triangle/draw berdasarkan targethardware dahulu; jangan muat source-copy dan semuaLOD saat produksi seperti alat diagnostik ini.

## 8. Lisensi/provenance dan status

13GLTF architecture/props: **LICENSE_OK berdasarkan teks CC0 1.0 Universal / Quaternius yang disertakan dalam dua ZIP lokal**, hanya cakupan Standard pack yang dipakai. Evidence sourceEntry dan textcopy ada di provenance staging/catalog. Ini audit dokumen lokal, bukan pendapat hukum atau verifikasi chain kepemilikan eksternal.

Tree, boulder, keenam remapmaterial: **LICENSE_UNKNOWN**. Tidak ditemukan bukti lisensi yang memadai di metadata/fileyangdiinspeksi; nama asset/folder tidak dianggap bukti. Localtest boleh berjalan sesuai scope owner, tetapi publikasi/production hold.

Semua15: TECH_VALIDATED dalam lingkup teknis yang disebutkan, masing-masing punya blocker. **Tidak ada asset yang dipromosikan PRODUCTION_READY_CANDIDATE pada fase ini.** Gagal/rejected derivative: architectureLOD1/2; treeLOD2 untuk close view; bukan penghapusan assetasli. Barrel2degenerates dicatat. Unknownlicense tidak disembunyikan oleh statusTECH_VALIDATED.

## 9. Hero gaps dan spesifikasi berikutnya

1. **Palace/castle shell**: custom silhouette, badan/roof/wall/courtyard yang modular pada grid3unit, gatebesar sekurangnya usulan3×4.8 dengan avatar2.4, pivot/snap jelas, shell exterior dan interior opsional terpisah, collision sederhana dan roof-camera test. Jangan upscale cottage ini menjadi palace.
2. **Religious landmark**: silhouette berbeda dari roof village (nave/sanctum/tower atau bentuk original LUMENFALL), ruang masuk minimal normaldoor, materialtrim/UV konsisten, opsiinterior dan collider terpisah. Ukuran footprint ditentukan layout kelak, bukan diinvent pada pilot.
3. **Road/plaza kit**: grid3unit, jalanutama6/gang3 sebagai testreference; straight/corner/T/cross/edge/curb/stair/ramp, sambungan slope dan seam terukur, tiling PBR dan collision ground. Jalan pilot masih primitive netral, bukan kit final.
4. Lengkapi lisensi nature/material, foliageLOD artist-authored, rockhull, camera roof collision, trim-safe remap dan texturebudget sebelum kota besar.

## 10. Evidence dan cara membuka

Viewer: http://127.0.0.1:3006/tests/browser/kingdom-pilot.html (localhostdev saja). Jalankan node node_modules/vite/bin/vite.js --config tests/browser/kingdom-pilot.vite.config.ts jika server berhenti. WASD, dragkanan kamera, pilih titik inspeksi, collisiondebug, remap dan LOD. Tidak membuat save permanen.

| Evidence | File |
|---|---|
| Player–gate | [01-player-gate.png](../${stage}/evidence/01-player-gate.png) |
| House entrance | [02-player-house.png](../${stage}/evidence/02-player-house.png) |
| Wall/tower | [03-wall-tower.png](../${stage}/evidence/03-wall-tower.png) |
| Street | [04-street.png](../${stage}/evidence/04-street.png) |
| Tree/rock | [05-tree-rock.png](../${stage}/evidence/05-tree-rock.png) |
| Collisiondebug | [06-collision.png](../${stage}/evidence/06-collision.png) |
| Remapbuilding | [07-material-remap.png](../${stage}/evidence/07-material-remap.png) |
| Fabric/metal remap | [07b-fabric-metal-remap.png](../${stage}/evidence/07b-fabric-metal-remap.png) |
| Overview | [08-overview.png](../${stage}/evidence/08-overview.png) |
| Walk upstairs | [walk-stairs.png](../${stage}/evidence/walk-stairs.png) |
| Camera | [camera-near-wall.png](../${stage}/evidence/camera-near-wall.png) |

Tambahan treeLOD0/1/2 dan empat performance screenshot ada di directoryevidence. Screenshot adalah bukti visual, bukan pengganti collision assertions.

## 11. Verifikasi teknis, outputs, keamanan

- Headed Chrome: **7/7 cek lulus**, error${browser.errors.length}, consolewarning${browser.warnings.length}, HTTPgagal${browser.failed.length}.
- Primary lib/game TypeScript saat audit awal5error, sesudah${primary.length}; A3newdiagnostics${newFiles.length}. Historical6error bukan baselineaktual turnini. Wholeworkspace${diagnostics.length}diagnostics termasuk folder dev/output lama; filelog menyimpan detail. TypeScript keseluruhan **belumclean**.
- Build entry Vitepilot exit${build.status}. DEVguard membuat buildproduction stub penolakan dan tidak menyalinpublic; **bukan klaim fullgame production build lulus**. Fullsuitegame tidak dijalankan karena A3 tidak mengubah productiongamecode.
- Sepuluh arsip sumber di-hash SHA256 sebelum/selesai staging dan final: **10/10 identik**. Hash lengkap di catalogA3. Tidak ada extractionmassal, originalrename/delete/overwrite.
- Lifecycle: pagehide mematikanRAF, Game.dispose dan geometry/material/texture/InstancedMesh dev; storage memori, transitiondisabled. Tidak ada dependencybaru atau productionroutebaru.
- Files A3: scripts/prepare-kingdom-pilot-a3.mjs, scripts/convert-kingdom-pilot-a3.py, scripts/finalize-kingdom-pilot-a3.mjs; tests/browser/kingdom-pilot.html/.css/.ts, kingdom-pilot-scene.ts, kingdom-pilot.vite.config.ts, kingdom-pilot-verify.mjs; empat JSONdata/assets; laporanini; derivedstaging dan evidence di dev-assets/kingdom-city-pilot-a3.

**Rekomendasi akhir:** boleh memakai subsetarchitecture/props pada greybox kecil yang di-stream bertahap. Jangan menganggap hasil ini izin membangun fullcity dengan pohonLOD0, unknownlicense atau LODcacat. Tidak ada kota/progression/map produksi yang diubah, tidakpublish. STOP setelahpilot.
`;
// Keep generated owner copy readable without changing technical identifiers/paths.
const copyEdits = {
  'avatar2.4':'avatar 2.4', 'semuaLOD':'semua LOD', 'sourceLOD0':'source LOD0',
  'originalLOD0':'original LOD0', 'treeLOD':'tree LOD', 'architectureLOD':'architecture LOD',
  'LOD0geometry':'LOD0 geometry', 'karakter2.4':'karakter 2.4', 'fieldtest':'field test',
  'runtimeheight':'runtime height', 'overallheight':'overall height',
  'SourceEntry':'sourceEntry', 'fileyangdiinspeksi':'file yang diinspeksi',
  'assetasli':'asset asli', 'packlowpoly':'pack low-poly', 'semua15':'semua 15',
  'Semua15':'Semua 15', '13GLTF':'13 GLTF', '16material':'16 material',
  'normaldoor':'normal door', 'largegate':'large gate', 'Largegate':'Large gate',
  'jalanutama':'jalan utama', 'gatebesar':'gate besar', 'opsiinterior':'opsi interior',
  'materialtrim':'material trim', 'targethardware':'target hardware',
  'perchunk':'per chunk', 'perinstance':'per instance', 'collisiondebug':'collision debug',
  'source-copydan':'source-copy dan', 'remapmaterial':'remap material',
  'localtest':'local test', 'Localtest':'Local test', 'unknownlicense':'unknown license',
  'fullcity':'full city', 'roofcamera':'roof camera', 'rockhull':'rock hull',
  'texturebudget':'texture budget', 'foliageLOD':'foliage LOD', 'namunLOD':'namun LOD',
  'roadkit':'road kit', 'testreference':'test reference', 'drawcalls':'draw calls',
  'directoryevidence':'directory evidence', 'dragkanan':'drag kanan',
  'localhostdev':'localhost dev', 'Fullsuitegame':'Full suite game',
  'productiongamecode':'production game code', 'productionroutebaru':'production route baru',
  'dependencybaru':'dependency baru', 'filelog':'file log', 'historical6error':'historical 6 error',
  'Historical6error':'Historical 6 error', 'baselineaktual':'baseline aktual',
  'turnini':'turn ini', 'Wholeworkspace':'Whole workspace ', 'newdiagnostics':'new diagnostics ',
  'sourcecopy':'source copy', 'derivedstaging':'derived staging', 'laporanini':'laporan ini',
  'empat JSONdata/assets':'empat JSON di data/assets', 'Tidakpublish':'Tidak publish',
  'tidakpublish':'tidak publish', 'setelahpilot':'setelah pilot',
  'DEVguard':'DEV guard', 'buildproduction':'build production', 'entry Vitepilot':'entry Vite pilot',
  'fullgame':'full game', 'performaLOD':'performa LOD', 'sourceasli':'source asli',
  'originalrename/delete/overwrite':'rename/delete/overwrite original',
  'extractionmassal':'extraction massal', 'catalogA3':'catalog A3', 'transitiondisabled':'transition disabled',
  'karakterasli':'karakter asli', 'statusTECH_VALIDATED':'status TECH_VALIDATED',
  '2degenerates':'2 degenerates', 'actor2.4':'actor 2.4',
  '10house':'10 house', '24wall':'24 wall', '4towers':'4 towers', '20trees':'20 trees', '40props':'40 props',
};
let ownerCopy = report;
for (const [from,to] of Object.entries(copyEdits)) ownerCopy = ownerCopy.split(from).join(to);
ownerCopy = ownerCopy.replace(/(\d)(unit|tri\b|error\b|diagnostics\b|frame\b|detik\b|FPS\b|MiB\b)/g, '$1 $2');
write('docs/LUMENFALL_Kingdom_City_Production_Readiness_A3.md',ownerCopy);
console.log(JSON.stringify({assets:assets.length,unchangedSources:hashes.filter(x=>x.unchanged).length,checks:browser.checks,typescript:checks.typescript,build:build.status,stagingMiB:diskBytes/1048576},null,2));
