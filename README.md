# Digital Twin Jembatan

Situs pemantauan struktur jembatan: kembaran digital tiga dimensi, telemetri
sensor waktu nyata, analisa deret waktu, perbandingan terhadap garis dasar,
berkas aset, dan simulasi skenario pembebanan.

```
jembatan-digital-twin/
├── frontend/   Vite + React 18 + TypeScript + three.js
└── backend/    Express — telemetri, penilaian risiko, skenario, autentikasi
```

## Menjalankan

Bawaannya **mode peraga**: seluruh angka dibangkitkan mesin simulasi di
peramban dan data contoh, tanpa memerlukan server sama sekali.

```bash
npm install
npm run dev:web
```

Antarmuka: <http://localhost:5174>

Untuk menyalakan API Express sekaligus:

```bash
cp backend/.env.example backend/.env
cp frontend/.env.example frontend/.env    # setel VITE_API_ENABLED=true
npm run dev
```

- Antarmuka: <http://localhost:5174>
- API: <http://localhost:5175>

Antarmuka tidak punya layar masuk. Titik akhir yang mengubah keadaan di server
tetap memerlukan token, jadi dalam mode API kendali skenario dijalankan mesin
lokal disertai keterangannya — lihat `backend/README.md` bila kendali sisi
server memang diperlukan.

## Mode peraga dan data dummy

Selama `VITE_API_ENABLED` tidak disetel `true`, antarmuka tidak menghubungi
server sama sekali — bilah samping menandainya dengan label **Mode demo · data
dummy**. Dua sumber angkanya:

- **Telemetri** dibangkitkan `frontend/src/domain/simulationEngine.ts`, rumus
  yang sama persis dengan mesin di sisi server.
- **Berkas aset** — riwayat inspeksi, pekerjaan pemeliharaan, inventaris
  sensor, dan kontak penanggung jawab — adalah data karangan di
  `frontend/src/domain/demoData.ts`. Berkas itulah yang dibuang ketika aplikasi
  disambungkan ke data sungguhan.

Artinya hasil `npm run build` dapat disajikan sebagai berkas statis dan tetap
berfungsi penuh tanpa server.

Bila API dinyalakan namun kemudian berhenti di tengah sesi, antarmuka pindah
sendiri ke mesin lokal daripada membeku, dan menyatakan alasannya.

## Laju pengambilan sampel

Jembatan yang sedang tenang berubah dalam hitungan jam, jadi antarmuka
mengambil satu cuplikan **per menit** selama tidak ada skenario berjalan —
bilah statusnya berbunyi *Pemantauan rutin*. Begitu sebuah skenario dijalankan,
laju naik ke **200 ms** dan bilahnya berbunyi *Pemantauan langsung*.

Laju penuh juga dipertahankan selama struktur masih bergerak menuju kondisi
barunya, termasuk saat pulih setelah skenario dihentikan; begitu seluruh kanal
sampai di sasarannya, laju turun kembali ke satu menit.

### Yang ditampilkan adalah rerata satu menit

Angka pada kartu kanal, indeks kesehatan, skor risiko, dan tiap titik pada
bagan bukan cuplikan sesaat, melainkan **rerata satu menit** — sama seperti
alat ukur lapangan, yang mengirim rerata satu selang alih-alih bacaan sesaat.
Riak dan derau membuat nilai sesaat melompat beberapa persen antar cuplikan,
dan yang menentukan kondisi struktur adalah tingkat yang bertahan, bukan satu
puncak.

Yang berbeda antara kedua laju hanya *kapan* nilai baru muncul, bukan artinya:

| Mode | Cuplikan mentah | Nilai tampil |
|---|---|---|
| Pemantauan rutin | 12 cuplikan berjarak 5 detik, sekali tiap menit | rerata ke-12 cuplikan itu |
| Pemantauan langsung | satu cuplikan tiap 200 ms | rerata 300 cuplikan terakhir, diperbarui tiap 200 ms |

