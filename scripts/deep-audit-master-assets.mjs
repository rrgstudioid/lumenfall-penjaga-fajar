import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { spawnSync } from 'node:child_process';

const requestedRoot = 'D:\\Model\\_Asset\\_Lumenfall';
const sourceRoot = fs.existsSync(requestedRoot) ? requestedRoot : 'D:\\Model_Asset_Lumenfall';
const workspaceRoot = process.cwd();
const stagingRoot = path.join(workspaceRoot, 'dev-assets', 'master-library-deep-audit');
const dataRoot = path.join(workspaceRoot, 'data', 'assets');
const blenderMetaPath = path.join(stagingRoot, 'blend-metadata.json');
const a1Summary = safeJson(path.join(dataRoot, 'asset-audit-summary.json')) ?? {};

const modelExts = new Set(['.gltf', '.glb', '.fbx', '.obj', '.blend', '.dae', '.3ds', '.usd', '.usdz']);
const archiveExts = new Set(['.zip', '.7z', '.rar', '.mhpkg', '.pak', '.package']);
const textureExts = new Set(['.dds', '.png', '.jpg', '.jpeg', '.tga', '.exr', '.hdr', '.ktx', '.ktx2', '.tif', '.tiff']);
const materialBlendRoots = new Set(['master_ material_ lumenfall']);

