import React from 'react';
import { Store, LayoutDashboard, Package, Users, History, TrendingUp, LogOut, ClipboardList, Truck, Download } from 'lucide-react';

function NavButton({ active, onClick, icon, label }) {
  return (
    <button onClick={onClick} className={`flex flex-col items-center justify-center w-full h-full min-w-[70px] px-1 ${active ? 'text-blue-600 scale-105' : 'text-slate-400 hover:text-slate-600'}`}>
      {icon} <span className="text-[10px] uppercase font-bold mt-1 truncate w-full text-center">{label}</span>
    </button>
  );
}

// Recibimos 'supportsPWA' e 'installApp'
export default function Sidebar({ user, userData, storeProfile, activeTab, setActiveTab, onLogout, onEditStore, supportsPWA, installApp }) {
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

      <div className="p-4 border-t space-y-2">
        {/* BOTÓN INSTALAR PWA (Solo aparece si es instalable) */}
        {supportsPWA && (
          <button
            onClick={installApp}
            className="w-full p-3 bg-blue-600 text-white rounded-xl flex items-center justify-center gap-2 text-sm font-bold shadow-md hover:bg-blue-700 active:scale-95 transition-all animate-in fade-in slide-in-from-bottom-2"
          >
            <Download size={18} /> Instalar App
          </button>
        )}

        <div className="flex items-center gap-3 pt-2">
          <div className="w-8 h-8 rounded-full bg-slate-200 flex items-center justify-center text-slate-500 font-bold shrink-0">
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

// NAV MÓVIL
export function MobileNav({ activeTab, setActiveTab, userData, onLogout, supportsPWA, installApp }) {
  return (
    <nav className="lg:hidden fixed bottom-0 left-0 right-0 h-20 bg-white border-t border-slate-200 z-[50] shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.1)] flex justify-between pr-2 pb-1">
      <div className="flex items-center h-full overflow-x-auto px-2 gap-1 no-scrollbar flex-1">
        <NavButton active={activeTab === 'pos'} onClick={() => setActiveTab('pos')} icon={<LayoutDashboard size={26} />} label="Vender" />

        {userData.role === 'admin' && <NavButton active={activeTab === 'orders'} onClick={() => setActiveTab('orders')} icon={<ClipboardList size={26} />} label="Pedidos" />}
        {userData.role === 'admin' && <NavButton active={activeTab === 'delivery'} onClick={() => setActiveTab('delivery')} icon={<Truck size={26} />} label="Reparto" />}

        <NavButton active={activeTab === 'transactions'} onClick={() => setActiveTab('transactions')} icon={<History size={26} />} label="Historial" />

        {userData.role === 'admin' && <NavButton active={activeTab === 'inventory'} onClick={() => setActiveTab('inventory')} icon={<Package size={26} />} label="Stock" />}
        {userData.role === 'admin' && <NavButton active={activeTab === 'customers'} onClick={() => setActiveTab('customers')} icon={<Users size={26} />} label="Clientes" />}
        {userData.role === 'admin' && <NavButton active={activeTab === 'dashboard'} onClick={() => setActiveTab('dashboard')} icon={<TrendingUp size={26} />} label="Balance" />}
      </div>

      {supportsPWA && (
        <button
          onClick={installApp}
          className="h-full px-4 bg-blue-50 text-blue-600 flex flex-col items-center justify-center border-l border-slate-100"
        >
          <Download size={22} />
          <span className="text-[9px] font-bold uppercase mt-1">App</span>
        </button>
      )}
    </nav>
  );
}