import { useEffect, useState } from 'react';
import { AdminLayout } from '../../components/AdminLayout';
import { supabase } from '../../lib/supabase';
import { Users, UserX, Award, Hotel, DollarSign, AlertCircle } from 'lucide-react';
import { format } from 'date-fns';

interface Stats {
  totalUsers: number;
  activeSubscriptions: number;
  frozenSubscriptions: number;
  eligibleDonors: number;
  confirmedBookings: number;
  paymentsLast30Days: number;
  failedPaymentsLast30Days: number;
}

interface RecentActivity {
  id: string;
  type: 'payment' | 'booking';
  donor_name: string;
  amount?: number;
  hotel_name?: string;
  status: string;
  created_at: string;
}

export const AdminDashboardPage = () => {
  const [stats, setStats] = useState<Stats>({
    totalUsers: 0,
    activeSubscriptions: 0,
    frozenSubscriptions: 0,
    eligibleDonors: 0,
    confirmedBookings: 0,
    paymentsLast30Days: 0,
    failedPaymentsLast30Days: 0,
  });
  const [recentActivity, setRecentActivity] = useState<RecentActivity[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadStats();
    loadRecentActivity();
  }, []);

  const loadStats = async () => {
    try {
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      const thirtyDaysAgoISO = thirtyDaysAgo.toISOString();

      const [usersRes, activeRes, frozenRes, eligibleRes, bookingsRes, paymentsRes, failedPaymentsRes] = await Promise.all([
        supabase.from('profiles').select('id', { count: 'exact', head: true }).eq('role', 'donor'),
        supabase.from('subscriptions').select('id', { count: 'exact', head: true }).eq('status', 'active'),
        supabase.from('subscriptions').select('id', { count: 'exact', head: true }).eq('status', 'frozen'),
        supabase.from('subscriptions').select('id', { count: 'exact', head: true }).eq('is_eligible', true).eq('status', 'active'),
        supabase.from('bookings').select('id', { count: 'exact', head: true }).eq('status', 'confirmed'),
        supabase.from('payments').select('amount').eq('status', 'succeeded').gte('created_at', thirtyDaysAgoISO),
        supabase.from('payments').select('id', { count: 'exact', head: true }).eq('status', 'failed').gte('created_at', thirtyDaysAgoISO),
      ]);

      const paymentsSum = paymentsRes.data?.reduce((sum, p) => sum + p.amount, 0) || 0;

      setStats({
        totalUsers: usersRes.count || 0,
        activeSubscriptions: activeRes.count || 0,
        frozenSubscriptions: frozenRes.count || 0,
        eligibleDonors: eligibleRes.count || 0,
        confirmedBookings: bookingsRes.count || 0,
        paymentsLast30Days: paymentsSum,
        failedPaymentsLast30Days: failedPaymentsRes.count || 0,
      });
    } catch (error) {
      console.error('Error loading stats:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadRecentActivity = async () => {
    try {
      const { data: payments } = await supabase
        .from('payments')
        .select(`
          id,
          amount,
          status,
          created_at,
          subscription_id,
          subscriptions!inner(user_id, profiles!inner(full_name))
        `)
        .order('created_at', { ascending: false })
        .limit(5);

      const { data: bookings } = await supabase
        .from('bookings')
        .select(`
          id,
          status,
          created_at,
          user_id,
          profiles!inner(full_name),
          hotels!inner(name_he)
        `)
        .order('created_at', { ascending: false })
        .limit(5);

      const activities: RecentActivity[] = [];

      payments?.forEach((p: any) => {
        activities.push({
          id: p.id,
          type: 'payment',
          donor_name: p.subscriptions?.profiles?.full_name || 'לא ידוע',
          amount: p.amount,
          status: p.status,
          created_at: p.created_at,
        });
      });

      bookings?.forEach((b: any) => {
        activities.push({
          id: b.id,
          type: 'booking',
          donor_name: b.profiles?.full_name || 'לא ידוע',
          hotel_name: b.hotels?.name_he || 'לא ידוע',
          status: b.status,
          created_at: b.created_at,
        });
      });

      activities.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
      setRecentActivity(activities.slice(0, 10));
    } catch (error) {
      console.error('Error loading recent activity:', error);
    }
  };

  const statCards = [
    {
      title: 'סה"כ משתמשים',
      value: stats.totalUsers,
      icon: Users,
      color: 'bg-indigo-500',
    },
    {
      title: 'מנויים פעילים',
      value: stats.activeSubscriptions,
      icon: Users,
      color: 'bg-blue-500',
    },
    {
      title: 'מנויים מוקפאים',
      value: stats.frozenSubscriptions,
      icon: UserX,
      color: 'bg-red-500',
    },
    {
      title: 'תורמים זכאים',
      value: stats.eligibleDonors,
      icon: Award,
      color: 'bg-[#C6A75E]',
    },
    {
      title: 'הזמנות מאושרות',
      value: stats.confirmedBookings,
      icon: Hotel,
      color: 'bg-green-500',
    },
    {
      title: 'תשלומים (30 יום)',
      value: `₪${stats.paymentsLast30Days.toLocaleString()}`,
      icon: DollarSign,
      color: 'bg-emerald-500',
    },
    {
      title: 'תשלומים שנכשלו (30 יום)',
      value: stats.failedPaymentsLast30Days,
      icon: AlertCircle,
      color: 'bg-orange-500',
    },
  ];

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
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-[#0B3C5D]">לוח בקרה ראשי</h1>
        <p className="text-gray-600 mt-2">סקירה כללית של המערכת</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {statCards.map((card) => {
          const Icon = card.icon;
          return (
            <div key={card.title} className="bg-white rounded-lg shadow-md p-6">
              <div className="flex items-center justify-between mb-4">
                <div className={`${card.color} text-white p-3 rounded-lg`}>
                  <Icon size={24} />
                </div>
              </div>
              <div>
                <p className="text-gray-600 text-sm mb-1">{card.title}</p>
                <p className="text-3xl font-bold text-[#0B3C5D]">{card.value}</p>
              </div>
            </div>
          );
        })}
      </div>

      <div className="mt-8 grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-lg shadow-md p-6">
          <h2 className="text-xl font-bold text-[#0B3C5D] mb-4">פעילות אחרונה</h2>
          {recentActivity.length === 0 ? (
            <p className="text-gray-500 text-center py-4">אין פעילות אחרונה</p>
          ) : (
            <div className="space-y-3">
              {recentActivity.map((activity) => (
                <div key={`${activity.type}-${activity.id}`} className="flex items-start gap-3 p-3 bg-gray-50 rounded-lg">
                  <div className={`w-2 h-2 rounded-full mt-2 ${
                    activity.type === 'payment'
                      ? activity.status === 'succeeded' ? 'bg-green-500' : 'bg-red-500'
                      : 'bg-blue-500'
                  }`}></div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900">
                      {activity.type === 'payment' ? 'תשלום' : 'הזמנה'} - {activity.donor_name}
                    </p>
                    <p className="text-xs text-gray-600">
                      {activity.type === 'payment'
                        ? `₪${activity.amount} - ${activity.status === 'succeeded' ? 'הצליח' : 'נכשל'}`
                        : `${activity.hotel_name} - ${activity.status === 'confirmed' ? 'אושר' : activity.status}`
                      }
                    </p>
                    <p className="text-xs text-gray-400 mt-1">
                      {format(new Date(activity.created_at), 'dd/MM/yyyy HH:mm')}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="bg-white rounded-lg shadow-md p-6">
          <h2 className="text-xl font-bold text-[#0B3C5D] mb-4">פעולות מהירות</h2>
          <div className="space-y-3">
            <a
              href="/admin/plans"
              className="block px-4 py-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
            >
              ניהול תוכניות מנוי
            </a>
            <a
              href="/admin/hotels"
              className="block px-4 py-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
            >
              ניהול מלונות
            </a>
            <a
              href="/admin/inventory"
              className="block px-4 py-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
            >
              ניהול מלאי חדרים
            </a>
            <a
              href="/admin/service-desk"
              className="block px-4 py-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
            >
              שולחן שירות
            </a>
          </div>
        </div>
      </div>
    </AdminLayout>
  );
};