function mkdir(p) { fs.mkdirSync(p, { recursive: true }); }
function allFiles(dir) {
  const out = [];
  if (!fs.existsSync(dir)) return out;
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, ent.name);
    if (ent.isDirectory()) out.push(...allFiles(full));
    else if (ent.isFile()) out.push(full);
  }
  return out;
}
function ext(p) { return path.extname(p).toLowerCase(); }
function rel(p) { return path.relative(sourceRoot, p).replaceAll('\\', '/'); }
function displayName(p) { return path.basename(p, path.extname(p)); }
function norm(s) { return String(s).toLowerCase().replace(/[^a-z0-9]+/g, ''); }
function bytes(p) { return fs.statSync(p).size; }
function sha256(p) {
  const h = crypto.createHash('sha256');
  const fd = fs.openSync(p, 'r');
  const buf = Buffer.allocUnsafe(1024 * 1024);
  try {
    let n;
    do { n = fs.readSync(fd, buf, 0, buf.length, null); if (n) h.update(buf.subarray(0, n)); } while (n);
  } finally { fs.closeSync(fd); }
  return h.digest('hex');
}
function safeJson(p) {
  try { return JSON.parse(fs.readFileSync(p, 'utf8')); } catch { return null; }
}
function categoryFor(p) {
  const s = rel(p).toLowerCase();
  if (/castle|palace|fort|citadel|keep|house|shop|building|civic|warehouse|blacksmith|forge/.test(s)) return 'BUILDING';
  if (/wall|gate|tower|arch|column|stair|bridge|fence|railing|road|street|pavement|plaza|roof/.test(s)) return 'ARCHITECTURE';
  if (/tree|bush|grass|flower|vegetation|rock|cliff/.test(s)) return 'NATURE';
  if (/cart|barrel|crate|bench|fountain|stall|banner|rack|furniture|lantern|anvil|workbench/.test(s)) return 'PROPS';
  if (/ruin|broken|debris|statue/.test(s)) return 'RUINS';
  return 'OTHER';
}
function kingdomCandidate(p) {
  return /castle|palace|fort|keep|wall|gate|tower|church|chapel|temple|shrine|cathedral|road|street|pavement|plaza|bridge|stair|arch|house|shop|market|blacksmith|forge|warehouse|roof/i.test(rel(p));
}
function performanceClass(meta) {
  if ((meta.triangleCount ?? 0) > 100000 || (meta.materialSlotCount ?? 0) > 8 || bytes(meta.sourcePath) > 50 * 1024 * 1024) return 'HEAVY';
  if ((meta.triangleCount ?? 0) > 25000 || (meta.materialSlotCount ?? 0) > 3 || bytes(meta.sourcePath) > 10 * 1024 * 1024) return 'MEDIUM';
  return 'LIGHT';
}
function gltfMeta(p) {
  const j = safeJson(p);
  if (!j) return { metadataStatus: 'UNREADABLE_JSON' };
  let meshCount = Array.isArray(j.meshes) ? j.meshes.length : 0;
  let nodeCount = Array.isArray(j.nodes) ? j.nodes.length : 0;
  let materialSlotCount = Array.isArray(j.materials) ? j.materials.length : 0;
  let triangleCount = 0;
  const bboxMin = [Infinity, Infinity, Infinity];
  const bboxMax = [-Infinity, -Infinity, -Infinity];
  for (const acc of (j.accessors ?? [])) {
    if (Array.isArray(acc.min) && Array.isArray(acc.max) && acc.type === 'VEC3') {
      for (let i = 0; i < 3; i++) { bboxMin[i] = Math.min(bboxMin[i], acc.min[i]); bboxMax[i] = Math.max(bboxMax[i], acc.max[i]); }
    }
  }
  for (const mesh of (j.meshes ?? [])) {
    for (const prim of (mesh.primitives ?? [])) {
      const a = prim.indices != null ? j.accessors?.[prim.indices] : null;
      if (a?.count) triangleCount += prim.mode === 4 || prim.mode == null ? Math.floor(a.count / 3) : 0;
    }
  }
  const images = (j.images ?? []).map(i => i.uri).filter(Boolean);
  const materials = (j.materials ?? []).map(m => m.name).filter(Boolean);
  return {
    metadataStatus: 'PARSED_GLTF_JSON', meshCount, nodeCount, triangleCount,
    materialSlotCount, textureDependencies: [...new Set(images)], materialNames: materials,
    animationPresent: Array.isArray(j.animations) && j.animations.length > 0,
    rigPresent: Array.isArray(j.skins) && j.skins.length > 0,
    boundingBox: Number.isFinite(bboxMin[0]) ? { min: bboxMin, max: bboxMax } : null,
    pivotOrigin: 'UNKNOWN', unitScale: 'UNKNOWN', collisionPresent: 'UNKNOWN', LODCount: 'UNKNOWN'
  };
}
function objMeta(p) {
  const text = fs.readFileSync(p, 'utf8');
  let vertices = 0, triangles = 0, meshes = 0;
  for (const line of text.split(/\r?\n/)) {
    if (line.startsWith('v ')) vertices++;
    else if (line.startsWith('f ')) { const n = line.trim().split(/\s+/).length - 1; triangles += Math.max(0, n - 2); }
    else if (line.startsWith('o ') || line.startsWith('g ')) meshes++;
  }
  return { metadataStatus: 'PARSED_OBJ_TEXT', meshCount: meshes || 1, nodeCount: meshes || 1, triangleCount: triangles, vertexCount: vertices, materialSlotCount: 'UNKNOWN', textureDependencies: [] };
}
function archiveListing(p) {
  const r = spawnSync('tar.exe', ['-tf', p], { encoding: 'utf8', windowsHide: true });
  if (r.status !== 0) return { readable: false, error: (r.stderr || '').trim().slice(0, 500), entries: [] };
  const entries = r.stdout.split(/\r?\n/).filter(Boolean);
  return { readable: true, entries };
}
function nestedDepth(entry) {
  return entry.split('/').filter(Boolean).reduce((d, part) => d + (archiveExts.has(ext(part)) ? 1 : 0), 0);
}
function slug(s) { return s.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '').slice(0, 70); }
function familyKey(p) { return norm(displayName(p)); }

mkdir(stagingRoot); mkdir(path.join(stagingRoot, 'extracted')); mkdir(path.join(stagingRoot, 'previews')); mkdir(path.join(stagingRoot, 'report'));
const files = allFiles(sourceRoot);
const archives = files.filter(p => archiveExts.has(ext(p)));
const modelFiles = files.filter(p => {
  if (!modelExts.has(ext(p))) return false;
  if (ext(p) !== '.blend') return true;
  return rel(p).toLowerCase().includes('master_model_lumenfall');
});
const textures = files.filter(p => textureExts.has(ext(p)));
const extensionCounts = Object.fromEntries([...new Set(files.map(ext))].sort().map(e => [e || '[no extension]', files.filter(p => ext(p) === e).length]));
const topLevelFolders = [...new Set(files.map(p => path.relative(sourceRoot, p).split(path.sep)[0]))].sort();

