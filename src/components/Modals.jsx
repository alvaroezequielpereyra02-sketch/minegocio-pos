import React, { useState, useEffect, useMemo } from 'react';
import {
    X, Trash2, ScanBarcode, Box, AlertTriangle, LogOut, Plus, Minus,
    CheckCircle, ArrowLeft, Key, Copy, Loader2, AlertCircle, FolderTree,
    ChevronDown, Folder, FolderOpen, Edit, CornerDownRight, Eye, EyeOff, Edit3, Check,
    FileDown, Filter, TrendingUp, TrendingDown, Percent, Hash, RefreshCw,
} from 'lucide-react';

// IMPORTANTE: Rutas y nombres corregidos para el build de Vercel
import { uploadImage } from '../config/uploadImage';
import { compressImage } from '../utils/imageHelpers';

const modalOverlayClass = "fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-[200] backdrop-blur-sm animate-in fade-in duration-200";

// --- MODALES INDIVIDUALES EXPORTADOS ---

export function ConfirmModal({ title, message, onConfirm, onCancel, confirmText = "Confirmar", cancelText = "Cancelar", isDanger = false }) {
    return (
        <div className={modalOverlayClass} style={{ zIndex: 99999 }}>
            <div className="bg-[#EDE8DC] rounded-2xl w-full max-w-sm p-6 shadow-2xl text-center animate-in zoom-in-95 duration-200 border border-slate-100">
                <div className={`mx-auto w-12 h-12 rounded-full flex items-center justify-center mb-4 ${isDanger ? 'bg-red-100 text-red-600' : 'bg-amber-100 text-[#8B6914]'}`}>
                    {isDanger ? <AlertTriangle size={24} /> : <AlertCircle size={24} />}
                </div>
                <h3 className="text-lg font-bold text-slate-900 mb-2">{title}</h3>
                <p className="text-sm text-slate-600 mb-6 leading-relaxed whitespace-pre-line">{message}</p>
                <div className="flex gap-3">
                    <button onClick={onCancel} className="flex-1 py-3 text-[#5C4A2A] font-bold bg-[#E8E0CC] rounded-xl hover:bg-[#D4C9B0]">
                        {cancelText}
                    </button>
                    <button onClick={onConfirm} className={`flex-1 py-3 text-white font-bold rounded-xl shadow-md ${isDanger ? 'bg-red-600' : 'bg-[#8B6914]'}`}>
                        {confirmText}
                    </button>
                </div>
            </div>
        </div>
    );
}

export function ProcessingModal() {
    return (
        <div className="fixed inset-0 bg-[#F5F0E8]/80 backdrop-blur-md flex flex-col items-center justify-center z-[300]">
            <div className="bg-[#EDE8DC] p-8 rounded-3xl shadow-2xl flex flex-col items-center text-center">
                <div className="relative mb-6">
                    <div className="w-20 h-20 border-4 border-[#D4C9B0] rounded-full"></div>
                    <div className="absolute top-0 left-0 w-20 h-20 border-4 border-[#8B6914] rounded-full border-t-transparent animate-spin"></div>
                    <Loader2 className="absolute top-7 left-7 text-[#8B6914] animate-pulse" size={24} />
                </div>
                <h3 className="text-xl font-extrabold text-slate-800">Procesando</h3>
                <p className="text-sm text-slate-400">Por favor espere...</p>
            </div>
        </div>
    );
}

