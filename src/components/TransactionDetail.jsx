import React, { useState } from 'react';
import { ArrowLeft, Share2, Printer, FileText, MessageCircle, X, Receipt, Mail, Phone, MapPin, User, Calendar, CreditCard, ExternalLink } from 'lucide-react';

export default function TransactionDetail({ transaction, onClose, onPrint, onShare, onCancel, customers }) {
  const [showShareOptions, setShowShareOptions] = useState(false);
  const [activeTab, setActiveTab] = useState('items'); // 'items', 'details', 'client'

  if (!transaction) return null;

  // Buscar datos del cliente en la base de datos local usando el ID de la transacción
  const customerData = customers.find(c => c.id === transaction.clientId) || {};
  
  // Datos combinados (prioriza los guardados en la venta, si no, usa los actuales del cliente)
  const clientName = transaction.clientName || customerData.name || 'Consumidor Final';
  const clientPhone = customerData.phone || '';
  const clientAddress = customerData.address || '';
  const clientEmail = customerData.email || '';

  const dateObj = transaction.date?.seconds ? new Date(transaction.date.seconds * 1000) : new Date();
  const dateStr = dateObj.toLocaleDateString('es-ES', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
  const timeStr = dateObj.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });

  // --- MODAL DE OPCIONES DE COMPARTIR ---
  if (showShareOptions) {
    return (
      <div className="fixed inset-0 z-[70] bg-black/60 flex items-end justify-center sm:items-center p-0 sm:p-4 backdrop-blur-sm animate-in fade-in duration-200">
        <div className="bg-white w-full max-w-sm sm:rounded-2xl rounded-t-2xl overflow-hidden shadow-2xl animate-in slide-in-from-bottom duration-300">
          <div className="p-4 flex justify-between items-start border-b">
            <button onClick={() => setShowShareOptions(false)}><X size={24} className="text-slate-400 hover:text-slate-600"/></button>
            <div className="text-right">
              <h3 className="text-lg font-bold text-slate-800">COMPARTIR</h3>
              <p className="text-xs text-slate-500">Selecciona un formato</p>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3 p-6 bg-slate-50">
            <button onClick={() => onPrint(transaction)} className="flex flex-col items-center justify-center gap-2 p-4 bg-white border rounded-xl hover:shadow-md transition-all">
                <div className="w-12 h-12 bg-red-100 text-red-600 rounded-full flex items-center justify-center"><FileText size={24} /></div>
                <span className="font-bold text-slate-700">PDF</span>
            </button>
            <button onClick={() => onShare(transaction)} className="flex flex-col items-center justify-center gap-2 p-4 bg-white border rounded-xl hover:shadow-md transition-all">
                <div className="w-12 h-12 bg-green-100 text-green-600 rounded-full flex items-center justify-center"><MessageCircle size={24} /></div>
                <span className="font-bold text-slate-700">WhatsApp</span>
            </button>
          </div>
        </div>
      </div>
    );
  }

  // --- VISTA DETALLADA PRINCIPAL ---
  return (
    <div className="fixed inset-0 z-50 bg-slate-100/90 backdrop-blur-sm flex justify-center items-start sm:items-center overflow-y-auto animate-in fade-in duration-200">
      
      {/* Contenedor Principal (Hoja) - Centrado en PC */}
      <div className="w-full max-w-2xl bg-white sm:rounded-2xl shadow-2xl min-h-screen sm:min-h-[600px] sm:h-auto flex flex-col relative animate-in slide-in-from-bottom-10 duration-300">
        
        {/* Navbar Superior Sticky */}
        <div className="bg-white px-4 py-3 flex items-center gap-4 border-b sticky top-0 z-10 sm:rounded-t-2xl">
          <button 
            onClick={onClose} 
            className="p-2 -ml-2 text-slate-600 hover:bg-slate-100 rounded-full transition-colors active:bg-slate-200"
            aria-label="Volver atrás"
          >
              <ArrowLeft size={24} />
          </button>
          <div className="flex-1 min-w-0">
              <div className="text-xs text-slate-500 font-medium">Detalle de Venta</div>
              <div className="font-bold text-slate-800 truncate text-lg">#{transaction.id.slice(0,8).toUpperCase()}</div>
          </div>
          <div className={`px-3 py-1 rounded-full text-xs font-bold border ${transaction.paymentStatus === 'paid' ? 'bg-green-50 text-green-700 border-green-200' : 'bg-red-50 text-red-700 border-red-200'}`}>
              {transaction.paymentStatus === 'paid' ? 'PAGADO' : 'PENDIENTE'}
          </div>
        </div>

        {/* Cuerpo Principal */}
        <div className="flex-1 overflow-y-auto">
          
          {/* Cabecera de Precio */}
          <div className="bg-slate-50 p-8 text-center border-b">
              <div className="text-5xl font-extrabold text-slate-800 tracking-tight">
                  ${transaction.total.toLocaleString()}
              </div>
              <div className="text-sm text-slate-500 mt-2 font-medium flex items-center justify-center gap-2">
                  <CreditCard size={14}/>
                  {transaction.paymentMethod === 'transfer' ? 'Transferencia Bancaria' : 'Efectivo'}
              </div>
          </div>

          {/* Pestañas de Navegación */}
          <div className="flex border-b sticky top-[60px] bg-white z-10">
              <button 
                onClick={() => setActiveTab('items')}
                className={`flex-1 pb-3 pt-3 text-sm font-bold border-b-2 transition-colors ${activeTab === 'items' ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-400 hover:text-slate-600'}`}
              >
                ITEMS ({transaction.items.length})
              </button>
              <button 
                onClick={() => setActiveTab('details')}
                className={`flex-1 pb-3 pt-3 text-sm font-bold border-b-2 transition-colors ${activeTab === 'details' ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-400 hover:text-slate-600'}`}
              >
                DETALLES
              </button>
              <button 
                onClick={() => setActiveTab('client')}
                className={`flex-1 pb-3 pt-3 text-sm font-bold border-b-2 transition-colors ${activeTab === 'client' ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-400 hover:text-slate-600'}`}
              >
                CLIENTE
              </button>
          </div>

          {/* CONTENIDO DE PESTAÑAS */}
          <div className="p-6">
            
            {/* 1. LISTA DE ITEMS */}
            {activeTab === 'items' && (
                <div className="space-y-4 animate-in fade-in slide-in-from-left-4 duration-300">
                    {transaction.items.map((item, index) => (
                        <div key={index} className="flex gap-4 items-start p-3 hover:bg-slate-50 rounded-lg transition-colors border border-transparent hover:border-slate-100">
                            <div className="bg-blue-50 text-blue-700 font-bold w-10 h-10 rounded-lg flex items-center justify-center shrink-0">
                                {item.qty}
                            </div>
                            <div className="flex-1 min-w-0">
                                <div className="font-bold text-slate-800 leading-tight">{item.name}</div>
                                <div className="text-xs text-slate-400 mt-1">${item.price.toLocaleString()} c/u</div>
                            </div>
                            <div className="text-lg font-bold text-slate-700">
                                ${(item.price * item.qty).toLocaleString()}
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* 2. DETALLES TÉCNICOS */}
            {activeTab === 'details' && (
                <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
                    <div className="grid grid-cols-2 gap-4">
                        <div className="p-3 bg-slate-50 rounded-lg border border-slate-100">
                            <div className="text-xs text-slate-400 mb-1 flex items-center gap-1"><Calendar size={12}/> Fecha</div>
                            <div className="font-semibold text-slate-700 text-sm">{dateStr}</div>
                        </div>
                        <div className="p-3 bg-slate-50 rounded-lg border border-slate-100">
                            <div className="text-xs text-slate-400 mb-1 flex items-center gap-1"><CreditCard size={12}/> Hora</div>
                            <div className="font-semibold text-slate-700 text-sm">{timeStr}</div>
                        </div>
                    </div>
                    
                    <div>
                        <h4 className="text-xs font-bold text-slate-400 uppercase mb-2">Notas de la venta</h4>
                        <div className="p-4 bg-yellow-50 border border-yellow-100 rounded-lg text-sm text-yellow-800 italic min-h-[80px]">
                            {transaction.paymentNote ? `"${transaction.paymentNote}"` : "Sin notas adicionales."}
                        </div>
                    </div>

                    <div className="text-xs text-slate-300 text-center pt-4">
                        ID Transacción: {transaction.id}
                    </div>
                </div>
            )}

            {/* 3. INFORMACIÓN DEL CLIENTE (NUEVO) */}
            {activeTab === 'client' && (
                <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
                    <div className="flex items-center gap-4 p-4 bg-blue-50 border border-blue-100 rounded-xl">
                        <div className="w-12 h-12 bg-blue-200 text-blue-700 rounded-full flex items-center justify-center text-xl font-bold">
                            {clientName.charAt(0).toUpperCase()}
                        </div>
                        <div>
                            <div className="font-bold text-slate-800 text-lg">{clientName}</div>
                            <div className="text-xs text-blue-600 font-medium bg-blue-100 px-2 py-0.5 rounded-full inline-block mt-1">
                                {transaction.clientRole === 'client' ? 'Cliente Registrado' : 'Invitado'}
                            </div>
                        </div>
                    </div>

                    <div className="space-y-3">
                        {/* Teléfono */}
                        {clientPhone ? (
                            <div className="flex gap-2">
                                <a href={`tel:${clientPhone}`} className="flex-1 flex items-center gap-3 p-3 bg-white border border-slate-200 rounded-lg hover:border-blue-400 hover:shadow-sm transition-all group">
                                    <div className="p-2 bg-slate-100 text-slate-500 rounded-full group-hover:bg-blue-100 group-hover:text-blue-600"><Phone size={18}/></div>
                                    <div>
                                        <div className="text-xs text-slate-400">Teléfono</div>
                                        <div className="font-bold text-slate-700">{clientPhone}</div>
                                    </div>
                                </a>
                                <a href={`https://wa.me/${clientPhone.replace(/\D/g,'')}`} target="_blank" rel="noreferrer" className="flex items-center justify-center w-14 bg-green-50 border border-green-200 rounded-lg text-green-600 hover:bg-green-100">
                                    <MessageCircle size={24}/>
                                </a>
                            </div>
                        ) : (
                            <div className="p-3 border border-dashed border-slate-300 rounded-lg text-slate-400 text-sm text-center">Sin teléfono registrado</div>
                        )}

                        {/* Dirección */}
                        {clientAddress ? (
                            <div className="flex gap-2">
                                <div className="flex-1 flex items-center gap-3 p-3 bg-white border border-slate-200 rounded-lg">
                                    <div className="p-2 bg-slate-100 text-slate-500 rounded-full"><MapPin size={18}/></div>
                                    <div>
                                        <div className="text-xs text-slate-400">Dirección de Entrega</div>
                                        <div className="font-bold text-slate-700 leading-tight">{clientAddress}</div>
                                    </div>
                                </div>
                                <a href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(clientAddress)}`} target="_blank" rel="noreferrer" className="flex items-center justify-center w-14 bg-blue-50 border border-blue-200 rounded-lg text-blue-600 hover:bg-blue-100">
                                    <ExternalLink size={24}/>
                                </a>
                            </div>
                        ) : (
                            <div className="p-3 border border-dashed border-slate-300 rounded-lg text-slate-400 text-sm text-center">Sin dirección registrada</div>
                        )}

                        {/* Email */}
                        {clientEmail && (
                            <a href={`mailto:${clientEmail}`} className="flex items-center gap-3 p-3 bg-white border border-slate-200 rounded-lg hover:border-blue-400 hover:shadow-sm transition-all group">
                                <div className="p-2 bg-slate-100 text-slate-500 rounded-full group-hover:bg-blue-100 group-hover:text-blue-600"><Mail size={18}/></div>
                                <div>
                                    <div className="text-xs text-slate-400">Email</div>
                                    <div className="font-bold text-slate-700">{clientEmail}</div>
                                </div>
                            </a>
                        )}
                    </div>
                </div>
            )}

          </div>
        </div>

        {/* Footer de Acciones */}
        <div className="p-4 border-t bg-white safe-area-bottom flex gap-3 sm:rounded-b-2xl">
          <button 
              onClick={() => setShowShareOptions(true)}
              className="flex-1 h-12 flex items-center justify-center gap-2 border-2 border-slate-200 rounded-xl text-slate-700 font-bold hover:bg-slate-50 hover:border-slate-300 transition-colors"
          >
              <Share2 size={20} /> Compartir
          </button>

          <button 
              onClick={() => onCancel(transaction.id)}
              className="flex-1 h-12 bg-white border-2 border-red-100 text-red-600 font-bold rounded-xl hover:bg-red-50 hover:border-red-200 transition-colors"
          >
              Cancelar
          </button>
        </div>

      </div>
    </div>
  );
}