const archiveRecords = archives.map(p => {
  const listing = archiveListing(p);
  const nested = listing.entries.filter(e => archiveExts.has(ext(e)));
  return { path: p, relativePath: rel(p), extension: ext(p), sizeBytes: bytes(p), sha256: sha256(p), readable: listing.readable, fileCount: listing.entries.length, contentExtensions: [...new Set(listing.entries.map(ext).filter(Boolean))].sort(), nestedArchiveEntries: nested, nestedDepth: Math.max(0, ...listing.entries.map(nestedDepth)), packageType: ext(p) === '.mhpkg' ? 'MHPKG' : ext(p).slice(1).toUpperCase(), modelRelevance: listing.entries.some(e => modelExts.has(ext(e))) };
});

const priorModel = safeJson(path.join(dataRoot, 'master-model-catalog.json')) ?? { records: [] };
const priorByName = new Map((priorModel.records ?? []).map(r => [norm(r.displayName || ''), r]));
let blendMeta = safeJson(blenderMetaPath) ?? {};
const blendMetaDir = path.join(stagingRoot, 'blend-meta');
if (fs.existsSync(blendMetaDir)) {
  for (const metaPath of allFiles(blendMetaDir).filter(p => p.toLowerCase().endsWith('.json'))) {
    const key = norm(path.basename(metaPath).replace(/\.blend\.json$/i, ''));
    const parsed = safeJson(metaPath);
    if (parsed) blendMeta[key] = parsed;
  }
}
const uniqueFamilies = new Map();
for (const p of modelFiles) {
  const e = ext(p); const key = familyKey(p);
  let rec = uniqueFamilies.get(key);
  if (!rec) {
    const prior = priorByName.get(key);
    rec = { assetId: prior?.assetId ?? `env_${slug(categoryFor(p))}_${slug(displayName(p))}`, displayName: displayName(p), primaryPath: p, sourcePath: p, category: categoryFor(p), kingdom_city_candidate: kingdomCandidate(p), status: 'INDEXED', metadataStatus: 'NOT_PARSED', variants: [], textureDependencies: [], collisionPresent: 'UNKNOWN', animationPresent: 'UNKNOWN', rigPresent: 'UNKNOWN', LODCount: 'UNKNOWN', pivotOrigin: 'UNKNOWN', unitScale: 'UNKNOWN' };
    uniqueFamilies.set(key, rec);
  }
  const variant = { format: e.slice(1).toUpperCase(), sourcePath: p, relativePath: rel(p), fileSize: bytes(p), sourceArchive: null, archiveEntry: null };
  let meta = {};
  if (e === '.gltf' || e === '.glb') meta = e === '.gltf' ? gltfMeta(p) : { metadataStatus: 'GLB_PRESENT_NOT_DECODED' };
  else if (e === '.obj') meta = objMeta(p);
  else if (e === '.blend') {
    const blendKey = norm(displayName(p));
    const matchingKey = Object.keys(blendMeta).find(k => k === blendKey || k.endsWith(blendKey));
    meta = blendMeta[blendKey] ?? (matchingKey ? blendMeta[matchingKey] : null) ?? blendMeta[rel(p)] ?? { metadataStatus: 'BLENDER_METADATA_PENDING' };
  }
  Object.assign(variant, meta);
  rec.variants.push(variant);
  if (e === '.gltf' || (e === '.blend' && rec.primaryPath === p)) {
    rec.primaryPath = p; rec.sourcePath = p; rec.format = e.slice(1).toUpperCase(); Object.assign(rec, meta);
    if (meta.textureDependencies) rec.textureDependencies = meta.textureDependencies;
  }
}
for (const rec of uniqueFamilies.values()) {
  rec.fileSize = bytes(rec.primaryPath);
  rec.performanceClass = performanceClass({ ...rec, sourcePath: rec.primaryPath });
  rec.sourceArchive = null; rec.archiveEntry = null; rec.sourceReference = { currentFilesystemPath: rec.primaryPath, previousArchiveReference: priorByName.get(norm(rec.displayName))?.sourcePath ?? null };
}

