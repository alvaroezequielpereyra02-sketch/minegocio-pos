import React, { useState, useMemo } from 'react';
import { ClipboardList, CheckCircle, Clock, AlertTriangle, Download, Package, Search, Square, CheckSquare, Truck, Filter, Edit3, Save, X, Minus, Plus } from 'lucide-react';

export default function Orders({ transactions, products, categories, onUpdateTransaction }) {
    const [filterStatus, setFilterStatus] = useState('all');
    const [searchTerm, setSearchTerm] = useState('');

    // Estado local para manejar la edición de cantidad INLINE (sin ventanas emergentes)
    const [editingItem, setEditingItem] = useState({ orderId: null, itemIndex: null, qty: 0 });

    // 1. FILTRAR PEDIDOS ACTIVOS
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
            if (filterStatus !== 'all' && status !== filterStatus) return false;
            return matchesSearch;
        });
    }, [activeOrders, filterStatus, searchTerm]);

    // 2. REPORTE DE STOCK (POR CATEGORÍAS)
    const shoppingReport = useMemo(() => {
        const needs = {};
        activeOrders.forEach(order => {
            if (order.fulfillmentStatus === 'ready') return;
            order.items.forEach(item => {
                const packedQty = item.packedQty || (item.packed ? item.qty : 0);
                const remaining = item.qty - packedQty;
                if (remaining > 0) {
                    const productRef = products.find(p => p.id === item.id) || products.find(p => p.name === item.name);
                    const catId = productRef ? productRef.categoryId : 'uncategorized';
                    const catName = categories.find(c => c.id === catId)?.name || 'Varios';
                    const key = item.id || item.name;
                    if (!needs[key]) needs[key] = { name: item.name, required: 0, stock: productRef ? productRef.stock : 0, category: catName };
                    needs[key].required += remaining;
                }
            });
        });

        // Agrupar por categoría
        const grouped = {};
        Object.values(needs).forEach(item => {
            const missing = item.required - item.stock;
            // Incluimos en el reporte si falta stock O si se necesita separar (picking)
            if (missing > 0) {
                if (!grouped[item.category]) grouped[item.category] = [];
                grouped[item.category].push({ ...item, missing });
            }
        });
        return grouped;
    }, [activeOrders, products, categories]);

    const totalMissingItems = Object.values(shoppingReport).reduce((acc, catItems) => acc + catItems.length, 0);

    const handleDownloadReport = async () => {
        if (totalMissingItems === 0) return alert("✅ No hay faltantes de stock críticos.");
        const html2pdfModule = await import('html2pdf.js');
        const html2pdf = html2pdfModule.default;

        let rows = '';
        Object.keys(shoppingReport).sort().forEach(cat => {
            rows += `<tr style="background-color:#f3f4f6;font-weight:bold;"><td colspan="4" style="padding:8px;text-transform:uppercase;">${cat}</td></tr>`;
            shoppingReport[cat].forEach(i => {
                rows += `<tr style="border-bottom:1px solid #eee;"><td style="padding:8px;">${i.name}</td><td style="text-align:center;">${i.required}</td><td style="text-align:center;">${i.stock}</td><td style="text-align:center;font-weight:bold;color:red;">${i.missing}</td></tr>`;
            });
        });

        const content = `<div style="font-family:sans-serif;padding:20px;">
            <h1 style="color:#dc2626;text-align:center;">Reporte de Faltantes</h1>
            <p style="text-align:center;color:#666;font-size:12px;">Generado el ${new Date().toLocaleDateString()}</p>
            <table style="width:100%;border-collapse:collapse;font-size:12px;margin-top:20px;">
                <thead><tr style="background:#374151;color:white;"><th style="text-align:left;padding:8px;">Producto</th><th>Pedidos</th><th>Stock</th><th>A COMPRAR</th></tr></thead>
                <tbody>${rows}</tbody>
            </table>
        </div>`;

        const element = document.createElement('div'); element.innerHTML = content;
        html2pdf().set({ margin: 10, filename: `stock_faltante.pdf`, image: { type: 'jpeg', quality: 0.98 }, html2canvas: { scale: 2 }, jsPDF: { unit: 'mm', format: 'a4' } }).from(element).save();
    };

    // 3. MANEJO DE EDICIÓN VISUAL
    const startEditing = (orderId, idx, currentQty) => {
        setEditingItem({ orderId, itemIndex: idx, qty: currentQty });
    };

    const saveEditing = async (order) => {
        const { itemIndex, qty } = editingItem;
        const newItems = [...order.items];
        const item = newItems[itemIndex];

        // Validar límites
        let finalQty = qty;
        if (finalQty < 0) finalQty = 0;
        if (finalQty > item.qty) finalQty = item.qty;

        newItems[itemIndex] = { ...item, packedQty: finalQty, packed: finalQty === item.qty };

        // Recalcular estado global
        const totalReq = newItems.reduce((acc, i) => acc + i.qty, 0);
        const totalPack = newItems.reduce((acc, i) => acc + (i.packedQty || 0), 0);
        let newStatus = order.fulfillmentStatus;

        if (totalPack === 0) newStatus = 'pending';
        else if (totalPack < totalReq) newStatus = 'partial';
        else newStatus = 'ready';

        await onUpdateTransaction(order.id, { items: newItems, fulfillmentStatus: newStatus });
        setEditingItem({ orderId: null, itemIndex: null, qty: 0 });
    };

    // Tilde rápido (0 -> Todo -> 0)
    const handleQuickToggle = async (order, idx) => {
        const item = order.items[idx];
        const isFull = (item.packedQty || 0) === item.qty;
        const nextQty = isFull ? 0 : item.qty;

        // Simulamos el estado de edición para reutilizar lógica, pero guardamos directo
        const newItems = [...order.items];
        newItems[idx] = { ...item, packedQty: nextQty, packed: nextQty === item.qty };

        const totalReq = newItems.reduce((acc, i) => acc + i.qty, 0);
        const totalPack = newItems.reduce((acc, i) => acc + (i.packedQty || 0), 0);
        let newStatus = totalPack === totalReq ? 'ready' : totalPack > 0 ? 'partial' : 'pending';

        await onUpdateTransaction(order.id, { items: newItems, fulfillmentStatus: newStatus });
    };

    const updateStatus = async (transaction, newStatus) => {
        await onUpdateTransaction(transaction.id, { fulfillmentStatus: newStatus });
    };

    return (
        <div className="flex flex-col h-full overflow-hidden pb-20 lg:pb-0 bg-slate-50 -m-4">
            {/* Header Fijo */}
            <div className="bg-white p-4 sticky top-0 z-10 border-b shadow-sm space-y-3">
                <div className="flex justify-between items-center">
                    <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2"><Package className="text-blue-600" /> Armado</h2>
                    <button onClick={handleDownloadReport} className="bg-white border border-red-200 text-red-600 px-3 py-2 rounded-lg text-sm font-bold shadow-sm hover:bg-red-50 flex items-center gap-2 transition-colors">
                        <Download size={16} /> <span className="hidden sm:inline">Faltantes</span>
                        {totalMissingItems > 0 && <span className="bg-red-600 text-white text-[10px] px-1.5 rounded-full animate-pulse">{totalMissingItems}</span>}
                    </button>
                </div>
                {/* Filtros */}
                <div className="flex gap-2 overflow-x-auto no-scrollbar pb-1">
                    {[{ id: 'all', l: 'Todos' }, { id: 'pending', l: 'Pendientes' }, { id: 'partial', l: 'En Proceso' }, { id: 'ready', l: 'Listos' }].map(t => (
                        <button key={t.id} onClick={() => setFilterStatus(t.id)} className={`px-3 py-1.5 rounded-full text-xs font-bold whitespace-nowrap transition-colors border ${filterStatus === t.id ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-slate-600 border-slate-200'}`}>{t.l}</button>
                    ))}
                </div>
                <div className="relative">
                    <Search className="absolute left-3 top-2.5 text-slate-400 w-5 h-5" />
                    <input className="w-full pl-10 pr-4 py-2 bg-slate-100 border border-slate-200 rounded-xl text-sm outline-none focus:border-blue-600 focus:bg-white transition-all" placeholder="Buscar por cliente o ID..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
                </div>
            </div>

            {/* Lista de Pedidos */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
                {filteredOrders.length === 0 && <div className="flex flex-col items-center justify-center h-64 text-slate-400 text-center"><ClipboardList size={48} className="mb-2 opacity-20" /><p>No hay pedidos en esta vista.</p></div>}

                {filteredOrders.map(order => {
                    const totalReq = order.items.reduce((a, i) => a + i.qty, 0);
                    const totalPack = order.items.reduce((a, i) => a + (i.packedQty || (i.packed ? i.qty : 0)), 0);
                    const progress = totalReq > 0 ? Math.round((totalPack / totalReq) * 100) : 0;
                    const status = order.fulfillmentStatus || 'pending';

                    return (
                        <div key={order.id} className={`bg-white rounded-xl border shadow-sm overflow-hidden transition-all ${status === 'ready' ? 'border-green-300 shadow-md' : status === 'partial' ? 'border-orange-200' : 'border-slate-200'}`}>

                            {/* Cabecera Pedido */}
                            <div className={`p-3 border-b border-slate-100 flex justify-between items-center ${status === 'ready' ? 'bg-green-50' : 'bg-slate-50/50'}`}>
                                <div>
                                    <div className="font-bold text-slate-800 text-base flex items-center gap-2">
                                        {order.clientName}
                                        <span className="text-xs font-normal text-slate-400 px-1.5 py-0.5 bg-white border rounded">#{order.id.slice(0, 4)}</span>
                                    </div>
                                    <div className="text-xs text-slate-500 mt-1 flex items-center gap-2"><Clock size={11} /> {new Date(order.date?.seconds * 1000).toLocaleString()}</div>
                                </div>
                                <div className="text-right">
                                    <div className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase border inline-block mb-1 ${status === 'ready' ? 'bg-green-100 text-green-700 border-green-200' : status === 'partial' ? 'bg-orange-100 text-orange-700 border-orange-200' : 'bg-white text-slate-500 border-slate-200'}`}>
                                        {status === 'ready' ? 'Listo' : status === 'partial' ? 'En Proceso' : 'Pendiente'}
                                    </div>
                                    {/* Barra Progreso */}
                                    <div className="w-24 h-2 bg-slate-200 rounded-full overflow-hidden"><div className={`h-full transition-all duration-500 ${progress === 100 ? 'bg-green-500' : progress > 0 ? 'bg-blue-500' : 'bg-slate-300'}`} style={{ width: `${progress}%` }}></div></div>
                                </div>
                            </div>

                            {/* LISTA DE ITEMS (Checklist mejorada) */}
                            <div className="divide-y divide-slate-50">
                                {order.items.map((item, idx) => {
                                    const packed = item.packedQty || (item.packed ? item.qty : 0);
                                    const isEditing = editingItem.orderId === order.id && editingItem.itemIndex === idx;
                                    const isComplete = packed === item.qty;
                                    const isPartial = packed > 0 && packed < item.qty;

                                    return (
                                        <div key={idx} className={`flex items-center p-3 gap-3 transition-colors ${isComplete ? 'bg-green-50/30' : isPartial ? 'bg-orange-50' : 'hover:bg-slate-50'}`}>

                                            {/* 1. Checkbox (Tocar para completar todo) */}
                                            <button
                                                onClick={() => handleQuickToggle(order, idx)}
                                                className={`w-10 h-10 rounded-xl border-2 flex items-center justify-center transition-all shrink-0 active:scale-90 shadow-sm ${isComplete ? 'bg-green-500 border-green-500 text-white' : isPartial ? 'bg-white border-orange-400 text-orange-500' : 'bg-white border-slate-200 text-transparent'}`}
                                            >
                                                {isComplete ? <CheckSquare size={20} strokeWidth={3} /> : isPartial ? <span className="font-bold text-sm">!</span> : null}
                                            </button>

                                            {/* 2. Nombre del Producto */}
                                            <div className="flex-1 min-w-0" onClick={() => !isEditing && startEditing(order.id, idx, packed)}>
                                                <div className={`font-medium text-sm leading-tight ${isComplete ? 'text-slate-400 line-through' : 'text-slate-800'}`}>{item.name}</div>
                                                {isPartial && !isEditing && <div className="text-xs text-orange-600 font-bold mt-0.5">Faltan {item.qty - packed} unidades</div>}
                                            </div>

                                            {/* 3. Control de Cantidad (Editable) */}
                                            {isEditing ? (
                                                <div className="flex items-center bg-white border border-blue-500 rounded-lg shadow-md overflow-hidden animate-in zoom-in-95 duration-150">
                                                    <button onClick={() => setEditingItem(prev => ({ ...prev, qty: Math.max(0, prev.qty - 1) }))} className="p-2 bg-slate-100 hover:bg-slate-200 text-slate-600"><Minus size={14} /></button>
                                                    <div className="w-10 text-center font-bold text-slate-800">{editingItem.qty}</div>
                                                    <button onClick={() => setEditingItem(prev => ({ ...prev, qty: Math.min(item.qty, prev.qty + 1) }))} className="p-2 bg-slate-100 hover:bg-slate-200 text-slate-600"><Plus size={14} /></button>
                                                    <button onClick={() => saveEditing(order)} className="p-2 bg-blue-600 text-white hover:bg-blue-700"><Save size={14} /></button>
                                                </div>
                                            ) : (
                                                <button
                                                    onClick={() => startEditing(order.id, idx, packed)}
                                                    className={`flex flex-col items-end justify-center px-3 py-1 rounded-lg border min-w-[60px] transition-all active:scale-95 ${isComplete ? 'border-green-200 bg-green-50 text-green-800' : isPartial ? 'border-orange-300 bg-white text-orange-700 shadow-sm' : 'border-slate-200 bg-white text-slate-500'}`}
                                                >
                                                    <div className="text-sm font-extrabold">{packed}/{item.qty}</div>
                                                    <div className="text-[10px] uppercase font-bold opacity-60">Unid.</div>
                                                </button>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>

                            {/* Footer Acciones */}
                            {status !== 'ready' && (
                                <div className="p-3 bg-slate-50 border-t border-slate-100 flex justify-end">
                                    <button onClick={() => updateStatus(order, 'ready')} className="w-full py-2.5 bg-white border-2 border-slate-200 rounded-xl text-slate-600 font-bold text-sm hover:bg-green-50 hover:text-green-700 hover:border-green-200 transition-all flex items-center justify-center gap-2">
                                        <CheckCircle size={18} /> Marcar Pedido Completo
                                    </button>
                                </div>
                            )}
                            {status === 'ready' && (
                                <div className="p-3 bg-green-50 border-t border-green-100 flex justify-end">
                                    <button onClick={() => updateStatus(order, 'delivered')} className="w-full py-2.5 bg-slate-800 text-white rounded-xl font-bold text-sm hover:bg-slate-900 flex items-center justify-center gap-2 shadow-lg transform active:scale-95 transition-all">
                                        <Truck size={18} /> Despachar / Entregar
                                    </button>
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>
        </div>
    );
}