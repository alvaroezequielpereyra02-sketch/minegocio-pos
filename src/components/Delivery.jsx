import React, { useState, useMemo, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useTransactionsContext } from '../context/TransactionsContext';
import { useInventoryContext } from '../context/InventoryContext';
import {
    Clock, MapPin, Phone, CheckCircle, Truck, XCircle,
    ShoppingBag, Navigation, Map, Package, Search,
    ArrowLeft, Plus, Minus, Save, Trash2, CheckSquare,
    ChevronRight, Edit3, ExternalLink
} from 'lucide-react';

// ─── Modal GPS: elegir app de navegación ────────────────────────────────────
function GpsModal({ address, name, onClose }) {
    if (!address) return null;

    const encodedAddress = encodeURIComponent(address);

    const openGoogleMaps = () => {
        window.open(`https://www.google.com/maps/dir/?api=1&destination=${encodedAddress}`, '_blank');
    };
    const openWaze = () => {
        window.open(`https://waze.com/ul?q=${encodedAddress}&navigate=yes`, '_blank');
    };
    const openAppleMaps = () => {
        window.open(`https://maps.apple.com/?daddr=${encodedAddress}`, '_blank');
    };

    return createPortal(
        <div className="fixed inset-0 z-[30000] bg-black/60 flex items-end justify-center p-4 animate-in fade-in" onClick={onClose}>
            <div className="bg-white w-full max-w-sm rounded-2xl overflow-hidden shadow-2xl animate-in slide-in-from-bottom-4" onClick={e => e.stopPropagation()}>
                <div className="p-5 border-b">
                    <div className="flex items-center gap-3 mb-1">
                        <MapPin size={20} className="text-indigo-600 shrink-0" />
                        <div>
                            <p className="font-bold text-slate-800 text-sm">{name}</p>
                            <p className="text-xs text-slate-500 mt-0.5 leading-snug">{address}</p>
                        </div>
                    </div>
                </div>
                <div className="p-4 space-y-2">
                    <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">Abrir con...</p>

                    <button
                        onClick={openGoogleMaps}
                        className="w-full flex items-center gap-3 p-4 bg-white border-2 border-slate-100 rounded-xl hover:border-orange-300 hover:bg-orange-50 transition-all active:scale-[0.98]"
                    >
                        <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 bg-orange-500">
                            <Map size={20} className="text-white" />
                        </div>
                        <div className="text-left">
                            <p className="font-bold text-slate-800 text-sm">Google Maps</p>
                            <p className="text-xs text-slate-400">Navegación con tráfico en tiempo real</p>
                        </div>
                        <ExternalLink size={14} className="ml-auto text-slate-300" />
                    </button>

                    <button
                        onClick={openWaze}
                        className="w-full flex items-center gap-3 p-4 bg-white border-2 border-slate-100 rounded-xl hover:border-cyan-300 hover:bg-cyan-50 transition-all active:scale-[0.98]"
                    >
                        <div className="w-10 h-10 rounded-xl bg-cyan-500 flex items-center justify-center shrink-0">
                            <Navigation size={20} className="text-white" />
                        </div>
                        <div className="text-left">
                            <p className="font-bold text-slate-800 text-sm">Waze</p>
                            <p className="text-xs text-slate-400">Rutas con reportes de la comunidad</p>
                        </div>
                        <ExternalLink size={14} className="ml-auto text-slate-300" />
                    </button>

                    <button
                        onClick={openAppleMaps}
                        className="w-full flex items-center gap-3 p-4 bg-white border-2 border-slate-100 rounded-xl hover:border-slate-300 hover:bg-slate-50 transition-all active:scale-[0.98]"
                    >
                        <div className="w-10 h-10 rounded-xl bg-slate-800 flex items-center justify-center shrink-0">
                            <Map size={20} className="text-white" />
                        </div>
                        <div className="text-left">
                            <p className="font-bold text-slate-800 text-sm">Apple Maps</p>
                            <p className="text-xs text-slate-400">Solo disponible en iPhone / iPad</p>
                        </div>
                        <ExternalLink size={14} className="ml-auto text-slate-300" />
                    </button>
                </div>
                <div className="p-4 pt-0">
                    <button onClick={onClose} className="w-full py-3 text-slate-500 font-bold text-sm hover:bg-slate-50 rounded-xl transition-colors">
                        Cancelar
                    </button>
                </div>
            </div>
        </div>,
        document.body
    );
}

