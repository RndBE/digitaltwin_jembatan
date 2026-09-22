# Digital Twin Jembatan

Situs pemantauan struktur jembatan: kembaran digital tiga dimensi, telemetri
sensor waktu nyata, tabel data mentah yang dapat diunduh dan dicetak, analisa
deret waktu, perbandingan terhadap garis dasar, ambang tingkat siaga yang dapat
diatur, berkas aset, dan simulasi skenario pembebanan.

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

## Kerangka layar

Cangkangnya setinggi layar dan **hanya isi halaman yang bergulir**. Rel
navigasi dan bilah tingkat siaga tinggal diam; `main` yang membawa
`overflow-y: auto`.

Sebelumnya yang bergulir adalah jendela, dengan rel dan bilah dipaku
`position: sticky`. Dua hal rusak karenanya: posisi gulir terbawa lintas layar,
sehingga halaman yang lebih pendek daripada halaman sebelumnya terbuka dalam
keadaan tergulir ke ruang kosong; dan tiap `sticky` menambah satu lapisan yang
harus disusun ulang tiap bingkai. Dengan tinggi dikunci, kerangkanya benar-benar
diam, tiap layar mulai dari atas, dan `main` yang dipasangi `key={screen}`
memang menghasilkan wadah gulir yang baru tiap kali berpindah.

Jarak bawah dibawa `main`, bukan lajurnya: baris terakhir halaman harus punya
ruang di bawahnya ketika digulir sampai habis, dan jarak yang dipasang pada
wadah yang tidak bergulir tidak pernah ikut tergulir.

Di bawah lebar tablet aturannya dibalik — gulirannya dikembalikan ke jendela dan
bilah siaga dipaku `sticky`. Rel di sana sudah berubah jadi bilah mendatar, jadi
tidak ada lagi dua kolom yang perlu bergulir sendiri-sendiri; dan peramban
ponsel hanya menyembunyikan bilah alamatnya ketika yang bergulir memang
jendelanya.

### Pembagian rel dan kepala

**Rel memuat yang tetap, kepala memuat yang berubah.** Itu satu kalimat yang
menentukan di mana tiap keterangan tinggal:

| Rel, dari atas ke bawah | Kepala lajur isi, dari kiri ke kanan |
|---|---|
| Tanda platform dan namanya | Nama halaman yang sedang dibuka |
| Aset yang dipantau — nama dan ruasnya | Tingkat siaga, kode aturan, kriterianya |
| Navigasi, tiga kelompok | Sejak kapan tingkat itu berlaku |
| Tingkat siaga ringkas dan asal data | Denyut aliran, nama mode, tanggal dan jam |
| | Tombol menuju Aturan & ambang |

Rel berdiri **utuh dari atas ke bawah**, dan kepala mulai di sebelah kanannya.
Pembagian itu sempat ditinggalkan: kepala pernah dinaikkan menjadi satu baris
penuh lebar di atas rel sekaligus, dengan tanda platform ikut pindah ke
dalamnya. Yang hilang karenanya adalah **batas tegak** antara rel dan isi —
relnya jadi tampak menggantung di bawah sesuatu, bukan berdiri sendiri. Batas
itu dikembalikan.

Riwayat bentuknya, karena tiap langkah membuang satu baris:

1. **Dua bilah bertumpuk** — tingkat siaga, lalu keadaan aliran data
   (`LiveStrip`) tepat di bawahnya. Dua baris untuk pekerjaan satu baris, dan
   yang di bawah cuma ada di tiga halaman sehingga tinggi halaman melompat tiap
   berpindah menu.
2. **Satu bilah** di dalam lajur kanan; `LiveStrip` dihapus.
3. **Satu kepala penuh lebar** di atas rel — dicoba, lalu ditinggalkan karena
   batas tegaknya hilang.
4. **Kepala lajur isi** seperti sekarang (`components/AppHeader.tsx`), dengan
   nama halaman di kirinya.

Namanya dibaca dari `SCREEN_TITLES` — daftar yang sama yang menamai tab
peramban, jadi keduanya tidak akan pernah berbeda.

#### Badan halaman tidak lagi punya tajuk maupun pengantar

Begitu nama halaman naik ke kepala, tajuk besar `PageHeader` di bawahnya
mengulang salah satu dari dua hal yang **sudah tertulis di kerangka yang tidak
ikut tergulir**: nama halamannya, atau nama jembatannya yang menetap di rel.
Tiga baris setinggi delapan puluh piksel untuk mengulang dua keterangan yang
tidak pernah hilang dari layar adalah harga yang tidak dibayar siapa pun, dan
di layar sepenuh Digital Twin harga itu diambil dari panggung modelnya.

Kalimat pengantarnya menyusul dibuang karena alasan yang berbeda: ia dibaca
**sekali**, oleh orang yang pertama kali membuka layar itu, lalu dilewati
ribuan kali oleh orang yang sudah hafal — sementara tiga barisnya menekan isi
halaman ke bawah pada tiap kunjungan.

Yang dibuang **gambarnya, bukan teksnya**. Keduanya tetap dikeluarkan lewat
`.sr-only`:

- `<h1>` berisi kicker dan judulnya sekaligus (`Informasi aset · Jembatan Kali
  Progo`). Halaman tanpa tajuk memaksa pembaca layar menebak batas dokumennya,
  dan tautan "Lompat ke isi" mendarat di wilayah yang tidak dapat diumumkan
  namanya. Dashboard — yang memang sudah tidak memakai `PageHeader` — mendapat
  `<h1>` tersembunyinya sendiri karena sebelumnya ia satu-satunya layar tanpa
  tajuk sama sekali.
- Pengantarnya tetap terbaca pembaca layar dan tetap ditemukan pencarian dalam
  halaman — dua pembaca yang justru paling membutuhkan keterangan tentang
  layar yang belum mereka kenal.

Pengantarnya **dilipat, bukan dihapus**. Tombol bundar `?` di ujung kanan
membukanya, dan yang sudah hafal tidak pernah menekannya. Itu yang membedakan
melipat dari membuang: pada Digital Twin, "seret untuk memutar, klik penanda
sensor untuk membacanya" adalah satu-satunya tempat cara memakai layar itu
dikatakan — tanpanya orang baru hanya melihat gambar yang tidak menjawab
apa-apa.

Tombolnya bundar dan 26 piksel: ia ditekan sekali oleh tiap orang baru lalu
tidak pernah lagi, jadi ia tidak boleh bersaing dengan tombol yang memang
dipakai berulang seperti *Unduh CSV*. Keadaannya dibawa `aria-expanded`, jadi
pembaca layar mengumumkannya sebagai pengungkap, bukan sebagai tombol yang
tidak jelas akibatnya.

Yang tinggal terlihat di badan halaman: deretan tombolnya, rata kanan.
Dashboard tidak punya `?` karena ia memang tidak memakai `PageHeader` dan
tidak punya pengantar — angkanya sendiri yang menerangkan dirinya di sana.

#### Penyusutannya diukur terhadap kepala, bukan jendela

`@container`, bukan `@media`. Sempat dicoba dengan kueri layar dan hasilnya
melimpah: jendela 1634 px sementara kepalanya cuma 1284 px karena rel memakan
250 px, sehingga `max-width: 1280px` tidak pernah kena. Kueri yang mengukur
benda yang salah selalu rusak diam-diam.

| Lebar kepala | Yang hilang |
|---|---|
| ≤ 940 px | Sejak kapan — ada di kaki kartu tangga siaga |
| ≤ 780 px | Tanggal; jamnya tinggal |
| ≤ 680 px | Nama mode aliran; titik denyutnya tinggal |
| ≤ 620 px | Nomor tingkat dan kode aturan; tombol jadi "Aturan" |
| ≤ 420 px | Zona waktu, jarak tepi dikecilkan, nama halaman boleh dipotong |

