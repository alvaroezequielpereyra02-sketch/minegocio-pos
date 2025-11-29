import React from 'react';
import { X, Trash2, ScanBarcode, Box, AlertTriangle, LogOut } from 'lucide-react';

// 1. MODAL DE GASTOS
export function ExpenseModal({ onClose, onSave }) {
    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-[100] backdrop-blur-sm">
            <div className="bg-white rounded-2xl w-full max-w-sm p-6 space-y-4 shadow-2xl">
                <div className="flex justify-between items-center"><h3 className="font-bold text-lg text-red-600">Registrar Gasto</h3><button onClick={onClose}><X size={20} /></button></div>
                <form onSubmit={onSave} className="space-y-3">
                    <label className="block text-sm text-slate-500">Descripción</label><input name="description" required className="w-full p-2 border rounded" placeholder="Ej: Combustible, Luz..." />
                    <label className="block text-sm text-slate-500">Monto</label><input name="amount" type="number" required className="w-full p-2 border rounded text-red-600 font-bold" placeholder="0.00" />
                    <button type="submit" className="w-full bg-red-600 text-white font-bold py-2 rounded">Guardar Gasto</button>
                </form>
            </div>
        </div>
    );
}

// 2. MODAL DE PRODUCTOS
export function ProductModal({ onClose, onSave, onDelete, editingProduct, imageMode, setImageMode, previewImage, setPreviewImage, handleFileChange, categories }) {
    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-[100] backdrop-blur-sm">
            <div className="bg-white rounded-2xl w-full max-w-md p-6 space-y-4 shadow-2xl overflow-y-auto max-h-[90vh]">
                <div className="flex justify-between items-center"><h3 className="font-bold text-lg">{editingProduct ? 'Editar' : 'Nuevo'} Producto</h3>{editingProduct && <button onClick={() => onDelete(editingProduct.id)} className="text-red-500 text-sm underline">Eliminar</button>}</div>
                <form onSubmit={onSave} className="space-y-3">
                    <input required name="name" defaultValue={editingProduct?.name} className="w-full p-2 border rounded" placeholder="Nombre" />
                    <div className="flex gap-2 items-center border p-2 rounded bg-slate-50"><ScanBarcode size={16} className="text-slate-400" /><input name="barcode" defaultValue={editingProduct?.barcode} className="w-full bg-transparent outline-none text-sm" placeholder="Código de Barras (Opcional)" /></div>
                    <div className="grid grid-cols-2 gap-2"><div><label className="text-xs text-slate-500 font-bold">Precio Venta</label><input required name="price" type="number" defaultValue={editingProduct?.price} className="w-full p-2 border rounded" /></div><div><label className="text-xs text-slate-500 font-bold">Costo Compra</label><input name="cost" type="number" defaultValue={editingProduct?.cost || ''} className="w-full p-2 border rounded" placeholder="0.00" /></div></div>
                    <div><label className="text-xs text-slate-500 font-bold">Stock</label><input required name="stock" type="number" defaultValue={editingProduct?.stock} className="w-full p-2 border rounded" /></div>
                    <select name="category" defaultValue={editingProduct?.categoryId || ""} className="w-full p-2 border rounded bg-white"><option value="">Sin Categoría</option>{categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select>
                    <div className="flex gap-2 bg-slate-100 p-1 rounded"><button type="button" onClick={() => { setImageMode('file'); setPreviewImage('') }} className={`flex-1 py-1 text-xs rounded ${imageMode === 'file' ? 'bg-white shadow' : ''}`}>Subir</button><button type="button" onClick={() => { setImageMode('link'); setPreviewImage('') }} className={`flex-1 py-1 text-xs rounded ${imageMode === 'link' ? 'bg-white shadow' : ''}`}>Link</button></div>
                    {imageMode === 'file' ? <input type="file" accept="image/*" onChange={handleFileChange} className="text-sm w-full" /> : <input name="imageUrlLink" defaultValue={!editingProduct?.imageUrl?.startsWith('data:') ? editingProduct?.imageUrl : ''} className="w-full p-2 border rounded text-sm" placeholder="URL imagen..." onChange={(e) => setPreviewImage(e.target.value)} />}
                    {previewImage && <img src={previewImage} className="h-20 w-full object-cover rounded border" />}
                    <div className="flex gap-2 pt-2"><button type="button" onClick={onClose} className="flex-1 py-2 text-slate-500">Cancelar</button><button type="submit" className="flex-1 bg-blue-600 text-white py-2 rounded font-bold">Guardar</button></div>
                </form>
            </div>
        </div>
    );
}

