import React, { useEffect, useState, useMemo } from 'react';
import { AdminLayout } from '../../components/AdminLayout';
import { supabase } from '../../lib/supabase';
import { Download, Search, X, Eye, CreditCard, RefreshCw, AlertCircle, TrendingUp, Calendar } from 'lucide-react';
import { Toast } from '../../components/admin/Toast';
import { Modal } from '../../components/admin/Modal';
import { useToast } from '../../hooks/useToast';
import { useAuth } from '../../contexts/AuthContext';

interface Payment {
  id: string;
  subscription_id: string;
  amount: number;
  status: 'succeeded' | 'failed' | 'pending';
  attempt_number: number;
  paid_at: string | null;
  created_at: string;
  failure_reason: string | null;
  subscriptions: {
    successful_payments_count: number;
    plan_id: string;
    plans: {
      monthly_amount: number;
      required_successful_payments: number;
      name_he: string;
    };
    profiles: {
      full_name: string;
      email: string;
      phone: string | null;
    };
  } | null;
  // joined from nedarim_donation_callbacks
  nedarim_transaction_id: string | null;
  nedarim_keva_id: string | null;
  nedarim_zeout: string | null;
  nedarim_phone: string | null;
  nedarim_mail: string | null;
  nedarim_tashloumim: string | null;
  nedarim_next_date: string | null;
  nedarim_match_source: 'email' | 'zeout' | 'none' | null;
  nedarim_raw_payload: Record<string, unknown> | null;
}

type PaymentTypeFilter = 'all' | 'recurring_290' | 'recurring_350' | 'one_time' | 'additional';
type StatusFilter = 'all' | 'succeeded' | 'failed' | 'pending';

const TODAY = new Date().toISOString().split('T')[0];
const MONTH_START = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0];

