import type { Series } from '../hooks/useTelemetry';
import type { Telemetry } from '../lib/types';
import { SENSOR_BY_ID, TAG_CLASS, formatValue } from '../domain/sensors';
import { SCENARIOS } from '../domain/scenarios';
import {
  SENSOR_FOCUS,
  cameraForSensor,
  cueForSensor,
  deltaPercent,
  referenceValue,
} from '../domain/cameras';
import { CameraFrame } from './CameraTile';

/**
 * Sensor dan kamera, disatukan.
 *
 * Sensor menjawab *berapa*, kamera menjawab *seperti apa*. Sebelum ini
 * keduanya tinggal di halaman yang berbeda, dan operator yang melihat
 * kemiringan melewati ambang harus mengingat sendiri kamera mana yang
 * menghadap tumpuan timur, membukanya di halaman lain, lalu mencocokkan
 * jamnya. Tiga langkah dari ingatan; tiga tempat kekeliruan masuk.
 *
 * Yang dikerjakan berkas ini dua hal saja:
 *
 *   1. **Pratinjau** pada label penanda sensor di model tiga dimensi —
 *      bingkai kecil dari kamera yang mengawasi titik itu, dengan petaknya
 *      disorot.
 *   2. **Perbandingan** dua bingkai berdampingan: acuan ketika kanal itu
 *      masih aman, dan keadaan sekarang, beserta selisih angkanya.
 *
 * Bingkai acuannya **bukan gambar lama yang disimpan** — pada peraga ini ia
 * digambar ulang tanpa isyarat kerusakan, dan angkanya diambil dari deret
 * pembanding yang direkam saat skenario acuan berjalan. Di sistem sungguhan
 * yang berubah hanya sumbernya: bingkai kiri menjadi cuplikan tersimpan dari
 * saat kanal itu terakhir berstatus AMAN, bingkai kanan cuplikan siaran. Tata
 * letak, sorotan, dan hitungan selisihnya tidak berubah sama sekali.
 */

interface SensorCameraProps {
  bridgeId: string;
  sensorId: string;
  telemetry: Telemetry | null;
  series: Record<string, Series>;
}

/** Angka acuan, angka sekarang, selisih, dan isyarat yang dipakai keduanya. */
function bacaan({ bridgeId, sensorId, telemetry, series }: SensorCameraProps) {
  const spec = SENSOR_BY_ID[sensorId];
  const reading = telemetry?.readings.find((r) => r.id === sensorId);
  if (!spec || !reading) return null;

  const acuan = referenceValue(series[sensorId]?.baseline, reading.baseline);
  const flood = telemetry ? (SCENARIOS[telemetry.scenario]?.environment?.flood ?? 0) : 0;

  return {
    spec,
    reading,
    acuan,
    selisih: deltaPercent(reading.value, acuan),
    cue: cueForSensor(sensorId, reading.status, flood),
    camera: cameraForSensor(bridgeId, sensorId),
    focus: SENSOR_FOCUS[sensorId] ?? null,
    at: telemetry?.at ?? new Date().toISOString(),
  };
}

/**
 * Selisih sebagai persen, dengan tanda yang jujur.
 *
 * Pembulatan ke bilangan bulat membuat selisih −0,4 % tertulis "−0 %", dan
 * tanda minus di depan nol mengabarkan penurunan yang tidak terjadi. Di bawah
 * setengah persen yang benar adalah menulis nol tanpa tanda.
 */
function persen(nilai: number | null): string {
  if (nilai === null) return '—';
  const bulat = Math.round(nilai);
  if (bulat === 0) return '0 %';
  return `${bulat > 0 ? '+' : '−'}${Math.abs(bulat)} %`;
}

const TONE = {
  AMAN: 'var(--state-normal)',
  WASPADA: 'var(--state-waspada)',
  KRITIS: 'var(--state-bahaya)',
} as const;

/* ------------------------------------------------------------ label 3D */

export interface SensorLabelCardProps extends SensorCameraProps {
  /** Membuka panel perbandingan; tombolnya disembunyikan bila tidak diberikan. */
  onCompare?: (sensorId: string) => void;
}

/**
 * Isi label melayang di atas penanda sensor.
 *
 * Label ini menempel pada penanda yang bergerak mengikuti kamera tiga
 * dimensi, jadi ia harus tetap kecil: satu baris angka, satu baris tempat,
 * lalu satu bingkai kamera selebar 168 piksel. Lebih dari itu ia berhenti
 * menjadi label dan mulai menutupi jembatan yang sedang dibaca.
 */
