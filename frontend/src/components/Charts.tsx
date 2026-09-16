import { useId } from 'react';
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