Jendela reratanya dikosongkan setiap kali keadaan berpindah — skenario
dijalankan, dihentikan, atau perbaikan dicatat. Tanpa itu rerata satu menit
akan menahan angka dari keadaan sebelumnya, dan struktur yang baru dibebani
terbaca seolah belum berubah; dengan itu, kanal sudah melewati ambang waspada
dalam hitungan detik setelah skenario dijalankan, tetapi tetap naik mulus
tanpa berloncatan.

## Aset

Katalog berisi satu jembatan. Pemilih aset di bilah samping muncul sendiri
begitu `frontend/src/domain/bridges.ts` berisi lebih dari satu entri, dan sebuah
entri dengan `model.kind: 'glb'` akan memakai penampil model kendali bersumber
alih-alih rangka prosedural — keduanya tetap didukung, hanya tidak dipakai
sekarang.

## Bahasa antarmuka

Seluruh teks yang dilihat pengguna berbahasa **Indonesia** — nama menu, judul,
label, tombol, status, teks skenario, dan data contoh berkas aset. Begitu pula
dokumentasi dan komentar kode.

Tiga sebutan sengaja dibiarkan berbahasa Inggris karena sudah menjadi nama, bukan
keterangan: **Bridge Digital Twin** (nama produk pada judul halaman dan bilah
samping), **Dashboard**, dan **Digital Twin**. Menerjemahkannya justru
menyulitkan — "kembaran digital" tidak dipakai orang di lapangan.

Nilai status di dalam kode adalah `AMAN` / `WASPADA` / `KRITIS`, dan ia memang
nilai domain yang dipakai mesin simulasi, penilaian risiko, dan API. Karena
bahasa tampilan sekarang sama dengan bahasa nilai domainnya, nilai itu
ditampilkan apa adanya tanpa lapisan penerjemah.

## Halaman

Bilah samping dikelompokkan menurut sifat halamannya, bukan menurut asal
datanya. Model 3D sebelumnya berada di kelompok aset, dan itu salah tempat: ia
layar pemantauan langsung, bukan lembar arsip.

| Kelompok | Halaman | Isi |
|---|---|---|
| Pemantauan | **Dashboard** | Halaman muka. Indeks kesehatan, skor risiko, rekomendasi pemeliharaan, log peristiwa, seluruh kanal sensor |
| Pemantauan | **Digital Twin** | Model 3D yang bereaksi terhadap telemetri: batang memerah seiring regangan, lantai miring saat tumpuan rusak, kendaraan melintas sesuai skenario |
| Kajian | **Deret waktu** | Deret waktu tiap kanal terhadap ambang waspada dan kritis, dengan garis dasar sebagai pembanding |
| Kajian | **Perbandingan** | Dua grafik berdampingan: rekaman kondisi normal dan kondisi sekarang, pada rentang sumbu yang sama |
| Kajian | **Skenario** | Delapan skenario dalam tiga keluarga, masing-masing menyebut dampak, laju, dan apakah kondisinya pulih sendiri |
| Berkas aset | **Informasi** | Identitas aset: ukuran, data teknis, beban rencana, nilai kondisi, penanggung jawab |
| Berkas aset | **Inspeksi** | Riwayat pemeriksaan lapangan beserta temuan dan nilai kondisi tiap kali |
| Berkas aset | **Pemeliharaan** | Pekerjaan pemeliharaan: selesai, berjalan, terjadwal, beserta biayanya |
| Berkas aset | **Sensor** | Inventaris alat terpasang: model, letak, umur pemasangan, baterai, sinyal |

### Berkas aset sebagai acuan