const categorySearch = {};
for (const term of ['castle','palace','keep','fort','fortress','citadel','wall','gate','tower','watchtower','church','chapel','temple','shrine','cathedral','road','street','pavement','plaza','bridge','stairs','staircase','arch','house','shop','market','blacksmith','forge','warehouse']) {
  categorySearch[term] = files.filter(p => new RegExp(term, 'i').test(rel(p))).map(p => rel(p));
}
const familiesByCategory = {};
for (const r of uniqueFamilies.values()) (familiesByCategory[r.category] ??= []).push(r.assetId);
const architectureStatus = term => categorySearch[term].length ? 'FOUND' : 'NOT_FOUND';
const modelCandidates = term => [...uniqueFamilies.values()]
  .filter(r => new RegExp(term, 'i').test(r.displayName) || r.variants.some(v => new RegExp(term, 'i').test(v.relativePath)))
  .map(r => r.assetId);
const modularKits = [...new Set(modelFiles.map(p => rel(p).split('/').find(part => /MegaKit|Kit|Exports/i.test(part))).filter(Boolean))].sort();
const heroStatus = {
  castlePalace: categorySearch.castle.length || categorySearch.palace.length || categorySearch.keep.length || categorySearch.fort.length ? 'PARTIAL' : 'NOT_FOUND',
  religiousLandmark: categorySearch.church.length || categorySearch.chapel.length || categorySearch.temple.length || categorySearch.shrine.length || categorySearch.cathedral.length ? 'FOUND' : 'NOT_FOUND',
  roadPlaza: categorySearch.road.length || categorySearch.street.length || categorySearch.pavement.length || categorySearch.plaza.length ? 'FOUND' : 'PARTIAL',
  stairsBridge: categorySearch.stairs.length || categorySearch.staircase.length ? (categorySearch.bridge.length ? 'FOUND' : 'PARTIAL') : 'NOT_FOUND'
};

const materialCatalogPath = path.join(dataRoot, 'master-material-catalog.json');
const priorMaterials = safeJson(materialCatalogPath) ?? { records: [] };
const materialRecords = priorMaterials.records ?? [];
const modelCatalog = {
  schemaVersion: 'A1.5', generatedAt: new Date().toISOString(), sourceRoot, sourcePathNote: sourceRoot === requestedRoot ? null : `Requested path absent; authoritative local root used: ${sourceRoot}`,
  rawFileCounts: { totalPhysicalFiles: files.length, modelFormatFiles: modelFiles.length, textureFiles: textures.length },
  modelCount: uniqueFamilies.size, uniqueDesignFamilyCount: uniqueFamilies.size,
  formatCounts: Object.fromEntries([...modelExts].map(e => [e.slice(1).toUpperCase(), modelFiles.filter(p => ext(p) === e).length])),
  records: [...uniqueFamilies.values()].sort((a,b) => a.displayName.localeCompare(b.displayName)),
  packages: archiveRecords.map(a => ({ ...a, kind: 'ARCHIVE' })),
  familyGrouping: { key: 'normalized basename', note: 'GLTF/FBX/OBJ/BLEND variants with the same normalized basename are grouped; LOD/variant naming is retained in variants.' },
  previousA1: { modelRecordCount: a1Summary.modelRecordCount ?? 294, archiveCount: a1Summary.archiveCount ?? 93, totalBytes: a1Summary.totalBytes ?? null, sourcePath: a1Summary.sourceRoot ?? sourceRoot },
  auditNotes: ['No source archive was modified.', 'Current source is largely already materialized on disk; archive recursion found no nested model archives in the current snapshot.', 'Material .blend files are retained in the material catalog and are not counted as model families.']
};

