import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useCheckout } from '../hooks/useCheckout';

// ── Mocks de dependencias externas ────────────────────────────────────────────
vi.mock('../hooks/useSyncManager', () => ({
    addToOfflineQueue:  vi.fn(),
    checkRealInternet:  vi.fn(),
}));

import { addToOfflineQueue, checkRealInternet } from '../hooks/useSyncManager';

// ─────────────────────────────────────────────────────────────────────────────
// Fixtures reutilizables
// ─────────────────────────────────────────────────────────────────────────────
const mockUser     = { uid: 'user-123' };
const mockAdmin    = { role: 'admin', name: 'Admin' };
const mockClient   = { role: 'client', name: 'Cliente', address: 'Calle 1', phone: '123' };

const mockCart = [
    { id: 'prod-1', name: 'Coca Cola', qty: 2, price: 500 },
    { id: 'prod-2', name: 'Agua',      qty: 1, price: 200 },
];
const mockProducts = [
    { id: 'prod-1', name: 'Coca Cola', price: 500, cost: 300 },
    { id: 'prod-2', name: 'Agua',      price: 200, cost: 100 },
];

const baseProps = {
    user:              mockUser,
    userData:          mockAdmin,
    cart:              mockCart,
    products:          mockProducts,
    cartTotal:         1200,
    paymentMethod:     'efectivo',
    selectedCustomer:  null,
    createTransaction: vi.fn(),
    clearCart:         vi.fn(),
    onOfflineSaved:    vi.fn(),
};

beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
});

// ─────────────────────────────────────────────────────────────────────────────
// Tests
// ─────────────────────────────────────────────────────────────────────────────

describe('useCheckout — estado inicial', () => {
    it('inicia sin errores ni procesamiento', () => {
        const { result } = renderHook(() => useCheckout(baseProps));
        expect(result.current.isProcessing).toBe(false);
        expect(result.current.checkoutError).toBeNull();
        expect(result.current.showCheckoutSuccess).toBe(false);
        expect(result.current.lastSale).toBeNull();
    });
});

describe('useCheckout — handleCheckout con carrito vacío', () => {
    it('no hace nada si el carrito está vacío', async () => {
        const { result } = renderHook(() => useCheckout({ ...baseProps, cart: [] }));

        await act(async () => {
            await result.current.handleCheckout({ setShowMobileCart: vi.fn(), setSelectedCustomer: vi.fn() });
        });

        expect(checkRealInternet).not.toHaveBeenCalled();
        expect(baseProps.createTransaction).not.toHaveBeenCalled();
    });

    it('no hace nada si no hay usuario autenticado', async () => {
        const { result } = renderHook(() => useCheckout({ ...baseProps, user: null }));

        await act(async () => {
            await result.current.handleCheckout({ setShowMobileCart: vi.fn(), setSelectedCustomer: vi.fn() });
        });

        expect(checkRealInternet).not.toHaveBeenCalled();
    });
});

describe('useCheckout — sin conexión (offline)', () => {
    beforeEach(() => {
        checkRealInternet.mockResolvedValue(false);
    });

    it('admin offline → guarda en cola y no muestra spinner', async () => {
        const { result } = renderHook(() => useCheckout({ ...baseProps, userData: mockAdmin }));

        await act(async () => {
            await result.current.handleCheckout({ setShowMobileCart: vi.fn(), setSelectedCustomer: vi.fn() });
        });

        expect(addToOfflineQueue).toHaveBeenCalledTimes(1);
        expect(baseProps.onOfflineSaved).toHaveBeenCalledTimes(1);
        expect(result.current.isProcessing).toBe(false);
        expect(result.current.checkoutError?.isPendingSync).toBe(true);
        expect(result.current.checkoutError?.isOffline).toBe(true);
    });

    it('admin offline → limpia el carrito tras guardar', async () => {
        const { result } = renderHook(() => useCheckout({ ...baseProps, userData: mockAdmin }));

        await act(async () => {
            await result.current.handleCheckout({ setShowMobileCart: vi.fn(), setSelectedCustomer: vi.fn() });
        });

        expect(baseProps.clearCart).toHaveBeenCalledTimes(1);
    });

    it('cliente offline → muestra error sin guardar en cola', async () => {
        const { result } = renderHook(() => useCheckout({ ...baseProps, userData: mockClient }));

        await act(async () => {
            await result.current.handleCheckout({ setShowMobileCart: vi.fn(), setSelectedCustomer: vi.fn() });
        });

        expect(addToOfflineQueue).not.toHaveBeenCalled();
        expect(baseProps.clearCart).not.toHaveBeenCalled();
        expect(result.current.checkoutError?.isOffline).toBe(true);
        expect(result.current.checkoutError?.isPendingSync).toBe(false);
    });

    it('el error offline incluye el total del pedido', async () => {
        const { result } = renderHook(() => useCheckout({ ...baseProps, userData: mockClient }));

        await act(async () => {
            await result.current.handleCheckout({ setShowMobileCart: vi.fn(), setSelectedCustomer: vi.fn() });
        });

        expect(result.current.checkoutError?.total).toBe(1200);
    });
});

