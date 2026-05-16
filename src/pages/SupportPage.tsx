import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { supabase } from '../lib/supabase';
import { MessageSquare, Send } from 'lucide-react';
import { format } from 'date-fns';
import DonorLayout from '../components/DonorLayout';

interface Thread {
  id: string;
  subject: string;
  status: string;
  created_at: string;
  messages: Message[];
}

interface Message {
  id: string;
  message: string;
  is_admin: boolean;
  created_at: string;
  sender_id: string;
  profiles: {
    full_name: string;
  };
}

export const SupportPage = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [threads, setThreads] = useState<Thread[]>([]);
  const [selectedThread, setSelectedThread] = useState<string | null>(null);
  const [newThreadSubject, setNewThreadSubject] = useState('');
  const [newThreadMessage, setNewThreadMessage] = useState('');
  const [replyMessage, setReplyMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [showNewThread, setShowNewThread] = useState(false);

  useEffect(() => {
    if (!user) {
      navigate('/signin');
      return;
    }
    loadThreads();
  }, [user]);

  const loadThreads = async () => {
    if (!user) return;

    try {
      const { data } = await supabase
        .from('support_threads')
        .select(`
          *,
          support_messages (
            *,
            profiles (
              full_name
            )
          )
        `)
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (data) {
        setThreads(data.map(thread => ({
          ...thread,
          messages: thread.support_messages || []
        })) as Thread[]);
      }
    } catch (error) {
      console.error('Error loading threads:', error);
    } finally {
      setLoading(false);
    }
  };

  const createThread = async () => {
    if (!user || !newThreadSubject || !newThreadMessage) return;

    try {
      const { data: thread } = await supabase
        .from('support_threads')
        .insert({
          user_id: user.id,
          subject: newThreadSubject,
          status: 'open',
        })
        .select()
        .single();

      if (thread) {
        await supabase
          .from('support_messages')
          .insert({
            thread_id: thread.id,
            sender_id: user.id,
            message: newThreadMessage,
            is_admin: false,
          });

        setNewThreadSubject('');
        setNewThreadMessage('');
        setShowNewThread(false);
        await loadThreads();
      }
    } catch (error) {
      console.error('Error creating thread:', error);
    }
  };

  const sendReply = async (threadId: string) => {
    if (!user || !replyMessage) return;

    try {
      await supabase
        .from('support_messages')
        .insert({
          thread_id: threadId,
          sender_id: user.id,
          message: replyMessage,
          is_admin: false,
        });

      setReplyMessage('');
      await loadThreads();
    } catch (error) {
      console.error('Error sending reply:', error);
    }
  };

  const currentThread = threads.find(t => t.id === selectedThread);

  if (loading) {
    return (
      <DonorLayout>
        <div className="flex items-center justify-center py-20">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
            <p className="text-gray-600">טוען...</p>
          </div>
        </div>
      </DonorLayout>
    );
  }

  return (
    <DonorLayout>
      <div className="max-w-6xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <h1 className="text-3xl font-bold text-gray-900">תמיכה</h1>
          <button
            onClick={() => setShowNewThread(!showNewThread)}
            className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 flex items-center gap-2"
          >
            <MessageSquare size={20} />
            פנייה חדשה
          </button>
        </div>

        {showNewThread && (
          <div className="bg-white rounded-lg shadow-md p-6 mb-6">
            <h2 className="text-lg font-bold text-gray-900 mb-4">פנייה חדשה</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  נושא
                </label>
                <input
                  type="text"
                  value={newThreadSubject}
                  onChange={(e) => setNewThreadSubject(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-600 focus:border-transparent"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  הודעה
                </label>
                <textarea
                  value={newThreadMessage}
                  onChange={(e) => setNewThreadMessage(e.target.value)}
                  rows={4}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-600 focus:border-transparent"
                />
              </div>
              <div className="flex gap-2">
                <button
                  onClick={createThread}
                  className="bg-blue-600 text-white px-6 py-2 rounded-lg font-medium hover:bg-blue-700"
                >
                  שלח
                </button>
                <button
                  onClick={() => setShowNewThread(false)}
                  className="bg-gray-200 text-gray-700 px-6 py-2 rounded-lg hover:bg-gray-300"
                >
                  ביטול
                </button>
              </div>
            </div>
          </div>
        )}

        <div className="grid md:grid-cols-3 gap-6">
          <div className="md:col-span-1">
            <div className="bg-white rounded-lg shadow-md overflow-hidden">
              <div className="bg-blue-600 text-white px-4 py-3 font-medium">
                פניות
              </div>
              <div className="divide-y divide-gray-200">
                {threads.length === 0 ? (
                  <div className="p-4 text-center text-gray-500">
                    אין פניות
                  </div>
                ) : (
                  threads.map(thread => (
                    <button
                      key={thread.id}
                      onClick={() => setSelectedThread(thread.id)}
                      className={`w-full px-4 py-3 text-right hover:bg-gray-50 transition-colors ${
                        selectedThread === thread.id ? 'bg-blue-50' : ''
                      }`}
                    >
                      <div className="font-medium text-gray-900 mb-1">{thread.subject}</div>
                      <div className="flex items-center justify-between text-xs text-gray-500">
                        <span>{format(new Date(thread.created_at), 'dd/MM/yyyy')}</span>
                        <span className={`px-2 py-1 rounded ${
                          thread.status === 'open' ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'
                        }`}>
                          {thread.status === 'open' ? 'פתוח' : 'סגור'}
                        </span>
                      </div>
                    </button>
                  ))
                )}
              </div>
            </div>
          </div>

          <div className="md:col-span-2">
            {currentThread ? (
              <div className="bg-white rounded-lg shadow-md overflow-hidden">
                <div className="bg-blue-600 text-white px-6 py-4">
                  <h2 className="text-xl font-bold">{currentThread.subject}</h2>
                </div>
                <div className="p-6">
                  <div className="space-y-4 mb-6">
                    {currentThread.messages.map((message) => (
                      <div
                        key={message.id}
                        className={`p-4 rounded-lg ${
                          message.is_admin ? 'bg-blue-50' : 'bg-gray-50'
                        }`}
                      >
                        <div className="flex items-center justify-between mb-2">
                          <span className="font-medium text-gray-900">
                            {message.profiles?.full_name || 'משתמש'}
                            {message.is_admin && ' (תמיכה)'}
                          </span>
                          <span className="text-xs text-gray-500">
                            {format(new Date(message.created_at), 'dd/MM/yyyy HH:mm')}
                          </span>
                        </div>
                        <p className="text-gray-700">{message.message}</p>
                      </div>
                    ))}
                  </div>

                  {currentThread.status === 'open' && (
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={replyMessage}
                        onChange={(e) => setReplyMessage(e.target.value)}
                        placeholder="הקלד תשובה..."
                        className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-600 focus:border-transparent"
                        onKeyPress={(e) => {
                          if (e.key === 'Enter') {
                            sendReply(currentThread.id);
                          }
                        }}
                      />
                      <button
                        onClick={() => sendReply(currentThread.id)}
                        className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 flex items-center gap-2"
                      >
                        <Send size={18} />
                        שלח
                      </button>
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="bg-white rounded-lg shadow-md p-12 text-center">
                <MessageSquare className="mx-auto text-gray-400 mb-4" size={48} />
                <p className="text-gray-600">בחר שיחה מהרשימה</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </DonorLayout>
  );
};
