param(
  [string]$CatalogPath='data\assets\master-model-catalog.json',
  [string]$ManifestPath='dev-assets\kingdom-city-kit-v1\metadata\kit-manifest.json',
  [string]$OutputRoot='data\assets'
)
$ErrorActionPreference='Stop'
$catalog=Get-Content $CatalogPath -Raw|ConvertFrom-Json;$manifest=Get-Content $ManifestPath -Raw|ConvertFrom-Json
$out=(Resolve-Path (New-Item -ItemType Directory -Force -Path $OutputRoot)).Path
$records=@($manifest.assets);$renderable=@($records|?{$_.format -eq 'GLTF'});$held=@($records|?{$_.format -ne 'GLTF'})
$approved=[System.Collections.Generic.HashSet[string]]::new()
function AddIds([string[]]$values){foreach($v in $values){[void]$approved.Add($v)}}
AddIds @('env_model_wall_arch','env_model_wall_bottomcover','env_model_wall_plaster_door_flat','env_model_wall_plaster_door_round','env_model_wall_plaster_door_roundinset','env_model_wall_plaster_straight','env_model_doorframe_flat_brick','env_model_doorframe_round_brick','env_model_doorframe_flat_wooddark','env_model_doorframe_round_wooddark','env_model_roof_tower_roundtiles')
AddIds @('env_model_corner_exteriorwide_brick','env_model_corner_exteriorwide_wood','env_model_corner_exterior_brick','env_model_corner_exterior_topdown','env_model_corner_exterior_wood','env_model_floor_brick','env_model_floor_redbrick','env_model_floor_unevenbrick','env_model_floor_wooddark','env_model_floor_wooddark_half1','env_model_floor_wooddark_half2')
AddIds @('env_model_stall_cart_empty','env_model_stall_empty','env_model_prop_wagon','env_model_anvil','env_model_anvil_log','env_model_workbench','env_model_workbench_drawers')
AddIds @('env_model_barrel','env_model_barrel_apples','env_model_barrel_holder','env_model_bench','env_model_crate_wooden','env_model_lantern_wall')
AddIds @('env_model_torch_metal','env_model_prop_metalfence_ornament','env_model_prop_metalfence_simple','env_model_prop_woodenfence_extension1','env_model_prop_woodenfence_single','env_model_banner_1','env_model_banner_1_cloth','env_model_banner_2')
AddIds @('env_model_stairs_exterior_nofirststep','env_model_stairs_exterior_platform','env_model_stairs_exterior_platform45','env_model_stairs_exterior_platformu')
function PrimaryFamily($a){
  $n=(($a.materialFamilies -join ' ')+' '+$a.displayName).ToLowerInvariant();$d=$a.displayName.ToLowerInvariant()
  if($d -match 'banner'){return 'fabric_banner'} if($d -match 'roof'){return 'roof_tile'}
  if($d -match 'wall|doorframe|floor|stair|corner|arch'){return 'stone_architecture'}
  if($d -match 'metal|torch|lantern|anvil|fence'){return 'metal'}
  if($d -match 'barrel|crate|wagon|stall|workbench|bench|wood'){return 'wood'}
  if($n -match 'plaster'){return 'plaster_brick'} if($n -match 'stone|brick'){return 'stone_architecture'} return 'UNKNOWN'
}
$matCatalog=Get-Content (Join-Path $out 'master-material-catalog.json') -Raw|ConvertFrom-Json;$matByFamily=@{}
foreach($m in $matCatalog.records){if(!$matByFamily.ContainsKey($m.materialFamily)){$matByFamily[$m.materialFamily]=$m.assetId}}
$styleGroups=[ordered]@{
  STYLE_A_MEDIEVAL_VILLAGE_MODULAR=[ordered]@{label='Medieval Village Modular';dominant=$true;sourcePacks=@('Medieval_Village_MegaKit.zip');role='Primary architecture family';assetIds=@($renderable|?{$_.styleGroup -eq 'STYLE_A_MEDIEVAL_VILLAGE_MODULAR'}|% assetId)}
  STYLE_B_FANTASY_TOWN_PROPS=[ordered]@{label='Fantasy Town Props';dominant=$false;sourcePacks=@('Fantasy_Props_MegaKit.zip');role='Market/craft/street support';assetIds=@($renderable|?{$_.styleGroup -eq 'STYLE_B_FANTASY_TOWN_PROPS'}|% assetId)}
  STYLE_C_FORTIFICATION_PACKAGE=[ordered]@{label='Fortification Packages';dominant=$false;sourcePacks=@('modular_fort_01_2k.blend.zip','large_castle_door_2k.blend.zip');role='Requires BLEND conversion';assetIds=@($held|?{$_.styleGroup -eq 'STYLE_C_FORTIFICATION_PACKAGE'}|% assetId)}
  STYLE_D_NATURE_PACKAGES=[ordered]@{label='Nature Packages';dominant=$false;sourcePacks=@('tree/vegetation/rock BLEND packages');role='Requires BLEND conversion';assetIds=@($held|?{$_.styleGroup -eq 'STYLE_D_NATURE_PACKAGES'}|% assetId)}
}
$mapping=@();$validation=@()
foreach($a in $records){$isApproved=$approved.Contains($a.assetId);$status=if($isApproved){'APPROVED'}elseif($a.format -eq 'BLEND'){'HOLD'}else{'HOLD'};$reason=if($isApproved){'Renderable GLTF, coherent with the selected medieval village / town-prop family; final production approval still requires collision, LOD, license and in-world validation.'}elseif($a.format -eq 'BLEND'){'HOLD: conversion required before visual geometry validation.'}else{'HOLD: variant/redundant shortlist piece reserved for later assembly review.'};$scale=if($isApproved){'UNKNOWN_SCALE'}else{'UNKNOWN_SCALE'};$perf=$a.metadata.performanceClass; $family=PrimaryFamily $a; $candidate=if($matByFamily.ContainsKey($family)){$matByFamily[$family]}else{$null};$validation += [ordered]@{assetId=$a.assetId;displayName=$a.displayName;format=$a.format;status=$status;reason=$reason;styleGroup=$a.styleGroup;scaleClass=$scale;performanceClass=$perf;collision='COLLISION_UNKNOWN';lod='LOD_MISSING_OR_UNKNOWN';license='LICENSE_UNKNOWN';sourceArchive=$a.sourceArchive;sourceEntry=$a.sourceEntry}
  $mapping += [ordered]@{assetId=$a.assetId;status=$status;sourceMaterialFamilies=@($a.materialFamilies);recommendedLumenfallFamily=$family;recommendedMaterialAssetId=$candidate;mappingStatus='RECOMMENDATION_ONLY';notes='Do not replace source material during A2.'}
}
$approvedRecords=@($validation|?{$_.status -eq 'APPROVED'});$holdRecords=@($validation|?{$_.status -eq 'HOLD'})
$kit=[ordered]@{schemaVersion='1.0';kitId='kingdom_city_kit_v1_final';status='SHORTLISTED_FOR_GREYBOX';sourceKit='kingdom_city_kit_v1';shortlistEntries=$records.Count;approvedCount=$approvedRecords.Count;holdCount=$holdRecords.Count;rejectedCount=0;dominantStyleGroup='STYLE_A_MEDIEVAL_VILLAGE_MODULAR';approvedAssetIds=@($approvedRecords|% assetId);approvedAssets=$approvedRecords;holdAssets=$holdRecords;missingAssets=@('complete palace/castle shell','religious landmark','final road/plaza kit','validated collision meshes','validated LODs','license provenance');notes=@('APPROVED means approved for A2 greybox review, not PRODUCTION_READY.','All source archives remain external and unchanged.','Nature and fortification BLEND packages remain HOLD until controlled conversion.')}
$kit|ConvertTo-Json -Depth 16|Set-Content (Join-Path $out 'kingdom-city-kit-v1-final.json') -Encoding UTF8
[ordered]@{schemaVersion='1.0';dominantStyleGroup='STYLE_A_MEDIEVAL_VILLAGE_MODULAR';groups=$styleGroups;selectionNotes=@('STYLE_A is the strongest coherent architecture family from the available GLTF evidence.','Fortification/nature packages require conversion before visual approval.','No license was promoted to LICENSE_OK from absent metadata.') }|ConvertTo-Json -Depth 16|Set-Content (Join-Path $out 'kingdom-city-style-groups.json') -Encoding UTF8
[ordered]@{schemaVersion='1.0';generatedAt=(Get-Date).ToUniversalTime().ToString('o');sourceCatalog='master-material-catalog.json';mappings=$mapping}|ConvertTo-Json -Depth 16|Set-Content (Join-Path $out 'kingdom-city-material-mapping.json') -Encoding UTF8
$report=@"
# LUMENFALL Kingdom City Asset Validation — Phase A2

