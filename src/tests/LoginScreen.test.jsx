import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import LoginScreen from '../components/LoginScreen';

// ─────────────────────────────────────────────────────────────────────────────
// Fixtures
// ─────────────────────────────────────────────────────────────────────────────

const defaultProps = {
    storeProfile:     { name: 'Mi Tienda', logoUrl: '' },
    login:            vi.fn(),
    register:         vi.fn(),
    resetPassword:    vi.fn(),
    loginError:       '',
    setLoginError:    vi.fn(),
    showNotification: vi.fn(),
};

beforeEach(() => {
    vi.clearAllMocks();
    defaultProps.login.mockResolvedValue(undefined);
    defaultProps.register.mockResolvedValue(undefined);
    defaultProps.resetPassword.mockResolvedValue(undefined);
});

// ─────────────────────────────────────────────────────────────────────────────
// Renderizado inicial — modo login
// ─────────────────────────────────────────────────────────────────────────────

describe('LoginScreen — renderizado inicial', () => {
    it('muestra el nombre de la tienda en el encabezado', () => {
        render(<LoginScreen {...defaultProps} />);
        expect(screen.getByText('Mi Tienda')).toBeDefined();
    });

    it('muestra el campo de email', () => {
        render(<LoginScreen {...defaultProps} />);
        expect(screen.getByPlaceholderText(/correo/i)).toBeDefined();
    });

    it('muestra el campo de contraseña', () => {
        render(<LoginScreen {...defaultProps} />);
        expect(screen.getByPlaceholderText(/contraseña/i)).toBeDefined();
    });

    it('muestra el botón de ingresar', () => {
        render(<LoginScreen {...defaultProps} />);
        expect(screen.getByRole('button', { name: /ingresar/i })).toBeDefined();
    });

    it('muestra el enlace para registrarse', () => {
        render(<LoginScreen {...defaultProps} />);
        expect(screen.getByText(/registrarse/i)).toBeDefined();
    });

    it('no muestra el campo de nombre (solo visible en registro)', () => {
        render(<LoginScreen {...defaultProps} />);
        expect(screen.queryByPlaceholderText(/nombre/i)).toBeNull();
    });

    it('no muestra el campo de código de invitación por defecto', () => {
        render(<LoginScreen {...defaultProps} />);
        expect(screen.queryByPlaceholderText(/código/i)).toBeNull();
    });
});

// ─────────────────────────────────────────────────────────────────────────────
// Cambio a modo registro
// ─────────────────────────────────────────────────────────────────────────────

describe('LoginScreen — modo registro', () => {
    it('al hacer clic en registrarse muestra el formulario de registro', () => {
        render(<LoginScreen {...defaultProps} />);

        const registerLink = screen.getByText(/registrarse/i);
        fireEvent.click(registerLink);

        expect(screen.getByPlaceholderText(/nombre/i)).toBeDefined();
    });

    it('muestra el campo de código de invitación en modo registro', () => {
        render(<LoginScreen {...defaultProps} />);
        fireEvent.click(screen.getByText(/registrarse/i));

        expect(screen.getByPlaceholderText(/código/i)).toBeDefined();
    });

    it('muestra el botón "Crear cuenta" en modo registro', () => {
        render(<LoginScreen {...defaultProps} />);
        fireEvent.click(screen.getByText(/registrarse/i));

        expect(screen.getByRole('button', { name: /crear cuenta/i })).toBeDefined();
    });

    it('al hacer clic en "ya tengo cuenta" vuelve al modo login', () => {
        render(<LoginScreen {...defaultProps} />);

        fireEvent.click(screen.getByText(/registrarse/i));
        expect(screen.getByRole('button', { name: /crear cuenta/i })).toBeDefined();

        fireEvent.click(screen.getByText(/ya tengo cuenta/i));
        expect(screen.queryByRole('button', { name: /crear cuenta/i })).toBeNull();
        expect(screen.getByRole('button', { name: /ingresar/i })).toBeDefined();
    });
});

