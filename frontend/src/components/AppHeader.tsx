import type { Telemetry } from '../lib/types';
import { ALERT_RULES, activeRule, jamSejak, lamaSejak } from '../domain/alertRules';
import { clockOf } from './EventLog';
import { StatusTag } from './Ui';

/**
 * Kepala lajur isi — satu baris di atas halaman, bukan di atas rel.
 *
 * Pembagiannya: **rel memuat yang tetap, kepala memuat yang berubah.** Tanda
 * platform dan nama aset tidak berganti sepanjang sesi, jadi keduanya tinggal
 * di rel yang juga tidak berganti. Yang berubah — halaman yang sedang dibuka,
 * tingkat siaga, dan keadaan aliran data — berdiri di kepala, tepat di atas
 * benda yang berubah itu.
 *
 * Bentuknya berubah tiga kali, dan tiap perubahan membuang satu baris:
 *
 *   1. Dua bilah bertumpuk — tingkat siaga, lalu keadaan aliran data
 *      (`LiveStrip`) tepat di bawahnya. Dua baris untuk pekerjaan satu baris,
 *      dan yang di bawah cuma ada di tiga halaman sehingga tinggi halaman
 *      melompat tiap berpindah menu.
 *   2. Keduanya digabung jadi satu bilah.
 *   3. Bilah itu sempat dinaikkan menjadi kepala penuh lebar di atas rel
 *      sekaligus. Yang hilang karenanya adalah **batas tegak** antara rel dan
 *      isi: rel jadi tampak menggantung di bawah sesuatu, bukan berdiri
 *      sendiri dari atas ke bawah.
 *
 * Nama halaman yang sedang dibuka ditulis di kiri kepala. Ia memang diulang
 * oleh `PageHeader` di bawahnya, dan pengulangan itu disengaja: judul halaman
 * ikut tergulir ke luar layar, sedangkan kepala ini tidak.
 */

export interface AppHeaderProps {
  /** Nama layar yang sedang dibuka. */
  title: string;
  telemetry: Telemetry | null;
  /** Sejak kapan tingkat siaga yang sekarang berlaku. */
  alertSince: string;
  /** Jarak antar cuplikan yang sedang dipakai. */
  intervalMs: number;
  /** Aset tanpa telemetri — model acuan; tidak ada tingkat siaga untuknya. */
  reference?: boolean;
  onOpenRules: () => void;
}

/** Tanggal gaya Indonesia yang pendek: `21 Sep 2026`. */
function tanggalPendek(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' });
}

export function AppHeader({
  title,
  telemetry,
  alertSince,
  intervalMs,
  reference = false,
  onOpenRules,
}: AppHeaderProps) {
  const berlaku = activeRule(telemetry?.readings ?? []);
  const paused = telemetry?.paused ?? false;
  // Pada laju satu menit jembatan sedang tenang — titik yang berkedip cepat di
  // sebelahnya akan menjanjikan sesuatu yang tidak sedang terjadi.
  const quiet = intervalMs >= 60_000;

  /*
   * Tingkat siaga ditulis "2 dari 3", bukan cuma "WASPADA".
   *
   * Nama tingkat saja tidak memberi tahu masih ada berapa langkah tersisa di
   * atasnya, dan itu pertanyaan pertama orang yang belum hafal tangganya.
   * Pembaginya dihitung dari `ALERT_RULES`, bukan diketik — supaya angkanya
   * tidak berbohong pada hari sebuah tingkat ditambahkan.
   */
  const jumlahTingkat = ALERT_RULES.length;
  const tingkatKe = jumlahTingkat - ALERT_RULES.findIndex((r) => r.code === berlaku.rule.code);

  return (
    <header className="app-header glass glass--chip">
      <span className="app-header-judul">{title}</span>

      {reference || !telemetry ? (
        <span className="text-muted topbar-rule">
          {reference ? 'Model acuan · tidak memiliki sensor terpasang' : 'Menyiapkan tingkat siaga…'}
        </span>
      ) : (
        <>
          <button
            type="button"
            className="app-header-siaga"
            onClick={onOpenRules}
            title={berlaku.rule.criteria}
          >
            <StatusTag status={berlaku.rule.level}>
              {berlaku.rule.level}
              <span className="siaga-tingkat">
                {' '}
                · tingkat {tingkatKe} dari {jumlahTingkat}
              </span>
            </StatusTag>
            <span className="tag tag-outline tabular topbar-kode">{berlaku.rule.code}</span>
          </button>

          {/*
            * Kalimat kriteria tidak digambar di sini.
            *
            * Ia terpotong di hampir semua lebar layar — dan yang terpotong
            * justru penutupnya, bagian yang membedakan "menyentuh ambang
            * waspada" dari "belum menyentuh ambang kritis". Kalimat yang
            * separuh terbaca bukan keterangan yang lebih ringkas, ia
            * keterangan yang salah sambil memakan 359 piksel.
            *
            * Tiga tempat lain sudah memuatnya utuh: bisikan pada lencana
            * siaga di sebelah kiri, kartu Tangga siaga di Dashboard, dan
            * halaman Aturan & ambang. Kode aturannya sendiri sudah cukup untuk
            * dirujuk di berita acara.
            */}
          <span className="text-muted topbar-since">
            sejak <span className="tabular">{jamSejak(alertSince)}</span> · {lamaSejak(alertSince)}
          </span>

          <span className="topbar-aliran">
            <span
              className="topbar-denyut"
              aria-hidden="true"
              style={{
                background: paused
                  ? 'var(--mist-400)'
                  : quiet
                    ? 'var(--state-normal)'
                    : 'var(--brand-400)',
                animation: paused || quiet ? 'none' : 'blink 1.2s infinite',
              }}
            />
            <strong className="topbar-mode">
              {paused ? 'Dijeda' : quiet ? 'Rutin' : 'Langsung'}
            </strong>
            {/*
              * Laju cuplikan dan pencacah paket tidak ikut naik ke sini.
              * Denyut, nama mode, dan jam perbaruan sudah membuktikan bahwa
              * datanya mengalir; keduanya hanya menambah angka pada baris yang
              * sudah penuh, dan keduanya ada lengkap di halaman Data.
              */}
            <span className="topbar-butir topbar-jam">
              <span className="text-muted topbar-tanggal">{tanggalPendek(telemetry.at)}, </span>
              <span className="tabular">{clockOf(telemetry.at)}</span>
              <span className="text-muted topbar-zona"> WIB</span>
            </span>
          </span>
        </>
      )}

      {/* Pada bilah yang tinggal selebar telapak tangan, tombolnya dipendekkan
          alih-alih dibuang: ia satu-satunya jalan menuju keterangan lengkap
          dari semua yang barusan disembunyikan. */}
      <button type="button" className="btn btn-sm btn-ghost app-header-tombol" onClick={onOpenRules}>
        <span className="topbar-panjang">Aturan &amp; ambang</span>
        <span className="topbar-pendek">Aturan</span>
      </button>
    </header>
  );
}
