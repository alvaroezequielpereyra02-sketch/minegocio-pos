import React from 'react';
import {
  Store, LayoutDashboard, Package, Users, History,
  TrendingUp, LogOut, ClipboardList, Truck, Download
} from 'lucide-react';

// ── NavButton móvil ───────────────────────────────────────────────────────────
function NavButton({ active, onClick, icon, label, badge }) {
  return (
    <button
      onClick={onClick}
      className={`relative flex flex-col items-center justify-center w-full h-full min-w-[72px] px-1 transition-all active:scale-95 ${
        active ? 'text-orange-500' : 'text-white/40 hover:text-white/70'
      }`}
    >
      {/* Indicador activo — arriba */}
      {active && (
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-8 h-0.5 bg-orange-500 rounded-full" />
      )}

      <div className="relative mb-1.5">
        {icon}
        {badge > 0 && (
          <span className="absolute -top-2 -right-2 bg-orange-500 text-white text-[9px] font-black w-4 h-4 rounded-full flex items-center justify-center border-2 border-gray-900">
            {badge > 9 ? '9+' : badge}
          </span>
        )}
      </div>

      <span className={`text-[11px] font-bold leading-none tracking-wide ${active ? 'text-orange-500' : 'text-white/40'}`}>
        {label}
      </span>
    </button>
  );
}

