'use client';

import { useState } from 'react';
import Link from 'next/link';

export default function ContactPage() {
  const [form, setForm] = useState({ name: '', email: '', company: '', message: '' });
  const [status, setStatus] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatus('sending');

    try {
      const res = await fetch('/api/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });

      if (res.ok) {
        setStatus('sent');
        setForm({ name: '', email: '', company: '', message: '' });
      } else {
        setStatus('error');
      }
    } catch {
      setStatus('error');
    }
  };

  return (
    <div style={{ minHeight: '100vh', background: '#f7f8fb', fontFamily: "'Noto Sans TC', system-ui, sans-serif" }}>
      {/* Nav */}
      <nav style={{
        position: 'sticky', top: 0, zIndex: 50,
        background: 'rgba(255,255,255,0.88)', backdropFilter: 'blur(20px)',
        borderBottom: '1px solid #eef0f5', height: 64,
      }}>
        <div style={{
          maxWidth: 1120, margin: '0 auto', padding: '0 24px',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between', height: '100%',
        }}>
          <Link href="/" style={{ display: 'flex', alignItems: 'center', gap: 10, textDecoration: 'none', color: '#0a0e1a', fontWeight: 700, fontSize: 17 }}>
            <div style={{
              width: 34, height: 34, borderRadius: 10,
              background: 'linear-gradient(135deg, #4f6df5, #6b85ff)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: '#fff', fontWeight: 800, fontSize: 13,
            }}>PA</div>
            PrimeStride Atlas
          </Link>
          <Link href="/" style={{
            padding: '9px 20px', borderRadius: 10, fontSize: 13.5, fontWeight: 600,
            color: '#3d4663', background: '#fff', border: '1.5px solid #dfe2ec',
            textDecoration: 'none',
          }}>
            ← 返回首頁
          </Link>
        </div>
      </nav>

      {/* Main Content */}
      <div style={{
        maxWidth: 960, margin: '0 auto', padding: '80px 24px',
        display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 60, alignItems: 'start',
      }}>
        {/* Left: Info */}
        <div>
          <div style={{
            fontSize: 11.5, fontWeight: 700, textTransform: 'uppercase' as const,
            letterSpacing: 3, color: '#4f6df5', marginBottom: 14,
          }}>
            聯繫我們
          </div>
          <h1 style={{
            fontSize: 36, fontWeight: 700, lineHeight: 1.25,
            letterSpacing: -0.5, marginBottom: 16, color: '#0a0e1a',
          }}>
            讓我們聊聊如何幫助你的團隊
          </h1>
          <p style={{ fontSize: 16.5, lineHeight: 1.75, color: '#3d4663', marginBottom: 40 }}>
            無論你是想了解更多功能細節、討論客製化需求，或是預約產品展示，都歡迎與我們聯繫。
          </p>

          <div style={{ display: 'flex', flexDirection: 'column' as const, gap: 24 }}>
            {[
              { icon: '⚡', title: '快速回覆', desc: '我們通常在 24 小時內回覆所有詢問。' },
              { icon: '🎯', title: '客製化方案', desc: '根據團隊規模與需求，提供最適合的使用建議。' },
              { icon: '🆓', title: '免費試用', desc: '入門方案永久免費，可以隨時開始體驗。' },
            ].map((item) => (
              <div key={item.title} style={{ display: 'flex', gap: 14 }}>
                <div style={{
                  width: 42, height: 42, borderRadius: 10,
                  background: 'rgba(79, 109, 245, 0.1)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 18, flexShrink: 0,
                }}>{item.icon}</div>
                <div>
                  <div style={{ fontSize: 15, fontWeight: 700, color: '#0a0e1a', marginBottom: 2 }}>{item.title}</div>
                  <div style={{ fontSize: 14, color: '#7a829e', lineHeight: 1.6 }}>{item.desc}</div>
                </div>
              </div>
            ))}
          </div>

          <div style={{
            marginTop: 40, padding: 20, borderRadius: 14,
            background: '#fff', border: '1px solid #dfe2ec',
          }}>
            <div style={{ fontSize: 13, color: '#7a829e', marginBottom: 4 }}>也可以直接寫信給我們</div>
            <a href="mailto:primestrideai@gmail.com" style={{
              fontSize: 15, fontWeight: 600, color: '#4f6df5', textDecoration: 'none',
            }}>
              primestrideai@gmail.com
            </a>
          </div>
        </div>

        {/* Right: Form */}
        <div style={{
          padding: 36, borderRadius: 22, background: '#fff',
          border: '1px solid #dfe2ec', boxShadow: '0 4px 24px rgba(0,0,0,0.04)',
        }}>
          {status === 'sent' ? (
            <div style={{ textAlign: 'center' as const, padding: '40px 0' }}>
              <div style={{ fontSize: 48, marginBottom: 16 }}>✅</div>
              <h3 style={{ fontSize: 20, fontWeight: 700, marginBottom: 8, color: '#0a0e1a' }}>
                訊息已送出！
              </h3>
              <p style={{ fontSize: 15, color: '#7a829e', marginBottom: 24, lineHeight: 1.6 }}>
                感謝你的來信，我們會盡快回覆你。
              </p>
              <button
                onClick={() => setStatus('idle')}
                style={{
                  padding: '12px 28px', borderRadius: 10, fontSize: 14,
                  fontWeight: 600, background: '#4f6df5', color: '#fff',
                  border: 'none', cursor: 'pointer',
                }}
              >
                送出另一則訊息
              </button>
            </div>
          ) : (
            <form onSubmit={handleSubmit}>
              <h3 style={{ fontSize: 18, fontWeight: 700, marginBottom: 24, color: '#0a0e1a' }}>
                填寫聯繫表單
              </h3>

              <div style={{ marginBottom: 18 }}>
                <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#3d4663', marginBottom: 6 }}>
                  姓名 *
                </label>
                <input
                  type="text"
                  required
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="你的姓名"
                  style={{
                    width: '100%', padding: '12px 16px', borderRadius: 10,
                    border: '1.5px solid #dfe2ec', fontSize: 14,
                    fontFamily: "'Noto Sans TC', sans-serif",
                    outline: 'none', transition: 'border-color 0.2s',
                    background: '#f7f8fb',
                  }}
                  onFocus={(e) => e.currentTarget.style.borderColor = '#4f6df5'}
                  onBlur={(e) => e.currentTarget.style.borderColor = '#dfe2ec'}
                />
              </div>

              <div style={{ marginBottom: 18 }}>
                <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#3d4663', marginBottom: 6 }}>
                  電子郵件 *
                </label>
                <input
                  type="email"
                  required
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                  placeholder="your@email.com"
                  style={{
                    width: '100%', padding: '12px 16px', borderRadius: 10,
                    border: '1.5px solid #dfe2ec', fontSize: 14,
                    fontFamily: "'Noto Sans TC', sans-serif",
                    outline: 'none', transition: 'border-color 0.2s',
                    background: '#f7f8fb',
                  }}
                  onFocus={(e) => e.currentTarget.style.borderColor = '#4f6df5'}
                  onBlur={(e) => e.currentTarget.style.borderColor = '#dfe2ec'}
                />
              </div>

              <div style={{ marginBottom: 18 }}>
                <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#3d4663', marginBottom: 6 }}>
                  公司 / 組織名稱
                </label>
                <input
                  type="text"
                  value={form.company}
                  onChange={(e) => setForm({ ...form, company: e.target.value })}
                  placeholder="你的公司名稱（選填）"
                  style={{
                    width: '100%', padding: '12px 16px', borderRadius: 10,
                    border: '1.5px solid #dfe2ec', fontSize: 14,
                    fontFamily: "'Noto Sans TC', sans-serif",
                    outline: 'none', transition: 'border-color 0.2s',
                    background: '#f7f8fb',
                  }}
                  onFocus={(e) => e.currentTarget.style.borderColor = '#4f6df5'}
                  onBlur={(e) => e.currentTarget.style.borderColor = '#dfe2ec'}
                />
              </div>

              <div style={{ marginBottom: 24 }}>
                <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#3d4663', marginBottom: 6 }}>
                  訊息內容 *
                </label>
                <textarea
                  required
                  value={form.message}
                  onChange={(e) => setForm({ ...form, message: e.target.value })}
                  placeholder="請描述你的需求或問題..."
                  rows={5}
                  style={{
                    width: '100%', padding: '12px 16px', borderRadius: 10,
                    border: '1.5px solid #dfe2ec', fontSize: 14,
                    fontFamily: "'Noto Sans TC', sans-serif",
                    outline: 'none', transition: 'border-color 0.2s',
                    background: '#f7f8fb', resize: 'vertical' as const,
                  }}
                  onFocus={(e) => e.currentTarget.style.borderColor = '#4f6df5'}
                  onBlur={(e) => e.currentTarget.style.borderColor = '#dfe2ec'}
                />
              </div>

              <button
                type="submit"
                disabled={status === 'sending'}
                style={{
                  width: '100%', padding: '14px 30px', borderRadius: 10,
                  fontSize: 15, fontWeight: 600, border: 'none', cursor: 'pointer',
                  background: status === 'sending' ? '#94a3b8' : '#4f6df5',
                  color: '#fff',
                  boxShadow: '0 2px 4px rgba(0,0,0,0.06), 0 8px 24px rgba(79,109,245,0.28)',
                  transition: 'all 0.25s',
                  fontFamily: "'Noto Sans TC', sans-serif",
                }}
              >
                {status === 'sending' ? '送出中...' : '送出訊息 →'}
              </button>

              {status === 'error' && (
                <p style={{ marginTop: 12, fontSize: 13, color: '#e5484d', textAlign: 'center' as const }}>
                  送出失敗，請稍後再試或直接寄信至 primestrideai@gmail.com
                </p>
              )}
            </form>
          )}
        </div>
      </div>

      {/* Responsive override */}
      <style jsx global>{`
        @media (max-width: 768px) {
          div[style*="grid-template-columns: 1fr 1fr"] {
            grid-template-columns: 1fr !important;
            padding: 40px 20px !important;
          }
        }
      `}</style>
    </div>
  );
}
