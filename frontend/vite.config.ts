import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5174,
    // host: true agar server dev juga mendengarkan di alamat IP LAN,
    // sehingga perangkat lain di jaringan yang sama bisa membuka aplikasi.
    host: true,
    // Permintaan /api diteruskan ke server Express, sehingga kode klien
    // cukup memakai jalur relatif dan tidak perlu tahu porta API.
    proxy: {
      '/api': {
        target: process.env.VITE_API_TARGET || 'http://localhost:5175',
        changeOrigin: true,
      },
    },
  },
  build: {
    outDir: 'dist',
    // three.js dipisah agar berkas utama tetap kecil untuk halaman non-3D.
    rollupOptions: {
      output: {
        manualChunks: { three: ['three'] },
      },
    },
  },
});
