import React, { useState } from 'react';
import { Search, Filter, Plus, Edit, Trash2, ShoppingCart, Image as ImageIcon } from 'lucide-react';
import { useInventory } from '../hooks/useInventory';
import { useCart } from '../hooks/useCart';
import { uploadImage } from '../config/uploadImage';

const ProductGrid = ({ onEditProduct, onOpenModal }) => {
    const { products, loading, deleteProduct, categories } = useInventory();
    const { addToCart } = useCart();

    const [searchTerm, setSearchTerm] = useState('');
    const [selectedCategory, setSelectedCategory] = useState('Todas');

    // Filtrado de productos
    const filteredProducts = products.filter(product => {
        const matchesSearch = product.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
            product.barcode?.includes(searchTerm);
        const matchesCategory = selectedCategory === 'Todas' || product.category === selectedCategory;
        return matchesSearch && matchesCategory;
    });

    const handleDelete = async (id, e) => {
        e.stopPropagation(); // Evitar abrir el modal de edición
        if (window.confirm('¿Estás seguro de eliminar este producto?')) {
            await deleteProduct(id);
        }
    };

    if (loading) {
        return (
            <div className="flex justify-center items-center h-64">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
            </div>
        );
    }

    return (
        <div className="p-4">
            {/* Barra Superior: Buscador y Filtros */}
            <div className="flex flex-col md:flex-row justify-between items-center mb-6 gap-4">
                <div className="relative w-full md:w-96">
                    <Search className="absolute left-3 top-2.5 text-gray-400 h-5 w-5" />
                    <input
                        type="text"
                        placeholder="Buscar por nombre o código..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full pl-10 p-2 border rounded-lg focus:ring-2 focus:ring-indigo-500"
                    />
                </div>

                <div className="flex gap-2 w-full md:w-auto overflow-x-auto pb-2 md:pb-0">
                    <button
                        onClick={() => setSelectedCategory('Todas')}
                        className={`px-4 py-2 rounded-full whitespace-nowrap transition-colors ${selectedCategory === 'Todas'
                            ? 'bg-indigo-600 text-white'
                            : 'bg-white text-gray-600 hover:bg-gray-100'
                            }`}
                    >
                        Todas
                    </button>
                    {categories.map(cat => (
                        <button
                            key={cat}
                            onClick={() => setSelectedCategory(cat)}
                            className={`px-4 py-2 rounded-full whitespace-nowrap transition-colors ${selectedCategory === cat
                                ? 'bg-indigo-600 text-white'
                                : 'bg-white text-gray-600 hover:bg-gray-100'
                                }`}
                        >
                            {cat}
                        </button>
                    ))}
                </div>

                <button
                    onClick={() => onOpenModal('add-product')}
                    className="bg-green-600 text-white px-4 py-2 rounded-lg flex items-center gap-2 hover:bg-green-700 transition-colors shadow-sm shrink-0"
                >
                    <Plus size={20} />
                    <span className="hidden md:inline">Nuevo Producto</span>
                </button>
            </div>

            {/* Grid de Productos */}
            {filteredProducts.length === 0 ? (
                <div className="text-center py-12 text-gray-500 bg-white rounded-lg border border-dashed">
                    <p className="text-lg">No se encontraron productos.</p>
                </div>
            ) : (
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                    {filteredProducts.map((product) => (
                        <div
                            key={product.id}
                            className="bg-white rounded-lg shadow-sm hover:shadow-md transition-shadow border overflow-hidden flex flex-col"
                        >
                            {/* Imagen del Producto */}
                            <div className="h-40 bg-gray-100 relative group overflow-hidden">
                                {product.image ? (
                                    <img
                                        src={product.image}
                                        alt={product.name}
                                        className="w-full h-full object-cover"
                                    />
                                ) : (
                                    <div className="w-full h-full flex items-center justify-center text-gray-400">
                                        <ImageIcon size={40} />
                                    </div>
                                )}

                                {/* Botones flotantes (Editar/Eliminar) */}
                                <div className="absolute top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity bg-white/80 p-1 rounded-lg backdrop-blur-sm">
                                    <button
                                        onClick={() => onEditProduct(product)}
                                        className="p-1.5 text-blue-600 hover:bg-blue-50 rounded"
                                        title="Editar"
                                    >
                                        <Edit size={16} />
                                    </button>
                                    <button
                                        onClick={(e) => handleDelete(product.id, e)}
                                        className="p-1.5 text-red-600 hover:bg-red-50 rounded"
                                        title="Eliminar"
                                    >
                                        <Trash2 size={16} />
                                    </button>
                                </div>
                            </div>

                            {/* Información */}
                            <div className="p-3 flex-1 flex flex-col">
                                <div className="flex-1">
                                    <h3 className="font-semibold text-gray-800 truncate" title={product.name}>
                                        {product.name}
                                    </h3>
                                    <p className="text-xs text-gray-500 mb-1">{product.category}</p>
                                    <p className="text-lg font-bold text-indigo-600">
                                        ${product.price?.toFixed(2)}
                                    </p>
                                </div>

                                <div className="mt-3 flex items-center justify-between gap-2">
                                    <div className={`text-xs px-2 py-1 rounded-full font-medium ${product.stock > 5
                                        ? 'bg-green-100 text-green-800'
                                        : product.stock > 0
                                            ? 'bg-yellow-100 text-yellow-800'
                                            : 'bg-red-100 text-red-800'
                                        }`}>
                                        Stock: {product.stock}
                                    </div>

                                    <button
                                        onClick={() => addToCart(product)}
                                        disabled={product.stock <= 0}
                                        className="p-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                                        title="Agregar al carrito"
                                    >
                                        <ShoppingCart size={18} />
                                    </button>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};

export default ProductGrid;