import {
  LayoutDashboard,
  MapPin,
  Users,
  Clock,
  Camera,
  Images,
  DollarSign,
  Calendar,
  Tag,
  Timer,
  ShieldCheck,
  FileText,
  FileSignature,
  Settings,
  UserPlus,
  Clipboard,
  AlertTriangle,
  ToggleLeft,
  type LucideIcon,
} from "lucide-react";

export interface NavItem {
  href: string;
  icon: LucideIcon;
  labelKey: string;
  section: string;
  adminOnly?: boolean;
  supervisorOrAbove?: boolean;
}

export const NAV_ITEMS: NavItem[] = [
  { href: "/", icon: LayoutDashboard, labelKey: "shell.dashboard", section: "overview" },
  { href: "/map", icon: MapPin, labelKey: "shell.map", section: "overview" },
  { href: "/workers", icon: Users, labelKey: "shell.workers", section: "overview" },
  { href: "/crew", icon: Users, labelKey: "shell.crew", section: "overview", supervisorOrAbove: true },
  { href: "/projects", icon: Clipboard, labelKey: "shell.projects", section: "overview" },
  { href: "/schedule", icon: Calendar, labelKey: "shell.schedule", section: "operations" },
  { href: "/timeline", icon: Clock, labelKey: "shell.timeline", section: "operations" },
  { href: "/photos", icon: Camera, labelKey: "shell.photos", section: "operations" },
  { href: "/galleries", icon: Images, labelKey: "shell.galleries", section: "operations" },
  { href: "/expenses", icon: DollarSign, labelKey: "shell.expenses", section: "operations" },
  { href: "/cost-codes", icon: Tag, labelKey: "shell.costCodes", section: "operations" },
  { href: "/overtime", icon: Timer, labelKey: "shell.overtime", section: "operations" },
  { href: "/pto", icon: ShieldCheck, labelKey: "shell.pto", section: "operations" },
  { href: "/projects/permits", icon: FileText, labelKey: "shell.permits", section: "operations" },
  { href: "/alerts", icon: AlertTriangle, labelKey: "shell.alerts", section: "operations", supervisorOrAbove: true },
  { href: "/timecards", icon: FileSignature, labelKey: "shell.timecards", section: "operations" },
  { href: "/reports", icon: FileText, labelKey: "shell.reports", section: "reports" },
  { href: "/settings", icon: Settings, labelKey: "shell.company", section: "settings" },
  { href: "/settings/billing", icon: DollarSign, labelKey: "shell.billing", section: "settings", adminOnly: true },
  { href: "/settings/staff", icon: UserPlus, labelKey: "shell.staff", section: "settings", adminOnly: true },
  { href: "/settings/pto-allocations", icon: ShieldCheck, labelKey: "shell.ptoAllocations", section: "settings", adminOnly: true },
  { href: "/settings/job-foremen", icon: Users, labelKey: "shell.jobForemen", section: "settings", adminOnly: true },
  { href: "/settings/feature-flags", icon: ToggleLeft, labelKey: "shell.featureFlags", section: "settings", adminOnly: true },
  { href: "/onboarding", icon: Clipboard, labelKey: "shell.onboarding", section: "settings", adminOnly: true },
];

export const NAV_SECTIONS: Record<string, string> = {
  overview: "shell.overview",
  operations: "shell.operations",
  reports: "shell.reports",
  settings: "shell.settings",
};
