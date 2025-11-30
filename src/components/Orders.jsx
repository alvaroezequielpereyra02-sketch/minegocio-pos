import React, { useState, useMemo } from 'react';
import { ClipboardList, CheckCircle, Clock, AlertTriangle, Download, Package, Search, Square, CheckSquare, Truck, Filter, Edit3 } from 'lucide-react';

export default function Orders({ transactions, products, categories, onUpdateTransaction }) {
    const [filterStatus, setFilterStatus] = useState('all'); // all, pending, partial, ready
    const [searchTerm, setSearchTerm] = useState('');

    // 1. FILTRAR PEDIDOS ACTIVOS
    const activeOrders = useMemo(() => {
        return transactions.filter(t => {
            const status = t.fulfillmentStatus || 'pending';
            return status !== 'delivered' && status !== 'cancelled';
        }).sort((a, b) => (a.date?.seconds || 0) - (b.date?.seconds || 0)); // FIFO
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

    // 2. CALCULAR LISTA DE NECESIDADES (STOCK)
    const shoppingReport = useMemo(() => {
        const needs = {};
        activeOrders.forEach(order => {
            if (order.fulfillmentStatus === 'ready') return;
            order.items.forEach(item => {
                // Calculamos lo que falta armar (Total - Ya Empaquetado)
                const packedQty = item.packedQty || (item.packed ? item.qty : 0);
                const remainingNeeded = item.qty - packedQty;

                if (remainingNeeded > 0) {
                    const productRef = products.find(p => p.id === item.id) || products.find(p => p.name === item.name);
                    const catId = productRef ? productRef.categoryId : 'uncategorized';
                    const catName = categories.find(c => c.id === catId)?.name || 'Varios';
                    const key = item.id || item.name;

                    if (!needs[key]) {
                        needs[key] = {
                            name: item.name,
                            required: 0,
                            stock: productRef ? productRef.stock : 0,
                            category: catName
                        };
                    }
                    needs[key].required += remainingNeeded;
                }
            });
        });

        const grouped = {};
        Object.values(needs).forEach(item => {
            const missing = item.required - item.stock;
            if (missing > 0) {
                if (!grouped[item.category]) grouped[item.category] = [];
                grouped[item.category].push({ ...item, missing });
            }
        });
        return grouped;
    }, [activeOrders, products, categories]);

    const totalMissingItems = Object.values(shoppingReport).reduce((acc, catItems) => acc + catItems.length, 0);

    // 3. GENERAR PDF
    const handleDownloadReport = async () => {
        if (totalMissingItems === 0) return alert("✅ No hay faltantes de stock para los pedidos pendientes.");
        const html2pdfModule = await import('html2pdf.js');
        const html2pdf = html2pdfModule.default;
        const date = new Date().toLocaleDateString();

        let rowsHTML = '';
        Object.keys(shoppingReport).sort().forEach(category => {
            rowsHTML += `<tr style="background-color:#e5e7eb;font-weight:bold;"><td colspan="4" style="padding:8px;text-transform:uppercase;font-size:11px;color:#374151;">${category}</td></tr>`;
            shoppingReport[category].forEach(item => {
                rowsHTML += `<tr style="border-bottom:1px solid #f3f4f6;"><td style="padding:8px;">${item.name}</td><td style="padding:8px;text-align:center;">${item.required}</td><td style="padding:8px;text-align:center;">${item.stock}</td><td style="padding:8px;text-align:center;font-weight:bold;color:#dc2626;">${item.missing}</td></tr>`;
            });
        });

        const content = `<div style="font-family:sans-serif;padding:20px;color:#1f2937;"><div style="text-align:center;margin-bottom:20px;border-bottom:2px solid #dc2626;padding-bottom:10px;"><h1 style="font-size:22px;margin:0;color:#dc2626;">Reporte de Reposición</h1><p style="margin:5px 0 0;font-size:12px;color:#6b7280;">${date}</p></div><div style="background:#fee2e2;padding:10px;border-radius:6px;font-size:11px;margin-bottom:15px;color:#991b1b;"><strong>IMPORTANTE:</strong> Mercadería insuficiente para completar pedidos.</div><table style="width:100%;border-collapse:collapse;font-size:11px;"><thead><tr style="background:#1f2937;color:white;"><th style="text-align:left;padding:8px;">Producto</th><th style="text-align:center;padding:8px;">Pedidos</th><th style="text-align:center;padding:8px;">Stock</th><th style="text-align:center;padding:8px;">FALTANTE</th></tr></thead><tbody>${rowsHTML}</tbody></table></div>`;
        const element = document.createElement('div'); element.innerHTML = content;
        html2pdf().set({ margin: 10, filename: `compras_${Date.now()}.pdf`, image: { type: 'jpeg', quality: 0.98 }, html2canvas: { scale: 2 }, jsPDF: { unit: 'mm', format: 'a4' } }).from(element).save();
    };

    // 4. LÓGICA DE PICKING (PARCIAL O TOTAL)
    const updateItemPacking = async (order, itemIndex, newPackedQty) => {
        const newItems = [...order.items];
        const item = newItems[itemIndex];

        // Validaciones
        if (newPackedQty < 0) newPackedQty = 0;
        if (newPackedQty > item.qty) newPackedQty = item.qty;

        // Actualizamos la cantidad empacada
        newItems[itemIndex] = {
            ...item,
            packedQty: newPackedQty,
            packed: newPackedQty === item.qty // Mantenemos 'packed' por compatibilidad, es true si está completo
        };

        // Calcular estado general del pedido
        const totalRequested = newItems.reduce((acc, i) => acc + i.qty, 0);
        const totalPacked = newItems.reduce((acc, i) => acc + (i.packedQty || 0), 0);

        let newStatus = order.fulfillmentStatus;
        if (totalPacked === 0) newStatus = 'pending';
        else if (totalPacked < totalRequested) newStatus = 'partial';
        else if (totalPacked === totalRequested) newStatus = 'ready';

        try {
            await onUpdateTransaction(order.id, {
                items: newItems,
                fulfillmentStatus: newStatus
            });
        } catch (error) {
            console.error("Error updating packing", error);
        }
    };

    const handleQuickToggle = (order, idx) => {
        const item = order.items[idx];
        const currentPacked = item.packedQty || (item.packed ? item.qty : 0);
        // Si ya está lleno, lo vaciamos. Si no, lo llenamos.
        const nextQty = currentPacked === item.qty ? 0 : item.qty;
        updateItemPacking(order, idx, nextQty);
    };

    const handleManualQty = (order, idx) => {
        const item = order.items[idx];
        const input = prompt(`¿Cuántas unidades de "${item.name}" armaste? (Total: ${item.qty})`, item.packedQty || 0);
        if (input === null) return;
        const qty = parseInt(input);
        if (!isNaN(qty)) {
            updateItemPacking(order, idx, qty);
        }
    };

    const updateStatus = async (transaction, newStatus) => {
        let notes = transaction.fulfillmentNotes || '';
        if (newStatus === 'partial' && !notes) {
            const missing = prompt("Nota sobre faltantes:", notes);
            if (missing) notes = missing;
        }
        await onUpdateTransaction(transaction.id, { fulfillmentStatus: newStatus, fulfillmentNotes: notes });
    };

    return (
        <div className="flex flex-col h-full overflow-hidden pb-20 lg:pb-0 bg-slate-50 -m-4">
            {/* Header */}
            <div className="bg-white p-4 sticky top-0 z-10 border-b shadow-sm">
                <div className="flex justify-between items-center mb-4">
                    <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2"><Package className="text-blue-600" /> Armado</h2>
                    <button onClick={handleDownloadReport} className="bg-white border border-red-200 text-red-600 px-3 py-2 rounded-lg text-sm font-bold shadow-sm hover:bg-red-50 flex items-center gap-2 transition-colors">
                        <Download size={16} /> <span className="hidden sm:inline">Faltantes</span>
                        {totalMissingItems > 0 && <span className="bg-red-600 text-white text-[10px] px-1.5 rounded-full animate-pulse">{totalMissingItems}</span>}
                    </button>
                </div>
                <div className="flex flex-col sm:flex-row gap-3">
                    <div className="relative flex-1">
                        <Search className="absolute left-3 top-2.5 text-slate-400 w-5 h-5" />
                        <input className="w-full pl-10 pr-4 py-2 bg-slate-100 border border-slate-200 rounded-lg text-sm outline-none focus:bg-white focus:border-blue-600 transition-all" placeholder="Buscar pedido..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
                    </div>
                    <div className="flex bg-slate-100 p-1 rounded-lg shrink-0 overflow-x-auto">
                        {[{ id: 'all', label: 'Todos' }, { id: 'pending', label: 'Pendientes' }, { id: 'partial', label: 'En Proceso' }, { id: 'ready', label: 'Listos' }].map(tab => (
                            <button key={tab.id} onClick={() => setFilterStatus(tab.id)} className={`px-3 py-1.5 rounded-md text-xs font-bold transition-all whitespace-nowrap ${filterStatus === tab.id ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>{tab.label}</button>
                        ))}
                    </div>
                </div>
            </div>

            {/* Tablero */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
                {filteredOrders.length === 0 && <div className="flex flex-col items-center justify-center h-64 text-slate-400 text-center"><ClipboardList size={48} className="mb-2 opacity-20" /><p>No hay pedidos aquí.</p></div>}

                {filteredOrders.map(order => {
                    const status = order.fulfillmentStatus || 'pending';
                    // Cálculo de progreso real
                    const totalRequested = order.items.reduce((acc, i) => acc + i.qty, 0);
                    const totalPacked = order.items.reduce((acc, i) => acc + (i.packedQty || (i.packed ? i.qty : 0)), 0);
                    const progress = totalRequested > 0 ? Math.round((totalPacked / totalRequested) * 100) : 0;

                    return (
                        <div key={order.id} className={`bg-white rounded-xl border shadow-sm overflow-hidden transition-all ${status === 'ready' ? 'border-green-200 ring-1 ring-green-100' : status === 'partial' ? 'border-orange-200' : 'border-slate-200'}`}>
                            <div className="p-3 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
                                <div>
                                    <div className="font-bold text-slate-800 text-base flex items-center gap-2">{order.clientName} <span className="text-xs font-normal text-slate-400">#{order.id.slice(0, 6)}</span></div>
                                    <div className="text-xs text-slate-500 mt-0.5 flex items-center gap-2"><Clock size={11} /> {new Date(order.date?.seconds * 1000).toLocaleDateString()}</div>
                                </div>
                                <div className="text-right">
                                    <div className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase border inline-block ${status === 'ready' ? 'bg-green-100 text-green-700 border-green-200' : status === 'partial' ? 'bg-orange-100 text-orange-700 border-orange-200' : 'bg-white text-slate-500 border-slate-200'}`}>
                                        {status === 'ready' ? 'Listo' : status === 'partial' ? 'En Proceso' : 'Pendiente'}
                                    </div>
                                    <div className="w-20 h-1.5 bg-slate-200 rounded-full mt-1.5 overflow-hidden ml-auto"><div className={`h-full transition-all duration-500 ${status === 'ready' ? 'bg-green-500' : 'bg-blue-500'}`} style={{ width: `${progress}%` }}></div></div>
                                </div>
                            </div>

                            {/* ITEMS CHECKLIST AVANZADO */}
                            <div className="p-2 divide-y divide-slate-50">
                                {order.items.map((item, idx) => {
                                    const currentPacked = item.packedQty || (item.packed ? item.qty : 0);
                                    const isComplete = currentPacked === item.qty;
                                    const isPartial = currentPacked > 0 && currentPacked < item.qty;
                                    const isZero = currentPacked === 0;

                                    return (
                                        <div key={idx} className={`flex items-center gap-3 p-3 rounded-lg transition-colors ${isComplete ? 'bg-green-50/50' : isPartial ? 'bg-orange-50' : 'hover:bg-slate-50'}`}>
                                            {/* Botón Checkbox Rápido */}
                                            <button onClick={() => handleQuickToggle(order, idx)} className={`w-8 h-8 rounded border flex items-center justify-center transition-all shrink-0 ${isComplete ? 'bg-green-500 border-green-500 text-white' : isPartial ? 'bg-orange-100 border-orange-300 text-orange-600' : 'bg-white border-slate-300 text-transparent'}`}>
                                                {isComplete && <CheckSquare size={16} strokeWidth={3} />}
                                                {isPartial && <span className="text-xs font-bold">!</span>}
                                            </button>

                                            <div className="flex-1 min-w-0">
                                                <div className={`text-sm font-medium truncate ${isComplete ? 'text-slate-400 line-through' : 'text-slate-700'}`}>{item.name}</div>
                                                {isPartial && <div className="text-xs text-orange-600 font-bold">Faltan {item.qty - currentPacked} un.</div>}
                                            </div>

                                            {/* Control Numérico */}
                                            <button onClick={() => handleManualQty(order, idx)} className={`flex items-center gap-1 px-2 py-1 rounded border text-xs font-bold ${isComplete ? 'border-green-200 text-green-700 bg-green-50' : isPartial ? 'border-orange-200 text-orange-700 bg-orange-50' : 'border-slate-200 text-slate-600 bg-white'}`}>
                                                {currentPacked} / {item.qty} <Edit3 size={10} className="opacity-50" />
                                            </button>
                                        </div>
                                    );
                                })}
                            </div>

                            <div className="p-3 bg-slate-50 border-t border-slate-100 flex items-center justify-between gap-2">
                                {status === 'partial' && order.fulfillmentNotes && <div className="text-xs text-orange-700 bg-orange-100 px-2 py-1 rounded flex-1 truncate"><AlertTriangle size={10} className="inline mr-1" /> {order.fulfillmentNotes}</div>}
                                <div className="flex gap-2 ml-auto">
                                    {status !== 'ready' ? (
                                        <button onClick={() => updateStatus(order, 'ready')} className="bg-green-600 text-white px-4 py-1.5 rounded-lg text-xs font-bold hover:bg-green-700 flex items-center gap-1 shadow-sm"><CheckCircle size={14} /> Marcar Listo</button>
                                    ) : (
                                        <button onClick={() => updateStatus(order, 'delivered')} className="bg-slate-800 text-white px-4 py-1.5 rounded-lg text-xs font-bold hover:bg-slate-900 flex items-center gap-1 shadow-sm"><Truck size={14} /> Despachar</button>
                                    )}
                                </div>
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}