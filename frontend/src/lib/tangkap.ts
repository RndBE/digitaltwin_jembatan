/**
 * Tangkapan bingkai kamera menjadi gambar JPEG.
 *
 * Pedoman meminta foto digital untuk tiap kerusakan: tidak lebih kecil dari
 * 640 × 480 piksel dan berorientasi lanskap (Bab 4.4.3, Lampiran G). Bingkai
 * 16:9 pada 960 × 540 memenuhi keduanya.
 *
 * **Isinya peraga.** Sampai kamera sungguhan tersambung, bingkai yang
 * ditangkap adalah gambar vektor `CameraFrame`, bukan hasil lensa. Karena itu
 * pita keterangan dibakar *ke dalam piksel* gambarnya — kamera, jam, dan
 * kalimat "tangkapan peraga" — supaya gambar yang kelak disalin ke berkas lain
 * tetap menyatakan asalnya. Pita yang hanya berupa label di layar hilang di
 * langkah pertama gambarnya diunduh.
 *
 * Jalur sungguhan: bila `<svg>` diganti `<video>`, `tangkapSvg` tinggal
 * diganti `drawImage(video, …)` pada kanvas yang sama; pita dan JPEG-nya
 * tidak berubah.
 */

export interface Tangkapan {
  /** `data:image/jpeg;base64,…` */
  data: string;
  lebar: number;
  tinggi: number;
}

export const LEBAR_TANGKAPAN = 960;
const KUALITAS = 0.82;

/** Nilai `var(--x)` di dalam serialisasi SVG diganti nilai sebenarnya; gambar mandiri tidak mewarisi variabel CSS halaman. */
function selesaikanVariabel(teks: string): string {
  const gaya = getComputedStyle(document.documentElement);
  return teks.replace(/var\((--[\w-]+)\)/g, (_, nama: string) => gaya.getPropertyValue(nama).trim() || 'currentColor');
}

function muatGambar(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const gambar = new Image();
    gambar.onload = () => resolve(gambar);
    gambar.onerror = () => reject(new Error('Bingkai kamera tidak dapat dibaca sebagai gambar.'));
    gambar.src = url;
  });
}

export async function tangkapSvg(
  svg: SVGSVGElement,
  keterangan: { kamera: string; tempat: string; waktu: Date },
): Promise<Tangkapan> {
  const [, , vw, vh] = (svg.getAttribute('viewBox') ?? '0 0 320 180').split(/\s+/).map(Number);
  const lebar = LEBAR_TANGKAPAN;
  const tinggi = Math.round((lebar * vh) / vw);

  const salinan = svg.cloneNode(true) as SVGSVGElement;
  salinan.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
  salinan.setAttribute('width', String(lebar));
  salinan.setAttribute('height', String(tinggi));
  const teks = selesaikanVariabel(new XMLSerializer().serializeToString(salinan));

  const url = URL.createObjectURL(new Blob([teks], { type: 'image/svg+xml;charset=utf-8' }));
  try {
    const gambar = await muatGambar(url);
    const kanvas = document.createElement('canvas');
    kanvas.width = lebar;
    kanvas.height = tinggi;
    const ctx = kanvas.getContext('2d');
    if (!ctx) throw new Error('Kanvas tidak tersedia.');
    ctx.drawImage(gambar, 0, 0, lebar, tinggi);

    // Pita keterangan dibakar ke piksel; lihat catatan di kepala berkas.
    const pita = 34;
    ctx.fillStyle = 'rgb(8 16 28 / 0.82)';
    ctx.fillRect(0, tinggi - pita, lebar, pita);
    ctx.fillStyle = '#e4eefb';
    ctx.font = '600 15px system-ui, sans-serif';
    ctx.textBaseline = 'middle';
    const jam = keterangan.waktu.toLocaleString('id-ID', { dateStyle: 'medium', timeStyle: 'medium' });
    ctx.fillText(`${keterangan.kamera} · ${keterangan.tempat} · ${jam}`, 14, tinggi - pita / 2);
    ctx.textAlign = 'right';
    ctx.fillStyle = '#fbbf24';
    ctx.fillText('TANGKAPAN PERAGA · bukan foto lapangan', lebar - 14, tinggi - pita / 2);

    return { data: kanvas.toDataURL('image/jpeg', KUALITAS), lebar, tinggi };
  } finally {
    URL.revokeObjectURL(url);
  }
}
