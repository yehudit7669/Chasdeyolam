import { useEffect, useState, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../hooks/useAuth';

export interface AppNotification {
  id: string;
  recipient_id: string | null;
  for_admin: boolean;
  type: string | null;
  title: string | null;
  body: string | null;
  link: string | null;
  is_read: boolean;
  created_at: string;
}

// mode 'admin' → התראות מנהל (for_admin=true) | 'user' → התראות אישיות
export function useNotifications(mode: 'admin' | 'user') {
  const { user } = useAuth();
  const [items, setItems] = useState<AppNotification[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    let query = supabase
      .from('notifications')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(30);

    if (mode === 'admin') {
      query = query.eq('for_admin', true);
    } else {
      if (!user) { setItems([]); setLoading(false); return; }
      query = query.eq('recipient_id', user.id);
    }

    const { data } = await query;
    setItems((data ?? []) as AppNotification[]);
    setLoading(false);
  }, [mode, user]);

  useEffect(() => {
    load();
    const interval = setInterval(load, 20000); // poll כל 20 שניות
    return () => clearInterval(interval);
  }, [load]);

  const unreadCount = items.filter((n) => !n.is_read).length;

  const markRead = async (id: string) => {
    await supabase.from('notifications').update({ is_read: true }).eq('id', id);
    setItems((prev) => prev.map((n) => (n.id === id ? { ...n, is_read: true } : n)));
  };

  const markAllRead = async () => {
    const ids = items.filter((n) => !n.is_read).map((n) => n.id);
    if (ids.length === 0) return;
    await supabase.from('notifications').update({ is_read: true }).in('id', ids);
    setItems((prev) => prev.map((n) => ({ ...n, is_read: true })));
  };

  return { items, unreadCount, loading, reload: load, markRead, markAllRead };
}

// עוזר ליצירת התראה (+ מייל אופציונלי)
export async function createNotification(n: {
  recipient_id?: string | null;
  for_admin?: boolean;
  type: string;
  title: string;
  body?: string;
  link?: string;
  // אם קיים — יישלח גם מייל. toAdmin → למנהל; to → למייל המשתמש
  email?: { toAdmin?: boolean; to?: string | null; donorName?: string | null };
}) {
  const { error } = await supabase.from('notifications').insert({
    recipient_id: n.recipient_id ?? null,
    for_admin: n.for_admin ?? false,
    type: n.type,
    title: n.title,
    body: n.body ?? null,
    link: n.link ?? null,
  });
  if (error) console.error('[createNotification] insert failed:', error.message);

  // שליחת מייל — best effort, לא חוסם את הזרימה
  if (n.email && (n.email.toAdmin || n.email.to)) {
    try {
      await supabase.functions.invoke('send-email', {
        body: {
          template: n.email.toAdmin ? 'immediate_admin' : 'immediate_user',
          to: n.email.to ?? undefined,
          data: { subject: n.title, body: n.body ?? '', link: n.link ?? '', donorName: n.email.donorName ?? '' },
        },
      });
    } catch (e) {
      console.warn('[createNotification] email failed:', e);
    }
  }
  return { error };
}
