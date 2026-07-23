export const ROLES = {
  STUDENT: 'student',
  MENTOR: 'mentor',
  ADMIN: 'admin',
  SETTER: 'setter',
  CLOSER: 'closer',
} as const;

export type Role = (typeof ROLES)[keyof typeof ROLES];
