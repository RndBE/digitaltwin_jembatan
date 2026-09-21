/**
 * Riwayat deret waktu yang bertahan di disk.
 *
 * Penyangga di dalam mesin simulasi hanya memuat beberapa menit terakhir, dan
 * hilang begitu prosesnya berhenti. Itu cukup untuk sebuah monitor, tidak
 * cukup untuk sebuah situs telemetri: pertanyaan yang benar-benar dipakai
 * mengambil keputusan selalu tentang rentang yang lebih panjang daripada layar
 * — apakah lendutan bulan ini lebih dalam daripada bulan lalu, berapa kali
 * regangan menyentuh ambang sepanjang musim hujan, apakah suhu dek naik
 * bersama umur perkerasan.
 *
 * Bentuk simpanannya sengaja sederhana: satu baris JSON per cuplikan, satu
 * berkas per jembatan per hari.
 *
 *   data/history/jbt-progo/2026-09-21.ndjson
 *   {"t":1758441600000,"v":{"vib":0.121,"strain":85.4,...}}
 *
 * Tidak ada basis data, dan itu keputusan yang disengaja. Menambah satu baris
 * ke berkas teks adalah satu panggilan sistem; membaca sebulan adalah membaca
 * tiga puluh berkas berurutan. Selama satu proses menulis satu jembatan, tidak
 * ada yang dapat diberikan mesin basis data di sini selain ketergantungan baru
 * yang harus dipasang di server Balai. Hari data ini perlu dibagi ke banyak
 * proses atau disimpan bertahun-tahun, modul inilah yang diganti — pemanggilnya
 * hanya memakai `record` dan `query`.
 */
const fs = require('fs');
const path = require('path');
const config = require('../config');
const { SENSORS } = require('../domain/sensors');

/** Cuplikan hari ini per jembatan, supaya kueri hari berjalan tidak menyentuh disk. */
const memori = new Map();

/** Kapan tiap jembatan terakhir menulis, untuk menjaga jarak antar cuplikan. */
const terakhirTulis = new Map();

const hariDari = (ms) => {
  const d = new Date(ms);
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
};

const berkasHari = (bridgeId, hari) =>
  path.join(config.HISTORY_DIR, bridgeId, `${hari}.ndjson`);

/**
 * Catat satu cuplikan.
 *
 * Dipanggil dari pengatur waktu yang berdetak lima kali sedetik, tetapi hanya
 * menulis sekali tiap `HISTORY_SAMPLE_MS`. Menyimpan tiap detak berarti
 * setengah juta baris sehari per jembatan untuk menjawab pertanyaan yang tidak
 * pernah ditanyakan: tidak ada yang memeriksa regangan pada resolusi dua ratus
 * milidetik seminggu kemudian. Yang disimpan rerata satu menit — satuan yang
 * sama dengan yang ditampilkan di layar.
 */
function record(bridgeId, snapshot) {
  const now = Date.parse(snapshot.at) || Date.now();
  const sebelumnya = terakhirTulis.get(bridgeId) || 0;
  if (now - sebelumnya < config.HISTORY_SAMPLE_MS) return;
  terakhirTulis.set(bridgeId, now);

  const nilai = {};
  snapshot.readings.forEach((r) => {
    nilai[r.id] = r.value;
  });
  const baris = { t: now, v: nilai };

  const hari = hariDari(now);
  const kunci = `${bridgeId}|${hari}`;
  const buffer = memori.get(kunci) || [];
  buffer.push(baris);
  memori.set(kunci, buffer);
  // Hari yang sudah lewat tidak perlu dipegang di memori; berkasnya sudah ada.
  memori.forEach((_, k) => {
    if (k.startsWith(`${bridgeId}|`) && k !== kunci) memori.delete(k);
  });

  try {
    const berkas = berkasHari(bridgeId, hari);
    fs.mkdirSync(path.dirname(berkas), { recursive: true });
    fs.appendFileSync(berkas, `${JSON.stringify(baris)}\n`);
  } catch (err) {
    // Riwayat yang gagal ditulis tidak boleh menjatuhkan pemantauan langsung:
    // yang hilang satu cuplikan, bukan seluruh layanan.
    console.warn(`[riwayat] gagal menulis ${bridgeId}: ${err.message}`);
  }
}

/** Baca satu berkas hari; baris rusak dilewati, bukan menggagalkan seluruh kueri. */
function bacaHari(bridgeId, hari) {
  const kunci = `${bridgeId}|${hari}`;
  if (memori.has(kunci)) return memori.get(kunci);
  let isi;
  try {
    isi = fs.readFileSync(berkasHari(bridgeId, hari), 'utf8');
  } catch {
    return [];
  }
  const baris = [];
  isi.split('\n').forEach((teks) => {
    if (!teks.trim()) return;
    try {
      baris.push(JSON.parse(teks));
    } catch {
      /* baris separuh tertulis saat proses mati; dilewati */
    }
  });
  return baris;
}

/** Banyak keranjang terbesar yang dilayani satu kueri. */
const MAX_BUCKETS = 2000;