Nama halaman bertahan paling lama dari semuanya, dan itu disengaja: ia
satu-satunya keterangan di kepala yang menjawab "saya sedang di mana", dan
layar sempit justru yang paling butuh jawabannya.

Tiga hal **tidak** ada di kepala. Laju cuplikan dan pencacah paket: denyut,
nama mode, dan jam perbaruan sudah membuktikan datanya mengalir, dan keduanya
ada lengkap di halaman Data. Jendela rerata dan jumlah sensor: kepala ini
untuk yang *berubah*, keduanya tetap sepanjang hari.

Yang ketiga sempat ada lalu dibuang: **kalimat kriteria aturan siaga**. Ia
terpotong di hampir semua lebar layar — dan yang terpotong justru penutupnya,
bagian yang membedakan "menyentuh ambang waspada" dari "belum menyentuh ambang
kritis". Kalimat yang separuh terbaca bukan keterangan yang lebih ringkas, ia
keterangan yang salah sambil memakan 359 piksel. Tiga tempat lain sudah
memuatnya utuh: bisikan pada lencana siaga, kartu Tangga siaga di Dashboard,
dan halaman Aturan & ambang. Ruangnya dipakai mengembalikan "sejak kapan",
yang kini bertahan sampai 940 px alih-alih hilang di 1280 px.

Ambangnya bukan ditebak — lebar tiap butir diukur langsung di peramban, lalu
seluruh rentang lebar kepala 340–1400 px disapu per 20 px pada halaman
bernama terpanjang sampai tidak ada satu pun lebar yang meluber.

## Halaman

Bilah samping dikelompokkan menurut sifat halamannya, bukan menurut asal
datanya. Model 3D sebelumnya berada di kelompok aset, dan itu salah tempat: ia
layar pemantauan langsung, bukan lembar arsip.

Tiap butir membawa **ikon garis** di sebelah labelnya (`components/Icon.tsx`,
sebelas bentuk digambar sebaris — sepuluh bentuk tidak sepadan dengan satu
pustaka ikon beserta pohon berkasnya). Ikonnya mendampingi label, tidak
menggantikannya: sepuluh butir teks polos menuntut pembacanya membaca ulang
tiap kali, sepuluh butir bergambar tanpa teks menuntutnya menghafal sandi.
Warnanya `currentColor`, jadi butir yang aktif membawa ikonnya ikut menyala
tanpa aturan warna tersendiri.

Dua butir dapat memanggil sendiri lewat **titik penanda** di ujung kanannya:
**Tingkat siaga** berwarna keadaan saat strukturnya keluar rentang, dan
**Data** berwarna merek saat ada kejadian yang belum dibaca. Hanya dua, karena
menandai lebih banyak butir membuat seluruh relnya berbintik — dan rel
berbintik tidak menunjuk ke mana pun. Titik Data hanya menyala untuk kejadian
yang lahir setelah aplikasi dibuka; log selalu berisi baris pembuka, dan tanda
yang menyala sejak detik pertama sama saja dengan tidak ada tanda. Warnanya
bukan satu-satunya pembawa pesan: alasannya ikut ditulis sebagai teks
tersembunyi yang dibacakan pembaca layar.

| Kelompok | Halaman | Isi |
|---|---|---|
| Pemantauan | **Dashboard** | Halaman muka. Indeks kesehatan, skor risiko, rekomendasi pemeliharaan, log peristiwa, seluruh kanal sensor |
| Pemantauan | **Digital Twin** | Model 3D yang bereaksi terhadap telemetri: batang memerah seiring regangan, lantai miring saat tumpuan rusak, kendaraan melintas sesuai skenario |
| Pemantauan | **Data** | Tabel angka mentah dan log kejadian, dengan penyaring periode dan kanal, ringkasan min/rerata/maks, unduhan CSV, dan cetak |
| Pemantauan | **Kamera** | Enam titik pandang beserta keadaan, resolusi, PTZ, dan perekamannya; siarannya peraga, lapisan HUD-nya sudah bentuk akhir |
| Kajian | **Deret waktu** | Deret waktu tiap kanal terhadap ambang waspada dan kritis, dengan garis dasar sebagai pembanding |
| Kajian | **Perbandingan** | Rekaman kondisi normal dan kondisi sekarang ditumpuk pada satu sumbu, dengan daerah selisihnya diarsir |
| Kajian | **Skenario** | Delapan skenario dalam tiga keluarga, masing-masing menyebut dampak, laju, dan apakah kondisinya pulih sendiri |
| Berkas aset | **Informasi** | Identitas aset: ukuran, data teknis, beban rencana, nilai kondisi, penanggung jawab |
| Berkas aset | **Inspeksi** | Riwayat pemeriksaan lapangan beserta temuan dan nilai kondisi tiap kali |
| Berkas aset | **Pemeliharaan** | Pekerjaan pemeliharaan: selesai, berjalan, terjadwal, beserta biayanya |
| Berkas aset | **Kondisi elemen** | Skor 0–1 tiap elemen struktur dari sensor + inspeksi + uji diagnostik, beserta dekomposisinya dan elemen yang menarik turun indeks |
| Berkas aset | **Sensor** | Inventaris alat terpasang: model, letak, umur pemasangan, baterai, sinyal — beserta bilah *Data masuk*: paket diterima, cuplikan terakhir, jarak cuplikan, kanal yang mengirim, lama berjalan |
| Berkas aset | **Tingkat siaga** | Ambang batas tiap parameter beserta pita aman/waspada/kritisnya, aturan yang sedang menaikkan status dan sejak kapan, dapat diubah dan dikembalikan ke bawaan |

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

## Susunan dashboard

Dashboard dibaca dari kiri atas ke kanan bawah dalam tiga lapis, dan tiap lapis
menjawab satu pertanyaan:

1. **Lima angka utama** — seberapa buruk keadaannya.
2. **Tangga siaga · kondisi struktur · log peristiwa** — kenapa, oleh apa, dan
   sejak kapan.
3. **Kamera · rekomendasi · acuan aset** — apa yang dilihat di lapangan dan apa
   yang harus dikerjakan.

### Tiap angka membawa penyebabnya

Angka tanpa penyebab hanya memberi tahu bahwa ada yang berubah, dan orang tidak
dapat mengerjakan "ada yang berubah". Karena itu baris angka utama tidak berisi
angka telanjang:

| Angka | Kalimat penyebab di bawahnya |
|---|---|
| Indeks kesehatan | status kanal sekarang |
| Indeks kondisi | elemen yang menariknya turun, beserta skornya |
| Lendutan tengah | persen terhadap ambang waspada |
| Kanal di luar rentang | nama kanal yang melanggar, bukan hanya jumlahnya |
| Sensor daring | skenario yang sedang berjalan dan sudah berapa lama |

Tiga angka yang dulu berdiri di baris ini — skor risiko, skenario aktif, nilai
kondisi berkas — tidak dibuang, hanya **turun ke kartu di bawahnya**, tempat
masing-masing punya ruang untuk dijelaskan. Baris utama dipakai untuk yang
harus terbaca dalam satu pandangan; sisanya untuk yang butuh kalimat.

### Tangga siaga

Bilah di atas layar sudah menyebut tingkat yang berlaku, tetapi ia satu baris
dan tidak punya ruang menyebut **tingkat berikutnya**. Kartu tangga
menyebutnya: ketiga tingkat berurutan dari yang paling ringan, masing-masing
dengan kriterianya sendiri, yang berlaku disorot dan diberi lencana
`SEKARANG`. Tanpa tangganya, satu-satunya cara mengetahui apa yang akan
menaikkan keadaan adalah menunggu keadaannya naik.

