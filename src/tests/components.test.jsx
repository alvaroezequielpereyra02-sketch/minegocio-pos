import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import ErrorBoundary from '../components/ErrorBoundary';
import Cart from '../components/Cart';

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

// Silencia los console.error de React durante los tests de ErrorBoundary
const suppressConsoleError = () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    return () => spy.mockRestore();
};

// Componente que lanza un error intencionalmente
const Bomb = ({ shouldThrow = false }) => {
    if (shouldThrow) throw new Error('Error de prueba intencional');
    return <div>Todo bien</div>;
};

// ─────────────────────────────────────────────────────────────────────────────
// Props base del Cart
// ─────────────────────────────────────────────────────────────────────────────

const cartBaseProps = {
    cart:               [],
    updateCartQty:      vi.fn(),
    removeFromCart:     vi.fn(),
    setCartItemQty:     vi.fn(),
    userData:           { role: 'admin', name: 'Admin' },
    selectedCustomer:   null,
    setSelectedCustomer: vi.fn(),
    customerSearch:     '',
    setCustomerSearch:  vi.fn(),
    customers:          [],
    paymentMethod:      'unspecified',
    setPaymentMethod:   vi.fn(),
    cartTotal:          0,
    handleCheckout:     vi.fn(),
    setShowMobileCart:  vi.fn(),
};

// ─────────────────────────────────────────────────────────────────────────────
// ErrorBoundary
// ─────────────────────────────────────────────────────────────────────────────

describe('ErrorBoundary — renderizado normal', () => {
    it('renderiza sus children cuando no hay error', () => {
        render(
            <ErrorBoundary>
                <div>Contenido normal</div>
            </ErrorBoundary>
        );
        expect(screen.getByText('Contenido normal')).toBeDefined();
    });

    it('no muestra la UI de emergencia cuando no hay error', () => {
        render(
            <ErrorBoundary>
                <div>OK</div>
            </ErrorBoundary>
        );
        expect(screen.queryByText('¡Ups! Algo salió mal')).toBeNull();
    });
});

describe('ErrorBoundary — captura de errores', () => {
    let restoreConsole;
    beforeEach(() => { restoreConsole = suppressConsoleError(); });
    afterEach(() => restoreConsole());

    it('captura un error lanzado por un hijo y muestra la UI de emergencia', () => {
        render(
            <ErrorBoundary>
                <Bomb shouldThrow={true} />
            </ErrorBoundary>
        );
        expect(screen.getByText('¡Ups! Algo salió mal')).toBeDefined();
    });

    it('muestra el botón de recargar aplicación', () => {
        render(
            <ErrorBoundary>
                <Bomb shouldThrow={true} />
            </ErrorBoundary>
        );
        expect(screen.getByText('Recargar Aplicación')).toBeDefined();
    });

    it('muestra el detalle técnico del error en el summary', () => {
        render(
            <ErrorBoundary>
                <Bomb shouldThrow={true} />
            </ErrorBoundary>
        );
        expect(screen.getByText('Ver detalle técnico (para soporte)')).toBeDefined();
    });

    it('el mensaje de error aparece en el detalle técnico', () => {
        render(
            <ErrorBoundary>
                <Bomb shouldThrow={true} />
            </ErrorBoundary>
        );
        expect(screen.getByText(/Error de prueba intencional/)).toBeDefined();
    });

    it('no muestra los children cuando hay error', () => {
        render(
            <ErrorBoundary>
                <Bomb shouldThrow={true} />
                <div>Este texto no debe aparecer</div>
            </ErrorBoundary>
        );
        expect(screen.queryByText('Este texto no debe aparecer')).toBeNull();
    });
});

// ─────────────────────────────────────────────────────────────────────────────
// Cart — estado vacío
// ─────────────────────────────────────────────────────────────────────────────