// ── Sidebar desktop ───────────────────────────────────────────────────────────
export default function Sidebar({
  user, userData, storeProfile, activeTab, setActiveTab,
  onLogout, onEditStore, supportsPWA, installApp, pendingCount
}) {
  if (!userData) return null;

  const navItems = [
    { id: 'pos',          icon: <LayoutDashboard size={28} />, label: 'Vender',     adminOnly: false },
    { id: 'orders',       icon: <ClipboardList   size={28} />, label: 'Pedidos',    adminOnly: true, badge: pendingCount },
    { id: 'delivery',     icon: <Truck           size={28} />, label: 'Reparto',    adminOnly: true },
    { id: 'inventory',    icon: <Package         size={28} />, label: 'Inventario', adminOnly: true },
    { id: 'customers',    icon: <Users           size={28} />, label: 'Clientes',   adminOnly: true },
    { id: 'dashboard',    icon: <TrendingUp      size={28} />, label: 'Balance',    adminOnly: true },
    { id: 'transactions', icon: <History         size={28} />, label: 'Historial',  adminOnly: false },
  ].filter(item => !item.adminOnly || userData.role === 'admin');

  return (
    <div
      className="hidden lg:flex flex-col w-72 shrink-0 overflow-hidden"
      style={{ background: 'var(--sidebar-bg)', paddingTop: 'env(safe-area-inset-top, 0px)' }}
    >
      {/* Store header — logo y nombre grandes */}
      <button
        onClick={() => userData.role === 'admin' && onEditStore?.()}
        className="w-full text-left px-5 py-6 flex items-center gap-4 border-b border-white/10 hover:bg-white/5 transition-colors"
        title="Editar Perfil"
      >
        <div className="w-14 h-14 rounded-2xl overflow-hidden shrink-0 ring-2 ring-orange-500/40 flex items-center justify-center bg-orange-500/20">
          {storeProfile.logoUrl
            ? <img src={storeProfile.logoUrl} className="w-full h-full object-cover" alt="Logo" />
            : <Store size={26} className="text-orange-400" />}
        </div>
        <div className="overflow-hidden">
          <div className="text-white font-black text-base leading-tight truncate">{storeProfile.name}</div>
          <div className="text-white/40 text-sm mt-0.5">Sistema POS</div>
        </div>
      </button>

      {/* Nav items */}
      <nav className="flex-1 overflow-y-auto px-2.5 py-4 space-y-1">
        {navItems.map(item => (
          <button
            key={item.id}
            onClick={() => setActiveTab(item.id)}
            className={`sidebar-nav-item-lg ${activeTab === item.id ? 'active' : ''}`}
          >
            {item.icon}
            <span>{item.label}</span>
            {item.badge > 0 && (
              <span className="ml-auto bg-orange-500 text-white text-xs font-black px-2.5 py-0.5 rounded-full">
                {item.badge}
              </span>
            )}
          </button>
        ))}
      </nav>

      {/* Footer */}
      <div
        className="px-4 py-4 border-t border-white/10 space-y-3"
        style={{ paddingBottom: 'max(env(safe-area-inset-bottom, 0px), 1rem)' }}
      >
        {supportsPWA && (
          <button
            onClick={installApp}
            className="w-full py-3 btn-accent rounded-xl flex items-center justify-center gap-2 text-base font-bold"
          >
            <Download size={20} /> Instalar App
          </button>
        )}

        <div className="flex items-center gap-3 px-1">
          <div className="w-10 h-10 rounded-full bg-orange-500/20 ring-1 ring-orange-500/40 flex items-center justify-center text-orange-400 font-black text-base shrink-0">
            {userData.name.charAt(0).toUpperCase()}
          </div>
          <div className="flex-1 overflow-hidden">
            <div className="text-white/90 text-sm font-semibold truncate">{userData.name}</div>
            <div className="text-white/30 text-xs">{userData.role === 'admin' ? 'Administrador' : 'Cliente'}</div>
          </div>
          <button
            onClick={onLogout}
            className="p-2 text-white/30 hover:text-red-400 hover:bg-white/5 rounded-lg transition-colors"
            title="Salir"
          >
            <LogOut size={20} />
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Nav móvil ─────────────────────────────────────────────────────────────────
export function MobileNav({
  activeTab, setActiveTab, userData,
  onLogout, supportsPWA, installApp, pendingCount
}) {
  return (
    // ✅ Un solo objeto style — el doble style en JSX descarta el primero
    <nav
      className="lg:hidden fixed bottom-0 left-0 right-0 z-[50] flex"
      style={{
        height: 'calc(5rem + env(safe-area-inset-bottom, 0px))',
        paddingBottom: 'env(safe-area-inset-bottom, 0px)',
        background: 'var(--sidebar-bg)',
        borderTop: '1px solid rgba(255,255,255,0.08)'
      }}
    >
      <div className="flex items-start pt-2.5 h-full overflow-x-auto no-scrollbar flex-1">
        <NavButton active={activeTab === 'pos'} onClick={() => setActiveTab('pos')} icon={<LayoutDashboard size={28} />} label="Vender" />

        {userData.role === 'admin' && (
          <NavButton active={activeTab === 'orders'} onClick={() => setActiveTab('orders')} icon={<ClipboardList size={28} />} label="Pedidos" badge={pendingCount} />
        )}
        {userData.role === 'admin' && (
          <NavButton active={activeTab === 'delivery'} onClick={() => setActiveTab('delivery')} icon={<Truck size={28} />} label="Reparto" />
        )}

        <NavButton active={activeTab === 'transactions'} onClick={() => setActiveTab('transactions')} icon={<History size={28} />} label="Historial" />

        {userData.role === 'admin' && (
          <NavButton active={activeTab === 'inventory'} onClick={() => setActiveTab('inventory')} icon={<Package size={28} />} label="Stock" />
        )}
        {userData.role === 'admin' && (
          <NavButton active={activeTab === 'customers'} onClick={() => setActiveTab('customers')} icon={<Users size={28} />} label="Clientes" />
        )}
        {userData.role === 'admin' && (
          <NavButton active={activeTab === 'dashboard'} onClick={() => setActiveTab('dashboard')} icon={<TrendingUp size={28} />} label="Balance" />
        )}
      </div>

      {supportsPWA && (
        <button onClick={installApp} className="h-full px-3 flex flex-col items-center justify-center border-l border-white/10 text-orange-400 shrink-0">
          <Download size={24} />
          <span className="text-[10px] font-bold uppercase mt-1 tracking-wide">App</span>
        </button>
      )}
    </nav>
  );
}
