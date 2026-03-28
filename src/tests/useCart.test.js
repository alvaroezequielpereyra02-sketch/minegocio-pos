import { describe, it, expect, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useCart } from '../hooks/useCart';

// ─────────────────────────────────────────────────────────────────────────────
// Fixtures
// ─────────────────────────────────────────────────────────────────────────────

const prodSimple = { id: 'p1', name: 'Coca Cola', price: 500, cost: 300, imageUrl: '' };

// Producto con precio mayorista: a partir de 6 unidades → $400 (en vez de $500)
const prodMayorista = {
    id: 'p2', name: 'Alfajor', price: 500, cost: 200,
    wholesalePrice: 400, wholesaleMinQty: 6, imageUrl: ''
};

const products = [prodSimple, prodMayorista];

// ─────────────────────────────────────────────────────────────────────────────
// Estado inicial
// ─────────────────────────────────────────────────────────────────────────────

describe('useCart — estado inicial', () => {
    it('carrito comienza vacío', () => {
        const { result } = renderHook(() => useCart(products));
        expect(result.current.cart).toHaveLength(0);
    });

    it('total comienza en 0', () => {
        const { result } = renderHook(() => useCart(products));
        expect(result.current.cartTotal).toBe(0);
    });

    it('método de pago inicial es "unspecified"', () => {
        const { result } = renderHook(() => useCart(products));
        expect(result.current.paymentMethod).toBe('unspecified');
    });
});

// ─────────────────────────────────────────────────────────────────────────────
// addToCart
// ─────────────────────────────────────────────────────────────────────────────

describe('useCart — addToCart', () => {
    it('agrega un producto nuevo al carrito con qty 1', () => {
        const { result } = renderHook(() => useCart(products));
        act(() => result.current.addToCart(prodSimple));

        expect(result.current.cart).toHaveLength(1);
        expect(result.current.cart[0].qty).toBe(1);
        expect(result.current.cart[0].id).toBe('p1');
    });

    it('incrementa qty si el producto ya está en el carrito', () => {
        const { result } = renderHook(() => useCart(products));
        act(() => result.current.addToCart(prodSimple));
        act(() => result.current.addToCart(prodSimple));

        expect(result.current.cart).toHaveLength(1);
        expect(result.current.cart[0].qty).toBe(2);
    });

    it('agregar dos productos distintos crea dos items', () => {
        const { result } = renderHook(() => useCart(products));
        act(() => result.current.addToCart(prodSimple));
        act(() => result.current.addToCart(prodMayorista));

        expect(result.current.cart).toHaveLength(2);
    });

    it('usa precio minorista cuando no se alcanza el mínimo mayorista', () => {
        const { result } = renderHook(() => useCart(products));
        act(() => result.current.addToCart(prodMayorista)); // qty=1, mínimo=6

        expect(result.current.cart[0].price).toBe(500);
        expect(result.current.cart[0].isWholesale).toBe(false);
    });

    it('aplica precio mayorista al superar el mínimo requerido', () => {
        const { result } = renderHook(() => useCart(products));
        // Agregar 6 veces para superar wholesaleMinQty=6
        for (let i = 0; i < 6; i++) {
            act(() => result.current.addToCart(prodMayorista));
        }
        expect(result.current.cart[0].price).toBe(400);
        expect(result.current.cart[0].isWholesale).toBe(true);
    });

    it('vuelve al precio minorista si la qty baja del mínimo mayorista', () => {
        const { result } = renderHook(() => useCart(products));
        for (let i = 0; i < 6; i++) {
            act(() => result.current.addToCart(prodMayorista));
        }
        expect(result.current.cart[0].isWholesale).toBe(true);

        act(() => result.current.updateCartQty('p2', -1)); // qty=5

        expect(result.current.cart[0].price).toBe(500);
        expect(result.current.cart[0].isWholesale).toBe(false);
    });
});

// ─────────────────────────────────────────────────────────────────────────────
// updateCartQty
// ─────────────────────────────────────────────────────────────────────────────

