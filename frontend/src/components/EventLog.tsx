import type { AlertEvent } from '../lib/types';
import { TAG_CLASS } from '../domain/sensors';

/** Jam lokal gaya Indonesia (12:05:33), tanpa membawa pustaka tanggal. */
export function clockOf(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '--:--:--';
  return date
    .toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
    .replace(/\./g, ':');
}

/**
 * Log peristiwa: satu baris per perpindahan status sensor atau perintah
 * skenario. Urutan terbaru di atas, karena itulah yang dibaca operator lebih
 * dulu saat sesuatu berubah.
 */
export function EventLog({ events, limit = 7 }: { events: AlertEvent[]; limit?: number }) {
  if (events.length === 0) {
    return <p className="text-muted" style={{ fontSize: 13 }}>Belum ada peristiwa tercatat.</p>;
  }

  return (
    <ul style={{ listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
      {events.slice(0, limit).map((event, i) => (
        <li
          key={`${event.at}-${i}`}
          style={{ display: 'flex', gap: 'var(--space-2)', alignItems: 'flex-start', fontSize: 13 }}
        >
          <span className="text-muted tabular" style={{ fontSize: 11, paddingTop: 3, flex: 'none' }}>
            {clockOf(event.at)}
          </span>
          <span className={TAG_CLASS[event.level]} style={{ flex: 'none' }}>
            {event.level}
          </span>
          <span>{event.text}</span>
        </li>
      ))}
    </ul>
  );
}
