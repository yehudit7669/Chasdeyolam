import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { PREVIEW_PLACES, PreviewPlace } from '../data/previewVacations';

export interface VacationPlace extends PreviewPlace {
  source: 'static' | 'db';
  linked_hotel_id?: string | null;
}

export function useVacationPlaces() {
  const [places, setPlaces] = useState<VacationPlace[]>([]);
  const [availByHotel, setAvailByHotel] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => { load(); }, []);

  const load = async () => {
    const today = new Date().toISOString().slice(0, 10);

    const [metaRes, dbPlacesRes] = await Promise.all([
      supabase.from('vacation_place_meta').select('*'),
      supabase.from('vacation_places').select('*').eq('active', true).eq('published', true),
    ]);

    const metaMap: Record<string, Record<string, any>> = {};
    for (const m of metaRes.data ?? []) metaMap[m.place_id] = m;

    const staticPlaces: VacationPlace[] = PREVIEW_PLACES
      .filter((p) => metaMap[p.id]?.published !== false && metaMap[p.id]?.removed !== true)
      .map((p) => {
        const m = metaMap[p.id] ?? {};
        return {
          ...p,
          name_he: m.name_he || p.name_he,
          city_he: m.city_he || p.city_he,
          description_he: m.description_he || p.description_he,
          website_url: m.website_url || p.website_url,
          map_url: m.map_url || p.map_url,
          linked_hotel_id: m.linked_hotel_id ?? null,
          source: 'static' as const,
        };
      });

    const dbPlaces: VacationPlace[] = (dbPlacesRes.data ?? []).map((p) => ({
      id: p.id,
      name_he: p.name_he,
      city_he: p.city_he,
      region: p.region,
      level: p.level,
      description_he: p.description_he ?? '',
      website_url: p.website_url ?? '',
      map_url: p.map_url ?? '',
      is_new: p.is_new ?? false,
      linked_hotel_id: p.linked_hotel_id ?? null,
      source: 'db' as const,
    }));

    const allPlaces = [...staticPlaces, ...dbPlaces];
    setPlaces(allPlaces);

    // טען זמינות עתידית לכל מלון מקושר
    const hotelIds = Array.from(new Set(allPlaces.map(p => p.linked_hotel_id).filter(Boolean))) as string[];
    if (hotelIds.length) {
      const { data: avail } = await supabase
        .from('hotel_availability')
        .select('hotel_id, kind, start_date, end_date')
        .in('hotel_id', hotelIds);

      const byHotel: Record<string, boolean> = {};
      for (const row of avail ?? []) {
        if (byHotel[row.hotel_id]) continue;
        const isActive = row.kind === 'date'
          ? row.start_date >= today
          : (row.end_date ? row.end_date >= today : true);
        if (isActive) byHotel[row.hotel_id] = true;
      }
      setAvailByHotel(byHotel);
    }

    setLoading(false);
  };

  return { places, availByHotel, loading, reload: load };
}
