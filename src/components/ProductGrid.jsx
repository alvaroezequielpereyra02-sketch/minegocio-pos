import React from 'react';
import { Search, ScanBarcode, Image as ImageIcon } from 'lucide-react';

export default function ProductGrid({
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
  return (
    <div className="flex-1 flex flex-col min-h-0">
        
        {/* BARRA DE BÚSQUEDA Y ESCÁNER (DISEÑO MEJORADO) */}
        <div className="mb-3 flex gap-3">
            <div className="flex-1">
                {/* Contenedor con borde limpio y transición suave */}
                <div className="flex items-center w-full bg-white border border-slate-300 rounded-xl px-4 py-2.5 transition-all duration-200 focus-within:border-blue-600 focus-within:ring-1 focus-within:ring-blue-600 focus-within:shadow-md">
                    <Search className="text-slate-400 w-5 h-5 shrink-0 mr-3 transition-colors focus-within:text-blue-500" />
                    <input 
                        className="w-full bg-transparent outline-none text-base text-slate-700 placeholder:text-slate-400 border-none focus:ring-0 p-0" 
                        placeholder="Buscar productos..." 
                        value={searchTerm} 
                        onChange={(e) => setSearchTerm(e.target.value)} 
                    />
                </div>
            </div>

            {userData.role === 'admin' && (
                <form onSubmit={handleBarcodeSubmit} className="hidden sm:block">
                    <div className="flex items-center w-48 bg-white border border-slate-300 rounded-xl px-4 py-2.5 transition-all duration-200 focus-within:border-blue-600 focus-within:ring-1 focus-within:ring-blue-600 focus-within:shadow-md">
                        <ScanBarcode className="text-slate-400 w-5 h-5 shrink-0 mr-3" />
                        <input 
                            className="w-full bg-transparent outline-none text-base text-slate-700 placeholder:text-slate-400 border-none focus:ring-0 p-0" 
                            placeholder="Escanear..." 
                            value={barcodeInput} 
                            onChange={(e) => setBarcodeInput(e.target.value)} 
                            autoFocus
                        />
                    </div>
                </form>
            )}
        </div>

        {/* FILTROS DE CATEGORÍA */}
        <div className="flex gap-2 overflow-x-auto pb-2 mb-2 scrollbar-hide">
            <button onClick={() => setSelectedCategory('all')} className={`px-4 py-1.5 rounded-full text-sm font-medium whitespace-nowrap transition-colors ${selectedCategory === 'all' ? 'bg-blue-600 text-white shadow-md' : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'}`}>Todos</button>
            {categories.map(cat => (
                <button key={cat.id} onClick={() => setSelectedCategory(cat.id)} className={`px-4 py-1.5 rounded-full text-sm font-medium whitespace-nowrap transition-colors ${selectedCategory === cat.id ? 'bg-blue-600 text-white shadow-md' : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'}`}>
                    {cat.name}
                </button>
            ))}
        </div>

        {/* LISTADO DE PRODUCTOS */}
        <div className="flex-1 overflow-y-auto pr-2 pb-24 lg:pb-0">
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
                {products.filter(p => p.name.toLowerCase().includes(searchTerm.toLowerCase()) && (selectedCategory === 'all' || p.categoryId === selectedCategory)).map(product => (
                    <button key={product.id} onClick={() => addToCart(product)} className="flex flex-col items-start p-0 rounded-xl border bg-white shadow-sm overflow-hidden active:scale-95 transition-all relative group hover:ring-2 hover:ring-blue-100 hover:border-blue-200">
                        <div className="w-full h-32 bg-slate-100 relative">
                            {product.imageUrl ? <img src={product.imageUrl} className="w-full h-full object-cover" onError={(e)=>{e.target.src='https://via.placeholder.com/150'}} /> : <div className="w-full h-full flex items-center justify-center text-slate-300"><ImageIcon className="w-8 h-8"/></div>}
                            <div className={`absolute top-1 right-1 px-1.5 py-0.5 rounded text-[10px] font-bold shadow-sm ${product.stock <= 0 ? 'bg-red-500 text-white' : 'bg-white/90 text-slate-700'}`}>{product.stock}</div>
                        </div>
                        <div className="p-3 w-full text-left">
                            <div className="font-semibold text-slate-800 text-sm truncate">{product.name}</div>
                            <div className="font-bold text-blue-600 text-sm">${product.price}</div>
                        </div>
                    </button>
                ))}
            </div>
        </div>
    </div>
  );
}