Telemetri hanya tahu keadaan sekarang. Yang membuat sebuah angka dapat
ditafsirkan justru datang dari berkas aset: 84 µm/m itu banyak atau sedikit
tergantung beban rencananya, dan lendutan yang naik berarti lain bila inspeksi
tiga bulan lalu sudah mencatat retak pada gelagar yang sama. Karena itu isinya
dipecah menjadi empat halaman yang berdiri sendiri — **Informasi**,
**Inspeksi**, **Pemeliharaan**, dan **Sensor** — karena tiap bagiannya dipakai
orang yang berbeda pada saat yang berbeda. Isinya juga tidak berhenti di keempat
halaman itu:

- **dashboard** — kartu *Acuan aset*: beban rencana, lalu lintas harian beserta
  bagian kendaraan berat, nilai kondisi, pekerjaan pemeliharaan yang sedang
  berjalan atau terjadwal, dan temuan inspeksi terakhir
- **time series** — tiap kanal menyebut unit sensor yang mengukurnya beserta model
  dan sisa baterainya; garis yang bergerak aneh bisa berarti strukturnya
  berubah, bisa juga berarti alatnya yang mulai habis daya

Sumbernya satu berkas, `frontend/src/domain/demoData.ts`, dengan fungsi
penyalur di bagian bawahnya (`sensorUnitFor`, `inspeksiTerakhir`,
`pekerjaanBerjalan`, `pekerjaanBerikutnya`, `jarakWaktu`).

## Model 3D

Ada dua jenis model, dipilih lewat bidang `model.kind` pada katalog jembatan.

**`procedural`** — rangka baja tipe Warren yang dibangkitkan langsung oleh
three.js (`frontend/src/three/proceduralBridge.ts`). Setiap batang membawa tag
sehingga skenario kerusakan dapat menyebut elemen mana yang terdampak, dan
kelompok bagian dapat disembunyikan satu per satu untuk melihat ke dalam
struktur. Delapan penanda sensor dapat diklik untuk membaca nilainya di tempat.

Adegannya **siang hari**: yang dikerjakan di halaman itu adalah membaca warna —
batang mana yang memerah, elemen mana yang ditandai rusak, penanda mana yang
keluar rentang — dan warna hanya terbaca kalau bendanya terang.

Penanda sensor berbentuk **pelat bertangkai** yang ujungnya menunjuk titik
pasang, bukan bola berwarna sama untuk semua kanal. Warnanya mengikuti status
kanal — hijau aman, kuning waspada, merah kritis — dan digambar di atas
strukturnya, karena ia keterangan tentang model, bukan benda di dalamnya.

Titik bawaannya diturunkan dari tetapan geometri model, bukan dikira-kira:
ujung runcing penanda jatuh persis di koordinat `SENSOR_SPOTS`, jadi koordinat
itu harus berada di permukaan elemen yang disebut keterangan kanalnya. Acuannya
ditulis sebagai komentar di atas tetapan itu.

Penanda juga **dapat diseret**, tetapi hanya setelah tombol **Geser penanda**
dinyalakan. Di luar mode itu penanda sekadar dibaca, dan tarikan di atasnya
memutar pandangan seperti tarikan di tempat lain. Sakelarnya ada karena halaman
ini lebih sering dibaca daripada diatur: letak penanda adalah data pemasangan,
dan satu tarikan yang meleset saat hendak memutar pandangan tidak boleh
memindahkan sensor tanpa disadari.

Saat mode geser menyala, titik pasang baru dicari dengan menembakkan sinar ke
struktur, bukan ke bidang khayal di depan kamera: sensor menempel pada elemen,
dan penanda yang bisa dilepas melayang di udara hanya menghasilkan letak yang
tidak berarti. Menekan penanda tanpa menggeser tetap berarti membacanya —
geseran di bawah lima piksel dihitung sebagai klik.

