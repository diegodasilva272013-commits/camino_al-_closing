'use client';

import { useEffect, useRef } from 'react';
import { createSupabaseBrowserClient } from '@/lib/supabase-client';

type LeadChange = {
  id: string;
  current_status: string;
  follow_up_count: number;
  is_closed: boolean;
  notes: string | null;
  updated_at: string;
  [key: string]: unknown;
};

export function useLeadsRealtime(callbacks: {
  onUpdate?: (lead: LeadChange) => void;
  onInsert?: (lead: LeadChange) => void;
  onDelete?: (id: string) => void;
}) {
  const cbRef = useRef(callbacks);
  cbRef.current = callbacks;

  useEffect(() => {
    const supabase = createSupabaseBrowserClient() as any;
    const channel  = supabase
      .channel('leads-realtime-global')
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'leads' }, (p: any) => {
        cbRef.current.onUpdate?.(p.new as LeadChange);
      })
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'leads' }, (p: any) => {
        cbRef.current.onInsert?.(p.new as LeadChange);
      })
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'leads' }, (p: any) => {
        cbRef.current.onDelete?.(p.old?.id as string);
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, []);
}
