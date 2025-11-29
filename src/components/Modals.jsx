import React, { useState, useEffect } from 'react';
import { X, Trash2, ScanBarcode, Box, AlertTriangle, LogOut, Plus, Minus, CheckCircle, ArrowLeft } from 'lucide-react';

// Estilo base para el fondo oscuro de los modales
const modalOverlayClass = "fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-[200] backdrop-blur-sm animate-in fade-in duration-200";

// (Mantener los otros modales igual: ExpenseModal, ProductModal, etc...)
// SOLO PEGO DE NUEVO LOS MODALES PEQUEÑOS PARA QUE TENGAS EL ARCHIVO COMPLETO,
// EL CAMBIO IMPORTANTE ESTÁ AL FINAL EN TransactionModal.

export function ExpenseModal({ onClose, onSave }) {
    return (
        <div className={modalOverlayClass}>
            <div className="bg-white rounded-2xl w-full max-w-sm p-6 space-y-4 shadow-2xl animate-in zoom-in-95 duration-200">
                <div className="flex justify-between items-center"><h3 className="font-bold text-lg text-red-600">Registrar Gasto</h3><button onClick={onClose}><X size={20}/></button></div>
                <form onSubmit={onSave} className="space-y-3">
                    <label className="block text-sm text-slate-500">Descripción</label><input name="description" required className="w-full p-2 border rounded" placeholder="Ej: Combustible, Luz..." />
                    <label className="block text-sm text-slate-500">Monto</label><input name="amount" type="number" required className="w-full p-2 border rounded text-red-600 font-bold" placeholder="0.00" />
                    <button type="submit" className="w-full bg-red-600 text-white font-bold py-2 rounded">Guardar Gasto</button>
                </form>
            </div>
        </div>
    );
}

