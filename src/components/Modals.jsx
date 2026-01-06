import React, { useState, useEffect } from 'react';
import {
    X, Trash2, ScanBarcode, Box, AlertTriangle, LogOut, Plus, Minus,
    CheckCircle, ArrowLeft, Key, Copy, Loader2, AlertCircle, FolderTree,
    ChevronDown, Folder, FolderOpen, Edit, CornerDownRight, Eye, EyeOff, Edit3, Check,
} from 'lucide-react';

// IMPORTANTE: Rutas y nombres corregidos para el build de Vercel
import { usePrinter } from '../hooks/usePrinter';
import { uploadImage } from '../config/uploadImage';
import { compressImage } from '../utils/imageHelpers';

const modalOverlayClass = "fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-[200] backdrop-blur-sm animate-in fade-in duration-200";

// --- MODALES INDIVIDUALES EXPORTADOS (Soluciona el error traceVariable) ---

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
                    <button onClick={onCancel} className="flex-1 py-3 text-slate-700 font-bold bg-slate-100 rounded-xl hover:bg-slate-200">
                        {cancelText}
                    </button>
                    <button onClick={onConfirm} className={`flex-1 py-3 text-white font-bold rounded-xl shadow-md ${isDanger ? 'bg-red-600' : 'bg-blue-600'}`}>
                        {confirmText}
                    </button>
                </div>
            </div>
        </div>
    );
}

export function ProcessingModal() {
    return (
        <div className="fixed inset-0 bg-slate-50/80 backdrop-blur-md flex flex-col items-center justify-center z-[30000]">
            <div className="bg-white p-8 rounded-3xl shadow-2xl flex flex-col items-center text-center">
                <div className="relative mb-6">
                    <div className="w-20 h-20 border-4 border-slate-100 rounded-full"></div>
                    <div className="absolute top-0 left-0 w-20 h-20 border-4 border-blue-600 rounded-full border-t-transparent animate-spin"></div>
                    <Loader2 className="absolute top-7 left-7 text-blue-600 animate-pulse" size={24} />
                </div>
                <h3 className="text-xl font-extrabold text-slate-800">Procesando</h3>
                <p className="text-sm text-slate-400">Por favor espere...</p>
            </div>
        </div>
    );
}

