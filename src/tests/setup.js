import '@testing-library/jest-dom';

// ── Mock de Firebase ──────────────────────────────────────────────────────────
// Evita que los tests intenten conectarse a Firestore real
vi.mock('../config/firebase', () => ({
    db:      {},
    auth:    {},
    appId:   'tienda-test',
    storage: {},
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
    setDoc:            vi.fn(),
    writeBatch:        vi.fn(),
    increment:         vi.fn(v => v),
    getDoc:            vi.fn(),
}));

// ── localStorage limpio entre tests ───────────────────────────────────────────
beforeEach(() => {
    localStorage.clear();
});