Letaknya disimpan di `localStorage` peramban, per jembatan
(`frontend/src/lib/sensorSpots.ts`), dan tombol **Kembalikan letak penanda**
muncul begitu ada yang pernah digeser. Kuncinya bernomor versi: menaikkan nomor
itu membuang simpanan lama, yang diperlukan setiap kali titik bawaan diperbaiki
— tanpa itu peramban yang sudah pernah menyimpan geseran tidak akan pernah
melihat perbaikannya. Simpanan itu tidak ikut berpindah ke
perangkat lain dan hilang bila data situs dibersihkan; untuk aset sungguhan,
letak sensor semestinya menjadi bidang pada katalog jembatan di sisi server —
yang diganti fungsi-fungsi di modul itu, bukan pemanggilnya.

Dua keadaan lingkungan ikut terlihat, bukan hanya terbaca sebagai angka.
**Kantong angin** berdiri di oprit timur dan membaca anemometer: menggantung
lemas saat tenang, terangkat mendatar dan berkibar saat angin kencang — persis
alasan benda itu masih dipasang di bandara yang sudah punya anemometer digital.
**Sungainya** naik, mengeruh, dan gelombangnya mengasar saat skenario banjir
berjalan, lalu surut perlahan setelah dihentikan; muka air tidak punya sensor
pada aset ini, jadi datang dari bidang `environment.flood` pada skenarionya.

Pandangannya satu: **isometri**, diputar dan diperbesar langsung dengan tetikus.
Pandangan ortogonal — rencana, elevasi, potongan — adalah alat gambar teknik,
dan yang membuatnya berguna di sana tidak ada di sini: tidak ada garis ukur,
tidak ada kop, tidak ada skala yang dapat dicetak. Daftar kelompok bagiannya
juga pindah ke dalam gambar sebagai satu tombol yang membuka daftar, bukan panel
tetap di sebelahnya: yang disembunyikan dan disorot adalah benda di dalam gambar
itu, jadi saklarnya dipasang di tempat akibatnya terlihat.

Lingkungannya dimodelkan menerus: lantai jembatan, oprit di kedua ujung, kerb,
pagar pengaman, dan timbunan tanah di bawah oprit disambung pada ketinggian yang
sama sehingga tidak ada bagian jalan yang tampak melayang. Kendaraan dibentuk
dari siluet sampingnya — satu profil memuat kap mesin, kemiringan kaca depan,
garis atap, dan buritan — lalu diekstrusi ke arah lebar; truk memakai kabin,
boks bersirip, dan roda ganda pada sumbu belakang. Jumlah dan lajunya mengikuti
skenario yang sedang berjalan.

**`glb`** — memuat berkas GLB beserta manifes bagiannya
(`frontend/src/three/GlbViewer.tsx`). Tiap bagian membawa tingkat kepercayaan
geometrinya, asal-usul bentuknya, dan kontrol dimensi yang dipakainya, sehingga
penampil dapat menyatakan seberapa kuat dasar sebuah bentuk — bukan sekadar
menampilkannya. Aplikasi ini menyertakan satu model acuan yang memakai kontrak
tersebut; lihat **Atribusi** di bawah.

## API

Ringkasan titik akhir ada di [`backend/README.md`](backend/README.md).
Membaca telemetri tidak memerlukan token; menjalankan skenario dan menjeda
aliran data memerlukannya.

Seluruh keadaan disimpan dalam memori proses API, jadi tidak ada basis data
yang perlu disiapkan. Data hilang saat proses berhenti.

## Cara kondisi struktur dinilai

Penilaian bertumpu pada **kelebihan nilai di atas kondisi layan normal**, bukan
rasio mentah terhadap ambang kritis. Ini penting: pada kondisi normal lendutan
sudah berada di sekitar setengah ambang kritisnya, sehingga rasio mentah akan
melaporkan struktur yang sehat sebagai setengah rusak.

- **Indeks kesehatan** — 100 saat seluruh kanal struktural berada di nilai
  dasarnya, 0 saat menyentuh ambang kritis. Kanal terburuk diberi bobot lebih
  besar daripada rata-ratanya.
