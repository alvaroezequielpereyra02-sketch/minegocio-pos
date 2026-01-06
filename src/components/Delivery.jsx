import React, { useState } from 'react';
// 1. IMPORTANTE: Usamos el contexto para que el reparto se actualice en tiempo real
import { useTransactionsContext } from '../context/TransactionsContext';
import {
    Clock,
    MapPin,
    Phone,
    CheckCircle,
    Truck,
    XCircle,
    ShoppingBag
} from 'lucide-react';

const Delivery = () => {
    // 2. Extraemos las funciones y datos del contexto global
    const { transactions, updateTransaction } = useTransactionsContext();
    const [statusFilter, setStatusFilter] = useState('active');

    // 3. FILTRO DE DELIVERY: Busca la etiqueta que pusimos en handleCheckout
    const deliveryOrders = transactions
        .filter(t => t.deliveryType === 'delivery')
        .sort((a, b) => (b.date?.seconds || 0) - (a.date?.seconds || 0));

    // 4. FILTRO POR ESTADO (Activos vs Completados)
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

    // 5. FUNCIÓN DE ACTUALIZACIÓN CORREGIDA
    const handleStatusUpdate = async (orderId, newStatus) => {
        if (window.confirm(`¿Cambiar estado a ${getStatusText(newStatus)}?`)) {
            try {
                // Actualizamos el status para este componente y fulfillmentStatus para el historial
                await updateTransaction(orderId, {
                    status: newStatus,
                    fulfillmentStatus: newStatus === 'completed' ? 'delivered' : 'pending'
                });
            } catch (error) {
                alert("Error al actualizar el pedido");
            }
        }
    };

    return (
        <div className="bg-white p-3 md:p-6 rounded-lg shadow-sm h-[calc(100dvh-80px)] md:h-[calc(100vh-100px)] overflow-y-auto">
            {/* Cabecera */}
            <div className="flex justify-between items-center mb-6">
                <h2 className="text-xl md:text-2xl font-bold text-gray-800 flex items-center gap-2">
                    <Truck className="h-6 w-6 text-indigo-600" />
                    Gestión de Reparto
                </h2>
            </div>

            {/* Pestañas de Filtro */}
            <div className="flex space-x-2 mb-6 border-b overflow-x-auto pb-2">
                <button
                    onClick={() => setStatusFilter('active')}
                    className={`px-4 py-2 rounded-t-lg font-medium whitespace-nowrap transition-colors ${statusFilter === 'active' ? 'bg-indigo-50 text-indigo-600 border-b-2 border-indigo-600' : 'text-gray-500'}`}
                >
                    Activos ({deliveryOrders.filter(o => ['pending', 'preparing', 'delivering'].includes(o.status)).length})
                </button>
                <button
                    onClick={() => setStatusFilter('completed')}
                    className={`px-4 py-2 rounded-t-lg font-medium whitespace-nowrap transition-colors ${statusFilter === 'completed' ? 'bg-indigo-50 text-indigo-600 border-b-2 border-indigo-600' : 'text-gray-500'}`}
                >
                    Historial
                </button>
            </div>

            {/* Grid de Pedidos */}
            {filteredOrders.length === 0 ? (
                <div className="text-center py-12 text-gray-500">
                    <ShoppingBag className="h-12 w-12 mx-auto mb-3 opacity-20" />
                    <p>No hay pedidos de reparto en esta lista</p>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                    {filteredOrders.map((order) => (
                        <div key={order.id} className="border rounded-lg p-4 hover:shadow-md transition-shadow bg-gray-50 flex flex-col shadow-sm">

                            {/* Info de Cliente y Hora */}
                            <div className="flex justify-between items-start mb-3">
                                <div className="min-w-0">
                                    <h3 className="font-bold text-lg text-gray-800 truncate">{order.clientInfo?.name || 'Cliente'}</h3>
                                    <div className="flex items-center text-sm text-gray-500 gap-1 mt-1">
                                        <Clock className="h-3 w-3" />
                                        {/* CORRECCIÓN: Manejo de fecha de Firebase */}
                                        {order.date?.seconds
                                            ? new Date(order.date.seconds * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                                            : 'Sincronizando...'}
                                    </div>
                                </div>
                                <span className={`px-2 py-1 rounded-full text-[10px] font-bold uppercase shrink-0 ${getStatusColor(order.status)}`}>
                                    {getStatusText(order.status)}
                                </span>
                            </div>

                            {/* Dirección y Teléfono */}
                            <div className="space-y-2 mb-4 text-sm">
                                <div className="flex items-start gap-2">
                                    <MapPin className="h-4 w-4 text-gray-400 mt-0.5 shrink-0" />
                                    <span className="text-gray-600 font-medium line-clamp-2">
                                        {order.clientInfo?.address || 'Sin dirección de entrega'}
                                    </span>
                                </div>
                                {order.clientInfo?.phone && (
                                    <div className="flex items-center gap-2">
                                        <Phone className="h-4 w-4 text-gray-400 shrink-0" />
                                        <a href={`tel:${order.clientInfo.phone}`} className="text-indigo-600 font-bold hover:underline">
                                            {order.clientInfo.phone}
                                        </a>
                                    </div>
                                )}
                            </div>

                            {/* Detalle de Productos */}
                            <div className="bg-white p-3 rounded border mb-4 text-sm flex-1">
                                <div className="flex justify-between font-bold mb-2 border-b pb-1">
                                    <span>Total</span>
                                    <span className="text-indigo-600">${order.total?.toLocaleString()}</span>
                                </div>
                                <ul className="space-y-1 text-gray-600">
                                    {order.items?.map((item, idx) => (
                                        <li key={idx} className="flex justify-between gap-2">
                                            <span className="truncate">{item.qty}x {item.name}</span>
                                            <span className="shrink-0 font-medium">${(item.price * item.qty).toLocaleString()}</span>
                                        </li>
                                    ))}
                                </ul>
                            </div>

                            {/* Botones de Cambio de Estado */}
                            {statusFilter === 'active' && (
                                <div className="grid grid-cols-2 gap-2 mt-auto">
                                    {order.status === 'pending' && (
                                        <button onClick={() => handleStatusUpdate(order.id, 'preparing')} className="col-span-2 bg-blue-600 text-white py-2 rounded-lg font-bold hover:bg-blue-700 transition-colors">Preparar Pedido</button>
                                    )}
                                    {order.status === 'preparing' && (
                                        <button onClick={() => handleStatusUpdate(order.id, 'delivering')} className="col-span-2 bg-purple-600 text-white py-2 rounded-lg font-bold hover:bg-purple-700 transition-colors">Enviar Pedido</button>
                                    )}
                                    {order.status === 'delivering' && (
                                        <>
                                            <button onClick={() => handleStatusUpdate(order.id, 'completed')} className="bg-green-600 text-white py-2 rounded-lg font-bold flex items-center justify-center gap-1 hover:bg-green-700"><CheckCircle size={16} /> Entregado</button>
                                            <button onClick={() => handleStatusUpdate(order.id, 'cancelled')} className="bg-red-50 text-red-600 py-2 rounded-lg font-bold border border-red-100 hover:bg-red-100">X</button>
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