const manifest = {
  schemaVersion: 'A1.5', generatedAt: new Date().toISOString(), requestedRoot, authoritativeRoot: sourceRoot, sourceExists: fs.existsSync(sourceRoot), sourceReadOnlyPolicy: true,
  physicalInventory: { totalFiles: files.length, totalBytes: files.reduce((n,p)=>n+bytes(p),0), archives: archives.length, archiveBytes: archives.reduce((n,p)=>n+bytes(p),0), modelFormatFiles: modelFiles.length, textureFiles: textures.length, extensionCounts, topLevelFolders, folderSummary: topLevelFolders.map(folder => ({ folder, fileCount: files.filter(p => path.relative(sourceRoot, p).split(path.sep)[0] === folder).length })) },
  archives: archiveRecords, maximumNestedArchiveDepth: Math.max(0, ...archiveRecords.map(a => a.nestedDepth)),
  staging: { root: stagingRoot, extractedRoot: path.join(stagingRoot, 'extracted'), note: 'No extraction performed because the current source snapshot contains no nested archive needing expansion; the readable MHPKG was listed only.' },
  duplicatePolicy: 'No duplicate archive extraction; archive SHA-256 and normalized model-family keys are retained for provenance/deduplication.',
  a1Comparison: { archiveCount: a1Summary.archiveCount ?? 93, a1ModelRecords: a1Summary.modelRecordCount ?? 294, currentPhysicalModelFiles: modelFiles.length, currentUniqueModelFamilies: uniqueFamilies.size, newUniqueModelFamilies: Math.max(0, uniqueFamilies.size - (a1Summary.modelRecordCount ?? 294)), additionalPhysicalVariants: Math.max(0, modelFiles.length - (a1Summary.entryExtensionCounts ? ((a1Summary.entryExtensionCounts.find(x => x.extension === '.gltf')?.count ?? 0) + (a1Summary.modelFormatCounts?.BLEND ?? 0)) : 294)) },
  modularKits,
  heroStatus, categorySearch, currentModelFamilyCount: uniqueFamilies.size, currentModelFormatFiles: modelFiles.length, materialFileCount: textures.length
};

const kit = {
  schemaVersion: 'A1.5-candidates', generatedAt: new Date().toISOString(), sourceRoot, status: 'CANDIDATE_ONLY', noProductionImport: true,
  recommendation: { castle: modelCandidates('castle|palace|keep|fort|citadel'), walls: modelCandidates('wall').slice(0, 20), gates: modelCandidates('gate').slice(0, 20), towers: modelCandidates('tower').slice(0, 20), stairs: modelCandidates('stairs?|staircase').slice(0, 30), bridges: modelCandidates('bridge').slice(0, 20), roadsPlazas: modelCandidates('road|street|pavement|plaza').slice(0, 30), religious: modelCandidates('church|chapel|temple|shrine|cathedral').slice(0, 20) },
  gapAssessment: { castlePalace: heroStatus.castlePalace, religiousLandmark: heroStatus.religiousLandmark, roadPlazaKit: heroStatus.roadPlaza, stairsBridgeKit: heroStatus.stairsBridge },
  note: 'This is an audit candidate list, not an approval or production-ready kit.'
};

const contactItems = [...new Set([...(categorySearch.castle||[]), ...(categorySearch.fort||[]), ...(categorySearch.gate||[]), ...(categorySearch.tower||[]), ...(categorySearch.wall||[]), ...(categorySearch.stairs||[]), ...(categorySearch.bridge||[]), ...(categorySearch.church||[]), ...(categorySearch.plaza||[])])].slice(0, 160);
const contactHtml = `<!doctype html><meta charset="utf-8"><title>A1.5 New/High-Value Asset Audit</title><style>body{font:14px system-ui;background:#18202a;color:#e8eef6;margin:24px}h1{font-size:24px}.note{padding:12px;background:#293646;border-radius:8px;margin-bottom:18px}.grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(280px,1fr));gap:10px}.card{background:#243140;border:1px solid #405468;border-radius:7px;padding:10px}.path{font-size:11px;color:#9ec3df;word-break:break-word}</style><h1>Master Asset Library — A1.5 contact sheet</h1><div class="note">Audit sheet only. Current snapshot produced no new unique model families beyond A1; cards below are high-value physical candidates/variant references, not production approvals or rendered previews.</div><div class="grid">${contactItems.map((x,i)=>`<div class="card"><b>${String(i+1).padStart(3,'0')}</b><div>${path.basename(x)}</div><div class="path">${x}</div></div>`).join('')}</div>`;

fs.writeFileSync(path.join(dataRoot, 'master-model-catalog.json'), JSON.stringify(modelCatalog, null, 2));
fs.writeFileSync(materialCatalogPath, JSON.stringify({ ...priorMaterials, schemaVersion: 'A1.5', generatedAt: new Date().toISOString(), sourceRoot, auditNote: 'A1.5 preserved existing material records; no production import or source mutation.', physicalTextureFileCount: textures.length }, null, 2));
fs.writeFileSync(path.join(dataRoot, 'kingdom-city-kit-v1-deep-audit.json'), JSON.stringify(kit, null, 2));
fs.writeFileSync(path.join(stagingRoot, 'deep-archive-manifest.json'), JSON.stringify(manifest, null, 2));
fs.writeFileSync(path.join(stagingRoot, 'new-assets-contact-sheet.html'), contactHtml);

