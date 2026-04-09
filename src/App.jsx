import React, { useState, useEffect, useRef } from 'react';
import {
  Beer, MapPin, Home, Settings, Plus, Trash2, Warehouse, Store, X,
  Edit2, ChevronRight, User, CreditCard, PlusCircle, Camera, Upload,
  FileText, MessageSquare, CheckCircle2, Tag, AlertCircle, Calendar,
  Music, ChevronDown, Info, DollarSign, Clock, RotateCcw, LogOut,
  Phone, Search, QrCode, TrendingUp, History
} from 'lucide-react';
import QRCode from 'react-qr-code';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import { auth, db } from './firebase';
import { signInWithEmailAndPassword, signOut, onAuthStateChanged } from 'firebase/auth';
import {
  collection, doc, onSnapshot, setDoc, deleteDoc, addDoc, writeBatch, updateDoc,
  query, orderBy, limit
} from 'firebase/firestore';

// ── DATOS INICIALES (solo para la primera vez que un usuario se loguea) ──────
const INITIAL_STYLES = ['SCOTTISH ALE', 'IPA', 'HONEY', 'STOUT', 'BLONDE'];

export default function App() {
  // ── AUTH ─────────────────────────────────────────────────────────────────
  const [user, setUser]               = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [loginForm, setLoginForm]     = useState({ email: '', password: '' });
  const [loginError, setLoginError]   = useState('');
  const [loginLoading, setLoginLoading] = useState(false);

  // ── DATOS (poblados por Firestore onSnapshot) ─────────────────────────────
  const [kegs,      setKegs]      = useState([]);
  const [locations, setLocations] = useState([]);
  const [events,    setEvents]    = useState([]);
  const [styles,    setStyles]    = useState(INITIAL_STYLES);
  const [prices,    setPrices]    = useState([]);
  const [settings,  setSettings]  = useState({ providerName: 'Cerveza Brauers', aliasInfo: '' });

  // ── LOGO: sigue en localStorage (por dispositivo, no se sincroniza) ────────
  const [logoUrl, setLogoUrl] = useState(() => localStorage.getItem('brauers_logo') || null);
  useEffect(() => {
    if (logoUrl) localStorage.setItem('brauers_logo', logoUrl);
    else localStorage.removeItem('brauers_logo');
  }, [logoUrl]);

  // ── UI ────────────────────────────────────────────────────────────────────
  const [activeTab,      setActiveTab]      = useState('whatsapp');
  const [statusFilter,   setStatusFilter]   = useState(null);
  const [showAddKeg,     setShowAddKeg]     = useState(false);
  const [showLogoAlert,  setShowLogoAlert]  = useState(false);
  const [showAddPrice,   setShowAddPrice]   = useState(false);
  const [newKeg,         setNewKeg]         = useState({ code: '', capacity: '' });
  const [newLocationName,setNewLocationName]= useState('');
  const [newEventName,   setNewEventName]   = useState('');
  const [newStyleName,   setNewStyleName]   = useState('');
  const [newPrice,       setNewPrice]       = useState({ capacity: '', style: '', priceBar: '', priceEvent: '' });
  const [creationChoice, setCreationChoice] = useState(null);
  const [wppData,        setWppData]        = useState({
    locationId: '',
    date: new Date().toISOString().split('T')[0],
    items: []
  });
  const [isCopied,              setIsCopied]              = useState(false);
  const [isPriceCopied,         setIsPriceCopied]         = useState(null);
  const [isGeneratingPDF,       setIsGeneratingPDF]       = useState(false);
  const [isGeneratingPriceListPDF, setIsGeneratingPriceListPDF] = useState(false);
  const [editingPriceId,        setEditingPriceId]        = useState(null);
  const [editPriceForm,         setEditPriceForm]         = useState({ capacity: '', style: '', priceBar: '', priceEvent: '' });
  const [showOnboarding,        setShowOnboarding]        = useState(false);
  const [onboardingStep,        setOnboardingStep]        = useState(0);
  const [newLocationAddress,    setNewLocationAddress]    = useState('');
  const [newEventAddress,       setNewEventAddress]       = useState('');
  const [newLocationContact,    setNewLocationContact]    = useState('');
  const [newEventContact,       setNewEventContact]       = useState('');
  const [editingDestId,         setEditingDestId]         = useState(null);
  const [editingDestAddress,    setEditingDestAddress]    = useState('');
  const [editingDestContact,    setEditingDestContact]    = useState('');
  const [editingNoteKegId,      setEditingNoteKegId]      = useState(null);
  const [editingNoteValue,      setEditingNoteValue]      = useState('');
  const [kegSearch,             setKegSearch]             = useState('');
  const [qrKeg,                 setQrKeg]                 = useState(null);
  const [movements,             setMovements]             = useState([]);
  const [showMovements,         setShowMovements]         = useState(false);

  const settingsTimerRef = useRef(null);

  // ── LISTENER DE AUTH ──────────────────────────────────────────────────────
  useEffect(() => {
    return onAuthStateChanged(auth, (u) => {
      setUser(u);
      setAuthLoading(false);
      if (u) {
        const seen = localStorage.getItem(`brauers_onboarding_${u.uid}`);
        if (!seen) { setShowOnboarding(true); setOnboardingStep(0); }
      }
    });
  }, []);

  // ── LISTENERS DE FIRESTORE (activos solo cuando hay sesión) ───────────────
  useEffect(() => {
    if (!user) {
      setKegs([]); setLocations([]); setEvents([]);
      setStyles(INITIAL_STYLES); setPrices([]);
      setSettings({ providerName: 'Cerveza Brauers', aliasInfo: '' });
      setMovements([]);
      return;
    }

    const uid = user.uid;

    const unsubKegs = onSnapshot(
      collection(db, 'users', uid, 'kegs'),
      snap => setKegs(snap.docs.map(d => ({ id: d.id, ...d.data() })))
    );
    const unsubLocs = onSnapshot(
      collection(db, 'users', uid, 'locations'),
      snap => setLocations(snap.docs.map(d => ({ id: d.id, ...d.data() })))
    );
    const unsubEvents = onSnapshot(
      collection(db, 'users', uid, 'events'),
      snap => setEvents(snap.docs.map(d => ({ id: d.id, ...d.data() })))
    );
    const unsubConfig = onSnapshot(
      doc(db, 'users', uid, 'config', 'main'),
      snap => {
        if (snap.exists()) {
          const d = snap.data();
          setSettings({ providerName: d.providerName || 'Cerveza Brauers', aliasInfo: d.aliasInfo || '' });
          setStyles(d.styles || INITIAL_STYLES);
          setPrices(d.prices || []);
        } else {
          // Primera vez: inicializar config con defaults
          setDoc(doc(db, 'users', uid, 'config', 'main'), {
            providerName: 'Cerveza Brauers',
            aliasInfo: '',
            styles: INITIAL_STYLES,
            prices: []
          });
        }
      }
    );

    const unsubMovements = onSnapshot(
      query(collection(db, 'users', uid, 'movements'), orderBy('createdAt', 'desc'), limit(30)),
      snap => setMovements(snap.docs.map(d => ({ id: d.id, ...d.data() })))
    );

    return () => { unsubKegs(); unsubLocs(); unsubEvents(); unsubConfig(); unsubMovements(); };
  }, [user]);

  // ── AUTH HANDLERS ─────────────────────────────────────────────────────────
  const handleLogin = async (e) => {
    e.preventDefault();
    setLoginLoading(true);
    setLoginError('');
    try {
      await signInWithEmailAndPassword(auth, loginForm.email, loginForm.password);
    } catch {
      setLoginError('Email o contraseña incorrectos');
    } finally {
      setLoginLoading(false);
    }
  };

  const handleLogout = () => signOut(auth);

  // ── HELPERS ───────────────────────────────────────────────────────────────
  const daysSince = (dateStr) => {
    if (!dateStr) return null;
    return Math.floor((Date.now() - new Date(dateStr).getTime()) / (1000 * 60 * 60 * 24));
  };
  const ALERT_DAYS = 7;

  const allDestinations = [...locations, ...events];
  const selectedLocation = allDestinations.find(l => l.id === wppData.locationId);
  const totalPrice = wppData.items.reduce((sum, i) => sum + (Number(i.price) || 0), 0);

  // ── CONFIG (styles, prices, settings) ────────────────────────────────────
  const configRef = () => doc(db, 'users', user.uid, 'config', 'main');

  const handleSettingsChange = (newSettings) => {
    setSettings(newSettings);
    if (settingsTimerRef.current) clearTimeout(settingsTimerRef.current);
    settingsTimerRef.current = setTimeout(() => {
      updateDoc(configRef(), {
        providerName: newSettings.providerName,
        aliasInfo: newSettings.aliasInfo
      }).catch(() => {});
    }, 800);
  };

  const addStyle = async () => {
    if (!newStyleName.trim()) return;
    const styleUp = newStyleName.toUpperCase();
    if (!styles.includes(styleUp)) {
      await updateDoc(configRef(), { styles: [...styles, styleUp] });
    }
    setNewStyleName('');
  };

  const removeStyle = (styleName) =>
    updateDoc(configRef(), { styles: styles.filter(s => s !== styleName) });

  const addPrice = async () => {
    if (!newPrice.capacity || !newPrice.style || !newPrice.priceBar || !newPrice.priceEvent) return;
    const entry = {
      id: Date.now().toString(),
      capacity: Number(newPrice.capacity),
      style: newPrice.style,
      priceBar: Number(newPrice.priceBar),
      priceEvent: Number(newPrice.priceEvent)
    };
    await updateDoc(configRef(), { prices: [...prices, entry] });
    setNewPrice({ capacity: '', style: '', priceBar: '', priceEvent: '' });
    setShowAddPrice(false);
  };

  const removePrice = (id) =>
    updateDoc(configRef(), { prices: prices.filter(p => p.id !== id) });

  const startEditPrice = (p) => {
    setEditingPriceId(p.id);
    setEditPriceForm({ capacity: String(p.capacity), style: p.style, priceBar: String(p.priceBar), priceEvent: String(p.priceEvent) });
  };

  const saveEditPrice = async () => {
    if (!editPriceForm.capacity || !editPriceForm.style || !editPriceForm.priceBar || !editPriceForm.priceEvent) return;
    const updated = prices.map(p => p.id === editingPriceId ? {
      ...p,
      capacity: Number(editPriceForm.capacity),
      style: editPriceForm.style,
      priceBar: Number(editPriceForm.priceBar),
      priceEvent: Number(editPriceForm.priceEvent)
    } : p);
    await updateDoc(configRef(), { prices: updated });
    setEditingPriceId(null);
  };

  // ── KEGS ──────────────────────────────────────────────────────────────────
  const addNewKeg = async () => {
    if (!newKeg.code || !newKeg.capacity) return;
    await addDoc(collection(db, 'users', user.uid, 'kegs'), {
      code: newKeg.code.toUpperCase(),
      capacity: Number(newKeg.capacity),
      status: 'almacen',
      locationId: null,
      deliveredAt: null
    });
    setNewKeg({ code: '', capacity: '' });
    setShowAddKeg(false);
  };

  const deleteKeg = (kegId) =>
    deleteDoc(doc(db, 'users', user.uid, 'kegs', kegId));

  const returnKeg = async (kegId) => {
    const keg = kegs.find(k => k.id === kegId);
    const dest = allDestinations.find(l => l.id === keg?.locationId);
    await updateDoc(doc(db, 'users', user.uid, 'kegs', kegId), {
      status: 'almacen', locationId: null, deliveredAt: null
    });
    if (keg) {
      await addDoc(collection(db, 'users', user.uid, 'movements'), {
        kegId, kegCode: keg.code, kegCapacity: keg.capacity,
        type: 'return',
        destinationId: keg.locationId || null,
        destinationName: dest?.name || 'Desconocido',
        date: new Date().toISOString().split('T')[0],
        createdAt: new Date().toISOString()
      });
    }
  };

  const saveKegNote = async (kegId) => {
    await updateDoc(doc(db, 'users', user.uid, 'kegs', kegId), { notes: editingNoteValue });
    setEditingNoteKegId(null);
    setEditingNoteValue('');
  };

  const handleFinalizeStock = async () => {
    const deliveredIds = wppData.items.map(i => i.kegId).filter(id => id !== '');
    if (deliveredIds.length === 0) return;
    const today = new Date().toISOString().split('T')[0];
    const dest = allDestinations.find(l => l.id === wppData.locationId);
    const batch = writeBatch(db);
    deliveredIds.forEach(kegId => {
      batch.update(doc(db, 'users', user.uid, 'kegs', kegId), {
        status: 'entregado',
        locationId: wppData.locationId,
        deliveredAt: today
      });
    });
    await batch.commit();
    // Log movements
    for (const kegId of deliveredIds) {
      const keg = kegs.find(k => k.id === kegId);
      if (keg) {
        await addDoc(collection(db, 'users', user.uid, 'movements'), {
          kegId, kegCode: keg.code, kegCapacity: keg.capacity,
          type: 'delivery',
          destinationId: wppData.locationId,
          destinationName: dest?.name || 'Desconocido',
          date: wppData.date,
          createdAt: new Date().toISOString()
        });
      }
    }
    setWppData({ ...wppData, items: [] });
    setStatusFilter(null);
  };

  // ── LOCATIONS / EVENTS ────────────────────────────────────────────────────
  const addLocation = async () => {
    if (!newLocationName.trim()) return;
    await addDoc(collection(db, 'users', user.uid, 'locations'), {
      name: newLocationName, address: newLocationAddress.trim(), contact: newLocationContact.trim()
    });
    setNewLocationName(''); setNewLocationAddress(''); setNewLocationContact('');
    setCreationChoice(null);
  };

  const addEvent = async () => {
    if (!newEventName.trim()) return;
    await addDoc(collection(db, 'users', user.uid, 'events'), {
      name: newEventName, address: newEventAddress.trim(), contact: newEventContact.trim()
    });
    setNewEventName(''); setNewEventAddress(''); setNewEventContact('');
    setCreationChoice(null);
  };

  const removeLocation = (id) =>
    deleteDoc(doc(db, 'users', user.uid, 'locations', id));

  const removeEvent = (id) =>
    deleteDoc(doc(db, 'users', user.uid, 'events', id));

  const saveDestAddress = async (type, id) => {
    const collName = type === 'location' ? 'locations' : 'events';
    await updateDoc(doc(db, 'users', user.uid, collName, id), { address: editingDestAddress });
    setEditingDestId(null); setEditingDestAddress('');
  };

  const saveDestContact = async (type, id) => {
    const collName = type === 'location' ? 'locations' : 'events';
    await updateDoc(doc(db, 'users', user.uid, collName, id), { contact: editingDestContact });
    setEditingDestId(null); setEditingDestContact('');
  };

  const finishOnboarding = () => {
    localStorage.setItem(`brauers_onboarding_${user.uid}`, '1');
    setShowOnboarding(false);
  };

  // ── LOGO ──────────────────────────────────────────────────────────────────
  const handleImageUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onloadend = () => setLogoUrl(reader.result);
    reader.readAsDataURL(file);
  };

  // ── BAJADA (FORM LOCAL) ───────────────────────────────────────────────────
  const addWppItem = () => {
    setWppData({
      ...wppData,
      items: [...wppData.items, { id: Date.now(), kegId: '', style: '', price: '' }]
    });
  };

  const updateWppItem = (id, field, value) => {
    const updatedItems = wppData.items.map(item => {
      if (item.id !== id) return item;
      const updated = { ...item, [field]: value };
      if (field === 'kegId' || field === 'style') {
        const kegId = field === 'kegId' ? value : item.kegId;
        const style = field === 'style' ? value : item.style;
        const keg = kegs.find(k => k.id === kegId);
        if (keg && style && wppData.locationId) {
          const isEvent = events.some(e => e.id === wppData.locationId);
          const priceEntry = prices.find(p => p.capacity === keg.capacity && p.style === style);
          if (priceEntry) updated.price = String(isEvent ? priceEntry.priceEvent : priceEntry.priceBar);
        }
      }
      return updated;
    });
    setWppData({ ...wppData, items: updatedItems });
  };

  // ── GENERAR TEXTO WHATSAPP ────────────────────────────────────────────────
  const generateText = () => {
    const bar = locations.find(l => l.id === wppData.locationId)?.name
              || events.find(e => e.id === wppData.locationId)?.name
              || '_______';
    const isEvent = events.some(e => e.id === wppData.locationId);
    const destType = isEvent ? 'Evento' : 'Bar';
    const date = wppData.date.split('-').reverse().join('/');
    let total = 0;
    const itemsStr = wppData.items.map(item => {
      const keg = kegs.find(k => k.id === item.kegId);
      const p = Number(item.price) || 0;
      total += p;
      return `Barril de ${keg?.capacity || '??'}L ${item.style || 'CERVEZA'} (${destType}) $${p.toLocaleString('es-AR')}`;
    }).join('\n');
    return `Local/Evento: *${bar}*\nProveedor: *${settings.providerName}*\n\nBajada del ${date}:\n${itemsStr}\n\nTotal: $${total.toLocaleString('es-AR')}\n\nAlias: ${settings.aliasInfo}`;
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

  // ── PDF REMITO ────────────────────────────────────────────────────────────
  const handleGeneratePDF = async () => {
    if (!logoUrl) {
      setShowLogoAlert(true);
      setTimeout(() => setShowLogoAlert(false), 4000);
      return;
    }
    setIsGeneratingPDF(true);
    try {
      const element = document.getElementById('print-section');
      const canvas = await html2canvas(element, { scale: 2, useCORS: true, backgroundColor: '#ffffff' });
      const imgWidth = 210;
      const imgHeight = (canvas.height * imgWidth) / canvas.width;
      const pdf = new jsPDF('p', 'mm', 'a4');
      pdf.addImage(canvas.toDataURL('image/png'), 'PNG', 0, 0, imgWidth, imgHeight);
      const fileName = `remito-${wppData.date}.pdf`;
      const blob = pdf.output('blob');
      if (navigator.share && navigator.canShare) {
        const file = new File([blob], fileName, { type: 'application/pdf' });
        if (navigator.canShare({ files: [file] })) {
          await navigator.share({ files: [file], title: 'Remito de Entrega' });
          return;
        }
      }
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = fileName; a.click();
      URL.revokeObjectURL(url);
    } finally {
      setIsGeneratingPDF(false);
    }
  };

  // ── LISTA DE PRECIOS ──────────────────────────────────────────────────────
  const generatePriceListText = (type) => {
    const label = type === 'bar' ? 'Bares' : 'Eventos';
    const items = prices.map(p => {
      const price = type === 'bar' ? p.priceBar : p.priceEvent;
      return `Barril de ${p.capacity}L ${p.style} → $${price.toLocaleString('es-AR')}`;
    }).join('\n');
    return `🍺 *${settings.providerName} — Precios ${label}*\n\n${items}\n\n💳 Alias: ${settings.aliasInfo}`;
  };

  const handleCopyPriceList = (type) => {
    const text = generatePriceListText(type);
    const el = document.createElement('textarea');
    el.value = text;
    document.body.appendChild(el);
    el.select();
    document.execCommand('copy');
    document.body.removeChild(el);
    setIsPriceCopied(type);
    setTimeout(() => setIsPriceCopied(null), 2000);
  };

  const handleGeneratePriceListPDF = async (type) => {
    setIsGeneratingPriceListPDF(true);
    try {
      const label = type === 'bar' ? 'Bares' : 'Eventos';
      const pdf = new jsPDF('p', 'mm', 'a4');
      pdf.setFontSize(20); pdf.setFont('helvetica', 'bold');
      pdf.text(`${settings.providerName}`, 20, 28);
      pdf.setFontSize(11); pdf.setFont('helvetica', 'normal');
      pdf.setTextColor(180, 0, 0);
      pdf.text(`Lista de Precios — ${label}`, 20, 37);
      pdf.setTextColor(0, 0, 0);
      pdf.setFontSize(9);
      pdf.text(new Date().toLocaleDateString('es-AR'), 20, 44);
      pdf.setDrawColor(200, 0, 0); pdf.setLineWidth(0.8);
      pdf.line(20, 49, 190, 49);
      let y = 62;
      pdf.setFontSize(8); pdf.setFont('helvetica', 'bold');
      pdf.setTextColor(150, 150, 150);
      pdf.text('CAPACIDAD', 20, y); pdf.text('ESTILO', 70, y); pdf.text('PRECIO', 170, y, { align: 'right' });
      pdf.setTextColor(0, 0, 0); pdf.setLineWidth(0.3); pdf.setDrawColor(220, 220, 220);
      pdf.line(20, y + 3, 190, y + 3);
      y += 14;
      pdf.setFontSize(11);
      prices.forEach((p, i) => {
        const price = type === 'bar' ? p.priceBar : p.priceEvent;
        if (i % 2 === 0) { pdf.setFillColor(248, 248, 248); pdf.rect(18, y - 7, 174, 12, 'F'); }
        pdf.setFont('helvetica', 'bold'); pdf.text(`${p.capacity}L`, 20, y);
        pdf.setFont('helvetica', 'normal'); pdf.text(p.style, 70, y);
        pdf.setFont('helvetica', 'bold'); pdf.text(`$${price.toLocaleString('es-AR')}`, 170, y, { align: 'right' });
        y += 13;
      });
      pdf.setFontSize(9); pdf.setFont('helvetica', 'normal'); pdf.setTextColor(120, 120, 120);
      pdf.text(`Alias de pago: ${settings.aliasInfo}`, 20, y + 16);
      const fileName = `precios-${type === 'bar' ? 'bares' : 'eventos'}.pdf`;
      const blob = pdf.output('blob');
      if (navigator.share && navigator.canShare) {
        const file = new File([blob], fileName, { type: 'application/pdf' });
        if (navigator.canShare({ files: [file] })) {
          await navigator.share({ files: [file], title: `Lista de Precios ${label}` });
          return;
        }
      }
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = fileName; a.click();
      URL.revokeObjectURL(url);
    } finally {
      setIsGeneratingPriceListPDF(false);
    }
  };

  // ── ESTADÍSTICAS (computed) ───────────────────────────────────────────────
  const nowDate = new Date();
  const thisMonthStr = `${nowDate.getFullYear()}-${String(nowDate.getMonth() + 1).padStart(2, '0')}`;
  const deliveriesThisMonth = movements.filter(m => m.type === 'delivery' && m.date?.startsWith(thisMonthStr)).length;
  const destCounts = movements.filter(m => m.type === 'delivery').reduce((acc, m) => {
    if (m.destinationName) acc[m.destinationName] = (acc[m.destinationName] || 0) + 1;
    return acc;
  }, {});
  const topDest = Object.entries(destCounts).sort((a, b) => b[1] - a[1])[0]?.[0] || '—';
  const deliveredKegsOut = kegs.filter(k => k.status === 'entregado' && k.deliveredAt);
  const avgDaysOut = deliveredKegsOut.length > 0
    ? Math.round(deliveredKegsOut.reduce((sum, k) => sum + (daysSince(k.deliveredAt) || 0), 0) / deliveredKegsOut.length)
    : 0;

  // ── LOADING SCREEN ────────────────────────────────────────────────────────
  if (authLoading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-5xl font-black italic uppercase tracking-tighter text-white leading-none">Brauers</h1>
          <p className="text-red-600 text-[10px] font-black uppercase tracking-[0.3em] mt-2">Logistics</p>
        </div>
      </div>
    );
  }

  // ── LOGIN SCREEN ──────────────────────────────────────────────────────────
  if (!user) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center p-6">
        <div className="w-full max-w-sm">
          <div className="text-center mb-10">
            <h1 className="text-5xl font-black italic uppercase tracking-tighter text-white leading-none">Brauers</h1>
            <div className="flex items-center justify-center space-x-2 mt-2">
              <div className="h-[2px] w-6 bg-red-600"></div>
              <span className="text-[10px] font-black tracking-[0.3em] text-red-500 uppercase">Logistics</span>
              <div className="h-[2px] w-6 bg-red-600"></div>
            </div>
          </div>
          <form onSubmit={handleLogin} className="space-y-4">
            <input
              type="email"
              placeholder="Email"
              required
              className="w-full bg-white/10 border border-white/20 text-white rounded-2xl p-4 font-bold text-sm outline-none focus:border-red-600 transition-all placeholder:text-gray-500"
              value={loginForm.email}
              onChange={e => setLoginForm({ ...loginForm, email: e.target.value })}
            />
            <input
              type="password"
              placeholder="Contraseña"
              required
              className="w-full bg-white/10 border border-white/20 text-white rounded-2xl p-4 font-bold text-sm outline-none focus:border-red-600 transition-all placeholder:text-gray-500"
              value={loginForm.password}
              onChange={e => setLoginForm({ ...loginForm, password: e.target.value })}
            />
            {loginError && (
              <p className="text-red-500 text-[10px] font-bold uppercase text-center tracking-wide">{loginError}</p>
            )}
            <button
              type="submit"
              disabled={loginLoading}
              className="w-full bg-red-600 text-white py-4 rounded-2xl font-black uppercase tracking-widest text-sm active:scale-95 transition-transform disabled:opacity-50"
            >
              {loginLoading ? 'Ingresando...' : 'Ingresar'}
            </button>
          </form>
        </div>
      </div>
    );
  }

  // ── APP PRINCIPAL ─────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-gray-50 flex justify-center font-sans overflow-x-hidden">

      {/* SECCIÓN DE IMPRESIÓN — fuera de pantalla para html2canvas */}
      <div id="print-section" className="text-black" style={{ position: 'absolute', left: '-9999px', top: 0, width: '794px', padding: '40px', background: 'white' }}>
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

      {/* ONBOARDING OVERLAY */}
      {showOnboarding && (() => {
        const steps = [
          { Icon: Beer,      bg: 'bg-red-600',   title: '¡Bienvenido a Brauers!',   desc: 'Tu central de operaciones para barriles. En 5 pasos te mostramos todo lo que podés hacer.' },
          { Icon: Home,      bg: 'bg-gray-900',  title: 'Dashboard de Estado',       desc: 'Mirá de un vistazo cuántos barriles tenés en fábrica y cuántos están en clientes. Te alertamos automáticamente si alguno lleva más de 7 días afuera.' },
          { Icon: Warehouse, bg: 'bg-gray-800',  title: 'Stock de Barriles',         desc: 'Registrá cada barril con su código y capacidad. El estado se sincroniza en tiempo real desde cualquier dispositivo.' },
          { Icon: Plus,      bg: 'bg-red-600',   title: 'Nueva Bajada',              desc: 'El botón central (+) es para registrar entregas. Seleccionás el destino, los barriles y generás el mensaje de WhatsApp y el remito PDF al instante.' },
          { Icon: Tag,       bg: 'bg-black',     title: 'Lista de Precios',          desc: 'Cargá tus tarifas diferenciadas por Bar y Evento. Al hacer una bajada, el precio se completa solo según el barril y el destino.' },
          { Icon: Settings,  bg: 'bg-gray-700',  title: 'Configuración',             desc: 'Registrá tus bares y eventos (con dirección), configurá tu alias de pago y subí tu logo para los remitos PDF.' },
        ];
        const step = steps[onboardingStep];
        const isLast = onboardingStep === steps.length - 1;
        const { Icon, bg, title, desc } = step;
        return (
          <div className="fixed inset-0 z-[200] flex items-end justify-center p-4 pb-8 no-print" style={{ background: 'rgba(0,0,0,0.88)' }}>
            <div className="w-full max-w-sm bg-white rounded-[40px] p-7 space-y-6 animate-in slide-in-from-bottom-6 duration-400 shadow-2xl">
              {/* Progress dots */}
              <div className="flex justify-center space-x-2">
                {steps.map((_, i) => (
                  <div key={i} className={`h-2 rounded-full transition-all duration-300 ${i === onboardingStep ? 'w-6 bg-red-600' : i < onboardingStep ? 'w-2 bg-red-300' : 'w-2 bg-gray-200'}`} />
                ))}
              </div>
              {/* Icon */}
              <div className="flex justify-center">
                <div className={`w-20 h-20 ${bg} rounded-3xl flex items-center justify-center shadow-lg`}>
                  <Icon size={36} className="text-white" strokeWidth={2} />
                </div>
              </div>
              {/* Text */}
              <div className="text-center space-y-2 px-2">
                <h2 className="text-xl font-black uppercase tracking-tighter text-gray-900">{title}</h2>
                <p className="text-gray-500 text-sm leading-relaxed">{desc}</p>
              </div>
              {/* Actions */}
              <div className="flex items-center justify-between pt-1">
                <button onClick={finishOnboarding} className="text-[10px] font-black uppercase text-gray-300 hover:text-gray-500 transition-colors px-2 py-2">
                  Omitir
                </button>
                <div className="flex space-x-2">
                  {onboardingStep > 0 && (
                    <button onClick={() => setOnboardingStep(s => s - 1)} className="bg-gray-100 text-gray-600 px-5 py-3 rounded-2xl font-black uppercase text-[10px] tracking-widest active:scale-95">
                      ←
                    </button>
                  )}
                  <button onClick={() => isLast ? finishOnboarding() : setOnboardingStep(s => s + 1)} className="bg-black text-white px-7 py-3 rounded-2xl font-black uppercase text-[10px] tracking-widest active:scale-95 shadow-lg">
                    {isLast ? 'Comenzar' : 'Siguiente →'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        );
      })()}

      {/* APP UI */}
      <div className="w-full max-w-md bg-white min-h-screen relative shadow-2xl flex flex-col no-print">

        {/* HEADER */}
        <div className="bg-black text-white pt-12 pb-10 px-6 rounded-b-[36px] shadow-xl relative overflow-hidden z-10">
          <div className="absolute top-0 right-0 w-40 h-40 bg-red-600/10 rounded-full -mr-20 -mt-20 blur-3xl pointer-events-none"></div>
          <div className="absolute bottom-0 left-0 w-24 h-24 bg-red-900/20 rounded-full -ml-12 -mb-12 blur-2xl pointer-events-none"></div>
          <div className="relative flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="w-14 h-14 bg-white rounded-2xl overflow-hidden border-2 border-red-600/60 flex items-center justify-center p-1 shadow-lg">
                {logoUrl
                  ? <img src={logoUrl} alt="Logo" className="w-full h-full object-contain" />
                  : <div className="text-black font-black text-xl italic">B</div>
                }
              </div>
              <div>
                <h1 className="text-xl font-black italic tracking-tighter uppercase leading-none">Brauers</h1>
                <div className="flex items-center space-x-1.5 mt-0.5">
                  <div className="h-[2px] w-3 bg-red-600"></div>
                  <span className="text-[9px] font-black tracking-[0.3em] text-red-500 uppercase">Logistics</span>
                </div>
              </div>
            </div>
            <div className="text-right">
              <p className="text-[8px] font-black uppercase text-gray-600 tracking-widest">{user?.email?.split('@')[0]}</p>
              <p className="text-[7px] text-gray-700 mt-0.5">Sesión activa</p>
            </div>
          </div>
        </div>

        <main className="flex-1 -mt-4 px-4 pb-28 overflow-y-auto relative">

          {showLogoAlert && (
            <div className="absolute top-4 left-4 right-4 z-[100] animate-in slide-in-from-top-4 duration-300">
              <div className="bg-red-600 text-white p-4 rounded-2xl shadow-xl flex items-center space-x-3 border-2 border-red-400">
                <AlertCircle size={24} />
                <p className="text-[10px] font-bold uppercase">Sube tu Logo en Perfil para generar el PDF.</p>
              </div>
            </div>
          )}

          {/* ── TAB: BAJADA + LISTA DE PRECIOS ─────────────────────────────── */}
          {activeTab === 'whatsapp' && (
            <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 space-y-5 pt-4">
              <div className="flex items-center space-x-2 mb-2 ml-2">
                <div className="w-1.5 h-6 bg-red-600 rounded-full"></div>
                <h2 className="text-xl font-black text-gray-900 uppercase tracking-tighter">Nueva Bajada</h2>
              </div>

              <div className="bg-white p-5 rounded-[28px] shadow-lg border border-gray-100 space-y-5">
                <div>
                  <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest block mb-2 px-1">Bar / Evento</label>
                  <div className="flex items-center space-x-2">
                    <select
                      className="flex-1 bg-gray-50 border-2 border-gray-100 rounded-2xl p-4 font-bold text-gray-800 outline-none focus:border-red-600 transition-all appearance-none"
                      value={wppData.locationId}
                      onChange={e => setWppData({ ...wppData, locationId: e.target.value })}
                    >
                      <option value="">Seleccionar destino...</option>
                      <optgroup label="Bares">
                        {locations.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
                      </optgroup>
                      <optgroup label="Eventos">
                        {events.map(e => <option key={e.id} value={e.id}>{e.name}</option>)}
                      </optgroup>
                    </select>
                    {selectedLocation?.contact && (
                      <a
                        href={`https://wa.me/${selectedLocation.contact.replace(/\D/g, '')}`}
                        target="_blank" rel="noopener noreferrer"
                        className="shrink-0 w-14 h-14 bg-green-500 text-white rounded-2xl flex items-center justify-center shadow-lg active:scale-90 transition-transform"
                      >
                        <Phone size={22} />
                      </a>
                    )}
                  </div>
                </div>

                <div>
                  <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest block mb-2 px-1">Fecha de Operación</label>
                  <input
                    type="date"
                    className="w-full bg-gray-50 border-2 border-gray-100 rounded-2xl p-4 font-bold text-gray-800 outline-none focus:border-red-600 transition-all"
                    value={wppData.date}
                    onChange={e => setWppData({ ...wppData, date: e.target.value })}
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
                          onClick={() => setWppData({ ...wppData, items: wppData.items.filter(i => i.id !== item.id) })}
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
                        onClick={handleGeneratePDF}
                        disabled={isGeneratingPDF}
                        className={`py-4 text-white rounded-2xl font-black uppercase tracking-widest text-[10px] active:scale-95 shadow-xl flex items-center justify-center space-x-2 transition-all ${!logoUrl || isGeneratingPDF ? 'bg-gray-400 grayscale' : 'bg-red-600 shadow-red-200'}`}
                      >
                        <FileText size={16} />
                        <span>{isGeneratingPDF ? 'Generando...' : 'Remito PDF'}</span>
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

              {/* LISTA DE PRECIOS (solo vista — gestión en pestaña Precios) */}
              <div>
                <div className="flex items-center justify-between mb-4 ml-2 mr-1">
                  <div className="flex items-center space-x-2">
                    <div className="w-1.5 h-6 bg-gray-300 rounded-full"></div>
                    <h2 className="text-xl font-black text-gray-900 uppercase tracking-tighter">Lista de Precios</h2>
                  </div>
                  <button
                    onClick={() => setActiveTab('prices')}
                    className="flex items-center space-x-1 text-[9px] font-black uppercase text-red-600 bg-red-50 hover:bg-red-100 px-3 py-1.5 rounded-xl transition-colors"
                  >
                    <span>Gestionar</span>
                    <ChevronRight size={12} />
                  </button>
                </div>
                {prices.length === 0 ? (
                  <div className="bg-white p-8 rounded-[32px] shadow-xl border border-gray-100 text-center space-y-3">
                    <DollarSign size={32} className="mx-auto text-gray-200" />
                    <p className="text-[10px] font-black uppercase text-gray-400">Sin precios cargados</p>
                    <button onClick={() => setActiveTab('prices')} className="text-[10px] font-black text-red-600 underline underline-offset-2">Ir a Lista de Precios →</button>
                  </div>
                ) : (
                  <div className="bg-white p-6 rounded-[32px] shadow-xl border border-gray-100 space-y-5">
                    <div className="space-y-2">
                      {prices.map(p => (
                        <div key={p.id} className="flex items-center justify-between py-2 border-b border-gray-50 last:border-0">
                          <span className="font-bold text-sm text-gray-700">{p.capacity}L <span className="text-red-600 italic font-black">{p.style}</span></span>
                          <div className="flex space-x-4">
                            <div className="text-right">
                              <div className="text-[8px] font-black uppercase text-gray-400">Bar</div>
                              <div className="text-xs font-black text-gray-800">${p.priceBar.toLocaleString('es-AR')}</div>
                            </div>
                            <div className="text-right">
                              <div className="text-[8px] font-black uppercase text-gray-400">Evento</div>
                              <div className="text-xs font-black text-gray-800">${p.priceEvent.toLocaleString('es-AR')}</div>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                    <div className="border-t border-gray-100 pt-4 space-y-2">
                      <p className="text-[8px] font-black uppercase text-gray-400 tracking-widest px-1">Compartir</p>
                      <div className="grid grid-cols-2 gap-2">
                        <button onClick={() => handleCopyPriceList('bar')} className={`py-3 rounded-2xl font-black uppercase tracking-widest text-[10px] flex items-center justify-center space-x-2 transition-all active:scale-95 shadow-sm ${isPriceCopied === 'bar' ? 'bg-green-600 text-white' : 'bg-black text-white'}`}>
                          {isPriceCopied === 'bar' ? <CheckCircle2 size={14} /> : <MessageSquare size={14} />}
                          <span>{isPriceCopied === 'bar' ? 'Copiado' : 'WPP Bares'}</span>
                        </button>
                        <button onClick={() => handleCopyPriceList('event')} className={`py-3 rounded-2xl font-black uppercase tracking-widest text-[10px] flex items-center justify-center space-x-2 transition-all active:scale-95 shadow-sm ${isPriceCopied === 'event' ? 'bg-green-600 text-white' : 'bg-gray-800 text-white'}`}>
                          {isPriceCopied === 'event' ? <CheckCircle2 size={14} /> : <MessageSquare size={14} />}
                          <span>{isPriceCopied === 'event' ? 'Copiado' : 'WPP Eventos'}</span>
                        </button>
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <button onClick={() => handleGeneratePriceListPDF('bar')} disabled={isGeneratingPriceListPDF} className={`py-3 rounded-2xl font-black uppercase tracking-widest text-[10px] flex items-center justify-center space-x-2 transition-all active:scale-95 border-2 ${isGeneratingPriceListPDF ? 'bg-gray-100 text-gray-400 border-gray-200' : 'bg-white text-red-600 border-red-200 hover:bg-red-50'}`}>
                          <FileText size={14} /><span>PDF Bares</span>
                        </button>
                        <button onClick={() => handleGeneratePriceListPDF('event')} disabled={isGeneratingPriceListPDF} className={`py-3 rounded-2xl font-black uppercase tracking-widest text-[10px] flex items-center justify-center space-x-2 transition-all active:scale-95 border-2 ${isGeneratingPriceListPDF ? 'bg-gray-100 text-gray-400 border-gray-200' : 'bg-white text-red-600 border-red-200 hover:bg-red-50'}`}>
                          <FileText size={14} /><span>PDF Eventos</span>
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ── TAB: DASHBOARD ──────────────────────────────────────────────── */}
          {activeTab === 'home' && (
            <div className="space-y-4 pt-4 animate-in fade-in zoom-in-95 duration-300 pb-4">
              <div className="flex items-center space-x-2 mb-2 ml-2">
                <div className="w-1.5 h-6 bg-red-600 rounded-full"></div>
                <h2 className="text-xl font-black text-gray-900 uppercase tracking-tighter">Dashboard</h2>
              </div>

              {/* ALERTA */}
              {kegs.some(k => k.status === 'entregado' && daysSince(k.deliveredAt) >= ALERT_DAYS) && (
                <div className="bg-red-600 text-white p-4 rounded-2xl flex items-center space-x-3 shadow-lg animate-in slide-in-from-top-2">
                  <AlertCircle size={20} className="shrink-0" />
                  <div>
                    <p className="text-[10px] font-black uppercase tracking-wider">Barriles sin retornar</p>
                    <p className="text-xs font-bold mt-0.5 text-red-200">
                      {kegs.filter(k => k.status === 'entregado' && daysSince(k.deliveredAt) >= ALERT_DAYS).length} barril(es) lleva(n) más de {ALERT_DAYS} días afuera
                    </p>
                  </div>
                </div>
              )}

              {/* CONTADORES PRINCIPALES */}
              <div className="grid grid-cols-2 gap-4">
                <button onClick={() => setStatusFilter(statusFilter === 'almacen' ? null : 'almacen')}
                  className={`bg-white p-6 rounded-[32px] shadow-sm border-b-4 flex flex-col items-center group active:scale-95 transition-all ${statusFilter === 'almacen' ? 'border-red-600 ring-2 ring-red-100 shadow-md' : 'border-gray-100'}`}>
                  <Warehouse className={`h-6 w-6 mb-2 transition-colors ${statusFilter === 'almacen' ? 'text-red-600' : 'text-gray-400'}`} />
                  <span className="text-4xl font-black text-gray-900 tracking-tighter">{kegs.filter(k => k.status === 'almacen').length}</span>
                  <span className="text-[10px] font-black uppercase text-gray-400 mt-1 tracking-widest">En Fábrica</span>
                </button>
                <button onClick={() => setStatusFilter(statusFilter === 'entregado' ? null : 'entregado')}
                  className={`bg-white p-6 rounded-[32px] shadow-sm border-b-4 flex flex-col items-center group active:scale-95 transition-all ${statusFilter === 'entregado' ? 'border-black ring-2 ring-gray-100 shadow-md' : 'border-gray-100'}`}>
                  <Store className={`h-6 w-6 mb-2 transition-colors ${statusFilter === 'entregado' ? 'text-black' : 'text-red-600'}`} />
                  <span className="text-4xl font-black text-gray-900 tracking-tighter">{kegs.filter(k => k.status === 'entregado').length}</span>
                  <span className="text-[10px] font-black uppercase text-gray-400 mt-1 tracking-widest">Entregados</span>
                </button>
              </div>

              {/* ESTADÍSTICAS */}
              <div className="grid grid-cols-3 gap-2">
                <div className="bg-white p-3 rounded-2xl shadow-sm border border-gray-100 flex flex-col items-center space-y-1 text-center">
                  <TrendingUp size={14} className="text-red-600" />
                  <span className="text-xl font-black text-gray-900">{deliveriesThisMonth}</span>
                  <span className="text-[7px] font-black uppercase text-gray-400 tracking-wide leading-tight">Entregas este mes</span>
                </div>
                <div className="bg-white p-3 rounded-2xl shadow-sm border border-gray-100 flex flex-col items-center space-y-1 text-center">
                  <Store size={14} className="text-red-600" />
                  <span className="text-[9px] font-black text-gray-900 leading-tight line-clamp-2">{topDest}</span>
                  <span className="text-[7px] font-black uppercase text-gray-400 tracking-wide leading-tight">Top destino</span>
                </div>
                <div className="bg-white p-3 rounded-2xl shadow-sm border border-gray-100 flex flex-col items-center space-y-1 text-center">
                  <Clock size={14} className="text-red-600" />
                  <span className="text-xl font-black text-gray-900">{avgDaysOut}d</span>
                  <span className="text-[7px] font-black uppercase text-gray-400 tracking-wide leading-tight">Prom. días afuera</span>
                </div>
              </div>

              {/* DETALLE FÁBRICA */}
              {statusFilter === 'almacen' && (
                <div className="animate-in slide-in-from-top-4 duration-300">
                  <div className="flex items-center justify-between px-2 mb-3">
                    <span className="text-[10px] font-black uppercase text-gray-400 tracking-widest">Stock en Fábrica</span>
                    <button onClick={() => setStatusFilter(null)} className="text-[9px] font-black uppercase text-red-600 hover:bg-red-50 px-2 py-1 rounded-lg">Cerrar</button>
                  </div>
                  {kegs.filter(k => k.status === 'almacen').length === 0 ? (
                    <div className="text-center py-10 bg-gray-50 rounded-3xl border-2 border-dashed border-gray-200">
                      <Info className="mx-auto text-gray-300 mb-2" size={24} />
                      <p className="text-[10px] font-black uppercase text-gray-400">No hay barriles en fábrica</p>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {kegs.filter(k => k.status === 'almacen').map(k => (
                        <div key={k.id} className="bg-white p-4 rounded-2xl shadow-sm border border-gray-100 flex items-center space-x-3">
                          <div className="w-8 h-8 rounded-lg bg-gray-100 flex items-center justify-center">
                            <Beer size={14} className="text-gray-900" />
                          </div>
                          <div>
                            <p className="font-black text-sm">{k.code}</p>
                            <p className="text-[9px] font-bold text-gray-400 uppercase">{k.capacity} Litros · Disponible</p>
                            {k.notes && <p className="text-[9px] text-gray-400 italic mt-0.5">{k.notes}</p>}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* DETALLE ENTREGADOS */}
              {statusFilter === 'entregado' && (
                <div className="animate-in slide-in-from-top-4 duration-300">
                  <div className="flex items-center justify-between px-2 mb-3">
                    <span className="text-[10px] font-black uppercase text-gray-400 tracking-widest">Barriles en Clientes</span>
                    <button onClick={() => setStatusFilter(null)} className="text-[9px] font-black uppercase text-red-600 hover:bg-red-50 px-2 py-1 rounded-lg">Cerrar</button>
                  </div>
                  {kegs.filter(k => k.status === 'entregado').length === 0 ? (
                    <div className="text-center py-10 bg-gray-50 rounded-3xl border-2 border-dashed border-gray-200">
                      <Info className="mx-auto text-gray-300 mb-2" size={24} />
                      <p className="text-[10px] font-black uppercase text-gray-400">No hay barriles entregados</p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {allDestinations
                        .map(dest => ({ dest, kegsHere: kegs.filter(k => k.status === 'entregado' && k.locationId === dest.id) }))
                        .filter(g => g.kegsHere.length > 0)
                        .map(({ dest, kegsHere }) => {
                          const hasAlert = kegsHere.some(k => daysSince(k.deliveredAt) >= ALERT_DAYS);
                          return (
                            <div key={dest.id} className={`bg-white rounded-3xl shadow-sm border-2 overflow-hidden ${hasAlert ? 'border-red-200' : 'border-gray-100'}`}>
                              <div className={`px-4 py-3 flex items-center justify-between ${hasAlert ? 'bg-red-50' : 'bg-gray-50'}`}>
                                <div className="flex items-center space-x-2 min-w-0">
                                  {hasAlert && <AlertCircle size={14} className="text-red-600 shrink-0" />}
                                  <div className="min-w-0">
                                    <span className="font-black text-sm uppercase tracking-tight block truncate">{dest.name}</span>
                                    {dest.address && <span className="text-[9px] text-gray-400 truncate block">{dest.address}</span>}
                                  </div>
                                </div>
                                <div className="flex items-center space-x-2 shrink-0 ml-2">
                                  {dest.contact && (
                                    <a href={`https://wa.me/${dest.contact.replace(/\D/g, '')}`} target="_blank" rel="noopener noreferrer"
                                      className="w-7 h-7 bg-green-500 text-white rounded-lg flex items-center justify-center active:scale-90">
                                      <Phone size={12} />
                                    </a>
                                  )}
                                  <span className={`text-[10px] font-black px-2 py-1 rounded-full ${hasAlert ? 'bg-red-600 text-white' : 'bg-black text-white'}`}>
                                    {kegsHere.length} barril{kegsHere.length > 1 ? 'es' : ''}
                                  </span>
                                </div>
                              </div>
                              <div className="divide-y divide-gray-50">
                                {kegsHere.map(k => {
                                  const days = daysSince(k.deliveredAt);
                                  const isOld = days !== null && days >= ALERT_DAYS;
                                  return (
                                    <div key={k.id} className="px-4 py-3 flex items-center justify-between">
                                      <div className="flex items-center space-x-3">
                                        <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${isOld ? 'bg-red-100' : 'bg-gray-100'}`}>
                                          <Beer size={14} className={isOld ? 'text-red-600' : 'text-gray-700'} />
                                        </div>
                                        <div>
                                          <p className="font-black text-sm">{k.code} <span className="font-bold text-gray-400 text-xs">{k.capacity}L</span></p>
                                          <div className="flex items-center space-x-1 mt-0.5">
                                            <Clock size={10} className={isOld ? 'text-red-500' : 'text-gray-400'} />
                                            <span className={`text-[9px] font-bold ${isOld ? 'text-red-600' : 'text-gray-400'}`}>
                                              {days === null ? 'Fecha desconocida' : days === 0 ? 'Entregado hoy' : `${days} día${days > 1 ? 's' : ''} afuera`}
                                            </span>
                                          </div>
                                          {k.notes && <p className="text-[8px] text-gray-400 italic mt-0.5 max-w-[120px] truncate">{k.notes}</p>}
                                        </div>
                                      </div>
                                      <button onClick={() => returnKeg(k.id)}
                                        className="flex items-center space-x-1 bg-gray-100 hover:bg-green-100 hover:text-green-700 text-gray-500 px-3 py-2 rounded-xl transition-colors active:scale-95">
                                        <RotateCcw size={12} />
                                        <span className="text-[9px] font-black uppercase ml-1">Devolver</span>
                                      </button>
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          );
                        })
                      }
                    </div>
                  )}
                </div>
              )}

              {/* HISTORIAL DE MOVIMIENTOS */}
              <div>
                <button onClick={() => setShowMovements(v => !v)}
                  className="w-full flex items-center justify-between px-4 py-3 bg-white rounded-2xl shadow-sm border border-gray-100 active:scale-[0.98] transition-transform">
                  <div className="flex items-center space-x-2">
                    <History size={16} className="text-red-600" />
                    <span className="text-[10px] font-black uppercase tracking-widest text-gray-600">Últimos Movimientos</span>
                    {movements.length > 0 && (
                      <span className="bg-gray-100 text-gray-500 text-[9px] font-black px-2 py-0.5 rounded-full">{movements.length}</span>
                    )}
                  </div>
                  <ChevronDown size={16} className={`text-gray-400 transition-transform duration-200 ${showMovements ? 'rotate-180' : ''}`} />
                </button>

                {showMovements && (
                  <div className="mt-2 space-y-2 animate-in slide-in-from-top-4 duration-300">
                    {movements.length === 0 ? (
                      <div className="text-center py-8 bg-gray-50 rounded-2xl border-2 border-dashed border-gray-200">
                        <p className="text-[10px] font-black uppercase text-gray-400">Sin movimientos registrados aún</p>
                      </div>
                    ) : (
                      movements.map(m => (
                        <div key={m.id} className="bg-white px-4 py-3 rounded-2xl border border-gray-100 shadow-sm flex items-center space-x-3">
                          <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${m.type === 'delivery' ? 'bg-red-50' : 'bg-green-50'}`}>
                            {m.type === 'delivery'
                              ? <ChevronRight size={16} className="text-red-600" />
                              : <RotateCcw size={14} className="text-green-600" />
                            }
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="font-black text-sm leading-tight">
                              {m.kegCode} <span className="font-bold text-gray-400 text-xs">{m.kegCapacity}L</span>
                            </p>
                            <p className="text-[10px] text-gray-400 font-bold truncate">
                              {m.type === 'delivery' ? '→' : '←'} {m.destinationName}
                            </p>
                          </div>
                          <div className="text-right shrink-0">
                            <p className="text-[9px] font-bold text-gray-400">{m.date?.split('-').reverse().join('/')}</p>
                            <p className={`text-[8px] font-black uppercase ${m.type === 'delivery' ? 'text-red-500' : 'text-green-600'}`}>
                              {m.type === 'delivery' ? 'Entrega' : 'Retorno'}
                            </p>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ── TAB: STOCK ──────────────────────────────────────────────────── */}
          {activeTab === 'kegs' && (
            <div className="pt-4 space-y-3 animate-in fade-in slide-in-from-right-4 duration-300 pb-24">
              <div className="flex justify-between items-center px-2">
                <h2 className="text-xl font-black uppercase tracking-tighter">Stock de Barriles</h2>
                <button onClick={() => setShowAddKeg(true)} className="bg-black text-white p-2.5 rounded-xl active:scale-90 shadow-lg"><Plus size={20} /></button>
              </div>

              {/* BUSCADOR */}
              <div className="flex items-center space-x-2 bg-gray-50 border border-gray-200 rounded-2xl px-4 py-3">
                <Search size={15} className="text-gray-400 shrink-0" />
                <input
                  type="text"
                  placeholder="Buscar por código..."
                  className="flex-1 bg-transparent text-sm font-bold outline-none text-gray-700 placeholder:text-gray-400"
                  value={kegSearch}
                  onChange={e => setKegSearch(e.target.value)}
                />
                {kegSearch && (
                  <button onClick={() => setKegSearch('')} className="text-gray-400 hover:text-red-500 transition-colors"><X size={14} /></button>
                )}
              </div>

              {/* FORM NUEVO BARRIL */}
              {showAddKeg && (
                <div className="bg-gray-900 p-6 rounded-[32px] text-white space-y-4 animate-in slide-in-from-top-4 duration-300 shadow-2xl">
                  <div className="flex justify-between items-center">
                    <span className="text-[10px] font-black uppercase tracking-widest text-red-500">Nuevo Barril</span>
                    <button onClick={() => setShowAddKeg(false)} className="hover:text-red-500 transition-colors"><X size={18} /></button>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <label className="text-[8px] font-black uppercase text-gray-500 ml-1">Código</label>
                      <input type="text" placeholder="B-00X"
                        className="w-full bg-white/10 border border-white/20 rounded-xl p-3 text-sm font-black uppercase outline-none focus:border-red-600"
                        value={newKeg.code} onChange={e => setNewKeg({ ...newKeg, code: e.target.value })} />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[8px] font-black uppercase text-gray-500 ml-1">Capacidad (L)</label>
                      <input type="number" placeholder="Ej: 50"
                        className="w-full bg-white/10 border border-white/20 rounded-xl p-3 text-sm font-black outline-none focus:border-red-600"
                        value={newKeg.capacity} onChange={e => setNewKeg({ ...newKeg, capacity: e.target.value })} />
                    </div>
                  </div>
                  <button onClick={addNewKeg} className="w-full py-4 bg-red-600 rounded-2xl font-black uppercase text-xs tracking-widest active:scale-95 transition-transform">
                    Agregar al Inventario
                  </button>
                </div>
              )}

              {/* LISTA */}
              <div className="space-y-2">
                {kegs
                  .filter(k => !kegSearch || k.code.toLowerCase().includes(kegSearch.toLowerCase()))
                  .map(k => (
                    <div key={k.id} className="bg-white rounded-3xl shadow-sm border border-gray-100 overflow-hidden">
                      <div className="p-4 flex items-center justify-between">
                        <div className="flex items-center space-x-3 min-w-0">
                          <div className={`w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 ${k.status === 'almacen' ? 'bg-gray-100 text-gray-900' : 'bg-red-50 text-red-600'}`}>
                            <Beer size={20} />
                          </div>
                          <div className="min-w-0">
                            <div className="flex items-center space-x-2">
                              <span className="font-black text-lg">{k.code}</span>
                              <span className="text-[10px] bg-black text-white px-2 py-0.5 rounded font-black">{k.capacity}L</span>
                            </div>
                            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mt-0.5">
                              {k.status === 'almacen' ? 'Disponible en Fábrica' : `En ${allDestinations.find(l => l.id === k.locationId)?.name || 'Local'}`}
                            </p>
                            {/* NOTA */}
                            {k.notes && editingNoteKegId !== k.id && (
                              <p className="text-[10px] text-amber-600 italic mt-0.5 truncate max-w-[160px]">📝 {k.notes}</p>
                            )}
                            {editingNoteKegId === k.id && (
                              <div className="flex items-center space-x-1 mt-1.5">
                                <input
                                  type="text"
                                  className="text-xs bg-amber-50 border border-amber-200 rounded-lg px-2 py-1.5 font-medium outline-none w-32 focus:border-amber-400"
                                  value={editingNoteValue}
                                  onChange={e => setEditingNoteValue(e.target.value)}
                                  autoFocus
                                  placeholder="Nota..."
                                  onKeyDown={e => { if (e.key === 'Enter') saveKegNote(k.id); if (e.key === 'Escape') setEditingNoteKegId(null); }}
                                />
                                <button onClick={() => saveKegNote(k.id)} className="text-[9px] font-black text-white bg-amber-500 px-2 py-1.5 rounded-lg active:scale-95">OK</button>
                                <button onClick={() => setEditingNoteKegId(null)} className="text-gray-400"><X size={12} /></button>
                              </div>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center space-x-1 shrink-0 ml-2">
                          <button onClick={() => { setEditingNoteKegId(editingNoteKegId === k.id ? null : k.id); setEditingNoteValue(k.notes || ''); }}
                            className={`p-2 transition-colors rounded-lg ${editingNoteKegId === k.id ? 'text-amber-500 bg-amber-50' : 'text-gray-300 hover:text-amber-500'}`}>
                            <Edit2 size={15} />
                          </button>
                          <button onClick={() => setQrKeg(k)} className="p-2 text-gray-300 hover:text-gray-700 transition-colors rounded-lg hover:bg-gray-50">
                            <QrCode size={15} />
                          </button>
                          {k.status === 'entregado' && (
                            <button onClick={() => returnKeg(k.id)} className="p-2 text-gray-300 hover:text-green-600 transition-colors rounded-lg hover:bg-green-50">
                              <Warehouse size={15} />
                            </button>
                          )}
                          <button onClick={() => deleteKeg(k.id)} className="p-2 text-gray-200 hover:text-red-600 transition-colors rounded-lg hover:bg-red-50">
                            <Trash2 size={15} />
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                {kegs.filter(k => !kegSearch || k.code.toLowerCase().includes(kegSearch.toLowerCase())).length === 0 && kegSearch && (
                  <div className="text-center py-10 bg-gray-50 rounded-3xl border-2 border-dashed border-gray-200">
                    <p className="text-[10px] font-black uppercase text-gray-400">Sin resultados para "{kegSearch}"</p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ── TAB: PERFIL / CONFIG ────────────────────────────────────────── */}
          {activeTab === 'settings' && (
            <div className="pt-4 space-y-5 animate-in fade-in slide-in-from-left-4 duration-300 pb-24">
              <div className="flex items-center justify-between mb-2 ml-2 mr-1">
                <div className="flex items-center space-x-2">
                  <div className="w-1.5 h-6 bg-red-600 rounded-full"></div>
                  <h2 className="text-xl font-black text-gray-900 uppercase tracking-tighter">Configuración</h2>
                </div>
                <button
                  onClick={handleLogout}
                  className="flex items-center space-x-2 bg-gray-100 text-gray-500 px-3 py-2 rounded-xl font-black uppercase text-[9px] hover:bg-red-50 hover:text-red-600 transition-colors active:scale-95"
                >
                  <LogOut size={13} />
                  <span>Cerrar sesión</span>
                </button>
              </div>

              {/* DATOS COMERCIALES */}
              <div className="bg-white p-6 rounded-[32px] shadow-sm border border-gray-100 space-y-4">
                <div className="flex items-center space-x-2">
                  <User size={16} className="text-red-600" />
                  <span className="text-[10px] font-black uppercase text-gray-400 tracking-widest">Datos Comerciales</span>
                </div>
                <div className="space-y-3">
                  <input
                    type="text"
                    className="w-full bg-gray-50 border border-gray-200 rounded-xl p-3 font-bold text-sm outline-none focus:border-red-600"
                    value={settings.providerName}
                    onChange={e => handleSettingsChange({ ...settings, providerName: e.target.value })}
                    placeholder="Nombre Proveedor"
                  />
                  <input
                    type="text"
                    className="w-full bg-gray-50 border border-gray-200 rounded-xl p-3 font-bold text-sm outline-none focus:border-red-600"
                    value={settings.aliasInfo}
                    onChange={e => handleSettingsChange({ ...settings, aliasInfo: e.target.value })}
                    placeholder="Datos de Pago (CBU/Alias)"
                  />
                </div>
              </div>

              {/* CLIENTES / BARES / EVENTOS */}
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
                    <PlusCircle size={18} /><span>Agregar Nuevo Destino</span>
                  </button>
                ) : creationChoice === 'select' ? (
                  <div className="grid grid-cols-2 gap-2 animate-in zoom-in-95 duration-200">
                    <button onClick={() => setCreationChoice('bar')} className="bg-gray-100 p-4 rounded-xl flex flex-col items-center justify-center space-y-2 border-2 border-transparent hover:border-red-600 transition-all">
                      <Store size={24} className="text-gray-900" />
                      <span className="text-[10px] font-black uppercase">Es un Bar</span>
                    </button>
                    <button onClick={() => setCreationChoice('event')} className="bg-gray-100 p-4 rounded-xl flex flex-col items-center justify-center space-y-2 border-2 border-transparent hover:border-red-600 transition-all">
                      <Music size={24} className="text-gray-900" />
                      <span className="text-[10px] font-black uppercase">Es un Evento</span>
                    </button>
                  </div>
                ) : (
                  <div className="space-y-2 animate-in slide-in-from-top-2">
                    <input
                      type="text"
                      placeholder={creationChoice === 'bar' ? 'Nombre del bar...' : 'Nombre del evento...'}
                      className="w-full bg-gray-50 border-2 border-red-100 rounded-xl p-3 font-bold text-sm outline-none focus:border-red-400"
                      value={creationChoice === 'bar' ? newLocationName : newEventName}
                      onChange={e => creationChoice === 'bar' ? setNewLocationName(e.target.value) : setNewEventName(e.target.value)}
                    />
                    <div className="flex items-center space-x-2 bg-gray-50 border border-gray-200 rounded-xl px-3">
                      <MapPin size={14} className="text-gray-400 shrink-0" />
                      <input type="text" placeholder="Dirección (opcional)"
                        className="flex-1 bg-transparent p-3 text-sm font-medium outline-none text-gray-700 placeholder:text-gray-400"
                        value={creationChoice === 'bar' ? newLocationAddress : newEventAddress}
                        onChange={e => creationChoice === 'bar' ? setNewLocationAddress(e.target.value) : setNewEventAddress(e.target.value)} />
                    </div>
                    <div className="flex items-center space-x-2 bg-gray-50 border border-gray-200 rounded-xl px-3">
                      <Phone size={14} className="text-gray-400 shrink-0" />
                      <input type="tel" placeholder="WhatsApp (ej: 5491112345678)"
                        className="flex-1 bg-transparent p-3 text-sm font-medium outline-none text-gray-700 placeholder:text-gray-400"
                        value={creationChoice === 'bar' ? newLocationContact : newEventContact}
                        onChange={e => creationChoice === 'bar' ? setNewLocationContact(e.target.value) : setNewEventContact(e.target.value)} />
                    </div>
                    <div className="flex space-x-2">
                      <button onClick={creationChoice === 'bar' ? addLocation : addEvent} className="flex-1 bg-red-600 text-white py-3 rounded-xl font-black uppercase text-[10px] tracking-widest active:scale-95 shadow-md">Guardar</button>
                      <button onClick={() => { setCreationChoice(null); setNewLocationAddress(''); setNewEventAddress(''); setNewLocationContact(''); setNewEventContact(''); }} className="bg-gray-200 text-gray-500 px-4 rounded-xl active:scale-95"><X size={18} /></button>
                    </div>
                  </div>
                )}
                <div className="space-y-2">
                  <h4 className="text-[9px] font-black uppercase text-gray-300 tracking-tighter">Bares Registrados</h4>
                  {locations.map(loc => (
                    <div key={loc.id} className="bg-gray-50 rounded-xl border border-gray-100 overflow-hidden">
                      <div className="flex items-center justify-between p-3">
                        <div className="flex items-center space-x-2 min-w-0">
                          <Store size={14} className="text-gray-400 shrink-0" />
                          <div className="min-w-0">
                            <span className="font-bold text-sm text-gray-700 block">{loc.name}</span>
                            {loc.address && <span className="text-[10px] text-gray-400 flex items-center gap-1"><MapPin size={9} />{loc.address}</span>}
                            {loc.contact && (
                              <a href={`https://wa.me/${loc.contact.replace(/\D/g, '')}`} target="_blank" rel="noopener noreferrer"
                                className="text-[10px] text-green-600 font-bold flex items-center gap-1 hover:underline">
                                <Phone size={9} />{loc.contact}
                              </a>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center space-x-1 shrink-0 ml-2">
                          <button onClick={() => { setEditingDestId(editingDestId === loc.id ? null : loc.id); setEditingDestAddress(loc.address || ''); setEditingDestContact(loc.contact || ''); }}
                            className="p-1.5 text-gray-300 hover:text-gray-600 transition-colors"><Edit2 size={13} /></button>
                          <button onClick={() => removeLocation(loc.id)} className="p-1.5 text-gray-300 hover:text-red-600 transition-colors"><Trash2 size={13} /></button>
                        </div>
                      </div>
                      {editingDestId === loc.id && (
                        <div className="px-3 pb-3 space-y-2 animate-in slide-in-from-top-2">
                          <div className="flex space-x-2">
                            <div className="flex-1 flex items-center space-x-2 bg-white border border-gray-200 rounded-lg px-2">
                              <MapPin size={12} className="text-gray-400 shrink-0" />
                              <input type="text" placeholder="Dirección..." className="flex-1 py-2 text-xs font-medium outline-none"
                                value={editingDestAddress} onChange={e => setEditingDestAddress(e.target.value)} />
                            </div>
                            <button onClick={() => saveDestAddress('location', loc.id)} className="bg-red-600 text-white px-3 py-2 rounded-lg text-[10px] font-black active:scale-95">OK</button>
                            <button onClick={() => setEditingDestId(null)} className="bg-gray-200 text-gray-500 px-3 py-2 rounded-lg"><X size={12} /></button>
                          </div>
                          <div className="flex space-x-2">
                            <div className="flex-1 flex items-center space-x-2 bg-white border border-gray-200 rounded-lg px-2">
                              <Phone size={12} className="text-green-500 shrink-0" />
                              <input type="tel" placeholder="WhatsApp..." className="flex-1 py-2 text-xs font-medium outline-none"
                                value={editingDestContact} onChange={e => setEditingDestContact(e.target.value)} />
                            </div>
                            <button onClick={() => saveDestContact('location', loc.id)} className="bg-green-500 text-white px-3 py-2 rounded-lg text-[10px] font-black active:scale-95">OK</button>
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
                <div className="space-y-2 pt-2 border-t border-gray-50">
                  <h4 className="text-[9px] font-black uppercase text-gray-300 tracking-tighter">Eventos Activos</h4>
                  {events.map(ev => (
                    <div key={ev.id} className="bg-red-50/30 rounded-xl border border-red-50 overflow-hidden">
                      <div className="flex items-center justify-between p-3">
                        <div className="flex items-center space-x-2 min-w-0">
                          <Music size={14} className="text-red-400 shrink-0" />
                          <div className="min-w-0">
                            <span className="font-bold text-sm text-gray-700 block">{ev.name}</span>
                            {ev.address && <span className="text-[10px] text-gray-400 flex items-center gap-1"><MapPin size={9} />{ev.address}</span>}
                            {ev.contact && (
                              <a href={`https://wa.me/${ev.contact.replace(/\D/g, '')}`} target="_blank" rel="noopener noreferrer"
                                className="text-[10px] text-green-600 font-bold flex items-center gap-1 hover:underline">
                                <Phone size={9} />{ev.contact}
                              </a>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center space-x-1 shrink-0 ml-2">
                          <button onClick={() => { setEditingDestId(editingDestId === ev.id ? null : ev.id); setEditingDestAddress(ev.address || ''); setEditingDestContact(ev.contact || ''); }}
                            className="p-1.5 text-gray-300 hover:text-gray-600 transition-colors"><Edit2 size={13} /></button>
                          <button onClick={() => removeEvent(ev.id)} className="p-1.5 text-gray-300 hover:text-red-600 transition-colors"><Trash2 size={13} /></button>
                        </div>
                      </div>
                      {editingDestId === ev.id && (
                        <div className="px-3 pb-3 space-y-2 animate-in slide-in-from-top-2">
                          <div className="flex space-x-2">
                            <div className="flex-1 flex items-center space-x-2 bg-white border border-gray-200 rounded-lg px-2">
                              <MapPin size={12} className="text-gray-400 shrink-0" />
                              <input type="text" placeholder="Dirección..." className="flex-1 py-2 text-xs font-medium outline-none"
                                value={editingDestAddress} onChange={e => setEditingDestAddress(e.target.value)} />
                            </div>
                            <button onClick={() => saveDestAddress('event', ev.id)} className="bg-red-600 text-white px-3 py-2 rounded-lg text-[10px] font-black active:scale-95">OK</button>
                            <button onClick={() => setEditingDestId(null)} className="bg-gray-200 text-gray-500 px-3 py-2 rounded-lg"><X size={12} /></button>
                          </div>
                          <div className="flex space-x-2">
                            <div className="flex-1 flex items-center space-x-2 bg-white border border-gray-200 rounded-lg px-2">
                              <Phone size={12} className="text-green-500 shrink-0" />
                              <input type="tel" placeholder="WhatsApp..." className="flex-1 py-2 text-xs font-medium outline-none"
                                value={editingDestContact} onChange={e => setEditingDestContact(e.target.value)} />
                            </div>
                            <button onClick={() => saveDestContact('event', ev.id)} className="bg-green-500 text-white px-3 py-2 rounded-lg text-[10px] font-black active:scale-95">OK</button>
                          </div>
                        </div>
                      )}
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
                <p className="text-[9px] text-gray-400">El logo se guarda en este dispositivo. No se sincroniza entre dispositivos.</p>
                <div className="flex items-center space-x-4">
                  <div className="w-20 h-20 rounded-2xl border-2 border-dashed border-gray-200 flex items-center justify-center overflow-hidden bg-gray-50 relative group">
                    {logoUrl ? (
                      <>
                        <img src={logoUrl} className="w-full h-full object-contain" alt="Logo" />
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

          {/* ── TAB: LISTA DE PRECIOS ──────────────────────────────────────── */}
          {activeTab === 'prices' && (
            <div className="pt-4 space-y-4 animate-in fade-in slide-in-from-right-4 duration-300 pb-24">
              <div className="flex justify-between items-center px-2">
                <div className="flex items-center space-x-2">
                  <div className="w-1.5 h-6 bg-red-600 rounded-full"></div>
                  <h2 className="text-xl font-black uppercase tracking-tighter">Lista de Precios</h2>
                </div>
                <button
                  onClick={() => { setShowAddPrice(true); setEditingPriceId(null); }}
                  className="bg-black text-white p-2.5 rounded-xl active:scale-90 shadow-lg"
                >
                  <Plus size={20} />
                </button>
              </div>

              {/* FORM NUEVO PRECIO */}
              {showAddPrice && (
                <div className="bg-gray-900 p-6 rounded-[32px] text-white space-y-4 animate-in slide-in-from-top-4 duration-300 shadow-2xl">
                  <div className="flex justify-between items-center">
                    <span className="text-[10px] font-black uppercase tracking-widest text-red-500">Nuevo Precio</span>
                    <button onClick={() => setShowAddPrice(false)} className="text-gray-400 hover:text-white transition-colors"><X size={18} /></button>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <label className="text-[8px] font-black uppercase text-gray-500 ml-1">Capacidad (L)</label>
                      <input type="number" placeholder="Ej: 50" className="w-full bg-white/10 border border-white/20 rounded-xl p-3 text-sm font-bold outline-none focus:border-red-500 text-white placeholder:text-gray-600" value={newPrice.capacity} onChange={e => setNewPrice({ ...newPrice, capacity: e.target.value })} />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[8px] font-black uppercase text-gray-500 ml-1">Estilo</label>
                      <select className="w-full bg-white/10 border border-white/20 rounded-xl p-3 text-sm font-bold outline-none focus:border-red-500 text-white" value={newPrice.style} onChange={e => setNewPrice({ ...newPrice, style: e.target.value })}>
                        <option value="" className="text-black bg-white">Estilo...</option>
                        {styles.map(s => <option key={s} value={s} className="text-black bg-white">{s}</option>)}
                      </select>
                    </div>
                    <div className="space-y-1">
                      <label className="text-[8px] font-black uppercase text-gray-500 ml-1">Precio Bar $</label>
                      <input type="number" placeholder="Ej: 12000" className="w-full bg-white/10 border border-white/20 rounded-xl p-3 text-sm font-bold outline-none focus:border-red-500 text-white placeholder:text-gray-600" value={newPrice.priceBar} onChange={e => setNewPrice({ ...newPrice, priceBar: e.target.value })} />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[8px] font-black uppercase text-gray-500 ml-1">Precio Evento $</label>
                      <input type="number" placeholder="Ej: 15000" className="w-full bg-white/10 border border-white/20 rounded-xl p-3 text-sm font-bold outline-none focus:border-red-500 text-white placeholder:text-gray-600" value={newPrice.priceEvent} onChange={e => setNewPrice({ ...newPrice, priceEvent: e.target.value })} />
                    </div>
                  </div>
                  <button onClick={addPrice} className="w-full py-4 bg-red-600 rounded-2xl font-black uppercase text-xs tracking-widest active:scale-95 transition-transform shadow-lg shadow-red-900/30">
                    Guardar Precio
                  </button>
                </div>
              )}

              {/* LISTA */}
              {prices.length === 0 && !showAddPrice ? (
                <div className="flex flex-col items-center justify-center py-24 space-y-4">
                  <div className="w-20 h-20 bg-gray-100 rounded-3xl flex items-center justify-center">
                    <DollarSign size={36} className="text-gray-300" />
                  </div>
                  <div className="text-center space-y-1">
                    <p className="text-sm font-black uppercase text-gray-400">Sin precios cargados</p>
                    <p className="text-xs text-gray-400">Tocá <span className="font-black text-gray-600">+</span> para agregar tu primera tarifa</p>
                  </div>
                </div>
              ) : (
                <div className="space-y-3">
                  {prices.map(p => (
                    editingPriceId === p.id ? (
                      /* FORM EDICIÓN INLINE */
                      <div key={p.id} className="bg-gray-900 p-5 rounded-[28px] text-white space-y-3 animate-in zoom-in-95 duration-200 shadow-xl">
                        <span className="text-[8px] font-black uppercase tracking-widest text-red-500">Editando precio</span>
                        <div className="grid grid-cols-2 gap-2">
                          <div className="space-y-1">
                            <label className="text-[8px] font-black uppercase text-gray-500 ml-1">Capacidad (L)</label>
                            <input type="number" className="w-full bg-white/10 border border-white/20 rounded-xl p-3 text-sm font-bold outline-none focus:border-red-500 text-white" value={editPriceForm.capacity} onChange={e => setEditPriceForm({ ...editPriceForm, capacity: e.target.value })} />
                          </div>
                          <div className="space-y-1">
                            <label className="text-[8px] font-black uppercase text-gray-500 ml-1">Estilo</label>
                            <select className="w-full bg-white/10 border border-white/20 rounded-xl p-3 text-sm font-bold outline-none text-white" value={editPriceForm.style} onChange={e => setEditPriceForm({ ...editPriceForm, style: e.target.value })}>
                              {styles.map(s => <option key={s} value={s} className="text-black bg-white">{s}</option>)}
                            </select>
                          </div>
                          <div className="space-y-1">
                            <label className="text-[8px] font-black uppercase text-gray-500 ml-1">Precio Bar $</label>
                            <input type="number" className="w-full bg-white/10 border border-white/20 rounded-xl p-3 text-sm font-bold outline-none focus:border-red-500 text-white" value={editPriceForm.priceBar} onChange={e => setEditPriceForm({ ...editPriceForm, priceBar: e.target.value })} />
                          </div>
                          <div className="space-y-1">
                            <label className="text-[8px] font-black uppercase text-gray-500 ml-1">Precio Evento $</label>
                            <input type="number" className="w-full bg-white/10 border border-white/20 rounded-xl p-3 text-sm font-bold outline-none focus:border-red-500 text-white" value={editPriceForm.priceEvent} onChange={e => setEditPriceForm({ ...editPriceForm, priceEvent: e.target.value })} />
                          </div>
                        </div>
                        <div className="flex space-x-2">
                          <button onClick={saveEditPrice} className="flex-1 py-3 bg-red-600 rounded-xl font-black uppercase text-[10px] tracking-widest active:scale-95">Guardar</button>
                          <button onClick={() => setEditingPriceId(null)} className="px-4 py-3 bg-white/10 rounded-xl text-gray-400 hover:text-white transition-colors"><X size={16} /></button>
                        </div>
                      </div>
                    ) : (
                      /* CARD PRECIO */
                      <div key={p.id} className="bg-white p-4 rounded-3xl shadow-sm border border-gray-100 flex items-center justify-between group">
                        <div className="flex-1">
                          <div className="flex items-center space-x-2 mb-2">
                            <span className="text-2xl font-black text-gray-900 tracking-tighter">{p.capacity}L</span>
                            <span className="text-sm font-black italic text-red-600 uppercase">{p.style}</span>
                          </div>
                          <div className="flex items-center space-x-3">
                            <div className="bg-gray-50 rounded-lg px-3 py-1.5">
                              <div className="text-[7px] font-black uppercase text-gray-400 tracking-wider">Bar</div>
                              <div className="text-sm font-black text-gray-800">${p.priceBar.toLocaleString('es-AR')}</div>
                            </div>
                            <div className="bg-gray-50 rounded-lg px-3 py-1.5">
                              <div className="text-[7px] font-black uppercase text-gray-400 tracking-wider">Evento</div>
                              <div className="text-sm font-black text-gray-800">${p.priceEvent.toLocaleString('es-AR')}</div>
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center space-x-1 ml-3">
                          <button onClick={() => startEditPrice(p)} className="p-2.5 text-gray-300 hover:text-gray-700 hover:bg-gray-100 rounded-xl transition-all active:scale-90">
                            <Edit2 size={16} />
                          </button>
                          <button onClick={() => removePrice(p.id)} className="p-2.5 text-gray-300 hover:text-red-600 hover:bg-red-50 rounded-xl transition-all active:scale-90">
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </div>
                    )
                  ))}
                </div>
              )}

              {/* COMPARTIR */}
              {prices.length > 0 && (
                <div className="bg-white p-5 rounded-[32px] shadow-sm border border-gray-100 space-y-3">
                  <div className="flex items-center space-x-2">
                    <MessageSquare size={14} className="text-red-600" />
                    <span className="text-[10px] font-black uppercase text-gray-400 tracking-widest">Compartir Lista</span>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <button onClick={() => handleCopyPriceList('bar')} className={`py-3 rounded-2xl font-black uppercase tracking-widest text-[10px] flex items-center justify-center space-x-2 transition-all active:scale-95 ${isPriceCopied === 'bar' ? 'bg-green-600 text-white' : 'bg-black text-white'}`}>
                      {isPriceCopied === 'bar' ? <CheckCircle2 size={14} /> : <MessageSquare size={14} />}
                      <span>{isPriceCopied === 'bar' ? 'Copiado' : 'WPP Bares'}</span>
                    </button>
                    <button onClick={() => handleCopyPriceList('event')} className={`py-3 rounded-2xl font-black uppercase tracking-widest text-[10px] flex items-center justify-center space-x-2 transition-all active:scale-95 ${isPriceCopied === 'event' ? 'bg-green-600 text-white' : 'bg-gray-800 text-white'}`}>
                      {isPriceCopied === 'event' ? <CheckCircle2 size={14} /> : <MessageSquare size={14} />}
                      <span>{isPriceCopied === 'event' ? 'Copiado' : 'WPP Eventos'}</span>
                    </button>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <button onClick={() => handleGeneratePriceListPDF('bar')} disabled={isGeneratingPriceListPDF} className={`py-3 rounded-2xl font-black uppercase tracking-widest text-[10px] flex items-center justify-center space-x-2 transition-all active:scale-95 border-2 ${isGeneratingPriceListPDF ? 'bg-gray-100 text-gray-400 border-gray-200' : 'bg-white text-red-600 border-red-200 hover:bg-red-50'}`}>
                      <FileText size={14} /><span>PDF Bares</span>
                    </button>
                    <button onClick={() => handleGeneratePriceListPDF('event')} disabled={isGeneratingPriceListPDF} className={`py-3 rounded-2xl font-black uppercase tracking-widest text-[10px] flex items-center justify-center space-x-2 transition-all active:scale-95 border-2 ${isGeneratingPriceListPDF ? 'bg-gray-100 text-gray-400 border-gray-200' : 'bg-white text-red-600 border-red-200 hover:bg-red-50'}`}>
                      <FileText size={14} /><span>PDF Eventos</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

        </main>

        {/* NAVEGACIÓN INFERIOR */}
        <div className="fixed bottom-5 left-0 right-0 px-4 flex justify-center z-50 no-print">
          <div className="bg-black w-full max-w-sm rounded-[28px] shadow-2xl flex items-center px-3 relative" style={{ height: '68px' }}>

            {/* Status */}
            <button
              onClick={() => setActiveTab('home')}
              className={`flex-1 flex flex-col items-center space-y-1 py-2 transition-all ${activeTab === 'home' ? 'text-red-500 scale-110' : 'text-gray-500'}`}
            >
              <Home size={20} />
              <span className="text-[7px] font-black uppercase">Status</span>
            </button>

            {/* Stock */}
            <button
              onClick={() => setActiveTab('kegs')}
              className={`flex-1 flex flex-col items-center space-y-1 py-2 transition-all ${activeTab === 'kegs' ? 'text-red-500 scale-110' : 'text-gray-500'}`}
            >
              <Warehouse size={20} />
              <span className="text-[7px] font-black uppercase">Stock</span>
            </button>

            {/* Botón central + */}
            <div className="flex-1 flex items-center justify-center">
              <button
                onClick={() => { setActiveTab('whatsapp'); setStatusFilter(null); }}
                className={`w-14 h-14 rounded-full flex items-center justify-center shadow-2xl transition-all active:scale-90 absolute -top-7 ${activeTab === 'whatsapp' ? 'bg-red-600 text-white ring-4 ring-red-600/30 shadow-red-500/40' : 'bg-white text-black shadow-black/30'}`}
              >
                <Plus size={28} strokeWidth={3} />
              </button>
            </div>

            {/* Precios */}
            <button
              onClick={() => setActiveTab('prices')}
              className={`flex-1 flex flex-col items-center space-y-1 py-2 transition-all ${activeTab === 'prices' ? 'text-red-500 scale-110' : 'text-gray-500'}`}
            >
              <Tag size={20} />
              <span className="text-[7px] font-black uppercase">Precios</span>
            </button>

            {/* Perfil */}
            <button
              onClick={() => { setActiveTab('settings'); setStatusFilter(null); }}
              className={`flex-1 flex flex-col items-center space-y-1 py-2 transition-all ${activeTab === 'settings' ? 'text-red-500 scale-110' : 'text-gray-500'}`}
            >
              <Settings size={20} />
              <span className="text-[7px] font-black uppercase">Perfil</span>
            </button>

          </div>
        </div>

      </div>

      {/* MODAL QR */}
      {qrKeg && (
        <div className="fixed inset-0 z-[300] flex items-center justify-center p-6 no-print"
          style={{ background: 'rgba(0,0,0,0.88)' }}
          onClick={() => setQrKeg(null)}>
          <div className="bg-white rounded-[36px] p-7 w-full max-w-xs flex flex-col items-center space-y-5 shadow-2xl animate-in zoom-in-95 duration-200"
            onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between w-full">
              <div className="flex items-center space-x-2">
                <QrCode size={16} className="text-red-600" />
                <span className="text-[10px] font-black uppercase tracking-widest text-gray-400">Código QR del Barril</span>
              </div>
              <button onClick={() => setQrKeg(null)} className="p-1.5 text-gray-300 hover:text-red-500 transition-colors"><X size={18} /></button>
            </div>
            <div className="bg-white p-4 rounded-2xl border-2 border-gray-100 shadow-inner">
              <QRCode
                value={`BRAUERS|${qrKeg.code}|${qrKeg.capacity}L`}
                size={180}
                fgColor="#000000"
                bgColor="#ffffff"
              />
            </div>
            <div className="text-center space-y-1">
              <p className="text-3xl font-black tracking-tighter text-gray-900">{qrKeg.code}</p>
              <p className="text-sm font-bold text-gray-400 uppercase tracking-widest">{qrKeg.capacity} Litros</p>
              <span className={`text-[10px] font-black uppercase px-3 py-1 rounded-full inline-block mt-1 ${qrKeg.status === 'almacen' ? 'bg-gray-100 text-gray-500' : 'bg-red-100 text-red-600'}`}>
                {qrKeg.status === 'almacen' ? 'En Fábrica' : `En ${allDestinations.find(l => l.id === qrKeg.locationId)?.name || 'Cliente'}`}
              </span>
              {qrKeg.notes && <p className="text-[10px] text-amber-600 italic mt-1">📝 {qrKeg.notes}</p>}
            </div>
            <button onClick={() => setQrKeg(null)}
              className="w-full py-3 bg-black text-white rounded-2xl font-black uppercase text-[10px] tracking-widest active:scale-95">
              Cerrar
            </button>
          </div>
        </div>
      )}

    </div>
  );
}