export const AdminPaymentsPage = () => {
  const [payments, setPayments] = useState<Payment[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [typeFilter, setTypeFilter] = useState<PaymentTypeFilter>('all');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [detailPayment, setDetailPayment] = useState<Payment | null>(null);
  const { toast, showToast, hideToast } = useToast();
  const { canView } = useAuth();

  useEffect(() => {
    if (!canView) {
      showToast('אין לך הרשאה לצפות בדף זה', 'error');
      return;
    }
    loadPayments();
  }, []);

  const loadPayments = async () => {
    setLoading(true);
    try {
      // Load payments with full subscription/plan/profile join
      const { data: paymentsData, error: paymentsError } = await supabase
        .from('payments')
        .select(`
          *,
          subscriptions!payments_subscription_id_fkey(
            successful_payments_count,
            plan_id,
            plans!subscriptions_plan_id_fkey(monthly_amount, required_successful_payments, name_he),
            profiles!subscriptions_user_id_fkey(full_name, email, phone)
          )
        `)
        .order('created_at', { ascending: false });

      if (paymentsError) throw paymentsError;

      // Load all donation callbacks to enrich payments
      const { data: callbacksData } = await supabase
        .from('nedarim_donation_callbacks')
        .select('transaction_id, keva_id, zeout, phone, mail, tashloumim, subscription_id, raw_payload')
        .not('subscription_id', 'is', null);

      // Load all keva callbacks for next_date
      const { data: kevaData } = await supabase
        .from('nedarim_keva_callbacks')
        .select('keva_id, next_date, subscription_id, zeout');

      // Build lookup maps
      const callbackBySubId = new Map<string, typeof callbacksData[0]>();
      callbacksData?.forEach((cb) => {
        if (cb.subscription_id && !callbackBySubId.has(cb.subscription_id)) {
          callbackBySubId.set(cb.subscription_id, cb);
        }
      });

      const kevaBySubId = new Map<string, typeof kevaData[0]>();
      kevaData?.forEach((kv) => {
        if (kv.subscription_id) kevaBySubId.set(kv.subscription_id, kv);
      });

      const enriched: Payment[] = (paymentsData || []).map((p) => {
        const cb = p.subscription_id ? callbackBySubId.get(p.subscription_id) ?? null : null;
        const kv = p.subscription_id ? kevaBySubId.get(p.subscription_id) ?? null : null;

        let match_source: Payment['nedarim_match_source'] = null;
        if (cb) {
          match_source = cb.mail ? 'email' : 'zeout';
        } else if (p.subscription_id) {
          match_source = 'none';
        }

        return {
          ...p,
          nedarim_transaction_id: cb?.transaction_id ?? null,
          nedarim_keva_id: cb?.keva_id ?? kv?.keva_id ?? null,
          nedarim_zeout: cb?.zeout ?? kv?.zeout ?? null,
          nedarim_phone: cb?.phone ?? null,
          nedarim_mail: cb?.mail ?? null,
          nedarim_tashloumim: cb?.tashloumim ?? null,
          nedarim_next_date: kv?.next_date ?? null,
          nedarim_match_source: match_source,
          nedarim_raw_payload: (cb?.raw_payload as Record<string, unknown>) ?? null,
        };
      });

      setPayments(enriched);
    } catch (error) {
      console.error('Error loading payments:', error);
      showToast('שגיאה בטעינת תשלומים', 'error');
    } finally {
      setLoading(false);
    }
  };

  // Derive payment type label from plan amount + keva_id presence
  const getPaymentType = (p: Payment): PaymentTypeFilter => {
    const amount = p.subscriptions?.plans?.monthly_amount ?? p.amount;
    const isRecurring = !!p.nedarim_keva_id || !!p.subscription_id;
    if (!isRecurring) return 'one_time';
    if (amount === 290) return 'recurring_290';
    if (amount === 350) return 'recurring_350';
    return 'additional';
  };

  const getPaymentTypeLabel = (p: Payment) => {
    const type = getPaymentType(p);
    const labels: Record<PaymentTypeFilter, string> = {
      all: 'הכל',
      recurring_290: 'קבוע 290₪',
      recurring_350: 'קבוע 350₪',
      one_time: 'חד-פעמי',
      additional: 'תרומה נוספת',
    };
    return labels[type];
  };

  const getPaymentTypeBadgeClass = (p: Payment) => {
    const type = getPaymentType(p);
    const classes: Record<PaymentTypeFilter, string> = {
      all: '',
      recurring_290: 'bg-blue-100 text-blue-800',
      recurring_350: 'bg-sky-100 text-sky-800',
      one_time: 'bg-amber-100 text-amber-800',
      additional: 'bg-teal-100 text-teal-800',
    };
    return classes[type];
  };

  const getMatchSourceLabel = (source: Payment['nedarim_match_source']) => {
    if (source === 'email') return { label: 'אימייל', cls: 'bg-green-100 text-green-800' };
    if (source === 'zeout') return { label: 'זיהוי', cls: 'bg-blue-100 text-blue-700' };
    if (source === 'none') return { label: 'לא שויך', cls: 'bg-gray-100 text-gray-600' };
    return { label: '-', cls: 'bg-gray-50 text-gray-400' };
  };

  const getStatusBadge = (status: string) => {
    const cfg = {
      succeeded: { cls: 'bg-green-100 text-green-800', label: 'הצליח' },
      failed: { cls: 'bg-red-100 text-red-800', label: 'נכשל' },
      pending: { cls: 'bg-yellow-100 text-yellow-800', label: 'ממתין' },
    } as const;
    const s = cfg[status as keyof typeof cfg] ?? { cls: 'bg-gray-100 text-gray-700', label: status };
    return <span className={`px-2 py-1 rounded-full text-xs font-medium ${s.cls}`}>{s.label}</span>;
  };

  // Filtered + searched list
  const filteredPayments = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return payments.filter((p) => {
      if (statusFilter !== 'all' && p.status !== statusFilter) return false;
      if (typeFilter !== 'all' && getPaymentType(p) !== typeFilter) return false;
      if (dateFrom) {
        const d = p.paid_at ?? p.created_at;
        if (d < dateFrom) return false;
      }
      if (dateTo) {
        const d = p.paid_at ?? p.created_at;
        if (d.slice(0, 10) > dateTo) return false;
      }
      if (q) {
        const name = (p.subscriptions?.profiles?.full_name ?? '').toLowerCase();
        const email = (p.subscriptions?.profiles?.email ?? p.nedarim_mail ?? '').toLowerCase();
        const phone = (p.subscriptions?.profiles?.phone ?? p.nedarim_phone ?? '').toLowerCase();
        const zeout = (p.nedarim_zeout ?? '').toLowerCase();
        const txn = (p.nedarim_transaction_id ?? '').toLowerCase();
        if (!name.includes(q) && !email.includes(q) && !phone.includes(q) && !zeout.includes(q) && !txn.includes(q)) {
          return false;
        }
      }
      return true;
    });
  }, [payments, statusFilter, typeFilter, dateFrom, dateTo, searchQuery]);

  // Summary card stats (from full unfiltered list)
  const stats = useMemo(() => {
    const todayPayments = payments.filter(
      (p) => p.status === 'succeeded' && (p.paid_at ?? p.created_at).slice(0, 10) === TODAY
    );
    const monthPayments = payments.filter(
      (p) => p.status === 'succeeded' && (p.paid_at ?? p.created_at).slice(0, 10) >= MONTH_START
    );
    const activeRecurring = new Set(
      payments
        .filter((p) => p.subscription_id && getPaymentType(p).startsWith('recurring'))
        .map((p) => p.subscription_id)
    ).size;
    const failed = payments.filter((p) => p.status === 'failed').length;
    const oneTime = payments.filter((p) => getPaymentType(p) === 'one_time').length;
    return {
      todayTotal: todayPayments.reduce((s, p) => s + p.amount, 0),
      todayCount: todayPayments.length,
      monthTotal: monthPayments.reduce((s, p) => s + p.amount, 0),
      monthCount: monthPayments.length,
      activeRecurring,
      failed,
      oneTime,
    };
  }, [payments]);

  const handleExportCSV = () => {
    try {
      const headers = [
        'תאריך', 'שם תורם', 'אימייל', 'טלפון', 'סכום', 'סטטוס', 'סוג תשלום',
        'מזהה עסקה', 'KevaId', 'זיהוי', 'התאמה', 'התקדמות', 'תשלום הבא', 'ניסיון', 'סיבת כישלון',
      ];
      const rows = filteredPayments.map((p) => {
        const sub = p.subscriptions;
        const progress = sub
          ? `${sub.successful_payments_count}/${sub.plans?.required_successful_payments ?? '?'}`
          : '-';
        const match = getMatchSourceLabel(p.nedarim_match_source);
        return [
          (p.paid_at ?? p.created_at).slice(0, 10),
          sub?.profiles?.full_name || p.nedarim_mail || 'לא זמין',
          sub?.profiles?.email || p.nedarim_mail || 'לא זמין',
          sub?.profiles?.phone || p.nedarim_phone || '',
          `₪${p.amount}`,
          p.status,
          getPaymentTypeLabel(p),
          p.nedarim_transaction_id || '',
          p.nedarim_keva_id || '',
          p.nedarim_zeout || '',
          match.label,
          progress,
          p.nedarim_next_date || '',
          String(p.attempt_number),
          p.failure_reason || '',
        ];
      });
      const BOM = '\uFEFF';
      const csv =
        BOM +
        [headers.join(','), ...rows.map((r) => r.map((c) => `"${c}"`).join(','))].join('\n');
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = `payments_${new Date().toISOString().split('T')[0]}.csv`;
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      showToast('הקובץ יוצא בהצלחה', 'success');
    } catch {
      showToast('שגיאה בייצוא הקובץ', 'error');
    }
  };

  const clearFilters = () => {
    setStatusFilter('all');
    setTypeFilter('all');
    setDateFrom('');
    setDateTo('');
    setSearchQuery('');
  };

  const hasActiveFilters =
    statusFilter !== 'all' || typeFilter !== 'all' || dateFrom || dateTo || searchQuery;

  if (!canView) {
    return (
      <AdminLayout>
        <div className="flex items-center justify-center h-64">
          <p className="text-gray-600">אין לך הרשאה לצפות בדף זה</p>
        </div>
      </AdminLayout>
    );
  }

  if (loading) {
    return (
      <AdminLayout>
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#0B3C5D]"></div>
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout>
      {/* Header */}
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-[#0B3C5D]">ניהול תשלומים</h1>
          <p className="text-gray-500 mt-1 text-sm">צפייה, סינון וניתוח תשלומים מנדרים פלוס</p>
        </div>
        <button
          onClick={handleExportCSV}
          className="flex items-center gap-2 bg-[#C6A75E] text-white px-4 py-2 rounded-lg hover:bg-opacity-90 transition-colors text-sm font-medium"
        >
          <Download size={16} />
          ייצא ל-CSV
        </button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4 mb-8">
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4 flex flex-col gap-1">
          <div className="flex items-center justify-between">
            <span className="text-xs text-gray-500 font-medium">תרומות היום</span>
            <span className="w-8 h-8 rounded-lg bg-green-50 flex items-center justify-center">
              <TrendingUp size={16} className="text-green-600" />
            </span>
          </div>
          <p className="text-2xl font-bold text-gray-900">₪{stats.todayTotal.toLocaleString('he-IL')}</p>
          <p className="text-xs text-gray-400">{stats.todayCount} תשלומים</p>
        </div>

        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4 flex flex-col gap-1">
          <div className="flex items-center justify-between">
            <span className="text-xs text-gray-500 font-medium">תרומות החודש</span>
            <span className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center">
              <Calendar size={16} className="text-blue-600" />
            </span>
          </div>
          <p className="text-2xl font-bold text-gray-900">₪{stats.monthTotal.toLocaleString('he-IL')}</p>
          <p className="text-xs text-gray-400">{stats.monthCount} תשלומים</p>
        </div>

        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4 flex flex-col gap-1">
          <div className="flex items-center justify-between">
            <span className="text-xs text-gray-500 font-medium">מנויים פעילים</span>
            <span className="w-8 h-8 rounded-lg bg-sky-50 flex items-center justify-center">
              <RefreshCw size={16} className="text-sky-600" />
            </span>
          </div>
          <p className="text-2xl font-bold text-gray-900">{stats.activeRecurring}</p>
          <p className="text-xs text-gray-400">קבועים</p>
        </div>

        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4 flex flex-col gap-1">
          <div className="flex items-center justify-between">
            <span className="text-xs text-gray-500 font-medium">תשלומים שנכשלו</span>
            <span className="w-8 h-8 rounded-lg bg-red-50 flex items-center justify-center">
              <AlertCircle size={16} className="text-red-500" />
            </span>
          </div>
          <p className="text-2xl font-bold text-gray-900">{stats.failed}</p>
          <p className="text-xs text-gray-400">כישלונות</p>
        </div>

        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4 flex flex-col gap-1">
          <div className="flex items-center justify-between">
            <span className="text-xs text-gray-500 font-medium">תרומות חד-פעמיות</span>
            <span className="w-8 h-8 rounded-lg bg-amber-50 flex items-center justify-center">
              <CreditCard size={16} className="text-amber-600" />
            </span>
          </div>
          <p className="text-2xl font-bold text-gray-900">{stats.oneTime}</p>
          <p className="text-xs text-gray-400">עסקאות</p>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4 mb-6 space-y-4">
        {/* Search */}
        <div className="relative">
          <Search size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="חיפוש לפי שם, אימייל, טלפון, זיהוי, מזהה עסקה..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pr-9 pl-4 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#0B3C5D]/20 focus:border-[#0B3C5D]"
            dir="rtl"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
            >
              <X size={14} />
            </button>
          )}
        </div>

        <div className="flex flex-wrap gap-3 items-end">
          {/* Status */}
          <div className="flex flex-col gap-1">
            <label className="text-xs text-gray-500 font-medium">סטטוס</label>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}
              className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#0B3C5D]/20"
            >
              <option value="all">הכל</option>
              <option value="succeeded">הצליחו</option>
              <option value="failed">נכשלו</option>
              <option value="pending">ממתינים</option>
            </select>
          </div>

          {/* Payment type */}
          <div className="flex flex-col gap-1">
            <label className="text-xs text-gray-500 font-medium">סוג תשלום</label>
            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value as PaymentTypeFilter)}
              className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#0B3C5D]/20"
            >
              <option value="all">כל הסוגים</option>
              <option value="recurring_290">קבוע 290₪</option>
              <option value="recurring_350">קבוע 350₪</option>
              <option value="one_time">חד-פעמי</option>
              <option value="additional">תרומה נוספת</option>
            </select>
          </div>

          {/* Date from */}
          <div className="flex flex-col gap-1">
            <label className="text-xs text-gray-500 font-medium">מתאריך</label>
            <input
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#0B3C5D]/20"
            />
          </div>

          {/* Date to */}
          <div className="flex flex-col gap-1">
            <label className="text-xs text-gray-500 font-medium">עד תאריך</label>
            <input
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#0B3C5D]/20"
            />
          </div>

          {hasActiveFilters && (
            <button
              onClick={clearFilters}
              className="flex items-center gap-1 px-3 py-2 text-sm text-gray-500 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors self-end"
            >
              <X size={14} />
              נקה סינון
            </button>
          )}

          <span className="text-xs text-gray-400 self-end pb-2 mr-auto">
            {filteredPayments.length} מתוך {payments.length} תשלומים
          </span>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm">
        <div className="overflow-x-auto">
        <table className="w-full min-w-[1100px]">
          <thead className="bg-gray-50 border-b border-gray-100">
            <tr>
              <th className="px-4 py-3 text-right text-xs font-semibold text-gray-600 uppercase tracking-wide">תורם</th>
              <th className="px-4 py-3 text-right text-xs font-semibold text-gray-600 uppercase tracking-wide">אימייל / טלפון</th>
              <th className="px-4 py-3 text-right text-xs font-semibold text-gray-600 uppercase tracking-wide">סוג תשלום</th>
              <th className="px-4 py-3 text-right text-xs font-semibold text-gray-600 uppercase tracking-wide">סכום</th>
              <th className="px-4 py-3 text-right text-xs font-semibold text-gray-600 uppercase tracking-wide">סטטוס</th>
              <th className="px-4 py-3 text-right text-xs font-semibold text-gray-600 uppercase tracking-wide">התאמה</th>
              <th className="px-4 py-3 text-right text-xs font-semibold text-gray-600 uppercase tracking-wide">התקדמות</th>
              <th className="px-4 py-3 text-right text-xs font-semibold text-gray-600 uppercase tracking-wide">מזהה / Keva</th>
              <th className="px-4 py-3 text-right text-xs font-semibold text-gray-600 uppercase tracking-wide">זיהוי</th>
              <th className="px-4 py-3 text-right text-xs font-semibold text-gray-600 uppercase tracking-wide">תאריך / הבא</th>
              <th className="px-4 py-3 text-center text-xs font-semibold text-gray-600 uppercase tracking-wide">פרטים</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {filteredPayments.length === 0 ? (
              <tr>
                <td colSpan={11} className="px-6 py-12 text-center text-gray-400">
                  {hasActiveFilters ? 'לא נמצאו תשלומים התואמים את הסינון' : 'אין תשלומים להצגה'}
                </td>
              </tr>
            ) : (
              filteredPayments.map((p) => {
                const sub = p.subscriptions;
                const profile = sub?.profiles;
                const plan = sub?.plans;
                const email = profile?.email || p.nedarim_mail || '';
                const phone = profile?.phone || p.nedarim_phone || '';
                const name = profile?.full_name || p.nedarim_mail || 'לא זמין';
                const progress = sub && plan
                  ? `${sub.successful_payments_count}/${plan.required_successful_payments}`
                  : null;
                const matchInfo = getMatchSourceLabel(p.nedarim_match_source);
                const date = (p.paid_at ?? p.created_at).slice(0, 10);
                const isRecurring = getPaymentType(p).startsWith('recurring');

                return (
                  <tr key={p.id} className="hover:bg-gray-50/60 transition-colors">
                    {/* Donor name */}
                    <td className="px-4 py-3">
                      <span className="text-sm font-medium text-gray-900">{name}</span>
                    </td>

                    {/* Email / Phone */}
                    <td className="px-4 py-3">
                      <div className="flex flex-col gap-0.5">
                        {email && (
                          <span className="text-xs text-gray-700 truncate max-w-[160px]" title={email}>
                            {email}
                          </span>
                        )}
                        {phone && (
                          <span className="text-xs text-gray-500">{phone}</span>
                        )}
                        {!email && !phone && <span className="text-xs text-gray-400">-</span>}
                      </div>
                    </td>

                    {/* Payment type */}
                    <td className="px-4 py-3">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${getPaymentTypeBadgeClass(p)}`}>
                        {getPaymentTypeLabel(p)}
                      </span>
                    </td>

                    {/* Amount */}
                    <td className="px-4 py-3 text-sm font-semibold text-gray-900">
                      ₪{p.amount}
                    </td>

                    {/* Status */}
                    <td className="px-4 py-3">{getStatusBadge(p.status)}</td>

                    {/* Match source */}
                    <td className="px-4 py-3">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${matchInfo.cls}`}>
                        {matchInfo.label}
                      </span>
                    </td>

                    {/* Progress */}
                    <td className="px-4 py-3">
                      {progress ? (
                        <div className="flex flex-col gap-1">
                          <span className="text-xs font-semibold text-gray-800">{progress}</span>
                          {sub && plan && (
                            <div className="w-16 bg-gray-100 rounded-full h-1.5">
                              <div
                                className="bg-[#0B3C5D] h-1.5 rounded-full"
                                style={{
                                  width: `${Math.min(100, (sub.successful_payments_count / plan.required_successful_payments) * 100)}%`,
                                }}
                              />
                            </div>
                          )}
                        </div>
                      ) : (
                        <span className="text-xs text-gray-400">-</span>
                      )}
                    </td>

                    {/* Transaction ID / KevaId */}
                    <td className="px-4 py-3">
                      <div className="flex flex-col gap-0.5">
                        {p.nedarim_transaction_id && (
                          <span className="text-xs font-mono text-gray-700 truncate max-w-[120px]" title={p.nedarim_transaction_id}>
                            {p.nedarim_transaction_id}
                          </span>
                        )}
                        {p.nedarim_keva_id && (
                          <span className="text-xs font-mono text-gray-400 truncate max-w-[120px]" title={p.nedarim_keva_id}>
                            K: {p.nedarim_keva_id}
                          </span>
                        )}
                        {!p.nedarim_transaction_id && !p.nedarim_keva_id && (
                          <span className="text-xs text-gray-400">-</span>
                        )}
                      </div>
                    </td>

                    {/* Zeout */}
                    <td className="px-4 py-3">
                      <span className="text-xs font-mono text-gray-600 truncate max-w-[100px] block" title={p.nedarim_zeout ?? ''}>
                        {p.nedarim_zeout || '-'}
                      </span>
                    </td>

                    {/* Date / Next payment */}
                    <td className="px-4 py-3">
                      <div className="flex flex-col gap-0.5">
                        <span className="text-xs text-gray-800">{new Date(date).toLocaleDateString('he-IL')}</span>
                        {isRecurring && p.nedarim_next_date && (
                          <span className="text-xs text-blue-600">
                            הבא: {new Date(p.nedarim_next_date).toLocaleDateString('he-IL')}
                          </span>
                        )}
                      </div>
                    </td>

                    {/* View details */}
                    <td className="px-4 py-3 text-center">
                      <button
                        onClick={() => setDetailPayment(p)}
                        className="inline-flex items-center gap-1 px-2 py-1 text-xs text-[#0B3C5D] border border-[#0B3C5D]/30 rounded-lg hover:bg-[#0B3C5D]/5 transition-colors"
                      >
                        <Eye size={13} />
                        פרטים
                      </button>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
        </div>
      </div>

      {/* Detail Modal */}
      {detailPayment && (
        <Modal
          isOpen={!!detailPayment}
          onClose={() => setDetailPayment(null)}
          title="פרטי תשלום"
          maxWidth="xl"
        >
          <div className="space-y-1 text-sm" dir="rtl">

            {/* 1. Donor information */}
            <ModalSection title="פרטי תורם" icon="👤">
              <DetailRow label="שם מלא" value={detailPayment.subscriptions?.profiles?.full_name || '-'} />
              <DetailRow
                label="אימייל"
                value={detailPayment.subscriptions?.profiles?.email || detailPayment.nedarim_mail || '-'}
                copyable
              />
              <DetailRow
                label="טלפון"
                value={detailPayment.subscriptions?.profiles?.phone || detailPayment.nedarim_phone || '-'}
              />
            </ModalSection>

            {/* 2. Payment information */}
            <ModalSection title="פרטי תשלום" icon="💳">
              <DetailRow label="סכום" value={`₪${detailPayment.amount}`} highlight />
              <DetailRow
                label="סטטוס"
                value={
                  detailPayment.status === 'succeeded' ? 'הצליח' :
                  detailPayment.status === 'failed' ? 'נכשל' : 'ממתין'
                }
                statusColor={
                  detailPayment.status === 'succeeded' ? 'success' :
                  detailPayment.status === 'failed' ? 'error' : 'warning'
                }
              />
              <DetailRow label="סוג תשלום" value={getPaymentTypeLabel(detailPayment)} />
              <DetailRow
                label="תאריך תשלום"
                value={
                  detailPayment.paid_at
                    ? new Date(detailPayment.paid_at).toLocaleString('he-IL')
                    : new Date(detailPayment.created_at).toLocaleString('he-IL')
                }
              />
              <DetailRow label="ניסיון מספר" value={String(detailPayment.attempt_number)} />
              {detailPayment.failure_reason && (
                <DetailRow label="סיבת כישלון" value={detailPayment.failure_reason} statusColor="error" />
              )}
            </ModalSection>

            {/* 3. Subscription information */}
            {detailPayment.subscriptions?.plans && (
              <ModalSection title="מנוי" icon="🔄">
                <DetailRow label="תוכנית" value={detailPayment.subscriptions.plans.name_he} />
                <DetailRow
                  label="התקדמות"
                  value={`${detailPayment.subscriptions.successful_payments_count} / ${detailPayment.subscriptions.plans.required_successful_payments} תשלומים`}
                />
                {detailPayment.nedarim_next_date && (
                  <DetailRow label="תשלום הבא" value={detailPayment.nedarim_next_date} />
                )}
                <div className="col-span-2 pt-1">
                  <div className="flex items-center justify-between text-xs text-gray-400 mb-1">
                    <span>0</span>
                    <span>{detailPayment.subscriptions.plans.required_successful_payments}</span>
                  </div>
                  <div className="w-full bg-gray-100 rounded-full h-2.5">
                    <div
                      className="bg-[#0B3C5D] h-2.5 rounded-full transition-all"
                      style={{
                        width: `${Math.min(100, (detailPayment.subscriptions.successful_payments_count / detailPayment.subscriptions.plans.required_successful_payments) * 100)}%`,
                      }}
                    />
                  </div>
                  <p className="text-xs text-gray-400 mt-1 text-center">
                    {Math.round((detailPayment.subscriptions.successful_payments_count / detailPayment.subscriptions.plans.required_successful_payments) * 100)}% הושלם
                  </p>
                </div>
              </ModalSection>
            )}

            {/* 4. Nedarim Plus callback information */}
            <ModalSection title="נדרים פלוס — נתוני callback" icon="📡">
              <DetailRow
                label="Transaction ID"
                value={detailPayment.nedarim_transaction_id || '-'}
                mono
                copyable={!!detailPayment.nedarim_transaction_id}
              />
              <DetailRow
                label="Keva ID"
                value={detailPayment.nedarim_keva_id || '-'}
                mono
                copyable={!!detailPayment.nedarim_keva_id}
              />
              <DetailRow
                label="Zeout (זיהוי)"
                value={detailPayment.nedarim_zeout || '-'}
                mono
                copyable={!!detailPayment.nedarim_zeout}
              />
              <DetailRow
                label="התאמה"
                value={getMatchSourceLabel(detailPayment.nedarim_match_source).label}
                statusColor={
                  detailPayment.nedarim_match_source === 'email' ? 'success' :
                  detailPayment.nedarim_match_source === 'zeout' ? 'info' : 'neutral'
                }
              />
              {detailPayment.nedarim_tashloumim && (
                <DetailRow label="מספר תשלומים" value={detailPayment.nedarim_tashloumim} />
              )}
            </ModalSection>

            {/* 5. Raw payload */}
            {detailPayment.nedarim_raw_payload && (
              <ModalSection title="Payload גולמי" icon="🔧" collapsible>
                <div className="col-span-2">
                  <pre
                    className="bg-gray-950 text-green-400 rounded-lg p-3 text-xs leading-relaxed overflow-x-auto overflow-y-auto max-h-56 select-all"
                    dir="ltr"
                  >
                    {JSON.stringify(detailPayment.nedarim_raw_payload, null, 2)}
                  </pre>
                </div>
              </ModalSection>
            )}

          </div>
        </Modal>
      )}

      {toast.isOpen && <Toast message={toast.message} type={toast.type} onClose={hideToast} />}
    </AdminLayout>
  );
};

// ─── Modal sub-components ────────────────────────────────────────────────────

const ModalSection = ({
  title,
  icon,
  children,
  collapsible = false,
}: {
  title: string;
  icon: string;
  children: React.ReactNode;
  collapsible?: boolean;
}) => {
  const [open, setOpen] = useState(!collapsible);
  return (
    <div className="rounded-xl border border-gray-100 overflow-hidden">
      <button
        type="button"
        onClick={() => collapsible && setOpen((v) => !v)}
        className={`w-full flex items-center gap-2 px-4 py-3 bg-gray-50 text-right ${collapsible ? 'cursor-pointer hover:bg-gray-100 transition-colors' : 'cursor-default'}`}
      >
        <span className="text-base leading-none">{icon}</span>
        <span className="text-xs font-semibold text-gray-600 uppercase tracking-wide flex-1">{title}</span>
        {collapsible && (
          <span className="text-gray-400 text-xs">{open ? '▲' : '▼'}</span>
        )}
      </button>
      {open && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-3 px-4 py-4">
          {children}
        </div>
      )}
    </div>
  );
};

const CopyButton = ({ value }: { value: string }) => {
  const [copied, setCopied] = useState(false);
  const handleCopy = () => {
    navigator.clipboard.writeText(value).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    });
  };
  return (
    <button
      type="button"
      onClick={handleCopy}
      title="העתק"
      className={`shrink-0 px-1.5 py-0.5 rounded text-xs border transition-all ${
        copied
          ? 'border-green-300 text-green-600 bg-green-50'
          : 'border-gray-200 text-gray-400 hover:border-gray-400 hover:text-gray-600 bg-white'
      }`}
    >
      {copied ? '✓' : 'העתק'}
    </button>
  );
};