describe('useCheckout — con conexión (online)', () => {
    beforeEach(() => {
        checkRealInternet.mockResolvedValue(true);
        baseProps.createTransaction.mockResolvedValue({ id: 'tx-abc123' });
    });

    it('llama a createTransaction con los datos correctos', async () => {
        const { result } = renderHook(() => useCheckout(baseProps));

        await act(async () => {
            await result.current.handleCheckout({ setShowMobileCart: vi.fn(), setSelectedCustomer: vi.fn() });
        });

        expect(baseProps.createTransaction).toHaveBeenCalledTimes(1);
        const [saleData] = baseProps.createTransaction.mock.calls[0];
        expect(saleData.type).toBe('sale');
        expect(saleData.total).toBe(1200);
        expect(saleData.paymentMethod).toBe('efectivo');
    });

    it('limpia el carrito tras una venta exitosa', async () => {
        const { result } = renderHook(() => useCheckout(baseProps));

        await act(async () => {
            await result.current.handleCheckout({ setShowMobileCart: vi.fn(), setSelectedCustomer: vi.fn() });
        });

        expect(baseProps.clearCart).toHaveBeenCalledTimes(1);
    });

    it('muestra el banner de éxito tras la venta', async () => {
        const { result } = renderHook(() => useCheckout(baseProps));

        await act(async () => {
            await result.current.handleCheckout({ setShowMobileCart: vi.fn(), setSelectedCustomer: vi.fn() });
        });

        expect(result.current.showCheckoutSuccess).toBe(true);
        expect(result.current.lastSale?.id).toBe('tx-abc123');
    });

    it('incluye el costo de cada producto en itemsWithCost', async () => {
        const { result } = renderHook(() => useCheckout(baseProps));

        await act(async () => {
            await result.current.handleCheckout({ setShowMobileCart: vi.fn(), setSelectedCustomer: vi.fn() });
        });

        const [, itemsWithCost] = baseProps.createTransaction.mock.calls[0];
        expect(itemsWithCost[0].cost).toBe(300); // Coca Cola
        expect(itemsWithCost[1].cost).toBe(100); // Agua
    });

    it('usa cliente anónimo si no hay cliente seleccionado ni userData.role=client', async () => {
        const { result } = renderHook(() => useCheckout({ ...baseProps, userData: mockAdmin, selectedCustomer: null }));

        await act(async () => {
            await result.current.handleCheckout({ setShowMobileCart: vi.fn(), setSelectedCustomer: vi.fn() });
        });

        const [saleData] = baseProps.createTransaction.mock.calls[0];
        expect(saleData.clientId).toBe('anonimo');
        expect(saleData.clientRole).toBe('guest');
    });

    it('usa el cliente seleccionado cuando está disponible', async () => {
        const customer = { id: 'cust-1', name: 'Juan', address: 'Av. 9 de Julio', phone: '351-000' };
        const { result } = renderHook(() => useCheckout({ ...baseProps, selectedCustomer: customer }));

        await act(async () => {
            await result.current.handleCheckout({ setShowMobileCart: vi.fn(), setSelectedCustomer: vi.fn() });
        });

        const [saleData] = baseProps.createTransaction.mock.calls[0];
        expect(saleData.clientId).toBe('cust-1');
        expect(saleData.clientName).toBe('Juan');
        expect(saleData.clientRole).toBe('customer');
    });
});

describe('useCheckout — fallo en Firestore (online pero error)', () => {
    beforeEach(() => {
        checkRealInternet.mockResolvedValue(true);
    });

    it('admin: si Firestore falla, guarda en cola offline', async () => {
        baseProps.createTransaction.mockRejectedValue(new Error('Firestore unavailable'));
        const { result } = renderHook(() => useCheckout({ ...baseProps, userData: mockAdmin }));

        await act(async () => {
            await result.current.handleCheckout({ setShowMobileCart: vi.fn(), setSelectedCustomer: vi.fn() });
        });

        expect(addToOfflineQueue).toHaveBeenCalledTimes(1);
        expect(result.current.checkoutError?.isPendingSync).toBe(true);
    });

    it('cliente: si Firestore falla, muestra error sin guardar en cola', async () => {
        baseProps.createTransaction.mockRejectedValue(new Error('Firestore unavailable'));
        const { result } = renderHook(() => useCheckout({ ...baseProps, userData: mockClient }));

        await act(async () => {
            await result.current.handleCheckout({ setShowMobileCart: vi.fn(), setSelectedCustomer: vi.fn() });
        });

        expect(addToOfflineQueue).not.toHaveBeenCalled();
        expect(result.current.checkoutError?.isOffline).toBe(false);
        expect(result.current.checkoutError?.isPendingSync).toBe(false);
    });
});