Kriterianya tidak ditulis ulang di komponennya — seluruhnya dibaca dari
`ALERT_RULES`, sumber yang sama yang dipakai bilah atas dan halaman Aturan &
ambang. Kalimat yang disalin akan berbeda pada hari aturannya diubah, dan layar
yang menyebut kriteria lain daripada yang dipakai sistem lebih buruk daripada
layar yang diam. Kakinya menjawab dua hal yang tidak dijawab tingkatnya
sendiri: **sejak kapan** dan **kanal mana** yang melanggarnya, lengkap dengan
nilainya.

### Kartu kondisi struktur membawa dua indeks sekaligus

Ini bagian yang sengaja tidak menyalin acuan mana pun, karena aplikasi ini
punya sesuatu yang tidak dipunyai acuannya: penilaian **per elemen**.

- **Cincin di atas** — indeks kesehatan, dari kanal. Bergerak tiap cuplikan,
  naik lagi begitu truk lewat.
- **Batang di bawah** — indeks kondisi elemen, dari sensor + inspeksi + uji
  diagnostik. Hampir tidak bergerak sepanjang hari.

Keduanya sengaja berdampingan justru karena sering berbeda: seluruh kanal boleh
saja aman sementara pelat buhul sudah berkarat sejak inspeksi tiga bulan lalu,
dan dashboard yang hanya menampilkan yang pertama akan menyebut jembatan itu
sehat. Karat tidak akan pernah muncul di cincin, dan truk yang sedang melintas
tidak akan pernah muncul di batang.

Batangnya dipecah per bagian struktur — lantai, rangka utama, sambungan &
ikatan, tumpuan — dengan **dua garis tipis** di ambang 0,70 dan 0,85, sehingga
yang dibaca bukan "batangnya panjang" melainkan "batangnya masih di sebelah
kanan garis". Tiap bagian memakai aturan minimum berbobot yang sama dengan
indeks keseluruhan, bukan rata-rata: satu elemen buruk di antara elemen sehat
tetap menarik turun bagiannya.

## Data, unduhan, dan cetak

Halaman **Data** menampilkan jendela riwayat yang sama yang menggerakkan bagan —
180 cuplikan terakhir per kanal — sebagai tabel: satu baris per cuplikan, satu
lajur per kanal, terbaru di atas. Nilainya diwarnai begitu melewati ambang, dan
tab keduanya berisi log kejadian. Tidak ada yang ditarik ulang dari server, jadi
halaman ini tetap berisi dalam mode peraga.

Penyaring periodenya diukur terhadap **cuplikan terbaru**, bukan jam dinding.
Jendela riwayat selalu berisi 180 cuplikan berapa pun lajunya, dan pada
pemantauan langsung seluruhnya berumur kurang dari satu menit — diukur terhadap
jam dinding, "30 menit terakhir" akan selalu berarti seluruh tabel. Milidetik
ikut ditulis hanya saat cuplikannya memang datang lebih rapat dari satu detik,
supaya baris yang berbeda tidak terbaca sebagai baris yang tergandakan.

Periode yang diminta karena itu tidak pernah berdiri sendiri: kartu **Rentang
waktu tabel** menyebut rentang yang benar-benar termuat beserta jam awal dan
akhirnya, dan begitu jendela riwayat lebih pendek daripada periode yang dipilih,
satu kalimat di bawah penyaring menyatakannya. Tanpa itu, tabel berisi setengah
menit data terbaca seolah berisi satu jam hanya karena penyaringnya bertuliskan
demikian.

Tombol **Unduh CSV** menurunkan seluruh baris yang sedang tersaring, bukan hanya
yang terlihat, lengkap dengan kepala berkas berisi nama aset, periode, jumlah
baris, dan sumber datanya. Berkasnya memakai **titik koma** sebagai pemisah
lajur dan **koma** sebagai tanda desimal, dengan tanda urutan bita di depan:
Excel dengan setelan wilayah Indonesia membukanya langsung sebagai angka, tanpa
langkah impor dan tanpa huruf beraksen yang berubah jadi sampah. Penyusunnya ada
di `frontend/src/lib/export.ts`.

Tombol **Cetak** memakai blok `@media print` di `frontend/src/styles/app.css`:
navigasi, tombol, dan penyaring disembunyikan (`.d-print-none`), latar gelap
diganti putih, batas tinggi pembungkus tabel dicabut supaya tabel seratus baris
tercetak utuh, kepala lajur diulang tiap halaman, dan warna keadaan
dipertahankan — itu satu-satunya warna yang membawa arti.

## Kamera

Sensor menjawab *berapa*, kamera menjawab *apa*. Keduanya menutupi lubang satu
sama lain: lonjakan beban gandar tanpa gambar hanya angka yang mencurigakan,
dan gambar truk tanpa angka hanya truk.

Siaran di halaman ini **peraga**, dan tiap ubin mengatakannya sendiri lewat
lencana `PERAGA` — bukan `LIVE`. Ubin yang menggambar jalan lalu diberi lencana
siaran langsung adalah kebohongan kecil yang mahal: operator yang mengiranya
sungguhan akan mengambil keputusan dari gambar yang tidak pernah melihat apa
pun.

Yang sudah berbentuk akhir justru lapisan di atas gambarnya — penanda keadaan,
jam, nama kamera, resolusi, kotak deteksi — dan lapisan itu **HTML, bukan
bagian dari gambarnya**. Menyambungkannya ke kamera sungguhan berarti mengganti
satu `<svg>` dengan satu `<video>` di `components/CameraTile.tsx`; sisanya
tetap di tempatnya.

### Apa yang membuat gambarnya terbaca sebagai kamera

Gambarnya digambar ulang supaya menyerupai keluaran kamera di lapangan, bukan
diagram. Yang dikerjakan bukan menambah detail, melainkan menambah **petunjuk
optik** — dan petunjuk itu jumlahnya sedikit:

| Petunjuk | Yang dikerjakannya |
|---|---|
| Perspektif satu titik | Jarak antar marka memampat **1/z**, bukan rata. Ini yang paling menentukan: jalan yang menyempit lurus tetap terbaca sebagai segitiga. |
| Kabut jarak | Bukit jauh lebih pucat daripada bukit dekat, dan ujung jalan **larut** alih-alih berhenti pada satu garis. Garis cakrawala yang tajam adalah ciri gambar vektor yang paling cepat dikenali mata. |
| Vignet lensa | Sudut bingkai lebih gelap daripada tengahnya, seperti lensa lebar yang dipakai kamera pengawas. |
| Bintik sensor | Satu lapis `feTurbulence` tipis. Gambar tanpa bintik selalu terbaca sebagai gambar vektor. |
| Kabur gerak | Kendaraan terdekat sedikit kabur — rana lambat, bukan kesalahan gambar. |
| Bayangan | Kendaraan dan tumpukan perletakan menjatuhkan bayangan. Benda tanpa bayangan tampak melayang, dan mata mengenali itu sebelum mampu menyebut sebabnya. |
| Benih per kamera | Awan, pohon, dan bintiknya digeser menurut `id` kameranya, jadi enam ubin tidak terbaca sebagai satu gambar yang diulang. |

Titik pandangnya pun diperbaiki. `bentang` sebelumnya menggambar siluet
jembatan dari seberang sungai — gambar yang bagus, tetapi **tidak ada kamera
pemantau yang berdiri di sana**, dan titik pandang yang tidak mungkin membuat
seluruh ubinnya terbaca sebagai ilustrasi. Sekarang ia memandang dari *dalam*
rangka: lantai memanjang, diagonal berderet ke kejauhan, ikatan angin di atas
kepala. `tumpuan` disusun ulang di sekitar satu benda yang memang diawasi
kamera itu — tumpukan perletakan, dari pedestal sampai ujung gelagar.

Dua kamera oprit saling berhadapan, jadi yang menghadap barat **dicerminkan**.
Bonusnya benar dengan sendirinya: lalu lintas Indonesia berjalan di lajur kiri,
jadi lajur yang menjauh dari kamera memang bertukar sisi bingkai ketika
kameranya menghadap arah sebaliknya.

