import { useId, useState, type MouseEvent } from 'react';
import type { SensorSpec, Status } from '../lib/types';
import { STATUS_COLOR } from '../domain/sensors';

/**
 * Bagan digambar sebagai SVG sebaris, bukan lewat pustaka bagan.
 *
 * Deret di sini pendek dan bentuknya selalu sama — satu garis nilai, satu garis
 * acuan, dua garis ambang — sehingga SVG langsung lebih ringan daripada
 * membawa pustaka bagan, dan seluruh warnanya dapat mengikuti token tema.
 */

/** Ubah deret angka menjadi jalur SVG pada kotak w × h. */
export function toPath(values: number[], w: number, h: number, lo: number, hi: number): string {
  if (values.length < 2 || hi <= lo) return '';
  return values
    .map((value, i) => {
      const x = (i / (values.length - 1)) * w;
      const y = h - ((value - lo) / (hi - lo)) * h;
      return `${i ? 'L' : 'M'}${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join('');
}

/** Jalur yang sama, ditutup ke garis dasar kotak supaya dapat diberi arsir. */
function toArea(values: number[], w: number, h: number, lo: number, hi: number): string {
  const line = toPath(values, w, h, lo, hi);
  if (!line) return '';
  return `${line}L${w},${h}L0,${h}Z`;
}

export interface SparklineProps {
  values: number[];
  status: Status;
  width?: number;
  height?: number;
  /** Rentang sumbu tegak; bila tidak diberikan dihitung dari datanya. */
  domain?: [number, number];
}

export function Sparkline({ values, status, width = 220, height = 44, domain }: SparklineProps) {
  const gradientId = useId();
  if (values.length < 2) return <svg width="100%" height={height} viewBox={`0 0 ${width} ${height}`} />;

  const lo = domain?.[0] ?? Math.min(...values);
  const hi = domain?.[1] ?? Math.max(...values);
  const pad = (hi - lo) * 0.12 || 1;
  const color = STATUS_COLOR[status];

  return (
    <svg
      width="100%"
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      preserveAspectRatio="none"
      aria-hidden="true"
      style={{ display: 'block', overflow: 'visible' }}
    >
      <defs>
        <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.26" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={toArea(values, width, height, lo - pad, hi + pad)} fill={`url(#${gradientId})`} stroke="none" />
      <path
        d={toPath(values, width, height, lo - pad, hi + pad)}
        fill="none"
        stroke={color}
        strokeWidth={1.6}
        strokeLinejoin="round"
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  );
}

export interface ThresholdChartProps {
  sensor: SensorSpec;
  values: number[];
  baseline?: number[];
  status: Status;
  height?: number;
  showBaseline?: boolean;
  /**
   * Rentang sumbu tegak yang dipaksakan. Dipakai ketika dua bagan dijajarkan
   * untuk dibandingkan: tanpa skala yang sama, garis yang lebih tinggi belum
   * tentu berarti nilai yang lebih besar.
   */
  domain?: [number, number];
}

/**
 * Rentang sumbu tegak bersama untuk beberapa deret satu kanal.
 *
 * Selalu memuat ambang kritis, supaya jarak nilai terhadap batas dapat dibaca
 * langsung dan tidak berubah-ubah mengikuti data.
 */
export function sharedDomain(sensor: SensorSpec, ...sets: number[][]): [number, number] {
  const all = sets.flat().filter((value) => Number.isFinite(value));
  const lo = Math.min(...all, sensor.base * 0.6);
  const hi = Math.max(...all, sensor.crit * 1.05);
  return [lo, hi];
}

/**
 * Bagan deret waktu dengan dua garis ambang. Sumbu tegaknya selalu memuat
 * ambang kritis, supaya jarak nilai terhadap batas dapat dibaca langsung dan
 * tidak berubah-ubah mengikuti data.
 */
export function ThresholdChart({
  sensor,
  values,
  baseline,
  status,
  height = 128,
  showBaseline = false,
  domain,
}: ThresholdChartProps) {
  const gradientId = useId();
  const width = 520;

  if (values.length < 2) {
    return <div style={{ height }} className="text-muted" />;
  }

  const [lo, hi] =
    domain ?? sharedDomain(sensor, values, showBaseline && baseline ? baseline : []);
  const y = (value: number) => height - ((value - lo) / (hi - lo)) * height;
  const color = STATUS_COLOR[status];

  return (
    <svg
      width="100%"
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      preserveAspectRatio="none"
      role="img"
      aria-label={`Grafik ${sensor.name} dalam ${sensor.unit}, ambang waspada ${sensor.warn} dan kritis ${sensor.crit}`}
      style={{ display: 'block', overflow: 'visible' }}
    >
      <defs>
        <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.22" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>

      {/* Pita di atas ambang kritis: daerah yang tidak boleh dimasuki garis nilai. */}
      <rect
        x={0}
        y={0}
        width={width}
        height={Math.max(0, y(sensor.crit))}
        fill="var(--state-bahaya)"
        opacity={0.05}
      />

      <line
        x1={0}
        x2={width}
        y1={y(sensor.warn)}
        y2={y(sensor.warn)}
        stroke="var(--state-waspada)"
        strokeWidth={1}
        strokeDasharray="5 4"
        vectorEffect="non-scaling-stroke"
      />
      <line
        x1={0}
        x2={width}
        y1={y(sensor.crit)}
        y2={y(sensor.crit)}
        stroke="var(--state-bahaya)"
        strokeWidth={1}
        strokeDasharray="5 4"
        vectorEffect="non-scaling-stroke"
      />

      {showBaseline && baseline && baseline.length > 1 ? (
        <path
          d={toPath(baseline, width, height, lo, hi)}
          fill="none"
          stroke="var(--mist-400)"
          strokeWidth={1.2}
          strokeDasharray="4 3"
          vectorEffect="non-scaling-stroke"
        />
      ) : null}

      <path d={toArea(values, width, height, lo, hi)} fill={`url(#${gradientId})`} stroke="none" />
      <path
        d={toPath(values, width, height, lo, hi)}
        fill="none"
        stroke={color}
        strokeWidth={1.8}
        strokeLinejoin="round"
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  );
}

/* ------------------------------------------------------- bagan bertumpuk */

/**
 * Dua deret satu kanal, ditumpuk pada satu sumbu.
 *
 * Tiga aturan yang menentukan bagan ini terbaca atau tidak:
 *
 * 1. **Satu sumbu tegak saja.** Dua skala pada satu bagan membuat selisih
 *    antar deret tidak dapat dibaca sama sekali — garis yang lebih tinggi
 *    belum tentu bernilai lebih besar. Ini kesalahan paling sering pada papan
 *    pantau teknik, dan ia tidak pernah kelihatan salah.
 * 2. **Deret pembanding diputus-putus.** Rekaman yang dibekukan dan nilai yang
 *    sedang berjalan tidak boleh terlihat sama. Garis putus sekaligus menjadi
 *    pembeda kedua bagi pembaca yang tidak membedakan warna.
 * 3. **Daerah di antara kedua kurva diarsir.** Yang dicari pembaca bukan nilai
 *    mutlak salah satunya, melainkan seberapa jauh keduanya berpisah — dan
 *    mata tidak bisa mengurangkan dua garis, apalagi dua bagan terpisah.
 *
 * Keduanya disejajarkan dari ujung terbaru dan dipotong pada panjang yang
 * sama, jadi sumbu datarnya berarti "lama pengamatan yang sama", bukan jam
 * dinding yang sama — rekaman pembanding memang berhenti lebih dulu.
 */
export interface OverlayChartProps {
  sensor: SensorSpec;
  /** Deret kondisi sekarang. */
  current: number[];
  /** Deret kondisi normal yang dibekukan. */
  reference: number[];
  status: Status;
  height?: number;
  domain?: [number, number];
  /** Versi kecil: tanpa garis ambang berlabel, tanpa penunjuk, tanpa bacaan. */
  compact?: boolean;
}

/** Potong kedua deret pada panjang yang sama, dihitung dari ujung terbarunya. */
function align(a: number[], b: number[]): [number[], number[]] {
  const n = Math.min(a.length, b.length);
  return [a.slice(-n), b.slice(-n)];
}

export function OverlayChart({
  sensor,
  current,
  reference,
  status,
  height = 180,
  domain,
  compact = false,
}: OverlayChartProps) {
  const gradientId = useId();
  const [hover, setHover] = useState<number | null>(null);

  const width = 560;
  const [cur, ref] = align(current, reference);
  const n = cur.length;

  if (n < 2) {
    return (
      <div className="text-muted" style={{ height, fontSize: 12, display: 'grid', placeItems: 'center' }}>
        Belum cukup data untuk dibandingkan.
      </div>
    );
  }

  const [lo, hi] = domain ?? sharedDomain(sensor, cur, ref);
  const px = (i: number) => (i / (n - 1)) * width;
  const py = (value: number) => height - ((value - lo) / (hi - lo)) * height;

  const line = (values: number[]) =>
    values.map((v, i) => `${i ? 'L' : 'M'}${px(i).toFixed(1)},${py(v).toFixed(1)}`).join('');

  // Pita: maju menyusuri kondisi sekarang, pulang menyusuri rekaman normal.
  const band =
    `${line(cur)}` +
    ref
      .map((_, i) => `L${px(n - 1 - i).toFixed(1)},${py(ref[n - 1 - i]).toFixed(1)}`)
      .join('') +
    'Z';

  const index = hover === null ? n - 1 : Math.max(0, Math.min(n - 1, hover));
  const curAt = cur[index];
  const refAt = ref[index];
  const deltaPct = refAt === 0 ? 0 : ((curAt - refAt) / refAt) * 100;
  const color = STATUS_COLOR[status];

  const onMove = (event: MouseEvent<SVGSVGElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    if (rect.width === 0) return;
    const u = (event.clientX - rect.left) / rect.width;
    setHover(Math.round(u * (n - 1)));
  };

  return (
    <div>
      <svg
        width="100%"
        height={height}
        viewBox={`0 0 ${width} ${height}`}
        preserveAspectRatio="none"
        role="img"
        aria-label={
          `Perbandingan ${sensor.name} dalam ${sensor.unit}: kondisi normal dan kondisi sekarang ` +
          `pada satu sumbu, ambang waspada ${sensor.warn} dan kritis ${sensor.crit}`
        }
        style={{ display: 'block', overflow: 'visible', cursor: compact ? 'default' : 'crosshair' }}
        onMouseMove={compact ? undefined : onMove}
        onMouseLeave={compact ? undefined : () => setHover(null)}
      >
        <defs>
          <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity="0.3" />
            <stop offset="100%" stopColor={color} stopOpacity="0.12" />
          </linearGradient>
        </defs>

        <rect x={0} y={0} width={width} height={Math.max(0, py(sensor.crit))} fill="var(--state-bahaya)" opacity={0.05} />

        {[
          { value: sensor.warn, stroke: 'var(--state-waspada)' },
          { value: sensor.crit, stroke: 'var(--state-bahaya)' },
        ].map((threshold) => (
          <line
            key={threshold.value}
            x1={0}
            x2={width}
            y1={py(threshold.value)}
            y2={py(threshold.value)}
            stroke={threshold.stroke}
            strokeWidth={1}
            strokeDasharray="5 4"
            vectorEffect="non-scaling-stroke"
          />
        ))}

        {/* Arsiran selisih digambar sebelum kedua garis, supaya garisnya tetap
            berada di atas dan tepinya tidak tertutup warna pita. */}
        <path d={band} fill={`url(#${gradientId})`} stroke="none" />

        <path
          d={line(ref)}
          fill="none"
          stroke="var(--mist-300)"
          strokeWidth={1.5}
          strokeDasharray="6 4"
          strokeLinejoin="round"
          vectorEffect="non-scaling-stroke"
        />
        <path
          d={line(cur)}
          fill="none"
          stroke={color}
          strokeWidth={2}
          strokeLinejoin="round"
          vectorEffect="non-scaling-stroke"
        />

        {compact ? null : (
          <>
            <line
              x1={px(index)}
              x2={px(index)}
              y1={0}
              y2={height}
              stroke="var(--mist-100)"
              strokeWidth={1}
              strokeDasharray="3 3"
              opacity={0.45}
              vectorEffect="non-scaling-stroke"
            />
            <circle cx={px(index)} cy={py(refAt)} r={3.5} fill="var(--mist-300)" />
            <circle cx={px(index)} cy={py(curAt)} r={3.5} fill={color} />
          </>
        )}
      </svg>

      {compact ? null : (
        <div
          className="row tabular"
          style={{ gap: 'var(--space-4)', fontSize: 12, marginTop: 6, flexWrap: 'wrap' }}
        >
          <span className="row" style={{ gap: 6 }}>
            <svg width="18" height="8" aria-hidden="true">
              <line x1="0" y1="4" x2="18" y2="4" stroke="var(--mist-300)" strokeWidth="1.5" strokeDasharray="6 4" />
            </svg>
            <span className="text-muted">normal</span>
            <strong style={{ fontWeight: 700 }}>
              {refAt.toFixed(sensor.dec)} {sensor.unit}
            </strong>
          </span>
          <span className="row" style={{ gap: 6 }}>
            <svg width="18" height="8" aria-hidden="true">
              <line x1="0" y1="4" x2="18" y2="4" stroke={color} strokeWidth="2" />
            </svg>
            <span className="text-muted">sekarang</span>
            <strong style={{ fontWeight: 700 }}>
              {curAt.toFixed(sensor.dec)} {sensor.unit}
            </strong>
          </span>
          <span className="row" style={{ gap: 6 }}>
            <span className="text-muted">selisih</span>
            <strong
              style={{
                fontWeight: 700,
                color: deltaPct >= 0 ? 'var(--state-bahaya)' : 'var(--state-normal)',
              }}
            >
              {deltaPct >= 0 ? '+' : ''}
              {deltaPct.toFixed(1)} %
            </strong>
          </span>
          <span className="text-muted" style={{ marginLeft: 'auto' }}>
            {hover === null ? 'cuplikan terakhir · arahkan tetikus untuk menelusuri' : `cuplikan ke-${index + 1} dari ${n}`}
          </span>
        </div>
      )}
    </div>
  );
}

export interface MeterProps {
  /** Nilai 0..100. */
  pct: number;
  color?: string;
  label?: string;
  /** Sembunyikan angka persen di kanan label. */
  hideValue?: boolean;
}

/** Batang pemanfaatan sederhana, dipakai di rincian risiko dan inventaris sensor. */
export function Meter({ pct, color = 'var(--brand-400)', label, hideValue = false }: MeterProps) {
  const clamped = Math.max(0, Math.min(100, pct));
  return (
    <div>
      {label ? (
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 4 }}>
          <span>{label}</span>
          {hideValue ? null : <span className="tabular text-muted">{clamped.toFixed(0)}%</span>}
        </div>
      ) : null}
      <div
        role="meter"
        aria-valuenow={Math.round(clamped)}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={label ?? 'Pemanfaatan terhadap ambang kritis'}
        style={{ height: 6, background: 'rgb(255 255 255 / 0.12)', borderRadius: 3, overflow: 'hidden' }}
      >
        <div
          style={{
            width: `${clamped}%`,
            height: '100%',
            background: color,
            transition: 'width var(--dur) var(--ease)',
          }}
        />
      </div>
    </div>
  );
}
