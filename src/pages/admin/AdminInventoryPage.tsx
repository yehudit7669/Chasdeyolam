import { useEffect, useState } from 'react';
import { AdminLayout } from '../../components/AdminLayout';
import { supabase } from '../../lib/supabase';
import { Plus, Edit2, Calendar, Trash2 } from 'lucide-react';
import { Modal } from '../../components/admin/Modal';
import { ConfirmDialog } from '../../components/admin/ConfirmDialog';
import { Toast } from '../../components/admin/Toast';
import { useToast } from '../../hooks/useToast';
import { useAuth } from '../../contexts/AuthContext';

interface Hotel {
  id: string;
  name_he: string;
  active: boolean;
}

interface Inventory {
  id: string;
  hotel_id: string;
  date: string;
  total_rooms: number;
  available_rooms: number;
  hotels: {
    name_he: string;
  };
}

export const AdminInventoryPage = () => {
  const [hotels, setHotels] = useState<Hotel[]>([]);
  const [inventory, setInventory] = useState<Inventory[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedHotelId, setSelectedHotelId] = useState<string>('');
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isBulkAddModalOpen, setIsBulkAddModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingInventory, setEditingInventory] = useState<Inventory | null>(null);
  const [confirmDialog, setConfirmDialog] = useState<{ isOpen: boolean; inventoryId: string }>({
    isOpen: false,
    inventoryId: '',
  });
  const { toast, showToast, hideToast } = useToast();
  const { canEdit } = useAuth();

  const [formData, setFormData] = useState({
    hotel_id: '',
    date: '',
    total_rooms: '',
    available_rooms: '',
  });

  const [bulkFormData, setBulkFormData] = useState({
    hotel_id: '',
    start_date: '',
    end_date: '',
    total_rooms: '',
    available_rooms: '',
  });

  useEffect(() => {
    loadHotels();
  }, []);

  useEffect(() => {
    if (selectedHotelId) {
      loadInventory();
    }
  }, [selectedHotelId]);

  const loadHotels = async () => {
    try {
      const { data, error } = await supabase
        .from('hotels')
        .select('id, name_he, active')
        .eq('active', true)
        .order('name_he');

      if (error) throw error;
      setHotels(data || []);
      if (data && data.length > 0) {
        setSelectedHotelId(data[0].id);
      }
    } catch (error) {
      console.error('Error loading hotels:', error);
      showToast('שגיאה בטעינת מלונות', 'error');
    } finally {
      setLoading(false);
    }
  };

  const loadInventory = async () => {
    try {
      const { data, error } = await supabase
        .from('hotel_inventory')
        .select(`
          *,
          hotels!hotel_inventory_hotel_id_fkey(name_he)
        `)
        .eq('hotel_id', selectedHotelId)
        .order('date', { ascending: true });

      if (error) throw error;
      setInventory(data || []);
    } catch (error) {
      console.error('Error loading inventory:', error);
      showToast('שגיאה בטעינת מלאי', 'error');
    }
  };

  const handleAddSingle = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!canEdit) {
      showToast('אין לך הרשאה לבצע פעולה זו', 'error');
      return;
    }

    const inventoryData = {
      hotel_id: formData.hotel_id,
      date: formData.date,
      total_rooms: parseInt(formData.total_rooms),
      available_rooms: parseInt(formData.available_rooms),
    };

    if (inventoryData.available_rooms < 0) {
      showToast('מספר חדרים זמינים חייב להיות 0 או יותר', 'error');
      return;
    }

    try {
      const { error } = await supabase
        .from('hotel_inventory')
        .insert(inventoryData);

      if (error) throw error;
      showToast('מלאי נוסף בהצלחה', 'success');
      setIsAddModalOpen(false);
      setFormData({
        hotel_id: '',
        date: '',
        total_rooms: '',
        available_rooms: '',
      });
      loadInventory();
    } catch (error) {
      console.error('Error adding inventory:', error);
      showToast('שגיאה בהוספת מלאי', 'error');
    }
  };

  const handleBulkAdd = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!canEdit) {
      showToast('אין לך הרשאה לבצע פעולה זו', 'error');
      return;
    }

    const startDate = new Date(bulkFormData.start_date);
    const endDate = new Date(bulkFormData.end_date);

    if (endDate < startDate) {
      showToast('תאריך סיום חייב להיות אחרי תאריך התחלה', 'error');
      return;
    }

    const totalRooms = parseInt(bulkFormData.total_rooms);
    const availableRooms = parseInt(bulkFormData.available_rooms);

    if (availableRooms < 0) {
      showToast('מספר חדרים זמינים חייב להיות 0 או יותר', 'error');
      return;
    }

    try {
      const inventoryEntries = [];
      const currentDate = new Date(startDate);

      while (currentDate <= endDate) {
        inventoryEntries.push({
          hotel_id: bulkFormData.hotel_id,
          date: currentDate.toISOString().split('T')[0],
          total_rooms: totalRooms,
          available_rooms: availableRooms,
        });
        currentDate.setDate(currentDate.getDate() + 1);
      }

      const { error } = await supabase
        .from('hotel_inventory')
        .insert(inventoryEntries);

      if (error) throw error;
      showToast(`${inventoryEntries.length} רשומות מלאי נוספו בהצלחה`, 'success');
      setIsBulkAddModalOpen(false);
      setBulkFormData({
        hotel_id: '',
        start_date: '',
        end_date: '',
        total_rooms: '',
        available_rooms: '',
      });
      loadInventory();
    } catch (error) {
      console.error('Error bulk adding inventory:', error);
      showToast('שגיאה בהוספת מלאי המוני', 'error');
    }
  };

  const handleEdit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!canEdit) {
      showToast('אין לך הרשאה לבצע פעולה זו', 'error');
      return;
    }

    const availableRooms = parseInt(formData.available_rooms);

    if (availableRooms < 0) {
      showToast('מספר חדרים זמינים חייב להיות 0 או יותר', 'error');
      return;
    }

    try {
      const { error } = await supabase
        .from('hotel_inventory')
        .update({ available_rooms: availableRooms })
        .eq('id', editingInventory!.id);

      if (error) throw error;
      showToast('מלאי עודכן בהצלחה', 'success');
      setIsEditModalOpen(false);
      setEditingInventory(null);
      loadInventory();
    } catch (error) {
      console.error('Error updating inventory:', error);
      showToast('שגיאה בעדכון מלאי', 'error');
    }
  };

  const handleOpenEdit = (item: Inventory) => {
    setEditingInventory(item);
    setFormData({
      hotel_id: item.hotel_id,
      date: item.date,
      total_rooms: item.total_rooms.toString(),
      available_rooms: item.available_rooms.toString(),
    });
    setIsEditModalOpen(true);
  };

  const handleDelete = async () => {
    if (!canEdit) {
      showToast('אין לך הרשאה לבצע פעולה זו', 'error');
      return;
    }

    try {
      const { error } = await supabase
        .from('hotel_inventory')
        .delete()
        .eq('id', confirmDialog.inventoryId);

      if (error) throw error;
      showToast('רשומת מלאי נמחקה בהצלחה', 'success');
      loadInventory();
    } catch (error) {
      console.error('Error deleting inventory:', error);
      showToast('שגיאה במחיקת מלאי', 'error');
    }
  };

  if (loading) {
    return (
      <AdminLayout>
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#0B3C5D]"></div>
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout>
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-[#0B3C5D]">ניהול מלאי</h1>
        <p className="text-gray-600 mt-2">ניהול זמינות חדרי מלון</p>
      </div>

      <div className="mb-6 flex gap-4">
        <div className="flex-1">
          <label className="block text-sm font-medium text-gray-700 mb-2">בחר מלון</label>
          <select
            value={selectedHotelId}
            onChange={(e) => setSelectedHotelId(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#0B3C5D] focus:border-transparent"
          >
            {hotels.map((hotel) => (
              <option key={hotel.id} value={hotel.id}>
                {hotel.name_he}
              </option>
            ))}
          </select>
        </div>
        {canEdit && (
          <div className="flex gap-2 items-end">
            <button
              onClick={() => {
                setFormData({ ...formData, hotel_id: selectedHotelId });
                setIsAddModalOpen(true);
              }}
              className="flex items-center gap-2 bg-[#0B3C5D] text-white px-4 py-2 rounded-lg hover:bg-opacity-90 transition-colors"
            >
              <Plus size={20} />
              הוסף תאריך בודד
            </button>
            <button
              onClick={() => {
                setBulkFormData({ ...bulkFormData, hotel_id: selectedHotelId });
                setIsBulkAddModalOpen(true);
              }}
              className="flex items-center gap-2 bg-[#C6A75E] text-white px-4 py-2 rounded-lg hover:bg-opacity-90 transition-colors"
            >
              <Calendar size={20} />
              הוספה המונית
            </button>
          </div>
        )}
      </div>

      <div className="bg-white rounded-lg shadow-md overflow-hidden">
        <table className="w-full">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="px-6 py-3 text-right text-sm font-semibold text-gray-700">תאריך</th>
              <th className="px-6 py-3 text-right text-sm font-semibold text-gray-700">סך חדרים</th>
              <th className="px-6 py-3 text-right text-sm font-semibold text-gray-700">חדרים זמינים</th>
              {canEdit && <th className="px-6 py-3 text-right text-sm font-semibold text-gray-700">פעולות</th>}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {inventory.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-6 py-8 text-center text-gray-500">
                  אין מלאי להצגה
                </td>
              </tr>
            ) : (
              inventory.map((item) => (
                <tr key={item.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 text-sm text-gray-900">
                    {new Date(item.date).toLocaleDateString('he-IL')}
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-900">{item.total_rooms}</td>
                  <td className="px-6 py-4 text-sm">
                    <span
                      className={`px-2 py-1 rounded-full text-xs ${
                        item.available_rooms === 0
                          ? 'bg-red-100 text-red-800'
                          : item.available_rooms < item.total_rooms / 2
                          ? 'bg-yellow-100 text-yellow-800'
                          : 'bg-green-100 text-green-800'
                      }`}
                    >
                      {item.available_rooms}
                    </span>
                  </td>
                  {canEdit && (
                    <td className="px-6 py-4 text-sm">
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => handleOpenEdit(item)}
                          className="text-blue-600 hover:text-blue-800"
                          title="עריכה"
                        >
                          <Edit2 size={18} />
                        </button>
                        <button
                          onClick={() => setConfirmDialog({ isOpen: true, inventoryId: item.id })}
                          className="text-red-600 hover:text-red-800"
                          title="מחק"
                        >
                          <Trash2 size={18} />
                        </button>
                      </div>
                    </td>
                  )}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Add Single Modal */}
      <Modal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        title="הוספת מלאי לתאריך בודד"
      >
        <form onSubmit={handleAddSingle} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">תאריך *</label>
            <input
              type="date"
              value={formData.date}
              onChange={(e) => setFormData({ ...formData, date: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#0B3C5D] focus:border-transparent"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">סך חדרים *</label>
            <input
              type="number"
              value={formData.total_rooms}
              onChange={(e) => setFormData({ ...formData, total_rooms: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#0B3C5D] focus:border-transparent"
              required
              min="0"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">חדרים זמינים *</label>
            <input
              type="number"
              value={formData.available_rooms}
              onChange={(e) => setFormData({ ...formData, available_rooms: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#0B3C5D] focus:border-transparent"
              required
              min="0"
            />
          </div>
          <div className="flex gap-3 justify-end mt-6">
            <button
              type="button"
              onClick={() => setIsAddModalOpen(false)}
              className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200"
            >
              ביטול
            </button>
            <button
              type="submit"
              className="px-4 py-2 bg-[#0B3C5D] text-white rounded-lg hover:bg-opacity-90"
            >
              הוסף
            </button>
          </div>
        </form>
      </Modal>

      {/* Bulk Add Modal */}
      <Modal
        isOpen={isBulkAddModalOpen}
        onClose={() => setIsBulkAddModalOpen(false)}
        title="הוספה המונית של מלאי"
      >
        <form onSubmit={handleBulkAdd} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">תאריך התחלה *</label>
              <input
                type="date"
                value={bulkFormData.start_date}
                onChange={(e) => setBulkFormData({ ...bulkFormData, start_date: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#0B3C5D] focus:border-transparent"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">תאריך סיום *</label>
              <input
                type="date"
                value={bulkFormData.end_date}
                onChange={(e) => setBulkFormData({ ...bulkFormData, end_date: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#0B3C5D] focus:border-transparent"
                required
              />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">סך חדרים *</label>
            <input
              type="number"
              value={bulkFormData.total_rooms}
              onChange={(e) => setBulkFormData({ ...bulkFormData, total_rooms: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#0B3C5D] focus:border-transparent"
              required
              min="0"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">חדרים זמינים *</label>
            <input
              type="number"
              value={bulkFormData.available_rooms}
              onChange={(e) => setBulkFormData({ ...bulkFormData, available_rooms: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#0B3C5D] focus:border-transparent"
              required
              min="0"
            />
          </div>
          <div className="flex gap-3 justify-end mt-6">
            <button
              type="button"
              onClick={() => setIsBulkAddModalOpen(false)}
              className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200"
            >
              ביטול
            </button>
            <button
              type="submit"
              className="px-4 py-2 bg-[#C6A75E] text-white rounded-lg hover:bg-opacity-90"
            >
              הוסף
            </button>
          </div>
        </form>
      </Modal>

      {/* Edit Modal */}
      <Modal
        isOpen={isEditModalOpen}
        onClose={() => setIsEditModalOpen(false)}
        title="עדכון מלאי"
      >
        <form onSubmit={handleEdit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">תאריך</label>
            <input
              type="text"
              value={new Date(formData.date).toLocaleDateString('he-IL')}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-gray-50"
              disabled
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">סך חדרים</label>
            <input
              type="text"
              value={formData.total_rooms}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-gray-50"
              disabled
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">חדרים זמינים *</label>
            <input
              type="number"
              value={formData.available_rooms}
              onChange={(e) => setFormData({ ...formData, available_rooms: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#0B3C5D] focus:border-transparent"
              required
              min="0"
            />
          </div>
          <div className="flex gap-3 justify-end mt-6">
            <button
              type="button"
              onClick={() => setIsEditModalOpen(false)}
              className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200"
            >
              ביטול
            </button>
            <button
              type="submit"
              className="px-4 py-2 bg-[#0B3C5D] text-white rounded-lg hover:bg-opacity-90"
            >
              עדכן
            </button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        isOpen={confirmDialog.isOpen}
        onClose={() => setConfirmDialog({ ...confirmDialog, isOpen: false })}
        onConfirm={() => {
          handleDelete();
          setConfirmDialog({ ...confirmDialog, isOpen: false });
        }}
        title="מחיקת רשומת מלאי"
        message="האם אתה בטוח שברצונך למחוק רשומת מלאי זו? פעולה זו בלתי הפיכה."
        type="danger"
      />

      {toast.isOpen && <Toast message={toast.message} type={toast.type} onClose={hideToast} />}
    </AdminLayout>
  );
};