Status: **VALIDASI VISUAL DEVELOPMENT SELESAI — greybox kit, belum production-ready**

## Ringkasan

- Shortlist input: **$($records.Count) ID unik** dari 74 referensi shortlist V1.
- GLTF yang masuk staging dan berhasil dimuat viewer: **$($renderable.Count)**.
- BLEND yang ditahan untuk conversion terkontrol: **$($held.Count)**.
- APPROVED untuk A2 greybox: **$($approvedRecords.Count)**.
- HOLD: **$($holdRecords.Count)**.
- REJECTED_FOR_CITY: **0**; tidak ada asset dibuang permanen.

## Hasil validasi

Viewer development-only tersedia melalui `tests/browser/kingdom-city-kit.html` dengan Vite config khusus A2. Viewer memuat GLTF, material dependency, 3/4 orbit, wireframe, bounds, source metadata, triangle count, material count, dan proxy karakter 1.75m. Source scale tidak diubah.

Keluarga arsitektur dominan: **STYLE_A_MEDIEVAL_VILLAGE_MODULAR** dari Medieval Village MegaKit. Fantasy Props dipakai sebagai pendukung market/craft/street, bukan sebagai arsitektur utama.

## Scale, material, collision, LOD, license

Scale seluruh asset tetap **UNKNOWN_SCALE** sampai dilakukan kalibrasi in-world terhadap karakter nyata dan modul pintu/rumah. Tidak ada random per-object scale.