- **Skor risiko** — gabungan rata-rata berbobot seluruh kanal dan kanal
  struktural terburuk, karena satu batang yang hampir gagal tetap berbahaya
  walau kanal lain tenang.
- **Prioritas pemeliharaan** — diturunkan dari skor risiko, tetapi satu kanal
  yang sudah melewati ambang kritis selalu menaikkannya ke prioritas tertinggi.

Bobot tiap kanal dinyatakan di `backend/src/domain/sensors.js` dan salinannya di
`frontend/src/domain/sensors.ts`, sehingga setiap angka yang muncul di
antarmuka dapat ditelusuri kembali ke satu kanal.

## Skenario pembebanan

Sebuah skenario menyatakan tujuh hal: pemicunya, beban yang bekerja, kanal yang
bergerak beserta pengalinya, elemen struktur yang terdampak, status yang
diharapkan, **laju** perubahannya, dan **apakah kondisinya pulih sendiri**.

Dua yang terakhir itu yang membedakan satu keadaan waspada dari yang lain.
Waspada karena kemacetan hilang bersama kemacetannya; waspada karena retak lelah
tidak. Tanpa membedakan keduanya, semua skenario terlihat sama: naik lalu turun.

Delapan skenario disusun sebagai tangga dalam tiga keluarga. Keluarga beban
lingkungan berhenti di anak tangga waspada — tidak ada skenario lingkungan yang
sampai kritis sejak skenario badai dilepas:

| Keluarga | Laju | Pulih sendiri | AMAN | WASPADA | KRITIS |
|---|---|---|---|---|---|
| Beban lalu lintas | cepat | ya, penuh | Arus normal | Jam sibuk / kemacetan | Truk melebihi batas gandar |
| Beban lingkungan | sedang | ya, mengikuti cuaca | — | Angin kencang · Suhu ekstrem | — |
| Kerusakan struktur | bertahap | **tidak** | — | Retak lelah pada girder | Kegagalan bantalan · Gerusan pilar |

Keluarga kerusakan menitipkan **sisa** pada kanal yang terdampak: setelah
skenario dihentikan, pembacaannya tidak kembali ke nilai dasar. Sisa itu hanya
hilang lewat tombol **Record a repair**, yang mewakili pekerjaan lapangan yang
benar-benar dilakukan. Selama sisa itu ada, bilah samping menandainya.

Status yang benar-benar dihasilkan mesin simulasi, diukur setelah 600 langkah:

| Skenario | Kesehatan | Risiko | Status |
|---|---|---|---|
| Arus lalu lintas normal | 94 | 6 · RENDAH | AMAN |
| Jam sibuk / kemacetan | 48 | 50 · SEDANG | WASPADA |
| Truk melebihi batas gandar | 21 | 78 · KRITIS | KRITIS |
| Angin kencang | 53 | 40 · SEDANG | WASPADA |
| Suhu ekstrem siang hari | 56 | 40 · SEDANG | WASPADA |
| Retak lelah pada girder | 59 | 33 · SEDANG | WASPADA |
| Kegagalan bantalan tumpuan | 24 | 64 · TINGGI | KRITIS |
| Gerusan pilar pascabanjir | 17 | 74 · TINGGI | KRITIS |

## Perbandingan dua kondisi

Halaman **Perbandingan** menjajarkan dua grafik dari struktur yang sama: rekaman
saat jembatan berada pada kondisi normal, dan kondisi sekarang.

Rekaman sebelah kiri berhenti terisi begitu sebuah skenario dijalankan, jadi
yang dibandingkan benar-benar "sebelum" dan "sesudah" — bukan dua potongan waktu
yang sama-sama sedang terbebani. Kedua grafik memakai rentang sumbu tegak yang
sama dan garis ambangnya berada pada ketinggian yang sama, karena tanpa itu
garis yang lebih tinggi belum tentu berarti nilai yang lebih besar.

## Sistem tampilan

