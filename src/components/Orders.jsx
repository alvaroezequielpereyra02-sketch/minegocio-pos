import React, { useState, useMemo, useEffect } from 'react';
import { createPortal } from 'react-dom';
import {
    Package, Search, Clock, CheckCircle, AlertTriangle,
    X, Plus, Minus, CheckSquare, Trash2, ArrowLeft,
    Save, Filter, ChevronRight
} from 'lucide-react';

import { useTransactionsContext } from '../context/TransactionsContext';
import { useInventoryContext } from '../context/InventoryContext';

function OrderWorkModal({ order, onClose }) {
    const { updateTransaction } = useTransactionsContext();
    const { products } = useInventoryContext();

    // ESTADO LOCAL (OPTIMISTA)
    const [localItems, setLocalItems] = useState(order.items || []);

    const [searchTerm, setSearchTerm] = useState('');
    const [searchResults, setSearchResults] = useState([]);
    const [editingItemIndex, setEditingItemIndex] = useState(null);
    const [manualQty, setManualQty] = useState(0);

    // Sincronizar estado local
    useEffect(() => {
        setLocalItems(order.items || []);
    }, [order]);

    // Buscador
    useEffect(() => {
        if (searchTerm.length < 2) { setSearchResults([]); return; }
        const lowerTerm = searchTerm.toLowerCase();
        const results = products.filter(p =>
            p.name.toLowerCase().includes(lowerTerm) ||
            (p.barcode && p.barcode.includes(lowerTerm))
        ).slice(0, 5);
        setSearchResults(results);
    }, [searchTerm, products]);

    // --- FUNCIONES DE ACCIÓN ---

    const syncChanges = async (newItems) => {
        setLocalItems(newItems);
        const newStatus = calculateNewStatus(newItems);
        const newTotal = newItems.reduce((acc, i) => acc + (i.price * i.qty), 0);

        await updateTransaction(order.id, {
            items: newItems,
            total: newTotal,
            fulfillmentStatus: newStatus
        });
    };

    const handleAddItem = (product) => {
        const newItems = [...localItems];
        const existingIndex = newItems.findIndex(i => i.id === product.id);

        if (existingIndex >= 0) {
            newItems[existingIndex] = {
                ...newItems[existingIndex],
                qty: newItems[existingIndex].qty + 1
            };
        } else {
            newItems.push({
                id: product.id,
                name: product.name,
                price: product.price,
                cost: product.cost || 0,
                qty: 1,
                packedQty: 0,
                packed: false,
                imageUrl: product.imageUrl
            });
        }
        syncChanges(newItems);
        setSearchTerm('');
    };

    const handleQuickToggle = (idx) => {
        const newItems = [...localItems];
        const item = newItems[idx];
        const currentPacked = item.packedQty || 0;

        // Toggle: Si tiene algo, a 0. Si está en 0, llenar todo.
        const nextQty = currentPacked > 0 ? 0 : item.qty;

        newItems[idx] = { ...item, packedQty: nextQty, packed: nextQty === item.qty };
        syncChanges(newItems);
    };

    const saveManualEdit = (idx) => {
        const newItems = [...localItems];
        const item = newItems[idx];
        const finalQty = Math.max(0, manualQty);

        newItems[idx] = { ...item, packedQty: finalQty, packed: finalQty === item.qty };
        syncChanges(newItems);
        setEditingItemIndex(null);
    };

    const handleDeleteItem = (idx) => {
        if (!window.confirm("¿Quitar este producto del pedido?")) return;
        const newItems = localItems.filter((_, i) => i !== idx);
        syncChanges(newItems);
    };

    const calculateNewStatus = (items) => {
        if (items.length === 0) return 'pending';
        const totalReq = items.reduce((acc, i) => acc + i.qty, 0);
        const totalPack = items.reduce((acc, i) => acc + (i.packedQty || 0), 0);
        if (totalPack === 0) return 'pending';
        if (totalPack >= totalReq) return 'ready';
        return 'partial';
    };

    const handleConfirmOrder = async () => {
        // Filtrar y limpiar para entrega final
        const finalItems = localItems.map(i => ({
            ...i,
            qty: i.packedQty || 0,
            packed: true
        })).filter(i => i.qty > 0);

        if (finalItems.length === 0) return;

        const finalTotal = finalItems.reduce((acc, i) => acc + (i.price * i.qty), 0);

        await updateTransaction(order.id, {
            items: finalItems,
            total: finalTotal,
            amountPaid: order.paymentStatus === 'paid' ? finalTotal : (order.amountPaid || 0),
            // fulfillmentStatus 'ready' → el pedido aparece en Reparto como "Listo para despachar"
            fulfillmentStatus: 'ready',
            // Aseguramos que deliveryType esté seteado para que Delivery lo filtre
            deliveryType: order.deliveryType || 'delivery',
        });
        onClose();
    };

    const getItemStyle = (item) => {
        const packed = item.packedQty || 0;
        if (packed === item.qty) return "bg-green-50 border-green-200";
        if (packed > 0) return "bg-orange-50 border-orange-200";
        return "bg-white border-slate-200";
    };

    if (typeof document === 'undefined') return null;

    return createPortal(
        <div className="fixed inset-0 z-[20000] bg-slate-900/50 backdrop-blur-sm flex justify-center items-center animate-in fade-in duration-200">
            <div className="w-full h-full sm:h-[90vh] sm:max-w-2xl bg-white sm:rounded-2xl shadow-2xl flex flex-col overflow-hidden">

                {/* HEADER */}
                <div className="bg-white p-4 border-b flex items-center justify-between shadow-sm z-20">
                    <button onClick={onClose} className="p-2 -ml-2 rounded-full hover:bg-slate-100"><ArrowLeft size={24} className="text-slate-600" /></button>
                    <div className="text-center">
                        <h2 className="font-bold text-slate-800 text-lg">{order.clientName}</h2>
                        <div className="text-xs text-slate-500 font-medium uppercase tracking-wide">Pedido #{order.id.slice(0, 4)}</div>
                    </div>
                    <div className="w-8"></div>
                </div>

                {/* BUSCADOR */}
                <div className="p-4 bg-slate-50 border-b z-10 relative">
                    <div className="relative">
                        <Search className="absolute left-3 top-2.5 text-slate-400 w-4 h-4" />
                        <input
                            className="w-full pl-9 pr-4 py-2 text-sm border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none"
                            placeholder="🔍 Agregar producto extra..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />
                        {searchResults.length > 0 && (
                            <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-slate-200 rounded-xl shadow-xl overflow-hidden animate-in fade-in zoom-in-95 max-h-48 overflow-y-auto">
                                {searchResults.map(p => (
                                    <button key={p.id} onClick={() => handleAddItem(p)} className="w-full text-left p-3 hover:bg-blue-50 flex justify-between items-center border-b last:border-0 transition-colors">
                                        <div className="text-sm font-bold text-slate-800">{p.name}</div>
                                        <div className="text-xs font-bold text-blue-600"><Plus size={14} className="inline" /> Agregar</div>
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>
                </div>

                {/* LISTA DE ITEMS */}
                <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-slate-50/50">
                    {localItems.map((item, idx) => {
                        const packed = item.packedQty || 0;
                        const isEditing = editingItemIndex === idx;

                        return (
                            <div key={idx} className={`p-3 rounded-xl border-2 transition-all ${getItemStyle(item)} flex items-center gap-3 shadow-sm`}>
                                {/* CHECK BUTTON */}
                                <button
                                    onClick={() => handleQuickToggle(idx)}
                                    className={`w-12 h-12 rounded-xl flex items-center justify-center transition-transform active:scale-90 ${packed === item.qty ? 'bg-green-500 text-white shadow-green-200 shadow-lg' : packed > 0 ? 'bg-orange-500 text-white' : 'bg-white border-2 border-slate-200 text-slate-300'}`}
                                >
                                    {packed === item.qty ? <CheckSquare size={24} strokeWidth={3} /> : packed > 0 ? <span className="font-bold text-lg">!</span> : <div className="w-4 h-4 rounded-sm border-2 border-slate-300"></div>}
                                </button>

                                <div className="flex-1 min-w-0">
                                    <div className={`font-bold text-sm leading-snug ${packed === item.qty ? 'text-slate-500 line-through' : 'text-slate-800'}`}>
                                        {item.name}
                                    </div>
                                    <div className="flex items-center gap-2 mt-1">
                                        <span className="text-xs font-bold bg-white px-2 py-0.5 rounded border border-slate-200 text-slate-600">
                                            Pedido: {item.qty}
                                        </span>
                                        {packed > 0 && packed < item.qty && (
                                            <span className="text-xs font-bold text-orange-600 animate-pulse">Faltan {item.qty - packed}</span>
                                        )}
                                    </div>
                                </div>

                                {isEditing ? (
                                    <div className="flex items-center bg-white border border-blue-500 rounded-lg shadow-lg overflow-hidden animate-in zoom-in-95">
                                        <button onClick={() => setManualQty(Math.max(0, manualQty - 1))} className="p-3 bg-slate-100 hover:bg-slate-200"><Minus size={16} /></button>
                                        <div className="w-10 text-center font-bold text-lg">{manualQty}</div>
                                        <button onClick={() => setManualQty(manualQty + 1)} className="p-3 bg-slate-100 hover:bg-slate-200"><Plus size={16} /></button>
                                        <button onClick={() => saveManualEdit(idx)} className="p-3 bg-blue-600 text-white"><Save size={16} /></button>
                                    </div>
                                ) : (
                                    <div className="flex flex-col gap-1">
                                        <button onClick={() => { setEditingItemIndex(idx); setManualQty(packed); }} className="text-blue-600 hover:bg-blue-50 p-1.5 rounded-lg">
                                            <span className="text-xs font-bold">Editar</span>
                                        </button>
                                        <button onClick={() => handleDeleteItem(idx)} className="text-red-400 hover:text-red-600 hover:bg-red-50 p-1.5 rounded-lg">
                                            <Trash2 size={16} />
                                        </button>
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>

                {/* FOOTER */}
                <div className="p-4 bg-white border-t z-20 shadow-[0_-4px_10px_-1px_rgba(0,0,0,0.05)]">
                    <button
                        onClick={handleConfirmOrder}
                        className="w-full py-4 bg-blue-600 text-white rounded-xl font-bold text-lg shadow-lg shadow-blue-200 hover:bg-blue-700 active:scale-[0.98] transition-all flex items-center justify-center gap-2"
                    >
                        <Package size={24} /> Confirmar Armado
                    </button>
                </div>
            </div>
        </div>,
        document.body
    );
}

// --- COMPONENTE PRINCIPAL ---
export default function Orders() {
    const { transactions } = useTransactionsContext();

    // 1. CAMBIO: Default 'pending' en vez de 'all'
    const [filterStatus, setFilterStatus] = useState('pending');
    const [searchTerm, setSearchTerm] = useState('');

    const [selectedOrderId, setSelectedOrderId] = useState(null);

    const selectedOrder = useMemo(() => {
        return transactions.find(t => t.id === selectedOrderId);
    }, [transactions, selectedOrderId]);

    const activeOrders = useMemo(() => {
        return transactions.filter(t => {
            const status = t.fulfillmentStatus || 'pending';
            return status !== 'delivered' && status !== 'cancelled';
        }).sort((a, b) => (a.date?.seconds || 0) - (b.date?.seconds || 0));
    }, [transactions]);

    const filteredOrders = useMemo(() => {
        return activeOrders.filter(t => {
            const status = t.fulfillmentStatus || 'pending';
            const matchesSearch = t.clientName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                t.id.toLowerCase().includes(searchTerm.toLowerCase());

            if (status !== filterStatus) return false;

            return matchesSearch;
        });
    }, [activeOrders, filterStatus, searchTerm]);

    const statusLabels = {
        pending: 'Pendientes',
        partial: 'En Proceso',
        ready: 'Listos'
    };

    return (
        // 👇 PADDING INDEPENDIENTE PARA ESTA VISTA (pb-28 para móvil)
        <div className="flex flex-col h-full overflow-hidden bg-slate-50 p-4 pb-28 lg:pb-4">
            <div className="bg-white p-4 sticky top-0 z-10 border-b shadow-sm space-y-3 rounded-xl mb-4">
                <div className="flex justify-between items-center">
                    <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
                        <Package className="text-blue-600" /> Pedidos
                    </h2>
                    <span className="bg-blue-100 text-blue-700 px-2 py-1 rounded-lg text-xs font-bold">
                        {filteredOrders.length} {statusLabels[filterStatus]}
                    </span>
                </div>

                <div className="flex gap-2 overflow-x-auto no-scrollbar pb-1">
                    {[
                        { id: 'pending', l: 'Pendientes' },
                        { id: 'partial', l: 'En Proceso' },
                        { id: 'ready', l: 'Listos' }
                    ].map(t => (
                        <button
                            key={t.id}
                            onClick={() => setFilterStatus(t.id)}
                            className={`px-4 py-1.5 rounded-full text-xs font-bold whitespace-nowrap transition-colors border ${filterStatus === t.id ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-slate-600 border-slate-200'}`}
                        >
                            {t.l}
                        </button>
                    ))}
                </div>

                <div className="relative">
                    <Search className="absolute left-3 top-2.5 text-slate-400 w-5 h-5" />
                    <input
                        className="w-full pl-10 pr-4 py-2 bg-slate-100 border border-slate-200 rounded-xl text-sm outline-none focus:border-blue-600 focus:bg-white transition-all"
                        placeholder="Buscar cliente..."
                        value={searchTerm}
                        onChange={e => setSearchTerm(e.target.value)}
                    />
                </div>
            </div>

            <div className="flex-1 overflow-y-auto space-y-3 pb-4">
                {filteredOrders.length === 0 && (
                    <div className="flex flex-col items-center justify-center h-64 text-slate-400 text-center opacity-60">
                        <Package size={48} className="mb-2" />
                        <p>No hay pedidos en "{statusLabels[filterStatus]}".</p>
                    </div>
                )}

                {filteredOrders.map(order => {
                    const status = order.fulfillmentStatus || 'pending';
                    const itemCount = order.items.length;
                    const date = order.date?.seconds ? new Date(order.date.seconds * 1000) : new Date();

                    return (
                        <button
                            key={order.id}
                            onClick={() => setSelectedOrderId(order.id)}
                            className={`w-full text-left bg-white p-4 rounded-xl border shadow-sm hover:shadow-md transition-all active:scale-[0.99] flex justify-between items-center group relative overflow-hidden ${status === 'ready' ? 'border-green-300' : 'border-slate-200'}`}
                        >
                            {status === 'ready' && <div className="absolute left-0 top-0 bottom-0 w-1.5 bg-green-500"></div>}
                            {status === 'partial' && <div className="absolute left-0 top-0 bottom-0 w-1.5 bg-orange-400"></div>}

                            <div className="pl-2">
                                <div className="font-bold text-slate-800 text-lg group-hover:text-blue-600 transition-colors">
                                    {order.clientName}
                                </div>
                                <div className="text-xs text-slate-500 flex items-center gap-2 mt-1">
                                    <Clock size={12} /> {date.toLocaleDateString()} {date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                </div>
                            </div>

                            <div className="flex flex-col items-end gap-1">
                                <div className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase border ${status === 'ready' ? 'bg-green-100 text-green-700 border-green-200' : status === 'partial' ? 'bg-orange-100 text-orange-700 border-orange-200' : 'bg-slate-100 text-slate-600 border-slate-200'}`}>
                                    {status === 'ready' ? 'LISTO' : status === 'partial' ? 'ARMANDO' : 'NUEVO'}
                                </div>
                                <div className="text-xs font-bold text-slate-400 flex items-center gap-1">
                                    {itemCount} items <ChevronRight size={14} />
                                </div>
                            </div>
                        </button>
                    );
                })}
            </div>

            {selectedOrderId && selectedOrder && (
                <OrderWorkModal
                    order={selectedOrder}
                    onClose={() => setSelectedOrderId(null)}
                />
            )}
        </div>
    );
}