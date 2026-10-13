import { useEffect, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { AdminLayout } from '../../components/AdminLayout';
import { supabase, hotelLevelLabel } from '../../lib/supabase';
import {
  Plus, CreditCard as Edit2, Power, PowerOff, Image as ImageIcon, Trash2,
  ChevronLeft, ChevronRight, ChevronDown, Upload, Link as LinkIcon, X, Loader2,
  Calendar, CalendarRange, CalendarDays, Save, Moon, MapPin, Navigation,
  AlertTriangle, Images,
} from 'lucide-react';
import { Modal } from '../../components/admin/Modal';
import { ConfirmDialog } from '../../components/admin/ConfirmDialog';
import { Toast } from '../../components/admin/Toast';
import { useToast } from '../../hooks/useToast';
import { useAuth } from '../../contexts/AuthContext';
import { DAY_NAMES, formatBookableDays } from '../../lib/stayType';

interface Plan {
  id: string;
  name_he: string;
  hotel_level: string;
  monthly_amount: number;
  active: boolean;
  bookable_days: number[] | null;
}

interface HotelImage {
  id: string;
  image_url: string;
  display_order: number;
}

interface Hotel {
  id: string;
  name_he: string;
  name_en: string;
  city_he: string;
  city_en: string;
  level: string;
  description_he: string | null;
  description_en: string | null;
  base_rooms: number;
  extra_room_price: number;
  change_deadline_days: number;
  active: boolean;
  created_at: string;
  bookable_days: number[] | null;
  bookable_nights: number | null;
  address: string | null;
  map_url: string | null;
  arrival_instructions: string | null;
  room_type: string | null;
  meals: string | null;
  package_includes: string | null;
  images?: HotelImage[];
}

interface PendingImage {
  id: string;
  type: 'url' | 'file';
  url: string;
  file?: File;
  previewUrl: string;
  uploading: boolean;
  error?: string;
}

interface Availability {
  id: string;
  hotel_id: string;
  kind: 'range' | 'date';
  start_date: string;
  end_date: string | null;
}

const ACCEPTED_TYPES = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif'];
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

export const AdminHotelsPage = () => {
  const navigate = useNavigate();
  const [plans, setPlans] = useState<Plan[]>([]);
  const [selectedPlanId, setSelectedPlanId] = useState<string>('');
  const [hotels, setHotels] = useState<Hotel[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedHotelId, setExpandedHotelId] = useState<string | null>(null);

  // --- מודל פרטי מלון ---
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingHotel, setEditingHotel] = useState<Hotel | null>(null);
  const [saving, setSaving] = useState(false);
  const [confirmDialog, setConfirmDialog] = useState<{
    isOpen: boolean; hotelId: string; currentStatus: boolean; action: 'toggle' | 'delete';
  }>({ isOpen: false, hotelId: '', currentStatus: false, action: 'toggle' });
  const [currentImageIndex, setCurrentImageIndex] = useState<Record<string, number>>({});
  // "המחיר הרגיל" — כמה עולה לנו הזמנה בכל מלון (טבלת hotel_costs, מנהל בלבד)
  const [hotelCosts, setHotelCosts] = useState<Record<string, number | null>>({});
  const [pendingImages, setPendingImages] = useState<PendingImage[]>([]);
  const [urlInput, setUrlInput] = useState('');
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast, showToast, hideToast } = useToast();
  const { canEdit } = useAuth();

  const [formData, setFormData] = useState({
    name_he: '', name_en: '', city_he: '', city_en: '',
    description_he: '', description_en: '',
    base_rooms: '2', extra_room_price: '0', change_deadline_days: '7',
    room_type: '', meals: '', package_includes: '', default_cost: '',
  });

  // --- זמינות (per הרחבת מלון) ---
  const [avail, setAvail] = useState<Availability[]>([]);
  const [availLoading, setAvailLoading] = useState(false);
  const [availBusy, setAvailBusy] = useState(false);
  const [mode, setMode] = useState<'range' | 'date'>('range');
  const [start, setStart] = useState('');
  const [end, setEnd] = useState('');
  const [days, setDays] = useState<number[]>([]);
  const [nights, setNights] = useState(1);
  const [savingCfg, setSavingCfg] = useState(false);
  const [address, setAddress] = useState('');
  const [mapUrl, setMapUrl] = useState('');
  const [arrival, setArrival] = useState('');
  const [savingLoc, setSavingLoc] = useState(false);

  // --- ימי כניסה ברירת מחדל של התוכנית ---
  const [planDaysDraft, setPlanDaysDraft] = useState<number[]>([]);
  const [savingPlanDays, setSavingPlanDays] = useState(false);

  useEffect(() => { loadPlans(); }, []);
  useEffect(() => { if (selectedPlanId) loadHotels(); }, [selectedPlanId]);

  const loadPlans = async () => {
    const { data, error } = await supabase
      .from('plans').select('id, name_he, hotel_level, monthly_amount, active, bookable_days')
      .eq('active', true).order('monthly_amount', { ascending: true });
    if (error) { showToast('שגיאה בטעינת תוכניות', 'error'); setLoading(false); return; }
    setPlans(data || []);
    if (data && data.length) setSelectedPlanId(data[0].id);
    else setLoading(false);
  };

  const currentPlan = plans.find(p => p.id === selectedPlanId);

  useEffect(() => { setPlanDaysDraft(currentPlan?.bookable_days ?? []); }, [selectedPlanId, currentPlan?.bookable_days]);

  const togglePlanDay = (d: number) =>
    setPlanDaysDraft((prev) => prev.includes(d) ? prev.filter((x) => x !== d) : [...prev, d].sort((a, b) => a - b));

  const savePlanDays = async () => {
    if (!currentPlan) return;
    setSavingPlanDays(true);
    const { error } = await supabase.from('plans').update({ bookable_days: planDaysDraft }).eq('id', currentPlan.id);
    if (!error) setPlans((prev) => prev.map((p) => p.id === currentPlan.id ? { ...p, bookable_days: planDaysDraft } : p));
    setSavingPlanDays(false);
    showToast(error ? 'שגיאה: ' + error.message : '✓ נשמרה ברירת המחדל — חלה מיד על כל המלונות בתוכנית ללא חריגה עצמית', error ? 'error' : 'success');
  };

  const loadHotels = async () => {
    if (!currentPlan) return;
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('hotels')
        .select(`*, images:hotel_images(id, image_url, display_order)`)
        .eq('level', currentPlan.hotel_level)
        .order('created_at', { ascending: false });
      if (error) throw error;
      const sorted = (data || []).map((hotel: any) => ({
        ...hotel,
        images: (hotel.images || []).sort((a: HotelImage, b: HotelImage) => a.display_order - b.display_order),
      }));
      setHotels(sorted);
      if (sorted.length) {
        const { data: costs } = await supabase.from('hotel_costs').select('hotel_id, default_cost').in('hotel_id', sorted.map((h: Hotel) => h.id));
        const cmap: Record<string, number | null> = {};
        for (const c of costs ?? []) cmap[c.hotel_id] = c.default_cost;
        setHotelCosts(cmap);
      }
      const initialIndexes: Record<string, number> = {};
      sorted.forEach((hotel: Hotel) => { initialIndexes[hotel.id] = 0; });
      setCurrentImageIndex(initialIndexes);
      setExpandedHotelId(null);
    } catch (error) {
      console.error('Error loading hotels:', error);
      showToast('שגיאה בטעינת מלונות', 'error');
    } finally {
      setLoading(false);
    }
  };

  // ===== מודל פרטי מלון =====

  const handleOpenModal = (hotel?: Hotel) => {
    if (hotel) {
      setEditingHotel(hotel);
      setFormData({
        name_he: hotel.name_he, name_en: hotel.name_en,
        city_he: hotel.city_he, city_en: hotel.city_en,
        description_he: hotel.description_he || '', description_en: hotel.description_en || '',
        base_rooms: hotel.base_rooms.toString(),
        extra_room_price: hotel.extra_room_price.toString(),
        change_deadline_days: hotel.change_deadline_days.toString(),
        room_type: hotel.room_type ?? '', meals: hotel.meals ?? '', package_includes: hotel.package_includes ?? '',
        default_cost: hotelCosts[hotel.id] != null ? String(hotelCosts[hotel.id]) : '',
      });
      const existing: PendingImage[] = (hotel.images || []).map((img) => ({
        id: img.id, type: 'url', url: img.image_url, previewUrl: img.image_url, uploading: false,
      }));
      setPendingImages(existing);
    } else {
      setEditingHotel(null);
      setFormData({
        name_he: '', name_en: '', city_he: '', city_en: '',
        description_he: '', description_en: '',
        base_rooms: '2', extra_room_price: '0', change_deadline_days: '7',
        room_type: '', meals: '', package_includes: '', default_cost: '',
      });
      setPendingImages([]);
    }
    setUrlInput('');
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    pendingImages.forEach((img) => { if (img.type === 'file') URL.revokeObjectURL(img.previewUrl); });
    setIsModalOpen(false);
    setEditingHotel(null);
    setPendingImages([]);
    setUrlInput('');
  };

  const validateFile = (file: File): string | null => {
    if (!ACCEPTED_TYPES.includes(file.type)) return 'סוג קובץ לא נתמך. יש להשתמש ב-JPEG, PNG, WebP או GIF';
    if (file.size > MAX_FILE_SIZE) return 'הקובץ גדול מדי. גודל מקסימלי 10MB';
    return null;
  };

  const addFilesToPending = (files: File[]) => {
    const newImages: PendingImage[] = [];
    for (const file of files) {
      const err = validateFile(file);
      const previewUrl = URL.createObjectURL(file);
      newImages.push({
        id: `file-${Date.now()}-${Math.random()}`, type: 'file', url: '',
        file, previewUrl, uploading: false, error: err || undefined,
      });
    }
    setPendingImages((prev) => [...prev, ...newImages]);
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length > 0) addFilesToPending(files);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const files = Array.from(e.dataTransfer.files).filter((f) => ACCEPTED_TYPES.includes(f.type));
    if (files.length > 0) addFilesToPending(files);
  };

  const handleAddUrl = () => {
    const trimmed = urlInput.trim();
    if (!trimmed) return;
    try { new URL(trimmed); } catch { showToast('כתובת URL לא תקינה', 'error'); return; }
    setPendingImages((prev) => [...prev, { id: `url-${Date.now()}`, type: 'url', url: trimmed, previewUrl: trimmed, uploading: false }]);
    setUrlInput('');
  };

  const removeImage = (id: string) => {
    setPendingImages((prev) => {
      const img = prev.find((i) => i.id === id);
      if (img?.type === 'file') URL.revokeObjectURL(img.previewUrl);
      return prev.filter((i) => i.id !== id);
    });
  };

  const moveImage = (id: string, direction: 'up' | 'down') => {
    setPendingImages((prev) => {
      const idx = prev.findIndex((i) => i.id === id);
      if (idx < 0) return prev;
      const newArr = [...prev];
      const swapIdx = direction === 'up' ? idx - 1 : idx + 1;
      if (swapIdx < 0 || swapIdx >= newArr.length) return prev;
      [newArr[idx], newArr[swapIdx]] = [newArr[swapIdx], newArr[idx]];
      return newArr;
    });
  };

  const uploadFileToStorage = async (file: File): Promise<string> => {
    const ext = file.name.split('.').pop() || 'jpg';
    const path = `hotels/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
    const { error } = await supabase.storage.from('hotel-images').upload(path, file, { cacheControl: '3600', upsert: false });
    if (error) throw error;
    const { data } = supabase.storage.from('hotel-images').getPublicUrl(path);
    return data.publicUrl;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canEdit) { showToast('אין לך הרשאה לבצע פעולה זו', 'error'); return; }
    if (!currentPlan) return;

    const hasErrors = pendingImages.some((img) => img.error);
    if (hasErrors) { showToast('יש תמונות עם שגיאות. יש להסיר אותן לפני השמירה', 'error'); return; }

    setSaving(true);
    try {
      const uploadedImages: PendingImage[] = [];
      for (const img of pendingImages) {
        if (img.type === 'file' && img.file && !img.error) {
          setPendingImages((prev) => prev.map((i) => i.id === img.id ? { ...i, uploading: true } : i));
          try {
            const publicUrl = await uploadFileToStorage(img.file);
            uploadedImages.push({ ...img, url: publicUrl, uploading: false });
            setPendingImages((prev) => prev.map((i) => i.id === img.id ? { ...i, url: publicUrl, uploading: false } : i));
          } catch {
            setPendingImages((prev) => prev.map((i) => i.id === img.id ? { ...i, uploading: false, error: 'שגיאה בהעלאת התמונה' } : i));
            throw new Error(`שגיאה בהעלאת תמונה: ${img.file.name}`);
          }
        } else {
          uploadedImages.push(img);
        }
      }

      const hotelData = {
        name_he: formData.name_he, name_en: formData.name_en,
        city_he: formData.city_he, city_en: formData.city_en,
        level: currentPlan.hotel_level,
        description_he: formData.description_he || null, description_en: formData.description_en || null,
        base_rooms: parseInt(formData.base_rooms),
        extra_room_price: parseInt(formData.extra_room_price),
        change_deadline_days: parseInt(formData.change_deadline_days),
        room_type: formData.room_type.trim() || null,
        meals: formData.meals.trim() || null,
        package_includes: formData.package_includes.trim() || null,
      };

      let hotelId: string;
      if (editingHotel) {
        const { error } = await supabase.from('hotels').update(hotelData).eq('id', editingHotel.id);
        if (error) throw error;
        hotelId = editingHotel.id;
        await supabase.from('hotel_images').delete().eq('hotel_id', hotelId);
      } else {
        const { data, error } = await supabase.from('hotels').insert({ ...hotelData, active: true }).select().single();
        if (error) throw error;
        hotelId = data.id;
      }

      const validImages = uploadedImages.filter((img) => img.url.trim() !== '');
      if (validImages.length > 0) {
        const imageRecords = validImages.map((img, index) => ({ hotel_id: hotelId, image_url: img.url.trim(), display_order: index }));
        const { error: imageError } = await supabase.from('hotel_images').insert(imageRecords);
        if (imageError) throw imageError;
      }

      const cost = formData.default_cost.trim() === '' ? null : Number(formData.default_cost);
      const { error: costError } = await supabase.from('hotel_costs')
        .upsert({ hotel_id: hotelId, default_cost: cost, updated_at: new Date().toISOString() });
      if (costError) throw costError;

      showToast(editingHotel ? 'המלון עודכן בהצלחה' : 'המלון נוסף לתוכנית בהצלחה', 'success');
      handleCloseModal();
      loadHotels();
    } catch (error: any) {
      console.error('Error saving hotel:', error);
      showToast(error?.message || 'שגיאה בשמירת המלון', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleToggleActive = async () => {
    if (!canEdit) { showToast('אין לך הרשאה לבצע פעולה זו', 'error'); return; }
    try {
      const { error } = await supabase.from('hotels').update({ active: !confirmDialog.currentStatus }).eq('id', confirmDialog.hotelId);
      if (error) throw error;
      showToast(confirmDialog.currentStatus ? 'המלון הושבת' : 'המלון הופעל', 'success');
      loadHotels();
    } catch (error) {
      console.error('Error toggling hotel status:', error);
      showToast('שגיאה בעדכון סטטוס המלון', 'error');
    }
  };

  const handleDelete = async () => {
    if (!canEdit) { showToast('אין לך הרשאה לבצע פעולה זו', 'error'); return; }
    try {
      await supabase.from('hotel_images').delete().eq('hotel_id', confirmDialog.hotelId);
      await supabase.from('hotel_availability').delete().eq('hotel_id', confirmDialog.hotelId);
      const { error } = await supabase.from('hotels').delete().eq('id', confirmDialog.hotelId);
      if (error) throw error;
      showToast('המלון נמחק בהצלחה', 'success');
      loadHotels();
    } catch (error) {
      console.error('Error deleting hotel:', error);
      showToast('שגיאה במחיקת מלון', 'error');
    }
  };

  const handleConfirmAction = () => {
    if (confirmDialog.action === 'delete') handleDelete();
    else handleToggleActive();
    setConfirmDialog({ ...confirmDialog, isOpen: false });
  };

  const nextImage = (hotelId: string, count: number) =>
    setCurrentImageIndex((prev) => ({ ...prev, [hotelId]: (prev[hotelId] + 1) % count }));
  const prevImage = (hotelId: string, count: number) =>
    setCurrentImageIndex((prev) => ({ ...prev, [hotelId]: prev[hotelId] === 0 ? count - 1 : prev[hotelId] - 1 }));

  const anyUploading = pendingImages.some((img) => img.uploading);

  // ===== זמינות (בתוך הרחבת מלון) =====

  const toggleExpand = async (hotel: Hotel) => {
    if (expandedHotelId === hotel.id) { setExpandedHotelId(null); return; }
    setExpandedHotelId(hotel.id);
    setDays(hotel.bookable_days ?? []);
    setNights(hotel.bookable_nights ?? 1);
    setAddress(hotel.address ?? '');
    setMapUrl(hotel.map_url ?? '');
    setArrival(hotel.arrival_instructions ?? '');
    setStart(''); setEnd(''); setMode('range');
    setAvailLoading(true);
    const { data } = await supabase.from('hotel_availability').select('*').eq('hotel_id', hotel.id).order('start_date');
    setAvail((data ?? []) as Availability[]);
    setAvailLoading(false);
  };

  const toggleDay = (d: number) => setDays((prev) => prev.includes(d) ? prev.filter((x) => x !== d) : [...prev, d].sort());

  const saveLocation = async (hotelId: string) => {
    setSavingLoc(true);
    const payload = { address: address || null, map_url: mapUrl || null, arrival_instructions: arrival || null };
    const { error } = await supabase.from('hotels').update(payload).eq('id', hotelId);
    setHotels((prev) => prev.map((h) => h.id === hotelId ? { ...h, ...payload } : h));
    setSavingLoc(false);
    showToast(error ? 'שגיאה: ' + error.message : '✓ נשמרו פרטי הגעה', error ? 'error' : 'success');
  };

  const saveConfig = async (hotelId: string) => {
    setSavingCfg(true);
    const { error } = await supabase.from('hotels').update({ bookable_days: days, bookable_nights: nights }).eq('id', hotelId);
    setHotels((prev) => prev.map((h) => h.id === hotelId ? { ...h, bookable_days: days, bookable_nights: nights } : h));
    setSavingCfg(false);
    showToast(error ? 'שגיאה: ' + error.message : '✓ נשמרו כללי ההזמנה', error ? 'error' : 'success');
  };

  const addAvail = async (hotelId: string) => {
    if (!start) { showToast('יש לבחור תאריך', 'error'); return; }
    if (mode === 'range' && !end) { showToast('בטווח יש למלא תאריך סיום', 'error'); return; }
    if (mode === 'range' && end < start) { showToast('תאריך הסיום לפני ההתחלה', 'error'); return; }
    setAvailBusy(true);
    const { error } = await supabase.from('hotel_availability').insert({
      hotel_id: hotelId, kind: mode, start_date: start, end_date: mode === 'range' ? end : null,
    });
    setAvailBusy(false);
    if (error) { showToast('שגיאה: ' + error.message, 'error'); return; }
    setStart(''); setEnd('');
    const { data } = await supabase.from('hotel_availability').select('*').eq('hotel_id', hotelId).order('start_date');
    setAvail((data ?? []) as Availability[]);
    showToast('✓ נוסף', 'success');
  };

  const removeAvail = async (id: string, hotelId: string) => {
    await supabase.from('hotel_availability').delete().eq('id', id);
    const { data } = await supabase.from('hotel_availability').select('*').eq('hotel_id', hotelId).order('start_date');
    setAvail((data ?? []) as Availability[]);
    showToast('נמחק', 'success');
  };

  const fmt = (d: string) => new Date(d).toLocaleDateString('he-IL', { day: 'numeric', month: 'short', year: 'numeric' });

  if (loading && !currentPlan) {
    return (
      <AdminLayout>
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#0B3C5D]"></div>
        </div>
      </AdminLayout>
    );
  }

  if (!plans.length) {
    return (
      <AdminLayout>
        <div className="text-center py-12">
          <p className="text-gray-600">אין תוכניות פעילות. יש ליצור תוכנית תחילה במסך "תוכניות".</p>
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">מלונות ותוכניות</h1>
        <p className="text-gray-600 mt-1">לכל תוכנית — המלונות שלה, ולכל מלון — הזמינות שלו. מסך אחד, בלי לקפוץ בין מסכים.</p>
      </div>

      {/* בורר תוכנית */}
      <div className="mb-6 flex flex-wrap gap-2">
        {plans.map((p) => (
          <button
            key={p.id}
            onClick={() => setSelectedPlanId(p.id)}
            className={`px-4 py-2.5 rounded-xl text-sm font-semibold transition-all ${
              selectedPlanId === p.id ? 'bg-[#0B3C5D] text-white shadow-sm' : 'bg-white text-gray-700 border border-gray-200 hover:bg-gray-50'
            }`}
          >
            {p.name_he} <span className="opacity-60">· ₪{p.monthly_amount}</span>
          </button>
        ))}
      </div>

      {currentPlan && (
        <div className="mb-4 flex items-center justify-between">
          <p className="text-sm text-gray-500">
            רמת מלון בתוכנית זו: <span className="font-semibold text-gray-700">{hotelLevelLabel(currentPlan.hotel_level)}</span>
          </p>
          {canEdit && (
            <button
              onClick={() => handleOpenModal()}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-semibold"
            >
              <Plus size={18} />
              <span>הוסף מלון לתוכנית</span>
            </button>
          )}
        </div>
      )}

      {currentPlan && canEdit && (
        <div className="mb-6 bg-white rounded-xl border border-gray-200 p-4">
          <h3 className="text-sm font-bold text-gray-900 mb-1">ימי כניסה ברירת מחדל — לכל המלונות בתוכנית "{currentPlan.name_he}"</h3>
          <p className="text-xs text-gray-400 mb-3">שינוי כאן חל מיד על כל מלון בתוכנית שאין לו הגדרת ימים עצמית. מלון עם חריגה (בפירוט הזמינות שלו) ימשיך להתנהג לפי החריגה שלו.</p>
          <div className="flex flex-wrap gap-1.5 mb-3">
            {DAY_NAMES.map((name, i) => (
              <button key={i} onClick={() => togglePlanDay(i)}
                className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-all ${planDaysDraft.includes(i) ? 'bg-[#0B3C5D] text-white' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'}`}>
                {name}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-3">
            <button onClick={savePlanDays} disabled={savingPlanDays}
              className="px-4 py-2 rounded-lg bg-[#0B3C5D] text-white text-sm font-semibold hover:bg-[#0B3C5D]/90 transition-all flex items-center gap-2 disabled:opacity-50">
              {savingPlanDays ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />} שמור ברירת מחדל לתוכנית
            </button>
            <span className="text-xs text-gray-400">{formatBookableDays(planDaysDraft)}</span>
          </div>
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center h-40">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-[#0B3C5D]"></div>
        </div>
      ) : hotels.length === 0 ? (
        <div className="text-center py-12 bg-white rounded-xl border border-gray-200">
          <ImageIcon className="mx-auto text-gray-400 mb-4" size={48} />
          <p className="text-gray-600">אין עדיין מלונות בתוכנית זו</p>
        </div>
      ) : (
        <div className="space-y-4">
          {hotels.map((hotel) => {
            const currentIndex = currentImageIndex[hotel.id] || 0;
            const hasImages = hotel.images && hotel.images.length > 0;
            const isExpanded = expandedHotelId === hotel.id;
            const missingLocation = !hotel.address || !hotel.map_url;
            return (
              <div key={hotel.id} className={`bg-white rounded-xl shadow-sm overflow-hidden border-2 ${hotel.active ? 'border-green-200' : 'border-gray-200'}`}>
                <div className="flex flex-col md:flex-row">
                  <div className="relative h-44 md:h-auto md:w-56 shrink-0 bg-gray-200">
                    {hasImages ? (
                      <>
                        <img src={hotel.images![currentIndex].image_url} alt={hotel.name_he} className="w-full h-full object-cover" />
                        {hotel.images!.length > 1 && (
                          <>
                            <button onClick={() => prevImage(hotel.id, hotel.images!.length)} className="absolute left-2 top-1/2 -translate-y-1/2 bg-black/50 hover:bg-black/70 text-white p-1.5 rounded-full transition-colors">
                              <ChevronRight size={16} />
                            </button>
                            <button onClick={() => nextImage(hotel.id, hotel.images!.length)} className="absolute right-2 top-1/2 -translate-y-1/2 bg-black/50 hover:bg-black/70 text-white p-1.5 rounded-full transition-colors">
                              <ChevronLeft size={16} />
                            </button>
                          </>
                        )}
                      </>
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <ImageIcon className="text-gray-400" size={40} />
                      </div>
                    )}
                    <div className="absolute top-2 left-2">
                      <span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${hotel.active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-700'}`}>
                        {hotel.active ? 'פעיל' : 'לא פעיל'}
                      </span>
                    </div>
                  </div>

                  <div className="flex-1 p-4">
                    <div className="flex items-start justify-between gap-3 flex-wrap">
                      <div>
                        <h3 className="text-lg font-bold text-gray-900">{hotel.name_he}</h3>
                        <p className="text-sm text-gray-600">{hotel.city_he}</p>
                        {missingLocation && (
                          <div className="mt-1.5 flex items-center gap-1.5 text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-2.5 py-1 w-fit">
                            <AlertTriangle size={12} /> חסרים פרטי מיקום
                          </div>
                        )}
                      </div>
                      {canEdit && (
                        <div className="flex flex-wrap gap-2">
                          <button onClick={() => navigate('/admin/vacation-gallery')}
                            className="inline-flex items-center gap-1.5 px-3 py-2 bg-[#626D58]/10 text-[#626D58] rounded-lg hover:bg-[#626D58]/20 transition-colors text-sm font-semibold">
                            <Images size={15} /> קטלוג ציבורי
                          </button>
                          <button onClick={() => handleOpenModal(hotel)}
                            className="inline-flex items-center gap-1.5 px-3 py-2 bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-100 transition-colors text-sm font-semibold">
                            <Edit2 size={15} /> עריכה
                          </button>
                          <button onClick={() => setConfirmDialog({ isOpen: true, hotelId: hotel.id, currentStatus: hotel.active, action: 'toggle' })}
                            className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-lg transition-colors text-sm font-semibold ${hotel.active ? 'bg-red-50 text-red-600 hover:bg-red-100' : 'bg-green-50 text-green-600 hover:bg-green-100'}`}>
                            {hotel.active ? <PowerOff size={15} /> : <Power size={15} />} {hotel.active ? 'השבת' : 'הפעל'}
                          </button>
                          <button onClick={() => setConfirmDialog({ isOpen: true, hotelId: hotel.id, currentStatus: hotel.active, action: 'delete' })}
                            className="inline-flex items-center gap-1.5 px-3 py-2 bg-red-50 text-red-600 rounded-lg hover:bg-red-100 transition-colors text-sm font-semibold">
                            <Trash2 size={15} /> מחק
                          </button>
                        </div>
                      )}
                    </div>

                    <button onClick={() => toggleExpand(hotel)}
                      className="mt-3 inline-flex items-center gap-1.5 text-sm font-semibold text-[#0B3C5D] hover:opacity-70 transition-opacity">
                      <Calendar size={15} />
                      זמינות ותאריכים
                      <ChevronDown size={15} className={`transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
                    </button>
                  </div>
                </div>

                {isExpanded && (
                  <div className="border-t border-gray-200 bg-gray-50/60 p-4 md:p-5">
                    {availLoading ? (
                      <div className="flex justify-center py-8"><Loader2 className="animate-spin text-[#626D58]" size={24} /></div>
                    ) : (
                      <div className="grid lg:grid-cols-3 gap-5">
                        {/* פרטי הגעה */}
                        <div className="bg-white rounded-xl border border-gray-200 p-4">
                          <h4 className="text-sm font-bold text-gray-900 mb-3 flex items-center gap-1.5"><MapPin size={14} className="text-[#626D58]" /> פרטי הגעה</h4>
                          <label className="block text-xs text-gray-500 mb-1">כתובת מדויקת</label>
                          <input value={address} onChange={(e) => setAddress(e.target.value)} placeholder="רחוב, מספר, עיר"
                            className="w-full px-3 py-2 mb-3 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#0B3C5D]" />
                          <label className="block text-xs text-gray-500 mb-1">קישור Google Maps</label>
                          <input value={mapUrl} onChange={(e) => setMapUrl(e.target.value)} placeholder="https://maps.google.com/..." dir="ltr"
                            className="w-full px-3 py-2 mb-3 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#0B3C5D]" />
                          <label className="block text-xs text-gray-500 mb-1">הוראות הגעה / הערות</label>
                          <textarea value={arrival} onChange={(e) => setArrival(e.target.value)} rows={3} placeholder="לדוגמה: צ'ק-אין מ-15:00..."
                            className="w-full px-3 py-2 mb-3 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#0B3C5D] resize-none" />
                          <button onClick={() => saveLocation(hotel.id)} disabled={savingLoc}
                            className="w-full py-2.5 rounded-lg bg-[#626D58] text-white text-sm font-semibold hover:bg-[#626D58]/90 transition-all flex items-center justify-center gap-2 disabled:opacity-50">
                            {savingLoc ? <Loader2 size={14} className="animate-spin" /> : <Navigation size={14} />} שמור פרטי הגעה
                          </button>
                        </div>

                        {/* כללי הזמנה */}
                        <div className="bg-white rounded-xl border border-gray-200 p-4">
                          <h4 className="text-sm font-bold text-gray-900 mb-3">כללי הזמנה</h4>
                          <label className="block text-xs text-gray-500 mb-2">ימי כניסה מותרים — חריגה למלון זה בלבד</label>
                          <div className="flex flex-wrap gap-1.5 mb-2">
                            {DAY_NAMES.map((name, i) => (
                              <button key={i} onClick={() => toggleDay(i)}
                                className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-all ${days.includes(i) ? 'bg-[#626D58] text-white' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'}`}>
                                {name}
                              </button>
                            ))}
                          </div>
                          {days.length === 0 ? (
                            <p className="text-[10px] text-gray-400 mb-3">אין חריגה — עוקב אחרי ברירת המחדל של התוכנית: <span className="font-semibold">{formatBookableDays(currentPlan?.bookable_days)}</span></p>
                          ) : (
                            <div className="flex items-center gap-2 mb-3">
                              <p className="text-[10px] text-amber-600">חריגה פעילה ({days.length} ימים) — דורסת את ברירת המחדל של התוכנית</p>
                              <button onClick={() => setDays([])} className="text-[10px] font-semibold text-[#626D58] hover:underline">נקה חריגה</button>
                            </div>
                          )}
                          <label className="block text-xs text-gray-500 mb-1">מספר לילות</label>
                          <div className="flex items-center gap-2 mb-3">
                            <Moon size={14} className="text-[#626D58]" />
                            <input type="number" min={1} max={14} value={nights}
                              onChange={(e) => setNights(Math.max(1, parseInt(e.target.value) || 1))}
                              className="w-20 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#0B3C5D]" />
                            <span className="text-xs text-gray-500">לילות לשהייה</span>
                          </div>
                          <button onClick={() => saveConfig(hotel.id)} disabled={savingCfg}
                            className="w-full py-2.5 rounded-lg bg-[#0B3C5D] text-white text-sm font-semibold hover:bg-[#0B3C5D]/90 transition-all flex items-center justify-center gap-2 disabled:opacity-50">
                            {savingCfg ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />} שמור כללים
                          </button>
                        </div>

                        {/* הוספת זמינות + רשימה */}
                        <div className="bg-white rounded-xl border border-gray-200 p-4">
                          <h4 className="text-sm font-bold text-gray-900 mb-3">תקופות זמינות</h4>
                          <div className="flex gap-2 mb-3">
                            <button onClick={() => setMode('range')}
                              className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-semibold transition-all ${mode === 'range' ? 'bg-[#0B3C5D] text-white' : 'bg-gray-100 text-gray-500'}`}>
                              <CalendarRange size={13} /> טווח
                            </button>
                            <button onClick={() => setMode('date')}
                              className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-semibold transition-all ${mode === 'date' ? 'bg-[#0B3C5D] text-white' : 'bg-gray-100 text-gray-500'}`}>
                              <CalendarDays size={13} /> תאריך בודד
                            </button>
                          </div>
                          <label className="block text-xs text-gray-500 mb-1">{mode === 'range' ? 'מתאריך' : 'תאריך'}</label>
                          <input type="date" value={start} onChange={(e) => setStart(e.target.value)}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm mb-2 focus:outline-none focus:ring-2 focus:ring-[#0B3C5D]" />
                          {mode === 'range' && (
                            <>
                              <label className="block text-xs text-gray-500 mb-1">עד תאריך</label>
                              <input type="date" value={end} onChange={(e) => setEnd(e.target.value)}
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm mb-2 focus:outline-none focus:ring-2 focus:ring-[#0B3C5D]" />
                            </>
                          )}
                          <button onClick={() => addAvail(hotel.id)} disabled={availBusy}
                            className="w-full mb-4 py-2.5 rounded-lg bg-[#626D58] text-white text-sm font-semibold hover:bg-[#626D58]/90 transition-all flex items-center justify-center gap-2 disabled:opacity-50">
                            {availBusy ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />} הוסף
                          </button>

                          {avail.length === 0 ? (
                            <p className="text-center text-xs text-gray-400 py-3">עדיין לא הוגדרה זמינות</p>
                          ) : (
                            <div className="space-y-1.5 max-h-52 overflow-y-auto">
                              {avail.map((a) => (
                                <div key={a.id} className="flex items-center justify-between bg-gray-50 rounded-lg px-3 py-2">
                                  <span className="text-xs font-semibold text-gray-700">
                                    {a.kind === 'range' ? `${fmt(a.start_date)} — ${a.end_date ? fmt(a.end_date) : ''}` : fmt(a.start_date)}
                                  </span>
                                  <button onClick={() => removeAvail(a.id, hotel.id)} className="p-1 rounded-md text-red-400 hover:text-red-600 hover:bg-red-50 transition-all">
                                    <Trash2 size={14} />
                                  </button>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      <Modal isOpen={isModalOpen} onClose={handleCloseModal} title={editingHotel ? 'עריכת מלון' : `הוספת מלון לתוכנית "${currentPlan?.name_he ?? ''}"`}>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">שם בעברית *</label>
              <input type="text" required value={formData.name_he}
                onChange={(e) => setFormData({ ...formData, name_he: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">שם באנגלית *</label>
              <input type="text" required value={formData.name_en}
                onChange={(e) => setFormData({ ...formData, name_en: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">עיר בעברית *</label>
              <input type="text" required value={formData.city_he}
                onChange={(e) => setFormData({ ...formData, city_he: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">עיר באנגלית *</label>
              <input type="text" required value={formData.city_en}
                onChange={(e) => setFormData({ ...formData, city_en: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent" />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">תוכנית (רמת מלון)</label>
            <div className="w-full px-3 py-2 border border-gray-200 rounded-lg bg-gray-50 text-gray-600 text-sm">
              {currentPlan?.name_he} — {hotelLevelLabel(currentPlan?.hotel_level || '')}
            </div>
            <p className="text-xs text-gray-400 mt-1">נקבע לפי התוכנית שבחרת למעלה. כדי לשייך מלון לתוכנית אחרת, עברו לתוכנית ההיא לפני ההוספה.</p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">תיאור בעברית</label>
            <textarea value={formData.description_he} onChange={(e) => setFormData({ ...formData, description_he: e.target.value })}
              rows={2} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent" />
          </div>

          {/* העלות שלנו — לחישוב רווחיות. נשמר בטבלה נפרדת שהלקוח לא יכול לקרוא */}
          <div className="rounded-xl border border-gray-200 bg-gray-50 p-4">
            <label className="block text-sm font-semibold text-gray-800 mb-1">העלות שלנו להזמנה (מחיר רגיל) ₪</label>
            <input type="number" min="0" step="1" value={formData.default_cost} placeholder="לדוגמה: 2000"
              onChange={(e) => setFormData({ ...formData, default_cost: e.target.value })}
              className="w-48 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent" />
            <p className="text-xs text-gray-500 mt-1">גלוי רק למנהל. בכל הזמנה אפשר לבחור את המחיר הזה או להזין מחיר אחר.</p>
          </div>

          {/* מה מקבלים — מוצג ללקוח בכפתור "עוד" ליד שם המלון */}
          <div className="rounded-xl border border-amber-200 bg-amber-50/40 p-4 space-y-3">
            <div>
              <p className="text-sm font-semibold text-gray-800">מה מקבלים במקום הזה</p>
              <p className="text-xs text-gray-500">מוצג ללקוח כשהוא לוחץ "עוד" ליד שם המלון. אפשר להשאיר ריק.</p>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">סוג חדר</label>
                <input type="text" value={formData.room_type} placeholder="לדוגמה: חדר זוגי סטנדרט"
                  onChange={(e) => setFormData({ ...formData, room_type: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">ארוחות</label>
                <input type="text" value={formData.meals} placeholder="לדוגמה: ארוחת בוקר + ארוחת ערב"
                  onChange={(e) => setFormData({ ...formData, meals: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent" />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">עוד בחבילה</label>
              <textarea value={formData.package_includes} rows={3}
                placeholder={'כל שורה תוצג כסעיף נפרד. לדוגמה:\nכניסה לבריכה\nחניה חינם\nצ׳ק-אאוט מאוחר בשבת'}
                onChange={(e) => setFormData({ ...formData, package_includes: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent" />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">חדרים בסיס *</label>
              <input type="number" required min="1" value={formData.base_rooms}
                onChange={(e) => setFormData({ ...formData, base_rooms: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">מחיר חדר נוסף *</label>
              <input type="number" required min="0" value={formData.extra_room_price}
                onChange={(e) => setFormData({ ...formData, extra_room_price: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">ימי הודעה לשינוי *</label>
              <input type="number" required min="0" value={formData.change_deadline_days}
                onChange={(e) => setFormData({ ...formData, change_deadline_days: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent" />
            </div>
          </div>

          <div className="border-t border-gray-200 pt-4">
            <label className="block text-sm font-medium text-gray-700 mb-3">
              תמונות מלון
              {pendingImages.length > 0 && <span className="mr-2 text-xs font-normal text-gray-500">({pendingImages.length} תמונות)</span>}
            </label>

            <div
              onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
              onDragLeave={() => setDragOver(false)}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              className={`relative border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition-all mb-3 ${
                dragOver ? 'border-blue-500 bg-blue-50' : 'border-gray-300 bg-gray-50 hover:border-blue-400 hover:bg-blue-50/50'
              }`}
            >
              <input ref={fileInputRef} type="file" accept={ACCEPTED_TYPES.join(',')} multiple onChange={handleFileSelect} className="hidden" />
              <Upload className="mx-auto text-gray-400 mb-2" size={28} />
              <p className="text-sm font-medium text-gray-700">גרור תמונות לכאן או לחץ לבחירה</p>
              <p className="text-xs text-gray-500 mt-1">JPEG, PNG, WebP, GIF · עד 10MB לתמונה</p>
            </div>

            <div className="flex gap-2 mb-3">
              <div className="flex-1 relative">
                <LinkIcon size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input type="url" placeholder="או הדבק כתובת URL לתמונה" value={urlInput}
                  onChange={(e) => setUrlInput(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), handleAddUrl())}
                  className="w-full pr-9 pl-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent" />
              </div>
              <button type="button" onClick={handleAddUrl} disabled={!urlInput.trim()}
                className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors text-sm font-medium disabled:opacity-40 disabled:cursor-not-allowed">
                הוסף
              </button>
            </div>

            {pendingImages.length > 0 && (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {pendingImages.map((img, index) => (
                  <div key={img.id} className={`relative group rounded-xl overflow-hidden border-2 bg-gray-100 aspect-video ${img.error ? 'border-red-400' : 'border-gray-200'}`}>
                    <img src={img.previewUrl} alt="" className="w-full h-full object-cover"
                      onError={(e) => { (e.target as HTMLImageElement).src = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='100' height='100'%3E%3Crect fill='%23e5e7eb' width='100' height='100'/%3E%3Ctext fill='%239ca3af' font-size='14' x='50%25' y='50%25' text-anchor='middle' dy='.35em'%3EX%3C/text%3E%3C/svg%3E"; }} />
                    {img.uploading && (
                      <div className="absolute inset-0 bg-black/50 flex flex-col items-center justify-center">
                        <Loader2 className="text-white animate-spin mb-1" size={20} />
                        <span className="text-white text-xs">מעלה...</span>
                      </div>
                    )}
                    {img.error && !img.uploading && (
                      <div className="absolute inset-0 bg-red-500/80 flex items-center justify-center p-1">
                        <span className="text-white text-xs text-center leading-tight">{img.error}</span>
                      </div>
                    )}
                    {!img.uploading && (
                      <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-all">
                        <div className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 transition-opacity flex gap-1">
                          <button type="button" onClick={() => removeImage(img.id)} className="w-6 h-6 bg-red-500 hover:bg-red-600 text-white rounded-full flex items-center justify-center">
                            <X size={12} />
                          </button>
                        </div>
                        <div className="absolute bottom-1 left-1/2 -translate-x-1/2 opacity-0 group-hover:opacity-100 transition-opacity flex gap-1">
                          {index > 0 && (
                            <button type="button" onClick={() => moveImage(img.id, 'up')} className="w-6 h-6 bg-black/60 hover:bg-black/80 text-white rounded-full flex items-center justify-center" title="הזז שמאלה">
                              <ChevronRight size={12} />
                            </button>
                          )}
                          {index < pendingImages.length - 1 && (
                            <button type="button" onClick={() => moveImage(img.id, 'down')} className="w-6 h-6 bg-black/60 hover:bg-black/80 text-white rounded-full flex items-center justify-center" title="הזז ימינה">
                              <ChevronLeft size={12} />
                            </button>
                          )}
                        </div>
                      </div>
                    )}
                    <div className="absolute top-1 left-1"><span className="bg-black/60 text-white text-xs px-1.5 py-0.5 rounded-md">{index + 1}</span></div>
                    <div className="absolute bottom-1 right-1">
                      {img.type === 'file' ? <span className="bg-blue-500/80 text-white text-xs px-1.5 py-0.5 rounded-md">קובץ</span> : <span className="bg-gray-500/80 text-white text-xs px-1.5 py-0.5 rounded-md">URL</span>}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {pendingImages.length === 0 && <p className="text-xs text-gray-500 text-center py-2">לא נבחרו תמונות עדיין</p>}
          </div>

          <div className="flex gap-3 pt-4 border-t border-gray-100">
            <button type="submit" disabled={saving || anyUploading}
              className="flex-1 flex items-center justify-center gap-2 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-60 disabled:cursor-not-allowed">
              {saving ? (<><Loader2 size={16} className="animate-spin" /><span>שומר...</span></>) : (<span>{editingHotel ? 'עדכן' : 'הוסף'}</span>)}
            </button>
            <button type="button" onClick={handleCloseModal} disabled={saving}
              className="flex-1 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors disabled:opacity-60">
              ביטול
            </button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        isOpen={confirmDialog.isOpen}
        onClose={() => setConfirmDialog({ ...confirmDialog, isOpen: false })}
        onConfirm={handleConfirmAction}
        title={confirmDialog.action === 'delete' ? 'מחיקת מלון' : confirmDialog.currentStatus ? 'השבתת מלון' : 'הפעלת מלון'}
        message={
          confirmDialog.action === 'delete'
            ? 'האם אתה בטוח שברצונך למחוק את המלון? כל התמונות והזמינות הקשורים יימחקו גם כן. פעולה זו בלתי הפיכה.'
            : confirmDialog.currentStatus
            ? 'האם אתה בטוח שברצונך להשבית את המלון? המלון לא יהיה זמין למנויים.'
            : 'האם אתה בטוח שברצונך להפעיל את המלון? המלון יהיה זמין למנויים.'
        }
        type={confirmDialog.action === 'delete' ? 'danger' : confirmDialog.currentStatus ? 'warning' : 'info'}
      />

      {toast.isOpen && <Toast message={toast.message} type={toast.type} onClose={hideToast} />}
    </AdminLayout>
  );
};
