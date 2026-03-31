import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';

// ── Mocks de Firebase Auth ────────────────────────────────────────────────────
const mockSignIn   = vi.fn();
const mockSignOut  = vi.fn();
const mockRegister = vi.fn();
const mockReset    = vi.fn();
const mockDelete   = vi.fn();
const mockGetToken = vi.fn();

vi.mock('firebase/auth', () => ({
    onAuthStateChanged:          vi.fn(() => () => {}),
    signInWithEmailAndPassword:  (...args) => mockSignIn(...args),
    createUserWithEmailAndPassword: (...args) => mockRegister(...args),
    signOut:                     (...args) => mockSignOut(...args),
    sendPasswordResetEmail:      (...args) => mockReset(...args),
    getIdTokenResult:            (...args) => mockGetToken(...args),
}));

// ── Mocks de Firebase Firestore ───────────────────────────────────────────────
const mockGetDoc      = vi.fn();
const mockGetDocsFrom = vi.fn();
const mockSetDoc      = vi.fn();
const mockUpdateDoc   = vi.fn();
const mockOnSnapshot  = vi.fn(() => () => {});

vi.mock('firebase/firestore', async () => {
    const original = await vi.importActual('firebase/firestore');
    return {
        ...original,
        doc:               vi.fn(() => ({ path: 'mocked' })),
        collection:        vi.fn(() => ({ path: 'mocked-col' })),
        getDoc:            (...args) => mockGetDoc(...args),
        getDocsFromServer: (...args) => mockGetDocsFrom(...args),
        setDoc:            (...args) => mockSetDoc(...args),
        updateDoc:         (...args) => mockUpdateDoc(...args),
        onSnapshot:        (...args) => mockOnSnapshot(...args),
        query:             vi.fn(),
        where:             vi.fn(),
        serverTimestamp:   () => ({ _type: 'serverTimestamp' }),
    };
});

import { useAuth } from '../hooks/useAuth';

// ─────────────────────────────────────────────────────────────────────────────
// Fixtures
// ─────────────────────────────────────────────────────────────────────────────

const validCredentials = { email: 'user@test.com', password: '123456' };

const validRegisterData = {
    email: 'nuevo@test.com', password: 'password123',
    name: 'Juan Pérez', phone: '351-000', address: 'Av. 1',
    inviteCode: 'ABCD1234',
};

const mockFirebaseUser = {
    uid: 'uid-123',
    email: 'user@test.com',
    delete: mockDelete,
};

const mockInviteDoc = {
    id:   'invite-doc-id',
    data: () => ({ code: 'ABCD1234', status: 'active' }),
};

beforeEach(() => {
    vi.clearAllMocks();
    // Token por defecto retorna role: null
    mockGetToken.mockResolvedValue({ claims: {} });
    mockGetDoc.mockResolvedValue({ exists: () => false, data: () => null });
    mockSetDoc.mockResolvedValue(undefined);
    mockUpdateDoc.mockResolvedValue(undefined);
    mockSignOut.mockResolvedValue(undefined);
    mockReset.mockResolvedValue(undefined);
});

// ─────────────────────────────────────────────────────────────────────────────
// Estado inicial
// ─────────────────────────────────────────────────────────────────────────────

describe('useAuth — estado inicial', () => {
    it('user y userData comienzan como null', () => {
        const { result } = renderHook(() => useAuth());
        expect(result.current.user).toBeNull();
        expect(result.current.userData).toBeNull();
    });

    it('loginError comienza como string vacío', () => {
        const { result } = renderHook(() => useAuth());
        expect(result.current.loginError).toBe('');
    });
});

// ─────────────────────────────────────────────────────────────────────────────
// login
// ─────────────────────────────────────────────────────────────────────────────

describe('useAuth — login', () => {
    it('llama a signInWithEmailAndPassword con las credenciales correctas', async () => {
        mockSignIn.mockResolvedValueOnce({ user: mockFirebaseUser });
        const { result } = renderHook(() => useAuth());

        await act(async () => {
            await result.current.login(validCredentials.email, validCredentials.password);
        });

        expect(mockSignIn).toHaveBeenCalledWith(
            expect.anything(),
            validCredentials.email,
            validCredentials.password
        );
    });

    it('limpia el loginError antes de intentar el login', async () => {
        mockSignIn.mockResolvedValueOnce({ user: mockFirebaseUser });
        const { result } = renderHook(() => useAuth());

        await act(async () => { result.current.setLoginError('Error previo'); });
        await act(async () => {
            await result.current.login(validCredentials.email, validCredentials.password);
        });

        expect(result.current.loginError).toBe('');
    });

    it('setea loginError si las credenciales son inválidas', async () => {
        mockSignIn.mockRejectedValueOnce({ code: 'auth/wrong-password' });
        const { result } = renderHook(() => useAuth());

        await act(async () => {
            try { await result.current.login('wrong@test.com', 'wrong'); } catch {}
        });

        expect(result.current.loginError).toBe('Credenciales incorrectas.');
    });

    it('re-lanza el error para que el componente pueda manejarlo', async () => {
        mockSignIn.mockRejectedValueOnce(new Error('auth/user-not-found'));
        const { result } = renderHook(() => useAuth());

        await expect(
            act(async () => { await result.current.login('x@x.com', 'pass'); })
        ).rejects.toThrow();
    });
});