// 3. MODAL DE CATEGORÍAS
export function CategoryModal({ onClose, onSave, onDelete, categories }) {
    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-[100] backdrop-blur-sm">
            <div className="bg-white rounded-2xl w-full max-w-sm p-6 space-y-4 shadow-2xl">
                <div className="flex justify-between items-center"><h3 className="font-bold text-lg">Categorías</h3><button onClick={onClose}><X size={20} /></button></div>
                <div className="max-h-40 overflow-y-auto space-y-2 border-b pb-4">{categories.map(cat => (<div key={cat.id} className="flex justify-between items-center bg-slate-50 p-2 rounded"><span>{cat.name}</span><button onClick={() => onDelete(cat.id)} className="text-red-400"><Trash2 size={16} /></button></div>))}</div>
                <form onSubmit={onSave} className="flex gap-2"><input name="catName" required className="flex-1 p-2 border rounded text-sm" placeholder="Nueva..." /><button type="submit" className="bg-green-600 text-white px-4 rounded font-bold">+</button></form>
            </div>
        </div>
    );
}

// 4. MODAL DE CLIENTES
export function CustomerModal({ onClose, onSave, editingCustomer }) {
    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-[100] backdrop-blur-sm">
            <div className="bg-white rounded-2xl w-full max-w-md p-6 space-y-4 shadow-2xl">
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

// 5. MODAL DE TIENDA
export function StoreModal({ onClose, onSave, storeProfile, imageMode, setImageMode, previewImage, setPreviewImage, handleFileChange }) {
    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-[100] backdrop-blur-sm">
            <div className="bg-white rounded-2xl w-full max-w-sm p-6 space-y-4 shadow-2xl">
                <div className="flex justify-between items-center"><h3 className="font-bold text-lg">Perfil del Negocio</h3><button onClick={onClose}><X size={20} /></button></div>
                <form onSubmit={onSave} className="space-y-4">
                    <div><label className="block text-sm font-medium text-slate-700 mb-1">Nombre</label><input name="storeName" defaultValue={storeProfile.name} required className="w-full p-2 border rounded" /></div>
                    <div><label className="block text-sm font-medium text-slate-700 mb-2">Logo</label><div className="flex gap-2 mb-3 bg-slate-100 p-1 rounded-lg"><button type="button" onClick={() => { setImageMode('file'); setPreviewImage(''); }} className={`flex-1 py-1.5 text-xs rounded-md ${imageMode === 'file' ? 'bg-white shadow text-blue-600 font-bold' : 'text-slate-500'}`}>Subir</button><button type="button" onClick={() => { setImageMode('link'); setPreviewImage(''); }} className={`flex-1 py-1.5 text-xs rounded-md ${imageMode === 'link' ? 'bg-white shadow text-blue-600 font-bold' : 'text-slate-500'}`}>Link</button></div>{imageMode === 'file' ? (<input type="file" accept="image/*" onChange={handleFileChange} className="text-sm w-full" />) : (<input name="logoUrlLink" defaultValue={!storeProfile.logoUrl?.startsWith('data:') ? storeProfile.logoUrl : ''} className="w-full p-2 border rounded text-sm" placeholder="URL del logo..." onChange={(e) => setPreviewImage(e.target.value)} />)}{(previewImage || storeProfile.logoUrl) && (<div className="mt-3 flex justify-center"><img src={previewImage || storeProfile.logoUrl} className="h-20 w-20 object-cover rounded-xl border shadow-sm" /></div>)}</div>
                    <button type="submit" className="w-full bg-blue-600 text-white font-bold py-2 rounded hover:bg-blue-700">Guardar Cambios</button>
                </form>
            </div>
        </div>
    );
}

