import { supabase } from './supabase';

export type NedarimOperation =
  | 'GetKevaId'
  | 'GetKevaJson'
  | 'DisableKeva'
  | 'EnableKevaNew'
  | 'DeleteKeva';

interface NedarimRequest {
  operation: NedarimOperation;
  subscriptionId?: string;
  clientId?: string;
  kevaId?: string;
  notes?: string;
  syncPayments?: boolean;
}

interface NedarimResult {
  success?: boolean;
  newStatus?: string;
  error?: string;
  [key: string]: unknown;
}

export async function callNedarimKevaService(
  params: NedarimRequest
): Promise<NedarimResult> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) throw new Error('Not authenticated');

  const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/nedarim-keva-service`;
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${session.access_token}`,
    },
    body: JSON.stringify(params),
  });

  const json = await res.json();
  if (!res.ok) throw new Error(json.error ?? `HTTP ${res.status}`);
  return json;
}