Karena gambarnya kini jauh lebih meyakinkan, penanda peraganya **dinaikkan**,
bukan dibiarkan: selain lencana di pojok, ada cap air `PERAGA` melintang di
tengah bingkai. Semakin menyerupai siaran sungguhan sebuah gambar, semakin
mahal harga salah membacanya.

Kotak deteksinya tidak dikarang: ia menyala pada kamera yang mengawasi WIM
ketika telemetri memang sedang melaporkan kendaraan berat, dan menyebut
jumlahnya. Kotak yang selalu ada, atau yang muncul menurut jadwalnya sendiri,
mengajari operator untuk mengabaikannya.

Kamera lapangan berbicara RTSP dan peramban tidak, jadi ada dua jalur yang
biasa dipakai: **RTSP → HLS** lewat MediaMTX atau go2rtc lalu dimainkan
`hls.js` — paling mudah dipasang, latensi 3–10 detik; atau **WebRTC lewat
go2rtc** — latensi di bawah satu detik. Pilih yang kedua bila operatornya harus
bereaksi terhadap apa yang dilihatnya; sepuluh detik terlalu lama untuk menutup
lajur.

## Tingkat siaga

Ambang adalah satu-satunya angka di seluruh sistem yang tidak datang dari alat
ukur: ia keputusan orang. Selama angka itu tertanam di dalam kode, status
"waspada" pada layar tidak dapat ditelusuri oleh orang yang harus
menandatanganinya. Halaman **Tingkat siaga** memunculkannya — berapa batasnya
sekarang, berapa bawaannya, dan bagaimana mengembalikannya.

Perubahannya ditulis langsung ke objek `SensorSpec` di
`frontend/src/domain/sensors.ts` lewat `frontend/src/domain/thresholds.ts`.
Mesin simulasi membaca `warn` dan `crit` pada tiap langkah, jadi ambang baru
berlaku pada cuplikan berikutnya tanpa memuat ulang halaman. Yang disimpan di
`localStorage` hanya *selisihnya* terhadap bawaan: kanal yang tidak pernah
disentuh tidak ikut tertulis, sehingga ambang bawaan yang kelak diperbaiki di
katalog tetap sampai ke pengguna lama. Simpanan itu dipasang kembali di
`main.tsx` sebelum render pertama, supaya cuplikan pertama pun sudah dinilai
dengan ambang milik penggunanya.

Ambang waspada wajib lebih kecil daripada ambang kritis. Pasangan yang terbalik
ditolak, bukan diurutkan diam-diam: kanal seperti itu tidak akan pernah
berstatus waspada — ia melompat dari aman langsung ke kritis.

### Ambang diubah lewat jendela bertumpuk

Tombol **Ubah** pada tiap baris membuka jendela (`components/Modal.tsx`), bukan
menumbuhkan formulir di dalam barisnya. Bentuk sebelumnya merusak tiga hal
sekaligus:

- Formulirnya menggantikan **tiga sel pita**, sehingga angka yang sedang diubah
  menghilang justru ketika ia paling dibutuhkan sebagai pembanding.
- Lebar kolom melompat karena tiga sel berubah menjadi satu, dan seluruh tabel
  bergeser di bawah mata operator.
- Pada tabel selebar ini barisnya sering berada di luar layar, jadi operator
  mengetik di tempat yang harus digulir dulu untuk dilihat.

Di dalam jendela ketiganya hilang. Tabelnya tidak bergerak sama sekali, dan
jendelanya membawa apa yang dibutuhkan untuk memutuskan: nilai bawaan pabrik,
nilai yang sedang terbaca, dan kondisi layan normal kanal itu — semuanya
berdampingan dengan kotak isiannya. Galat penyuntingan muncul di dalam jendela
dan jendelanya tetap terbuka, jadi angka yang ditolak tidak perlu diketik ulang.

Dasarnya `<dialog>` bawaan peramban dengan `showModal()`, bukan `<div>`
berlapis `position: fixed`. Empat hal datang gratis dan hampir selalu setengah
jadi kalau dikerjakan sendiri: perangkap fokus, tombol Esc, lapisan di luar
urutan susun halaman (tidak ada perang `z-index` dengan rel, kepala, dan
panggung tiga dimensi), dan halaman di belakangnya menjadi inert.

#### Munculnya dianimasikan, termasuk hilangnya

Bagian yang biasanya gagal pada `<dialog>`: `close()` mencabut elemen dari
lapisan atas dan menyetel `display: none` seketika, jadi peralihan keluar
tidak pernah sempat berjalan dan jendelanya lenyap begitu saja. Dua sifat
diskret itu — `display` dan `overlay` — karena itu ikut dialihkan dengan
`allow-discrete`, dan keadaan awal peralihan masuknya ditulis di
`@starting-style`. Tanpa dukungan peramban yang hilang hanya animasinya;
jendelanya tetap muncul dan tetap tertutup.

| | Masuk | Keluar |
|---|---|---|
| Pudar jendela | 220 ms | 140 ms |
| Kartu naik 12 px, membesar 97 % → 100 % | 240 ms | 140 ms |
| Latar meredup dan mengabur | 220 ms | 140 ms |

Keluar memang harus lebih cepat: yang menutup jendela sudah selesai dengan
isinya dan sedang menunggu halaman di belakangnya, sementara yang membukanya
perlu matanya sempat mengikuti dari mana benda itu datang.

Lengkungnya `cubic-bezier(0.4, 0, 0.2, 1)`, bukan lengkung yang tajam di awal.
Percobaan pertama memakai `cubic-bezier(0.22, 0.9, 0.28, 1)` dan hasilnya
diukur begini — kartunya sudah sampai 0,67 px dari tujuannya pada milidetik
ke-90 dari 200, jadi sisa separuh waktunya merayap tak terlihat. Pada jarak
sependek ini yang terbaca bukan gerak, melainkan kedipan. Lengkung yang
dipakai sekarang menahan kecepatan puncaknya di tengah:

| Waktu | Kelegapan | Geser tegak | Skala |
|---|---|---|---|
| 0 ms | 0,00 | 12,00 px | 0,970 |
| 55 ms | 0,24 | 9,73 px | 0,976 |
| 110 ms | 0,78 | 3,39 px | 0,992 |
| 165 ms | 0,96 | 0,82 px | 0,998 |
| 220 ms | 1,00 | 0,05 px | 1,000 |

Geraknya 20 milidetik lebih panjang daripada pudarnya, jadi bentuk kartunya
mantap sesaat setelah warnanya penuh alih-alih keduanya berhenti serentak —
berhenti serentak terbaca sebagai satu kedipan, bukan sebagai benda yang
mendarat.

Satu hal yang wajib ikut: `pointer-events: none` selama elemennya belum
`[open]`. Sepanjang peralihan keluar ia masih `display: block` — itu memang
syarat animasinya — dan seratus empat puluh milidetik lembar tak terlihat
selebar layar cukup untuk menelan satu klik. Klik yang hilang tanpa sebab
adalah kerusakan yang paling sulit dilaporkan orang.

Yang meminta gerak dikurangi (`prefers-reduced-motion`) tetap mendapat
jendelanya tanpa geraknya. Durasinya disisakan satu milidetik, bukan dinolkan:
nol membuat sebagian peramban melewati peristiwa peralihan sama sekali, dan
kode yang kelak menunggunya akan menggantung.

Dua jebakan yang ditemukan saat mengujinya, keduanya tertulis di berkasnya:

1. **`cancel` wajib ditangkap.** Tanpa `preventDefault`, Esc menutup elemennya
   sementara React masih mengira jendelanya terbuka, dan tombol yang membukanya
   berhenti bekerja.