Mengikuti bahasa visual Digital Twin Bendungan Budong Budong
(digital-twin.be-stesy.cloud): bidang senja gelap berwarna tinta laut, panel
kaca tembus pandang yang mengapung di atasnya, dan satu biru merek untuk
seluruh elemen interaktif.

Token ada di `frontend/src/styles/tokens.css`, komponennya di
`frontend/src/styles/app.css`.

| Peran | Nilai |
|---|---|
| Tinta (bidang) | `#030b14` → `#1b3b53` |
| Kabut (teks) | `#f2f8ff` → `#7590ab` |
| Biru merek | `#7cc4ff` → `#1268c9` |
| Keadaan | normal `#34d399` · waspada `#fbbf24` · siaga `#fb923c` · bahaya `#f87171` |
| Huruf | Plus Jakarta Sans, angka dengan lebar tetap |
| Sudut | kaca 20 px · chip 14 px |

Empat aturan yang menjaga tampilannya tetap satu benda:

- **Palet keadaan terpisah dari palet antarmuka.** Hijau, kuning, dan merah
  hanya menyatakan status struktur; tidak pernah dipakai sebagai hiasan.
- **Warna saja tidak cukup.** Setiap label keadaan membawa titik, jadi status
  tetap terbaca oleh pembaca yang tidak membedakan hijau dari merah.
- **Kaca yang bertumpuk tidak saling menjatuhkan bayangan.** Di dalam satu
  kolom, garis rambut sudah cukup jadi tepinya — bayangan yang jatuh ke benda
  di sebelahnya terbaca sebagai kotoran di sambungan, bukan sebagai ketinggian.
- **Satu isyarat gerak.** Hanya kartu yang dapat diklik yang mengangkat dirinya
  saat disentuh kursor.

Adegan 3D ikut diturunkan ke senja — langit tinta, matahari rendah yang hangat,
cahaya tepi biru dari belakang, dan lampu jalan menyala — supaya panggungnya
sewarna dengan antarmuka di sekitarnya, bukan jendela siang di dinding malam.

## Atribusi

Model acuan **Manhattan Bridge** di `frontend/public/models/manhattan/` berasal
dari proyek [manhattan-bridge-3d](https://github.com/Ethical-Tech-CoLab/manhattan-bridge-3d)
milik Ethical Tech CoLab, di bawah lisensi **CC BY 4.0**. Sitasi yang diminta:

> *Manhattan Bridge Digital Twin: a source-governed control skeleton.*
> Ethical Tech CoLab, 2026.

Rincian ada di `frontend/public/models/manhattan/ATRIBUSI.md`. Angka dimensi
pada model itu milik proyek tersebut, bukan hasil pengukuran aset yang dipantau
aplikasi ini. Pendekatan penampil GLB — memuat bagian beradres dari `extras`
glTF, pembingkaian kamera yang pas persis, pandangan ortogonal baku, dan
penyajian tingkat kepercayaan — juga diadaptasi dari proyek tersebut (kode MIT).

Rancangan lapisan pemantauan — mesin simulasi deterministik dengan penuaan
struktur, pengukur risiko berbobot, dan rekomendasi pemeliharaan berjenjang —
mengikuti pendekatan pada
[Smart-Bridge-Digital-Twin-Dashboard](https://github.com/aadityakavi28-spec/Smart-Bridge-Digital-Twin-Dashboard).

## Membangun untuk produksi

```bash
npm run build      # menghasilkan frontend/dist
npm start          # menjalankan API, bila dipakai
```

Sajikan `frontend/dist` lewat peladen statis apa pun. Tanpa penyetelan
tambahan, hasil bangunan itu berjalan dalam mode peraga dan tidak memerlukan
API. Bila API dipasang pada asal yang berbeda, setel `VITE_API_ENABLED=true`
dan `VITE_API_BASE` saat membangun, serta `FRONTEND_URL` pada API agar daftar
origin yang diizinkan mengikat.
