import React from 'react';
import { ShoppingCart, X, Minus, Plus, Trash2, Search } from 'lucide-react';

export default function Cart({ 
  cart, 
  updateCartQty, 
  removeFromCart, 
  setCartItemQty, 
  userData, 
  selectedCustomer, 
  setSelectedCustomer, 
  customerSearch, 
  setCustomerSearch, 
  customers, 
  paymentMethod, 
  setPaymentMethod, 
  cartTotal, 
  handleCheckout, 
  setShowMobileCart 
}) {
  return (
    <div className="bg-white h-full flex flex-col">
        {/* HEADER */}
        <div className="p-4 border-b bg-slate-50 font-bold text-slate-700 flex justify-between items-center shadow-sm z-10">
          <span className="flex gap-2 items-center text-lg">
            <ShoppingCart className="w-5 h-5 text-blue-600" /> Compra
          </span>
          <button onClick={() => setShowMobileCart(false)} className="lg:hidden p-1 bg-slate-200 rounded-full hover:bg-slate-300 transition-colors">
            <X size={20}/>
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {cart.map(item => (
            <div key={item.id} className="flex items-center gap-3 border-b border-slate-100 pb-3 last:border-0">
              <div className="flex-1 min-w-0">
                <div className="font-bold text-slate-800 text-sm truncate">{item.name}</div>
                <div className="text-xs text-slate-500 font-medium mt-0.5">${item.price} x unidad</div>
              </div>
              
              {/* CANTIDAD EDITABLE */} {/* CANTIDAD EDITABLE */}
              <div className="flex items-center bg-slate-50 rounded-lg border border-slate-200 overflow-hidden">
                <button onClick={() => updateCartQty(item.id, -1)} className="w-8 h-8 flex items-center justify-center hover:bg-slate-200 active:bg-slate-300 text-slate-600 transition-colors border-r border-slate-200">
                  <Minus className="w-3 h-3"/>
                </button>
                <input 
                  type="number"
                  min="1"
                  value={item.qty}
                  onChange={(e) => setCartItemQty(item.id, e.target.value)}
                  className="w-10 h-8 text-center text-sm font-bold bg-transparent outline-none appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                />
                <button onClick={() => updateCartQty(item.id, 1)} className="w-8 h-8 flex items-center justify-center hover:bg-slate-200 active:bg-slate-300 text-slate-600 transition-colors border-l border-slate-200">
                  <Plus className="w-3 h-3"/>
                </button>
              </div>

              <button onClick={() => removeFromCart(item.id)} className="text-slate-300 hover:text-red-500 transition-colors p-1">
                <Trash2 className="w-4 h-4"/>
              </button>
            </div>
          ))}
          
          {cart.length === 0 && (
            <div className="flex flex-col items-center justify-center h-full text-slate-400 space-y-2 opacity-50">
              <ShoppingCart size={48} />
              <p>El carrito está vacío</p>
            </div>
          )}
        </div>

        <div className="p-4 bg-slate-50 border-t space-y-4 z-10 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)]">
            {/* SECCIÓN CLIENTE */}
            {userData.role === 'admin' && (
              <div className="relative">
                {selectedCustomer ? (
                  <div className="flex items-center justify-between bg-blue-50 p-3 rounded-lg border border-blue-200 shadow-sm">
                    <div>
                      <div className="text-sm font-bold text-blue-800">{selectedCustomer.name}</div>
                      <div className="text-xs text-blue-600">{selectedCustomer.phone}</div>
                    </div>
                    <button onClick={()=>setSelectedCustomer(null)} className="text-blue-400 hover:text-blue-600 bg-white p-1 rounded-full"><X size={14}/></button>
                  </div>
                ) : (
                  <div>
                    {/* BÚSQUEDA DE CLIENTE MEJORADA */}
                    <div className="flex items-center gap-2 border border-slate-300 rounded-xl p-3 bg-white transition-all duration-200 focus-within:border-blue-600 focus-within:ring-1 focus-within:ring-blue-600 focus-within:shadow-md">
                      <Search size={18} className="text-slate-400 shrink-0"/>
                      <input 
                        className="w-full text-sm outline-none bg-transparent placeholder:text-slate-400 border-none focus:ring-0 p-0" 
                        placeholder="Buscar cliente..." 
                        value={customerSearch} 
                        onChange={(e) => setCustomerSearch(e.target.value)}
                      />
                    </div>
                    
                    {customerSearch && (
                      <div className="absolute left-0 right-0 bottom-full mb-1 bg-white border rounded-lg shadow-xl max-h-48 overflow-y-auto z-50">
                        {customers.filter(c => c.name.toLowerCase().includes(customerSearch.toLowerCase())).map(c => (
                          <button key={c.id} onClick={()=>{setSelectedCustomer(c); setCustomerSearch('');}} className="w-full text-left p-3 hover:bg-blue-50 text-sm border-b last:border-0 transition-colors">
                            <div className="font-bold text-slate-800">{c.name}</div>
                            <div className="text-xs text-slate-500">{c.phone}</div>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
            
            <div className="space-y-3">
              <div className="flex gap-2">
                  <select value={paymentMethod} onChange={(e) => setPaymentMethod(e.target.value)} className="w-full p-3 border border-slate-300 rounded-xl bg-white text-sm font-bold text-slate-700 outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-600 cursor-pointer transition-colors">
                      <option value="cash">💵 Efectivo</option>
                      <option value="transfer">🏦 Transferencia</option>
                  </select>
              </div>

              <div className="flex justify-between items-end border-t pt-3">
                <span className="font-bold text-slate-600 text-lg">Total</span>
                <span className="text-2xl font-extrabold text-slate-900 tracking-tight">${cartTotal.toLocaleString()}</span>
              </div>
              
              <button 
                onClick={handleCheckout} 
                disabled={cart.length === 0}
                className={`w-full py-3.5 rounded-xl font-bold text-lg shadow-lg transition-all transform active:scale-[0.98] ${
                  cart.length > 0 
                  ? 'bg-blue-600 text-white hover:bg-blue-700 hover:shadow-blue-200' 
                  : 'bg-slate-300 text-slate-500 cursor-not-allowed'
                }`}
              >
                Cobrar
              </button>
            </div>
        </div>
    </div>
  );
}