export function SensorLabelCard({ onCompare, ...props }: SensorLabelCardProps) {
  const data = bacaan(props);
  if (!data) return null;

  const { spec, reading, camera, focus, at, cue } = data;
  const tone = TONE[reading.status];

  return (
    <div className="penanda-kartu">
      <div className="penanda-kepala">
        <span className="penanda-nama">{spec.name}</span>
        <span className="tabular penanda-nilai">
          {formatValue(spec, reading.value)} {spec.unit}
        </span>
        <span className={TAG_CLASS[reading.status]}>{reading.status}</span>
      </div>
      <div className="penanda-tempat">
        {spec.node} · ambang {formatValue(spec, spec.warn)} {spec.unit}
      </div>

      {camera ? (
        <div className="penanda-kamera">
          <CameraFrame
            camera={camera}
            at={at}
            focus={focus}
            focusLabel={`${spec.name} ${formatValue(spec, reading.value)} ${spec.unit}`}
            focusColor={tone}
            cue={cue}
            stamp="SEKARANG"
          />
        </div>
      ) : (
        <div className="penanda-tempat">Tidak ada kamera yang mengawasi titik ini.</div>
      )}

      {camera && onCompare ? (
        <button
          type="button"
          className="btn btn-sm btn-primary penanda-tombol"
          onClick={() => onCompare(props.sensorId)}
        >
          Bandingkan dengan kondisi aman
        </button>
      ) : null}
    </div>
  );
}

/* ------------------------------------------------------ panel perbandingan */

/**
 * Dua bingkai berdampingan: acuan aman dan keadaan sekarang.
 *
 * Urutannya kiri-ke-kanan mengikuti urutan waktu, dan itu bukan selera:
 * orang membaca perubahan sebagai "dari ini menjadi itu", jadi bingkai yang
 * lebih lama harus berada di sebelah kiri. Dibalik, selisih yang sama terbaca
 * sebagai perbaikan.
 */
export function SensorCameraCompare(props: SensorCameraProps) {
  const data = bacaan(props);
  if (!data) return <p className="text-muted">Kanal ini tidak sedang melaporkan nilai.</p>;

  const { spec, reading, acuan, selisih, cue, camera, focus, at } = data;
  const tone = TONE[reading.status];

  if (!camera) {
    return (
      <p className="text-muted">
        Tidak ada kamera yang menghadap {spec.node.toLowerCase()}. Perbandingan gambar hanya tersedia
        untuk titik yang terpasang kamera.
      </p>
    );
  }

  return (
    <div className="banding">
      <div className="banding-bingkai">
        <figure className="glass card banding-kartu">
          <CameraFrame
            camera={camera}
            at={at}
            focus={focus}
            focusLabel={`${spec.name} ${formatValue(spec, acuan)} ${spec.unit}`}
            focusColor="var(--state-normal)"
            cue={null}
            stamp="ACUAN · AMAN"
          />
          <figcaption className="banding-kaki">
            <span className="banding-judul">Kondisi aman</span>
            <span className="text-muted">
              rerata deret pembanding · {formatValue(spec, acuan)} {spec.unit}
            </span>
          </figcaption>
        </figure>

        <figure className="glass card banding-kartu">
          <CameraFrame
            camera={camera}
            at={at}
            focus={focus}
            focusLabel={`${spec.name} ${formatValue(spec, reading.value)} ${spec.unit}`}
            focusColor={tone}
            cue={cue}
            stamp="SEKARANG"
          />
          <figcaption className="banding-kaki">
            <span className="banding-judul">Sekarang</span>
            <span className="text-muted">
              {camera.id} · {camera.place.toLowerCase()}
            </span>
          </figcaption>
        </figure>
      </div>

      {/*
        * Angkanya ditulis di bawah gambar, bukan hanya di dalamnya.
        *
        * Gambar menjawab "apa yang berubah"; hanya angka yang menjawab
        * "seberapa, dan apakah itu melewati batas". Keduanya diperlukan, dan
        * yang kedua tidak boleh bergantung pada pembaca yang memperbesar
        * gambar untuk membaca tulisan kecil di dalam sorotan.
        */}
      <div className="banding-angka">
        <div>
          <span className="text-muted">Acuan aman</span>
          <strong className="tabular">
            {formatValue(spec, acuan)} {spec.unit}
          </strong>
        </div>
        <div>
          <span className="text-muted">Sekarang</span>
          <strong className="tabular" style={{ color: tone }}>
            {formatValue(spec, reading.value)} {spec.unit}
          </strong>
        </div>
        <div>
          <span className="text-muted">Selisih</span>
          <strong className="tabular">{persen(selisih)}</strong>
        </div>
        <div>
          <span className="text-muted">Ambang waspada · kritis</span>
          <strong className="tabular">
            {formatValue(spec, spec.warn)} · {formatValue(spec, spec.crit)} {spec.unit}
          </strong>
        </div>
      </div>

      <p className="text-muted banding-catatan">
        Kedua gambar adalah <strong>peraga</strong>, digambar dari keadaan kanal — bukan cuplikan
        kamera sungguhan.{' '}
        {cue
          ? 'Bentuk kerusakan pada bingkai kanan digambar karena kanal ini sedang di luar rentang amannya.'
          : 'Kanal ini masih di dalam rentang aman, jadi kedua bingkai memang tidak berbeda selain angkanya.'}{' '}
        Pada pemasangan sungguhan bingkai kiri diambil dari cuplikan tersimpan pada saat kanal
        terakhir berstatus AMAN, dan bingkai kanan dari siaran langsung.
      </p>
    </div>
  );
}
