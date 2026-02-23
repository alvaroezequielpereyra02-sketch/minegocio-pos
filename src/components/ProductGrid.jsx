import React from 'react';
import { ShoppingCart, Image as ImageIcon, ScanBarcode, Edit, AlertCircle, Plus } from 'lucide-react';
import { getThumbnailUrl } from '../config/uploadImage';

const ProductGrid = ({
    products, addToCart, searchTerm, setSearchTerm,
    selectedCategory, setSelectedCategory, categories,
    userData, barcodeInput, setBarcodeInput, handleBarcodeSubmit,
    onEditProduct, setFaultyProduct, toggleModal,
    cart
}) => {
    const activeCategories = categories.filter(c => c.isActive !== false);

    const filteredProducts = products.filter(product => {
        const category = categories.find(c => c.id === product.categoryId);
        if (category && category.isActive === false) return false;
        const effectiveSearch = (barcodeInput || searchTerm).toLowerCase();
        const matchesSearch = product.name?.toLowerCase().includes(effectiveSearch) ||
            product.barcode?.toLowerCase().includes(effectiveSearch);
        const matchesCategory = selectedCategory === 'all' || product.categoryId === selectedCategory;
        return matchesSearch && matchesCategory;
    });

    const cartQtyMap = (cart || []).reduce((acc, item) => {
        acc[item.id] = item.qty;
        return acc;
    }, {});

    const isAdmin = userData?.role === 'admin';

    return (
        <div className="flex-1 flex flex-col min-w-0 h-full">

            {/* Barra de búsqueda + categorías */}
            <div className="bg-white rounded-2xl shadow-sm border border-slate-100 mb-3 overflow-hidden">
                <form onSubmit={handleBarcodeSubmit} className="relative">
                    <ScanBarcode className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300" size={18} />
                    <input
                        type="text"
                        placeholder="Buscar o escanear producto..."
                        value={barcodeInput || searchTerm}
                        onChange={(e) => {
                            const val = e.target.value;
                            if (barcodeInput !== undefined) setBarcodeInput(val);
                            setSearchTerm(val);
                        }}
                        className="w-full pl-11 pr-4 py-3.5 text-sm font-medium bg-transparent outline-none placeholder:text-slate-300 border-b border-slate-100"
                    />
                </form>

                <div className="flex gap-2 px-3 py-2.5 overflow-x-auto scrollbar-hide">
                    {[{ id: 'all', name: 'Todo' }, ...activeCategories].map(cat => (
                        <button
                            key={cat.id}
                            onClick={() => setSelectedCategory(cat.id)}
                            className={`px-3.5 py-1.5 rounded-full text-xs font-bold whitespace-nowrap transition-all ${
                                selectedCategory === cat.id
                                    ? 'text-white shadow-sm'
                                    : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
                            }`}
                            style={selectedCategory === cat.id ? { background: 'linear-gradient(135deg, #f97316, #ea580c)' } : {}}
                        >
                            {cat.name}
                        </button>
                    ))}
                </div>
            </div>

            {/* Grilla */}
            <div className="flex-1 overflow-y-auto">
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5 gap-3 pb-24">
                    {filteredProducts.map((product) => {
                        const qtyInCart = cartQtyMap[product.id] || 0;
                        const outOfStock = product.stock <= 0;

                        return (
                            <div
                                key={product.id}
                                onClick={() => addToCart(product)}
                                className="product-card bg-white rounded-2xl overflow-hidden flex flex-col cursor-pointer border border-slate-100 hover:border-orange-200 hover:shadow-lg transition-all active:scale-[0.97] group"
                            >
                                {/* Imagen */}
                                <div className="aspect-square relative overflow-hidden bg-slate-50">
                                    {product.imageUrl ? (
                                        <img
                                            src={getThumbnailUrl(product.imageUrl, 300)}
                                            alt={product.name}
                                            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                                        />
                                    ) : (
                                        <div className="w-full h-full flex items-center justify-center">
                                            <ImageIcon size={28} className="text-slate-200" />
                                        </div>
                                    )}

                                    {/* Gradiente inferior */}
                                    {product.imageUrl && (
                                        <div className="absolute inset-x-0 bottom-0 h-12 bg-gradient-to-t from-black/30 to-transparent" />
                                    )}

                                    {/* Badge qty */}
                                    {qtyInCart > 0 && (
                                        <div className="absolute top-2 left-2 text-white text-xs font-black w-6 h-6 rounded-full flex items-center justify-center shadow-lg"
                                            style={{ background: 'linear-gradient(135deg, #f97316, #ea580c)' }}>
                                            {qtyInCart}
                                        </div>
                                    )}



                                    {/* Admin buttons */}
                                    {isAdmin && (
                                        <div className="absolute top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                            <button onClick={(e) => { e.stopPropagation(); setFaultyProduct(product); toggleModal('faulty', true); }}
                                                className="w-6 h-6 bg-white/90 rounded-full flex items-center justify-center text-orange-500 shadow-sm hover:bg-white">
                                                <AlertCircle size={12} />
                                            </button>
                                            <button onClick={(e) => { e.stopPropagation(); onEditProduct(product); }}
                                                className="w-6 h-6 bg-white/90 rounded-full flex items-center justify-center text-blue-500 shadow-sm hover:bg-white">
                                                <Edit size={12} />
                                            </button>
                                        </div>
                                    )}
                                </div>

                                {/* Info */}
                                <div className="p-2.5 flex flex-col flex-1">
                                    <h3 className="text-xs font-bold text-slate-800 line-clamp-2 leading-tight mb-2">{product.name}</h3>
                                    <div className="mt-auto flex items-center justify-between">
                                        <div className="flex flex-col">
                                            <span className="text-base font-black text-slate-900 leading-none">${product.price?.toLocaleString()}</span>
                                            {isAdmin && (
                                                <span className={`text-[10px] font-semibold mt-0.5 ${outOfStock ? 'text-red-400' : 'text-slate-300'}`}>
                                                    {outOfStock ? 'Sin stock' : `Stock: ${product.stock}`}
                                                </span>
                                            )}
                                        </div>
                                        <div className="w-7 h-7 rounded-xl flex items-center justify-center text-white shrink-0"
                                            style={{ background: 'linear-gradient(135deg, #f97316, #ea580c)' }}>
                                            <Plus size={14} strokeWidth={3} />
                                        </div>
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>
        </div>
    );
};

export default ProductGrid;