/**
 * Riwayat satu rentang waktu, sudah diringkas per keranjang.
 *
 * Yang dikembalikan **tiga angka per keranjang**, bukan satu. Rata-rata
 * sendirian menyembunyikan justru kejadian yang dicari: satu truk berlebih
 * yang lewat pukul dua pagi mengangkat regangan selama tiga puluh detik, dan
 * pada keranjang satu jam rata-ratanya nyaris tidak bergerak. Nilai tertinggi
 * tiap keranjanglah yang membuat kejadian itu tetap terlihat pada tampilan
 * sebulan.
 */
function query(bridgeId, { from, to, bucketMs, sensorIds } = {}) {
  const akhir = Number(to) || Date.now();
  const awal = Number(from) || akhir - 24 * 3_600_000;
  const ids = (sensorIds && sensorIds.length ? sensorIds : SENSORS.map((s) => s.id)).filter(
    (id) => SENSORS.some((s) => s.id === id),
  );

  let keranjang = Math.max(60_000, Number(bucketMs) || 0);
  if (!bucketMs) {
    // Keranjang bawaan: sekitar dua ratus titik pada rentang apa pun. Cukup
    // untuk bentuk grafiknya, tidak cukup untuk membebani peramban.
    keranjang = Math.max(60_000, Math.round((akhir - awal) / 200 / 60_000) * 60_000);
  }
  if ((akhir - awal) / keranjang > MAX_BUCKETS) {
    keranjang = Math.ceil((akhir - awal) / MAX_BUCKETS / 60_000) * 60_000;
  }

  /** @type {Map<number, Map<string, {min:number,max:number,jumlah:number,n:number}>>} */
  const peta = new Map();
  for (let hari = new Date(awal); hari.getTime() <= akhir; hari.setDate(hari.getDate() + 1)) {
    bacaHari(bridgeId, hariDari(hari.getTime())).forEach((baris) => {
      if (baris.t < awal || baris.t > akhir) return;
      const t = Math.floor(baris.t / keranjang) * keranjang;
      let perSensor = peta.get(t);
      if (!perSensor) {
        perSensor = new Map();
        peta.set(t, perSensor);
      }
      ids.forEach((id) => {
        const nilai = baris.v[id];
        if (typeof nilai !== 'number') return;
        const agg = perSensor.get(id);
        if (!agg) perSensor.set(id, { min: nilai, max: nilai, jumlah: nilai, n: 1 });
        else {
          agg.min = Math.min(agg.min, nilai);
          agg.max = Math.max(agg.max, nilai);
          agg.jumlah += nilai;
          agg.n += 1;
        }
      });
    });
  }

  const waktu = [...peta.keys()].sort((a, b) => a - b);
  const series = ids.map((id) => {
    const sensor = SENSORS.find((s) => s.id === id);
    const points = [];
    waktu.forEach((t) => {
      const agg = peta.get(t).get(id);
      if (!agg) return;
      const bulat = (n) => Number(n.toFixed(sensor.dec + 2));
      points.push({ t, min: bulat(agg.min), avg: bulat(agg.jumlah / agg.n), max: bulat(agg.max) });
    });
    return {
      sensorId: id,
      name: sensor.name,
      unit: sensor.unit,
      warn: sensor.warn,
      crit: sensor.crit,
      points,
    };
  });

  return { bridgeId, from: awal, to: akhir, bucketMs: keranjang, series };
}

/**
 * Buang berkas yang lebih tua daripada masa simpan.
 *
 * Dijalankan sekali saat mulai, bukan terjadwal: proses ini biasanya hidup
 * berminggu-minggu, dan sehari lebih tua daripada batas bukan keadaan yang
 * mendesak. Yang penting berkasnya tidak tumbuh tanpa batas selama bertahun.
 */
function prune(now = Date.now()) {
  const batas = now - config.HISTORY_RETENTION_DAYS * 86_400_000;
  let dibuang = 0;
  let akar;
  try {
    akar = fs.readdirSync(config.HISTORY_DIR, { withFileTypes: true });
  } catch {
    return 0;
  }
  akar
    .filter((entry) => entry.isDirectory())
    .forEach((entry) => {
      const dir = path.join(config.HISTORY_DIR, entry.name);
      fs.readdirSync(dir).forEach((nama) => {
        const cocok = /^(\d{4})-(\d{2})-(\d{2})\.ndjson$/.exec(nama);
        if (!cocok) return;
        const hari = new Date(Number(cocok[1]), Number(cocok[2]) - 1, Number(cocok[3])).getTime();
        if (hari >= batas) return;
        try {
          fs.unlinkSync(path.join(dir, nama));
          dibuang += 1;
        } catch {
          /* berkas terkunci; dicoba lagi pada proses berikutnya */
        }
      });
    });
  return dibuang;
}

/** Keterangan singkat isi simpanan, untuk `/health` dan layar Data. */
function stats(bridgeId) {
  let hari = 0;
  let bita = 0;
  try {
    const dir = path.join(config.HISTORY_DIR, bridgeId);
    fs.readdirSync(dir).forEach((nama) => {
      if (!nama.endsWith('.ndjson')) return;
      hari += 1;
      bita += fs.statSync(path.join(dir, nama)).size;
    });
  } catch {
    return { days: 0, bytes: 0 };
  }
  return { days: hari, bytes: bita };
}

module.exports = { record, query, prune, stats };
