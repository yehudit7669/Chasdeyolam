import { useEffect, useRef, useState } from 'react';
import { AdminLayout } from '../../components/AdminLayout';
import { supabase } from '../../lib/supabase';
import { PREVIEW_PLACES, PREVIEW_PLAN_META, planMetaByLevel } from '../../data/previewVacations';
import {
  Upload, Trash2, ChevronUp, ChevronDown, ImageIcon, Loader2, Check,
  ExternalLink, Eye, EyeOff, MapPin, Moon, Star, Plus, X, Send, Video, Link2,
} from 'lucide-react';

interface VacationImage { id: string; place_id: string; url: string; sort_order: number; media_type?: 'image' | 'video'; }
interface DbPlace { id: string; name_he: string; city_he: string; region: string; level: string; description_he: string; website_url: string; is_new: boolean; published: boolean; source: 'db'; }

const BUCKET = 'vacations';
const REGIONS = ['טבריה', 'צפת', 'גליל', 'כרמל', 'מרכז', 'דרום'];

export const AdminVacationGalleryPage = () => {
  const [staticPlaces] = useState(PREVIEW_PLACES);
  const [dbPlaces, setDbPlaces] = useState<DbPlace[]>([]);
  // מצב פרסום למקומות סטטיים: place_id -> published (ברירת מחדל true)
  const [staticPublished, setStaticPublished] = useState<Record<string, boolean>>({});
  // מקומות סטטיים שהוסרו: place_id -> true
  const [staticRemoved, setStaticRemoved] = useState<Record<string, boolean>>({});
  const [selectedId, setSelectedId] = useState<string>(PREVIEW_PLACES[0].id);
  const [images, setImages] = useState<VacationImage[]>([]);
  const [uploading, setUploading] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [showPreview, setShowPreview] = useState(false);
  const [saving, setSaving] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showVideoUrlModal, setShowVideoUrlModal] = useState(false);
  const [videoUrlInput, setVideoUrlInput] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);
  const videoFileRef = useRef<HTMLInputElement>(null);

  // שדות עריכה
  const [nameHe, setNameHe] = useState('');
  const [cityHe, setCityHe] = useState('');
  const [description, setDescription] = useState('');
  const [websiteUrl, setWebsiteUrl] = useState('');

  // טופס הוספה
  const [newPlace, setNewPlace] = useState({ name_he: '', city_he: '', region: REGIONS[0], level: PREVIEW_PLAN_META[0].level, description_he: '', website_url: '', is_new: true, published: false });
  const [addingPlace, setAddingPlace] = useState(false);

  const allPlaces = [
    ...staticPlaces.filter(p => !staticRemoved[p.id]).map(p => ({ ...p, source: 'static' as const })),
    ...dbPlaces,
  ];
  const place = allPlaces.find(p => p.id === selectedId) ?? allPlaces[0];
  const meta = place ? planMetaByLevel(place.level) : null;

  useEffect(() => { loadDbPlaces(); loadStaticPublished(); }, []);

  const loadStaticPublished = async () => {
    const { data } = await supabase.from('vacation_place_meta').select('place_id, published, removed');
    const pub: Record<string, boolean> = {};
    const rem: Record<string, boolean> = {};
    for (const m of data ?? []) { pub[m.place_id] = m.published !== false; if (m.removed) rem[m.place_id] = true; }
    setStaticPublished(pub);
    setStaticRemoved(rem);
  };

  const deleteStaticPlace = async (id: string) => {
    if (!confirm('למחוק מקום זה מהגלריה? הוא יוסתר מהאתר ומהרשימה.')) return;
    const { error } = await supabase.from('vacation_place_meta').upsert({ place_id: id, removed: true }, { onConflict: 'place_id' });
    if (error) { alert('המחיקה נכשלה: ' + error.message + '\n(ייתכן שצריך להריץ את ה-SQL של העמודה removed)'); return; }
    setStaticRemoved(prev => ({ ...prev, [id]: true }));
    const remaining = allPlaces.filter(p => p.id !== id);
    if (remaining.length) setSelectedId(remaining[0].id);
    showToast('המקום נמחק');
  };
  useEffect(() => { if (place) { loadImages(); loadMeta(); } }, [selectedId]);

  const showToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(null), 2500); };

  const loadDbPlaces = async () => {
    const { data } = await supabase.from('vacation_places').select('*').eq('active', true);
    setDbPlaces((data ?? []).map(p => ({ ...p, published: p.published ?? false, source: 'db' as const })));
  };

  const loadImages = async () => {
    const { data } = await supabase.from('vacation_place_images').select('*').eq('place_id', selectedId).order('sort_order');
    setImages(data ?? []);
  };

  const loadMeta = async () => {
    if (!place) return;
    // DB places already have full data
    if (place.source === 'db') {
      const p = dbPlaces.find(d => d.id === selectedId);
      if (p) { setNameHe(p.name_he); setCityHe(p.city_he); setDescription(p.description_he); setWebsiteUrl(p.website_url); }
      return;
    }
    const { data } = await supabase.from('vacation_place_meta').select('*').eq('place_id', selectedId).maybeSingle();
    const sp = staticPlaces.find(p => p.id === selectedId)!;
    setNameHe(data?.name_he || sp.name_he);
    setCityHe(data?.city_he || sp.city_he);
    setDescription(data?.description_he || sp.description_he || '');
    setWebsiteUrl(data?.website_url || sp.website_url || '');
  };

  const saveMeta = async () => {
    setSaving(true);
    if (place.source === 'db') {
      await supabase.from('vacation_places').update({ name_he: nameHe, city_he: cityHe, description_he: description, website_url: websiteUrl }).eq('id', selectedId);
      await loadDbPlaces();
    } else {
      await supabase.from('vacation_place_meta').upsert(
        { place_id: selectedId, name_he: nameHe, city_he: cityHe, description_he: description, website_url: websiteUrl },
        { onConflict: 'place_id' }
      );
    }
    setSaving(false);
    showToast('✓ נשמר בהצלחה');
  };

  const handleUpload = async (files: FileList | null, mediaType: 'image' | 'video' = 'image') => {
    if (!files || files.length === 0) return;
    setUploading(true);
    const base = images.length;
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const ext = file.name.split('.').pop();
      const path = `${selectedId}/${Date.now()}-${i}.${ext}`;
      const { error } = await supabase.storage.from(BUCKET).upload(path, file, { upsert: false });
      if (error) { showToast('שגיאה: ' + error.message); continue; }
      const { data: { publicUrl } } = supabase.storage.from(BUCKET).getPublicUrl(path);
      await supabase.from('vacation_place_images').insert({ place_id: selectedId, url: publicUrl, sort_order: base + i, media_type: mediaType });
    }
    await loadImages();
    setUploading(false);
    showToast(`✓ ${files.length} ${mediaType === 'video' ? 'סרטונים הועלו' : 'תמונות הועלו'}`);
  };

  const addVideoByUrl = async () => {
    const url = videoUrlInput.trim();
    if (!url) return;
    await supabase.from('vacation_place_images').insert({ place_id: selectedId, url, sort_order: images.length, media_type: 'video' });
    setVideoUrlInput('');
    setShowVideoUrlModal(false);
    await loadImages();
    showToast('✓ קישור הסרטון נוסף');
  };

  const handleDelete = async (img: VacationImage) => {
    // רק קבצים שהועלו לאחסון שלנו (לא קישורי YouTube/Vimeo חיצוניים) — למחוק גם מהאחסון
    if (img.url.includes(`/object/public/${BUCKET}/`)) {
      const url = new URL(img.url);
      const path = url.pathname.split(`/object/public/${BUCKET}/`)[1];
      if (path) await supabase.storage.from(BUCKET).remove([path]);
    }
    await supabase.from('vacation_place_images').delete().eq('id', img.id);
    await loadImages();
    showToast(img.media_type === 'video' ? 'סרטון נמחק' : 'תמונה נמחקה');
  };

  const move = async (idx: number, dir: -1 | 1) => {
    const other = idx + dir;
    if (other < 0 || other >= images.length) return;
    const updated = [...images];
    [updated[idx], updated[other]] = [updated[other], updated[idx]];
    await Promise.all([
      supabase.from('vacation_place_images').update({ sort_order: other }).eq('id', updated[other].id),
      supabase.from('vacation_place_images').update({ sort_order: idx }).eq('id', updated[idx].id),
    ]);
    setImages(updated);
  };

  const addNewPlace = async () => {
    if (!newPlace.name_he || !newPlace.city_he) return;
    setAddingPlace(true);
    const id = `db-${Date.now()}`;
    const { error } = await supabase.from('vacation_places').insert({ id, ...newPlace });
    if (error) { showToast('שגיאה: ' + error.message); setAddingPlace(false); return; }
    await loadDbPlaces();
    setSelectedId(id);
    setShowAddModal(false);
    setNewPlace({ name_he: '', city_he: '', region: REGIONS[0], level: PREVIEW_PLAN_META[0].level, description_he: '', website_url: '', is_new: true });
    setAddingPlace(false);
    showToast('✓ מקום חדש נוסף');
  };

  const togglePublish = async (id: string, current: boolean, isStatic: boolean) => {
    if (isStatic) {
      await supabase.from('vacation_place_meta').upsert(
        { place_id: id, published: !current },
        { onConflict: 'place_id' }
      );
      await loadStaticPublished();
    } else {
      await supabase.from('vacation_places').update({ published: !current }).eq('id', id);
      await loadDbPlaces();
    }
    showToast(!current ? '✓ פורסם — גלוי לכולם' : 'הוסתר — טיוטה בלבד');
  };

  const deleteDbPlace = async (id: string) => {
    await supabase.from('vacation_places').update({ active: false }).eq('id', id);
    await loadDbPlaces();
    setSelectedId(allPlaces[0]?.id ?? PREVIEW_PLACES[0].id);
    showToast('מקום נמחק');
  };

  const coverUrl = images[0]?.url ?? (place as any)?.image_url;

  return (
    <AdminLayout>
      <div className="max-w-7xl mx-auto p-6" dir="rtl">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-black text-[#0A192F]">גלריית נופשים — ניהול</h1>
          <div className="flex gap-2">
            <button onClick={() => setShowAddModal(true)}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#626D58] text-white text-sm font-semibold hover:bg-[#626D58]/90 transition-all">
              <Plus size={15} /> הוסף מקום חדש
            </button>
            <button onClick={() => setShowPreview(!showPreview)}
              className={`inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold transition-all ${showPreview ? 'bg-[#0A192F] text-white' : 'border-2 border-[#0A192F] text-[#0A192F]'}`}>
              {showPreview ? <EyeOff size={15} /> : <Eye size={15} />}
              {showPreview ? 'הסתר תצוגה' : 'תצוגה ללקוח'}
            </button>
          </div>
        </div>

        <div className="grid grid-cols-12 gap-6">

          {/* רשימת מקומות */}
          <div className="col-span-3 bg-white rounded-2xl border border-[#E5E1D8]/60 overflow-hidden" style={{ boxShadow: '0 2px 12px rgba(98,109,88,0.07)' }}>
            <div className="px-4 py-3 border-b border-[#E5E1D8]/50 flex items-center justify-between">
              <p className="text-xs font-bold text-[#33332D]/50 uppercase tracking-widest">מקומות ({allPlaces.length})</p>
            </div>
            <div className="overflow-y-auto max-h-[75vh]">
              {/* סטטיים */}
              <div className="px-3 py-2 text-[9px] font-bold text-[#33332D]/30 uppercase tracking-widest border-b border-[#E5E1D8]/30">
                מקומות קיימים
              </div>
              {staticPlaces.filter(p => !staticRemoved[p.id]).map((p) => {
                const isPub = staticPublished[p.id] !== false;
                return (
                <button key={p.id} onClick={() => setSelectedId(p.id)}
                  className={`w-full text-right px-4 py-3 border-b border-[#E5E1D8]/30 transition-all flex items-center justify-between gap-2 ${selectedId === p.id ? 'bg-[#0A192F] text-white' : 'hover:bg-[#F7F5F0] text-[#33332D]'}`}>
                  <div>
                    <div className="text-sm font-semibold">{p.name_he}</div>
                    <div className={`text-xs ${selectedId === p.id ? 'text-white/50' : 'text-[#33332D]/40'}`}>{p.city_he}</div>
                  </div>
                  <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded shrink-0 ${
                    isPub
                      ? (selectedId === p.id ? 'bg-green-400/30 text-green-200' : 'bg-green-100 text-green-700')
                      : (selectedId === p.id ? 'bg-white/20 text-white/60' : 'bg-orange-100 text-orange-600')
                  }`}>{isPub ? '● פורסם' : '○ טיוטה'}</span>
                </button>
                );
              })}
              {/* DB */}
              {dbPlaces.length > 0 && (
                <>
                  <div className="px-3 py-2 text-[9px] font-bold text-[#626D58]/60 uppercase tracking-widest border-b border-[#E5E1D8]/30 bg-[#626D58]/5">
                    נוספו ידנית
                  </div>
                  {dbPlaces.map((p) => (
                    <button key={p.id} onClick={() => setSelectedId(p.id)}
                      className={`w-full text-right px-4 py-3 border-b border-[#E5E1D8]/30 transition-all flex items-center justify-between gap-2 ${selectedId === p.id ? 'bg-[#0A192F] text-white' : 'hover:bg-[#F7F5F0] text-[#33332D]'}`}>
                      <div>
                        <div className="text-sm font-semibold">{p.name_he}</div>
                        <div className={`text-xs ${selectedId === p.id ? 'text-white/50' : 'text-[#33332D]/40'}`}>{p.city_he}</div>
                      </div>
                      <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded shrink-0 ${
                        p.published
                          ? (selectedId === p.id ? 'bg-green-400/30 text-green-200' : 'bg-green-100 text-green-700')
                          : (selectedId === p.id ? 'bg-white/20 text-white/60' : 'bg-orange-100 text-orange-600')
                      }`}>{p.published ? '● פורסם' : '○ טיוטה'}</span>
                    </button>
                  ))}
                </>
              )}
            </div>
          </div>

          {/* פאנל עריכה */}
          <div className={showPreview ? 'col-span-5' : 'col-span-9'}>
            <div className="space-y-4">

              {/* כותרת + מחיקה */}
              <div className="bg-white rounded-2xl border border-[#E5E1D8]/60 p-4 flex items-center justify-between" style={{ boxShadow: '0 2px 12px rgba(98,109,88,0.07)' }}>
                <div>
                  <h2 className="text-lg font-black text-[#0A192F]">{nameHe || place?.name_he}</h2>
                  <p className="text-sm text-[#33332D]/50">{cityHe || place?.city_he} · {place?.region}</p>
                </div>
                <div className="flex items-center gap-2">
                  {(() => {
                    const isStatic = place?.source === 'static';
                    const isPublished = isStatic
                      ? staticPublished[selectedId] !== false
                      : (dbPlaces.find(d => d.id === selectedId)?.published ?? false);
                    return (
                      <button
                        onClick={() => togglePublish(selectedId, isPublished, isStatic)}
                        className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-semibold transition-all ${
                          isPublished
                            ? 'bg-orange-50 text-orange-600 hover:bg-orange-100 border border-orange-200'
                            : 'bg-green-50 text-green-700 hover:bg-green-100 border border-green-200'
                        }`}
                        title={isPublished ? 'החזר לטיוטה — רק המנהל יראה' : 'פרסם לציבור'}
                      >
                        <Send size={14} />
                        {isPublished ? 'הסתר' : 'פרסם'}
                      </button>
                    );
                  })()}
                  <button onClick={() => place?.source === 'db' ? deleteDbPlace(selectedId) : deleteStaticPlace(selectedId)}
                    className="p-2 rounded-xl text-red-400 hover:text-red-600 hover:bg-red-50 transition-all" title="מחק מקום">
                    <Trash2 size={17} />
                  </button>
                </div>
              </div>

              {/* שדות עריכה */}
              <div className="bg-white rounded-2xl border border-[#E5E1D8]/60 p-5 space-y-4" style={{ boxShadow: '0 2px 12px rgba(98,109,88,0.07)' }}>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-bold text-[#33332D]/50 uppercase tracking-widest block mb-1.5">שם המקום</label>
                    <input value={nameHe} onChange={e => setNameHe(e.target.value)}
                      className="w-full border border-[#E5E1D8] rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-[#0A192F] text-[#0A192F]" />
                  </div>
                  <div>
                    <label className="text-xs font-bold text-[#33332D]/50 uppercase tracking-widest block mb-1.5">עיר</label>
                    <input value={cityHe} onChange={e => setCityHe(e.target.value)}
                      className="w-full border border-[#E5E1D8] rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-[#0A192F] text-[#0A192F]" />
                  </div>
                </div>

                <div>
                  <label className="text-xs font-bold text-[#33332D]/50 uppercase tracking-widest block mb-1.5">תיאור קצר</label>
                  <textarea value={description} onChange={e => setDescription(e.target.value)} rows={3}
                    placeholder="בריכה מחוממת, נוף לכינרת, מטבח כשר למהדרין..."
                    className="w-full border border-[#E5E1D8] rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-[#0A192F] text-[#0A192F] resize-none leading-relaxed" />
                  <p className="text-xs text-[#33332D]/30 mt-1">{description.length} תווים</p>
                </div>

                <div>
                  <label className="text-xs font-bold text-[#33332D]/50 uppercase tracking-widest block mb-1.5">קישור לאתר</label>
                  <div className="flex gap-2">
                    <input type="url" value={websiteUrl} onChange={e => setWebsiteUrl(e.target.value)}
                      placeholder="https://www.hotel-example.co.il" dir="ltr"
                      className="flex-1 border border-[#E5E1D8] rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-[#0A192F] text-[#0A192F]" />
                    {websiteUrl && (
                      <a href={websiteUrl} target="_blank" rel="noopener noreferrer"
                        className="p-2.5 rounded-xl border border-[#E5E1D8] text-[#33332D]/50 hover:text-[#0A192F] transition-colors">
                        <ExternalLink size={16} />
                      </a>
                    )}
                  </div>
                </div>

                <button onClick={saveMeta} disabled={saving}
                  className="w-full py-2.5 rounded-xl bg-[#0A192F] text-white text-sm font-semibold hover:bg-[#0A192F]/90 transition-all flex items-center justify-center gap-2">
                  {saving ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
                  {saving ? 'שומר...' : 'שמור שינויים'}
                </button>
              </div>

              {/* תמונות וסרטונים */}
              <div className="bg-white rounded-2xl border border-[#E5E1D8]/60 p-5" style={{ boxShadow: '0 2px 12px rgba(98,109,88,0.07)' }}>
                <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
                  <p className="text-xs font-bold text-[#33332D]/50 uppercase tracking-widest">מדיה ({images.length})</p>
                  <div className="flex items-center gap-2">
                    <button onClick={() => fileRef.current?.click()} disabled={uploading}
                      className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-[#626D58] text-white text-sm font-semibold hover:bg-[#626D58]/90 transition-all">
                      {uploading ? <Loader2 size={15} className="animate-spin" /> : <Upload size={15} />}
                      {uploading ? 'מעלה...' : 'העלה תמונות'}
                    </button>
                    <button onClick={() => videoFileRef.current?.click()} disabled={uploading}
                      className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-[#0A192F] text-white text-sm font-semibold hover:bg-[#0A192F]/90 transition-all">
                      <Video size={15} />
                      העלה סרטון
                    </button>
                    <button onClick={() => setShowVideoUrlModal(true)}
                      className="inline-flex items-center gap-2 px-4 py-2 rounded-xl border border-[#E5E1D8] text-[#33332D]/70 text-sm font-semibold hover:bg-[#F7F5F0] transition-all">
                      <Link2 size={15} />
                      קישור סרטון
                    </button>
                  </div>
                  <input ref={fileRef} type="file" accept="image/*" multiple className="hidden" onChange={e => handleUpload(e.target.files, 'image')} />
                  <input ref={videoFileRef} type="file" accept="video/*" multiple className="hidden" onChange={e => handleUpload(e.target.files, 'video')} />
                </div>

                <div className="border-2 border-dashed border-[#E5E1D8] rounded-2xl p-5 text-center mb-4 hover:border-[#626D58]/50 transition-colors cursor-pointer"
                  onClick={() => fileRef.current?.click()}
                  onDragOver={e => e.preventDefault()}
                  onDrop={e => { e.preventDefault(); handleUpload(e.dataTransfer.files, 'image'); }}>
                  <ImageIcon className="text-[#33332D]/20 mx-auto mb-2" size={28} />
                  <p className="text-sm text-[#33332D]/40">גרור תמונות לכאן או לחץ להעלאה</p>
                  <p className="text-xs text-[#33332D]/25 mt-1">JPG, PNG, WEBP — מספר בבת אחת. לסרטון השתמשו בכפתורים למעלה</p>
                </div>

                {images.length === 0 ? (
                  <p className="text-center text-sm text-[#33332D]/30 py-2">אין מדיה עדיין</p>
                ) : (
                  <div className="grid grid-cols-3 gap-3">
                    {images.map((img, idx) => {
                      const isVideo = img.media_type === 'video';
                      return (
                        <div key={img.id} className="relative group rounded-xl overflow-hidden border border-[#E5E1D8]/60 bg-black/5">
                          {isVideo ? (
                            img.url.includes(`/object/public/${BUCKET}/`) ? (
                              <video src={img.url} className="w-full h-28 object-cover" muted preload="metadata" />
                            ) : (
                              <div className="w-full h-28 flex items-center justify-center bg-[#0A192F]/5">
                                <Video className="text-[#33332D]/25" size={26} />
                              </div>
                            )
                          ) : (
                            <img src={img.url} alt="" className="w-full h-28 object-cover" loading="lazy" />
                          )}
                          {isVideo && (
                            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                              <div className="w-8 h-8 rounded-full bg-black/50 flex items-center justify-center">
                                <Video size={14} className="text-white" />
                              </div>
                            </div>
                          )}
                          {idx === 0 && <span className="absolute top-1.5 end-1.5 text-[9px] font-bold bg-[#0A192F] text-white px-1.5 py-0.5 rounded-md">ראשית</span>}
                          <div className="absolute inset-0 bg-black/0 group-hover:bg-black/45 transition-all flex items-center justify-center gap-1.5 opacity-0 group-hover:opacity-100">
                            <button onClick={() => move(idx, -1)} disabled={idx === 0} className="p-1.5 rounded-lg bg-white/90 text-[#0A192F] disabled:opacity-30"><ChevronUp size={13} /></button>
                            <button onClick={() => move(idx, 1)} disabled={idx === images.length - 1} className="p-1.5 rounded-lg bg-white/90 text-[#0A192F] disabled:opacity-30"><ChevronDown size={13} /></button>
                            <button onClick={() => handleDelete(img)} className="p-1.5 rounded-lg bg-red-500 text-white"><Trash2 size={13} /></button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* תצוגה מקדימה */}
          {showPreview && (
            <div className="col-span-4">
              <div className="sticky top-6">
                <p className="text-xs font-bold text-[#33332D]/40 uppercase tracking-widest mb-3 text-center">תצוגה ללקוח</p>
                <div className="bg-white rounded-[2rem] overflow-hidden border border-[#E5E1D8]/60" style={{ boxShadow: '0 4px 24px 0 rgba(98,109,88,0.12)' }}>
                  <div className="relative h-52 bg-gradient-to-br from-[#E5E1D8] to-[#F7F5F0] flex items-center justify-center">
                    {coverUrl ? <img src={coverUrl} alt="" className="w-full h-full object-cover" /> : (
                      <div className="flex flex-col items-center gap-2">
                        <ImageIcon className="text-[#33332D]/15" size={40} />
                        <span className="text-[10px] text-[#33332D]/25">תמונה תופיע כאן</span>
                      </div>
                    )}
                    <div className="absolute top-3 end-3 flex items-center gap-1 px-2.5 py-1 rounded-xl bg-white/90 text-xs font-bold text-[#B08D57]">
                      <Star size={11} fill="currentColor" /><span>5.0</span>
                    </div>
                    {place?.is_new && <div className="absolute top-3 start-3 px-2.5 py-1 rounded-xl bg-[#626D58] text-white text-[10px] font-bold">חדש</div>}
                  </div>
                  <div className="p-5 flex flex-col gap-3" dir="rtl">
                    <div>
                      <div className="flex items-center gap-1.5 text-xs text-[#33332D]/40 mb-1.5">
                        <MapPin size={11} className="text-[#626D58]" />
                        <span>{cityHe || place?.city_he}</span>
                        <span className="text-[#33332D]/20">·</span>
                        <span>{place?.region}</span>
                      </div>
                      <h3 className="text-base font-bold text-[#0A192F]">{nameHe || place?.name_he}</h3>
                    </div>
                    <p className={`text-xs leading-relaxed font-light ${description ? 'text-[#33332D]/55' : 'text-[#33332D]/25 italic'}`}>
                      {description || 'התיאור יופיע כאן...'}
                    </p>
                    {meta && (
                      <div className="flex items-center gap-2 text-xs text-[#33332D]/60">
                        <Moon size={12} className="text-[#626D58]" />
                        <span>{meta.nights} לילות באמצע השבוע · חופשה זוגית</span>
                      </div>
                    )}
                    {meta && (
                      <div className="rounded-xl bg-[#626D58]/8 border border-[#626D58]/15 px-4 py-2.5">
                        <div className="text-[9px] font-bold uppercase tracking-widest text-[#626D58]/60 mb-0.5">משויך לתוכנית</div>
                        <div className="text-xs font-bold text-[#0A192F]">{meta.name_he} — ₪{meta.monthly_amount} לחודש</div>
                        <div className="text-[10px] text-[#33332D]/45">למשך {meta.months} חודש</div>
                      </div>
                    )}
                    <div className="flex gap-2">
                      <div className="flex-1 py-2.5 rounded-xl border-2 border-[#0A192F] text-center text-xs font-semibold text-[#0A192F]">פרטים נוספים</div>
                      <div className="flex-1 py-2.5 rounded-xl bg-[#0A192F] text-center text-xs font-semibold text-white">הצטרפו</div>
                    </div>
                  </div>
                </div>
                <p className="text-[10px] text-center text-[#33332D]/30 mt-3">* כך תיראה הכרטיסייה בדף הנופשים</p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* מודל הוספת סרטון בקישור */}
      {showVideoUrlModal && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4" onClick={() => setShowVideoUrlModal(false)}>
          <div className="bg-white rounded-3xl p-7 w-full max-w-md shadow-2xl" dir="rtl" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-black text-[#0A192F]">הוסף סרטון בקישור</h2>
              <button onClick={() => setShowVideoUrlModal(false)} className="p-2 rounded-xl hover:bg-[#F7F5F0] text-[#33332D]/50 transition-colors"><X size={18} /></button>
            </div>
            <p className="text-sm text-[#33332D]/55 mb-4">הדביקו קישור לסרטון YouTube / Vimeo, או קישור ישיר לקובץ וידאו.</p>
            <input value={videoUrlInput} onChange={e => setVideoUrlInput(e.target.value)} placeholder="https://youtube.com/watch?v=..." dir="ltr"
              className="w-full border border-[#E5E1D8] rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-[#0A192F] mb-4" />
            <div className="flex gap-3">
              <button onClick={() => setShowVideoUrlModal(false)} className="flex-1 py-3 rounded-xl border border-[#E5E1D8] text-[#33332D]/60 font-semibold text-sm hover:bg-[#F7F5F0]">ביטול</button>
              <button onClick={addVideoByUrl} disabled={!videoUrlInput.trim()}
                className="flex-1 py-3 rounded-xl bg-[#0A192F] text-white font-semibold text-sm hover:bg-[#0A192F]/90 transition-all disabled:opacity-40">הוסף</button>
            </div>
          </div>
        </div>
      )}

      {/* מודל הוספת מקום */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4" onClick={() => setShowAddModal(false)}>
          <div className="bg-white rounded-3xl p-7 w-full max-w-lg shadow-2xl" dir="rtl" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-black text-[#0A192F]">הוסף מקום חדש</h2>
              <button onClick={() => setShowAddModal(false)} className="p-2 rounded-xl hover:bg-[#F7F5F0] text-[#33332D]/50 transition-colors"><X size={18} /></button>
            </div>

            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold text-[#33332D]/50 block mb-1.5">שם המקום *</label>
                  <input value={newPlace.name_he} onChange={e => setNewPlace(p => ({ ...p, name_he: e.target.value }))}
                    placeholder="מלון כינורות" className="w-full border border-[#E5E1D8] rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-[#0A192F]" />
                </div>
                <div>
                  <label className="text-xs font-bold text-[#33332D]/50 block mb-1.5">עיר *</label>
                  <input value={newPlace.city_he} onChange={e => setNewPlace(p => ({ ...p, city_he: e.target.value }))}
                    placeholder="טבריה" className="w-full border border-[#E5E1D8] rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-[#0A192F]" />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold text-[#33332D]/50 block mb-1.5">אזור</label>
                  <select value={newPlace.region} onChange={e => setNewPlace(p => ({ ...p, region: e.target.value }))}
                    className="w-full border border-[#E5E1D8] rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-[#0A192F] bg-white">
                    {REGIONS.map(r => <option key={r}>{r}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs font-bold text-[#33332D]/50 block mb-1.5">תוכנית</label>
                  <select value={newPlace.level} onChange={e => setNewPlace(p => ({ ...p, level: e.target.value }))}
                    className="w-full border border-[#E5E1D8] rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-[#0A192F] bg-white">
                    {PREVIEW_PLAN_META.map(m => <option key={m.level} value={m.level}>{m.name_he} · ₪{m.monthly_amount}</option>)}
                  </select>
                </div>
              </div>

              <div>
                <label className="text-xs font-bold text-[#33332D]/50 block mb-1.5">תיאור קצר</label>
                <textarea value={newPlace.description_he} onChange={e => setNewPlace(p => ({ ...p, description_he: e.target.value }))}
                  rows={2} placeholder="בריכה, נוף לכינרת, מטבח כשר..."
                  className="w-full border border-[#E5E1D8] rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-[#0A192F] resize-none" />
              </div>

              <div>
                <label className="text-xs font-bold text-[#33332D]/50 block mb-1.5">קישור לאתר</label>
                <input type="url" value={newPlace.website_url} onChange={e => setNewPlace(p => ({ ...p, website_url: e.target.value }))}
                  placeholder="https://..." dir="ltr"
                  className="w-full border border-[#E5E1D8] rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-[#0A192F]" />
              </div>

              <label className="flex items-center gap-3 cursor-pointer">
                <input type="checkbox" checked={newPlace.is_new} onChange={e => setNewPlace(p => ({ ...p, is_new: e.target.checked }))}
                  className="w-4 h-4 rounded accent-[#626D58]" />
                <span className="text-sm font-semibold text-[#33332D]">הצג תגית "חדש"</span>
              </label>
              <label className="flex items-center gap-3 cursor-pointer">
                <input type="checkbox" checked={newPlace.published} onChange={e => setNewPlace(p => ({ ...p, published: e.target.checked }))}
                  className="w-4 h-4 rounded accent-[#0A192F]" />
                <span className="text-sm font-semibold text-[#33332D]">פרסם מיד (גלוי לכולם)</span>
                <span className="text-xs text-[#33332D]/40">• ברירת מחדל: טיוטה</span>
              </label>

              <button onClick={addNewPlace} disabled={addingPlace || !newPlace.name_he || !newPlace.city_he}
                className="w-full py-3 rounded-xl bg-[#0A192F] text-white font-bold text-sm hover:bg-[#0A192F]/90 transition-all flex items-center justify-center gap-2 disabled:opacity-50">
                {addingPlace ? <Loader2 size={15} className="animate-spin" /> : <Plus size={15} />}
                {addingPlace ? 'מוסיף...' : 'הוסף מקום'}
              </button>
            </div>
          </div>
        </div>
      )}

      {toast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-[#0A192F] text-white text-sm font-semibold px-5 py-3 rounded-2xl shadow-xl z-50">
          {toast}
        </div>
      )}
    </AdminLayout>
  );
};
