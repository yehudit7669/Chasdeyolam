import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useTranslation } from '../hooks/useTranslation';
import { Layout } from '../components/Layout';
import { supabase } from '../lib/supabase';
import { formatCurrency } from '../lib/stripe';
import { Hotel, Calendar, MapPin, Plus, Minus } from 'lucide-react';
import { format, addDays } from 'date-fns';
import { he } from 'date-fns/locale';

interface HotelWithInventory {
  id: string;
  name_he: string;
  name_en: string;
  city_he: string;
  city_en: string;
  level: string;
  description_he: string | null;
  description_en: string | null;
  extra_room_price: number;
  available_dates: string[];
}

export const BookingPage = () => {
  const { user } = useAuth();
  const { t, language } = useTranslation();
  const navigate = useNavigate();
  const [hotels, setHotels] = useState<HotelWithInventory[]>([]);
  const [cities, setCities] = useState<string[]>([]);
  const [selectedCity, setSelectedCity] = useState<string>('');
  const [selectedDate, setSelectedDate] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [booking, setBooking] = useState<{hotelId: string; extraRooms: number} | null>(null);

  useEffect(() => {
    if (user) {
      checkEligibility();
    }
  }, [user]);

  const checkEligibility = async () => {
    if (!user) return;

    try {
      const { data: subscription } = await supabase
        .from('subscriptions')
        .select('is_eligible, status')
        .eq('user_id', user.id)
        .maybeSingle();

      if (!subscription || !subscription.is_eligible || subscription.status !== 'active') {
        navigate('/dashboard');
        return;
      }

      await loadHotelsAndInventory();
    } catch (error) {
      console.error('Error checking eligibility:', error);
      navigate('/dashboard');
    }
  };

  const loadHotelsAndInventory = async () => {
    try {
      const { data: hotelsData } = await supabase
        .from('hotels')
        .select('*')
        .eq('active', true);

      if (!hotelsData) return;

      const today = new Date();
      const { data: inventoryData } = await supabase
        .from('hotel_inventory')
        .select('*')
        .gte('date', format(today, 'yyyy-MM-dd'))
        .gt('available_rooms', 0);

      if (!inventoryData) return;

      const hotelsWithDates = hotelsData.map(hotel => {
        const availableDates = inventoryData
          .filter(inv => inv.hotel_id === hotel.id)
          .map(inv => inv.date);

        return {
          ...hotel,
          available_dates: availableDates
        };
      });

      setHotels(hotelsWithDates);

      const uniqueCities = [...new Set(hotelsData.map(h => h.city_he))];
      setCities(uniqueCities);

    } catch (error) {
      console.error('Error loading hotels:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleBooking = async (hotelId: string, extraRooms: number) => {
    if (!user || !selectedDate) return;

    setBooking({ hotelId, extraRooms });

    try {
      const hotel = hotels.find(h => h.id === hotelId);
      if (!hotel) return;

      const { data: subscription } = await supabase
        .from('subscriptions')
        .select('id')
        .eq('user_id', user.id)
        .maybeSingle();

      if (!subscription) return;

      const totalExtraCost = hotel.extra_room_price * extraRooms;
      const voucherCode = `CH${Date.now()}${Math.random().toString(36).substring(2, 9).toUpperCase()}`;

      const { data: bookingData, error: bookingError } = await supabase
        .from('bookings')
        .insert({
          subscription_id: subscription.id,
          hotel_id: hotelId,
          user_id: user.id,
          booking_date: selectedDate,
          base_rooms: 1,
          extra_rooms: extraRooms,
          total_extra_cost: totalExtraCost,
          status: 'confirmed',
          voucher_code: voucherCode,
        })
        .select()
        .single();

      if (bookingError) throw bookingError;

      await supabase.rpc('decrement_inventory', {
        p_hotel_id: hotelId,
        p_date: selectedDate
      });

      await supabase
        .from('subscriptions')
        .update({
          status: 'completed',
          completed_at: new Date().toISOString()
        })
        .eq('id', subscription.id);

      navigate(`/booking/${bookingData.id}`);

    } catch (error) {
      console.error('Error creating booking:', error);
      alert('Failed to create booking');
    } finally {
      setBooking(null);
    }
  };

  const filteredHotels = hotels.filter(hotel => {
    if (selectedCity && hotel.city_he !== selectedCity) return false;
    if (selectedDate && !hotel.available_dates.includes(selectedDate)) return false;
    return true;
  });

  if (loading) {
    return (
      <Layout>
        <div className="flex items-center justify-center min-h-[50vh]">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#0B3C5D]"></div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="max-w-6xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-[#0B3C5D] mb-2">{t.booking.title}</h1>
          <p className="text-gray-600">בחר את בית המלון והתאריך המועדפים עליך</p>
        </div>

        <div className="bg-white rounded-lg shadow-md p-6 mb-6">
          <h2 className="text-lg font-bold text-[#0B3C5D] mb-4">{t.booking.filters}</h2>
          <div className="grid md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                {t.booking.city}
              </label>
              <select
                value={selectedCity}
                onChange={(e) => setSelectedCity(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#0B3C5D] focus:border-transparent"
              >
                <option value="">{t.booking.allCities}</option>
                {cities.map(city => (
                  <option key={city} value={city}>{city}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                {t.booking.date}
              </label>
              <input
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                min={format(addDays(new Date(), 1), 'yyyy-MM-dd')}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#0B3C5D] focus:border-transparent"
              />
            </div>
          </div>
        </div>

        <div className="space-y-6">
          {filteredHotels.length === 0 ? (
            <div className="bg-white rounded-lg shadow-md p-8 text-center">
              <Hotel className="mx-auto text-gray-400 mb-4" size={48} />
              <p className="text-gray-600 mb-4">{t.booking.noAvailability}</p>
              <button className="bg-[#0B3C5D] text-white px-6 py-2 rounded-lg hover:bg-opacity-90">
                {t.booking.requestAvailability}
              </button>
            </div>
          ) : (
            filteredHotels.map(hotel => (
              <HotelCard
                key={hotel.id}
                hotel={hotel}
                language={language}
                onBook={handleBooking}
                isBooking={booking?.hotelId === hotel.id}
              />
            ))
          )}
        </div>
      </div>
    </Layout>
  );
};

interface HotelCardProps {
  hotel: HotelWithInventory;
  language: 'he' | 'en';
  onBook: (hotelId: string, extraRooms: number) => void;
  isBooking: boolean;
}

const HotelCard = ({ hotel, language, onBook, isBooking }: HotelCardProps) => {
  const [extraRooms, setExtraRooms] = useState(0);
  const { t } = useTranslation();

  const totalCost = hotel.extra_room_price * extraRooms;

  return (
    <div className="bg-white rounded-lg shadow-md overflow-hidden">
      <div className="p-6">
        <div className="flex items-start justify-between mb-4">
          <div>
            <h3 className="text-2xl font-bold text-[#0B3C5D] mb-2">
              {language === 'he' ? hotel.name_he : hotel.name_en}
            </h3>
            <div className="flex items-center gap-2 text-gray-600">
              <MapPin size={16} />
              <span>{language === 'he' ? hotel.city_he : hotel.city_en}</span>
            </div>
          </div>
          <div className="bg-[#C6A75E] text-white px-3 py-1 rounded-full text-sm font-medium">
            {hotel.level}
          </div>
        </div>

        {hotel.description_he && (
          <p className="text-gray-600 mb-4">
            {language === 'he' ? hotel.description_he : hotel.description_en}
          </p>
        )}

        <div className="bg-gray-50 rounded-lg p-4 mb-4">
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm font-medium text-gray-700">{t.booking.extraRooms}</span>
            <div className="flex items-center gap-3">
              <button
                onClick={() => setExtraRooms(Math.max(0, extraRooms - 1))}
                className="w-8 h-8 rounded-full bg-white border border-gray-300 flex items-center justify-center hover:bg-gray-100"
              >
                <Minus size={16} />
              </button>
              <span className="font-bold text-lg w-8 text-center">{extraRooms}</span>
              <button
                onClick={() => setExtraRooms(extraRooms + 1)}
                className="w-8 h-8 rounded-full bg-white border border-gray-300 flex items-center justify-center hover:bg-gray-100"
              >
                <Plus size={16} />
              </button>
            </div>
          </div>

          {extraRooms > 0 && (
            <div className="text-sm text-gray-600 text-center">
              {t.booking.extraRoomPrice}: {formatCurrency(hotel.extra_room_price)} × {extraRooms} = {formatCurrency(totalCost)}
            </div>
          )}
        </div>

        <button
          onClick={() => onBook(hotel.id, extraRooms)}
          disabled={isBooking}
          className="w-full bg-[#C6A75E] text-[#0B3C5D] py-3 rounded-lg font-bold hover:bg-opacity-90 transition-colors disabled:opacity-50"
        >
          {isBooking ? 'מעבד...' : t.booking.bookNow}
        </button>
      </div>
    </div>
  );
};
