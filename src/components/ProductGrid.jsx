import React, { useMemo, useCallback } from 'react';
import { Image as ImageIcon, ScanBarcode, Edit, AlertCircle, Plus } from 'lucide-react';
import { FixedSizeGrid } from 'react-window';
import AutoSizer from 'react-virtualized-auto-sizer';
import { getThumbnailUrl } from '../config/uploadImage';

// ── Constantes de layout ──────────────────────────────────────────────────────
// Altura fija de cada card — necesaria para FixedSizeGrid.
const CARD_HEIGHT = 220;
const GAP = 12; // equivalente a gap-3 de Tailwind

// Replica el comportamiento responsive de grid-cols-2/3/4/5 de Tailwind.
const getColumnCount = (width) => {
    if (width >= 1280) return 5; // xl
    if (width >= 768)  return 4; // md
    if (width >= 640)  return 3; // sm
    return 2;                    // base (móvil)
};

// ── Card individual memorizada ────────────────────────────────────────────────
// React.memo evita que FixedSizeGrid la recree cuando cambian celdas vecinas.
const ProductCard = React.memo(function ProductCard({
    product, qtyInCart, isAdmin, addToCart, onEditProduct,
    setFaultyProduct, toggleModal, cardWidth,
}) {
    const outOfStock = product.stock <= 0;
    return (
        <div
            onClick={() => addToCart(product)}
            style={{ width: cardWidth, height: CARD_HEIGHT }}
            className="product-card bg-[#EDE8DC] rounded-2xl overflow-hidden flex flex-col cursor-pointer border border-[#D4C9B0] hover:border-[#8B6914] hover:shadow-lg transition-all active:scale-[0.97] group"
        >
            <div className="aspect-square relative overflow-hidden bg-[#F5F0E8]">
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
                {product.imageUrl && (
                    <div className="absolute inset-x-0 bottom-0 h-12 bg-gradient-to-t from-black/30 to-transparent" />
                )}
                {qtyInCart > 0 && (
                    <div className="absolute top-2 left-2 text-white text-xs font-black w-6 h-6 rounded-full flex items-center justify-center shadow-lg"
                        style={{ background: 'linear-gradient(135deg, #f97316, #ea580c)' }}>
                        {qtyInCart}
                    </div>
                )}
                {isAdmin && (
                    <div className="absolute top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button onClick={(e) => { e.stopPropagation(); setFaultyProduct(product); toggleModal('faulty', true); }}
                            className="w-6 h-6 bg-white/90 rounded-full flex items-center justify-center text-[#8B6914] shadow-sm hover:bg-white">
                            <AlertCircle size={12} />
                        </button>
                        <button onClick={(e) => { e.stopPropagation(); onEditProduct(product); }}
                            className="w-6 h-6 bg-white/90 rounded-full flex items-center justify-center text-blue-500 shadow-sm hover:bg-white">
                            <Edit size={12} />
                        </button>
                    </div>
                )}
            </div>
            <div className="p-2.5 flex flex-col flex-1">
                <h3 className="text-xs font-bold text-slate-800 line-clamp-2 leading-tight mb-2">{product.name}</h3>
                <div className="mt-auto flex items-center justify-between">
                    <div className="flex flex-col">
                        <span className="text-base font-black text-black leading-none">${product.price?.toLocaleString()}</span>
                        {isAdmin && (
                            <span className={`text-[10px] font-semibold mt-0.5 ${outOfStock ? 'text-red-500' : 'text-emerald-700'}`}>
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
});

// ── Componente principal ──────────────────────────────────────────────────────
const ProductGrid = React.memo(function ProductGrid({
    products, addToCart, searchTerm, setSearchTerm,
    selectedCategory, setSelectedCategory, categories,
    subcategories = [],
    userData, barcodeInput, setBarcodeInput, handleBarcodeSubmit,
    onEditProduct, setFaultyProduct, toggleModal,
    cart
}) {
    const activeCategories = useMemo(
        () => categories.filter(c => c.isActive !== false),
        [categories]
    );

    // Subcategorías de la categoría seleccionada (si hay alguna activa)
    // Solo se muestran cuando hay una categoría concreta seleccionada (no 'all')
    // y no se está ya dentro de una subcategoría (__sub__: prefix).
    const activeSubcategories = useMemo(() => {
        if (!selectedCategory || selectedCategory === 'all' || selectedCategory.startsWith('__sub__:')) return [];
        return subcategories.filter(s => s.parentId === selectedCategory);
    }, [subcategories, selectedCategory]);

    const filteredProducts = useMemo(() => products.filter(product => {
        const category = categories.find(c => c.id === product.categoryId);
        if (category && category.isActive === false) return false;
        const effectiveSearch = (barcodeInput || searchTerm).toLowerCase();
        const matchesSearch = product.name?.toLowerCase().includes(effectiveSearch) ||
            product.barcode?.toLowerCase().includes(effectiveSearch);

        // Soporte para selección de subcategoría: '__sub__:subcategoryId'
        let matchesCategory;
        if (selectedCategory === 'all') {
            matchesCategory = true;
        } else if (selectedCategory.startsWith('__sub__:')) {
            const subId = selectedCategory.slice(8);
            matchesCategory = product.subCategoryId === subId;
        } else {
            matchesCategory = product.categoryId === selectedCategory;
        }

        return matchesSearch && matchesCategory;
    }), [products, categories, barcodeInput, searchTerm, selectedCategory]);

    const cartQtyMap = useMemo(() =>
        (cart || []).reduce((acc, item) => { acc[item.id] = item.qty; return acc; }, {}),
        [cart]
    );

    const isAdmin = userData?.role === 'admin';

    // ── Renderer de celda para FixedSizeGrid ──────────────────────────────────
    // useCallback con dependencias estables evita que FixedSizeGrid
    // descarte su caché de celdas en cada render del padre.
    const CellRenderer = useCallback(({ columnIndex, rowIndex, style, data }) => {
        const { products, columnCount, cardWidth } = data;
        const index = rowIndex * columnCount + columnIndex;
        if (index >= products.length) return null; // celda vacía en la última fila

        const product = products[index];
        // FixedSizeGrid ya posiciona cada celda en:
        //   left = columnIndex * columnWidth  (donde columnWidth = cardWidth + GAP)
        //   top  = rowIndex    * rowHeight    (donde rowHeight  = CARD_HEIGHT + GAP)
        // Solo sobreescribimos width y height para recortar el GAP visual.
        // NO agregar columnIndex*GAP ni rowIndex*GAP — eso duplica el espacio.
        const cellStyle = {
            ...style,
            width:  cardWidth,
            height: CARD_HEIGHT,
        };

        return (
            <div style={cellStyle}>
                <ProductCard
                    product={product}
                    qtyInCart={cartQtyMap[product.id] || 0}
                    isAdmin={isAdmin}
                    cardWidth={cardWidth}
                    addToCart={addToCart}
                    onEditProduct={onEditProduct}
                    setFaultyProduct={setFaultyProduct}
                    toggleModal={toggleModal}
                />
            </div>
        );
    }, [cartQtyMap, isAdmin, addToCart, onEditProduct, setFaultyProduct, toggleModal]);

    return (
        <div className="flex-1 flex flex-col min-w-0 h-full">

            {/* Barra de búsqueda + categorías */}
            <div className="bg-[#EDE8DC] rounded-2xl shadow-sm border border-[#D4C9B0] mb-3 overflow-hidden">
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
                                    : 'bg-[#E8E0CC] text-[#5C4A2A] hover:bg-[#D4C9B0]'
                            }`}
                            style={selectedCategory === cat.id ? { background: 'linear-gradient(135deg, #f97316, #ea580c)' } : {}}
                        >
                            {cat.name}
                        </button>
                    ))}
                </div>

                {/* Segunda fila: subcategorías de la categoría seleccionada */}
                {activeSubcategories.length > 0 && (
                    <div className="flex gap-2 px-3 pb-2.5 overflow-x-auto scrollbar-hide border-t border-[#D4C9B0] pt-2">
                        <button
                            onClick={() => setSelectedCategory(selectedCategory)}
                            className={`px-3 py-1 rounded-full text-[11px] font-bold whitespace-nowrap transition-all ${
                                !selectedCategory.startsWith('__sub__:')
                                    ? 'bg-[#8B6914] text-white shadow-sm'
                                    : 'bg-[#E8E0CC] text-[#5C4A2A] hover:bg-[#D4C9B0]'
                            }`}
                        >
                            Todas
                        </button>
                        {activeSubcategories.map(sub => {
                            const isActive = selectedCategory === `__sub__:${sub.id}`;
                            return (
                                <button
                                    key={sub.id}
                                    onClick={() => setSelectedCategory(`__sub__:${sub.id}`)}
                                    className={`px-3 py-1 rounded-full text-[11px] font-bold whitespace-nowrap transition-all ${
                                        isActive
                                            ? 'text-white shadow-sm'
                                            : 'bg-[#E8E0CC] text-[#5C4A2A] hover:bg-[#D4C9B0]'
                                    }`}
                                    style={isActive ? { background: 'linear-gradient(135deg, #f97316, #ea580c)' } : {}}
                                >
                                    {sub.name}
                                </button>
                            );
                        })}
                    </div>
                )}
            </div>

            {/* Grilla virtualizada.
                Con 1000 productos, pasa de ~1000 nodos DOM a ~20-30 visibles en pantalla.
                AutoSizer mide el contenedor y pasa width/height a FixedSizeGrid. */}
            <div className="flex-1">
                <AutoSizer>
                    {({ width, height }) => {
                        const columnCount = getColumnCount(width);
                        // Math.floor(width / columnCount) garantiza que
                        // columnCount * columnWidth ≤ width → sin overflow lateral.
                        const columnWidth = Math.floor(width / columnCount);
                        const cardWidth   = columnWidth - GAP;
                        const rowCount    = Math.ceil(filteredProducts.length / columnCount);
                        const rowHeight   = CARD_HEIGHT + GAP;

                        return (
                            <FixedSizeGrid
                                width={width}
                                height={height}
                                columnCount={columnCount}
                                columnWidth={cardWidth + GAP}
                                rowCount={rowCount}
                                rowHeight={rowHeight}
                                itemData={{ products: filteredProducts, columnCount, cardWidth }}
                                overscanRowCount={2}
                            >
                                {CellRenderer}
                            </FixedSizeGrid>
                        );
                    }}
                </AutoSizer>
            </div>
        </div>
    );
});

export default ProductGrid;
