import {
  LayoutDashboard, GraduationCap, Users, Calendar, FolderOpen, User,
  Shield, MessageSquare, Trophy, Bell, Swords, Users2, BarChart2,
  Target, TrendingUp, BookOpen, ClipboardList, ClipboardCheck,
  UserCheck, Inbox, Megaphone, Wifi, LayoutGrid, FileSearch, Handshake,
  AlertTriangle, ListChecks, CalendarDays, Clock, List,
  type LucideIcon,
} from 'lucide-react';

export type NavItem = {
  label: string;
  href: string;
  icon: LucideIcon;
};

export type NavSection = {
  sectionLabel?: string;
  items: NavItem[];
};

// ─── 1. Plataforma — todos los usuarios logueados ────────────────────────────

export const PLATFORM_NAV: NavItem[] = [
  { label: 'Dashboard',   href: '/dashboard',   icon: LayoutDashboard },
  { label: 'Clases',      href: '/classes',     icon: GraduationCap },
  { label: 'Comunidad',   href: '/community',   icon: Users },
  { label: 'Muro de Wins', href: '/wins',       icon: Trophy },
  { label: 'Ranking',     href: '/leaderboard', icon: Trophy },
  { label: 'Mensajes',    href: '/chat',        icon: MessageSquare },
  { label: 'Comunicados', href: '/comunicados', icon: Bell },
  { label: 'Perfil',      href: '/profile',     icon: User },
];

// ─── 2. Setter — solo rol setter (operación propia) ──────────────────────────

export const SETTER_NAV: NavItem[] = [
  { label: 'Mi Panel',          href: '/panel',            icon: LayoutGrid },
  { label: 'Mis Leads',         href: '/leads',            icon: Users2 },
  { label: 'Mi Equipo',         href: '/equipo',           icon: Handshake },
  { label: 'Mis Tareas',        href: '/tareas',            icon: ClipboardList },
  { label: 'Mis Conversaciones',href: '/conversaciones',   icon: FileSearch },
  { label: 'Inbox',             href: '/inbox',            icon: Inbox },
  { label: 'Formularios',       href: '/formularios',      icon: ClipboardCheck },
  { label: 'Entrenamiento',     href: '/trainer',          icon: Swords },
  { label: 'Mi Evolución',      href: '/setter-evolucion', icon: TrendingUp },
  { label: 'Ranking Setters',   href: '/setter-ranking',   icon: Trophy },
  { label: 'Ranking Equipos',   href: '/equipo-ranking',   icon: Handshake },
  { label: 'Recursos CAC',      href: '/setter-recursos',  icon: BookOpen },
  { label: 'Strikes Equipo',    href: '/strikes',           icon: AlertTriangle },
];

// ─── 3. Closer — solo rol closer ─────────────────────────────────────────────

export const CLOSER_NAV: NavItem[] = [
  { label: 'Mi Agenda',        href: '/agenda',                  icon: CalendarDays },
  { label: 'Mi Disponibilidad',href: '/agenda/disponibilidad',   icon: Clock },
  { label: 'Mis Reuniones',    href: '/agenda/reuniones',        icon: List },
];

// ─── 4. Admin — solo rol admin (dirección del equipo) ────────────────────────

export const ADMIN_NAV: NavItem[] = [
  { label: 'Control Admin', href: '/admin',                 icon: Shield },
  { label: 'Equipo',        href: '/admin/setters',         icon: UserCheck },
  { label: 'Equipos Dupla', href: '/admin/equipos',         icon: Handshake },
  { label: 'Tareas Duplas', href: '/admin/duplas',          icon: ListChecks },
  { label: 'Leads',         href: '/admin/leads-dashboard', icon: BarChart2 },
  { label: 'Inbox Global',  href: '/admin/inbox',           icon: Inbox },
  { label: 'Campañas',      href: '/admin/campanas',        icon: Megaphone },
  { label: 'Prospección',   href: '/admin/prospeccion',     icon: Target },
  { label: 'Formularios',   href: '/admin/forms',           icon: ClipboardCheck },
  { label: 'Evaluaciones',  href: '/admin/conversaciones',  icon: ClipboardList },
  { label: 'Comunicados',   href: '/admin/comunicados',     icon: Bell },
  { label: 'Evolución CAC', href: '/admin/evolucion/equipo', icon: TrendingUp },
  { label: 'Diego 2030',    href: '/admin/evolucion',       icon: TrendingUp },
  { label: 'Evolution API', href: '/admin/evolution',       icon: Wifi },
  { label: 'Calendario',    href: '/setter-calendario',     icon: Calendar },
  { label: 'Recursos',      href: '/resources',             icon: FolderOpen },
  { label: 'Strikes',      href: '/admin/strikes',         icon: AlertTriangle },
  { label: 'Agenda Closers', href: '/admin/agenda',         icon: CalendarDays },
];

// ─── Legacy exports (para compatibilidad) ────────────────────────────────────
// Mantenemos estos para que los imports existentes no se rompan.

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

// El PRIVATE_NAV legacy ya no mezcla setter y admin — solo plataforma.
export const PRIVATE_NAV: NavEntry[] = PLATFORM_NAV;
