import React from 'react';
import {
  Store, LayoutDashboard, Package, Users, History,
  TrendingUp, LogOut, ClipboardList, Truck, Download
} from 'lucide-react';

function NavButton({ active, onClick, icon, label, badge }) {
  return (
    <button
      onClick={onClick}
      className={`relative flex flex-col items-center justify-center w-full h-full min-w-[58px] px-0.5 transition-all active:scale-95 ${
        active ? 'text-orange-500' : 'text-white/35 hover:text-white/70'
      }`}
    >
      {active && <div className="absolute top-0 left-1/2 -translate-x-1/2 w-7 h-0.5 bg-orange-500 rounded-full" />}
      <div className="relative mb-1">
        {icon}
        {badge > 0 && (
          <span className="absolute -top-1.5 -right-2 bg-orange-500 text-white text-[9px] font-black w-4 h-4 rounded-full flex items-center justify-center border-2 border-gray-900">
            {badge > 9 ? '9+' : badge}
          </span>
        )}
      </div>
      <span className={`text-[10px] font-bold leading-none tracking-wide ${active ? 'text-orange-500' : 'text-white/35'}`}>
        {label}
      </span>
    </button>
  );
}

export default function Sidebar({
  user, userData, storeProfile, activeTab, setActiveTab,
  onLogout, onEditStore, supportsPWA, installApp, pendingCount
}) {
  if (!userData) return null;

  const navItems = [
    { id: 'pos', icon: <LayoutDashboard size={20} />, label: 'Vender', adminOnly: false },
    { id: 'orders', icon: <ClipboardList size={20} />, label: 'Pedidos', adminOnly: true, badge: pendingCount },
    { id: 'delivery', icon: <Truck size={20} />, label: 'Reparto', adminOnly: true },
    { id: 'inventory', icon: <Package size={20} />, label: 'Inventario', adminOnly: true },
    { id: 'customers', icon: <Users size={20} />, label: 'Clientes', adminOnly: true },
    { id: 'dashboard', icon: <TrendingUp size={20} />, label: 'Balance', adminOnly: true },
    { id: 'transactions', icon: <History size={20} />, label: 'Historial', adminOnly: false },
  ].filter(item => !item.adminOnly || userData.role === 'admin');

  return (
    <div className="hidden lg:flex flex-col w-60 shrink-0 overflow-hidden" style={{ background: 'var(--sidebar-bg)', paddingTop: 'env(safe-area-inset-top, 0px)' }}>

      {/* Store header */}
      <button
        onClick={() => userData.role === 'admin' && onEditStore && onEditStore()}
        className="w-full text-left px-4 py-5 flex items-center gap-3 border-b border-white/10 hover:bg-white/5 transition-colors"
        title="Editar Perfil"
      >
        <div className="w-9 h-9 rounded-xl overflow-hidden shrink-0 ring-2 ring-orange-500/40 flex items-center justify-center bg-orange-500/20">
          {storeProfile.logoUrl
            ? <img src={storeProfile.logoUrl} className="w-full h-full object-cover" alt="Logo" />
            : <Store size={20} className="text-orange-400" />}
        </div>
        <div className="overflow-hidden">
          <div className="text-white font-bold text-sm truncate">{storeProfile.name}</div>
          <div className="text-white/40 text-xs">Sistema POS</div>
        </div>
      </button>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto px-2 py-3 space-y-0.5">
        {navItems.map(item => (
          <button
            key={item.id}
            onClick={() => setActiveTab(item.id)}
            className={`sidebar-nav-item ${activeTab === item.id ? 'active' : ''}`}
          >
            {item.icon}
            <span>{item.label}</span>
            {item.badge > 0 && (
              <span className="ml-auto bg-orange-500 text-white text-[10px] font-black px-2 py-0.5 rounded-full">
                {item.badge}
              </span>
            )}
          </button>
        ))}
      </nav>

      {/* Footer */}
      <div className="px-3 py-4 border-t border-white/10 space-y-3">
        {supportsPWA && (
          <button
            onClick={installApp}
            className="w-full py-2.5 btn-accent rounded-xl flex items-center justify-center gap-2 text-sm"
          >
            <Download size={16} /> Instalar App
          </button>
        )}

        <div className="flex items-center gap-3 px-1">
          <div className="w-8 h-8 rounded-full bg-orange-500/20 ring-1 ring-orange-500/40 flex items-center justify-center text-orange-400 font-bold text-sm shrink-0">
            {userData.name.charAt(0).toUpperCase()}
          </div>
          <div className="flex-1 overflow-hidden">
            <div className="text-white/90 text-sm font-semibold truncate">{userData.name}</div>
            <div className="text-white/30 text-xs">{userData.role === 'admin' ? 'Administrador' : 'Cliente'}</div>
          </div>
          <button
            onClick={onLogout}
            className="p-1.5 text-white/30 hover:text-red-400 hover:bg-white/5 rounded-lg transition-colors"
            title="Salir"
          >
            <LogOut size={16} />
          </button>
        </div>
      </div>
    </div>
  );
}

// NAV MÓVIL
export function MobileNav({
  activeTab, setActiveTab, userData,
  onLogout, supportsPWA, installApp, pendingCount
}) {
  return (
    <nav className="lg:hidden fixed bottom-0 left-0 right-0 z-[50] flex" style={{
        height: 'calc(4.5rem + env(safe-area-inset-bottom, 0px))',
        paddingBottom: 'env(safe-area-inset-bottom, 0px)',
        background: 'var(--sidebar-bg)',
        borderTop: '1px solid rgba(255,255,255,0.08)'
      }}>
      <div className="flex items-start pt-2 h-full overflow-x-auto px-1 gap-0 no-scrollbar flex-1">
        <NavButton active={activeTab === 'pos'} onClick={() => setActiveTab('pos')} icon={<LayoutDashboard size={26} />} label="Vender" />

        {userData.role === 'admin' && (
          <NavButton active={activeTab === 'orders'} onClick={() => setActiveTab('orders')} icon={<ClipboardList size={26} />} label="Pedidos" badge={pendingCount} />
        )}

        {userData.role === 'admin' && <NavButton active={activeTab === 'delivery'} onClick={() => setActiveTab('delivery')} icon={<Truck size={26} />} label="Reparto" />}

        <NavButton active={activeTab === 'transactions'} onClick={() => setActiveTab('transactions')} icon={<History size={26} />} label="Historial" />

        {userData.role === 'admin' && <NavButton active={activeTab === 'inventory'} onClick={() => setActiveTab('inventory')} icon={<Package size={26} />} label="Stock" />}
        {userData.role === 'admin' && <NavButton active={activeTab === 'customers'} onClick={() => setActiveTab('customers')} icon={<Users size={26} />} label="Clientes" />}
        {userData.role === 'admin' && <NavButton active={activeTab === 'dashboard'} onClick={() => setActiveTab('dashboard')} icon={<TrendingUp size={26} />} label="Balance" />}
      </div>

      {supportsPWA && (
        <button onClick={installApp} className="h-full px-3 flex flex-col items-center justify-center border-l border-white/10 text-orange-400">
          <Download size={20} />
          <span className="text-[9px] font-bold uppercase mt-1 tracking-wide">App</span>
        </button>
      )}
    </nav>
  );
}
