"use client";

import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import {
  FileText,
  Search,
  Plus,
  X,
  ChevronRight,
  MoreHorizontal,
  Folder,
  Globe,
  Youtube,
  FileType,
  Bot,
  StickyNote,
  Link as LinkIcon,
  Clock,
  AlertCircle,
  Filter,
  Sparkles,
  Zap,
  Brain,
  Type,
  Loader2,
  Trash2,
  Edit3,
  FolderInput,
  Shield,
  ChevronDown,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
} from "@/components/ui/dropdown-menu";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import StatCard from "@/components/ui/atlas/StatCard";
import OnboardingCard, { type OnboardingStep } from "@/components/ui/atlas/OnboardingCard";
import DocumentAccessToggle from "@/components/DocumentAccessToggle";
import QuickCreate from "@/components/QuickCreate";

/* ═══════════════════════════════════════════════════════════════
   Types
   ═══════════════════════════════════════════════════════════════ */

interface DocumentItem {
  doc_id: string;
  title: string;
  doc_type: string;
  doc_source: "file" | "note" | "url" | "youtube" | "template" | "ai-agent";
  access_level: "all_members" | "admin_only";
  folder_id: string | null;
  team_id: string | null;
  domain: string | null;
  version: string | null;
  status: string | null;
  tags: string[];
  review_by?: string | null;
  feedback?: {
    helped: number;
    not_confident: number;
    didnt_help: number;
  };
  created_at: string;
  updated_at: string;
}

interface FolderItem {
  id: string;
  name: string;
  icon: string;
  color: string;
  parent_folder_id: string | null;
  team_id: string | null;
  documents?: [{ count: number }];
}

interface TeamItem {
  id: string;
  name: string;
}

interface SearchResultItem {
  doc_id: string;
  title: string;
  doc_type: string;
  doc_source: string;
  score: number;
  why_matched: string[];
  section_title: string | null;
  snippet: string | null;
  access_level: string;
  feedback?: {
    helped: number;
    not_confident: number;
    didnt_help: number;
  };
}

interface FacetsData {
  top_tags: string[];
}

interface ProfileData {
  role?: string;
  language?: string;
  organization_id?: string | null;
}

/* ═══════════════════════════════════════════════════════════════
   Doc-Type Sub-Palette (non-semantic, ADR 0004 compliant)
   ═══════════════════════════════════════════════════════════════ */

const DOC_TYPE_META: Record<string, { icon: React.ElementType; bg: string; text: string; label: string }> = {
  file:      { icon: FileText,   bg: "bg-slate-100",  text: "text-slate-600",  label: "File" },
  note:      { icon: StickyNote, bg: "bg-amber-100",  text: "text-amber-600",  label: "Note" },
  url:       { icon: LinkIcon,   bg: "bg-sky-100",    text: "text-sky-600",    label: "URL" },
  youtube:   { icon: Youtube,    bg: "bg-rose-100",   text: "text-rose-600",   label: "YouTube" },
  template:  { icon: FileType,   bg: "bg-teal-100",   text: "text-teal-600",   label: "Template" },
  "ai-agent":{ icon: Bot,        bg: "bg-violet-100", text: "text-violet-600", label: "AI" },
};

function getDocMeta(source: string) {
  return DOC_TYPE_META[source] || DOC_TYPE_META.file;
}

/* ═══════════════════════════════════════════════════════════════
   Helpers
   ═══════════════════════════════════════════════════════════════ */

