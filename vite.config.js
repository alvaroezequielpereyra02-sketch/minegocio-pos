import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    // Aumentamos el límite de advertencia a 1000kb (1MB) para que sea menos estricto
    chunkSizeWarningLimit: 1000, 
    rollupOptions: {
      output: {
        manualChunks(id) {
          // Si el archivo viene de node_modules (librerías externas)
          if (id.includes('node_modules')) {
            // 1. Separa Firebase (es pesado)
            if (id.includes('firebase') || id.includes('@firebase')) {
              return 'firebase';
            }
            // 2. Separa html2pdf y sus dependencias (es MUY pesado)
            if (id.includes('html2pdf') || id.includes('jspdf') || id.includes('html2canvas')) {
              return 'html2pdf';
            }
            // 3. Separa los gráficos
            if (id.includes('recharts')) {
              return 'recharts';
            }
            // 4. Separa los iconos de Lucide (opcional, pero ayuda)
            if (id.includes('lucide')) {
              return 'icons';
            }
            // El resto de librerías pequeñas van a un archivo "vendor"
            return 'vendor';
          }
        },
      },
    },
  },
})import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    // Aumentamos el límite de advertencia a 1000kb (1MB) para que sea menos estricto
    chunkSizeWarningLimit: 1000, 
    rollupOptions: {
      output: {
        manualChunks(id) {
          // Si el archivo viene de node_modules (librerías externas)
          if (id.includes('node_modules')) {
            // 1. Separa Firebase (es pesado)
            if (id.includes('firebase') || id.includes('@firebase')) {
              return 'firebase';
            }
            // 2. Separa html2pdf y sus dependencias (es MUY pesado)
            if (id.includes('html2pdf') || id.includes('jspdf') || id.includes('html2canvas')) {
              return 'html2pdf';
            }
            // 3. Separa los gráficos
            if (id.includes('recharts')) {
              return 'recharts';
            }
            // 4. Separa los iconos de Lucide (opcional, pero ayuda)
            if (id.includes('lucide')) {
              return 'icons';
            }
            // El resto de librerías pequeñas van a un archivo "vendor"
            return 'vendor';
          }
        },
      },
    },
  },
})
