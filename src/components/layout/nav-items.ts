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
  TrendingUp,
  BookOpen,
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
  roles?: string[];
};

export type NavEntry = NavItem | NavGroup;

export function isNavGroup(entry: NavEntry): entry is NavGroup {
  return 'groupLabel' in entry;
}

export const PRIVATE_NAV: NavEntry[] = [
  { label: 'Dashboard',     href: '/dashboard',  icon: LayoutDashboard },
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
    roles: ['setter', 'admin'],
    items: [
      { label: 'Entrenamiento', href: '/trainer',          icon: Swords },
      { label: 'Mis Leads',     href: '/leads',            icon: Users2 },
      { label: 'Reporte Diario',href: '/reporte-diario',   icon: BarChart2 },
      { label: 'Aperturas',     href: '/aperturas',        icon: MessageCircle },
      { label: 'Mi Evolución',  href: '/setter-evolucion', icon: TrendingUp },
      { label: 'Agendar con Diego', href: '/setter-calendario', icon: Calendar },
      { label: 'Recursos CAC',     href: '/setter-recursos',   icon: BookOpen },
      { label: 'Evolución del equipo', href: '/admin/evolucion', icon: TrendingUp, adminOnly: true },
    ],
  },
];

export const ADMIN_NAV: NavItem[] = [
  { label: 'Admin',             href: '/admin',                     icon: Shield,    adminOnly: true },
  { label: 'Leads en vivo',     href: '/admin/leads-dashboard',     icon: BarChart2, adminOnly: true },
  { label: 'Historial Trainer', href: '/admin/trainer/historial',   icon: Swords,    adminOnly: true },
];
