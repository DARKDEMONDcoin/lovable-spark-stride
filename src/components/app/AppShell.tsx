import { LogoMark } from "@/components/site/LogoMark";
import { createContext, useContext, useEffect, useLayoutEffect, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { Link, useRouterState } from "@tanstack/react-router";
import { Portrait } from "@/components/site/Portrait";
import { Globe, Menu, X, User, LogOut, PanelRightClose, PanelRightOpen, ArrowLeft, MessageCircle, LayoutDashboard, FolderKanban, CheckCircle2, BrainCircuit, Blocks, Gift, MessageSquareText, CircleHelp, PanelLeftClose, PanelLeftOpen } from "lucide-react";

import { team } from "@/data/team";
import { COUNTRIES } from "@/data/team-portraits";
import { useRegion } from "@/hooks/use-region";
import { supabase } from "@/integrations/supabase/client";
import { GUEST_EMAIL } from "@/lib/guest.functions";

import { useEmployeeInbox, useProfile, useUpdateWorkspace, useWorkspace } from "@/lib/data";
import { inboxTime } from "@/lib/inbox-time";
import { UserAvatar } from "@/components/app/UserAvatar";
import { useAvatarUrl } from "@/hooks/use-avatar";
import { NotificationBell } from "@/components/app/NotificationBell";
import { SpaceSwitcher } from "@/components/app/SpaceSwitcher";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import defaultUserRobot from "@/assets/default-user-robot.jpg";
import { SiteFavicon } from "@/components/app/SiteBadge";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import defaultWorkspace from "@/assets/default-workspace-identity.jpg";

function WorkspaceCard() {
  const { data: workspace } = useWorkspace();
  const updateWorkspace = useUpdateWorkspace();
  const website = (workspace as { website?: string | null } | undefined)?.website?.trim();
  return (
    <div className="w-full rounded-lg border border-border bg-card p-3 text-start">
      <div className="flex items-center gap-3">
      {website ? (
        <span className="grid size-10 shrink-0 place-items-center overflow-hidden rounded-xl border border-border bg-background p-1.5 shadow-sm">
          <SiteFavicon website={website} className="size-full" />
        </span>
      ) : (
        <img
          src={defaultWorkspace}
          alt="صورة مساحة العمل الافتراضية"
          loading="lazy"
          width={1024}
          height={1024}
          className="size-10 shrink-0 rounded-xl border border-border object-cover shadow-sm"
        />
      )}
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-bold" dir="ltr">
          {website ? website.replace(/^https?:\/\//, "").replace(/^www\./, "") : workspace?.name ?? "أضف موقع نشاطك"}
        </span>
        <span className="block truncate text-xs text-muted-foreground">
          {website ? "موقع النشاط" : workspace?.industry ?? "—"}
        </span>
      </span>
      </div>
      {website && workspace ? (
        <label className="mt-3 flex cursor-pointer items-center justify-between gap-3 border-t border-border pt-2.5 text-xs font-bold">
          <span>استخدام الموقع في الردود</span>
          <input
            type="checkbox"
            checked={workspace.use_website_context}
            disabled={updateWorkspace.isPending}
            onChange={(event) =>
              updateWorkspace.mutate({
                id: workspace.id,
                patch: { use_website_context: event.target.checked },
              })
            }
            className="size-4 accent-primary"
          />
        </label>
      ) : null}
    </div>
  );
}

function SidebarBody({ onNavigate, collapsed = false, onToggle }: { onNavigate?: () => void; collapsed?: boolean; onToggle?: () => void }) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const { data: inboxWorkspace } = useWorkspace();
  const { data: inbox } = useEmployeeInbox(inboxWorkspace?.id);
  // ترتيب واتساب: الأحدث رسالةً أولاً، ومن لم يراسلك بعد يبقى بترتيب الفريق.
  const inboxOrder = [...team].sort((a, b) => {
    const ta = inbox?.find((t) => t.employee_id === a.id)?.last_employee_message_at ?? "";
    const tb = inbox?.find((t) => t.employee_id === b.id)?.last_employee_message_at ?? "";
    return tb.localeCompare(ta);
  });

  return (
    <div className={cn("flex h-full flex-col gap-4 p-3", collapsed && "items-center gap-3 px-2")}>
      <div className={cn("flex w-full items-center border-b border-border pb-3", collapsed ? "flex-col gap-1" : "justify-between gap-1")}>
        <Link to="/" aria-label="سهل — الرئيسية" title={collapsed ? "سهل — الرئيسية" : undefined} className={cn("flex h-9 min-w-0 items-center gap-2 font-display text-xl font-black", collapsed && "justify-center")}>
          <LogoMark className="size-8 shrink-0" size={40} />
          {!collapsed && <>سهل<span className="text-jade">.</span></>}
        </Link>
        {onToggle && <Button type="button" variant="ghost" size="icon" onClick={onToggle} aria-label={collapsed ? "فتح القائمة الجانبية" : "طي القائمة الجانبية"} aria-expanded={!collapsed} aria-controls="app-desktop-sidebar" title={collapsed ? "فتح القائمة الجانبية" : "طي القائمة الجانبية"} className="size-9 shrink-0">
          {collapsed ? <PanelRightOpen className="size-4" /> : <PanelRightClose className="size-4" />}
        </Button>}
      </div>

      <SpaceSwitcher collapsed={collapsed} />
      {collapsed ? null : <WorkspaceCard />}

      <div className={cn("flex min-h-0 flex-1 flex-col", collapsed && "w-full")}>
        <div className={cn("mb-2 px-2", collapsed && "sr-only")}>
          <p className="text-[0.68rem] font-bold text-muted-foreground">الموظفون</p>
        </div>
        <div className={cn("min-h-0 flex-1 space-y-1.5 overflow-y-auto", collapsed && "overflow-x-hidden")}>
          {inboxOrder.map((m) => {
            const thread = inbox?.find((t) => t.employee_id === m.id);
            const unread = thread?.unread_count ?? 0;
            const time = inboxTime(thread?.last_employee_message_at);
            const active = pathname === `/app/chat/${m.id}`;
            return (
              <Link
                key={m.id}
                to="/app/chat/$id"
                params={{ id: m.id }}
                onClick={onNavigate}
                 title={collapsed ? m.name : undefined}
                 aria-label={collapsed ? `${m.name}${unread ? `، ${unread} غير مقروء` : ""}` : undefined}
                 aria-current={active ? "page" : undefined}
                className={cn(
                  "group flex items-center gap-3 rounded-lg border border-transparent px-2.5 py-2 text-sm transition-colors hover:bg-secondary/70",
                  collapsed && "justify-center px-1 py-1.5",
                  active && "border-primary/20 bg-primary/10 shadow-sm",
                )}
              >
                <span className={cn("relative block size-11 shrink-0 overflow-hidden rounded-full shadow-sm", collapsed && "size-10")}>
                  <Portrait memberId={m.id} name={m.name} className="size-full" />
                  {collapsed && unread > 0 && !active && <span className="absolute bottom-0 end-0 size-2.5 rounded-full border border-card bg-primary" />}
                </span>
                {!collapsed && <span className="min-w-0 flex-1">
                  <span className="flex items-center justify-between gap-2">
                    <span className={cn("truncate", unread && !active ? "font-black" : "font-bold")}>{m.name}</span>
                    {time ? <time className={cn("inbox-row-time", unread > 0 && !active && "is-unread")}>{time}</time> : null}
                  </span>
                  <span className="mt-0.5 flex items-center gap-2">
                    <span
                      className={cn(
                        "min-w-0 flex-1 truncate text-[0.72rem]",
                        unread && !active ? "font-bold text-foreground" : "text-muted-foreground",
                      )}
                    >
                      {thread?.last_employee_message?.replace(/[#*_`>]+/g, "").replace(/\s+/g, " ").trim() || m.role}
                    </span>
                    {unread > 0 && !active ? (
                      <b className="inbox-row-badge">{unread > 99 ? "99+" : unread}</b>
                    ) : null}
                  </span>
                </span>}
              </Link>
            );
          })}
        </div>
      </div>
      <Link to="/pricing" onClick={onNavigate} aria-label={collapsed ? "عرض الأسعار" : undefined} title={collapsed ? "عرض الأسعار" : undefined} className={cn("app-sidebar-pricing", collapsed && "!grid !size-11 !place-items-center !p-0")}>
        {collapsed ? <ArrowLeft className="size-5" /> : <>
        <span>
          <small>الخطط والسعة</small>
          <b>عرض الأسعار</b>
        </span>
        <i aria-hidden="true">←</i>
        </>}
      </Link>
    </div>
  );
}

function WorkspaceCardIcon() {
  const { data: workspace } = useWorkspace();
  return workspace?.website ? <SiteFavicon website={workspace.website} className="size-8" /> : <img src={defaultWorkspace} alt="" loading="lazy" width={1024} height={1024} className="size-full object-cover" />;
}

/** شريط يوضّح أن الجلسة الحالية تجريبية ويقود لإنشاء حساب حقيقي. */
function GuestBar() {
  const [isGuest, setIsGuest] = useState(false);

  useEffect(() => {
    let alive = true;
    void supabase.auth.getUser().then(({ data }) => {
      if (alive) setIsGuest(data.user?.email === GUEST_EMAIL);
    });
    return () => {
      alive = false;
    };
  }, []);

  if (!isGuest) return null;
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border bg-amber/15 px-5 py-3">
      <p className="text-sm font-bold">أنت في وضع التجربة — العمل هنا مشترك ولن يُحفظ باسمك.</p>
      <Link
        to="/auth"
        search={{ mode: "signup" }}
        className="rounded-full bg-foreground px-4 py-1.5 text-xs font-bold text-background"
      >
        أنشئ حسابك المجاني
      </Link>
    </div>
  );
}

/** قائمة المستخدم: اسمه وبريده، والملف الشخصي، وزي الفريق، وتسجيل الخروج. */
function UserMenu({ name }: { name: string | null }) {
  const [open, setOpen] = useState(false);
  const [photoOpen, setPhotoOpen] = useState(false);
  const [email, setEmail] = useState<string | null>(null);
  const { country, countryInfo, setCountry } = useRegion();

  useEffect(() => {
    let alive = true;
    void supabase.auth.getUser().then(({ data }) => {
      if (alive) setEmail(data.user?.email ?? null);
    });
    return () => {
      alive = false;
    };
  }, []);

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label="حسابك"
        aria-expanded={open}
        className="size-10 overflow-hidden rounded-xl border border-border/60 shadow-card transition-transform hover:-translate-y-0.5"
      >
        <UserAvatar />
      </button>
      {open ? (
        <>
          <button
            aria-label="إغلاق"
            className="fixed inset-0 z-40 cursor-default"
            onClick={() => setOpen(false)}
          />
          <div className="absolute end-0 z-50 mt-2 w-[min(88vw,17rem)] rounded-2xl border border-border bg-card p-2 shadow-lift">
            <div className="flex items-center gap-3 px-3 py-2">
              <Button type="button" variant="ghost" size="icon" onClick={() => { setOpen(false); setPhotoOpen(true); }} aria-label="عرض الصورة الشخصية كاملة" className="size-10 shrink-0 overflow-hidden rounded-xl border border-border/60 p-0"><UserAvatar /></Button>
              <span className="min-w-0">
                <p className="truncate text-sm font-bold">{name ?? "حسابك"}</p>
                {email ? <p className="truncate text-xs text-muted-foreground">{email}</p> : null}
              </span>
            </div>
            <Link
              to="/app/settings"
              onClick={() => setOpen(false)}
              className="flex items-center gap-2.5 rounded-xl px-3 py-2.5 text-sm font-bold hover:bg-secondary"
            >
              <User className="size-4" /> الملف الشخصي والإعدادات
            </Link>

            <div className="mt-1 rounded-xl bg-secondary/50 p-3">
              <p className="text-xs font-bold">زيّ الفريق</p>
              <p className="mt-0.5 text-[0.7rem] text-muted-foreground">
                اختياري — اعرض الموظفين بلبس أي دولة عربية.
              </p>
              <select
                value={country}
                onChange={(e) => setCountry(e.target.value)}
                aria-label="زي الفريق حسب الدولة"
                className="mt-2 w-full rounded-lg border border-border bg-background px-2.5 py-2 text-sm font-semibold"
              >
                {COUNTRIES.map((c) => (
                  <option key={c.code} value={c.code}>
                    {c.name}
                  </option>
                ))}
              </select>
              <p className="mt-1 text-[0.68rem] text-muted-foreground">
                الحالي: {countryInfo.name}
              </p>
            </div>

            <button
              type="button"
              onClick={async () => {
                await supabase.auth.signOut();
                window.location.href = "/";
              }}
              className="mt-1 flex w-full items-center gap-2.5 rounded-xl px-3 py-2.5 text-start text-sm font-bold text-coral hover:bg-coral/10"
            >
              <LogOut className="size-4" /> تسجيل الخروج
            </button>
          </div>
        </>
      ) : null}
      <ProfilePhotoViewer open={photoOpen} onClose={() => setPhotoOpen(false)} />
    </div>
  );
}

function ProfilePhotoViewer({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { url, name } = useAvatarUrl();
  return <Dialog open={open} onOpenChange={(value) => { if (!value) onClose(); }}>
    <DialogContent className="flex max-h-[90dvh] w-[min(94vw,42rem)] max-w-none items-center justify-center overflow-hidden border-border bg-card p-3 sm:p-5" aria-describedby={undefined}>
      <DialogTitle className="sr-only">الصورة الشخصية</DialogTitle>
      <img src={url ?? defaultUserRobot} alt={url ? `صورة ${name ?? "المستخدم"}` : "الصورة الافتراضية للمستخدم"} width={1024} height={1024} className="max-h-[82dvh] max-w-full object-contain" />
    </DialogContent>
  </Dialog>;
}

const primaryLinks = [
  { to: "/app/chat", label: "المحادثات", icon: MessageCircle },
  { to: "/app", label: "لوحة المؤشرات", icon: LayoutDashboard },
  { to: "/app/workspace", label: "مساحة العمل", icon: FolderKanban },
  { to: "/app/approvals", label: "الموافقات", icon: CheckCircle2 },
  { to: "/app/brain", label: "عقل العلامة", icon: BrainCircuit },
  { to: "/app/integrations", label: "التكاملات", icon: Blocks },
] as const;
const secondaryLinks = [
  { to: "/app/referral", label: "شارك واربح", icon: Gift },
  { to: "/app/feedback", label: "الملاحظات والآراء", icon: MessageSquareText },
  { to: "/app/help", label: "المساعدة والدعم", icon: CircleHelp },
] as const;

function PrimaryNavigation({ expanded, onToggle, mobile = false, onNavigate }: { expanded: boolean; onToggle?: () => void; mobile?: boolean; onNavigate?: (chats: boolean) => void }) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const renderLink = (item: (typeof primaryLinks)[number] | (typeof secondaryLinks)[number]) => {
    const active = item.to === "/app" ? pathname === "/app" : pathname === item.to || pathname.startsWith(`${item.to}/`);
    return <Link
      key={item.to}
      to={item.to}
      preload="intent"
      preloadDelay={0}
      activeOptions={{ exact: item.to === "/app" }}
      onClick={() => onNavigate?.(item.to === "/app/chat")}
      aria-label={expanded ? undefined : item.label}
      title={expanded ? undefined : item.label}
      aria-current={active ? "page" : undefined}
      className={cn("flex h-11 w-full items-center gap-3 rounded-md px-3 text-sm font-bold transition-colors hover:bg-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring", !expanded && "justify-center px-0", active ? "bg-primary/10 text-primary" : "text-muted-foreground hover:text-foreground")}
    >
      <item.icon className="size-5 shrink-0" aria-hidden="true" />
      {expanded && <span className="min-w-0 truncate">{item.label}</span>}
    </Link>;
  };
  return (
    <nav aria-label="التنقل الرئيسي" className={cn("flex h-full min-h-0 flex-col gap-1 p-2", mobile && "min-h-full")}>
      {!mobile && <div className="mb-3 flex h-12 items-center justify-center border-b border-border pb-2">
        <Button type="button" variant="ghost" size="icon" onClick={onToggle} aria-label={expanded ? "طي التنقل الرئيسي" : "توسيع التنقل الرئيسي"} title={expanded ? "طي التنقل الرئيسي" : "توسيع التنقل الرئيسي"} aria-expanded={expanded} className="size-10 shrink-0">
          {expanded ? <PanelLeftClose /> : <PanelLeftOpen />}
        </Button>
        {expanded && <span className="min-w-0 flex-1 truncate px-2 text-sm font-black">سهل</span>}
      </div>}
      <div className="space-y-1">{primaryLinks.map(renderLink)}</div>
      <div className="mt-auto space-y-1 border-t border-border pt-3">{secondaryLinks.map(renderLink)}</div>
    </nav>
  );
}

type ShellOptions = { title: string; lead: string | undefined; actions: ReactNode; padded: boolean; compactTitle: boolean; hideTitle: boolean };
const PersistentShell = createContext<{ setOptions: (options: ShellOptions) => void; actionsSlot: HTMLElement | null } | null>(null);

export function AppShell({
  title,
  lead,
  actions,
  children,
  padded = true,
  compactTitle = false,
  hideTitle = false,
}: {
  title: string;
  lead?: string;
  actions?: ReactNode;
  children: ReactNode;
  padded?: boolean;
  /** يخفي العنوان على الهاتف ليتّسع الشريط للأزرار دون تداخل. */
  compactTitle?: boolean;
  hideTitle?: boolean;
}) {
  const parent = useContext(PersistentShell);
  const [actionsSlot, setActionsSlot] = useState<HTMLElement | null>(null);
  const [options, setOptions] = useState<ShellOptions>({ title, lead, actions, padded, compactTitle, hideTitle });
  const setParentOptions = parent?.setOptions;
  useLayoutEffect(() => {
    if (setParentOptions) setParentOptions({ title, lead, padded, compactTitle, hideTitle, actions: undefined });
  }, [setParentOptions, title, lead, padded, compactTitle, hideTitle]);

  if (parent) return <>{children}{actions && parent.actionsSlot ? createPortal(actions, parent.actionsSlot) : null}</>;
  return <PersistentShell.Provider value={{ setOptions, actionsSlot }}>
    <AppShellFrame {...options} actions={<span ref={setActionsSlot} className="contents" />}>{children}</AppShellFrame>
  </PersistentShell.Provider>;
}

function AppShellFrame({ title, lead, actions, children, padded, compactTitle, hideTitle }: ShellOptions & { children: ReactNode }) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [mobilePane, setMobilePane] = useState<"navigation" | "employees">("navigation");
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [railExpanded, setRailExpanded] = useState(false);
  useEffect(() => {
    try { setSidebarCollapsed(localStorage.getItem("sahl-sidebar-collapsed") === "true"); } catch { /* Private browsing may block storage. */ }
    try { setRailExpanded(localStorage.getItem("sahl-primary-rail-expanded") === "true"); } catch { /* Private browsing may block storage. */ }
  }, []);
  const toggleSidebar = () => setSidebarCollapsed((current) => {
    try { localStorage.setItem("sahl-sidebar-collapsed", String(!current)); } catch { /* Keep the toggle usable without storage. */ }
    return !current;
  });
  const toggleRail = () => setRailExpanded((current) => {
    try { localStorage.setItem("sahl-primary-rail-expanded", String(!current)); } catch { /* Keep the toggle usable without storage. */ }
    return !current;
  });
  const { data: profile } = useProfile();
  const embedded = useRouterState({
    select: (state) =>
      ["1", "true"].includes(String((state.location.search as Record<string, unknown>)["embedded"])),
  });

  return (
    <div
      className={cn(
        "app-shell sahl-app-theme flex min-h-screen bg-background",
        embedded && "is-embedded",
        compactTitle && "is-chat-shell",
        sidebarCollapsed && "is-sidebar-collapsed",
        railExpanded && "is-rail-expanded",
      )}
    >
      <div className="sahl-smoke sahl-smoke-app" aria-hidden="true">
        <i />
        <i />
        <i />
      </div>
      <aside aria-label="التنقل الرئيسي" className={cn("app-primary-rail sticky top-0 hidden h-screen shrink-0 self-start overflow-y-auto border-e border-border bg-card md:block", embedded && "md:hidden")}>
        <PrimaryNavigation expanded={railExpanded} onToggle={toggleRail} onNavigate={(chats) => { if (chats) { setSidebarCollapsed(false); try { localStorage.setItem("sahl-sidebar-collapsed", "false"); } catch { /* Keep navigation usable. */ } } }} />
      </aside>
      <aside
        className={cn(
          "sticky top-0 hidden h-screen shrink-0 self-start overflow-hidden border-e border-border bg-card transition-[width] duration-200 md:block",
          sidebarCollapsed ? "w-16" : "w-64",
          embedded && "md:hidden",
        )}
        id="app-desktop-sidebar"
        aria-label="القائمة الجانبية"
      >
        <SidebarBody collapsed={sidebarCollapsed} onToggle={toggleSidebar} />
      </aside>

      {mobileOpen ? (
        <div className="fixed inset-0 z-50 md:hidden">
          <Button type="button" variant="ghost"
            aria-label="إغلاق"
            className="absolute inset-0 h-auto w-auto rounded-none bg-foreground/40 backdrop-blur-sm hover:bg-foreground/40"
            onClick={() => setMobileOpen(false)}
          />
           <div className="absolute inset-y-0 start-0 flex w-[min(19rem,86vw)] flex-col overflow-y-auto bg-card shadow-2xl">
             {mobilePane === "navigation" ? <PrimaryNavigation expanded mobile onNavigate={(chats) => { if (chats) setMobilePane("employees"); else setMobileOpen(false); }} /> : <>
               <Button type="button" variant="ghost" onClick={() => setMobilePane("navigation")} className="mx-3 mt-3 justify-start gap-2"><ArrowLeft className="size-4 rotate-180" /> التنقل الرئيسي</Button>
               <div className="min-h-[34rem] flex-1"><SidebarBody onNavigate={() => setMobileOpen(false)} /></div>
             </>}
          </div>
        </div>
      ) : null}

      <div className="relative z-10 flex min-w-0 flex-1 flex-col">
        <header
          className={cn(
            "app-topbar sticky top-0 z-30 px-2 pt-2 sm:px-4 sm:pt-3",
            embedded && "hidden",
          )}
        >
          <div className={cn("app-topbar-inner flex min-h-14 items-center gap-2 px-2 py-1.5 sm:gap-2.5 sm:px-3", compactTitle && "max-sm:flex-wrap")}>
            <Button type="button" variant="outline" size="icon"
              className="size-10 shrink-0 rounded-lg border-border md:hidden"
               onClick={() => { setMobilePane("navigation"); setMobileOpen(true); }}
              aria-label="القائمة"
            >
              {mobileOpen ? <X className="size-5" /> : <Menu className="size-5" />}
            </Button>
            <div className={cn("min-w-0 flex-1", hideTitle && "sr-only")}>
              <h1 className="truncate font-display text-base font-black sm:text-lg">{title}</h1>
              {lead ? (
                <p className="truncate text-xs text-muted-foreground sm:text-sm">{lead}</p>
              ) : null}
            </div>
            <div
              className={cn(
                "app-topbar-controls flex min-w-0 shrink-0 items-center gap-1 sm:gap-2",
                compactTitle && "max-sm:w-full max-sm:flex-auto sm:flex-initial",
              )}
            >
              {actions}
              <NotificationBell />
              <UserMenu name={profile?.full_name ?? null} />
            </div>
          </div>
        </header>
        {embedded ? null : <GuestBar />}
        <main className={padded ? "mx-auto w-full max-w-[100rem] px-3.5 py-5 sm:px-5 sm:py-7" : ""}>
          {children}
        </main>
      </div>
    </div>
  );
}
