import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  MapPin,
  Users,
  Lock,
  Hotel as HotelIcon,
  ChevronLeft,
  ChevronRight,
  Star,
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
        <div className="flex items-center justify-center py-24">
          <div className="text-center">
            <div className="w-12 h-12 border-2 border-[#E5E1D8] border-t-[#626D58] rounded-full animate-spin mx-auto mb-4" />
            <p className="text-[#33332D]/50 text-sm">טוען מלונות...</p>
          </div>
        </div>
      </DonorLayout>
    );
  }

  if (!subscription) {
    return (
      <DonorLayout>
        <div className="flex flex-col items-center justify-center py-24 text-center">
          <div className="w-20 h-20 rounded-[1.5rem] bg-[#0A192F]/5 flex items-center justify-center mb-6">
            <HotelIcon className="text-[#33332D]/20" size={36} />
          </div>
          <h2 className="text-2xl font-black text-[#0A192F] mb-3">אין לך מנוי פעיל</h2>
          <p className="text-[#33332D]/50 mb-8 font-light">הצטרף עכשיו כדי לראות מלונות זמינים</p>
          <button
            onClick={() => navigate('/plans')}
            className="px-8 py-3.5 bg-[#0A192F] text-white font-semibold rounded-xl hover:bg-[#0A192F]/90 transition-all"
          >
            בחר תוכנית תרומה
          </button>
        </div>
      </DonorLayout>
    );
  }

  return (
    <DonorLayout>
      <div className="space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-2xl font-black text-[#0A192F]">בחירת בית מלון</h1>
          <p className="text-[#33332D]/50 text-sm mt-1 font-light">
            גלה את מבחר המלונות היוקרתיים שעומדים לרשותך
          </p>
        </div>

        {/* Eligibility notice */}
        {!subscription.is_eligible && (
          <div
            className="flex items-start gap-4 p-5 rounded-2xl border border-[#D4B483]/30"
            style={{ backgroundColor: 'rgba(212,180,131,0.06)' }}
          >
            <div className="w-10 h-10 rounded-xl bg-[#D4B483]/10 flex items-center justify-center flex-shrink-0">
              <Lock className="text-[#B08D57]" size={18} />
            </div>
            <div>
              <h3 className="font-bold text-[#0A192F] mb-1">המלונות עדיין לא זמינים להזמנה</h3>
              <p className="text-sm text-[#33332D]/60 font-light leading-relaxed">
                תוכל להזמין מלון רק לאחר השלמת כל התשלומים הנדרשים בתוכנית שלך.
                תוכל בינתיים להתרשם מרשימת המלונות.
              </p>
            </div>
          </div>
        )}

        {/* Hotels grid */}
        {hotels.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <div className="w-20 h-20 rounded-[1.5rem] bg-[#F7F5F0] flex items-center justify-center mb-6">
              <HotelIcon className="text-[#33332D]/20" size={36} />
            </div>
            <h2 className="text-xl font-black text-[#0A192F] mb-2">אין מלונות זמינים</h2>
            <p className="text-[#33332D]/50 text-sm font-light">
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
                  className="bg-white rounded-[2rem] overflow-hidden border border-[#E5E1D8]/60 transition-all duration-300 hover:-translate-y-1"
                  style={{ boxShadow: '0 4px 24px 0 rgba(98,109,88,0.08)' }}
                >
                  {/* Image */}
                  <div className="relative h-52 bg-[#F7F5F0]">
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
                              className="absolute start-2 top-1/2 -translate-y-1/2 bg-white/90 hover:bg-white text-[#33332D] p-2 rounded-xl transition-colors shadow-sm"
                            >
                              <ChevronRight size={18} />
                            </button>
                            <button
                              onClick={() => nextImage(hotel.id, hotel.images.length)}
                              className="absolute end-2 top-1/2 -translate-y-1/2 bg-white/90 hover:bg-white text-[#33332D] p-2 rounded-xl transition-colors shadow-sm"
                            >
                              <ChevronLeft size={18} />
                            </button>
                            <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex gap-1.5">
                              {hotel.images.map((_, idx) => (
                                <div
                                  key={idx}
                                  className={`h-1.5 rounded-full transition-all ${
                                    idx === currentIndex ? 'w-4 bg-white' : 'w-1.5 bg-white/50'
                                  }`}
                                />
                              ))}
                            </div>
                          </>
                        )}
                      </>
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <HotelIcon className="text-[#33332D]/20" size={40} />
                      </div>
                    )}

                    {/* Rating badge */}
                    <div className="absolute top-3 end-3 flex items-center gap-1 px-2.5 py-1 rounded-xl bg-white/90 text-xs font-bold text-[#B08D57]">
                      <Star size={11} fill="currentColor" />
                      <span>5.0</span>
                    </div>
                  </div>

                  {/* Content */}
                  <div className="p-6">
                    <div className="mb-3">
                      <div className="flex items-center gap-1.5 text-xs text-[#33332D]/40 mb-1.5">
                        <MapPin size={12} className="text-[#626D58]" />
                        <span>{hotel.city_he}</span>
                      </div>
                      <h3 className="text-lg font-bold text-[#0A192F]">{hotel.name_he}</h3>
                    </div>

                    <div className="flex items-center gap-3 mb-4">
                      <div className="flex items-center gap-1 text-xs text-[#33332D]/50">
                        <Users size={12} />
                        <span>{hotel.base_rooms} {hotel.base_rooms === 1 ? 'חדר' : 'חדרים'} בסיס</span>
                      </div>
                    </div>

                    {hotel.description_he && (
                      <p className="text-sm text-[#33332D]/50 mb-5 line-clamp-2 font-light leading-relaxed">
                        {hotel.description_he}
                      </p>
                    )}

                    <button
                      disabled={!subscription.is_eligible}
                      className={`w-full py-3 rounded-xl font-semibold text-sm transition-all ${
                        subscription.is_eligible
                          ? 'bg-[#0A192F] text-white hover:bg-[#0A192F]/90 hover:shadow-md'
                          : 'bg-[#F7F5F0] text-[#33332D]/30 cursor-not-allowed border border-[#E5E1D8]'
                      }`}
                    >
                      {subscription.is_eligible ? 'הזמן עכשיו' : (
                        <span className="flex items-center justify-center gap-2">
                          <Lock size={14} />
                          נעול — השלם תשלומים
                        </span>
                      )}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </DonorLayout>
  );
}
