'use client';

import { useTransition } from 'react';
import { updateUserRoleAction } from '@/app/admin/actions';

type Role = 'student' | 'setter' | 'mentor' | 'admin' | 'closer';

export function RoleSelect({ userId, current }: { userId: string; current: string }) {
  const [pending, startTransition] = useTransition();
  return (
    <select
      defaultValue={current}
      disabled={pending}
      onChange={(e) => {
        const value = e.currentTarget.value as Role;
        startTransition(() => { updateUserRoleAction(userId, value); });
      }}
      className="rounded border border-[rgba(212,175,55,0.18)] bg-[#0d0d0d] px-2 py-1 text-xs text-brand-text disabled:opacity-60"
    >
      <option value="student">Student</option>
      <option value="setter">Setter</option>
      <option value="mentor">Mentor</option>
      <option value="admin">Admin</option>
      <option value="closer">Closer</option>
    </select>
  );
}
