import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: './src/tests/setup.js',
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    sourcemap: false,
    chunkSizeWarningLimit: 1000,
    rollupOptions: {
      // firebase-admin es exclusivo del servidor (api/notify.js).
      // Marcarlo como external evita que Vite lo bundlee en el cliente,
      // reduciendo el tamaño del bundle y eliminando warnings de build.
      external: [
        'firebase-admin',
        'firebase-admin/app',
        'firebase-admin/firestore',
        'firebase-admin/messaging',
      ],
      output: {
        entryFileNames: 'assets/[name]-[hash].js',
        chunkFileNames: 'assets/[name]-[hash].js',
        assetFileNames: 'assets/[name]-[hash].[ext]',
        manualChunks(id) {
          if (id.includes('node_modules')) {
            if (id.includes('firebase') || id.includes('@firebase')) return 'firebase';
            if (id.includes('html2pdf') || id.includes('jspdf') || id.includes('html2canvas')) return 'html2pdf';
            if (id.includes('recharts')) return 'recharts';
            if (id.includes('lucide')) return 'icons';
            return 'vendor';
          }
        },
      },
    },
  },
})
