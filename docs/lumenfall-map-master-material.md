# Lumenfall — Map Master Material Specification

## Tujuan

Dokumen ini menjadi sumber tunggal untuk material dan texture seluruh map Lumenfall: Penjaga Fajar.

Setiap map baru wajib mengambil material dari sistem master material ini. Map tidak boleh lagi membuat material terrain sendiri menggunakan warna langsung, `MeshStandardMaterial` terpisah, atau texture fallback yang tidak terdaftar.

Master material harus memisahkan tiga hal:

1. **Material family** — jenis permukaan seperti grass, rock, path, water, wood, dan stone.
2. **Material instance/profile** — variasi warna, texture, tiling, dan detail untuk biome atau map tertentu.
3. **Lighting mood** — nuansa terang, netral, gelap, dingin, atau hangat tanpa mengganti struktur material.

Geometry, collision, navigation, NPC, monster, spawn, dan gameplay tidak termasuk dalam sistem ini dan harus tetap terpisah.

## Arsitektur file yang dituju

```text
lib/game/map-master-material.ts       # Shader/material utama bersama
lib/game/map-material-instances.ts    # Instance grass, rock, path, water, dll.
lib/game/map-material-profiles.ts     # Profile material per map dan mood
lib/game/map-material-assets.ts        # Registry texture/asset dan validasi path
```

Dokumen ini tidak menggantikan material khusus senjata, character, NPC, VFX, atau UI.

## Prinsip utama

- Semua permukaan memakai satu shader dasar yang konsisten.
- Texture opsional boleh tidak tersedia; material tetap memakai warna dan noise internal sebagai fallback.
- Fallback hanya berada di master material, bukan dibuat ulang di setiap map.
- Material tidak boleh mengubah tinggi terrain atau collision.
- Material tidak boleh menambah mesh hanya untuk membuat detail visual.
- Texture base color memakai sRGB.
- Normal, roughness, AO, height, dan mask memakai linear color space.
- Tiling memakai world-space scale agar ukuran texture konsisten terhadap character.
- Variasi noise harus deterministik per map supaya hasil tidak berubah setiap reload.
- Map terang dan map gelap menggunakan material yang sama dengan mood profile berbeda.
- Texture addon yang belum terdaftar tidak boleh dipanggil langsung dari renderer.

## Master shader inputs

### Texture slots

| Slot | Fungsi | Wajib |
|---|---|---:|
| `baseColorMap` | Warna utama permukaan | Tidak |
| `normalMap` | Detail arah permukaan | Tidak |
| `roughnessMap` | Variasi kasar/licin | Tidak |
| `aoMap` | Bayangan mikro | Tidak |
| `heightMap` | Detail relief shader ringan | Tidak |
| `surfaceMask` | Campuran beberapa material | Tidak |
| `detailColorMap` | Detail frekuensi tinggi | Tidak |
| `detailNormalMap` | Normal tambahan | Tidak |
| `emissionMap` | Cahaya dari material | Tidak |
| `flowMap` | Gerakan air atau efek | Tidak |

Jika texture slot kosong, shader memakai fallback warna, noise, roughness, dan normal datar internal.

### Parameter utama

```ts
type MapMasterMaterialParams = {
  family: MapMaterialFamily;
  baseColor: string;
  secondaryColor?: string;
  accentColor?: string;
  tiling: number;
  detailTiling: number;
  normalStrength: number;
  roughness: number;
  roughnessVariation: number;
  aoStrength: number;
  heightStrength: number;
  detailStrength: number;
  maskBlend: number;
  emissionColor?: string;
  emissionStrength?: number;
  alphaTest?: number;
  transparent?: boolean;
  flatShading?: boolean;
  mood: MapMaterialMood;
  seed: number;
};
```

Nilai `heightStrength` hanya mempengaruhi normal/lighting shader. Nilai ini tidak boleh melakukan displacement geometry agar collision tetap cocok dengan terrain.

## Material families

### 1. `terrain`

Untuk permukaan utama map.

- Bisa mencampur grass, dirt, rock, sand, atau snow melalui `surfaceMask`.
- Memakai world-space tiling.
- Mendukung detail normal dan roughness.
- Tidak memakai flat shading.
- Cocok untuk Padang Arunika, East Gate, field, dan map baru.

