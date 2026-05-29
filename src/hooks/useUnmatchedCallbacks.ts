import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';

export function useUnmatchedCallbacks() {
  const [count, setCount] = useState(0);

  useEffect(() => {
    let cancelled = false;

    const fetchCount = async () => {
      const { count: n } = await supabase
        .from('nedarim_keva_callbacks')
        .select('id', { count: 'exact', head: true })
        .eq('review_status', 'pending_review');
      if (!cancelled) setCount(n ?? 0);
    };

    fetchCount();

    const channel = supabase
      .channel('unmatched-callbacks-count')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'nedarim_keva_callbacks' },
        () => fetchCount()
      )
      .subscribe();

    return () => {
      cancelled = true;
      supabase.removeChannel(channel);
    };
  }, []);

  return count;
}
