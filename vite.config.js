import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    sourcemap: false,
    // Aumentamos el límite de advertencia a 1000kb (1MB)
    chunkSizeWarningLimit: 1000,
    rollupOptions: {
      output: {
        entryFileNames: 'assets/[name]-[hash].js',
        chunkFileNames: 'assets/[name]-[hash].js',
        assetFileNames: 'assets/[name]-[hash].[ext]',
        manualChunks(id) {
          // Si el archivo viene de node_modules (librerías externas)
          if (id.includes('node_modules')) {
            // 1. Separa Firebase
            if (id.includes('firebase') || id.includes('@firebase')) {
              return 'firebase';
            }
            // 2. Separa html2pdf
            if (id.includes('html2pdf') || id.includes('jspdf') || id.includes('html2canvas')) {
              return 'html2pdf';
            }
            // 3. Separa los gráficos
            if (id.includes('recharts')) {
              return 'recharts';
            }
            // 4. Separa los iconos
            if (id.includes('lucide')) {
              return 'icons';
            }
            // El resto a vendor
            return 'vendor';
          }
        },
      },
    },
  },
})
