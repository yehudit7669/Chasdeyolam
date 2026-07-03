import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { PREVIEW_PLACES, PreviewPlace } from '../data/previewVacations';

export interface VacationPlace extends PreviewPlace {
  source: 'static' | 'db';
  nights?: number | null;
  stay_type?: string | null;
}

export function useVacationPlaces() {
  const [places, setPlaces] = useState<VacationPlace[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => { load(); }, []);

  const load = async () => {
    const [metaRes, dbPlacesRes] = await Promise.all([
      supabase.from('vacation_place_meta').select('*'),
      supabase.from('vacation_places').select('*').eq('active', true).eq('published', true),
    ]);

    const metaMap: Record<string, Record<string, any>> = {};
    for (const m of metaRes.data ?? []) metaMap[m.place_id] = m;

    const staticPlaces: VacationPlace[] = PREVIEW_PLACES
      // מקום סטטי מוצג אלא אם הוסתר (published===false) או נמחק (removed===true)
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
          nights: m.nights ?? null,
          stay_type: m.stay_type ?? null,
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
      nights: p.nights ?? null,
      stay_type: p.stay_type ?? null,
      source: 'db' as const,
    }));

    setPlaces([...staticPlaces, ...dbPlaces]);
    setLoading(false);
  };

  return { places, loading, reload: load };
}