### 2. `grass`

Untuk tanah berumput dan grass tuft.

- Base color hijau tidak boleh polos sepenuhnya.
- Mendukung grass ground texture dan detail noise.
- Grass tuft menggunakan alpha test, bukan transparansi penuh.
- Tidak boleh membuat texture berbentuk kotak yang terlihat berulang.

### 3. `path`

Untuk jalan tanah, jalan batu, dan jalur utama.

- Harus lebih terang atau lebih gelap dari terrain di sekitarnya.
- Tepi jalan memakai feathered mask.
- Tidak mengubah lebar atau jalur collision.
- Mendukung variasi dirt, pebble, dan wetness.

### 4. `rock`

Untuk batu alam, tebing, rubble, dan cliff skirt.

- Roughness tinggi.
- Mendukung normal kuat dan detail retakan.
- Cliff memakai material yang sama dengan parameter arah/proyeksi berbeda.
- Bentuk batu tetap berasal dari geometry asli.

### 5. `sand`

Untuk padang pasir, pantai, oasis, dan tanah kering.

- Roughness tinggi.
- Detail grain halus.
- Mendukung variasi warna krem, kuning, cokelat, dan merah pasir.

### 6. `water`

Untuk sungai, danau, oasis, dan air terjun.

- Transparansi dikontrol terpusat.
- Mendukung flow/wave sederhana.
- Roughness lebih rendah daripada terrain.
- Emission hanya dipakai untuk highlight ringan, bukan bloom berat.
- Bridge mask tetap berada di shader; collision bridge tidak diubah.

### 7. `wood`

Untuk batang, plank, beam, crate, jembatan, dan props kayu.

- Memakai grain directional.
- Memiliki variasi `fresh`, `weathered`, dan `rotten`.
- Roughness tinggi.
- Tidak memakai material berbeda per object kecil jika bisa digabung dalam satu instance.

### 8. `stone`

Untuk temple, shrine, wall, ruin, dan bangunan batu.

- Mendukung block seam, moss, age, dan mineral variation.
- Cocok untuk material `temple_stone`, `shrine_stone`, dan `stone_wall`.

### 9. `foliage`

Untuk daun, tanaman, ivy, bunga, dan semak.

- Alpha test untuk daun.
- Two-sided rendering hanya untuk kartu daun.
- Tidak memakai shadow berat untuk setiap daun kecil.
- Mendukung variasi warna berdasarkan biome dan seed.

### 10. `metal`

Untuk metal props, lantern, dan dekorasi tambang.

- Metallic diatur berdasarkan profile, bukan per renderer.
- Mendukung rust, edge wear, dan emissive lantern.

### 11. `crystal`

Untuk crystal, mineral, dan objek bercahaya.

- Roughness rendah.
- Emission dikontrol melalui mood profile.
- Tidak boleh menggunakan dynamic light tambahan untuk setiap crystal.

## Mood dan pencahayaan material

Mood mengubah warna, contrast, saturation, roughness, dan emission. Mood tidak mengganti material family.

```ts
type MapMaterialMood =
  | 'bright'
  | 'neutral'
  | 'dark'
  | 'cold'
  | 'warm'
  | 'mystic';
```

### `bright`

Untuk Padang Arunika dan area siang.

- Contrast sedang.
- Saturation sedikit lebih tinggi.
- Shadow tidak terlalu pekat.
- Emission hanya untuk crystal, portal, dan efek kecil.

### `neutral`

Untuk map umum dan area transisi.

- Warna mendekati texture sumber.
- Roughness tidak dimodifikasi secara agresif.
- Cocok sebagai default semua map baru.

### `dark`

Untuk tambang, reruntuhan, dan area malam.

- Base color diturunkan melalui mood multiplier.
- Roughness tetap terbaca agar permukaan tidak menjadi bidang hitam.
- Detail normal dan edge highlight sedikit dinaikkan.
- Emission digunakan untuk crystal, lampu, atau material magic.

### `cold`

Untuk Frostfire Highlands.

- Bias warna biru/abu.
- Snow dan ice memakai roughness lebih rendah.
- Emission biru hanya pada crystal atau efek tertentu.