// 6. MODAL DE STOCK
export function AddStockModal({ onClose, onConfirm, scannedProduct, quantityInputRef }) {
    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-[105] backdrop-blur-sm">
            <div className="bg-white rounded-2xl w-full max-w-sm p-6 space-y-4 shadow-2xl text-center">
                <div className="flex items-center gap-3 justify-center mb-2"><Box size={32} className="text-blue-600" /><h3 className="font-bold text-lg text-slate-800">Entrada Stock</h3></div>
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

// 7. MODAL DE TRANSACCIÓN
export function TransactionModal({ onClose, onSave, editingTransaction }) {
    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-[100] backdrop-blur-sm">
            <div className="bg-white rounded-2xl w-full max-w-lg p-6 space-y-4 shadow-2xl overflow-y-auto max-h-[90vh]">
                <div className="flex justify-between items-center"><h3 className="font-bold text-lg">Editar Boleta</h3><button onClick={onClose}><X size={20} /></button></div>
                <form onSubmit={onSave} className="space-y-4">
                    <div className="bg-slate-50 rounded-lg border overflow-hidden"><table className="w-full text-sm text-left"><thead className="bg-slate-200 text-slate-700 font-bold"><tr><th className="p-2 w-16">Cant</th><th className="p-2">Producto</th><th className="p-2 w-20 text-right">Precio ($)</th></tr></thead><tbody className="divide-y divide-slate-200">{editingTransaction.items.map((item, index) => (<tr key={index} className="bg-white"><td className="p-2"><input name={`item_qty_${index}`} defaultValue={item.qty} type="number" className="w-full p-1 border rounded text-center" /></td><td className="p-2"><input name={`item_name_${index}`} defaultValue={item.name} className="w-full p-1 border rounded" /></td><td className="p-2"><input name={`item_price_${index}`} defaultValue={item.price} type="number" className="w-full p-1 border rounded text-right" /></td></tr>))}</tbody></table></div>
                    <div className="grid grid-cols-2 gap-3"><div><label className="block text-sm font-medium text-slate-700 mb-1">Estado</label><select name="paymentStatus" defaultValue={editingTransaction?.paymentStatus || 'pending'} className="w-full p-2 border rounded bg-white text-sm"><option value="paid">✅ Pagado</option><option value="pending">❌ Pendiente</option><option value="partial">⚠️ Parcial</option></select></div><div><label className="block text-sm font-medium text-slate-700 mb-1">Nota</label><input name="paymentNote" defaultValue={editingTransaction?.paymentNote || ''} className="w-full p-2 border rounded text-sm" placeholder="Detalles..." /></div></div>
                    <button type="submit" className="w-full bg-blue-600 text-white font-bold py-2 rounded hover:bg-blue-700">Guardar Cambios</button>
                </form>
            </div>
        </div>
    );
}

// 8. MODAL DE LOGOUT
export function LogoutConfirmModal({ onClose, onConfirm }) {
    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-[110] backdrop-blur-sm">
            <div className="bg-white rounded-2xl w-full max-w-sm p-6 space-y-4 shadow-2xl text-center">
                <AlertTriangle size={32} className="text-orange-500 mx-auto" />
                <h3 className="font-bold text-lg text-slate-800">Cerrar Sesión</h3>
                <p className="text-sm text-slate-600">⚠️ ¿Estás seguro de que quieres cerrar la sesión? Perderás el acceso hasta que vuelvas a iniciar sesión.</p>
                <div className="flex gap-3 pt-2">
                    <button type="button" onClick={onClose} className="flex-1 py-3 text-slate-700 font-bold bg-slate-100 rounded-lg hover:bg-slate-200">Cancelar</button>
                    <button type="button" onClick={onConfirm} className="flex-1 bg-red-600 text-white font-bold py-3 rounded-lg hover:bg-red-700"><LogOut size={18} className="inline mr-1" /> Sí, Salir</button>
                </div>
            </div>
        </div>
    );
}