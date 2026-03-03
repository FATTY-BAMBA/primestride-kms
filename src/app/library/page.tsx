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
  MoreVertical,
  Search,
  Filter,
  Globe,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Edit3,
  Trash2,
  Plus,
  ArrowLeft
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
        {/* Icon */}
        <div className={cn("w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0", getIconBg())}>
          {getDocIcon()}
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <h3 className="font-medium text-slate-900 truncate">{doc.title}</h3>
            </div>
            
            {/* Actions - shown on hover */}
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

          {/* Meta row */}
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
            
            {/* Feedback summary - only show if there's feedback */}
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
  const [searchQuery, setSearchQuery] = useState("");

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);

      const url = teamFilter && teamFilter !== "all"
        ? `/api/learning-summary?team=${teamFilter}`
        : "/api/learning-summary";

      const [docRes, folderRes, profileRes] = await Promise.all([
        fetch(url),
        fetch("/api/folders"),
        fetch("/api/profile"),
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
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : "Error");
    } finally {
      setLoading(false);
    }
  }, [teamFilter]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const totalFeedback = docs.reduce(
    (sum, d) =>
      sum + d.feedback_counts.helped + d.feedback_counts.not_confident + d.feedback_counts.didnt_help,
    0
  );

  // Filter docs by folder and search
  const filteredDocs = docs
    .filter(d => !folderFilter || d.folder_id === folderFilter)
    .filter(d => !searchQuery || d.title.toLowerCase().includes(searchQuery.toLowerCase()));

  const currentFolder = folders.find((f) => f.id === folderFilter);

  const handleDeleteFolder = async (folderId: string) => {
    if (!confirm("Delete this folder? Documents inside will be moved to unfiled.")) return;
    try {
      await fetch(`/api/folders?id=${folderId}`, { method: "DELETE" });
      router.push("/library");
      fetchData();
    } catch {}
  };

  // Filter options
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

  return (
    <div className="p-6 lg:p-8 max-w-6xl mx-auto">
      {/* Header */}
      <header className="mb-8">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-2xl font-semibold text-slate-900">Knowledge Library</h1>
            <p className="text-sm text-slate-500 mt-1">
              Learning-enabled docs with feedback
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

      {/* Search & Filters */}
      {!loading && !err && (
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 mb-6">
          <div className="relative flex-1 max-w-md w-full">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <Input
              placeholder="Search documents..."
              className="pl-10"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          
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
        </div>
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

      {/* Folders Section */}
      {!loading && !err && folders.length > 0 && !folderFilter && (
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

      {/* Documents List */}
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