2. **`close` justru tidak boleh didengar.** Sempat dipasang sebagai jaring
   pengaman, dan ia yang merusak: `close` dikirim juga ketika React sendiri
   yang menutup, jadi penanganannya memanggil `onClose` di tengah pembaruan
   yang sedang berjalan dan membuat jendela berikutnya gagal terbuka sekali.
   Penggantinya lebih sederhana — penyamaan DOM dijalankan **tiap render**
   tanpa senarai kebergantungan, jadi perbedaan apa pun antara React dan DOM
   sembuh sendiri pada render berikutnya.

### Aturan ditulis sebagai data

Status sudah dihitung `worstStatus` di `domain/risk.ts` — tiga baris yang benar.
Yang tidak dijawab tiga baris itu adalah pertanyaan yang justru diajukan orang
yang harus menandatangani: *kenapa* sekarang KRITIS, aturan mana yang dilanggar,
kanal mana yang melanggarnya, dan sejak kapan. Selama kriterianya hanya hidup di
dalam kode, jawaban itu tidak dapat ditampilkan — dan status yang tidak dapat
diterangkan akan dianggap ajaib, lalu diabaikan.

Karena itu `domain/alertRules.ts` menuliskan tiap tingkat sebagai data: kode
(`R-01`…`R-03`), kalimat kriterianya, tindakan yang dituntut, dan fungsi yang
menunjuk kanal pelanggarnya. Aturan diperiksa berurutan dari yang paling berat
dan yang pertama cocok itulah yang berlaku — setara persis dengan `worstStatus`,
bukan tafsiran baru atasnya. Begitu keduanya berbeda, halaman akan menyebut satu
alasan sementara sistem bertindak atas alasan lain, dan itu lebih buruk daripada
tidak menyebut alasan sama sekali.

Hasilnya tampil di dua tempat. Pertama, **bilah tetap di atas setiap layar**
(`components/TopBar.tsx`): tingkat, kode aturan, kalimat kriterianya, sejak
pukul berapa, dan dari mana angkanya datang. Ia berdiri di luar `main` — yang
dipasangi `key={screen}` supaya isinya benar-benar diganti tiap berpindah layar
— karena bilah ini keadaan jembatan, bukan bagian dari halaman mana pun.
Kedua, panel penuh di **Tingkat siaga**: ditambah kanal pelanggar beserta nilai
dan ambangnya, tindakan yang dituntut, serta tabel seluruh aturan dengan baris
yang sedang berlaku ditandai.

Tingkat siaga adalah **keadaan**, bukan halaman. Selama ia hanya menjadi satu
butir menu, operator harus mengklik dulu untuk tahu jembatannya sedang
bagaimana — dan orang tidak mengklik sesuatu yang tidak mereka curigai. Satu
butir yang boleh dipotong di bilah itu hanyalah kalimat kriterianya: tingkat,
kode, dan jam perpindahan semuanya pendek dan tidak tergantikan, sedangkan
kalimatnya masih berguna walau terbaca separuh dan selengkapnya selalu satu
klik jauhnya.
Jam perpindahannya diambil dari waktu cuplikan, bukan jam dinding, dan dihitung
ulang ketika ambang diubah — mengubah ambang memang memindahkan tingkat, dan jam
perpindahannya adalah saat itu juga.

Satu batas yang perlu dinyatakan terang-terangan: pada **mode API** status tiap
pembacaan dihitung server dengan ambangnya sendiri, dan setelan di halaman ini
hanya mengubah penilaian yang dilakukan peramban — warna sel pada halaman Data,
garis ambang pada bagan, dan mesin lokal bila sambungan terputus. Untuk mengubah
ambang yang dipakai server, ubah `backend/src/domain/sensors.js`. Halaman itu
sendiri menyatakan hal ini saat mode API sedang aktif.

## Kondisi elemen

Telemetri menjawab "sekarang bagaimana". Yang tidak dijawabnya adalah
pertanyaan yang dipakai mengambil keputusan anggaran: **elemen mana** yang
paling buruk, dan atas dasar apa. Jawabannya tidak bisa datang dari sensor
saja — sensor punya cakupan sempit dan frekuensi tinggi, inspeksi punya cakupan
luas dan frekuensi rendah, uji diagnostik punya akurasi tinggi tetapi jarang.

```
skor elemen = Σ(nilai × bobot) / Σ(bobot)      sensor 1,0 · visual 0,6 · diagnostik 0,3
indeks      = mean × (1 − severity) + min × severity              severity = 0,75
```

Empat keputusan yang menentukan halaman ini dipercaya atau tidak:

**1 · Daftarnya tidak dikarang.** Tiap elemen menunjuk kelompok bagian yang
sudah ada di model 3D (`PART_GROUPS`) dan kanal sensor yang mengukurnya. Itulah
tautan yang mengubah "grafik regangan" menjadi "kondisi batang tepi bawah";
tanpanya yang ada hanya dasbor sensor dengan gambar tiga dimensi di sebelahnya,
dua hal yang tidak saling tahu. Perinciannya mengikuti cara pemeriksa menilai
di lapangan — "batang tepi bawah sisi utara", bukan "batang bc3z0".

**2 · Indeksnya bukan rata-rata.** Rata-rata menyembunyikan kegagalan setempat,
dan kegagalan setempat itulah yang dicari. Keduanya ditampilkan berdampingan
supaya selisihnya terlihat, bukan disembunyikan.

**3 · Tiap angka bisa dibongkar.** Skor gabungan selalu tampil bersama elemen
penyebabnya, dan skor elemen selalu tampil bersama ketiga sukunya, bobotnya,
dan perhitungannya apa adanya — `(1,00×1,0 + 0,45×0,6 + 0,66×0,3) / 1,9 =
0,77`. Kalau ahli struktur tidak bisa melihat kenapa skornya 0,77, ia tidak
akan percaya sistemnya, dan ia benar.

**4 · Sumber yang tidak ada ditulis `null`, bukan nol.** Nol berarti "elemennya
hancur menurut sumber ini"; tidak ada berarti "sumber ini tidak berkata
apa-apa". Bobotnya dikeluarkan dari penyebut, jadi elemen tanpa sensor dinilai
inspeksi saja — bukan dihukum karena kebetulan tidak dipasangi alat.

Dua batas dinyatakan di halamannya sendiri, bukan disembunyikan:

- **Perlengkapan tidak ikut menentukan indeks struktur.** Sandaran dan kerb
  tidak memikul beban, dan satu-satunya elemen tanpa sensor ada di sana — skor
  dua sumber tidak sebanding satu-satu dengan skor tiga sumber. Elemennya tetap
  didaftar; yang tidak dilakukan hanyalah membiarkannya menarik turun indeks.
- **Suku sensor membaca cuplikan terakhir**, jadi pada hari yang tenang ia
  mengangkat setiap elemen bersensor mendekati 1,0.

`visual` dan `diagnostic` masih **data contoh** — tetapi bukan angka acak.
Seluruhnya diturunkan dari kalimat temuan pada catatan inspeksi yang sudah ada
di `demoData.ts` (korosi pelat buhul panel 4–6, retak gelagar G-6, deformasi
bantalan tumpuan timur, gerusan pilar), dan rata-ratanya sengaja jatuh di
sekitar 0,64 — yang dibalik dan dikalikan lima menghasilkan nilai kondisi **2
dari 5**, persis nilai kondisi jembatan ini pada berkas asetnya. Dua bagian
data contoh yang saling bertentangan lebih buruk daripada satu pun tidak ada.
Keduanya baru menjadi data sungguhan setelah form inspeksi mencatat temuan
**per elemen**, bukan satu paragraf per kunjungan.

### Bedanya dengan indeks kesehatan

Dua angka yang mirip namanya akan tertukar, dan angka yang tertukar lebih buruk
daripada angka yang tidak ada:

