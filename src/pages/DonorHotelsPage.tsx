import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  MapPin,
  Users,
  Lock,
  Hotel as HotelIcon,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../hooks/useAuth';
import DonorLayout from '../components/DonorLayout';

interface Hotel {
  id: string;
  name_he: string;
  city_he: string;
  level: string;
  description_he: string;
  base_rooms: number;
  active: boolean;
  images: Array<{ id: string; image_url: string; display_order: number }>;
}

interface Subscription {
  is_eligible: boolean;
  plans: {
    hotel_level: string;
  };
}

export default function DonorHotelsPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [hotels, setHotels] = useState<Hotel[]>([]);
  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [loading, setLoading] = useState(true);
  const [currentImageIndex, setCurrentImageIndex] = useState<Record<string, number>>({});

  useEffect(() => {
    if (!user) {
      navigate('/signin');
      return;
    }
    loadData();
  }, [user]);

  const loadData = async () => {
    try {
      const { data: subData } = await supabase
        .from('subscriptions')
        .select(`
          is_eligible,
          plans (hotel_level)
        `)
        .eq('user_id', user!.id)
        .eq('status', 'active')
        .maybeSingle();

      if (subData) {
        setSubscription(subData as any);

        const { data: hotelsData } = await supabase
          .from('hotels')
          .select(`
            *,
            images:hotel_images(id, image_url, display_order)
          `)
          .eq('active', true)
          .eq('level', (subData as any).plans.hotel_level)
          .order('name_he');

        if (hotelsData) {
          const hotelsWithSortedImages = hotelsData.map((hotel: any) => ({
            ...hotel,
            images: (hotel.images || []).sort((a: any, b: any) => a.display_order - b.display_order),
          }));
          setHotels(hotelsWithSortedImages);

          const initialIndexes: Record<string, number> = {};
          hotelsWithSortedImages.forEach((hotel: Hotel) => {
            initialIndexes[hotel.id] = 0;
          });
          setCurrentImageIndex(initialIndexes);
        }
      }
    } catch (err) {
      console.error('Error loading data:', err);
    } finally {
      setLoading(false);
    }
  };

  const nextImage = (hotelId: string, imagesCount: number) => {
    setCurrentImageIndex((prev) => ({
      ...prev,
      [hotelId]: (prev[hotelId] + 1) % imagesCount,
    }));
  };

  const prevImage = (hotelId: string, imagesCount: number) => {
    setCurrentImageIndex((prev) => ({
      ...prev,
      [hotelId]: prev[hotelId] === 0 ? imagesCount - 1 : prev[hotelId] - 1,
    }));
  };

  if (loading) {
    return (
      <DonorLayout>
        <div className="flex items-center justify-center py-20">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
            <p className="text-gray-600">טוען מלונות...</p>
          </div>
        </div>
      </DonorLayout>
    );
  }

  if (!subscription) {
    return (
      <DonorLayout>
        <div className="text-center py-20">
          <HotelIcon className="mx-auto mb-4 text-gray-400" size={64} />
          <h2 className="text-2xl font-bold text-gray-900 mb-4">אין לך מנוי פעיל</h2>
          <p className="text-gray-600 mb-6">הצטרף עכשיו כדי לראות מלונות זמינים</p>
          <button
            onClick={() => navigate('/plans')}
            className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            בחר תוכנית תרומה
          </button>
        </div>
      </DonorLayout>
    );
  }

  return (
    <DonorLayout>
      {!subscription.is_eligible && (
        <div className="mb-8 p-6 bg-amber-50 border-2 border-amber-200 rounded-xl">
            <div className="flex items-start gap-4">
              <Lock className="text-amber-600 flex-shrink-0 mt-1" size={24} />
              <div>
                <h3 className="text-lg font-bold text-amber-900 mb-2">המלונות עדיין לא זמינים להזמנה</h3>
                <p className="text-amber-800">
                  תוכל להזמין מלון רק לאחר השלמת כל התשלומים הנדרשים בתוכנית שלך.
                  חזור לדשבורד כדי לראות את ההתקדמות שלך.
                </p>
            </div>
          </div>
        </div>
      )}

      {hotels.length === 0 ? (
        <div className="text-center py-20">
            <HotelIcon className="mx-auto mb-4 text-gray-400" size={64} />
          <h2 className="text-2xl font-bold text-gray-900 mb-4">אין מלונות זמינים</h2>
          <p className="text-gray-600">
            לא נמצאו מלונות ברמת הזכאות שלך: {subscription.plans.hotel_level}
          </p>
        </div>
      ) : (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {hotels.map((hotel) => {
              const currentIndex = currentImageIndex[hotel.id] || 0;
              const hasImages = hotel.images && hotel.images.length > 0;

              return (
                <div
                  key={hotel.id}
                  className="bg-white rounded-xl shadow-lg overflow-hidden hover:shadow-xl transition-shadow border border-gray-200"
                >
                  <div className="relative h-56 bg-gray-200">
                    {hasImages ? (
                      <>
                        <img
                          src={hotel.images[currentIndex].image_url}
                          alt={hotel.name_he}
                          className="w-full h-full object-cover"
                        />
                        {hotel.images.length > 1 && (
                          <>
                            <button
                              onClick={() => prevImage(hotel.id, hotel.images.length)}
                              className="absolute left-2 top-1/2 -translate-y-1/2 bg-black/50 hover:bg-black/70 text-white p-2 rounded-full transition-colors"
                            >
                              <ChevronRight size={20} />
                            </button>
                            <button
                              onClick={() => nextImage(hotel.id, hotel.images.length)}
                              className="absolute right-2 top-1/2 -translate-y-1/2 bg-black/50 hover:bg-black/70 text-white p-2 rounded-full transition-colors"
                            >
                              <ChevronLeft size={20} />
                            </button>
                            <div className="absolute bottom-2 left-1/2 -translate-x-1/2 flex gap-2">
                              {hotel.images.map((_, idx) => (
                                <div
                                  key={idx}
                                  className={`w-2 h-2 rounded-full transition-colors ${
                                    idx === currentIndex ? 'bg-white' : 'bg-white/50'
                                  }`}
                                />
                              ))}
                            </div>
                          </>
                        )}
                      </>
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <HotelIcon className="text-gray-400" size={48} />
                      </div>
                    )}
                  </div>

                  <div className="p-6">
                    <h3 className="text-xl font-bold text-gray-900 mb-2">{hotel.name_he}</h3>

                    <div className="space-y-2 mb-4">
                      <div className="flex items-center gap-2 text-gray-600">
                        <MapPin size={16} className="text-blue-600" />
                        <span className="text-sm">{hotel.city_he}</span>
                      </div>
                      <div className="flex items-center gap-2 text-gray-600">
                        <Users size={16} className="text-blue-600" />
                        <span className="text-sm">
                          {hotel.base_rooms} {hotel.base_rooms === 1 ? 'חדר' : 'חדרים'} בסיס
                        </span>
                      </div>
                    </div>

                    {hotel.description_he && (
                      <p className="text-sm text-gray-600 mb-4 line-clamp-3">{hotel.description_he}</p>
                    )}

                    <button
                      disabled={!subscription.is_eligible}
                      className={`w-full py-3 rounded-lg font-semibold transition-colors ${
                        subscription.is_eligible
                          ? 'bg-blue-600 text-white hover:bg-blue-700'
                          : 'bg-gray-300 text-gray-500 cursor-not-allowed'
                      }`}
                    >
                      {subscription.is_eligible ? 'הזמן עכשיו' : 'נעול - השלם תשלומים'}
                    </button>
                  </div>
              </div>
            );
          })}
        </div>
      )}
    </DonorLayout>
  );
}
