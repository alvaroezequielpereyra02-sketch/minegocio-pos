import React, { useState, useEffect } from 'react';
// CORRECCIÓN: Agregados FolderTree, ChevronDown, ChevronUp, Folder, FolderOpen, CornerDownRight
import { X, Trash2, ScanBarcode, Box, AlertTriangle, LogOut, Plus, Minus, CheckCircle, ArrowLeft, Key, Copy, Loader2, AlertCircle, FolderTree, ChevronDown, ChevronUp, Folder, FolderOpen, CornerDownRight } from 'lucide-react';

const modalOverlayClass = "fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-[200] backdrop-blur-sm animate-in fade-in duration-200";

// --- CONFIRM MODAL ---
export function ConfirmModal({ title, message, onConfirm, onCancel, confirmText = "Confirmar", cancelText = "Cancelar", isDanger = false }) {
    return (
        <div className={modalOverlayClass} style={{ zIndex: 99999 }}>
            <div className="bg-white rounded-2xl w-full max-w-sm p-6 shadow-2xl text-center animate-in zoom-in-95 duration-200 border border-slate-100">
                <div className={`mx-auto w-12 h-12 rounded-full flex items-center justify-center mb-4 ${isDanger ? 'bg-red-100 text-red-600' : 'bg-blue-100 text-blue-600'}`}>
                    {isDanger ? <AlertTriangle size={24} /> : <AlertCircle size={24} />}
                </div>
                <h3 className="text-lg font-bold text-slate-900 mb-2">{title}</h3>
                <p className="text-sm text-slate-600 mb-6 leading-relaxed whitespace-pre-line">{message}</p>
                <div className="flex gap-3">
                    <button onClick={onCancel} className="flex-1 py-3 text-slate-700 font-bold bg-slate-100 rounded-xl hover:bg-slate-200 active:scale-95 transition-transform">{cancelText}</button>
                    <button onClick={onConfirm} className={`flex-1 py-3 text-white font-bold rounded-xl shadow-md active:scale-95 transition-transform ${isDanger ? 'bg-red-600 hover:bg-red-700' : 'bg-blue-600 hover:bg-blue-700'}`}>{confirmText}</button>
                </div>
            </div>
        </div>
    );
}

// --- PROCESSING MODAL ---
export function ProcessingModal() {
    return (
        <div className="fixed inset-0 bg-slate-50/80 backdrop-blur-md flex flex-col items-center justify-center z-[30000] animate-in fade-in duration-300">
            <div className="bg-white p-8 rounded-3xl shadow-2xl flex flex-col items-center text-center border border-slate-100 transform scale-110">
                <div className="relative mb-6">
                    <div className="w-20 h-20 border-4 border-slate-100 rounded-full"></div>
                    <div className="absolute top-0 left-0 w-20 h-20 border-4 border-blue-600 rounded-full border-t-transparent animate-spin"></div>
                    <div className="absolute inset-0 flex items-center justify-center"><Loader2 className="text-blue-600 animate-pulse" size={24} /></div>
                </div>
                <h3 className="text-xl font-extrabold text-slate-800 mb-2">Procesando</h3>
                <p className="text-sm text-slate-400 font-medium">Por favor espere...</p>
            </div>
        </div>
    );
}

// --- INVITATION MODAL ---
export function InvitationModal({ onClose, onGenerate }) {
    const [generatedCode, setGeneratedCode] = useState(null);
    const handleGenerate = () => { const code = Math.random().toString(36).substring(2, 8).toUpperCase(); onGenerate(code); setGeneratedCode(code); };
    const copyToClipboard = () => { navigator.clipboard.writeText(generatedCode).then(() => alert("Copiado")); };
    return (
        <div className={modalOverlayClass}>
            <div className="bg-white rounded-2xl w-full max-w-sm p-6 shadow-2xl animate-in zoom-in-95 duration-200 text-center">
                <div className="flex justify-between items-center mb-4"><h3 className="font-bold text-lg text-blue-800 flex items-center gap-2"><Key size={20} /> Nueva Invitación</h3><button onClick={onClose}><X size={20} /></button></div>
                {!generatedCode ? (<div className="space-y-4"><p className="text-sm text-slate-600">Genera un código único.</p><button onClick={handleGenerate} className="w-full py-3 bg-blue-600 text-white font-bold rounded-xl">Generar Código</button></div>) : (<div className="space-y-4"><div className="p-4 bg-slate-100 rounded-xl"><p className="text-3xl font-mono font-black">{generatedCode}</p></div><button onClick={copyToClipboard} className="w-full py-3 bg-green-600 text-white font-bold rounded-xl flex items-center justify-center gap-2"><Copy size={18} /> Copiar</button></div>)}
            </div>
        </div>
    );
}

