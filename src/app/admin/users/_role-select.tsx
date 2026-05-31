'use client';

import { useTransition } from 'react';
import { updateUserRoleAction } from '@/app/admin/actions';

export function RoleSelect({
  userId,
  current,
}: {
  userId: string;
  current: 'student' | 'mentor' | 'admin';
}) {
  const [pending, startTransition] = useTransition();
  return (
    <select
      defaultValue={current}
      disabled={pending}
      onChange={(e) => {
        const value = e.currentTarget.value as 'student' | 'mentor' | 'admin';
        startTransition(() => {
          updateUserRoleAction(userId, value);
        });
      }}
      className="rounded border border-[rgba(212,175,55,0.18)] bg-[#0d0d0d] px-2 py-1 text-xs text-brand-text disabled:opacity-60"
    >
      <option value="student">Student</option>
      <option value="mentor">Mentor</option>
      <option value="admin">Admin</option>
    </select>
  );
}