### `warm`

Untuk area pasir, api, dan material tanah kering.

- Bias warna kuning/oranye.
- Emission api dipisahkan dari base color.

### `mystic`

Untuk Benteng Hujan Meteor dan area magis.

- Bias ungu/biru gelap.
- Emission cyan, violet, atau orange berdasarkan objek.

## Material instances yang harus tersedia

```ts
const MAP_MATERIAL_INSTANCES = {
  terrainBright: {
    family: 'terrain', mood: 'bright',
    baseColor: '#8aa85c', tiling: 12,
  },
  terrainNeutral: {
    family: 'terrain', mood: 'neutral',
    baseColor: '#879b62', tiling: 12,
  },
  terrainDark: {
    family: 'terrain', mood: 'dark',
    baseColor: '#3f4b43', tiling: 10,
  },
  terrainCold: {
    family: 'terrain', mood: 'cold',
    baseColor: '#8798a4', tiling: 11,
  },
  terrainWarm: {
    family: 'terrain', mood: 'warm',
    baseColor: '#b99a63', tiling: 12,
  },
  grassBright: { family: 'grass', mood: 'bright' },
  grassDark: { family: 'grass', mood: 'dark' },
  pathDirt: { family: 'path', mood: 'neutral' },
  pathRocky: { family: 'path', mood: 'dark' },
  rockNatural: { family: 'rock', mood: 'neutral' },
  rockBasalt: { family: 'rock', mood: 'dark' },
  rockSnow: { family: 'rock', mood: 'cold' },
  sandBright: { family: 'sand', mood: 'bright' },
  sandWarm: { family: 'sand', mood: 'warm' },
  waterRiver: { family: 'water', mood: 'neutral' },
  waterDark: { family: 'water', mood: 'dark' },
  waterCold: { family: 'water', mood: 'cold' },
  woodWeathered: { family: 'wood', mood: 'neutral' },
  woodDark: { family: 'wood', mood: 'dark' },
  stoneTemple: { family: 'stone', mood: 'bright' },
  stoneRuin: { family: 'stone', mood: 'dark' },
  foliageBright: { family: 'foliage', mood: 'bright' },
  foliageDark: { family: 'foliage', mood: 'dark' },
  crystalMystic: { family: 'crystal', mood: 'mystic' },
};
```

Nama instance di atas adalah nama stabil. Map hanya boleh mereferensikan nama instance, bukan membuat parameter material baru secara lokal.

## Profile material setiap map

