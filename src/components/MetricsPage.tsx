'use client';

import { useEffect, useState } from 'react';

interface DailyStats {
  date: string;
  count: number;
}

interface ActionStats {
  action: string;
  count: number;
}

interface MetricsData {
  totalEvents: number;
  activeDays: number;
  totalMembers: number;
  topAction: string;
  dailyStats: DailyStats[];
  actionStats: ActionStats[];
  orgName: string;
}

const ACTION_LABELS: Record<string, { label: string; emoji: string; color: string }> = {
  'compliance.check':  { label: '合規掃描', emoji: '⚖️', color: '#EF4444' },
  'workflow.submit':   { label: '表單申請', emoji: '📝', color: '#3B82F6' },
  'chat.query':        { label: 'AI 問答',   emoji: '🤖', color: '#8B5CF6' },
  'document.upload':   { label: '文件上傳', emoji: '📄', color: '#10B981' },
  'export.download':   { label: '文件匯出', emoji: '📤', color: '#F59E0B' },
  'document.view':     { label: '文件瀏覽', emoji: '👁️', color: '#06B6D4' },
  'search.query':      { label: '搜尋查詢', emoji: '🔍', color: '#EC4899' },
};

export default function MetricsPage() {
  const [data, setData] = useState<MetricsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [period, setPeriod] = useState<'7' | '30' | '90'>('30');

  useEffect(() => {
    setLoading(true);
    fetch(`/api/metrics?days=${period}`)
      .then(r => r.json())
      .then(d => {
        if (d.error) { setError(d.error); return; }
        setData(d);
      })
      .catch(() => setError('無法載入數據'))
      .finally(() => setLoading(false));
  }, [period]);

  if (loading) return (
    <div style={{ padding: 60, textAlign: 'center', color: '#94A3B8' }}>
      <div style={{ fontSize: 32, marginBottom: 12 }}>📊</div>
      <div>載入數據中...</div>
    </div>
  );

  if (error) return (
    <div style={{ padding: 60, textAlign: 'center', color: '#EF4444' }}>
      <div style={{ fontSize: 32, marginBottom: 12 }}>⚠️</div>
      <div>{error}</div>
    </div>
  );

  if (!data) return null;

  const maxDaily = Math.max(...data.dailyStats.map(d => d.count), 1);
  const totalActionCount = data.actionStats.reduce((s, a) => s + a.count, 0);

  return (
    <div style={{ maxWidth: 1100, margin: '0 auto', padding: '32px 24px 60px' }}>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 32, flexWrap: 'wrap', gap: 16 }}>
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 700, color: '#0F172A', marginBottom: 4 }}>
            📊 指標數據 Platform Metrics
          </h1>
          <p style={{ fontSize: 14, color: '#64748B' }}>
            {data.orgName} 的平台使用數據 · Platform usage statistics
          </p>
        </div>
        {/* Period selector */}
        <div style={{ display: 'flex', gap: 6, background: '#F1F5F9', borderRadius: 10, padding: 4 }}>
          {(['7', '30', '90'] as const).map(p => (
            <button key={p} onClick={() => setPeriod(p)} style={{
              padding: '6px 16px', borderRadius: 8, border: 'none', cursor: 'pointer',
              fontSize: 13, fontWeight: 600, transition: 'all 0.15s',
              background: period === p ? 'white' : 'transparent',
              color: period === p ? '#0F172A' : '#64748B',
              boxShadow: period === p ? '0 1px 4px rgba(0,0,0,0.08)' : 'none',
            }}>
              {p === '7' ? '7 天' : p === '30' ? '30 天' : '90 天'}
            </button>
          ))}
        </div>
      </div>

      {/* Stat Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 28 }}>
        {[
          { label: '總事件數', labelEn: 'Total Events', value: data.totalEvents.toLocaleString(), icon: '⚡', color: '#3B82F6', bg: '#EFF6FF' },
          { label: '活躍天數', labelEn: 'Active Days', value: `${data.activeDays} 天`, icon: '📅', color: '#10B981', bg: '#F0FDF4' },
          { label: '團隊成員', labelEn: 'Team Members', value: `${data.totalMembers} 人`, icon: '👥', color: '#8B5CF6', bg: '#F5F3FF' },
          { label: '最常使用', labelEn: 'Top Feature', value: ACTION_LABELS[data.topAction]?.label || data.topAction, icon: ACTION_LABELS[data.topAction]?.emoji || '🏆', color: '#F59E0B', bg: '#FFFBEB' },
        ].map((card, i) => (
          <div key={i} style={{ background: 'white', borderRadius: 14, border: '1px solid #E2E8F0', padding: '20px 20px 18px', transition: 'all 0.2s' }}
            onMouseEnter={e => { e.currentTarget.style.boxShadow = '0 4px 20px rgba(0,0,0,0.07)'; e.currentTarget.style.transform = 'translateY(-2px)'; }}
            onMouseLeave={e => { e.currentTarget.style.boxShadow = 'none'; e.currentTarget.style.transform = 'none'; }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
              <div style={{ fontSize: 12, color: '#64748B', fontWeight: 600 }}>{card.label}</div>
              <div style={{ width: 32, height: 32, borderRadius: 9, background: card.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16 }}>{card.icon}</div>
            </div>
            <div style={{ fontSize: 28, fontWeight: 800, color: card.color, lineHeight: 1, marginBottom: 4 }}>{card.value}</div>
            <div style={{ fontSize: 11, color: '#94A3B8' }}>{card.labelEn}</div>
          </div>
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 380px', gap: 20, marginBottom: 20 }}>

        {/* Daily Activity Bar Chart */}
        <div style={{ background: 'white', borderRadius: 14, border: '1px solid #E2E8F0', padding: 24 }}>
          <div style={{ fontSize: 15, fontWeight: 700, color: '#0F172A', marginBottom: 4 }}>每日活動趨勢</div>
          <div style={{ fontSize: 12, color: '#94A3B8', marginBottom: 20 }}>Daily Activity Trend · 近 {period} 天</div>

          {data.dailyStats.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '40px 0', color: '#CBD5E1', fontSize: 14 }}>此期間無數據</div>
          ) : (
            <div style={{ position: 'relative' }}>
              {/* Y axis grid lines */}
              {[0, 25, 50, 75, 100].map(pct => (
                <div key={pct} style={{ position: 'absolute', left: 0, right: 0, top: `${100 - pct}%`, borderTop: '1px dashed #F1F5F9', zIndex: 0 }} />
              ))}
              {/* Bars */}
              <div style={{ display: 'flex', alignItems: 'flex-end', gap: 3, height: 160, position: 'relative', zIndex: 1 }}>
                {data.dailyStats.map((d, i) => {
                  const height = Math.max((d.count / maxDaily) * 100, d.count > 0 ? 4 : 0);
                  const date = new Date(d.date);
                  const label = `${date.getMonth() + 1}/${date.getDate()}`;
                  return (
                    <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, position: 'relative' }}
                      title={`${d.date}: ${d.count} 個事件`}>
                      <div style={{ width: '100%', height: `${height}%`, background: d.count > 0 ? 'linear-gradient(180deg, #6366F1 0%, #3B82F6 100%)' : '#F1F5F9', borderRadius: '4px 4px 0 0', minHeight: d.count > 0 ? 4 : 0, transition: 'all 0.2s' }}
                        onMouseEnter={e => { e.currentTarget.style.background = 'linear-gradient(180deg, #4F46E5 0%, #2563EB 100%)'; }}
                        onMouseLeave={e => { e.currentTarget.style.background = d.count > 0 ? 'linear-gradient(180deg, #6366F1 0%, #3B82F6 100%)' : '#F1F5F9'; }} />
                      {(i % Math.ceil(data.dailyStats.length / 6) === 0) && (
                        <div style={{ fontSize: 9, color: '#94A3B8', whiteSpace: 'nowrap' }}>{label}</div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Feature Breakdown */}
        <div style={{ background: 'white', borderRadius: 14, border: '1px solid #E2E8F0', padding: 24 }}>
          <div style={{ fontSize: 15, fontWeight: 700, color: '#0F172A', marginBottom: 4 }}>功能使用分佈</div>
          <div style={{ fontSize: 12, color: '#94A3B8', marginBottom: 20 }}>Feature Usage Breakdown</div>

          {data.actionStats.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '40px 0', color: '#CBD5E1', fontSize: 14 }}>此期間無數據</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {data.actionStats.map((a, i) => {
                const info = ACTION_LABELS[a.action] || { label: a.action, emoji: '📌', color: '#64748B' };
                const pct = Math.round((a.count / totalActionCount) * 100);
                return (
                  <div key={i}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 5 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: 13, color: '#1E293B', fontWeight: 500 }}>
                        <span>{info.emoji}</span>
                        <span>{info.label}</span>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span style={{ fontSize: 12, color: '#64748B' }}>{a.count} 次</span>
                        <span style={{ fontSize: 12, fontWeight: 700, color: info.color, minWidth: 32, textAlign: 'right' }}>{pct}%</span>
                      </div>
                    </div>
                    <div style={{ height: 6, background: '#F1F5F9', borderRadius: 3, overflow: 'hidden' }}>
                      <div style={{ height: '100%', width: `${pct}%`, background: info.color, borderRadius: 3, transition: 'width 0.6s ease' }} />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Recent Activity Table */}
      <div style={{ background: 'white', borderRadius: 14, border: '1px solid #E2E8F0', padding: 24 }}>
        <div style={{ fontSize: 15, fontWeight: 700, color: '#0F172A', marginBottom: 4 }}>使用數據明細</div>
        <div style={{ fontSize: 12, color: '#94A3B8', marginBottom: 20 }}>Usage Data Detail · 可作為政府補助流量佐證</div>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ borderBottom: '2px solid #E2E8F0' }}>
                {['日期 Date', '功能類型 Feature', '次數 Count', '佔比 %'].map(h => (
                  <th key={h} style={{ padding: '8px 12px', textAlign: 'left', fontWeight: 700, color: '#64748B', fontSize: 12, textTransform: 'uppercase', letterSpacing: '0.04em' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {data.dailyStats.filter(d => d.count > 0).slice(0, 10).map((d, i) => (
                <tr key={i} style={{ borderBottom: '1px solid #F8FAFC', transition: 'background 0.1s' }}
                  onMouseEnter={e => e.currentTarget.style.background = '#F8FAFC'}
                  onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                  <td style={{ padding: '10px 12px', color: '#0F172A', fontWeight: 500 }}>{d.date}</td>
                  <td style={{ padding: '10px 12px', color: '#64748B' }}>全部功能 All Features</td>
                  <td style={{ padding: '10px 12px', fontWeight: 700, color: '#0F172A' }}>{d.count}</td>
                  <td style={{ padding: '10px 12px', color: '#64748B' }}>{Math.round((d.count / data.totalEvents) * 100)}%</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr style={{ borderTop: '2px solid #E2E8F0', background: '#F8FAFC' }}>
                <td colSpan={2} style={{ padding: '10px 12px', fontWeight: 700, color: '#0F172A' }}>合計 Total</td>
                <td style={{ padding: '10px 12px', fontWeight: 800, color: '#3B82F6' }}>{data.totalEvents}</td>
                <td style={{ padding: '10px 12px', fontWeight: 700, color: '#0F172A' }}>100%</td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>

    </div>
  );
}