function timeAgo(date: string, isZh: boolean): string {
  const d = new Date(date);
  const now = new Date();
  const diff = Math.floor((now.getTime() - d.getTime()) / 1000);
  if (diff < 60) return isZh ? "剛剛" : "just now";
  if (diff < 3600) return isZh ? `${Math.floor(diff / 60)} 分鐘前` : `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return isZh ? `${Math.floor(diff / 3600)} 小時前` : `${Math.floor(diff / 3600)}h ago`;
  if (diff < 604800) return isZh ? `${Math.floor(diff / 86400)} 天前` : `${Math.floor(diff / 86400)}d ago`;
  return isZh ? `${Math.floor(diff / 604800)} 週前` : `${Math.floor(diff / 604800)}w ago`;
}

function scoreTier(score: number): { bg: string; text: string } {
  if (score >= 0.6) return { bg: "bg-purple-100", text: "text-purple-700" };
  if (score >= 0.4) return { bg: "bg-blue-100", text: "text-blue-700" };
  return { bg: "bg-slate-100", text: "text-slate-600" };
}

function isOverdue(reviewBy: string | null | undefined): boolean {
  if (!reviewBy) return false;
  return new Date(reviewBy) < new Date();
}

/* ═══════════════════════════════════════════════════════════════
   Module-Scope Internal Components
   ═══════════════════════════════════════════════════════════════ */

function CreateFolderModal({ open, onClose, onCreated, isZh }: { open: boolean; onClose: () => void; onCreated: () => void; isZh: boolean }) {
  const [name, setName] = useState("");
  const [creating, setCreating] = useState(false);
  const handleCreate = async () => {
    if (!name.trim()) return;
    setCreating(true);
    try {
      await fetch("/api/folders", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name }) });
      onCreated();
      onClose();
      setName("");
    } catch {
      // toast error
    } finally {
      setCreating(false);
    }
  };
  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-lg font-semibold tracking-tight text-slate-900">
            {isZh ? "新增資料夾" : "Create Folder"}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4 pt-2">
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={isZh ? "資料夾名稱" : "Folder name"}
            className="h-10"
            onKeyDown={(e) => e.key === "Enter" && handleCreate()}
          />
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={onClose} className="h-9 px-4">
              {isZh ? "取消" : "Cancel"}
            </Button>
            <Button onClick={handleCreate} disabled={creating || !name.trim()} className="h-9 px-4 bg-purple-600 hover:bg-purple-700">
              {creating ? <Loader2 className="h-4 w-4 animate-spin" /> : isZh ? "建立" : "Create"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function MoveToFolderModal({ docId, folders, docs, open, onClose, onMoved, isZh }: {
  docId: string | null;
  folders: FolderItem[];
  docs: DocumentItem[];
  open: boolean;
  onClose: () => void;
  onMoved: () => void;
  isZh: boolean;
}) {
  const [moving, setMoving] = useState(false);

  const handleMove = async (folderId: string | null) => {
    if (!docId) return;
    setMoving(true);
    try {
      const res = await fetch(`/api/documents/${encodeURIComponent(docId)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ folderId }),
      });
      if (res.ok) {
        onMoved();
        onClose();
      }
    } catch {
      // toast error
    } finally {
      setMoving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-lg font-semibold tracking-tight text-slate-900">
            {isZh ? "移動到資料夾" : "Move to Folder"}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-2 pt-2 max-h-72 overflow-y-auto">
          <button
            onClick={() => handleMove(null)}
            disabled={moving}
            className="w-full flex items-center gap-3 rounded-lg border border-slate-200 px-3 py-2.5 text-left text-sm transition-colors hover:bg-slate-50"
          >
            <Globe className="h-4 w-4 text-slate-400" />
            <span className="font-medium text-slate-900">{isZh ? "未分類（根目錄）" : "Unfiled (root)"}</span>
          </button>
          {folders.map((f) => {
            const docCount = f.documents?.[0]?.count ?? docs.filter((d) => d.folder_id === f.id).length;
            return (
              <button
                key={f.id}
                onClick={() => handleMove(f.id)}
                disabled={moving}
                className="w-full flex items-center gap-3 rounded-lg border border-slate-200 px-3 py-2.5 text-left text-sm transition-colors hover:bg-slate-50"
              >
                <span className="text-lg">{f.icon}</span>
                <span className="font-medium text-slate-900">{f.name}</span>
                <span className="ml-auto text-xs text-slate-400">{docCount} {isZh ? "份" : "docs"}</span>
              </button>
            );
          })}
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <Button variant="outline" onClick={onClose} className="h-9 px-4" disabled={moving}>
            {isZh ? "取消" : "Cancel"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function SearchModeControl({
  searchMode,
  setSearchMode,
  setIsAdvancedSearchActive,
  setSearchResults,
  isZh,
}: {
  searchMode: "browse" | "keyword" | "semantic" | "hybrid";
  setSearchMode: (m: "browse" | "keyword" | "semantic" | "hybrid") => void;
  setIsAdvancedSearchActive: (v: boolean) => void;
  setSearchResults: (r: SearchResultItem[]) => void;
  isZh: boolean;
}) {
  const modes: { id: typeof searchMode; label: string; short: string; icon: React.ElementType }[] = [
    { id: "browse",   label: isZh ? "瀏覽" : "Browse",   short: isZh ? "瀏覽" : "Browse", icon: Folder },
    { id: "hybrid",   label: isZh ? "混合" : "Hybrid",   short: isZh ? "混合" : "Hybrd", icon: Zap },
    { id: "keyword",  label: isZh ? "關鍵字" : "Keyword", short: isZh ? "關鍵" : "Keywd", icon: Type },
    { id: "semantic", label: isZh ? "語義" : "Semantic", short: isZh ? "語義" : "Semnt", icon: Brain },
  ];
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex rounded-lg bg-slate-100 p-1 gap-0.5 overflow-x-auto snap-x">
        {modes.map((m) => {
          const active = searchMode === m.id;
          return (
            <button
              key={m.id}
              onClick={() => {
                setSearchMode(m.id);
                if (m.id === "browse") {
                  setIsAdvancedSearchActive(false);
                  setSearchResults([]);
                }
              }}
              className={cn(
                "relative flex items-center justify-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium transition-all duration-150 shrink-0 snap-start",
                "sm:px-4 sm:text-sm",
                active
                  ? "bg-white text-purple-700 shadow-sm border border-slate-200"
                  : "text-slate-500 hover:text-slate-700 hover:bg-slate-200/50 border border-transparent"
              )}
            >
              <m.icon className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
              <span className="hidden sm:inline">{m.label}</span>
              <span className="sm:hidden">{m.short}</span>
              {active && m.id !== "browse" && (
                <span className="absolute -top-0.5 -right-0.5 h-1.5 w-1.5 rounded-full bg-purple-500" />
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// RowActionMenu — custom dropdown replacement for the broken shadcn DropdownMenu
// in this codebase. Each row gets its own instance with isolated open state.
// ---------------------------------------------------------------------------
function RowActionMenu({
  onEdit,
  onMove,
  onDelete,
  isZh,
}: {
  onEdit: () => void;
  onMove: () => void;
  onDelete: () => void;
  isZh: boolean;
}) {
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // Close on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    if (open) document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [open]);

  // Close on Escape
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    if (open) document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [open]);

  return (
    <div ref={menuRef} className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
        aria-label={isZh ? "更多操作" : "More actions"}
        aria-expanded={open}
      >
        <MoreHorizontal className="h-5 w-5" />
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-1 w-48 rounded-md border border-slate-200 bg-white shadow-lg z-50 py-1">
          <button
            onClick={() => {
              setOpen(false);
              onEdit();
            }}
            className="flex items-center gap-2 w-full px-3 py-2.5 text-sm text-slate-700 hover:bg-slate-50 transition-colors cursor-pointer"
          >
            <Edit3 className="h-4 w-4" />
            {isZh ? "編輯" : "Edit"}
          </button>
          <button
            onClick={() => {
              setOpen(false);
              onMove();
            }}
            className="flex items-center gap-2 w-full px-3 py-2.5 text-sm text-slate-700 hover:bg-slate-50 transition-colors cursor-pointer"
          >
            <FolderInput className="h-4 w-4" />
            {isZh ? "移動" : "Move"}
          </button>
          <div className="my-1 h-px bg-slate-100" />
          <button
            onClick={() => {
              setOpen(false);
              onDelete();
            }}
            className="flex items-center gap-2 w-full px-3 py-2.5 text-sm text-red-600 hover:bg-red-50 transition-colors cursor-pointer"
          >
            <Trash2 className="h-4 w-4" />
            {isZh ? "刪除" : "Delete"}
          </button>
        </div>
      )}
    </div>
  );
}

function BrowseRow({
  doc,
  folders,
  isAdmin,
  isZh,
  onDelete,
  onMove,
}: {
  doc: DocumentItem;
  folders: FolderItem[];
  isAdmin: boolean;
  isZh: boolean;
  onDelete: (docId: string) => void;
  onMove: (docId: string) => void;
}) {
  const router = useRouter();
  const meta = getDocMeta(doc.doc_source);
  const Icon = meta.icon;
  const totalFb = (doc.feedback?.helped || 0) + (doc.feedback?.not_confident || 0) + (doc.feedback?.didnt_help || 0);
  const needsReview = (doc.feedback?.not_confident || 0) + (doc.feedback?.didnt_help || 0) > 0;
  const overdue = isOverdue(doc.review_by);
  const parentFolder = doc.folder_id ? folders.find((f) => f.id === doc.folder_id) : null;

  return (
    <div className="group flex items-center gap-3 rounded-xl border border-slate-200 bg-white p-3 transition-all duration-200 hover:border-slate-300 hover:shadow-sm sm:gap-4 sm:p-4">
      <div className={cn("flex h-9 w-9 shrink-0 items-center justify-center rounded-lg sm:h-10 sm:w-10", meta.bg)}>
        <Icon className={cn("h-4 w-4 sm:h-5 sm:w-5", meta.text)} />
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <Link
            href={`/library/${doc.doc_id}`}
            className="truncate text-sm font-medium text-slate-900 transition-colors group-hover:text-purple-700"
          >
            {doc.title}
          </Link>
          <Badge variant="secondary" className="hidden h-5 shrink-0 text-[10px] font-medium sm:inline-flex">
            {doc.doc_type}
          </Badge>
          {doc.access_level === "admin_only" && (
            <Badge variant="outline" className="hidden h-5 shrink-0 text-[10px] font-medium text-amber-600 border-amber-200 bg-amber-50 sm:inline-flex">
              <Shield className="mr-0.5 h-3 w-3" />
              {isZh ? "管理員" : "Admin"}
            </Badge>
          )}
          {parentFolder && (
            <Badge variant="outline" className="hidden h-5 shrink-0 text-[10px] font-medium text-amber-700 border-amber-200 bg-amber-50 sm:inline-flex">
              <span className="mr-0.5">{parentFolder.icon || "📁"}</span>
              {parentFolder.name}
            </Badge>
          )}
          {overdue && (
            <span className="inline-flex items-center gap-1 rounded-md bg-red-50 px-1.5 py-0.5 text-[10px] font-semibold text-red-600">
              ⚠️ {isZh ? "逾期審閱" : "Review overdue"}
            </span>
          )}
        </div>
        <div className="mt-0.5 flex items-center gap-2 text-xs text-slate-400">
          <span>{meta.label}</span>
          <span>·</span>
          <span>{timeAgo(doc.updated_at, isZh)}</span>
          {totalFb > 0 && (
            <>
              <span>·</span>
              <span className={cn(needsReview && "text-amber-600 font-medium")}>
                {isZh ? `${totalFb} 則回饋` : `${totalFb} feedback`}
              </span>
            </>
          )}
        </div>
      </div>

      {isAdmin && (
        <div className="flex items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100 focus-within:opacity-100 sm:gap-2">
          <DocumentAccessToggle
            docId={doc.doc_id}
            currentLevel={doc.access_level || "all_members"}
            isAdmin={isAdmin}
          />
          <RowActionMenu
            onEdit={() => router.push(`/library/${doc.doc_id}/edit`)}
            onMove={() => onMove(doc.doc_id)}
            onDelete={() => onDelete(doc.doc_id)}
            isZh={isZh}
          />
        </div>
      )}

      {!isAdmin && (
        <ChevronRight className="h-4 w-4 shrink-0 text-slate-300 transition-transform group-hover:translate-x-0.5 group-hover:text-purple-400" />
      )}
    </div>
  );
}

function SearchResultRow({
  result,
  isAdmin,
  isZh,
  onDelete,
  onMove,
}: {
  result: SearchResultItem;
  isAdmin: boolean;
  isZh: boolean;
  onDelete: (docId: string) => void;
  onMove: (docId: string) => void;
}) {
  const router = useRouter();
  const meta = getDocMeta(result.doc_source);
  const Icon = meta.icon;
  const tier = scoreTier(result.score);
  const totalFb = (result.feedback?.helped || 0) + (result.feedback?.not_confident || 0) + (result.feedback?.didnt_help || 0);

  return (
    <div className="group flex items-start gap-3 rounded-xl border border-slate-200 bg-white p-3 transition-all duration-200 hover:border-slate-300 hover:shadow-sm sm:gap-4 sm:p-4">
      <div className={cn("flex h-9 w-9 shrink-0 items-center justify-center rounded-lg sm:h-10 sm:w-10", meta.bg)}>
        <Icon className={cn("h-4 w-4 sm:h-5 sm:w-5", meta.text)} />
      </div>

      <div className="min-w-0 flex-1 space-y-1.5">
        <div className="flex items-center gap-2">
          <Link
            href={`/library/${result.doc_id}`}
            className="truncate text-sm font-medium text-slate-900 transition-colors group-hover:text-purple-700"
          >
            {result.title}
          </Link>
          <Badge className={cn("h-5 shrink-0 text-[10px] font-bold tabular-nums border-0", tier.bg, tier.text)}>
            {Math.round(result.score * 100)}%
          </Badge>
          <Badge variant="secondary" className="hidden h-5 shrink-0 text-[10px] font-medium sm:inline-flex">
            {result.doc_type}
          </Badge>
        </div>

        <div className="space-y-1">
          {result.why_matched.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {result.why_matched.map((wm, i) => (
                <span key={i} className="inline-flex items-center rounded-md bg-purple-50 px-1.5 py-0.5 text-[11px] font-medium text-purple-700">
                  <Sparkles className="mr-1 h-3 w-3" />
                  {wm}
                </span>
              ))}
            </div>
          )}
          {result.snippet && (
            <p className="text-xs text-slate-500 line-clamp-2 leading-relaxed">
              {result.section_title && (
                <span className="font-semibold text-slate-700">{result.section_title}: </span>
              )}
              {result.snippet}
            </p>
          )}
        </div>

        <div className="flex items-center gap-2 text-[11px] text-slate-400">
          <span>{meta.label}</span>
          {totalFb > 0 && (
            <>
              <span>·</span>
              <span>{isZh ? `${totalFb} 則回饋` : `${totalFb} feedback`}</span>
            </>
          )}
        </div>
      </div>

      {isAdmin && (
        <div className="flex items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100 focus-within:opacity-100">
          <RowActionMenu
            onEdit={() => router.push(`/library/${result.doc_id}/edit`)}
            onMove={() => onMove(result.doc_id)}
            onDelete={() => onDelete(result.doc_id)}
            isZh={isZh}
          />
        </div>
      )}

      {!isAdmin && (
        <ChevronRight className="mt-2.5 h-4 w-4 shrink-0 text-slate-300 transition-transform group-hover:translate-x-0.5 group-hover:text-purple-400" />
      )}
    </div>
  );
}

function LibrarySkeleton() {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4">
        {[1, 2, 3].map((i) => (
          <Card key={i} className="border-slate-200">
            <CardContent className="p-4 sm:p-5">
              <div className="flex items-start gap-3">
                <Skeleton className="h-8 w-8 rounded-lg" />
                <div className="space-y-2">
                  <Skeleton className="h-7 w-16" />
                  <Skeleton className="h-3 w-20" />
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
      <div className="space-y-3">
        <Skeleton className="h-11 w-full rounded-xl" />
        <Skeleton className="h-9 w-64 rounded-lg" />
      </div>
      <div className="flex gap-2 overflow-hidden">
        {[1, 2, 3, 4].map((i) => (
          <Skeleton key={i} className="h-9 w-28 shrink-0 rounded-full" />
        ))}
      </div>
      <div className="space-y-2">
        {[1, 2, 3, 4, 5, 6].map((i) => (
          <div key={i} className="flex items-center gap-3 rounded-xl border border-slate-200 p-3 sm:gap-4 sm:p-4">
            <Skeleton className="h-9 w-9 shrink-0 rounded-lg sm:h-10 sm:w-10" />
            <div className="min-w-0 flex-1 space-y-2">
              <Skeleton className="h-4 w-3/4" />
              <Skeleton className="h-3 w-1/3" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function EmptyState({
  isAdmin,
  folderFilter,
  searchQuery,
  teamFilter,
  isZh,
  onClear,
}: {
  isAdmin: boolean;
  folderFilter: string | null;
  searchQuery: string;
  teamFilter: string;
  isZh: boolean;
  onClear: () => void;
}) {
  const router = useRouter();
  const isAdminEmpty = isAdmin && !folderFilter && !searchQuery && teamFilter === "all";
  const steps: OnboardingStep[] = [
    { step: 1, icon: FileText, title: isZh ? "上傳文件" : "Upload Documents", desc: isZh ? "新增 HR 政策與規範" : "Add HR policies", href: "/library/new", done: false },
    { step: 2, icon: StickyNote, title: isZh ? "撰寫筆記" : "Write Notes", desc: isZh ? "記錄團隊知識" : "Capture team knowledge", href: "/library/note/new", done: false },
    { step: 3, icon: Zap, title: isZh ? "試用 AI 搜尋" : "Try Atlas AI", desc: isZh ? "用語意尋找文件" : "Search by meaning", href: "/library", done: false },
  ];

  if (isAdminEmpty) {
    return (
      <div className="mt-6">
        <OnboardingCard
          title={isZh ? "完成設定以解鎖 AI 功能" : "Complete setup to unlock AI features"}
          subtitle={isZh ? "3 個步驟，不到 5 分鐘" : "3 steps, less than 5 minutes"}
          steps={steps}
        />
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-slate-300 bg-slate-50/50 py-12 sm:py-16">
      <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-slate-100">
        <Search className="h-6 w-6 text-slate-400" />
      </div>
      <p className="mt-4 text-sm font-medium text-slate-900">
        {folderFilter
          ? isZh ? "此資料夾尚無文件" : "No documents in this folder yet."
          : teamFilter !== "all"
          ? isZh ? "此篩選條件下無文件" : "No documents found in this filter."
          : searchQuery
          ? isZh ? `沒有符合「${searchQuery}」的結果` : `No results found for "${searchQuery}"`
          : isZh ? "尚無文件" : "No documents found."}
      </p>
      <p className="mt-1 text-xs text-slate-500">
        {searchQuery
          ? isZh ? "嘗試不同關鍵字或切換搜尋模式" : "Try different keywords or switch search mode"
          : isZh ? "上傳第一份文件開始使用" : "Upload your first document to get started"}
      </p>
      {(folderFilter || searchQuery || teamFilter !== "all") && (
        <Button variant="outline" size="sm" className="mt-4 h-8" onClick={onClear}>
          <X className="mr-1.5 h-3.5 w-3.5" />
          {isZh ? "清除篩選" : "Clear filters"}
        </Button>
      )}
      {isAdmin && !folderFilter && !searchQuery && teamFilter === "all" && (
        <Button className="mt-4 h-8 bg-purple-600 hover:bg-purple-700" size="sm" onClick={() => router.push("/library/new")}>
          <Plus className="mr-1.5 h-3.5 w-3.5" />
          {isZh ? "上傳文件" : "Upload"}
        </Button>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   Main Page
   ═══════════════════════════════════════════════════════════════ */

export default function LibraryPage() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [isAdmin, setIsAdmin] = useState(false);
  const [isZh, setIsZh] = useState(true);

  const [docs, setDocs] = useState<DocumentItem[]>([]);
  const [folders, setFolders] = useState<FolderItem[]>([]);
  const [teams, setTeams] = useState<TeamItem[]>([]);
  const [facets, setFacets] = useState<FacetsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  const [searchQuery, setSearchQuery] = useState("");
  const [searchMode, setSearchMode] = useState<"browse" | "keyword" | "semantic" | "hybrid">("browse");
  const [searchResults, setSearchResults] = useState<SearchResultItem[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchErr, setSearchErr] = useState<string | null>(null);
  const [isAdvancedSearchActive, setIsAdvancedSearchActive] = useState(false);

  const [folderFilter, setFolderFilter] = useState<string | null>(null);
  const [teamFilter, setTeamFilter] = useState("all");
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);
  const [filterDocType, setFilterDocType] = useState("");
  const [filterDomain, setFilterDomain] = useState("");
  const [filterTag, setFilterTag] = useState("");

  const [showCreateFolder, setShowCreateFolder] = useState(false);
  const [moveDocId, setMoveDocId] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setErr(null);
    try {
      const [docsRes, foldersRes, teamsRes, profileRes, facetsRes] = await Promise.all([
        fetch("/api/documents"),
        fetch("/api/folders"),
        fetch("/api/teams"),
        fetch("/api/profile"),
        fetch("/api/facets"),
      ]);
      const docsData = await docsRes.json();
      const foldersData = await foldersRes.json();
      const teamsData = await teamsRes.json();
      const profileData: ProfileData = profileRes.ok ? await profileRes.json() : {};
      const facetsData = facetsRes.ok ? await facetsRes.json() : null;

      setDocs(docsData.documents || []);
      setFolders(foldersData.folders || []);
      setTeams(teamsData.teams || []);
      setFacets(facetsData);

      // role comes from organization membership; admin/owner both count as admin
      if (profileData.role) {
        setIsAdmin(["owner", "admin"].includes(profileData.role));
      }
      if (profileData.language) {
        setIsZh(profileData.language === "zh" || profileData.language === "zh-TW");
      }
    } catch (e) {
      setErr("Failed to load library");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  useEffect(() => {
    const teamParam = searchParams?.get("team");
    const folderParam = searchParams?.get("folder");
    if (teamParam) setTeamFilter(teamParam);
    if (folderParam) setFolderFilter(folderParam);
  }, [searchParams]);

  const handleAdvancedSearch = useCallback(async () => {
    if (!searchQuery.trim()) return;
    setSearchLoading(true);
    setSearchErr(null);
    setIsAdvancedSearchActive(true);
    try {
      const params = new URLSearchParams({
        q: searchQuery,
        mode: searchMode,
      });
      if (filterDocType) params.set("doc_type", filterDocType);
      if (filterDomain) params.set("domain", filterDomain);
      if (filterTag) params.set("tag", filterTag);

      const res = await fetch(`/api/doc-snap?${params.toString()}`);
      const data = await res.json();
      setSearchResults(data.results || []);
      if (data.facets) setFacets(data.facets);
    } catch (e) {
      setSearchErr(isZh ? "搜尋失敗" : "Search failed");
    } finally {
      setSearchLoading(false);
    }
  }, [searchQuery, searchMode, filterDocType, filterDomain, filterTag, isZh]);

  const recentUploads = useMemo(
    () => docs.filter((d) => new Date(d.created_at) > new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)).length,
    [docs]
  );

  const docsNeedingReview = useMemo(
    () => docs.filter((d) => (d.feedback?.not_confident || 0) + (d.feedback?.didnt_help || 0) > 0).length,
    [docs]
  );

  const overdueReviews = useMemo(
    () => docs.filter((d) => isOverdue(d.review_by)).length,
    [docs]
  );

  const currentFolder = useMemo(
    () => folders.find((f) => f.id === folderFilter) || null,
    [folders, folderFilter]
  );

  const filteredDocs = useMemo(() => {
    let result = docs;
    if (folderFilter) {
      result = result.filter((d) => d.folder_id === folderFilter);
    }
    if (teamFilter !== "all") {
      result = result.filter((d) => d.team_id === teamFilter || (teamFilter === "org-wide" && !d.team_id));
    }
    if (searchQuery && searchMode === "browse") {
      const q = searchQuery.toLowerCase();
      result = result.filter((d) => d.title.toLowerCase().includes(q));
    }
    return result;
  }, [docs, folderFilter, teamFilter, searchQuery, searchMode]);

  const filterOptions = useMemo(() => {
    const allCount = docs.length;
    const orgWideCount = docs.filter((d) => !d.team_id).length;
    const adminCount = docs.filter((d) => d.access_level === "admin_only").length;
    const engineeringCount = docs.filter((d) => d.team_id && teams.find((t) => t.id === d.team_id)?.name?.toLowerCase().includes("engineer")).length;
    const salesCount = docs.filter((d) => d.team_id && teams.find((t) => t.id === d.team_id)?.name?.toLowerCase().includes("sales")).length;
    return [
      { id: "all", label: isZh ? "全部" : "All", count: allCount },
      { id: "org-wide", label: isZh ? "全體" : "Org-Wide", count: orgWideCount },
      { id: "admin", label: isZh ? "管理" : "Admin", count: adminCount },
      { id: "engineering", label: isZh ? "工程" : "Engineering", count: engineeringCount },
      { id: "sales", label: isZh ? "業務" : "Sales", count: salesCount },
    ];
  }, [docs, teams, isZh]);

  const modeDescription = useMemo(() => {
    switch (searchMode) {
      case "hybrid":
        return isZh ? "結合關鍵字與 AI 語意，獲得最佳結果" : "Combines keyword matching + AI meaning for the best results";
      case "semantic":
        return isZh ? "AI 透過語意尋找文件" : `AI finds documents by meaning — "keeping clients happy" finds "customer retention" docs`;
      case "keyword":
        return isZh ? "在標題與內容中尋找完全匹配" : "Finds exact text matches in document titles and content";
      default:
        return "";
    }
  }, [searchMode, isZh]);

  const searchPlaceholder = useMemo(() => {
    switch (searchMode) {
      case "hybrid":
        return isZh ? "關鍵字 + 語意搜尋..." : "Search by keyword + meaning...";
      case "semantic":
        return isZh ? "語意搜尋... 例如：如何處理加班" : "Search by meaning... e.g. 'how to handle overtime'";
      case "keyword":
        return isZh ? "精確關鍵字搜尋..." : "Search by exact keyword...";
      default:
        return isZh ? "搜尋文件..." : "Search documents...";
    }
  }, [searchMode, isZh]);

  const handleDeleteDoc = useCallback(async (docId: string) => {
    if (!confirm(isZh ? "確定刪除？" : "Delete this document?")) return;
    try {
      await fetch(`/api/documents/${encodeURIComponent(docId)}`, { method: "DELETE" });
      fetchData();
    } catch {
      // toast error
    }
  }, [isZh, fetchData]);

  const handleMoveDoc = useCallback((docId: string) => {
    setMoveDocId(docId);
  }, []);

  const handleClearFilters = useCallback(() => {
    setFolderFilter(null);
    setSearchQuery("");
    setTeamFilter("all");
    setIsAdvancedSearchActive(false);
    setSearchResults([]);
  }, []);

  if (loading) {
    return (
      <div className="mx-auto max-w-5xl px-4 py-6 sm:px-6 sm:py-8">
        <LibrarySkeleton />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-6 sm:px-6 sm:py-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-900">
            {isZh ? "知識庫" : "Knowledge Library"}
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            {isZh ? "您公司的單一真相來源" : "Your company's single source of truth"}
          </p>
        </div>
        {isAdmin && (
          <QuickCreate onCreateFolder={() => setShowCreateFolder(true)} isAdmin={isAdmin} />
        )}
      </div>

      <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4">
        <StatCard
          label={isZh ? "近 7 日上傳" : "Recent uploads (7d)"}
          value={recentUploads}
          icon={Clock}
          color="blue"
        />
        <StatCard
          label={isZh ? "待審閱文件" : "Docs needing review"}
          value={docsNeedingReview}
          icon={AlertCircle}
          color="danger"
          pulse={docsNeedingReview > 0}
        />
        <StatCard
          label={isZh ? "逾期審閱" : "Overdue reviews"}
          value={overdueReviews}
          icon={AlertCircle}
          color="danger"
          pulse={overdueReviews > 0}
        />
      </div>

      <div className="mt-6 space-y-3">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && searchMode !== "browse") {
                  handleAdvancedSearch();
                }
              }}
              placeholder={searchPlaceholder}
              className="h-11 rounded-xl border-slate-200 pl-10 pr-10 text-sm shadow-sm transition-colors focus-visible:border-purple-300 focus-visible:ring-purple-200"
            />
            {searchQuery && (
              <button
                onClick={() => {
                  setSearchQuery("");
                  setIsAdvancedSearchActive(false);
                  setSearchResults([]);
                }}
                className="absolute right-3 top-1/2 -translate-y-1/2 rounded-md p-1 text-slate-400 hover:text-slate-600"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>
          <SearchModeControl
            searchMode={searchMode}
            setSearchMode={setSearchMode}
            setIsAdvancedSearchActive={setIsAdvancedSearchActive}
            setSearchResults={setSearchResults}
            isZh={isZh}
          />
          {searchMode !== "browse" && (
            <Button
              onClick={handleAdvancedSearch}
              disabled={searchLoading || !searchQuery.trim()}
              className="h-11 shrink-0 bg-purple-600 px-5 hover:bg-purple-700"
            >
              {searchLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : isZh ? "搜尋" : "Search"}
            </Button>
          )}
        </div>

        {searchMode !== "browse" && (
          <p className="text-xs text-slate-400 pl-1">{modeDescription}</p>
        )}

        {searchMode !== "browse" && (
          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={() => setShowAdvancedFilters((s) => !s)}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors",
                showAdvancedFilters ? "bg-purple-50 text-purple-700 border border-purple-200" : "text-slate-500 hover:bg-slate-100 border border-transparent"
              )}
            >
              <Filter className="h-3.5 w-3.5" />
              {isZh ? "進階篩選" : "Advanced Filters"}
              <ChevronDown className={cn("h-3 w-3 transition-transform", showAdvancedFilters && "rotate-180")} />
            </button>
            {showAdvancedFilters && (
              <div className="flex flex-wrap items-center gap-2">
                <Input
                  value={filterDocType}
                  onChange={(e) => setFilterDocType(e.target.value)}
                  placeholder={isZh ? "文件類型" : "Doc Type"}
                  className="h-8 w-32 text-xs"
                />
                <Input
                  value={filterDomain}
                  onChange={(e) => setFilterDomain(e.target.value)}
                  placeholder={isZh ? "領域" : "Domain"}
                  className="h-8 w-32 text-xs"
                />
                <Input
                  value={filterTag}
                  onChange={(e) => setFilterTag(e.target.value)}
                  placeholder={isZh ? "標籤" : "Tag"}
                  className="h-8 w-32 text-xs"
                />
                {facets?.top_tags && facets.top_tags.length > 0 && (
                  <div className="flex flex-wrap gap-1">
                    {facets.top_tags.slice(0, 6).map((t) => (
                      <button
                        key={t}
                        onClick={() => setFilterTag(t)}
                        className={cn(
                          "rounded-full px-2 py-0.5 text-[10px] font-medium transition-colors",
                          filterTag === t
                            ? "bg-purple-100 text-purple-700 border border-purple-200"
                            : "bg-slate-100 text-slate-600 border border-slate-200 hover:bg-slate-200"
                        )}
                      >
                        {t}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {searchErr && (
          <div className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-4 py-2.5 text-sm text-red-700">
            <AlertCircle className="h-4 w-4 shrink-0" />
            {searchErr}
          </div>
        )}

        {searchMode === "browse" && (
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-medium text-slate-500">{isZh ? "篩選：" : "Filter:"}</span>
            {filterOptions.map((filter) => (
              <button
                key={filter.id}
                onClick={() => setTeamFilter(filter.id)}
                className={cn(
                  "inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-medium transition-colors",
                  teamFilter === filter.id
                    ? "bg-purple-600 text-white border border-purple-600"
                    : "bg-white text-slate-600 border border-slate-200 hover:border-slate-300 hover:bg-slate-50"
                )}
              >
                {filter.label}
                <span className={cn("tabular-nums", teamFilter === filter.id ? "text-purple-200" : "text-slate-400")}>
                  {filter.count}
                </span>
              </button>
            ))}
          </div>
        )}
      </div>

      {isAdvancedSearchActive && searchMode !== "browse" && (
        <div className="mt-6 space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold tracking-tight text-slate-900">
              {isZh ? "搜尋結果" : "Search Results"}
            </h2>
            <button
              onClick={() => {
                setIsAdvancedSearchActive(false);
                setSearchResults([]);
                setSearchQuery("");
              }}
              className="inline-flex items-center gap-1 text-xs font-medium text-slate-500 hover:text-slate-700"
            >
              <X className="h-3.5 w-3.5" />
              {isZh ? "清除搜尋" : "Clear search"}
            </button>
          </div>

          {searchLoading && (
            <div className="flex items-center gap-2 py-4 text-sm text-slate-500">
              <Loader2 className="h-4 w-4 animate-spin" />
              {searchMode === "hybrid" ? (isZh ? "⚡ 執行混合搜尋..." : "⚡ Running hybrid search...")
                : searchMode === "semantic" ? (isZh ? "🧠 AI 搜尋中..." : "🧠 AI searching...")
                : (isZh ? "搜尋中..." : "Searching...")}
            </div>
          )}

          {!searchLoading && searchResults.length === 0 && searchQuery && (
            <EmptyState
              isAdmin={isAdmin}
              folderFilter={folderFilter}
              searchQuery={searchQuery}
              teamFilter={teamFilter}
              isZh={isZh}
              onClear={handleClearFilters}
            />
          )}

          <div className="space-y-2">
            {searchResults.map((result) => (
              <SearchResultRow
                key={result.doc_id}
                result={result}
                isAdmin={isAdmin}
                isZh={isZh}
                onDelete={handleDeleteDoc}
                onMove={handleMoveDoc}
              />
            ))}
          </div>
        </div>
      )}

      {folderFilter && currentFolder && (
        <div className="mt-6 flex items-center gap-2 text-sm">
          <button
            onClick={() => setFolderFilter(null)}
            className="font-medium text-slate-500 hover:text-purple-700 transition-colors"
          >
            {isZh ? "全部文件" : "All Documents"}
          </button>
          <ChevronRight className="h-4 w-4 text-slate-300" />
          <span className="text-lg">{currentFolder.icon}</span>
          <span className="font-semibold text-slate-900">{currentFolder.name}</span>
          {isAdmin && (
            <Button
              variant="ghost"
              size="sm"
              className="ml-2 h-7 text-xs text-purple-600 hover:bg-purple-50 hover:text-purple-700"
              onClick={() => setShowCreateFolder(true)}
            >
              <Plus className="mr-1 h-3 w-3" />
              {isZh ? "子資料夾" : "Subfolder"}
            </Button>
          )}
        </div>
      )}

      {!loading && !err && folders.length > 0 && !folderFilter && searchMode === "browse" && !searchQuery && (
        <div className="mt-6">
          <h2 className="text-lg font-semibold tracking-tight text-slate-900 mb-3">
            {isZh ? "資料夾" : "Folders"}
          </h2>
          <div className="flex gap-2 overflow-x-auto pb-2 snap-x">
            {folders.map((f) => {
              const docCount = f.documents?.[0]?.count ?? docs.filter((d) => d.folder_id === f.id).length;
              return (
                <button
                  key={f.id}
                  onClick={() => setFolderFilter(f.id)}
                  className={cn(
                    "flex shrink-0 snap-start items-center gap-2.5 rounded-xl border px-4 py-2.5 text-left transition-all duration-200",
                    "hover:border-slate-300 hover:shadow-sm hover:bg-slate-50",
                    folderFilter === f.id
                      ? "border-purple-300 bg-purple-50 ring-1 ring-purple-200"
                      : "border-slate-200 bg-white"
                  )}
                >
                  <span className="text-xl">{f.icon}</span>
                  <div>
                    <div className="text-sm font-medium text-slate-900">{f.name}</div>
                    <div className="text-[11px] text-slate-500">
                      {docCount} {isZh ? "份文件" : `doc${docCount !== 1 ? "s" : ""}`}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {(searchMode === "browse" || !isAdvancedSearchActive) && (
        <div className="mt-6 space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold tracking-tight text-slate-900">
              {folderFilter && currentFolder
                ? currentFolder.name
                : isZh ? "文件" : "Documents"}
              {teamFilter !== "all" && teamFilter !== "org-wide" && teams.find((t) => t.id === teamFilter) && (
                <span className="ml-2 text-sm font-normal text-slate-500">
                  — {teams.find((t) => t.id === teamFilter)?.name}
                </span>
              )}
              {teamFilter === "org-wide" && (
                <span className="ml-2 text-sm font-normal text-slate-500">
                  — {isZh ? "全體成員" : "Organization-Wide"}
                </span>
              )}
            </h2>
            {filteredDocs.length > 0 && (
              <span className="text-xs font-medium text-slate-400">
                {filteredDocs.length} {isZh ? "份" : "docs"}
              </span>
            )}
          </div>

          {err && (
            <div className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              <AlertCircle className="h-4 w-4 shrink-0" />
              {isZh ? "錯誤：" : "Error: "}{err}
            </div>
          )}

          {!err && (
            <>
              {filteredDocs.length > 0 ? (
                <div className="space-y-2">
                  {filteredDocs.map((doc) => (
                    <BrowseRow
                      key={doc.doc_id}
                      doc={doc}
                      folders={folders}
                      isAdmin={isAdmin}
                      isZh={isZh}
                      onDelete={handleDeleteDoc}
                      onMove={handleMoveDoc}
                    />
                  ))}
                </div>
              ) : (
                <EmptyState
                  isAdmin={isAdmin}
                  folderFilter={folderFilter}
                  searchQuery={searchQuery}
                  teamFilter={teamFilter}
                  isZh={isZh}
                  onClear={handleClearFilters}
                />
              )}
            </>
          )}
        </div>
      )}

      <CreateFolderModal
        open={showCreateFolder}
        onClose={() => setShowCreateFolder(false)}
        onCreated={fetchData}
        isZh={isZh}
      />
      {moveDocId && (
        <MoveToFolderModal
          docId={moveDocId}
          folders={folders}
          docs={docs}
          open={!!moveDocId}
          onClose={() => setMoveDocId(null)}
          onMoved={fetchData}
          isZh={isZh}
        />
      )}
    </div>
  );
}