```ts
const MAP_MATERIAL_PROFILES = {
  arunika: {
    mood: 'bright',
    terrain: 'terrainBright',
    path: 'pathDirt',
    grass: 'grassBright',
    rock: 'rockNatural',
    water: 'waterRiver',
    wood: 'woodWeathered',
    stone: 'stoneTemple',
    foliage: 'foliageBright',
  },
  verdantPlains: {
    mood: 'bright',
    terrain: 'terrainBright',
    path: 'pathDirt',
    grass: 'grassBright',
    rock: 'rockNatural',
    water: 'waterRiver',
    wood: 'woodWeathered',
    stone: 'stoneTemple',
    foliage: 'foliageBright',
    terrainAddon: 'rocky-terrain-02',
    grassAddon: 'grass-medium-01',
  },
  eastGateArunika: {
    mood: 'bright',
    terrain: 'terrainBright',
    path: 'pathDirt',
    grass: 'grassBright',
    rock: 'rockNatural',
    water: 'waterRiver',
    wood: 'woodWeathered',
    stone: 'stoneTemple',
    foliage: 'foliageBright',
  },
  ironveilMines: {
    mood: 'dark',
    terrain: 'terrainDark',
    path: 'pathRocky',
    grass: 'grassDark',
    rock: 'rockBasalt',
    water: 'waterDark',
    wood: 'woodDark',
    stone: 'stoneRuin',
    foliage: 'foliageDark',
  },
  whisperingWilds: {
    mood: 'dark',
    terrain: 'terrainDark',
    path: 'pathDirt',
    grass: 'grassDark',
    rock: 'rockNatural',
    water: 'waterDark',
    wood: 'woodWeathered',
    stone: 'stoneRuin',
    foliage: 'foliageDark',
  },
  frostfireHighlands: {
    mood: 'cold',
    terrain: 'terrainCold',
    path: 'pathRocky',
    grass: 'grassDark',
    rock: 'rockSnow',
    water: 'waterCold',
    wood: 'woodWeathered',
    stone: 'stoneRuin',
    foliage: 'foliageDark',
  },
  sunkenRuins: {
    mood: 'dark',
    terrain: 'terrainDark',
    path: 'pathRocky',
    grass: 'grassDark',
    rock: 'rockBasalt',
    water: 'waterDark',
    wood: 'woodDark',
    stone: 'stoneRuin',
    foliage: 'foliageDark',
  },
  meteorfallCitadel: {
    mood: 'mystic',
    terrain: 'terrainDark',
    path: 'pathRocky',
    grass: 'grassDark',
    rock: 'rockBasalt',
    water: 'waterDark',
    wood: 'woodDark',
    stone: 'stoneRuin',
    foliage: 'foliageDark',
    crystal: 'crystalMystic',
  },
  jayantara: {
    mood: 'cold',
    terrain: 'terrainCold',
    path: 'pathRocky',
    grass: 'grassDark',
    rock: 'rockSnow',
    water: 'waterCold',
    wood: 'woodDark',
    stone: 'stoneRuin',
    foliage: 'foliageDark',
  },
  sandsLocation: {
    mood: 'warm',
    terrain: 'sandWarm',
    path: 'sandWarm',
    grass: 'grassBright',
    rock: 'rockNatural',
    water: 'waterRiver',
    wood: 'woodWeathered',
    stone: 'stoneTemple',
    foliage: 'foliageBright',
    source: 'embedded-glb-materials',
  },
};
```

Profile di atas adalah target pengelompokan. Untuk `Sands Location`, material embedded GLB tetap menjadi sumber utama karena map tersebut memiliki material dan texture internal sendiri.

## Registry texture yang sudah tersedia

### Rocky Terrain 02 — Padang Arunika

Lokasi:

```text
public/assets/materials/terrain/arunika/rocky-terrain-02/
```

Texture:

- `rocky_terrain_02_diff_2k.jpg` — base color
- `rocky_terrain_02_nor_gl_2k_v2.webp` — normal OpenGL
- `rocky_terrain_02_rough_2k_v2.webp` — roughness
- `arunika_surface_mask_v2.webp` — grass/rock/path/transition mask

### Grass Medium 01 — Padang Arunika

Lokasi:

```text
public/assets/materials/terrain/arunika/grass-medium-01/
```

Texture:

- `grass_ground_color_2k.webp`
- `grass_ground_normal_rough_1k.webp`
- `grass_tuft_color_alpha_2k.webp`
- `grass_tuft_normal_rough_1k.webp`

### Stylized Tree Pack

Texture bark:

- `T_Stylized_Bark_1_COLOR.png`
- `T_Stylized_Bark_1_NORM.png`

Texture daun:

- Acacia
- Beech
- Joshua
- Maple
- Oak
- Pine
- Spruce
- Willow

Texture tambahan:

- `T_Moss_Normal.png`
- `T_Snow_Normal.png`
- `T_WhiteBlack_Gradient.png`
- `T_BlackWhite_Gradient.png`

### Unreal Normandy

Asset ini menjadi sumber texture detail untuk terrain, grass, stone, rock, plant, wood, metal, dan lantern.

Texture families utama:

- `LC_Ground*`
- `LC_Grass*`
- `LC_Basalt*`
- `LC_Cliff*`
- `GroundDry*`
- `GroundGrassGravel*`
- `GroundGrassMoss*`
- `GroundGrassSoil*`
- `GroundMossy*`
- `GroundRockyRoad*`
- `GroundSnow*`
- `GroundSoilExcavated*`
- `StoneSurface*`
- `WoodSurface*`
- `RottenWoodSurface*`
- `MetalRust*`
- `PlantTypeA/B/C*`
- `LS_GrassTall*`
- `LS_Moss*`
- `Props_Lantern*`
- `IvyLeaves*`