// ─── Modal editar boleta (desde Reparto) ────────────────────────────────────
function EditOrderModal({ order, onClose }) {
    const { updateTransaction } = useTransactionsContext();
    const { products } = useInventoryContext();

    const [localItems, setLocalItems] = useState(order.items || []);
    const [searchTerm, setSearchTerm]       = useState('');
    const [searchResults, setSearchResults] = useState([]);
    const [isSaving, setIsSaving]           = useState(false);

    useEffect(() => { setLocalItems(order.items || []); }, [order]);

    useEffect(() => {
        if (searchTerm.length < 2) { setSearchResults([]); return; }
        const lower = searchTerm.toLowerCase();
        setSearchResults(
            products.filter(p =>
                p.name.toLowerCase().includes(lower) ||
                (p.barcode && p.barcode.includes(lower))
            ).slice(0, 5)
        );
    }, [searchTerm, products]);

    const handleQtyChange = (idx, delta) => {
        setLocalItems(prev => prev.map((item, i) => {
            if (i !== idx) return item;
            const newQty = Math.max(1, item.qty + delta);
            return { ...item, qty: newQty };
        }));
    };

    const handleAddProduct = (product) => {
        setLocalItems(prev => {
            const exists = prev.findIndex(i => i.id === product.id);
            if (exists >= 0) {
                return prev.map((item, i) => i === exists ? { ...item, qty: item.qty + 1 } : item);
            }
            return [...prev, { id: product.id, name: product.name, price: product.price, cost: product.cost || 0, qty: 1 }];
        });
        setSearchTerm('');
        setSearchResults([]);
    };

    const handleRemoveItem = (idx) => {
        setLocalItems(prev => prev.filter((_, i) => i !== idx));
    };

    const handleSave = async () => {
        if (localItems.length === 0) return;
        setIsSaving(true);
        try {
            const newTotal = localItems.reduce((acc, i) => acc + (i.price * i.qty), 0);
            await updateTransaction(order.id, {
                items: localItems,
                total: newTotal,
                amountPaid: order.paymentStatus === 'paid' ? newTotal : (order.amountPaid || 0),
            });
            onClose();
        } catch (e) {
            console.error('Error guardando boleta:', e);
        } finally {
            setIsSaving(false);
        }
    };

    const newTotal = localItems.reduce((acc, i) => acc + (i.price * i.qty), 0);

    return createPortal(
        <div className="fixed inset-0 z-[25000] bg-slate-900/50 backdrop-blur-sm flex justify-center items-end sm:items-center animate-in fade-in">
            <div className="w-full h-[90vh] sm:max-w-lg sm:h-[85vh] bg-white sm:rounded-2xl rounded-t-2xl shadow-2xl flex flex-col overflow-hidden animate-in slide-in-from-bottom">

                {/* Header */}
                <div className="p-4 border-b flex items-center justify-between shrink-0">
                    <button onClick={onClose} className="p-2 -ml-2 rounded-full hover:bg-slate-100">
                        <ArrowLeft size={22} className="text-slate-600" />
                    </button>
                    <div className="text-center">
                        <h2 className="font-bold text-slate-800">Editar Boleta</h2>
                        <p className="text-xs text-slate-400">{order.clientName}</p>
                    </div>
                    <button
                        onClick={handleSave}
                        disabled={isSaving || localItems.length === 0}
                        className="btn-accent px-4 py-2 rounded-xl text-sm font-bold disabled:opacity-50 flex items-center gap-1.5"
                    >
                        {isSaving ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <Save size={15} />}
                        Guardar
                    </button>
                </div>

                {/* Buscador */}
                <div className="p-3 bg-slate-50 border-b relative shrink-0">
                    <div className="relative">
                        <Search className="absolute left-3 top-2.5 text-slate-400 w-4 h-4" />
                        <input
                            className="w-full pl-9 pr-4 py-2 text-sm border border-slate-300 rounded-xl outline-none focus:ring-2 focus:ring-orange-400 bg-white"
                            placeholder="Buscar producto para agregar..."
                            value={searchTerm}
                            onChange={e => setSearchTerm(e.target.value)}
                        />
                        {searchResults.length > 0 && (
                            <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-slate-200 rounded-xl shadow-xl z-10 max-h-48 overflow-y-auto">
                                {searchResults.map(p => (
                                    <button
                                        key={p.id}
                                        onClick={() => handleAddProduct(p)}
                                        className="w-full text-left p-3 hover:bg-orange-50 flex justify-between items-center border-b last:border-0"
                                    >
                                        <div>
                                            <div className="text-sm font-bold text-slate-800">{p.name}</div>
                                            <div className="text-xs text-slate-400">${p.price?.toLocaleString()}</div>
                                        </div>
                                        <div className="text-xs font-bold text-orange-500 flex items-center gap-1">
                                            <Plus size={12} /> Agregar
                                        </div>
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>
                </div>

                {/* Lista de items */}
                <div className="flex-1 overflow-y-auto p-4 space-y-2">
                    {localItems.map((item, idx) => (
                        <div key={idx} className="bg-white border border-slate-200 rounded-xl p-3 flex items-center gap-3 shadow-sm">
                            <div className="flex-1 min-w-0">
                                <p className="font-bold text-slate-800 text-sm truncate">{item.name}</p>
                                <p className="text-xs text-slate-400">${item.price?.toLocaleString()} c/u</p>
                            </div>

                            {/* Controles de cantidad */}
                            <div className="flex items-center gap-1 bg-slate-100 rounded-xl overflow-hidden">
                                <button onClick={() => handleQtyChange(idx, -1)} className="w-9 h-9 flex items-center justify-center hover:bg-slate-200 active:scale-90 transition-all">
                                    <Minus size={14} />
                                </button>
                                <span className="w-8 text-center font-bold text-slate-800 text-sm">{item.qty}</span>
                                <button onClick={() => handleQtyChange(idx, +1)} className="w-9 h-9 flex items-center justify-center hover:bg-slate-200 active:scale-90 transition-all">
                                    <Plus size={14} />
                                </button>
                            </div>

                            <div className="text-right shrink-0 w-16">
                                <p className="font-bold text-slate-800 text-sm">${(item.price * item.qty).toLocaleString()}</p>
                            </div>

                            <button onClick={() => handleRemoveItem(idx)} className="p-2 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors">
                                <Trash2 size={15} />
                            </button>
                        </div>
                    ))}

                    {localItems.length === 0 && (
                        <div className="text-center py-12 text-slate-300">
                            <Package size={40} className="mx-auto mb-2" />
                            <p className="text-sm">Sin productos</p>
                        </div>
                    )}
                </div>

                {/* Footer con total */}
                <div className="p-4 border-t bg-slate-50 shrink-0">
                    <div className="flex justify-between items-center">
                        <span className="text-slate-500 font-medium text-sm">Total actualizado</span>
                        <span className="text-2xl font-black text-slate-800">${newTotal.toLocaleString()}</span>
                    </div>
                </div>
            </div>
        </div>,
        document.body
    );
}

// ─── Tarjeta de pedido ───────────────────────────────────────────────────────
function DeliveryCard({ order, onStatusUpdate, onEdit }) {
    const [showGps, setShowGps] = useState(false);

    const address = order.clientInfo?.address;
    const phone   = order.clientInfo?.phone;
    const name    = order.clientInfo?.name || order.clientName;

    const statusConfig = {
        pending:    { label: 'Pendiente',   color: 'bg-yellow-100 text-yellow-800 border-yellow-200' },
        preparing:  { label: 'Preparando',  color: 'bg-orange-100 text-orange-800 border-orange-200' },
        ready:      { label: 'Listo',       color: 'bg-emerald-100 text-emerald-800 border-emerald-200' },
        delivering: { label: 'En Camino',   color: 'bg-purple-100 text-purple-800 border-purple-200' },
        completed:  { label: 'Entregado',   color: 'bg-green-100 text-green-800 border-green-200' },
        cancelled:  { label: 'Cancelado',   color: 'bg-red-100 text-red-800 border-red-200' },
    };

    // El estado de display: usamos fulfillmentStatus si el pedido está armado,
    // si no, el status de delivery
    const displayStatus = order.fulfillmentStatus === 'ready' && order.status !== 'delivering' && order.status !== 'completed'
        ? 'ready'
        : order.status;

    const cfg = statusConfig[displayStatus] || statusConfig.pending;

    return (
        <>
            <div className="bg-white border-2 border-slate-100 rounded-2xl overflow-hidden hover:shadow-xl hover:border-indigo-100 transition-all flex flex-col">

                {/* Header de la tarjeta */}
                <div className="p-4 pb-3">
                    <div className="flex justify-between items-start gap-2">
                        <div className="min-w-0 flex-1">
                            <h3 className="font-black text-slate-800 text-lg truncate uppercase italic leading-tight">
                                {name}
                            </h3>
                            <div className="flex items-center text-xs font-bold text-slate-400 gap-1.5 mt-1">
                                <Clock size={12} />
                                {order.date?.seconds
                                    ? new Date(order.date.seconds * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                                    : 'Sincronizando...'}
                            </div>
                        </div>
                        <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider border shrink-0 ${cfg.color}`}>
                            {cfg.label}
                        </span>
                    </div>
                </div>

                {/* Dirección + GPS + Teléfono */}
                <div className="px-4 pb-3 space-y-2">
                    {address ? (
                        <button
                            onClick={() => setShowGps(true)}
                            className="w-full flex items-center gap-3 bg-indigo-50 hover:bg-indigo-100 border border-indigo-100 p-3 rounded-xl transition-all active:scale-[0.98] group"
                        >
                            <div className="w-8 h-8 bg-indigo-600 rounded-xl flex items-center justify-center shrink-0 shadow-sm shadow-indigo-200 group-hover:bg-indigo-700 transition-colors">
                                <Navigation size={16} className="text-white" />
                            </div>
                            <div className="text-left flex-1 min-w-0">
                                <p className="text-[11px] font-bold text-indigo-400 uppercase tracking-wider">Navegar</p>
                                <p className="text-sm font-bold text-indigo-800 truncate leading-snug">{address}</p>
                            </div>
                            <ExternalLink size={14} className="text-indigo-300 shrink-0" />
                        </button>
                    ) : (
                        <div className="flex items-center gap-3 bg-slate-50 p-3 rounded-xl border border-slate-100">
                            <MapPin size={16} className="text-slate-300 shrink-0" />
                            <span className="text-sm text-slate-400 italic">Retira en local / Sin dirección</span>
                        </div>
                    )}

                    {phone && (
                        <a
                            href={`tel:${phone}`}
                            className="flex items-center gap-3 px-3 py-2 bg-green-50 border border-green-100 rounded-xl hover:bg-green-100 transition-colors"
                        >
                            <Phone size={15} className="text-green-600 shrink-0" />
                            <span className="text-sm font-black text-green-700">{phone}</span>
                        </a>
                    )}
                </div>

                {/* Detalle de productos */}
                <div className="mx-4 mb-3 bg-slate-50 rounded-xl border border-slate-100 overflow-hidden">
                    <div className="px-3 py-2 bg-slate-100/50 flex justify-between items-center border-b border-slate-100">
                        <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Productos</span>
                        <span className="font-black text-slate-700 text-sm">${order.total?.toLocaleString()}</span>
                    </div>
                    <ul className="p-3 space-y-1.5 max-h-32 overflow-y-auto">
                        {order.items?.map((item, idx) => (
                            <li key={idx} className="flex justify-between items-center text-xs">
                                <span className="text-slate-500 font-bold truncate pr-4">
                                    <span className="text-indigo-600 font-black mr-1">{item.qty}x</span>
                                    {item.name}
                                </span>
                                <span className="text-slate-700 font-black shrink-0">
                                    ${(item.price * item.qty).toLocaleString()}
                                </span>
                            </li>
                        ))}
                    </ul>
                </div>

                {/* Acciones */}
                <div className="px-4 pb-4 space-y-2 mt-auto">
                    {/* Botón editar boleta */}
                    <button
                        onClick={onEdit}
                        className="w-full flex items-center justify-center gap-2 py-2.5 bg-slate-100 text-slate-600 rounded-xl text-xs font-bold hover:bg-slate-200 transition-colors border border-slate-200"
                    >
                        <Edit3 size={14} /> Editar Boleta
                    </button>

                    {/* Botones de avance de estado */}
                    {displayStatus === 'pending' && (
                        <button
                            onClick={() => onStatusUpdate(order.id, 'preparing')}
                            className="w-full py-3 rounded-xl font-black uppercase text-xs tracking-widest shadow-lg transition-all active:scale-95 btn-accent"
                        >
                            Empezar a Preparar
                        </button>
                    )}

                    {(displayStatus === 'preparing' || displayStatus === 'ready') && (
                        <button
                            onClick={() => onStatusUpdate(order.id, 'delivering')}
                            className="w-full bg-purple-600 text-white py-3 rounded-xl font-black uppercase text-xs tracking-widest hover:bg-purple-700 shadow-lg shadow-purple-100 transition-all active:scale-95"
                        >
                            🚚 Enviar con Repartidor
                        </button>
                    )}

                    {displayStatus === 'delivering' && (
                        <div className="grid grid-cols-2 gap-2">
                            <button
                                onClick={() => onStatusUpdate(order.id, 'completed')}
                                className="flex items-center justify-center gap-1.5 bg-green-600 text-white py-3 rounded-xl font-black uppercase text-xs tracking-widest hover:bg-green-700 shadow-lg shadow-green-100 transition-all active:scale-95"
                            >
                                <CheckCircle size={14} /> Entregado
                            </button>
                            <button
                                onClick={() => onStatusUpdate(order.id, 'cancelled')}
                                className="bg-red-50 text-red-600 py-3 rounded-xl font-black uppercase text-xs tracking-widest border-2 border-red-100 hover:bg-red-100 transition-all"
                            >
                                Cancelar
                            </button>
                        </div>
                    )}
                </div>
            </div>

            {showGps && address && (
                <GpsModal address={address} name={name} onClose={() => setShowGps(false)} />
            )}
        </>
    );
}

// ─── Componente principal ────────────────────────────────────────────────────
const Delivery = () => {
    const { transactions, updateTransaction } = useTransactionsContext();
    const [activeTab, setActiveTab]   = useState('active');
    const [editingOrder, setEditingOrder] = useState(null);

    // Un pedido es "de reparto" si tiene deliveryType = 'delivery'
    const allDelivery = useMemo(() =>
        transactions
            .filter(t => t.deliveryType === 'delivery')
            .sort((a, b) => (b.date?.seconds || 0) - (a.date?.seconds || 0)),
        [transactions]
    );

    // Tabs:
    // "active"    → pedidos activos (pending, preparing) y armados (fulfillmentStatus=ready)
    //               que todavía no salieron a entregar
    // "delivering" → en camino
    // "completed"  → historial
    const tabs = useMemo(() => ({
        active: allDelivery.filter(o =>
            ['pending', 'preparing'].includes(o.status) || 
            (o.fulfillmentStatus === 'ready' && o.status !== 'delivering' && o.status !== 'completed' && o.status !== 'cancelled')
        ),
        delivering: allDelivery.filter(o => o.status === 'delivering'),
        completed:  allDelivery.filter(o => ['completed', 'cancelled'].includes(o.status)),
    }), [allDelivery]);

    const handleStatusUpdate = async (orderId, newStatus) => {
        const order = transactions.find(t => t.id === orderId);
        if (!order) return;

        const updates = {
            status: newStatus,
            amountPaid: order.amountPaid ?? 0,
        };

        if (newStatus === 'completed') {
            updates.fulfillmentStatus = 'delivered';
            updates.paymentStatus     = order.paymentStatus === 'paid' ? 'paid' : order.paymentStatus;
        }
        if (newStatus === 'delivering') {
            updates.fulfillmentStatus = 'ready';
        }

        try {
            await updateTransaction(orderId, updates);
        } catch (error) {
            console.error("Error al actualizar:", error);
        }
    };

    const tabConfig = [
        { id: 'active',     label: 'Activos',    count: tabs.active.length },
        { id: 'delivering', label: 'En Camino',  count: tabs.delivering.length },
        { id: 'completed',  label: 'Historial',  count: tabs.completed.length },
    ];

    const currentOrders = tabs[activeTab] || [];

    return (
        <div className="bg-white rounded-lg shadow-sm h-full flex flex-col overflow-hidden">

            {/* Cabecera */}
            <div className="p-4 md:p-6 border-b shrink-0">
                <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2 mb-4">
                    <Truck className="text-indigo-600" size={24} />
                    Gestión de Reparto
                </h2>

                {/* Tabs */}
                <div className="flex gap-1 bg-slate-100 p-1 rounded-xl">
                    {tabConfig.map(tab => (
                        <button
                            key={tab.id}
                            onClick={() => setActiveTab(tab.id)}
                            className={`flex-1 py-2 px-3 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
                                activeTab === tab.id
                                    ? 'bg-white text-indigo-600 shadow-sm'
                                    : 'text-slate-500 hover:text-slate-700'
                            }`}
                        >
                            {tab.label}
                            {tab.count > 0 && (
                                <span className={`text-[10px] font-black w-5 h-5 rounded-full flex items-center justify-center ${
                                    activeTab === tab.id ? 'bg-indigo-600 text-white' : 'bg-slate-300 text-slate-600'
                                }`}>
                                    {tab.count}
                                </span>
                            )}
                        </button>
                    ))}
                </div>
            </div>

            {/* Lista de pedidos */}
            <div className="flex-1 overflow-y-auto p-4">
                {currentOrders.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-64 text-slate-300">
                        <ShoppingBag size={56} className="mb-3 opacity-40" />
                        <p className="text-base font-bold text-slate-400">
                            {activeTab === 'active'     && 'No hay pedidos activos'}
                            {activeTab === 'delivering' && 'Ningún pedido en camino'}
                            {activeTab === 'completed'  && 'Sin historial de envíos'}
                        </p>
                        {activeTab === 'active' && (
                            <p className="text-xs text-slate-300 mt-1 text-center max-w-xs">
                                Los pedidos confirmados en la sección "Pedidos" aparecerán aquí listos para despachar
                            </p>
                        )}
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                        {currentOrders.map(order => (
                            <DeliveryCard
                                key={order.id}
                                order={order}
                                onStatusUpdate={handleStatusUpdate}
                                onEdit={() => setEditingOrder(order)}
                            />
                        ))}
                    </div>
                )}
            </div>

            {/* Modal editar boleta */}
            {editingOrder && (
                <EditOrderModal
                    order={editingOrder}
                    onClose={() => setEditingOrder(null)}
                />
            )}
        </div>
    );
};

export default Delivery;
