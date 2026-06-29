import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],

  // ── Tests (Vitest) ──────────────────────────────────────────────────────────
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: './src/tests/setup.js',
  },

  // ── Build ───────────────────────────────────────────────────────────────────
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    sourcemap: false,
    chunkSizeWarningLimit: 1000,
    rollupOptions: {
      // NOTA: firebase-admin ya no se referencia desde el frontend.
      // Se puede eliminar este bloque cuando Firebase quede completamente fuera
      // del proyecto (Fase 8). Por ahora se mantiene para evitar warnings durante
      // la migración si algún archivo aún importa módulos de firebase-admin.
      external: [
        'firebase-admin',
        'firebase-admin/app',
        'firebase-admin/firestore',
        'firebase-admin/messaging',
      ],
      output: {
        entryFileNames:  'assets/[name]-[hash].js',
        chunkFileNames:  'assets/[name]-[hash].js',
        assetFileNames:  'assets/[name]-[hash].[ext]',
        manualChunks(id) {
          if (!id.includes('node_modules')) return;

          // ── TEMPORAL (Fase 8: eliminar estos bloques) ─────────────────────
          if (id.includes('firebase/auth') || id.includes('@firebase/auth'))
            return 'firebase-auth';
          if (id.includes('firebase') || id.includes('@firebase'))
            return 'firebase';

          // ── Stack nuevo ────────────────────────────────────────────────────
          // TanStack Query se separa: es grande pero solo se carga una vez.
          if (id.includes('@tanstack/react-query'))  return 'tanstack-query';
          if (id.includes('@tanstack/react-virtual')) return 'tanstack-virtual';

          // Recharts es el chunk más pesado del proyecto — chunk propio.
          if (id.includes('recharts'))               return 'recharts';

          // html2pdf y dependencias (jspdf, html2canvas) se cargan solo al exportar.
          if (
            id.includes('html2pdf') ||
            id.includes('jspdf')    ||
            id.includes('html2canvas')
          ) return 'html2pdf';

          // Todos los iconos juntos.
          if (id.includes('lucide'))                 return 'icons';

          // El resto de node_modules en un chunk vendor genérico.
          return 'vendor';
        },
      },
    },
  },
});
