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
  Swords,
  Users2,
  BarChart2,
  MessageCircle,
  Target,
  type LucideIcon,
} from 'lucide-react';

export type NavItem = {
  label: string;
  href: string;
  icon: LucideIcon;
  adminOnly?: boolean;
};

export type NavGroup = {
  groupLabel: string;
  icon: LucideIcon;
  items: NavItem[];
};

export type NavEntry = NavItem | NavGroup;

export function isNavGroup(entry: NavEntry): entry is NavGroup {
  return 'groupLabel' in entry;
}

export const PRIVATE_NAV: NavEntry[] = [
  { label: 'Dashboard',     href: '/dashboard',  icon: LayoutDashboard },
  { label: 'Entrenamiento', href: '/trainer',     icon: Swords },
  { label: 'Clases',        href: '/classes',     icon: GraduationCap },
  { label: 'Comunidad',     href: '/community',   icon: Users },
  { label: 'Ranking',       href: '/leaderboard', icon: Trophy },
  { label: 'Mensajes',      href: '/chat',        icon: MessageSquare },
  { label: 'Calendario',    href: '/calendar',    icon: Calendar },
  { label: 'Recursos',      href: '/resources',   icon: FolderOpen },
  { label: 'Notificaciones',href: '/notifications',icon: Bell },
  { label: 'Perfil',        href: '/profile',     icon: User },
  {
    groupLabel: 'Setter',
    icon: Target,
    items: [
      { label: 'Mis Leads',       href: '/leads',           icon: Users2 },
      { label: 'Reporte Diario',  href: '/reporte-diario',  icon: BarChart2 },
      { label: 'Aperturas',       href: '/aperturas',       icon: MessageCircle },
    ],
  },
];

export const ADMIN_NAV: NavItem[] = [
  { label: 'Admin', href: '/admin', icon: Shield, adminOnly: true },
];
