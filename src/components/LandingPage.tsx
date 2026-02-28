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
        .nav { position: fixed; top: 0; left: 0; right: 0; z-index: 100; height: 64px; background: rgba(255,255,255,0.9); backdrop-filter: blur(20px); -webkit-backdrop-filter: blur(20px); border-bottom: 1px solid transparent; transition: all 0.3s; }
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
        .hero { padding: 140px 24px 80px; text-align: center; position: relative; overflow: hidden; }
        .hero::before { content: ''; position: absolute; top: -200px; left: 50%; transform: translateX(-50%); width: 800px; height: 800px; background: radial-gradient(circle, rgba(124,58,237,0.06) 0%, transparent 70%); pointer-events: none; }
        .hero-in { max-width: 720px; margin: 0 auto; position: relative; z-index: 1; }
        .hero-badge { display: inline-flex; align-items: center; gap: 8px; padding: 6px 16px 6px 8px; border-radius: 100px; background: var(--brand-glow); border: 1px solid rgba(124,58,237,0.15); font-size: 13px; font-weight: 600; color: var(--brand); margin-bottom: 28px; }
        .hero-badge .dot { width: 8px; height: 8px; border-radius: 50%; background: var(--green); animation: pulse 2s infinite; }
        @keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.4; } }
        .hero h1 { font-family: 'Sora', 'Noto Sans TC', sans-serif; font-size: clamp(36px, 5.5vw, 56px); font-weight: 800; line-height: 1.15; color: var(--ink); margin-bottom: 20px; letter-spacing: -0.02em; }
        .hero h1 .hl { background: linear-gradient(135deg, var(--brand), var(--brand-l)); -webkit-background-clip: text; -webkit-text-fill-color: transparent; }
        .hero p { font-size: 18px; color: var(--ink3); max-width: 540px; margin: 0 auto 32px; line-height: 1.8; }
        .hero-acts { display: flex; gap: 12px; justify-content: center; flex-wrap: wrap; margin-bottom: 48px; }
        .hero-metrics { display: flex; justify-content: center; gap: 48px; flex-wrap: wrap; }
        .hero-metrics .m { text-align: center; }
        .hero-metrics .mv { font-family: 'Sora', sans-serif; font-size: 32px; font-weight: 800; color: var(--brand); }
        .hero-metrics .ml { font-size: 13px; color: var(--ink4); font-weight: 500; }

        /* ─── Section ─── */
        .sec { padding: 100px 24px; }
        .sec-dark { background: var(--ink); color: #fff; }
        .sec-alt { background: var(--surf2); }
        .con { max-width: var(--mw); margin: 0 auto; }
        .sec-hd { max-width: 580px; margin-bottom: 52px; }
        .sec-hd.ctr { margin-left: auto; margin-right: auto; text-align: center; }
        .sec-label { font-size: 13px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.08em; color: var(--brand); margin-bottom: 10px; }
        .sec-dark .sec-label { color: var(--brand-l); }
        .sec-title { font-family: 'Sora', 'Noto Sans TC', sans-serif; font-size: clamp(28px, 4vw, 38px); font-weight: 700; line-height: 1.25; margin-bottom: 14px; letter-spacing: -0.01em; }
        .sec-dark .sec-title { color: #fff; }
        .sec-desc { font-size: 16px; color: var(--ink3); line-height: 1.7; }
        .sec-dark .sec-desc { color: rgba(255,255,255,0.5); }

        /* ─── ERP Highlight ─── */
        .erp-hero { padding: 100px 24px; background: linear-gradient(135deg, #0F172A 0%, #1E1B4B 50%, #312E81 100%); color: #fff; position: relative; overflow: hidden; }
        .erp-hero::before { content: ''; position: absolute; top: -100px; right: -100px; width: 500px; height: 500px; background: radial-gradient(circle, rgba(124,58,237,0.2) 0%, transparent 70%); }
        .erp-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 64px; align-items: center; }
        .erp-demo { background: rgba(255,255,255,0.06); border: 1px solid rgba(255,255,255,0.1); border-radius: var(--r-lg); padding: 28px; backdrop-filter: blur(10px); }
        .erp-input { background: rgba(255,255,255,0.08); border: 1px solid rgba(255,255,255,0.12); border-radius: 12px; padding: 16px 20px; color: rgba(255,255,255,0.9); font-size: 15px; margin-bottom: 16px; font-style: italic; }
        .erp-arrow { text-align: center; font-size: 24px; margin-bottom: 16px; color: var(--brand-l); }
        .erp-result { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
        .erp-field { background: rgba(255,255,255,0.05); border-radius: 8px; padding: 10px 14px; }
        .erp-field-label { font-size: 11px; color: rgba(255,255,255,0.4); font-weight: 600; margin-bottom: 2px; }
        .erp-field-val { font-size: 14px; color: rgba(255,255,255,0.9); font-weight: 600; }

        /* ─── Features ─── */
        .feat-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 20px; }
        .feat-card { padding: 28px; border-radius: var(--r); border: 1px solid var(--bdr); background: white; transition: all 0.25s; }
        .feat-card:hover { border-color: var(--brand); box-shadow: 0 8px 30px rgba(124,58,237,0.08); transform: translateY(-2px); }
        .feat-icon { width: 44px; height: 44px; border-radius: 12px; display: flex; align-items: center; justify-content: center; font-size: 22px; margin-bottom: 16px; }
        .feat-card h3 { font-size: 16px; font-weight: 700; margin-bottom: 6px; }
        .feat-card p { font-size: 14px; color: var(--ink3); line-height: 1.6; }

        .feat-wide { grid-column: 1 / -1; display: flex; gap: 24px; align-items: center; padding: 28px 32px; background: linear-gradient(135deg, var(--brand-glow), rgba(124,58,237,0.04)); border: 1px solid rgba(124,58,237,0.15); }
        .feat-wide .feat-icon { background: var(--brand); color: white; flex-shrink: 0; }
        .feat-wide h3, .feat-wide p { margin-bottom: 0; }

        /* ─── Problem ─── */
        .prob-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 20px; }
        .prob-card { padding: 28px; border-radius: var(--r); background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.08); transition: all 0.25s; }
        .prob-card:hover { background: rgba(255,255,255,0.07); border-color: rgba(255,255,255,0.15); }
        .prob-icon { font-size: 32px; margin-bottom: 14px; }
        .prob-card h3 { font-size: 16px; font-weight: 700; margin-bottom: 6px; color: #fff; }
        .prob-card p { font-size: 14px; color: rgba(255,255,255,0.5); line-height: 1.6; }
        .prob-stat { margin-top: 12px; font-family: 'Sora', sans-serif; font-size: 28px; font-weight: 800; color: var(--brand-l); }

        /* ─── Comparison ─── */
        .cmp-table { width: 100%; border-collapse: separate; border-spacing: 0; border-radius: var(--r); overflow: hidden; border: 1px solid var(--bdr); background: white; }
        .cmp-table th { padding: 14px 20px; font-size: 14px; font-weight: 700; text-align: left; background: var(--surf2); border-bottom: 1px solid var(--bdr); }
        .cmp-table th:last-child { color: var(--brand); }
        .cmp-table td { padding: 12px 20px; font-size: 14px; border-bottom: 1px solid var(--bdr-l); }
        .cmp-table tr:last-child td { border-bottom: none; }
        .cmp-check { color: var(--green); font-weight: 700; }
        .cmp-cross { color: var(--red); opacity: 0.5; }

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
        .price-pop { position: absolute; top: -12px; left: 50%; transform: translateX(-50%); padding: 4px 16px; border-radius: 100px; background: var(--brand); color: white; font-size: 12px; font-weight: 700; }
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

        /* ─── Tech ─── */
        .tech-bar { padding: 24px; background: var(--surf2); border-top: 1px solid var(--bdr-l); border-bottom: 1px solid var(--bdr-l); }
        .tech-in { max-width: var(--mw); margin: 0 auto; display: flex; align-items: center; justify-content: center; gap: 32px; flex-wrap: wrap; }
        .tech-label { font-size: 13px; font-weight: 600; color: var(--ink4); }
        .tech-item { display: flex; align-items: center; gap: 6px; font-size: 13px; font-weight: 500; color: var(--ink3); }
        .tech-icon { width: 28px; height: 28px; border-radius: 8px; background: white; border: 1px solid var(--bdr-l); display: flex; align-items: center; justify-content: center; font-size: 14px; }

        /* ─── Responsive ─── */
        @media (max-width: 768px) {
          .nav-links, .nav-acts .btn-o { display: none; }
          .mob-tog { display: flex; }
          .hero h1 { font-size: 32px; }
          .hero p { font-size: 16px; }
          .hero-metrics { gap: 24px; }
          .erp-grid { grid-template-columns: 1fr; gap: 32px; }
          .feat-grid, .prob-grid, .steps, .price-grid { grid-template-columns: 1fr; }
          .feat-wide { flex-direction: column; }
          .cmp-table { font-size: 13px; }
          .cmp-table th, .cmp-table td { padding: 10px 12px; }
        }
      `}</style>

      {/* ═══ NAV ═══ */}
      <nav className={`nav ${navScrolled ? 'sc' : ''}`}>
        <div className="nav-in">
          <a href="/" className="nav-brand"><div className="nav-mark">📚</div> PrimeStride Atlas</a>
          <div className="nav-links">
            <a href="#features">功能</a>
            <a href="#erp">ERP 表單</a>
            <a href="#compare">比較</a>
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
        <a href="#features" onClick={() => setMobileMenuOpen(false)}>功能</a>
        <a href="#erp" onClick={() => setMobileMenuOpen(false)}>ERP 表單</a>
        <a href="#compare" onClick={() => setMobileMenuOpen(false)}>比較</a>
        <a href="#pricing" onClick={() => setMobileMenuOpen(false)}>價格</a>
        <a href="/login" onClick={() => setMobileMenuOpen(false)}>登入</a>
        <a href="/signup" className="btn btn-p" style={{ justifyContent: 'center' }}>免費開始 →</a>
      </div>

      {/* ═══ HERO ═══ */}
      <section className="hero">
        <div className="hero-in">
          <div className="hero-badge"><span className="dot" /> 已上線 · 台灣企業智慧化首選</div>
          <h1>取代傳統 ERP<br />用 <span className="hl">AI 自然語言</span><br />管理企業知識</h1>
          <p>上傳文件、用自然語言提問、用一句話填完請假單。PrimeStride Atlas 將散落的文件與繁瑣的 ERP 流程，變成智慧化的企業知識系統。</p>
          <div className="hero-acts">
            <a href="/signup" className="btn btn-p btn-lg">免費開始使用 →</a>
            <a href="#erp" className="btn btn-o btn-lg">看 AI 表單 Demo</a>
          </div>
          <div className="hero-metrics">
            <div className="m"><div className="mv">36+</div><div className="ml">文件已索引</div></div>
            <div className="m"><div className="mv">&lt;3s</div><div className="ml">AI 回應時間</div></div>
            <div className="m"><div className="mv">5</div><div className="ml">匯出格式</div></div>
            <div className="m"><div className="mv">3</div><div className="ml">NLP 表單類型</div></div>
          </div>
        </div>
      </section>

      {/* ═══ ERP HIGHLIGHT ═══ */}
      <section className="erp-hero" id="erp">
        <div className="con">
          <div className="erp-grid">
            <div>
              <div className="sec-label" style={{ color: '#A78BFA' }}>核心亮點 · Phase 5</div>
              <h2 className="sec-title" style={{ color: '#fff', fontSize: 'clamp(28px, 4vw, 36px)' }}>用一句話填完請假單</h2>
              <p style={{ color: 'rgba(255,255,255,0.6)', fontSize: 16, lineHeight: 1.8, marginBottom: 24 }}>
                不再需要點選十個欄位。只要用自然語言描述你的需求，AI 自動解析並填好所有表單欄位。支援請假、加班、出差三種申請類型，主管可即時審核。
              </p>
              <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                {[['📝', '請假申請'], ['🕐', '加班申請'], ['✈️', '出差申請']].map(([icon, label]) => (
                  <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 16px', borderRadius: 10, background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.1)', fontSize: 14, color: 'rgba(255,255,255,0.8)' }}>
                    {icon} {label}
                  </div>
                ))}
              </div>
            </div>
            <div className="erp-demo fi">
              <div style={{ fontSize: 13, fontWeight: 600, color: 'rgba(255,255,255,0.4)', marginBottom: 10 }}>🤖 AI 智慧填寫</div>
              <div className="erp-input">"我下週一到週三要請特休，因為要回南部探親"</div>
              <div className="erp-arrow">↓ AI 自動解析</div>
              <div className="erp-result">
                <div className="erp-field"><div className="erp-field-label">假別 Leave Type</div><div className="erp-field-val">特休 Annual</div></div>
                <div className="erp-field"><div className="erp-field-label">開始日期 Start</div><div className="erp-field-val">2026-03-02</div></div>
                <div className="erp-field"><div className="erp-field-label">結束日期 End</div><div className="erp-field-val">2026-03-04</div></div>
                <div className="erp-field"><div className="erp-field-label">天數 Days</div><div className="erp-field-val">3</div></div>
                <div className="erp-field" style={{ gridColumn: '1 / -1' }}><div className="erp-field-label">事由 Reason</div><div className="erp-field-val">回南部探親</div></div>
              </div>
              <div style={{ marginTop: 16, display: 'flex', gap: 8 }}>
                <div style={{ flex: 1, padding: '10px', borderRadius: 8, background: 'var(--brand)', color: 'white', textAlign: 'center', fontSize: 14, fontWeight: 700 }}>📤 確認送出</div>
                <div style={{ padding: '10px 16px', borderRadius: 8, background: 'rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.6)', fontSize: 14 }}>取消</div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ═══ PROBLEM ═══ */}
      <section className="sec sec-dark">
        <div className="con">
          <div className="sec-hd"><div className="sec-label">問題所在</div><h2 className="sec-title">傳統 ERP 正在拖慢你的團隊</h2><p className="sec-desc">複雜的選單、難用的介面、缺乏智慧搜尋。每天浪費大量時間在找資料和填表單。</p></div>
          <div className="prob-grid">
            {[
              { icon: '⏳', title: '花太多時間找資料', desc: '團隊成員花費 20% 的工作時間尋找已存在的資訊，不斷重複搜尋。', stat: '20%' },
              { icon: '📋', title: 'ERP 表單太繁瑣', desc: '請假要點十個欄位，出差要填八個選單。明明一句話能說清楚的事。', stat: '10min' },
              { icon: '🚪', title: '知識隨人離開', desc: '資深同事離職時，多年累積的經驗也跟著走了。沒有系統留住這些資產。', stat: '致命' },
            ].map((p) => (
              <div className="prob-card fi" key={p.title}><div className="prob-icon">{p.icon}</div><h3>{p.title}</h3><p>{p.desc}</p><div className="prob-stat">{p.stat}</div></div>
            ))}
          </div>
        </div>
      </section>

      {/* ═══ FEATURES ═══ */}
      <section className="sec" id="features">
        <div className="con">
          <div className="sec-hd"><div className="sec-label">完整功能</div><h2 className="sec-title">管理企業知識所需的一切</h2><p className="sec-desc">從文件管理到 AI 搜尋，從 NLP 表單到公開 API。</p></div>
          <div className="feat-grid">
            {[
              { icon: '🔍', bg: '#EDE9FE', title: '語意混合搜尋', desc: '結合語意理解與關鍵字比對，精準找到答案。支援中英文自動偵測。' },
              { icon: '🤖', bg: '#DBEAFE', title: 'AI Agent 代理', desc: '用自然語言指揮 AI 建立文件、整理資料夾、搜尋內容、管理標籤。' },
              { icon: '✨', bg: '#FEF3C7', title: 'AI 寫作助手', desc: '改善、翻譯、縮短、擴展、調整語氣。中英文自動偵測，選取文字即可操作。' },
              { icon: '📤', bg: '#D1FAE5', title: '五格式匯出', desc: '一鍵匯出 PDF、Word、HTML、Markdown、純文字。完整保留標籤與摘要。' },
              { icon: '🔑', bg: '#FEE2E2', title: '公開 API v1', desc: 'RESTful API 支援外部整合。ERP 系統、機器人、自動化腳本都能串接。' },
              { icon: '📋', bg: '#F3E8FF', title: 'NLP 表單系統', desc: '用自然語言填寫請假、加班、出差申請。AI 自動解析，主管即時審核。' },
            ].map((f) => (
              <div className="feat-card fi" key={f.title}>
                <div className="feat-icon" style={{ background: f.bg }}>{f.icon}</div>
                <h3>{f.title}</h3><p>{f.desc}</p>
              </div>
            ))}
            <div className="feat-wide fi">
              <div className="feat-icon">🏢</div>
              <div>
                <h3>企業級管理 — 角色權限、稽核日誌、自訂品牌</h3>
                <p style={{ color: 'var(--ink3)', fontSize: 14 }}>三層權限控制（Owner / Admin / Member）、完整操作紀錄、自訂組織名稱與色彩。從第一天就為企業設計。</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ═══ COMPARISON ═══ */}
      <section className="sec sec-alt" id="compare">
        <div className="con">
          <div className="sec-hd ctr"><div className="sec-label">方案比較</div><h2 className="sec-title">Atlas vs 傳統系統</h2></div>
          <table className="cmp-table">
            <thead><tr><th>功能</th><th>傳統 ERP / Google Drive</th><th>PrimeStride Atlas ✦</th></tr></thead>
            <tbody>
              <tr><td>搜尋方式</td><td>僅關鍵字精確比對</td><td><span className="cmp-check">✓</span> 語意 + 關鍵字混合搜尋</td></tr>
              <tr><td>AI 對話</td><td><span className="cmp-cross">✕</span> 不支援</td><td><span className="cmp-check">✓</span> RAG 驅動，附來源引用</td></tr>
              <tr><td>表單填寫</td><td>逐欄手動輸入</td><td><span className="cmp-check">✓</span> 自然語言 AI 自動填寫</td></tr>
              <tr><td>文件匯出</td><td>原始格式或 PDF</td><td><span className="cmp-check">✓</span> PDF / Word / HTML / MD / TXT</td></tr>
              <tr><td>公開 API</td><td><span className="cmp-cross">✕</span> 無或收費</td><td><span className="cmp-check">✓</span> RESTful API v1 內建</td></tr>
              <tr><td>稽核日誌</td><td>基本或無</td><td><span className="cmp-check">✓</span> 完整操作紀錄</td></tr>
              <tr><td>繁體中文</td><td>介面支援，無中文優化</td><td><span className="cmp-check">✓</span> 全面原生繁體中文</td></tr>
            </tbody>
          </table>
        </div>
      </section>

      {/* ═══ HOW IT WORKS ═══ */}
      <section className="sec">
        <div className="con">
          <div className="sec-hd"><div className="sec-label">如何開始</div><h2 className="sec-title">幾分鐘內就能上手</h2><p className="sec-desc">不需要複雜設定，不需要工程師。</p></div>
          <div className="steps">
            {[
              { title: '建立工作空間', desc: '註冊帳號、為組織命名、邀請團隊成員。角色權限立即生效。' },
              { title: '上傳文件', desc: '拖放檔案上傳，AI 自動標記與索引。知識庫立即可以搜尋對話。' },
              { title: '開始使用', desc: '用語意搜尋找答案、用 AI 表單請假、用 Agent 管理文件。' },
            ].map((s) => (<div className="step fi" key={s.title}><h3>{s.title}</h3><p>{s.desc}</p></div>))}
          </div>
        </div>
      </section>

      {/* ═══ PRICING ═══ */}
      <section className="sec sec-alt" id="pricing">
        <div className="con">
          <div className="sec-hd ctr"><div className="sec-label">方案價格</div><h2 className="sec-title">簡單透明的價格</h2><p className="sec-desc">免費開始，團隊成長時再升級。</p></div>
          <div className="price-grid">
            <div className="price-card fi">
              <div className="price-tier">入門方案</div><div className="price-val">$0<span>/月</span></div><div className="price-note">小型團隊永久免費</div>
              <ul className="price-list"><li>最多 50 份文件</li><li>語意搜尋</li><li>AI 對話（每月 100 則）</li><li>1 位使用者</li><li>NLP 表單申請</li></ul>
              <a href="/signup" className="btn btn-o" style={{ width: '100%', justifyContent: 'center' }}>免費開始</a>
            </div>
            <div className="price-card pop fi">
              <div className="price-pop">最受歡迎</div>
              <div className="price-tier">團隊方案</div><div className="price-val">$29<span>/月</span></div><div className="price-note">每個工作空間</div>
              <ul className="price-list"><li>無限文件數量</li><li>混合搜尋 + AI 對話</li><li>最多 10 位成員</li><li>AI Agent + 寫作助手</li><li>NLP 表單 + 審核流程</li><li>匯出 + API 存取</li><li>稽核日誌 + 品牌設定</li></ul>
              <a href="/signup" className="btn btn-p" style={{ width: '100%', justifyContent: 'center' }}>免費試用 →</a>
            </div>
            <div className="price-card fi">
              <div className="price-tier">企業方案</div><div className="price-val">客製</div><div className="price-note">適合大型組織</div>
              <ul className="price-list"><li>團隊方案所有功能</li><li>無限成員數</li><li>SSO / SAML 單一登入</li><li>自訂表單類型</li><li>優先支援</li><li>客製化整合</li></ul>
              <a href="/contact" className="btn btn-o" style={{ width: '100%', justifyContent: 'center' }}>聯繫我們</a>
            </div>
          </div>
        </div>
      </section>

      {/* ═══ CTA ═══ */}
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
          <div className="foot-links">
            <a href="/contact">聯繫我們</a>
          </div>
        </div>
      </footer>
    </>
  );
}
