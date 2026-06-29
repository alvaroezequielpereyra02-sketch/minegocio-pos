/**
 * src/tests/setup.js
 *
 * Configuración global de tests (Vitest + Testing Library).
 *
 * Cambios respecto a la versión anterior:
 * - Se mantienen los mocks de Firebase mientras dure la migración.
 * - Se agrega el mock de la capa de servicios nueva (api.js).
 * - Se agrega limpieza de IndexedDB entre tests.
 * - Se reemplaza limpieza de localStorage por limpieza de ambos storages.
 */
import '@testing-library/jest-dom';

// ── Mock de Firebase ──────────────────────────────────────────────────────────
// TEMPORAL: se elimina en la Fase 8 junto con Firebase.
vi.mock('../config/firebase', () => ({
  getDb:               () => Promise.resolve({}),
  auth:                {},
  appId:               'tienda-test',
  storage:             {},
  getStorageInstance:  () => Promise.resolve({}),
  getMessagingInstance:() => Promise.resolve(null),
}));

vi.mock('firebase/firestore', () => ({
  serverTimestamp:   () => ({ _type: 'serverTimestamp' }),
  collection:        vi.fn(),
  doc:               vi.fn(),
  addDoc:            vi.fn(),
  updateDoc:         vi.fn(),
  deleteDoc:         vi.fn(),
  onSnapshot:        vi.fn(() => () => {}),
  query:             vi.fn(),
  orderBy:           vi.fn(),
  limit:             vi.fn(),
  where:             vi.fn(),
  getDocs:           vi.fn(),
  getDocsFromServer: vi.fn(),
  setDoc:            vi.fn(),
  writeBatch:        vi.fn(),
  increment:         vi.fn(v => v),
  getDoc:            vi.fn(),
  Timestamp:         { fromDate: vi.fn(d => ({ seconds: Math.floor(d.getTime() / 1000) })) },
}));

vi.mock('firebase/auth', () => ({
  onAuthStateChanged:             vi.fn(() => () => {}),
  signInWithEmailAndPassword:     vi.fn(),
  createUserWithEmailAndPassword: vi.fn(),
  signOut:                        vi.fn(),
  sendPasswordResetEmail:         vi.fn(),
  getIdTokenResult:               vi.fn().mockResolvedValue({ claims: {} }),
}));

vi.mock('firebase/storage', () => ({
  getStorage:     vi.fn(),
  ref:            vi.fn(),
  uploadBytes:    vi.fn(),
  getDownloadURL: vi.fn(),
}));

// ── Mock de la capa de servicios nueva ───────────────────────────────────────
// Permite testear hooks y componentes sin llamadas HTTP reales.
vi.mock('../services/api', () => ({
  api: {
    get:    vi.fn(),
    post:   vi.fn(),
    put:    vi.fn(),
    patch:  vi.fn(),
    delete: vi.fn(),
  },
  tokenStorage: {
    get:   vi.fn(() => 'test-token'),
    set:   vi.fn(),
    clear: vi.fn(),
  },
  ApiError: class ApiError extends Error {
    constructor(message, status) {
      super(message);
      this.status = status;
    }
  },
}));

// ── Mock de IndexedDB ─────────────────────────────────────────────────────────
vi.mock('../lib/idb', () => ({
  addToOfflineQueue:    vi.fn(),
  getOfflineQueue:      vi.fn(() => Promise.resolve([])),
  removeFromOfflineQueue: vi.fn(),
  getOfflineQueueCount: vi.fn(() => Promise.resolve(0)),
  clearOfflineQueue:    vi.fn(),
}));

// ── Limpieza entre tests ──────────────────────────────────────────────────────
beforeEach(() => {
  localStorage.clear();
  sessionStorage.clear();
});

afterEach(() => {
  vi.clearAllMocks();
});