const statusColorMap = {
  success: 'text-green-700 font-medium',
  error: 'text-red-600 font-medium',
  warning: 'text-amber-600 font-medium',
  info: 'text-blue-600 font-medium',
  neutral: 'text-gray-500',
} as const;

const DetailRow = ({
  label,
  value,
  mono = false,
  copyable = false,
  highlight = false,
  statusColor,
}: {
  label: string;
  value: string;
  mono?: boolean;
  copyable?: boolean;
  highlight?: boolean;
  statusColor?: keyof typeof statusColorMap;
}) => (
  <div className="flex flex-col gap-1 min-w-0">
    <span className="text-xs text-gray-400 leading-none">{label}</span>
    <div className="flex items-center gap-2 min-w-0">
      <span
        className={[
          'text-sm break-all min-w-0',
          mono ? 'font-mono text-xs bg-gray-50 border border-gray-100 rounded px-1.5 py-0.5 overflow-x-auto max-w-full block' : '',
          highlight ? 'text-lg font-bold text-[#0B3C5D]' : 'text-gray-800',
          statusColor ? statusColorMap[statusColor] : '',
        ].join(' ')}
        title={value}
      >
        {value}
      </span>
      {copyable && value !== '-' && <CopyButton value={value} />}
    </div>
  </div>
);
