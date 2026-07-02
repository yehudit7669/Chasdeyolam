import { useNavigate } from 'react-router-dom';
import { Hotel, Star, MapPin, Moon, ArrowLeft } from 'lucide-react';
import { useVacationPlaces } from '../hooks/useVacationPlaces';
import { useAllVacationImages } from '../hooks/useVacationImages';
import { planMetaByLevel } from '../data/previewVacations';

interface Props {
  limit?: number;
  title?: string;
  subtitle?: string;
}

export const VacationsTeaser = ({
  limit = 3,
  title = 'המקומות שמחכים לכם',
  subtitle = 'מלונות, וילות וצימרים מפנקים — חופשה זוגית שמגיעה לכם',
}: Props) => {
  const navigate = useNavigate();
  const { places } = useVacationPlaces();
  const { imagesByPlace } = useAllVacationImages();
  const shown = places.slice(0, limit);

  return (
    <section className="py-12" dir="rtl">
      <div className="max-w-6xl mx-auto">
        <div className="text-center mb-10">
          <p className="text-[10px] font-bold text-[#B08D57] tracking-[0.3em] uppercase mb-3">הנופשים שלנו</p>
          <h2 className="text-3xl md:text-4xl font-black text-[#0A192F] tracking-tight mb-2">{title}</h2>
          <p className="text-[#33332D]/50 font-light text-base max-w-xl mx-auto">{subtitle}</p>
        </div>

        <div className="grid md:grid-cols-3 gap-6 mb-8">
          {shown.map((place) => {
            const meta = planMetaByLevel(place.level);
            const dbImages = imagesByPlace[place.id];
            const coverUrl = dbImages?.find((i) => i.media_type !== 'video')?.url ?? place.image_url;
            return (
              <div
                key={place.id}
                className="bg-white rounded-[2rem] overflow-hidden border border-[#E5E1D8]/60 transition-all duration-300 hover:-translate-y-1 flex flex-col cursor-pointer"
                style={{ boxShadow: '0 4px 24px 0 rgba(98,109,88,0.08)' }}
                onClick={() => navigate(`/our-vacations/${place.id}`)}
              >
                <div className="relative h-48 bg-gradient-to-br from-[#E5E1D8] to-[#F7F5F0] flex items-center justify-center">
                  {coverUrl ? (
                    <img src={coverUrl} alt={place.name_he} className="w-full h-full object-cover" loading="lazy" />
                  ) : (
                    <Hotel className="text-[#33332D]/15" size={40} />
                  )}
                  <div className="absolute top-3 end-3 flex items-center gap-1 px-2.5 py-1 rounded-xl bg-white/90 text-xs font-bold text-[#B08D57]">
                    <Star size={11} fill="currentColor" /><span>5.0</span>
                  </div>
                  {place.is_new && (
                    <div className="absolute top-3 start-3 px-2.5 py-1 rounded-xl bg-[#626D58] text-white text-[10px] font-bold">חדש</div>
                  )}
                </div>
                <div className="p-5 flex flex-col flex-1">
                  <div className="flex items-center gap-1.5 text-xs text-[#33332D]/40 mb-1">
                    <MapPin size={11} className="text-[#626D58]" />
                    <span>{place.city_he}</span>
                    <span className="text-[#33332D]/20">·</span>
                    <span>{place.region}</span>
                  </div>
                  <h3 className="text-base font-bold text-[#0A192F] mb-2">{place.name_he}</h3>
                  {place.description_he && (
                    <p className="text-xs text-[#33332D]/55 leading-relaxed mb-3 font-light line-clamp-2">{place.description_he}</p>
                  )}
                  {meta && (
                    <div className="mt-auto flex items-center gap-2 text-xs text-[#33332D]/60">
                      <Moon size={12} className="text-[#626D58]" />
                      <span>{meta.nights} לילות · חופשה זוגית</span>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        <div className="text-center">
          <button
            onClick={() => navigate('/our-vacations')}
            className="group inline-flex items-center gap-3 px-10 py-4 rounded-2xl font-bold text-[#0A192F] transition-all hover:-translate-y-0.5 hover:shadow-lg"
            style={{ background: 'linear-gradient(135deg, #D4B483 0%, #B08D57 100%)' }}
          >
            <span>לכל המקומות</span>
            <ArrowLeft size={18} className="transition-transform group-hover:-translate-x-1" />
          </button>
        </div>
      </div>
    </section>
  );
};
