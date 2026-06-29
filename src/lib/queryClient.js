import { QueryClient } from '@tanstack/react-query';

/**
 * QueryClient global de MiNegocio POS.
 *
 * Estrategia de caché:
 * - staleTime 30s  → los datos son "frescos" por 30 segundos.
 *                    Durante ese tiempo no se hace refetch aunque el componente
 *                    se monte varias veces. Evita llamadas innecesarias al navegar.
 * - refetchInterval 15s → polling cada 15 segundos mientras la ventana está activa.
 *                         Reemplaza el onSnapshot de Firestore para mantener los datos
 *                         actualizados sin WebSockets.
 * - refetchOnWindowFocus → al volver a la pestaña se refresca inmediatamente.
 * - retry 2 → en caso de error de red, reintenta 2 veces antes de mostrar el error.
 *
 * Para queries que NO necesitan polling (ej: configuración de tienda, categorías),
 * se puede sobreescribir en el hook individual:
 *   useQuery({ ..., refetchInterval: false, staleTime: Infinity })
 */
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime:          1000 * 30,   // 30 segundos
      refetchInterval:    1000 * 15,   // polling cada 15 segundos
      refetchOnWindowFocus: true,
      retry: 2,
      retryDelay: (attempt) => Math.min(1000 * 2 ** attempt, 10_000),
    },
    mutations: {
      retry: 1,
    },
  },
});
