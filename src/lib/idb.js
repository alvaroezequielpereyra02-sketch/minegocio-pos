import { openDB } from 'idb';

/**
 * Cola offline con IndexedDB.
 * Reemplaza la implementación anterior en localStorage.
 *
 * Ventajas sobre localStorage:
 * - Sin límite práctico de tamaño (vs ~5MB de localStorage).
 * - Operaciones asíncronas — no bloquea el hilo principal.
 * - TTL nativo por índice de timestamp.
 * - Más confiable en mobile al manejar transacciones atómicas.
 */

const DB_NAME    = 'mnpos-offline';
const DB_VERSION = 1;
const STORE_NAME = 'offline_queue';
const TTL_MS     = 7 * 24 * 60 * 60 * 1000; // 7 días

let _db = null;

async function getDB() {
  if (_db) return _db;
  _db = await openDB(DB_NAME, DB_VERSION, {
    upgrade(db) {
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const store = db.createObjectStore(STORE_NAME, { keyPath: 'localId' });
        store.createIndex('by_timestamp', 'timestamp');
      }
    },
  });
  return _db;
}

/**
 * Agrega una transacción a la cola offline.
 * @param {Object} entry - Objeto con los datos de la transacción.
 *   Debe incluir un campo `localId` único (string UUID generado en el cliente).
 */
export async function addToOfflineQueue(entry) {
  const db = await getDB();
  await db.put(STORE_NAME, {
    ...entry,
    timestamp: Date.now(),
  });
}

/**
 * Devuelve todas las entradas de la cola, ordenadas por timestamp (más antiguas primero).
 * Filtra automáticamente las entradas con TTL vencido.
 */
export async function getOfflineQueue() {
  const db    = await getDB();
  const all   = await db.getAllFromIndex(STORE_NAME, 'by_timestamp');
  const now   = Date.now();
  const fresh = all.filter(e => (now - e.timestamp) < TTL_MS);

  // Si hay entradas expiradas, limpiarlas en background
  const expired = all.filter(e => (now - e.timestamp) >= TTL_MS);
  if (expired.length > 0) {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    await Promise.all([
      ...expired.map(e => tx.store.delete(e.localId)),
      tx.done,
    ]);
  }

  return fresh;
}

/**
 * Elimina una entrada de la cola por su localId (luego de sincronizar con el servidor).
 * @param {string} localId
 */
export async function removeFromOfflineQueue(localId) {
  const db = await getDB();
  await db.delete(STORE_NAME, localId);
}

/**
 * Retorna la cantidad de entradas pendientes en la cola.
 * Útil para mostrar un badge en la UI.
 */
export async function getOfflineQueueCount() {
  const db    = await getDB();
  const items = await getOfflineQueue(); // usa la versión que filtra expired
  return items.length;
}

/**
 * Limpia toda la cola. Úsalo solo en tests o si el admin fuerza el vaciado.
 */
export async function clearOfflineQueue() {
  const db = await getDB();
  await db.clear(STORE_NAME);
}