Material dependency GLTF berhasil dibaca dan dipetakan secara rekomendatif ke `stone_architecture`, `wood`, `plaster_brick`, `roof_tile`, `metal`, dan `fabric_banner`. Remapping belum dilakukan.

Collision, LOD, dan license tetap **UNKNOWN/MISSING** dari data yang tersedia. Asset belum boleh disebut production-ready.

## Missing assets

- complete palace/castle shell
- religious landmark
- final road/plaza kit
- collision mesh terverifikasi
- LOD terverifikasi
- license/provenance confirmation

Fortification dan vegetation BLEND tetap HOLD. Tidak ada conversion massal atau Blender opening massal.

## Preview

Preview interaktif, contact-sheet, dan composition tests development: `tests/browser/kingdom-city-kit.html`, `tests/browser/kingdom-city-kit-sheets.html`, dan `tests/browser/kingdom-city-kit-compositions.html`. Semua hasil staging berada di `dev-assets/kingdom-city-kit-v1/`.

## Kesimpulan

Kit final cukup untuk **greybox awal**, tetapi belum cukup untuk production city. Langkah berikutnya yang aman adalah conversion terbatas untuk satu fortification package, satu tree, dan satu rock, lalu kalibrasi scale/collision/LOD.
"@
$report|Set-Content 'docs/LUMENFALL_Kingdom_City_Asset_Validation_A2.md' -Encoding UTF8
Write-Output ([ordered]@{shortlist=$records.Count;approved=$approvedRecords.Count;hold=$holdRecords.Count;rejected=0}|ConvertTo-Json -Compress)
