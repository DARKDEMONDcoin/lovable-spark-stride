import { useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { Check, ChevronsUpDown, ImagePlus, Loader2, Plus, User, Users, X } from "lucide-react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { createProjectSpace } from "@/lib/collaboration.functions";
import { setChatSpace, useChatSpaces, useChatWorkspace } from "@/lib/data";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

type Space = { id: string; name: string; kind: string; owned: boolean; logo: string | null };

function SpaceIcon({ space, className }: { space?: Pick<Space, "name" | "logo" | "kind"> | null; className?: string }) {
  if (space?.logo) return <img src={space.logo} alt="" className={cn("size-9 shrink-0 rounded-lg border border-border object-cover", className)} />;
  return (
    <span className={cn("grid size-9 shrink-0 place-items-center rounded-lg border border-border bg-primary/10 font-display text-sm font-black text-primary", className)}>
      {space?.kind === "personal" ? <User className="size-4" /> : (space?.name ?? "؟").slice(0, 2)}
    </span>
  );
}

/** مبدّل المساحات: المساحة الشخصية + كل مشروع كمساحة مستقلة بفريقه وموظفيه. */
export function SpaceSwitcher({ collapsed = false }: { collapsed?: boolean }) {
  const { data: spaces } = useChatSpaces();
  const { data: active } = useChatWorkspace();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const list = (spaces ?? []) as Space[];
  const current = list.find((s) => s.id === active?.id) ?? list[0];

  const switchTo = (id: string) => {
    setChatSpace(id);
    setOpen(false);
    void qc.invalidateQueries();
    void navigate({ to: "/app" });
  };

  return (
    <>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <button type="button" aria-label="تبديل المساحة" title={collapsed ? current?.name : undefined}
            className={cn("flex w-full items-center gap-2.5 rounded-lg border border-border bg-card p-2 text-start transition hover:bg-accent", collapsed && "justify-center p-1")}>
            <SpaceIcon space={current} />
            {!collapsed && (
              <>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-bold">{current?.name ?? "مساحتي"}</span>
                  <span className="block truncate text-[0.7rem] text-muted-foreground">{current?.kind === "personal" ? "مساحتي الشخصية" : current?.owned ? "مشروع — أنت المالك" : "مشروع — عضو"}</span>
                </span>
                <ChevronsUpDown className="size-4 shrink-0 text-muted-foreground" />
              </>
            )}
          </button>
        </PopoverTrigger>
        <PopoverContent align="start" className="w-72 p-2">
          <p className="px-2 pb-1 text-[0.7rem] font-bold text-muted-foreground">مساحاتك ومشاريعك</p>
          <div className="max-h-72 space-y-1 overflow-y-auto">
            {list.map((s) => (
              <button key={s.id} type="button" onClick={() => switchTo(s.id)}
                className={cn("flex w-full items-center gap-2.5 rounded-md p-2 text-start text-sm hover:bg-accent", s.id === current?.id && "bg-accent")}>
                <SpaceIcon space={s} className="size-8" />
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-bold">{s.name}</span>
                  <span className="flex items-center gap-1 text-[0.7rem] text-muted-foreground">
                    {s.kind === "personal" ? <><User className="size-3" /> شخصية</> : <><Users className="size-3" /> {s.owned ? "مشروعي" : "مشروع فريق"}</>}
                  </span>
                </span>
                {s.id === current?.id && <Check className="size-4 text-primary" />}
              </button>
            ))}
          </div>
          <Button type="button" variant="outline" className="mt-2 w-full gap-2" onClick={() => { setOpen(false); setCreating(true); }}>
            <Plus className="size-4" /> مشروع جديد
          </Button>
        </PopoverContent>
      </Popover>
      <CreateProjectDialog open={creating} onOpenChange={setCreating} onCreated={switchTo} />
    </>
  );
}

function CreateProjectDialog({ open, onOpenChange, onCreated }: { open: boolean; onOpenChange: (v: boolean) => void; onCreated: (id: string) => void }) {
  const create = useServerFn(createProjectSpace);
  const qc = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);
  const [name, setName] = useState("");
  const [industry, setIndustry] = useState("");
  const [website, setWebsite] = useState("");
  const [email, setEmail] = useState("");
  const [invites, setInvites] = useState<string[]>([]);
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const preview = file ? URL.createObjectURL(file) : null;

  const addInvite = () => {
    const e = email.trim().toLowerCase();
    if (!/^\S+@\S+\.\S+$/.test(e)) return toast.error("اكتب بريدًا صحيحًا");
    if (!invites.includes(e)) setInvites([...invites, e]);
    setEmail("");
  };

  const submit = async () => {
    if (name.trim().length < 2) return toast.error("اكتب اسم المشروع");
    setBusy(true);
    try {
      let logoPath: string | undefined;
      if (file) {
        if (file.size > 5 * 1024 * 1024) throw new Error("الصورة أكبر من 5 ميجا");
        const { data: auth } = await supabase.auth.getUser();
        const ext = file.name.split(".").pop() || "png";
        logoPath = `${auth.user!.id}/spaces/${crypto.randomUUID()}.${ext}`;
        const { error } = await supabase.storage.from("avatars").upload(logoPath, file, { contentType: file.type });
        if (error) throw new Error("تعذّر رفع الصورة");
      }
      const finalInvites = email.trim() ? [...invites, email.trim().toLowerCase()] : invites;
      const { id } = await create({ data: { name: name.trim(), industry: industry.trim() || undefined, website: website.trim() || undefined, logoPath, invites: finalInvites } });
      await qc.invalidateQueries({ queryKey: ["human-spaces"] });
      toast.success(finalInvites.length ? `اتعمل المشروع واتبعتت ${finalInvites.length} دعوة` : "اتعمل المشروع");
      onOpenChange(false);
      setName(""); setIndustry(""); setWebsite(""); setInvites([]); setFile(null); setEmail("");
      onCreated(id);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "حصل خطأ");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md" dir="rtl">
        <DialogTitle className="font-display text-xl font-black">مشروع جديد</DialogTitle>
        <p className="-mt-2 text-sm text-muted-foreground">مساحة مستقلة كاملة: موظفين ومحادثات ومهام وفريق خاص بالمشروع ده بس.</p>
        <div className="flex items-center gap-3">
          <button type="button" onClick={() => fileRef.current?.click()} aria-label="صورة المشروع"
            className="grid size-16 shrink-0 place-items-center overflow-hidden rounded-xl border-2 border-dashed border-border bg-muted hover:border-primary">
            {preview ? <img src={preview} alt="" className="size-full object-cover" /> : <ImagePlus className="size-6 text-muted-foreground" />}
          </button>
          <input ref={fileRef} type="file" accept="image/*" hidden onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
          <div className="flex-1 space-y-1">
            <label className="text-xs font-bold" htmlFor="pj-name">اسم المشروع</label>
            <Input id="pj-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="مثلاً: متجر العطور" maxLength={60} />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div className="space-y-1"><label className="text-xs font-bold" htmlFor="pj-ind">المجال</label><Input id="pj-ind" value={industry} onChange={(e) => setIndustry(e.target.value)} placeholder="تجارة إلكترونية" /></div>
          <div className="space-y-1"><label className="text-xs font-bold" htmlFor="pj-web">الموقع (اختياري)</label><Input id="pj-web" dir="ltr" value={website} onChange={(e) => setWebsite(e.target.value)} placeholder="example.com" /></div>
        </div>
        <div className="space-y-1">
          <label className="text-xs font-bold" htmlFor="pj-mail">ادعُ فريقك (اختياري)</label>
          <div className="flex gap-2">
            <Input id="pj-mail" dir="ltr" type="email" value={email} onChange={(e) => setEmail(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addInvite(); } }} placeholder="name@email.com" />
            <Button type="button" variant="outline" onClick={addInvite}>إضافة</Button>
          </div>
          {invites.length > 0 && (
            <div className="flex flex-wrap gap-1.5 pt-1">
              {invites.map((m) => (
                <span key={m} dir="ltr" className="flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-xs">
                  {m}<button type="button" aria-label="إزالة" onClick={() => setInvites(invites.filter((x) => x !== m))}><X className="size-3" /></button>
                </span>
              ))}
            </div>
          )}
        </div>
        <Button type="button" onClick={submit} disabled={busy} className="w-full gap-2">
          {busy && <Loader2 className="size-4 animate-spin" />} إنشاء المشروع والدخول له
        </Button>
      </DialogContent>
    </Dialog>
  );
}