| | Indeks kesehatan | Indeks kondisi |
|---|---|---|
| Sumber | telemetri saja | telemetri + inspeksi + diagnostik |
| Rentang | 0–100 | 0–1 |
| Berubah | tiap menit | hitungan bulan |
| Menjawab | "sekarang jembatannya sedang bagaimana" | "elemen mana yang harus dianggarkan" |

Keduanya boleh berbeda jauh: jembatan yang seluruh sensornya tenang hari ini
tetap dapat berkondisi buruk karena korosi yang tercatat inspeksi setengah
tahun lalu.

## Membaca perbandingan

Halaman **Perbandingan** menumpuk rekaman kondisi normal dan kondisi sekarang
pada satu bagan, bukan menjajarkan dua bagan. Dua bagan berdampingan menuntut
mata mengurangkan dua gambar, dan mata tidak bisa melakukannya; ditumpuk,
selisihnya menjadi satu bentuk yang langsung terlihat besar-kecilnya.

Tiga aturan yang dipegang `OverlayChart` di `components/Charts.tsx`:

1. **Satu sumbu tegak saja.** Dua skala pada satu bagan membuat selisih antar
   deret tidak dapat dibaca sama sekali — garis yang lebih tinggi belum tentu
   bernilai lebih besar, dan kesalahan itu tidak pernah kelihatan salah.
2. **Deret pembanding diputus-putus.** Rekaman yang dibekukan dan nilai yang
   sedang berjalan tidak boleh terlihat sama. Garis putus sekaligus menjadi
   pembeda kedua bagi pembaca yang tidak membedakan warna.
3. **Daerah di antara kedua kurva diarsir**, dengan warna status kondisi
   sekarang. Yang dicari pembaca bukan nilai mutlak salah satunya, melainkan
   seberapa jauh keduanya berpisah.

Sumbu datarnya berarti *lama pengamatan yang sama*, bukan jam dinding yang sama:
kedua deret dipotong pada panjang yang sama dihitung dari ujung terbarunya,
karena rekaman pembandingnya memang berhenti terisi lebih dulu. Menyusuri bagan
dengan tetikus memindahkan penunjuk dan memperbarui bacaan di bawahnya; tanpa
tetikus, yang terbaca adalah cuplikan terakhir.

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

### Sungai dan dataran

Ukuran tanah dan air bukan selera, melainkan hitungan mundur dari jangkauan
kabut. Apa pun yang berujung **di dalam** jangkauan itu terbaca sebagai tepi
lembar kertas, bukan sebagai kaki langit.

Sebelumnya keduanya tidak sepakat: tanahnya 32 × 80 satuan sementara airnya
130 × 64. Airnya karena itu menyembul di luar tepi tanah dan tergambar sebagai
**pita biru yang mengambang di atas padang** — persis di tempat yang seharusnya
kaki langit. Sekarang keduanya berbagi satu batas:

| | Sebelum | Sekarang |
|---|---|---|
| Tanah tiap sisi | 32 × 80 | 110 × 240 |
| Air | 130 × 64 | 20 × 240 |
| Kabut (`near`, `far`) | 45, 175 | 50, 165 |

Air kini selebar alurnya saja, dengan 3,5 satuan terselip di bawah tiap tebing
supaya tepinya tidak pernah terlihat, dan sepanjang tanahnya persis. Ujung
keduanya jatuh di luar `far`, jadi larut sebelum sempat terlihat.

**Permukaannya tidak lagi rata.** Bergelombang hanya jauh dari sungai: bukit
yang tumbuh tepat di bawah oprit akan menaikkan perkerasan yang memang harus
datar, jadi kelerengannya baru dimulai 24 satuan dari bibir alur dan naik
penuh pada 64 satuan. Rumusnya dipisah sebagai fungsi `tinggiTanah` karena dua
hal harus memakai yang persis sama — simpul bidang rumputnya dan kaki tiap
pohon; dihitung terpisah, pohonnya melayang atau terbenam.

**Warna per simpul**, bukan satu warna rata. Rumput tepi sungai lebih hijau,
padang di kejauhan lebih kering, dan punggung bukit lebih pucat daripada
lembahnya — tiga petunjuk yang sama-sama datang dari air. Warna bahannya
diubah menjadi putih: warna simpul **dikalikan** dengan warna bahan, jadi
bahan yang sudah hijau akan mengalikan hijau dengan hijau dan seluruh padang
berubah gelap kehitaman.

Airnya juga berwarna per simpul: tepian lebih pucat daripada tengah alur. Air
sungguhan tidak berwarna rata — yang dangkal memantulkan dasarnya, yang dalam
menelan cahayanya, dan satu warna rata di seluruh permukaan adalah hal pertama
yang membuat air buatan terbaca sebagai plastik biru. Nilainya pengali, bukan
warna jadi, jadi perubahan dari biru tenang ke cokelat banjir tetap terbawa.

**Seratus sepuluh pohon** berdiri di kedua sisi. Padang kosong seluas dua ratus
empat puluh satuan tidak punya apa pun yang memberi tahu mata seberapa jauh
ujungnya; pohon adalah pengukur jarak yang paling murah, karena tingginya
diketahui semua orang — yang mengecil di kejauhan langsung terbaca sebagai
jauh, bukan sebagai kecil. Dua `InstancedMesh`, bukan dua ratus dua puluh
`Mesh`: dipisah satu per satu ongkos menggambarnya melebihi seluruh rangka
jembatannya. Dua daerah dikosongkan karena pohon di situ menutupi benda yang
justru harus dilihat — 30 satuan pertama dari alur (tempat oprit dan
timbunannya) dan lorong selebar 20 satuan di sekitar sumbu jalan.

### Oprit dan arus lalu lintas

Oprit diperpanjang **17 → 48 satuan tiap sisi**. Jalan yang berhenti di tengah
padang terbaca sebagai potongan yang belum selesai, dan mata langsung mencari
di mana sisanya; pada 48 satuan ujungnya jatuh jauh di dalam kabut, jadi
jalannya *menghilang* alih-alih berhenti. Marka putus-putus dan tiang pagar
pengaman ikut sepanjang itu — keduanya jadi `InstancedMesh`, karena 106 marka
dan 35 tiang per sayap dikalikan dua sisi berarti hampir tiga ratus panggilan
gambar untuk garis putih selebar 22 cm dan tiang setebal 6 cm. Dengan instansi:
tiga.

Armadanya ikut naik, **16 → 24 kendaraan** (16 mobil, 8 truk). Tanpa tambahan
itu jembatan terbaca lengang pada arus yang seharusnya biasa: lintasannya
memanjang 30 → 48 satuan, jadi kerapatan yang sama menuntut kendaraan yang
lebih banyak. Jumlah tiap skenario dinaikkan sebanding — arus normal 6 + 2
menjadi 10 + 3, jam sibuk 11 + 5 menjadi 14 + 5.

Jenisnya juga dipisah di dalam armada, bukan ditentukan `i % 3`. Dengan pola
lama jenis kendaraan terikat pada nomor urutnya, sehingga skenario yang
meminta "satu mobil dan empat truk" mendapat tiga truk dan dua mobil — susunan
yang tidak pernah bisa dipenuhi karena yang ditampilkan selalu N pertama.
Dipisah per jenis, permintaan apa pun dipenuhi persis, dan **angka pada label
benar-benar angka yang tergambar**. Lajurnya dibagi di dalam tiap jenis, bukan
pada nomor urut keseluruhan; kalau tidak, permintaan yang berat sebelah
menumpuk di satu lajur.

