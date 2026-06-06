"use client";

import { useState, useRef, useEffect } from "react";
import { useAuth } from "@/lib/AuthContext";
import Link from "next/link";
import { LogOut, Shield, ChevronDown } from "lucide-react";

type Language = "zh" | "en";

export default function UserMenu({ collapsed }: { collapsed?: boolean }) {
  const { user, profile, isAdmin, signOut } = useAuth();
  const [lang, setLang] = useState<Language>("zh");
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

  if (!user) return null;

  const name = profile?.full_name || user.email?.split("@")[0] || "User";
  const initials = name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

  const switchLang = async (l: Language) => {
    if (l === lang) return;
    await fetch("/api/profile", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ language: l }),
    });
    setLang(l);
    window.location.reload();
  };

  // Avatar component (reused in both collapsed and expanded)
  const Avatar = (
    <>
      {profile?.avatar_url ? (
        <img
          src={profile.avatar_url}
          alt={name}
          className="h-6 w-6 rounded-full"
        />
      ) : (
        <div className="flex h-6 w-6 items-center justify-center rounded-full bg-purple-600 text-[10px] font-bold text-white">
          {initials}
        </div>
      )}
    </>
  );

  // === COLLAPSED MODE: just avatar button, minimal dropdown ===
  if (collapsed) {
    return (
      <div ref={menuRef} className="relative">
        <button
          onClick={() => setOpen((o) => !o)}
          className="flex h-8 w-8 items-center justify-center rounded-full hover:bg-slate-100 transition-colors cursor-pointer"
          aria-label="User menu"
          aria-expanded={open}
        >
          {Avatar}
        </button>

        {open && (
          <div className="absolute bottom-full mb-2 right-0 w-56 rounded-lg border border-slate-200 bg-white shadow-lg z-50 py-1">
            <div className="px-3 py-2 border-b border-slate-100">
              <div className="text-sm font-semibold text-slate-900">{name}</div>
              <div className="text-xs text-slate-500 truncate">{user.email}</div>
            </div>
            <button
              onClick={() => {
                setOpen(false);
                signOut();
              }}
              className="flex items-center gap-2 w-full px-3 py-2 text-sm text-red-600 hover:bg-red-50 transition-colors cursor-pointer"
            >
              <LogOut className="h-4 w-4" />
              Sign out
            </button>
          </div>
        )}
      </div>
    );
  }

  // === EXPANDED MODE: full button with name + chevron ===
  return (
    <div ref={menuRef} className="relative w-full">
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center gap-2 px-2 py-1.5 rounded-md hover:bg-slate-100 transition-colors cursor-pointer"
        aria-expanded={open}
      >
        {Avatar}
        <span className="flex-1 truncate text-left text-xs font-semibold text-slate-900">
          {name}
        </span>
        <ChevronDown
          className={`h-3 w-3 text-slate-400 transition-transform ${
            open ? "rotate-180" : ""
          }`}
        />
      </button>

      {open && (
        <div className="absolute bottom-full mb-2 left-0 w-56 rounded-lg border border-slate-200 bg-white shadow-lg z-50 py-1">
          {/* User info header */}
          <div className="px-3 py-2 border-b border-slate-100">
            <div className="text-sm font-semibold text-slate-900">{name}</div>
            <div className="text-xs text-slate-500 truncate">{user.email}</div>
            {isAdmin && (
              <span className="mt-1 inline-block rounded bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-600">
                Admin
              </span>
            )}
          </div>

          {/* Language toggle */}
          <div className="px-3 py-2 border-b border-slate-100">
            <div className="mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-slate-400">
              Language
            </div>
            <div className="flex gap-1">
              {(["zh", "en"] as Language[]).map((l) => (
                <button
                  key={l}
                  onClick={() => switchLang(l)}
                  className={`flex-1 h-7 text-xs font-medium rounded-md transition-colors cursor-pointer ${
                    lang === l
                      ? "bg-purple-600 text-white"
                      : "border border-slate-200 text-slate-600 hover:bg-slate-50"
                  }`}
                >
                  {l === "zh" ? "中文" : "English"}
                </button>
              ))}
            </div>
          </div>

          {/* Admin link */}
          {isAdmin && (
            <Link
              href="/admin"
              onClick={() => setOpen(false)}
              className="flex items-center gap-2 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50 transition-colors cursor-pointer"
            >
              <Shield className="h-4 w-4" />
              Admin Dashboard
            </Link>
          )}

          {/* Sign out */}
          <button
            onClick={() => {
              setOpen(false);
              signOut();
            }}
            className="flex items-center gap-2 w-full px-3 py-2 text-sm text-red-600 hover:bg-red-50 transition-colors cursor-pointer"
          >
            <LogOut className="h-4 w-4" />
            Sign out
          </button>
        </div>
      )}
    </div>
  );
}