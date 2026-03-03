"use client";

import QuickCreate from "@/components/QuickCreate";
import Link from "next/link";
import { useEffect, useState, Suspense, useCallback } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import ProtectedRoute from "@/components/ProtectedRoute";
import { 
  FolderKanban, 
  FileText, 
  File, 
  Link as LinkIcon, 
  Youtube, 
  ClipboardList, 
  Bot,
  ChevronRight,
  Search,
  Filter,
  Globe,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Edit3,
  Trash2,
  Plus,
  ArrowLeft,
  Zap,
  Type,
  Brain,
  X,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

type Team = {
  id: string;
  name: string;
  color: string;
};

type Folder = {
  id: string;
  name: string;
  color: string;
  icon: string;
  parent_folder_id: string | null;
  team_id: string | null;
  documents: { count: number }[] | null;
};

type DocRow = {
  doc_id: string;
  title: string;
  current_version: string;
  status: string;
  doc_type: string | null;
  domain: string | null;
  tags: string[] | null;
  file_url?: string | null;
  team_id?: string | null;
  folder_id?: string | null;
  doc_source?: string | null;
  teams?: Team | null;
  updated_at?: string;
  feedback_counts: {
    helped: number;
    not_confident: number;
    didnt_help: number;
  };
};

type Facets = {
  doc_types: string[];
  domains: string[];
  ai_maturity_stages: string[];
  statuses: string[];
  top_tags: { tag: string; count: number }[];
};

type SearchResult = {
  doc_id: string;
  title: string;
  version: string;
  doc_type: string | null;
  domain: string | null;
  ai_maturity_stage: string | null;
  tags: string[];
  status: string | null;
  source_url: string | null;
  score: number;
  snippet: string;
  section_title?: string;
  section_path?: string;
  why_matched?: string[];
  search_mode?: string;
};

// ── Folder Creation Modal ──
function CreateFolderModal({
  open,
  onClose,
  onCreated,
}: {
  open: boolean;
  onClose: () => void;
  onCreated: () => void;
}) {
  const [name, setName] = useState("");
  const [color, setColor] = useState("#7C3AED");
  const [icon, setIcon] = useState("📁");
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState("");

  const colors = ["#7C3AED", "#2563EB", "#059669", "#D97706", "#DC2626", "#EC4899", "#6B7280"];
  const icons = ["📁", "📂", "📋", "📌", "🗂️", "💼", "🎯", "📚", "🔬", "💡"];

  const handleCreate = async () => {
    if (!name.trim()) return;
    setCreating(true);
    setError("");
    try {
      const res = await fetch("/api/folders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim(), color, icon }),
      });
      const data = await res.json();
      if (res.ok) {
        setName("");
        setColor("#7C3AED");
        setIcon("📁");
        onClose();
        onCreated();
      } else {
        setError(data.error || "Failed to create folder");
      }
    } catch {
      setError("Failed to create folder");
    } finally {
      setCreating(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>New Folder</DialogTitle>
        </DialogHeader>
        
        {error && (
          <div className="p-3 bg-red-50 text-red-700 rounded-lg text-sm">
            {error}
          </div>
        )}

        <div className="space-y-4">
          <div>
            <label className="text-sm font-medium text-slate-700 block mb-2">
              Folder Name
            </label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g., Onboarding Docs"
              onKeyDown={(e) => { if (e.key === "Enter") handleCreate(); }}
            />
          </div>

          <div>
            <label className="text-sm font-medium text-slate-700 block mb-2">
              Icon
            </label>
            <div className="flex gap-2 flex-wrap">
              {icons.map((ic) => (
                <button
                  key={ic}
                  type="button"
                  onClick={() => setIcon(ic)}
                  className={cn(
                    "w-10 h-10 rounded-lg border text-xl flex items-center justify-center transition-all",
                    icon === ic 
                      ? "border-violet-500 bg-violet-50" 
                      : "border-slate-200 hover:border-slate-300"
                  )}
                >
                  {ic}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="text-sm font-medium text-slate-700 block mb-2">
              Color
            </label>
            <div className="flex gap-2">
              {colors.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setColor(c)}
                  className={cn(
                    "w-8 h-8 rounded-full transition-all",
                    color === c ? "ring-2 ring-offset-2 ring-slate-900" : ""
                  )}
                  style={{ background: c }}
                />
              ))}
            </div>
          </div>
        </div>

        <div className="flex justify-end gap-3 mt-6">
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button 
            onClick={handleCreate} 
            disabled={!name.trim() || creating}
            className="bg-violet-600 hover:bg-violet-700"
          >
            {creating ? "Creating..." : "Create Folder"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ── Move to Folder Modal ──
function MoveToFolderModal({
  open,
  docId,
  folders,
  onClose,
  onMoved,
}: {
  open: boolean;
  docId: string;
  folders: Folder[];
  onClose: () => void;
  onMoved: () => void;
}) {
  const [moving, setMoving] = useState(false);

  const handleMove = async (folderId: string | null) => {
    setMoving(true);
    try {
      const res = await fetch(`/api/documents/${encodeURIComponent(docId)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ folderId }),
      });
      if (res.ok) {
        onClose();
        onMoved();
      }
    } catch {} finally {
      setMoving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Move to Folder</DialogTitle>
        </DialogHeader>
        
        <div className="space-y-2 max-h-72 overflow-y-auto">
          <button
            onClick={() => handleMove(null)}
            disabled={moving}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg border border-slate-200 hover:bg-slate-50 transition-colors text-left"
          >
            <Globe className="w-4 h-4 text-slate-400" />
            <span>Unfiled (root)</span>
          </button>

          {folders.map((f) => (
            <button
              key={f.id}
              onClick={() => handleMove(f.id)}
              disabled={moving}
              className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg border border-slate-200 hover:bg-slate-50 transition-colors text-left"
            >
              <span>{f.icon}</span>
              <span className="font-medium">{f.name}</span>
            </button>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ── Document Card Component ──
function DocumentCard({ 
  doc, 
  folders, 
  isAdmin, 
  onMove 
}: { 
  doc: DocRow; 
  folders: Folder[]; 
  isAdmin: boolean;
  onMove: (id: string) => void;
}) {
  const [hovered, setHovered] = useState(false);

  const getDocIcon = () => {
    const iconClass = "w-4 h-4";
    switch (doc.doc_source) {
      case "note": return <FileText className={cn(iconClass, "text-emerald-600")} />;
      case "url": return <LinkIcon className={cn(iconClass, "text-blue-600")} />;
      case "youtube": return <Youtube className={cn(iconClass, "text-red-600")} />;
      case "template": return <ClipboardList className={cn(iconClass, "text-pink-600")} />;
      case "ai-agent": return <Bot className={cn(iconClass, "text-violet-600")} />;
      default:
        if (doc.file_url) {
          const ext = doc.doc_type?.toLowerCase() || "";
          if (ext === "pdf" || doc.file_url?.includes(".pdf")) return <File className={cn(iconClass, "text-red-500")} />;
        }
        return <FileText className={cn(iconClass, "text-violet-600")} />;
    }
  };

  const getIconBg = () => {
    switch (doc.doc_source) {
      case "note": return "bg-emerald-100";
      case "url": return "bg-blue-100";
      case "youtube": return "bg-red-100";
      case "template": return "bg-pink-100";
      case "ai-agent": return "bg-violet-100";
      default: return "bg-slate-100";
    }
  };

  const formatDate = (dateStr?: string) => {
    if (!dateStr) return "";
    const date = new Date(dateStr);
    const now = new Date();
    const diffDays = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));
    if (diffDays === 0) return "Today";
    if (diffDays === 1) return "Yesterday";
    if (diffDays < 7) return `${diffDays} days ago`;
    if (diffDays < 30) return `${Math.floor(diffDays / 7)} weeks ago`;
    return date.toLocaleDateString();
  };

  const totalFeedback = doc.feedback_counts.helped + doc.feedback_counts.not_confident + doc.feedback_counts.didnt_help;

  return (
    <div
      className="group bg-white border border-slate-200 rounded-xl p-4 hover:border-violet-300 hover:shadow-sm transition-all duration-200"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <div className="flex items-start gap-4">
        <div className={cn("w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0", getIconBg())}>
          {getDocIcon()}
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <h3 className="font-medium text-slate-900 truncate">{doc.title}</h3>
            </div>
            
            <div className={cn(
              "flex items-center gap-2 transition-opacity duration-200",
              hovered ? "opacity-100" : "opacity-0"
            )}>
              {isAdmin && folders.length > 0 && (
                <Button 
                  variant="ghost" 
                  size="sm" 
                  className="h-8 text-slate-600"
                  onClick={() => onMove(doc.doc_id)}
                >
                  <FolderKanban className="w-4 h-4" />
                </Button>
              )}
              {isAdmin && (
                <Link href={`/library/${encodeURIComponent(doc.doc_id)}/edit`}>
                  <Button variant="ghost" size="sm" className="h-8 text-slate-600">
                    <Edit3 className="w-4 h-4" />
                  </Button>
                </Link>
              )}
              <Link href={`/library/${encodeURIComponent(doc.doc_id)}`}>
                <Button size="sm" className="h-8 bg-violet-600 hover:bg-violet-700 text-white gap-1">
                  View
                  <ChevronRight className="w-4 h-4" />
                </Button>
              </Link>
            </div>
          </div>

          <div className="flex items-center gap-2 mt-2 flex-wrap">
            <span className="text-xs text-slate-400 font-mono">{doc.doc_id}</span>
            <span className="text-xs text-slate-400">{doc.current_version}</span>
            <Badge className="bg-emerald-50 text-emerald-600 hover:bg-emerald-50 border-0 text-xs font-normal">
              {doc.status}
            </Badge>
            {doc.doc_type && (
              <Badge variant="secondary" className="bg-slate-100 text-slate-600 font-normal text-xs">
                {doc.doc_type}
              </Badge>
            )}
            {doc.teams ? (
              <Badge 
                className="font-normal text-xs border-0"
                style={{ background: doc.teams.color + "20", color: doc.teams.color }}
              >
                {doc.teams.name}
              </Badge>
            ) : (
              <Badge variant="secondary" className="bg-slate-100 text-slate-600 font-normal text-xs">
                <Globe className="w-3 h-3 mr-1" />
                Org-Wide
              </Badge>
            )}
            {doc.folder_id && (
              <Badge className="bg-amber-50 text-amber-600 border-0 text-xs font-normal">
                {folders.find(f => f.id === doc.folder_id)?.icon || "📁"}
                {folders.find(f => f.id === doc.folder_id)?.name}
              </Badge>
            )}
            
            {totalFeedback > 0 && (
              <div className="flex items-center gap-2 ml-auto text-xs">
                {doc.feedback_counts.helped > 0 && (
                  <span className="flex items-center gap-1 text-emerald-600">
                    <CheckCircle2 className="w-3 h-3" />
                    {doc.feedback_counts.helped}
                  </span>
                )}
                {doc.feedback_counts.not_confident > 0 && (
                  <span className="flex items-center gap-1 text-amber-600">
                    <AlertTriangle className="w-3 h-3" />
                    {doc.feedback_counts.not_confident}
                  </span>
                )}
                {doc.feedback_counts.didnt_help > 0 && (
                  <span className="flex items-center gap-1 text-red-600">
                    <XCircle className="w-3 h-3" />
                    {doc.feedback_counts.didnt_help}
                  </span>
                )}
              </div>
            )}
            
            {doc.updated_at && (
              <span className="text-xs text-slate-400 ml-auto">{formatDate(doc.updated_at)}</span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Search Result Card (for advanced search results) ──
function SearchResultCard({ result, onNavigate }: { result: SearchResult; onNavigate: (docId: string) => void }) {
  return (
    <div className="bg-white border border-slate-200 rounded-xl p-4 hover:border-blue-300 hover:shadow-sm transition-all duration-200">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <h3 className="font-medium text-slate-900">{result.title}</h3>
          <div className="flex items-center gap-2 mt-2 flex-wrap">
            <span className="text-xs text-slate-400 font-mono">{result.doc_id}</span>
            <span className="text-xs text-slate-400">{result.version}</span>
            {result.doc_type && (
              <Badge variant="secondary" className="bg-slate-100 text-slate-600 font-normal text-xs">
                {result.doc_type}
              </Badge>
            )}
            {result.domain && (
              <Badge variant="secondary" className="bg-slate-100 text-slate-600 font-normal text-xs">
                {result.domain}
              </Badge>
            )}
            {(result.search_mode === "semantic" || result.search_mode === "hybrid") && result.score > 0 && (
              <Badge className={cn(
                "border-0 text-xs font-semibold",
                result.score >= 60 
                  ? "bg-violet-100 text-violet-700" 
                  : result.score >= 40 
                    ? "bg-blue-50 text-blue-600" 
                    : "bg-slate-100 text-slate-600"
              )}>
                {result.search_mode === "hybrid" ? "⚡" : "🧠"} {result.score}% match
              </Badge>
            )}
          </div>
        </div>
        <Button 
          size="sm" 
          className="h-8 bg-violet-600 hover:bg-violet-700 text-white gap-1"
          onClick={() => onNavigate(result.doc_id)}
        >
          View <ChevronRight className="w-4 h-4" />
        </Button>
      </div>

      {result.why_matched && result.why_matched.length > 0 && (
        <p className="text-xs text-violet-600 mt-2">
          {result.search_mode === "hybrid" ? "⚡ " : "🧠 "}
          Why matched: {result.why_matched.slice(0, 4).join(" · ")}
        </p>
      )}

      {result.section_title && (
        <p className="text-xs text-slate-500 mt-1">
          Match in: <strong>{result.section_title}</strong>
        </p>
      )}

      {result.snippet && (
        <div className="mt-3 p-3 bg-slate-50 rounded-lg text-sm text-slate-600 leading-relaxed">
          {result.snippet}
        </div>
      )}
    </div>
  );
}

// ── Main Library Content ──
function LibraryContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const teamFilter = searchParams.get("team") || "all";
  const folderFilter = searchParams.get("folder") || null;

  const [docs, setDocs] = useState<DocRow[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);
  const [folders, setFolders] = useState<Folder[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [showCreateFolder, setShowCreateFolder] = useState(false);
  const [moveDocId, setMoveDocId] = useState<string | null>(null);

  // ── Search state ──
  const [searchQuery, setSearchQuery] = useState("");
  const [searchMode, setSearchMode] = useState<"browse" | "keyword" | "semantic" | "hybrid">("browse");
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchErr, setSearchErr] = useState("");
  const [facets, setFacets] = useState<Facets | null>(null);
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);
  const [filterDocType, setFilterDocType] = useState("");
  const [filterDomain, setFilterDomain] = useState("");
  const [filterTag, setFilterTag] = useState("");

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);

      const url = teamFilter && teamFilter !== "all"
        ? `/api/learning-summary?team=${teamFilter}`
        : "/api/learning-summary";

      const [docRes, folderRes, profileRes, facetRes] = await Promise.all([
        fetch(url),
        fetch("/api/folders"),
        fetch("/api/profile"),
        fetch("/api/facets"),
      ]);

      const docData = await docRes.json();
      const folderData = await folderRes.json();
      const profileData = await profileRes.json();

      if (!docRes.ok) throw new Error(docData?.error ?? "Failed to load");

      setDocs(docData.documents ?? []);
      setTeams(docData.teams ?? []);
      setFolders(folderData.folders ?? []);

      if (profileRes.ok && profileData.role) {
        setIsAdmin(["owner", "admin"].includes(profileData.role));
      }

      if (facetRes.ok) {
        const facetData = await facetRes.json();
        setFacets(facetData);
      }
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : "Error");
    } finally {
      setLoading(false);
    }
  }, [teamFilter]);

  useEffect(() => { fetchData(); }, [fetchData]);

  // ── Advanced search handler ──
  const handleAdvancedSearch = async () => {
    if (!searchQuery.trim()) return;
    setSearchLoading(true);
    setSearchErr("");
    setSearchResults([]);

    try {
      const params = new URLSearchParams();
      params.set("q", searchQuery.trim());
      params.set("mode", searchMode === "browse" ? "hybrid" : searchMode);
      if (filterDocType) params.set("doc_type", filterDocType);
      if (filterDomain) params.set("domain", filterDomain);
      if (filterTag) params.set("tag", filterTag);

      const res = await fetch("/api/search?" + params.toString());
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Search failed");
      setSearchResults(data.results || []);
    } catch (e: any) {
      setSearchErr(e?.message || "Search failed");
    } finally {
      setSearchLoading(false);
    }
  };

  const clearSearch = () => {
    setSearchQuery("");
    setSearchResults([]);
    setSearchErr("");
    setSearchMode("browse");
    setFilterDocType("");
    setFilterDomain("");
    setFilterTag("");
    setShowAdvancedFilters(false);
  };

  const isAdvancedSearchActive = searchMode !== "browse" || searchResults.length > 0;

  const totalFeedback = docs.reduce(
    (sum, d) =>
      sum + d.feedback_counts.helped + d.feedback_counts.not_confident + d.feedback_counts.didnt_help,
    0
  );

  // Filter docs by folder and basic search (browse mode)
  const filteredDocs = docs
    .filter(d => !folderFilter || d.folder_id === folderFilter)
    .filter(d => {
      if (searchMode !== "browse" || !searchQuery) return true;
      const q = searchQuery.toLowerCase();
      return d.title.toLowerCase().includes(q) || 
        d.doc_id.toLowerCase().includes(q) ||
        (d.tags || []).some(t => t.toLowerCase().includes(q));
    });

  const currentFolder = folders.find((f) => f.id === folderFilter);

  const handleDeleteFolder = async (folderId: string) => {
    if (!confirm("Delete this folder? Documents inside will be moved to unfiled.")) return;
    try {
      await fetch(`/api/folders?id=${folderId}`, { method: "DELETE" });
      router.push("/library");
      fetchData();
    } catch {}
  };

  const handleNavigateToDoc = (docId: string) => {
    router.push(`/library/${encodeURIComponent(docId)}`);
  };

  const filterOptions = [
    { label: "All", value: "all", count: docs.length },
    { label: "Org-Wide", value: "org-wide", count: docs.filter(d => !d.team_id).length },
    ...teams.map(t => ({
      label: t.name,
      value: t.id,
      count: docs.filter(d => d.team_id === t.id).length,
      color: t.color
    }))
  ];

  const activeAdvancedFilterCount = [filterDocType, filterDomain, filterTag].filter(Boolean).length;

  return (
    <div className="p-6 lg:p-8 max-w-6xl mx-auto">
      {/* Header */}
      <header className="mb-8">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-2xl font-semibold text-slate-900">Knowledge Library</h1>
            <p className="text-sm text-slate-500 mt-1">
              Your company&apos;s single source of truth
            </p>
          </div>
          {isAdmin && (
            <QuickCreate onCreateFolder={() => setShowCreateFolder(true)} isAdmin={isAdmin} />
          )}
        </div>

        {/* Stats Row */}
        {!loading && !err && (
          <div className="flex items-center gap-8 mt-6 flex-wrap">
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-semibold text-slate-900">{docs.length}</span>
              <span className="text-sm text-slate-500">Documents</span>
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-semibold text-blue-600">{totalFeedback}</span>
              <span className="text-sm text-slate-500">Feedback</span>
            </div>
            {folders.length > 0 && (
              <div className="flex items-baseline gap-2">
                <span className="text-2xl font-semibold text-amber-500">{folders.length}</span>
                <span className="text-sm text-slate-500">Folders</span>
              </div>
            )}
            {teams.length > 0 && (
              <div className="flex items-baseline gap-2">
                <span className="text-2xl font-semibold text-violet-500">{teams.length}</span>
                <span className="text-sm text-slate-500">Groups</span>
              </div>
            )}
          </div>
        )}
      </header>

      {/* ═══ SEARCH BAR WITH MODES ═══ */}
      {!loading && !err && (
        <div className="mb-6 space-y-3">
          {/* Search input row */}
          <div className="flex gap-3 items-center">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <Input
                placeholder={
                  searchMode === "semantic" 
                    ? "Search by meaning... e.g. 'how to handle overtime'" 
                    : searchMode === "hybrid"
                    ? "Search by keyword + meaning..."
                    : searchMode === "keyword"
                    ? "Search by exact keyword..."
                    : "Search documents..."
                }
                className="pl-10 pr-10"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    if (searchMode === "browse") {
                      // Basic title filter — no API call needed
                    } else {
                      handleAdvancedSearch();
                    }
                  }
                }}
              />
              {searchQuery && (
                <button 
                  onClick={clearSearch}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>

            {/* Search mode toggle */}
            <div className="flex rounded-lg border border-slate-200 overflow-hidden flex-shrink-0">
              <button
                onClick={() => { setSearchMode("browse"); setSearchResults([]); }}
                className={cn(
                  "px-3 py-2 text-xs font-medium transition-all flex items-center gap-1.5",
                  searchMode === "browse" 
                    ? "bg-slate-900 text-white" 
                    : "bg-white text-slate-600 hover:bg-slate-50"
                )}
              >
                <FileText className="w-3.5 h-3.5" />
                Browse
              </button>
              <button
                onClick={() => setSearchMode("hybrid")}
                className={cn(
                  "px-3 py-2 text-xs font-medium transition-all border-l border-slate-200 flex items-center gap-1.5",
                  searchMode === "hybrid" 
                    ? "bg-violet-600 text-white" 
                    : "bg-white text-slate-600 hover:bg-slate-50"
                )}
              >
                <Zap className="w-3.5 h-3.5" />
                Hybrid
              </button>
              <button
                onClick={() => setSearchMode("keyword")}
                className={cn(
                  "px-3 py-2 text-xs font-medium transition-all border-l border-slate-200 flex items-center gap-1.5",
                  searchMode === "keyword" 
                    ? "bg-blue-600 text-white" 
                    : "bg-white text-slate-600 hover:bg-slate-50"
                )}
              >
                <Type className="w-3.5 h-3.5" />
                Keyword
              </button>
              <button
                onClick={() => setSearchMode("semantic")}
                className={cn(
                  "px-3 py-2 text-xs font-medium transition-all border-l border-slate-200 flex items-center gap-1.5",
                  searchMode === "semantic" 
                    ? "bg-purple-600 text-white" 
                    : "bg-white text-slate-600 hover:bg-slate-50"
                )}
              >
                <Brain className="w-3.5 h-3.5" />
                Semantic
              </button>
            </div>

            {/* Search button (for AI modes) */}
            {searchMode !== "browse" && (
              <Button 
                onClick={handleAdvancedSearch}
                disabled={searchLoading || !searchQuery.trim()}
                className="bg-violet-600 hover:bg-violet-700 gap-2 flex-shrink-0"
              >
                {searchLoading ? "Searching..." : "Search"}
              </Button>
            )}
          </div>

          {/* Advanced filters toggle (only for non-browse modes) */}
          {searchMode !== "browse" && (
            <div>
              <button
                onClick={() => setShowAdvancedFilters(!showAdvancedFilters)}
                className="text-xs text-slate-500 hover:text-slate-700 flex items-center gap-1"
              >
                <Filter className="w-3.5 h-3.5" />
                Advanced Filters
                {activeAdvancedFilterCount > 0 && (
                  <Badge className="bg-violet-100 text-violet-700 border-0 text-xs ml-1">
                    {activeAdvancedFilterCount}
                  </Badge>
                )}
                {showAdvancedFilters ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
              </button>

              {showAdvancedFilters && (
                <div className="flex gap-3 mt-3 flex-wrap">
                  <div>
                    <label className="text-xs text-slate-500 block mb-1">Doc Type</label>
                    <select
                      value={filterDocType}
                      onChange={(e) => setFilterDocType(e.target.value)}
                      className="text-sm border border-slate-200 rounded-lg px-3 py-1.5 bg-white text-slate-700"
                    >
                      <option value="">All types</option>
                      {(facets?.doc_types ?? []).map((v) => (
                        <option key={v} value={v}>{v}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="text-xs text-slate-500 block mb-1">Domain</label>
                    <select
                      value={filterDomain}
                      onChange={(e) => setFilterDomain(e.target.value)}
                      className="text-sm border border-slate-200 rounded-lg px-3 py-1.5 bg-white text-slate-700"
                    >
                      <option value="">All domains</option>
                      {(facets?.domains ?? []).map((v) => (
                        <option key={v} value={v}>{v}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="text-xs text-slate-500 block mb-1">Tag</label>
                    <Input
                      value={filterTag}
                      onChange={(e) => setFilterTag(e.target.value)}
                      placeholder="e.g., compliance"
                      className="h-8 w-40 text-sm"
                    />
                  </div>
                  {facets?.top_tags && facets.top_tags.length > 0 && (
                    <div className="flex items-end gap-1.5 flex-wrap">
                      {facets.top_tags.slice(0, 6).map((t) => (
                        <button
                          key={t.tag}
                          onClick={() => setFilterTag(t.tag)}
                          className={cn(
                            "px-2.5 py-1 rounded-full text-xs border transition-all",
                            filterTag === t.tag
                              ? "bg-violet-100 border-violet-300 text-violet-700"
                              : "bg-white border-slate-200 text-slate-600 hover:border-slate-300"
                          )}
                        >
                          {t.tag}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Search mode description */}
          {searchMode !== "browse" && (
            <p className="text-xs text-slate-400">
              {searchMode === "hybrid" 
                ? "Combines keyword matching + AI meaning for the best results" 
                : searchMode === "semantic"
                ? "AI finds documents by meaning — \"keeping clients happy\" finds \"customer retention\" docs"
                : "Finds exact text matches in document titles and content"}
            </p>
          )}

          {/* Search error */}
          {searchErr && (
            <div className="p-3 bg-red-50 text-red-700 rounded-lg text-sm">
              {searchErr}
            </div>
          )}

          {/* Team filter pills (browse mode) */}
          {searchMode === "browse" && (
            <div className="flex items-center gap-2 flex-wrap">
              <Filter className="w-4 h-4 text-slate-400" />
              <span className="text-sm text-slate-500">Filter:</span>
              {filterOptions.map((filter) => (
                <Link
                  key={filter.value}
                  href={filter.value === "all" ? "/library" : `/library?team=${filter.value}`}
                  className={cn(
                    "px-3 py-1.5 rounded-full text-sm transition-all duration-200",
                    teamFilter === filter.value
                      ? "bg-violet-600 text-white"
                      : "bg-white text-slate-600 hover:bg-slate-100 border border-slate-200"
                  )}
                >
                  {filter.label}
                  <span className={cn(
                    "ml-1.5 text-xs",
                    teamFilter === filter.value ? "text-violet-200" : "text-slate-400"
                  )}>
                    {filter.count}
                  </span>
                </Link>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ═══ SEARCH RESULTS (when AI search is active) ═══ */}
      {isAdvancedSearchActive && searchMode !== "browse" && (
        <section className="mb-8">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-medium text-slate-900 flex items-center gap-2">
              <Search className="w-4 h-4 text-slate-400" />
              Search Results
              {searchResults.length > 0 && (
                <Badge variant="secondary" className="text-xs">{searchResults.length}</Badge>
              )}
            </h2>
            <Button variant="ghost" size="sm" onClick={clearSearch} className="text-slate-500 gap-1">
              <X className="w-4 h-4" />
              Clear search
            </Button>
          </div>

          {searchLoading && (
            <div className="flex items-center justify-center py-12 text-slate-500">
              <span>{searchMode === "hybrid" ? "⚡ Running hybrid search..." : searchMode === "semantic" ? "🧠 AI searching..." : "Searching..."}</span>
            </div>
          )}

          {!searchLoading && searchResults.length === 0 && searchQuery && (
            <div className="text-center py-12 bg-white border border-slate-200 rounded-xl">
              <p className="text-slate-500">No results found for &ldquo;{searchQuery}&rdquo;</p>
              <p className="text-xs text-slate-400 mt-2">Try different keywords or switch search mode</p>
            </div>
          )}

          <div className="space-y-3">
            {searchResults.map((result) => (
              <SearchResultCard 
                key={result.doc_id + "-" + result.version} 
                result={result} 
                onNavigate={handleNavigateToDoc}
              />
            ))}
          </div>
        </section>
      )}

      {/* Folder Breadcrumb */}
      {folderFilter && currentFolder && (
        <div className="flex items-center gap-2 mb-6">
          <Link 
            href="/library" 
            className="text-sm text-slate-500 hover:text-slate-700 flex items-center gap-1"
          >
            <ArrowLeft className="w-4 h-4" />
            All Documents
          </Link>
          <span className="text-slate-300">/</span>
          <span className="text-sm font-medium text-slate-900 flex items-center gap-2">
            <span>{currentFolder.icon}</span>
            {currentFolder.name}
          </span>
          {isAdmin && (
            <>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => handleDeleteFolder(currentFolder.id)}
                className="text-red-600 hover:text-red-700 hover:bg-red-50 ml-2"
              >
                <Trash2 className="w-4 h-4 mr-1" />
                Delete
              </Button>
              <Link href={`/library/new?folder=${currentFolder.id}`}>
                <Button size="sm" variant="outline" className="gap-1">
                  <Plus className="w-4 h-4" />
                  Upload
                </Button>
              </Link>
            </>
          )}
        </div>
      )}

      {/* Folders Section (only in browse mode, not during search) */}
      {!loading && !err && folders.length > 0 && !folderFilter && searchMode === "browse" && !searchQuery && (
        <div className="mb-8">
          <h2 className="text-sm font-medium text-slate-900 mb-3 flex items-center gap-2">
            <FolderKanban className="w-4 h-4 text-slate-400" />
            Folders
          </h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
            {folders.map((f) => {
              const docCount = f.documents?.[0]?.count || docs.filter(d => d.folder_id === f.id).length;
              return (
                <Link
                  key={f.id}
                  href={`/library?folder=${f.id}`}
                  className="group flex flex-col p-4 bg-white border border-slate-200 rounded-xl hover:border-violet-300 hover:shadow-sm transition-all duration-200"
                  style={{ borderLeftWidth: "4px", borderLeftColor: f.color }}
                >
                  <span className="text-2xl mb-2">{f.icon}</span>
                  <span className="font-medium text-slate-900 text-sm truncate">{f.name}</span>
                  <span className="text-xs text-slate-400 mt-1">
                    {docCount} doc{docCount !== 1 ? "s" : ""}
                  </span>
                </Link>
              );
            })}
          </div>
        </div>
      )}

      {/* Documents List (browse mode) */}
      {(searchMode === "browse" || !isAdvancedSearchActive) && (
        <section>
          <h2 className="text-sm font-medium text-slate-900 mb-3 flex items-center gap-2">
            <FileText className="w-4 h-4 text-slate-400" />
            {folderFilter && currentFolder
              ? currentFolder.name
              : "Documents"}
            {teamFilter !== "all" && teamFilter !== "org-wide" && teams.find(t => t.id === teamFilter) && (
              <span className="text-slate-400 font-normal">
                — {teams.find(t => t.id === teamFilter)?.name}
              </span>
            )}
            {teamFilter === "org-wide" && (
              <span className="text-slate-400 font-normal">— Organization-Wide</span>
            )}
          </h2>

          {loading && (
            <div className="flex items-center justify-center py-12 text-slate-500">
              <span>Loading documents...</span>
            </div>
          )}

          {err && (
            <div className="p-4 bg-red-50 border border-red-200 rounded-xl text-red-700">
              Error: {err}
            </div>
          )}

          {!loading && !err && (
            <div className="space-y-3">
              {filteredDocs.map((doc) => (
                <DocumentCard
                  key={doc.doc_id}
                  doc={doc}
                  folders={folders}
                  isAdmin={isAdmin}
                  onMove={setMoveDocId}
                />
              ))}
            </div>
          )}

          {!loading && !err && filteredDocs.length === 0 && (
            <div className="text-center py-12 bg-white border border-slate-200 rounded-xl">
              <p className="text-slate-500">
                {folderFilter
                  ? "No documents in this folder yet."
                  : teamFilter !== "all"
                  ? "No documents found in this filter."
                  : searchQuery
                  ? "No documents match your search."
                  : "No documents found."}
              </p>
              {isAdmin && !folderFilter && !searchQuery && (
                <Link href="/library/new">
                  <Button className="mt-4 bg-violet-600 hover:bg-violet-700 gap-2">
                    <Plus className="w-4 h-4" />
                    Upload Documents
                  </Button>
                </Link>
              )}
              {(folderFilter || searchQuery) && (
                <Button 
                  variant="outline" 
                  className="mt-4 gap-2"
                  onClick={() => {
                    if (folderFilter) router.push("/library");
                    setSearchQuery("");
                  }}
                >
                  <ArrowLeft className="w-4 h-4" />
                  Back to All
                </Button>
              )}
            </div>
          )}
        </section>
      )}

      {/* Modals */}
      <CreateFolderModal
        open={showCreateFolder}
        onClose={() => setShowCreateFolder(false)}
        onCreated={fetchData}
      />

      {moveDocId && (
        <MoveToFolderModal
          open={!!moveDocId}
          docId={moveDocId}
          folders={folders}
          onClose={() => setMoveDocId(null)}
          onMoved={fetchData}
        />
      )}
    </div>
  );
}

function LibraryLoading() {
  return (
    <div className="flex items-center justify-center py-12 text-slate-500">
      <span>Loading library...</span>
    </div>
  );
}

export default function LibraryPage() {
  return (
    <ProtectedRoute>
      <main className="min-h-screen bg-slate-50">
        <Suspense fallback={<LibraryLoading />}>
          <LibraryContent />
        </Suspense>
      </main>
    </ProtectedRoute>
  );
}