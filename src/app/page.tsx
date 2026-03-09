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
        @import url('https://fonts.googleapis.com/css2?family=DM+Serif+Display:ital@0;1&family=Instrument+Sans:wght@400;500;600;700&family=Noto+Sans+TC:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap');

        :root {
          --ink: #0a0e17; --ink2: #111827; --ink3: #1a2033;
          --surface: #0f1420; --surface2: #151b2b; --surface3: #1c2438;
          --text: #e8e6e1; --text2: #94a3b8; --text3: #64748b;
          --border: rgba(255,255,255,0.07); --border-h: rgba(255,255,255,0.12);
          --blue: #2563eb; --blue-l: #60a5fa; --blue-glow: rgba(37,99,235,0.12);
          --green: #10b981; --green-l: #34d399; --green-glow: rgba(16,185,129,0.1);
          --amber: #f59e0b; --violet: #8b5cf6; --red: #ef4444;
          --mw: 1160px; --r: 14px; --r-lg: 20px;
          --light-bg: #f8f6f2; --light-text: #0f172a; --light-text2: #475569; --light-border: rgba(10,14,23,0.08);
        }

        * { margin: 0; padding: 0; box-sizing: border-box; }
        html { scroll-behavior: smooth; -webkit-font-smoothing: antialiased; }
        body { font-family: 'Instrument Sans', 'Noto Sans TC', system-ui, sans-serif; color: var(--text); background: var(--ink); line-height: 1.7; overflow-x: hidden; }
        a { color: inherit; text-decoration: none; }
        .fi { opacity: 0; transform: translateY(24px); transition: opacity 0.55s ease, transform 0.55s ease; }

        .nav { position: fixed; top: 0; left: 0; right: 0; z-index: 100; height: 64px; background: rgba(10,14,23,0.85); backdrop-filter: blur(24px); -webkit-backdrop-filter: blur(24px); border-bottom: 1px solid transparent; transition: all 0.3s; }
        .nav.sc { border-color: var(--border); box-shadow: 0 1px 30px rgba(0,0,0,0.2); }
        .nav-in { max-width: var(--mw); margin: 0 auto; padding: 0 24px; display: flex; align-items: center; justify-content: space-between; height: 100%; }
        .nav-brand { display: flex; align-items: center; gap: 10px; font-weight: 700; font-size: 17px; font-family: 'DM Serif Display', serif; color: var(--text); }
        .nav-mark { width: 34px; height: 34px; border-radius: 10px; background: linear-gradient(135deg, var(--blue), var(--violet)); display: flex; align-items: center; justify-content: center; color: #fff; font-size: 14px; font-weight: 700; font-family: 'Instrument Sans', sans-serif; box-shadow: 0 2px 12px rgba(37,99,235,0.35); }
        .nav-links { display: flex; align-items: center; gap: 4px; }
        .nav-links a { padding: 7px 14px; font-size: 15px; font-weight: 500; color: var(--text3); border-radius: 8px; transition: all 0.15s; }
        .nav-links a:hover { color: var(--text); background: rgba(255,255,255,0.04); }
        .nav-acts { display: flex; align-items: center; gap: 10px; }
        .lang-tag { font-family: 'JetBrains Mono', monospace; font-size: 11px; color: var(--text3); padding: 4px 8px; border-radius: 4px; border: 1px solid var(--border); }
        .mob-tog { display: none; background: none; border: none; cursor: pointer; width: 40px; height: 40px; align-items: center; justify-content: center; }
        .mob-tog span { display: block; width: 20px; height: 2px; background: var(--text); border-radius: 2px; position: relative; transition: all 0.3s; }
        .mob-tog span::before, .mob-tog span::after { content: ''; position: absolute; left: 0; width: 100%; height: 2px; background: var(--text); border-radius: 2px; transition: all 0.3s; }
        .mob-tog span::before { top: -7px; } .mob-tog span::after { top: 7px; }
        .mob-tog span.open { background: transparent; }
        .mob-tog span.open::before { top: 0; transform: rotate(45deg); }
        .mob-tog span.open::after { top: 0; transform: rotate(-45deg); }
        .mob-menu { display: none; position: fixed; top: 64px; left: 0; right: 0; background: var(--ink2); border-bottom: 1px solid var(--border); padding: 16px 24px; z-index: 99; flex-direction: column; gap: 8px; box-shadow: 0 8px 30px rgba(0,0,0,0.3); }
        .mob-menu.show { display: flex; }
        .mob-menu a { padding: 12px 16px; border-radius: 8px; font-size: 15px; font-weight: 500; color: var(--text2); }
        .mob-menu a:hover { background: rgba(255,255,255,0.04); }

        .btn { display: inline-flex; align-items: center; gap: 8px; padding: 10px 22px; border-radius: 10px; font-weight: 600; font-size: 15px; transition: all 0.2s; cursor: pointer; border: none; font-family: inherit; }
        .btn-p { background: var(--blue); color: #fff; box-shadow: 0 2px 16px rgba(37,99,235,0.3); }
        .btn-p:hover { background: #1d4ed8; transform: translateY(-1px); box-shadow: 0 6px 24px rgba(37,99,235,0.4); }
        .btn-o { background: transparent; color: var(--text); border: 1.5px solid var(--border-h); }
        .btn-o:hover { border-color: var(--blue); color: var(--blue-l); background: var(--blue-glow); }
        .btn-w { background: rgba(255,255,255,0.1); color: #fff; border: 1.5px solid rgba(255,255,255,0.2); backdrop-filter: blur(10px); }
        .btn-w:hover { background: rgba(255,255,255,0.18); }
        .btn-lg { padding: 16px 36px; font-size: 17px; border-radius: 12px; }

        .badge { display: inline-flex; align-items: center; gap: 6px; padding: 7px 16px; border-radius: 100px; font-size: 13px; font-weight: 600; letter-spacing: 0.03em; }
        .badge-blue { background: var(--blue-glow); color: var(--blue-l); border: 1px solid rgba(37,99,235,0.2); }
        .badge-green { background: var(--green-glow); color: var(--green-l); border: 1px solid rgba(16,185,129,0.2); }
        .badge-dot { width: 7px; height: 7px; border-radius: 50%; background: var(--green); animation: pulse 2s infinite; }
        @keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.4; } }

        .hero { padding: 150px 24px 80px; text-align: center; position: relative; overflow: hidden; }
        .hero::before { content: ''; position: absolute; top: -300px; left: 50%; transform: translateX(-50%); width: 1000px; height: 1000px; background: radial-gradient(circle, rgba(37,99,235,0.1) 0%, transparent 65%); pointer-events: none; }
        .hero::after { content: ''; position: absolute; top: -100px; right: -200px; width: 600px; height: 600px; background: radial-gradient(circle, rgba(139,92,246,0.06) 0%, transparent 65%); pointer-events: none; }
        .hero-in { max-width: 780px; margin: 0 auto; position: relative; z-index: 1; }
        .hero-badges { display: flex; gap: 10px; justify-content: center; margin-bottom: 32px; flex-wrap: wrap; }
        .hero h1 { font-family: 'DM Serif Display', 'Noto Sans TC', serif; font-size: clamp(40px, 6vw, 64px); font-weight: 400; line-height: 1.1; color: var(--text); margin-bottom: 10px; letter-spacing: -0.01em; }
        .hero h1 .hl-blue { color: var(--blue-l); } .hero h1 .hl-green { color: var(--green-l); }
        .hero-sub-zh { font-family: 'Noto Sans TC', sans-serif; font-size: 20px; color: var(--text3); margin-bottom: 24px; }
        .hero-desc { font-size: 18px; color: var(--text2); max-width: 600px; margin: 0 auto 40px; line-height: 1.8; }
        .hero-desc strong { color: var(--text); font-weight: 600; }
        .hero-acts { display: flex; gap: 12px; justify-content: center; flex-wrap: wrap; margin-bottom: 48px; }
        .hero-pills { display: flex; gap: 8px; justify-content: center; flex-wrap: wrap; }
        .hero-pill { display: flex; align-items: center; gap: 6px; padding: 8px 18px; border-radius: 100px; background: rgba(255,255,255,0.03); border: 1px solid var(--border); font-size: 13px; font-weight: 600; color: var(--text2); }
        .hero-pill span { font-size: 14px; }

        .sec { padding: 100px 24px; }
        .sec-light { background: var(--light-bg); color: var(--light-text); }
        .sec-dark2 { background: var(--surface); }
        .con { max-width: var(--mw); margin: 0 auto; }
        .sec-hd { max-width: 720px; margin-bottom: 52px; }
        .sec-hd.ctr { margin-left: auto; margin-right: auto; text-align: center; }
        .sec-label { font-size: 20px; font-weight: 700; margin-bottom: 12px; }
        .sec-label-blue { color: var(--blue-l); } .sec-label-green { color: var(--green-l); } .sec-label-dark { color: var(--text3); }
        .sec-title { font-family: 'DM Serif Display', 'Noto Sans TC', serif; font-size: clamp(30px, 4.5vw, 44px); font-weight: 400; line-height: 1.2; margin-bottom: 14px; }
        .sec-light .sec-title { color: var(--light-text); }
        .sec-desc { font-size: 17px; color: var(--text2); line-height: 1.7; }
        .sec-light .sec-desc { color: var(--light-text2); }

        .terminal { background: var(--surface2); border: 1px solid var(--border); border-radius: 16px; overflow: hidden; box-shadow: 0 40px 80px rgba(0,0,0,0.35); max-width: 860px; margin: 0 auto; }
        .terminal-bar { padding: 14px 20px; display: flex; align-items: center; gap: 8px; border-bottom: 1px solid var(--border); background: rgba(255,255,255,0.015); }
        .t-dot { width: 12px; height: 12px; border-radius: 50%; } .t-dot-r { background: #ef4444; } .t-dot-y { background: #f59e0b; } .t-dot-g { background: #10b981; }
        .t-title { margin-left: auto; font-size: 12px; color: var(--text3); font-family: 'JetBrains Mono', monospace; }
        .terminal-body { padding: 28px; }
        .chat-msg { margin-bottom: 20px; opacity: 0; animation: fadeUp 0.5s forwards; }
        .chat-msg:nth-child(1) { animation-delay: 0.3s; } .chat-msg:nth-child(2) { animation-delay: 1.4s; }
        .chat-label { font-size: 12px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.06em; margin-bottom: 6px; }
        .chat-label-user { color: var(--blue-l); } .chat-label-ai { color: var(--green-l); }
        .chat-bubble { padding: 16px 20px; border-radius: 12px; font-size: 16px; line-height: 1.7; }
        .chat-user { background: var(--blue-glow); border: 1px solid rgba(37,99,235,0.2); display: inline-block; }
        .chat-ai { background: rgba(16,185,129,0.05); border: 1px solid rgba(16,185,129,0.12); }
        .chat-zh { font-family: 'Noto Sans TC', sans-serif; font-size: 17px; }
        .chat-en-sub { font-size: 13px; color: var(--text3); margin-top: 4px; }
        .compliance-seal { margin-top: 14px; padding: 14px 18px; background: rgba(16,185,129,0.06); border-left: 3px solid var(--green); border-radius: 0 10px 10px 0; }
        .seal-title { font-weight: 700; color: var(--green); margin-bottom: 6px; font-size: 13px; text-transform: uppercase; letter-spacing: 0.04em; }
        .seal-list { list-style: none; padding: 0; } .seal-list li { padding: 2px 0; font-size: 14px; color: rgba(232,230,225,0.7); line-height: 1.5; } .seal-list li::before { content: '✓ '; color: var(--green); font-weight: 700; }
        @keyframes fadeUp { from { opacity: 0; transform: translateY(12px); } to { opacity: 1; transform: translateY(0); } }

        .prob-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 18px; }
        .prob-card { padding: 28px; border-radius: var(--r); background: rgba(255,255,255,0.025); border: 1px solid var(--border); transition: all 0.25s; }
        .prob-card:hover { background: rgba(255,255,255,0.045); border-color: var(--border-h); }
        .prob-icon { font-size: 28px; margin-bottom: 14px; }
        .prob-card h3 { font-size: 18px; font-weight: 700; margin-bottom: 6px; font-family: 'Noto Sans TC', sans-serif; }
        .prob-card p { font-size: 15px; color: var(--text2); line-height: 1.6; font-family: 'Noto Sans TC', sans-serif; }
        .prob-stat { margin-top: 12px; font-family: 'JetBrains Mono', monospace; font-size: 28px; font-weight: 700; color: var(--red); }

        .compare-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 2px; border-radius: var(--r-lg); overflow: hidden; border: 1px solid var(--light-border); background: rgba(10,14,23,0.05); }
        .compare-header { padding: 18px 24px; font-weight: 700; font-size: 16px; background: #f0ede8; }
        .compare-header.legacy { color: var(--light-text2); } .compare-header.atlas { color: var(--blue); }
        .compare-cell { padding: 16px 24px; background: white; border-top: 1px solid rgba(10,14,23,0.04); }
        .compare-cell-label { font-size: 13px; font-weight: 700; letter-spacing: 0.03em; color: var(--light-text2); margin-bottom: 4px; }
        .compare-cell p { font-size: 15px; line-height: 1.5; color: var(--light-text); }
        .compare-cell.atlas-col p { color: var(--blue); font-weight: 600; }

        .pillar { display: grid; grid-template-columns: 1fr 1fr; gap: 56px; align-items: center; }
        .pillar.rev { direction: rtl; } .pillar.rev > * { direction: ltr; }
        .pillar-label { font-size: 18px; font-weight: 700; margin-bottom: 8px; }
        .pillar-title { font-family: 'DM Serif Display', 'Noto Sans TC', serif; font-size: clamp(24px, 3.2vw, 34px); font-weight: 400; line-height: 1.3; margin-bottom: 14px; }
        .pillar-desc { font-size: 16px; color: var(--text2); line-height: 1.7; margin-bottom: 22px; font-family: 'Noto Sans TC', sans-serif; }
        .pillar-features { display: flex; flex-direction: column; gap: 10px; }
        .pillar-feat { display: flex; align-items: flex-start; gap: 10px; font-size: 15px; color: var(--text2); line-height: 1.5; font-family: 'Noto Sans TC', sans-serif; }
        .pillar-feat strong { color: var(--text); }
        .pillar-feat-icon { width: 32px; height: 32px; border-radius: 8px; display: flex; align-items: center; justify-content: center; font-size: 15px; flex-shrink: 0; margin-top: 1px; }

        .kv-card { background: var(--surface2); border: 1px solid var(--border); border-radius: var(--r-lg); padding: 22px; }
        .kv-search { display: flex; align-items: center; gap: 8px; padding: 11px 16px; background: rgba(255,255,255,0.03); border: 1px solid var(--border); border-radius: 10px; margin-bottom: 12px; }
        .kv-search-icon { font-size: 16px; } .kv-search-text { font-size: 14px; color: var(--text3); }
        .kv-row { display: flex; gap: 10px; margin-bottom: 12px; }
        .kv-doc { flex: 1; padding: 14px; border-radius: 10px; background: rgba(255,255,255,0.03); border: 1px solid var(--border); }
        .kv-doc-icon { font-size: 18px; margin-bottom: 4px; } .kv-doc-title { font-size: 14px; font-weight: 700; color: var(--text); margin-bottom: 2px; } .kv-doc-meta { font-size: 12px; color: var(--text3); }
        .kv-tag { display: inline-block; padding: 3px 8px; border-radius: 4px; font-size: 11px; font-weight: 600; margin-right: 4px; margin-top: 4px; }
        .kv-chat { padding: 12px 16px; background: var(--blue-glow); border: 1px solid rgba(37,99,235,0.15); border-radius: 10px; font-size: 14px; color: var(--text2); line-height: 1.6; }

        .wv-card { background: var(--surface2); border: 1px solid var(--border); border-radius: var(--r-lg); padding: 22px; }
        .wv-toolbar { display: flex; gap: 5px; flex-wrap: wrap; margin-bottom: 12px; }
        .wv-btn { padding: 6px 12px; border-radius: 6px; font-size: 13px; font-weight: 600; background: rgba(255,255,255,0.04); border: 1px solid var(--border); color: var(--text3); }
        .wv-btn.active { background: var(--blue); color: white; border-color: var(--blue); }
        .wv-content { padding: 14px; background: rgba(255,255,255,0.02); border: 1px solid var(--border); border-radius: 10px; margin-bottom: 12px; font-size: 15px; color: var(--text2); line-height: 1.7; }
        .wv-preview { padding: 14px; background: var(--green-glow); border: 1px solid rgba(16,185,129,0.15); border-radius: 10px; font-size: 15px; color: rgba(232,230,225,0.8); line-height: 1.6; }
        .wv-preview-label { font-size: 13px; font-weight: 700; color: var(--green); margin-bottom: 6px; }

        .ev-card { background: linear-gradient(135deg, var(--surface2) 0%, var(--surface3) 100%); border: 1px solid var(--border); border-radius: var(--r-lg); padding: 22px; }
        .ev-label { font-size: 13px; font-weight: 700; color: var(--text3); margin-bottom: 10px; }
        .ev-input { background: rgba(255,255,255,0.04); border: 1px solid var(--border); border-radius: 10px; padding: 14px 18px; color: var(--text2); font-size: 15px; font-style: italic; margin-bottom: 12px; font-family: 'Noto Sans TC', sans-serif; }
        .ev-arrow { text-align: center; font-size: 18px; margin-bottom: 12px; color: var(--blue-l); }
        .ev-fields { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin-bottom: 12px; }
        .ev-field { background: rgba(255,255,255,0.03); border-radius: 6px; padding: 8px 12px; border: 1px solid var(--border); }
        .ev-field-label { font-size: 12px; color: var(--text3); font-weight: 600; } .ev-field-val { font-size: 15px; color: var(--text); font-weight: 600; }
        .ev-submit { padding: 10px; border-radius: 8px; background: var(--blue); color: white; text-align: center; font-size: 14px; font-weight: 700; }
        .ev-compliance { margin-top: 12px; padding: 10px 14px; background: var(--green-glow); border: 1px solid rgba(16,185,129,0.15); border-radius: 8px; }
        .ev-compliance-title { font-size: 12px; font-weight: 700; color: var(--green); text-transform: uppercase; letter-spacing: 0.04em; margin-bottom: 4px; }
        .ev-compliance-text { font-size: 13px; color: var(--text2); line-height: 1.5; }

        .sop-card { background: linear-gradient(135deg, #0f172a 0%, #1a1040 100%); border: 1px solid var(--border); border-radius: var(--r-lg); padding: 24px; }
        .sop-label { font-size: 13px; font-weight: 700; color: var(--blue-l); letter-spacing: 0.04em; margin-bottom: 12px; display: flex; align-items: center; gap: 8px; }
        .sop-label .sop-pulse { width: 8px; height: 8px; border-radius: 50%; background: var(--blue-l); animation: sopPulse 1.5s ease-in-out infinite; }
        @keyframes sopPulse { 0%, 100% { opacity: 1; box-shadow: 0 0 0 0 rgba(96,165,250,0.4); } 50% { opacity: 0.7; box-shadow: 0 0 0 6px rgba(96,165,250,0); } }
        .sop-input { background: rgba(255,255,255,0.04); border: 1px solid var(--border); border-radius: 10px; padding: 14px 18px; color: var(--text2); font-size: 15px; font-style: italic; margin-bottom: 14px; font-family: 'Noto Sans TC', sans-serif; }
        .sop-arrow { text-align: center; font-size: 18px; margin-bottom: 14px; color: var(--blue-l); }
        .sop-fields { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin-bottom: 14px; }
        .sop-field { background: rgba(255,255,255,0.03); border-radius: 8px; padding: 10px 14px; border: 1px solid var(--border); }
        .sop-field.pulse { border-color: rgba(96,165,250,0.3); animation: fieldPulse 2s ease-in-out infinite; }
        @keyframes fieldPulse { 0%, 100% { border-color: rgba(96,165,250,0.3); box-shadow: 0 0 0 0 rgba(96,165,250,0.1); } 50% { border-color: rgba(96,165,250,0.5); box-shadow: 0 0 12px 0 rgba(96,165,250,0.08); } }
        .sop-field-label { font-size: 12px; color: var(--text3); font-weight: 700; letter-spacing: 0.03em; margin-bottom: 2px; }
        .sop-field-val { font-size: 15px; color: var(--text); font-weight: 600; }
        .sop-insight { margin-top: 14px; padding: 12px 16px; background: rgba(245,158,11,0.06); border: 1px solid rgba(245,158,11,0.15); border-radius: 10px; }
        .sop-insight-title { font-size: 13px; font-weight: 700; color: var(--amber); margin-bottom: 4px; }
        .sop-insight-text { font-size: 14px; color: var(--text2); line-height: 1.6; }
        .sop-submit { margin-top: 14px; padding: 11px; border-radius: 8px; background: var(--blue); color: white; text-align: center; font-size: 14px; font-weight: 700; }

        .compliance-sec { padding: 80px 24px; background: linear-gradient(135deg, #0f172a 0%, #1e1b4b 100%); text-align: center; border-top: 1px solid var(--border); border-bottom: 1px solid var(--border); }
        .law-chips { display: flex; justify-content: center; gap: 10px; flex-wrap: wrap; margin-bottom: 28px; }
        .law-chip { padding: 9px 20px; border-radius: 8px; background: var(--green-glow); border: 1px solid rgba(16,185,129,0.2); font-family: 'JetBrains Mono', monospace; font-size: 13px; color: var(--green-l); font-weight: 500; }

        .why-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 18px; }
        .why-card { padding: 28px; border-radius: var(--r); background: white; border: 1px solid var(--light-border); text-align: center; transition: all 0.25s; }
        .why-card:hover { border-color: var(--blue); box-shadow: 0 8px 30px rgba(37,99,235,0.08); transform: translateY(-3px); }
        .why-icon { font-size: 28px; margin-bottom: 12px; }
        .why-card h3 { font-size: 17px; font-weight: 700; margin-bottom: 6px; color: var(--light-text); font-family: 'Noto Sans TC', sans-serif; }
        .why-card p { font-size: 14px; color: var(--light-text2); line-height: 1.5; font-family: 'Noto Sans TC', sans-serif; }

        /* CHANGE 1: 4 columns, position: relative on all cards */
        .price-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 18px; }
        .price-card { padding: 32px; border-radius: var(--r-lg); border: 1px solid var(--border); background: var(--surface2); position: relative; }
        .price-card.pop { border: 2px solid var(--blue); box-shadow: 0 8px 40px rgba(37,99,235,0.12); }
        .price-card.biz { border: 1.5px solid rgba(245,158,11,0.4); background: linear-gradient(135deg, var(--surface2) 0%, rgba(245,158,11,0.04) 100%); }
        .price-pop { position: absolute; top: -12px; left: 50%; transform: translateX(-50%); padding: 4px 16px; border-radius: 100px; background: var(--blue); color: white; font-size: 12px; font-weight: 700; white-space: nowrap; }
        .price-biz-badge { position: absolute; top: -12px; left: 50%; transform: translateX(-50%); padding: 4px 16px; border-radius: 100px; background: var(--amber); color: #000; font-size: 12px; font-weight: 700; white-space: nowrap; }
        .price-tier { font-size: 16px; font-weight: 600; color: var(--text2); margin-bottom: 8px; }
        .price-val { font-family: 'DM Serif Display', serif; font-size: 42px; color: var(--text); margin-bottom: 4px; }
        .price-val span { font-size: 16px; font-weight: 400; color: var(--text3); font-family: 'Instrument Sans', sans-serif; }
        .price-note { font-size: 14px; color: var(--text3); margin-bottom: 24px; }
        .price-list { list-style: none; padding: 0; margin-bottom: 24px; }
        .price-list li { padding: 5px 0; font-size: 15px; color: var(--text2); }
        .price-list li::before { content: '✓ '; color: var(--green); font-weight: 700; }
        .price-subnote { margin-top: 10px; font-size: 12px; color: var(--text3); text-align: center; line-height: 1.5; }

        .cta { padding: 100px 24px; text-align: center; position: relative; overflow: hidden; }
        .cta::before { content: ''; position: absolute; bottom: 0; left: 50%; transform: translateX(-50%); width: 800px; height: 400px; background: radial-gradient(ellipse, rgba(37,99,235,0.1), transparent); pointer-events: none; }
        .cta h2 { font-family: 'DM Serif Display', 'Noto Sans TC', serif; font-size: clamp(30px, 5vw, 46px); font-weight: 400; margin-bottom: 14px; position: relative; }
        .cta p { font-size: 17px; color: var(--text2); margin-bottom: 36px; max-width: 480px; margin-left: auto; margin-right: auto; position: relative; }
        .cta-acts { display: flex; gap: 12px; justify-content: center; flex-wrap: wrap; margin-bottom: 20px; position: relative; }
        .cta-note { font-size: 14px; color: var(--text3); position: relative; }

        .foot { padding: 24px; border-top: 1px solid var(--border); }
        .foot-in { max-width: var(--mw); margin: 0 auto; display: flex; align-items: center; justify-content: space-between; }
        .foot-l { font-size: 14px; color: var(--text3); }
        .foot-links { display: flex; gap: 20px; }
        .foot-links a { font-size: 14px; color: var(--text3); transition: color 0.15s; }
        .foot-links a:hover { color: var(--blue-l); }

        /* ═══ RESPONSIVE ═══ */
        @media (max-width: 768px) {
          .nav-links, .nav-acts .btn-o, .lang-tag { display: none; }
          .mob-tog { display: flex; }
          .nav-in { padding: 0 16px; }
          .nav-brand { font-size: 15px; gap: 8px; }
          .nav-mark { width: 30px; height: 30px; font-size: 12px; }
          .nav-acts .btn-p { padding: 8px 14px; font-size: 12px; white-space: nowrap; }
          .hero { padding: 110px 16px 60px; }
          .hero h1 { font-size: 28px; line-height: 1.15; }
          .hero-badges { gap: 8px; margin-bottom: 20px; }
          .hero-badges .badge { font-size: 11px; padding: 5px 10px; }
          .hero-sub-zh { font-size: 15px; margin-bottom: 16px; }
          .hero-desc { font-size: 14px; margin-bottom: 28px; line-height: 1.7; }
          .hero-acts { flex-direction: column; align-items: center; gap: 10px; margin-bottom: 32px; }
          .hero-acts .btn { width: 100%; max-width: 280px; justify-content: center; }
          .hero-pills { gap: 6px; }
          .hero-pill { padding: 5px 10px; font-size: 11px; }
          .hero-pill span { font-size: 12px; }
          .sec { padding: 60px 16px; }
          .sec-hd { margin-bottom: 32px; }
          .sec-title { font-size: 24px !important; }
          .sec-desc { font-size: 14px; }
          .sec-label { font-size: 15px; }
          .terminal { border-radius: 12px; }
          .terminal-body { padding: 16px; }
          .chat-bubble { padding: 12px 14px; font-size: 13px; }
          .chat-zh { font-size: 14px; }
          .compliance-seal { padding: 10px 14px; }
          .seal-list li { font-size: 12px; }
          .prob-grid { grid-template-columns: 1fr; gap: 12px; }
          .prob-card { padding: 20px; }
          .prob-card h3 { font-size: 15px; }
          .prob-card p { font-size: 13px; }
          .prob-stat { font-size: 20px; }
          .compare-grid { grid-template-columns: 1fr; }
          .compare-header { padding: 14px 16px; font-size: 13px; }
          .compare-cell { padding: 12px 16px; }
          .compare-cell p { font-size: 13px; }
          .pillar, .pillar.rev { grid-template-columns: 1fr; gap: 24px; direction: ltr; }
          .pillar.rev > * { direction: ltr; }
          .pillar-title { font-size: 22px !important; }
          .pillar-desc { font-size: 13px; }
          .pillar-label { font-size: 14px; }
          .pillar-feat { font-size: 12.5px; }
          .pillar-feat-icon { width: 24px; height: 24px; font-size: 12px; }
          .kv-card, .wv-card, .ev-card, .sop-card { padding: 16px; }
          .kv-row { flex-direction: column; gap: 8px; }
          .kv-doc { padding: 10px; }
          .kv-chat { font-size: 12px; padding: 10px 12px; }
          .kv-search { padding: 8px 12px; }
          .kv-search-text { font-size: 12px; }
          .wv-toolbar { gap: 4px; }
          .wv-btn { padding: 4px 8px; font-size: 10px; }
          .wv-content { padding: 10px; font-size: 12px; }
          .wv-preview { padding: 10px; font-size: 12px; }
          .ev-fields { grid-template-columns: 1fr; gap: 6px; }
          .ev-input { font-size: 13px; padding: 10px 14px; }
          .ev-field { padding: 6px 10px; }
          .ev-field-val { font-size: 12px; }
          .ev-submit { font-size: 12px; padding: 8px; }
          .ev-compliance { padding: 8px 12px; }
          .ev-compliance-text { font-size: 10px; }
          .sop-fields { grid-template-columns: 1fr; gap: 6px; }
          .sop-input { font-size: 13px; padding: 10px 14px; }
          .sop-field { padding: 8px 12px; }
          .sop-field-val { font-size: 12px; }
          .sop-insight { padding: 10px 12px; }
          .sop-insight-text { font-size: 11px; }
          .sop-submit { font-size: 12px; padding: 9px; }
          .compliance-sec { padding: 50px 16px; }
          .law-chips { gap: 6px; }
          .law-chip { padding: 6px 12px; font-size: 11px; }
          .why-grid { grid-template-columns: 1fr; gap: 12px; }
          .why-card { padding: 20px; text-align: left; display: flex; align-items: flex-start; gap: 14px; }
          .why-icon { font-size: 24px; margin-bottom: 0; flex-shrink: 0; }
          .why-card h3 { font-size: 14px; }
          .why-card p { font-size: 12px; }
          /* CHANGE 2: mobile stays 1 column */
          .price-grid { grid-template-columns: 1fr; gap: 16px; }
          .price-card { padding: 24px; }
          .price-val { font-size: 36px; }
          .price-list li { font-size: 13px; }
          .cta { padding: 60px 16px; }
          .cta h2 { font-size: 24px; }
          .cta p { font-size: 14px; }
          .cta-acts { flex-direction: column; align-items: center; gap: 10px; }
          .cta-acts .btn { width: 100%; max-width: 280px; justify-content: center; }
          .cta-note { font-size: 11px; }
          .foot { padding: 20px 16px; }
          .foot-in { flex-direction: column; gap: 12px; text-align: center; }
          .foot-l { font-size: 11px; }
          .foot-links { gap: 16px; }
          .foot-links a { font-size: 12px; }
        }
        @media (max-width: 380px) {
          .hero h1 { font-size: 24px; }
          .hero-pills { display: grid; grid-template-columns: 1fr 1fr; gap: 4px; }
          .hero-pill { justify-content: center; font-size: 10px; padding: 4px 8px; }
          .sec-title { font-size: 20px !important; }
          .pillar-title { font-size: 19px !important; }
          .price-val { font-size: 30px; }
          .nav-brand { font-size: 14px; }
        }
      `}</style>

      <nav className={`nav ${navScrolled ? 'sc' : ''}`}>
        <div className="nav-in">
          <a href="/" className="nav-brand"><div className="nav-mark">P</div> Atlas EIP</a>
          <div className="nav-links">
            <a href="#problem">痛點</a>
            <a href="#platform">平台功能</a>
            <a href="#compliance">合規引擎</a>
            <a href="#pricing">價格</a>
            <a href="/audit" style={{color: '#FCA5A5'}}>🔍 免費掃描</a>
          </div>
          <div className="nav-acts">
            <span className="lang-tag">EN / 中文</span>
            <a href="/login" className="btn btn-o">登入</a>
            <a href="/signup" className="btn btn-p">免費註冊 →</a>
            <button className="mob-tog" onClick={() => setMobileMenuOpen(!mobileMenuOpen)}><span className={mobileMenuOpen ? 'open' : ''} /></button>
          </div>
        </div>
      </nav>
      <div className={`mob-menu ${mobileMenuOpen ? 'show' : ''}`}>
        <a href="#problem" onClick={() => setMobileMenuOpen(false)}>痛點</a>
        <a href="#platform" onClick={() => setMobileMenuOpen(false)}>平台功能</a>
        <a href="#compliance" onClick={() => setMobileMenuOpen(false)}>合規引擎</a>
        <a href="#pricing" onClick={() => setMobileMenuOpen(false)}>價格</a>
        <a href="/audit" onClick={() => setMobileMenuOpen(false)} style={{color: '#FCA5A5'}}>🔍 免費掃描</a>
        <a href="/login" onClick={() => setMobileMenuOpen(false)}>登入</a>
        <a href="/signup" className="btn btn-p" style={{ justifyContent: 'center' }}>免費註冊 →</a>
      </div>

      <section className="hero">
        <div className="hero-in">
          <div className="hero-badges">
            <span className="badge badge-blue">Enterprise Intelligence Platform</span>
            <span className="badge badge-green"><span className="badge-dot" /> 2026 LSA Compliant</span>
          </div>
          <h1>From <span className="hl-blue">Knowledge</span> to <span className="hl-green">Action</span><br />in One Step.</h1>
          <div className="hero-sub-zh">從知識到行動，一步到位。台灣企業的智慧中樞。</div>
          <p className="hero-desc">One box. Zero forms. Your team speaks naturally — the AI reads your SOPs, enforces <strong>2026 Taiwan Labor Standards</strong>, and executes compliant workflows instantly.</p>
          <div className="hero-acts">
            <a href="/signup" className="btn btn-p btn-lg">免費開始使用 →</a>
            <a href="#demo" className="btn btn-o btn-lg">探索功能</a>
          </div>
          <div className="hero-pills">
            <div className="hero-pill"><span>🛡️</span> 2026 合規引擎</div>
            <div className="hero-pill"><span>🤖</span> Agentic Auditor</div>
            <div className="hero-pill"><span>📊</span> ESG 報告</div>
            <div className="hero-pill"><span>🧠</span> AI 知識管理</div>
            <div className="hero-pill"><span>📋</span> NLP 智慧表單</div>
            <div className="hero-pill"><span>✍️</span> AI 寫作助手</div>
          </div>
        </div>
      </section>

      <section className="sec sec-dark2" id="demo">
        <div className="con">
          <div className="sec-hd ctr"><div className="sec-label sec-label-green">Live Demo</div><div className="sec-title">一句話完成合規請假</div><p className="sec-desc">員工用自然語言說需求，AI 自動解析、合規檢查、送出表單。</p></div>
          <div className="terminal fi">
            <div className="terminal-bar"><span className="t-dot t-dot-r" /><span className="t-dot t-dot-y" /><span className="t-dot t-dot-g" /><span className="t-title">atlas-eip v2.0 — compliance demo</span></div>
            <div className="terminal-body">
              <div className="chat-msg"><div className="chat-label chat-label-user">Employee 員工</div><div className="chat-bubble chat-user"><div className="chat-zh">老闆，我小孩發燒，今天請假兩小時</div><div className="chat-en-sub">Boss, kid has a fever, taking 2 hours off today</div></div></div>
              <div className="chat-msg"><div className="chat-label chat-label-ai">Atlas AI</div><div className="chat-bubble chat-ai">已為您登記 <strong>2 小時家庭照顧假（Family Care Leave）</strong>。您的 2026 年度餘額剩餘 <strong>54 小時</strong>。根據 Project Atlas 的任務分配，已預選 <strong>Kevin Chen</strong> 作為您的代理人。祝早日康復！<div className="compliance-seal"><div className="seal-title">✅ Atlas Compliance Check</div><ul className="seal-list"><li>依 2026 勞基法，以 1 小時為單位申請</li><li>未超過年度 56 小時家庭照顧假上限</li><li>全勤獎金受 Art. 9-1 保障，不受影響</li></ul></div></div></div>
            </div>
          </div>
        </div>
      </section>

      <section className="sec" id="problem"><div className="con"><div className="sec-hd"><div className="sec-label sec-label-blue">企業現況</div><div className="sec-title">2026 法規更嚴格了，你的系統跟上了嗎？</div><p className="sec-desc">勞動部新規、ESG 要求、小時制假別 — 傳統 ERP 無法應對。</p></div><div className="prob-grid">{[{icon:'⚖️',title:'2026 勞基法合規風險',desc:'家庭照顧假改為小時制、全勤獎金不可扣除 — 違規罰款最高 100 萬。你的系統能自動處理嗎？',stat:'NT$1M'},{icon:'📋',title:'ERP 流程太繁瑣',desc:'請假要填十個欄位，出差要選八個下拉選單。明明一句話就能說清楚的事情。',stat:'10min'},{icon:'📊',title:'ESG 報告壓力',desc:'國際客戶要求可驗證的勞動數據。手動整理 Excel 報表已經來不及了。',stat:'致命'}].map((p)=>(<div className="prob-card fi" key={p.title}><div className="prob-icon">{p.icon}</div><h3>{p.title}</h3><p>{p.desc}</p><div className="prob-stat">{p.stat}</div></div>))}</div></div></section>

      <section className="sec sec-light"><div className="con"><div className="sec-hd"><div className="sec-label sec-label-dark">為什麼要換</div><div className="sec-title" style={{color:'var(--light-text)'}}>傳統 ERP 是上個時代的產物</div><p className="sec-desc" style={{color:'var(--light-text2)'}}>傳統 ERP 需要手動更新、獨立 SOP 資料夾、表單密集的流程。Atlas 讓知識與行動合一。</p></div><div className="compare-grid fi"><div className="compare-header legacy">傳統 ERP </div><div className="compare-header atlas">Atlas EIP (2026)</div>{[{label:'SOP 存取',legacy:'在另一個資料夾搜尋 PDF',atlas:'融合式。AI 讀取 SOP 自動填寫表單。'},{label:'法規合規',legacy:'每年手動更新一次',atlas:'自動同步。2026 勞基法內建於每個流程。'},{label:'使用方式',legacy:'選擇「病假」→ 選日期 → 寫理由',atlas:'自然語言。「我生病了，在家休息。」— 完成。'},{label:'ESG 報告',legacy:'手動整理 Excel 數據',atlas:'即時。一鍵產出自動化法規報告。'},{label:'代理人',legacy:'員工自己去問同事',atlas:'AI 讀取組織圖 + 專案資料，建議最佳人選。'}].map((r,i)=>(<div key={i} style={{display:'contents'}}><div className="compare-cell"><div className="compare-cell-label">{r.label}</div><p>{r.legacy}</p></div><div className="compare-cell atlas-col"><div className="compare-cell-label">{r.label}</div><p>{r.atlas}</p></div></div>))}</div></div></section>

      <div id="platform">
      <section className="sec"><div className="con"><div className="pillar fi"><div><div className="pillar-label" style={{color:'var(--blue-l)'}}>核心一 · AI 知識管理</div><div className="pillar-title">上傳文件，AI 幫你整理、搜尋、回答</div><div className="pillar-desc">上傳任何文件，AI 自動標籤分類。用自然語言搜尋或對話，取得有來源引用的精準答案。還有知識圖譜，讓你看見知識之間的關聯。</div><div className="pillar-features"><div className="pillar-feat"><div className="pillar-feat-icon" style={{background:'var(--blue-glow)'}}>🔍</div><div><strong>語意混合搜尋</strong> — 語意理解 + 關鍵字比對，中英文自動偵測</div></div><div className="pillar-feat"><div className="pillar-feat-icon" style={{background:'rgba(139,92,246,0.1)'}}>💬</div><div><strong>AI 文件對話</strong> — 問問題，得到附來源引用的答案</div></div><div className="pillar-feat"><div className="pillar-feat-icon" style={{background:'rgba(245,158,11,0.1)'}}>🏷️</div><div><strong>自動標籤</strong> — GPT-4o-mini 自動分類，不需手動整理</div></div><div className="pillar-feat"><div className="pillar-feat-icon" style={{background:'var(--green-glow)'}}>🌐</div><div><strong>知識圖譜</strong> — 互動式視覺化，探索文件之間的關聯</div></div></div></div><div className="pillar-visual"><div className="kv-card"><div className="kv-search"><div className="kv-search-icon">🔍</div><div className="kv-search-text">搜尋「客戶報告」或問 AI 問題...</div></div><div className="kv-row"><div className="kv-doc"><div className="kv-doc-icon">📄</div><div className="kv-doc-title">Q4 業務報告</div><div className="kv-doc-meta">v2.1 · 2 天前更新</div><div><span className="kv-tag" style={{background:'var(--blue-glow)',color:'var(--blue-l)'}}>報告</span><span className="kv-tag" style={{background:'rgba(139,92,246,0.1)',color:'var(--violet)'}}>業務</span></div></div><div className="kv-doc"><div className="kv-doc-icon">📋</div><div className="kv-doc-title">新人培訓手冊</div><div className="kv-doc-meta">v1.3 · 已發佈</div><div><span className="kv-tag" style={{background:'rgba(245,158,11,0.1)',color:'var(--amber)'}}>培訓</span><span className="kv-tag" style={{background:'var(--green-glow)',color:'var(--green)'}}>HR</span></div></div></div><div className="kv-chat">💬 根據 Q4 報告，本季營收成長了 23%，主要由企業客戶帶動。<span style={{fontSize:11,color:'var(--text3)'}}> — 來源: Q4 業務報告 p.12</span></div></div></div></div></div></section>

      <section className="sec sec-dark2"><div className="con"><div className="pillar rev fi"><div><div className="pillar-label" style={{color:'var(--green-l)'}}>核心二 · AI 智慧工具</div><div className="pillar-title">寫作、翻譯、匯出 — AI 幫你加速</div><div className="pillar-desc">內建 AI 寫作助手，選取文字即可改善、翻譯、調整語氣。支援五種格式匯出，還有公開 API 讓外部系統串接。</div><div className="pillar-features"><div className="pillar-feat"><div className="pillar-feat-icon" style={{background:'var(--green-glow)'}}>✨</div><div><strong>AI 寫作助手</strong> — 改善、翻譯、縮短、擴展、調整語氣</div></div><div className="pillar-feat"><div className="pillar-feat-icon" style={{background:'rgba(245,158,11,0.1)'}}>📤</div><div><strong>五格式匯出</strong> — PDF、Word、HTML、Markdown、純文字</div></div><div className="pillar-feat"><div className="pillar-feat-icon" style={{background:'rgba(239,68,68,0.1)'}}>🔑</div><div><strong>公開 API v1</strong> — RESTful API，外部系統可直接串接</div></div><div className="pillar-feat"><div className="pillar-feat-icon" style={{background:'var(--blue-glow)'}}>📝</div><div><strong>協作工具</strong> — 行內留言、文件範本、版本追蹤</div></div></div></div><div className="pillar-visual"><div className="wv-card"><div className="wv-toolbar"><div className="wv-btn active">✨ 改善</div><div className="wv-btn">📝 修正文法</div><div className="wv-btn">🇹🇼 翻譯中文</div><div className="wv-btn">👔 正式</div><div className="wv-btn">📏 加長</div><div className="wv-btn">📊 摘要</div></div><div className="wv-content">Our company performance this quarter was good. We made more money than before and customers seem happy with our products.</div><div className="wv-preview"><div className="wv-preview-label">✨ AI 改善結果</div>Our company delivered strong results this quarter, with revenue growth exceeding prior-period benchmarks. Customer satisfaction metrics reflect the positive reception of our product enhancements.</div></div></div></div></div></section>

      <section className="sec" style={{background:'linear-gradient(180deg, #0f1420 0%, #1a1040 100%)'}}><div className="con"><div className="pillar fi"><div><div className="pillar-label" style={{color:'var(--blue-l)'}}>核心三 · 智慧執行層</div><div className="pillar-title">Stop Reading SOPs.<br/>Start Executing Them.</div><div className="pillar-desc">傳統的 SOP 是躺在資料夾裡的 PDF。在 Atlas，SOP 是活的。當員工提出需求，AI 會即時檢索公司手冊，確保每一筆申請都符合公司規範與法律要求。</div><div className="pillar-features"><div className="pillar-feat"><div className="pillar-feat-icon" style={{background:'var(--blue-glow)'}}>🧠</div><div><strong>Contextual Retrieval</strong> — AI 根據員工職級與部門，自動套用對應的差旅與請假福利。</div></div><div className="pillar-feat"><div className="pillar-feat-icon" style={{background:'var(--green-glow)'}}>🛡️</div><div><strong>Zero-Violation</strong> — 自動比對 2026 勞基法與公司內規，從源頭杜絕合規風險。</div></div><div className="pillar-feat"><div className="pillar-feat-icon" style={{background:'rgba(139,92,246,0.1)'}}>⚡</div><div><strong>One-Click Fill</strong> — 只要說出「我要出差」，AI 自動根據歷史數據與手冊建議最佳流程。</div></div></div></div><div className="pillar-visual"><div className="sop-card"><div className="sop-label"><span className="sop-pulse" /> AI AGENT CROSS-CHECKING SOP...</div><div className="sop-input">{'"下週三要去新竹廠支援兩天，住那邊"'}</div><div className="sop-arrow">↓ AI 檢索公司手冊</div><div className="sop-fields"><div className="sop-field pulse"><div className="sop-field-label">DOC RETRIEVED</div><div className="sop-field-val">《員工差旅管理辦法 v2.6》</div></div><div className="sop-field"><div className="sop-field-label">ALLOWANCE</div><div className="sop-field-val">NT$2,200 / Night</div></div><div className="sop-field"><div className="sop-field-label">DESTINATION</div><div className="sop-field-val">新竹科學園區</div></div><div className="sop-field"><div className="sop-field-label">DURATION</div><div className="sop-field-val">2 Days + 1 Night</div></div></div><div className="sop-insight"><div className="sop-insight-title">💡 Policy Insight</div><div className="sop-insight-text">根據您的手冊：跨縣市支援可申請<strong>「遠端補助」</strong>。已自動為您勾選。</div></div><div className="sop-submit">確認送出申請 →</div></div></div></div></div></section>

      <section className="sec"><div className="con"><div className="pillar fi"><div><div className="pillar-label" style={{color:'var(--amber)'}}>核心四 · 合規流程自動化</div><div className="pillar-title">用一句話填完請假單，AI 自動合規檢查</div><div className="pillar-desc">不再需要點選十個欄位。用自然語言描述需求，AI 自動解析並填好表單。每一筆申請都經過 2026 勞基法合規檢查，附帶 Compliance Seal。</div><div className="pillar-features"><div className="pillar-feat"><div className="pillar-feat-icon" style={{background:'var(--blue-glow)'}}>📝</div><div><strong>NLP 智慧表單</strong> — 自然語言自動填寫，支援中英文</div></div><div className="pillar-feat"><div className="pillar-feat-icon" style={{background:'var(--green-glow)'}}>🛡️</div><div><strong>2026 合規引擎</strong> — 小時制假別、全勤獎金保護、最低工資檢查</div></div><div className="pillar-feat"><div className="pillar-feat-icon" style={{background:'rgba(245,158,11,0.1)'}}>✅</div><div><strong>審核流程</strong> — 主管即時審核，批次核准/駁回</div></div><div className="pillar-feat"><div className="pillar-feat-icon" style={{background:'rgba(139,92,246,0.1)'}}>🤖</div><div><strong>Agentic Auditor</strong> — AI 預先審查，自動附加 SOP 相關政策</div></div><div className="pillar-feat"><div className="pillar-feat-icon" style={{background:'rgba(239,68,68,0.1)'}}>📊</div><div><strong>ESG 報告</strong> — 一鍵產出性別中立假別、加班合規報告</div></div></div></div><div className="pillar-visual"><div className="ev-card"><div className="ev-label">🤖 AI 智慧填寫 + 合規檢查</div><div className="ev-input">{'"我下週一到週三要請特休，因為要回南部探親"'}</div><div className="ev-arrow">↓ AI 自動解析 + 合規驗證</div><div className="ev-fields"><div className="ev-field"><div className="ev-field-label">假別 Leave Type</div><div className="ev-field-val">特休 Annual</div></div><div className="ev-field"><div className="ev-field-label">開始日期 Start</div><div className="ev-field-val">2026-03-09</div></div><div className="ev-field"><div className="ev-field-label">結束日期 End</div><div className="ev-field-val">2026-03-11</div></div><div className="ev-field"><div className="ev-field-label">天數 Days</div><div className="ev-field-val">3</div></div></div><div className="ev-submit">📤 確認送出 Submit</div><div className="ev-compliance"><div className="ev-compliance-title">✅ Compliance Seal</div><div className="ev-compliance-text">符合 2026 勞基法 · 特休餘額充足 (4/7) · 已建議代理人: Kevin Chen</div></div></div></div></div></div></section>
      </div>

      <section className="compliance-sec" id="compliance"><div className="con"><div className="sec-label" style={{color:'var(--green-l)',textAlign:'center'}}>Built for 2026</div><div className="sec-title" style={{textAlign:'center',color:'#fff',marginBottom:12}}>每一筆流程都附帶 Compliance Seal</div><p style={{textAlign:'center',color:'rgba(255,255,255,0.5)',fontSize:15,maxWidth:550,margin:'0 auto 32px',lineHeight:1.7}}>台灣勞動部 2026 年新規：小時制假別、比例計算、全勤獎金保護。Atlas 在送出前自動檢查每一筆申請。</p><div className="law-chips"><span className="law-chip">家庭照顧假 56hr/年</span><span className="law-chip">育嬰假 1 天為單位</span><span className="law-chip">病假 Art 9-1</span><span className="law-chip">基本工資 NT$29,500</span><span className="law-chip">加班上限 46hr/月</span><span className="law-chip">ESG S-Pillar</span></div><div style={{textAlign:'center'}}><a href="#demo" className="btn btn-p">See Compliance in Action →</a>
<a href="/audit" className="btn btn-w" style={{marginLeft: 12}}>🔍 免費掃描你的手冊 →</a></div></div></section>

      <section className="sec sec-light"><div className="con"><div className="sec-hd ctr"><div className="sec-label sec-label-dark">為什麼選擇 Atlas</div><div className="sec-title" style={{color:'var(--light-text)'}}>從第一天就為台灣企業設計</div></div><div className="why-grid">{[{icon:'🛡️',title:'2026 法規內建',desc:'不是外掛模組，而是從核心邏輯就內建勞基法合規檢查。'},{icon:'💬',title:'自然語言驅動',desc:'用一句話取代十個欄位。AI 理解你的需求，自動填寫表單。'},{icon:'🔗',title:'知識 + 流程融合',desc:'SOP 不再是獨立文件。AI 讀取政策後直接執行合規流程。'},{icon:'📊',title:'一鍵 ESG 報告',desc:'勞動數據自動追蹤，隨時產出符合國際標準的 ESG 報告。'}].map((w)=>(<div className="why-card fi" key={w.title}><div className="why-icon">{w.icon}</div><div><h3>{w.title}</h3><p>{w.desc}</p></div></div>))}</div></div></section>

      {/* CHANGE 3: PRICING SECTION — 4 cards including 商務版 */}
      <section className="sec sec-dark2" id="pricing"><div className="con"><div className="sec-hd ctr"><div className="sec-label sec-label-blue">方案價格</div><div className="sec-title">Enterprise Intelligence，合理價格</div><p className="sec-desc">免費探索，團隊成長時升級。合規功能每個方案都有。</p></div><div className="price-grid">

        {/* Card 1: Explorer */}
        <div className="price-card fi">
          <div className="price-tier">Explorer 探索版</div>
          <div className="price-val">$0<span>/月</span></div>
          <div className="price-note">單人或小型試用</div>
          <ul className="price-list">
            <li>最多 50 份文件</li>
            <li>語意搜尋 + AI 對話</li>
            <li>NLP 表單 + 基礎合規檢查</li>
            <li>1 位使用者</li>
          </ul>
          <a href="/signup" className="btn btn-o" style={{width:'100%',justifyContent:'center'}}>免費開始</a>
        </div>

        {/* Card 2: Team */}
        <div className="price-card pop fi">
          <div className="price-pop">Recommended</div>
          <div className="price-tier">Team 團隊版</div>
          <div className="price-val">$49<span>/月</span></div>
          <div className="price-note">每個工作空間</div>
          <ul className="price-list">
            <li>無限文件</li>
            <li>AI Agent + 寫作助手</li>
            <li>最多 15 位成員</li>
            <li>完整 2026 合規引擎</li>
            <li>Agentic Auditor 預審</li>
            <li>ESG 社會面報告</li>
            <li>五格式匯出 + API</li>
            <li>稽核日誌 + 品牌設定</li>
          </ul>
          <a href="/signup" className="btn btn-p" style={{width:'100%',justifyContent:'center'}}>立即升級 →</a>
        </div>

        {/* Card 3: 商務版 — NEW */}
        <div className="price-card biz fi">
          <div className="price-biz-badge">🏛️ 政府補助適用</div>
          <div className="price-tier" style={{color:'var(--amber)'}}>商務版 Business</div>
          <div className="price-val" style={{color:'var(--amber)'}}>NT$3,000<span>/月</span></div>
          <div className="price-note">年繳 NT$36,000（含稅）· 最多 30 位成員</div>
          <ul className="price-list">
            <li>無限文件上傳</li>
            <li>AI Agent + Atlas 知識問答</li>
            <li>NLP 工作流程（13種假別）</li>
            <li>完整 2026 勞基法合規引擎</li>
            <li>500次/月 AI 掃描</li>
            <li>ESG 社會面報告</li>
            <li>勞動成本自動試算與警示</li>
            <li>CSV / Excel 完整匯出</li>
            <li>稽核日誌 + 品牌設定</li>
            <li>台北在地導入支援</li>
            <li>優先技術支援</li>
          </ul>
          <a href="/signup" className="btn btn-p" style={{width:'100%',justifyContent:'center',background:'var(--amber)',color:'#000',boxShadow:'0 2px 16px rgba(245,158,11,0.3)'}}>立即開始 →</a>
          <div className="price-subnote">符合商業服務業智慧轉型專區補助資格<br/>續約9折 · 超過30人每+10人加收NT$5,000/年</div>
        </div>

        {/* Card 4: Enterprise */}
        <div className="price-card fi">
          <div className="price-tier">Enterprise 企業版</div>
          <div className="price-val">客製</div>
          <div className="price-note">適合大型組織</div>
          <ul className="price-list">
            <li>團隊版所有功能</li>
            <li>無限成員數</li>
            <li>SSO 單一登入</li>
            <li>自訂表單類型 + 審核流程</li>
            <li>Predictive 容量規劃</li>
            <li>LINE 語音整合</li>
            <li>專屬客戶成功經理</li>
          </ul>
          <a href="/contact" className="btn btn-o" style={{width:'100%',justifyContent:'center'}}>聯繫我們</a>
        </div>

      </div></div></section>

      <section className="cta"><h2>讓 AI 守護你的每一筆流程</h2><p>合規、智慧、一站式。從知識管理到流程自動化，一個平台全搞定。</p><div className="cta-acts"><a href="/signup" className="btn btn-p btn-lg">免費開始使用 →</a><a href="/contact" className="btn btn-w btn-lg">預約 Demo</a><a href="/audit" className="btn btn-o btn-lg">🔍 免費合規掃描</a>
</div><div className="cta-note">hello@primestrideatlas.com · 不需信用卡 · 五分鐘完成設定</div></section>

      <footer className="foot"><div className="foot-in"><div className="foot-l">&copy; 2026 Atlas EIP — Enterprise Intelligence Platform</div><div className="foot-links"><a href="/contact">聯繫我們</a><a href="/privacy">Privacy</a>
<a href="/terms">Terms</a></div></div></footer>
    </>
  );
}