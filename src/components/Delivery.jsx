import React, { useState } from 'react';
// 🛡️ IMPORTANTE: Usamos el Contexto para estar siempre sincronizados
import { useTransactionsContext } from '../context/TransactionsContext';
import {
    Clock,
    MapPin,
    Phone,
    CheckCircle,
    Truck,
    XCircle,
    ShoppingBag,
    RefreshCw
} from 'lucide-react';

const Delivery = () => {
    // Extraemos los datos y funciones del contexto global
    const { transactions, updateTransaction, loading } = useTransactionsContext();
    const [statusFilter, setStatusFilter] = useState('active'); // 'active', 'completed'

    // 🛡️ FILTRO: Solo pedidos marcados como delivery y ordenados por fecha
    const deliveryOrders = transactions
        .filter(t => t.deliveryType === 'delivery')
        .sort((a, b) => (b.date?.seconds || 0) - (a.date?.seconds || 0));

    // Filtrado por pestaña (Activos vs Historial)
    const filteredOrders = deliveryOrders.filter(order => {
        if (statusFilter === 'active') return ['pending', 'preparing', 'delivering'].includes(order.status);
        if (statusFilter === 'completed') return ['completed', 'cancelled'].includes(order.status);
        return true;
    });

    const getStatusColor = (status) => {
        switch (status) {
            case 'pending': return 'bg-yellow-100 text-yellow-800';
            case 'preparing': return 'bg-blue-100 text-blue-800';
            case 'delivering': return 'bg-purple-100 text-purple-800';
            case 'completed': return 'bg-green-100 text-green-800';
            case 'cancelled': return 'bg-red-100 text-red-800';
            default: return 'bg-gray-100 text-gray-800';
        }
    };

    const getStatusText = (status) => {
        switch (status) {
            case 'pending': return 'Pendiente';
            case 'preparing': return 'Preparando';
            case 'delivering': return 'En Camino';
            case 'completed': return 'Entregado';
            case 'cancelled': return 'Cancelado';
            default: return status;
        }
    };

    const handleStatusUpdate = async (orderId, newStatus) => {
        if (window.confirm(`¿Cambiar estado a ${getStatusText(newStatus)}?`)) {
            try {
                // Buscamos la orden actual para mantener el monto pagado (evitar error undefined)
                const currentOrder = transactions.find(t => t.id === orderId);

                await updateTransaction(orderId, {
                    status: newStatus,
                    fulfillmentStatus: newStatus === 'completed' ? 'delivered' : 'pending',
                    // 🛡️ Protección contra valores undefined en Firebase
                    amountPaid: currentOrder?.amountPaid ?? 0
                });
            } catch (error) {
                console.error("Error al actualizar:", error);
                alert("Ocurrió un error al actualizar el pedido.");
            }
        }
    };

    if (loading) {
        return (
            <div className="flex justify-center items-center h-full">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
            </div>
        );
    }

    return (
        <div className="bg-white p-3 md:p-6 rounded-lg shadow-sm h-[calc(100dvh-80px)] md:h-[calc(100vh-100px)] overflow-y-auto">

            {/* Cabecera */}
            <div className="flex justify-between items-center mb-6">
                <h2 className="text-xl md:text-2xl font-bold text-gray-800 flex items-center gap-2">
                    <Truck className="h-7 w-7 text-indigo-600" />
                    Gestión de Reparto
                </h2>
            </div>

            {/* Pestañas / Filtros */}
            <div className="flex space-x-2 mb-6 border-b overflow-x-auto pb-2 scrollbar-hide">
                <button
                    onClick={() => setStatusFilter('active')}
                    className={`px-6 py-2 rounded-t-xl font-bold whitespace-nowrap transition-all ${statusFilter === 'active'
                            ? 'bg-indigo-50 text-indigo-600 border-b-4 border-indigo-600'
                            : 'text-gray-400 hover:text-gray-600'
                        }`}
                >
                    Pedidos Activos ({deliveryOrders.filter(o => ['pending', 'preparing', 'delivering'].includes(o.status)).length})
                </button>
                <button
                    onClick={() => setStatusFilter('completed')}
                    className={`px-6 py-2 rounded-t-xl font-bold whitespace-nowrap transition-all ${statusFilter === 'completed'
                            ? 'bg-indigo-50 text-indigo-600 border-b-4 border-indigo-600'
                            : 'text-gray-400 hover:text-gray-600'
                        }`}
                >
                    Historial de Envíos
                </button>
            </div>

            {/* Listado de Pedidos */}
            {filteredOrders.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-20 text-gray-300">
                    <ShoppingBag size={64} className="mb-4 opacity-20" />
                    <p className="text-lg font-bold">No hay pedidos en esta sección</p>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                    {filteredOrders.map((order) => (
                        <div key={order.id} className="bg-white border-2 border-slate-100 rounded-2xl p-5 hover:shadow-xl hover:border-indigo-100 transition-all flex flex-col group">

                            {/* Info de Cliente y Tiempo */}
                            <div className="flex justify-between items-start mb-4">
                                <div className="min-w-0">
                                    <h3 className="font-black text-slate-800 text-lg truncate uppercase italic">
                                        {order.clientInfo?.name || 'Cliente sin nombre'}
                                    </h3>
                                    <div className="flex items-center text-xs font-bold text-slate-400 gap-1.5 mt-1">
                                        <Clock size={14} />
                                        {order.date?.seconds
                                            ? new Date(order.date.seconds * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                                            : 'Sincronizando...'}
                                    </div>
                                </div>
                                <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider shadow-sm ${getStatusColor(order.status)}`}>
                                    {getStatusText(order.status)}
                                </span>
                            </div>

                            {/* Contacto y Dirección */}
                            <div className="space-y-3 mb-5">
                                <div className="flex items-start gap-3 bg-slate-50 p-3 rounded-xl border border-slate-100">
                                    <MapPin size={18} className="text-slate-400 shrink-0 mt-0.5" />
                                    <span className="text-sm font-bold text-slate-600 leading-snug">
                                        {order.clientInfo?.address || 'Retira en local / Sin dirección'}
                                    </span>
                                </div>
                                {order.clientInfo?.phone && (
                                    <div className="flex items-center gap-3 px-1">
                                        <Phone size={16} className="text-green-500" />
                                        <a href={`tel:${order.clientInfo.phone}`} className="text-sm font-black text-indigo-600 hover:underline">
                                            {order.clientInfo.phone}
                                        </a>
                                    </div>
                                )}
                            </div>

                            {/* Detalle de Productos (qty corregido) */}
                            <div className="bg-white rounded-2xl border-2 border-slate-50 mb-5 overflow-hidden flex-1 shadow-inner">
                                <div className="p-3 bg-slate-50/50 flex justify-between items-center border-b border-slate-50">
                                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Productos</span>
                                    <span className="font-black text-slate-800 text-sm">${order.total?.toLocaleString()}</span>
                                </div>
                                <ul className="p-3 space-y-2">
                                    {order.items?.map((item, idx) => (
                                        <li key={idx} className="flex justify-between items-center text-xs">
                                            <span className="text-slate-500 font-bold truncate pr-4">
                                                <span className="text-indigo-600 font-black mr-1">{item.qty}x</span> {item.name}
                                            </span>
                                            <span className="text-slate-800 font-black shrink-0">
                                                ${(item.price * item.qty).toLocaleString()}
                                            </span>
                                        </li>
                                    ))}
                                </ul>
                            </div>

                            {/* Botones de Acción (Solo en activos) */}
                            {statusFilter === 'active' && (
                                <div className="grid grid-cols-2 gap-2 mt-auto">
                                    {order.status === 'pending' && (
                                        <button
                                            onClick={() => handleStatusUpdate(order.id, 'preparing')}
                                            className="col-span-2 bg-blue-600 text-white py-3 rounded-xl font-black uppercase text-xs tracking-widest hover:bg-blue-700 shadow-lg shadow-blue-100 transition-all active:scale-95"
                                        >
                                            Empezar a Preparar
                                        </button>
                                    )}
                                    {order.status === 'preparing' && (
                                        <button
                                            onClick={() => handleStatusUpdate(order.id, 'delivering')}
                                            className="col-span-2 bg-purple-600 text-white py-3 rounded-xl font-black uppercase text-xs tracking-widest hover:bg-purple-700 shadow-lg shadow-purple-100 transition-all active:scale-95"
                                        >
                                            Enviar con Repartidor
                                        </button>
                                    )}
                                    {order.status === 'delivering' && (
                                        <>
                                            <button
                                                onClick={() => handleStatusUpdate(order.id, 'completed')}
                                                className="flex items-center justify-center gap-2 bg-green-600 text-white py-3 rounded-xl font-black uppercase text-xs tracking-widest hover:bg-green-700 shadow-lg shadow-green-100 transition-all active:scale-95"
                                            >
                                                <CheckCircle size={14} /> Entregado
                                            </button>
                                            <button
                                                onClick={() => handleStatusUpdate(order.id, 'cancelled')}
                                                className="bg-red-50 text-red-600 py-3 rounded-xl font-black uppercase text-xs tracking-widest border-2 border-red-100 hover:bg-red-100 transition-all"
                                            >
                                                X
                                            </button>
                                        </>
                                    )}
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};

export default Delivery;