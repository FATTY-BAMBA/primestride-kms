"use client";

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

interface Document {
  doc_id: string;
  title: string;
  content: string;
  doc_type?: string;
  current_version: string;
  file_url?: string;
  file_name?: string;
  file_type?: string;
  tags?: string[];
}

export default function EditDocumentForm({ document }: { document: Document }) {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [title, setTitle] = useState(document.title);
  const [content, setContent] = useState(document.content);
  const [docType, setDocType] = useState(document.doc_type || "");
  const [tags, setTags] = useState<string[]>(document.tags || []);
  const [tagInput, setTagInput] = useState("");
  const [suggestedTags, setSuggestedTags] = useState<string[]>([]);
  const [suggestingTags, setSuggestingTags] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [changeDescription, setChangeDescription] = useState("");
  const [uploadingFile, setUploadingFile] = useState(false);
  const [fileName, setFileName] = useState(document.file_name || "");
  const [existingFileUrl, setExistingFileUrl] = useState(document.file_url || "");
  const [fileData, setFileData] = useState<{
    file: File;
    previewUrl: string;
  } | null>(null);
  const [removeExistingFile, setRemoveExistingFile] = useState(false);

  const inputStyle = {
    width: "100%",
    padding: "12px 16px",
    fontSize: 16,
    border: "1px solid #D1D5DB",
    borderRadius: 8,
    background: "#FFFFFF",
    color: "#111827",
    outline: "none",
  };

  const handleSuggestTags = async () => {
    if (!title && !content) {
      setError("Add a title or content first so AI can suggest tags.");
      return;
    }
    setSuggestingTags(true);
    setSuggestedTags([]);
    try {
      const res = await fetch("/api/tags/suggest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, content, docType }),
      });
      const data = await res.json();
      if (res.ok && data.tags) {
        const newSuggestions = data.tags.filter((t: string) => !tags.includes(t));
        setSuggestedTags(newSuggestions);
      }
    } catch (err) {
      console.error("Failed to suggest tags:", err);
    } finally {
      setSuggestingTags(false);
    }
  };

  const addTag = (tag: string) => {
    const cleaned = tag.toLowerCase().trim().replace(/[^a-z0-9-]/g, "");
    if (cleaned && !tags.includes(cleaned)) {
      setTags([...tags, cleaned]);
      setSuggestedTags(suggestedTags.filter((t) => t !== cleaned));
    }
    setTagInput("");
  };

  const removeTag = (tag: string) => {
    setTags(tags.filter((t) => t !== tag));
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!content.trim()) {
      setError("Please provide content by uploading a file or editing directly.");
      return;
    }

    setSaving(true);
    setError("");
    setMessage("");

    try {
      // ── Step 1: Create version snapshot before saving ──
      setMessage("📸 Saving version snapshot...");
      try {
        await fetch("/api/versions", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            docId: document.doc_id,
            changeDescription: changeDescription || "Edited document",
          }),
        });
      } catch {
        console.error("Failed to create version snapshot (continuing with save)");
      }

      // ── Step 2: Handle file upload ──
      let fileUrl = removeExistingFile ? null : existingFileUrl;
      let storedFileName = removeExistingFile ? null : fileName;
      let fileType = removeExistingFile ? null : document.file_type;

      if (fileData?.file) {
        setMessage("📤 Uploading file...");
        const formData = new FormData();
        formData.append("file", fileData.file);
        formData.append("docId", document.doc_id);

        const uploadRes = await fetch("/api/documents/upload", {
          method: "POST",
          body: formData,
        });

        const uploadData = await uploadRes.json();

        if (uploadRes.ok) {
          fileUrl = uploadData.fileUrl;
          storedFileName = uploadData.fileName;
          fileType = uploadData.fileType;
        } else {
          setError(uploadData.error || "Failed to upload file");
          setSaving(false);
          return;
        }
      }

      // ── Step 3: Save document changes ──
      setMessage("💾 Saving changes...");
      const res = await fetch(`/api/documents/${document.doc_id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title,
          content,
          docType,
          tags: tags.length > 0 ? tags : null,
          fileUrl,
          fileName: storedFileName,
          fileType,
        }),
      });

      const data = await res.json();

      if (res.ok) {
        setMessage("✅ Document updated successfully!");
        setTimeout(() => {
          router.push(`/library/${document.doc_id}`);
        }, 1000);
      } else {
        setError(data.error || "Failed to update document");
      }
    } catch (err) {
      setError("Failed to update document");
    } finally {
      setSaving(false);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadingFile(true);
    setError("");
    setMessage("");
    setFileName(file.name);
    setRemoveExistingFile(false);

    try {
      const fileExtension = file.name.split(".").pop()?.toLowerCase();
      const previewUrl = URL.createObjectURL(file);
      setFileData({ file, previewUrl });

      if (fileExtension === "txt" || fileExtension === "md") {
        const text = await file.text();
        setContent(text);
        setMessage(`✅ Loaded content from ${file.name}`);
        setUploadingFile(false);
        return;
      }

      const formData = new FormData();
      formData.append("file", file);

      const res = await fetch("/api/documents/parse", {
        method: "POST",
        body: formData,
      });

      const data = await res.json();

      if (res.ok && data.content) {
        setContent(data.content);
        setMessage(`✅ Extracted text from ${file.name}. Original file will be stored.`);
      } else {
        setMessage(`⚠️ Could not extract text, but file will be stored.`);
      }
    } catch (err) {
      setError("Failed to process file");
    } finally {
      setUploadingFile(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  const removeFile = () => {
    if (fileData?.previewUrl) {
      URL.revokeObjectURL(fileData.previewUrl);
    }
    setFileData(null);
    setFileName("");
    setExistingFileUrl("");
    setRemoveExistingFile(true);
    setMessage("");
  };

  const hasFile = fileData || (existingFileUrl && !removeExistingFile);

  return (
    <div style={{ minHeight: "100vh", background: "#F9FAFB", paddingBottom: 60 }}>
      <div className="container" style={{ maxWidth: 900, padding: "40px 20px" }}>
        <div style={{ marginBottom: 32 }}>
          <Link href={`/library/${document.doc_id}`} style={{ color: "#6B7280", textDecoration: "none", fontSize: 14, fontWeight: 500 }}>
            ← Back to Document
          </Link>
        </div>

        <div className="card" style={{ padding: 40, background: "white", borderRadius: 12 }}>
          <h1 style={{ fontSize: 28, fontWeight: 700, marginBottom: 8 }}>Edit Document</h1>
          <p style={{ color: "#6B7280", marginBottom: 32 }}>
            {document.doc_id} • Version {document.current_version}
          </p>

          {message && (
            <div style={{
              padding: 16, marginBottom: 24, borderRadius: 8,
              background: message.includes("⚠️") ? "#FEF3C7" : message.includes("❌") ? "#FEE2E2" : "#D1FAE5",
              color: message.includes("⚠️") ? "#92400E" : message.includes("❌") ? "#991B1B" : "#065F46",
              fontSize: 15,
            }}>
              {message}
            </div>
          )}

          {error && (
            <div style={{ padding: 16, marginBottom: 24, borderRadius: 8, background: "#FEE2E2", color: "#991B1B", fontSize: 15 }}>
              {error}
            </div>
          )}

          <form onSubmit={handleSave}>
            {/* Title */}
            <div style={{ marginBottom: 24 }}>
              <label style={{ display: "block", fontSize: 14, fontWeight: 600, marginBottom: 8, color: "#374151" }}>
                Document Title *
              </label>
              <input type="text" value={title} onChange={(e) => setTitle(e.target.value)} required disabled={saving} style={{ ...inputStyle, opacity: saving ? 0.6 : 1 }} />
            </div>

            {/* Document Type */}
            <div style={{ marginBottom: 24 }}>
              <label style={{ display: "block", fontSize: 14, fontWeight: 600, marginBottom: 8, color: "#374151" }}>
                Document Type
              </label>
              <input type="text" value={docType} onChange={(e) => setDocType(e.target.value)} placeholder="e.g., guide, playbook, strategy" disabled={saving} style={{ ...inputStyle, opacity: saving ? 0.6 : 1 }} />
            </div>

            {/* Tags Section */}
            <div style={{ marginBottom: 24 }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
                <label style={{ fontSize: 14, fontWeight: 600, color: "#374151" }}>Tags</label>
                <button type="button" onClick={handleSuggestTags} disabled={suggestingTags || saving} style={{ padding: "6px 14px", background: suggestingTags ? "#A5B4FC" : "linear-gradient(135deg, #7C3AED, #6366F1)", color: "white", border: "none", borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: suggestingTags ? "not-allowed" : "pointer", display: "flex", alignItems: "center", gap: 6 }}>
                  {suggestingTags ? "⏳ Suggesting..." : "🏷️ AI Suggest Tags"}
                </button>
              </div>

              {tags.length > 0 && (
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 10 }}>
                  {tags.map((tag) => (
                    <span key={tag} style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "6px 12px", background: "#EEF2FF", color: "#4338CA", borderRadius: 6, fontSize: 13, fontWeight: 600 }}>
                      #{tag}
                      <button type="button" onClick={() => removeTag(tag)} style={{ background: "none", border: "none", color: "#6366F1", cursor: "pointer", fontSize: 14, padding: 0, lineHeight: 1 }}>✕</button>
                    </span>
                  ))}
                </div>
              )}

              {suggestedTags.length > 0 && (
                <div style={{ padding: 12, background: "linear-gradient(135deg, #EEF2FF 0%, #E0E7FF 100%)", borderRadius: 8, border: "1px solid #C7D2FE", marginBottom: 10 }}>
                  <div style={{ fontSize: 12, color: "#4338CA", fontWeight: 600, marginBottom: 8 }}>🏷️ AI Suggested Tags — click to add:</div>
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                    {suggestedTags.map((tag) => (
                      <button key={tag} type="button" onClick={() => addTag(tag)} style={{ padding: "6px 12px", background: "white", color: "#4F46E5", border: "1px solid #C7D2FE", borderRadius: 6, fontSize: 13, fontWeight: 600, cursor: "pointer", display: "flex", alignItems: "center", gap: 4 }}>
                        + #{tag}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <div style={{ display: "flex", gap: 8 }}>
                <input type="text" value={tagInput} onChange={(e) => setTagInput(e.target.value)} placeholder="Add a custom tag..." disabled={saving} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); if (tagInput.trim()) addTag(tagInput); } }} style={{ ...inputStyle, flex: 1, opacity: saving ? 0.6 : 1 }} />
                <button type="button" onClick={() => { if (tagInput.trim()) addTag(tagInput); }} className="btn" style={{ padding: "12px 16px", whiteSpace: "nowrap" }}>
                  + Add
                </button>
              </div>
              <p style={{ fontSize: 13, color: "#6B7280", marginTop: 6 }}>Press Enter to add a tag</p>
            </div>

            {/* File Upload */}
            <div style={{ marginBottom: 24 }}>
              <label style={{ display: "block", fontSize: 14, fontWeight: 600, marginBottom: 8, color: "#374151" }}>
                Attached File
              </label>
              {!hasFile ? (
                <div style={{ padding: 24, border: "2px dashed #D1D5DB", borderRadius: 8, background: "#F9FAFB", textAlign: "center" }}>
                  <input ref={fileInputRef} type="file" accept=".pdf,.docx,.doc,.txt,.md" onChange={handleFileUpload} disabled={uploadingFile || saving} style={{ display: "none" }} id="file-upload" />
                  <label htmlFor="file-upload" style={{ cursor: uploadingFile || saving ? "not-allowed" : "pointer", display: "block" }}>
                    <div style={{ marginBottom: 8 }}><span style={{ fontSize: 40 }}>📄</span></div>
                    <div style={{ fontSize: 15, fontWeight: 600, color: "#374151", marginBottom: 4 }}>{uploadingFile ? "Processing..." : "Click to upload a file"}</div>
                    <div style={{ fontSize: 13, color: "#6B7280" }}>PDF, DOCX, TXT, MD</div>
                  </label>
                </div>
              ) : (
                <div style={{ padding: 16, border: "1px solid #D1D5DB", borderRadius: 8, background: "#F9FAFB", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16, flexWrap: "wrap" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                    <span style={{ fontSize: 32 }}>{fileName.endsWith(".pdf") ? "📕" : fileName.endsWith(".docx") || fileName.endsWith(".doc") ? "📘" : "📄"}</span>
                    <div>
                      <div style={{ fontWeight: 600, color: "#111827" }}>{fileName}</div>
                      <div style={{ fontSize: 13, color: "#6B7280" }}>{fileData ? "New file (will be uploaded)" : "Currently attached"}</div>
                    </div>
                  </div>
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                    {(fileData?.previewUrl || existingFileUrl) && (
                      <a href={fileData?.previewUrl || existingFileUrl} target="_blank" rel="noopener noreferrer" className="btn" style={{ padding: "6px 12px", fontSize: 13 }}>👁️ Preview</a>
                    )}
                    {existingFileUrl && !fileData && (
                      <a href={existingFileUrl} download={fileName} className="btn" style={{ padding: "6px 12px", fontSize: 13 }}>📥 Download</a>
                    )}
                    <label htmlFor="file-upload" className="btn" style={{ padding: "6px 12px", fontSize: 13, cursor: "pointer" }}>🔄 Replace</label>
                    <input ref={fileInputRef} type="file" accept=".pdf,.docx,.doc,.txt,.md" onChange={handleFileUpload} disabled={uploadingFile || saving} style={{ display: "none" }} id="file-upload" />
                    <button type="button" onClick={removeFile} className="btn" style={{ padding: "6px 12px", fontSize: 13, background: "#FEE2E2", color: "#991B1B", border: "1px solid #FCA5A5" }}>✕ Remove</button>
                  </div>
                </div>
              )}
            </div>

            {/* Content */}
            <div style={{ marginBottom: 24 }}>
              <label style={{ display: "block", fontSize: 14, fontWeight: 600, marginBottom: 8, color: "#374151" }}>
                Content *
              </label>

              {/* AI Writing Assistant Toolbar */}
              <WritingAssistant content={content} onApply={(newContent) => setContent(newContent)} disabled={saving} />

              <textarea
                id="content-editor"
                value={content}
                onChange={(e) => setContent(e.target.value)}
                disabled={saving}
                rows={16}
                style={{ ...inputStyle, padding: "16px", fontSize: 15, fontFamily: "monospace", lineHeight: 1.6, resize: "vertical", opacity: saving ? 0.6 : 1, borderTopLeftRadius: 0, borderTopRightRadius: 0 }}
              />
              <p style={{ fontSize: 13, color: "#6B7280", marginTop: 8 }}>{content.length} characters</p>
            </div>

            {/* Change Description */}
            <div style={{ marginBottom: 32 }}>
              <label style={{ display: "block", fontSize: 14, fontWeight: 600, marginBottom: 8, color: "#374151" }}>
                What changed? (optional)
              </label>
              <input
                type="text"
                value={changeDescription}
                onChange={(e) => setChangeDescription(e.target.value)}
                placeholder="e.g., Updated pricing section, Fixed typos, Added new FAQ..."
                disabled={saving}
                style={{ ...inputStyle, opacity: saving ? 0.6 : 1 }}
              />
              <p style={{ fontSize: 13, color: "#6B7280", marginTop: 6 }}>
                This note will be saved with the version snapshot for reference.
              </p>
            </div>

            {/* Save / Cancel */}
            <div style={{ display: "flex", gap: 12 }}>
              <button type="submit" disabled={saving || uploadingFile} className="btn btn-primary" style={{ padding: "12px 24px", fontSize: 16, fontWeight: 600, opacity: saving || uploadingFile ? 0.7 : 1 }}>
                {saving ? "Saving..." : "Save Changes"}
              </button>
              <Link href={`/library/${document.doc_id}`} className="btn" style={{ padding: "12px 24px", fontSize: 16 }}>
                Cancel
              </Link>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}

// ── AI Writing Assistant ──
function WritingAssistant({ content, onApply, disabled }: {
  content: string; onApply: (text: string) => void; disabled: boolean;
}) {
  const [loading, setLoading] = useState(false);
  const [action, setAction] = useState("");
  const [preview, setPreview] = useState("");
  const [showCustom, setShowCustom] = useState(false);
  const [customPrompt, setCustomPrompt] = useState("");
  const [showGenerate, setShowGenerate] = useState(false);
  const [generatePrompt, setGeneratePrompt] = useState("");

  const quickActions = [
    { id: "improve", label: "✨ 優化 Improve", color: "#7C3AED" },
    { id: "fix-grammar", label: "📝 修正 Fix", color: "#059669" },
    { id: "make-shorter", label: "📐 精簡 Shorter", color: "#D97706" },
    { id: "make-longer", label: "📏 擴展 Longer", color: "#2563EB" },
    { id: "bullet-points", label: "📋 條列 Bullets", color: "#6B7280" },
    { id: "summarize", label: "📊 摘要 Summary", color: "#EC4899" },
  ];

  const toneActions = [
    { id: "formal", label: "👔 正式" },
    { id: "casual", label: "😊 輕鬆" },
    { id: "technical", label: "🔬 專業" },
  ];

  const translateActions = [
    { id: "translate-zh", label: "🇹🇼 翻譯中文" },
    { id: "translate-en", label: "🇺🇸 Translate EN" },
  ];

  const getSelectedText = (): { text: string; start: number; end: number } | null => {
    const textarea = globalThis.document.getElementById("content-editor") as HTMLTextAreaElement | null;
    if (!textarea) return null;
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    if (start === end) return null;
    return { text: content.slice(start, end), start, end };
  };

  const runAction = async (actionId: string, prompt?: string) => {
    const selection = getSelectedText();
    const textToProcess = selection?.text || content;

    if (!textToProcess.trim()) return;

    setLoading(true);
    setAction(actionId);
    setPreview("");

    try {
      const res = await fetch("/api/writing-assist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: actionId,
          text: textToProcess,
          context: selection ? content.slice(0, 500) : undefined,
          customPrompt: prompt,
        }),
      });

      const data = await res.json();
      if (data.result) {
        setPreview(data.result);
      }
    } catch {
      setPreview("❌ Failed to process. Try again.");
    } finally {
      setLoading(false);
    }
  };

  const applyPreview = () => {
    if (!preview) return;
    const selection = getSelectedText();

    if (selection && (action !== "generate")) {
      // Replace selected text
      const newContent = content.slice(0, selection.start) + preview + content.slice(selection.end);
      onApply(newContent);
    } else if (action === "generate") {
      // Append generated content
      onApply(content + (content.endsWith("\n") ? "" : "\n\n") + preview);
    } else {
      // Replace entire content
      onApply(preview);
    }
    setPreview("");
    setAction("");
  };

  const dismissPreview = () => {
    setPreview("");
    setAction("");
  };

  return (
    <div style={{
      border: "1px solid #E5E7EB", borderBottom: "none",
      borderRadius: "8px 8px 0 0", background: "white", overflow: "hidden",
    }}>
      {/* Toolbar */}
      <div className="mobile-toolbar" style={{
        padding: "8px 12px",
        background: "linear-gradient(135deg, #FAFAFE 0%, #F5F3FF 100%)",
        borderBottom: "1px solid #EDE9FE",
        display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center",
      }}>
        <span style={{ fontSize: 12, color: "#7C3AED", fontWeight: 700, marginRight: 4 }}>🤖 AI</span>

        {/* Quick actions */}
        {quickActions.map(a => (
          <button
            key={a.id}
            onClick={() => runAction(a.id)}
            disabled={disabled || loading || !content.trim()}
            style={{
              padding: "4px 10px", borderRadius: 6, border: "1px solid #E5E7EB",
              background: "white", fontSize: 12, cursor: "pointer", color: "#374151",
              fontWeight: 500, opacity: disabled || loading || !content.trim() ? 0.5 : 1,
              transition: "all 0.15s",
            }}
            onMouseEnter={(e) => { if (!disabled) { e.currentTarget.style.borderColor = a.color; e.currentTarget.style.color = a.color; }}}
            onMouseLeave={(e) => { e.currentTarget.style.borderColor = "#E5E7EB"; e.currentTarget.style.color = "#374151"; }}
          >{a.label}</button>
        ))}

        <span style={{ width: 1, height: 20, background: "#E5E7EB", margin: "0 2px" }} />

        {/* Tone */}
        {toneActions.map(a => (
          <button
            key={a.id}
            onClick={() => runAction(a.id)}
            disabled={disabled || loading || !content.trim()}
            style={{
              padding: "4px 8px", borderRadius: 6, border: "1px solid #E5E7EB",
              background: "white", fontSize: 11, cursor: "pointer", color: "#6B7280",
              opacity: disabled || loading || !content.trim() ? 0.5 : 1,
            }}
          >{a.label}</button>
        ))}

        <span style={{ width: 1, height: 20, background: "#E5E7EB", margin: "0 2px" }} />

        {/* Translate */}
        {translateActions.map(a => (
          <button
            key={a.id}
            onClick={() => runAction(a.id)}
            disabled={disabled || loading || !content.trim()}
            style={{
              padding: "4px 8px", borderRadius: 6, border: "1px solid #E5E7EB",
              background: "white", fontSize: 11, cursor: "pointer", color: "#6B7280",
              opacity: disabled || loading || !content.trim() ? 0.5 : 1,
            }}
          >{a.label}</button>
        ))}

        <span style={{ width: 1, height: 20, background: "#E5E7EB", margin: "0 2px" }} />

        {/* Custom */}
        <button
          onClick={() => setShowCustom(!showCustom)}
          disabled={disabled || loading || !content.trim()}
          style={{
            padding: "4px 10px", borderRadius: 6, border: "1px solid #E5E7EB",
            background: showCustom ? "#7C3AED" : "white", color: showCustom ? "white" : "#374151",
            fontSize: 12, cursor: "pointer", fontWeight: 500,
            opacity: disabled || loading || !content.trim() ? 0.5 : 1,
          }}
        >🎯 自訂 Custom</button>

        {/* Generate */}
        <button
          onClick={() => setShowGenerate(!showGenerate)}
          disabled={disabled || loading}
          style={{
            padding: "4px 10px", borderRadius: 6, border: "1px solid #E5E7EB",
            background: showGenerate ? "#EC4899" : "white", color: showGenerate ? "white" : "#374151",
            fontSize: 12, cursor: "pointer", fontWeight: 500,
            opacity: disabled || loading ? 0.5 : 1,
          }}
        >💡 生成 Generate</button>

        {loading && (
          <span style={{ fontSize: 12, color: "#7C3AED", fontWeight: 600, marginLeft: 4 }}>
            ⏳ 處理中 Processing...
          </span>
        )}
      </div>

      {/* Selection hint */}
      <div style={{ padding: "4px 12px", background: "#FEFCE8", fontSize: 11, color: "#92400E", borderBottom: "1px solid #FDE68A" }}>
        💡 選取文字只轉換該段落，或直接套用整篇內容 | Select text to transform just that section, or apply to full content
      </div>

      {/* Custom prompt input */}
      {showCustom && (
        <div style={{ padding: "10px 12px", borderBottom: "1px solid #E5E7EB", display: "flex", gap: 8 }}>
          <input
            type="text"
            value={customPrompt}
            onChange={(e) => setCustomPrompt(e.target.value)}
            placeholder="告訴 AI 如何修改文字... 例如：'為每個重點加上範例' | Tell AI what to do..."
            onKeyDown={(e) => { if (e.key === "Enter" && customPrompt.trim()) { runAction("custom", customPrompt); setShowCustom(false); } }}
            style={{ flex: 1, padding: "8px 12px", border: "1px solid #D1D5DB", borderRadius: 6, fontSize: 13, outline: "none" }}
          />
          <button
            onClick={() => { if (customPrompt.trim()) { runAction("custom", customPrompt); setShowCustom(false); } }}
            style={{ padding: "8px 14px", borderRadius: 6, border: "none", background: "#7C3AED", color: "white", fontSize: 13, fontWeight: 600, cursor: "pointer" }}
          >Apply</button>
        </div>
      )}

      {/* Generate prompt input */}
      {showGenerate && (
        <div style={{ padding: "10px 12px", borderBottom: "1px solid #E5E7EB", display: "flex", gap: 8 }}>
          <input
            type="text"
            value={generatePrompt}
            onChange={(e) => setGeneratePrompt(e.target.value)}
            placeholder="AI 應該寫什麼？例如：'撰寫專案提案的介紹' | What should AI write?"
            onKeyDown={(e) => { if (e.key === "Enter" && generatePrompt.trim()) { runAction("generate", generatePrompt); setShowGenerate(false); } }}
            style={{ flex: 1, padding: "8px 12px", border: "1px solid #D1D5DB", borderRadius: 6, fontSize: 13, outline: "none" }}
          />
          <button
            onClick={() => { if (generatePrompt.trim()) { runAction("generate", generatePrompt); setShowGenerate(false); } }}
            style={{ padding: "8px 14px", borderRadius: 6, border: "none", background: "#EC4899", color: "white", fontSize: 13, fontWeight: 600, cursor: "pointer" }}
          >Generate</button>
        </div>
      )}

      {/* Preview */}
      {preview && (
        <div style={{ borderBottom: "1px solid #E5E7EB" }}>
          <div style={{ padding: "8px 12px", background: "#F0FDF4", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ fontSize: 13, fontWeight: 600, color: "#065F46" }}>✨ AI 建議 Suggestion</span>
            <div style={{ display: "flex", gap: 8 }}>
              <button onClick={applyPreview}
                style={{ padding: "5px 14px", borderRadius: 6, border: "none", background: "#059669", color: "white", fontSize: 12, fontWeight: 600, cursor: "pointer" }}>
                ✓ 套用 Apply
              </button>
              <button onClick={dismissPreview}
                style={{ padding: "5px 14px", borderRadius: 6, border: "1px solid #D1D5DB", background: "white", fontSize: 12, cursor: "pointer", color: "#6B7280" }}>
                ✕ 取消 Dismiss
              </button>
            </div>
          </div>
          <div style={{
            padding: "12px 16px", maxHeight: 200, overflowY: "auto",
            fontSize: 14, lineHeight: 1.6, whiteSpace: "pre-wrap",
            background: "#F9FFF9", color: "#1a1a1a", fontFamily: "monospace",
          }}>
            {preview}
          </div>
        </div>
      )}
    </div>
  );
}