import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import LoginScreen from '../components/LoginScreen';

// El SDK de Google Identity Services (accounts.google.com/gsi/client) no
// existe en jsdom. Lo simulamos con un mock que deja capturar el `callback`
// registrado en initialize() para poder disparar el flujo como si alguien
// hubiera completado el popup de Google.
function mockGoogleIdentity() {
    const initialize   = vi.fn();
    const renderButton = vi.fn();
    window.google = { accounts: { id: { initialize, renderButton } } };
    return { initialize, renderButton };
}

function lastCallback(initialize) {
    const calls = initialize.mock.calls;
    return calls[calls.length - 1][0].callback;
}

const storeProfile = { name: 'Distribuidora P&P', logoUrl: null };

function renderLogin(overrides = {}) {
    const props = {
        storeProfile,
        loginWithGoogle: vi.fn().mockResolvedValue({}),
        registerWithInvite: vi.fn().mockResolvedValue({}),
        loginError: '',
        setLoginError: vi.fn(),
        ...overrides,
    };
    return { ...render(<LoginScreen {...props} />), props };
}

describe('LoginScreen', () => {
    beforeEach(() => {
        delete window.google;
    });

    it('muestra el nombre de la tienda', () => {
        mockGoogleIdentity();
        renderLogin();
        expect(screen.getByText('Distribuidora P&P')).toBeInTheDocument();
    });

    it('arranca en modo cliente, sin campo de código de invitación', () => {
        mockGoogleIdentity();
        renderLogin();
        expect(screen.queryByPlaceholderText('CÓDIGO DE INVITACIÓN')).not.toBeInTheDocument();
    });

    it('al tocar "Soy del equipo" aparece el campo de código', () => {
        mockGoogleIdentity();
        renderLogin();
        fireEvent.click(screen.getByText('Soy del equipo'));
        expect(screen.getByPlaceholderText('CÓDIGO DE INVITACIÓN')).toBeInTheDocument();
    });

    it('inicializa el SDK de Google con auto_select en false', async () => {
        const { initialize, renderButton } = mockGoogleIdentity();
        renderLogin();

        await waitFor(() => expect(initialize).toHaveBeenCalled());
        expect(initialize.mock.calls[0][0]).toMatchObject({ auto_select: false });
        expect(renderButton).toHaveBeenCalled();
    });

    it('en modo cliente, la credencial de Google dispara loginWithGoogle', async () => {
        const { initialize } = mockGoogleIdentity();
        const { props } = renderLogin();

        await waitFor(() => expect(initialize).toHaveBeenCalled());
        await act(async () => {
            await lastCallback(initialize)({ credential: 'g-id-token' });
        });

        expect(props.loginWithGoogle).toHaveBeenCalledWith('g-id-token');
        expect(props.registerWithInvite).not.toHaveBeenCalled();
    });

    it('en modo empleado sin código cargado, no llama a registerWithInvite y avisa el error', async () => {
        const { initialize } = mockGoogleIdentity();
        const { props } = renderLogin();

        fireEvent.click(screen.getByText('Soy del equipo'));
        await waitFor(() => expect(initialize).toHaveBeenCalled());
        await act(async () => {
            await lastCallback(initialize)({ credential: 'g-id-token' });
        });

        expect(props.registerWithInvite).not.toHaveBeenCalled();
        expect(props.setLoginError).toHaveBeenCalledWith('Ingresá tu código de invitación.');
    });

    it('en modo empleado con código cargado, llama a registerWithInvite con credential + inviteCode', async () => {
        const { initialize } = mockGoogleIdentity();
        const { props } = renderLogin();

        fireEvent.click(screen.getByText('Soy del equipo'));
        fireEvent.change(screen.getByPlaceholderText('CÓDIGO DE INVITACIÓN'), {
            target: { value: 'abcd1234' },
        });

        await waitFor(() => expect(initialize).toHaveBeenCalled());
        await act(async () => {
            await lastCallback(initialize)({ credential: 'g-id-token' });
        });

        expect(props.registerWithInvite).toHaveBeenCalledWith({
            credential: 'g-id-token', inviteCode: 'abcd1234',
        });
    });

    it('muestra loginError cuando está presente', () => {
        mockGoogleIdentity();
        renderLogin({ loginError: 'Token de Google inválido.' });
        expect(screen.getByText('Token de Google inválido.')).toBeInTheDocument();
    });

    it('al cambiar de modo, limpia el error anterior', () => {
        mockGoogleIdentity();
        const setLoginError = vi.fn();
        renderLogin({ setLoginError });

        fireEvent.click(screen.getByText('Soy del equipo'));
        expect(setLoginError).toHaveBeenCalledWith('');
    });
});