**Lintasan kendaraan tidak ikut sepanjang itu** — ia tetap 18 satuan di luar
bentang tiap sisi. Semakin panjang lintasannya, semakin sedikit kendaraan yang
berada di atas jembatan pada saat yang sama, dan jembatan yang kosong tidak
menunjukkan apa pun tentang lendutan. Angkanya terikat: `APPROACH_UNITS` harus
sama dengan `2 × (TRACK_HALF − L/2)`, karena ia yang dipakai menghitung berapa
bagian armada yang **wajar** berada di atas bentang.

#### Antrean, bukan kumpulan benda yang berjalan sendiri-sendiri

Tiap kendaraan dulu maju dengan lajunya sendiri (`speedJitter` 0,9–1,1) dan
membungkus posisinya tanpa melihat siapa pun. Akibatnya yang lebih cepat
menyusul yang lebih lambat lalu **menembusnya** — truk dan mobil tergambar
saling tumpang tindih di lajur yang sama. Sebaran ulang saat jumlah berubah
tidak menolong: ia menata sekali, sedangkan tabrakannya lahir dari selisih laju
yang terus berjalan.

Sekarang tiap kendaraan mengejar yang di depannya dan berhenti pada jarak aman
0,55 satuan bemper ke bemper. Panjang bodi diukur dari geometrinya, bukan
dikira-kira — truk 2,25 satuan, mobil 1,3. Tiga akibat yang semuanya benar:

- tidak ada lagi yang saling menembus;
- iring-iringan terbentuk sendiri di belakang truk yang lambat, lalu merenggang
  lagi setelah ia keluar — pada skenario *Jam sibuk* barisannya mengular
  sepanjang bentang tanpa satu pun diatur;
- roda berputar menurut jarak yang **benar-benar** ditempuh, jadi kendaraan
  yang tertahan rodanya ikut berhenti.

Kedudukannya disimpan sebagai `p`, jarak tempuh sepanjang lintasan yang selalu
bertambah pada kedua lajur, bukan sebagai `x`. Dengan begitu pengurutan antrean
tidak perlu tahu arah tiap lajur: yang di depan selalu yang `p`-nya lebih
besar.

#### Muncul di celah terlapang, bukan di mulut lintasan

Kendaraan yang baru diminta skenario ditaruh di celah paling lapang pada
lintasannya. Mengantre di mulut memang lebih jujur, tetapi mulutnya 18 satuan
dari ujung jembatan: pada laju arus biasa butuh enam detik sampai yang pertama
tiba, dan skenario yang menjanjikan kemacetan lalu memperlihatkan bentang
lengang adalah kebohongan yang lebih mahal daripada kendaraan yang muncul di
tengah oprit. Celahnya dicari dengan memeriksa 24 titik dan mengambil yang
jaraknya ke tetangga terdekat paling besar; bila tidak ada yang cukup lapang,
kendaraannya menunggu di luar dan masuk lewat mulut nanti.

Yang **tidak** dilakukan: memindahkan kendaraan yang sudah berjalan.
Sebelumnya seluruh armada ditata ulang tiap kali jumlahnya berubah, dan arus
yang sedang mengalir melompat serentak. Yang tidak diminta lagi pun tidak
dihilangkan seketika — ia menghabiskan lintasannya lalu keluar sendiri di
ujung, seperti kendaraan yang memang sedang lewat.

### Lendutan dan pengalinya

Lendutan tengah bentang jembatan ini bergerak di kisaran **milimeter**,
sementara bentangnya seratus meter lebih — perbandingan sepersepuluh ribu, yang
pada layar setara nol piksel. Karena itu ia digambar dengan pengali, dan angka
pengalinya wajib tertulis di sebelah modelnya: lengkungan yang dibesarkan tanpa
keterangan membuat orang membaca kerusakan yang tidak ada. Keterangan di bawah
panggung selalu menyebut dua angka sekaligus — lendutan yang benar-benar
terukur dan besarnya setelah dibesarkan — beserta pita ambang tempat nilainya
jatuh.

Pengalinya **tidak satu angka, melainkan bertingkat per pita ambang**
(`domain/deflectionScale.ts`):

| Pita | Rentang kanal | Pengali di dalam pita |
|---|---|---|
| Aman | di bawah 12 mm | × 110 |
| Waspada | 12 – 16 mm | × 450 |
| Kritis | 16 mm ke atas | × 900 |

Satu pengali tetap memaksa kompromi yang tidak enak di kedua ujungnya: cukup
besar supaya keadaan kritis terbaca berarti keadaan normal pun sudah tampak
melengkung — dan lantai yang **selalu** melengkung membuat orang berhenti
memperhatikan lengkungannya. Cukup kecil supaya keadaan normal tampak lurus
berarti keadaan kritis hanya beberapa piksel lebih dalam, dan tidak ada yang
melihatnya datang.

Pengali bertingkat mengalikan hanya milimeter yang jatuh **di dalam** tiap
pita, jadi hasilnya **menerus** (tidak melompat di batas pita) dan **selalu
naik** (nilai yang lebih besar tidak pernah tergambar lebih dangkal). Dua sifat
itu wajib: tanpa keduanya, gambarnya berhenti bisa dibandingkan dengan dirinya
sendiri sedetik yang lalu. Pada bentang yang digambar selebar ±420 piksel:

| Kanal | Pengali rata-rata | Cekungan di layar |
|---|---|---|
| 8 mm (layan normal) | × 110 | 3,2 px |
| 12 mm (batas waspada) | × 110 | 4,8 px |
| 14 mm | × 159 | 8,1 px |
| 16 mm (batas kritis) | × 195 | 11,3 px |
| 20 mm | × 336 | 24,4 px |

Yang bertambah bukan hanya dalamnya, tetapi **kecepatan perubahannya**: 0,40
piksel per milimeter di pita aman, 1,64 di waspada, 3,27 di kritis. Kendaraan
yang lewat menggerakkan cekungan empat kali lebih keras begitu kanalnya
melewati ambang waspada, dan delapan kali setelah ambang kritis — itulah gerak
tambahan yang terbaca dari sudut mata, tanpa satu pun gerak yang dikarang.

Pita aman dibuat sedangkal itu dengan sengaja. Bentuk yang paling cepat
dikenali mata adalah garis lurus: selama lantainya lurus, tidak ada yang perlu
dibaca. Tiga koma dua piksel pada bentang selebar empat ratus piksel masih
cukup untuk memperlihatkan lantainya **bernapas** ketika truk lewat, tetapi
tidak cukup untuk terbaca sebagai lengkungan — dan itu memang yang seharusnya
dikabarkan hari yang biasa-biasa saja.

Sebagai pembanding, pengali tunggal × 250 yang dipakai sebelumnya menghasilkan
7,3 px pada keadaan normal dan 14,6 px pada batas kritis — keadaan normal sudah
tampak melengkung, dan selisih antara normal dan kritis cuma dua kali. Pengali
bertingkat menggambar keadaan normal **jauh lebih dangkal** daripada itu
(3,2 px) sambil tetap menggambar keadaan kritis **lebih dalam** (11,3 px),
dengan selisih tiga setengah kali. Itulah yang tidak bisa dilakukan satu
angka.

Kendalinya dicabut karena ia bukan parameter pengukuran melainkan perbesaran
gambar, dan bentuknya — mula-mula penggeser, lalu empat tombol — memancing
orang menyetelnya seolah ia bagian dari data. Sekarang ada jalan lain untuk
menjawab "elemen mana yang buruk" yang tidak menuntut siapa pun menyetel
apa-apa: halaman **Kondisi elemen**.

Lendutannya dibagi dua bagian, dan pembagian itu yang membuat lantainya
**bernapas**:

- **Tiga perempatnya beban tetap** — berat sendiri dan perkerasan. Bentuknya tidak
  berubah: `(1 − u²)(5 − u²)/5`, bentuk lendutan balok di atas dua tumpuan
  sederhana dengan beban merata, dinormalkan terhadap lendutan tengah
  bentangnya.
