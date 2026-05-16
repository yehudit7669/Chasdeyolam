import { useEffect, useState } from 'react';
import { AdminLayout } from '../../components/AdminLayout';
import { supabase } from '../../lib/supabase';
import { MessageSquare, Lock, Unlock, Send } from 'lucide-react';
import { Toast } from '../../components/admin/Toast';
import { useToast } from '../../hooks/useToast';
import { useAuth } from '../../contexts/AuthContext';

interface SupportThread {
  id: string;
  user_id: string;
  booking_id: string | null;
  subject: string;
  status: 'open' | 'closed';
  created_at: string;
  updated_at: string;
  profiles: {
    full_name: string;
    email: string;
  };
}

interface SupportMessage {
  id: string;
  thread_id: string;
  sender_id: string;
  message: string;
  is_admin: boolean;
  created_at: string;
  profiles: {
    full_name: string;
  };
}

export const AdminSupportPage = () => {
  const [threads, setThreads] = useState<SupportThread[]>([]);
  const [messages, setMessages] = useState<SupportMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedThread, setSelectedThread] = useState<SupportThread | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [newMessage, setNewMessage] = useState('');
  const { toast, showToast, hideToast } = useToast();
  const { canEdit, profile } = useAuth();

  useEffect(() => {
    loadThreads();
  }, []);

  useEffect(() => {
    loadThreads();
  }, [statusFilter]);

  const loadThreads = async () => {
    try {
      let query = supabase
        .from('support_threads')
        .select(`
          *,
          profiles!support_threads_user_id_fkey(full_name, email)
        `)
        .order('updated_at', { ascending: false });

      if (statusFilter !== 'all') {
        query = query.eq('status', statusFilter);
      }

      const { data, error } = await query;

      if (error) throw error;
      setThreads(data || []);
    } catch (error) {
      console.error('Error loading threads:', error);
      showToast('שגיאה בטעינת פניות', 'error');
    } finally {
      setLoading(false);
    }
  };

  const loadMessages = async (threadId: string) => {
    try {
      const { data, error } = await supabase
        .from('support_messages')
        .select(`
          *,
          profiles!support_messages_sender_id_fkey(full_name)
        `)
        .eq('thread_id', threadId)
        .order('created_at', { ascending: true });

      if (error) throw error;
      setMessages(data || []);
    } catch (error) {
      console.error('Error loading messages:', error);
      showToast('שגיאה בטעינת הודעות', 'error');
    }
  };

  const handleSelectThread = async (thread: SupportThread) => {
    setSelectedThread(thread);
    await loadMessages(thread.id);
  };

  const handleSendMessage = async () => {
    if (!canEdit) {
      showToast('אין לך הרשאה לבצע פעולה זו', 'error');
      return;
    }

    if (!newMessage.trim()) {
      showToast('נא להזין הודעה', 'error');
      return;
    }

    if (!selectedThread || !profile) return;

    try {
      const { error } = await supabase
        .from('support_messages')
        .insert({
          thread_id: selectedThread.id,
          sender_id: profile.id,
          message: newMessage,
          is_admin: true,
        });

      if (error) throw error;

      // Update thread updated_at
      const { error: threadError } = await supabase
        .from('support_threads')
        .update({ updated_at: new Date().toISOString() })
        .eq('id', selectedThread.id);

      if (threadError) console.error('Error updating thread:', threadError);

      showToast('הודעה נשלחה בהצלחה', 'success');
      setNewMessage('');
      await loadMessages(selectedThread.id);
      await loadThreads();
    } catch (error) {
      console.error('Error sending message:', error);
      showToast('שגיאה בשליחת הודעה', 'error');
    }
  };

  const handleToggleThreadStatus = async (threadId: string, currentStatus: string) => {
    if (!canEdit) {
      showToast('אין לך הרשאה לבצע פעולה זו', 'error');
      return;
    }

    const newStatus = currentStatus === 'open' ? 'closed' : 'open';

    try {
      const { error } = await supabase
        .from('support_threads')
        .update({ status: newStatus })
        .eq('id', threadId);

      if (error) throw error;

      showToast(
        newStatus === 'closed' ? 'פנייה נסגרה בהצלחה' : 'פנייה נפתחה מחדש בהצלחה',
        'success'
      );

      if (selectedThread && selectedThread.id === threadId) {
        setSelectedThread({ ...selectedThread, status: newStatus as 'open' | 'closed' });
      }

      await loadThreads();
    } catch (error) {
      console.error('Error toggling thread status:', error);
      showToast('שגיאה בשינוי סטטוס פנייה', 'error');
    }
  };

  const getStatusBadge = (status: string) => {
    const badges = {
      open: 'bg-green-100 text-green-800',
      closed: 'bg-gray-100 text-gray-800',
    };
    const labels = {
      open: 'פתוח',
      closed: 'סגור',
    };
    return (
      <span className={`px-2 py-1 rounded-full text-xs ${badges[status as keyof typeof badges]}`}>
        {labels[status as keyof typeof labels]}
      </span>
    );
  };

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
        <h1 className="text-3xl font-bold text-[#0B3C5D]">תמיכה</h1>
        <p className="text-gray-600 mt-2">ניהול פניות תמיכה וצ'אט עם תורמים</p>
      </div>

      <div className="mb-6 flex gap-2">
        <button
          onClick={() => setStatusFilter('all')}
          className={`px-4 py-2 rounded-lg ${
            statusFilter === 'all'
              ? 'bg-[#0B3C5D] text-white'
              : 'bg-white text-gray-700 border border-gray-300'
          }`}
        >
          הכל
        </button>
        <button
          onClick={() => setStatusFilter('open')}
          className={`px-4 py-2 rounded-lg ${
            statusFilter === 'open'
              ? 'bg-[#0B3C5D] text-white'
              : 'bg-white text-gray-700 border border-gray-300'
          }`}
        >
          פתוחים
        </button>
        <button
          onClick={() => setStatusFilter('closed')}
          className={`px-4 py-2 rounded-lg ${
            statusFilter === 'closed'
              ? 'bg-[#0B3C5D] text-white'
              : 'bg-white text-gray-700 border border-gray-300'
          }`}
        >
          סגורים
        </button>
      </div>

      <div className="grid grid-cols-3 gap-6">
        {/* Threads List */}
        <div className="bg-white rounded-lg shadow-md overflow-hidden">
          <div className="p-4 border-b border-gray-200 bg-gray-50">
            <h2 className="font-semibold text-gray-900">פניות ({threads.length})</h2>
          </div>
          <div className="divide-y divide-gray-200 max-h-[600px] overflow-y-auto">
            {threads.length === 0 ? (
              <div className="p-6 text-center text-gray-500">אין פניות להצגה</div>
            ) : (
              threads.map((thread) => (
                <div
                  key={thread.id}
                  onClick={() => handleSelectThread(thread)}
                  className={`p-4 cursor-pointer hover:bg-gray-50 transition-colors ${
                    selectedThread?.id === thread.id ? 'bg-blue-50' : ''
                  }`}
                >
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <MessageSquare size={16} className="text-gray-400" />
                      <span className="font-medium text-gray-900 text-sm">
                        {thread.profiles?.full_name || thread.profiles?.email || 'משתמש לא ידוע'}
                      </span>
                    </div>
                    {getStatusBadge(thread.status)}
                  </div>
                  <div className="text-sm text-gray-900 font-medium mb-1">{thread.subject}</div>
                  <div className="text-xs text-gray-500">
                    {new Date(thread.updated_at).toLocaleDateString('he-IL')} -{' '}
                    {new Date(thread.updated_at).toLocaleTimeString('he-IL')}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Chat View */}
        <div className="col-span-2 bg-white rounded-lg shadow-md overflow-hidden flex flex-col">
          {selectedThread ? (
            <>
              <div className="p-4 border-b border-gray-200 bg-gray-50 flex items-center justify-between">
                <div>
                  <h2 className="font-semibold text-gray-900">{selectedThread.subject}</h2>
                  <p className="text-sm text-gray-600">{selectedThread.profiles?.full_name || selectedThread.profiles?.email || 'משתמש לא ידוע'}</p>
                </div>
                {canEdit && (
                  <button
                    onClick={() => handleToggleThreadStatus(selectedThread.id, selectedThread.status)}
                    className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm ${
                      selectedThread.status === 'open'
                        ? 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                        : 'bg-green-100 text-green-700 hover:bg-green-200'
                    }`}
                  >
                    {selectedThread.status === 'open' ? (
                      <>
                        <Lock size={16} />
                        סגור פנייה
                      </>
                    ) : (
                      <>
                        <Unlock size={16} />
                        פתח מחדש
                      </>
                    )}
                  </button>
                )}
              </div>

              {/* Messages */}
              <div className="flex-1 p-4 overflow-y-auto max-h-[400px] space-y-4">
                {messages.length === 0 ? (
                  <div className="text-center text-gray-500">אין הודעות</div>
                ) : (
                  messages.map((msg) => (
                    <div
                      key={msg.id}
                      className={`flex ${msg.is_admin ? 'justify-end' : 'justify-start'}`}
                    >
                      <div
                        className={`max-w-[70%] rounded-lg p-3 ${
                          msg.is_admin
                            ? 'bg-[#0B3C5D] text-white'
                            : 'bg-gray-100 text-gray-900'
                        }`}
                      >
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-xs font-semibold">
                            {msg.profiles?.full_name || msg.profiles?.email || 'משתמש לא ידוע'}
                          </span>
                          <span
                            className={`text-xs px-2 py-0.5 rounded ${
                              msg.is_admin ? 'bg-white/20' : 'bg-blue-100 text-blue-700'
                            }`}
                          >
                            {msg.is_admin ? 'מנהל' : 'תורם'}
                          </span>
                        </div>
                        <p className="text-sm whitespace-pre-wrap">{msg.message}</p>
                        <div
                          className={`text-xs mt-2 ${
                            msg.is_admin ? 'text-white/70' : 'text-gray-500'
                          }`}
                        >
                          {new Date(msg.created_at).toLocaleString('he-IL')}
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>

              {/* Reply Form */}
              {canEdit && selectedThread.status === 'open' && (
                <div className="p-4 border-t border-gray-200">
                  <div className="flex gap-2">
                    <textarea
                      value={newMessage}
                      onChange={(e) => setNewMessage(e.target.value)}
                      placeholder="כתוב תשובה..."
                      className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#0B3C5D] focus:border-transparent resize-none"
                      rows={3}
                    />
                    <button
                      onClick={handleSendMessage}
                      className="px-4 bg-[#0B3C5D] text-white rounded-lg hover:bg-opacity-90 transition-colors flex items-center gap-2"
                    >
                      <Send size={18} />
                      שלח
                    </button>
                  </div>
                </div>
              )}

              {selectedThread.status === 'closed' && (
                <div className="p-4 border-t border-gray-200 bg-gray-50">
                  <p className="text-sm text-gray-600 text-center">פנייה זו סגורה</p>
                </div>
              )}
            </>
          ) : (
            <div className="flex items-center justify-center h-full text-gray-500">
              בחר פנייה לצפייה
            </div>
          )}
        </div>
      </div>

      {toast.isOpen && <Toast message={toast.message} type={toast.type} onClose={hideToast} />}
    </AdminLayout>
  );
};
