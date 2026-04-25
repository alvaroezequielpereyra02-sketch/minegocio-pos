import React, { useState } from 'react';
import {
    Tag, Send, Plus, Trash2, ToggleLeft, ToggleRight,
    Bell, BellOff, Calendar, Percent, Image, Edit3, X, CheckCircle, Search,
} from 'lucide-react';
import { useState as useLocalState } from 'react';
import { useOffers } from '../hooks/useOffers';

// ─── Formulario de oferta ─────────────────────────────────────────────────────

function OfferForm({ initial = {}, onSave, onCancel, saving, products = [] }) {
    const [productSearch, setProductSearch] = useState('');
    const [form, setForm] = useState({
        title:         initial.title         ?? '',
        description:   initial.description   ?? '',
        discount:      initial.discount       ?? '',
        discountType:  initial.discountType   ?? 'percent',
        discountValue: initial.discountValue  ?? '',
        productIds:    initial.productIds     ?? [],
        validUntil:    initial.validUntil     ?? '',
        imageUrl:      initial.imageUrl       ?? '',
    });

    const set = (k) => (e) => setForm(f => ({ ...f, [k]: e.target.value }));
    const toggleProduct = (id) => setForm(f => ({
        ...f,
        productIds: f.productIds.includes(id)
            ? f.productIds.filter(pid => pid !== id)
            : [...f.productIds, id],
    }));

    const handleSubmit = (e) => {
        e.preventDefault();
        if (!form.title.trim()) return;
        onSave(form);
    };

    return (
        <form onSubmit={handleSubmit} className="bg-white rounded-2xl border border-[#D4C9B0] p-5 space-y-4 shadow-sm">
            <div className="flex items-center justify-between">
                <h3 className="font-bold text-[#3D2B1F] text-sm">
                    {initial.id ? 'Editar oferta' : 'Nueva oferta'}
                </h3>
                <button type="button" onClick={onCancel} className="text-slate-400 hover:text-slate-600 transition-colors">
                    <X size={16} />
                </button>
            </div>

            {/* Título */}
            <div>
                <label className="text-xs font-semibold text-[#7A6040] block mb-1">Título *</label>
                <input
                    value={form.title}
                    onChange={set('title')}
                    maxLength={80}
                    placeholder="Ej: 20% de descuento en lácteos"
                    required
                    className="w-full px-3 py-2 rounded-xl border border-[#D4C9B0] text-sm focus:outline-none focus:border-[#8B6914] bg-[#F5F0E8] text-[#3D2B1F]"
                />
            </div>

            {/* Descripción */}
            <div>
                <label className="text-xs font-semibold text-[#7A6040] block mb-1">Descripción</label>
                <textarea
                    value={form.description}
                    onChange={set('description')}
                    maxLength={200}
                    rows={2}
                    placeholder="Detalle de la oferta, condiciones, productos incluidos..."
                    className="w-full px-3 py-2 rounded-xl border border-[#D4C9B0] text-sm focus:outline-none focus:border-[#8B6914] bg-[#F5F0E8] text-[#3D2B1F] resize-none"
                />
                <div className="text-right text-[10px] text-slate-400 mt-0.5">{form.description.length}/200</div>
            </div>

            {/* Tipo y valor de descuento */}
            <div>
                <label className="text-xs font-semibold text-[#7A6040] block mb-1">
                    <Percent size={11} className="inline mr-1" />Descuento aplicado al carrito *
                </label>
                <div className="flex gap-2">
                    <select
                        value={form.discountType}
                        onChange={set('discountType')}
                        className="px-3 py-2 rounded-xl border border-[#D4C9B0] text-sm focus:outline-none focus:border-[#8B6914] bg-[#F5F0E8] text-[#3D2B1F] shrink-0"
                    >
                        <option value="percent">% porcentaje</option>
                        <option value="fixed">$ fijo</option>
                    </select>
                    <input
                        type="number"
                        min="0"
                        max={form.discountType === 'percent' ? 100 : undefined}
                        value={form.discountValue}
                        onChange={set('discountValue')}
                        placeholder={form.discountType === 'percent' ? 'Ej: 20' : 'Ej: 500'}
                        required
                        className="flex-1 px-3 py-2 rounded-xl border border-[#D4C9B0] text-sm focus:outline-none focus:border-[#8B6914] bg-[#F5F0E8] text-[#3D2B1F]"
                    />
                </div>
                <p className="text-[10px] text-slate-400 mt-1">
                    {form.discountType === 'percent'
                        ? `El precio se reduce un ${form.discountValue || 0}% automáticamente en el carrito`
                        : `Se restan $${form.discountValue || 0} del precio en el carrito`}
                </p>
            </div>

            {/* Productos incluidos */}
            <div>
                <label className="text-xs font-semibold text-[#7A6040] block mb-1">
                    Productos incluidos * ({form.productIds.length} seleccionados)
                </label>
                <div className="relative mb-2">
                    <Search size={12} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                        value={productSearch}
                        onChange={(e) => setProductSearch(e.target.value)}
                        placeholder="Buscar producto..."
                        className="w-full pl-8 pr-3 py-2 rounded-xl border border-[#D4C9B0] text-sm focus:outline-none focus:border-[#8B6914] bg-[#F5F0E8] text-[#3D2B1F]"
                    />
                </div>
                <div className="max-h-40 overflow-y-auto rounded-xl border border-[#D4C9B0] divide-y divide-[#E8E0CC] bg-[#F5F0E8]">
                    {products
                        .filter(p => !productSearch || p.name?.toLowerCase().includes(productSearch.toLowerCase()))
                        .map(p => {
                            const selected = form.productIds.includes(p.id);
                            return (
                                <button
                                    key={p.id}
                                    type="button"
                                    onClick={() => toggleProduct(p.id)}
                                    className={`w-full flex items-center gap-2 px-3 py-2 text-left transition-colors ${selected ? 'bg-[#8B6914]/10' : 'hover:bg-[#EDE8DC]'}`}
                                >
                                    <div className={`w-4 h-4 rounded border-2 flex items-center justify-center shrink-0 ${selected ? 'bg-[#8B6914] border-[#8B6914]' : 'border-[#D4C9B0]'}`}>
                                        {selected && <span className="text-white text-[10px] font-black">✓</span>}
                                    </div>
                                    <span className="text-sm text-[#3D2B1F] truncate">{p.name}</span>
                                    <span className="text-xs text-slate-400 ml-auto shrink-0">${p.price?.toLocaleString()}</span>
                                </button>
                            );
                        })}
                    {products.filter(p => !productSearch || p.name?.toLowerCase().includes(productSearch.toLowerCase())).length === 0 && (
                        <p className="text-xs text-slate-400 text-center py-4">Sin resultados</p>
                    )}
                </div>
            </div>

            {/* Etiqueta visual + Vigencia */}
            <div className="grid grid-cols-2 gap-3">
                <div>
                    <label className="text-xs font-semibold text-[#7A6040] block mb-1">
                        <Percent size={11} className="inline mr-1" />Etiqueta visual
                    </label>
                    <input
                        value={form.discount}
                        onChange={set('discount')}
                        maxLength={30}
                        placeholder="Ej: 20% OFF"
                        className="w-full px-3 py-2 rounded-xl border border-[#D4C9B0] text-sm focus:outline-none focus:border-[#8B6914] bg-[#F5F0E8] text-[#3D2B1F]"
                    />
                </div>
                <div>
                    <label className="text-xs font-semibold text-[#7A6040] block mb-1">
                        <Calendar size={11} className="inline mr-1" />Válida hasta
                    </label>
                    <input
                        type="date"
                        value={form.validUntil}
                        onChange={set('validUntil')}
                        className="w-full px-3 py-2 rounded-xl border border-[#D4C9B0] text-sm focus:outline-none focus:border-[#8B6914] bg-[#F5F0E8] text-[#3D2B1F]"
                    />
                </div>
            </div>

            {/* URL imagen */}
            <div>
                <label className="text-xs font-semibold text-[#7A6040] block mb-1">
                    <Image size={11} className="inline mr-1" />URL de imagen (opcional)
                </label>
                <input
                    value={form.imageUrl}
                    onChange={set('imageUrl')}
                    maxLength={500}
                    placeholder="https://..."
                    className="w-full px-3 py-2 rounded-xl border border-[#D4C9B0] text-sm focus:outline-none focus:border-[#8B6914] bg-[#F5F0E8] text-[#3D2B1F]"
                />
            </div>

            {/* Acciones */}
            <div className="flex gap-2 pt-1">
                <button
                    type="button"
                    onClick={onCancel}
                    className="flex-1 py-2 rounded-xl border border-[#D4C9B0] text-sm font-semibold text-[#7A6040] hover:bg-[#EDE8DC] transition-colors"
                >
                    Cancelar
                </button>
                <button
                    type="submit"
                    disabled={saving || !form.title.trim()}
                    className="flex-1 py-2 rounded-xl bg-[#8B6914] text-white text-sm font-bold hover:bg-[#6B4F0F] disabled:opacity-50 transition-colors"
                >
                    {saving ? 'Guardando...' : 'Guardar'}
                </button>
            </div>
        </form>
    );
}

