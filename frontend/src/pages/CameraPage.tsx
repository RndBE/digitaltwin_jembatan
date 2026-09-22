import type { Bridge, Telemetry } from '../lib/types';
import { CameraTile } from '../components/CameraTile';
import { PageHeader, Stat } from '../components/Ui';
import { dossierFor } from '../domain/demoData';

/**
 * Kamera: dinding siaran dari titik-titik yang tidak terlihat sensor.
 *
 * Sensor menjawab *berapa*, kamera menjawab *apa* — muatan yang lewat, air
 * yang naik sampai mana, orang yang berdiri di tempat yang semestinya kosong.
 * Keduanya saling menutupi lubang: lonjakan beban gandar tanpa gambar hanya
 * angka yang mencurigakan, dan gambar truk tanpa angka hanya truk.
 *
 * Siarannya di sini **peraga**, dan tiap ubin mengatakannya sendiri. Yang
 * sudah berbentuk akhir adalah lapisan HUD di atas gambarnya; menyambungkannya
 * ke kamera sungguhan berarti mengganti satu `<svg>` dengan satu `<video>`.
 */

export interface CameraPageProps {
  bridge: Bridge;
  telemetry: Telemetry | null;
}

export function CameraPage({ bridge, telemetry }: CameraPageProps) {
  const dossier = dossierFor(bridge.id);

  if (!dossier || dossier.cameras.length === 0) {
    return (
      <div className="screen">
        <PageHeader
          kicker="Pemantauan"
          title={bridge.name}
          lede="Aset ini belum memiliki kamera terdaftar."
        />
      </div>
    );
  }

  const cameras = dossier.cameras;
  const daring = cameras.filter((c) => c.status === 'daring').length;
  const merekam = cameras.filter((c) => c.recording).length;
  const ptz = cameras.filter((c) => c.ptz).length;
  const bermasalah = cameras.filter((c) => c.status !== 'daring');

  /*
   * Kotak deteksi tidak dikarang: ia menyala ketika telemetri memang sedang
   * melaporkan kendaraan berat di atas jembatan, dan menyebut jumlahnya. Kotak
   * yang selalu ada, atau yang muncul menurut jadwalnya sendiri, mengajari
   * operator untuk mengabaikannya.
   */
  const trucks = telemetry?.traffic.trucks ?? 0;
  const deteksi = trucks > 0 ? `${trucks} kendaraan berat` : null;

  return (
    <div className="screen">
      <PageHeader
        kicker="Pemantauan"
        title="Kamera"
        lede={
          <>
            Enam titik pandang yang tidak terjangkau sensor: kedua oprit, tengah bentang, tumpuan
            timur, pendekat WIM, dan pilar tengah. Sensor menjawab <em>berapa</em>, kamera menjawab{' '}
            <em>apa</em> — dan satu lonjakan beban gandar jauh lebih berarti ketika gambar
            kendaraannya ada di sebelahnya.
          </>
        }
      />

      <section
        className="glass glass--chip stat-row"
        style={{
          gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
          marginBottom: 'var(--space-4)',
        }}
      >
        <Stat
          label="Kamera daring"
          value={`${daring} dari ${cameras.length}`}
          note={bermasalah.length ? `${bermasalah.length} perlu perhatian` : 'seluruhnya normal'}
          tone={daring < cameras.length ? 'warn' : 'default'}
        />
        <Stat label="Sedang merekam" value={merekam} note="siaran tersimpan ke perekam" />
        <Stat label="Dapat digerakkan" value={ptz} unit="PTZ" note="sisanya sudut tetap" />
        <Stat
          label="Kendaraan berat"
          value={trucks}
          note={deteksi ? 'terdeteksi di atas bentang' : 'tidak ada saat ini'}
          tone={trucks >= 3 ? 'warn' : 'default'}
        />
      </section>

      {bermasalah.length ? (
        <div
          role="status"
          className="glass card"
          style={{
            background: 'rgb(251 191 36 / 0.1)',
            padding: 'var(--space-3) var(--space-4)',
            marginBottom: 'var(--space-4)',
            fontSize: 13,
            lineHeight: 1.55,
          }}
        >
          <strong style={{ fontWeight: 700 }}>
            {bermasalah.length} kamera tidak menyiarkan penuh
          </strong>{' '}
          ·{' '}
          {bermasalah.map((c) => `${c.id} (${c.status})`).join(', ')}
        </div>
      ) : null}

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
          gap: 'var(--space-3)',
        }}
      >
        {cameras.map((camera) => (
          <CameraTile
            key={camera.id}
            camera={camera}
            at={telemetry?.at ?? new Date().toISOString()}
            // Deteksi hanya pada kamera yang memang mengawasi timbangan jalan.
            detection={camera.channel === 'wim' ? deteksi : null}
          />
        ))}
      </div>
    </div>
  );
}
