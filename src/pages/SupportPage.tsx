import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { supabase } from '../lib/supabase';
import { MessageSquare, Send, X, Plus } from 'lucide-react';
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
        setSelectedThread(thread.id);
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
        <div className="flex items-center justify-center py-24">
          <div className="w-12 h-12 border-2 border-[#E5E1D8] border-t-[#626D58] rounded-full animate-spin" />
        </div>
      </DonorLayout>
    );
  }

  return (
    <DonorLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-black text-[#0A192F]">מרכז תמיכה</h1>
            <p className="text-[#33332D]/50 text-sm mt-1 font-light">אנחנו כאן לכל שאלה או בקשה</p>
          </div>
          <button
            onClick={() => setShowNewThread(!showNewThread)}
            className="flex items-center gap-2 px-5 py-2.5 bg-[#0A192F] text-white text-sm font-semibold rounded-xl hover:bg-[#0A192F]/90 transition-all shadow-sm hover:shadow-md"
          >
            <Plus size={16} />
            <span>פנייה חדשה</span>
          </button>
        </div>

        {/* New thread form */}
        {showNewThread && (
          <div
            className="bg-white rounded-[2rem] p-7 border border-[#E5E1D8]/60"
            style={{ boxShadow: '0 4px 24px 0 rgba(98,109,88,0.08)' }}
          >
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-lg font-black text-[#0A192F]">פנייה חדשה</h2>
              <button
                onClick={() => setShowNewThread(false)}
                className="p-2 text-[#33332D]/40 hover:text-[#33332D] transition-colors rounded-xl hover:bg-[#F7F5F0]"
              >
                <X size={18} />
              </button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-semibold text-[#33332D]/70 mb-2">נושא</label>
                <input
                  type="text"
                  value={newThreadSubject}
                  onChange={(e) => setNewThreadSubject(e.target.value)}
                  className="w-full px-4 py-3 bg-[#F9F8F4] border border-[#E5E1D8] rounded-xl text-[#0A192F] placeholder-[#33332D]/30 focus:outline-none focus:ring-2 focus:ring-[#D4B483]/30 focus:border-[#D4B483] transition-all text-sm"
                  placeholder="במה נוכל לעזור?"
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-[#33332D]/70 mb-2">הודעה</label>
                <textarea
                  value={newThreadMessage}
                  onChange={(e) => setNewThreadMessage(e.target.value)}
                  rows={4}
                  className="w-full px-4 py-3 bg-[#F9F8F4] border border-[#E5E1D8] rounded-xl text-[#0A192F] placeholder-[#33332D]/30 focus:outline-none focus:ring-2 focus:ring-[#D4B483]/30 focus:border-[#D4B483] transition-all text-sm resize-none"
                  placeholder="פרט את שאלתך..."
                />
              </div>
              <div className="flex gap-3">
                <button
                  onClick={createThread}
                  className="flex items-center gap-2 px-6 py-2.5 bg-[#0A192F] text-white text-sm font-semibold rounded-xl hover:bg-[#0A192F]/90 transition-all"
                >
                  <Send size={15} />
                  שלח
                </button>
                <button
                  onClick={() => setShowNewThread(false)}
                  className="px-6 py-2.5 bg-[#F7F5F0] text-[#33332D] text-sm font-semibold rounded-xl hover:bg-[#E5E1D8] transition-colors"
                >
                  ביטול
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Threads + Messages */}
        <div className="grid md:grid-cols-3 gap-5">
          {/* Thread list */}
          <div className="md:col-span-1">
            <div
              className="bg-white rounded-[2rem] overflow-hidden border border-[#E5E1D8]/60"
              style={{ boxShadow: '0 4px 24px 0 rgba(98,109,88,0.06)' }}
            >
              <div className="px-5 py-4 border-b border-[#E5E1D8]/60">
                <h3 className="text-sm font-black text-[#0A192F]">פניות אחרונות</h3>
              </div>

              {threads.length === 0 ? (
                <div className="px-5 py-10 text-center">
                  <MessageSquare className="mx-auto text-[#33332D]/20 mb-3" size={28} />
                  <p className="text-sm text-[#33332D]/40 font-light">אין פניות עדיין</p>
                </div>
              ) : (
                <div className="divide-y divide-[#E5E1D8]/40">
                  {threads.map(thread => (
                    <button
                      key={thread.id}
                      onClick={() => setSelectedThread(thread.id)}
                      className={`w-full px-5 py-4 text-right hover:bg-[#F9F8F4] transition-colors ${
                        selectedThread === thread.id ? 'bg-[#F9F8F4]' : ''
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <p className="font-semibold text-[#0A192F] text-sm leading-snug">{thread.subject}</p>
                        <span
                          className={`text-[10px] px-2 py-0.5 rounded-full font-bold whitespace-nowrap flex-shrink-0 ${
                            thread.status === 'open'
                              ? 'bg-[#626D58]/10 text-[#626D58]'
                              : 'bg-[#F7F5F0] text-[#33332D]/40 border border-[#E5E1D8]'
                          }`}
                        >
                          {thread.status === 'open' ? 'פתוח' : 'סגור'}
                        </span>
                      </div>
                      <p className="text-xs text-[#33332D]/40 mt-1.5">
                        {format(new Date(thread.created_at), 'dd/MM/yyyy')}
                      </p>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Thread messages */}
          <div className="md:col-span-2">
            {currentThread ? (
              <div
                className="bg-white rounded-[2rem] overflow-hidden border border-[#E5E1D8]/60 flex flex-col"
                style={{ boxShadow: '0 4px 24px 0 rgba(98,109,88,0.06)', minHeight: '400px' }}
              >
                {/* Thread header */}
                <div className="px-6 py-4 border-b border-[#E5E1D8]/60 bg-[#F9F8F4]">
                  <h2 className="font-black text-[#0A192F]">{currentThread.subject}</h2>
                </div>

                {/* Messages */}
                <div className="flex-1 p-6 space-y-4 overflow-y-auto">
                  {currentThread.messages.map((message) => (
                    <div
                      key={message.id}
                      className={`flex gap-3 ${message.is_admin ? '' : 'flex-row-reverse'}`}
                    >
                      <div className={`w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0 text-xs font-bold ${
                        message.is_admin ? 'bg-[#0A192F] text-white' : 'bg-[#626D58]/10 text-[#626D58]'
                      }`}>
                        {message.is_admin ? 'T' : 'A'}
                      </div>
                      <div className={`flex-1 max-w-[80%] ${message.is_admin ? '' : 'text-right'}`}>
                        <div className={`px-4 py-3 rounded-2xl text-sm leading-relaxed ${
                          message.is_admin
                            ? 'bg-[#F9F8F4] text-[#33332D]'
                            : 'bg-[#0A192F] text-white'
                        }`}>
                          {message.message}
                        </div>
                        <div className={`flex items-center gap-2 mt-1.5 text-xs text-[#33332D]/40 ${message.is_admin ? '' : 'flex-row-reverse'}`}>
                          <span>{message.profiles?.full_name || 'משתמש'}</span>
                          {message.is_admin && <span>· תמיכה</span>}
                          <span>·</span>
                          <span>{format(new Date(message.created_at), 'dd/MM HH:mm')}</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Reply input */}
                {currentThread.status === 'open' && (
                  <div className="p-4 border-t border-[#E5E1D8]/60">
                    <div className="flex gap-3">
                      <input
                        type="text"
                        value={replyMessage}
                        onChange={(e) => setReplyMessage(e.target.value)}
                        placeholder="הקלד תשובה..."
                        className="flex-1 px-4 py-3 bg-[#F9F8F4] border border-[#E5E1D8] rounded-xl text-[#0A192F] placeholder-[#33332D]/30 focus:outline-none focus:ring-2 focus:ring-[#D4B483]/30 focus:border-[#D4B483] transition-all text-sm"
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' && !e.shiftKey) {
                            e.preventDefault();
                            sendReply(currentThread.id);
                          }
                        }}
                      />
                      <button
                        onClick={() => sendReply(currentThread.id)}
                        disabled={!replyMessage.trim()}
                        className="px-4 py-3 bg-[#0A192F] text-white rounded-xl hover:bg-[#0A192F]/90 transition-all disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-2"
                      >
                        <Send size={16} />
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div
                className="bg-white rounded-[2rem] border border-[#E5E1D8]/60 flex flex-col items-center justify-center text-center p-16"
                style={{ boxShadow: '0 4px 24px 0 rgba(98,109,88,0.06)', minHeight: '400px' }}
              >
                <div className="w-16 h-16 rounded-[1.5rem] bg-[#F7F5F0] flex items-center justify-center mb-4">
                  <MessageSquare className="text-[#33332D]/20" size={28} />
                </div>
                <p className="font-bold text-[#0A192F] mb-2">בחר שיחה מהרשימה</p>
                <p className="text-sm text-[#33332D]/40 font-light">
                  תוכל לצפות בהיסטוריית ההודעות שלך או לפתוח פנייה חדשה
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </DonorLayout>
  );
};