export function ProductModal({ onClose, onSave, onDelete, editingProduct, imageMode, setImageMode, previewImage, setPreviewImage, handleFileChange, categories }) {
    return (
        <div className={modalOverlayClass}>
            <div className="bg-white rounded-2xl w-full max-w-md p-6 space-y-4 shadow-2xl overflow-y-auto max-h-[90vh] animate-in zoom-in-95 duration-200">
                <div className="flex justify-between items-center"><h3 className="font-bold text-lg">{editingProduct ? 'Editar' : 'Nuevo'} Producto</h3>{editingProduct && <button onClick={() => onDelete(editingProduct.id)} className="text-red-500 text-sm underline">Eliminar</button>}</div>
                <form onSubmit={onSave} className="space-y-3">
                    <input required name="name" defaultValue={editingProduct?.name} className="w-full p-2 border rounded" placeholder="Nombre" />
                    <div className="flex gap-2 items-center border p-2 rounded bg-slate-50"><ScanBarcode size={16} className="text-slate-400"/><input name="barcode" defaultValue={editingProduct?.barcode} className="w-full bg-transparent outline-none text-sm" placeholder="Código de Barras (Opcional)" /></div>
                    <div className="grid grid-cols-2 gap-2"><div><label className="text-xs text-slate-500 font-bold">Precio Venta</label><input required name="price" type="number" defaultValue={editingProduct?.price} className="w-full p-2 border rounded" /></div><div><label className="text-xs text-slate-500 font-bold">Costo Compra</label><input name="cost" type="number" defaultValue={editingProduct?.cost || ''} className="w-full p-2 border rounded" placeholder="0.00" /></div></div>
                    <div><label className="text-xs text-slate-500 font-bold">Stock</label><input required name="stock" type="number" defaultValue={editingProduct?.stock} className="w-full p-2 border rounded" /></div>
                    <select name="category" defaultValue={editingProduct?.categoryId || ""} className="w-full p-2 border rounded bg-white"><option value="">Sin Categoría</option>{categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select>
                    <div className="flex gap-2 bg-slate-100 p-1 rounded"><button type="button" onClick={()=>{setImageMode('file'); setPreviewImage('')}} className={`flex-1 py-1 text-xs rounded ${imageMode==='file'?'bg-white shadow':''}`}>Subir</button><button type="button" onClick={()=>{setImageMode('link'); setPreviewImage('')}} className={`flex-1 py-1 text-xs rounded ${imageMode==='link'?'bg-white shadow':''}`}>Link</button></div>
                    {imageMode === 'file' ? <input type="file" accept="image/*" onChange={handleFileChange} className="text-sm w-full" /> : <input name="imageUrlLink" defaultValue={!editingProduct?.imageUrl?.startsWith('data:')?editingProduct?.imageUrl:''} className="w-full p-2 border rounded text-sm" placeholder="URL imagen..." onChange={(e)=>setPreviewImage(e.target.value)} />}
                    {previewImage && <img src={previewImage} className="h-20 w-full object-cover rounded border" />}
                    <div className="flex gap-2 pt-2"><button type="button" onClick={onClose} className="flex-1 py-2 text-slate-500">Cancelar</button><button type="submit" className="flex-1 bg-blue-600 text-white py-2 rounded font-bold">Guardar</button></div>
                </form>
            </div>
        </div>
    );
}

export function CategoryModal({ onClose, onSave, onDelete, categories }) {
    return (
        <div className={modalOverlayClass}>
            <div className="bg-white rounded-2xl w-full max-w-sm p-6 space-y-4 shadow-2xl animate-in zoom-in-95 duration-200">
                <div className="flex justify-between items-center"><h3 className="font-bold text-lg">Categorías</h3><button onClick={onClose}><X size={20}/></button></div>
                <div className="max-h-40 overflow-y-auto space-y-2 border-b pb-4">{categories.map(cat => (<div key={cat.id} className="flex justify-between items-center bg-slate-50 p-2 rounded"><span>{cat.name}</span><button onClick={() => onDelete(cat.id)} className="text-red-400"><Trash2 size={16}/></button></div>))}</div>
                <form onSubmit={onSave} className="flex gap-2"><input name="catName" required className="flex-1 p-2 border rounded text-sm" placeholder="Nueva..." /><button type="submit" className="bg-green-600 text-white px-4 rounded font-bold">+</button></form>
            </div>
        </div>
    );
}

export function CustomerModal({ onClose, onSave, editingCustomer }) {
    return (
        <div className={modalOverlayClass}>
            <div className="bg-white rounded-2xl w-full max-w-md p-6 space-y-4 shadow-2xl animate-in zoom-in-95 duration-200">
                <h3 className="font-bold text-lg">{editingCustomer ? 'Editar' : 'Nuevo'} Cliente</h3>
                <form onSubmit={onSave} className="space-y-3">
                    <input required name="name" defaultValue={editingCustomer?.name} className="w-full p-2 border rounded" placeholder="Nombre Completo" />
                    <input required name="phone" defaultValue={editingCustomer?.phone} className="w-full p-2 border rounded" placeholder="Teléfono" />
                    <input required name="address" defaultValue={editingCustomer?.address} className="w-full p-2 border rounded" placeholder="Dirección" />
                    <input name="email" type="email" defaultValue={editingCustomer?.email} className="w-full p-2 border rounded" placeholder="Email (Opcional)" />
                    <div className="flex gap-2 pt-2"><button type="button" onClick={onClose} className="flex-1 py-2 text-slate-500">Cancelar</button><button type="submit" className="flex-1 bg-blue-600 text-white py-2 rounded font-bold">Guardar</button></div>
                </form>
            </div>
        </div>
    );
}

export function StoreModal({ onClose, onSave, storeProfile, imageMode, setImageMode, previewImage, setPreviewImage, handleFileChange }) {
    return (
        <div className={modalOverlayClass}>
            <div className="bg-white rounded-2xl w-full max-w-sm p-6 space-y-4 shadow-2xl animate-in zoom-in-95 duration-200">
                <div className="flex justify-between items-center"><h3 className="font-bold text-lg">Perfil del Negocio</h3><button onClick={onClose}><X size={20}/></button></div>
                <form onSubmit={onSave} className="space-y-4">
                    <div><label className="block text-sm font-medium text-slate-700 mb-1">Nombre</label><input name="storeName" defaultValue={storeProfile.name} required className="w-full p-2 border rounded" /></div>
                    <div><label className="block text-sm font-medium text-slate-700 mb-2">Logo</label><div className="flex gap-2 mb-3 bg-slate-100 p-1 rounded-lg"><button type="button" onClick={() => { setImageMode('file'); setPreviewImage(''); }} className={`flex-1 py-1.5 text-xs rounded-md ${imageMode === 'file' ? 'bg-white shadow text-blue-600 font-bold' : 'text-slate-500'}`}>Subir</button><button type="button" onClick={() => { setImageMode('link'); setPreviewImage(''); }} className={`flex-1 py-1.5 text-xs rounded-md ${imageMode === 'link' ? 'bg-white shadow text-blue-600 font-bold' : 'text-slate-500'}`}>Link</button></div>{imageMode === 'file' ? (<input type="file" accept="image/*" onChange={handleFileChange} className="text-sm w-full" />) : (<input name="logoUrlLink" defaultValue={!storeProfile.logoUrl?.startsWith('data:') ? storeProfile.logoUrl : ''} className="w-full p-2 border rounded text-sm" placeholder="URL del logo..." onChange={(e) => setPreviewImage(e.target.value)} />)}{(previewImage || storeProfile.logoUrl) && (<div className="mt-3 flex justify-center"><img src={previewImage || storeProfile.logoUrl} className="h-20 w-20 object-cover rounded-xl border shadow-sm" /></div>)}</div>
                    <button type="submit" className="w-full bg-blue-600 text-white font-bold py-2 rounded hover:bg-blue-700">Guardar Cambios</button>
                </form>
            </div>
        </div>
    );
}

export function AddStockModal({ onClose, onConfirm, scannedProduct, quantityInputRef }) {
    return (
        <div className={modalOverlayClass}>
            <div className="bg-white rounded-2xl w-full max-w-sm p-6 space-y-4 shadow-2xl text-center animate-in zoom-in-95 duration-200">
                <div className="flex items-center gap-3 justify-center mb-2"><Box size={32} className="text-blue-600"/><h3 className="font-bold text-lg text-slate-800">Entrada Stock</h3></div>
                <div className="bg-slate-100 p-3 rounded-lg"><div className="font-bold text-lg">{scannedProduct.name}</div><div className="text-sm text-slate-500">Stock Actual: {scannedProduct.stock}</div></div>
                <form onSubmit={onConfirm}>
                    <label className="block text-sm text-slate-500 mb-2">Cantidad a sumar:</label>
                    <input ref={quantityInputRef} name="qty" type="number" defaultValue="1" min="1" className="w-32 p-3 border-2 border-blue-500 rounded-lg text-center text-2xl font-bold mx-auto block mb-4" />
                    <div className="flex gap-2"><button type="button" onClick={onClose} className="flex-1 py-3 text-slate-500 font-bold bg-slate-100 rounded-lg">Cancelar</button><button type="submit" className="flex-1 bg-blue-600 text-white font-bold py-3 rounded-lg">Confirmar</button></div>
                </form>
            </div>
        </div>
    );
}

export function LogoutConfirmModal({ onClose, onConfirm }) {
    return (
        <div className={modalOverlayClass}>
            <div className="bg-white rounded-2xl w-full max-w-sm p-6 space-y-4 shadow-2xl text-center animate-in zoom-in-95 duration-200">
                <AlertTriangle size={32} className="text-orange-500 mx-auto"/>
                <h3 className="font-bold text-lg text-slate-800">Cerrar Sesión</h3>
                <p className="text-sm text-slate-600">⚠️ ¿Estás seguro de que quieres cerrar la sesión? Perderás el acceso hasta que vuelvas a iniciar sesión.</p>
                <div className="flex gap-3 pt-2">
                    <button type="button" onClick={onClose} className="flex-1 py-3 text-slate-700 font-bold bg-slate-100 rounded-lg hover:bg-slate-200">Cancelar</button>
                    <button type="button" onClick={onConfirm} className="flex-1 bg-red-600 text-white font-bold py-3 rounded-lg hover:bg-red-700"><LogOut size={18} className="inline mr-1"/> Sí, Salir</button>
                </div>
            </div>
        </div>
    );
}

// 7. MODAL DE EDICIÓN DE ITEMS (REDISEÑADO - FULL SCREEN EN MÓVIL)
export function TransactionModal({ onClose, onSave, editingTransaction }) {
    const [localItems, setLocalItems] = useState(editingTransaction.items || []);
    
    const updateItem = (index, field, value) => {
        const newItems = [...localItems];
        newItems[index] = { ...newItems[index], [field]: value };
        setLocalItems(newItems);
    };

    const updateQty = (index, delta) => {
        const newItems = [...localItems];
        const newQty = (newItems[index].qty || 0) + delta;
        if(newQty < 1) return; // Mínimo 1
        newItems[index].qty = newQty;
        setLocalItems(newItems);
    };

    const deleteItem = (index) => {
        const newItems = localItems.filter((_, i) => i !== index);
        setLocalItems(newItems);
    };

    const handleSave = () => {
        const newTotal = localItems.reduce((acc, item) => acc + (item.price * item.qty), 0);
        onSave({ items: localItems, total: newTotal });
    };

    return (
        <div className="fixed inset-0 z-[250] bg-slate-100/90 backdrop-blur-sm flex justify-center items-center animate-in fade-in duration-200">
            
            {/* Contenedor Principal Estilo "Hoja" */}
            <div className="w-full max-w-2xl h-full sm:h-auto sm:max-h-[85vh] bg-white sm:rounded-2xl shadow-2xl flex flex-col relative">
                
                {/* Header */}
                <div className="bg-white px-4 py-3 border-b flex items-center justify-between sticky top-0 z-10 sm:rounded-t-2xl">
                    <div className="flex items-center gap-3">
                        <button onClick={onClose} className="p-2 -ml-2 text-slate-600 hover:bg-slate-100 rounded-full">
                            <ArrowLeft size={24} />
                        </button>
                        <div>
                            <h3 className="font-bold text-lg text-slate-800">Editar Pedido</h3>
                            <p className="text-xs text-slate-500">Modifica cantidades o precios</p>
                        </div>
                    </div>
                    <button onClick={handleSave} className="bg-blue-600 text-white px-4 py-2 rounded-lg font-bold text-sm shadow-md hover:bg-blue-700 transition-colors flex items-center gap-2">
                        <CheckCircle size={18}/> Guardar
                    </button>
                </div>

                {/* Lista de Items */}
                <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-slate-50">
                    {localItems.map((item, index) => (
                        <div key={index} className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
                            {/* Fila Superior: Nombre y Eliminar */}
                            <div className="flex justify-between items-start mb-3">
                                <input 
                                    className="font-bold text-slate-800 text-lg w-full outline-none border-b border-transparent focus:border-blue-300 mr-2"
                                    value={item.name}
                                    onChange={(e) => updateItem(index, 'name', e.target.value)}
                                />
                                <button onClick={() => deleteItem(index)} className="text-red-400 hover:text-red-600 p-1">
                                    <Trash2 size={20}/>
                                </button>
                            </div>

                            {/* Controles de Precio y Cantidad */}
                            <div className="flex items-center justify-between gap-4">
                                {/* Precio Unitario */}
                                <div className="flex-1">
                                    <label className="text-[10px] uppercase font-bold text-slate-400">Precio Unit.</label>
                                    <div className="flex items-center gap-1 border rounded-lg p-2 bg-slate-50">
                                        <span className="text-slate-400 font-bold">$</span>
                                        <input 
                                            type="number"
                                            className="w-full bg-transparent outline-none font-bold text-slate-700"
                                            value={item.price}
                                            onChange={(e) => updateItem(index, 'price', parseFloat(e.target.value) || 0)}
                                        />
                                    </div>
                                </div>

                                {/* Cantidad (Botones Grandes) */}
                                <div className="flex items-center gap-3">
                                    <button onClick={() => updateQty(index, -1)} className="w-10 h-10 rounded-full border border-slate-300 flex items-center justify-center text-slate-600 hover:bg-slate-100 active:bg-slate-200">
                                        <Minus size={18}/>
                                    </button>
                                    <div className="w-8 text-center font-bold text-xl">{item.qty}</div>
                                    <button onClick={() => updateQty(index, 1)} className="w-10 h-10 rounded-full border border-slate-300 flex items-center justify-center text-slate-600 hover:bg-slate-100 active:bg-slate-200">
                                        <Plus size={18}/>
                                    </button>
                                </div>
                            </div>
                            
                            {/* Subtotal Item */}
                            <div className="text-right mt-2 text-xs font-bold text-blue-600">
                                Subtotal: ${(item.price * item.qty).toLocaleString()}
                            </div>
                        </div>
                    ))}
                    
                    {localItems.length === 0 && (
                        <div className="text-center py-10 text-slate-400">
                            No hay items en el pedido.
                        </div>
                    )}
                </div>

                {/* Footer Total */}
                <div className="p-4 bg-white border-t sm:rounded-b-2xl sticky bottom-0 z-10">
                    <div className="flex justify-between items-center text-lg">
                        <span className="font-bold text-slate-600">Nuevo Total</span>
                        <span className="font-extrabold text-2xl text-slate-900">
                            ${localItems.reduce((acc, i) => acc + (i.price * i.qty), 0).toLocaleString()}
                        </span>
                    </div>
                </div>

            </div>
        </div>
    );
}
