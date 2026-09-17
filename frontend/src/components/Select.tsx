import { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react';

/**
 * Daftar pilihan yang dapat ditata.
 *
 * `<select>` bawaan peramban menggambar daftar popupnya di luar halaman, dan
 * isi daftar itu tidak dapat disentuh CSS: warna latar `option` diabaikan di
 * sebagian peramban, dan label `optgroup` selalu memakai palet sistem — abu-abu
 * terang di tengah antarmuka kaca gelap. Karena itu daftarnya digambar sendiri.
 *
 * Yang ditiru bukan hanya tampilannya, tetapi juga perilakunya: pola
 * `combobox` + `listbox` dengan `aria-activedescendant`, sehingga fokus papan
 * ketik tidak pernah berpindah dari tombol pemicu dan tidak ada fokus yang
 * tersesat saat daftar ditutup. Panah naik/turun, Home/End, Enter, Escape, dan
 * pengetikan awal huruf bekerja seperti pada daftar bawaan.
 */

export interface SelectOption {
  value: string;
  label: string;
  /** Keterangan pendek di sisi kanan baris, misalnya komposisi lalu lintas. */
  hint?: string;
}

/** Kelompok pilihan. Tanpa `label`, isinya tampil sebagai baris lepas. */
export interface SelectGroup {
  label?: string;
  options: SelectOption[];
}

export interface SelectProps {
  value: string;
  onChange: (value: string) => void;
  groups: SelectGroup[];
  id?: string;
  'aria-label'?: string;
  'aria-labelledby'?: string;
  disabled?: boolean;
  /** Teks tombol saat `value` tidak ada di daftar. */
  placeholder?: string;
}

export function Select({
  value,
  onChange,
  groups,
  id,
  disabled = false,
  placeholder = 'Pilih…',
  ...aria
}: SelectProps) {
  const generatedId = useId();
  const baseId = id ?? generatedId;
  const listId = `${baseId}-daftar`;

  const [open, setOpen] = useState(false);
  const [activeValue, setActiveValue] = useState(value);
  const wrapRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  /** Huruf yang baru diketik, untuk melompat ke baris yang diawali huruf itu. */
  const typed = useRef({ text: '', at: 0 });

  const flat = useMemo(() => groups.flatMap((group) => group.options), [groups]);
  const selected = flat.find((option) => option.value === value);
  const optionId = (optionValue: string) => `${baseId}-${optionValue}`;

  const close = useCallback((focusTrigger = true) => {
    setOpen(false);
    if (focusTrigger) triggerRef.current?.focus();
  }, []);

  const choose = useCallback(
    (next: string) => {
      onChange(next);
      close();
    },
    [onChange, close],
  );

  /** Buka daftar dengan baris aktif jatuh pada nilai yang sedang dipakai. */
  const openList = useCallback(() => {
    if (disabled) return;
    setActiveValue(flat.some((option) => option.value === value) ? value : (flat[0]?.value ?? ''));
    setOpen(true);
  }, [disabled, flat, value]);

  // Pergeseran dihitung dari nilai aktif terbaru, bukan dari salinan yang
  // tertangkap saat penyunting dibuat: dua tekanan panah yang jatuh pada satu
  // putaran render akan membaca salinan yang sama dan hanya bergerak satu baris.
  const move = useCallback(
    (delta: number) => {
      setActiveValue((current) => {
        if (!flat.length) return current;
        const from = flat.findIndex((option) => option.value === current);
        const next = Math.min(flat.length - 1, Math.max(0, (from < 0 ? 0 : from) + delta));
        return flat[next].value;
      });
    },
    [flat],
  );

  // Menutup saat penunjuk turun di luar daftar. Fokus tidak ditarik kembali ke
  // tombol: pengguna sedang menuju tempat lain, dan merebut fokus akan
  // membatalkan klik yang sedang berjalan.
  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: PointerEvent) => {
      if (!wrapRef.current?.contains(event.target as Node)) close(false);
    };
    document.addEventListener('pointerdown', onPointerDown);
    return () => document.removeEventListener('pointerdown', onPointerDown);
  }, [open, close]);

  // Baris aktif selalu ditarik ke dalam pandangan — daftar skenario lebih
  // panjang daripada tinggi popup, dan navigasi papan ketik tanpa ini akan
  // menggerakkan penanda di luar layar.
  useEffect(() => {
    if (!open) return;
    const node = listRef.current?.querySelector<HTMLElement>('[data-active="true"]');
    node?.scrollIntoView({ block: 'nearest' });
  }, [open, activeValue]);

  const onKeyDown = (event: React.KeyboardEvent<HTMLButtonElement>) => {
    if (disabled) return;

    if (!open) {
      if (event.key === 'ArrowDown' || event.key === 'ArrowUp' || event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        openList();
      }
      return;
    }

    switch (event.key) {
      case 'ArrowDown':
        event.preventDefault();
        move(1);
        return;
      case 'ArrowUp':
        event.preventDefault();
        move(-1);
        return;
      case 'Home':
        event.preventDefault();
        if (flat.length) setActiveValue(flat[0].value);
        return;
      case 'End':
        event.preventDefault();
        if (flat.length) setActiveValue(flat[flat.length - 1].value);
        return;
      case 'Enter':
      case ' ':
        event.preventDefault();
        if (activeValue) choose(activeValue);
        return;
      case 'Escape':
      case 'Tab':
        close(event.key === 'Escape');
        return;
      default:
        break;
    }

    // Pengetikan awal huruf. Huruf yang datang beruntun disusun menjadi satu
    // kata; jeda satu detik memulai pencarian baru.
    if (event.key.length === 1 && !event.ctrlKey && !event.metaKey && !event.altKey) {
      const now = Date.now();
      typed.current = {
        text: now - typed.current.at > 1000 ? event.key : typed.current.text + event.key,
        at: now,
      };
      const needle = typed.current.text.toLowerCase();
      const hit = flat.find((option) => option.label.toLowerCase().startsWith(needle));
      if (hit) setActiveValue(hit.value);
    }
  };

  return (
    <div className="select" ref={wrapRef}>
      <button
        type="button"
        id={baseId}
        ref={triggerRef}
        className="select-trigger"
        role="combobox"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={open ? listId : undefined}
        aria-activedescendant={open && activeValue ? optionId(activeValue) : undefined}
        aria-label={aria['aria-label']}
        aria-labelledby={aria['aria-labelledby']}
        disabled={disabled}
        onClick={() => (open ? close() : openList())}
        onKeyDown={onKeyDown}
      >
        <span className="select-value">{selected?.label ?? placeholder}</span>
        <Chevron open={open} />
      </button>

      {open ? (
        <div className="select-popup glass" id={listId} role="listbox" ref={listRef} tabIndex={-1}>
          {groups.map((group, index) => {
            const rows = group.options.map((option) => (
              <div
                key={option.value}
                id={optionId(option.value)}
                role="option"
                className="select-option"
                aria-selected={option.value === value}
                data-active={option.value === activeValue}
                // Penanda aktif mengikuti penunjuk, supaya papan ketik dan
                // tetikus tidak pernah menyorot dua baris yang berbeda.
                onPointerEnter={() => setActiveValue(option.value)}
                onClick={() => choose(option.value)}
              >
                <span>{option.label}</span>
                {option.hint ? <span className="select-hint">{option.hint}</span> : null}
              </div>
            ));

            if (!group.label) return <div key={`lepas-${index}`}>{rows}</div>;
            return (
              <div key={group.label} role="group" aria-label={group.label}>
                <div className="select-group" aria-hidden="true">
                  {group.label}
                </div>
                {rows}
              </div>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}

function Chevron({ open }: { open: boolean }) {
  return (
    <svg
      className="select-chevron"
      data-open={open}
      width="14"
      height="14"
      viewBox="0 0 16 16"
      fill="none"
      aria-hidden="true"
    >
      <path d="M4 6.5 8 10.5 12 6.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
