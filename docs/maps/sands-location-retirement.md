# Penghapusan Sands Location

Sands Location (`sands-location`) dihapus dari registry map, menu M, koneksi kota, NPC, quest aktif dalam registry, spawn, dekorasi pohon, lighting, dan jalur loading/movement/camera khusus di engine.

Aset runtime `public/assets/maps/sands-location.glb` (9.267.192 byte) dan helper koordinat khusus `lib/game/sands-coordinates.ts` dihapus. Aset sumber/master tidak disentuh. `ImportedMapGround` dan `cloneImportedMap` tetap dipakai map lain; tesnya memakai terrain sintetis agar tidak membutuhkan GLB Sands.

Save yang berada di Sands otomatis memakai Verdant Plains dan entry Arunika Rest melalui migrasi field yang sudah tersedia. Inventory, equipment, gold, level, dan riwayat progress tetap tersimpan. Save yang berada dalam kota mempertahankan kota dan koordinatnya. ID Sands tidak lagi menerima teleport.

Validasi: 34/34 tes map, migrasi, importer, tree, dan release boundary lulus; typecheck serta lint lulus. Browser terisolasi memverifikasi menu tanpa Sands, migrasi save Sands, perjalanan Averion–Verdant Plains, dan reload tanpa error. Bukti: `output/verdant-plains/sands-retirement/retirement.json`.

Perubahan lokal; tidak ada commit, push, atau publish. Dokumen audit lama yang mencantumkan Sands merupakan catatan historis sebelum penghapusan ini.
