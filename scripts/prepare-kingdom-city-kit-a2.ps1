param(
  [string]$CatalogPath = 'data\assets\master-model-catalog.json',
  [string]$ShortlistPath = 'data\assets\kingdom-city-kit-v1.json',
  [string]$StageRoot = 'dev-assets\kingdom-city-kit-v1'
)
$ErrorActionPreference='Stop'
Add-Type -AssemblyName System.IO.Compression.FileSystem
$catalog=Get-Content -LiteralPath $CatalogPath -Raw|ConvertFrom-Json
$shortlist=Get-Content -LiteralPath $ShortlistPath -Raw|ConvertFrom-Json
$stage=(Resolve-Path (New-Item -ItemType Directory -Force -Path $StageRoot)).Path
$dirs=@('models','textures','materials','previews','metadata')
foreach($d in $dirs){New-Item -ItemType Directory -Force -Path (Join-Path $stage $d)|Out-Null}

function CopyZipEntry([IO.Compression.ZipArchive]$zip,[string]$entryName,[string]$destination){
  $entry=$zip.GetEntry($entryName);if(!$entry){throw "Archive entry not found: $entryName"}
  $parent=Split-Path -Parent $destination;if($parent){New-Item -ItemType Directory -Force -Path $parent|Out-Null}
  $input=$entry.Open();$output=[IO.File]::Open($destination,[IO.FileMode]::Create,[IO.FileAccess]::Write,[IO.FileShare]::None)
  try{$input.CopyTo($output)}finally{$input.Dispose();$output.Dispose()}
}
function ResolveArchivePath([string]$entryName,[string]$relative){
  $base=[Uri]::new('https://archive.local/'+$entryName)
  $resolved=[Uri]::new($base,$relative).AbsolutePath.TrimStart('/')
  return [Uri]::UnescapeDataString($resolved)
}
function GetReferencedEntries([IO.Compression.ZipArchive]$zip,[string]$gltfEntryName,[string]$gltfText){
  $doc=$gltfText|ConvertFrom-Json;$names=New-Object System.Collections.Generic.HashSet[string]
  [void]$names.Add($gltfEntryName)
  foreach($b in @($doc.buffers)){if($b.uri){[void]$names.Add((ResolveArchivePath $gltfEntryName ([string]$b.uri)))} }
  foreach($i in @($doc.images)){if($i.uri){[void]$names.Add((ResolveArchivePath $gltfEntryName ([string]$i.uri)))} }
  return @($names)
}
function FlattenShortlist($node){
  $ids=@()
  foreach($p in $node.PSObject.Properties){$v=$p.Value;if($v -is [array]){$ids+=@($v)}elseif($v -is [string] -and $v){$ids+=$v}}
  return @($ids|Sort-Object -Unique)
}
function StyleGroup($r){
  if($r.sourceArchive -match 'Medieval_Village_MegaKit'){return 'STYLE_A_MEDIEVAL_VILLAGE_MODULAR'}
  if($r.sourceArchive -match 'Fantasy_Props_MegaKit'){return 'STYLE_B_FANTASY_TOWN_PROPS'}
  if($r.displayName -match 'castle|fort'){return 'STYLE_C_FORTIFICATION_PACKAGE'}
  if($r.displayName -match 'tree|fern|grass|shrub|boulder|rock'){return 'STYLE_D_NATURE_PACKAGES'}
  return 'STYLE_UNKNOWN'
}
function MaterialFamilyFor($r){
  $n=($r.displayName+' '+($r.textureDependencies -join ' ')).ToLowerInvariant()
  $m=@();if($n -match 'rock|brick|stone|plaster|wall'){ $m+='stone_architecture' }
  if($n -match 'wood|furniture|trim'){ $m+='wood' }
  if($n -match 'roof|tile'){ $m+='roof_tile' }
  if($n -match 'metal|iron'){ $m+='metal' }
  if($n -match 'cloth|banner|fabric'){ $m+='fabric_banner' }
  if($n -match 'tree|bark|grass|fern|shrub|boulder|rock'){ $m+='tree_bark' }
  if($m.Count -eq 0){$m+='UNKNOWN'}
  return @($m|Sort-Object -Unique)
}
$ids=FlattenShortlist $shortlist.assets
$records=@($catalog.records|Where-Object {$_.assetId -in $ids})
if($records.Count -ne $ids.Count){throw "Shortlist/catalog mismatch: $($ids.Count) ids, $($records.Count) records"}
$staged=@();$conversion=@()
foreach($r in $records){
  $style=StyleGroup $r;$families=MaterialFamilyFor $r
  if($r.format -eq 'GLTF'){
    $assetRoot=Join-Path $stage ('models\'+$r.assetId)
    New-Item -ItemType Directory -Force -Path $assetRoot|Out-Null
    $zip=[IO.Compression.ZipFile]::OpenRead($r.sourceArchive)
    try{
      $entry=$zip.GetEntry($r.archiveEntry);$stream=$entry.Open();$reader=[IO.StreamReader]::new($stream);$text=$reader.ReadToEnd();$reader.Dispose();$stream.Dispose()
      foreach($name in GetReferencedEntries $zip $r.archiveEntry $text){
        $target=Join-Path $assetRoot $name.Replace('/','\');CopyZipEntry $zip $name $target
      }
    }finally{$zip.Dispose()}
    $entryRelative=('models/'+$r.assetId+'/'+$r.archiveEntry).Replace('\','/')
    $staged += [ordered]@{assetId=$r.assetId;displayName=$r.displayName;format=$r.format;viewerUrl=('/dev-assets/kingdom-city-kit-v1/'+$entryRelative);sourceArchive=$r.sourceArchive;sourceEntry=$r.archiveEntry;styleGroup=$style;materialFamilies=$families;scaleStatus='UNKNOWN_SCALE';collisionStatus='UNKNOWN';lodStatus='UNKNOWN';licenseStatus='LICENSE_UNKNOWN';validationStatus='RENDERABLE_STAGING';metadata=$r}
  }else{
    $conversion += [ordered]@{assetId=$r.assetId;displayName=$r.displayName;format=$r.format;sourceArchive=$r.sourceArchive;sourceEntry=$r.archiveEntry;styleGroup=$style;materialFamilies=$families;validationStatus='HOLD';reason='BLEND source requires controlled offline conversion; no primary GLTF representation selected.';scaleStatus='UNKNOWN_SCALE';collisionStatus='UNKNOWN';lodStatus='UNKNOWN';licenseStatus='LICENSE_UNKNOWN';metadata=$r}
  }
}
$manifest=[ordered]@{schemaVersion='1.0';generatedAt=(Get-Date).ToUniversalTime().ToString('o');stageRoot=$stage;shortlistCount=$records.Count;renderableCount=$staged.Count;conversionRequiredCount=$conversion.Count;characterProxy='/assets/characters/male-revision-02/male-revision-02.glb';assets=($staged+$conversion)}
$manifest|ConvertTo-Json -Depth 16|Set-Content -LiteralPath (Join-Path $stage 'metadata\kit-manifest.json') -Encoding UTF8
$manifest|ConvertTo-Json -Depth 16|Set-Content -LiteralPath (Join-Path $stage 'metadata\kit-manifest.viewer.json') -Encoding UTF8
Write-Output ([ordered]@{stage=$stage;shortlist=$records.Count;renderable=$staged.Count;conversionRequired=$conversion.Count}|ConvertTo-Json -Compress)