describe('useCart — updateCartQty', () => {
    it('incrementa la cantidad con delta positivo', () => {
        const { result } = renderHook(() => useCart(products));
        act(() => result.current.addToCart(prodSimple));
        act(() => result.current.updateCartQty('p1', 3));

        expect(result.current.cart[0].qty).toBe(4);
    });

    it('decrementa la cantidad con delta negativo', () => {
        const { result } = renderHook(() => useCart(products));
        act(() => result.current.addToCart(prodSimple));
        act(() => result.current.updateCartQty('p1', 1));
        act(() => result.current.updateCartQty('p1', -1));

        expect(result.current.cart[0].qty).toBe(1);
    });

    it('elimina el item si qty llega a 0 o menos', () => {
        const { result } = renderHook(() => useCart(products));
        act(() => result.current.addToCart(prodSimple)); // qty=1
        act(() => result.current.updateCartQty('p1', -1)); // qty=0

        expect(result.current.cart).toHaveLength(0);
    });
});

// ─────────────────────────────────────────────────────────────────────────────
// setCartItemQty
// ─────────────────────────────────────────────────────────────────────────────

describe('useCart — setCartItemQty', () => {
    it('fija la cantidad exacta del item', () => {
        const { result } = renderHook(() => useCart(products));
        act(() => result.current.addToCart(prodSimple));
        act(() => result.current.setCartItemQty('p1', '10'));

        expect(result.current.cart[0].qty).toBe(10);
    });

    it('ignora valores inválidos (0, texto, negativo)', () => {
        const { result } = renderHook(() => useCart(products));
        act(() => result.current.addToCart(prodSimple));

        act(() => result.current.setCartItemQty('p1', '0'));
        expect(result.current.cart[0].qty).toBe(1); // no cambia

        act(() => result.current.setCartItemQty('p1', 'abc'));
        expect(result.current.cart[0].qty).toBe(1);
    });
});

// ─────────────────────────────────────────────────────────────────────────────
// removeFromCart
// ─────────────────────────────────────────────────────────────────────────────

describe('useCart — removeFromCart', () => {
    it('elimina el item correcto', () => {
        const { result } = renderHook(() => useCart(products));
        act(() => result.current.addToCart(prodSimple));
        act(() => result.current.addToCart(prodMayorista));
        act(() => result.current.removeFromCart('p1'));

        expect(result.current.cart).toHaveLength(1);
        expect(result.current.cart[0].id).toBe('p2');
    });
});

// ─────────────────────────────────────────────────────────────────────────────
// clearCart
// ─────────────────────────────────────────────────────────────────────────────

describe('useCart — clearCart', () => {
    it('vacía el carrito completamente', () => {
        const { result } = renderHook(() => useCart(products));
        act(() => result.current.addToCart(prodSimple));
        act(() => result.current.addToCart(prodMayorista));
        act(() => result.current.clearCart());

        expect(result.current.cart).toHaveLength(0);
        expect(result.current.cartTotal).toBe(0);
    });

    it('resetea el método de pago a "unspecified"', () => {
        const { result } = renderHook(() => useCart(products));
        act(() => result.current.setPaymentMethod('cash'));
        act(() => result.current.clearCart());

        expect(result.current.paymentMethod).toBe('unspecified');
    });
});

// ─────────────────────────────────────────────────────────────────────────────
// cartTotal
// ─────────────────────────────────────────────────────────────────────────────

describe('useCart — cartTotal', () => {
    it('calcula correctamente el total con precios minoristas', () => {
        const { result } = renderHook(() => useCart(products));
        act(() => result.current.addToCart(prodSimple));     // 1 × $500 = $500
        act(() => result.current.addToCart(prodSimple));     // 2 × $500 = $1000
        act(() => result.current.addToCart(prodMayorista)); // 1 × $500 = $500

        expect(result.current.cartTotal).toBe(1500);
    });

    it('refleja el precio mayorista en el total cuando aplica', () => {
        const { result } = renderHook(() => useCart(products));
        // Agregar 6 alfajores → precio mayorista $400
        for (let i = 0; i < 6; i++) {
            act(() => result.current.addToCart(prodMayorista));
        }
        // 6 × $400 = $2400
        expect(result.current.cartTotal).toBe(2400);
    });
});
