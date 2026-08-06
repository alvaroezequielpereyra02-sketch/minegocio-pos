import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { useAuth } from '../hooks/useAuth';
import { api, tokenStorage } from '../services/api';

// api.js y tokenStorage ya están mockeados globalmente en tests/setup.js.
// Acá solo configuramos qué devuelve cada llamada en cada caso.

describe('useAuth', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        tokenStorage.get.mockReturnValue('test-token');
    });

    describe('hidratación inicial', () => {
        it('no intenta hidratar si no hay token guardado', async () => {
            tokenStorage.get.mockReturnValue(null);
            const { result } = renderHook(() => useAuth());

            await waitFor(() => expect(result.current.authLoading).toBe(false));

            expect(api.get).not.toHaveBeenCalled();
            expect(result.current.user).toBeNull();
            expect(result.current.userData).toBeNull();
        });

        it('carga el perfil desde /auth/me si hay token guardado', async () => {
            api.get.mockResolvedValue({
                id: 'u1', email: 'ana@gmail.com', name: 'Ana', role: 'client',
                profileComplete: true, avatarUrl: null,
            });

            const { result } = renderHook(() => useAuth());
            await waitFor(() => expect(result.current.authLoading).toBe(false));

            expect(api.get).toHaveBeenCalledWith('/auth/me');
            expect(result.current.user).toEqual({
                uid: 'u1', email: 'ana@gmail.com', name: 'Ana', avatarUrl: null,
            });
            expect(result.current.userData.role).toBe('client');
        });

        it('si /auth/me falla, limpia el token y deja la sesión vacía', async () => {
            api.get.mockRejectedValue(new Error('Token expirado.'));

            const { result } = renderHook(() => useAuth());
            await waitFor(() => expect(result.current.authLoading).toBe(false));

            expect(tokenStorage.clear).toHaveBeenCalled();
            expect(result.current.user).toBeNull();
            expect(result.current.userData).toBeNull();
        });
    });

    describe('loginWithGoogle', () => {
        it('manda el idToken, guarda el token nuevo y setea user/userData', async () => {
            tokenStorage.get.mockReturnValue(null); // sin sesión previa
            const { result } = renderHook(() => useAuth());
            await waitFor(() => expect(result.current.authLoading).toBe(false));

            api.post.mockResolvedValue({
                token: 'jwt-nuevo',
                user: {
                    id: 'u2', email: 'cliente@gmail.com', name: 'Cliente Nuevo',
                    role: 'client', profileComplete: false, avatarUrl: 'https://foto.jpg',
                },
            });

            await act(async () => {
                await result.current.loginWithGoogle('google-id-token');
            });

            expect(api.post).toHaveBeenCalledWith('/auth/google', { idToken: 'google-id-token' });
            expect(tokenStorage.set).toHaveBeenCalledWith('jwt-nuevo');
            expect(result.current.user.email).toBe('cliente@gmail.com');
            // profileComplete=false es la señal que gatilla CompleteProfileScreen en App.jsx
            expect(result.current.userData.profileComplete).toBe(false);
        });

        it('si el backend rechaza el token, setea loginError y no guarda sesión', async () => {
            tokenStorage.get.mockReturnValue(null);
            const { result } = renderHook(() => useAuth());
            await waitFor(() => expect(result.current.authLoading).toBe(false));

            api.post.mockRejectedValue(new Error('Token de Google inválido o expirado.'));

            await act(async () => {
                try { await result.current.loginWithGoogle('token-malo'); }
                catch { /* se espera que rechace */ }
            });

            expect(result.current.loginError).toBe('Token de Google inválido o expirado.');
            expect(result.current.user).toBeNull();
        });
    });

    describe('registerWithInvite', () => {
        it('manda idToken + inviteCode y guarda la sesión del rol otorgado', async () => {
            tokenStorage.get.mockReturnValue(null);
            const { result } = renderHook(() => useAuth());
            await waitFor(() => expect(result.current.authLoading).toBe(false));

            api.post.mockResolvedValue({
                token: 'jwt-empleado',
                user: {
                    id: 'u3', email: 'empleada@gmail.com', name: 'Empleada',
                    role: 'employee', profileComplete: true,
                },
            });

            await act(async () => {
                await result.current.registerWithInvite({ credential: 'g-token', inviteCode: 'ABCD1234' });
            });

            expect(api.post).toHaveBeenCalledWith('/auth/invite', {
                idToken: 'g-token', inviteCode: 'ABCD1234',
            });
            expect(result.current.userData.role).toBe('employee');
        });

        it('si el código es inválido, setea loginError con el mensaje del backend', async () => {
            tokenStorage.get.mockReturnValue(null);
            const { result } = renderHook(() => useAuth());
            await waitFor(() => expect(result.current.authLoading).toBe(false));

            api.post.mockRejectedValue(new Error('Código de invitación inválido o ya utilizado.'));

            await act(async () => {
                try {
                    await result.current.registerWithInvite({ credential: 'g-token', inviteCode: 'VENCIDO' });
                } catch { /* se espera que rechace */ }
            });

            expect(result.current.loginError).toBe('Código de invitación inválido o ya utilizado.');
        });
    });

    describe('completeProfile', () => {
        it('actualiza userData con el perfil completo y profileComplete=true', async () => {
            api.get.mockResolvedValue({
                id: 'u4', email: 'c@gmail.com', name: 'C', role: 'client', profileComplete: false,
            });
            const { result } = renderHook(() => useAuth());
            await waitFor(() => expect(result.current.authLoading).toBe(false));

            api.patch.mockResolvedValue({
                id: 'u4', email: 'c@gmail.com', name: 'Cliente Completo', role: 'client',
                profileComplete: true, businessName: 'Kiosco C', address: 'Calle 123', phone: '11111111',
            });

            await act(async () => {
                await result.current.completeProfile({
                    name: 'Cliente Completo', businessName: 'Kiosco C',
                    address: 'Calle 123', phone: '11111111',
                });
            });

            expect(api.patch).toHaveBeenCalledWith('/auth/me/profile', {
                name: 'Cliente Completo', businessName: 'Kiosco C',
                address: 'Calle 123', phone: '11111111',
            });
            expect(result.current.userData.profileComplete).toBe(true);
            expect(result.current.userData.businessName).toBe('Kiosco C');
        });
    });

    describe('logout', () => {
        it('limpia el token guardado y el estado local', async () => {
            api.get.mockResolvedValue({
                id: 'u5', email: 'admin@gmail.com', name: 'Admin', role: 'admin', profileComplete: true,
            });
            const { result } = renderHook(() => useAuth());
            await waitFor(() => expect(result.current.authLoading).toBe(false));
            expect(result.current.user).not.toBeNull();

            act(() => { result.current.logout(); });

            expect(tokenStorage.clear).toHaveBeenCalled();
            expect(result.current.user).toBeNull();
            expect(result.current.userData).toBeNull();
        });
    });

    describe('evento mnpos:session-expired', () => {
        it('limpia la sesión cuando api.js detecta un 401 en cualquier request', async () => {
            api.get.mockResolvedValue({
                id: 'u6', email: 'y@gmail.com', name: 'Y', role: 'client', profileComplete: true,
            });
            const { result } = renderHook(() => useAuth());
            await waitFor(() => expect(result.current.authLoading).toBe(false));
            expect(result.current.user).not.toBeNull();

            act(() => {
                window.dispatchEvent(new CustomEvent('mnpos:session-expired'));
            });

            expect(result.current.user).toBeNull();
            expect(result.current.userData).toBeNull();
        });
    });
});
