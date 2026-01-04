import React, { useState, useEffect } from 'react';
import {
    X,
    Save,
    Trash2,
    Plus,
    CreditCard,
    Banknote,
    User,
    MapPin,
    Phone,
    FileText,
    AlertCircle
} from 'lucide-react'; // Eliminé Smartphone para evitar advertencias
import { useInventory } from '../hooks/useInventory';
import { useCart } from '../hooks/useCart';
import { useTransactions } from '../hooks/useTransactions';
import { usePrinter } from '../hooks/usePrinter'; // Correcto (Named export)
import { uploadImage } from '../config/uploadImage'; // Correcto (Ahora apuntamos a config)
import { compressImage } from '../utils/imageHelpers'; // Asegúrate que imageHelpers esté en utils

const Modals = ({ activeModal, onClose, productToEdit = null }) => {
    // Hooks
    const { addProduct, updateProduct, deleteProduct, categories } = useInventory();
    const { cart, total, clearCart } = useCart();
    const { addTransaction } = useTransactions();
    const { printTicket } = usePrinter();

    // Estados locales
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    // Estado para Producto (Nuevo/Editar)
    const [productForm, setProductForm] = useState({
        name: '',
        price: '',
        cost: '',
        stock: '',
        category: '',
        barcode: '',
        description: '',
        image: null
    });
    const [imageFile, setImageFile] = useState(null);
    const [imagePreview, setImagePreview] = useState(null);

    // Estado para Checkout
    const [checkoutStep, setCheckoutStep] = useState(1); // 1: Resumen/Pago, 2: Cliente
    const [paymentMethod, setPaymentMethod] = useState('cash');
    const [cashAmount, setCashAmount] = useState('');
    const [clientInfo, setClientInfo] = useState({
        name: '',
        phone: '',
        address: '',
        notes: ''
    });

    // Efecto para cargar datos si es edición
    useEffect(() => {
        if (activeModal === 'edit-product' && productToEdit) {
            setProductForm({
                name: productToEdit.name || '',
                price: productToEdit.price || '',
                cost: productToEdit.cost || '',
                stock: productToEdit.stock || '',
                category: productToEdit.category || '',
                barcode: productToEdit.barcode || '',
                description: productToEdit.description || '',
                image: productToEdit.image || null
            });
            setImagePreview(productToEdit.image);
        } else {
            resetProductForm();
        }

        // Resetear checkout al abrir
        if (activeModal === 'checkout') {
            setCheckoutStep(1);
            setPaymentMethod('cash');
            setCashAmount('');
            setClientInfo({ name: '', phone: '', address: '', notes: '' });
        }
    }, [activeModal, productToEdit]);

    const resetProductForm = () => {
        setProductForm({
            name: '',
            price: '',
            cost: '',
            stock: '',
            category: '',
            barcode: '',
            description: '',
            image: null
        });
        setImageFile(null);
        setImagePreview(null);
        setError('');
    };

    // --- MANEJADORES DE PRODUCTOS ---

    const handleImageChange = async (e) => {
        const file = e.target.files[0];
        if (file) {
            try {
                const compressed = await compressImage(file);
                setImageFile(compressed);
                const reader = new FileReader();
                reader.onloadend = () => setImagePreview(reader.result);
                reader.readAsDataURL(compressed);
            } catch (err) {
                setError('Error al procesar la imagen');
            }
        }
    };

    const handleProductSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        setError('');

        try {
            let imageUrl = productForm.image;

            if (imageFile) {
                imageUrl = await uploadImage(imageFile);
            }

            const productData = {
                ...productForm,
                price: parseFloat(productForm.price),
                cost: parseFloat(productForm.cost) || 0,
                stock: parseInt(productForm.stock),
                image: imageUrl,
                updatedAt: new Date().toISOString()
            };

            if (activeModal === 'add-product') {
                await addProduct({
                    ...productData,
                    createdAt: new Date().toISOString()
                });
            } else {
                await updateProduct(productToEdit.id, productData);
            }

            onClose();
        } catch (err) {
            console.error(err);
            setError('Error al guardar el producto');
        } finally {
            setLoading(false);
        }
    };

    const handleDeleteProduct = async () => {
        if (window.confirm('¿Estás seguro de eliminar este producto?')) {
            setLoading(true);
            try {
                await deleteProduct(productToEdit.id);
                onClose();
            } catch (err) {
                setError('Error al eliminar');
            } finally {
                setLoading(false);
            }
        }
    };

    // --- MANEJADORES DE CHECKOUT ---

    const handleCheckout = async () => {
        if (cart.length === 0) return;

        setLoading(true);
        try {
            const transactionData = {
                items: cart.map(item => ({
                    id: item.id,
                    name: item.name,
                    price: item.price,
                    quantity: item.quantity,
                    cost: item.cost || 0
                })),
                total: total,
                subtotal: total,
                paymentMethod,
                cashReceived: paymentMethod === 'cash' ? (parseFloat(cashAmount) || total) : total,
                clientInfo: clientInfo.name ? clientInfo : null,
                date: new Date().toISOString(),
                status: 'completed',
                type: 'sale'
            };

            // 1. Guardar transacción
            const newId = await addTransaction(transactionData);

            // 2. IMPRIMIR TICKET AUTOMÁTICAMENTE (Lógica agregada)
            // Usamos los datos actuales + el ID nuevo + fecha objeto Date
            const ticketData = {
                ...transactionData,
                id: newId,
                date: new Date()
            };

            try {
                await printTicket(ticketData);
            } catch (printError) {
                console.error("Error al abrir ticket automático:", printError);
                alert("Venta guardada. Activa las ventanas emergentes para ver el ticket.");
            }

            // 3. Limpiar y cerrar
            clearCart();
            onClose();

        } catch (err) {
            console.error(err);
            setError('Error al procesar la venta');
        } finally {
            setLoading(false);
        }
    };

    // --- RENDERIZADO DE MODALES ---

    if (!activeModal) return null;

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">

                {/* --- MODAL DE PRODUCTO (Agregar/Editar) --- */}
                {(activeModal === 'add-product' || activeModal === 'edit-product') && (
                    <form onSubmit={handleProductSubmit} className="p-6">
                        <div className="flex justify-between items-center mb-6">
                            <h2 className="text-2xl font-bold text-gray-800">
                                {activeModal === 'add-product' ? 'Nuevo Producto' : 'Editar Producto'}
                            </h2>
                            <button type="button" onClick={onClose} className="text-gray-500 hover:text-gray-700">
                                <X size={24} />
                            </button>
                        </div>

                        {error && (
                            <div className="bg-red-50 text-red-600 p-3 rounded-lg mb-4 flex items-center gap-2">
                                <AlertCircle size={20} />
                                {error}
                            </div>
                        )}

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            {/* Imagen */}
                            <div className="md:col-span-2 flex justify-center">
                                <div className="relative group cursor-pointer w-full max-w-xs h-48 bg-gray-100 rounded-lg border-2 border-dashed border-gray-300 flex items-center justify-center overflow-hidden">
                                    <input
                                        type="file"
                                        accept="image/*"
                                        onChange={handleImageChange}
                                        className="absolute inset-0 opacity-0 cursor-pointer"
                                    />
                                    {imagePreview ? (
                                        <img src={imagePreview} alt="Preview" className="w-full h-full object-cover" />
                                    ) : (
                                        <div className="text-center text-gray-500">
                                            <Plus className="mx-auto mb-2" />
                                            <span>Subir Imagen</span>
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* Campos Básicos */}
                            <div className="space-y-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Nombre</label>
                                    <input
                                        type="text"
                                        required
                                        value={productForm.name}
                                        onChange={(e) => setProductForm({ ...productForm, name: e.target.value })}
                                        className="w-full p-2 border rounded-lg focus:ring-2 focus:ring-indigo-500"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Categoría</label>
                                    <select
                                        value={productForm.category}
                                        onChange={(e) => setProductForm({ ...productForm, category: e.target.value })}
                                        className="w-full p-2 border rounded-lg focus:ring-2 focus:ring-indigo-500"
                                    >
                                        <option value="">Seleccionar...</option>
                                        {categories.map(cat => (
                                            <option key={cat} value={cat}>{cat}</option>
                                        ))}
                                        <option value="new">+ Nueva Categoría</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Código de Barras</label>
                                    <input
                                        type="text"
                                        value={productForm.barcode}
                                        onChange={(e) => setProductForm({ ...productForm, barcode: e.target.value })}
                                        className="w-full p-2 border rounded-lg focus:ring-2 focus:ring-indigo-500"
                                    />
                                </div>
                            </div>

                            {/* Campos Numéricos */}
                            <div className="space-y-4">
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">Precio ($)</label>
                                        <input
                                            type="number"
                                            required
                                            min="0"
                                            step="0.01"
                                            value={productForm.price}
                                            onChange={(e) => setProductForm({ ...productForm, price: e.target.value })}
                                            className="w-full p-2 border rounded-lg focus:ring-2 focus:ring-indigo-500"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">Costo ($)</label>
                                        <input
                                            type="number"
                                            min="0"
                                            step="0.01"
                                            value={productForm.cost}
                                            onChange={(e) => setProductForm({ ...productForm, cost: e.target.value })}
                                            className="w-full p-2 border rounded-lg focus:ring-2 focus:ring-indigo-500"
                                        />
                                    </div>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Stock Actual</label>
                                    <input
                                        type="number"
                                        required
                                        value={productForm.stock}
                                        onChange={(e) => setProductForm({ ...productForm, stock: e.target.value })}
                                        className="w-full p-2 border rounded-lg focus:ring-2 focus:ring-indigo-500"
                                    />
                                </div>
                            </div>
                        </div>

                        <div className="mt-6 flex justify-end gap-3">
                            {activeModal === 'edit-product' && (
                                <button
                                    type="button"
                                    onClick={handleDeleteProduct}
                                    className="px-4 py-2 text-red-600 hover:bg-red-50 rounded-lg flex items-center gap-2 mr-auto"
                                >
                                    <Trash2 size={20} /> Eliminar
                                </button>
                            )}
                            <button
                                type="button"
                                onClick={onClose}
                                className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg"
                            >
                                Cancelar
                            </button>
                            <button
                                type="submit"
                                disabled={loading}
                                className="px-6 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 flex items-center gap-2"
                            >
                                {loading ? 'Guardando...' : (
                                    <>
                                        <Save size={20} />
                                        Guardar
                                    </>
                                )}
                            </button>
                        </div>
                    </form>
                )}

                {/* --- MODAL DE CHECKOUT --- */}
                {activeModal === 'checkout' && (
                    <div className="p-6">
                        <div className="flex justify-between items-center mb-6">
                            <h2 className="text-2xl font-bold text-gray-800">
                                {checkoutStep === 1 ? 'Resumen de Venta' : 'Datos del Cliente (Opcional)'}
                            </h2>
                            <button onClick={onClose} className="text-gray-500 hover:text-gray-700">
                                <X size={24} />
                            </button>
                        </div>

                        {/* Pasos de Navegación */}
                        <div className="flex mb-6 border-b">
                            <button
                                onClick={() => setCheckoutStep(1)}
                                className={`pb-2 px-4 font-medium ${checkoutStep === 1 ? 'text-indigo-600 border-b-2 border-indigo-600' : 'text-gray-500'}`}
                            >
                                1. Pago
                            </button>
                            <button
                                onClick={() => setCheckoutStep(2)}
                                className={`pb-2 px-4 font-medium ${checkoutStep === 2 ? 'text-indigo-600 border-b-2 border-indigo-600' : 'text-gray-500'}`}
                            >
                                2. Cliente / Delivery
                            </button>
                        </div>

                        {/* CONTENIDO PASO 1: PAGO */}
                        {checkoutStep === 1 && (
                            <div className="space-y-6">
                                <div className="bg-gray-50 p-4 rounded-lg">
                                    <div className="flex justify-between text-lg font-bold text-gray-800 mb-2">
                                        <span>Total a Pagar:</span>
                                        <span>${total.toFixed(2)}</span>
                                    </div>
                                    <div className="text-sm text-gray-500">
                                        {cart.reduce((acc, item) => acc + item.quantity, 0)} artículos
                                    </div>
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-3">Método de Pago</label>
                                    <div className="grid grid-cols-2 gap-3">
                                        <button
                                            onClick={() => setPaymentMethod('cash')}
                                            className={`p-3 rounded-lg border-2 flex flex-col items-center gap-2 transition-all ${paymentMethod === 'cash' ? 'border-indigo-600 bg-indigo-50 text-indigo-700' : 'border-gray-200 hover:border-gray-300'
                                                }`}
                                        >
                                            <Banknote size={24} />
                                            <span>Efectivo</span>
                                        </button>
                                        <button
                                            onClick={() => setPaymentMethod('card')}
                                            className={`p-3 rounded-lg border-2 flex flex-col items-center gap-2 transition-all ${paymentMethod === 'card' ? 'border-indigo-600 bg-indigo-50 text-indigo-700' : 'border-gray-200 hover:border-gray-300'
                                                }`}
                                        >
                                            <CreditCard size={24} />
                                            <span>Tarjeta / Transferencia</span>
                                        </button>
                                    </div>
                                </div>

                                {paymentMethod === 'cash' && (
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">Monto Recibido</label>
                                        <div className="relative">
                                            <span className="absolute left-3 top-2.5 text-gray-500">$</span>
                                            <input
                                                type="number"
                                                value={cashAmount}
                                                onChange={(e) => setCashAmount(e.target.value)}
                                                placeholder={total.toFixed(2)}
                                                className="w-full pl-7 p-2 border rounded-lg text-lg"
                                            />
                                        </div>
                                        {parseFloat(cashAmount) > total && (
                                            <div className="mt-2 text-green-600 font-medium flex justify-between p-2 bg-green-50 rounded">
                                                <span>Vuelto:</span>
                                                <span>${(parseFloat(cashAmount) - total).toFixed(2)}</span>
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                        )}

                        {/* CONTENIDO PASO 2: CLIENTE */}
                        {checkoutStep === 2 && (
                            <div className="space-y-4">
                                <div className="bg-blue-50 p-3 rounded text-sm text-blue-800 flex gap-2">
                                    <AlertCircle size={16} className="mt-0.5" />
                                    <p>Si es una venta rápida de mostrador, puedes dejar estos campos vacíos.</p>
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Nombre Cliente</label>
                                    <div className="relative">
                                        <User className="absolute left-3 top-2.5 text-gray-400 h-5 w-5" />
                                        <input
                                            type="text"
                                            value={clientInfo.name}
                                            onChange={(e) => setClientInfo({ ...clientInfo, name: e.target.value })}
                                            className="w-full pl-10 p-2 border rounded-lg"
                                            placeholder="Consumidor Final"
                                        />
                                    </div>
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Teléfono</label>
                                    <div className="relative">
                                        <Phone className="absolute left-3 top-2.5 text-gray-400 h-5 w-5" />
                                        <input
                                            type="tel"
                                            value={clientInfo.phone}
                                            onChange={(e) => setClientInfo({ ...clientInfo, phone: e.target.value })}
                                            className="w-full pl-10 p-2 border rounded-lg"
                                            placeholder="Ej: 351..."
                                        />
                                    </div>
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Dirección / Notas</label>
                                    <div className="relative">
                                        <MapPin className="absolute left-3 top-2.5 text-gray-400 h-5 w-5" />
                                        <textarea
                                            value={clientInfo.address}
                                            onChange={(e) => setClientInfo({ ...clientInfo, address: e.target.value })}
                                            className="w-full pl-10 p-2 border rounded-lg"
                                            rows="3"
                                            placeholder="Dirección de envío o notas..."
                                        ></textarea>
                                    </div>
                                </div>
                            </div>
                        )}

                        <div className="mt-8 flex justify-between items-center">
                            {checkoutStep === 2 ? (
                                <button
                                    onClick={() => setCheckoutStep(1)}
                                    className="text-indigo-600 font-medium hover:underline"
                                >
                                    &larr; Volver al pago
                                </button>
                            ) : (
                                <span className="text-gray-500 text-sm">Paso 1 de 2</span>
                            )}

                            <div className="flex gap-3">
                                {checkoutStep === 1 ? (
                                    <button
                                        onClick={() => setCheckoutStep(2)}
                                        className="px-6 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200"
                                    >
                                        Datos Cliente &rarr;
                                    </button>
                                ) : null}

                                <button
                                    onClick={handleCheckout}
                                    disabled={loading}
                                    className="px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 flex items-center gap-2 shadow-sm"
                                >
                                    {loading ? 'Procesando...' : (
                                        <>
                                            <FileText size={20} />
                                            Confirmar Venta
                                        </>
                                    )}
                                </button>
                            </div>
                        </div>
                    </div>
                )}

            </div>
        </div>
    );
};

export default Modals;
export const ProductModal = Modals;
export const CheckoutModal = Modals; // O como lo uses
export const CategoryModal = () => null; // Si no los usas por separado aún, ponlos así para que no den error
export const CustomerModal = () => null;
export const StoreModal = () => null;
export const AddStockModal = () => null;
export const TransactionModal = () => null;
export const LogoutConfirmModal = () => null;
export const InvitationModal = () => null;
export const ProcessingModal = () => null;
export const ConfirmModal = () => null;
export const ExpenseModal = () => null;