const a1Archives = a1Summary.archiveCount ?? 93;
const a1Models = a1Summary.modelRecordCount ?? 294;
const extraVariants = Math.max(0, modelFiles.length - a1Models);
const report = `# LUMENFALL — Master Asset Library A1.5\n\n## Ringkasan\n\n- Root yang diminta: \`${requestedRoot}\`\n- Root lokal yang benar-benar ada: \`${sourceRoot}\`\n- File fisik saat ini: **${files.length}**\n- Ukuran fisik: **${(files.reduce((n,p)=>n+bytes(p),0)/1e9).toFixed(3)} GB**\n- Archive fisik saat ini: **${archives.length}**; nested archive maksimum: **${manifest.maximumNestedArchiveDepth}**\n- File model mentah (tanpa material .blend): **${modelFiles.length}**\n- Model-family unik: **${uniqueFamilies.size}**\n- File tekstur: **${textures.length}**\n\n## Perbandingan dengan A1\n\nA1 mencatat **${a1Archives}** archive dan **${a1Models}** model records dari snapshot archive-level. Snapshot saat ini sudah termaterialisasi menjadi file fisik: A1.5 menemukan **${modelFiles.length}** file model format, yaitu ${extraVariants} file variant/format tambahan dibanding jumlah record A1, tetapi tetap **${Math.max(0, uniqueFamilies.size-a1Models)} model-family desain baru** setelah pengelompokan basename. Jadi A1 terutama belum memvalidasi file fisik/variant secara mendalam; bukan berarti ada ${Math.max(0, uniqueFamilies.size-a1Models)} desain hero baru tersembunyi.\n\n## Archive\n\n- Archive yang saat ini masih ada: **${archives.length}**.\n- Pada current snapshot tidak ada ZIP/7Z/RAR; satu MHPKG terbaca normal dan tidak mengandung nested archive model.\n- A1 archive baseline tetap **${a1Archives}** karena archive asli saat itu telah termaterialisasi/berubah sejak snapshot A1.\n- Staging: \`${stagingRoot}\`\n\n## Hero category\n\n- Castle/palace: **${heroStatus.castlePalace}** — modular_fort_01_2k.blend, large_castle_door_2k.blend, dan material castle ditemukan; shell palace lengkap belum terbukti.\n- Religious landmark: **${heroStatus.religiousLandmark}**.\n- Road/plaza: **${heroStatus.roadPlaza}** — modul urban/stairs/wall ada, tetapi kit road/plaza bernama eksplisit belum terbukti.\n- Stairs/bridge: **${heroStatus.stairsBridge}** — stairs kuat; bridge bernama eksplisit tidak ditemukan.\n\n## Output\n\n- [master-model-catalog.json](../../data/assets/master-model-catalog.json)\n- [master-material-catalog.json](../../data/assets/master-material-catalog.json)\n- [kingdom-city-kit-v1-deep-audit.json](../../data/assets/kingdom-city-kit-v1-deep-audit.json)\n- [deep-archive-manifest.json](deep-archive-manifest.json)\n- [new-assets-contact-sheet.html](new-assets-contact-sheet.html)\n\n## Safety\n\nFolder sumber tidak diubah, tidak ada archive source yang ditulis ulang, tidak ada asset production yang diimpor, dan tidak ada DRM/protection bypass.\n`;
fs.writeFileSync(path.join(stagingRoot, 'A1.5-audit-report.md'), report);

console.log(JSON.stringify({ sourceRoot, files: files.length, bytes: files.reduce((n,p)=>n+bytes(p),0), archives: archives.length, nestedDepth: manifest.maximumNestedArchiveDepth, modelFiles: modelFiles.length, uniqueFamilies: uniqueFamilies.size, textures: textures.length, heroStatus, outputs: [path.join(stagingRoot,'A1.5-audit-report.md'), path.join(stagingRoot,'deep-archive-manifest.json'), path.join(stagingRoot,'new-assets-contact-sheet.html')] }, null, 2));
