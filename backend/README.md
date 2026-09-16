# API Digital Twin Jembatan

Server Express yang membangkitkan telemetri jembatan, menilai kondisi struktur,
dan menerima perintah skenario pembebanan.

## Menjalankan

```bash
cp .env.example .env
npm install
npm run dev        # node --watch
```

Bawaan: `http://localhost:5175`.

## Titik akhir

| Metode | Jalur | Keterangan |
|---|---|---|
| GET | `/health` | Status proses |
| GET | `/api/bridges` | Katalog jembatan + status terkini |
| GET | `/api/bridges/:id` | Detail satu jembatan |
| GET | `/api/bridges/:id/telemetry` | Cuplikan seluruh kanal + penilaian risiko |
| GET | `/api/bridges/:id/history?sensors=vib,strain` | Deret waktu + garis dasar |
| GET | `/api/bridges/:id/alerts?limit=20` | Log peristiwa |
| GET | `/api/sensors` | Katalog kanal sensor beserta ambangnya |
| GET | `/api/scenarios` | Daftar skenario pembebanan |
| POST | `/api/bridges/:id/scenario` | Jalankan skenario — **perlu token** |
| POST | `/api/bridges/:id/pause` | Jeda / lanjutkan aliran — **perlu token** |
| POST | `/api/auth/register` | Daftar akun |
| POST | `/api/auth/login` | Masuk, mengembalikan JWT |
| GET | `/api/auth/me` | Profil pemilik token |

## Penyimpanan

Seluruh keadaan disimpan dalam memori proses (`src/store/dataStore.js`) sehingga
API dapat dijalankan tanpa basis data. Data hilang saat proses berhenti; ganti
modul tersebut bila diperlukan penyimpanan permanen.
