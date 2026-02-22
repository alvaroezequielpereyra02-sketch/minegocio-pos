import React, { memo } from 'react';
import { ShoppingCart, X, Minus, Plus, Trash2, Search, ChevronRight } from 'lucide-react';

const Cart = memo(function Cart({
  cart, updateCartQty, removeFromCart, setCartItemQty,
  userData, selectedCustomer, setSelectedCustomer,
  customerSearch, setCustomerSearch, customers,
  paymentMethod, setPaymentMethod,
  cartTotal, handleCheckout, setShowMobileCart
}) {
  const itemCount = cart.reduce((a, b) => a + b.qty, 0);

  return (
    <div className="bg-white h-full flex flex-col">

      {/* Header */}
      <div className="px-4 py-3.5 flex justify-between items-center border-b border-slate-100">
        <div className="flex items-center gap-2">
          <ShoppingCart size={18} className="text-orange-500" />
          <span className="font-bold text-slate-800 text-base">Pedido</span>
          {itemCount > 0 && (
            <span className="text-xs font-black text-white px-2 py-0.5 rounded-full"
              style={{ background: 'linear-gradient(135deg, #f97316, #ea580c)' }}>
              {itemCount}
            </span>
          )}
        </div>
        <button onClick={() => setShowMobileCart(false)}
          className="lg:hidden w-7 h-7 bg-slate-100 rounded-full flex items-center justify-center hover:bg-slate-200 transition-colors">
          <X size={16} className="text-slate-500" />
        </button>
      </div>

      {/* Items */}
      <div className="flex-1 overflow-y-auto">
        {cart.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-slate-300 gap-3">
            <ShoppingCart size={44} strokeWidth={1.5} />
            <p className="text-sm font-medium">El carrito está vacío</p>
          </div>
        ) : (
          <div className="divide-y divide-slate-50">
            {cart.map(item => (
              <div key={item.id} className="flex items-center gap-3 px-4 py-3">
                <div className="flex-1 min-w-0">
                  <div className="font-semibold text-slate-800 text-sm truncate leading-tight">{item.name}</div>
                  <div className="text-xs text-slate-400 mt-0.5">${item.price?.toLocaleString()} c/u</div>
                </div>

                <div className="flex items-center rounded-xl border border-slate-200 overflow-hidden shrink-0">
                  <button onClick={() => updateCartQty(item.id, -1)}
                    className="w-7 h-7 flex items-center justify-center hover:bg-slate-100 active:bg-slate-200 text-slate-500 transition-colors">
                    <Minus size={12} strokeWidth={3} />
                  </button>
                  <input
                    type="number" min="1" value={item.qty}
                    onChange={(e) => setCartItemQty(item.id, e.target.value)}
                    className="w-8 h-7 text-center text-sm font-bold bg-transparent outline-none [&::-webkit-inner-spin-button]:appearance-none"
                  />
                  <button onClick={() => updateCartQty(item.id, 1)}
                    className="w-7 h-7 flex items-center justify-center hover:bg-slate-100 active:bg-slate-200 text-slate-500 transition-colors">
                    <Plus size={12} strokeWidth={3} />
                  </button>
                </div>

                <div className="text-right shrink-0">
                  <div className="text-sm font-bold text-slate-800">${(item.price * item.qty)?.toLocaleString()}</div>
                  <button onClick={() => removeFromCart(item.id)}
                    className="text-slate-200 hover:text-red-400 transition-colors mt-0.5 flex items-center justify-end w-full">
                    <Trash2 size={12} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="border-t border-slate-100 bg-slate-50/60 px-4 pt-3 pb-4 space-y-3">

        {/* Cliente (admin) */}
        {userData.role === 'admin' && (
          <div className="relative">
            {selectedCustomer ? (
              <div className="flex items-center justify-between bg-orange-50 px-3 py-2.5 rounded-xl border border-orange-200">
                <div>
                  <div className="text-sm font-bold text-orange-800 leading-tight">{selectedCustomer.name}</div>
                  <div className="text-xs text-orange-500">{selectedCustomer.phone}</div>
                </div>
                <button onClick={() => setSelectedCustomer(null)}
                  className="text-orange-300 hover:text-orange-500 transition-colors bg-white rounded-full w-5 h-5 flex items-center justify-center">
                  <X size={12} />
                </button>
              </div>
            ) : (
              <div>
                <div className="flex items-center gap-2 border border-slate-200 rounded-xl px-3 py-2.5 bg-white focus-within:border-orange-400 transition-colors">
                  <Search size={14} className="text-slate-300 shrink-0" />
                  <input
                    className="w-full text-sm outline-none bg-transparent placeholder:text-slate-300"
                    placeholder="Asignar cliente..."
                    value={customerSearch}
                    onChange={(e) => setCustomerSearch(e.target.value)}
                  />
                </div>
                {customerSearch && (
                  <div className="absolute left-0 right-0 bottom-full mb-1 bg-white border border-slate-200 rounded-xl shadow-xl max-h-44 overflow-y-auto z-50">
                    {customers.filter(c => c.name.toLowerCase().includes(customerSearch.toLowerCase())).map(c => (
                      <button key={c.id} onClick={() => { setSelectedCustomer(c); setCustomerSearch(''); }}
                        className="w-full text-left px-4 py-3 hover:bg-orange-50 text-sm border-b border-slate-50 last:border-0 flex items-center justify-between transition-colors">
                        <div>
                          <div className="font-semibold text-slate-800">{c.name}</div>
                          <div className="text-xs text-slate-400">{c.phone}</div>
                        </div>
                        <ChevronRight size={14} className="text-slate-300" />
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Método de pago */}
        <select
          value={paymentMethod}
          onChange={(e) => setPaymentMethod(e.target.value)}
          className="w-full px-3 py-2.5 border border-slate-200 rounded-xl bg-white text-sm font-semibold text-slate-700 outline-none focus:border-orange-400 transition-colors cursor-pointer"
        >
          <option value="unspecified">❓ A definir</option>
          <option value="cash">💵 Efectivo</option>
          <option value="transfer">🏦 Transferencia</option>
        </select>

        {/* Total */}
        <div className="flex justify-between items-center py-1">
          <span className="text-sm font-semibold text-slate-500">Total</span>
          <span className="text-2xl font-black text-slate-900 tracking-tight">${cartTotal.toLocaleString()}</span>
        </div>

        {/* Botón cobrar */}
        <button
          onClick={handleCheckout}
          disabled={cart.length === 0}
          className={`w-full py-4 rounded-2xl font-black text-base tracking-wide transition-all ${
            cart.length > 0
              ? 'btn-accent'
              : 'bg-slate-100 text-slate-300 cursor-not-allowed'
          }`}
        >
          {cart.length > 0 ? `Confirmar pedido · $${cartTotal.toLocaleString()}` : 'Carrito vacío'}
        </button>
      </div>
    </div>
  );
});

export default Cart;
