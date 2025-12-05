import React, { useMemo, memo } from 'react';
import { Search, ScanBarcode, Image as ImageIcon } from 'lucide-react';
import { FixedSizeGrid as Grid } from 'react-window';
import AutoSizer from 'react-virtualized-auto-sizer';

// Helper para calcular columnas según el ancho (igual que tus clases de Tailwind)
const getColumnCount = (width) => {
    if (width < 640) return 2; // sm (mobile)
    if (width < 768) return 3; // md
    if (width < 1024) return 4; // lg
    return 5; // xl+
};

const ProductGrid = memo(function ProductGrid({
    products,
    addToCart,
    searchTerm,
    setSearchTerm,
    selectedCategory,
    setSelectedCategory,
    categories,
    userData,
    barcodeInput,
    setBarcodeInput,
    handleBarcodeSubmit
}) {

    const filteredProducts = useMemo(() => {
        const lowerTerm = searchTerm.toLowerCase();
        return products.filter(p =>
            p.name.toLowerCase().includes(lowerTerm) &&
            (selectedCategory === 'all' || p.categoryId === selectedCategory)
        );
    }, [products, searchTerm, selectedCategory]);

    // Renderizador de cada celda (Producto)
    const Cell = ({ columnIndex, rowIndex, style, data }) => {
        const { products, columnCount } = data;
        const index = rowIndex * columnCount + columnIndex;

        // Si el índice se pasa del total de productos, renderizar vacío
        if (index >= products.length) return null;

        const product = products[index];

        // Ajuste para simular 'gap' (espacio entre celdas)
        const gutter = 10;
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
                    className="flex flex-col items-start w-full h-full p-0 rounded-xl border bg-white shadow-sm overflow-hidden active:scale-95 transition-transform relative group hover:border-blue-300"
                >
                    <div className="w-full h-32 bg-slate-100 relative shrink-0">
                        {product.imageUrl ? (
                            <img src={product.imageUrl} className="w-full h-full object-cover" loading="lazy" onError={(e) => { e.target.src = 'https://via.placeholder.com/150' }} />
                        ) : (
                            <div className="w-full h-full flex items-center justify-center text-slate-300">
                                <ImageIcon className="w-8 h-8" />
                            </div>
                        )}
                        <div className={`absolute top-1 right-1 px-1.5 py-0.5 rounded text-[10px] font-bold shadow-sm ${product.stock <= 0 ? 'bg-red-500 text-white' : 'bg-white/90 text-slate-700'}`}>
                            {product.stock}
                        </div>
                    </div>
                    <div className="p-3 w-full text-left flex flex-col justify-between flex-1 min-h-0">
                        <div className="font-semibold text-slate-800 text-sm line-clamp-2 leading-tight">{product.name}</div>
                        <div className="font-bold text-blue-600 text-sm mt-1">${product.price}</div>
                    </div>
                </button>
            </div>
        );
    };

    return (
        <div className="flex-1 flex flex-col min-h-0">

            {/* BARRA DE BÚSQUEDA Y ESCÁNER */}
            <div className="mb-3 flex gap-3 shrink-0">
                <div className="flex-1">
                    <div className="flex items-center w-full bg-white border border-slate-300 rounded-xl px-4 py-2.5 transition-colors duration-200 focus-within:border-blue-600 focus-within:shadow-sm">
                        <Search className="text-slate-400 w-5 h-5 shrink-0 mr-3" />
                        <input
                            className="w-full bg-transparent outline-none text-base text-slate-700 placeholder:text-slate-400 border-none focus:ring-0 focus:outline-none p-0"
                            placeholder="Buscar productos..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />
                    </div>
                </div>

                {userData.role === 'admin' && (
                    <form onSubmit={handleBarcodeSubmit} className="hidden sm:block">
                        <div className="flex items-center w-48 bg-white border border-slate-300 rounded-xl px-4 py-2.5 transition-colors duration-200 focus-within:border-blue-600 focus-within:shadow-sm">
                            <ScanBarcode className="text-slate-400 w-5 h-5 shrink-0 mr-3" />
                            <input
                                className="w-full bg-transparent outline-none text-base text-slate-700 placeholder:text-slate-400 border-none focus:ring-0 focus:outline-none p-0"
                                placeholder="Escanear..."
                                value={barcodeInput}
                                onChange={(e) => setBarcodeInput(e.target.value)}
                            />
                        </div>
                    </form>
                )}
            </div>

            {/* FILTROS DE CATEGORÍA */}
            <div className="flex gap-2 overflow-x-auto pb-2 mb-2 scrollbar-hide shrink-0">
                <button onClick={() => setSelectedCategory('all')} className={`px-4 py-1.5 rounded-full text-sm font-medium whitespace-nowrap transition-colors ${selectedCategory === 'all' ? 'bg-blue-600 text-white shadow-md' : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'}`}>Todos</button>
                {categories.map(cat => (
                    <button key={cat.id} onClick={() => setSelectedCategory(cat.id)} className={`px-4 py-1.5 rounded-full text-sm font-medium whitespace-nowrap transition-colors ${selectedCategory === cat.id ? 'bg-blue-600 text-white shadow-md' : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'}`}>
                        {cat.name}
                    </button>
                ))}
            </div>

            {/* LISTADO VIRTUALIZADO */}
            <div className="flex-1 min-h-0 pb-20 lg:pb-0">
                {filteredProducts.length === 0 ? (
                    <div className="h-full flex flex-col items-center justify-center text-slate-400">
                        <Search size={48} className="mb-2 opacity-20" />
                        <p>No se encontraron productos</p>
                    </div>
                ) : (
                    <AutoSizer>
                        {({ height, width }) => {
                            const columnCount = getColumnCount(width);
                            const columnWidth = width / columnCount;
                            const rowHeight = 240; // Altura fija de cada tarjeta + espacio
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