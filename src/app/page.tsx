'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/AuthContext';

export default function LandingPage() {
  const { user, isLoading } = useAuth();
  const router = useRouter();
  const isSignedIn = !isLoading && !!user;
  const [navScrolled, setNavScrolled] = useState(false);
  const [activeScreen, setActiveScreen] = useState('library');

  // Redirect logged-in users to library (matches original behavior)
  useEffect(() => {
    if (!isLoading && user) {
      router.replace('/library');
    }
  }, [user, isLoading, router]);

  // Nav scroll effect
  useEffect(() => {
    if (isLoading || user) return; // Skip if not rendering
    const handleScroll = () => setNavScrolled(window.scrollY > 20);
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, [isLoading, user]);

  // Scroll-triggered fade-in
  useEffect(() => {
    if (isLoading || user) return; // Skip if not rendering
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            (entry.target as HTMLElement).style.opacity = '1';
            (entry.target as HTMLElement).style.transform = 'translateY(0)';
          }
        });
      },
      { threshold: 0.08, rootMargin: '0px 0px -30px 0px' }
    );

    document.querySelectorAll('.fade-in').forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, [isLoading, user]);

  // Show nothing while checking auth or redirecting
  if (isLoading || user) {
    return null;
  }

  const urlMap: Record<string, string> = {
    library: 'primestrideatlas.com/library',
    search: 'primestrideatlas.com/search',
    chat: 'primestrideatlas.com/chat',
    learning: 'primestrideatlas.com/learning',
    team: 'primestrideatlas.com/team',
  };

  const primaryCTA = '/signup';
  const primaryLabel = '免費開始使用 →';

  return (
    <>
      <style jsx global>{`
        @import url('https://fonts.googleapis.com/css2?family=Noto+Sans+TC:wght@300;400;500;600;700;900&family=Playfair+Display:ital,wght@0,700;1,700&family=JetBrains+Mono:wght@400;500&display=swap');

        :root {
          --brand: #4f6df5;
          --brand-dark: #3b54d4;
          --brand-light: #6b85ff;
          --brand-glow: rgba(79, 109, 245, 0.10);
          --brand-glow-strong: rgba(79, 109, 245, 0.20);
          --warm: #f0a35c;
          --warm-dark: #d4883d;
          --ink: #0a0e1a;
          --ink-2: #161b2e;
          --ink-3: #3d4663;
          --ink-4: #7a829e;
          --ink-5: #a5abc3;
          --surface: #ffffff;
          --surface-2: #f7f8fb;
          --surface-3: #eef0f6;
          --border: #dfe2ec;
          --border-light: #eef0f5;
          --success: #1aae6f;
          --success-bg: rgba(26, 174, 111, 0.08);
          --danger: #e5484d;
          --max-w: 1120px;
          --nav-h: 64px;
          --radius: 14px;
          --radius-lg: 22px;
          --ui-bg: #12141f;
          --ui-card: #1a1d2e;
          --ui-border: rgba(255,255,255,0.07);
          --ui-text: rgba(255,255,255,0.85);
          --ui-muted: rgba(255,255,255,0.4);
        }

        * { margin: 0; padding: 0; box-sizing: border-box; }
        html { scroll-behavior: smooth; -webkit-font-smoothing: antialiased; }
        body { font-family: 'Noto Sans TC', system-ui, sans-serif; color: var(--ink); background: var(--surface); line-height: 1.7; overflow-x: hidden; }
        a { color: inherit; text-decoration: none; }

        .fade-in {
          opacity: 0;
          transform: translateY(18px);
          transition: opacity 0.45s ease, transform 0.45s ease;
        }

        /* ─── Nav ─── */
        .lp-nav {
          position: fixed; top: 0; left: 0; right: 0; z-index: 100;
          height: var(--nav-h);
          background: rgba(255,255,255,0.88);
          backdrop-filter: blur(20px); -webkit-backdrop-filter: blur(20px);
          border-bottom: 1px solid transparent;
          transition: all 0.3s;
        }
        .lp-nav.scrolled { border-color: var(--border-light); box-shadow: 0 1px 16px rgba(0,0,0,0.04); }
        .lp-nav-inner { max-width: var(--max-w); margin: 0 auto; padding: 0 24px; display: flex; align-items: center; justify-content: space-between; height: 100%; }
        .lp-nav-brand { display: flex; align-items: center; gap: 10px; font-weight: 700; font-size: 17px; }
        .lp-logo-mark { width: 34px; height: 34px; border-radius: 10px; background: linear-gradient(135deg, var(--brand), var(--brand-light)); display: flex; align-items: center; justify-content: center; color: #fff; font-weight: 800; font-size: 13px; box-shadow: 0 2px 8px rgba(79,109,245,0.3); }
        .lp-nav-links { display: flex; align-items: center; gap: 4px; }
        .lp-nav-links a { padding: 7px 14px; font-size: 14px; font-weight: 500; color: var(--ink-4); border-radius: 8px; transition: all 0.15s; }
        .lp-nav-links a:hover { color: var(--ink); background: var(--surface-2); }
        .lp-nav-actions { display: flex; align-items: center; gap: 10px; }

        /* ─── Buttons ─── */
        .lp-btn { display: inline-flex; align-items: center; gap: 8px; padding: 14px 30px; border-radius: 10px; font-size: 15px; font-weight: 600; cursor: pointer; border: none; transition: all 0.25s ease; white-space: nowrap; font-family: 'Noto Sans TC', sans-serif; }
        .lp-btn-primary { background: var(--brand); color: #fff; box-shadow: 0 2px 4px rgba(0,0,0,0.06), 0 8px 24px rgba(79,109,245,0.28); }
        .lp-btn-primary:hover { background: var(--brand-dark); transform: translateY(-2px); box-shadow: 0 2px 4px rgba(0,0,0,0.06), 0 14px 36px rgba(79,109,245,0.38); }
        .lp-btn-outline { background: transparent; color: var(--ink-2); border: 1.5px solid var(--border); }
        .lp-btn-outline:hover { border-color: var(--brand); color: var(--brand); background: var(--brand-glow); }
        .lp-btn-ghost { background: transparent; color: var(--ink-4); padding: 10px 16px; }
        .lp-btn-ghost:hover { color: var(--brand); }
        .lp-btn-warm { background: var(--warm); color: #fff; box-shadow: 0 2px 4px rgba(0,0,0,0.06), 0 8px 24px rgba(240,163,92,0.3); }
        .lp-btn-warm:hover { background: var(--warm-dark); transform: translateY(-2px); }
        .lp-btn-white { background: #fff; color: var(--ink); border: 1.5px solid var(--border); }
        .lp-btn-white:hover { border-color: var(--brand); color: var(--brand); }
        .lp-btn-sm { padding: 9px 20px; font-size: 13.5px; }

        /* ─── Hero ─── */
        .lp-hero { padding: calc(var(--nav-h) + 72px) 24px 60px; position: relative; overflow: hidden; text-align: center; }
        .lp-hero::before { content: ''; position: absolute; top: 0; left: 0; right: 0; bottom: 0; background: radial-gradient(ellipse 60% 45% at 30% 10%, rgba(79,109,245,0.07) 0%, transparent 70%), radial-gradient(ellipse 50% 40% at 80% 30%, rgba(240,163,92,0.05) 0%, transparent 60%); pointer-events: none; }
        .lp-hero::after { content: ''; position: absolute; top: 0; left: 0; right: 0; height: 60%; background-image: radial-gradient(circle, rgba(79,109,245,0.03) 1px, transparent 1px); background-size: 28px 28px; pointer-events: none; mask-image: linear-gradient(to bottom, black 20%, transparent); -webkit-mask-image: linear-gradient(to bottom, black 20%, transparent); }
        .lp-hero-inner { max-width: var(--max-w); margin: 0 auto; position: relative; z-index: 1; }

        .lp-badge { display: inline-flex; align-items: center; gap: 8px; padding: 6px 18px 6px 10px; background: var(--success-bg); border: 1px solid rgba(26,174,111,0.15); border-radius: 100px; font-size: 13px; font-weight: 600; color: var(--success); margin-bottom: 32px; }
        .lp-pulse { width: 8px; height: 8px; background: var(--success); border-radius: 50%; position: relative; }
        .lp-pulse::after { content: ''; position: absolute; inset: -3px; border-radius: 50%; border: 2px solid var(--success); animation: lp-ping 2s cubic-bezier(0,0,0.2,1) infinite; }
        @keyframes lp-ping { 0% { opacity: .75; transform: scale(1); } 100% { opacity: 0; transform: scale(2.2); } }
        @keyframes lp-fadeUp { from { opacity: 0; transform: translateY(18px); } to { opacity: 1; transform: translateY(0); } }

        .lp-display { font-family: 'Noto Sans TC', sans-serif; font-size: clamp(36px, 5.5vw, 64px); font-weight: 900; line-height: 1.15; letter-spacing: -1px; animation: lp-fadeUp 0.5s 0.08s ease both; max-width: 720px; margin: 0 auto 24px; }
        .lp-display .accent { font-family: 'Playfair Display', serif; font-style: italic; color: var(--brand); }
        .lp-body { font-size: 16.5px; line-height: 1.75; color: var(--ink-3); max-width: 580px; margin: 0 auto 40px; animation: lp-fadeUp 0.5s 0.16s ease both; }
        .lp-hero-actions { display: flex; gap: 12px; justify-content: center; flex-wrap: wrap; animation: lp-fadeUp 0.5s 0.24s ease both; }

        .lp-metrics { display: flex; gap: 48px; justify-content: center; margin-top: 48px; padding-top: 40px; border-top: 1px solid var(--border-light); animation: lp-fadeUp 0.5s 0.32s ease both; }
        .lp-metric { text-align: center; }
        .lp-metric-val { font-family: 'JetBrains Mono', monospace; font-size: 28px; font-weight: 700; color: var(--ink); }
        .lp-metric-lbl { font-size: 12px; color: var(--ink-4); margin-top: 2px; }
        .lp-metric-sep { width: 1px; height: 40px; background: var(--border); align-self: center; }

        /* ─── Showcase ─── */
        .lp-showcase { padding: 40px 24px 100px; }
        .lp-showcase-wrap { max-width: var(--max-w); margin: 0 auto; }
        .lp-tabs { display: flex; gap: 2px; background: var(--surface-3); padding: 3px; border-radius: 12px; width: fit-content; margin: 0 auto 32px; flex-wrap: wrap; }
        .lp-tab { padding: 10px 22px; border-radius: 10px; font-size: 13.5px; font-weight: 600; color: var(--ink-4); cursor: pointer; border: none; background: transparent; transition: all 0.2s; font-family: 'Noto Sans TC', sans-serif; }
        .lp-tab.active { background: var(--surface); color: var(--ink); box-shadow: 0 1px 4px rgba(0,0,0,0.06); }
        .lp-tab:hover:not(.active) { color: var(--ink-3); }

        .lp-frame { background: var(--ui-bg); border-radius: var(--radius-lg); overflow: hidden; box-shadow: 0 4px 20px rgba(0,0,0,0.12), 0 20px 60px rgba(0,0,0,0.18); border: 1px solid rgba(255,255,255,0.04); }
        .lp-frame-bar { display: flex; align-items: center; gap: 7px; padding: 12px 16px; background: rgba(255,255,255,0.03); border-bottom: 1px solid var(--ui-border); }
        .lp-dot { width: 11px; height: 11px; border-radius: 50%; }
        .lp-dot-r { background: #ef4444; }
        .lp-dot-y { background: #f59e0b; }
        .lp-dot-g { background: #22c55e; }
        .lp-frame-url { margin-left: 14px; font-family: 'JetBrains Mono', monospace; font-size: 12px; color: var(--ui-muted); background: rgba(255,255,255,0.04); padding: 5px 14px; border-radius: 7px; flex: 1; }

        .lp-screen { display: none; padding: 24px; min-height: 420px; }
        .lp-screen.active { display: block; }
        .lp-screen-chat { display: none; flex-direction: column; min-height: 420px; }
        .lp-screen-chat.active { display: flex; }

        /* UI elements inside screens */
        .ui-header { display: flex; align-items: center; gap: 12px; margin-bottom: 20px; }
        .ui-logo { width: 32px; height: 32px; background: linear-gradient(135deg, var(--brand), var(--brand-light)); border-radius: 8px; display: flex; align-items: center; justify-content: center; font-size: 14px; }
        .ui-title { font-size: 18px; font-weight: 700; color: var(--ui-text); }
        .ui-nav { display: flex; gap: 6px; margin-bottom: 20px; flex-wrap: wrap; }
        .ui-nav-item { padding: 6px 14px; border-radius: 8px; font-size: 12px; font-weight: 500; color: var(--ui-muted); background: rgba(255,255,255,0.04); }
        .ui-nav-item.active { background: var(--brand); color: #fff; }
        .ui-nav-item.chat { background: var(--success); color: #fff; }
        .ui-stats { display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; margin-bottom: 24px; }
        .ui-stat { padding: 16px; border-radius: 12px; background: rgba(255,255,255,0.03); border: 1px solid var(--ui-border); }
        .ui-stat-num { font-family: 'JetBrains Mono', monospace; font-size: 28px; font-weight: 700; color: var(--ui-text); }
        .ui-stat-lbl { font-size: 11px; color: var(--ui-muted); margin-top: 2px; }
        .ui-label { font-size: 14px; font-weight: 600; color: var(--ui-text); margin-bottom: 12px; }

        .ui-doc { display: flex; align-items: center; justify-content: space-between; padding: 14px 16px; border-radius: 10px; background: rgba(255,255,255,0.02); border: 1px solid var(--ui-border); margin-bottom: 8px; }
        .ui-doc-name { font-size: 13.5px; font-weight: 600; color: var(--ui-text); }
        .ui-doc-meta { display: flex; gap: 8px; align-items: center; margin-top: 4px; }
        .ui-doc-meta span { font-size: 10.5px; padding: 2px 8px; border-radius: 4px; font-weight: 500; }
        .ui-id { color: var(--ui-muted); font-family: 'JetBrains Mono', monospace; }
        .ui-pub { background: rgba(34,197,94,0.15); color: #4ade80; }
        .ui-cat { color: var(--ui-muted); }
        .ui-org { background: rgba(79,109,245,0.15); color: var(--brand-light); font-size: 10px; }
        .ui-doc-btn { padding: 6px 14px; border-radius: 7px; font-size: 11.5px; font-weight: 600; background: var(--brand); color: #fff; border: none; cursor: default; }
        .ui-doc-edit { font-size: 11px; color: var(--ui-muted); }

        /* Search screen */
        .ui-search-card { padding: 24px; border-radius: 14px; background: rgba(255,255,255,0.03); border: 1px solid var(--ui-border); }
        .ui-modes { display: flex; gap: 4px; margin-bottom: 16px; }
        .ui-mode { padding: 7px 16px; border-radius: 8px; font-size: 12.5px; font-weight: 600; color: var(--ui-muted); background: rgba(255,255,255,0.04); border: none; }
        .ui-mode.active { background: var(--brand); color: #fff; }
        .ui-input { width: 100%; padding: 12px 16px; border-radius: 10px; background: rgba(255,255,255,0.04); border: 1px solid var(--ui-border); color: var(--ui-muted); font-size: 13px; font-family: 'Noto Sans TC', sans-serif; margin-bottom: 16px; }
        .ui-filters { display: flex; gap: 10px; flex-wrap: wrap; margin-bottom: 16px; }
        .ui-filter { padding: 7px 14px; border-radius: 8px; font-size: 12px; background: rgba(255,255,255,0.04); border: 1px solid var(--ui-border); color: var(--ui-muted); }
        .ui-tags { display: flex; gap: 6px; flex-wrap: wrap; margin-bottom: 16px; }
        .ui-tag { padding: 4px 12px; border-radius: 6px; font-size: 11.5px; background: rgba(255,255,255,0.06); color: var(--ui-muted); font-weight: 500; }
        .ui-search-btn { padding: 9px 20px; border-radius: 8px; font-size: 13px; font-weight: 600; background: var(--brand); color: #fff; border: none; }

        /* Chat screen */
        .ui-chat-header { display: flex; align-items: center; justify-content: space-between; padding: 14px 20px; border-bottom: 1px solid var(--ui-border); }
        .ui-chat-avatar { width: 32px; height: 32px; border-radius: 50%; background: linear-gradient(135deg, #60a5fa, #34d399); display: flex; align-items: center; justify-content: center; font-size: 16px; }
        .ui-chat-body { flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 40px 20px; }
        .ui-chat-suggestions { display: flex; gap: 8px; flex-wrap: wrap; justify-content: center; }
        .ui-chat-suggestion { padding: 8px 16px; border-radius: 8px; font-size: 12.5px; background: rgba(255,255,255,0.04); border: 1px solid var(--ui-border); color: var(--ui-muted); }
        .ui-chat-input-bar { display: flex; align-items: center; gap: 10px; padding: 12px 16px; border-top: 1px solid var(--ui-border); }
        .ui-chat-input { flex: 1; padding: 10px 14px; border-radius: 8px; background: rgba(255,255,255,0.04); border: 1px solid var(--ui-border); color: var(--ui-muted); font-size: 13px; font-family: 'Noto Sans TC', sans-serif; }
        .ui-chat-send { padding: 10px 18px; border-radius: 8px; font-size: 13px; font-weight: 600; background: var(--brand-light); color: #fff; border: none; }
        .ui-header-btn { padding: 6px 14px; border-radius: 7px; font-size: 11.5px; font-weight: 600; border: none; color: #fff; }

        /* Learning screen */
        .ui-le-stats { display: grid; grid-template-columns: repeat(5, 1fr); gap: 10px; margin-bottom: 24px; }
        .ui-le-stat { padding: 14px 16px; border-radius: 12px; background: rgba(255,255,255,0.03); border: 1px solid var(--ui-border); }
        .ui-le-stat-label { font-size: 11px; color: var(--ui-muted); margin-bottom: 6px; }
        .ui-le-stat-val { font-family: 'JetBrains Mono', monospace; font-size: 24px; font-weight: 700; color: var(--ui-text); }
        .ui-le-doc { padding: 18px; border-radius: 12px; background: rgba(255,255,255,0.02); border: 1px solid var(--ui-border); margin-bottom: 10px; }
        .ui-le-doc-top { display: flex; align-items: flex-start; justify-content: space-between; margin-bottom: 10px; }
        .ui-le-feedback { display: flex; gap: 16px; font-size: 12px; color: var(--ui-muted); margin-bottom: 12px; }
        .ui-le-negative { padding: 10px 14px; border-radius: 8px; background: rgba(255,255,255,0.02); border: 1px solid var(--ui-border); }

        /* Team screen */
        .ui-member { display: flex; align-items: center; justify-content: space-between; padding: 14px 16px; border-radius: 10px; background: rgba(255,255,255,0.02); border: 1px solid var(--ui-border); margin-bottom: 8px; }
        .ui-member-email { font-size: 13.5px; font-weight: 500; color: var(--ui-text); display: flex; align-items: center; gap: 8px; }
        .ui-member-date { font-size: 11px; color: var(--ui-muted); margin-top: 2px; }
        .ui-role { padding: 4px 10px; border-radius: 6px; font-size: 11px; font-weight: 600; }
        .ui-role-owner { background: rgba(34,197,94,0.12); color: #4ade80; }
        .ui-role-admin { background: rgba(59,130,246,0.12); color: #60a5fa; }
        .ui-role-member { background: rgba(255,255,255,0.06); color: var(--ui-muted); }
        .ui-you { padding: 2px 8px; border-radius: 4px; background: rgba(255,255,255,0.08); font-size: 10px; color: var(--ui-muted); }
        .ui-remove { padding: 4px 10px; border-radius: 6px; font-size: 11px; font-weight: 600; background: rgba(229,72,77,0.12); color: #f87171; border: none; }
        .ui-team-btn { padding: 8px 16px; border-radius: 8px; font-size: 12.5px; font-weight: 600; border: 1px solid var(--ui-border); color: var(--ui-muted); background: transparent; }
        .ui-team-btn.primary { background: var(--brand); color: #fff; border-color: transparent; }

        /* ─── Built With ─── */
        .lp-built { display: flex; align-items: center; justify-content: center; gap: 36px; flex-wrap: wrap; padding: 44px 24px; border-top: 1px solid var(--border); border-bottom: 1px solid var(--border); }
        .lp-built-label { font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 2.5px; color: var(--ink-5); }
        .lp-built-item { display: flex; align-items: center; gap: 7px; font-size: 13.5px; font-weight: 500; color: var(--ink-4); }
        .lp-built-icon { width: 26px; height: 26px; border-radius: 6px; background: var(--surface-2); border: 1px solid var(--border); display: flex; align-items: center; justify-content: center; font-size: 13px; }

        /* ─── Sections ─── */
        .lp-section { padding: 100px 24px; }
        .lp-section-dark { background: var(--ink); color: #fff; }
        .lp-section-alt { background: var(--surface-2); }
        .lp-container { max-width: var(--max-w); margin: 0 auto; }
        .lp-section-header { max-width: 560px; margin-bottom: 52px; }
        .lp-section-header.center { margin-left: auto; margin-right: auto; text-align: center; }
        .lp-label { font-size: 11.5px; font-weight: 700; text-transform: uppercase; letter-spacing: 3px; color: var(--brand); margin-bottom: 14px; }
        .lp-section-dark .lp-label { color: var(--brand-light); }
        .lp-heading { font-size: clamp(26px, 3.5vw, 40px); font-weight: 700; line-height: 1.25; letter-spacing: -0.3px; margin-bottom: 14px; }
        .lp-section-dark .lp-heading { color: #fff; }
        .lp-desc { font-size: 16.5px; line-height: 1.75; color: var(--ink-3); }
        .lp-section-dark .lp-desc { color: rgba(255,255,255,0.5); }

        /* ─── Problem Cards ─── */
        .lp-problem-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 18px; }
        .lp-problem-card { padding: 30px 26px; border-radius: 18px; background: rgba(255,255,255,0.025); border: 1px solid rgba(255,255,255,0.06); transition: all 0.25s; }
        .lp-problem-card:hover { background: rgba(255,255,255,0.05); transform: translateY(-2px); }
        .lp-problem-icon { width: 42px; height: 42px; border-radius: 10px; background: rgba(229,72,77,0.1); display: flex; align-items: center; justify-content: center; font-size: 18px; margin-bottom: 18px; }
        .lp-problem-card h3 { font-size: 17px; font-weight: 700; color: #fff; margin-bottom: 8px; }
        .lp-problem-card p { font-size: 14px; color: rgba(255,255,255,0.4); line-height: 1.75; }
        .lp-problem-stat { font-family: 'JetBrains Mono', monospace; font-size: 30px; font-weight: 700; color: #f87171; margin-top: 14px; }

        /* ─── Feature Cards ─── */
        .lp-features-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 18px; }
        .lp-feature-card { padding: 30px 26px; border-radius: 18px; border: 1px solid var(--border); background: var(--surface); transition: all 0.25s; position: relative; overflow: hidden; }
        .lp-feature-card::before { content: ''; position: absolute; top: 0; left: 0; right: 0; height: 3px; background: linear-gradient(90deg, var(--brand), var(--brand-light)); opacity: 0; transition: opacity 0.25s; }
        .lp-feature-card:hover { border-color: rgba(79,109,245,0.2); box-shadow: 0 8px 28px var(--brand-glow); transform: translateY(-2px); }
        .lp-feature-card:hover::before { opacity: 1; }
        .lp-feature-icon { width: 42px; height: 42px; border-radius: 10px; background: var(--brand-glow); display: flex; align-items: center; justify-content: center; font-size: 18px; margin-bottom: 16px; }
        .lp-feature-card h3 { font-size: 16px; font-weight: 700; margin-bottom: 8px; }
        .lp-feature-card p { font-size: 14px; color: var(--ink-3); line-height: 1.7; }
        .lp-feature-hl { grid-column: span 3; background: linear-gradient(135deg, var(--brand), var(--brand-light)); border: none; color: #fff; display: flex; gap: 28px; align-items: center; }
        .lp-feature-hl .lp-feature-icon { background: rgba(255,255,255,0.15); }
        .lp-feature-hl h3 { color: #fff; font-size: 18px; }
        .lp-feature-hl p { color: rgba(255,255,255,0.8); }
        .lp-feature-hl::before { display: none; }
        .lp-feature-hl:hover { box-shadow: 0 12px 40px rgba(79,109,245,0.35); }

        /* ─── Comparison ─── */
        .lp-table { width: 100%; border-collapse: separate; border-spacing: 0; border-radius: 18px; overflow: hidden; border: 1px solid var(--border); }
        .lp-table th, .lp-table td { padding: 15px 22px; text-align: left; font-size: 14px; border-bottom: 1px solid var(--border); }
        .lp-table thead th { background: var(--ink); color: #fff; font-weight: 600; font-size: 12.5px; text-transform: uppercase; letter-spacing: 0.5px; }
        .lp-table thead th:last-child { background: var(--brand); }
        .lp-table tbody tr:last-child td { border-bottom: none; }
        .lp-table tbody td:first-child { font-weight: 600; color: var(--ink); }
        .lp-table tbody td { color: var(--ink-3); }
        .lp-table tbody td:last-child { color: var(--brand); font-weight: 600; background: var(--brand-glow); }
        .lp-check { color: var(--success); font-weight: 700; }
        .lp-cross { color: var(--border); }

        /* ─── Steps ─── */
        .lp-steps { display: grid; grid-template-columns: repeat(3, 1fr); gap: 28px; counter-reset: step; }
        .lp-step { position: relative; padding: 34px 26px; background: var(--surface); border-radius: 18px; border: 1px solid var(--border); counter-increment: step; }
        .lp-step::before { content: counter(step); font-family: 'Playfair Display', serif; font-size: 64px; font-weight: 700; color: var(--brand-glow-strong); position: absolute; top: -10px; right: 20px; line-height: 1; }
        .lp-step h3 { font-size: 16px; font-weight: 700; margin-bottom: 8px; }
        .lp-step p { font-size: 14px; color: var(--ink-3); line-height: 1.75; }

        /* ─── Pricing ─── */
        .lp-pricing-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 18px; align-items: start; }
        .lp-pricing-card { padding: 36px 28px; border-radius: 18px; border: 1px solid var(--border); background: var(--surface); text-align: center; transition: all 0.25s; position: relative; }
        .lp-pricing-card.featured { border-color: var(--brand); box-shadow: 0 8px 40px var(--brand-glow); transform: scale(1.03); }
        .lp-pop-badge { position: absolute; top: -12px; left: 50%; transform: translateX(-50%); padding: 4px 16px; background: var(--brand); color: #fff; font-size: 11px; font-weight: 700; border-radius: 100px; }
        .lp-tier { font-size: 15px; font-weight: 600; color: var(--ink-4); margin-bottom: 14px; }
        .lp-price { font-size: 44px; font-weight: 700; color: var(--ink); line-height: 1; margin-bottom: 4px; }
        .lp-price span { font-size: 16px; font-weight: 400; color: var(--ink-4); }
        .lp-price-note { font-size: 12.5px; color: var(--ink-4); margin-bottom: 24px; }
        .lp-feat-list { list-style: none; text-align: left; margin-bottom: 28px; }
        .lp-feat-list li { padding: 7px 0; font-size: 13.5px; color: var(--ink-3); display: flex; align-items: center; gap: 10px; border-bottom: 1px solid var(--border-light); }
        .lp-feat-list li:last-child { border-bottom: none; }
        .lp-feat-list li::before { content: '✓'; color: var(--success); font-weight: 700; font-size: 12px; }

        /* ─── CTA ─── */
        .lp-cta { text-align: center; padding: 100px 24px; background: var(--ink); position: relative; overflow: hidden; }
        .lp-cta::before { content: ''; position: absolute; inset: 0; background: radial-gradient(ellipse 50% 60% at 50% 80%, rgba(79,109,245,0.12) 0%, transparent 70%); pointer-events: none; }
        .lp-cta .lp-heading { color: #fff; position: relative; z-index: 1; }
        .lp-cta .lp-desc { color: rgba(255,255,255,0.5); position: relative; z-index: 1; max-width: 460px; margin: 0 auto 36px; }
        .lp-cta-actions { position: relative; z-index: 1; display: flex; gap: 12px; justify-content: center; flex-wrap: wrap; }
        .lp-cta-note { position: relative; z-index: 1; margin-top: 20px; font-size: 12.5px; color: rgba(255,255,255,0.3); }

        /* ─── Footer ─── */
        .lp-footer { padding: 44px 24px; border-top: 1px solid var(--border); }
        .lp-footer-inner { max-width: var(--max-w); margin: 0 auto; display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 16px; }
        .lp-footer-left { font-size: 13px; color: var(--ink-4); }
        .lp-footer-links { display: flex; gap: 20px; }
        .lp-footer-links a { font-size: 13px; color: var(--ink-4); transition: color 0.15s; }
        .lp-footer-links a:hover { color: var(--ink); }

        /* ─── Responsive ─── */
        @media (max-width: 1024px) {
          .lp-features-grid { grid-template-columns: 1fr 1fr; }
          .lp-feature-hl { grid-column: span 2; }
        }
        @media (max-width: 768px) {
          .lp-section { padding: 72px 20px; }
          .lp-nav-links { display: none; }
          .lp-hero { padding: calc(var(--nav-h) + 40px) 20px 40px; }
          .lp-metrics { flex-wrap: wrap; gap: 24px; }
          .lp-metric-sep { display: none; }
          .lp-tabs { justify-content: center; }
          .lp-problem-grid, .lp-features-grid, .lp-pricing-grid, .lp-steps { grid-template-columns: 1fr; }
          .lp-feature-hl { grid-column: span 1; flex-direction: column; }
          .lp-pricing-card.featured { transform: none; }
          .lp-built { gap: 16px; }
          .lp-table { font-size: 12px; }
          .lp-table th, .lp-table td { padding: 10px 12px; }
          .ui-stats, .ui-le-stats { grid-template-columns: 1fr 1fr; }
          .ui-nav, .ui-filters { display: none; }
          .lp-footer-inner { flex-direction: column; text-align: center; }
          .ui-chat-suggestions { flex-direction: column; align-items: center; }
        }
      `}</style>

      {/* ═══ NAV ═══ */}
      <nav className={`lp-nav ${navScrolled ? 'scrolled' : ''}`}>
        <div className="lp-nav-inner">
          <a href="#" className="lp-nav-brand">
            <div className="lp-logo-mark">PA</div>
            PrimeStride Atlas
          </a>
          <div className="lp-nav-links">
            <a href="#features">功能</a>
            <a href="#product">產品展示</a>
            <a href="#pricing">方案價格</a>
            <a href="#compare">比較</a>
          </div>
          <div className="lp-nav-actions">
            <a href="/login" className="lp-btn lp-btn-ghost lp-btn-sm">登入</a>
            <a href="/signup" className="lp-btn lp-btn-primary lp-btn-sm">免費開始 →</a>
          </div>
        </div>
      </nav>

      {/* ═══ HERO ═══ */}
      <section className="lp-hero">
        <div className="lp-hero-inner">
          <div className="lp-badge"><span className="lp-pulse" /> 已上線 · 開放團隊申請中</div>
          <h1 className="lp-display">團隊知識，<br />由 <span className="accent">AI</span> 幫你整理</h1>
          <p className="lp-body">上傳文件、用自然語言提問、透過互動圖譜探索知識關聯。PrimeStride Atlas 將散落各處的資料，變成一座可搜尋、可對話的團隊智慧資產。</p>
          <div className="lp-hero-actions">
            <a href={primaryCTA} className="lp-btn lp-btn-primary">{primaryLabel}</a>
            <a href="#product" className="lp-btn lp-btn-outline">看產品展示</a>
          </div>
          <div className="lp-metrics">
            <div className="lp-metric"><div className="lp-metric-val">8+</div><div className="lp-metric-lbl">已索引文件</div></div>
            <div className="lp-metric-sep" />
            <div className="lp-metric"><div className="lp-metric-val">94%</div><div className="lp-metric-lbl">回答準確率</div></div>
            <div className="lp-metric-sep" />
            <div className="lp-metric"><div className="lp-metric-val">&lt;3s</div><div className="lp-metric-lbl">平均回應時間</div></div>
            <div className="lp-metric-sep" />
            <div className="lp-metric"><div className="lp-metric-val">4人</div><div className="lp-metric-lbl">團隊協作中</div></div>
          </div>
        </div>
      </section>

      {/* ═══ SHOWCASE ═══ */}
      <section className="lp-showcase" id="product">
        <div className="lp-showcase-wrap">
          <div className="lp-tabs">
            {['library', 'search', 'chat', 'learning', 'team'].map((s) => (
              <button key={s} className={`lp-tab ${activeScreen === s ? 'active' : ''}`} onClick={() => setActiveScreen(s)}>
                {s === 'library' && '📚 知識庫'}
                {s === 'search' && '🔍 智慧搜尋'}
                {s === 'chat' && '💬 AI 對話'}
                {s === 'learning' && '📊 學習分析'}
                {s === 'team' && '👥 團隊管理'}
              </button>
            ))}
          </div>
          <div className="lp-frame">
            <div className="lp-frame-bar">
              <div className="lp-dot lp-dot-r" /><div className="lp-dot lp-dot-y" /><div className="lp-dot lp-dot-g" />
              <div className="lp-frame-url">{urlMap[activeScreen]}</div>
            </div>

            {/* Screen: Library */}
            <div className={`lp-screen ${activeScreen === 'library' ? 'active' : ''}`}>
              <div className="ui-header"><div className="ui-logo">📚</div><div className="ui-title">PS Atlas</div></div>
              <div className="ui-nav">
                <div className="ui-nav-item active">✦ New</div>
                <div className="ui-nav-item chat">💬 Chat</div>
                <div className="ui-nav-item">🔍 Search</div>
                <div className="ui-nav-item">📊 Learning</div>
                <div className="ui-nav-item">⚙ Admin</div>
                <div className="ui-nav-item">👥 Members</div>
                <div className="ui-nav-item">🗂 Groups</div>
                <div className="ui-nav-item">🔴 Graph</div>
              </div>
              <div className="ui-stats">
                <div className="ui-stat"><div className="ui-stat-num">8</div><div className="ui-stat-lbl">Documents</div></div>
                <div className="ui-stat"><div className="ui-stat-num">47</div><div className="ui-stat-lbl">Total Feedback</div></div>
                <div className="ui-stat"><div className="ui-stat-num">2</div><div className="ui-stat-lbl">Groups</div></div>
              </div>
              <div className="ui-label">Knowledge Library</div>
              {[
                { name: 'AI-PERFORMANCE-VALIDATION', id: 'PS-PV-001', cat: 'strategy' },
                { name: 'PrimeStride Performance Intelligence System', id: 'PPIS-KMS', cat: 'AI Tool' },
                { name: 'PrimeStrideAI 3-Step Client Engagement Flow', id: 'PS-ENGAGE-001', cat: 'Strategy' },
              ].map((doc) => (
                <div className="ui-doc" key={doc.id}>
                  <div><div className="ui-doc-name">{doc.name}</div><div className="ui-doc-meta"><span className="ui-id">{doc.id}</span><span className="ui-pub">published</span><span className="ui-cat">{doc.cat}</span><span className="ui-org">🟢 Org-Wide</span></div></div>
                  <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}><span className="ui-doc-edit">✏ Edit</span><div className="ui-doc-btn">View &amp; Feedback →</div></div>
                </div>
              ))}
            </div>

            {/* Screen: Search */}
            <div className={`lp-screen ${activeScreen === 'search' ? 'active' : ''}`}>
              <div className="ui-header"><span style={{ fontSize: '24px' }}>🔍</span><div className="ui-title">Search</div></div>
              <p style={{ fontSize: '13px', color: 'var(--ui-muted)', marginBottom: '24px' }}>Search by keywords or use AI to search by meaning</p>
              <div className="ui-search-card">
                <div className="ui-modes"><div className="ui-mode active">🔮 Hybrid</div><div className="ui-mode">🟦 Keyword</div><div className="ui-mode">🔴 Semantic</div></div>
                <p style={{ fontSize: '11.5px', color: 'var(--ui-muted)', marginBottom: '16px' }}>Combines keyword matching + AI meaning for the best results</p>
                <div style={{ fontSize: '12px', color: 'var(--ui-muted)', marginBottom: '6px' }}>Describe what you&apos;re looking for</div>
                <input className="ui-input" placeholder="e.g., how do we keep clients happy and engaged?" readOnly />
                <div className="ui-filters"><div className="ui-filter">Doc Type ▾</div><div className="ui-filter">Domain ▾</div><div className="ui-filter">AI Maturity ▾</div><div className="ui-filter">Status ▾</div><div className="ui-filter">Tag</div></div>
                <div className="ui-tags"><span style={{ fontSize: '11px', color: 'var(--ui-muted)', marginRight: '4px' }}>Quick tags:</span><span className="ui-tag">construction</span><span className="ui-tag">saas</span><span className="ui-tag">platform</span><span className="ui-tag">documentation</span><span className="ui-tag">taiwan</span></div>
                <div className="ui-search-btn">🔮 Hybrid Search →</div>
              </div>
            </div>

            {/* Screen: Chat */}
            <div className={`lp-screen-chat ${activeScreen === 'chat' ? 'active' : ''}`}>
              <div className="ui-chat-header">
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <div className="ui-chat-avatar">🤖</div>
                  <div><div style={{ fontSize: '14px', fontWeight: 700, color: 'var(--ui-text)' }}>AI Assistant</div><div style={{ fontSize: '11px', color: 'var(--ui-muted)' }}>Ask questions about your knowledge base</div></div>
                </div>
                <div style={{ display: 'flex', gap: '8px' }}><div className="ui-header-btn" style={{ background: 'var(--brand)' }}>📚 Library</div><div className="ui-header-btn" style={{ background: '#e85d75' }}>🔴 AI Graph</div></div>
              </div>
              <div className="ui-chat-body">
                <div style={{ fontSize: '48px', marginBottom: '16px' }}>🤖</div>
                <h3 style={{ fontSize: '17px', fontWeight: 700, color: 'var(--ui-text)', marginBottom: '8px' }}>Ask me anything about your documents</h3>
                <p style={{ fontSize: '13px', color: 'var(--ui-muted)', textAlign: 'center', maxWidth: '400px', marginBottom: '24px', lineHeight: 1.6 }}>I can search through your knowledge base and provide answers with citations.</p>
                <div className="ui-chat-suggestions">
                  {['What documents do we have about sales?', 'How do we engage with clients?', 'What is our pitch narrative?', 'Summarize our key strategies'].map((q) => (<div className="ui-chat-suggestion" key={q}>{q}</div>))}
                </div>
              </div>
              <div className="ui-chat-input-bar">
                <input className="ui-chat-input" placeholder="Ask a question about your documents..." readOnly />
                <div className="ui-chat-send">Send →</div>
              </div>
            </div>

            {/* Screen: Learning */}
            <div className={`lp-screen ${activeScreen === 'learning' ? 'active' : ''}`}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <span style={{ fontSize: '24px' }}>📊</span>
                  <div><div style={{ fontSize: '20px', fontWeight: 700, color: 'var(--ui-text)' }}>Learning Dashboard</div><div style={{ fontSize: '12px', color: 'var(--ui-muted)' }}>Feedback analytics per document — identify what needs improvement</div></div>
                </div>
                <div style={{ display: 'flex', gap: '8px' }}><div className="ui-team-btn">← Library</div><div className="ui-team-btn primary">Admin →</div></div>
              </div>
              <div className="ui-le-stats">
                <div className="ui-le-stat"><div className="ui-le-stat-label">📄 Total Documents</div><div className="ui-le-stat-val">8</div></div>
                <div className="ui-le-stat"><div className="ui-le-stat-label">💬 Total Feedback</div><div className="ui-le-stat-val" style={{ color: '#a78bfa' }}>47</div></div>
                <div className="ui-le-stat"><div className="ui-le-stat-label">👍 Helpful</div><div className="ui-le-stat-val" style={{ color: '#4ade80' }}>38</div></div>
                <div className="ui-le-stat"><div className="ui-le-stat-label">👎 Not Helpful</div><div className="ui-le-stat-val" style={{ color: '#f87171' }}>9</div></div>
                <div className="ui-le-stat"><div className="ui-le-stat-label">📊 Helpfulness Rate</div><div className="ui-le-stat-val" style={{ color: '#4ade80' }}>80.9%</div></div>
              </div>
              <div style={{ marginBottom: '6px' }}><div style={{ fontSize: '15px', fontWeight: 700, color: 'var(--ui-text)' }}>Documents Ranked by Need for Improvement</div><div style={{ fontSize: '12px', color: 'var(--ui-muted)' }}>Documents with the most negative feedback appear first</div></div>
              {[
                { name: 'AI-PERFORMANCE-VALIDATION', id: 'PS-PV-001', total: 18, helpful: 15, notHelpful: 3, comment: '「步驟說明可以再更詳細一些」' },
                { name: 'PERFORMANCE-AWARE-KMS', id: 'PS-PAKMS', total: 14, helpful: 11, notHelpful: 3, comment: '「希望增加更多整合範例」' },
              ].map((doc) => (
                <div className="ui-le-doc" key={doc.id}>
                  <div className="ui-le-doc-top">
                    <div><div className="ui-doc-name">{doc.name}</div><div className="ui-doc-meta"><span className="ui-id">{doc.id}</span><span style={{ color: 'var(--ui-muted)', fontSize: '11px' }}>v1.0</span><span className="ui-pub">published</span></div></div>
                    <div className="ui-doc-btn" style={{ background: 'var(--ui-card)', border: '1px solid var(--ui-border)', color: 'var(--ui-text)' }}>View →</div>
                  </div>
                  <div className="ui-le-feedback"><span>💬 Total: <b>{doc.total}</b></span><span>👍 Helpful: <b style={{ color: '#4ade80' }}>{doc.helpful}</b></span><span>👎 Not helpful: <b style={{ color: '#f87171' }}>{doc.notHelpful}</b></span></div>
                  <div className="ui-le-negative"><div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--ui-text)', marginBottom: '4px' }}>💬 Negative Feedback Comments</div><div style={{ fontSize: '12px', color: 'var(--ui-muted)' }}>{doc.comment}</div></div>
                </div>
              ))}
            </div>

            {/* Screen: Team */}
            <div className={`lp-screen ${activeScreen === 'team' ? 'active' : ''}`}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}><h2 style={{ fontSize: '20px', fontWeight: 700, color: 'var(--ui-text)' }}>Team Settings</h2><div style={{ display: 'flex', gap: '8px' }}><div className="ui-team-btn">← Back to Library</div><div className="ui-team-btn primary">+ Invite Member</div></div></div>
              <p style={{ fontSize: '13px', color: 'var(--ui-muted)', marginBottom: '24px' }}>Manage your organization members</p>
              <div style={{ fontSize: '14px', fontWeight: 600, color: 'var(--ui-text)', marginBottom: '14px' }}>Team Members (4)</div>
              {[
                { email: 'chen.wei@company.com', date: '1/30/2026', role: 'owner', you: true },
                { email: 'lin.mei@company.com', date: '2/6/2026', role: 'member', you: false },
                { email: 'wang.jun@company.com', date: '2/11/2026', role: 'member', you: false },
                { email: 'huang.li@company.com', date: '2/11/2026', role: 'admin', you: false },
              ].map((m) => (
                <div className="ui-member" key={m.email}>
                  <div><div className="ui-member-email">{m.email} {m.you && <span className="ui-you">You</span>}</div><div className="ui-member-date">Joined {m.date}</div></div>
                  <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                    <span className={`ui-role ui-role-${m.role}`}>{m.role}{m.role !== 'owner' && ' ▾'}</span>
                    {!m.you && <div className="ui-remove">Remove</div>}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ═══ BUILT WITH ═══ */}
      <div className="lp-built">
        <span className="lp-built-label">技術架構</span>
        {[['▲', 'Next.js'], ['⚡', 'Supabase'], ['🤖', 'OpenAI GPT-4'], ['🔐', 'Clerk Auth'], ['📧', 'Resend']].map(([icon, name]) => (
          <div className="lp-built-item" key={name}><div className="lp-built-icon">{icon}</div> {name}</div>
        ))}
      </div>

      {/* ═══ PROBLEM ═══ */}
      <section className="lp-section lp-section-dark">
        <div className="lp-container">
          <div className="lp-section-header"><div className="lp-label">問題所在</div><h2 className="lp-heading">團隊知識正在流失</h2><p className="lp-desc">重要資訊散落在 Google Docs、Notion、Slack 和同事的腦海中。每當有人離職，他們的知識也跟著離開。</p></div>
          <div className="lp-problem-grid">
            {[
              { icon: '⏳', title: '花太多時間找資料', desc: '團隊成員花費 20% 的工作時間尋找組織內已經存在的資訊，不斷重複搜尋、反覆詢問。', stat: '20%' },
              { icon: '🔄', title: '重複造輪子', desc: '沒有統一的知識庫，團隊不斷重新製作已經存在的文件、回答已經回答過的問題。', stat: '40%' },
              { icon: '🚪', title: '知識隨人離開', desc: '資深同事離職時，多年累積的經驗與 know-how 也跟著走了。沒有系統留住這些寶貴資產。', stat: '致命' },
            ].map((p) => (
              <div className="lp-problem-card fade-in" key={p.title}><div className="lp-problem-icon">{p.icon}</div><h3>{p.title}</h3><p>{p.desc}</p><div className="lp-problem-stat">{p.stat}</div></div>
            ))}
          </div>
        </div>
      </section>

      {/* ═══ FEATURES ═══ */}
      <section className="lp-section" id="features">
        <div className="lp-container">
          <div className="lp-section-header"><div className="lp-label">核心功能</div><h2 className="lp-heading">管理團隊知識所需的一切</h2><p className="lp-desc">從文件上傳到 AI 驅動的搜尋，再到視覺化的知識探索。</p></div>
          <div className="lp-features-grid">
            {[
              { icon: '🔍', title: '語意混合搜尋', desc: '用自然語言提問。混合搜尋結合語意理解與關鍵字比對，精準找到你需要的答案。' },
              { icon: '💬', title: 'AI 對話助理', desc: '與你的文件對話。基於 RAG 架構的 AI 提供有根據的回答，每個答案都附帶來源引用。' },
              { icon: '🏷️', title: '自動標籤分類', desc: '文件上傳後由 GPT-4o-mini 自動分類與標記，不需要手動整理檔案結構。' },
              { icon: '🌐', title: '知識圖譜', desc: '透過互動式視覺圖譜，探索文件之間的關聯。發現你從未注意到的知識連結。' },
              { icon: '📊', title: '數據分析儀表板', desc: '追蹤文件使用、搜尋模式與團隊參與度。瞭解哪些知識對團隊最重要。' },
              { icon: '🔐', title: '角色權限控制', desc: '管理員擁有完整的分析與管理功能。一般成員則獲得簡潔專注的使用體驗。' },
            ].map((f) => (
              <div className="lp-feature-card fade-in" key={f.title}><div className="lp-feature-icon">{f.icon}</div><h3>{f.title}</h3><p>{f.desc}</p></div>
            ))}
            <div className="lp-feature-card lp-feature-hl fade-in"><div className="lp-feature-icon">👥</div><div><h3>為團隊而生 — 從第一天就內建組織架構</h3><p>邀請團隊成員、管理角色權限、確保知識安全。每個組織獨立運作，資料完全隔離。Owner、Admin、Member 三層權限，靈活配置。</p></div></div>
          </div>
        </div>
      </section>

      {/* ═══ COMPARISON ═══ */}
      <section className="lp-section lp-section-alt" id="compare">
        <div className="lp-container">
          <div className="lp-section-header"><div className="lp-label">方案比較</div><h2 className="lp-heading">Atlas 與傳統方案的差異</h2><p className="lp-desc">不只是另一個資料夾系統，而是團隊的智慧知識層。</p></div>
          <table className="lp-table">
            <thead><tr><th>功能</th><th>Google Drive / Notion</th><th>PrimeStride Atlas ✦</th></tr></thead>
            <tbody>
              <tr><td>搜尋方式</td><td>僅支援關鍵字精確比對</td><td>語意 + 關鍵字混合搜尋</td></tr>
              <tr><td>AI 對話</td><td><span className="lp-cross">✕</span> 不支援</td><td><span className="lp-check">✓</span> RAG 驅動，附來源引用</td></tr>
              <tr><td>自動整理</td><td>手動建立資料夾與標籤</td><td>上傳即自動 AI 標籤分類</td></tr>
              <tr><td>知識視覺化</td><td><span className="lp-cross">✕</span> 無此功能</td><td><span className="lp-check">✓</span> 互動式知識圖譜</td></tr>
              <tr><td>權限管理</td><td>基本的分享功能</td><td>Owner / Admin / Member 三層角色</td></tr>
              <tr><td>使用分析</td><td>基本或無</td><td>完整儀表板，含使用趨勢</td></tr>
              <tr><td>繁體中文</td><td>介面支援，內容無優化</td><td>全面原生繁體中文支援</td></tr>
            </tbody>
          </table>
        </div>
      </section>

      {/* ═══ HOW IT WORKS ═══ */}
      <section className="lp-section">
        <div className="lp-container">
          <div className="lp-section-header"><div className="lp-label">如何開始</div><h2 className="lp-heading">幾分鐘內就能上手</h2><p className="lp-desc">不需要複雜設定，不需要工程師。</p></div>
          <div className="lp-steps">
            {[
              { title: '建立你的工作空間', desc: '註冊帳號、為組織命名、邀請團隊成員。你自動成為管理員，角色權限立即生效。' },
              { title: '上傳文件', desc: '直接拖放檔案上傳。AI 自動標記與索引所有內容，知識庫立即可以搜尋。' },
              { title: '開始提問', desc: '用語意搜尋或與 AI 對話來找答案。探索知識圖譜，與團隊分享洞見。' },
            ].map((s) => (<div className="lp-step fade-in" key={s.title}><h3>{s.title}</h3><p>{s.desc}</p></div>))}
          </div>
        </div>
      </section>

      {/* ═══ PRICING ═══ */}
      <section className="lp-section lp-section-alt" id="pricing">
        <div className="lp-container">
          <div className="lp-section-header center"><div className="lp-label">方案價格</div><h2 className="lp-heading">簡單透明的價格</h2><p className="lp-desc">免費開始。團隊成長時再升級。</p></div>
          <div className="lp-pricing-grid">
            <div className="lp-pricing-card fade-in">
              <div className="lp-tier">入門方案</div><div className="lp-price">$0<span>/月</span></div><div className="lp-price-note">小型團隊永久免費</div>
              <ul className="lp-feat-list"><li>最多 50 份文件</li><li>語意搜尋</li><li>AI 對話（每月 100 則）</li><li>1 位使用者</li></ul>
              <a href="/signup" className="lp-btn lp-btn-outline" style={{ width: '100%', justifyContent: 'center' }}>免費開始</a>
            </div>
            <div className="lp-pricing-card featured fade-in">
              <div className="lp-pop-badge">最受歡迎</div>
              <div className="lp-tier">團隊方案</div><div className="lp-price">$29<span>/月</span></div><div className="lp-price-note">每個工作空間，按月計費</div>
              <ul className="lp-feat-list"><li>無限文件數量</li><li>語意 + 關鍵字混合搜尋</li><li>無限 AI 對話</li><li>最多 10 位成員</li><li>知識圖譜</li><li>分析儀表板</li></ul>
              <a href="/signup" className="lp-btn lp-btn-primary" style={{ width: '100%', justifyContent: 'center' }}>免費試用 →</a>
            </div>
            <div className="lp-pricing-card fade-in">
              <div className="lp-tier">企業方案</div><div className="lp-price">客製</div><div className="lp-price-note">適合大型組織</div>
              <ul className="lp-feat-list"><li>團隊方案所有功能</li><li>無限成員數</li><li>SSO / SAML 單一登入</li><li>稽核日誌</li><li>優先支援</li><li>客製化整合</li></ul>
              <a href="mailto:contact@primestrideatlas.com" className="lp-btn lp-btn-outline" style={{ width: '100%', justifyContent: 'center' }}>聯繫我們</a>
            </div>
          </div>
        </div>
      </section>

      {/* ═══ CTA ═══ */}
      <section className="lp-cta">
        <h2 className="lp-heading">準備好整理團隊的知識了嗎？</h2>
        <p className="lp-desc">免費開始。不需信用卡。五分鐘內完成設定。</p>
        <div className="lp-cta-actions">
          <a href={primaryCTA} className="lp-btn lp-btn-warm">{primaryLabel}</a>
          <a href="mailto:contact@primestrideatlas.com" className="lp-btn lp-btn-white">與我們聊聊</a>
        </div>
        <div className="lp-cta-note">contact@primestrideatlas.com · 不需信用卡 · 隨時可取消</div>
      </section>

      {/* ═══ FOOTER ═══ */}
      <footer className="lp-footer">
        <div className="lp-footer-inner">
          <div className="lp-footer-left">&copy; 2026 PrimeStride Atlas. All rights reserved.</div>
          <div className="lp-footer-links">
            <a href="/docs">使用文件</a>
            <a href="/privacy">隱私權政策</a>
            <a href="/terms">服務條款</a>
          </div>
        </div>
      </footer>
    </>
  );
}