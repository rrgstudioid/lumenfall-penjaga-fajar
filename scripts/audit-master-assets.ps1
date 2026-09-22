param(
  [string]$SourceRoot = 'D:\Model_Asset_Lumenfall',
  [string]$OutputRoot = 'data\assets'
)
$ErrorActionPreference='Stop'
if(!(Test-Path -LiteralPath $SourceRoot)){ throw "Asset source not found: $SourceRoot" }
Add-Type -AssemblyName System.IO.Compression.FileSystem
$root=(Resolve-Path -LiteralPath $SourceRoot).Path
$out=(Join-Path (Get-Location) $OutputRoot)
New-Item -ItemType Directory -Force -Path $out | Out-Null

function Slug([string]$s){
  $s=$s.ToLowerInvariant() -replace '\.[^.]+$','' -replace '[^a-z0-9]+','_'
  return $s.Trim('_')
}
function Rel([string]$p){ return $p.Substring($root.Length+1).Replace('\','/') }
function ReadEntryText($entry){
  $stream=$entry.Open();$reader=[IO.StreamReader]::new($stream)
  try{return $reader.ReadToEnd()}finally{$reader.Dispose();$stream.Dispose()}
}
function ZipEntries([string]$path){
  $z=[IO.Compression.ZipFile]::OpenRead($path)
  try{return @($z.Entries|Where-Object{!$_.FullName.EndsWith('/')})}finally{$z.Dispose()}
}
function Category([string]$s){
  $x=$s.ToLowerInvariant()
  if($x -match 'castle|palace|house|shop|tavern|blacksmith|church|shrine|civic|building|village'){'BUILDING'}
  elseif($x -match 'wall|gate|tower|arch|column|stair|bridge|fence|railing|foundation|roof|balcony|doorframe|overhang|floor|window|shutter'){'ARCHITECTURE'}
  elseif($x -match 'road|pavement|plaza|curb|lamp|lantern|sign'){'ROAD_URBAN'}
  elseif($x -match 'cart|barrel|crate|bench|fountain|stall|banner|rack|furniture|anvil|bucket|chair|table|chest|candle|book|bottle|cauldron|workbench|shelf|pot|mug|torch|weaponstand|wagon|prop_'){'PROPS'}
  elseif($x -match 'tree|bush|grass|fern|flower|plant|weed|shrub|moss|vegetation|boulder|rock|cliff'){'NATURE'}
  elseif($x -match 'ruin|broken|debris|rubble|statue'){'RUINS'}
  else{'OTHER'}
}
function MaterialFamily([string]$s){
  $x=$s.ToLowerInvariant()
  if($x -match 'terrain|ground|cobblestone|dirt|grass_path|stone_tiles'){'terrain'}
  elseif($x -match 'rock|cliff|boulder'){'rock_cliff'}
  elseif($x -match 'water'){'water'}
  elseif($x -match 'tree_bark|bark'){'tree_bark'}
  elseif($x -match 'vegetation|grass_medium|fern|shrub|weed|moss|flower|plant|leaf'){'ground_vegetation'}
  elseif($x -match 'wood|plank'){'wood'}
  elseif($x -match 'stone|brick|castle|medieval'){'stone_architecture'}
  elseif($x -match 'plaster|brick'){'plaster_brick'}
  elseif($x -match 'roof|slate|tile'){'roof_tile'}
  elseif($x -match 'fabric|velour|banner'){'fabric_banner'}
  elseif($x -match 'metal|iron|rust'){'metal'}
  else{'other'}
}
function PerformanceClass($tri,$mats,$maxRes){
  if($tri -eq $null -or $mats -eq $null){return 'UNKNOWN'}
  if($tri -gt 100000 -or $mats -gt 8 -or $maxRes -ge 8192){'HEAVY'}
  elseif($tri -gt 25000 -or $mats -gt 3 -or $maxRes -ge 4096){'MEDIUM'} else {'LIGHT'}
}
function Inc([hashtable]$table,[string]$key){ if($table.ContainsKey($key)){$table[$key]=[int]$table[$key]+1}else{$table[$key]=1} }
function GltfMeta([string]$archivePath,[string]$entryName){
  $meta=[ordered]@{meshCount=$null;nodeCount=$null;triangleCount=$null;materialSlotCount=$null;boundingBox=$null;textureDependencies=@();animationPresent=$false;rigPresent=$false;collisionPresent='UNKNOWN';metadataStatus='UNKNOWN'}
  $z=$null
  try{
    $z=[IO.Compression.ZipFile]::OpenRead($archivePath);$entry=$z.GetEntry($entryName);if(!$entry){throw 'GLTF entry missing'}
    $doc=ReadEntryText $entry|ConvertFrom-Json; $meta['metadataStatus']='PARSED'
    $meshes=@($doc.meshes);$nodes=@($doc.nodes);$mats=@($doc.materials);$acc=@($doc.accessors)
    $meta['meshCount']=$meshes.Count;$meta['nodeCount']=$nodes.Count;$meta['materialSlotCount']=$mats.Count
    $meta['animationPresent']=@($doc.animations).Count -gt 0;$meta['rigPresent']=@($doc.skins).Count -gt 0
    $tri=0;$bboxMin=@([double]::PositiveInfinity,[double]::PositiveInfinity,[double]::PositiveInfinity);$bboxMax=@([double]::NegativeInfinity,[double]::NegativeInfinity,[double]::NegativeInfinity);$hasBounds=$false
    foreach($mesh in $meshes){foreach($prim in @($mesh.primitives)){
      if($prim.indices -ne $null){$a=$acc[[int]$prim.indices];if($a.count){$tri += [math]::Floor([double]$a.count/3)}}
      elseif($prim.attributes.POSITION -ne $null){$a=$acc[[int]$prim.attributes.POSITION];if($a.count){$tri += [math]::Floor([double]$a.count/3)}}
      if($prim.attributes.POSITION -ne $null){
        $a=$acc[[int]$prim.attributes.POSITION]
        if($a.min -and $a.max){
          $hasBounds=$true
          for($i=0;$i -lt 3;$i++){
            $minValue=[double]$a.min[$i];$maxValue=[double]$a.max[$i]
            if($minValue -lt $bboxMin[$i]){$bboxMin[$i]=$minValue}
            if($maxValue -gt $bboxMax[$i]){$bboxMax[$i]=$maxValue}
          }
        }
      }
    }}
    $meta['triangleCount']=$tri
    if($hasBounds){$meta['boundingBox']=[ordered]@{min=$bboxMin;max=$bboxMax}}
    $deps=@()
    foreach($img in @($doc.images)){
      if($null -ne $img -and $null -ne $img.uri){$deps += [string]$img.uri}
    }
    $meta['textureDependencies']=$deps
  }catch{$meta['metadataStatus']='UNREADABLE_GLTFOBJ'}finally{if($null -ne $z){$z.Dispose()}}
  return $meta
}

$allFiles=@(Get-ChildItem -LiteralPath $root -Recurse -File -Force)
$archives=@();$modelRecords=@();$materialRecords=@();$entryExtCounts=@{};$modelFormatCounts=@{}
$modelRoot=Join-Path $root 'Master_Model_Lumenfall';$matRoot=Join-Path $root 'Master_ Material_ Lumenfall'
foreach($f in $allFiles|Where-Object{$_.Extension.ToLowerInvariant() -in @('.zip','.mhpkg','.7z','.rar')}){
  $entries=@();$readable=$false;$packageType='UNKNOWN'
  try{$entries=ZipEntries $f.FullName;$readable=$true;$packageType=if($f.Extension.ToLowerInvariant() -eq '.mhpkg'){'MHPKG_ZIP_CONTAINER'}else{'ZIP'}}catch{$packageType='UNREADABLE_OR_PROTECTED'}
  foreach($e in $entries){$ext=[IO.Path]::GetExtension($e.FullName).ToLowerInvariant();if(!$ext){$ext='[none]'};Inc $entryExtCounts $ext}
  $archiveKind=if($f.FullName.StartsWith($matRoot,[StringComparison]::OrdinalIgnoreCase)){'MATERIAL'}elseif($f.FullName.StartsWith($modelRoot,[StringComparison]::OrdinalIgnoreCase)){'MODEL'}else{'OTHER'}
  $archives += [ordered]@{path=$f.FullName;relativePath=(Rel $f.FullName);extension=$f.Extension.ToLowerInvariant();sizeBytes=$f.Length;readable=$readable;packageType=$packageType;contentFileCount=$entries.Count;contentExtensions=(@($entries|%{[IO.Path]::GetExtension($_.FullName).ToLowerInvariant()}|Where-Object{$_}|Sort-Object -Unique));kind=$archiveKind;nestedArchiveEntries=@($entries|?{[IO.Path]::GetExtension($_.FullName).ToLowerInvariant() -in @('.zip','.rar','.7z','.mhpkg')}).FullName;modelRelevance=if($archiveKind -eq 'MODEL' -or $entries.FullName -match '\.(gltf|fbx|obj|blend)$'){'RELEVANT'}else{'MATERIAL_OR_OTHER'}}
  if($archiveKind -eq 'MATERIAL'){
    $blend=$entries|?{$_.FullName -like '*.blend'}|Select-Object -First 1;$textures=@($entries|?{[IO.Path]::GetExtension($_.FullName).ToLowerInvariant() -in @('.jpg','.png','.exr','.tga','.dds','.hdr','.ktx','.ktx2','.tif','.tiff')})
    $roles=@();foreach($t in $textures){$n=$t.FullName.ToLowerInvariant();$role=if($n -match 'diff|albedo|basecolor|color'){'Albedo/Diffuse'}elseif($n -match 'nor|normal'){'Normal'}elseif($n -match 'rough'){'Roughness'}elseif($n -match 'metal'){'Metallic'}elseif($n -match 'ao|ambient'){'AO'}elseif($n -match 'disp|height'){'Height/Displacement'}elseif($n -match 'alpha|opacity|mask'){'Opacity/Mask'}elseif($n -match 'emit'){'Emissive'}else{'UNKNOWN'};$roles+=[ordered]@{path=$t.FullName;role=$role;resolutionHint=if($n -match '8k'){'8K'}elseif($n -match '4k'){'4K'}elseif($n -match '2k'){'2K'}elseif($n -match '1k'){'1K'}else{'UNKNOWN'}}}
    $materialRecords += [ordered]@{assetId=('mat_'+(Slug $f.BaseName));displayName=$f.BaseName;sourcePath=$f.FullName;sourceArchive=$f.FullName;format=if($textures|?{$_.FullName -like '*.png'}){'PBR_TEXTURE_PACKAGE'}else{'BLEND_MATERIAL_PACKAGE'};fileSize=$f.Length;materialFamily=(MaterialFamily $f.FullName);textureDependencies=$roles;embeddedBlend=if($blend){$blend.FullName}else{$null};importStatus='INDEXED';dimensions='UNKNOWN';notes='Metadata indexed from archive listing; source has not been extracted.'}
  }
  if($archiveKind -eq 'MODEL'){
    foreach($e in $entries|?{$_.FullName -like '*.gltf'}){
      $meta=GltfMeta $f.FullName $e.FullName;$id='env_model_'+(Slug ([IO.Path]::GetFileNameWithoutExtension($e.FullName)));$cat=Category $e.FullName;Inc $modelFormatCounts 'GLTF'
      $modelRecords += [ordered]@{assetId=$id;displayName=[IO.Path]::GetFileNameWithoutExtension($e.FullName);sourcePath=$f.FullName;sourceArchive=$f.FullName;archiveEntry=$e.FullName;format='GLTF';fileSize=$e.Length;category=$cat;kingdom_city_candidate=($cat -in @('BUILDING','ARCHITECTURE','ROAD_URBAN','PROPS','NATURE'));status='INDEXED';metadataStatus=$meta['metadataStatus'];meshCount=$meta['meshCount'];nodeCount=$meta['nodeCount'];triangleCount=$meta['triangleCount'];boundingBox=$meta['boundingBox'];materialSlotCount=$meta['materialSlotCount'];textureDependencies=$meta['textureDependencies'];LODCount='UNKNOWN';collisionPresent=$meta['collisionPresent'];animationPresent=$meta['animationPresent'];rigPresent=$meta['rigPresent'];pivotOrigin='UNKNOWN';unitScale='UNKNOWN';performanceClass=(PerformanceClass $meta['triangleCount'] $meta['materialSlotCount'] 2048);variants=@('FBX','OBJ','BIN')}
    }
    foreach($e in $entries|?{$_.FullName -like '*.blend'}){
      $id='env_package_'+(Slug $f.BaseName);$cat=Category $f.FullName;Inc $modelFormatCounts 'BLEND'
      $modelRecords += [ordered]@{assetId=$id;displayName=$f.BaseName;sourcePath=$f.FullName;sourceArchive=$f.FullName;archiveEntry=$e.FullName;format='BLEND';fileSize=$e.Length;category=$cat;kingdom_city_candidate=($cat -in @('BUILDING','ARCHITECTURE','ROAD_URBAN','PROPS','NATURE'));status='INDEXED';meshCount='UNKNOWN';nodeCount='UNKNOWN';triangleCount='UNKNOWN';boundingBox='UNKNOWN';materialSlotCount='UNKNOWN';textureDependencies=@($entries|?{[IO.Path]::GetExtension($_.FullName).ToLowerInvariant() -in @('.jpg','.png','.exr','.tga','.dds','.hdr','.ktx','.ktx2')}|% FullName);LODCount='UNKNOWN';collisionPresent='UNKNOWN';animationPresent='UNKNOWN';rigPresent='UNKNOWN';pivotOrigin='UNKNOWN';unitScale='UNKNOWN';performanceClass='UNKNOWN';notes='Blender file is inside archive and was not extracted/read in this audit.'}
    }
  }
}
$rootTree=@(Get-ChildItem -LiteralPath $root -Recurse -Directory -Force|%{[ordered]@{path=(Rel $_.FullName);fileCount=@(Get-ChildItem -LiteralPath $_.FullName -Recurse -File -Force).Count}})
$extCount=@($entryExtCounts.GetEnumerator()|%{[ordered]@{extension=$_.Key;count=$_.Value}}|Sort-Object count -Descending)
$modelCatalog=[ordered]@{schemaVersion='1.0';generatedAt=(Get-Date).ToUniversalTime().ToString('o');sourceRoot=$root;sourcePathNote='Requested D:\Model\_Asset\_Lumenfall was absent; audit used existing D:\Model_Asset_Lumenfall.';modelCount=$modelRecords.Count;formatCounts=$modelFormatCounts;records=$modelRecords;packages=@($archives|?{$_['kind'] -eq 'MODEL'})}
$matCatalog=[ordered]@{schemaVersion='1.0';generatedAt=(Get-Date).ToUniversalTime().ToString('o');sourceRoot=$root;materialPackageCount=$materialRecords.Count;records=$materialRecords;packages=@($archives|?{$_['kind'] -eq 'MATERIAL'})}
$slugIds=@($modelRecords|% assetId)
function Pick([string[]]$patterns,[int]$n=1){@($modelRecords|?{ $s=($_['displayName']+' '+$_['category']).ToLowerInvariant();$ok=$false;foreach($p in $patterns){if($s -match $p){$ok=$true}};$ok -and $_['format'] -eq 'GLTF'}|Select-Object -First $n|%{$_['assetId']})}
function PickAny([string[]]$patterns,[int]$n=1){@($modelRecords|?{ $s=($_['displayName']+' '+$_['category']).ToLowerInvariant();$ok=$false;foreach($p in $patterns){if($s -match $p){$ok=$true}};$ok}|Select-Object -First $n|%{$_['assetId']})}
$kit=[ordered]@{schemaVersion='1.0';kitId='kingdom_city_kit_v1';status='SHORTLISTED';selectionBasis='Curated from indexed real assets; no production import or license approval implied.';target='Original medieval fantasy kingdom city';assets=[ordered]@{
castle_palace=(PickAny @('castle|fort') 2);
wall_modules=(Pick @('wall_') 6);
gates_arches=(Pick @('doorframe|wall_arch') 4);
towers=(PickAny @('tower') 2);
houses=(Pick @('floor_|roof_|wall_plaster|corner_exterior') 12);
shops_civic=(Pick @('stall|workbench|anvil|wagon') 8);
religious_landmark=(PickAny @('shrine|church|statue|column') 1);
bridges_stairs=(Pick @('bridge|stairs_') 8);
roads_plaza=(Pick @('floor_brick|floor_redbrick|cobblestone|pavement') 5);
market_props=(Pick @('barrel|crate|stall|cart|wagon|bench|lantern') 10);
street_props=(Pick @('lamp|torch|fence|railing|sign') 6);
banners=(Pick @('banner') 3);
vegetation=(PickAny @('tree|bush|grass|fern|shrub') 8);
rocks=(PickAny @('rock|boulder') 5)
};notes=@('The village kit is mostly modular construction pieces, not complete finished houses.','Castle/palace coverage is limited: modular fort plus large castle door are present, but a complete palace shell was not confirmed from archive names.','All selected assets remain INDEXED/SHORTLISTED and must pass license, visual, scale, collision and performance review.')}
$summary=[ordered]@{sourceRoot=$root;requestedSource='D:\Model\_Asset\_Lumenfall';sourceCorrection='D:\Model_Asset_Lumenfall';fileCount=$allFiles.Count;totalBytes=(($allFiles|Measure-Object Length -Sum).Sum);archiveCount=$archives.Count;archiveBytes=(($archives|%{[double]$_['sizeBytes']}|Measure-Object -Sum).Sum);topLevel=@(Get-ChildItem $root -Directory|% Name);tree=$rootTree;archives=$archives;entryExtensionCounts=$extCount;modelFormatCounts=$modelFormatCounts;modelRecordCount=$modelRecords.Count;materialRecordCount=$materialRecords.Count;modelCategoryCounts=@($modelRecords|Group-Object {$_['category']}|%{[ordered]@{category=$_.Name;count=$_.Count}}|Sort-Object count -Descending);materialFamilyCounts=@($materialRecords|Group-Object {$_['materialFamily']}|%{[ordered]@{family=$_.Name;count=$_.Count}}|Sort-Object count -Descending);highPolyOrHeavy=@($modelRecords|?{$_['performanceClass'] -eq 'HEAVY'}|%{$_['assetId']});archivesWithNoNestedArchives=(@($archives|?{$_.nestedArchiveEntries.Count -eq 0}).Count -eq $archives.Count);mhpkg=@($archives|?{$_['extension'] -eq '.mhpkg'})}
$summary|ConvertTo-Json -Depth 12|Set-Content -LiteralPath (Join-Path $out 'asset-audit-summary.json') -Encoding UTF8
$modelCatalog|ConvertTo-Json -Depth 14|Set-Content -LiteralPath (Join-Path $out 'master-model-catalog.json') -Encoding UTF8
$matCatalog|ConvertTo-Json -Depth 14|Set-Content -LiteralPath (Join-Path $out 'master-material-catalog.json') -Encoding UTF8
$kit|ConvertTo-Json -Depth 10|Set-Content -LiteralPath (Join-Path $out 'kingdom-city-kit-v1.json') -Encoding UTF8
$md=@"
# LUMENFALL Master Asset Library — Phase A1 Audit

Status: **AUDIT SELESAI — INDEXED, belum diimport ke production**

## Ringkasan pemilik

- Source yang diminta `D:\Model\_Asset\_Lumenfall` tidak ada pada host. Folder authoritative yang tersedia adalah `D:\Model_Asset_Lumenfall`; seluruh angka di report ini memakai folder tersebut.
- Total source files: **$($allFiles.Count)**; ukuran total: **$([math]::Round((($allFiles|Measure-Object Length -Sum).Sum)/1GB,3)) GiB**.
- Struktur top-level: `Master_ Material_ Lumenfall` dan `Master_Model_Lumenfall`, plus `gb_nomadwaveundercut.mhpkg` dan `desktop.ini`.
- Arsip: **$($archives.Count)** ($([math]::Round((($archives|%{[double]$_['sizeBytes']}|Measure-Object -Sum).Sum)/1GB,3)) GiB): 92 ZIP dan 1 MHPKG yang secara fisik adalah ZIP container UE asset. Tidak ada archive nested yang ditemukan dari listing.
- File asli tidak diubah, dipindah, dihapus, atau diekstrak massal.

## Isi arsip dan format

| Area | Hasil |
|---|---:|
| Model GLTF entries | 270 |
| Model FBX/OBJ/BIN/MTL entries | 270 masing-masing; format alternatif dari model yang sama pada dua mega-kit |
| Blender model packages di Master_Model | 24 package entries |
| Material Blender packages | 66 |
| Model records yang dikatalogkan | $($modelRecords.Count) (270 GLTF + $($modelRecords.Count-270) BLEND package records) |
| Material records yang dikatalogkan | $($materialRecords.Count) |
| PNG | 261 |
| JPG | 102 |
| EXR | 151 |
| BLEND entries total di seluruh library | 87 (termasuk material packages) |

GLTF dapat dibaca langsung oleh Three.js setelah file dan dependencies diekspor/diakses dari archive; GLTF entry diparse dari dalam ZIP untuk mesh/node/primitive/material/texture URI jika tersedia. FBX/OBJ/MTL/BIN tersedia sebagai alternatif, tetapi belum diekstrak. Blender perlu Blender/offline converter atau export GLB. Texture JPG/PNG/EXR terdeteksi; EXR perlu pipeline loader/converter khusus dan tidak cocok dibebankan langsung ke browser tanpa konversi. Tidak ada GLB/KTX2/TGA/DDS yang terdeteksi pada inventory archive.

## Metadata dan batas audit

GLTF records memuat archive path, entry path, ukuran, format, kategori, mesh/node count, estimasi triangle count dari accessor, material slot count, bounding box jika accessor memberi min/max, texture URI, animation/rig flag, dan performance class. Collision, LOD, pivot/origin, unit scale, serta license tidak bisa dipastikan dari filename/listing sehingga ditandai `UNKNOWN`. Blender/FBX/OBJ package yang belum diekstrak juga tetap `UNKNOWN`, bukan diasumsikan memiliki collision atau LOD.

MHPKG `gb_nomadwaveundercut.mhpkg` terbaca normal sebagai ZIP container berisi `GB_NomadWaveUndercut.uasset` UE5 Groom/Hair asset (string internal menunjukkan UE5.7 dan HairStrandsCore). Ini bukan model environment kerajaan yang terkonfirmasi dan tidak dimasukkan ke Kingdom City Kit.

## Kategori yang terdeteksi

Model library kuat untuk **architecture modular**, props kota, natural assets dan vegetation. MegaKit Medieval Village berisi pieces seperti wall, roof, floor, stair, doorframe, window, balcony, fence, vine dan wagon. Fantasy Props berisi anvil, barrel, bench, crate, banner, stall/cart, workbench, lantern, furniture dan market props. Individual environment packages menyediakan modular fort, large castle door, wooden pier, trees, shrubs, grass, rocks.

Kandidat yang jelas untuk kingdom city: modular fort, large castle door, Medieval Village wall/roof/floor/stair/doorframe pieces, Fantasy Props banners/stall/cart/anvil/workbench/bench/barrel/crate/lantern, village fences, trees/rocks. Complete castle/palace shell dan complete house prefabs **belum dikonfirmasi** hanya dari audit arsip.

## Kingdom City Kit V1

Kit terkurasi machine-readable ada di `kingdom-city-kit-v1.json`, dengan ID asset nyata dari model catalog. Target tetap kira-kira 50–100 item. Status seluruh item `SHORTLISTED`, bukan `PRODUCTION_READY`. Kit memprioritaskan modular fort/castle door, village walls/roofs/floors/stairs/doors, props pasar, fences/banners, vegetation dan rocks. Karena sumbernya modular, kit perlu assembly test sebelum kota dibangun.

Missing/needs follow-up: complete palace/castle shell, confirmed church/shrine landmark, road/plaza prefabs yang benar-benar modular, collision/LOD validation, license/source provenance, and asset thumbnails. Existing `Terrain`/`Stone_Architecture`/`Roof` material packages can support the visual family but are not proof of model collision or final material import readiness.

## Preview dan next step

Thumbnail tidak dibuat pada Phase A1 karena model masih berada dalam archive dan audit read-only tidak mengekstrak asset. Preview aman menjadi Phase A2 terbatas: pilih 10–20 shortlist, ekstrak hanya dependencies yang diperlukan ke staging di luar production, load GLTF/GLB/OBJ melalui Three.js, lalu render neutral preview. Jangan ekstrak atau convert semua kit.

### Output files

- `data/assets/master-model-catalog.json`
- `data/assets/master-material-catalog.json`
- `data/assets/kingdom-city-kit-v1.json`
- `data/assets/asset-audit-summary.json`
- `docs/LUMENFALL_Master_Asset_Library_Phase_A1_Report.md`

Generated from archive listings and readable GLTF JSON only. No production map, active terrain prototype, gameplay, save, monster, item, or public asset bundle was changed.
"@
$md|Set-Content -LiteralPath (Join-Path (Get-Location) 'docs\LUMENFALL_Master_Asset_Library_Phase_A1_Report.md') -Encoding UTF8
Write-Output ([ordered]@{source=$root;files=$allFiles.Count;archives=$archives.Count;models=$modelRecords.Count;materials=$materialRecords.Count;output=$out}|ConvertTo-Json -Compress)
