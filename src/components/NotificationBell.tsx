import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bell, Check } from 'lucide-react';
import { useNotifications, AppNotification } from '../hooks/useNotifications';

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return 'עכשיו';
  if (m < 60) return `לפני ${m} ד'`;
  const h = Math.floor(m / 60);
  if (h < 24) return `לפני ${h} ש'`;
  const d = Math.floor(h / 24);
  return `לפני ${d} ימים`;
}

export default function NotificationBell({ mode }: { mode: 'admin' | 'user' }) {
  const navigate = useNavigate();
  const { items, unreadCount, markRead, markAllRead } = useNotifications(mode);
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, []);

  const handleClick = (n: AppNotification) => {
    if (!n.is_read) markRead(n.id);
    if (n.link) { setOpen(false); navigate(n.link); }
  };

  return (
    <div className="relative" ref={ref} dir="rtl">
      <button
        onClick={() => setOpen((o) => !o)}
        className="relative p-2 rounded-xl text-[#33332D]/60 hover:text-[#0A192F] hover:bg-[#F7F5F0] transition-colors"
        title="התראות"
      >
        <Bell size={20} />
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -end-0.5 min-w-[18px] h-[18px] px-1 rounded-full bg-red-500 text-white text-[10px] font-bold flex items-center justify-center">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute end-0 mt-2 w-80 max-w-[calc(100vw-2rem)] bg-white rounded-2xl border border-[#E5E1D8] shadow-xl z-50 overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-[#E5E1D8]/60">
            <span className="text-sm font-bold text-[#0A192F]">התראות</span>
            {unreadCount > 0 && (
              <button onClick={markAllRead} className="text-xs text-[#626D58] font-semibold hover:underline flex items-center gap-1">
                <Check size={12} /> סמן הכל כנקרא
              </button>
            )}
          </div>

          <div className="max-h-96 overflow-y-auto">
            {items.length === 0 ? (
              <div className="px-4 py-10 text-center">
                <Bell size={28} className="text-[#33332D]/15 mx-auto mb-2" />
                <p className="text-sm text-[#33332D]/40">אין התראות</p>
              </div>
            ) : (
              items.map((n) => (
                <button
                  key={n.id}
                  onClick={() => handleClick(n)}
                  className={`w-full text-right px-4 py-3 border-b border-[#E5E1D8]/40 transition-colors hover:bg-[#F7F5F0] ${
                    !n.is_read ? 'bg-[#626D58]/5' : ''
                  }`}
                >
                  <div className="flex items-start gap-2">
                    {!n.is_read && <span className="w-2 h-2 rounded-full bg-[#626D58] mt-1.5 shrink-0" />}
                    <div className="flex-1 min-w-0">
                      <p className={`text-sm ${!n.is_read ? 'font-bold text-[#0A192F]' : 'font-medium text-[#33332D]/70'}`}>
                        {n.title}
                      </p>
                      {n.body && <p className="text-xs text-[#33332D]/50 mt-0.5 leading-relaxed line-clamp-2">{n.body}</p>}
                      <p className="text-[10px] text-[#33332D]/30 mt-1">{timeAgo(n.created_at)}</p>
                    </div>
                  </div>
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
