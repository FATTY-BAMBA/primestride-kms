'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/AuthContext';

// ─── Particle Background ───────────────────────────────────────────────────
function ParticleBackground() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const particlesRef = useRef<{ x: number; y: number; vx: number; vy: number; size: number; opacity: number }[]>([]);
  const mouseRef = useRef({ x: 0, y: 0 });
  const animRef = useRef<number>();

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const resize = () => { canvas.width = window.innerWidth; canvas.height = window.innerHeight; };
    resize();
    window.addEventListener('resize', resize);

    particlesRef.current = Array.from({ length: 20 }, () => ({
      x: Math.random() * canvas.width,
      y: Math.random() * canvas.height,
      vx: (Math.random() - 0.5) * 0.25,
      vy: (Math.random() - 0.5) * 0.25,
      size: Math.random() * 1.5 + 0.5,
      opacity: Math.random() * 0.2 + 0.05,
    }));

    const onMouseMove = (e: MouseEvent) => { mouseRef.current = { x: e.clientX, y: e.clientY }; };
    window.addEventListener('mousemove', onMouseMove);

    const animate = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      particlesRef.current.forEach((p, i) => {
        const dx = mouseRef.current.x - p.x;
        const dy = mouseRef.current.y - p.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < 80) { p.vx -= (dx / dist) * 0.3; p.vy -= (dy / dist) * 0.3; }
        p.x += p.vx; p.y += p.vy; p.vx *= 0.99; p.vy *= 0.99;
        if (p.x < 0) p.x = canvas.width; if (p.x > canvas.width) p.x = 0;
        if (p.y < 0) p.y = canvas.height; if (p.y > canvas.height) p.y = 0;
        ctx.beginPath(); ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(29,78,216,${p.opacity})`; ctx.fill();
        particlesRef.current.slice(i + 1).forEach(o => {
          const d = Math.sqrt(Math.pow(p.x - o.x, 2) + Math.pow(p.y - o.y, 2));
          if (d < 120) {
            ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(o.x, o.y);
            ctx.strokeStyle = `rgba(29,78,216,${0.08 * (1 - d / 120)})`; ctx.lineWidth = 0.5; ctx.stroke();
          }
        });
      });
      animRef.current = requestAnimationFrame(animate);
    };
    animate();
    return () => { window.removeEventListener('resize', resize); window.removeEventListener('mousemove', onMouseMove); if (animRef.current) cancelAnimationFrame(animRef.current); };
  }, []);

  return <canvas ref={canvasRef} style={{ position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 0 }} />;
}

// ─── Interactive NLP Demo ──────────────────────────────────────────────────
function NLPDemo() {
  const [input, setInput] = useState('');
  const [processing, setProcessing] = useState(false);
  const [result, setResult] = useState<{ leaveType: string; days: string; start: string; end: string; proxy: string } | null>(null);

  const examples = [
    '我下週一到週三要請特休，回南部探親，代理人是小明',
    '明天想請半天病假，去醫院複診',
    '這週五要請事假處理家裡的事情',
  ];

  const parse = useCallback(() => {
    if (!input.trim()) return;
    setProcessing(true); setResult(null);
    setTimeout(() => {
      const lower = input.toLowerCase();
      const isSick = lower.includes('病假') || lower.includes('醫院');
      const isPersonal = lower.includes('事假') || lower.includes('家裡');
      const isHalf = lower.includes('半天');
      setResult({
        leaveType: isSick ? '病假 Sick Leave' : isPersonal ? '事假 Personal Leave' : '特休 Annual Leave',
        days: isHalf ? '0.5 天' : isSick || isPersonal ? '1 天' : '3 天',
        start: '2026-03-30',
        end: isHalf || isSick || isPersonal ? '2026-03-30' : '2026-04-01',
        proxy: input.includes('小明') ? '小明 (AI 建議)' : '—',
      });
      setProcessing(false);
    }, 900);
  }, [input]);

  return (
    <div>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 16 }}>
        {examples.map((ex, i) => (
          <button key={i} onClick={() => { setInput(ex); setResult(null); }} style={{ padding: '8px 14px', borderRadius: 8, fontSize: 12, color: 'var(--ink3)', background: 'var(--surf2)', border: '1px solid var(--bdr)', cursor: 'pointer', textAlign: 'left', transition: 'all 0.15s' }}
            onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--brand)'; e.currentTarget.style.color = 'var(--brand)'; }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--bdr)'; e.currentTarget.style.color = 'var(--ink3)'; }}>
            {ex.slice(0, 18)}...
          </button>
        ))}
      </div>
      <div style={{ display: 'flex', gap: 10, marginBottom: 16 }}>
        <input type="text" value={input} onChange={e => setInput(e.target.value)} onKeyDown={e => e.key === 'Enter' && parse()}
          placeholder="輸入請假內容，按 Enter 解析..." style={{ flex: 1, padding: '12px 16px', borderRadius: 10, border: '2px solid var(--bdr)', fontSize: 14, color: 'var(--ink)', background: 'white', fontFamily: 'inherit', outline: 'none', transition: 'border-color 0.2s' }}
          onFocus={e => e.currentTarget.style.borderColor = 'var(--brand)'}
          onBlur={e => e.currentTarget.style.borderColor = 'var(--bdr)'} />
        <button onClick={parse} disabled={!input.trim() || processing} style={{ padding: '12px 20px', borderRadius: 10, background: 'var(--brand)', color: 'white', fontSize: 14, fontWeight: 600, border: 'none', cursor: 'pointer', opacity: (!input.trim() || processing) ? 0.5 : 1, transition: 'all 0.2s' }}>
          {processing ? '⏳' : '解析 →'}
        </button>
      </div>
      {processing && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: 14, background: 'var(--surf2)', borderRadius: 10, marginBottom: 12, fontSize: 13, color: 'var(--ink3)' }}>
          <span style={{ display: 'inline-block', animation: 'spin 0.8s linear infinite' }}>↻</span> AI 正在解析...
        </div>
      )}
      {result && !processing && (
        <div style={{ animation: 'slideUp 0.4s ease-out' }}>
          <div style={{ textAlign: 'center', fontSize: 18, color: 'var(--brand)', marginBottom: 12 }}>↓ AI 自動解析</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 12 }}>
            {[['假別', result.leaveType], ['天數', result.days], ['開始日期', result.start], ['結束日期', result.end]].map(([label, val]) => (
              <div key={label} style={{ background: 'var(--surf2)', borderRadius: 8, padding: '10px 14px', border: '1px solid var(--bdr)' }}>
                <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--ink4)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 3 }}>{label}</div>
                <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--ink)' }}>{val}</div>
              </div>
            ))}
            <div style={{ gridColumn: '1/-1', background: 'var(--surf2)', borderRadius: 8, padding: '10px 14px', border: '1px solid var(--bdr)' }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--ink4)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 3 }}>職務代理人</div>
              <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--ink)' }}>{result.proxy}</div>
            </div>
          </div>
          <div style={{ padding: '12px 16px', borderRadius: 10, background: '#D1FAE5', border: '1px solid #A7F3D0', fontSize: 13, fontWeight: 600, color: '#059669', display: 'flex', alignItems: 'center', gap: 8 }}>
            ✅ 合規通過 — 特休餘額足夠，可送出申請
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Interactive Compliance Demo ───────────────────────────────────────────
function ComplianceDemo() {
  const [phase, setPhase] = useState<'idle' | 'scanning' | 'done'>('idle');

  const scan = () => {
    setPhase('scanning');
    setTimeout(() => setPhase('done'), 2800);
  };

  if (phase === 'idle') return (
    <div onClick={scan} style={{ padding: 40, border: '2px dashed var(--bdr)', borderRadius: 14, textAlign: 'center', cursor: 'pointer', transition: 'all 0.2s' }}
      onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--brand)'; e.currentTarget.style.background = 'var(--brand-glow)'; }}
      onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--bdr)'; e.currentTarget.style.background = 'transparent'; }}>
      <div style={{ fontSize: 44, marginBottom: 14 }}>📄</div>
      <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--ink)', marginBottom: 6 }}>點擊上傳員工手冊 PDF</div>
      <div style={{ fontSize: 13, color: 'var(--ink4)' }}>AI 自動逐條比對 2026 年勞基法</div>
    </div>
  );

  if (phase === 'scanning') return (
    <div style={{ padding: '20px 0' }}>
      <div style={{ height: 8, background: 'var(--surf2)', borderRadius: 4, overflow: 'hidden', marginBottom: 20 }}>
        <div style={{ height: '100%', width: '100%', background: 'linear-gradient(90deg, var(--brand), #8B5CF6)', borderRadius: 4, animation: 'scanProgress 2.8s ease-out forwards' }} />
      </div>
      <div style={{ textAlign: 'center', fontSize: 15, fontWeight: 600, color: 'var(--ink)', marginBottom: 20 }}>AI 正在掃描 47 頁文件...</div>
      <div style={{ display: 'flex', justifyContent: 'center', gap: 12, flexWrap: 'wrap' }}>
        {['讀取 PDF', '分析條文', '比對法規', '產生報告'].map((s, i) => (
          <div key={s} style={{ padding: '8px 16px', borderRadius: 8, fontSize: 13, color: i === 0 ? 'var(--brand)' : 'var(--ink4)', background: i === 0 ? 'var(--brand-xl)' : 'var(--surf2)', fontWeight: i === 0 ? 600 : 400, border: '1px solid var(--bdr)' }}>{s}</div>
        ))}
      </div>
    </div>
  );

  return (
    <div style={{ animation: 'slideUp 0.4s ease-out' }}>
      <div style={{ display: 'flex', gap: 10, marginBottom: 18, flexWrap: 'wrap' }}>
        {[['1 違規', '#DC2626', '#FEE2E2'], ['1 需更新', '#D97706', '#FEF3C7'], ['15 通過', '#059669', '#D1FAE5']].map(([label, color, bg]) => (
          <div key={label} style={{ padding: '5px 14px', borderRadius: 100, fontSize: 13, fontWeight: 700, color, background: bg }}>{label}</div>
        ))}
      </div>
      {[
        { type: 'error', icon: '✕', color: '#DC2626', bg: '#FEE2E2', border: '#FECACA', title: '加班費率規定不足', desc: '手冊記載「加班費為時薪 1.3 倍」，低於法定最低 1.34 倍', law: 'LSA Art. 24 — 加班費率 ↗' },
        { type: 'warning', icon: '!', color: '#D97706', bg: '#FEF3C7', border: '#FCD34D', title: '家庭照顧假條款未更新', desc: '2026 年起可按小時請假，手冊僅規定以天為單位', law: '勞工請假規則 Art. 7 ↗' },
        { type: 'success', icon: '✓', color: '#059669', bg: '#D1FAE5', border: '#A7F3D0', title: '特休天數規定符合標準', desc: '', law: 'LSA Art. 38 ↗' },
      ].map((item, i) => (
        <div key={i} style={{ display: 'flex', gap: 12, padding: 14, borderRadius: 10, background: item.bg, border: `1px solid ${item.border}`, marginBottom: 10 }}>
          <div style={{ width: 22, height: 22, borderRadius: '50%', background: item.color, color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700, flexShrink: 0 }}>{item.icon}</div>
          <div>
            <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--ink)', marginBottom: item.desc ? 4 : 0 }}>{item.title}</div>
            {item.desc && <div style={{ fontSize: 12, color: 'var(--ink3)', marginBottom: 4, lineHeight: 1.5 }}>{item.desc}</div>}
            <div style={{ fontSize: 11, color: 'var(--brand)', fontWeight: 600 }}>📖 {item.law}</div>
          </div>
        </div>
      ))}
      <button onClick={() => setPhase('idle')} style={{ width: '100%', padding: 10, borderRadius: 8, border: '1px solid var(--bdr)', background: 'white', fontSize: 13, color: 'var(--ink3)', cursor: 'pointer', marginTop: 4 }}>重新掃描</button>
    </div>
  );
}

// ─── Interactive Subsidy Demo ──────────────────────────────────────────────
function SubsidyDemo() {
  const [phase, setPhase] = useState<'idle' | 'scanning' | 'done'>('idle');

  const scan = () => {
    setPhase('scanning');
    setTimeout(() => setPhase('done'), 2200);
  };

  if (phase === 'idle') return (
    <div onClick={scan} style={{ padding: 40, border: '2px dashed var(--bdr)', borderRadius: 14, textAlign: 'center', cursor: 'pointer', transition: 'all 0.2s' }}
      onMouseEnter={e => { e.currentTarget.style.borderColor = '#059669'; e.currentTarget.style.background = 'rgba(5,150,105,0.04)'; }}
      onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--bdr)'; e.currentTarget.style.background = 'transparent'; }}>
      <div style={{ fontSize: 44, marginBottom: 14 }}>🔍</div>
      <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--ink)', marginBottom: 6 }}>掃描貴公司可申請補助</div>
      <div style={{ fontSize: 13, color: 'var(--ink4)' }}>根據公司規模、產業別、所在縣市自動比對</div>
    </div>
  );

  if (phase === 'scanning') return (
    <div style={{ textAlign: 'center', padding: '36px 0' }}>
      <div style={{ position: 'relative', width: 90, height: 90, margin: '0 auto 24px' }}>
        {[0, 1, 2].map(i => (
          <div key={i} style={{ position: 'absolute', inset: 0, border: '2px solid var(--brand)', borderRadius: '50%', opacity: 0, animation: `radarPulse 2s ease-out ${i * 0.5}s infinite` }} />
        ))}
        <div style={{ position: 'absolute', inset: 25, background: 'var(--brand)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22 }}>🔍</div>
      </div>
      <div style={{ fontSize: 14, color: 'var(--ink3)' }}>正在比對 47 項政府補助計畫...</div>
    </div>
  );

  return (
    <div style={{ animation: 'slideUp 0.4s ease-out' }}>
      {[
        { name: '商業服務業智慧轉型補助', amt: 'NT$500,000', deadline: '3月 & 9月', source: '經濟部 MOEA', priority: true, bg: '#F0FDF4', border: '#6EE7B7' },
        { name: 'AI 解決方案推廣計畫', amt: 'NT$200,000', deadline: '6月', source: '數位部', priority: false, bg: '#EFF6FF', border: '#93C5FD' },
      ].map((sub, i) => (
        <div key={i} style={{ padding: '14px 16px', borderRadius: 12, border: `1.5px solid ${sub.border}`, background: sub.bg, marginBottom: 12 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--ink)' }}>🏛️ {sub.name}</div>
            <div style={{ fontSize: 15, fontWeight: 800, color: '#059669', flexShrink: 0, marginLeft: 12 }}>{sub.amt}</div>
          </div>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 11, padding: '3px 9px', borderRadius: 5, background: 'white', border: '1px solid var(--bdr)', color: 'var(--ink3)' }}>📅 {sub.deadline}</span>
            <span style={{ fontSize: 11, padding: '3px 9px', borderRadius: 5, background: 'white', border: '1px solid var(--bdr)', color: 'var(--ink3)' }}>{sub.source}</span>
            {sub.priority && <span style={{ fontSize: 11, padding: '3px 9px', borderRadius: 5, background: '#059669', color: 'white', fontWeight: 600 }}>高優先</span>}
          </div>
        </div>
      ))}
      <div style={{ padding: '14px 18px', background: 'var(--surf2)', borderRadius: 10, display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
        <div style={{ fontSize: 13, color: 'var(--ink3)' }}>貴公司最高可申請</div>
        <div style={{ fontSize: 26, fontWeight: 800, color: '#059669' }}>NT$700,000</div>
      </div>
      <a href="/contact" style={{ display: 'block', width: '100%', padding: 12, borderRadius: 10, background: '#059669', color: 'white', fontSize: 14, fontWeight: 700, textAlign: 'center', textDecoration: 'none', transition: 'all 0.2s', cursor: 'pointer' }}
        onMouseEnter={e => e.currentTarget.style.background = '#047857'}
        onMouseLeave={e => e.currentTarget.style.background = '#059669'}>
        預約 Demo，了解如何申請 →
      </a>
    </div>
  );
}

// ─── Main Landing Page ─────────────────────────────────────────────────────
export default function LandingPage() {
  const { user, isLoading } = useAuth();
  const router = useRouter();
  const [navScrolled, setNavScrolled] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [activeDemo, setActiveDemo] = useState<'nlp' | 'compliance' | 'subsidy'>('nlp');

  useEffect(() => {
    if (!isLoading && user) router.replace('/home');
  }, [user, isLoading, router]);

  useEffect(() => {
    if (isLoading || user) return;
    const onScroll = () => setNavScrolled(window.scrollY > 20);
    window.addEventListener('scroll', onScroll);
    return () => window.removeEventListener('scroll', onScroll);
  }, [isLoading, user]);

  useEffect(() => {
    if (isLoading || user) return;
    const observer = new IntersectionObserver(
      entries => entries.forEach(e => { if (e.isIntersecting) e.target.classList.add('visible'); }),
      { threshold: 0.08, rootMargin: '0px 0px -40px 0px' }
    );
    document.querySelectorAll('.reveal').forEach(el => observer.observe(el));
    return () => observer.disconnect();
  }, [isLoading, user]);

  if (isLoading || user) return null;

  return (
    <>
      <style jsx global>{`
        @import url('https://fonts.googleapis.com/css2?family=Noto+Sans+TC:wght@300;400;500;600;700;900&family=DM+Sans:wght@400;500;600;700;800&family=DM+Serif+Display:ital@0;1&display=swap');

        :root {
          --brand: #1D4ED8; --brand-d: #1E3A8A; --brand-l: #3B82F6; --brand-xl: #DBEAFE;
          --brand-glow: rgba(29,78,216,0.08);
          --ink: #0A0F1E; --ink2: #1E2A3A; --ink3: #4B5E7A; --ink4: #8FA3BC;
          --surf: #FFFFFF; --surf2: #F7F9FC; --surf3: #EFF3F8;
          --bdr: #DDE3ED; --bdr-l: #EEF2F7;
          --green: #059669; --green-l: #D1FAE5;
          --amber: #D97706; --amber-l: #FEF3C7;
          --red: #DC2626; --red-l: #FEE2E2;
          --mw: 1100px; --r: 12px; --r-lg: 18px;
        }

        * { margin: 0; padding: 0; box-sizing: border-box; }
        html { scroll-behavior: smooth; -webkit-font-smoothing: antialiased; }
        body { font-family: 'DM Sans', 'Noto Sans TC', system-ui, sans-serif; color: var(--ink); background: var(--surf); line-height: 1.7; overflow-x: hidden; }
        a { color: inherit; text-decoration: none; }

        .reveal { opacity: 0; transform: translateY(22px); transition: opacity 0.55s cubic-bezier(0.16,1,0.3,1), transform 0.55s cubic-bezier(0.16,1,0.3,1); }
        .reveal.visible { opacity: 1; transform: translateY(0); }
        .reveal-d1 { transition-delay: 0.1s; }
        .reveal-d2 { transition-delay: 0.2s; }
        .reveal-d3 { transition-delay: 0.3s; }

        @keyframes slideUp { from { opacity:0; transform:translateY(18px); } to { opacity:1; transform:translateY(0); } }
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes scanProgress { to { width: 100%; } }
        @keyframes radarPulse { 0% { transform:scale(0.4); opacity:0.8; } 100% { transform:scale(1.6); opacity:0; } }
        @keyframes blink { 0%,100% { opacity:1; } 50% { opacity:0.3; } }
        @keyframes pulse { 0%,100% { opacity:1; } 50% { opacity:0.4; } }

        /* ── NAV ── */
        .nav { position: fixed; top: 0; left: 0; right: 0; z-index: 100; height: 66px; background: rgba(255,255,255,0.92); backdrop-filter: blur(20px); border-bottom: 1px solid transparent; transition: all 0.3s; }
        .nav.sc { border-color: var(--bdr-l); box-shadow: 0 1px 24px rgba(10,15,30,0.06); }
        .nav-in { max-width: var(--mw); margin: 0 auto; padding: 0 28px; display: flex; align-items: center; justify-content: space-between; height: 100%; }
        .nav-brand { display: flex; align-items: center; gap: 10px; font-weight: 700; font-size: 16px; }
        .nav-mark { width: 32px; height: 32px; border-radius: 9px; background: var(--brand); display: flex; align-items: center; justify-content: center; color: #fff; font-size: 15px; }
        .nav-links { display: flex; align-items: center; gap: 2px; }
        .nav-links a { padding: 6px 14px; font-size: 14px; font-weight: 500; color: var(--ink3); border-radius: 8px; transition: all 0.15s; }
        .nav-links a:hover { color: var(--ink); background: var(--surf2); }
        .nav-acts { display: flex; align-items: center; gap: 8px; }
        .mob-tog { display: none; background: none; border: none; cursor: pointer; width: 40px; height: 40px; align-items: center; justify-content: center; flex-direction: column; gap: 5px; }
        .mob-tog span { display: block; width: 22px; height: 2px; background: var(--ink); border-radius: 2px; }
        .mob-menu { display: none; position: fixed; top: 66px; left: 0; right: 0; background: white; border-bottom: 1px solid var(--bdr); padding: 16px 24px 24px; z-index: 99; flex-direction: column; gap: 6px; box-shadow: 0 8px 40px rgba(0,0,0,0.1); }
        .mob-menu.show { display: flex; }
        .mob-menu a { padding: 11px 14px; border-radius: 8px; font-size: 15px; font-weight: 500; color: var(--ink2); }

        /* ── BUTTONS ── */
        .btn { display: inline-flex; align-items: center; gap: 7px; padding: 10px 20px; border-radius: 9px; font-weight: 600; font-size: 14px; transition: all 0.2s; cursor: pointer; border: none; font-family: inherit; white-space: nowrap; }
        .btn-p { background: var(--brand); color: #fff; box-shadow: 0 2px 12px rgba(29,78,216,0.25); }
        .btn-p:hover { background: var(--brand-d); transform: translateY(-1px); box-shadow: 0 4px 20px rgba(29,78,216,0.3); }
        .btn-o { background: transparent; color: var(--ink2); border: 1.5px solid var(--bdr); }
        .btn-o:hover { border-color: var(--brand); color: var(--brand); background: var(--brand-glow); }
        .btn-lg { padding: 13px 28px; font-size: 15px; border-radius: 11px; }
        .btn-xl { padding: 15px 34px; font-size: 16px; border-radius: 12px; }

        /* ── HERO ── */
        .hero { min-height: 100vh; padding: 138px 28px 96px; display: flex; align-items: center; justify-content: center; position: relative; overflow: hidden; background: linear-gradient(180deg, var(--surf) 0%, var(--surf2) 100%); }
        .hero-grid-bg { position: absolute; inset: 0; background-image: linear-gradient(var(--bdr-l) 1px, transparent 1px), linear-gradient(90deg, var(--bdr-l) 1px, transparent 1px); background-size: 70px 70px; opacity: 0.45; pointer-events: none; mask-image: radial-gradient(ellipse 80% 55% at 50% 0%, black 30%, transparent 100%); }
        .hero-in { max-width: 720px; margin: 0 auto; position: relative; z-index: 1; text-align: center; }
        .hero-badge { display: inline-flex; align-items: center; gap: 8px; padding: 6px 16px 6px 8px; border-radius: 100px; background: var(--surf); border: 1px solid var(--bdr); font-size: 13px; font-weight: 600; color: var(--ink3); margin-bottom: 28px; box-shadow: 0 2px 10px rgba(0,0,0,0.04); }
        .hero-badge .dot { width: 7px; height: 7px; border-radius: 50%; background: var(--green); animation: blink 2s infinite; }
        .hero h1 { font-family: 'DM Serif Display', 'Noto Sans TC', serif; font-size: clamp(38px, 6vw, 60px); font-weight: 400; line-height: 1.12; color: var(--ink); margin-bottom: 22px; letter-spacing: -0.02em; }
        .hero h1 strong { font-weight: 400; font-style: italic; color: var(--brand); }
        .hero-sub { font-size: 17px; color: var(--ink3); max-width: 520px; margin: 0 auto 36px; line-height: 1.75; }
        .hero-acts { display: flex; gap: 12px; justify-content: center; flex-wrap: wrap; margin-bottom: 56px; }
        .hero-proof { display: flex; justify-content: center; gap: 40px; flex-wrap: wrap; padding-top: 32px; border-top: 1px solid var(--bdr-l); }
        .hero-proof-item { text-align: center; }
        .hero-proof-val { font-family: 'DM Serif Display', serif; font-size: 28px; font-weight: 400; color: var(--ink); letter-spacing: -0.02em; }
        .hero-proof-val em { font-style: italic; color: var(--brand); }
        .hero-proof-label { font-size: 12px; color: var(--ink4); font-weight: 500; margin-top: 2px; }

        /* ── PAIN ── */
        .pain { background: var(--ink); padding: 80px 28px; }
        .pain-in { max-width: var(--mw); margin: 0 auto; }
        .pain-label { font-size: 12px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.1em; color: var(--brand-l); margin-bottom: 12px; }
        .pain-title { font-family: 'DM Serif Display', serif; font-size: clamp(26px, 4vw, 38px); color: #fff; margin-bottom: 44px; letter-spacing: -0.02em; line-height: 1.2; max-width: 540px; }
        .pain-title em { font-style: italic; color: rgba(255,255,255,0.35); }
        .pain-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 1px; background: rgba(255,255,255,0.08); border-radius: var(--r-lg); overflow: hidden; }
        .pain-item { background: var(--ink); padding: 28px 24px; }
        .pain-emoji { font-size: 26px; margin-bottom: 12px; }
        .pain-item h3 { font-size: 15px; font-weight: 700; color: #fff; margin-bottom: 8px; }
        .pain-item p { font-size: 13px; color: rgba(255,255,255,0.45); line-height: 1.65; }

        /* ── DEMO SECTION ── */
        .demo-sec { padding: 96px 28px; background: var(--surf); }
        .demo-con { max-width: var(--mw); margin: 0 auto; }
        .demo-hd { text-align: center; margin-bottom: 48px; }
        .sec-label { font-size: 12px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.1em; color: var(--brand); margin-bottom: 10px; }
        .sec-title { font-family: 'DM Serif Display', serif; font-size: clamp(26px, 3.5vw, 36px); color: var(--ink); letter-spacing: -0.02em; margin-bottom: 10px; }
        .sec-sub { font-size: 15px; color: var(--ink3); }

        .demo-tabs { display: flex; justify-content: center; gap: 10px; margin-bottom: 36px; flex-wrap: wrap; }
        .demo-tab { padding: 11px 22px; border-radius: 10px; font-size: 14px; font-weight: 600; color: var(--ink3); background: var(--surf2); border: 1px solid var(--bdr); cursor: pointer; transition: all 0.2s; display: flex; align-items: center; gap: 7px; font-family: inherit; }
        .demo-tab:hover { border-color: var(--brand-l); color: var(--brand); }
        .demo-tab.active { background: var(--brand); color: white; border-color: var(--brand); box-shadow: 0 4px 14px rgba(29,78,216,0.25); }

        .demo-box { max-width: 680px; margin: 0 auto; background: white; border-radius: var(--r-lg); border: 1px solid var(--bdr); box-shadow: 0 8px 40px rgba(10,15,30,0.08); overflow: hidden; }
        .demo-bar { padding: 12px 18px; background: var(--surf2); border-bottom: 1px solid var(--bdr-l); display: flex; align-items: center; gap: 6px; }
        .demo-dot { width: 11px; height: 11px; border-radius: 50%; }
        .demo-bar-title { font-size: 12px; color: var(--ink4); margin-left: 8px; }
        .demo-body { padding: 24px; }

        /* ── OTHER FEATURES ── */
        .other-sec { padding: 80px 28px; background: var(--surf2); }
        .other-con { max-width: var(--mw); margin: 0 auto; }
        .other-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 16px; }
        .other-card { padding: 24px; border-radius: var(--r); border: 1px solid var(--bdr); background: white; transition: all 0.2s; }
        .other-card:hover { border-color: var(--brand); box-shadow: 0 4px 20px rgba(29,78,216,0.06); transform: translateY(-2px); }
        .other-icon { font-size: 22px; margin-bottom: 12px; }
        .other-card h3 { font-size: 14px; font-weight: 700; color: var(--ink); margin-bottom: 6px; }
        .other-card p { font-size: 13px; color: var(--ink3); line-height: 1.6; }

        /* ── HOW IT WORKS ── */
        .how-sec { padding: 88px 28px; background: var(--surf); }
        .how-con { max-width: var(--mw); margin: 0 auto; }
        .how-steps { display: grid; grid-template-columns: repeat(3, 1fr); gap: 24px; }
        .how-step { padding: 28px; border-radius: var(--r-lg); border: 1px solid var(--bdr); background: white; }
        .how-num { font-family: 'DM Serif Display', serif; font-size: 44px; color: var(--bdr); font-weight: 400; line-height: 1; margin-bottom: 12px; }
        .how-step h3 { font-size: 16px; font-weight: 700; color: var(--ink); margin-bottom: 8px; }
        .how-step p { font-size: 14px; color: var(--ink3); line-height: 1.65; }

        /* ── PILOT CTA ── */
        .cta-sec { padding: 100px 28px; background: var(--ink); }
        .cta-con { max-width: 660px; margin: 0 auto; text-align: center; }
        .cta-tag { display: inline-flex; align-items: center; gap: 6px; padding: 5px 14px; border-radius: 100px; background: rgba(59,130,246,0.12); border: 1px solid rgba(59,130,246,0.2); font-size: 12px; font-weight: 700; color: var(--brand-l); text-transform: uppercase; letter-spacing: 0.07em; margin-bottom: 20px; }
        .cta-title { font-family: 'DM Serif Display', serif; font-size: clamp(30px, 5vw, 46px); color: #fff; line-height: 1.12; margin-bottom: 16px; letter-spacing: -0.02em; }
        .cta-title em { font-style: italic; color: rgba(255,255,255,0.3); }
        .cta-desc { font-size: 16px; color: rgba(255,255,255,0.5); margin-bottom: 32px; line-height: 1.7; }
        .cta-perks { display: flex; justify-content: center; gap: 28px; margin-bottom: 36px; flex-wrap: wrap; }
        .cta-perk { display: flex; align-items: center; gap: 7px; font-size: 14px; color: rgba(255,255,255,0.55); }
        .cta-perk-dot { width: 6px; height: 6px; border-radius: 50%; background: var(--green); }
        .cta-acts { display: flex; gap: 12px; justify-content: center; flex-wrap: wrap; margin-bottom: 24px; }
        .btn-inv { background: white; color: var(--brand); font-weight: 700; }
        .btn-inv:hover { background: var(--brand-xl); transform: translateY(-1px); }
        .btn-ghost { background: transparent; color: rgba(255,255,255,0.6); border: 1.5px solid rgba(255,255,255,0.15); }
        .btn-ghost:hover { background: rgba(255,255,255,0.06); border-color: rgba(255,255,255,0.3); color: white; }
        .cta-note { font-size: 13px; color: rgba(255,255,255,0.25); }

        /* ── FOOTER ── */
        .foot { padding: 26px; border-top: 1px solid var(--bdr); }
        .foot-in { max-width: var(--mw); margin: 0 auto; display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 12px; }
        .foot-l { font-size: 13px; color: var(--ink4); }
        .foot-r { display: flex; gap: 20px; }
        .foot-r a { font-size: 13px; color: var(--ink4); transition: color 0.15s; }
        .foot-r a:hover { color: var(--brand); }

        /* ── RESPONSIVE ── */
        @media (max-width: 768px) {
          .nav-links, .nav-acts .btn-o { display: none; }
          .mob-tog { display: flex; }
          .hero { padding: 110px 20px 72px; }
          .hero h1 { font-size: 36px; }
          .hero-proof { gap: 24px; }
          .pain-grid, .other-grid, .how-steps { grid-template-columns: 1fr; }
        }
      `}</style>

      {/* NAV */}
      <nav className={`nav ${navScrolled ? 'sc' : ''}`}>
        <div className="nav-in">
          <a href="/" className="nav-brand">
            <div className="nav-mark">⚡</div>
            <span>Atlas <span style={{ color: 'var(--brand)' }}>EIP</span></span>
          </a>
          <div className="nav-links">
            <a href="#demo">產品體驗</a>
            <a href="#features">完整功能</a>
            <a href="#how">如何開始</a>
          </div>
          <div className="nav-acts">
            <a href="/login" className="btn btn-o">登入</a>
            <a href="/contact" className="btn btn-p">預約免費 Demo →</a>
            <button className="mob-tog" onClick={() => setMobileMenuOpen(!mobileMenuOpen)}>
              <span /><span /><span />
            </button>
          </div>
        </div>
      </nav>
      <div className={`mob-menu ${mobileMenuOpen ? 'show' : ''}`}>
        <a href="#demo" onClick={() => setMobileMenuOpen(false)}>產品體驗</a>
        <a href="#features" onClick={() => setMobileMenuOpen(false)}>完整功能</a>
        <a href="#how" onClick={() => setMobileMenuOpen(false)}>如何開始</a>
        <a href="/login" onClick={() => setMobileMenuOpen(false)}>登入</a>
        <a href="/contact" className="btn btn-p" style={{ justifyContent: 'center', marginTop: 8 }}>預約免費 Demo →</a>
      </div>

      {/* HERO */}
      <section className="hero">
        <ParticleBackground />
        <div className="hero-grid-bg" />
        <div className="hero-in">
          <div className="hero-badge reveal">
            <span className="dot" />
            台灣中小企業 AI 人資系統 · 現已上線
          </div>
          <h1 className="reveal reveal-d1">
            告別 Excel 請假表<br />
            用 AI 守護你的<br />
            <strong>勞基法合規</strong>
          </h1>
          <p className="hero-sub reveal reveal-d2">
            Atlas EIP 是專為台灣中小企業設計的 AI 人資管理系統。
            一句話請假、自動掃描員工手冊違法條文、
            即時發現可申請的政府補助。
          </p>
          <div className="hero-acts reveal reveal-d2">
            <a href="/contact" className="btn btn-p btn-xl">預約免費 Demo →</a>
            <a href="#demo" className="btn btn-o btn-lg">看產品演示</a>
          </div>
          <div className="hero-proof reveal reveal-d3">
            <div className="hero-proof-item">
              <div className="hero-proof-val">NT$<em>500K</em></div>
              <div className="hero-proof-label">可申請政府補助上限</div>
            </div>
            <div className="hero-proof-item">
              <div className="hero-proof-val"><em>13</em> 種</div>
              <div className="hero-proof-label">假別自動辨識</div>
            </div>
            <div className="hero-proof-item">
              <div className="hero-proof-val"><em>2026</em></div>
              <div className="hero-proof-label">勞基法即時同步</div>
            </div>
            <div className="hero-proof-item">
              <div className="hero-proof-val">One <em>Box</em></div>
              <div className="hero-proof-label">Zero Forms 哲學</div>
            </div>
          </div>
        </div>
      </section>

      {/* PAIN */}
      <section className="pain">
        <div className="pain-in">
          <div className="pain-label reveal">你是否也這樣？</div>
          <h2 className="pain-title reveal reveal-d1">
            LINE 群組請假<br /><em>Excel 追蹤餘額</em><br />手冊從沒對過法
          </h2>
          <div className="pain-grid reveal reveal-d2">
            <div className="pain-item">
              <div className="pain-emoji">📊</div>
              <h3>試算表管理請假</h3>
              <p>每次請假要更新 Excel、算剩餘天數、主管手動核准。一個人離職資料就亂掉。</p>
            </div>
            <div className="pain-item">
              <div className="pain-emoji">⚖️</div>
              <h3>員工手冊不確定合不合法</h3>
              <p>加班費算法、特休規定、家庭照顧假時數——2026 年法規更新了，你的手冊跟上了嗎？</p>
            </div>
            <div className="pain-item">
              <div className="pain-emoji">💸</div>
              <h3>不知道有政府補助可以拿</h3>
              <p>導入 AI 系統最高可申請 NT$50 萬補助，但多數企業主根本不知道這些計畫的存在。</p>
            </div>
          </div>
        </div>
      </section>

      {/* INTERACTIVE DEMO */}
      <section className="demo-sec" id="demo">
        <div className="demo-con">
          <div className="demo-hd reveal">
            <div className="sec-label">產品體驗</div>
            <h2 className="sec-title">親自試試看 Atlas EIP 的威力</h2>
            <p className="sec-sub">點擊下方功能，親自體驗 AI 如何簡化你的人資流程</p>
          </div>

          <div className="demo-tabs reveal">
            {([
              ['nlp', '💬 智慧請假'],
              ['compliance', '⚖️ 合規掃描'],
              ['subsidy', '💰 補助獵人'],
            ] as const).map(([key, label]) => (
              <button key={key} className={`demo-tab ${activeDemo === key ? 'active' : ''}`} onClick={() => setActiveDemo(key)}>{label}</button>
            ))}
          </div>

          <div className="demo-box reveal">
            <div className="demo-bar">
              <div className="demo-dot" style={{ background: '#FC5754' }} />
              <div className="demo-dot" style={{ background: '#FDBC40' }} />
              <div className="demo-dot" style={{ background: '#34C749' }} />
              <span className="demo-bar-title">
                {activeDemo === 'nlp' && '智慧請假 — AI 自動解析'}
                {activeDemo === 'compliance' && '合規掃描 — 員工手冊分析'}
                {activeDemo === 'subsidy' && '補助獵人 — 自動比對政府補助'}
              </span>
            </div>
            <div className="demo-body">
              {activeDemo === 'nlp' && <NLPDemo />}
              {activeDemo === 'compliance' && <ComplianceDemo />}
              {activeDemo === 'subsidy' && <SubsidyDemo />}
            </div>
          </div>
        </div>
      </section>

      {/* OTHER FEATURES */}
      <section className="other-sec" id="features">
        <div className="other-con">
          <div style={{ textAlign: 'center', marginBottom: 44 }} className="reveal">
            <div className="sec-label">完整功能</div>
            <h2 className="sec-title">One Box. Zero Forms.</h2>
          </div>
          <div className="other-grid">
            {[
              { icon: '🔍', title: 'Ask Atlas AI 對話', desc: '上傳員工手冊、勞動契約，用自然語言直接提問。AI 附來源引用，不亂猜。' },
              { icon: '🌑', title: 'Shadow Audit 加班預警', desc: '即時監控全體員工加班時數，超過 LSA Art. 32 上限前主動警示，避免罰鍰。' },
              { icon: '📊', title: '假期總覽儀表板', desc: '管理員一眼看到全員特休、病假、事假餘額，紅色標示餘額不足員工。' },
              { icon: '✉️', title: '自動 Email 通知', desc: '申請送出、核准或駁回，雙方均收到通知。不再靠 LINE 人工傳話。' },
              { icon: '📋', title: '完整稽核日誌', desc: '每筆申請、審核、文件上傳均有時間戳記錄，符合政府補助申請的使用紀錄要求。' },
              { icon: '🌐', title: '繁中 / English 雙語', desc: '介面完整支援繁體中文與英文切換，適合台灣在地企業及外資公司混合團隊。' },
            ].map((f, i) => (
              <div key={f.title} className="other-card reveal" style={{ transitionDelay: `${i * 0.08}s` }}>
                <div className="other-icon">{f.icon}</div>
                <h3>{f.title}</h3>
                <p>{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* HOW IT WORKS */}
      <section className="how-sec" id="how">
        <div className="how-con">
          <div style={{ textAlign: 'center', marginBottom: 48 }} className="reveal">
            <div className="sec-label">如何開始</div>
            <h2 className="sec-title">三步驟，當天上線</h2>
          </div>
          <div className="how-steps">
            {[
              { num: '01', title: '預約 Demo', desc: '與我們安排 30 分鐘線上示範。根據你的公司規模和產業，展示最相關的功能。不需要準備任何資料。' },
              { num: '02', title: '導入試用', desc: '上傳員工手冊、邀請核心成員加入。Shadow Audit 和合規掃描器立即開始運作，不需要額外設定。' },
              { num: '03', title: '正式上線', desc: '員工用自然語言送出第一筆請假申請。所有記錄自動保存，補助申請資料一鍵匯出。' },
            ].map((s, i) => (
              <div key={s.num} className="how-step reveal" style={{ transitionDelay: `${i * 0.1}s` }}>
                <div className="how-num">{s.num}</div>
                <h3>{s.title}</h3>
                <p>{s.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* PILOT CTA */}
      <section className="cta-sec">
        <div className="cta-con">
          <div className="cta-tag reveal">🚀 現正招募試用夥伴</div>
          <h2 className="cta-title reveal reveal-d1">
            準備好讓 AI<br />幫你管人資了嗎？<br />
            <em>不用再靠 LINE 群組</em>
          </h2>
          <p className="cta-desc reveal reveal-d2">
            我們目前正在招募 3–5 家台灣中小企業作為第一批試用夥伴。<br />
            試用期間完全免費，並提供台北在地導入支援。
          </p>
          <div className="cta-perks reveal reveal-d2">
            <div className="cta-perk"><div className="cta-perk-dot" />試用期間免費</div>
            <div className="cta-perk"><div className="cta-perk-dot" />台北在地支援</div>
            <div className="cta-perk"><div className="cta-perk-dot" />協助申請政府補助</div>
          </div>
          <div className="cta-acts reveal reveal-d3">
            <a href="/contact" className="btn btn-inv btn-xl">預約免費 Demo →</a>
            <a href="mailto:primestrideai@gmail.com" className="btn btn-ghost btn-lg">Email 聯繫</a>
          </div>
          <div className="cta-note reveal reveal-d3">
            primestrideai@gmail.com · primestrideatlas.com · 首越人工智能有限公司
          </div>
        </div>
      </section>

      {/* FOOTER */}
      <footer className="foot">
        <div className="foot-in">
          <div className="foot-l">© 2026 PrimeStride AI · 首越人工智能有限公司 · Atlas EIP</div>
          <div className="foot-r">
            <a href="/contact">聯繫我們</a>
            <a href="/login">登入</a>
          </div>
        </div>
      </footer>
    </>
  );
}