// ─── Tarjeta de oferta ────────────────────────────────────────────────────────

function OfferCard({ offer, onEdit, onDelete, onPublish, onToggle, sending }) {
    const isExpired = offer.validUntil && new Date(offer.validUntil) < new Date();
    const isSending = sending === offer.id;

    return (
        <div className={`bg-white rounded-2xl border overflow-hidden shadow-sm transition-all ${
            offer.active ? 'border-[#8B6914]/40' : 'border-[#D4C9B0]'
        }`}>
            {/* Imagen */}
            {offer.imageUrl && (
                <div className="h-28 overflow-hidden bg-[#F5F0E8]">
                    <img
                        src={offer.imageUrl}
                        alt={offer.title}
                        className="w-full h-full object-cover"
                        onError={(e) => { e.target.parentNode.style.display = 'none'; }}
                    />
                </div>
            )}

            <div className="p-4 space-y-2">
                {/* Header */}
                <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-bold text-[#3D2B1F] text-sm leading-tight">{offer.title}</span>
                            {offer.discount && (
                                <span className="text-[10px] font-bold bg-red-100 text-red-600 px-2 py-0.5 rounded-full border border-red-200">
                                    {offer.discount}
                                </span>
                            )}
                        </div>
                        {offer.description && (
                            <p className="text-xs text-[#7A6040] mt-1 leading-relaxed">{offer.description}</p>
                        )}
                    </div>

                    {/* Toggle activo */}
                    <button
                        onClick={() => onToggle(offer)}
                        className={`shrink-0 transition-colors ${offer.active ? 'text-[#8B6914]' : 'text-slate-300'}`}
                        title={offer.active ? 'Desactivar' : 'Activar'}
                    >
                        {offer.active ? <ToggleRight size={28} /> : <ToggleLeft size={28} />}
                    </button>
                </div>

                {/* Meta */}
                <div className="flex items-center gap-3 text-[10px] text-slate-400 flex-wrap">
                    {offer.validUntil && (
                        <span className={isExpired ? 'text-red-500 font-semibold' : ''}>
                            <Calendar size={10} className="inline mr-0.5" />
                            {isExpired ? 'Vencida' : `Válida hasta ${new Date(offer.validUntil + 'T12:00:00').toLocaleDateString('es-AR')}`}
                        </span>
                    )}
                    {offer.notified && (
                        <span className="text-green-600 font-semibold">
                            <CheckCircle size={10} className="inline mr-0.5" />
                            Notificación enviada
                        </span>
                    )}
                    {!offer.notified && (
                        <span className="text-amber-500">
                            <BellOff size={10} className="inline mr-0.5" />
                            Sin notificar
                        </span>
                    )}
                </div>

                {/* Acciones */}
                <div className="flex gap-2 pt-1">
                    {/* Publicar y notificar */}
                    <button
                        onClick={() => onPublish(offer)}
                        disabled={isSending || offer.notified}
                        className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl text-xs font-bold transition-all ${
                            offer.notified
                                ? 'bg-slate-100 text-slate-400 cursor-not-allowed'
                                : 'bg-[#8B6914] text-white hover:bg-[#6B4F0F] active:scale-95'
                        }`}
                        title={offer.notified ? 'Notificación ya enviada' : 'Publicar y notificar a todos'}
                    >
                        {isSending
                            ? <><span className="animate-spin">↻</span> Enviando...</>
                            : offer.notified
                            ? <><Bell size={12} /> Ya notificado</>
                            : <><Send size={12} /> Publicar y notificar</>
                        }
                    </button>

                    {/* Editar */}
                    <button
                        onClick={() => onEdit(offer)}
                        className="w-9 h-9 flex items-center justify-center rounded-xl border border-[#D4C9B0] text-[#8B6914] hover:bg-[#EDE8DC] transition-colors"
                        title="Editar"
                    >
                        <Edit3 size={14} />
                    </button>

                    {/* Borrar */}
                    <button
                        onClick={() => onDelete(offer.id)}
                        className="w-9 h-9 flex items-center justify-center rounded-xl bg-red-50 border border-red-200 text-red-500 hover:bg-red-100 transition-colors"
                        title="Eliminar"
                    >
                        <Trash2 size={14} />
                    </button>
                </div>
            </div>
        </div>
    );
}

// ─── Componente principal ─────────────────────────────────────────────────────

export default function Offers({ showNotification, requestConfirm, products = [] }) {
    const { offers, sending, addOffer, updateOffer, deleteOffer, publishOffer } = useOffers();
    const [showForm, setShowForm] = useState(false);
    const [editingOffer, setEditingOffer] = useState(null);
    const [saving, setSaving] = useState(false);

    const handleSave = async (data) => {
        setSaving(true);
        try {
            if (editingOffer?.id) {
                await updateOffer(editingOffer.id, data);
                showNotification('✅ Oferta actualizada');
            } else {
                await addOffer(data);
                showNotification('✅ Oferta creada');
            }
            // Solo cerrar el form si la operación fue exitosa
            setShowForm(false);
            setEditingOffer(null);
        } catch (e) {
            // Mostrar error sin cerrar el form — el admin puede corregir y reintentar
            const msg = e?.code === 'permission-denied'
                ? 'Sin permisos — verificá que las reglas de Firestore estén desplegadas'
                : e.message;
            showNotification('❌ Error al guardar: ' + msg);
            console.error('[Offers] handleSave error:', e);
            // NO cerramos el form aquí — el admin no pierde los datos
        } finally {
            setSaving(false);
        }
    };

    const handleEdit = (offer) => {
        setEditingOffer(offer);
        setShowForm(true);
    };

    const handleDelete = (id) => {
        requestConfirm(
            'Eliminar oferta',
            '¿Seguro que querés eliminar esta oferta? No se puede deshacer.',
            async () => {
                try {
                    await deleteOffer(id);
                    showNotification('🗑️ Oferta eliminada');
                } catch (e) {
                    showNotification('❌ Error: ' + e.message);
                }
            },
            true
        );
    };

    const handleToggle = async (offer) => {
        try {
            await updateOffer(offer.id, { active: !offer.active });
        } catch (e) {
            showNotification('❌ Error: ' + e.message);
        }
    };

    const handlePublish = async (offer) => {
        const result = await publishOffer(offer);
        if (result.ok) {
            const total = (result.sent?.mobile ?? 0) + (result.sent?.desktop ?? 0);
            showNotification(`✅ Notificación enviada a ${total} dispositivo(s)`);
        } else {
            showNotification('❌ Error al enviar: ' + result.error);
        }
    };

    const activeOffers   = offers.filter(o => o.active);
    const inactiveOffers = offers.filter(o => !o.active);

    return (
        <div className="flex flex-col h-full bg-[#F5F0E8] overflow-y-auto">

            {/* Header */}
            <div className="sticky top-0 z-10 bg-[#F5F0E8] border-b border-[#D4C9B0] px-4 py-3 flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <Tag size={18} className="text-[#8B6914]" />
                    <h2 className="font-bold text-[#3D2B1F]">Ofertas</h2>
                    {activeOffers.length > 0 && (
                        <span className="text-xs font-bold bg-[#8B6914] text-white px-2 py-0.5 rounded-full">
                            {activeOffers.length} activa{activeOffers.length !== 1 ? 's' : ''}
                        </span>
                    )}
                </div>
                <button
                    onClick={() => { setEditingOffer(null); setShowForm(true); }}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#8B6914] text-white text-xs font-bold hover:bg-[#6B4F0F] transition-colors active:scale-95"
                >
                    <Plus size={14} /> Nueva oferta
                </button>
            </div>

            <div className="p-4 space-y-4">

                {/* Formulario */}
                {showForm && (
                    <OfferForm
                        initial={editingOffer ?? {}}
                        onSave={handleSave}
                        onCancel={() => { setShowForm(false); setEditingOffer(null); }}
                        saving={saving}
                        products={products}
                    />
                )}

                {/* Info box */}
                {!showForm && offers.length === 0 && (
                    <div className="text-center py-16 text-[#A09070]">
                        <Tag size={40} className="mx-auto mb-3 opacity-30" />
                        <p className="font-semibold text-sm">No hay ofertas creadas</p>
                        <p className="text-xs mt-1">Creá una oferta y notificá a todos tus clientes con un toque</p>
                    </div>
                )}

                {/* Cómo funciona */}
                {offers.length === 0 && !showForm && (
                    <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 text-xs text-amber-800 space-y-1">
                        <p className="font-bold text-sm mb-2">¿Cómo funciona?</p>
                        <p>1. Creá una oferta con título, descripción y descuento.</p>
                        <p>2. Presioná <strong>Publicar y notificar</strong> para activarla y enviar una notificación push a todos los clientes que tengan la app instalada.</p>
                        <p>3. Cada oferta solo puede notificarse una vez para no molestar a los clientes.</p>
                    </div>
                )}

                {/* Ofertas activas */}
                {activeOffers.length > 0 && (
                    <div>
                        <h3 className="text-xs font-bold text-[#8B6914] uppercase tracking-wide mb-3">
                            Activas ({activeOffers.length})
                        </h3>
                        <div className="space-y-3">
                            {activeOffers.map(offer => (
                                <OfferCard
                                    key={offer.id}
                                    offer={offer}
                                    onEdit={handleEdit}
                                    onDelete={handleDelete}
                                    onPublish={handlePublish}
                                    onToggle={handleToggle}
                                    sending={sending}
                                />
                            ))}
                        </div>
                    </div>
                )}

                {/* Ofertas inactivas */}
                {inactiveOffers.length > 0 && (
                    <div>
                        <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wide mb-3">
                            Inactivas ({inactiveOffers.length})
                        </h3>
                        <div className="space-y-3 opacity-70">
                            {inactiveOffers.map(offer => (
                                <OfferCard
                                    key={offer.id}
                                    offer={offer}
                                    onEdit={handleEdit}
                                    onDelete={handleDelete}
                                    onPublish={handlePublish}
                                    onToggle={handleToggle}
                                    sending={sending}
                                />
                            ))}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
