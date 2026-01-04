import React from 'react';
import { Search, ShoppingCart, Image as ImageIcon, ScanBarcode, Edit } from 'lucide-react';
import { getThumbnailUrl } from '../config/uploadImage';

const ProductGrid = ({
    products, addToCart, searchTerm, setSearchTerm,
    selectedCategory, setSelectedCategory, categories,
    userData, barcodeInput, setBarcodeInput, handleBarcodeSubmit
}) => {

    // 1. Filtrar las categorías para mostrar solo las activas
    const activeCategories = categories.filter(c => c.isActive !== false);

    // 2. Filtrado de productos: ocultar si su categoría está inactiva
    const filteredProducts = products.filter(product => {
        // Verificar si la categoría del producto está activa
        const category = categories.find(c => c.id === product.categoryId);
        if (category && category.isActive === false) return false;

        const matchesSearch = product.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
            product.barcode?.includes(searchTerm);
        const matchesCategory = selectedCategory === 'all' || product.categoryId === selectedCategory;

        return matchesSearch && matchesCategory;
    });

    return (
        <div className="flex-1 flex flex-col min-w-0 h-full">
            <div className="bg-white p-4 rounded-xl shadow-sm border mb-4 space-y-4">
                <div className="flex flex-col md:flex-row gap-4">
                    <form onSubmit={handleBarcodeSubmit} className="relative flex-1">
                        <ScanBarcode className="absolute left-3 top-3 text-slate-400" size={20} />
                        <input
                            type="text"
                            placeholder="Escanear o buscar..."
                            value={barcodeInput !== undefined ? barcodeInput : searchTerm}
                            onChange={(e) => barcodeInput !== undefined ? setBarcodeInput(e.target.value) : setSearchTerm(e.target.value)}
                            className="w-full pl-10 p-3 bg-slate-50 border-none rounded-xl focus:ring-2 focus:ring-blue-500 outline-none"
                        />
                    </form>

                    <div className="flex gap-2 overflow-x-auto pb-2">
                        <button
                            onClick={() => setSelectedCategory('all')}
                            className={`px-4 py-2 rounded-lg text-sm font-bold transition-colors whitespace-nowrap ${selectedCategory === 'all' ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-600'
                                }`}
                        >
                            Todas
                        </button>
                        {/* Solo mapeamos las categorías activas */}
                        {activeCategories.map(cat => (
                            <button
                                key={cat.id}
                                onClick={() => setSelectedCategory(cat.id)}
                                className={`px-4 py-2 rounded-lg text-sm font-bold transition-colors whitespace-nowrap ${selectedCategory === cat.id ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-600'
                                    }`}
                            >
                                {cat.name}
                            </button>
                        ))}
                    </div>
                </div>
            </div>

            <div className="flex-1 overflow-y-auto pr-2 custom-scrollbar">
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5 gap-4 pb-20">
                    {filteredProducts.map((product) => (
                        <div
                            key={product.id}
                            onClick={() => addToCart(product)} // AHORA TODA LA TARJETA ES CLICKEABLE
                            className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden flex flex-col group hover:shadow-md transition-all active:scale-[0.98] cursor-pointer"
                        >
                            <div className="aspect-square bg-slate-50 relative">
                                {product.imageUrl ? (
                                    <img
                                        src={getThumbnailUrl(product.imageUrl, 300)}
                                        alt={product.name}
                                        className="w-full h-full object-cover"
                                    />
                                ) : (
                                    <div className="w-full h-full flex items-center justify-center text-slate-300">
                                        <ImageIcon size={32} />
                                    </div>
                                )}

                                {userData?.role === 'admin' && (
                                    <div className="absolute top-2 right-2 p-2 bg-white/90 rounded-full text-blue-600 shadow-sm opacity-0 group-hover:opacity-100 transition-opacity">
                                        <Edit size={16} />
                                    </div>
                                )}
                            </div>

                            <div className="p-3 flex flex-col flex-1">
                                <h3 className="text-sm font-bold text-slate-800 line-clamp-2 mb-1">{product.name}</h3>
                                <div className="mt-auto">
                                    <div className="text-blue-600 font-black text-lg">${product.price?.toLocaleString()}</div>
                                    <div className="flex justify-between items-center mt-2">
                                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${product.stock <= 0 ? 'bg-red-100 text-red-600' : 'bg-slate-100 text-slate-500'
                                            }`}>
                                            Stock: {product.stock}
                                        </span>
                                        <div className="bg-blue-600 text-white p-2 rounded-lg">
                                            <ShoppingCart size={16} />
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
};

export default ProductGrid;