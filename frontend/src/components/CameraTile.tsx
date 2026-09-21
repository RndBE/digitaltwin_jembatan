import type { Camera } from '../domain/demoData';
import { clockOf } from './EventLog';

/**
 * Ubin siaran kamera.
 *
 * Gambarnya **peraga**, bukan siaran sungguhan — dan itu dikatakan di mukanya,
 * bukan disembunyikan. Ubin yang menggambar jalan dan kendaraan lalu diberi
 * lencana LIVE merah adalah kebohongan kecil yang mahal: operator yang
 * mengiranya siaran sungguhan akan mengambil keputusan dari gambar yang tidak
 * pernah melihat apa pun.
 *
 * Justru karena gambarnya kini jauh lebih menyerupai keluaran kamera
 * sungguhan — perspektif, kabut jarak, bintik sensor, vignet lensa — penanda
 * peraganya **dinaikkan**, bukan dibiarkan: selain lencana di pojok, ada cap
 * air melintang di tengah bingkai. Semakin meyakinkan gambarnya, semakin mahal
 * kekeliruan membacanya sebagai siaran.
 *
 * Yang di sini bukan gambarnya, melainkan **lapisan HUD di atasnya** — penanda
 * keadaan, jam, nama kamera, resolusi, dan kotak deteksi. Lapisan itulah yang
 * dipertahankan apa adanya ketika `<svg>` diganti `<video>`; ia React, bukan
 * bagian dari videonya.
 *
 * Jalur produksinya: RTSP dari kamera diubah jadi HLS oleh **MediaMTX** atau
 * **go2rtc** lalu dimainkan `hls.js` — paling mudah, latensi 3–10 detik. Untuk
 * ruang kendali yang operatornya harus bereaksi, **WebRTC lewat go2rtc**
 * menurunkannya ke bawah satu detik.
 */

export interface CameraTileProps {
  camera: Camera;
  /** Jam cuplikan telemetri, supaya jam di ubin sejalan dengan seisi aplikasi. */
  at: string;
  /** Kendaraan berat yang sedang terdeteksi lewat; menyalakan kotak deteksi. */
  detection?: string | null;
}

const STATUS_TONE: Record<Camera['status'], { dot: string; label: string }> = {
  daring: { dot: 'var(--state-normal)', label: 'Daring' },
  gangguan: { dot: 'var(--state-waspada)', label: 'Gangguan' },
  luring: { dot: 'var(--state-offline)', label: 'Luring' },
};

/*
 * Geometri perspektif satu titik.
 *
 * Inilah beda terbesar antara gambar yang terbaca sebagai kamera dan gambar
 * yang terbaca sebagai diagram. Jalan yang menyempit **lurus** ke titik lenyap
 * masih terbaca sebagai segitiga; yang membuatnya terbaca sebagai jalan adalah
 * jarak antar marka yang memampat secara **1/z**, bukan rata. Mata sangat peka
 * pada hal ini walau tidak dapat menyebut namanya.
 */
const CAKRAWALA = 96;
const DASAR = 180;

/** Ketinggian layar sebuah titik yang berjarak `z` satuan dari kamera. */
const yPada = (z: number) => CAKRAWALA + (DASAR - CAKRAWALA) / z;
/** Setengah lebar perkerasan pada ketinggian layar tertentu. */
const lebarPada = (y: number) => (y - CAKRAWALA) * 1.92;

/**
 * Bilangan tetap 0..1 dari teks.
 *
 * Enam ubin yang bergambar persis sama langsung terbaca sebagai gambar yang
 * diulang, bukan sebagai enam kamera. Benih ini menggeser awan, pohon, dan
 * bintik sensor tiap ubin sedikit — tetap, jadi gambarnya tidak berubah tiap
 * kali React menggambar ulang.
 */
