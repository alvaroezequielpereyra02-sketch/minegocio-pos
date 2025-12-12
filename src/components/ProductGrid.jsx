import React, { useMemo, useState, useEffect, memo } from 'react';
import { Search, ScanBarcode, Image as ImageIcon, Filter, X } from 'lucide-react';
import { FixedSizeGrid as Grid } from 'react-window';
import AutoSizer from 'react-virtualized-auto-sizer';
import { getThumbnailUrl } from '../utils/uploadImage'; // Asegúrate que esta ruta sea correcta

// MEJORA 1: Breakpoints más granulares para PC
const getColumnCount = (width) => {
    if (width < 640) return 2;  // Móvil
    if (width < 768) return 3;  // Tablet vertical
    if (width < 1024) return 4; // Tablet horizontal / Laptop pequeña
    if (width < 1280) return 5; // Laptop estándar
    if (width < 1536) return 6; // Monitor PC
    return 7;                   // Monitor Ultrawide
};

const ProductGrid = memo(function ProductGrid({
    products,
    addToCart,
    searchTerm,
    setSearchTerm,
    selectedCategory,
    setSelectedCategory,
    categories,
    subcategories = [],
    userData,
    barcodeInput,
    setBarcodeInput,
    handleBarcodeSubmit
}) {
    const [selectedSubCategory, setSelectedSubCategory] = useState('all');

    useEffect(() => {
        setSelectedSubCategory('all');
    }, [selectedCategory]);

    const currentSubcategories = useMemo(() => {
        if (selectedCategory === 'all') return [];
        return subcategories.filter(sub => sub.parentId === selectedCategory);
    }, [selectedCategory, subcategories]);

    const filteredProducts = useMemo(() => {
        const lowerTerm = searchTerm.toLowerCase();

        // Filtramos categorías activas
        const activeCategoryIds = new Set(
            categories
                .filter(c => c.isActive !== false)
                .map(c => c.id)
        );

        return products.filter(p => {
            const matchesSearch = p.name.toLowerCase().includes(lowerTerm);
            const matchesCategory = selectedCategory === 'all' || p.categoryId === selectedCategory;
            const matchesSub = selectedSubCategory === 'all' || p.subCategoryId === selectedSubCategory;
            const isCategoryActive = !p.categoryId || activeCategoryIds.has(p.categoryId);

            return matchesSearch && matchesCategory && matchesSub && isCategoryActive;
        });
    }, [products, searchTerm, selectedCategory, selectedSubCategory, categories]);

    const Cell = ({ columnIndex, rowIndex, style, data }) => {
        const { products, columnCount } = data;
        const index = rowIndex * columnCount + columnIndex;
        if (index >= products.length) return null;
        const product = products[index];

        // Gutter (Espacio entre tarjetas)
        const gutter = 10;

        // Ajustamos el estilo para crear el espacio visual
        const itemStyle = {
            ...style,
            left: style.left + gutter,
            top: style.top + gutter,
            width: style.width - gutter,
            height: style.height - gutter
        };

        return (
            <div style={itemStyle}>
                <button
                    onClick={() => addToCart(product)}
                    className="flex flex-col items-start w-full h-full p-0 rounded-xl border bg-white shadow-sm hover:shadow-md overflow-hidden active:scale-[0.98] transition-all relative group hover:border-blue-400"
                >
                    {/* Contenedor de imagen flexible */}
                    <div className="w-full h-[60%] bg-white relative shrink-0 p-2 flex items-center justify-center">
                        {product.imageUrl ? (
                            <img
                                src={getThumbnailUrl(product.imageUrl)}
                                className="w-full h-full object-contain mix-blend-multiply transition-transform group-hover:scale-105 duration-300"
                                loading="lazy"
                                onError={(e) => { e.target.src = 'https://via.placeholder.com/150' }}
                                alt={product.name}
                            />
                        ) : (
                            <div className="w-full h-full flex items-center justify-center text-slate-200 bg-slate-50"><ImageIcon size={40} /></div>
                        )}

                        {/* Badge de Stock */}
                        <div className={`absolute top-2 right-2 px-2 py-0.5 rounded-full text-[10px] font-bold shadow-sm backdrop-blur-sm ${product.stock <= 0 ? 'bg-red-500/90 text-white' : 'bg-white/80 text-slate-700 border border-slate-200'}`}>
                            {product.stock} un.
                        </div>
                    </div>

                    {/* Info del Producto */}
                    <div className="p-3 w-full text-left flex flex-col justify-between flex-1 min-h-0 bg-slate-50/50 border-t border-slate-100">
                        <div className="font-semibold text-slate-700 text-sm line-clamp-2 leading-snug" title={product.name}>
                            {product.name}
                        </div>
                        <div className="font-extrabold text-blue-600 text-base mt-1">
                            ${product.price.toLocaleString()}
                        </div>
                    </div>
                </button>
            </div>
        );
    };

    return (
        <div className="flex-1 flex flex-col min-h-0 pb-16 lg:pb-0 h-full">
            {/* Header de Búsqueda */}
            <div className="mb-3 flex gap-3 shrink-0">
                <div className="flex-1">
                    <div className="flex items-center w-full bg-white border border-slate-300 rounded-xl px-4 py-2.5 transition-all duration-200 focus-within:border-blue-500 focus-within:ring-2 focus-within:ring-blue-100 focus-within:shadow-sm">
                        <Search className="text-slate-400 w-5 h-5 shrink-0 mr-3" />
                        <input className="w-full bg-transparent outline-none text-base text-slate-700 placeholder:text-slate-400 border-none focus:ring-0 focus:outline-none p-0" placeholder="Buscar productos..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
                    </div>
                </div>
                {userData.role === 'admin' && (
                    <form onSubmit={handleBarcodeSubmit} className="hidden sm:block">
                        <div className="flex items-center w-48 bg-white border border-slate-300 rounded-xl px-4 py-2.5 transition-all duration-200 focus-within:border-blue-500 focus-within:ring-2 focus-within:ring-blue-100">
                            <ScanBarcode className="text-slate-400 w-5 h-5 shrink-0 mr-3" />
                            <input className="w-full bg-transparent outline-none text-base text-slate-700 placeholder:text-slate-400 border-none focus:ring-0 focus:outline-none p-0" placeholder="Escanear..." value={barcodeInput} onChange={(e) => setBarcodeInput(e.target.value)} />
                        </div>
                    </form>
                )}
            </div>

            {/* Filtros de Categoría */}
            <div className="flex gap-2 overflow-x-auto pb-2 mb-1 scrollbar-hide shrink-0">
                <button onClick={() => setSelectedCategory('all')} className={`px-4 py-1.5 rounded-full text-sm font-bold whitespace-nowrap transition-all ${selectedCategory === 'all' ? 'bg-slate-800 text-white shadow-lg scale-105' : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-100'}`}>Todas</button>
                {categories.filter(cat => cat.isActive !== false).map(cat => (
                    <button key={cat.id} onClick={() => setSelectedCategory(cat.id)} className={`px-4 py-1.5 rounded-full text-sm font-bold whitespace-nowrap transition-all ${selectedCategory === cat.id ? 'bg-slate-800 text-white shadow-lg scale-105' : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-100'}`}>
                        {cat.name}
                    </button>
                ))}
            </div>

            {/* Filtros de Subcategoría */}
            {currentSubcategories.length > 0 && (
                <div className="flex gap-2 overflow-x-auto pb-2 mb-2 scrollbar-hide shrink-0 animate-in slide-in-from-left-2 fade-in">
                    <div className="flex items-center text-xs font-bold text-slate-400 mr-1"><Filter size={12} className="mr-1" /> Sub:</div>
                    <button onClick={() => setSelectedSubCategory('all')} className={`px-3 py-1 rounded-lg text-xs font-bold whitespace-nowrap transition-colors border ${selectedSubCategory === 'all' ? 'bg-blue-100 text-blue-700 border-blue-200' : 'bg-white text-slate-500 border-slate-200'}`}>Todas</button>
                    {currentSubcategories.map(sub => (
                        <button key={sub.id} onClick={() => setSelectedSubCategory(sub.id)} className={`px-3 py-1 rounded-lg text-xs font-bold whitespace-nowrap transition-colors border ${selectedSubCategory === sub.id ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-slate-600 border-slate-200'}`}>
                            {sub.name}
                        </button>
                    ))}
                </div>
            )}

            {/* GRILLA AUTO-AJUSTABLE */}
            <div className="flex-1 min-h-0 relative">
                {filteredProducts.length === 0 ? (
                    <div className="absolute inset-0 flex flex-col items-center justify-center text-slate-400">
                        <Search size={48} className="mb-2 opacity-20" />
                        <p>No se encontraron productos</p>
                    </div>
                ) : (
                    <AutoSizer>
                        {({ height, width }) => {
                            const columnCount = getColumnCount(width);
                            const columnWidth = width / columnCount;

                            // MEJORA 2: Altura dinámica (Aspect Ratio)
                            // En lugar de fijo 240px, usamos una proporción.
                            // Por ejemplo, alto = ancho * 1.3 (Formato tarjeta vertical)
                            // Limitamos con Math.max para que no sean muy chatas en pantallas raras
                            const rowHeight = Math.max(220, columnWidth * 1.25);

                            const rowCount = Math.ceil(filteredProducts.length / columnCount);

                            return (
                                <Grid
                                    columnCount={columnCount}
                                    columnWidth={columnWidth}
                                    height={height}
                                    rowCount={rowCount}
                                    rowHeight={rowHeight}
                                    width={width}
                                    itemData={{ products: filteredProducts, columnCount }}
                                >
                                    {Cell}
                                </Grid>
                            );
                        }}
                    </AutoSizer>
                )}
            </div>
        </div>
    );
});

export default ProductGrid;