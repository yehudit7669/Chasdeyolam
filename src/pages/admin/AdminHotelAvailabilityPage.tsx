import { useEffect, useState } from 'react';
import { AdminLayout } from '../../components/AdminLayout';
import { supabase } from '../../lib/supabase';
import { Calendar, Plus, Trash2, Loader2, CalendarRange, CalendarDays, Save, Moon, MapPin, Navigation, AlertTriangle } from 'lucide-react';

interface Hotel { id: string; name_he: string; city_he: string; level: string; bookable_days: number[] | null; bookable_nights: number | null; address: string | null; map_url: string | null; arrival_instructions: string | null; }

const DAY_NAMES = ['ראשון', 'שני', 'שלישי', 'רביעי', 'חמישי', 'שישי', 'שבת'];
interface Availability {
  id: string; hotel_id: string; kind: 'range' | 'date'; start_date: string; end_date: string | null;
}

export const AdminHotelAvailabilityPage = () => {
  const [hotels, setHotels] = useState<Hotel[]>([]);
  const [selectedHotel, setSelectedHotel] = useState<string>('');
  const [avail, setAvail] = useState<Availability[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  // form
  const [mode, setMode] = useState<'range' | 'date'>('range');
  const [start, setStart] = useState('');
  const [end, setEnd] = useState('');

  // הגדרות מלון: ימים + לילות
  const [days, setDays] = useState<number[]>([]);
  const [nights, setNights] = useState(1);
  const [savingCfg, setSavingCfg] = useState(false);

  // פרטי הגעה
  const [address, setAddress] = useState('');
  const [mapUrl, setMapUrl] = useState('');
  const [arrival, setArrival] = useState('');
  const [savingLoc, setSavingLoc] = useState(false);

  const showToast = (m: string) => { setToast(m); setTimeout(() => setToast(null), 2500); };

  useEffect(() => {
    (async () => {
      const { data } = await supabase.from('hotels').select('id, name_he, city_he, level, bookable_days, bookable_nights, address, map_url, arrival_instructions').eq('active', true).order('name_he');
      setHotels((data ?? []) as Hotel[]);
      if (data && data.length) setSelectedHotel(data[0].id);
      setLoading(false);
    })();
  }, []);

  useEffect(() => {
    if (!selectedHotel) return;
    loadAvail();
    const h = hotels.find((x) => x.id === selectedHotel);
    setDays(h?.bookable_days ?? []);
    setNights(h?.bookable_nights ?? 1);
    setAddress(h?.address ?? '');
    setMapUrl(h?.map_url ?? '');
    setArrival(h?.arrival_instructions ?? '');
  }, [selectedHotel, hotels]);

  const saveLocation = async () => {
    if (!selectedHotel) return;
    setSavingLoc(true);
    const payload = { address: address || null, map_url: mapUrl || null, arrival_instructions: arrival || null };
    const { error } = await supabase.from('hotels').update(payload).eq('id', selectedHotel);
    setHotels((prev) => prev.map((h) => h.id === selectedHotel ? { ...h, ...payload } : h));
    setSavingLoc(false);
    showToast(error ? 'שגיאה: ' + error.message : '✓ נשמרו פרטי ההגעה');
  };

  const toggleDay = (d: number) => setDays((prev) => prev.includes(d) ? prev.filter((x) => x !== d) : [...prev, d].sort());

  const saveConfig = async () => {
    if (!selectedHotel) return;
    setSavingCfg(true);
    const { error } = await supabase.from('hotels').update({ bookable_days: days, bookable_nights: nights }).eq('id', selectedHotel);
    // עדכון מקומי כדי שהבחירה תישמר במעבר בין מלונות
    setHotels((prev) => prev.map((h) => h.id === selectedHotel ? { ...h, bookable_days: days, bookable_nights: nights } : h));
    setSavingCfg(false);
    showToast(error ? 'שגיאה: ' + error.message : '✓ נשמרו כללי ההזמנה');
  };

  const loadAvail = async () => {
    const { data } = await supabase.from('hotel_availability').select('*').eq('hotel_id', selectedHotel).order('start_date');
    setAvail((data ?? []) as Availability[]);
  };

  const add = async () => {
    if (!selectedHotel || !start) { showToast('יש לבחור תאריך'); return; }
    if (mode === 'range' && !end) { showToast('בטווח יש למלא תאריך סיום'); return; }
    if (mode === 'range' && end < start) { showToast('תאריך הסיום לפני ההתחלה'); return; }
    setBusy(true);
    const { error } = await supabase.from('hotel_availability').insert({
      hotel_id: selectedHotel,
      kind: mode,
      start_date: start,
      end_date: mode === 'range' ? end : null,
    });
    setBusy(false);
    if (error) { showToast('שגיאה: ' + error.message); return; }
    setStart(''); setEnd('');
    await loadAvail();
    showToast('✓ נוסף');
  };

  const remove = async (id: string) => {
    await supabase.from('hotel_availability').delete().eq('id', id);
    await loadAvail();
    showToast('נמחק');
  };

  const fmt = (d: string) => new Date(d).toLocaleDateString('he-IL', { day: 'numeric', month: 'short', year: 'numeric' });

  return (
    <AdminLayout>
      <div dir="rtl">
        <div className="flex items-center gap-3 mb-2">
          <div className="w-10 h-10 rounded-xl bg-[#626D58]/15 flex items-center justify-center">
            <Calendar className="text-[#626D58]" size={20} />
          </div>
          <h1 className="text-2xl font-black text-[#0A192F]">זמינות מלונות</h1>
        </div>
        <p className="text-[#33332D]/50 text-sm mb-6">הגדר לכל מלון/צימר את התקופות שבהן הוא זמין להזמנה — טווחים או תאריכים בודדים. התורם יוכל לבחור רק בתוכן.</p>

        {loading ? (
          <div className="flex justify-center py-20"><Loader2 className="animate-spin text-[#626D58]" size={28} /></div>
        ) : (
          <div className="grid xl:grid-cols-5 lg:grid-cols-2 gap-6">
            {/* בחירת מלון */}
            <div className="xl:col-span-2 lg:col-span-1">
              <label className="block text-sm font-bold text-[#0A192F] mb-2">בחר מלון</label>
              <select
                value={selectedHotel}
                onChange={(e) => setSelectedHotel(e.target.value)}
                className="w-full px-3 py-2.5 border border-[#E5E1D8] rounded-xl text-sm focus:outline-none focus:border-[#0A192F] bg-white"
              >
                {hotels.map((h) => {
                  const noLoc = !h.address || !h.map_url;
                  return <option key={h.id} value={h.id}>{noLoc ? '⚠ ' : ''}{h.name_he} — {h.city_he}</option>;
                })}
              </select>

              {/* אזהרת מיקום חסר */}
              {(!address || !mapUrl) && (
                <div className="mt-3 flex items-start gap-2 p-3 rounded-xl bg-amber-50 border border-amber-200 text-amber-800 text-xs">
                  <AlertTriangle size={14} className="shrink-0 mt-0.5" />
                  <span>חסרים פרטי מיקום למלון זה (כתובת/קישור מפה). יש להשלים כדי שהם יופיעו ללקוח באישור ההזמנה.</span>
                </div>
              )}

              {/* פרטי הגעה */}
              <div className="mt-5 bg-white rounded-2xl border border-[#E5E1D8]/60 p-5">
                <h3 className="text-sm font-bold text-[#0A192F] mb-3 flex items-center gap-1.5"><MapPin size={15} className="text-[#626D58]" /> פרטי הגעה (יוצגו ללקוח באישור)</h3>
                <label className="block text-xs text-[#33332D]/50 mb-1">כתובת מדויקת</label>
                <input value={address} onChange={(e) => setAddress(e.target.value)} placeholder="רחוב, מספר, עיר"
                  className="w-full px-3 py-2 mb-3 border border-[#E5E1D8] rounded-xl text-sm focus:outline-none focus:border-[#0A192F]" />
                <label className="block text-xs text-[#33332D]/50 mb-1">קישור Google Maps</label>
                <input value={mapUrl} onChange={(e) => setMapUrl(e.target.value)} placeholder="https://maps.google.com/..." dir="ltr"
                  className="w-full px-3 py-2 mb-3 border border-[#E5E1D8] rounded-xl text-sm focus:outline-none focus:border-[#0A192F]" />
                <label className="block text-xs text-[#33332D]/50 mb-1">הוראות הגעה / הערות</label>
                <textarea value={arrival} onChange={(e) => setArrival(e.target.value)} rows={3} placeholder="לדוגמה: צ'ק-אין מ-15:00, קוד שער 1234, ליצור קשר עם X בהגעה..."
                  className="w-full px-3 py-2 mb-4 border border-[#E5E1D8] rounded-xl text-sm focus:outline-none focus:border-[#0A192F] resize-none" />
                <button onClick={saveLocation} disabled={savingLoc}
                  className="w-full py-2.5 rounded-xl bg-[#626D58] text-white text-sm font-semibold hover:bg-[#626D58]/90 transition-all flex items-center justify-center gap-2 disabled:opacity-50">
                  {savingLoc ? <Loader2 size={15} className="animate-spin" /> : <Navigation size={15} />} שמור פרטי הגעה
                </button>
              </div>

              {/* כללי הזמנה: ימים + לילות */}
              <div className="mt-5 bg-white rounded-2xl border border-[#E5E1D8]/60 p-5">
                <h3 className="text-sm font-bold text-[#0A192F] mb-3">כללי הזמנה למלון זה</h3>
                <label className="block text-xs text-[#33332D]/50 mb-2">ימי כניסה מותרים</label>
                <div className="flex flex-wrap gap-1.5 mb-4">
                  {DAY_NAMES.map((name, i) => (
                    <button key={i} onClick={() => toggleDay(i)}
                      className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-all ${days.includes(i) ? 'bg-[#626D58] text-white' : 'bg-[#F7F5F0] text-[#33332D]/50 hover:bg-[#E5E1D8]'}`}>
                      {name}
                    </button>
                  ))}
                </div>
                <p className="text-[10px] text-[#33332D]/35 mb-4">{days.length === 0 ? 'ללא הגבלת ימים (כל הימים, בכפוף לסוג השהייה של התוכנית)' : `${days.length} ימים נבחרו`}</p>

                <label className="block text-xs text-[#33332D]/50 mb-1">מספר לילות</label>
                <div className="flex items-center gap-2 mb-4">
                  <Moon size={15} className="text-[#626D58]" />
                  <input type="number" min={1} max={14} value={nights}
                    onChange={(e) => setNights(Math.max(1, parseInt(e.target.value) || 1))}
                    className="w-20 px-3 py-2 border border-[#E5E1D8] rounded-xl text-sm focus:outline-none focus:border-[#0A192F]" />
                  <span className="text-xs text-[#33332D]/50">לילות לשהייה</span>
                </div>

                <button onClick={saveConfig} disabled={savingCfg}
                  className="w-full py-2.5 rounded-xl bg-[#0A192F] text-white text-sm font-semibold hover:bg-[#0A192F]/90 transition-all flex items-center justify-center gap-2 disabled:opacity-50">
                  {savingCfg ? <Loader2 size={15} className="animate-spin" /> : <Save size={15} />} שמור כללים
                </button>
              </div>

              {/* טופס הוספה */}
              <div className="mt-5 bg-white rounded-2xl border border-[#E5E1D8]/60 p-5">
                <h3 className="text-sm font-bold text-[#0A192F] mb-3">הוסף זמינות</h3>
                <div className="flex gap-2 mb-4">
                  <button onClick={() => setMode('range')}
                    className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl text-xs font-semibold transition-all ${mode === 'range' ? 'bg-[#0A192F] text-white' : 'bg-[#F7F5F0] text-[#33332D]/60'}`}>
                    <CalendarRange size={14} /> טווח
                  </button>
                  <button onClick={() => setMode('date')}
                    className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl text-xs font-semibold transition-all ${mode === 'date' ? 'bg-[#0A192F] text-white' : 'bg-[#F7F5F0] text-[#33332D]/60'}`}>
                    <CalendarDays size={14} /> תאריך בודד
                  </button>
                </div>

                <label className="block text-xs text-[#33332D]/50 mb-1">{mode === 'range' ? 'מתאריך' : 'תאריך'}</label>
                <input type="date" value={start} onChange={(e) => setStart(e.target.value)}
                  className="w-full px-3 py-2 border border-[#E5E1D8] rounded-xl text-sm mb-3 focus:outline-none focus:border-[#0A192F]" />

                {mode === 'range' && (
                  <>
                    <label className="block text-xs text-[#33332D]/50 mb-1">עד תאריך</label>
                    <input type="date" value={end} onChange={(e) => setEnd(e.target.value)}
                      className="w-full px-3 py-2 border border-[#E5E1D8] rounded-xl text-sm mb-3 focus:outline-none focus:border-[#0A192F]" />
                  </>
                )}

                <button onClick={add} disabled={busy}
                  className="w-full py-2.5 rounded-xl bg-[#626D58] text-white text-sm font-semibold hover:bg-[#626D58]/90 transition-all flex items-center justify-center gap-2 disabled:opacity-50">
                  {busy ? <Loader2 size={15} className="animate-spin" /> : <Plus size={15} />} הוסף
                </button>
              </div>
            </div>

            {/* רשימת זמינות */}
            <div className="xl:col-span-3 lg:col-span-1">
              <h3 className="text-sm font-bold text-[#0A192F] mb-3">תקופות זמינות מוגדרות</h3>
              {avail.length === 0 ? (
                <div className="bg-white rounded-2xl border border-[#E5E1D8]/60 p-10 text-center">
                  <Calendar className="text-[#33332D]/15 mx-auto mb-2" size={32} />
                  <p className="text-[#33332D]/40 text-sm">עדיין לא הוגדרה זמינות למלון זה</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {avail.map((a) => (
                    <div key={a.id} className="bg-white rounded-xl border border-[#E5E1D8]/60 px-4 py-3 flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${a.kind === 'range' ? 'bg-blue-50 text-blue-600' : 'bg-[#626D58]/10 text-[#626D58]'}`}>
                          {a.kind === 'range' ? <CalendarRange size={16} /> : <CalendarDays size={16} />}
                        </div>
                        <div>
                          {a.kind === 'range' ? (
                            <span className="text-sm font-semibold text-[#0A192F]">{fmt(a.start_date)} — {a.end_date ? fmt(a.end_date) : ''}</span>
                          ) : (
                            <span className="text-sm font-semibold text-[#0A192F]">{fmt(a.start_date)}</span>
                          )}
                          <span className="block text-[10px] text-[#33332D]/40">{a.kind === 'range' ? 'טווח תאריכים' : 'תאריך בודד'}</span>
                        </div>
                      </div>
                      <button onClick={() => remove(a.id)} className="p-2 rounded-lg text-red-400 hover:text-red-600 hover:bg-red-50 transition-all">
                        <Trash2 size={16} />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {toast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-[#0A192F] text-white text-sm font-semibold px-5 py-3 rounded-2xl shadow-xl z-50">{toast}</div>
      )}
    </AdminLayout>
  );
};