export function InvitationModal({ onClose, onGenerate, showNotification = () => {} }) {
    const [generatedCode, setGeneratedCode] = useState(null);
    const [isGenerating, setIsGenerating] = useState(false);

    // onGenerate() genera el código en Firestore y devuelve el código guardado.
    // El modal solo muestra lo que devuelve — nunca genera su propio código.
    const handleGenerate = async () => {
        setIsGenerating(true);
        try {
            const code = await onGenerate();
            setGeneratedCode(code);
        } catch (e) {
            // ✅ FIX: reemplazado alert() por showNotification
            showNotification('❌ Error al generar el código. Intentá de nuevo.');
        } finally {
            setIsGenerating(false);
        }
    };
    const copyToClipboard = () => {
        navigator.clipboard.writeText(generatedCode).then(() => {
            // ✅ FIX: reemplazado alert("Copiado") por showNotification
            showNotification('✅ Código copiado al portapapeles');
        });
    };

    return (
        <div className={modalOverlayClass}>
            <div className="bg-[#EDE8DC] rounded-2xl w-full max-w-sm p-6 shadow-2xl text-center">
                <div className="flex justify-between items-center mb-4">
                    <h3 className="font-bold text-lg text-slate-800 flex items-center gap-2"><Key size={20} /> Nueva Invitación</h3>
                    <button onClick={onClose}><X size={20} /></button>
                </div>
                {!generatedCode ? (
                    <button onClick={handleGenerate} disabled={isGenerating} className="w-full py-3 font-black rounded-xl btn-accent disabled:opacity-60">{isGenerating ? 'Generando...' : 'Generar Código'}</button>
                ) : (
                    <div className="space-y-4">
                        <div className="p-4 bg-[#F5F0E8] rounded-xl font-black text-3xl border border-[#D4C9B0]">{generatedCode}</div>
                        <button onClick={copyToClipboard} className="w-full py-3 bg-green-600 text-white font-bold rounded-xl flex items-center justify-center gap-2">
                            <Copy size={18} /> Copiar
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
}

export function ExpenseModal({ onClose, onSave }) {
    return (
        <div className={modalOverlayClass}>
            <div className="bg-[#EDE8DC] rounded-2xl w-full max-w-sm p-6 space-y-4 shadow-2xl">
                <div className="flex justify-between items-center"><h3 className="font-bold text-lg text-red-600">Registrar Gasto</h3><button onClick={onClose}><X size={20} /></button></div>
                <form onSubmit={onSave} className="space-y-3">
                    <input name="description" required className="w-full p-2 border rounded" placeholder="Descripción..." />
                    <input name="amount" type="number" required className="w-full p-2 border rounded font-bold" placeholder="Monto $0.00" />
                    <button type="submit" className="w-full bg-red-600 text-white font-bold py-2 rounded">Guardar Gasto</button>
                </form>
            </div>
        </div>
    );
}

export function ProductModal({ onClose, onSave, onDelete, editingProduct, imageMode, setImageMode, previewImage, setPreviewImage, handleFileChange, categories, subcategories, onRegisterFaulty }) {
    const [selectedCat, setSelectedCat] = useState(editingProduct?.categoryId || "");

    return (
        <div className={modalOverlayClass}>
            <div className="bg-[#EDE8DC] rounded-2xl w-full max-w-md p-6 space-y-4 shadow-2xl overflow-y-auto max-h-[90vh]">
                <div className="flex justify-between items-center">
                    <h3 className="font-bold text-lg">{editingProduct ? 'Editar' : 'Nuevo'} Producto</h3>
                    {editingProduct && <button type="button" onClick={() => onDelete(editingProduct.id)} className="text-red-500 text-xs underline">Eliminar</button>}
                </div>
                <form onSubmit={onSave} className="space-y-3">
                    <input required name="name" defaultValue={editingProduct?.name} className="w-full p-2 border rounded" placeholder="Nombre" />
                    <div className="flex gap-2 items-center border border-[#D4C9B0] p-2 rounded bg-[#F5F0E8]">
                        <ScanBarcode size={16} className="text-slate-400" />
                        <input name="barcode" defaultValue={editingProduct?.barcode} className="w-full bg-transparent outline-none text-sm" placeholder="Código de Barras" />
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                        <input required name="price" type="number" step="any" defaultValue={editingProduct?.price} className="p-2 border rounded" placeholder="Precio Venta" />
                        <input name="cost" type="number" step="any" defaultValue={editingProduct?.cost} className="p-2 border rounded" placeholder="Costo" />
                    </div>
                    <div className="border rounded p-3 space-y-2 bg-amber-50 border-amber-200">
                        <p className="text-xs font-bold text-amber-700 uppercase tracking-wide">Precio Mayorista (opcional)</p>
                        <div className="grid grid-cols-2 gap-2">
                            <input name="wholesalePrice" type="number" step="any" defaultValue={editingProduct?.wholesalePrice || ''} className="p-2 border rounded text-sm" placeholder="Precio mayorista" />
                            <input name="wholesaleMinQty" type="number" defaultValue={editingProduct?.wholesaleMinQty || ''} className="p-2 border rounded text-sm" placeholder="Cantidad mínima" />
                        </div>
                        <p className="text-[10px] text-amber-600">Si el cliente compra la cantidad mínima o más, se aplica el precio mayorista automáticamente.</p>
                    </div>
                    <input required name="stock" type="number" defaultValue={editingProduct?.stock} className="w-full p-2 border rounded" placeholder="Stock Inicial" />

                    <div className="grid grid-cols-2 gap-2">
                        <select name="category" value={selectedCat} onChange={(e) => setSelectedCat(e.target.value)} className="p-2 border rounded text-sm">
                            <option value="">Categoría...</option>
                            {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                        </select>
                        <select name="subcategory" defaultValue={editingProduct?.subCategoryId || ""} className="p-2 border rounded text-sm" disabled={!selectedCat}>
                            <option value="">Subcategoría...</option>
                            {subcategories?.filter(s => s.parentId === selectedCat).map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                        </select>
                    </div>

                    <div className="flex gap-2 bg-[#E8E0CC] p-1 rounded">
                        <button type="button" onClick={() => setImageMode('file')} className={`flex-1 py-1 text-xs rounded ${imageMode === 'file' ? 'bg-[#F5F0E8] shadow' : ''}`}>Subir</button>
                        <button type="button" onClick={() => setImageMode('link')} className={`flex-1 py-1 text-xs rounded ${imageMode === 'link' ? 'bg-[#F5F0E8] shadow' : ''}`}>Link</button>
                    </div>

                    {imageMode === 'file' ? (
                        <input type="file" accept="image/*" onChange={handleFileChange} className="text-xs" />
                    ) : (
                        <input name="imageUrlLink" defaultValue={!editingProduct?.imageUrl?.startsWith('data:') ? editingProduct?.imageUrl : ''} className="w-full p-2 border rounded text-sm" placeholder="URL imagen..." onChange={(e) => setPreviewImage(e.target.value)} />
                    )}

                    {(previewImage || editingProduct?.imageUrl) && (
                        <img src={previewImage || editingProduct.imageUrl} className="h-20 w-full object-contain border rounded" />
                    )}

                    <div className="flex gap-2 pt-2">
                        <button type="button" onClick={onClose} className="flex-1 py-2 text-slate-500">Cancelar</button>
                        <button type="submit" className="flex-1 text-white py-2 rounded font-bold" style={{background:"linear-gradient(135deg,#8B6914,#6B4F0F)"}}>Guardar</button>
                        {editingProduct && (
                            <button type="button" onClick={onRegisterFaulty} className="flex-1 bg-red-600 text-white py-2 rounded font-bold">Falla</button>
                        )}
                    </div>
                </form>
            </div>
        </div>
    );
}

export function CategoryModal({ onClose, onSave, onDelete, categories, onSaveSub, onDeleteSub, subcategories = [], onUpdate }) {
    const [expandedCat, setExpandedCat] = useState(null);
    const [editingId, setEditingId] = useState(null);
    const [editName, setEditName] = useState("");

    const startEdit = (cat, e) => { e.stopPropagation(); setEditingId(cat.id); setEditName(cat.name); };
    const saveEdit = (e) => { e.preventDefault(); if (editName.trim()) { onUpdate(editingId, { name: editName }); setEditingId(null); } };

    return (
        <div className={modalOverlayClass}>
            <div className="bg-[#EDE8DC] rounded-2xl w-full max-w-md shadow-2xl flex flex-col max-h-[85vh] overflow-hidden">
                <div className="p-4 bg-[#2C1810] text-white flex justify-between items-center">
                    <h3 className="font-bold flex items-center gap-2"><FolderTree size={20} /> Categorías</h3>
                    <button onClick={onClose}><X size={24} /></button>
                </div>
                <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-slate-50">
                    {categories.map(cat => (
                        <div key={cat.id} className="bg-white rounded-xl border border-slate-200">
                            <div className="flex justify-between items-center p-3">
                                {editingId === cat.id ? (
                                    <form onSubmit={saveEdit} className="flex gap-2 flex-1">
                                        <input autoFocus value={editName} onChange={(e) => setEditName(e.target.value)} className="flex-1 p-1 border rounded" />
                                        <button type="submit" className="text-green-600"><Check size={20} /></button>
                                        <button type="button" onClick={() => setEditingId(null)} className="text-red-600"><X size={20} /></button>
                                    </form>
                                ) : (
                                    <>
                                        <div className="flex items-center gap-3 flex-1 cursor-pointer" onClick={() => setExpandedCat(expandedCat === cat.id ? null : cat.id)}>
                                            <Folder size={20} className="text-slate-400" />
                                            <span className="font-bold text-slate-800">{cat.name}</span>
                                        </div>
                                        <div className="flex gap-1">
                                            <button onClick={(e) => startEdit(cat, e)} className="p-1 text-slate-400 hover:text-orange-500"><Edit3 size={16} /></button>
                                            <button onClick={(e) => { e.stopPropagation(); onUpdate(cat.id, { isActive: !cat.isActive }); }} className="p-1">
                                                {cat.isActive !== false ? <Eye size={18} className="text-green-600" /> : <EyeOff size={18} className="text-slate-400" />}
                                            </button>
                                        </div>
                                    </>
                                )}
                            </div>
                            {expandedCat === cat.id && (
                                <div className="p-3 border-t bg-slate-50">
                                    <div className="space-y-1 mb-3">
                                        {subcategories.filter(s => s.parentId === cat.id).map(sub => (
                                            <div key={sub.id} className="flex justify-between text-sm py-1 pl-4">
                                                <span className="text-slate-600">{sub.name}</span>
                                                <button onClick={() => onDeleteSub(sub.id)} className="text-red-300 hover:text-red-500"><Trash2 size={14} /></button>
                                            </div>
                                        ))}
                                    </div>
                                    <form onSubmit={(e) => { e.preventDefault(); onSaveSub(cat.id, e.target.sub.value); e.target.reset(); }} className="flex gap-2">
                                        <input name="sub" placeholder="Nueva subcategoría..." className="flex-1 text-xs p-1 border rounded" />
                                        <button type="submit" className="bg-orange-500 text-white p-1 rounded"><Plus size={14} /></button>
                                    </form>
                                    <button onClick={() => onDelete(cat.id)} className="w-full mt-3 text-[10px] text-red-400 hover:text-red-600 font-bold">Eliminar Categoría Principal</button>
                                </div>
                            )}
                        </div>
                    ))}
                </div>
                <form onSubmit={onSave} className="p-4 bg-white border-t flex gap-2">
                    <input name="catName" required className="flex-1 p-2 border rounded-xl text-sm" placeholder="Nueva Categoría Principal..." />
                    <button type="submit" className="bg-slate-800 text-white px-4 rounded-xl"><Plus size={20} /></button>
                </form>
            </div>
        </div>
    );
}

export function CustomerModal({ onClose, onSave, editingCustomer }) {
    return (
        <div className={modalOverlayClass}>
            <div className="bg-white rounded-2xl w-full max-w-md p-6 space-y-4 shadow-2xl">
                <h3 className="font-bold text-lg">{editingCustomer ? 'Editar' : 'Nuevo'} Cliente</h3>
                <form onSubmit={onSave} className="space-y-3">
                    <input required name="name" defaultValue={editingCustomer?.name} className="w-full p-2 border rounded" placeholder="Nombre" />
                    <input required name="phone" defaultValue={editingCustomer?.phone} className="w-full p-2 border rounded" placeholder="Teléfono" />
                    <input name="address" defaultValue={editingCustomer?.address} className="w-full p-2 border rounded" placeholder="Dirección" />
                    <input name="email" type="email" defaultValue={editingCustomer?.email} className="w-full p-2 border rounded" placeholder="Email" />
                    <div className="flex gap-2">
                        <button type="button" onClick={onClose} className="flex-1 py-2 text-slate-500">Cancelar</button>
                        <button type="submit" className="flex-1 text-white py-2 rounded font-bold" style={{background:"linear-gradient(135deg,#8B6914,#6B4F0F)"}}>Guardar</button>
                    </div>
                </form>
            </div>
        </div>
    );
}

export function StoreModal({ onClose, onSave, storeProfile, imageMode, setImageMode, previewImage, setPreviewImage, handleFileChange }) {
    return (
        <div className={modalOverlayClass}>
            <div className="bg-[#EDE8DC] rounded-2xl w-full max-w-sm p-6 space-y-4 shadow-2xl">
                <div className="flex justify-between items-center"><h3 className="font-bold text-lg">Perfil del Negocio</h3><button onClick={onClose}><X size={20} /></button></div>
                <form onSubmit={onSave} className="space-y-4">
                    <input name="storeName" defaultValue={storeProfile.name} required className="w-full p-2 border rounded" placeholder="Nombre del Negocio" />
                    <div className="flex gap-2 bg-[#E8E0CC] p-1 rounded-lg">
                        <button type="button" onClick={() => setImageMode('file')} className={`flex-1 py-1 text-xs rounded ${imageMode === 'file' ? 'bg-white shadow font-bold' : ''}`}>Subir</button>
                        <button type="button" onClick={() => setImageMode('link')} className={`flex-1 py-1 text-xs rounded ${imageMode === 'link' ? 'bg-white shadow font-bold' : ''}`}>Link</button>
                    </div>
                    {imageMode === 'file' ? <input type="file" onChange={handleFileChange} className="text-xs" /> : <input name="logoUrlLink" className="w-full p-2 border rounded text-xs" placeholder="URL del logo..." onChange={(e) => setPreviewImage(e.target.value)} />}
                    <button type="submit" className="w-full bg-orange-500 text-white font-bold py-2 rounded">Guardar Cambios</button>
                </form>
            </div>
        </div>
    );
}

export function AddStockModal({ onClose, onConfirm, scannedProduct, quantityInputRef }) {
    return (
        <div className={modalOverlayClass}>
            <div className="bg-[#EDE8DC] rounded-2xl w-full max-w-sm p-6 space-y-4 shadow-2xl text-center">
                <h3 className="font-bold text-lg">Entrada Stock</h3>
                <div className="bg-slate-100 p-3 rounded-lg font-bold">{scannedProduct?.name}</div>
                <form onSubmit={onConfirm}>
                    <input ref={quantityInputRef} name="qty" type="number" defaultValue="1" min="1" className="w-32 p-3 border-2 border-orange-400 rounded-lg text-center text-2xl font-bold mb-4" />
                    <div className="flex gap-2">
                        <button type="button" onClick={onClose} className="flex-1 py-3 bg-slate-100 rounded-lg">Cancelar</button>
                        <button type="submit" className="flex-1 bg-orange-500 text-white font-bold py-3 rounded-lg">Confirmar</button>
                    </div>
                </form>
            </div>
        </div>
    );
}

export function LogoutConfirmModal({ onClose, onConfirm }) {
    return (
        <div className={modalOverlayClass}>
            <div className="bg-white rounded-2xl w-full max-w-sm p-6 text-center space-y-4 shadow-2xl">
                <AlertTriangle size={32} className="text-orange-500 mx-auto" />
                <h3 className="font-bold text-lg">Cerrar Sesión</h3>
                <p className="text-sm text-slate-600">¿Estás seguro de que quieres salir?</p>
                <div className="flex gap-3">
                    <button onClick={onClose} className="flex-1 py-3 bg-slate-100 rounded-lg font-bold">Cancelar</button>
                    <button onClick={onConfirm} className="flex-1 bg-red-600 text-white py-3 rounded-lg font-bold">Sí, Salir</button>
                </div>
            </div>
        </div>
    );
}

export function TransactionModal({ onClose, onSave, editingTransaction }) {
    const [localItems, setLocalItems] = useState(editingTransaction.items || []);

    const updateQty = (index, delta) => {
        const newItems = [...localItems];
        const newQty = (newItems[index].qty || 0) + delta;
        if (newQty < 1) return;
        newItems[index].qty = newQty;
        setLocalItems(newItems);
    };

    const handleSave = () => {
        const newTotal = localItems.reduce((acc, item) => acc + (item.price * item.qty), 0);
        onSave({ items: localItems, total: newTotal });
    };

    // Memoizado para no recalcular en cada render — solo cuando localItems cambia
    const currentTotal = useMemo(
        () => localItems.reduce((acc, i) => acc + (i.price * i.qty), 0),
        [localItems]
    );

    return (
        <div className="fixed inset-0 z-[400] bg-slate-100/90 backdrop-blur-sm flex justify-center items-center">
            <div className="w-full max-w-2xl h-full sm:h-auto sm:max-h-[85vh] bg-white sm:rounded-2xl shadow-2xl flex flex-col">
                <div className="p-4 border-b flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-full"><ArrowLeft size={24} /></button>
                        <h3 className="font-bold text-lg text-slate-800">Editar Pedido</h3>
                    </div>
                    <button
                        onClick={handleSave}
                        // 🛡️ CORRECCIÓN: Usamos localItems y currentTotal
                        disabled={localItems.length === 0 || currentTotal === 0}
                        className={`px-4 py-2 rounded-lg font-bold transition-all ${(localItems.length === 0 || currentTotal === 0)
                                ? 'bg-slate-300 text-slate-500 cursor-not-allowed'
                                : 'bg-orange-500 text-white hover:bg-orange-600 shadow-md active:scale-95'
                            }`}
                    >
                        {localItems.length === 0 ? 'Cargando...' : 'Guardar Cambios'}
                    </button>
                </div>
                <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-slate-50">
                    {localItems.map((item, index) => (
                        <div key={index} className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex justify-between items-center">
                            <div className="flex-1">
                                <div className="font-bold text-slate-800">{item.name}</div>
                                <div className="text-xs text-orange-500 font-bold">${item.price} x {item.qty}</div>
                            </div>
                            <div className="flex items-center gap-3">
                                <button onClick={() => updateQty(index, -1)} className="w-8 h-8 rounded-full border flex items-center justify-center hover:bg-slate-100"><Minus size={16} /></button>
                                <span className="font-bold">{item.qty}</span>
                                <button onClick={() => updateQty(index, 1)} className="w-8 h-8 rounded-full border flex items-center justify-center hover:bg-slate-100"><Plus size={16} /></button>
                            </div>
                        </div>
                    ))}
                </div>
                <div className="p-4 bg-white border-t flex justify-between items-center font-black text-2xl">
                    <span className="font-bold text-slate-600 text-sm">Total Boleta:</span>
                    <span>${currentTotal.toLocaleString()}</span>
                </div>
            </div>
        </div>
    );
}

export function FaultyProductModal({ onClose, onConfirm, product }) {
    const [qty, setQty] = useState(1);
    const [reason, setReason] = useState("");

    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-[500] backdrop-blur-sm">
            <div className="bg-white rounded-2xl w-full max-w-sm p-6 shadow-2xl animate-in zoom-in-95">
                <div className="flex items-center gap-3 mb-4 text-orange-600">
                    <AlertCircle size={32} />
                    <h3 className="font-bold text-lg">Registrar Falla</h3>
                </div>

                <div className="bg-slate-50 p-3 rounded-lg mb-4">
                    <div className="font-bold text-sm text-slate-800 uppercase">{product.name}</div>
                    <div className="text-xs text-slate-500 font-bold">STOCK ACTUAL: <span className="text-slate-800">{product?.stock ?? 0}</span></div>
                </div>

                <form onSubmit={(e) => { e.preventDefault(); onConfirm(product, qty, reason); }} className="space-y-4">
                    <div>
                        <label className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-1 block">Unidades con Falla</label>
                        <input
                            type="number" min="1" max={product.stock} required
                            value={qty} onChange={(e) => setQty(Number(e.target.value))}
                            className="w-full p-3 border-2 border-orange-100 rounded-xl text-center text-2xl font-black text-orange-600 outline-none focus:border-orange-300 transition-colors"
                        />
                    </div>
                    <div>
                        <label className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-1 block">Motivo / Nota</label>
                        <textarea
                            className="w-full p-2 border rounded-lg text-sm bg-slate-50 outline-none focus:bg-white transition-colors h-20 resize-none"
                            placeholder="Ej: Roto de fábrica, vencido..."
                            value={reason} onChange={(e) => setReason(e.target.value)}
                        />
                    </div>
                    <div className="flex gap-2">
                        <button
                            type="button"
                            onClick={onClose}
                            className="flex-1 py-3 bg-slate-100 text-slate-600 rounded-xl font-bold hover:bg-slate-200 transition-colors"
                        >
                            Cancelar
                        </button>
                        <button
                            type="submit"
                            className="flex-1 bg-orange-600 text-white py-3 rounded-xl font-bold shadow-lg shadow-orange-100 active:scale-95 transition-all"
                        >
                            Confirmar
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
// ─────────────────────────────────────────────────────────────────────────────
// ShoppingListModal
// Permite al admin elegir qué categorías incluir en el PDF de faltantes.
// ─────────────────────────────────────────────────────────────────────────────
export function ShoppingListModal({ onClose, categories = [], onGenerate }) {
    // IDs seleccionados. Vacío = "Todas".
    const [selected, setSelected] = useState([]);
    const [isGenerating, setIsGenerating] = useState(false);

    const ALL_OPTION_ID = '__todas__';
    const SIN_CAT_ID    = '__sin_categoria__';

    // Opciones disponibles: categorías reales + "Sin categoría"
    const options = [
        ...categories.map(c => ({ id: c.id, name: c.name })),
        { id: SIN_CAT_ID, name: 'Sin categoría' },
    ];

    const allSelected = selected.length === 0;

    const toggle = (id) => {
        if (id === ALL_OPTION_ID) {
            setSelected([]);
            return;
        }
        setSelected(prev =>
            prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
        );
    };

    const handleGenerate = async () => {
        setIsGenerating(true);
        try {
            await onGenerate(selected); // selected vacío = todas
            onClose();
        } finally {
            setIsGenerating(false);
        }
    };

    const selectedLabel = allSelected
        ? 'Todas las categorías'
        : selected.length === 1
            ? options.find(o => o.id === selected[0])?.name || '1 categoría'
            : `${selected.length} categorías`;

    return (
        <div className="fixed inset-0 bg-black/50 flex items-end sm:items-center justify-center p-0 sm:p-4 z-[200] backdrop-blur-sm animate-in fade-in duration-200">
            <div className="bg-[#EDE8DC] rounded-t-3xl sm:rounded-2xl w-full sm:max-w-md shadow-2xl border border-[#D4C9B0] animate-in slide-in-from-bottom sm:zoom-in-95 duration-200">

                {/* Header */}
                <div className="flex items-center justify-between px-5 pt-5 pb-4 border-b border-[#D4C9B0]">
                    <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-lg bg-yellow-100 flex items-center justify-center">
                            <Filter size={16} className="text-yellow-700" />
                        </div>
                        <div>
                            <h3 className="font-bold text-[#3D2B1F] text-base leading-none">Lista de faltantes</h3>
                            <p className="text-xs text-[#8B6914] mt-0.5">Seleccioná las categorías a incluir</p>
                        </div>
                    </div>
                    <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-[#D4C9B0] transition-colors">
                        <X size={18} className="text-[#5C4A2A]" />
                    </button>
                </div>

                {/* Lista de opciones */}
                <div className="px-5 py-3 max-h-72 overflow-y-auto space-y-1.5">

                    {/* Opción "Todas" */}
                    <button
                        onClick={() => toggle(ALL_OPTION_ID)}
                        className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl border-2 transition-all text-left ${
                            allSelected
                                ? 'bg-[#8B6914] border-[#8B6914] text-white'
                                : 'bg-white border-[#D4C9B0] text-[#3D2B1F] hover:border-[#8B6914]/40'
                        }`}
                    >
                        <div className={`w-5 h-5 rounded-md border-2 flex items-center justify-center shrink-0 transition-all ${
                            allSelected ? 'border-white bg-white/20' : 'border-[#D4C9B0]'
                        }`}>
                            {allSelected && <Check size={12} className="text-white" strokeWidth={3} />}
                        </div>
                        <span className="font-bold text-sm">Todas las categorías</span>
                        <span className={`ml-auto text-xs font-medium px-2 py-0.5 rounded-full ${
                            allSelected ? 'bg-white/20 text-white' : 'bg-[#EDE8DC] text-[#8B6914]'
                        }`}>
                            PDF completo
                        </span>
                    </button>

                    {/* Separador */}
                    {options.length > 0 && (
                        <div className="flex items-center gap-2 py-1">
                            <div className="flex-1 h-px bg-[#D4C9B0]" />
                            <span className="text-[10px] text-[#A09070] font-medium uppercase tracking-wider">o por categoría</span>
                            <div className="flex-1 h-px bg-[#D4C9B0]" />
                        </div>
                    )}

                    {/* Categorías individuales */}
                    {options.map(opt => {
                        const isOn = selected.includes(opt.id);
                        return (
                            <button
                                key={opt.id}
                                onClick={() => toggle(opt.id)}
                                className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl border-2 transition-all text-left ${
                                    isOn
                                        ? 'bg-blue-600 border-blue-600 text-white'
                                        : 'bg-white border-[#D4C9B0] text-[#3D2B1F] hover:border-blue-300'
                                }`}
                            >
                                <div className={`w-5 h-5 rounded-md border-2 flex items-center justify-center shrink-0 transition-all ${
                                    isOn ? 'border-white bg-white/20' : 'border-[#D4C9B0]'
                                }`}>
                                    {isOn && <Check size={12} className="text-white" strokeWidth={3} />}
                                </div>
                                <span className="font-medium text-sm flex-1">{opt.name}</span>
                            </button>
                        );
                    })}

                    {options.length === 0 && (
                        <p className="text-center text-sm text-[#A09070] py-4">
                            No hay categorías creadas todavía.
                        </p>
                    )}
                </div>

                {/* Footer */}
                <div className="px-5 py-4 border-t border-[#D4C9B0] space-y-2">
                    <p className="text-xs text-[#A09070] text-center">
                        {allSelected
                            ? 'Se incluirán todos los productos con stock negativo'
                            : `Incluyendo: ${selectedLabel}`}
                    </p>
                    <button
                        onClick={handleGenerate}
                        disabled={isGenerating}
                        className="w-full py-3.5 btn-accent rounded-xl font-black text-sm flex items-center justify-center gap-2 disabled:opacity-60 active:scale-[0.98] transition-all"
                    >
                        {isGenerating
                            ? <><Loader2 size={16} className="animate-spin" /> Generando PDF...</>
                            : <><FileDown size={16} /> Descargar PDF de faltantes</>
                        }
                    </button>
                </div>
            </div>
        </div>
    );
}

// ─────────────────────────────────────────────────────────────────────────────
// BulkPriceModal
// Actualización masiva de precios/costos por categoría o subcategoría.
// ─────────────────────────────────────────────────────────────────────────────
export function BulkPriceModal({ onClose, categories = [], subcategories = [], products = [], onApply }) {
    // El valor del select puede ser:
    //   '__all__'           → todos los productos
    //   'cat:ID'            → solo categoría (todos sus productos sin importar subcategoría)
    //   'sub:ID'            → solo subcategoría específica
    const [selection, setSelection] = useState('__all__');
    const [type,      setType]      = useState('percent');
    const [value,     setValue]     = useState('');
    const [field,     setField]     = useState('price');
    const [roundTo,   setRoundTo]   = useState('10');
    const [isApplying, setIsApplying] = useState(false);
    const [result,     setResult]     = useState(null);

    // Resolver qué productos toca la selección actual
    const affectedProducts = useMemo(() => {
        if (selection === '__all__') return products;
        if (selection.startsWith('cat:')) {
            const catId = selection.slice(4);
            return products.filter(p => p.categoryId === catId);
        }
        if (selection.startsWith('sub:')) {
            const subId = selection.slice(4);
            return products.filter(p => p.subCategoryId === subId);
        }
        return products;
    }, [selection, products]);

    // Nombre legible de la selección para mostrar en el preview y confirmación
    const selectionLabel = useMemo(() => {
        if (selection === '__all__') return 'Todas las categorías';
        if (selection.startsWith('cat:')) {
            const catId = selection.slice(4);
            return categories.find(c => c.id === catId)?.name || catId;
        }
        if (selection.startsWith('sub:')) {
            const subId = selection.slice(4);
            return subcategories.find(s => s.id === subId)?.name || subId;
        }
        return selection;
    }, [selection, categories, subcategories]);

    // Preview en tiempo real
    const previewItems = useMemo(() => {
        if (!value || isNaN(Number(value))) return [];
        const numVal   = Number(value);
        const numRound = Number(roundTo) || 0;
        const round    = (n) => numRound > 0 ? Math.round(n / numRound) * numRound : Math.round(n);
        const apply    = (current) => round(Math.max(0, type === 'percent'
            ? Number(current || 0) * (1 + numVal / 100)
            : Number(current || 0) + numVal
        ));
        return affectedProducts.slice(0, 5).map(p => ({
            name:     p.name,
            oldPrice: p.price,
            newPrice: (field === 'price' || field === 'both') ? apply(p.price) : p.price,
            oldCost:  p.cost,
            newCost:  (field === 'cost'  || field === 'both') ? apply(p.cost)  : p.cost,
        }));
    }, [affectedProducts, type, value, field, roundTo]);

    const handleApply = async () => {
        if (!value || isNaN(Number(value))) return;
        setIsApplying(true);
        try {
            // Traducir la selección a los parámetros que espera useInventory
            let catParam = '__all__';
            if (selection.startsWith('cat:')) catParam = selection.slice(4);
            // Para subcategorías, filtramos manualmente — pasamos los IDs directamente
            if (selection.startsWith('sub:')) catParam = '__sub__:' + selection.slice(4);

            const res = await onApply(catParam, {
                type, value: Number(value), field, roundTo: Number(roundTo) || 0,
            });
            setResult(res);
        } finally {
            setIsApplying(false);
        }
    };

    const isPositive = Number(value) >= 0;

    return (
        <div className="fixed inset-0 bg-black/50 flex items-end sm:items-center justify-center p-0 sm:p-4 z-[200] backdrop-blur-sm animate-in fade-in duration-200">
            <div className="bg-[#EDE8DC] rounded-t-3xl sm:rounded-2xl w-full sm:max-w-lg shadow-2xl border border-[#D4C9B0] animate-in slide-in-from-bottom sm:zoom-in-95 duration-200">

                {/* Header */}
                <div className="flex items-center justify-between px-5 pt-5 pb-4 border-b border-[#D4C9B0]">
                    <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-lg bg-blue-100 flex items-center justify-center">
                            {isPositive ? <TrendingUp size={16} className="text-blue-700" /> : <TrendingDown size={16} className="text-red-600" />}
                        </div>
                        <div>
                            <h3 className="font-bold text-[#3D2B1F] text-base leading-none">Actualizar precios</h3>
                            <p className="text-xs text-[#8B6914] mt-0.5">Aumento o baja masiva por categoría</p>
                        </div>
                    </div>
                    <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-[#D4C9B0] transition-colors">
                        <X size={18} className="text-[#5C4A2A]" />
                    </button>
                </div>

                <div className="px-5 py-4 space-y-4 max-h-[70vh] overflow-y-auto">
                    {result ? (
                        /* ── Pantalla de éxito ── */
                        <div className="flex flex-col items-center py-6 gap-3 text-center">
                            <div className="w-14 h-14 rounded-full bg-green-100 flex items-center justify-center">
                                <CheckCircle size={28} className="text-green-600" />
                            </div>
                            <p className="font-bold text-[#3D2B1F] text-base">
                                ¡{result.updated} producto{result.updated !== 1 ? 's' : ''} actualizado{result.updated !== 1 ? 's' : ''}!
                            </p>
                            <p className="text-sm text-[#7A6040]">Los nuevos precios ya están activos.</p>
                            <button onClick={onClose} className="mt-2 w-full py-3 btn-accent rounded-xl font-black text-sm">Listo</button>
                        </div>
                    ) : (
                        <>
                            {/* ── Categoría / Subcategoría ── */}
                            <div>
                                <label className="text-xs font-bold text-[#5C4A2A] uppercase tracking-wider block mb-1.5">
                                    Categoría o subcategoría
                                </label>
                                <select
                                    value={selection}
                                    onChange={e => setSelection(e.target.value)}
                                    className="w-full px-3 py-2.5 rounded-xl bg-white border border-[#D4C9B0] text-[#3D2B1F] text-sm outline-none focus:border-[#8B6914]"
                                >
                                    <option value="__all__">Todas las categorías ({products.length} productos)</option>

                                    {categories.map(cat => {
                                        const catCount = products.filter(p => p.categoryId === cat.id).length;
                                        const catSubs  = subcategories.filter(s => s.parentId === cat.id);
                                        return (
                                            <optgroup key={cat.id} label={`── ${cat.name}`}>
                                                {/* Opción para toda la categoría */}
                                                <option value={`cat:${cat.id}`}>
                                                    {cat.name} — completa ({catCount} productos)
                                                </option>
                                                {/* Subcategorías hijas */}
                                                {catSubs.map(sub => {
                                                    const subCount = products.filter(p => p.subCategoryId === sub.id).length;
                                                    return (
                                                        <option key={sub.id} value={`sub:${sub.id}`}>
                                                            &nbsp;&nbsp;↳ {sub.name} ({subCount} productos)
                                                        </option>
                                                    );
                                                })}
                                            </optgroup>
                                        );
                                    })}

                                    {/* Subcategorías huérfanas (sin categoría padre conocida) */}
                                    {subcategories.filter(s => !categories.find(c => c.id === s.parentId)).length > 0 && (
                                        <optgroup label="── Sin categoría padre">
                                            {subcategories
                                                .filter(s => !categories.find(c => c.id === s.parentId))
                                                .map(sub => {
                                                    const subCount = products.filter(p => p.subCategoryId === sub.id).length;
                                                    return (
                                                        <option key={sub.id} value={`sub:${sub.id}`}>
                                                            {sub.name} ({subCount} productos)
                                                        </option>
                                                    );
                                                })}
                                        </optgroup>
                                    )}
                                </select>
                            </div>

                            {/* ── Tipo de ajuste ── */}
                            <div>
                                <label className="text-xs font-bold text-[#5C4A2A] uppercase tracking-wider block mb-1.5">Tipo de ajuste</label>
                                <div className="grid grid-cols-2 gap-2">
                                    {[{ k: 'percent', icon: <Percent size={15} />, label: 'Porcentaje' }, { k: 'fixed', icon: <Hash size={15} />, label: 'Monto fijo' }].map(opt => (
                                        <button key={opt.k} onClick={() => setType(opt.k)}
                                            className={`flex items-center justify-center gap-2 py-2.5 rounded-xl border-2 font-bold text-sm transition-all ${type === opt.k ? 'bg-blue-600 border-blue-600 text-white' : 'bg-white border-[#D4C9B0] text-[#3D2B1F] hover:border-blue-300'}`}>
                                            {opt.icon} {opt.label}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* ── Valor ── */}
                            <div>
                                <label className="text-xs font-bold text-[#5C4A2A] uppercase tracking-wider block mb-1.5">
                                    {type === 'percent' ? 'Porcentaje (negativo para bajar)' : 'Monto a sumar (negativo para restar)'}
                                </label>
                                <div className="relative">
                                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[#8B6914] font-bold text-sm">{type === 'percent' ? '%' : '$'}</span>
                                    <input type="number" value={value} onChange={e => setValue(e.target.value)}
                                        placeholder={type === 'percent' ? 'Ej: 15 (sube 15%) o -10 (baja 10%)' : 'Ej: 500 (suma $500)'}
                                        className="w-full pl-8 pr-4 py-2.5 rounded-xl bg-white border border-[#D4C9B0] text-[#3D2B1F] text-sm outline-none focus:border-[#8B6914]" />
                                </div>
                            </div>

                            {/* ── Campo ── */}
                            <div>
                                <label className="text-xs font-bold text-[#5C4A2A] uppercase tracking-wider block mb-1.5">Qué actualizar</label>
                                <div className="grid grid-cols-3 gap-2">
                                    {[{ key: 'price', label: 'Solo precio' }, { key: 'cost', label: 'Solo costo' }, { key: 'both', label: 'Precio y costo' }].map(opt => (
                                        <button key={opt.key} onClick={() => setField(opt.key)}
                                            className={`py-2 rounded-xl border-2 font-bold text-xs transition-all ${field === opt.key ? 'bg-[#8B6914] border-[#8B6914] text-white' : 'bg-white border-[#D4C9B0] text-[#3D2B1F] hover:border-[#8B6914]/40'}`}>
                                            {opt.label}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* ── Redondeo ── */}
                            <div>
                                <label className="text-xs font-bold text-[#5C4A2A] uppercase tracking-wider block mb-1.5">Redondear al múltiplo de</label>
                                <div className="flex gap-2 flex-wrap">
                                    {['0', '1', '5', '10', '50', '100'].map(r => (
                                        <button key={r} onClick={() => setRoundTo(r)}
                                            className={`px-3 py-1.5 rounded-lg border-2 font-bold text-xs transition-all ${roundTo === r ? 'bg-[#8B6914] border-[#8B6914] text-white' : 'bg-white border-[#D4C9B0] text-[#3D2B1F] hover:border-[#8B6914]/40'}`}>
                                            {r === '0' ? 'Sin redondeo' : `$${r}`}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* ── Preview ── */}
                            {previewItems.length > 0 && (
                                <div className="bg-white border border-[#D4C9B0] rounded-xl overflow-hidden">
                                    <div className="px-3 py-2 bg-[#F5F0E8] border-b border-[#D4C9B0]">
                                        <p className="text-xs font-bold text-[#5C4A2A] uppercase tracking-wider">
                                            Vista previa — {affectedProducts.length} producto{affectedProducts.length !== 1 ? 's' : ''} en {selectionLabel}
                                        </p>
                                    </div>
                                    <div className="divide-y divide-[#EDE8DC]">
                                        {previewItems.map((p, i) => (
                                            <div key={i} className="px-3 py-2.5 flex items-center gap-3">
                                                <p className="text-xs font-medium text-[#3D2B1F] flex-1 truncate">{p.name}</p>
                                                <div className="flex items-center gap-1.5 text-xs shrink-0">
                                                    {(field === 'price' || field === 'both') && (
                                                        <span className={`font-bold ${p.newPrice !== p.oldPrice ? (p.newPrice > p.oldPrice ? 'text-green-700' : 'text-red-600') : 'text-slate-400'}`}>
                                                            ${p.oldPrice?.toLocaleString('es-AR')} → ${p.newPrice?.toLocaleString('es-AR')}
                                                        </span>
                                                    )}
                                                    {field === 'both' && <span className="text-slate-300">|</span>}
                                                    {(field === 'cost' || field === 'both') && (
                                                        <span className="text-slate-500">costo: ${p.newCost?.toLocaleString('es-AR')}</span>
                                                    )}
                                                </div>
                                            </div>
                                        ))}
                                        {affectedProducts.length > 5 && (
                                            <p className="px-3 py-2 text-xs text-[#A09070] text-center">
                                                y {affectedProducts.length - 5} producto{affectedProducts.length - 5 !== 1 ? 's' : ''} más...
                                            </p>
                                        )}
                                    </div>
                                </div>
                            )}
                        </>
                    )}
                </div>

                {!result && (
                    <div className="px-5 py-4 border-t border-[#D4C9B0]">
                        <button onClick={handleApply}
                            disabled={isApplying || !value || isNaN(Number(value)) || affectedProducts.length === 0}
                            className="w-full py-3.5 btn-accent rounded-xl font-black text-sm flex items-center justify-center gap-2 disabled:opacity-50 active:scale-[0.98] transition-all">
                            {isApplying
                                ? <><RefreshCw size={16} className="animate-spin" /> Aplicando...</>
                                : <><TrendingUp size={16} /> Aplicar a {affectedProducts.length} producto{affectedProducts.length !== 1 ? 's' : ''}</>}
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
}
    const [categoryId, setCategoryId] = useState('__all__');
    const [type,       setType]       = useState('percent'); // 'percent' | 'fixed'
    const [value,      setValue]      = useState('');
    const [field,      setField]      = useState('price');   // 'price' | 'cost' | 'both'
    const [roundTo,    setRoundTo]    = useState('10');
    const [isApplying, setIsApplying] = useState(false);
    const [result,     setResult]     = useState(null);      // { updated } | null

    // Preview: cuántos productos se van a tocar
    const affectedProducts = useMemo(() => {
        if (categoryId === '__all__') return products;
        return products.filter(p => p.categoryId === categoryId);
    }, [categoryId, products]);

    // Preview de precios con los valores actuales del form
    const previewItems = useMemo(() => {
        if (!value || isNaN(Number(value))) return [];
        const numVal  = Number(value);
        const numRound = Number(roundTo) || 0;

        const round = (n) => {
            if (!numRound || numRound <= 0) return Math.round(n);
            return Math.round(n / numRound) * numRound;
        };
        const apply = (current) => {
            const base = Number(current || 0);
            const next = type === 'percent' ? base * (1 + numVal / 100) : base + numVal;
            return round(Math.max(0, next));
        };

        return affectedProducts.slice(0, 5).map(p => ({
            name: p.name,
            oldPrice: p.price,
            newPrice: (field === 'price' || field === 'both') ? apply(p.price) : p.price,
            oldCost:  p.cost,
            newCost:  (field === 'cost'  || field === 'both') ? apply(p.cost)  : p.cost,
        }));
    }, [affectedProducts, type, value, field, roundTo]);

    const handleApply = async () => {
        if (!value || isNaN(Number(value))) return;
        setIsApplying(true);
        try {
            const res = await onApply(categoryId, {
                type,
                value:   Number(value),
                field,
                roundTo: Number(roundTo) || 0,
            });
            setResult(res);
        } finally {
            setIsApplying(false);
        }
    };

    const catName = categoryId === '__all__'
        ? 'Todas las categorías'
        : categories.find(c => c.id === categoryId)?.name || categoryId;

    const isPositive = Number(value) >= 0;

    return (
        <div className="fixed inset-0 bg-black/50 flex items-end sm:items-center justify-center p-0 sm:p-4 z-[200] backdrop-blur-sm animate-in fade-in duration-200">
            <div className="bg-[#EDE8DC] rounded-t-3xl sm:rounded-2xl w-full sm:max-w-lg shadow-2xl border border-[#D4C9B0] animate-in slide-in-from-bottom sm:zoom-in-95 duration-200">

                {/* Header */}
                <div className="flex items-center justify-between px-5 pt-5 pb-4 border-b border-[#D4C9B0]">
                    <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-lg bg-blue-100 flex items-center justify-center">
                            {isPositive ? <TrendingUp size={16} className="text-blue-700" /> : <TrendingDown size={16} className="text-red-600" />}
                        </div>
                        <div>
                            <h3 className="font-bold text-[#3D2B1F] text-base leading-none">Actualizar precios</h3>
                            <p className="text-xs text-[#8B6914] mt-0.5">Aumento o baja masiva por categoría</p>
                        </div>
                    </div>
                    <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-[#D4C9B0] transition-colors">
                        <X size={18} className="text-[#5C4A2A]" />
                    </button>
                </div>

                <div className="px-5 py-4 space-y-4 max-h-[70vh] overflow-y-auto">

                    {result ? (
                        /* ── Pantalla de éxito ── */
                        <div className="flex flex-col items-center py-6 gap-3 text-center">
                            <div className="w-14 h-14 rounded-full bg-green-100 flex items-center justify-center">
                                <CheckCircle size={28} className="text-green-600" />
                            </div>
                            <p className="font-bold text-[#3D2B1F] text-base">
                                ¡{result.updated} producto{result.updated !== 1 ? 's' : ''} actualizado{result.updated !== 1 ? 's' : ''}!
                            </p>
                            <p className="text-sm text-[#7A6040]">Los nuevos precios ya están activos.</p>
                            <button onClick={onClose} className="mt-2 w-full py-3 btn-accent rounded-xl font-black text-sm">
                                Listo
                            </button>
                        </div>
                    ) : (
                        <>
                            {/* ── Categoría ── */}
                            <div>
                                <label className="text-xs font-bold text-[#5C4A2A] uppercase tracking-wider block mb-1.5">
                                    Categoría
                                </label>
                                <select
                                    value={categoryId}
                                    onChange={e => setCategoryId(e.target.value)}
                                    className="w-full px-3 py-2.5 rounded-xl bg-white border border-[#D4C9B0] text-[#3D2B1F] text-sm outline-none focus:border-[#8B6914]"
                                >
                                    <option value="__all__">Todas las categorías ({products.length} productos)</option>
                                    {categories.map(c => {
                                        const count = products.filter(p => p.categoryId === c.id).length;
                                        return (
                                            <option key={c.id} value={c.id}>
                                                {c.name} ({count} productos)
                                            </option>
                                        );
                                    })}
                                </select>
                            </div>

                            {/* ── Tipo de ajuste ── */}
                            <div>
                                <label className="text-xs font-bold text-[#5C4A2A] uppercase tracking-wider block mb-1.5">
                                    Tipo de ajuste
                                </label>
                                <div className="grid grid-cols-2 gap-2">
                                    <button
                                        onClick={() => setType('percent')}
                                        className={`flex items-center justify-center gap-2 py-2.5 rounded-xl border-2 font-bold text-sm transition-all ${type === 'percent' ? 'bg-blue-600 border-blue-600 text-white' : 'bg-white border-[#D4C9B0] text-[#3D2B1F] hover:border-blue-300'}`}
                                    >
                                        <Percent size={15} /> Porcentaje
                                    </button>
                                    <button
                                        onClick={() => setType('fixed')}
                                        className={`flex items-center justify-center gap-2 py-2.5 rounded-xl border-2 font-bold text-sm transition-all ${type === 'fixed' ? 'bg-blue-600 border-blue-600 text-white' : 'bg-white border-[#D4C9B0] text-[#3D2B1F] hover:border-blue-300'}`}
                                    >
                                        <Hash size={15} /> Monto fijo
                                    </button>
                                </div>
                            </div>

                            {/* ── Valor ── */}
                            <div>
                                <label className="text-xs font-bold text-[#5C4A2A] uppercase tracking-wider block mb-1.5">
                                    {type === 'percent' ? 'Porcentaje (negativo para bajar)' : 'Monto a sumar (negativo para restar)'}
                                </label>
                                <div className="relative">
                                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[#8B6914] font-bold text-sm">
                                        {type === 'percent' ? '%' : '$'}
                                    </span>
                                    <input
                                        type="number"
                                        value={value}
                                        onChange={e => setValue(e.target.value)}
                                        placeholder={type === 'percent' ? 'Ej: 15 (sube 15%) o -10 (baja 10%)' : 'Ej: 500 (suma $500)'}
                                        className="w-full pl-8 pr-4 py-2.5 rounded-xl bg-white border border-[#D4C9B0] text-[#3D2B1F] text-sm outline-none focus:border-[#8B6914]"
                                    />
                                </div>
                            </div>

                            {/* ── Campo a actualizar ── */}
                            <div>
                                <label className="text-xs font-bold text-[#5C4A2A] uppercase tracking-wider block mb-1.5">
                                    Qué actualizar
                                </label>
                                <div className="grid grid-cols-3 gap-2">
                                    {[
                                        { key: 'price', label: 'Solo precio' },
                                        { key: 'cost',  label: 'Solo costo' },
                                        { key: 'both',  label: 'Precio y costo' },
                                    ].map(opt => (
                                        <button
                                            key={opt.key}
                                            onClick={() => setField(opt.key)}
                                            className={`py-2 rounded-xl border-2 font-bold text-xs transition-all ${field === opt.key ? 'bg-[#8B6914] border-[#8B6914] text-white' : 'bg-white border-[#D4C9B0] text-[#3D2B1F] hover:border-[#8B6914]/40'}`}
                                        >
                                            {opt.label}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* ── Redondeo ── */}
                            <div>
                                <label className="text-xs font-bold text-[#5C4A2A] uppercase tracking-wider block mb-1.5">
                                    Redondear al múltiplo de
                                </label>
                                <div className="flex gap-2 flex-wrap">
                                    {['0', '1', '5', '10', '50', '100'].map(r => (
                                        <button
                                            key={r}
                                            onClick={() => setRoundTo(r)}
                                            className={`px-3 py-1.5 rounded-lg border-2 font-bold text-xs transition-all ${roundTo === r ? 'bg-[#8B6914] border-[#8B6914] text-white' : 'bg-white border-[#D4C9B0] text-[#3D2B1F] hover:border-[#8B6914]/40'}`}
                                        >
                                            {r === '0' ? 'Sin redondeo' : `$${r}`}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* ── Preview ── */}
                            {previewItems.length > 0 && (
                                <div className="bg-white border border-[#D4C9B0] rounded-xl overflow-hidden">
                                    <div className="px-3 py-2 bg-[#F5F0E8] border-b border-[#D4C9B0]">
                                        <p className="text-xs font-bold text-[#5C4A2A] uppercase tracking-wider">
                                            Vista previa — {affectedProducts.length} producto{affectedProducts.length !== 1 ? 's' : ''} en {catName}
                                        </p>
                                    </div>
                                    <div className="divide-y divide-[#EDE8DC]">
                                        {previewItems.map((p, i) => (
                                            <div key={i} className="px-3 py-2.5 flex items-center gap-3">
                                                <p className="text-xs font-medium text-[#3D2B1F] flex-1 truncate">{p.name}</p>
                                                <div className="flex items-center gap-1.5 text-xs shrink-0">
                                                    {(field === 'price' || field === 'both') && (
                                                        <span className={`font-bold ${p.newPrice !== p.oldPrice ? (p.newPrice > p.oldPrice ? 'text-green-700' : 'text-red-600') : 'text-slate-400'}`}>
                                                            ${p.oldPrice?.toLocaleString('es-AR')} → ${p.newPrice?.toLocaleString('es-AR')}
                                                        </span>
                                                    )}
                                                    {field === 'both' && <span className="text-slate-300">|</span>}
                                                    {(field === 'cost' || field === 'both') && (
                                                        <span className="text-slate-500">
                                                            costo: ${p.newCost?.toLocaleString('es-AR')}
                                                        </span>
                                                    )}
                                                </div>
                                            </div>
                                        ))}
                                        {affectedProducts.length > 5 && (
                                            <p className="px-3 py-2 text-xs text-[#A09070] text-center">
                                                y {affectedProducts.length - 5} producto{affectedProducts.length - 5 !== 1 ? 's' : ''} más...
                                            </p>
                                        )}
                                    </div>
                                </div>
                            )}
                        </>
                    )}
                </div>

                {/* Footer */}
                {!result && (
                    <div className="px-5 py-4 border-t border-[#D4C9B0]">
                        <button
                            onClick={handleApply}
                            disabled={isApplying || !value || isNaN(Number(value)) || affectedProducts.length === 0}
                            className="w-full py-3.5 btn-accent rounded-xl font-black text-sm flex items-center justify-center gap-2 disabled:opacity-50 active:scale-[0.98] transition-all"
                        >
                            {isApplying
                                ? <><RefreshCw size={16} className="animate-spin" /> Aplicando...</>
                                : <><TrendingUp size={16} /> Aplicar a {affectedProducts.length} producto{affectedProducts.length !== 1 ? 's' : ''}</>
                            }
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
}
