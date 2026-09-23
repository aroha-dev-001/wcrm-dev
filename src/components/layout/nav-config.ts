import {
  Bell,
  Bot,
  GitBranch,
  LayoutDashboard,
  MessageSquare,
  Radio,
  Settings,
  Users,
  Workflow,
  Zap,
  type LucideIcon,
} from "lucide-react";

/**
 * Primary navigation, shared by the sidebar and the command menu so the
 * two can never drift. `labelKey` resolves in the `Sidebar` namespace.
 */
export interface NavItem {
  href: string;
  labelKey: string;
  icon: LucideIcon;
  /** Renders a small "Beta" marker after the label. */
  beta?: boolean;
  /** Which live counter (if any) the sidebar shows on this row. */
  counter?: "inbox" | "notifications";
}

export interface NavGroup {
  id: string;
  /** Group heading key in the `Sidebar` namespace; null = no heading. */
  labelKey: string | null;
  items: NavItem[];
}

export const NAV_GROUPS: NavGroup[] = [
  {
    id: "main",
    labelKey: null,
    items: [
      { href: "/dashboard", labelKey: "dashboard", icon: LayoutDashboard },
      { href: "/inbox", labelKey: "inbox", icon: MessageSquare, counter: "inbox" },
      {
        href: "/notifications",
        labelKey: "notifications",
        icon: Bell,
        counter: "notifications",
      },
    ],
  },
  {
    id: "crm",
    labelKey: "groupCrm",
    items: [
      { href: "/contacts", labelKey: "contacts", icon: Users },
      { href: "/pipelines", labelKey: "pipelines", icon: GitBranch },
    ],
  },
  {
    id: "engage",
    labelKey: "groupEngage",
    items: [
      { href: "/broadcasts", labelKey: "broadcasts", icon: Radio },
      { href: "/automations", labelKey: "automations", icon: Zap },
      { href: "/flows", labelKey: "flows", icon: Workflow, beta: true },
      { href: "/agents", labelKey: "aiAgents", icon: Bot },
    ],
  },
];

export const SETTINGS_NAV_ITEM: NavItem = {
  href: "/settings",
  labelKey: "settings",
  icon: Settings,
};

export function isNavItemActive(pathname: string, href: string): boolean {
  if (href === "/dashboard") return pathname === "/dashboard";
  return pathname === href || pathname.startsWith(`${href}/`);
}
