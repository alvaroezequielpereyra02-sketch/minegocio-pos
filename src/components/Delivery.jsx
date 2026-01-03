import React, { useState } from 'react';
import { useTransactions } from '../hooks/useTransactions';
import {
    Clock,
    MapPin,
    Phone,
    CheckCircle,
    Truck,
    XCircle,
    RefreshCw,
    ShoppingBag
} from 'lucide-react';

const Delivery = () => {
    const { transactions, updateTransactionStatus, refreshTransactions, loading } = useTransactions();
    const [statusFilter, setStatusFilter] = useState('active'); // 'active', 'completed', 'all'

    // Filtrar solo transacciones que sean para "delivery" (asumiendo que tienes un campo deliveryType o similar)
    // Si tu app guarda todo junto, ajusta este filtro.
    const deliveryOrders = transactions
        .filter(t => t.deliveryType === 'delivery')
        .sort((a, b) => new Date(b.date) - new Date(a.date));

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
            await updateTransactionStatus(orderId, newStatus);
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
        // AJUSTE MÓVIL: p-3 en celular, p-6 en PC. Altura dinámica (dvh) para móviles.
        <div className="bg-white p-3 md:p-6 rounded-lg shadow-sm h-[calc(100dvh-80px)] md:h-[calc(100vh-100px)] overflow-y-auto">

            {/* Header */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-4 md:mb-6 gap-3">
                {/* AJUSTE MÓVIL: Texto más pequeño en celular (text-xl) */}
                <h2 className="text-xl md:text-2xl font-bold text-gray-800 flex items-center gap-2">
                    <Truck className="h-6 w-6 text-indigo-600" />
                    Pedidos y Envíos
                </h2>

                <button
                    onClick={refreshTransactions}
                    className="p-2 hover:bg-gray-100 rounded-full transition-colors self-end sm:self-auto"
                    title="Actualizar lista"
                >
                    <RefreshCw className="h-5 w-5 text-gray-500" />
                </button>
            </div>

            {/* Filtros (Tabs) */}
            <div className="flex space-x-2 mb-6 border-b overflow-x-auto pb-2">
                <button
                    onClick={() => setStatusFilter('active')}
                    className={`px-4 py-2 rounded-t-lg font-medium whitespace-nowrap transition-colors ${statusFilter === 'active'
                            ? 'bg-indigo-50 text-indigo-600 border-b-2 border-indigo-600'
                            : 'text-gray-500 hover:text-gray-700'
                        }`}
                >
                    Activos ({deliveryOrders.filter(o => ['pending', 'preparing', 'delivering'].includes(o.status)).length})
                </button>
                <button
                    onClick={() => setStatusFilter('completed')}
                    className={`px-4 py-2 rounded-t-lg font-medium whitespace-nowrap transition-colors ${statusFilter === 'completed'
                            ? 'bg-indigo-50 text-indigo-600 border-b-2 border-indigo-600'
                            : 'text-gray-500 hover:text-gray-700'
                        }`}
                >
                    Historial
                </button>
            </div>

            {/* Grid de Tarjetas */}
            {filteredOrders.length === 0 ? (
                <div className="text-center py-12 text-gray-500">
                    <ShoppingBag className="h-12 w-12 mx-auto mb-3 opacity-20" />
                    <p>No hay pedidos en esta categoría</p>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                    {filteredOrders.map((order) => (
                        <div key={order.id} className="border rounded-lg p-4 hover:shadow-md transition-shadow bg-gray-50">

                            {/* Encabezado de la Tarjeta */}
                            <div className="flex justify-between items-start mb-3">
                                <div>
                                    <h3 className="font-bold text-lg text-gray-800">{order.clientInfo?.name || 'Cliente sin nombre'}</h3>
                                    <div className="flex items-center text-sm text-gray-500 gap-1 mt-1">
                                        <Clock className="h-3 w-3" />
                                        {new Date(order.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                    </div>
                                </div>
                                <span className={`px-2 py-1 rounded-full text-xs font-semibold ${getStatusColor(order.status)}`}>
                                    {getStatusText(order.status)}
                                </span>
                            </div>

                            {/* Información de Contacto */}
                            <div className="space-y-2 mb-4 text-sm">
                                {order.clientInfo?.address && (
                                    <div className="flex items-start gap-2">
                                        <MapPin className="h-4 w-4 text-gray-400 mt-0.5 shrink-0" />
                                        <span className="text-gray-600 break-words">{order.clientInfo.address}</span>
                                    </div>
                                )}
                                {order.clientInfo?.phone && (
                                    <div className="flex items-center gap-2">
                                        <Phone className="h-4 w-4 text-gray-400 shrink-0" />
                                        <a href={`tel:${order.clientInfo.phone}`} className="text-indigo-600 hover:underline">
                                            {order.clientInfo.phone}
                                        </a>
                                    </div>
                                )}
                            </div>

                            {/* Detalle de Items (Resumido) */}
                            <div className="bg-white p-3 rounded border mb-4 text-sm">
                                <div className="flex justify-between font-medium mb-2 border-b pb-1">
                                    <span>Total</span>
                                    <span>${order.total?.toFixed(2)}</span>
                                </div>
                                <ul className="space-y-1 text-gray-600">
                                    {order.items?.map((item, idx) => (
                                        <li key={idx} className="flex justify-between">
                                            <span className="truncate pr-2">{item.quantity}x {item.name}</span>
                                            <span className="shrink-0">${(item.price * item.quantity).toFixed(2)}</span>
                                        </li>
                                    ))}
                                </ul>
                            </div>

                            {/* Botones de Acción */}
                            {statusFilter === 'active' && (
                                <div className="grid grid-cols-2 gap-2 mt-auto">
                                    {order.status === 'pending' && (
                                        <button
                                            onClick={() => handleStatusUpdate(order.id, 'preparing')}
                                            className="col-span-2 flex items-center justify-center gap-2 bg-blue-600 text-white py-2 rounded hover:bg-blue-700 transition-colors"
                                        >
                                            <ShoppingBag className="h-4 w-4" />
                                            Preparar
                                        </button>
                                    )}

                                    {order.status === 'preparing' && (
                                        <button
                                            onClick={() => handleStatusUpdate(order.id, 'delivering')}
                                            className="col-span-2 flex items-center justify-center gap-2 bg-purple-600 text-white py-2 rounded hover:bg-purple-700 transition-colors"
                                        >
                                            <Truck className="h-4 w-4" />
                                            Enviar
                                        </button>
                                    )}

                                    {order.status === 'delivering' && (
                                        <>
                                            <button
                                                onClick={() => handleStatusUpdate(order.id, 'completed')}
                                                className="flex items-center justify-center gap-1 bg-green-600 text-white py-2 rounded hover:bg-green-700 transition-colors text-sm"
                                            >
                                                <CheckCircle className="h-4 w-4" />
                                                Entregado
                                            </button>
                                            <button
                                                onClick={() => handleStatusUpdate(order.id, 'cancelled')}
                                                className="flex items-center justify-center gap-1 bg-red-100 text-red-600 py-2 rounded hover:bg-red-200 transition-colors text-sm"
                                            >
                                                <XCircle className="h-4 w-4" />
                                                Cancelar
                                            </button>
                                        </>
                                    )}

                                    {order.status === 'pending' && (
                                        <button
                                            onClick={() => handleStatusUpdate(order.id, 'cancelled')}
                                            className="col-span-2 mt-2 flex items-center justify-center gap-1 text-red-500 hover:text-red-700 text-sm"
                                        >
                                            Cancelar Pedido
                                        </button>
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