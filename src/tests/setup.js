import '@testing-library/jest-dom';

// ── Mock de Firebase ──────────────────────────────────────────────────────────
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
    getStorage:    vi.fn(),
    ref:           vi.fn(),
    uploadBytes:   vi.fn(),
    getDownloadURL: vi.fn(),
}));

// ── localStorage limpio entre tests ───────────────────────────────────────────
beforeEach(() => {
    localStorage.clear();
});

// ── Limpiar mocks entre tests ─────────────────────────────────────────────────
afterEach(() => {
    vi.clearAllMocks();
});