Mask/control texture seperti cloud, dust, grunge, crack, particle, dan global normal hanya boleh dipakai jika master shader memiliki slot yang sesuai. Texture tersebut tidak boleh otomatis dianggap sebagai base color.

### Sands Location

Material embedded yang terdeteksi:

- `map_2_island1`
- `map_2_object1`
- `map_2_terrain1`
- `map_4lambert5SG`

GLB memiliki 5 image PNG embedded. Karena tidak memiliki file eksternal terpisah, material ini harus dipertahankan oleh importer atau dikonversi satu kali ke registry asset resmi.

## Aturan penggunaan di renderer

Renderer map hanya boleh melakukan langkah berikut:

```ts
const profile = getMapMaterialProfile(mapId);
const terrain = createMapMaterial(profile.terrain, profile.mood);
const path = createMapMaterial(profile.path, profile.mood);
const water = createMapMaterial(profile.water, profile.mood);
```

Renderer tidak boleh:

- Memanggil `new MeshStandardMaterial` untuk terrain/map prop secara langsung.
- Memasukkan hex color baru yang tidak terdaftar.
- Mengakses path texture mentah tanpa registry.
- Membuat sistem material baru hanya untuk satu map.
- Mengubah collision atau geometry karena texture.
- Menggunakan texture 4K tanpa alasan dan tanpa deklarasi memory budget.

## Aturan asset baru

Setiap material atau texture baru harus didaftarkan dengan metadata berikut:

```ts
type MapMaterialAsset = {
  id: string;
  family: MapMaterialFamily;
  source: string;
  baseColor?: string;
  normal?: string;
  roughness?: string;
  ao?: string;
  height?: string;
  mask?: string;
  colorSpace: 'srgb' | 'linear';
  tileWorldUnits: number;
  normalStrength: number;
  compatibleMoods: MapMaterialMood[];
};
```

Validasi wajib:

- Semua file texture ada.
- Format image dapat dibaca browser.
- Color space benar.
- UV atau world projection tidak menghasilkan stretching parah.
- Texture tidak terlihat sebagai tile kotak pada jarak kamera gameplay.
- Material masih terbaca dalam mood bright dan dark.
- Tidak ada error shader saat texture gagal dimuat.

## Urutan implementasi yang direkomendasikan

1. Buat `MapMaterialFamily`, `MapMaterialMood`, dan registry asset.
2. Pindahkan tujuh material prosedural lama ke fallback master shader.
3. Pindahkan material Arunika ke instance master shader.
4. Uji Padang Arunika sebagai reference map karena sudah memiliki Rocky Terrain dan Grass Medium.
5. Terapkan profile bright ke Kota Arunika dan East Gate.
6. Terapkan profile dark ke Tambang Selubung Besi, Rimba Bisik, dan Reruntuhan Tenggelam.
7. Terapkan profile cold ke Jayantara dan Frostfire Highlands.
8. Terapkan profile mystic ke Benteng Hujan Meteor.
9. Terapkan profile warm ke Sands Location tanpa merusak material embedded GLB.
10. Hapus pemanggilan material map lama setelah semua profile lolos pengujian visual dan runtime.

## Definition of done

Master material dianggap siap jika:

- Semua map mengambil material dari profile terdaftar.
- Tidak ada material terrain yang dibuat langsung oleh `world.ts` atau renderer map.
- Mood bright/dark/cold/warm dapat diganti melalui profile.
- Texture gagal dimuat tetap menghasilkan fallback yang layak.
- Terrain, jalan, bridge, collision, NPC, monster, dan navigasi tidak berubah.
- Semua material tetap stabil setelah pindah map berulang kali.
- Tidak ada console error, shader error, atau texture path 404.
- Texture tile tidak tampak sebagai kotak besar dari kamera gameplay.
- Material baru dapat ditambahkan hanya dengan registry dan profile, tanpa menulis ulang renderer.

## Status dokumen

- Status: **Blueprint untuk implementasi**
- Implementasi master shader: **Belum dilakukan**
- Geometry/collision/gameplay: **Tidak termasuk perubahan**
- Map profile: **Sudah didefinisikan sebagai target awal**
- Sumber addon existing: Rocky Terrain 02, Grass Medium 01, Stylized Tree Pack, Unreal Normandy, Sands Location GLB
