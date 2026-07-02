import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';

export interface VacationImage {
  id: string;
  place_id: string;
  url: string;
  sort_order: number;
  media_type?: 'image' | 'video';
}

// זיהוי YouTube/Vimeo כדי להטמיע נגן במקום נגן וידאו רגיל
export function getVideoEmbedUrl(url: string): string | null {
  const yt = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([\w-]+)/);
  if (yt) return `https://www.youtube.com/embed/${yt[1]}`;
  const vimeo = url.match(/vimeo\.com\/(\d+)/);
  if (vimeo) return `https://player.vimeo.com/video/${vimeo[1]}`;
  return null;
}

export function useVacationImages(placeId: string) {
  const [images, setImages] = useState<VacationImage[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!placeId) return;
    setLoading(true);
    supabase
      .from('vacation_place_images')
      .select('*')
      .eq('place_id', placeId)
      .order('sort_order')
      .then(({ data }) => {
        setImages(data ?? []);
        setLoading(false);
      });
  }, [placeId]);

  return { images, loading };
}

export function useAllVacationImages() {
  const [imagesByPlace, setImagesByPlace] = useState<Record<string, VacationImage[]>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase
      .from('vacation_place_images')
      .select('*')
      .order('sort_order')
      .then(({ data }) => {
        const grouped: Record<string, VacationImage[]> = {};
        for (const img of data ?? []) {
          if (!grouped[img.place_id]) grouped[img.place_id] = [];
          grouped[img.place_id].push(img);
        }
        setImagesByPlace(grouped);
        setLoading(false);
      });
  }, []);

  return { imagesByPlace, loading };
}