export function InvitationModal({ onClose, onGenerate }) {
    const [generatedCode, setGeneratedCode] = useState(null);
    const handleGenerate = () => {
        const code = Math.random().toString(36).substring(2, 8).toUpperCase();
        onGenerate(code);
        setGeneratedCode(code);
    };
    const copyToClipboard = () => { navigator.clipboard.writeText(generatedCode).then(() => alert("Copiado")); };

    return (
        <div className={modalOverlayClass}>
            <div className="bg-white rounded-2xl w-full max-w-sm p-6 shadow-2xl text-center">
                <div className="flex justify-between items-center mb-4">
                    <h3 className="font-bold text-lg text-blue-800 flex items-center gap-2"><Key size={20} /> Nueva Invitación</h3>
                    <button onClick={onClose}><X size={20} /></button>
                </div>
                {!generatedCode ? (
                    <button onClick={handleGenerate} className="w-full py-3 bg-blue-600 text-white font-bold rounded-xl">Generar Código</button>
                ) : (
                    <div className="space-y-4">
                        <div className="p-4 bg-slate-100 rounded-xl font-black text-3xl">{generatedCode}</div>
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
            <div className="bg-white rounded-2xl w-full max-w-sm p-6 space-y-4 shadow-2xl">
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
            <div className="bg-white rounded-2xl w-full max-w-md p-6 space-y-4 shadow-2xl overflow-y-auto max-h-[90vh]">
                <div className="flex justify-between items-center">
                    <h3 className="font-bold text-lg">{editingProduct ? 'Editar' : 'Nuevo'} Producto</h3>
                    {editingProduct && <button onClick={() => onDelete(editingProduct.id)} className="text-red-500 text-xs underline">Eliminar</button>}
                </div>
                <form onSubmit={onSave} className="space-y-3">
                    <input required name="name" defaultValue={editingProduct?.name} className="w-full p-2 border rounded" placeholder="Nombre" />
                    <div className="flex gap-2 items-center border p-2 rounded bg-slate-50">
                        <ScanBarcode size={16} className="text-slate-400" />
                        <input name="barcode" defaultValue={editingProduct?.barcode} className="w-full bg-transparent outline-none text-sm" placeholder="Código de Barras" />
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                        <input required name="price" type="number" step="any" defaultValue={editingProduct?.price} className="p-2 border rounded" placeholder="Precio Venta" />
                        <input name="cost" type="number" step="any" defaultValue={editingProduct?.cost} className="p-2 border rounded" placeholder="Costo" />
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

                    <div className="flex gap-2 bg-slate-100 p-1 rounded">
                        <button type="button" onClick={() => setImageMode('file')} className={`flex-1 py-1 text-xs rounded ${imageMode === 'file' ? 'bg-white shadow' : ''}`}>Subir</button>
                        <button type="button" onClick={() => setImageMode('link')} className={`flex-1 py-1 text-xs rounded ${imageMode === 'link' ? 'bg-white shadow' : ''}`}>Link</button>
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
                        <button type="submit" className="flex-1 bg-blue-600 text-white py-2 rounded font-bold">Guardar</button>
                        <button type="button" onClick={onRegisterFaulty} className="flex-1 bg-red-600 text-white py-2 rounded font-bold">Registrar como dañado</button>
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
            <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl flex flex-col max-h-[85vh] overflow-hidden">
                <div className="p-4 bg-slate-800 text-white flex justify-between items-center">
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
                                            <button onClick={(e) => startEdit(cat, e)} className="p-1 text-slate-400 hover:text-blue-600"><Edit3 size={16} /></button>
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
                                        <button type="submit" className="bg-blue-600 text-white p-1 rounded"><Plus size={14} /></button>
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
                        <button type="submit" className="flex-1 bg-blue-600 text-white py-2 rounded font-bold">Guardar</button>
                    </div>
                </form>
            </div>
        </div>
    );
}

export function StoreModal({ onClose, onSave, storeProfile, imageMode, setImageMode, previewImage, setPreviewImage, handleFileChange }) {
    return (
        <div className={modalOverlayClass}>
            <div className="bg-white rounded-2xl w-full max-w-sm p-6 space-y-4 shadow-2xl">
                <div className="flex justify-between items-center"><h3 className="font-bold text-lg">Perfil del Negocio</h3><button onClick={onClose}><X size={20} /></button></div>
                <form onSubmit={onSave} className="space-y-4">
                    <input name="storeName" defaultValue={storeProfile.name} required className="w-full p-2 border rounded" placeholder="Nombre del Negocio" />
                    <div className="flex gap-2 bg-slate-100 p-1 rounded-lg">
                        <button type="button" onClick={() => setImageMode('file')} className={`flex-1 py-1 text-xs rounded ${imageMode === 'file' ? 'bg-white shadow font-bold' : ''}`}>Subir</button>
                        <button type="button" onClick={() => setImageMode('link')} className={`flex-1 py-1 text-xs rounded ${imageMode === 'link' ? 'bg-white shadow font-bold' : ''}`}>Link</button>
                    </div>
                    {imageMode === 'file' ? <input type="file" onChange={handleFileChange} className="text-xs" /> : <input name="logoUrlLink" className="w-full p-2 border rounded text-xs" placeholder="URL del logo..." onChange={(e) => setPreviewImage(e.target.value)} />}
                    <button type="submit" className="w-full bg-blue-600 text-white font-bold py-2 rounded">Guardar Cambios</button>
                </form>
            </div>
        </div>
    );
}

export function AddStockModal({ onClose, onConfirm, scannedProduct, quantityInputRef }) {
    return (
        <div className={modalOverlayClass}>
            <div className="bg-white rounded-2xl w-full max-w-sm p-6 space-y-4 shadow-2xl text-center">
                <h3 className="font-bold text-lg">Entrada Stock</h3>
                <div className="bg-slate-100 p-3 rounded-lg font-bold">{scannedProduct?.name}</div>
                <form onSubmit={onConfirm}>
                    <input ref={quantityInputRef} name="qty" type="number" defaultValue="1" min="1" className="w-32 p-3 border-2 border-blue-500 rounded-lg text-center text-2xl font-bold mb-4" />
                    <div className="flex gap-2">
                        <button type="button" onClick={onClose} className="flex-1 py-3 bg-slate-100 rounded-lg">Cancelar</button>
                        <button type="submit" className="flex-1 bg-blue-600 text-white font-bold py-3 rounded-lg">Confirmar</button>
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


    return (
        <div className="fixed inset-0 z-[20000] bg-slate-100/90 backdrop-blur-sm flex justify-center items-center">
            <div className="w-full max-w-2xl h-full sm:h-auto sm:max-h-[85vh] bg-white sm:rounded-2xl shadow-2xl flex flex-col">
                <div className="p-4 border-b flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-full"><ArrowLeft size={24} /></button>
                        <h3 className="font-bold text-lg">Editar Pedido</h3>
                    </div>
                    <button
                        onClick={handleSave}
                        // 🛡️ ESCUDO FÍSICO: El botón se apaga si no hay productos cargados
                        disabled={!formData.items || formData.items.length === 0 || formData.total === 0}
                        className={`px-4 py-2 rounded-lg font-bold transition-all ${(!formData.items || formData.items.length === 0 || formData.total === 0)
                                ? 'bg-slate-300 text-slate-500 cursor-not-allowed' // Estilo desactivado
                                : 'bg-blue-600 text-white hover:bg-blue-700 shadow-md active:scale-95' // Estilo activo
                            }`}
                    >
                        {/* Texto dinámico que indica el estado al administrador */}
                        {(!formData.items || formData.items.length === 0 || formData.total === 0)
                            ? (
                                <div className="flex items-center gap-2">
                                    <div className="w-3 h-3 border-2 border-slate-400 border-t-transparent rounded-full animate-spin"></div>
                                    <span>Cargando datos...</span>
                                </div>
                            )
                            : 'Guardar Cambios'}
                    </button>
                </div>
                <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-slate-50">
                    {localItems.map((item, index) => (
                        <div key={index} className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex justify-between items-center">
                            <div className="flex-1">
                                <div className="font-bold text-slate-800">{item.name}</div>
                                <div className="text-xs text-blue-600 font-bold">${item.price} x {item.qty}</div>
                            </div>
                            <div className="flex items-center gap-3">
                                <button onClick={() => updateQty(index, -1)} className="w-8 h-8 rounded-full border flex items-center justify-center"><Minus size={16} /></button>
                                <span className="font-bold">{item.qty}</span>
                                <button onClick={() => updateQty(index, 1)} className="w-8 h-8 rounded-full border flex items-center justify-center"><Plus size={16} /></button>
                            </div>
                        </div>
                    ))}
                </div>
                <div className="p-4 bg-white border-t flex justify-between items-center">
                    <span className="font-bold text-slate-600">Total:</span>
                    <span className="font-extrabold text-2xl">${localItems.reduce((acc, i) => acc + (i.price * i.qty), 0).toLocaleString()}</span>
                </div>
            </div>
        </div>
    );
}

// Ubicación: Al final de src/components/Modals.jsx

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
                    <div className="font-bold text-sm text-slate-800">{product.name}</div>
                    <div className="text-xs text-slate-500">Stock actual: <span className="font-bold text-slate-800">{product?.stock ?? 0}</span></div>
                </div>

                <form onSubmit={(e) => { e.preventDefault(); onConfirm(product, qty, reason); }} className="space-y-4">
                    <div>
                        <label className="text-xs font-bold text-slate-400 uppercase">Unidades con Falla</label>
                        <input
                            type="number" min="1" max={product.stock} required
                            value={qty} onChange={(e) => setQty(Number(e.target.value))}
                            className="w-full p-3 border-2 border-orange-100 rounded-xl text-center text-2xl font-black text-orange-600 outline-none"
                        />
                    </div>
                    <div>
                        <label className="text-xs font-bold text-slate-400 uppercase">Motivo / Nota</label>
                        <textarea
                            className="w-full p-2 border rounded-lg text-sm bg-slate-50"
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
                            className="flex-1 bg-orange-600 text-white py-3 rounded-xl font-bold shadow-lg shadow-orange-200 active:scale-95 transition-all"
                        >
                            Confirmar
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}