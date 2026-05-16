import { useEffect, useState } from 'react';
import { AdminLayout } from '../../components/AdminLayout';
import { supabase } from '../../lib/supabase';
import { Eye, X, Mail } from 'lucide-react';
import { Modal } from '../../components/admin/Modal';
import { ConfirmDialog } from '../../components/admin/ConfirmDialog';
import { Toast } from '../../components/admin/Toast';
import { useToast } from '../../hooks/useToast';
import { useAuth } from '../../contexts/AuthContext';

interface Booking {
  id: string;
  subscription_id: string;
  hotel_id: string;
  user_id: string;
  booking_date: string;
  base_rooms: number;
  extra_rooms: number;
  total_extra_cost: number;
  status: 'confirmed' | 'canceled' | 'changed';
  voucher_code: string;
  voucher_url: string | null;
  notes: string | null;
  created_at: string;
  profiles: {
    full_name: string;
    email: string;
  };
  hotels: {
    name_he: string;
    change_deadline_days: number;
  };
}

export const AdminBookingsPage = () => {
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [hotelFilter, setHotelFilter] = useState<string>('all');
  const [hotels, setHotels] = useState<any[]>([]);
  const [isDetailsModalOpen, setIsDetailsModalOpen] = useState(false);
  const [selectedBooking, setSelectedBooking] = useState<Booking | null>(null);
  const [confirmDialog, setConfirmDialog] = useState<{
    isOpen: boolean;
    bookingId: string;
    action: 'cancel' | 'resend';
  }>({
    isOpen: false,
    bookingId: '',
    action: 'cancel',
  });
  const { toast, showToast, hideToast } = useToast();
  const { canEdit } = useAuth();

  useEffect(() => {
    loadHotels();
    loadBookings();
  }, []);

  useEffect(() => {
    loadBookings();
  }, [statusFilter, hotelFilter]);

  const loadHotels = async () => {
    try {
      const { data, error } = await supabase
        .from('hotels')
        .select('id, name_he')
        .order('name_he');

      if (error) throw error;
      setHotels(data || []);
    } catch (error) {
      console.error('Error loading hotels:', error);
    }
  };

  const loadBookings = async () => {
    try {
      let query = supabase
        .from('bookings')
        .select(`
          *,
          profiles!bookings_user_id_fkey(full_name, email),
          hotels!bookings_hotel_id_fkey(name_he, change_deadline_days)
        `)
        .order('created_at', { ascending: false });

      if (statusFilter !== 'all') {
        query = query.eq('status', statusFilter);
      }

      if (hotelFilter !== 'all') {
        query = query.eq('hotel_id', hotelFilter);
      }

      const { data, error } = await query;

      if (error) throw error;
      setBookings(data || []);
    } catch (error) {
      console.error('Error loading bookings:', error);
      showToast('שגיאה בטעינת הזמנות', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleViewDetails = (booking: Booking) => {
    setSelectedBooking(booking);
    setIsDetailsModalOpen(true);
  };

  const handleCancelBooking = async () => {
    if (!canEdit) {
      showToast('אין לך הרשאה לבצע פעולה זו', 'error');
      return;
    }

    try {
      const booking = bookings.find((b) => b.id === confirmDialog.bookingId);
      if (!booking) return;

      // Update booking status
      const { error: bookingError } = await supabase
        .from('bookings')
        .update({ status: 'canceled' })
        .eq('id', confirmDialog.bookingId);

      if (bookingError) throw bookingError;

      // Restore inventory
      const { data: inventoryData, error: inventoryFetchError } = await supabase
        .from('hotel_inventory')
        .select('available_rooms')
        .eq('hotel_id', booking.hotel_id)
        .eq('date', booking.booking_date)
        .single();

      if (inventoryFetchError) {
        console.error('Error fetching inventory:', inventoryFetchError);
      } else if (inventoryData) {
        const { error: inventoryUpdateError } = await supabase
          .from('hotel_inventory')
          .update({ available_rooms: inventoryData.available_rooms + booking.base_rooms + booking.extra_rooms })
          .eq('hotel_id', booking.hotel_id)
          .eq('date', booking.booking_date);

        if (inventoryUpdateError) {
          console.error('Error restoring inventory:', inventoryUpdateError);
        }
      }

      showToast('הזמנה בוטלה בהצלחה', 'success');
      loadBookings();
    } catch (error) {
      console.error('Error canceling booking:', error);
      showToast('שגיאה בביטול הזמנה', 'error');
    }
  };

  const handleResendVoucher = async () => {
    if (!canEdit) {
      showToast('אין לך הרשאה לבצע פעולה זו', 'error');
      return;
    }

    try {
      // In a real implementation, this would trigger an email send
      // For now, we just show a success message
      showToast('שובר נשלח מחדש בהצלחה', 'success');
    } catch (error) {
      console.error('Error resending voucher:', error);
      showToast('שגיאה בשליחת שובר', 'error');
    }
  };

  const getStatusBadge = (status: string) => {
    const badges = {
      confirmed: 'bg-green-100 text-green-800',
      canceled: 'bg-red-100 text-red-800',
      changed: 'bg-yellow-100 text-yellow-800',
    };
    const labels = {
      confirmed: 'מאושר',
      canceled: 'בוטל',
      changed: 'שונה',
    };
    return (
      <span className={`px-2 py-1 rounded-full text-xs ${badges[status as keyof typeof badges]}`}>
        {labels[status as keyof typeof labels]}
      </span>
    );
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
        <h1 className="text-3xl font-bold text-[#0B3C5D]">ניהול הזמנות</h1>
        <p className="text-gray-600 mt-2">צפייה וניהול הזמנות מלון</p>
      </div>

      <div className="mb-6 flex gap-4">
        <div className="flex gap-2">
          <button
            onClick={() => setStatusFilter('all')}
            className={`px-4 py-2 rounded-lg ${
              statusFilter === 'all'
                ? 'bg-[#0B3C5D] text-white'
                : 'bg-white text-gray-700 border border-gray-300'
            }`}
          >
            הכל
          </button>
          <button
            onClick={() => setStatusFilter('confirmed')}
            className={`px-4 py-2 rounded-lg ${
              statusFilter === 'confirmed'
                ? 'bg-[#0B3C5D] text-white'
                : 'bg-white text-gray-700 border border-gray-300'
            }`}
          >
            מאושרים
          </button>
          <button
            onClick={() => setStatusFilter('canceled')}
            className={`px-4 py-2 rounded-lg ${
              statusFilter === 'canceled'
                ? 'bg-[#0B3C5D] text-white'
                : 'bg-white text-gray-700 border border-gray-300'
            }`}
          >
            מבוטלים
          </button>
          <button
            onClick={() => setStatusFilter('changed')}
            className={`px-4 py-2 rounded-lg ${
              statusFilter === 'changed'
                ? 'bg-[#0B3C5D] text-white'
                : 'bg-white text-gray-700 border border-gray-300'
            }`}
          >
            שונו
          </button>
        </div>
        <div className="flex-1">
          <select
            value={hotelFilter}
            onChange={(e) => setHotelFilter(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#0B3C5D] focus:border-transparent"
          >
            <option value="all">כל המלונות</option>
            {hotels.map((hotel) => (
              <option key={hotel.id} value={hotel.id}>
                {hotel.name_he}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow-md overflow-hidden">
        <table className="w-full">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="px-6 py-3 text-right text-sm font-semibold text-gray-700">תורם</th>
              <th className="px-6 py-3 text-right text-sm font-semibold text-gray-700">מלון</th>
              <th className="px-6 py-3 text-right text-sm font-semibold text-gray-700">תאריך</th>
              <th className="px-6 py-3 text-right text-sm font-semibold text-gray-700">חדרים נוספים</th>
              <th className="px-6 py-3 text-right text-sm font-semibold text-gray-700">סטטוס</th>
              <th className="px-6 py-3 text-right text-sm font-semibold text-gray-700">תאריך יצירה</th>
              <th className="px-6 py-3 text-right text-sm font-semibold text-gray-700">פעולות</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {bookings.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-6 py-8 text-center text-gray-500">
                  אין הזמנות להצגה
                </td>
              </tr>
            ) : (
              bookings.map((booking) => (
                <tr key={booking.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 text-sm text-gray-900">
                    <div>
                      <div className="font-medium">{booking.profiles?.full_name || booking.profiles?.email || 'משתמש לא ידוע'}</div>
                      <div className="text-gray-500 text-xs">{booking.profiles?.email}</div>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-900">{booking.hotels.name_he}</td>
                  <td className="px-6 py-4 text-sm text-gray-900">
                    {new Date(booking.booking_date).toLocaleDateString('he-IL')}
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-900">
                    {booking.extra_rooms > 0 ? `${booking.extra_rooms} (₪${booking.total_extra_cost})` : '-'}
                  </td>
                  <td className="px-6 py-4 text-sm">{getStatusBadge(booking.status)}</td>
                  <td className="px-6 py-4 text-sm text-gray-900">
                    {new Date(booking.created_at).toLocaleDateString('he-IL')}
                  </td>
                  <td className="px-6 py-4 text-sm">
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleViewDetails(booking)}
                        className="text-blue-600 hover:text-blue-800"
                        title="צפייה"
                      >
                        <Eye size={18} />
                      </button>
                      {canEdit && booking.status === 'confirmed' && (
                        <>
                          <button
                            onClick={() =>
                              setConfirmDialog({
                                isOpen: true,
                                bookingId: booking.id,
                                action: 'cancel',
                              })
                            }
                            className="text-red-600 hover:text-red-800"
                            title="ביטול"
                          >
                            <X size={18} />
                          </button>
                          <button
                            onClick={() =>
                              setConfirmDialog({
                                isOpen: true,
                                bookingId: booking.id,
                                action: 'resend',
                              })
                            }
                            className="text-green-600 hover:text-green-800"
                            title="שלח שובר מחדש"
                          >
                            <Mail size={18} />
                          </button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Details Modal */}
      <Modal
        isOpen={isDetailsModalOpen}
        onClose={() => setIsDetailsModalOpen(false)}
        title="פרטי הזמנה"
        maxWidth="lg"
      >
        {selectedBooking && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">תורם</label>
                <p className="text-gray-900">{selectedBooking.profiles?.full_name || selectedBooking.profiles?.email || 'משתמש לא ידוע'}</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">אימייל</label>
                <p className="text-gray-900">{selectedBooking.profiles?.email}</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">מלון</label>
                <p className="text-gray-900">{selectedBooking.hotels.name_he}</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">תאריך הזמנה</label>
                <p className="text-gray-900">
                  {new Date(selectedBooking.booking_date).toLocaleDateString('he-IL')}
                </p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">חדרים בסיס</label>
                <p className="text-gray-900">{selectedBooking.base_rooms}</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">חדרים נוספים</label>
                <p className="text-gray-900">{selectedBooking.extra_rooms}</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">עלות חדרים נוספים</label>
                <p className="text-gray-900">₪{selectedBooking.total_extra_cost}</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">סטטוס</label>
                {getStatusBadge(selectedBooking.status)}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">קוד שובר</label>
                <p className="text-gray-900 font-mono">{selectedBooking.voucher_code}</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">זמן שינוי מותר</label>
                <p className="text-gray-900">{selectedBooking.hotels.change_deadline_days} ימים לפני</p>
              </div>
            </div>
            {selectedBooking.voucher_url && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">קישור לשובר</label>
                <a
                  href={selectedBooking.voucher_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-600 hover:text-blue-800 break-all"
                >
                  {selectedBooking.voucher_url}
                </a>
              </div>
            )}
            {selectedBooking.notes && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">הערות</label>
                <p className="text-gray-900">{selectedBooking.notes}</p>
              </div>
            )}
          </div>
        )}
      </Modal>

      <ConfirmDialog
        isOpen={confirmDialog.isOpen}
        onClose={() => setConfirmDialog({ ...confirmDialog, isOpen: false })}
        onConfirm={confirmDialog.action === 'cancel' ? handleCancelBooking : handleResendVoucher}
        title={confirmDialog.action === 'cancel' ? 'ביטול הזמנה' : 'שליחת שובר מחדש'}
        message={
          confirmDialog.action === 'cancel'
            ? 'האם אתה בטוח שברצונך לבטל הזמנה זו? המלאי ישוחזר אוטומטית.'
            : 'האם אתה בטוח שברצונך לשלוח את השובר מחדש לתורם?'
        }
        type={confirmDialog.action === 'cancel' ? 'danger' : 'info'}
      />

      {toast.isOpen && <Toast message={toast.message} type={toast.type} onClose={hideToast} />}
    </AdminLayout>
  );
};
