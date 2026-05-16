import { useEffect, useState, useRef } from 'react';
import { AdminLayout } from '../../components/AdminLayout';
import { supabase } from '../../lib/supabase';
import { Plus, CreditCard as Edit2, Power, PowerOff, Image as ImageIcon, Trash2, ChevronLeft, ChevronRight, Upload, Link as LinkIcon, X, Loader2 } from 'lucide-react';
import { Modal } from '../../components/admin/Modal';
import { ConfirmDialog } from '../../components/admin/ConfirmDialog';
import { Toast } from '../../components/admin/Toast';
import { useToast } from '../../hooks/useToast';
import { useAuth } from '../../contexts/AuthContext';

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

const ACCEPTED_TYPES = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif'];
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

export const AdminHotelsPage = () => {
  const [hotels, setHotels] = useState<Hotel[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingHotel, setEditingHotel] = useState<Hotel | null>(null);
  const [saving, setSaving] = useState(false);
  const [confirmDialog, setConfirmDialog] = useState<{
    isOpen: boolean;
    hotelId: string;
    currentStatus: boolean;
    action: 'toggle' | 'delete';
  }>({ isOpen: false, hotelId: '', currentStatus: false, action: 'toggle' });
  const [currentImageIndex, setCurrentImageIndex] = useState<Record<string, number>>({});
  const [pendingImages, setPendingImages] = useState<PendingImage[]>([]);
  const [urlInput, setUrlInput] = useState('');
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast, showToast, hideToast } = useToast();
  const { canEdit } = useAuth();

  const [formData, setFormData] = useState({
    name_he: '',
    name_en: '',
    city_he: '',
    city_en: '',
    level: 'bronze',
    description_he: '',
    description_en: '',
    base_rooms: '2',
    extra_room_price: '0',
    change_deadline_days: '7',
  });

  useEffect(() => {
    loadHotels();
  }, []);

  const loadHotels = async () => {
    try {
      const { data, error } = await supabase
        .from('hotels')
        .select(`*, images:hotel_images(id, image_url, display_order)`)
        .order('created_at', { ascending: false });

      if (error) throw error;
      const sorted = (data || []).map((hotel: any) => ({
        ...hotel,
        images: (hotel.images || []).sort((a: HotelImage, b: HotelImage) => a.display_order - b.display_order),
      }));
      setHotels(sorted);
      const initialIndexes: Record<string, number> = {};
      sorted.forEach((hotel: Hotel) => { initialIndexes[hotel.id] = 0; });
      setCurrentImageIndex(initialIndexes);
    } catch (error) {
      console.error('Error loading hotels:', error);
      showToast('שגיאה בטעינת מלונות', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleOpenModal = (hotel?: Hotel) => {
    if (hotel) {
      setEditingHotel(hotel);
      setFormData({
        name_he: hotel.name_he,
        name_en: hotel.name_en,
        city_he: hotel.city_he,
        city_en: hotel.city_en,
        level: hotel.level,
        description_he: hotel.description_he || '',
        description_en: hotel.description_en || '',
        base_rooms: hotel.base_rooms.toString(),
        extra_room_price: hotel.extra_room_price.toString(),
        change_deadline_days: hotel.change_deadline_days.toString(),
      });
      const existing: PendingImage[] = (hotel.images || []).map((img) => ({
        id: img.id,
        type: 'url',
        url: img.image_url,
        previewUrl: img.image_url,
        uploading: false,
      }));
      setPendingImages(existing);
    } else {
      setEditingHotel(null);
      setFormData({
        name_he: '', name_en: '', city_he: '', city_en: '',
        level: 'bronze', description_he: '', description_en: '',
        base_rooms: '2', extra_room_price: '0', change_deadline_days: '7',
      });
      setPendingImages([]);
    }
    setUrlInput('');
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    pendingImages.forEach((img) => {
      if (img.type === 'file') URL.revokeObjectURL(img.previewUrl);
    });
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
        id: `file-${Date.now()}-${Math.random()}`,
        type: 'file',
        url: '',
        file,
        previewUrl,
        uploading: false,
        error: err || undefined,
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
    setPendingImages((prev) => [
      ...prev,
      { id: `url-${Date.now()}`, type: 'url', url: trimmed, previewUrl: trimmed, uploading: false },
    ]);
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
    const { error } = await supabase.storage.from('hotel-images').upload(path, file, {
      cacheControl: '3600',
      upsert: false,
    });
    if (error) throw error;
    const { data } = supabase.storage.from('hotel-images').getPublicUrl(path);
    return data.publicUrl;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canEdit) { showToast('אין לך הרשאה לבצע פעולה זו', 'error'); return; }

    const hasErrors = pendingImages.some((img) => img.error);
    if (hasErrors) { showToast('יש תמונות עם שגיאות. יש להסיר אותן לפני השמירה', 'error'); return; }

    setSaving(true);

    try {
      // Upload all pending file images
      const uploadedImages: PendingImage[] = [];
      for (const img of pendingImages) {
        if (img.type === 'file' && img.file && !img.error) {
          setPendingImages((prev) =>
            prev.map((i) => i.id === img.id ? { ...i, uploading: true } : i)
          );
          try {
            const publicUrl = await uploadFileToStorage(img.file);
            uploadedImages.push({ ...img, url: publicUrl, uploading: false });
            setPendingImages((prev) =>
              prev.map((i) => i.id === img.id ? { ...i, url: publicUrl, uploading: false } : i)
            );
          } catch (uploadErr) {
            setPendingImages((prev) =>
              prev.map((i) => i.id === img.id ? { ...i, uploading: false, error: 'שגיאה בהעלאת התמונה' } : i)
            );
            throw new Error(`שגיאה בהעלאת תמונה: ${img.file.name}`);
          }
        } else {
          uploadedImages.push(img);
        }
      }

      const hotelData = {
        name_he: formData.name_he,
        name_en: formData.name_en,
        city_he: formData.city_he,
        city_en: formData.city_en,
        level: formData.level,
        description_he: formData.description_he || null,
        description_en: formData.description_en || null,
        base_rooms: parseInt(formData.base_rooms),
        extra_room_price: parseInt(formData.extra_room_price),
        change_deadline_days: parseInt(formData.change_deadline_days),
      };

      let hotelId: string;

      if (editingHotel) {
        const { error } = await supabase.from('hotels').update(hotelData).eq('id', editingHotel.id);
        if (error) throw error;
        hotelId = editingHotel.id;
        await supabase.from('hotel_images').delete().eq('hotel_id', hotelId);
      } else {
        const { data, error } = await supabase
          .from('hotels').insert({ ...hotelData, active: true }).select().single();
        if (error) throw error;
        hotelId = data.id;
      }

      const validImages = uploadedImages.filter((img) => img.url.trim() !== '');
      if (validImages.length > 0) {
        const imageRecords = validImages.map((img, index) => ({
          hotel_id: hotelId,
          image_url: img.url.trim(),
          display_order: index,
        }));
        const { error: imageError } = await supabase.from('hotel_images').insert(imageRecords);
        if (imageError) throw imageError;
      }

      showToast(editingHotel ? 'המלון עודכן בהצלחה' : 'המלון נוסף בהצלחה', 'success');
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
      const { error } = await supabase
        .from('hotels').update({ active: !confirmDialog.currentStatus }).eq('id', confirmDialog.hotelId);
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
    setCurrentImageIndex((prev) => ({
      ...prev,
      [hotelId]: prev[hotelId] === 0 ? count - 1 : prev[hotelId] - 1,
    }));

  const anyUploading = pendingImages.some((img) => img.uploading);

  if (loading) {
    return (
      <AdminLayout>
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout>
      <div className="mb-6 flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">ניהול מלונות</h1>
          <p className="text-gray-600 mt-1">ניהול מלונות וחדרים זמינים למנויים</p>
        </div>
        {canEdit && (
          <button
            onClick={() => handleOpenModal()}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            <Plus size={20} />
            <span>הוסף מלון</span>
          </button>
        )}
      </div>

      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
        {hotels.map((hotel) => {
          const currentIndex = currentImageIndex[hotel.id] || 0;
          const hasImages = hotel.images && hotel.images.length > 0;
          return (
            <div
              key={hotel.id}
              className={`bg-white rounded-xl shadow-lg overflow-hidden border-2 ${hotel.active ? 'border-green-200' : 'border-gray-200'}`}
            >
              <div className="relative h-48 bg-gray-200">
                {hasImages ? (
                  <>
                    <img
                      src={hotel.images![currentIndex].image_url}
                      alt={hotel.name_he}
                      className="w-full h-full object-cover"
                    />
                    {hotel.images!.length > 1 && (
                      <>
                        <button
                          onClick={() => prevImage(hotel.id, hotel.images!.length)}
                          className="absolute left-2 top-1/2 -translate-y-1/2 bg-black/50 hover:bg-black/70 text-white p-2 rounded-full transition-colors"
                        >
                          <ChevronRight size={20} />
                        </button>
                        <button
                          onClick={() => nextImage(hotel.id, hotel.images!.length)}
                          className="absolute right-2 top-1/2 -translate-y-1/2 bg-black/50 hover:bg-black/70 text-white p-2 rounded-full transition-colors"
                        >
                          <ChevronLeft size={20} />
                        </button>
                        <div className="absolute bottom-2 left-1/2 -translate-x-1/2 flex gap-2">
                          {hotel.images!.map((_, idx) => (
                            <div
                              key={idx}
                              className={`w-2 h-2 rounded-full transition-colors ${idx === currentIndex ? 'bg-white' : 'bg-white/50'}`}
                            />
                          ))}
                        </div>
                      </>
                    )}
                  </>
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <ImageIcon className="text-gray-400" size={48} />
                  </div>
                )}
                <div className="absolute top-2 left-2">
                  <span className={`px-3 py-1 rounded-full text-xs font-semibold ${hotel.active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-700'}`}>
                    {hotel.active ? 'פעיל' : 'לא פעיל'}
                  </span>
                </div>
              </div>

              <div className="p-4">
                <h3 className="text-lg font-bold text-gray-900 mb-1">{hotel.name_he}</h3>
                <p className="text-sm text-gray-600 mb-3">{hotel.city_he}</p>
                <div className="space-y-1 text-sm text-gray-700 mb-4">
                  <div className="flex justify-between"><span>רמה:</span><span className="font-medium">{hotel.level}</span></div>
                  <div className="flex justify-between"><span>חדרים בסיס:</span><span className="font-medium">{hotel.base_rooms}</span></div>
                  {hasImages && (
                    <div className="flex justify-between"><span>תמונות:</span><span className="font-medium">{hotel.images!.length}</span></div>
                  )}
                </div>

                {canEdit && (
                  <div className="space-y-2">
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleOpenModal(hotel)}
                        className="flex-1 flex items-center justify-center gap-2 px-3 py-2 bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-100 transition-colors"
                      >
                        <Edit2 size={16} /><span>ערוך</span>
                      </button>
                      <button
                        onClick={() => setConfirmDialog({ isOpen: true, hotelId: hotel.id, currentStatus: hotel.active, action: 'toggle' })}
                        className={`flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-lg transition-colors ${hotel.active ? 'bg-red-50 text-red-600 hover:bg-red-100' : 'bg-green-50 text-green-600 hover:bg-green-100'}`}
                      >
                        {hotel.active ? <PowerOff size={16} /> : <Power size={16} />}
                        <span>{hotel.active ? 'השבת' : 'הפעל'}</span>
                      </button>
                    </div>
                    <button
                      onClick={() => setConfirmDialog({ isOpen: true, hotelId: hotel.id, currentStatus: hotel.active, action: 'delete' })}
                      className="w-full flex items-center justify-center gap-2 px-3 py-2 bg-red-50 text-red-600 rounded-lg hover:bg-red-100 transition-colors"
                    >
                      <Trash2 size={16} /><span>מחק</span>
                    </button>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {hotels.length === 0 && (
        <div className="text-center py-12">
          <ImageIcon className="mx-auto text-gray-400 mb-4" size={64} />
          <p className="text-gray-600">אין מלונות במערכת</p>
        </div>
      )}

      <Modal isOpen={isModalOpen} onClose={handleCloseModal} title={editingHotel ? 'עריכת מלון' : 'הוספת מלון חדש'}>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">שם בעברית *</label>
              <input
                type="text" required value={formData.name_he}
                onChange={(e) => setFormData({ ...formData, name_he: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">שם באנגלית *</label>
              <input
                type="text" required value={formData.name_en}
                onChange={(e) => setFormData({ ...formData, name_en: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">עיר בעברית *</label>
              <input
                type="text" required value={formData.city_he}
                onChange={(e) => setFormData({ ...formData, city_he: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">עיר באנגלית *</label>
              <input
                type="text" required value={formData.city_en}
                onChange={(e) => setFormData({ ...formData, city_en: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">רמה *</label>
            <select
              value={formData.level}
              onChange={(e) => setFormData({ ...formData, level: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="bronze">ארד</option>
              <option value="silver">כסף</option>
              <option value="gold">זהב</option>
              <option value="platinum">פלטינום</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">תיאור בעברית</label>
            <textarea
              value={formData.description_he}
              onChange={(e) => setFormData({ ...formData, description_he: e.target.value })}
              rows={2}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">חדרים בסיס *</label>
              <input
                type="number" required min="1" value={formData.base_rooms}
                onChange={(e) => setFormData({ ...formData, base_rooms: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">מחיר חדר נוסף *</label>
              <input
                type="number" required min="0" value={formData.extra_room_price}
                onChange={(e) => setFormData({ ...formData, extra_room_price: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">ימי הודעה לשינוי *</label>
              <input
                type="number" required min="0" value={formData.change_deadline_days}
                onChange={(e) => setFormData({ ...formData, change_deadline_days: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
          </div>

          {/* ── Image Upload Section ── */}
          <div className="border-t border-gray-200 pt-4">
            <label className="block text-sm font-medium text-gray-700 mb-3">
              תמונות מלון
              {pendingImages.length > 0 && (
                <span className="mr-2 text-xs font-normal text-gray-500">({pendingImages.length} תמונות)</span>
              )}
            </label>

            {/* Drop zone */}
            <div
              onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
              onDragLeave={() => setDragOver(false)}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              className={`relative border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition-all mb-3 ${
                dragOver
                  ? 'border-blue-500 bg-blue-50'
                  : 'border-gray-300 bg-gray-50 hover:border-blue-400 hover:bg-blue-50/50'
              }`}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept={ACCEPTED_TYPES.join(',')}
                multiple
                onChange={handleFileSelect}
                className="hidden"
              />
              <Upload className="mx-auto text-gray-400 mb-2" size={28} />
              <p className="text-sm font-medium text-gray-700">גרור תמונות לכאן או לחץ לבחירה</p>
              <p className="text-xs text-gray-500 mt-1">JPEG, PNG, WebP, GIF · עד 10MB לתמונה · ניתן לבחור מספר תמונות</p>
            </div>

            {/* URL input */}
            <div className="flex gap-2 mb-3">
              <div className="flex-1 relative">
                <LinkIcon size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  type="url"
                  placeholder="או הדבק כתובת URL לתמונה"
                  value={urlInput}
                  onChange={(e) => setUrlInput(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), handleAddUrl())}
                  className="w-full pr-9 pl-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
              <button
                type="button"
                onClick={handleAddUrl}
                disabled={!urlInput.trim()}
                className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors text-sm font-medium disabled:opacity-40 disabled:cursor-not-allowed"
              >
                הוסף
              </button>
            </div>

            {/* Image previews */}
            {pendingImages.length > 0 && (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {pendingImages.map((img, index) => (
                  <div
                    key={img.id}
                    className={`relative group rounded-xl overflow-hidden border-2 bg-gray-100 aspect-video ${
                      img.error ? 'border-red-400' : 'border-gray-200'
                    }`}
                  >
                    <img
                      src={img.previewUrl}
                      alt=""
                      className="w-full h-full object-cover"
                      onError={(e) => {
                        (e.target as HTMLImageElement).src =
                          "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='100' height='100'%3E%3Crect fill='%23e5e7eb' width='100' height='100'/%3E%3Ctext fill='%239ca3af' font-size='14' x='50%25' y='50%25' text-anchor='middle' dy='.35em'%3EX%3C/text%3E%3C/svg%3E";
                      }}
                    />

                    {/* Uploading overlay */}
                    {img.uploading && (
                      <div className="absolute inset-0 bg-black/50 flex flex-col items-center justify-center">
                        <Loader2 className="text-white animate-spin mb-1" size={20} />
                        <span className="text-white text-xs">מעלה...</span>
                      </div>
                    )}

                    {/* Error overlay */}
                    {img.error && !img.uploading && (
                      <div className="absolute inset-0 bg-red-500/80 flex items-center justify-center p-1">
                        <span className="text-white text-xs text-center leading-tight">{img.error}</span>
                      </div>
                    )}

                    {/* Controls overlay */}
                    {!img.uploading && (
                      <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-all">
                        <div className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 transition-opacity flex gap-1">
                          <button
                            type="button"
                            onClick={() => removeImage(img.id)}
                            className="w-6 h-6 bg-red-500 hover:bg-red-600 text-white rounded-full flex items-center justify-center"
                          >
                            <X size={12} />
                          </button>
                        </div>
                        <div className="absolute bottom-1 left-1/2 -translate-x-1/2 opacity-0 group-hover:opacity-100 transition-opacity flex gap-1">
                          {index > 0 && (
                            <button
                              type="button"
                              onClick={() => moveImage(img.id, 'up')}
                              className="w-6 h-6 bg-black/60 hover:bg-black/80 text-white rounded-full flex items-center justify-center"
                              title="הזז שמאלה"
                            >
                              <ChevronRight size={12} />
                            </button>
                          )}
                          {index < pendingImages.length - 1 && (
                            <button
                              type="button"
                              onClick={() => moveImage(img.id, 'down')}
                              className="w-6 h-6 bg-black/60 hover:bg-black/80 text-white rounded-full flex items-center justify-center"
                              title="הזז ימינה"
                            >
                              <ChevronLeft size={12} />
                            </button>
                          )}
                        </div>
                      </div>
                    )}

                    {/* Order badge */}
                    <div className="absolute top-1 left-1">
                      <span className="bg-black/60 text-white text-xs px-1.5 py-0.5 rounded-md">{index + 1}</span>
                    </div>

                    {/* Type badge */}
                    <div className="absolute bottom-1 right-1">
                      {img.type === 'file' ? (
                        <span className="bg-blue-500/80 text-white text-xs px-1.5 py-0.5 rounded-md">קובץ</span>
                      ) : (
                        <span className="bg-gray-500/80 text-white text-xs px-1.5 py-0.5 rounded-md">URL</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {pendingImages.length === 0 && (
              <p className="text-xs text-gray-500 text-center py-2">לא נבחרו תמונות עדיין</p>
            )}
          </div>

          <div className="flex gap-3 pt-4 border-t border-gray-100">
            <button
              type="submit"
              disabled={saving || anyUploading}
              className="flex-1 flex items-center justify-center gap-2 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {saving ? (
                <><Loader2 size={16} className="animate-spin" /><span>שומר...</span></>
              ) : (
                <span>{editingHotel ? 'עדכן' : 'הוסף'}</span>
              )}
            </button>
            <button
              type="button"
              onClick={handleCloseModal}
              disabled={saving}
              className="flex-1 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors disabled:opacity-60"
            >
              ביטול
            </button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        isOpen={confirmDialog.isOpen}
        onClose={() => setConfirmDialog({ ...confirmDialog, isOpen: false })}
        onConfirm={handleConfirmAction}
        title={
          confirmDialog.action === 'delete' ? 'מחיקת מלון'
          : confirmDialog.currentStatus ? 'השבתת מלון' : 'הפעלת מלון'
        }
        message={
          confirmDialog.action === 'delete'
            ? 'האם אתה בטוח שברצונך למחוק את המלון? כל התמונות והמלאי הקשורים יימחקו גם כן. פעולה זו בלתי הפיכה.'
            : confirmDialog.currentStatus
            ? 'האם אתה בטוח שברצונך להשבית את המלון? המלון לא יהיה זמין למנויים.'
            : 'האם אתה בטוח שברצונך להפעיל את המלון? המלון יהיה זמין למנויים.'
        }
        type={confirmDialog.action === 'delete' ? 'danger' : confirmDialog.currentStatus ? 'warning' : 'info'}
      />

      {toast.show && <Toast message={toast.message} type={toast.type} onClose={hideToast} />}
    </AdminLayout>
  );
};
