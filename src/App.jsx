import React, { useState, useEffect } from 'react';
import { 
  Beer, 
  MapPin, 
  Home, 
  Settings, 
  Plus, 
  Trash2, 
  Warehouse,
  Store,
  X,
  Edit2,
  ChevronRight,
  User,
  CreditCard,
  PlusCircle,
  Camera,
  Upload,
  FileText,
  MessageSquare,
  CheckCircle2,
  Tag,
  AlertCircle,
  Calendar,
  Music,
  ChevronDown,
  Info
} from 'lucide-react';

// --- CONFIGURACIÓN INICIAL ---
const INITIAL_KEGS = [
  { id: '1', code: 'B-001', capacity: 50, status: 'almacen', locationId: null },
  { id: '2', code: 'B-002', capacity: 50, status: 'almacen', locationId: null },
];

const INITIAL_LOCATIONS = [
  { id: 'loc-1', name: 'DISTRITO Morón', address: 'Av. Rivadavia 18000', contact: '' },
];

const INITIAL_STYLES = ['SCOTTISH ALE', 'IPA', 'HONEY', 'STOUT', 'BLONDE'];

export default function App() {
  const [activeTab, setActiveTab] = useState('whatsapp'); 
  const [statusFilter, setStatusFilter] = useState(null); // 'almacen' | 'entregado' | null
  
  const [kegs, setKegs] = useState(() => {
    const saved = localStorage.getItem('brauers_kegs');
    return saved ? JSON.parse(saved) : INITIAL_KEGS;
  });

  const [locations, setLocations] = useState(() => {
    const saved = localStorage.getItem('brauers_locations');
    return saved ? JSON.parse(saved) : INITIAL_LOCATIONS;
  });

  const [events, setEvents] = useState(() => {
    const saved = localStorage.getItem('brauers_events');
    return saved ? JSON.parse(saved) : [];
  });

  const [styles, setStyles] = useState(() => {
    const saved = localStorage.getItem('brauers_styles');
    return saved ? JSON.parse(saved) : INITIAL_STYLES;
  });

  const [logoUrl, setLogoUrl] = useState(() => {
    return localStorage.getItem('brauers_logo') || null;
  });

  const [settings, setSettings] = useState(() => {
    const saved = localStorage.getItem('brauers_settings');
    return saved ? JSON.parse(saved) : {
      providerName: 'Cerveza Brauers',
      aliasInfo: 'cerveza-brauers (Juan Ignacio Pagano)'
    };
  });

  // Efectos para persistencia
  useEffect(() => {
    localStorage.setItem('brauers_kegs', JSON.stringify(kegs));
  }, [kegs]);

  useEffect(() => {
    localStorage.setItem('brauers_locations', JSON.stringify(locations));
  }, [locations]);

  useEffect(() => {
    localStorage.setItem('brauers_events', JSON.stringify(events));
  }, [events]);

  useEffect(() => {
    localStorage.setItem('brauers_styles', JSON.stringify(styles));
  }, [styles]);

  useEffect(() => {
    if (logoUrl) localStorage.setItem('brauers_logo', logoUrl);
  }, [logoUrl]);

  useEffect(() => {
    localStorage.setItem('brauers_settings', JSON.stringify(settings));
  }, [settings]);

  // Estados de UI
  const [showAddKeg, setShowAddKeg] = useState(false);
  const [showLogoAlert, setShowLogoAlert] = useState(false);
  const [newKeg, setNewKeg] = useState({ code: '', capacity: '' });
  const [newLocationName, setNewLocationName] = useState('');
  const [newEventName, setNewEventName] = useState('');
  const [newStyleName, setNewStyleName] = useState('');
  
  // Lógica de pregunta Bar o Evento
  const [creationChoice, setCreationChoice] = useState(null); 

  // Estado de la "Bajada" actual
  const [wppData, setWppData] = useState({
    locationId: '',
    date: new Date().toISOString().split('T')[0],
    items: [] 
  });
  const [isCopied, setIsCopied] = useState(false);

  // Handlers
  const handleImageUpload = (e) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setLogoUrl(reader.result);
      };
      reader.readAsDataURL(file);
    }
  };

  const addWppItem = () => {
    setWppData({
      ...wppData,
      items: [...wppData.items, { id: Date.now(), kegId: '', style: '', price: '' }]
    });
  };

  const updateWppItem = (id, field, value) => {
    setWppData({
      ...wppData,
      items: wppData.items.map(item => item.id === id ? { ...item, [field]: value } : item)
    });
  };

  const generateText = () => {
    const bar = locations.find(l => l.id === wppData.locationId)?.name || events.find(e => e.id === wppData.locationId)?.name || '_______';
    const date = wppData.date.split('-').reverse().join('/');
    let total = 0;
    let itemsStr = wppData.items.map(item => {
      const keg = kegs.find(k => k.id === item.kegId);
      const p = Number(item.price) || 0;
      total += p;
      return `${keg?.capacity || '??'}L ${item.style || 'CERVEZA'} $${p}`;
    }).join('\n');

    return `Local/Evento: *${bar}*\nProveedor: *${settings.providerName}*\n\nBajada del ${date}:\n${itemsStr}\n\nTotal: $${total}\n\nAlias: ${settings.aliasInfo}`;
  };

  const handleCopyMessage = () => {
    const text = generateText();
    const el = document.createElement('textarea');
    el.value = text;
    document.body.appendChild(el);
    el.select();
    document.execCommand('copy');
    document.body.removeChild(el);
    setIsCopied(true);
    setTimeout(() => setIsCopied(false), 2000);
  };

  const handlePrintPDF = () => {
    if (!logoUrl) {
      setShowLogoAlert(true);
      setTimeout(() => setShowLogoAlert(false), 4000);
      return;
    }
    window.print();
  };

  const handleFinalizeStock = () => {
    const deliveredIds = wppData.items.map(i => i.kegId).filter(id => id !== '');
    if (deliveredIds.length === 0) return;

    setKegs(kegs.map(k => 
      deliveredIds.includes(k.id) 
        ? { ...k, status: 'entregado', locationId: wppData.locationId } 
        : k
    ));
    setWppData({ ...wppData, items: [] });
    setStatusFilter(null);
  };

  const addLocation = () => {
    if (!newLocationName.trim()) return;
    const newLoc = { id: `loc-${Date.now()}`, name: newLocationName, address: '', contact: '' };
    setLocations([...locations, newLoc]);
    setNewLocationName('');
    setCreationChoice(null);
  };

  const addEvent = () => {
    if (!newEventName.trim()) return;
    const newEv = { id: `event-${Date.now()}`, name: newEventName, address: '', contact: '' };
    setEvents([...events, newEv]);
    setNewEventName('');
    setCreationChoice(null);
  };

  const removeLocation = (id) => {
    setLocations(locations.filter(l => l.id !== id));
  };

  const removeEvent = (id) => {
    setEvents(events.filter(e => e.id !== id));
  };

  const addStyle = () => {
    if (!newStyleName.trim()) return;
    const styleUp = newStyleName.toUpperCase();
    if (!styles.includes(styleUp)) {
      setStyles([...styles, styleUp]);
    }
    setNewStyleName('');
  };

  const removeStyle = (styleName) => {
    setStyles(styles.filter(s => s !== styleName));
  };

  const addNewKeg = () => {
    if (!newKeg.code || !newKeg.capacity) return;
    const keg = {
      id: Date.now().toString(),
      code: newKeg.code.toUpperCase(),
      capacity: Number(newKeg.capacity),
      status: 'almacen',
      locationId: null
    };
    setKegs([...kegs, keg]);
    setNewKeg({ code: '', capacity: '' });
    setShowAddKeg(false);
  };

  const allDestinations = [...locations, ...events];
  const selectedLocation = allDestinations.find(l => l.id === wppData.locationId);
  const totalPrice = wppData.items.reduce((sum, item) => sum + (Number(item.price) || 0), 0);

  return (
    <div className="min-h-screen bg-gray-50 flex justify-center font-sans overflow-x-hidden">
      
      <style dangerouslySetInnerHTML={{ __html: `
        @media print {
          body * { visibility: hidden; }
          #print-section, #print-section * { visibility: visible; }
          #print-section { 
            position: absolute; 
            left: 0; 
            top: 0; 
            width: 100%; 
            padding: 40px;
            background: white;
          }
          .no-print { display: none !important; }
        }
      `}} />

      {/* SECCIÓN DE IMPRESIÓN */}
      <div id="print-section" className="hidden print:block text-black">
        <div className="flex justify-between items-start border-b-4 border-black pb-8 mb-8">
          <div className="flex items-center space-x-4">
            {logoUrl ? (
              <img src={logoUrl} alt="Logo" className="w-20 h-20 object-contain border-2 border-black p-1" />
            ) : (
              <div className="w-20 h-20 bg-black flex items-center justify-center text-white font-black italic text-2xl">B</div>
            )}
            <div>
              <h1 className="text-4xl font-black uppercase italic tracking-tighter leading-none">Brauers</h1>
              <p className="text-xs font-black uppercase tracking-[0.3em] text-red-600">Logistics</p>
            </div>
          </div>
          <div className="text-right">
            <h2 className="text-xl font-black uppercase tracking-widest">Remito de Entrega</h2>
            <p className="text-sm font-bold mt-1">Fecha: {wppData.date.split('-').reverse().join('/')}</p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-8 mb-10">
          <div className="bg-gray-100 p-6 rounded-2xl">
            <span className="text-[10px] font-black uppercase text-gray-400 block mb-2 tracking-widest">Emisor</span>
            <p className="font-black text-lg uppercase italic">{settings.providerName}</p>
            <p className="text-sm font-bold text-gray-600 mt-1">CBU/Alias: {settings.aliasInfo}</p>
          </div>
          <div className="bg-gray-100 p-6 rounded-2xl border-l-4 border-red-600">
            <span className="text-[10px] font-black uppercase text-gray-400 block mb-2 tracking-widest">Cliente / Destino</span>
            <p className="font-black text-lg uppercase italic">{selectedLocation?.name || 'No especificado'}</p>
          </div>
        </div>

        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="border-b-2 border-black uppercase text-[10px] font-black tracking-widest">
              <th className="py-3 px-2">Código</th>
              <th className="py-3 px-2">Capacidad</th>
              <th className="py-3 px-2">Estilo</th>
              <th className="py-3 px-2 text-right">Precio</th>
            </tr>
          </thead>
          <tbody>
            {wppData.items.map((item, idx) => {
              const keg = kegs.find(k => k.id === item.kegId);
              return (
                <tr key={idx} className="border-b border-gray-200">
                  <td className="py-4 px-2 font-black">{keg?.code || '---'}</td>
                  <td className="py-4 px-2 font-bold">{keg?.capacity || '0'} L</td>
                  <td className="py-4 px-2 font-black text-red-600 uppercase italic">{item.style || '---'}</td>
                  <td className="py-4 px-2 text-right font-black">$ {item.price || '0'}</td>
                </tr>
              );
            })}
          </tbody>
        </table>

        <div className="mt-10 flex justify-end">
          <div className="bg-black text-white p-6 rounded-3xl min-w-[250px]">
            <div className="flex justify-between items-center border-t border-white/20 pt-4 mt-2">
              <span className="text-lg font-black uppercase italic">Total</span>
              <span className="text-3xl font-black">$ {totalPrice}</span>
            </div>
          </div>
        </div>
      </div>

      {/* APP UI */}
      <div className="w-full max-w-md bg-white min-h-screen relative shadow-2xl flex flex-col no-print">
        
        {/* HEADER */}
        <div className="bg-black text-white pt-10 pb-12 px-8 rounded-b-[40px] shadow-xl relative overflow-hidden">
          <div className="absolute top-0 right-0 w-32 h-32 bg-red-600/10 rounded-full -mr-16 -mt-16 blur-3xl"></div>
          <div className="relative flex items-center space-x-4">
            <div className="w-16 h-16 bg-white rounded-full overflow-hidden border-2 border-red-600 flex items-center justify-center p-1 shadow-lg">
              {logoUrl ? (
                <img src={logoUrl} alt="Logo" className="w-full h-full object-contain" />
              ) : (
                <div className="text-black font-black text-2xl italic">B</div>
              )}
            </div>
            <div>
              <h1 className="text-2xl font-black italic tracking-tighter uppercase leading-none">Brauers</h1>
              <div className="flex items-center space-x-2 mt-1">
                <div className="h-[2px] w-4 bg-red-600"></div>
                <span className="text-[10px] font-black tracking-[0.3em] text-red-500 uppercase">Logistics</span>
              </div>
            </div>
          </div>
        </div>

        <main className="flex-1 -mt-6 px-4 pb-32 overflow-y-auto relative">
          
          {showLogoAlert && (
            <div className="absolute top-4 left-4 right-4 z-[100] animate-in slide-in-from-top-4 duration-300">
              <div className="bg-red-600 text-white p-4 rounded-2xl shadow-xl flex items-center space-x-3 border-2 border-red-400">
                <AlertCircle size={24} />
                <p className="text-[10px] font-bold uppercase">Sube tu Logo en Perfil para generar el PDF.</p>
              </div>
            </div>
          )}

          {activeTab === 'whatsapp' && (
            <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
              <div className="flex items-center space-x-2 mb-4 ml-2">
                <div className="w-1.5 h-6 bg-red-600 rounded-full"></div>
                <h2 className="text-xl font-black text-gray-900 uppercase tracking-tighter">Nueva Bajada</h2>
              </div>

              <div className="bg-white p-6 rounded-[32px] shadow-xl border border-gray-100 space-y-6">
                <div>
                  <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest block mb-2 px-1">Bar / Evento</label>
                  <select 
                    className="w-full bg-gray-50 border-2 border-gray-100 rounded-2xl p-4 font-bold text-gray-800 outline-none focus:border-red-600 transition-all appearance-none"
                    value={wppData.locationId}
                    onChange={e => setWppData({...wppData, locationId: e.target.value})}
                  >
                    <option value="">Seleccionar destino...</option>
                    <optgroup label="Bares">
                      {locations.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
                    </optgroup>
                    <optgroup label="Eventos">
                      {events.map(e => <option key={e.id} value={e.id}>{e.name}</option>)}
                    </optgroup>
                  </select>
                </div>

                <div>
                  <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest block mb-2 px-1">Fecha de Operación</label>
                  <input 
                    type="date"
                    className="w-full bg-gray-50 border-2 border-gray-100 rounded-2xl p-4 font-bold text-gray-800 outline-none focus:border-red-600 transition-all"
                    value={wppData.date}
                    onChange={e => setWppData({...wppData, date: e.target.value})}
                  />
                </div>

                <div className="pt-2">
                  <div className="flex justify-between items-center mb-4">
                    <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest px-1">Detalle de Entrega</span>
                    <button onClick={addWppItem} className="bg-red-600 text-white px-4 py-2 rounded-xl text-[10px] font-black uppercase flex items-center shadow-lg active:scale-95 transition-transform">
                      <Plus size={14} className="mr-1" /> Añadir Fila
                    </button>
                  </div>

                  <div className="space-y-4">
                    {wppData.items.map(item => (
                      <div key={item.id} className="p-4 bg-gray-50 rounded-2xl border border-gray-100 relative group animate-in zoom-in-95 duration-200">
                        <button 
                          onClick={() => setWppData({...wppData, items: wppData.items.filter(i => i.id !== item.id)})} 
                          className="absolute -top-2 -right-2 bg-white text-red-600 p-1.5 rounded-full shadow-md border border-gray-100 hover:bg-red-600 hover:text-white transition-colors"
                        >
                          <X size={14} />
                        </button>
                        <select 
                          className="w-full bg-white border border-gray-200 rounded-xl p-3 text-sm font-black text-red-600 mb-3 outline-none"
                          value={item.kegId}
                          onChange={e => updateWppItem(item.id, 'kegId', e.target.value)}
                        >
                          <option value="">Seleccionar Barril...</option>
                          {kegs.filter(k => k.status === 'almacen').map(k => (
                            <option key={k.id} value={k.id}>{k.code} ({k.capacity}L)</option>
                          ))}
                        </select>
                        <div className="grid grid-cols-2 gap-2">
                          <select 
                            className="bg-white border border-gray-200 rounded-xl p-3 text-xs font-bold outline-none" 
                            value={item.style} 
                            onChange={e => updateWppItem(item.id, 'style', e.target.value)}
                          >
                            <option value="">Estilo...</option>
                            {styles.map(s => <option key={s} value={s}>{s}</option>)}
                          </select>
                          <input 
                            type="number" 
                            placeholder="Precio $" 
                            className="bg-white border border-gray-200 rounded-xl p-3 text-xs font-black outline-none" 
                            value={item.price} 
                            onChange={e => updateWppItem(item.id, 'price', e.target.value)} 
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {wppData.items.length > 0 && (
                  <div className="pt-4 border-t border-gray-100 space-y-3">
                    <div className="grid grid-cols-2 gap-3">
                      <button 
                        onClick={handleCopyMessage} 
                        className={`py-4 rounded-2xl font-black uppercase tracking-widest text-[10px] transition-all flex items-center justify-center space-x-2 shadow-lg ${isCopied ? 'bg-green-600 text-white' : 'bg-black text-white active:scale-95'}`}
                      >
                        {isCopied ? <CheckCircle2 size={16} /> : <MessageSquare size={16} />}
                        <span>{isCopied ? 'Copiado' : 'WhatsApp'}</span>
                      </button>
                      <button 
                        onClick={handlePrintPDF} 
                        className={`py-4 text-white rounded-2xl font-black uppercase tracking-widest text-[10px] active:scale-95 shadow-xl flex items-center justify-center space-x-2 transition-all ${!logoUrl ? 'bg-gray-400 grayscale' : 'bg-red-600 shadow-red-200'}`}
                      >
                        <FileText size={16} />
                        <span>Remito PDF</span>
                      </button>
                    </div>
                    <button 
                      onClick={handleFinalizeStock} 
                      className="w-full py-4 bg-gray-100 text-gray-500 rounded-2xl font-black uppercase tracking-widest text-[10px] border border-gray-200 hover:bg-red-50 hover:text-red-600 transition-colors active:scale-95"
                    >
                      Finalizar y descontar stock
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}

          {activeTab === 'home' && (
            <div className="space-y-6 pt-4 animate-in fade-in zoom-in-95 duration-300">
              <div className="flex items-center space-x-2 mb-2 ml-2">
                <div className="w-1.5 h-6 bg-red-600 rounded-full"></div>
                <h2 className="text-xl font-black text-gray-900 uppercase tracking-tighter">Dashboard</h2>
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <button 
                  onClick={() => setStatusFilter(statusFilter === 'almacen' ? null : 'almacen')}
                  className={`bg-white p-6 rounded-[32px] shadow-sm border-b-4 flex flex-col items-center group active:scale-95 transition-all ${statusFilter === 'almacen' ? 'border-red-600 ring-2 ring-red-100 shadow-md' : 'border-gray-100'}`}
                >
                  <Warehouse className={`h-6 w-6 mb-2 transition-colors ${statusFilter === 'almacen' ? 'text-red-600' : 'text-gray-400'}`} />
                  <span className="text-4xl font-black text-gray-900 tracking-tighter">{kegs.filter(k => k.status === 'almacen').length}</span>
                  <span className="text-[10px] font-black uppercase text-gray-400 mt-1 tracking-widest">En Fábrica</span>
                </button>
                
                <button 
                  onClick={() => setStatusFilter(statusFilter === 'entregado' ? null : 'entregado')}
                  className={`bg-white p-6 rounded-[32px] shadow-sm border-b-4 flex flex-col items-center group active:scale-95 transition-all ${statusFilter === 'entregado' ? 'border-black ring-2 ring-gray-100 shadow-md' : 'border-gray-100'}`}
                >
                  <Store className={`h-6 w-6 mb-2 transition-colors ${statusFilter === 'entregado' ? 'text-black' : 'text-red-600'}`} />
                  <span className="text-4xl font-black text-gray-900 tracking-tighter">{kegs.filter(k => k.status === 'entregado').length}</span>
                  <span className="text-[10px] font-black uppercase text-gray-400 mt-1 tracking-widest">Entregados</span>
                </button>
              </div>

              {statusFilter && (
                <div className="animate-in slide-in-from-top-4 duration-300">
                  <div className="flex items-center justify-between px-2 mb-3">
                    <span className="text-[10px] font-black uppercase text-gray-400 tracking-widest">
                      {statusFilter === 'almacen' ? 'Detalle: Stock en Fábrica' : 'Detalle: Barriles en Clientes'}
                    </span>
                    <button onClick={() => setStatusFilter(null)} className="text-[9px] font-black uppercase text-red-600 hover:bg-red-50 px-2 py-1 rounded-lg">Cerrar</button>
                  </div>
                  <div className="space-y-2 max-h-[300px] overflow-y-auto pr-2 custom-scrollbar">
                    {kegs.filter(k => k.status === statusFilter).length === 0 ? (
                      <div className="text-center py-10 bg-gray-50 rounded-3xl border-2 border-dashed border-gray-200">
                        <Info className="mx-auto text-gray-300 mb-2" size={24} />
                        <p className="text-[10px] font-black uppercase text-gray-400">No hay barriles en esta categoría</p>
                      </div>
                    ) : (
                      kegs.filter(k => k.status === statusFilter).map(k => (
                        <div key={k.id} className="bg-white p-4 rounded-2xl shadow-sm border border-gray-100 flex items-center justify-between">
                          <div className="flex items-center space-x-3">
                            <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${statusFilter === 'almacen' ? 'bg-gray-100' : 'bg-red-100'}`}>
                              <Beer size={14} className={statusFilter === 'almacen' ? 'text-gray-900' : 'text-red-600'} />
                            </div>
                            <div>
                              <p className="font-black text-sm">{k.code}</p>
                              <p className="text-[9px] font-bold text-gray-400 uppercase">{k.capacity} Litros</p>
                            </div>
                          </div>
                          {statusFilter === 'entregado' && (
                             <span className="text-[9px] font-black bg-black text-white px-2 py-1 rounded-full uppercase">
                                {allDestinations.find(d => d.id === k.locationId)?.name || 'Desconocido'}
                             </span>
                          )}
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}
            </div>
          )}

          {activeTab === 'kegs' && (
            <div className="pt-4 space-y-4 animate-in fade-in slide-in-from-right-4 duration-300">
              <div className="flex justify-between items-center px-2">
                <h2 className="text-xl font-black uppercase tracking-tighter">Stock de Barriles</h2>
                <button onClick={() => setShowAddKeg(true)} className="bg-black text-white p-2 rounded-xl active:scale-90 shadow-lg"><Plus size={20}/></button>
              </div>

              {showAddKeg && (
                <div className="bg-gray-900 p-6 rounded-[32px] text-white space-y-4 animate-in slide-in-from-top-4 duration-300 shadow-2xl">
                   <div className="flex justify-between items-center">
                    <span className="text-[10px] font-black uppercase tracking-widest text-red-500">Nuevo Barril</span>
                    <button onClick={() => setShowAddKeg(false)} className="hover:text-red-500 transition-colors"><X size={18} /></button>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <label className="text-[8px] font-black uppercase text-gray-500 ml-1">Código</label>
                      <input 
                        type="text" 
                        placeholder="B-00X" 
                        className="w-full bg-white/10 border border-white/20 rounded-xl p-3 text-sm font-black uppercase outline-none focus:border-red-600" 
                        value={newKeg.code} 
                        onChange={e => setNewKeg({...newKeg, code: e.target.value})} 
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[8px] font-black uppercase text-gray-500 ml-1">Capacidad (L)</label>
                      <input 
                        type="number" 
                        placeholder="Ej: 50" 
                        className="w-full bg-white/10 border border-white/20 rounded-xl p-3 text-sm font-black outline-none focus:border-red-600" 
                        value={newKeg.capacity} 
                        onChange={e => setNewKeg({...newKeg, capacity: e.target.value})}
                      />
                    </div>
                  </div>
                  <button onClick={addNewKeg} className="w-full py-4 bg-red-600 rounded-2xl font-black uppercase text-xs tracking-widest active:scale-95 transition-transform">Agregar al Inventario</button>
                </div>
              )}

              <div className="space-y-3 pb-20">
                {kegs.map(k => (
                  <div key={k.id} className="bg-white p-4 rounded-3xl shadow-sm border border-gray-100 flex items-center justify-between group">
                    <div className="flex items-center space-x-4">
                      <div className={`w-12 h-12 rounded-2xl flex items-center justify-center transition-colors ${k.status === 'almacen' ? 'bg-gray-100 text-gray-900' : 'bg-red-50 text-red-600'}`}>
                        <Beer size={20} />
                      </div>
                      <div>
                        <div className="flex items-center space-x-2">
                          <span className="font-black text-lg">{k.code}</span>
                          <span className="text-[10px] bg-black text-white px-2 py-0.5 rounded font-black">{k.capacity}L</span>
                        </div>
                        <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mt-0.5">
                          {k.status === 'almacen' ? 'Disponible en Fábrica' : `En ${allDestinations.find(l => l.id === k.locationId)?.name || 'Local'}`}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center space-x-2">
                      {k.status === 'entregado' && (
                        <button 
                          onClick={() => setKegs(kegs.map(item => item.id === k.id ? {...item, status: 'almacen', locationId: null} : item))}
                          className="p-2 text-gray-300 hover:text-green-600 transition-colors"
                        >
                          <Warehouse size={16} />
                        </button>
                      )}
                      <button onClick={() => setKegs(kegs.filter(item => item.id !== k.id))} className="p-2 text-gray-200 hover:text-red-600 transition-colors">
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {activeTab === 'settings' && (
            <div className="pt-4 space-y-6 animate-in fade-in slide-in-from-left-4 duration-300 pb-20">
              <div className="flex items-center space-x-2 mb-2 ml-2">
                <div className="w-1.5 h-6 bg-red-600 rounded-full"></div>
                <h2 className="text-xl font-black text-gray-900 uppercase tracking-tighter">Mi Perfil / Config</h2>
              </div>

              {/* DATOS EMISOR */}
              <div className="bg-white p-6 rounded-[32px] shadow-sm border border-gray-100 space-y-4">
                <div className="flex items-center space-x-2">
                   <User size={16} className="text-red-600" />
                   <span className="text-[10px] font-black uppercase text-gray-400 tracking-widest">Datos Comerciales</span>
                </div>
                <div className="space-y-3">
                  <input type="text" className="w-full bg-gray-50 border border-gray-200 rounded-xl p-3 font-bold text-sm outline-none focus:border-red-600" value={settings.providerName} onChange={e => setSettings({...settings, providerName: e.target.value})} placeholder="Nombre Proveedor" />
                  <input type="text" className="w-full bg-gray-50 border border-gray-200 rounded-xl p-3 font-bold text-sm outline-none focus:border-red-600" value={settings.aliasInfo} onChange={e => setSettings({...settings, aliasInfo: e.target.value})} placeholder="Datos de Pago (CBU/Alias)" />
                </div>
              </div>

              {/* GESTIÓN DE DESTINOS */}
              <div className="bg-white p-6 rounded-[32px] shadow-sm border border-gray-100 space-y-4">
                <div className="flex items-center space-x-2">
                   <MapPin size={16} className="text-red-600" />
                   <span className="text-[10px] font-black uppercase text-gray-400 tracking-widest">Mis Clientes / Bares / Eventos</span>
                </div>

                {!creationChoice ? (
                  <button 
                    onClick={() => setCreationChoice('select')}
                    className="w-full bg-black text-white p-4 rounded-xl font-black uppercase text-[10px] tracking-widest flex items-center justify-center space-x-2 active:scale-95 shadow-lg"
                  >
                    <PlusCircle size={18} />
                    <span>Agregar Nuevo Destino</span>
                  </button>
                ) : creationChoice === 'select' ? (
                  <div className="grid grid-cols-2 gap-2 animate-in zoom-in-95 duration-200">
                    <button 
                      onClick={() => setCreationChoice('bar')}
                      className="bg-gray-100 p-4 rounded-xl flex flex-col items-center justify-center space-y-2 border-2 border-transparent hover:border-red-600 transition-all"
                    >
                      <Store size={24} className="text-gray-900" />
                      <span className="text-[10px] font-black uppercase">Es un Bar</span>
                    </button>
                    <button 
                      onClick={() => setCreationChoice('event')}
                      className="bg-gray-100 p-4 rounded-xl flex flex-col items-center justify-center space-y-2 border-2 border-transparent hover:border-red-600 transition-all"
                    >
                      <Music size={24} className="text-gray-900" />
                      <span className="text-[10px] font-black uppercase">Es un Evento</span>
                    </button>
                  </div>
                ) : (
                  <div className="flex space-x-2 animate-in slide-in-from-top-2">
                    <input 
                      type="text" 
                      placeholder={creationChoice === 'bar' ? "Nombre del bar..." : "Nombre del evento..."}
                      className="flex-1 bg-gray-50 border-2 border-red-100 rounded-xl p-3 font-bold text-sm outline-none" 
                      value={creationChoice === 'bar' ? newLocationName : newEventName} 
                      onChange={e => creationChoice === 'bar' ? setNewLocationName(e.target.value) : setNewEventName(e.target.value)} 
                    />
                    <button onClick={creationChoice === 'bar' ? addLocation : addEvent} className="bg-red-600 text-white p-3 rounded-xl active:scale-95 shadow-md"><PlusCircle size={20} /></button>
                    <button onClick={() => setCreationChoice(null)} className="bg-gray-200 text-gray-500 p-3 rounded-xl"><X size={20}/></button>
                  </div>
                )}

                <div className="space-y-2">
                  <h4 className="text-[9px] font-black uppercase text-gray-300 tracking-tighter">Bares Registrados</h4>
                  {locations.map(loc => (
                    <div key={loc.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-xl border border-gray-100">
                      <div className="flex items-center space-x-2">
                        <Store size={14} className="text-gray-400" />
                        <span className="font-bold text-sm text-gray-700">{loc.name}</span>
                      </div>
                      <button onClick={() => removeLocation(loc.id)} className="text-gray-300 hover:text-red-600"><Trash2 size={16} /></button>
                    </div>
                  ))}
                </div>

                <div className="space-y-2 pt-2 border-t border-gray-50">
                  <h4 className="text-[9px] font-black uppercase text-gray-300 tracking-tighter">Eventos Activos</h4>
                  {events.map(ev => (
                    <div key={ev.id} className="flex items-center justify-between p-3 bg-red-50/30 rounded-xl border border-red-50">
                      <div className="flex items-center space-x-2">
                        <Music size={14} className="text-red-400" />
                        <span className="font-bold text-sm text-gray-700">{ev.name}</span>
                      </div>
                      <button onClick={() => removeEvent(ev.id)} className="text-gray-300 hover:text-red-600"><Trash2 size={16} /></button>
                    </div>
                  ))}
                </div>
              </div>

              {/* ESTILOS */}
              <div className="bg-white p-6 rounded-[32px] shadow-sm border border-gray-100 space-y-4">
                <div className="flex items-center space-x-2">
                   <Tag size={16} className="text-red-600" />
                   <span className="text-[10px] font-black uppercase text-gray-400 tracking-widest">Estilos Disponibles</span>
                </div>
                <div className="flex space-x-2">
                  <input type="text" placeholder="Nuevo estilo..." className="flex-1 bg-gray-50 border border-gray-200 rounded-xl p-3 font-bold text-sm outline-none" value={newStyleName} onChange={e => setNewStyleName(e.target.value)} />
                  <button onClick={addStyle} className="bg-black text-white p-3 rounded-xl active:scale-95 shadow-md"><PlusCircle size={20} /></button>
                </div>
                <div className="flex flex-wrap gap-2">
                  {styles.map(s => (
                    <div key={s} className="bg-gray-50 px-3 py-1.5 rounded-full flex items-center space-x-2 border border-gray-100">
                      <span className="text-[10px] font-black uppercase italic text-gray-600">{s}</span>
                      <button onClick={() => removeStyle(s)}><X size={12} className="text-gray-400 hover:text-red-600" /></button>
                    </div>
                  ))}
                </div>
              </div>

              {/* LOGO */}
              <div className="bg-white p-6 rounded-[32px] shadow-sm border border-gray-100 space-y-4">
                <div className="flex items-center space-x-2">
                   <Camera size={16} className="text-red-600" />
                   <span className="text-[10px] font-black uppercase text-gray-400 tracking-widest">Identidad Visual</span>
                </div>
                <div className="flex items-center space-x-4">
                  <div className="w-20 h-20 rounded-2xl border-2 border-dashed border-gray-200 flex items-center justify-center overflow-hidden bg-gray-50 relative group">
                    {logoUrl ? (
                      <>
                        <img src={logoUrl} className="w-full h-full object-contain" />
                        <button onClick={() => setLogoUrl(null)} className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                          <X className="text-white" />
                        </button>
                      </>
                    ) : (
                      <Camera size={24} className="text-gray-300" />
                    )}
                  </div>
                  <label className="flex-1 cursor-pointer">
                    <div className="bg-gray-50 border border-gray-200 rounded-xl p-4 flex flex-col items-center justify-center hover:bg-gray-100 transition-colors">
                      <Upload size={18} className="text-red-600 mb-1" />
                      <span className="text-[9px] font-black uppercase text-gray-500">Subir Logo PNG</span>
                    </div>
                    <input type="file" className="hidden" accept="image/*" onChange={handleImageUpload} />
                  </label>
                </div>
              </div>
            </div>
          )}

        </main>

        {/* NAVEGACIÓN INFERIOR */}
        <div className="fixed bottom-6 left-0 right-0 px-6 flex justify-center z-50 no-print">
          <div className="bg-black h-20 w-full max-w-sm rounded-[32px] shadow-2xl flex items-center justify-around px-4">
            <button 
              onClick={() => setActiveTab('home')} 
              className={`flex flex-col items-center space-y-1 transition-all ${activeTab === 'home' ? 'text-red-500 scale-110' : 'text-gray-500'}`}
            >
              <Home size={22} />
              <span className="text-[8px] font-black uppercase">Status</span>
            </button>
            <button 
              onClick={() => setActiveTab('kegs')} 
              className={`flex flex-col items-center space-y-1 transition-all ${activeTab === 'kegs' ? 'text-red-500 scale-110' : 'text-gray-500'}`}
            >
              <Warehouse size={22} />
              <span className="text-[8px] font-black uppercase">Stock</span>
            </button>
            
            <div className="relative -mt-12">
               <button 
                onClick={() => { setActiveTab('whatsapp'); setStatusFilter(null); }} 
                className={`w-16 h-16 rounded-full flex items-center justify-center shadow-2xl transition-all active:scale-90 ${activeTab === 'whatsapp' ? 'bg-red-600 text-white ring-4 ring-red-600/20' : 'bg-white text-black hover:bg-red-50'}`}
              >
                <Plus size={32} strokeWidth={3} />
              </button>
            </div>

            <button 
              onClick={() => { setActiveTab('settings'); setStatusFilter(null); }} 
              className={`flex flex-col items-center space-y-1 transition-all ${activeTab === 'settings' ? 'text-red-500 scale-110' : 'text-gray-500'}`}
            >
              <Settings size={22} />
              <span className="text-[8px] font-black uppercase">Perfil</span>
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}