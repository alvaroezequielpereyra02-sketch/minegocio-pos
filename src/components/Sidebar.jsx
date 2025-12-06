import React from 'react';
import { Store, LayoutDashboard, Package, Users, History, TrendingUp, LogOut, ClipboardList, Truck } from 'lucide-react';

function NavButton({ active, onClick, icon, label }) {
  return (
    <button onClick={onClick} className={`flex flex-col items-center justify-center w-full h-full min-w-[70px] px-1 ${active ? 'text-blue-600 scale-105' : 'text-slate-400 hover:text-slate-600'}`}>
      {icon} <span className="text-[10px] uppercase font-bold mt-1 truncate w-full text-center">{label}</span>
    </button>
  );
}

export default function Sidebar({ user, userData, storeProfile, activeTab, setActiveTab, onLogout, onEditStore }) {
  if (!userData) return null;

  return (
    <div className="hidden lg:flex flex-col w-64 bg-white border-r z-20 shrink-0">
      <button
        onClick={() => userData.role === 'admin' && onEditStore && onEditStore()}
        className="w-full text-left p-4 border-b flex items-center gap-2 font-bold text-xl text-slate-800 hover:bg-slate-50 transition-colors"
        title="Editar Perfil"
      >
        <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center text-white overflow-hidden">
          {storeProfile.logoUrl ? (
            <img src={storeProfile.logoUrl} className="w-full h-full object-cover" alt="Logo" />
          ) : (
            <Store size={18} />
          )}
        </div>
        <span className="truncate">{storeProfile.name}</span>
      </button>

      <nav className="flex-1 overflow-y-auto p-2 space-y-1">
        <button onClick={() => setActiveTab('pos')} className={`w-full text-left p-3 rounded-lg flex gap-3 items-center font-medium ${activeTab === 'pos' ? 'bg-blue-50 text-blue-700' : 'text-slate-600 hover:bg-slate-50'}`}>
          <LayoutDashboard size={20} /> Vender
        </button>

        {userData.role === 'admin' && (
          <>
            <button onClick={() => setActiveTab('orders')} className={`w-full text-left p-3 rounded-lg flex gap-3 items-center font-medium ${activeTab === 'orders' ? 'bg-blue-50 text-blue-700' : 'text-slate-600 hover:bg-slate-50'}`}>
              <ClipboardList size={20} /> Pedidos
            </button>

            <button onClick={() => setActiveTab('delivery')} className={`w-full text-left p-3 rounded-lg flex gap-3 items-center font-medium ${activeTab === 'delivery' ? 'bg-blue-50 text-blue-700' : 'text-slate-600 hover:bg-slate-50'}`}>
              <Truck size={20} /> Reparto
            </button>

            <button onClick={() => setActiveTab('inventory')} className={`w-full text-left p-3 rounded-lg flex gap-3 items-center font-medium ${activeTab === 'inventory' ? 'bg-blue-50 text-blue-700' : 'text-slate-600 hover:bg-slate-50'}`}>
              <Package size={20} /> Inventario
            </button>
            <button onClick={() => setActiveTab('customers')} className={`w-full text-left p-3 rounded-lg flex gap-3 items-center font-medium ${activeTab === 'customers' ? 'bg-blue-50 text-blue-700' : 'text-slate-600 hover:bg-slate-50'}`}>
              <Users size={20} /> Clientes
            </button>
            <button onClick={() => setActiveTab('dashboard')} className={`w-full text-left p-3 rounded-lg flex gap-3 items-center font-medium ${activeTab === 'dashboard' ? 'bg-blue-50 text-blue-700' : 'text-slate-600 hover:bg-slate-50'}`}>
              <TrendingUp size={20} /> Balance
            </button>
          </>
        )}

        <button onClick={() => setActiveTab('transactions')} className={`w-full text-left p-3 rounded-lg flex gap-3 items-center font-medium ${activeTab === 'transactions' ? 'bg-blue-50 text-blue-700' : 'text-slate-600 hover:bg-slate-50'}`}>
          <History size={20} /> Transacciones
        </button>
      </nav>

      <div className="p-4 border-t">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-8 h-8 rounded-full bg-slate-200 flex items-center justify-center text-slate-500 font-bold">
            {userData.name.charAt(0)}
          </div>
          <div className="overflow-hidden">
            <div className="text-sm font-bold truncate">{userData.name}</div>
            <div className="text-xs text-slate-500 capitalize">{userData.role === 'admin' ? 'Admin' : 'Cliente'}</div>
          </div>
        </div>
        <button onClick={onLogout} className="w-full p-2 border rounded-lg flex items-center justify-center gap-2 text-sm text-red-600 hover:bg-red-50">
          <LogOut size={16} /> Salir
        </button>
      </div>
    </div>
  );
}

// CORRECCIÓN DEFINITIVA: Estructura simple sin safe-area padding
export function MobileNav({ activeTab, setActiveTab, userData, onLogout }) {
  return (
    <div className="lg:hidden fixed bottom-0 left-0 right-0 z-[50] bg-white border-t border-slate-200 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.1)]">
      <nav className="flex items-center h-16 overflow-x-auto px-2 gap-1 no-scrollbar">
        <NavButton active={activeTab === 'pos'} onClick={() => setActiveTab('pos')} icon={<LayoutDashboard size={24} />} label="Vender" />

        {userData.role === 'admin' && <NavButton active={activeTab === 'orders'} onClick={() => setActiveTab('orders')} icon={<ClipboardList size={24} />} label="Pedidos" />}

        {userData.role === 'admin' && <NavButton active={activeTab === 'delivery'} onClick={() => setActiveTab('delivery')} icon={<Truck size={24} />} label="Reparto" />}

        <NavButton active={activeTab === 'transactions'} onClick={() => setActiveTab('transactions')} icon={<History size={24} />} label="Historial" />

        {userData.role === 'admin' && <NavButton active={activeTab === 'inventory'} onClick={() => setActiveTab('inventory')} icon={<Package size={24} />} label="Stock" />}
        {userData.role === 'admin' && <NavButton active={activeTab === 'customers'} onClick={() => setActiveTab('customers')} icon={<Users size={24} />} label="Clientes" />}
        {userData.role === 'admin' && <NavButton active={activeTab === 'dashboard'} onClick={() => setActiveTab('dashboard')} icon={<TrendingUp size={24} />} label="Balance" />}
      </nav>
    </div>
  );
}