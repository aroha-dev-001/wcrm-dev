"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Dialog as DialogPrimitive } from "@base-ui/react/dialog";
import {
  CornerDownLeft,
  GitBranch,
  LogOut,
  Plus,
  Radio,
  Search,
  SunMoon,
  Upload,
  User,
  Workflow,
  Zap,
  type LucideIcon,
} from "lucide-react";

import { createClient } from "@/lib/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { useTheme } from "@/hooks/use-theme";
import { cn } from "@/lib/utils";
import { Kbd } from "@/components/ui/kbd";
import { Spinner } from "@/components/ui/spinner";
import { NAV_GROUPS, SETTINGS_NAV_ITEM } from "./nav-config";
import {
  SECTION_META,
  SETTINGS_SECTIONS,
} from "@/components/settings/settings-sections";

// ------------------------------------------------------------------
// Context — any component can open the menu (sidebar search field,
// mobile top bar). ⌘K / Ctrl+K toggles it globally.
// ------------------------------------------------------------------

interface CommandMenuContextValue {
  open: () => void;
}

const CommandMenuContext = createContext<CommandMenuContextValue>({
  open: () => {},
});

export function useCommandMenu() {
  return useContext(CommandMenuContext);
}

export function CommandMenuProvider({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((v) => !v);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const value = useMemo(() => ({ open: () => setOpen(true) }), []);

  return (
    <CommandMenuContext.Provider value={value}>
      {children}
      <CommandMenu open={open} onOpenChange={setOpen} />
    </CommandMenuContext.Provider>
  );
}

// ------------------------------------------------------------------
// Menu
// ------------------------------------------------------------------

interface CommandItem {
  id: string;
  group: string;
  label: string;
  hint?: string;
  icon: LucideIcon;
  keywords?: string;
  run: () => void;
}

interface ContactHit {
  id: string;
  name: string | null;
  phone: string | null;
  email: string | null;
  company: string | null;
}

/** PostgREST `or()` filters are comma/paren-delimited; strip anything
 *  that would break the expression or act as a wildcard. */
function sanitizeTerm(term: string): string {
  return term.replace(/[,()%*\\]/g, " ").trim();
}

function CommandMenu({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const t = useTranslations("CommandMenu");
  const tNav = useTranslations("Sidebar");
  const tSettings = useTranslations("Settings.sections");
  const router = useRouter();
  const { toggleMode } = useTheme();
  const { signOut } = useAuth();

  const [query, setQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);
  const [contacts, setContacts] = useState<ContactHit[]>([]);
  const [searching, setSearching] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);

  const close = useCallback(() => onOpenChange(false), [onOpenChange]);
  const go = useCallback(
    (href: string) => {
      close();
      router.push(href);
    },
    [close, router],
  );

  // Reset every time the menu opens.
  const handleOpenChange = (next: boolean) => {
    if (next) {
      setQuery("");
      setActiveIndex(0);
      setContacts([]);
    }
    onOpenChange(next);
  };

  const staticItems = useMemo<CommandItem[]>(() => {
    const nav: CommandItem[] = [...NAV_GROUPS.flatMap((g) => g.items), SETTINGS_NAV_ITEM].map(
      (item) => ({
        id: `nav:${item.href}`,
        group: t("groupNavigation"),
        label: tNav(item.labelKey),
        icon: item.icon,
        run: () => go(item.href),
      }),
    );
    const actions: CommandItem[] = [
      { id: "act:contact", label: t("newContact"), icon: Plus, href: "/contacts?new=1" },
      { id: "act:import", label: t("importContacts"), icon: Upload, href: "/contacts?import=1" },
      { id: "act:deal", label: t("newDeal"), icon: GitBranch, href: "/pipelines?new=deal" },
      { id: "act:broadcast", label: t("newBroadcast"), icon: Radio, href: "/broadcasts/new" },
      { id: "act:automation", label: t("newAutomation"), icon: Zap, href: "/automations/new" },
      { id: "act:flow", label: t("newFlow"), icon: Workflow, href: "/flows?new=1" },
    ].map((a) => ({
      id: a.id,
      group: t("groupActions"),
      label: a.label,
      icon: a.icon,
      run: () => go(a.href),
    }));
    actions.push(
      {
        id: "act:theme",
        group: t("groupActions"),
        label: t("toggleTheme"),
        icon: SunMoon,
        keywords: "dark light appearance",
        run: () => {
          toggleMode();
          close();
        },
      },
      {
        id: "act:signout",
        group: t("groupActions"),
        label: t("signOut"),
        icon: LogOut,
        keywords: "logout",
        run: () => {
          close();
          void signOut();
        },
      },
    );
    const settings: CommandItem[] = SETTINGS_SECTIONS.filter((s) => s !== "overview").map(
      (s) => ({
        id: `set:${s}`,
        group: t("groupSettings"),
        label: tSettings(s),
        icon: SECTION_META[s].icon,
        keywords: "settings",
        run: () => go(`/settings?tab=${s}`),
      }),
    );
    return [...nav, ...actions, ...settings];
  }, [t, tNav, tSettings, go, close, toggleMode, signOut]);

  // Live contact search (debounced) once the query is meaningful.
  const term = sanitizeTerm(query);
  useEffect(() => {
    if (!open || term.length < 2) return;
    let cancelled = false;
    const handle = setTimeout(async () => {
      setSearching(true);
      const like = `%${term}%`;
      const { data } = await createClient()
        .from("contacts")
        .select("id, name, phone, email, company")
        .or(`name.ilike.${like},phone.ilike.${like},email.ilike.${like},company.ilike.${like}`)
        .order("updated_at", { ascending: false })
        .limit(6);
      if (cancelled) return;
      setContacts((data as ContactHit[] | null) ?? []);
      setSearching(false);
    }, 180);
    return () => {
      cancelled = true;
      clearTimeout(handle);
    };
  }, [term, open]);

  const items = useMemo<CommandItem[]>(() => {
    const q = query.trim().toLowerCase();
    const filtered = q
      ? staticItems.filter((i) =>
          `${i.label} ${i.group} ${i.keywords ?? ""}`.toLowerCase().includes(q),
        )
      : staticItems;
    const contactItems: CommandItem[] =
      term.length >= 2
        ? contacts.map((c) => ({
            id: `contact:${c.id}`,
            group: t("groupContacts"),
            label: c.name || c.phone || c.email || "—",
            hint: [c.phone, c.company].filter(Boolean).join(" · "),
            icon: User,
            run: () => go(`/contacts?contact=${c.id}`),
          }))
        : [];
    return [...contactItems, ...filtered];
  }, [query, staticItems, contacts, term.length, t, go]);

  const safeIndex = Math.min(activeIndex, Math.max(items.length - 1, 0));

  // Keep the keyboard-active row in view.
  useEffect(() => {
    const el = listRef.current?.querySelector<HTMLElement>(
      `[data-index="${safeIndex}"]`,
    );
    el?.scrollIntoView({ block: "nearest" });
  }, [safeIndex]);

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIndex((i) => (items.length ? (Math.min(i, items.length - 1) + 1) % items.length : 0));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIndex((i) =>
        items.length ? (Math.min(i, items.length - 1) - 1 + items.length) % items.length : 0,
      );
    } else if (e.key === "Enter") {
      e.preventDefault();
      items[safeIndex]?.run();
    }
  };

  // Group consecutive items for headings while keeping a flat index.
  const grouped: { group: string; entries: { item: CommandItem; index: number }[] }[] = [];
  items.forEach((item, index) => {
    const last = grouped[grouped.length - 1];
    if (last && last.group === item.group) last.entries.push({ item, index });
    else grouped.push({ group: item.group, entries: [{ item, index }] });
  });

  const activeId = items[safeIndex] ? `cmd-${items[safeIndex].id}` : undefined;

  return (
    <DialogPrimitive.Root open={open} onOpenChange={handleOpenChange}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Backdrop className="fixed inset-0 z-50 bg-black/30 duration-150 data-closed:animate-out data-closed:fade-out-0 data-open:animate-in data-open:fade-in-0 dark:bg-black/55" />
        <DialogPrimitive.Popup
          aria-label={t("title")}
          className="fixed top-[12vh] left-1/2 z-50 flex max-h-[min(70vh,560px)] w-[calc(100%-2rem)] max-w-[580px] -translate-x-1/2 flex-col overflow-hidden rounded-lg border border-border bg-popover text-popover-foreground shadow-popover outline-none duration-150 data-closed:animate-out data-closed:fade-out-0 data-closed:zoom-out-[0.98] data-open:animate-in data-open:fade-in-0 data-open:zoom-in-[0.98]"
        >
          <DialogPrimitive.Title className="sr-only">{t("title")}</DialogPrimitive.Title>
          <div className="flex h-12 shrink-0 items-center gap-2.5 border-b border-border px-4">
            <Search className="size-4 shrink-0 text-muted-foreground" />
            <input
              autoFocus
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setActiveIndex(0);
              }}
              onKeyDown={onKeyDown}
              placeholder={t("placeholder")}
              role="combobox"
              aria-expanded
              aria-controls="command-menu-list"
              aria-activedescendant={activeId}
              aria-autocomplete="list"
              className="h-full flex-1 bg-transparent text-sm text-foreground outline-none placeholder:text-subtle-foreground"
            />
            {searching && term.length >= 2 ? <Spinner className="size-3.5" /> : null}
            <Kbd>Esc</Kbd>
          </div>

          <div
            ref={listRef}
            id="command-menu-list"
            role="listbox"
            className="min-h-0 flex-1 overflow-y-auto p-1.5"
          >
            {items.length === 0 ? (
              <p className="px-3 py-10 text-center text-[13px] text-muted-foreground">
                {searching ? t("searching") : t("noResults", { query: query.trim() })}
              </p>
            ) : (
              grouped.map(({ group, entries }) => (
                <div key={group} role="group" aria-label={group} className="pb-1">
                  <div className="px-2.5 pt-2 pb-1 text-[11px] font-medium text-subtle-foreground">
                    {group}
                  </div>
                  {entries.map(({ item, index }) => {
                    const Icon = item.icon;
                    const active = index === safeIndex;
                    return (
                      <div
                        key={item.id}
                        id={`cmd-${item.id}`}
                        role="option"
                        aria-selected={active}
                        data-index={index}
                        onMouseMove={() => setActiveIndex(index)}
                        onClick={() => item.run()}
                        className={cn(
                          "flex h-9 cursor-pointer items-center gap-2.5 rounded-md px-2.5 text-[13px]",
                          active ? "bg-accent text-accent-foreground" : "text-foreground",
                        )}
                      >
                        <Icon className="size-4 shrink-0 text-muted-foreground" />
                        <span className="truncate">{item.label}</span>
                        {item.hint ? (
                          <span className="truncate text-xs text-muted-foreground">
                            {item.hint}
                          </span>
                        ) : null}
                        {active ? (
                          <CornerDownLeft className="ml-auto size-3.5 shrink-0 text-subtle-foreground" />
                        ) : null}
                      </div>
                    );
                  })}
                </div>
              ))
            )}
          </div>

          <div className="hidden h-9 shrink-0 items-center gap-4 border-t border-border bg-card-2 px-4 text-[11px] text-muted-foreground sm:flex">
            <span className="flex items-center gap-1.5">
              <Kbd>↑</Kbd>
              <Kbd>↓</Kbd>
              {t("hintNavigate")}
            </span>
            <span className="flex items-center gap-1.5">
              <Kbd>↵</Kbd>
              {t("hintSelect")}
            </span>
            <span className="flex items-center gap-1.5">
              <Kbd>Esc</Kbd>
              {t("hintClose")}
            </span>
          </div>
        </DialogPrimitive.Popup>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
