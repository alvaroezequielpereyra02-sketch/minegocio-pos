import React, { useState, useEffect } from 'react';
import { Truck, MapPin, MessageCircle, CheckCircle, Plus, X, ArrowUp, ArrowDown, Navigation, Package, FileText } from 'lucide-react';

// 1. Recibimos 'onRequestConfirm'
export default function Delivery({ transactions, customers, onUpdateTransaction, onSelectTransaction, onRequestConfirm }) {

    const [routeIds, setRouteIds] = useState(() => {
        const saved = localStorage.getItem('deliveryRoute');
        return saved ? JSON.parse(saved) : [];
    });

    const [activeTab, setActiveTab] = useState('route');

    useEffect(() => {
        localStorage.setItem('deliveryRoute', JSON.stringify(routeIds));
    }, [routeIds]);

    const readyOrders = transactions.filter(t =>
        t.fulfillmentStatus === 'ready' && !routeIds.includes(t.id)
    );

    const routeOrders = routeIds
        .map(id => transactions.find(t => t.id === id))
        .filter(t => t && t.fulfillmentStatus !== 'delivered');

    // FUNCIONES DE ACCIÓN
    const addToRoute = (id) => setRouteIds([...routeIds, id]);

    const removeFromRoute = (id) => setRouteIds(routeIds.filter(rid => rid !== id));

    const moveOrder = (index, direction) => {
        const newRoute = [...routeIds];
        const [movedItem] = newRoute.splice(index, 1);
        newRoute.splice(index + direction, 0, movedItem);
        setRouteIds(newRoute);
    };

    // --- CAMBIO PRINCIPAL: Usamos el Modal Nativo ---
    const handleMarkDelivered = (order) => {
        // En lugar de window.confirm, usamos la función que nos pasó App.jsx
        onRequestConfirm(
            "Confirmar Entrega", // Título
            `¿Marcar el pedido #${order.id.slice(0, 4)} como ENTREGADO?`, // Mensaje
            async () => {
                // Acción a ejecutar si dice "SÍ"
                await onUpdateTransaction(order.id, { fulfillmentStatus: 'delivered' });
                removeFromRoute(order.id);
            },
            false // isDanger (false para azul, true para rojo)
        );
    };

    const getClientData = (t) => {
        const c = customers.find(cust => cust.id === t.clientId);
        return {
            name: t.clientName,
            phone: c?.phone || '',
            address: c?.address || '',
            coords: null
        };
    };

    const OrderCard = ({ order, isRoute = false, index }) => {
        const client = getClientData(order);

        return (
            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col gap-3 relative animate-in zoom-in-95 duration-200">
                <div className="flex justify-between items-start">
                    <div>
                        <div className="font-bold text-slate-800 text-lg flex items-center gap-2">
                            {isRoute && <span className="bg-slate-800 text-white w-6 h-6 rounded-full text-xs flex items-center justify-center shrink-0">{index + 1}</span>}
                            {client.name}
                        </div>
                        <div className="text-xs text-slate-500 font-bold uppercase mt-1">Pedido #{order.id.slice(0, 4)} • ${order.total.toLocaleString()}</div>

                        <button
                            onClick={() => onSelectTransaction(order)}
                            className="mt-2 text-xs font-bold text-blue-600 bg-blue-50 px-2 py-1 rounded-md border border-blue-100 flex items-center gap-1 hover:bg-blue-100 transition-colors"
                        >
                            <FileText size={12} /> Ver Boleta / Modificar
                        </button>
                    </div>

                    {isRoute ? (
                        <button onClick={() => removeFromRoute(order.id)} className="text-slate-400 hover:text-red-500"><X size={20} /></button>
                    ) : (
                        <button onClick={() => addToRoute(order.id)} className="bg-blue-100 text-blue-700 p-2 rounded-full hover:bg-blue-200 transition-colors">
                            <Plus size={20} />
                        </button>
                    )}
                </div>

                <div className="bg-slate-50 p-3 rounded-lg text-sm text-slate-600 space-y-1">
                    {client.address ? (
                        <div className="flex items-start gap-2 text-slate-800 font-medium">
                            <MapPin size={16} className="text-orange-500 mt-0.5 shrink-0" /> {client.address}
                        </div>
                    ) : (
                        <div className="text-slate-400 italic text-xs flex items-center gap-1"><MapPin size={14} /> Sin dirección registrada</div>
                    )}
                    <div className="text-xs text-slate-500 border-t border-slate-200 mt-2 pt-2 truncate">
                        {order.items.length} items: {order.items.map(i => i.name).join(', ')}
                    </div>
                </div>

                {isRoute && (
                    <div className="flex flex-col gap-2 mt-1">
                        <div className="flex gap-2">
                            {client.phone && (
                                <a
                                    href={`https://wa.me/${client.phone}?text=Hola ${client.name}, estamos en camino con tu pedido!`}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="flex-1 bg-green-50 text-green-700 border border-green-200 py-2 rounded-lg flex items-center justify-center gap-2 font-bold text-xs hover:bg-green-100"
                                >
                                    <MessageCircle size={16} /> Avisar
                                </a>
                            )}
                            {client.address && (
                                <a
                                    href={`https://www.google.com/maps/search/?api=1&query=$?q=${encodeURIComponent(client.address)}`}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="flex-1 bg-blue-50 text-blue-700 border border-blue-200 py-2 rounded-lg flex items-center justify-center gap-2 font-bold text-xs hover:bg-blue-100"
                                >
                                    <Navigation size={16} /> Ir
                                </a>
                            )}
                        </div>

                        <div className="flex gap-2 items-center">
                            <div className="flex bg-slate-100 rounded-lg p-1">
                                <button disabled={index === 0} onClick={() => moveOrder(index, -1)} className="p-2 hover:bg-white rounded shadow-sm disabled:opacity-30"><ArrowUp size={16} /></button>
                                <button disabled={index === routeOrders.length - 1} onClick={() => moveOrder(index, 1)} className="p-2 hover:bg-white rounded shadow-sm disabled:opacity-30"><ArrowDown size={16} /></button>
                            </div>
                            <button onClick={() => handleMarkDelivered(order)} className="flex-1 bg-slate-800 text-white py-2.5 rounded-lg font-bold text-sm hover:bg-slate-900 flex items-center justify-center gap-2 shadow-md active:scale-95 transition-transform">
                                <CheckCircle size={18} /> Entregado
                            </button>
                        </div>
                    </div>
                )}
            </div>
        );
    };

    return (
        <div className="flex flex-col h-full overflow-hidden bg-slate-50 -m-4 lg:flex-row">
            <div className={`flex-1 flex flex-col h-full overflow-hidden ${activeTab === 'route' ? 'hidden lg:flex' : 'flex'}`}>
                <div className="p-4 bg-white border-b shadow-sm flex-shrink-0 flex justify-between items-center">
                    <h2 className="font-bold text-lg text-slate-700 flex items-center gap-2"><Package className="text-blue-600" /> En Depósito ({readyOrders.length})</h2>
                    <button onClick={() => setActiveTab('route')} className="lg:hidden text-sm font-bold text-blue-600 flex items-center gap-1">Ver Ruta <ArrowUp className="rotate-90" size={16} /></button>
                </div>
                <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-slate-100/50">
                    {readyOrders.length === 0 && <div className="text-center text-slate-400 py-10">No hay pedidos listos para salir.</div>}
                    {readyOrders.map(t => <OrderCard key={t.id} order={t} />)}
                </div>
            </div>

            <div className={`flex-1 flex flex-col h-full overflow-hidden border-l border-slate-200 bg-white ${activeTab === 'pool' ? 'hidden lg:flex' : 'flex'}`}>
                <div className="p-4 bg-slate-800 text-white shadow-md flex-shrink-0 z-10 flex justify-between items-center">
                    <button onClick={() => setActiveTab('pool')} className="lg:hidden text-slate-300"><ArrowUp className="-rotate-90" size={20} /></button>
                    <h2 className="font-bold text-lg flex items-center gap-2"><Truck className="text-yellow-400" /> Mi Ruta ({routeOrders.length})</h2>
                    <div className="w-6"></div>
                </div>
                <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-slate-50 relative">
                    {routeOrders.length === 0 && (
                        <div className="absolute inset-0 flex flex-col items-center justify-center text-slate-400 opacity-60">
                            <Truck size={64} className="mb-4" strokeWidth={1} />
                            <p className="text-center px-10">Agrega pedidos desde el depósito con el botón (+)</p>
                        </div>
                    )}
                    {routeOrders.map((t, i) => <OrderCard key={t.id} order={t} isRoute={true} index={i} />)}
                </div>
                {routeOrders.length > 0 && (
                    <div className="p-4 bg-white border-t text-sm font-bold text-slate-600 flex justify-between">
                        <span>Total a cobrar en ruta:</span>
                        <span className="text-slate-900">${routeOrders.reduce((acc, t) => acc + (t.paymentStatus === 'paid' ? 0 : (t.total - (t.amountPaid || 0))), 0).toLocaleString()}</span>
                    </div>
                )}
            </div>
        </div>
    );
}