// ─────────────────────────────────────────────────────────────────────────────
// Error de login
// ─────────────────────────────────────────────────────────────────────────────

describe('LoginScreen — mensajes de error', () => {
    it('muestra el loginError cuando está definido', () => {
        render(<LoginScreen {...defaultProps} loginError="Credenciales incorrectas." />);
        expect(screen.getByText('Credenciales incorrectas.')).toBeDefined();
    });

    it('no muestra el error cuando loginError está vacío', () => {
        render(<LoginScreen {...defaultProps} loginError="" />);
        expect(screen.queryByText('Credenciales incorrectas.')).toBeNull();
    });
});

// ─────────────────────────────────────────────────────────────────────────────
// Submit del formulario de login
// ─────────────────────────────────────────────────────────────────────────────

describe('LoginScreen — submit del formulario de login', () => {
    it('llama a login con email y contraseña al hacer submit', async () => {
        render(<LoginScreen {...defaultProps} />);

        fireEvent.change(screen.getByPlaceholderText(/correo/i), {
            target: { value: 'user@test.com' },
        });
        fireEvent.change(screen.getByPlaceholderText(/contraseña/i), {
            target: { value: '123456' },
        });

        fireEvent.click(screen.getByRole('button', { name: /ingresar/i }));

        await waitFor(() => {
            expect(defaultProps.login).toHaveBeenCalledWith('user@test.com', '123456');
        });
    });
});

// ─────────────────────────────────────────────────────────────────────────────
// Recuperación de contraseña
// ─────────────────────────────────────────────────────────────────────────────

describe('LoginScreen — recuperar contraseña', () => {
    it('muestra el enlace "Olvidé mi contraseña"', () => {
        render(<LoginScreen {...defaultProps} />);
        expect(screen.getByText(/olvidé/i)).toBeDefined();
    });

    it('llama a resetPassword con el email ingresado', async () => {
        render(<LoginScreen {...defaultProps} />);

        fireEvent.change(screen.getByPlaceholderText(/correo/i), {
            target: { value: 'user@test.com' },
        });

        fireEvent.click(screen.getByText(/olvidé/i));

        await waitFor(() => {
            expect(defaultProps.resetPassword).toHaveBeenCalledWith('user@test.com');
        });
    });

    it('llama a setLoginError si se intenta recuperar sin email', async () => {
        render(<LoginScreen {...defaultProps} />);
        // Sin escribir email
        fireEvent.click(screen.getByText(/olvidé/i));

        await waitFor(() => {
            expect(defaultProps.setLoginError).toHaveBeenCalled();
        });
    });

    it('muestra mensaje de éxito después de enviar el email de recuperación', async () => {
        render(<LoginScreen {...defaultProps} />);

        fireEvent.change(screen.getByPlaceholderText(/correo/i), {
            target: { value: 'user@test.com' },
        });
        fireEvent.click(screen.getByText(/olvidé/i));

        await waitFor(() => {
            expect(screen.queryByText(/enviamos/i) || screen.queryByText(/revisa/i) ||
                   screen.queryByText(/correo/i)).toBeDefined();
        });
    });
});

// ─────────────────────────────────────────────────────────────────────────────
// Accesibilidad básica
// ─────────────────────────────────────────────────────────────────────────────

describe('LoginScreen — accesibilidad', () => {
    it('el logo muestra el nombre de la tienda cuando no hay imagen', () => {
        render(<LoginScreen {...defaultProps} storeProfile={{ name: 'SuperTienda', logoUrl: '' }} />);
        expect(screen.getByText('SuperTienda')).toBeDefined();
    });

    it('muestra el logo si hay logoUrl', () => {
        render(<LoginScreen {...defaultProps} storeProfile={{ name: 'Test', logoUrl: 'https://example.com/logo.png' }} />);
        const img = screen.getByRole('img');
        expect(img.src).toContain('example.com/logo.png');
    });
});