function benih(teks: string): number {
  let h = 2166136261;
  for (let i = 0; i < teks.length; i++) {
    h ^= teks.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return ((h >>> 0) % 1000) / 1000;
}

/* ------------------------------------------------------------------- defs */

/**
 * Gradien dan tapis milik satu ubin.
 *
 * Pengenalnya wajib memuat `uid`: enam `<svg>` dalam satu halaman berbagi satu
 * ruang nama pengenal, dan gradien bernama sama akan saling menimpa — seluruh
 * ubin lalu memakai langit ubin terakhir.
 */
function Defs({ uid, seed }: { uid: string; seed: number }) {
  return (
    <defs>
      <linearGradient id={`${uid}-langit`} x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stopColor="#7396b2" />
        <stop offset="48%" stopColor="#a8c0ce" />
        <stop offset="86%" stopColor="#ccd8dd" />
        <stop offset="100%" stopColor="#dde5e7" />
      </linearGradient>

      <linearGradient id={`${uid}-aspal`} x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stopColor="#5b5b58" />
        <stop offset="100%" stopColor="#3c3c3b" />
      </linearGradient>

      <linearGradient id={`${uid}-tanah`} x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stopColor="#7e8467" />
        <stop offset="100%" stopColor="#5a5f49" />
      </linearGradient>

      <linearGradient id={`${uid}-air`} x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stopColor="#8fa3ad" />
        <stop offset="100%" stopColor="#4e6675" />
      </linearGradient>

      <linearGradient id={`${uid}-beton`} x1="0" y1="0" x2="1" y2="0">
        <stop offset="0%" stopColor="#4a4945" />
        <stop offset="46%" stopColor="#6e6c65" />
        <stop offset="100%" stopColor="#3b3a37" />
      </linearGradient>

      <linearGradient id={`${uid}-betonDingin`} x1="0" y1="0" x2="1" y2="0">
        <stop offset="0%" stopColor="#2f353b" />
        <stop offset="38%" stopColor="#525a62" />
        <stop offset="100%" stopColor="#23282d" />
      </linearGradient>

      {/* Kabut jarak: udara di antara kamera dan benda jauh. Tanpa ini semua
          benda tampak sama dekatnya, dan gambarnya terbaca sebagai potongan
          kertas yang ditumpuk. */}
      <linearGradient id={`${uid}-kabut`} x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stopColor="#dbe4e8" stopOpacity="0.85" />
        <stop offset="100%" stopColor="#dbe4e8" stopOpacity="0" />
      </linearGradient>

      {/* Kabut yang menempel di permukaan tanah, bukan di langit. Inilah yang
          membuat ujung jalan **larut**, bukan berhenti pada satu garis tajam —
          dan garis tajam di cakrawala adalah ciri gambar vektor yang paling
          cepat dikenali mata. */}
      <linearGradient id={`${uid}-kabutTanah`} x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stopColor="#c9d6dd" stopOpacity="0.92" />
        <stop offset="100%" stopColor="#c9d6dd" stopOpacity="0" />
      </linearGradient>

      {/* Vignet lensa — sudut bingkai selalu lebih gelap daripada tengahnya
          pada lensa lebar yang dipakai kamera pengawas. */}
      <radialGradient id={`${uid}-vignet`} cx="50%" cy="46%" r="76%">
        <stop offset="52%" stopColor="#000000" stopOpacity="0" />
        <stop offset="100%" stopColor="#000000" stopOpacity="0.5" />
      </radialGradient>

      {/* Bintik sensor. Gambar tanpa bintik terbaca sebagai gambar vektor;
          sedikit bintik saja sudah cukup membuatnya terbaca sebagai cuplikan
          kamera yang cahayanya kurang. */}
      <filter id={`${uid}-bintik`} x="0" y="0" width="100%" height="100%">
        <feTurbulence
          type="fractalNoise"
          baseFrequency="0.86"
          numOctaves={2}
          seed={Math.round(seed * 200)}
          result="n"
        />
        <feColorMatrix in="n" type="saturate" values="0.12" />
      </filter>

      <filter id={`${uid}-lembut`} x="-20%" y="-20%" width="140%" height="140%">
        <feGaussianBlur stdDeviation="1.6" />
      </filter>

      <filter id={`${uid}-buram`} x="-20%" y="-20%" width="140%" height="140%">
        <feGaussianBlur stdDeviation="0.7" />
      </filter>
    </defs>
  );
}

/* ---------------------------------------------------------------- adegan 1 */

/**
 * Oprit: jalan yang dilihat memanjang dari tiang di tepinya.
 *
 * Susunannya mengikuti apa yang benar-benar masuk ke bingkai kamera pengawas
 * jalan — langit yang kelebihan cahaya di sepertiga atas, pohon dan bukit
 * dalam kabut di garis cakrawala, lalu perkerasan yang memenuhi dua pertiga
 * bawah dengan marka yang memampat ke kejauhan.
 */
function Oprit({ uid, seed }: { uid: string; seed: number }) {
  const marka = [1.15, 1.45, 1.9, 2.5, 3.4, 4.8, 7, 11];
  const tiang = [1.25, 1.7, 2.4, 3.6, 5.6, 9.5];
  const tepi = lebarPada(DASAR);

  // Portal rangka di ujung jalan. Oprit selalu menuju sesuatu, dan yang dituju
  // oprit ini adalah jembatannya — tanpa portal itu gambarnya bisa jalan mana
  // saja, dan kamera yang bisa memandang jalan mana saja tidak berguna.
  const zPortal = 8.5;
  const yPortal = yPada(zPortal);
  const wPortal = lebarPada(yPortal) * 1.34;

  return (
    <>
      <rect x="0" y="0" width="320" height={CAKRAWALA + 2} fill={`url(#${uid}-langit)`} />

      {/* Awan tipis, digeser menurut benih ubin. */}
      <g fill="#f2f6f7" opacity="0.42" filter={`url(#${uid}-lembut)`}>
        <ellipse cx={60 + seed * 160} cy={22 + seed * 10} rx="52" ry="7" />
        <ellipse cx={96 + seed * 150} cy={30 + seed * 8} rx="30" ry="5" />
        <ellipse cx={232 - seed * 130} cy={42} rx="38" ry="5" />
      </g>

      {/* Dua lapis bukit. Yang jauh lebih pucat daripada yang dekat — itu
          kabut jarak, dan itu pula satu-satunya petunjuk kedalaman yang
          dipunyai benda tanpa tekstur. */}
      <path
        d={`M0 ${CAKRAWALA - 10} L58 ${CAKRAWALA - 19} L118 ${CAKRAWALA - 11} L186 ${CAKRAWALA - 21} L262 ${CAKRAWALA - 12} L320 ${CAKRAWALA - 17} V${CAKRAWALA + 2} H0 Z`}
        fill="#9fb3bc"
        opacity="0.42"
      />
      <path
        d={`M0 ${CAKRAWALA - 4} L42 ${CAKRAWALA - 11} L96 ${CAKRAWALA - 5} L152 ${CAKRAWALA - 13} L214 ${CAKRAWALA - 4} L276 ${CAKRAWALA - 9} L320 ${CAKRAWALA - 3} V${CAKRAWALA + 2} H0 Z`}
        fill="#7d939c"
        opacity="0.5"
      />

      {/* Barisan pohon: satu jalur bergerigi, bukan bulatan yang berdiri
          sendiri-sendiri. Dari jarak segini pohon memang menyatu menjadi
          tepian gelap yang tidak rata. */}
      <path
        d={
          `M-6 ${CAKRAWALA + 2} ` +
          Array.from({ length: 26 }, (_, i) => {
            // Lebar tiap rumpun ikut berubah, bukan hanya tingginya. Gerigi
            // yang lebarnya sama rata terbaca sebagai pola, dan pola tidak
            // pernah muncul pada barisan pohon yang sungguhan.
            const lebar = 9 + ((i * 53 + seed * 70) % 7);
            const x = -8 + i * 13 + ((i * 17 + seed * 40) % 5);
            const h = 4 + ((i * 37 + seed * 90) % 10);
            return `L${x} ${CAKRAWALA - h} L${x + lebar * 0.55} ${CAKRAWALA - h * 0.35}`;
          }).join(' ') +
          ` L326 ${CAKRAWALA + 2} Z`
        }
        fill="#4b5a44"
        opacity="0.88"
      />

      <rect x="0" y={CAKRAWALA} width="320" height={DASAR - CAKRAWALA} fill={`url(#${uid}-tanah)`} />

      {/* Bahu jalan berkerikil. */}
      <polygon
        points={`${160 - tepi * 1.3},${DASAR} ${160 + tepi * 1.3},${DASAR} ${166.5},${CAKRAWALA} ${153.5},${CAKRAWALA}`}
        fill="#605f52"
      />

      <polygon
        points={`${160 - tepi},${DASAR} ${160 + tepi},${DASAR} ${164.6},${CAKRAWALA} ${155.4},${CAKRAWALA}`}
        fill={`url(#${uid}-aspal)`}
      />

      {/* Jejak roda yang terpoles ban — dua pita yang sedikit lebih terang.
          Detail kecil, tetapi inilah yang membedakan aspal yang dipakai dari
          persegi panjang abu-abu. */}
      <g fill="#565653" opacity="0.5">
        {[-0.46, 0.46].map((sisi) => (
          <polygon
            key={sisi}
            points={`${160 + sisi * tepi - 16},${DASAR} ${160 + sisi * tepi + 16},${DASAR} ${160 + sisi * 4.6 + 1},${CAKRAWALA} ${160 + sisi * 4.6 - 1},${CAKRAWALA}`}
          />
        ))}
      </g>

      {/* Tambalan bekas perbaikan. Perkerasan yang rata sempurna sepanjang
          seratus meter tidak ada di jalan nasional mana pun. */}
      <g fill="#33332f" opacity="0.5">
        {[1.35, 2.2, 4.1].map((z, i) => {
          const y = yPada(z);
          const w = lebarPada(y);
          const sisi = i % 2 === 0 ? -0.35 : 0.42;
          return (
            <ellipse
              key={z}
              cx={160 + sisi * w}
              cy={y - 2}
              rx={w * (0.16 + ((i * 7 + seed * 10) % 8) / 90)}
              ry={(y - CAKRAWALA) * 0.05}
            />
          );
        })}
      </g>

      {/* Garis tepi menerus. */}
      <g fill="#dcd8cb" opacity="0.7">
        {[-0.9, 0.9].map((sisi) => (
          <polygon
            key={sisi}
            points={`${160 + sisi * tepi - 3},${DASAR} ${160 + sisi * tepi + 3},${DASAR} ${160 + sisi * 4.6 + 0.5},${CAKRAWALA} ${160 + sisi * 4.6 - 0.5},${CAKRAWALA}`}
          />
        ))}
      </g>

      {/* Marka tengah putus-putus. Jarak antarnya memampat 1/z — bukan rata. */}
      <g fill="#e7e2d4">
        {marka.map((z) => {
          const y0 = yPada(z);
          const y1 = yPada(z + 0.42);
          const w0 = (y0 - CAKRAWALA) * 0.055 + 0.6;
          const w1 = (y1 - CAKRAWALA) * 0.055 + 0.6;
          return (
            <polygon
              key={z}
              points={`${160 - w0},${y0} ${160 + w0},${y0} ${160 + w1},${y1} ${160 - w1},${y1}`}
              opacity={0.85 - (1 / z) * 0.1}
            />
          );
        })}
      </g>

      {/* Portal rangka jembatan di ujung jalan, sudah separuh termakan kabut. */}
      <g stroke="#8d9aa3" strokeWidth="1.6" fill="none" opacity="0.8">
        <path d={`M${160 - wPortal} ${yPortal}V${yPortal - 26}H${160 + wPortal}V${yPortal}`} />
        <path d={`M${160 - wPortal} ${yPortal - 21}H${160 + wPortal}`} strokeWidth="1.1" />
        {[0, 1, 2, 3].map((i) => {
          const a = 160 - wPortal + (i * wPortal * 2) / 4;
          const b = a + (wPortal * 2) / 4;
          return <path key={i} d={`M${a} ${yPortal - 21}L${b} ${yPortal - 26}`} strokeWidth="0.9" />;
        })}
      </g>

      {/* Rel pengaman: tiang dan satu pita menerus di atasnya. */}
      <g>
        {tiang.map((z) => {
          const y = yPada(z);
          const w = lebarPada(y);
          const t = (y - CAKRAWALA) * 0.24 + 2;
          return (
            <g key={z}>
              <rect x={160 - w * 1.18} y={y - t} width={Math.max(0.8, t * 0.15)} height={t} fill="#6e747b" />
              <rect x={160 + w * 1.18} y={y - t} width={Math.max(0.8, t * 0.15)} height={t} fill="#6e747b" />
            </g>
          );
        })}
        {[-1.18, 1.18].map((sisi) => {
          const yJauh = yPada(13);
          const wJauh = lebarPada(yJauh) * 1.18;
          const tJauh = (yJauh - CAKRAWALA) * 0.24 + 2;
          const tDekat = (DASAR - CAKRAWALA) * 0.24 + 2;
          return (
            <polygon
              key={sisi}
              points={
                `${160 + sisi * tepi},${DASAR - tDekat} ` +
                `${160 + sisi * tepi},${DASAR - tDekat * 0.52} ` +
                `${160 + (sisi / 1.18) * wJauh},${yJauh - tJauh * 0.52} ` +
                `${160 + (sisi / 1.18) * wJauh},${yJauh - tJauh}`
              }
              fill="#a3a9b0"
              opacity="0.9"
            />
          );
        })}
      </g>

      {/*
        * Kabut permukaan, ditumpuk **di atas** jalan dan rel tetapi di bawah
        * kendaraan dekat. Itu urutan yang benar: udara memang berada di antara
        * kamera dan benda jauh, bukan di antara kamera dan benda dekat.
        */}
      <rect x="0" y={CAKRAWALA - 14} width="320" height="34" fill={`url(#${uid}-kabutTanah)`} opacity="0.62" />

      {/* Dua kendaraan pada kedalaman berbeda. Lalu lintas Indonesia berjalan
          di lajur kiri, jadi yang menjauh dari kamera berada di kiri bingkai
          dan yang mendekat di kanan — dan pada kamera yang menghadap arah
          sebaliknya keduanya bertukar tempat dengan sendirinya, karena seluruh
          adegannya dicerminkan. */}
      <Kendaraan uid={uid} z={3.05} sisi={0.45} tinggi={0.6} warna="#6a7178" arah="mendekat" />
      <Kendaraan uid={uid} z={1.72} sisi={-0.44} tinggi={0.92} warna="#8d9299" arah="menjauh" kabur />

      {/* Bayangan tiang kamera jatuh di perkerasan depan. */}
      <polygon points={`0,${DASAR} 96,${DASAR} 44,${DASAR - 26} 12,${DASAR - 26}`} fill="#1c1c1b" opacity="0.18" />

      {/* Tiang lampu di sisi kiri, batangnya terpotong tepi bingkai — kamera
          nyata memang jarang memuat seluruh benda di dekatnya. */}
      <g fill="#6f757c">
        <rect x="22" y="34" width="5" height={DASAR - 34} />
        <path d="M24 38q22 -6 34 8" stroke="#6f757c" strokeWidth="3.5" fill="none" />
        <rect x="54" y="42" width="12" height="4" rx="2" fill="#8b9198" />
      </g>
    </>
  );
}

function Kendaraan({
  uid,
  z,
  sisi,
  tinggi,
  warna,
  arah,
  kabur = false,
}: {
  uid: string;
  z: number;
  sisi: number;
  tinggi: number;
  warna: string;
  /** Menjauh berarti buritannya yang terlihat; mendekat berarti mukanya. */
  arah: 'menjauh' | 'mendekat';
  kabur?: boolean;
}) {
  const y = yPada(z);
  const w = lebarPada(y);
  const lebar = w * 0.42;
  const tinggiPx = lebar * tinggi;
  const x = 160 + sisi * w - lebar / 2;
  const lampu = Math.max(1, lebar * 0.1);

  return (
    <g filter={kabur ? `url(#${uid}-buram)` : undefined}>
      {/* Bayangan di bawah bodi. Kendaraan tanpa bayangan tampak melayang, dan
          mata mengenali itu jauh sebelum mampu menyebut sebabnya. */}
      <ellipse cx={x + lebar / 2} cy={y} rx={lebar * 0.58} ry={lebar * 0.1} fill="#1d1d1c" opacity="0.34" />

      <rect x={x} y={y - tinggiPx} width={lebar} height={tinggiPx} rx={lebar * 0.05} fill={warna} />
      {/* Sisi atas bodi menangkap langit; kolongnya tidak menangkap apa pun. */}
      <rect x={x} y={y - tinggiPx} width={lebar} height={tinggiPx * 0.12} fill="#c3c9cf" opacity="0.45" />
      <rect x={x} y={y - tinggiPx * 0.14} width={lebar} height={tinggiPx * 0.14} fill="#1f2226" opacity="0.75" />

      <rect
        x={x + lebar * 0.12}
        y={y - tinggiPx * 0.9}
        width={lebar * 0.76}
        height={tinggiPx * 0.3}
        fill="#252b32"
        opacity="0.85"
      />

      {arah === 'menjauh' ? (
        <g fill="#c8443a">
          <rect x={x + lebar * 0.08} y={y - tinggiPx * 0.44} width={lampu} height={lampu * 0.7} />
          <rect x={x + lebar * 0.92 - lampu} y={y - tinggiPx * 0.44} width={lampu} height={lampu * 0.7} />
        </g>
      ) : (
        <g fill="#f2ead2" opacity="0.9">
          <rect x={x + lebar * 0.08} y={y - tinggiPx * 0.34} width={lampu} height={lampu * 0.6} />
          <rect x={x + lebar * 0.92 - lampu} y={y - tinggiPx * 0.34} width={lampu} height={lampu * 0.6} />
        </g>
      )}
    </g>
  );
}

/* ---------------------------------------------------------------- adegan 2 */

/**
 * Tengah bentang: dari **dalam** rangka, bukan dari seberang sungai.
 *
 * Kamera di tengah bentang dipasang pada batang rangkanya sendiri, dan yang
 * masuk ke bingkainya adalah lantai yang memanjang, batang diagonal yang
 * berderet ke kejauhan, dan ikatan angin di atas kepala. Siluet jembatan
 * dilihat dari kejauhan memang gambar yang bagus, tetapi tidak ada kamera
 * pemantau yang berdiri di sana — dan titik pandang yang tidak mungkin
 * membuat seluruh ubinnya terbaca sebagai ilustrasi.
 */
function Bentang({ uid, seed }: { uid: string; seed: number }) {
  const panelZ = [1.06, 1.3, 1.66, 2.2, 3.1, 4.6, 7.4, 13];
  const tepi = lebarPada(DASAR);
  /** Tinggi rangka pada satu kedalaman; sebanding lebar lantainya. */
  const tinggiRangka = (w: number) => w * 1.05;

  const simpul = panelZ.map((z) => {
    const y = yPada(z);
    const w = lebarPada(y);
    return { z, y, w, sisiX: w * 1.2, atasY: y - tinggiRangka(w) };
  });

  return (
    <>
      {/* Langit hanya terlihat lewat mulut rangka di ujung sana. */}
      <rect x="0" y="0" width="320" height="180" fill={`url(#${uid}-langit)`} />

      {/* Air di kiri-kanan lantai, terlihat di sela batang. */}
      <rect x="0" y={CAKRAWALA} width="320" height={DASAR - CAKRAWALA} fill={`url(#${uid}-air)`} />
      <g stroke="#cfdde4" strokeWidth="0.8" opacity="0.22">
        {[104, 108, 114, 122, 133, 148, 166].map((y, i) => (
          <path key={y} d={`M${((i * 41 + seed * 70) % 120) - 40} ${y}h${60 + i * 18}`} />
        ))}
      </g>

      {/* Tebing seberang, jauh dan pucat. */}
      <path
        d={`M0 ${CAKRAWALA + 1} L64 ${CAKRAWALA - 5} L142 ${CAKRAWALA - 1} L226 ${CAKRAWALA - 6} L320 ${CAKRAWALA - 2} V${CAKRAWALA + 3} H0 Z`}
        fill="#5d6d55"
        opacity="0.6"
      />

      {/* Lantai jembatan. */}
      <polygon
        points={`${160 - tepi},${DASAR} ${160 + tepi},${DASAR} ${164.6},${CAKRAWALA} ${155.4},${CAKRAWALA}`}
        fill={`url(#${uid}-aspal)`}
      />
      <g fill="#565653" opacity="0.5">
        {[-0.46, 0.46].map((sisi) => (
          <polygon
            key={sisi}
            points={`${160 + sisi * tepi - 15},${DASAR} ${160 + sisi * tepi + 15},${DASAR} ${160 + sisi * 4.6 + 1},${CAKRAWALA} ${160 + sisi * 4.6 - 1},${CAKRAWALA}`}
          />
        ))}
      </g>
      <g fill="#e7e2d4">
        {[1.15, 1.45, 1.9, 2.5, 3.4, 4.8, 7].map((z) => {
          const y0 = yPada(z);
          const y1 = yPada(z + 0.42);
          const w0 = (y0 - CAKRAWALA) * 0.055 + 0.6;
          const w1 = (y1 - CAKRAWALA) * 0.055 + 0.6;
          return (
            <polygon
              key={z}
              points={`${160 - w0},${y0} ${160 + w0},${y0} ${160 + w1},${y1} ${160 - w1},${y1}`}
              opacity="0.75"
            />
          );
        })}
      </g>

      {/* Batang tepi bawah: tumpuan seluruh rangka, sejajar tepi lantai. */}
      {[-1, 1].map((sisi) => (
        <polygon
          key={`bawah${sisi}`}
          points={
            `${160 + sisi * simpul[0].sisiX},${simpul[0].y} ` +
            `${160 + sisi * simpul[0].sisiX * 1.06},${simpul[0].y - 7} ` +
            `${160 + sisi * simpul[simpul.length - 1].sisiX * 1.06},${simpul[simpul.length - 1].y - 1.4} ` +
            `${160 + sisi * simpul[simpul.length - 1].sisiX},${simpul[simpul.length - 1].y}`
          }
          fill="#7f858b"
        />
      ))}

      {/* Batang diagonal dan vertikal kedua rangka. Yang jauh lebih tipis dan
          lebih pucat — perspektif dan kabut sekaligus. */}
      {[-1, 1].map((sisi) =>
        simpul.map((n, i) => {
          const berikut = simpul[i + 1];
          const tebal = Math.max(0.7, (n.y - CAKRAWALA) * 0.035);
          const pucat = 0.55 + (1 - i / simpul.length) * 0.4;
          return (
            <g key={`r${sisi}-${i}`} opacity={pucat}>
              <line
                x1={160 + sisi * n.sisiX}
                y1={n.y}
                x2={160 + sisi * n.sisiX}
                y2={n.atasY}
                stroke="#9aa1a8"
                strokeWidth={tebal}
              />
              {berikut ? (
                <line
                  x1={160 + sisi * n.sisiX}
                  y1={i % 2 === 0 ? n.y : n.atasY}
                  x2={160 + sisi * berikut.sisiX}
                  y2={i % 2 === 0 ? berikut.atasY : berikut.y}
                  stroke="#8d949b"
                  strokeWidth={tebal * 0.85}
                />
              ) : null}
            </g>
          );
        }),
      )}

      {/* Batang tepi atas. */}
      {[-1, 1].map((sisi) => (
        <polygon
          key={`atas${sisi}`}
          points={
            `${160 + sisi * simpul[0].sisiX},${simpul[0].atasY} ` +
            `${160 + sisi * simpul[0].sisiX},${simpul[0].atasY - 6} ` +
            `${160 + sisi * simpul[simpul.length - 1].sisiX},${simpul[simpul.length - 1].atasY - 1.2} ` +
            `${160 + sisi * simpul[simpul.length - 1].sisiX},${simpul[simpul.length - 1].atasY}`
          }
          fill="#a6adb4"
        />
      ))}

      {/* Ikatan angin di atas kepala: silang antar buhul, memampat ke ujung. */}
      <g stroke="#7f868d" fill="none">
        {simpul.slice(0, -1).map((n, i) => {
          const b = simpul[i + 1];
          const tebal = Math.max(0.5, (n.y - CAKRAWALA) * 0.022);
          return (
            <g key={`ik${i}`} strokeWidth={tebal} opacity={0.5 + (1 - i / simpul.length) * 0.35}>
              <path d={`M${160 - n.sisiX} ${n.atasY}L${160 + b.sisiX} ${b.atasY}`} />
              <path d={`M${160 + n.sisiX} ${n.atasY}L${160 - b.sisiX} ${b.atasY}`} />
              <path d={`M${160 - b.sisiX} ${b.atasY}H${160 + b.sisiX}`} strokeWidth={tebal * 1.2} />
            </g>
          );
        })}
      </g>

      {/* Sandaran tepi lantai. */}
      {[-1, 1].map((sisi) => (
        <polygon
          key={`sdr${sisi}`}
          points={
            `${160 + sisi * tepi * 1.02},${DASAR - 20} ` +
            `${160 + sisi * tepi * 1.02},${DASAR - 14} ` +
            `${160 + sisi * simpul[simpul.length - 2].sisiX},${simpul[simpul.length - 2].y - 3} ` +
            `${160 + sisi * simpul[simpul.length - 2].sisiX},${simpul[simpul.length - 2].y - 4.6}`
          }
          fill="#b6bcc2"
          opacity="0.8"
        />
      ))}

      {/* Kabut di mulut rangka sebelah sana. */}
      <rect x="0" y={CAKRAWALA - 26} width="320" height="40" fill={`url(#${uid}-kabutTanah)`} opacity="0.5" />

      <Kendaraan uid={uid} z={2.35} sisi={-0.45} tinggi={0.78} warna="#7d838a" arah="menjauh" />
    </>
  );
}

/* ---------------------------------------------------------------- adegan 3 */

/**
 * Bawah lantai: perletakan di kepala abutmen.
 *
 * Adegan paling gelap dari ketiganya, dan memang begitu di lapangan — kamera
 * di bawah lantai bekerja di dalam bayangan sepanjang hari, dengan satu berkas
 * cahaya masuk dari mulut abutmen. Kontras rendah dan warna yang condong biru
 * adalah ciri sensor yang kekurangan cahaya, bukan pilihan gaya.
 *
 * Yang harus terbaca cuma satu: **tumpukan perletakan** — pedestal beton,
 * pelat landas, bantalan elastomer berlapis, pelat atas, lalu ujung gelagar
 * yang duduk di atasnya. Itulah benda yang diawasi kamera ini, dan itulah yang
 * dicari pemeriksa ketika ia membuka rekamannya.
 */
function Tumpuan({ uid, seed }: { uid: string; seed: number }) {
  const gelagar = [28, 104, 180, 256];

  return (
    <>
      <rect x="0" y="0" width="320" height="180" fill="#171b1f" />

      {/* Dinding kepala abutmen di belakang. */}
      <rect x="0" y="30" width="320" height="150" fill={`url(#${uid}-betonDingin)`} />

      {/* Noda rembesan yang turun dari siar muai. */}
      <g fill="#171b1e" opacity="0.45">
        {[0, 1, 2, 3, 4, 5, 6, 7].map((i) => {
          const x = (i * 43 + seed * 40) % 320;
          return <rect key={i} x={x} y="30" width={2 + ((i * 7) % 6)} height={26 + ((i * 29) % 74)} />;
        })}
      </g>

      {/* Pelat lantai di atas kepala, dengan gelagar melintang yang menjorok
          keluar ke arah kamera. */}
      <rect x="0" y="0" width="320" height="26" fill="#0e1114" />
      <polygon points="0,26 320,26 320,38 0,44" fill="#131719" />
      {gelagar.map((x) => (
        <g key={x}>
          <rect x={x} y="26" width="30" height="18" fill="#1b2024" />
          <rect x={x} y="42" width="30" height="3" fill="#0d1012" />
        </g>
      ))}

      {/* Celah siar muai: satu garis cahaya siang yang menembus dari atas. */}
      <rect x="0" y="24.5" width="320" height="1.8" fill="#dfe8ee" opacity="0.4" />

      {/* Berkas cahaya dari mulut abutmen sebelah kanan. */}
      <polygon points="320,30 320,164 196,180 262,30" fill="#cfe0ec" opacity="0.08" />

      {/* Tumpukan perletakan. */}
      <g>
        {/* Pedestal beton. */}
        <polygon points="104,180 216,180 206,116 114,116" fill="#4c535a" />
        <polygon points="114,116 206,116 206,122 114,122" fill="#5e666e" />
        {/* Pelat landas bawah. */}
        <rect x="108" y="106" width="104" height="10" fill="#767d85" />
        <rect x="108" y="106" width="104" height="2" fill="#939ba3" />
        {/* Bantalan elastomer berlapis — karet gelap dengan sisipan pelat. */}
        <rect x="118" y="82" width="84" height="24" fill="#15181b" />
        <g fill="#3d454d">
          <rect x="118" y="88" width="84" height="1.8" />
          <rect x="118" y="94" width="84" height="1.8" />
          <rect x="118" y="100" width="84" height="1.8" />
        </g>
        {/* Pelat atas dan ujung gelagar yang duduk di atasnya. */}
        <rect x="110" y="74" width="100" height="8" fill="#828a92" />
        <rect x="110" y="74" width="100" height="2" fill="#a2aab2" />
        <rect x="126" y="52" width="68" height="22" fill="#2a3036" />
        <rect x="118" y="46" width="84" height="7" fill="#3a4148" />
        {/* Baut angkur pada pelat atas. */}
        <g fill="#9aa1a8" opacity="0.9">
          {[116, 130, 190, 204].map((x) => (
            <circle key={x} cx={x} cy="78" r="1.9" />
          ))}
        </g>
        {/* Bayangan yang dijatuhkan tumpukan ke dinding di belakangnya. */}
        <polygon points="216,180 244,180 214,116 206,116" fill="#0f1215" opacity="0.5" />
      </g>

      {/* Batu pelindung dan genangan di kaki abutmen. */}
      <g fill="#20252a">
        {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map((i) => {
          const x = (i * 37 + seed * 30) % 336;
          return <ellipse key={i} cx={x} cy={170 + ((i * 13) % 10)} rx={12 + ((i * 5) % 8)} ry={6} />;
        })}
      </g>
      <ellipse cx="62" cy="172" rx="46" ry="7" fill="#37424a" opacity="0.5" />
    </>
  );
}

/* --------------------------------------------------------------- pembungkus */

function Scene({ view, uid, seed }: { view: Camera['view']; uid: string; seed: number }) {
  if (view === 'oprit') return <Oprit uid={uid} seed={seed} />;
  if (view === 'bentang') return <Bentang uid={uid} seed={seed} />;
  return <Tumpuan uid={uid} seed={seed} />;
}

export function CameraTile({ camera, at, detection = null }: CameraTileProps) {
  const tone = STATUS_TONE[camera.status];
  const offline = camera.status === 'luring';
  const uid = `cam-${camera.id.toLowerCase()}`;
  const seed = benih(camera.id);
  // Dua kamera oprit saling berhadapan. Yang menghadap barat dicerminkan,
  // supaya keduanya tidak terbaca sebagai satu gambar yang diulang.
  const cermin = camera.place.toLowerCase().includes('menghadap barat');

  return (
    <figure className="glass card cam" style={{ margin: 0, padding: 0, overflow: 'hidden', gap: 0 }}>
      <div style={{ position: 'relative', lineHeight: 0 }}>
        <svg
          viewBox="0 0 320 180"
          width="100%"
          role="img"
          aria-label={`Peraga siaran ${camera.id}, ${camera.place}`}
          style={{ display: 'block', filter: offline ? 'grayscale(1) brightness(0.45)' : undefined }}
        >
          <Defs uid={uid} seed={seed} />

          <g transform={cermin ? 'translate(320 0) scale(-1 1)' : undefined}>
            <Scene view={camera.view} uid={uid} seed={seed} />
          </g>

          {detection && !offline ? (
            <>
              {/* Letaknya mengikuti kendaraan dekat di lajur yang menjauh —
                  kotak deteksi yang melayang di ruang kosong justru
                  memberitahu pembacanya bahwa kotak itu tidak berasal dari
                  gambarnya. */}
              <rect x="93" y="105" width="56" height="42" fill="none" stroke="var(--state-waspada)" strokeWidth="1.6" />
              <rect x="93" y="94" width="56" height="11" fill="var(--state-waspada)" />
              <text x="97" y="102.5" fontSize="7.5" fill="#10233a" fontFamily="var(--font-sans)" fontWeight="700">
                {detection}
              </text>
            </>
          ) : null}

          {/*
            * Tiga lapis terakhir yang mengubah gambar vektor menjadi cuplikan
            * kamera, dan urutannya menentukan: bintik dulu, lalu vignet. Kalau
            * dibalik, bintiknya akan tampak menempel di atas lensa alih-alih
            * berada di dalam gambarnya.
            */}
          <rect x="0" y="0" width="320" height="180" filter={`url(#${uid}-bintik)`} opacity="0.085" />
          <rect x="0" y="0" width="320" height="180" fill={`url(#${uid}-vignet)`} />

          {/*
            * Cap air peraga.
            *
            * Sengaja terbaca, bukan sekadar formalitas: semakin gambarnya
            * menyerupai siaran sungguhan, semakin mahal harga salah membacanya.
            */}
          <text
            x="160"
            y="98"
            textAnchor="middle"
            fontSize="19"
            fontFamily="var(--font-sans)"
            fontWeight="700"
            fill="#ffffff"
            opacity="0.035"
            letterSpacing="5"
            transform="rotate(-11 160 98)"
          >
            PERAGA
          </text>
        </svg>

        {/*
          * HUD sebagai lapisan HTML di atas gambar, bukan digambar ke dalam
          * SVG-nya: begitu `<svg>` diganti `<video>`, lapisan ini tinggal tetap
          * di tempatnya tanpa disentuh.
          */}
        <div className="cam-hud">
          <span className="cam-badge">
            <span className="tag-dot" style={{ background: tone.dot }} aria-hidden="true" />
            {offline ? 'LURING' : 'PERAGA'}
          </span>
          <span className="cam-badge" style={{ marginLeft: 'auto' }}>
            {camera.id}
          </span>
        </div>

        <div className="cam-hud cam-hud--bawah">
          <span className="cam-badge tabular">{offline ? '—' : clockOf(at)}</span>
          <span className="cam-badge tabular" style={{ marginLeft: 'auto' }}>
            {camera.resolution} · {camera.fps} fps
          </span>
        </div>
      </div>

      <figcaption
        className="row"
        style={{ gap: 'var(--space-2)', padding: 'var(--space-2) var(--space-3)', fontSize: 12.5 }}
      >
        <span className="tag-dot" style={{ background: tone.dot }} aria-hidden="true" />
        <span style={{ fontWeight: 600 }}>{camera.place}</span>
        <span className="row" style={{ gap: 6, marginLeft: 'auto' }}>
          {camera.ptz ? <span className="tag tag-brand">PTZ</span> : null}
          {camera.recording ? (
            <span className="tag tag-outline">rekam</span>
          ) : (
            <span className="tag tag-neutral">tidak merekam</span>
          )}
        </span>
      </figcaption>

      {camera.note ? (
        <p
          className="text-muted"
          style={{ fontSize: 11.5, lineHeight: 1.5, padding: '0 var(--space-3) var(--space-3)' }}
        >
          {camera.note}
        </p>
      ) : null}
    </figure>
  );
}
