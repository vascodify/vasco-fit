import { createClient, SupabaseClient, RealtimeChannel } from '@supabase/supabase-js';

let supabase: SupabaseClient | null = null;
let activeChannel: RealtimeChannel | null = null;

export function connectSupabaseRealtime(
  url: string,
  anonKey: string,
  onTableChange: (payload: unknown) => void
): (() => void) | null {
  if (!url || !anonKey || !url.startsWith('http')) {
    return null;
  }

  try {
    supabase = createClient(url, anonKey);
    if (activeChannel) {
      supabase.removeChannel(activeChannel);
    }

    activeChannel = supabase
      .channel('vasco-realtime-dashboard')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'exercises' },
        (payload) => onTableChange({ table: 'exercises', payload })
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'logs' },
        (payload) => onTableChange({ table: 'logs', payload })
      )
      .subscribe();

    return () => {
      if (supabase && activeChannel) {
        supabase.removeChannel(activeChannel);
      }
    };
  } catch (err) {
    console.warn('Supabase Realtime connection warning:', err);
    return null;
  }
}