// --- EXPENSE MODAL ---
export function ExpenseModal({ onClose, onSave }) {
    return (
        <div className={modalOverlayClass}>
            <div className="bg-white rounded-2xl w-full max-w-sm p-6 space-y-4 shadow-2xl animate-in zoom-in-95 duration-200">
                <div className="flex justify-between items-center"><h3 className="font-bold text-lg text-red-600">Registrar Gasto</h3><button onClick={onClose}><X size={20} /></button></div>
                <form onSubmit={onSave} className="space-y-3">
                    <label className="block text-sm text-slate-500">Descripción</label><input name="description" required className="w-full p-2 border rounded" placeholder="Ej: Luz..." />
                    <label className="block text-sm text-slate-500">Monto</label><input name="amount" type="number" required className="w-full p-2 border rounded text-red-600 font-bold" placeholder="0.00" />
                    <button type="submit" className="w-full bg-red-600 text-white font-bold py-2 rounded">Guardar Gasto</button>
                </form>
            </div>
        </div>
    );
}

// --- PRODUCT MODAL ---
export function ProductModal({ onClose, onSave, onDelete, editingProduct, imageMode, setImageMode, previewImage, setPreviewImage, handleFileChange, categories, subcategories }) {
    const [selectedCat, setSelectedCat] = useState(editingProduct?.categoryId || "");

    useEffect(() => {
        // Reset visual si cambia categoría
    }, [selectedCat]);

    return (
        <div className={modalOverlayClass}>
            <div className="bg-white rounded-2xl w-full max-w-md p-6 space-y-4 shadow-2xl overflow-y-auto max-h-[90vh] animate-in zoom-in-95 duration-200">
                <div className="flex justify-between items-center"><h3 className="font-bold text-lg">{editingProduct ? 'Editar' : 'Nuevo'} Producto</h3>{editingProduct && <button onClick={() => onDelete(editingProduct.id)} className="text-red-500 text-sm underline">Eliminar</button>}</div>
                <form onSubmit={onSave} className="space-y-3">
                    <input required name="name" defaultValue={editingProduct?.name} className="w-full p-2 border rounded" placeholder="Nombre" />
                    <div className="flex gap-2 items-center border p-2 rounded bg-slate-50"><ScanBarcode size={16} className="text-slate-400" /><input name="barcode" defaultValue={editingProduct?.barcode} className="w-full bg-transparent outline-none text-sm" placeholder="Código de Barras (Opcional)" /></div>
                    <div className="grid grid-cols-2 gap-2"><div><label className="text-xs text-slate-500 font-bold">Precio Venta</label><input required name="price" type="number" defaultValue={editingProduct?.price} className="w-full p-2 border rounded" /></div><div><label className="text-xs text-slate-500 font-bold">Costo Compra</label><input name="cost" type="number" defaultValue={editingProduct?.cost || ''} className="w-full p-2 border rounded" placeholder="0.00" /></div></div>
                    <div><label className="text-xs text-slate-500 font-bold">Stock</label><input required name="stock" type="number" defaultValue={editingProduct?.stock} className="w-full p-2 border rounded" /></div>

                    {/* SELECTORES DE CATEGORÍA Y SUBCATEGORÍA */}
                    <div className="grid grid-cols-2 gap-2">
                        <div>
                            <label className="text-xs text-slate-500 font-bold">Categoría</label>
                            <select name="category" value={selectedCat} onChange={(e) => setSelectedCat(e.target.value)} className="w-full p-2 border rounded bg-white text-sm">
                                <option value="">Sin Categoría</option>
                                {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                            </select>
                        </div>
                        <div>
                            <label className="text-xs text-slate-500 font-bold">Subcategoría</label>
                            <select name="subcategory" defaultValue={editingProduct?.subCategoryId || ""} className="w-full p-2 border rounded bg-white text-sm" disabled={!selectedCat}>
                                <option value="">Ninguna</option>
                                {subcategories && subcategories.filter(s => s.parentId === selectedCat).map(s => (
                                    <option key={s.id} value={s.id}>{s.name}</option>
                                ))}
                            </select>
                        </div>
                    </div>

                    <div className="flex gap-2 bg-slate-100 p-1 rounded"><button type="button" onClick={() => { setImageMode('file'); setPreviewImage('') }} className={`flex-1 py-1 text-xs rounded ${imageMode === 'file' ? 'bg-white shadow' : ''}`}>Subir</button><button type="button" onClick={() => { setImageMode('link'); setPreviewImage('') }} className={`flex-1 py-1 text-xs rounded ${imageMode === 'link' ? 'bg-white shadow' : ''}`}>Link</button></div>
                    {imageMode === 'file' ? <input type="file" accept="image/*" onChange={handleFileChange} className="text-sm w-full" /> : <input name="imageUrlLink" defaultValue={!editingProduct?.imageUrl?.startsWith('data:') ? editingProduct?.imageUrl : ''} className="w-full p-2 border rounded text-sm" placeholder="URL imagen..." onChange={(e) => setPreviewImage(e.target.value)} />}
                    {previewImage && <img src={previewImage} className="h-20 w-full object-cover rounded border" />}
                    <div className="flex gap-2 pt-2"><button type="button" onClick={onClose} className="flex-1 py-2 text-slate-500">Cancelar</button><button type="submit" className="flex-1 bg-blue-600 text-white py-2 rounded font-bold">Guardar</button></div>
                </form>
            </div>
        </div>
    );
}

// --- CATEGORY MODAL MEJORADO (VISUALMENTE CLARO) ---
export function CategoryModal({ onClose, onSave, onDelete, categories, onSaveSub, onDeleteSub, subcategories = [] }) {
    const [expandedCat, setExpandedCat] = useState(null);

    return (
        <div className={modalOverlayClass}>
            <div className="bg-white rounded-2xl w-full max-w-md p-0 shadow-2xl animate-in zoom-in-95 duration-200 flex flex-col max-h-[85vh] overflow-hidden">

                {/* Header */}
                <div className="p-4 bg-slate-800 text-white flex justify-between items-center">
                    <h3 className="font-bold text-lg flex items-center gap-2"><FolderTree size={20} /> Gestión de Categorías</h3>
                    <button onClick={onClose} className="text-slate-300 hover:text-white"><X size={24} /></button>
                </div>

                {/* Lista */}
                <div className="flex-1 overflow-y-auto p-4 space-y-3 custom-scrollbar bg-slate-50">
                    {categories.map(cat => {
                        const subs = subcategories.filter(s => s.parentId === cat.id);
                        const isExpanded = expandedCat === cat.id;

                        return (
                            <div key={cat.id} className={`bg-white rounded-xl border transition-all duration-200 ${isExpanded ? 'border-blue-400 shadow-md ring-1 ring-blue-100' : 'border-slate-200 shadow-sm'}`}>
                                {/* Cabecera de la Categoría */}
                                <div className="flex justify-between items-center p-3 cursor-pointer select-none hover:bg-slate-50" onClick={() => setExpandedCat(isExpanded ? null : cat.id)}>
                                    <div className="flex items-center gap-3">
                                        <div className={`p-2 rounded-lg ${isExpanded ? 'bg-blue-100 text-blue-600' : 'bg-slate-100 text-slate-500'}`}>
                                            {isExpanded ? <FolderOpen size={20} /> : <Folder size={20} />}
                                        </div>
                                        <div>
                                            <div className="font-bold text-slate-800 text-sm">{cat.name}</div>
                                            <div className="text-[10px] text-slate-400 font-medium">{subs.length} subcategorías</div>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <div className={`transition-transform duration-200 ${isExpanded ? 'rotate-180 text-blue-500' : 'text-slate-400'}`}>
                                            <ChevronDown size={20} />
                                        </div>
                                    </div>
                                </div>

                                {/* Cuerpo Expandible (Subcategorías) */}
                                {isExpanded && (
                                    <div className="bg-slate-50/50 border-t border-slate-100 rounded-b-xl animate-in slide-in-from-top-1 fade-in p-3">
                                        <div className="space-y-1 mb-4 pl-4 border-l-2 border-slate-200 ml-3">
                                            {subs.map(sub => (
                                                <div key={sub.id} className="flex justify-between items-center py-2 px-2 hover:bg-white rounded-lg group transition-colors">
                                                    <div className="flex items-center gap-2 text-sm text-slate-600 font-medium">
                                                        <CornerDownRight size={14} className="text-slate-300" />
                                                        {sub.name}
                                                    </div>
                                                    <button onClick={(e) => { e.stopPropagation(); onDeleteSub(sub.id); }} className="text-slate-300 hover:text-red-500 p-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                                        <Trash2 size={14} />
                                                    </button>
                                                </div>
                                            ))}
                                            {subs.length === 0 && <div className="text-xs text-slate-400 italic py-2">No hay subcategorías.</div>}
                                        </div>

                                        {/* Input Agregar Subcategoría */}
                                        <form
                                            onSubmit={(e) => {
                                                e.preventDefault();
                                                const val = e.target.elements.subName.value.trim();
                                                if (val) {
                                                    onSaveSub(cat.id, val);
                                                    e.target.reset();
                                                }
                                            }}
                                            className="flex gap-2 items-center mt-2 pl-3"
                                        >
                                            <CornerDownRight size={16} className="text-blue-400 shrink-0" />
                                            <input
                                                name="subName"
                                                placeholder="Nueva subcategoría..."
                                                className="flex-1 p-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:border-blue-500 bg-white"
                                                autoComplete="off"
                                            />
                                            <button type="submit" className="bg-blue-600 text-white p-2 rounded-lg hover:bg-blue-700 shadow-sm active:scale-95 transition-transform">
                                                <Plus size={16} />
                                            </button>
                                        </form>

                                        <div className="mt-4 pt-3 border-t border-slate-100 text-right">
                                            <button onClick={(e) => { e.stopPropagation(); onDelete(cat.id); }} className="text-xs text-red-500 hover:text-red-700 font-bold flex items-center justify-end gap-1 ml-auto">
                                                <Trash2 size={12} /> Eliminar Categoría Principal
                                            </button>
                                        </div>
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>

                {/* Footer: Agregar Categoría Principal */}
                <div className="p-4 bg-white border-t border-slate-100">
                    <label className="text-xs font-bold text-slate-400 uppercase mb-2 block">Crear Nueva Categoría Principal</label>
                    <form onSubmit={onSave} className="flex gap-2">
                        <input name="catName" required className="flex-1 p-3 border border-slate-300 rounded-xl text-sm bg-slate-50 focus:bg-white focus:border-slate-800 transition-colors outline-none" placeholder="Ej: Bebidas, Limpieza..." />
                        <button type="submit" className="bg-slate-800 text-white px-5 rounded-xl font-bold hover:bg-slate-900 shadow-lg active:scale-95 transition-transform flex items-center">
                            <Plus size={20} />
                        </button>
                    </form>
                </div>
            </div>
        </div>
    );
}

// --- CUSTOMER MODAL ---
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

// --- STORE MODAL ---
export function StoreModal({ onClose, onSave, storeProfile, imageMode, setImageMode, previewImage, setPreviewImage, handleFileChange }) {
    return (
        <div className={modalOverlayClass}>
            <div className="bg-white rounded-2xl w-full max-w-sm p-6 space-y-4 shadow-2xl animate-in zoom-in-95 duration-200">
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

// --- ADD STOCK MODAL ---
export function AddStockModal({ onClose, onConfirm, scannedProduct, quantityInputRef }) {
    return (
        <div className={modalOverlayClass}>
            <div className="bg-white rounded-2xl w-full max-w-sm p-6 space-y-4 shadow-2xl text-center animate-in zoom-in-95 duration-200">
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

// --- LOGOUT CONFIRM MODAL ---
export function LogoutConfirmModal({ onClose, onConfirm }) {
    return (
        <div className={modalOverlayClass}>
            <div className="bg-white rounded-2xl w-full max-w-sm p-6 space-y-4 shadow-2xl text-center animate-in zoom-in-95 duration-200">
                <AlertTriangle size={32} className="text-orange-500 mx-auto" />
                <h3 className="font-bold text-lg text-slate-800">Cerrar Sesión</h3>
                <p className="text-sm text-slate-600">⚠️ ¿Estás seguro de que quieres cerrar la sesión?</p>
                <div className="flex gap-3 pt-2">
                    <button type="button" onClick={onClose} className="flex-1 py-3 text-slate-700 font-bold bg-slate-100 rounded-lg hover:bg-slate-200">Cancelar</button>
                    <button type="button" onClick={onConfirm} className="flex-1 bg-red-600 text-white font-bold py-3 rounded-lg hover:bg-red-700"><LogOut size={18} className="inline mr-1" /> Sí, Salir</button>
                </div>
            </div>
        </div>
    );
}

// --- TRANSACTION MODAL ---
export function TransactionModal({ onClose, onSave, editingTransaction }) {
    const [localItems, setLocalItems] = useState(editingTransaction.items || []);
    const updateItem = (index, field, value) => { const newItems = [...localItems]; newItems[index] = { ...newItems[index], [field]: value }; setLocalItems(newItems); };
    const updateQty = (index, delta) => { const newItems = [...localItems]; const newQty = (newItems[index].qty || 0) + delta; if (newQty < 1) return; newItems[index].qty = newQty; setLocalItems(newItems); };
    const deleteItem = (index) => { const newItems = localItems.filter((_, i) => i !== index); setLocalItems(newItems); };
    const handleSave = () => { const newTotal = localItems.reduce((acc, item) => acc + (item.price * item.qty), 0); onSave({ items: localItems, total: newTotal }); };

    return (
        <div className="fixed inset-0 z-[20000] bg-slate-100/90 backdrop-blur-sm flex justify-center items-center animate-in fade-in duration-200">
            <div className="w-full max-w-2xl h-full sm:h-auto sm:max-h-[85vh] bg-white sm:rounded-2xl shadow-2xl flex flex-col relative">
                <div className="bg-white px-4 py-3 border-b flex items-center justify-between sticky top-0 z-10 sm:rounded-t-2xl">
                    <div className="flex items-center gap-3"><button onClick={onClose} className="p-2 -ml-2 text-slate-600 hover:bg-slate-100 rounded-full"><ArrowLeft size={24} /></button><div><h3 className="font-bold text-lg text-slate-800">Editar Pedido</h3><p className="text-xs text-slate-500">Modifica cantidades o precios</p></div></div>
                    <button onClick={handleSave} className="bg-blue-600 text-white px-4 py-2 rounded-lg font-bold text-sm shadow-md hover:bg-blue-700 transition-colors flex items-center gap-2"><CheckCircle size={18} /> Guardar</button>
                </div>
                <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-slate-50">
                    {localItems.map((item, index) => (
                        <div key={index} className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
                            <div className="flex justify-between items-start mb-3"><input className="font-bold text-slate-800 text-lg w-full outline-none border-b border-transparent focus:border-blue-300 mr-2" value={item.name} onChange={(e) => updateItem(index, 'name', e.target.value)} /><button onClick={() => deleteItem(index)} className="text-red-400 hover:text-red-600 p-1"><Trash2 size={20} /></button></div>
                            <div className="flex items-center justify-between gap-4"><div className="flex-1"><label className="text-[10px] uppercase font-bold text-slate-400">Precio Unit.</label><div className="flex items-center gap-1 border rounded-lg p-2 bg-slate-50"><span className="text-slate-400 font-bold">$</span><input type="number" className="w-full bg-transparent outline-none font-bold text-slate-700" value={item.price} onChange={(e) => updateItem(index, 'price', parseFloat(e.target.value) || 0)} /></div></div><div className="flex items-center gap-3"><button onClick={() => updateQty(index, -1)} className="w-10 h-10 rounded-full border border-slate-300 flex items-center justify-center text-slate-600 hover:bg-slate-100 active:bg-slate-200"><Minus size={18} /></button><div className="w-8 text-center font-bold text-xl">{item.qty}</div><button onClick={() => updateQty(index, 1)} className="w-10 h-10 rounded-full border border-slate-300 flex items-center justify-center text-slate-600 hover:bg-slate-100 active:bg-slate-200"><Plus size={18} /></button></div></div>
                            <div className="text-right mt-2 text-xs font-bold text-blue-600">Subtotal: ${(item.price * item.qty).toLocaleString()}</div>
                        </div>
                    ))}
                </div>
                <div className="p-4 bg-white border-t sm:rounded-b-2xl sticky bottom-0 z-10"><div className="flex justify-between items-center text-lg"><span className="font-bold text-slate-600">Nuevo Total</span><span className="font-extrabold text-2xl text-slate-900">${localItems.reduce((acc, i) => acc + (i.price * i.qty), 0).toLocaleString()}</span></div></div>
            </div>
        </div>
    );
}