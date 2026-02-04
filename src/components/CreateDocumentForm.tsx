"use client";

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

export default function CreateDocumentForm() {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [docId, setDocId] = useState("");
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [docType, setDocType] = useState("");
  const [tags, setTags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState("");
  const [suggestedTags, setSuggestedTags] = useState<string[]>([]);
  const [suggestingTags, setSuggestingTags] = useState(false);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [uploadingFile, setUploadingFile] = useState(false);
  const [fileName, setFileName] = useState("");
  const [fileData, setFileData] = useState<{
    file: File;
    previewUrl: string;
  } | null>(null);

  // Shared input styles
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
        // Filter out tags already added
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

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!content.trim()) {
      setError("Please provide content by uploading a file or typing directly.");
      return;
    }

    setCreating(true);
    setError("");

    try {
      let fileUrl = null;
      let storedFileName = null;
      let fileType = null;

      // Upload file to storage if present
      if (fileData?.file) {
        const formData = new FormData();
        formData.append("file", fileData.file);
        formData.append("docId", docId);

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
          setCreating(false);
          return;
        }
      }

      // Create the document
      const res = await fetch("/api/documents", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          docId,
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
        router.push(`/library/${data.docId}`);
      } else {
        setError(data.error || "Failed to create document");
      }
    } catch (err) {
      setError("Failed to create document");
    } finally {
      setCreating(false);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadingFile(true);
    setError("");
    setMessage("");
    setFileName(file.name);

    try {
      const fileExtension = file.name.split(".").pop()?.toLowerCase();

      const previewUrl = URL.createObjectURL(file);
      setFileData({ file, previewUrl });

      if (!title) {
        const nameWithoutExt = file.name.replace(/\.[^/.]+$/, "");
        setTitle(nameWithoutExt.replace(/[-_]/g, " "));
      }

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

      if (res.ok) {
        if (data.content) {
          setContent(data.content);
          setMessage(`✅ Extracted ${data.characterCount} characters from ${file.name}. Original file will be stored.`);
        } else if (data.extractionFailed) {
          setMessage(`⚠️ Could not extract text from ${file.name}, but the file will be stored and viewable. Please add a description manually.`);
        }
      } else {
        setError(data.error || "Failed to extract content from file");
        setMessage(`⚠️ Text extraction failed. File will still be stored.`);
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
    setMessage("");
  };

  return (
    <div style={{ minHeight: "100vh", background: "#F9FAFB", paddingBottom: 60 }}>
      <div className="container" style={{ maxWidth: 900, padding: "40px 20px" }}>
        <div style={{ marginBottom: 32 }}>
          <Link
            href="/library"
            style={{
              color: "#6B7280",
              textDecoration: "none",
              fontSize: 14,
              fontWeight: 500,
            }}
          >
            ← Back to Library
          </Link>
        </div>

        <div
          className="card"
          style={{
            padding: 40,
            background: "white",
            borderRadius: 12,
          }}
        >
          <h1 style={{ fontSize: 28, fontWeight: 700, marginBottom: 8 }}>
            Create New Document
          </h1>
          <p style={{ color: "#6B7280", marginBottom: 32 }}>
            Add a new document to your knowledge base
          </p>

          {message && (
            <div
              style={{
                padding: 16,
                marginBottom: 24,
                borderRadius: 8,
                background: message.includes("⚠️") ? "#FEF3C7" : "#D1FAE5",
                color: message.includes("⚠️") ? "#92400E" : "#065F46",
                fontSize: 15,
              }}
            >
              {message}
            </div>
          )}

          {error && (
            <div
              style={{
                padding: 16,
                marginBottom: 24,
                borderRadius: 8,
                background: "#FEE2E2",
                color: "#991B1B",
                fontSize: 15,
              }}
            >
              {error}
            </div>
          )}

          <form onSubmit={handleCreate}>
            <div style={{ marginBottom: 24 }}>
              <label
                style={{
                  display: "block",
                  fontSize: 14,
                  fontWeight: 600,
                  marginBottom: 8,
                  color: "#374151",
                }}
              >
                Document ID *
              </label>
              <input
                type="text"
                value={docId}
                onChange={(e) => setDocId(e.target.value.toUpperCase().replace(/\s/g, "-"))}
                placeholder="PS-GUIDE-001"
                required
                disabled={creating}
                pattern="[A-Z0-9-]+"
                title="Only letters, numbers, and hyphens allowed (no spaces)"
                style={{
                  ...inputStyle,
                  opacity: creating ? 0.6 : 1,
                }}
              />
              <p style={{ fontSize: 13, color: "#6B7280", marginTop: 8 }}>
                Format: PS-TYPE-### (e.g., PS-GUIDE-001)
              </p>
            </div>

            <div style={{ marginBottom: 24 }}>
              <label
                style={{
                  display: "block",
                  fontSize: 14,
                  fontWeight: 600,
                  marginBottom: 8,
                  color: "#374151",
                }}
              >
                Document Title *
              </label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g., Customer Onboarding Guide"
                required
                disabled={creating}
                style={{
                  ...inputStyle,
                  opacity: creating ? 0.6 : 1,
                }}
              />
            </div>

            <div style={{ marginBottom: 24 }}>
              <label
                style={{
                  display: "block",
                  fontSize: 14,
                  fontWeight: 600,
                  marginBottom: 8,
                  color: "#374151",
                }}
              >
                Document Type
              </label>
              <input
                type="text"
                value={docType}
                onChange={(e) => setDocType(e.target.value)}
                placeholder="e.g., guide, playbook, strategy"
                disabled={creating}
                style={{
                  ...inputStyle,
                  opacity: creating ? 0.6 : 1,
                }}
              />
            </div>

            {/* ========== AI Tags Section ========== */}
            <div style={{ marginBottom: 24 }}>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  marginBottom: 8,
                }}
              >
                <label
                  style={{
                    fontSize: 14,
                    fontWeight: 600,
                    color: "#374151",
                  }}
                >
                  Tags
                </label>
                <button
                  type="button"
                  onClick={handleSuggestTags}
                  disabled={suggestingTags || creating}
                  style={{
                    padding: "6px 14px",
                    background: suggestingTags
                      ? "#A5B4FC"
                      : "linear-gradient(135deg, #7C3AED, #6366F1)",
                    color: "white",
                    border: "none",
                    borderRadius: 8,
                    fontSize: 13,
                    fontWeight: 600,
                    cursor: suggestingTags ? "not-allowed" : "pointer",
                    display: "flex",
                    alignItems: "center",
                    gap: 6,
                  }}
                >
                  {suggestingTags ? "⏳ Suggesting..." : "🏷️ AI Suggest Tags"}
                </button>
              </div>

              {/* Current tags */}
              {tags.length > 0 && (
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 10 }}>
                  {tags.map((tag) => (
                    <span
                      key={tag}
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        gap: 6,
                        padding: "6px 12px",
                        background: "#EEF2FF",
                        color: "#4338CA",
                        borderRadius: 6,
                        fontSize: 13,
                        fontWeight: 600,
                      }}
                    >
                      #{tag}
                      <button
                        type="button"
                        onClick={() => removeTag(tag)}
                        style={{
                          background: "none",
                          border: "none",
                          color: "#6366F1",
                          cursor: "pointer",
                          fontSize: 14,
                          padding: 0,
                          lineHeight: 1,
                        }}
                      >
                        ✕
                      </button>
                    </span>
                  ))}
                </div>
              )}

              {/* AI Suggested tags */}
              {suggestedTags.length > 0 && (
                <div
                  style={{
                    padding: 12,
                    background: "linear-gradient(135deg, #EEF2FF 0%, #E0E7FF 100%)",
                    borderRadius: 8,
                    border: "1px solid #C7D2FE",
                    marginBottom: 10,
                  }}
                >
                  <div style={{ fontSize: 12, color: "#4338CA", fontWeight: 600, marginBottom: 8 }}>
                    🏷️ AI Suggested Tags — click to add:
                  </div>
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                    {suggestedTags.map((tag) => (
                      <button
                        key={tag}
                        type="button"
                        onClick={() => addTag(tag)}
                        style={{
                          padding: "6px 12px",
                          background: "white",
                          color: "#4F46E5",
                          border: "1px solid #C7D2FE",
                          borderRadius: 6,
                          fontSize: 13,
                          fontWeight: 600,
                          cursor: "pointer",
                          display: "flex",
                          alignItems: "center",
                          gap: 4,
                        }}
                      >
                        + #{tag}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Manual tag input */}
              <div style={{ display: "flex", gap: 8 }}>
                <input
                  type="text"
                  value={tagInput}
                  onChange={(e) => setTagInput(e.target.value)}
                  placeholder="Add a custom tag..."
                  disabled={creating}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      if (tagInput.trim()) addTag(tagInput);
                    }
                  }}
                  style={{
                    ...inputStyle,
                    flex: 1,
                    opacity: creating ? 0.6 : 1,
                  }}
                />
                <button
                  type="button"
                  onClick={() => { if (tagInput.trim()) addTag(tagInput); }}
                  className="btn"
                  style={{ padding: "12px 16px", whiteSpace: "nowrap" }}
                >
                  + Add
                </button>
              </div>
              <p style={{ fontSize: 13, color: "#6B7280", marginTop: 6 }}>
                Press Enter to add a tag, or use AI Suggest after adding content
              </p>
            </div>

            <div style={{ marginBottom: 24 }}>
              <label
                style={{
                  display: "block",
                  fontSize: 14,
                  fontWeight: 600,
                  marginBottom: 8,
                  color: "#374151",
                }}
              >
                Upload Document
              </label>

              {!fileData ? (
                <div
                  style={{
                    padding: 24,
                    border: "2px dashed #D1D5DB",
                    borderRadius: 8,
                    background: "#F9FAFB",
                    textAlign: "center",
                  }}
                >
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".pdf,.docx,.doc,.txt,.md"
                    onChange={handleFileUpload}
                    disabled={uploadingFile || creating}
                    style={{ display: "none" }}
                    id="file-upload"
                  />
                  <label
                    htmlFor="file-upload"
                    style={{
                      cursor: uploadingFile || creating ? "not-allowed" : "pointer",
                      display: "block",
                    }}
                  >
                    <div style={{ marginBottom: 8 }}>
                      <span style={{ fontSize: 40 }}>📄</span>
                    </div>
                    <div
                      style={{
                        fontSize: 15,
                        fontWeight: 600,
                        color: "#374151",
                        marginBottom: 4,
                      }}
                    >
                      {uploadingFile ? "Processing..." : "Click to upload a file"}
                    </div>
                    <div style={{ fontSize: 13, color: "#6B7280" }}>
                      PDF, DOCX, DOC, TXT, MD • Text extracted automatically
                    </div>
                  </label>
                </div>
              ) : (
                <div
                  style={{
                    padding: 16,
                    border: "1px solid #D1D5DB",
                    borderRadius: 8,
                    background: "#F9FAFB",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    gap: 16,
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                    <span style={{ fontSize: 32 }}>
                      {fileName.endsWith(".pdf") ? "📕" : fileName.endsWith(".docx") || fileName.endsWith(".doc") ? "📘" : "📄"}
                    </span>
                    <div>
                      <div style={{ fontWeight: 600, color: "#111827" }}>{fileName}</div>
                      <div style={{ fontSize: 13, color: "#6B7280" }}>
                        {(fileData.file.size / 1024).toFixed(1)} KB
                      </div>
                    </div>
                  </div>
                  <div style={{ display: "flex", gap: 8 }}>
                    {fileData.previewUrl && fileName.endsWith(".pdf") && (
                      <a
                        href={fileData.previewUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="btn"
                        style={{ padding: "6px 12px", fontSize: 13 }}
                      >
                        👁️ Preview
                      </a>
                    )}
                    <button
                      type="button"
                      onClick={removeFile}
                      className="btn"
                      style={{
                        padding: "6px 12px",
                        fontSize: 13,
                        background: "#FEE2E2",
                        color: "#991B1B",
                        border: "1px solid #FCA5A5",
                      }}
                    >
                      ✕ Remove
                    </button>
                  </div>
                </div>
              )}
            </div>

            <div style={{ marginBottom: 32 }}>
              <label
                style={{
                  display: "block",
                  fontSize: 14,
                  fontWeight: 600,
                  marginBottom: 8,
                  color: "#374151",
                }}
              >
                Extracted Text / Content *
              </label>
              <p style={{ fontSize: 13, color: "#6B7280", marginBottom: 8 }}>
                {fileData
                  ? "Text extracted from your file. You can edit it below."
                  : "Upload a file above or write content directly."}
              </p>
              <textarea
                value={content}
                onChange={(e) => setContent(e.target.value)}
                placeholder="Start writing your document content here..."
                disabled={creating}
                rows={16}
                style={{
                  ...inputStyle,
                  padding: "16px",
                  fontSize: 15,
                  fontFamily: "monospace",
                  lineHeight: 1.6,
                  resize: "vertical",
                  opacity: creating ? 0.6 : 1,
                }}
              />
              <p style={{ fontSize: 13, color: "#6B7280", marginTop: 8 }}>
                {content.length} characters
              </p>
            </div>

            <div style={{ display: "flex", gap: 12 }}>
              <button
                type="submit"
                disabled={creating || uploadingFile}
                className="btn btn-primary"
                style={{
                  padding: "12px 24px",
                  fontSize: 16,
                  fontWeight: 600,
                  opacity: creating || uploadingFile ? 0.7 : 1,
                }}
              >
                {creating ? "Creating..." : "Create Document"}
              </button>
              <Link
                href="/library"
                className="btn"
                style={{ padding: "12px 24px", fontSize: 16 }}
              >
                Cancel
              </Link>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}