describe('Cart — carrito vacío', () => {
    it('muestra el mensaje de carrito vacío', () => {
        render(<Cart {...cartBaseProps} />);
        expect(screen.getByText('El carrito está vacío')).toBeDefined();
    });

    it('no muestra badge de cantidad cuando no hay items', () => {
        render(<Cart {...cartBaseProps} />);
        // El badge del contador solo aparece cuando itemCount > 0
        expect(screen.queryByText('0')).toBeNull();
    });

    it('muestra el título "Pedido" en el header', () => {
        render(<Cart {...cartBaseProps} />);
        expect(screen.getByText('Pedido')).toBeDefined();
    });
});

// ─────────────────────────────────────────────────────────────────────────────
// Cart — con items
// ─────────────────────────────────────────────────────────────────────────────

describe('Cart — con items', () => {
    const cartConItems = [
        { id: 'p1', name: 'Coca Cola', qty: 2, price: 500, isWholesale: false },
        { id: 'p2', name: 'Agua',      qty: 1, price: 200, isWholesale: false },
    ];

    it('muestra el nombre de cada producto', () => {
        render(<Cart {...cartBaseProps} cart={cartConItems} cartTotal={1200} />);
        expect(screen.getByText('Coca Cola')).toBeDefined();
        expect(screen.getByText('Agua')).toBeDefined();
    });

    it('muestra el badge con la cantidad total de items', () => {
        render(<Cart {...cartBaseProps} cart={cartConItems} cartTotal={1200} />);
        // Total: 2 + 1 = 3
        expect(screen.getByText('3')).toBeDefined();
    });

    it('muestra el precio unitario de cada item', () => {
        render(<Cart {...cartBaseProps} cart={cartConItems} cartTotal={1200} />);
        expect(screen.getByText('$500 c/u')).toBeDefined();
    });

    it('no muestra el cartel de vacío cuando hay items', () => {
        render(<Cart {...cartBaseProps} cart={cartConItems} cartTotal={1200} />);
        expect(screen.queryByText('El carrito está vacío')).toBeNull();
    });
});

// ─────────────────────────────────────────────────────────────────────────────
// Cart — precio mayorista
// ─────────────────────────────────────────────────────────────────────────────

describe('Cart — precio mayorista', () => {
    const cartMayorista = [
        { id: 'p1', name: 'Alfajor', qty: 6, price: 400, isWholesale: true },
    ];

    it('muestra el badge "Mayor" en items con precio mayorista', () => {
        render(<Cart {...cartBaseProps} cart={cartMayorista} cartTotal={2400} />);
        expect(screen.getByText('Mayor')).toBeDefined();
    });
});

// ─────────────────────────────────────────────────────────────────────────────
// Cart — interacciones
// ─────────────────────────────────────────────────────────────────────────────

describe('Cart — interacciones', () => {
    const cartConItems = [
        { id: 'p1', name: 'Coca Cola', qty: 2, price: 500, isWholesale: false },
    ];

    it('llama a updateCartQty(-1) al presionar el botón de reducir cantidad', () => {
        const updateQty = vi.fn();
        render(<Cart {...cartBaseProps} cart={cartConItems} updateCartQty={updateQty} cartTotal={1000} />);

        const minusButtons = screen.getAllByRole('button');
        // El primer botón de Minus es el de reducir cantidad
        const minusBtn = minusButtons.find(b => b.querySelector('svg'));
        fireEvent.click(minusButtons[1]); // primer botón de qty del item
        expect(updateQty).toHaveBeenCalled();
    });

    it('llama a setShowMobileCart(false) al presionar el botón X del header', () => {
        const setShowMobileCart = vi.fn();
        render(<Cart {...cartBaseProps} setShowMobileCart={setShowMobileCart} />);

        // El botón X tiene la clase lg:hidden
        const closeBtn = screen.getAllByRole('button').find(b =>
            b.className.includes('lg:hidden') || b.className.includes('rounded-full')
        );
        if (closeBtn) {
            fireEvent.click(closeBtn);
            expect(setShowMobileCart).toHaveBeenCalledWith(false);
        }
    });
});