// ─────────────────────────────────────────────────────────────────────────────
// register
// ─────────────────────────────────────────────────────────────────────────────

describe('useAuth — register', () => {
    beforeEach(() => {
        mockGetDocsFrom.mockResolvedValue({
            empty: false,
            docs:  [mockInviteDoc],
        });
        mockRegister.mockResolvedValue({ user: mockFirebaseUser });
    });

    it('valida el código de invitación antes de crear el usuario', async () => {
        const { result } = renderHook(() => useAuth());

        await act(async () => {
            try { await result.current.register(validRegisterData); } catch {}
        });

        // getDocsFromServer debe haberse llamado para validar el código
        expect(mockGetDocsFrom).toHaveBeenCalledTimes(1);
    });

    it('lanza error si el código de invitación está vencido o es inválido', async () => {
        mockGetDocsFrom.mockResolvedValueOnce({ empty: true, docs: [] });
        const { result } = renderHook(() => useAuth());

        await expect(
            act(async () => { await result.current.register(validRegisterData); })
        ).rejects.toThrow();
    });

    it('crea el usuario en Auth después de validar el código', async () => {
        const { result } = renderHook(() => useAuth());

        await act(async () => {
            try { await result.current.register(validRegisterData); } catch {}
        });

        expect(mockRegister).toHaveBeenCalledWith(
            expect.anything(),
            validRegisterData.email,
            validRegisterData.password
        );
    });

    it('guarda el usuario en Firestore con role: client', async () => {
        const { result } = renderHook(() => useAuth());

        await act(async () => {
            try { await result.current.register(validRegisterData); } catch {}
        });

        // El primer setDoc es el documento del usuario
        const firstSetDocCall = mockSetDoc.mock.calls[0];
        expect(firstSetDocCall[1].role).toBe('client');
        expect(firstSetDocCall[1].email).toBe(validRegisterData.email);
    });

    it('marca el código de invitación como usado', async () => {
        const { result } = renderHook(() => useAuth());

        await act(async () => {
            try { await result.current.register(validRegisterData); } catch {}
        });

        const updateCall = mockUpdateDoc.mock.calls.find(
            call => call[1]?.status === 'used'
        );
        expect(updateCall).toBeDefined();
        expect(updateCall[1].usedBy).toBe(mockFirebaseUser.uid);
    });

    it('ROLLBACK: elimina el usuario de Auth si Firestore falla', async () => {
        // Simular fallo en el primer setDoc (escribir en users/)
        mockSetDoc.mockRejectedValueOnce(new Error('Firestore permission denied'));

        const { result } = renderHook(() => useAuth());

        await act(async () => {
            try { await result.current.register(validRegisterData); } catch {}
        });

        // El usuario debe haber sido eliminado de Auth para evitar cuenta huérfana
        expect(mockDelete).toHaveBeenCalledTimes(1);
    });

    it('ROLLBACK: setea loginError con el mensaje del error de Firestore', async () => {
        mockSetDoc.mockRejectedValueOnce(new Error('Firestore error específico'));

        const { result } = renderHook(() => useAuth());

        await act(async () => {
            try { await result.current.register(validRegisterData); } catch {}
        });

        expect(result.current.loginError).toContain('Firestore error específico');
    });
});

// ─────────────────────────────────────────────────────────────────────────────
// logout
// ─────────────────────────────────────────────────────────────────────────────

describe('useAuth — logout', () => {
    it('llama a signOut', async () => {
        const { result } = renderHook(() => useAuth());

        await act(async () => { await result.current.logout(); });

        expect(mockSignOut).toHaveBeenCalledTimes(1);
    });

    it('limpia userData al hacer logout', async () => {
        const { result } = renderHook(() => useAuth());

        await act(async () => { await result.current.logout(); });

        expect(result.current.userData).toBeNull();
    });
});

// ─────────────────────────────────────────────────────────────────────────────
// resetPassword
// ─────────────────────────────────────────────────────────────────────────────

describe('useAuth — resetPassword', () => {
    it('llama a sendPasswordResetEmail con el email correcto', async () => {
        const { result } = renderHook(() => useAuth());

        await act(async () => {
            await result.current.resetPassword('user@test.com');
        });

        expect(mockReset).toHaveBeenCalledWith(
            expect.anything(),
            'user@test.com',
            expect.objectContaining({ handleCodeInApp: true })
        );
    });

    it('lanza error y setea loginError si el email está vacío', async () => {
        const { result } = renderHook(() => useAuth());

        await act(async () => {
            try { await result.current.resetPassword(''); } catch {}
        });

        expect(result.current.loginError).toBeTruthy();
        expect(mockReset).not.toHaveBeenCalled();
    });

    it('usa la URL de la app para el enlace de recuperación', async () => {
        const { result } = renderHook(() => useAuth());

        await act(async () => {
            await result.current.resetPassword('user@test.com');
        });

        const [, , actionSettings] = mockReset.mock.calls[0];
        expect(actionSettings.url).toBeDefined();
        expect(actionSettings.handleCodeInApp).toBe(true);
    });
});
