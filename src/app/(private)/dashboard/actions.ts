'use server';

import { revalidatePath } from 'next/cache';
import { createSupabaseServerClient } from '@/lib/supabase-server';

export async function completeOnboardingStepAction(step: string): Promise<void> {
  if (!step) return;
  const supabase = createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;
  await (supabase as any).rpc('complete_onboarding_step', {
    p_user: user.id,
    p_step: step,
  });
  revalidatePath('/dashboard');
}
