import { useEffect, useState } from 'react';
import { AdminLayout } from '../../components/AdminLayout';
import { supabase } from '../../lib/supabase';
import { createNotification } from '../../hooks/useNotifications';
import { Repeat, Clock, CheckCircle, XCircle, Loader2, X, Send, Mail, Phone } from 'lucide-react';

interface PlanChangeRequest {
  id: string;
  user_id: string;
  old_subscription_id: string;
  old_plan_name_he: string | null;
  new_plan_name_he: string | null;
  paid_amount_snapshot: number;
  credited_months: number;
  credited_remainder: number;
  months_to_pay: number;
  status: string;
  admin_note: string | null;
  created_at: string;
}

const STATUS_META: Record<string, { label: string; color: string; icon: any }> = {
  pending_review: { label: 'ממתין לבדיקה', color: 'bg-amber-100 text-amber-700', icon: Clock },
  approved: { label: 'אושר — ממתין לתשלום הלקוח', color: 'bg-blue-100 text-blue-700', icon: CheckCircle },
  completed: { label: 'הושלם', color: 'bg-green-100 text-green-700', icon: CheckCircle },
  rejected: { label: 'נדחה', color: 'bg-red-100 text-red-700', icon: XCircle },
};

export const AdminPlanChangeRequestsPage = () => {
  const [requests, setRequests] = useState<PlanChangeRequest[]>([]);
  const [profiles, setProfiles] = useState<Record<string, { full_name: string | null; email: string | null; phone: string | null }>>({});
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [rejectModal, setRejectModal] = useState<PlanChangeRequest | null>(null);
  const [rejectNote, setRejectNote] = useState('');
  const [tab, setTab] = useState<'new' | 'inProgress' | 'history'>('new');

  const showToast = (m: string) => { setToast(m); setTimeout(() => setToast(null), 2500); };

  useEffect(() => { load(); }, []);

  const load = async () => {
    const { data: reqs } = await supabase
      .from('plan_change_requests')
      .select('*')
      .order('created_at', { ascending: false });
    const rows = (reqs ?? []) as PlanChangeRequest[];
    setRequests(rows);

    const userIds = Array.from(new Set(rows.map((r) => r.user_id)));
    if (userIds.length) {
      const { data: profs } = await supabase.from('profiles').select('id, full_name, email, phone').in('id', userIds);
      const pmap: Record<string, { full_name: string | null; email: string | null; phone: string | null }> = {};
      for (const p of profs ?? []) pmap[p.id] = { full_name: p.full_name, email: p.email, phone: p.phone };
      setProfiles(pmap);
    }
    setLoading(false);
  };

  const approve = async (req: PlanChangeRequest) => {
    setBusyId(req.id);
    await supabase.from('plan_change_requests').update({ status: 'approved', updated_at: new Date().toISOString() }).eq('id', req.id);
    await createNotification({
      recipient_id: req.user_id,
      type: 'plan_change_approved',
      title: 'בקשת החלפת התוכנית שלך אושרה! 🎉',
      body: `אפשר להשלים עכשיו את התשלום לתוכנית "${req.new_plan_name_he}".`,
      link: '/donor/switch-plan',
      email: { to: profiles[req.user_id]?.email, donorName: profiles[req.user_id]?.full_name },
    });
    await load();
    setBusyId(null);
    showToast('✓ הבקשה אושרה והלקוח קיבל התראה');
  };

  const doReject = async () => {
    if (!rejectModal) return;
    const req = rejectModal;
    setBusyId(req.id);
    await supabase.from('plan_change_requests').update({ status: 'rejected', admin_note: rejectNote || null, updated_at: new Date().toISOString() }).eq('id', req.id);
    await createNotification({
      recipient_id: req.user_id,
      type: 'plan_change_rejected',
      title: 'בקשת החלפת התוכנית לא אושרה',
      body: rejectNote || 'ניתן לפנות אלינו דרך עמוד התמיכה לפרטים נוספים.',
      link: '/support',
      email: { to: profiles[req.user_id]?.email, donorName: profiles[req.user_id]?.full_name },
    });
    await load();
    setBusyId(null);
    setRejectModal(null);
    setRejectNote('');
    showToast('הבקשה נדחתה והלקוח עודכן');
  };

  const inTab = (r: PlanChangeRequest, t: 'new' | 'inProgress' | 'history') => {
    if (t === 'new') return r.status === 'pending_review';
    if (t === 'inProgress') return r.status === 'approved';
    return ['completed', 'rejected'].includes(r.status);
  };
  const counts = {
    new: requests.filter((r) => inTab(r, 'new')).length,
    inProgress: requests.filter((r) => inTab(r, 'inProgress')).length,
    history: requests.filter((r) => inTab(r, 'history')).length,
  };
  const visible = requests.filter((r) => inTab(r, tab));
  const TABS: { key: 'new' | 'inProgress' | 'history'; label: string }[] = [
    { key: 'new', label: 'בקשות חדשות' },
    { key: 'inProgress', label: 'ממתין לתשלום' },
    { key: 'history', label: 'היסטוריה' },
  ];

  return (
    <AdminLayout>
      <div dir="rtl">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-xl bg-[#D4B483]/15 flex items-center justify-center">
            <Repeat className="text-[#B08D57]" size={20} />
          </div>
          <h1 className="text-2xl font-black text-[#0A192F]">בקשות החלפת תוכנית</h1>
        </div>

        <div className="flex gap-2 mb-6 border-b border-[#E5E1D8]">
          {TABS.map(({ key, label }) => (
            <button key={key} onClick={() => setTab(key)}
              className={`px-4 py-2.5 text-sm font-semibold border-b-2 -mb-px transition-all flex items-center gap-2 ${tab === key ? 'border-[#0A192F] text-[#0A192F]' : 'border-transparent text-[#33332D]/45 hover:text-[#33332D]'}`}>
              {label}
              {counts[key] > 0 && (
                <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${tab === key ? 'bg-[#0A192F] text-white' : 'bg-[#E5E1D8] text-[#33332D]/60'}`}>{counts[key]}</span>
              )}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="flex justify-center py-20"><Loader2 className="animate-spin text-[#626D58]" size={28} /></div>
        ) : visible.length === 0 ? (
          <div className="bg-white rounded-2xl border border-[#E5E1D8]/60 p-12 text-center">
            <Repeat className="text-[#33332D]/15 mx-auto mb-3" size={36} />
            <p className="text-[#33332D]/40">{tab === 'new' ? 'אין בקשות חדשות' : tab === 'inProgress' ? 'אין בקשות ממתינות לתשלום' : 'אין היסטוריה'}</p>
          </div>
        ) : (
          <div className="space-y-3">
            {visible.map((req) => {
              const meta = STATUS_META[req.status] ?? STATUS_META.pending_review;
              const Icon = meta.icon;
              const busy = busyId === req.id;
              const profile = profiles[req.user_id];
              return (
                <div key={req.id} className="bg-white rounded-2xl border border-[#E5E1D8]/60 p-5" style={{ boxShadow: '0 2px 12px rgba(98,109,88,0.06)' }}>
                  <div className="flex items-start justify-between gap-4 flex-wrap">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1.5">
                        <span className={`inline-flex items-center gap-1.5 text-[11px] font-bold px-2.5 py-1 rounded-full ${meta.color}`}>
                          <Icon size={12} /> {meta.label}
                        </span>
                        <span className="text-[11px] text-[#33332D]/35">
                          {new Date(req.created_at).toLocaleDateString('he-IL')} · {new Date(req.created_at).toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                      <h3 className="text-lg font-bold text-[#0A192F]">{profile?.full_name || 'משתמש'}</h3>
                      <div className="mt-1 space-y-0.5 text-sm">
                        {profile?.email && (
                          <a href={`mailto:${profile.email}`} className="flex items-center gap-1.5 text-[#0A192F] hover:underline font-medium">
                            <Mail size={13} className="text-[#626D58]" />{profile.email}
                          </a>
                        )}
                        {profile?.phone && (
                          <a href={`tel:${profile.phone}`} className="flex items-center gap-1.5 text-[#33332D]/60 hover:underline">
                            <Phone size={13} className="text-[#626D58]" />{profile.phone}
                          </a>
                        )}
                      </div>

                      <div className="mt-3 rounded-xl bg-[#F7F5F0] border border-[#E5E1D8]/60 px-4 py-3 grid grid-cols-2 gap-2 text-sm">
                        <div><span className="text-[#33332D]/40">מ: </span><span className="font-semibold text-[#0A192F]">{req.old_plan_name_he}</span></div>
                        <div><span className="text-[#33332D]/40">אל: </span><span className="font-semibold text-[#0A192F]">{req.new_plan_name_he}</span></div>
                        <div><span className="text-[#33332D]/40">שווי ששולם: </span><span className="font-semibold">₪{req.paid_amount_snapshot.toLocaleString()}</span></div>
                        <div><span className="text-[#33332D]/40">חודשי זיכוי: </span><span className="font-semibold text-green-700">{req.credited_months}</span></div>
                        <div><span className="text-[#33332D]/40">יתרה לא מזוכה: </span><span className="font-semibold">₪{req.credited_remainder.toLocaleString()}</span></div>
                        <div><span className="text-[#33332D]/40">תשלומים שנשארו: </span><span className="font-semibold">{req.months_to_pay}</span></div>
                      </div>

                      {req.status === 'rejected' && req.admin_note && (
                        <p className="mt-2 text-xs text-red-600">סיבת דחייה: {req.admin_note}</p>
                      )}
                      {req.status === 'completed' && req.admin_note && (
                        <p className="mt-2 text-xs text-red-600 font-bold">{req.admin_note}</p>
                      )}
                    </div>

                    <div className="flex flex-col gap-2 shrink-0">
                      {req.status === 'pending_review' && (
                        <>
                          <button onClick={() => approve(req)} disabled={busy}
                            className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-[#626D58] text-white text-sm font-semibold hover:bg-[#626D58]/90 transition-all disabled:opacity-50">
                            {busy ? <Loader2 size={15} className="animate-spin" /> : <CheckCircle size={15} />} אשר בקשה
                          </button>
                          <button onClick={() => { setRejectModal(req); setRejectNote(''); }} disabled={busy}
                            className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl border border-red-200 text-red-600 text-sm font-semibold hover:bg-red-50 transition-all disabled:opacity-50">
                            <XCircle size={15} /> דחה
                          </button>
                        </>
                      )}
                      {req.status === 'approved' && (
                        <span className="inline-flex items-center gap-1.5 text-xs text-blue-600 font-semibold px-3 py-2">
                          <Clock size={13} /> ממתין שהלקוח ישלים תשלום
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {rejectModal && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4" dir="rtl" onClick={() => setRejectModal(null)}>
          <div className="bg-white rounded-3xl p-7 w-full max-w-md shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-black text-[#0A192F]">דחיית בקשה</h2>
              <button onClick={() => setRejectModal(null)} className="p-2 rounded-xl hover:bg-[#F7F5F0] text-[#33332D]/50"><X size={18} /></button>
            </div>
            <p className="text-sm text-[#33332D]/55 mb-4">הלקוח יקבל התראה. אפשר להוסיף סיבה (יוצג ללקוח):</p>
            <textarea
              value={rejectNote}
              onChange={(e) => setRejectNote(e.target.value)}
              rows={3}
              placeholder="לדוגמה: יש לוודא פרטים נוספים מולנו לפני ההחלפה."
              className="w-full border border-[#E5E1D8] rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-[#0A192F] resize-none mb-4"
            />
            <div className="flex gap-3">
              <button onClick={() => setRejectModal(null)} className="flex-1 py-3 rounded-xl border border-[#E5E1D8] text-[#33332D]/60 font-semibold text-sm hover:bg-[#F7F5F0]">ביטול</button>
              <button onClick={doReject} disabled={busyId === rejectModal.id}
                className="flex-1 py-3 rounded-xl bg-red-500 text-white font-semibold text-sm hover:bg-red-600 transition-all flex items-center justify-center gap-2 disabled:opacity-50">
                {busyId === rejectModal.id ? <Loader2 size={15} className="animate-spin" /> : <Send size={15} />}
                שלח דחייה
              </button>
            </div>
          </div>
        </div>
      )}

      {toast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-[#0A192F] text-white text-sm font-semibold px-5 py-3 rounded-2xl shadow-xl z-50">{toast}</div>
      )}
    </AdminLayout>
  );
};
