'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/AuthContext';

export default function LandingPage() {
  const { user, isLoading } = useAuth();
  const router = useRouter();
  const [navScrolled, setNavScrolled] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => {
    if (!isLoading && user) { router.replace('/library'); }
  }, [user, isLoading, router]);

  useEffect(() => {
    if (isLoading || user) return;
    const handleScroll = () => setNavScrolled(window.scrollY > 20);
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, [isLoading, user]);

  useEffect(() => {
    if (isLoading || user) return;
    const observer = new IntersectionObserver(
      (entries) => { entries.forEach((entry) => { if (entry.isIntersecting) { (entry.target as HTMLElement).style.opacity = '1'; (entry.target as HTMLElement).style.transform = 'translateY(0)'; } }); },
      { threshold: 0.08, rootMargin: '0px 0px -30px 0px' }
    );
    document.querySelectorAll('.fi').forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, [isLoading, user]);

  if (isLoading || user) return null;

  return (
    <>
      <style jsx global>{`
        @import url('https://fonts.googleapis.com/css2?family=Noto+Sans+TC:wght@300;400;500;600;700;900&family=Sora:wght@300;400;500;600;700;800&display=swap');

        :root {
          --brand: #7C3AED; --brand-d: #5B21B6; --brand-l: #A78BFA; --brand-glow: rgba(124,58,237,0.12);
          --ink: #0F172A; --ink2: #1E293B; --ink3: #475569; --ink4: #94A3B8;
          --surf: #FFFFFF; --surf2: #F8FAFC; --surf3: #F1F5F9;
          --bdr: #E2E8F0; --bdr-l: #F1F5F9;
          --green: #059669; --blue: #2563EB; --amber: #D97706; --red: #DC2626;
          --mw: 1140px; --r: 14px; --r-lg: 20px;
        }

        * { margin: 0; padding: 0; box-sizing: border-box; }
        html { scroll-behavior: smooth; -webkit-font-smoothing: antialiased; }
        body { font-family: 'Noto Sans TC', 'Sora', system-ui, sans-serif; color: var(--ink); background: var(--surf); line-height: 1.7; overflow-x: hidden; }
        a { color: inherit; text-decoration: none; }
        .fi { opacity: 0; transform: translateY(24px); transition: opacity 0.5s ease, transform 0.5s ease; }

        /* ─── Nav ─── */
        .nav { position: fixed; top: 0; left: 0; right: 0; z-index: 100; height: 64px; background: rgba(255,255,255,0.92); backdrop-filter: blur(20px); -webkit-backdrop-filter: blur(20px); border-bottom: 1px solid transparent; transition: all 0.3s; }
        .nav.sc { border-color: var(--bdr-l); box-shadow: 0 1px 20px rgba(0,0,0,0.04); }
        .nav-in { max-width: var(--mw); margin: 0 auto; padding: 0 24px; display: flex; align-items: center; justify-content: space-between; height: 100%; }
        .nav-brand { display: flex; align-items: center; gap: 10px; font-weight: 700; font-size: 17px; font-family: 'Sora', sans-serif; }
        .nav-mark { width: 34px; height: 34px; border-radius: 10px; background: linear-gradient(135deg, var(--brand), var(--brand-l)); display: flex; align-items: center; justify-content: center; color: #fff; font-size: 16px; box-shadow: 0 2px 10px rgba(124,58,237,0.3); }
        .nav-links { display: flex; align-items: center; gap: 4px; }
        .nav-links a { padding: 7px 16px; font-size: 14px; font-weight: 500; color: var(--ink3); border-radius: 8px; transition: all 0.15s; }
        .nav-links a:hover { color: var(--ink); background: var(--surf2); }
        .nav-acts { display: flex; align-items: center; gap: 10px; }

        .mob-tog { display: none; background: none; border: none; cursor: pointer; width: 40px; height: 40px; align-items: center; justify-content: center; }
        .mob-tog span { display: block; width: 20px; height: 2px; background: var(--ink); border-radius: 2px; position: relative; transition: all 0.3s; }
        .mob-tog span::before, .mob-tog span::after { content: ''; position: absolute; left: 0; width: 100%; height: 2px; background: var(--ink); border-radius: 2px; transition: all 0.3s; }
        .mob-tog span::before { top: -7px; } .mob-tog span::after { top: 7px; }
        .mob-tog span.open { background: transparent; }
        .mob-tog span.open::before { top: 0; transform: rotate(45deg); }
        .mob-tog span.open::after { top: 0; transform: rotate(-45deg); }
        .mob-menu { display: none; position: fixed; top: 64px; left: 0; right: 0; background: white; border-bottom: 1px solid var(--bdr); padding: 16px 24px; z-index: 99; flex-direction: column; gap: 8px; box-shadow: 0 8px 30px rgba(0,0,0,0.08); }
        .mob-menu.show { display: flex; }
        .mob-menu a { padding: 12px 16px; border-radius: 8px; font-size: 15px; font-weight: 500; color: var(--ink2); }

        /* ─── Btns ─── */
        .btn { display: inline-flex; align-items: center; gap: 8px; padding: 10px 22px; border-radius: 10px; font-weight: 600; font-size: 14px; transition: all 0.2s; cursor: pointer; border: none; font-family: inherit; }
        .btn-p { background: var(--brand); color: #fff; box-shadow: 0 2px 12px rgba(124,58,237,0.3); }
        .btn-p:hover { background: var(--brand-d); transform: translateY(-1px); box-shadow: 0 4px 20px rgba(124,58,237,0.35); }
        .btn-o { background: transparent; color: var(--ink2); border: 1.5px solid var(--bdr); }
        .btn-o:hover { border-color: var(--brand); color: var(--brand); background: var(--brand-glow); }
        .btn-w { background: rgba(255,255,255,0.15); color: #fff; border: 1.5px solid rgba(255,255,255,0.25); backdrop-filter: blur(10px); }
        .btn-w:hover { background: rgba(255,255,255,0.25); }
        .btn-lg { padding: 14px 32px; font-size: 16px; border-radius: 12px; }

        /* ─── Hero ─── */
        .hero { padding: 140px 24px 90px; text-align: center; position: relative; overflow: hidden; }
        .hero::before { content: ''; position: absolute; top: -200px; left: 50%; transform: translateX(-50%); width: 900px; height: 900px; background: radial-gradient(circle, rgba(124,58,237,0.06) 0%, transparent 70%); pointer-events: none; }
        .hero-in { max-width: 740px; margin: 0 auto; position: relative; z-index: 1; }
        .hero-badge { display: inline-flex; align-items: center; gap: 8px; padding: 6px 16px 6px 8px; border-radius: 100px; background: var(--brand-glow); border: 1px solid rgba(124,58,237,0.15); font-size: 13px; font-weight: 600; color: var(--brand); margin-bottom: 28px; }
        .hero-badge .dot { width: 8px; height: 8px; border-radius: 50%; background: var(--green); animation: pulse 2s infinite; }
        @keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.4; } }
        .hero h1 { font-family: 'Sora', 'Noto Sans TC', sans-serif; font-size: clamp(36px, 5.5vw, 54px); font-weight: 800; line-height: 1.18; color: var(--ink); margin-bottom: 22px; letter-spacing: -0.02em; }
        .hero h1 .hl { background: linear-gradient(135deg, var(--brand), var(--brand-l)); -webkit-background-clip: text; -webkit-text-fill-color: transparent; }
        .hero-sub { font-size: 18px; color: var(--ink3); max-width: 580px; margin: 0 auto 36px; line-height: 1.8; }
        .hero-acts { display: flex; gap: 12px; justify-content: center; flex-wrap: wrap; margin-bottom: 56px; }
        .hero-pills { display: flex; gap: 10px; justify-content: center; flex-wrap: wrap; }
        .hero-pill { display: flex; align-items: center; gap: 6px; padding: 8px 18px; border-radius: 100px; background: var(--surf2); border: 1px solid var(--bdr); font-size: 13px; font-weight: 600; color: var(--ink2); }
        .hero-pill span { font-size: 16px; }

        /* ─── Section ─── */
        .sec { padding: 100px 24px; }
        .sec-dark { background: var(--ink); color: #fff; }
        .sec-alt { background: var(--surf2); }
        .con { max-width: var(--mw); margin: 0 auto; }
        .sec-hd { max-width: 580px; margin-bottom: 52px; }
        .sec-hd.ctr { margin-left: auto; margin-right: auto; text-align: center; }
        .sec-label { font-size: 13px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.08em; color: var(--brand); margin-bottom: 10px; }
        .sec-dark .sec-label { color: var(--brand-l); }
        .sec-title { font-family: 'Sora', 'Noto Sans TC', sans-serif; font-size: clamp(26px, 4vw, 36px); font-weight: 700; line-height: 1.25; margin-bottom: 14px; letter-spacing: -0.01em; }
        .sec-dark .sec-title { color: #fff; }
        .sec-desc { font-size: 16px; color: var(--ink3); line-height: 1.7; }
        .sec-dark .sec-desc { color: rgba(255,255,255,0.5); }

        /* ─── Problem ─── */
        .prob-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 20px; }
        .prob-card { padding: 28px; border-radius: var(--r); background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.08); transition: all 0.25s; }
        .prob-card:hover { background: rgba(255,255,255,0.07); border-color: rgba(255,255,255,0.15); }
        .prob-icon { font-size: 32px; margin-bottom: 14px; }
        .prob-card h3 { font-size: 16px; font-weight: 700; margin-bottom: 6px; color: #fff; }
        .prob-card p { font-size: 14px; color: rgba(255,255,255,0.5); line-height: 1.6; }
        .prob-stat { margin-top: 12px; font-family: 'Sora', sans-serif; font-size: 28px; font-weight: 800; color: var(--brand-l); }

        /* ─── Pillar ─── */
        .pillar { display: grid; grid-template-columns: 1fr 1fr; gap: 60px; align-items: center; }
        .pillar.rev { direction: rtl; }
        .pillar.rev > * { direction: ltr; }
        .pillar-label { font-size: 12px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.1em; margin-bottom: 8px; }
        .pillar-title { font-family: 'Sora', 'Noto Sans TC', sans-serif; font-size: clamp(22px, 3vw, 30px); font-weight: 700; line-height: 1.3; margin-bottom: 14px; }
        .pillar-desc { font-size: 15px; color: var(--ink3); line-height: 1.7; margin-bottom: 20px; }
        .pillar-features { display: flex; flex-direction: column; gap: 10px; }
        .pillar-feat { display: flex; align-items: flex-start; gap: 10px; font-size: 14px; color: var(--ink2); line-height: 1.5; }
        .pillar-feat-icon { width: 28px; height: 28px; border-radius: 8px; display: flex; align-items: center; justify-content: center; font-size: 14px; flex-shrink: 0; margin-top: 1px; }
        .pillar-visual { border-radius: var(--r-lg); overflow: hidden; }

        /* Knowledge Card */
        .kv-card { background: var(--surf2); border: 1px solid var(--bdr); border-radius: var(--r-lg); padding: 24px; }
        .kv-row { display: flex; gap: 12px; margin-bottom: 12px; }
        .kv-doc { flex: 1; padding: 14px; border-radius: 10px; background: white; border: 1px solid var(--bdr-l); }
        .kv-doc-icon { font-size: 20px; margin-bottom: 6px; }
        .kv-doc-title { font-size: 12px; font-weight: 700; color: var(--ink); margin-bottom: 2px; }
        .kv-doc-meta { font-size: 10px; color: var(--ink4); }
        .kv-tag { display: inline-block; padding: 2px 8px; border-radius: 4px; font-size: 10px; font-weight: 600; margin-right: 4px; margin-top: 4px; }
        .kv-search { display: flex; align-items: center; gap: 8px; padding: 12px 16px; background: white; border: 1px solid var(--bdr); border-radius: 10px; margin-bottom: 12px; }
        .kv-search-icon { font-size: 16px; }
        .kv-search-text { font-size: 13px; color: var(--ink4); }
        .kv-chat { padding: 12px 16px; background: var(--brand-glow); border: 1px solid rgba(124,58,237,0.15); border-radius: 10px; font-size: 13px; color: var(--ink2); line-height: 1.5; }

        /* Writing Card */
        .wv-card { background: var(--surf2); border: 1px solid var(--bdr); border-radius: var(--r-lg); padding: 24px; }
        .wv-toolbar { display: flex; gap: 6px; flex-wrap: wrap; margin-bottom: 14px; }
        .wv-btn { padding: 5px 10px; border-radius: 6px; font-size: 11px; font-weight: 600; background: white; border: 1px solid var(--bdr-l); color: var(--ink3); }
        .wv-btn.active { background: var(--brand); color: white; border-color: var(--brand); }
        .wv-content { padding: 16px; background: white; border: 1px solid var(--bdr-l); border-radius: 10px; margin-bottom: 12px; font-size: 13px; color: var(--ink2); line-height: 1.7; }
        .wv-preview { padding: 14px; background: #F0FDF4; border: 1px solid #BBF7D0; border-radius: 10px; font-size: 13px; color: #166534; line-height: 1.6; }
        .wv-preview-label { font-size: 11px; font-weight: 700; color: var(--green); margin-bottom: 6px; }

        /* ERP Card */
        .ev-card { background: linear-gradient(135deg, #0F172A 0%, #1E1B4B 100%); border-radius: var(--r-lg); padding: 24px; color: white; }
        .ev-input { background: rgba(255,255,255,0.08); border: 1px solid rgba(255,255,255,0.12); border-radius: 10px; padding: 14px 18px; color: rgba(255,255,255,0.9); font-size: 14px; margin-bottom: 14px; font-style: italic; }
        .ev-arrow { text-align: center; font-size: 20px; margin-bottom: 14px; color: var(--brand-l); }
        .ev-fields { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin-bottom: 14px; }
        .ev-field { background: rgba(255,255,255,0.05); border-radius: 6px; padding: 8px 12px; }
        .ev-field-label { font-size: 10px; color: rgba(255,255,255,0.4); font-weight: 600; }
        .ev-field-val { font-size: 13px; color: rgba(255,255,255,0.9); font-weight: 600; }
        .ev-submit { padding: 10px; border-radius: 8px; background: var(--brand); color: white; text-align: center; font-size: 13px; font-weight: 700; }
        .ev-stats { display: flex; gap: 8px; margin-top: 14px; }
        .ev-stat { flex: 1; padding: 8px; background: rgba(255,255,255,0.04); border-radius: 6px; text-align: center; }
        .ev-stat-val { font-size: 18px; font-weight: 800; font-family: 'Sora'; }
        .ev-stat-label { font-size: 10px; color: rgba(255,255,255,0.4); }

        /* ─── Why Atlas ─── */
        .why-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 20px; }
        .why-card { padding: 28px; border-radius: var(--r); background: white; border: 1px solid var(--bdr); text-align: center; transition: all 0.25s; }
        .why-card:hover { border-color: var(--brand); box-shadow: 0 8px 30px rgba(124,58,237,0.06); transform: translateY(-2px); }
        .why-icon { font-size: 32px; margin-bottom: 12px; }
        .why-card h3 { font-size: 15px; font-weight: 700; margin-bottom: 6px; }
        .why-card p { font-size: 13px; color: var(--ink3); line-height: 1.5; }

        /* ─── Steps ─── */
        .steps { display: grid; grid-template-columns: repeat(3, 1fr); gap: 24px; counter-reset: step; }
        .step { padding: 28px; border-radius: var(--r); background: white; border: 1px solid var(--bdr); counter-increment: step; position: relative; }
        .step::before { content: counter(step); position: absolute; top: 20px; right: 20px; width: 32px; height: 32px; border-radius: 50%; background: var(--brand-glow); color: var(--brand); display: flex; align-items: center; justify-content: center; font-family: 'Sora'; font-weight: 800; font-size: 14px; }
        .step h3 { font-size: 16px; font-weight: 700; margin-bottom: 8px; padding-right: 40px; }
        .step p { font-size: 14px; color: var(--ink3); line-height: 1.6; }

        /* ─── Pricing ─── */
        .price-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 20px; }
        .price-card { padding: 32px; border-radius: var(--r-lg); border: 1px solid var(--bdr); background: white; }
        .price-card.pop { border: 2px solid var(--brand); position: relative; box-shadow: 0 8px 40px rgba(124,58,237,0.1); }
        .price-pop { position: absolute; top: -12px; left: 50%; transform: translateX(-50%); padding: 4px 16px; border-radius: 100px; background: var(--brand); color: white; font-size: 12px; font-weight: 700; white-space: nowrap; }
        .price-tier { font-size: 14px; font-weight: 600; color: var(--ink3); margin-bottom: 8px; }
        .price-val { font-family: 'Sora'; font-size: 42px; font-weight: 800; color: var(--ink); margin-bottom: 4px; }
        .price-val span { font-size: 16px; font-weight: 500; color: var(--ink4); }
        .price-note { font-size: 13px; color: var(--ink4); margin-bottom: 24px; }
        .price-list { list-style: none; padding: 0; margin-bottom: 24px; }
        .price-list li { padding: 6px 0; font-size: 14px; color: var(--ink2); }
        .price-list li::before { content: '✓ '; color: var(--green); font-weight: 700; }

        /* ─── CTA ─── */
        .cta { padding: 100px 24px; text-align: center; background: linear-gradient(135deg, var(--brand) 0%, var(--brand-d) 100%); color: #fff; }
        .cta h2 { font-family: 'Sora', 'Noto Sans TC'; font-size: clamp(28px, 4vw, 38px); font-weight: 700; margin-bottom: 14px; }
        .cta p { font-size: 16px; color: rgba(255,255,255,0.7); margin-bottom: 32px; }
        .cta-acts { display: flex; gap: 12px; justify-content: center; flex-wrap: wrap; margin-bottom: 20px; }
        .cta-note { font-size: 13px; color: rgba(255,255,255,0.4); }

        /* ─── Footer ─── */
        .foot { padding: 24px; border-top: 1px solid var(--bdr); }
        .foot-in { max-width: var(--mw); margin: 0 auto; display: flex; align-items: center; justify-content: space-between; }
        .foot-l { font-size: 13px; color: var(--ink4); }
        .foot-links { display: flex; gap: 20px; }
        .foot-links a { font-size: 13px; color: var(--ink4); }
        .foot-links a:hover { color: var(--brand); }

        /* ─── Responsive ─── */
        @media (max-width: 768px) {
          .nav-links, .nav-acts .btn-o { display: none; }
          .mob-tog { display: flex; }
          .hero h1 { font-size: 32px; }
          .hero-sub { font-size: 16px; }
          .pillar, .pillar.rev { grid-template-columns: 1fr; gap: 32px; }
          .pillar.rev { direction: ltr; }
          .prob-grid, .why-grid, .steps, .price-grid { grid-template-columns: 1fr; }
          .why-grid { grid-template-columns: 1fr 1fr; }
          .ev-fields { grid-template-columns: 1fr; }
        }
      `}</style>

      {/* ═══ NAV — matches scroll order ═══ */}
      <nav className={`nav ${navScrolled ? 'sc' : ''}`}>
        <div className="nav-in">
          <a href="/" className="nav-brand"><div className="nav-mark">📚</div> PrimeStride Atlas</a>
          <div className="nav-links">
            <a href="#problem">痛點</a>
            <a href="#platform">平台功能</a>
            <a href="#why">為什麼選我們</a>
            <a href="#pricing">價格</a>
            <a href="/contact">聯繫我們</a>
          </div>
          <div className="nav-acts">
            <a href="/login" className="btn btn-o">登入</a>
            <a href="/signup" className="btn btn-p">免費開始 →</a>
            <button className="mob-tog" onClick={() => setMobileMenuOpen(!mobileMenuOpen)}><span className={mobileMenuOpen ? 'open' : ''} /></button>
          </div>
        </div>
      </nav>
      <div className={`mob-menu ${mobileMenuOpen ? 'show' : ''}`}>
        <a href="#problem" onClick={() => setMobileMenuOpen(false)}>痛點</a>
        <a href="#platform" onClick={() => setMobileMenuOpen(false)}>平台功能</a>
        <a href="#why" onClick={() => setMobileMenuOpen(false)}>為什麼選我們</a>
        <a href="#pricing" onClick={() => setMobileMenuOpen(false)}>價格</a>
        <a href="/login" onClick={() => setMobileMenuOpen(false)}>登入</a>
        <a href="/signup" className="btn btn-p" style={{ justifyContent: 'center' }}>免費開始 →</a>
      </div>

      {/* ═══ 1. HERO — Big picture ═══ */}
      <section className="hero">
        <div className="hero-in">
          <div className="hero-badge"><span className="dot" /> 已上線 · 台灣企業智慧化平台</div>
          <h1>你的企業知識<br />值得一個<span className="hl"> AI 平台</span></h1>
          <p className="hero-sub">文件管理、智慧搜尋、AI 寫作、自然語言表單申請 — 從知識到流程，一個平台全搞定。專為台灣企業設計的繁體中文 AI 系統。</p>
          <div className="hero-acts">
            <a href="/signup" className="btn btn-p btn-lg">免費開始使用 →</a>
            <a href="#platform" className="btn btn-o btn-lg">探索功能</a>
          </div>
          <div className="hero-pills">
            <div className="hero-pill"><span>🧠</span> AI 知識管理</div>
            <div className="hero-pill"><span>✍️</span> AI 寫作助手</div>
            <div className="hero-pill"><span>📋</span> NLP 智慧表單</div>
            <div className="hero-pill"><span>🔑</span> 公開 API</div>
            <div className="hero-pill"><span>🏢</span> 企業級管理</div>
          </div>
        </div>
      </section>

      {/* ═══ 2. PROBLEM ═══ */}
      <section className="sec sec-dark" id="problem">
        <div className="con">
          <div className="sec-hd"><div className="sec-label">企業現況</div><h2 className="sec-title">你的團隊每天都在面對這些問題</h2><p className="sec-desc">散落各處的文件、難用的 ERP 系統、沒有留住的知識。</p></div>
          <div className="prob-grid">
            {[
              { icon: '⏳', title: '花太多時間找資料', desc: '重要資訊散落在 Google Docs、Email、Slack。團隊花 20% 的時間在找已經存在的東西。', stat: '20%' },
              { icon: '📋', title: 'ERP 流程太繁瑣', desc: '請假要填十個欄位，出差要選八個下拉選單。明明一句話就能說清楚的事情。', stat: '10min' },
              { icon: '🚪', title: '知識隨人離開', desc: '資深同事離職，多年經驗也跟著走了。沒有系統把這些知識留在組織裡。', stat: '致命' },
            ].map((p) => (
              <div className="prob-card fi" key={p.title}><div className="prob-icon">{p.icon}</div><h3>{p.title}</h3><p>{p.desc}</p><div className="prob-stat">{p.stat}</div></div>
            ))}
          </div>
        </div>
      </section>

      {/* ═══ 3. PLATFORM — Three Pillars ═══ */}
      <div id="platform">

      {/* Pillar 1: AI Knowledge Management */}
      <section className="sec">
        <div className="con">
          <div className="pillar fi">
            <div>
              <div className="pillar-label" style={{ color: 'var(--brand)' }}>核心一 · AI 知識管理</div>
              <div className="pillar-title">上傳文件，AI 幫你整理、搜尋、回答</div>
              <div className="pillar-desc">上傳任何文件，AI 自動標籤分類。用自然語言搜尋或對話，取得有來源引用的精準答案。還有知識圖譜，讓你看見知識之間的關聯。</div>
              <div className="pillar-features">
                <div className="pillar-feat"><div className="pillar-feat-icon" style={{ background: '#EDE9FE' }}>🔍</div><div><strong>語意混合搜尋</strong> — 語意理解 + 關鍵字比對，中英文自動偵測</div></div>
                <div className="pillar-feat"><div className="pillar-feat-icon" style={{ background: '#DBEAFE' }}>💬</div><div><strong>AI 文件對話</strong> — 問問題，得到附來源引用的答案</div></div>
                <div className="pillar-feat"><div className="pillar-feat-icon" style={{ background: '#FEF3C7' }}>🏷️</div><div><strong>自動標籤</strong> — GPT-4o-mini 自動分類，不需手動整理</div></div>
                <div className="pillar-feat"><div className="pillar-feat-icon" style={{ background: '#D1FAE5' }}>🤖</div><div><strong>AI Agent</strong> — 用自然語言指揮 AI 建立文件、管理資料夾</div></div>
                <div className="pillar-feat"><div className="pillar-feat-icon" style={{ background: '#F3E8FF' }}>🌐</div><div><strong>知識圖譜</strong> — 互動式視覺化，探索文件之間的關聯</div></div>
              </div>
            </div>
            <div className="pillar-visual">
              <div className="kv-card">
                <div className="kv-search"><div className="kv-search-icon">🔍</div><div className="kv-search-text">搜尋「客戶報告」或問 AI 問題...</div></div>
                <div className="kv-row">
                  <div className="kv-doc"><div className="kv-doc-icon">📄</div><div className="kv-doc-title">Q4 業務報告</div><div className="kv-doc-meta">v2.1 · 2 天前更新</div><div><span className="kv-tag" style={{ background: '#EDE9FE', color: 'var(--brand)' }}>報告</span><span className="kv-tag" style={{ background: '#DBEAFE', color: 'var(--blue)' }}>業務</span></div></div>
                  <div className="kv-doc"><div className="kv-doc-icon">📋</div><div className="kv-doc-title">新人培訓手冊</div><div className="kv-doc-meta">v1.3 · 已發佈</div><div><span className="kv-tag" style={{ background: '#FEF3C7', color: 'var(--amber)' }}>培訓</span><span className="kv-tag" style={{ background: '#D1FAE5', color: 'var(--green)' }}>HR</span></div></div>
                </div>
                <div className="kv-chat">💬 根據 Q4 報告，本季營收成長了 23%，主要由企業客戶帶動。<span style={{ fontSize: 11, color: 'var(--ink4)' }}> — 來源: Q4 業務報告 p.12</span></div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Pillar 2: AI Writing & Productivity */}
      <section className="sec sec-alt">
        <div className="con">
          <div className="pillar rev fi">
            <div>
              <div className="pillar-label" style={{ color: 'var(--green)' }}>核心二 · AI 智慧工具</div>
              <div className="pillar-title">寫作、翻譯、匯出 — AI 幫你加速</div>
              <div className="pillar-desc">內建 AI 寫作助手，選取文字即可改善、翻譯、調整語氣。支援五種格式匯出，還有公開 API 讓外部系統串接。</div>
              <div className="pillar-features">
                <div className="pillar-feat"><div className="pillar-feat-icon" style={{ background: '#D1FAE5' }}>✨</div><div><strong>AI 寫作助手</strong> — 改善、翻譯、縮短、擴展、調整語氣</div></div>
                <div className="pillar-feat"><div className="pillar-feat-icon" style={{ background: '#FEF3C7' }}>📤</div><div><strong>五格式匯出</strong> — PDF、Word、HTML、Markdown、純文字</div></div>
                <div className="pillar-feat"><div className="pillar-feat-icon" style={{ background: '#FEE2E2' }}>🔑</div><div><strong>公開 API v1</strong> — RESTful API，外部系統可直接串接</div></div>
                <div className="pillar-feat"><div className="pillar-feat-icon" style={{ background: '#EDE9FE' }}>📝</div><div><strong>協作工具</strong> — 行內留言、文件範本、版本追蹤</div></div>
              </div>
            </div>
            <div className="pillar-visual">
              <div className="wv-card">
                <div className="wv-toolbar">
                  <div className="wv-btn active">✨ 改善</div>
                  <div className="wv-btn">📝 修正文法</div>
                  <div className="wv-btn">🇹🇼 翻譯中文</div>
                  <div className="wv-btn">👔 正式</div>
                  <div className="wv-btn">📏 加長</div>
                  <div className="wv-btn">📊 摘要</div>
                </div>
                <div className="wv-content">Our company performance this quarter was good. We made more money than before and customers seem happy with our products.</div>
                <div className="wv-preview">
                  <div className="wv-preview-label">✨ AI 改善結果</div>
                  Our company delivered strong results this quarter, with revenue growth exceeding prior-period benchmarks. Customer satisfaction metrics reflect the positive reception of our product enhancements.
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Pillar 3: NLP Workflow Automation */}
      <section className="sec">
        <div className="con">
          <div className="pillar fi">
            <div>
              <div className="pillar-label" style={{ color: 'var(--blue)' }}>核心三 · AI 流程自動化</div>
              <div className="pillar-title">用一句話填完請假單</div>
              <div className="pillar-desc">不再需要點選十個欄位。用自然語言描述需求，AI 自動解析並填好表單。支援請假、加班、出差申請，主管可即時審核、批次核准。</div>
              <div className="pillar-features">
                <div className="pillar-feat"><div className="pillar-feat-icon" style={{ background: '#DBEAFE' }}>📝</div><div><strong>NLP 智慧表單</strong> — 自然語言自動填寫，支援中英文</div></div>
                <div className="pillar-feat"><div className="pillar-feat-icon" style={{ background: '#FEF3C7' }}>✅</div><div><strong>審核流程</strong> — 主管即時審核，批次核准/駁回</div></div>
                <div className="pillar-feat"><div className="pillar-feat-icon" style={{ background: '#D1FAE5' }}>🏖️</div><div><strong>假期管理</strong> — 自動扣減假期餘額，進度條視覺化</div></div>
                <div className="pillar-feat"><div className="pillar-feat-icon" style={{ background: '#FEE2E2' }}>📥</div><div><strong>PDF 匯出</strong> — 每筆申請都可匯出品牌化 PDF</div></div>
              </div>
            </div>
            <div className="pillar-visual">
              <div className="ev-card">
                <div style={{ fontSize: 12, fontWeight: 600, color: 'rgba(255,255,255,0.4)', marginBottom: 10 }}>🤖 AI 智慧填寫</div>
                <div className="ev-input">"我下週一到週三要請特休，因為要回南部探親"</div>
                <div className="ev-arrow">↓ AI 自動解析</div>
                <div className="ev-fields">
                  <div className="ev-field"><div className="ev-field-label">假別 Leave Type</div><div className="ev-field-val">特休 Annual</div></div>
                  <div className="ev-field"><div className="ev-field-label">開始日期 Start</div><div className="ev-field-val">2026-03-02</div></div>
                  <div className="ev-field"><div className="ev-field-label">結束日期 End</div><div className="ev-field-val">2026-03-04</div></div>
                  <div className="ev-field"><div className="ev-field-label">天數 Days</div><div className="ev-field-val">3</div></div>
                </div>
                <div className="ev-submit">📤 確認送出 Submit</div>
                <div className="ev-stats">
                  <div className="ev-stat"><div className="ev-stat-val" style={{ color: '#D97706' }}>2</div><div className="ev-stat-label">待審核</div></div>
                  <div className="ev-stat"><div className="ev-stat-val" style={{ color: '#059669' }}>12</div><div className="ev-stat-label">已核准</div></div>
                  <div className="ev-stat"><div className="ev-stat-val" style={{ color: '#A78BFA' }}>4/7</div><div className="ev-stat-label">特休餘額</div></div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      </div>

      {/* ═══ 4. WHY ATLAS ═══ */}
      <section className="sec sec-alt" id="why">
        <div className="con">
          <div className="sec-hd ctr"><div className="sec-label">為什麼選擇 Atlas</div><h2 className="sec-title">從第一天就為台灣企業設計</h2></div>
          <div className="why-grid">
            {[
              { icon: '🇹🇼', title: '原生繁體中文', desc: '不是翻譯層，而是從底層就以繁體中文為核心設計的 AI 系統。' },
              { icon: '💬', title: '自然語言驅動', desc: '用一句話取代十個欄位。AI 理解你的需求，自動填寫表單。' },
              { icon: '🔗', title: '一個平台全搞定', desc: '文件、搜尋、寫作、表單、分析。不需要七個工具拼湊。' },
              { icon: '⚡', title: '五分鐘上手', desc: '不需要工程師、不需要複雜設定。註冊、上傳、開始使用。' },
            ].map((w) => (
              <div className="why-card fi" key={w.title}><div className="why-icon">{w.icon}</div><h3>{w.title}</h3><p>{w.desc}</p></div>
            ))}
          </div>
        </div>
      </section>

      {/* ═══ 5. HOW IT WORKS ═══ */}
      <section className="sec">
        <div className="con">
          <div className="sec-hd"><div className="sec-label">如何開始</div><h2 className="sec-title">三步驟，立即上手</h2></div>
          <div className="steps">
            {[
              { title: '建立工作空間', desc: '註冊帳號，為組織命名，邀請團隊成員。角色權限立即生效。' },
              { title: '上傳文件', desc: '拖放檔案上傳，AI 自動標記、摘要、索引。知識庫立即可用。' },
              { title: '開始使用', desc: '用 AI 搜尋、對話、寫作、填表單。所有工具都在同一個平台。' },
            ].map((s) => (<div className="step fi" key={s.title}><h3>{s.title}</h3><p>{s.desc}</p></div>))}
          </div>
        </div>
      </section>

      {/* ═══ 6. PRICING ═══ */}
      <section className="sec sec-alt" id="pricing">
        <div className="con">
          <div className="sec-hd ctr"><div className="sec-label">方案價格</div><h2 className="sec-title">簡單透明的價格</h2><p className="sec-desc">免費開始，團隊成長時再升級。</p></div>
          <div className="price-grid">
            <div className="price-card fi">
              <div className="price-tier">入門方案</div><div className="price-val">$0<span>/月</span></div><div className="price-note">小型團隊永久免費</div>
              <ul className="price-list"><li>最多 50 份文件</li><li>語意搜尋 + AI 對話</li><li>NLP 表單申請</li><li>1 位使用者</li></ul>
              <a href="/signup" className="btn btn-o" style={{ width: '100%', justifyContent: 'center' }}>免費開始</a>
            </div>
            <div className="price-card pop fi">
              <div className="price-pop">最受歡迎</div>
              <div className="price-tier">團隊方案</div><div className="price-val">$29<span>/月</span></div><div className="price-note">每個工作空間</div>
              <ul className="price-list"><li>無限文件</li><li>AI Agent + 寫作助手</li><li>最多 10 位成員</li><li>NLP 表單 + 審核流程</li><li>五格式匯出 + API</li><li>稽核日誌 + 品牌設定</li></ul>
              <a href="/signup" className="btn btn-p" style={{ width: '100%', justifyContent: 'center' }}>免費試用 →</a>
            </div>
            <div className="price-card fi">
              <div className="price-tier">企業方案</div><div className="price-val">客製</div><div className="price-note">適合大型組織</div>
              <ul className="price-list"><li>團隊方案所有功能</li><li>無限成員數</li><li>SSO 單一登入</li><li>自訂表單類型</li><li>優先支援</li></ul>
              <a href="/contact" className="btn btn-o" style={{ width: '100%', justifyContent: 'center' }}>聯繫我們</a>
            </div>
          </div>
        </div>
      </section>

      {/* ═══ 7. CTA ═══ */}
      <section className="cta">
        <h2>準備好智慧化你的企業了嗎？</h2>
        <p>免費開始。不需信用卡。五分鐘內完成設定。</p>
        <div className="cta-acts">
          <a href="/signup" className="btn btn-lg" style={{ background: 'white', color: 'var(--brand)', fontWeight: 700 }}>免費開始使用 →</a>
          <a href="/contact" className="btn btn-w btn-lg">與我們聊聊</a>
        </div>
        <div className="cta-note">primestrideai@gmail.com · 不需信用卡 · 隨時可取消</div>
      </section>

      {/* ═══ FOOTER ═══ */}
      <footer className="foot">
        <div className="foot-in">
          <div className="foot-l">&copy; 2026 PrimeStride Atlas. All rights reserved.</div>
          <div className="foot-links"><a href="/contact">聯繫我們</a></div>
        </div>
      </footer>
    </>
  );
}