- **Seperempatnya kendaraan yang sedang melintas** (`LIVE_SHARE`). Tiap kendaraan yang berada di
  atas bentang menyumbang lewat **garis pengaruh** lendutan balok tumpuan
  sederhana — beban titik di absis `a` melendutkan titik `x` sebesar
  `b·x(L² − b² − x²)·48 / 6L⁴` dengan `b = L − a`. Truk dihitung tiga kali
  mobil penumpang.

  Bentuk gabungannya lalu dinormalkan **pada puncaknya sendiri**, dikalikan
  porsi beban yang sedang berada di atas bentang. Tanpa normalisasi puncak,
  angka yang tergambar tidak pernah sampai ke angka yang dijanjikan: sumbangan
  tiap kendaraan terbagi bobot seluruh armada sementara sebagian armada selalu
  ada di oprit, sehingga lendutan tengah bentang yang tergambar hanya sekitar
  **0,62 kali** nilai sensornya — keterangan di bawah panggung menyebut satu
  angka, modelnya menggambar angka lain.

Di atas keduanya ada bagian ketiga yang tidak menambah besarnya, hanya
mencondongkan bentuknya: **kerusakan**. Batang yang retak atau putus kehilangan
sebagian kekakuannya, dan bentang melendut paling dalam di dekat batang itu —
bukan lagi tepat di tengah. Itulah tanda yang dicari orang pada model: bukan
"jembatannya melendut", melainkan "melendutnya di sebelah sini". Tiap tag pada
`scenario.damaged` dicari absis batangnya, lalu bentuk beban matinya
dicondongkan ke sana dengan garis pengaruh yang sama — dinormalkan **pada tengah
bentang**, supaya angka yang terbaca sensor di tengah tetap angka yang tergambar
di tengah: yang berubah bentuknya, bukan besarnya.

Skenario *Gerusan pilar pascabanjir* karena itu melendutkan ujung barat jauh
lebih dalam daripada tengahnya, sementara *Retak pada sambungan gelagar* tetap
memusat di tengah. Kecondongan itu bertahan selama elemennya masih ditandai
rusak — termasuk sesudah skenarionya dihentikan — dan hilang begitu perbaikan
dicatat. Tumpuan yang turun tidak ikut di sini: ia sudah diwakili kemiringan
seluruh lantai lewat `tiltRatio`.

Akibatnya cekungannya **berjalan bersama truk**, bukan naik-turun di tempat:
beban di seperempat bentang melendutkan bentang di seperempat itu, dan begitu
bentangnya kosong lantainya naik kembali ke bagian tetapnya saja. Kendaraan pun
duduk di dalam cekungannya sendiri, karena ketinggiannya dibaca dari medan yang
sama.

Besarnya tetap datang dari sensor: yang dibagi dua adalah lendutan tengah
bentang yang terukur. Kanal lendutan mengirim **rerata satu menit**, dan
riak per kendaraan justru yang dihapus perataan itu — bagian hidup di sini
mengembalikannya sebagai gerak, tanpa mengubah tinggi rata-ratanya. Porsi
setengah-setengah itu perkiraan peraga (`LIVE_SHARE`), bukan hasil hitungan
struktur.

Medannya dicuplik pada 97 titik sepanjang bentang tiap bingkai lalu dibaca
dengan sisipan lurus. Tanpa itu, tiap simpul geometri — ribuan — harus
menjumlahkan sendiri sumbangan enam belas kendaraan; dengan tabel, penjumlahan
itu dikerjakan 97 kali saja. Sisipan juga memastikan dua batang yang bertemu di
satu buhul membaca angka yang persis sama, jadi rangkanya tidak terbuka di
sana. Bila tidak ada satu pun cuplikan medan yang berubah — bentang kosong,
lendutan tetap, aliran data dijeda — seluruh kerja memindahkan geometri
dilewati.

Tiga cara memindahkan benda dipakai bersamaan, dipilih menurut bentuknya:

| Benda | Cara |
|---|---|
| Pendek — pelat buhul, tiang sandaran, tiang lampu, paku keling | digeser turun sesuai absis titik pasangnya |
| Membentang penuh — lantai, kerb, sandaran, marka tepi | simpul geometrinya digeser satu per satu (karena itu geometrinya diberi ruas) |
| Batang rangka | dipasang ulang dari **kedua ujungnya** yang sudah turun |

Yang terakhir itu yang membuat rangkanya tidak terkoyak, dan sekaligus
satu-satunya yang benar secara struktur. Menggeser batang sebagai benda utuh
membuat tiap batang turun sebanyak lendutan di titik tengahnya sendiri, dan
rangka yang seharusnya menyatu terbuka di tiap buhul. Dipasang ulang dari kedua
ujungnya, buhulnya justru menjadi tempat rangka berpatah — dan memang begitu
rangka sungguhan melendut: batang bajanya tetap lurus, yang berpindah adalah
titik pertemuannya.

Penanda sensor ikut turun bersama strukturnya, dan titik pasangnya tetap
disimpan pada jembatan yang **belum** melendut — kalau tidak, letaknya akan
turun sendiri setiap kali pengalinya dinaikkan. Menyeret penanda saat model
sedang melendut pun mengembalikan lendutan itu dulu sebelum letaknya disimpan.
Kendaraan ikut turun juga, karena ia menempel pada lantai.

Nilainya dikejar dengan **pegas teredam**, bukan dengan tarikan eksponensial.
Tarikan eksponensial mendekat tanpa pernah sampai: sisa perjalanan terakhirnya
merayap semakin pelan, dan gerak yang melambat tanpa berhenti terbaca sebagai
gambar yang tersendat, bukan sebagai benda yang berpindah. Pegas punya ujung —
ia sampai, sedikit melewatinya, lalu diam. Dan itulah yang memang dilakukan
jembatan ketika beban naik ke atasnya: turun, terlewat sedikit, lalu tenang.

Redamannya **mengikuti pita ambang**, tidak tetap:

| Pita | ω (rad/detik) | ζ | Yang terlihat |
|---|---|---|---|
| Aman | 5,5 | 0,92 | turun tenang, tanpa ayunan |
| Waspada | 5,0 | 0,60 | terlewat sedikit, satu ayunan balik |
| Kritis | 4,2 | 0,34 | terlewat jauh, lama tenangnya |

Ini bukan hiasan. Rasio redaman struktur adalah besaran yang benar-benar
dipantau di lapangan, dan **turunnya rasio redaman** salah satu penanda
kerusakan yang paling dikenal: struktur yang retak atau sambungannya longgar
menyerap energi lebih sedikit dan bergoyang lebih lama. Lantai yang mengayun
saat kritis menyampaikan sesuatu yang benar.

Integrasinya dipecah menjadi **langkah tetap 1/240 detik**, bukan satu langkah
sebesar `dt`. Satu langkah besar pada pegas sekaku ini menghasilkan lintasan
yang berbeda tiap kali laju bingkainya berubah — dan laju bingkai yang
naik-turun sedikit saja sudah cukup membuat geraknya terbaca bergetar. Dengan
langkah tetap, lintasannya sama persis pada 30 bingkai per detik maupun pada
144. Total `dt` per bingkai dipangkas seperempat detik, karena satu bingkai
yang tertahan lama — tab di belakang, jeda pemeriksa galat — akan berubah
menjadi ribuan putaran integrasi sekaligus.

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
Putaran otomatisnya **mati secara bawaan**: halaman ini dipakai untuk membaca —
batang mana yang memerah, penanda mana yang keluar rentang — dan model yang
berputar sendiri memaksa pembacanya mengejar benda yang sedang dilihat, dengan
sasaran yang sudah bergeser tiap kali ia hendak menunjuk sesuatu. Tombolnya
tetap ada untuk menyalakannya saat memang hendak diperagakan. Pandangan
ortogonal — rencana, elevasi, potongan — adalah alat gambar teknik,
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
