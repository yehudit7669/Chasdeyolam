import { supabase } from './supabase';

interface SendEmailOptions {
  template: string;
  to: string;
  data?: Record<string, string | undefined>;
  relatedId?: string;
  relatedType?: string;
}

export async function sendEmail(opts: SendEmailOptions): Promise<void> {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;
    const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/send-email`;
    await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${session.access_token}`,
      },
      body: JSON.stringify(opts),
    });
  } catch (e) {
    console.error('[sendEmail]', e);
  }
}
