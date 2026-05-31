import {
  LayoutDashboard,
  GraduationCap,
  Users,
  Calendar,
  FolderOpen,
  User,
  Shield,
  MessageSquare,
  Trophy,
  Bell,
  type LucideIcon,
} from 'lucide-react';

export type NavItem = {
  label: string;
  href: string;
  icon: LucideIcon;
  adminOnly?: boolean;
};

export const PRIVATE_NAV: NavItem[] = [
  { label: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
  { label: 'Clases', href: '/classes', icon: GraduationCap },
  { label: 'Comunidad', href: '/community', icon: Users },
  { label: 'Ranking', href: '/leaderboard', icon: Trophy },
  { label: 'Mensajes', href: '/chat', icon: MessageSquare },
  { label: 'Calendario', href: '/calendar', icon: Calendar },
  { label: 'Recursos', href: '/resources', icon: FolderOpen },
  { label: 'Notificaciones', href: '/notifications', icon: Bell },
  { label: 'Perfil', href: '/profile', icon: User },
];

export const ADMIN_NAV: NavItem[] = [
  { label: 'Admin', href: '/admin', icon: Shield, adminOnly: true },
];
