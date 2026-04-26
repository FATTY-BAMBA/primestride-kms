// src/app/clock/manual/page.tsx
// Employee manual entry submission form.

'use client';

import { useEffect, useState, useMemo } from 'react';
import { useUser } from '@clerk/nextjs';
import { tokens } from '@/lib/tokens';
import { clockCopy, t, tf, type Lang } from '@/lib/i18n/clock';

type ReasonCode = 'phone_dead' | 'forgot' | 'travel' | 'system_issue' | 'other';

type MyRequest = {
  id: string;
  work_date: string;
  requested_clock_in: string | null;
  requested_clock_out: string | null;
  reason_code: ReasonCode;
  reason_note: string | null;
  status: 'pending' | 'approved' | 'rejected' | 'cancelled';
  resolution_note: string | null;
  created_at: string;
};

const WINDOW_DAYS_DEFAULT = 7;

export default function ManualEntryPage() {
  const { isLoaded, isSignedIn } = useUser();
  const [lang, setLang] = useState<Lang>('zh');
  const [windowDays] = useState(WINDOW_DAYS_DEFAULT);

  const [workDate, setWorkDate] = useState<string>(() => {
    const d = new Date(Date.now() - 24 * 60 * 60 * 1000);
    return d.toISOString().slice(0, 10);
  });
  const [clockInTime, setClockInTime] = useState('');
  const [clockOutTime, setClockOutTime] = useState('');
  const [reasonCode, setReasonCode] = useState<ReasonCode>('forgot');
  const [reasonNote, setReasonNote] = useState('');

  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<{ code: string; details?: Record<string, unknown> } | null>(null);

  const [myRequests, setMyRequests] = useState<MyRequest[]>([]);

  useEffect(() => {
    fetch('/api/profile')
      .then(r => r.json())
      .then(d => { if (d.language === 'en' || d.language === 'zh') setLang(d.language); })
      .catch(() => {});
  }, []);

  async function loadMyRequests() {
    try {
      const r = await fetch('/api/clock/manual', { cache: 'no-store' });
      const d = await r.json();
      if (d.ok) setMyRequests(d.requests);
    } catch {
      // silent
    }
  }
  useEffect(() => { loadMyRequests(); }, []);

  const minDate = useMemo(() => {
    const d = new Date(Date.now() - windowDays * 24 * 60 * 60 * 1000);
    return d.toISOString().slice(0, 10);
  }, [windowDays]);
  const maxDate = useMemo(() => new Date().toISOString().slice(0, 10), []);

  async function handleSubmit() {
    setError(null);

    const isoFromTime = (timeStr: string): string | null => {
      if (!timeStr) return null;
      return `${workDate}T${timeStr}:00+08:00`;
    };

    const requestedClockIn = isoFromTime(clockInTime);
    const requestedClockOut = isoFromTime(clockOutTime);

    if (!requestedClockIn && !requestedClockOut) {
      setError({ code: 'MISSING_TIMES' });
      return;
    }

    setSubmitting(true);
    try {
      const r = await fetch('/api/clock/manual', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          workDate,
          requestedClockIn,
          requestedClockOut,
          reasonCode,
          reasonNote: reasonNote.trim() || null,
        }),
      });
      const d = await r.json();
      if (!r.ok || !d.ok) {
        const code = d.code === 'INVALID_INPUT' && d.details?.code
          ? d.details.code
          : d.code ?? 'UNKNOWN';
        setError({ code, details: d.details });
      } else {
        setSubmitted(true);
        loadMyRequests();
      }
    } catch {
      setError({ code: 'UNKNOWN' });
    } finally {
      setSubmitting(false);
    }
  }

  function resetForm() {
    setSubmitted(false);
    setClockInTime('');
    setClockOutTime('');
    setReasonNote('');
    setError(null);
  }

  // Loading
  if (!isLoaded) {
    return (
      <Page>
        <Header lang={lang} />
        <div style={centeredContentStyle}>
          <p style={{ opacity: 0.6 }}>{t(clockCopy.mobile.loading, lang)}</p>
        </div>
      </Page>
    );
  }

  // Not signed in
  if (!isSignedIn) {
    return (
      <Page>
        <Header lang={lang} />
        <div style={centeredContentStyle}>
          <h1 style={h1Style}>{t(clockCopy.mobile.signin_required, lang)}</h1>
          <p style={pMutedStyle}>{t(clockCopy.mobile.signin_body, lang)}</p>
        </div>
      </Page>
    );
  }

  // Submitted confirmation
  if (submitted) {
    return (
      <Page>
        <Header lang={lang} />
        <div style={centeredContentStyle}>
          <CheckBadge />
          <h1 style={{ ...h1Style, marginTop: tokens.spacing['2xl'] }}>
            {t(clockCopy.manualEntry.submitted_title, lang)}
          </h1>
          <p style={pMutedStyle}>{t(clockCopy.manualEntry.submitted_body, lang)}</p>
          <button onClick={resetForm} style={primaryButtonStyle}>
            {t(clockCopy.manualEntry.submit_another, lang)}
          </button>
        </div>
      </Page>
    );
  }

  return (
    <Page>
      <Header lang={lang} />
      <div style={contentContainerStyle}>
        <div style={brandLabelStyle}>ATLAS EIP</div>
        <h1 style={{ ...h1Style, fontSize: tokens.font.size['2xl'], marginBottom: tokens.spacing.xs }}>
          {t(clockCopy.manualEntry.page_title, lang)}
        </h1>
        <p style={{ ...pMutedStyle, marginBottom: tokens.spacing['2xl'] }}>
          {t(clockCopy.manualEntry.subtitle, lang)}
        </p>

        {/* Work date */}
        <Field label={t(clockCopy.manualEntry.work_date_label, lang)}>
          <input
            type="date"
            value={workDate}
            min={minDate}
            max={maxDate}
            onChange={e => setWorkDate(e.target.value)}
            style={inputStyle}
          />
          <div style={helperStyle}>
            {tf(clockCopy.manualEntry.work_date_help, lang, { days: windowDays })}
          </div>
        </Field>

        {/* Times */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: tokens.spacing.md }}>
          <Field label={t(clockCopy.manualEntry.clock_in_label, lang)}>
            <input
              type="time"
              value={clockInTime}
              onChange={e => setClockInTime(e.target.value)}
              style={inputStyle}
            />
          </Field>
          <Field label={t(clockCopy.manualEntry.clock_out_label, lang)}>
            <input
              type="time"
              value={clockOutTime}
              onChange={e => setClockOutTime(e.target.value)}
              style={inputStyle}
            />
          </Field>
        </div>
        <div style={{ ...helperStyle, marginTop: -tokens.spacing.sm, marginBottom: tokens.spacing.lg }}>
          {t(clockCopy.manualEntry.times_help, lang)}
        </div>

        {/* Reason */}
        <Field label={t(clockCopy.manualEntry.reason_label, lang)}>
          <select
            value={reasonCode}
            onChange={e => setReasonCode(e.target.value as ReasonCode)}
            style={inputStyle}
          >
            <option value="forgot">{t(clockCopy.manualEntry.reason_forgot, lang)}</option>
            <option value="phone_dead">{t(clockCopy.manualEntry.reason_phone_dead, lang)}</option>
            <option value="travel">{t(clockCopy.manualEntry.reason_travel, lang)}</option>
            <option value="system_issue">{t(clockCopy.manualEntry.reason_system, lang)}</option>
            <option value="other">{t(clockCopy.manualEntry.reason_other, lang)}</option>
          </select>
        </Field>

        {/* Note */}
        <Field label={t(clockCopy.manualEntry.note_label, lang)}>
          <textarea
            value={reasonNote}
            onChange={e => setReasonNote(e.target.value)}
            placeholder={t(clockCopy.manualEntry.note_placeholder, lang)}
            rows={3}
            style={{ ...inputStyle, resize: 'vertical', fontFamily: tokens.font.family }}
          />
        </Field>

        {/* Error */}
        {error && (
          <div style={errorBoxStyle}>
            {renderErrorMessage(error.code, error.details, lang, windowDays)}
          </div>
        )}

        <button
          onClick={handleSubmit}
          disabled={submitting}
          style={{ ...primaryButtonStyle, opacity: submitting ? 0.6 : 1, cursor: submitting ? 'not-allowed' : 'pointer' }}
        >
          {submitting ? t(clockCopy.manualEntry.submitting, lang) : t(clockCopy.manualEntry.submit_button, lang)}
        </button>

        {/* History section */}
        <div style={historySectionStyle}>
          <h2 style={historyTitleStyle}>
            {t(clockCopy.manualEntry.my_requests_title, lang)}
          </h2>
          {myRequests.length === 0 ? (
            <div style={emptyStateStyle}>
              <div style={{ fontSize: 32, marginBottom: tokens.spacing.sm }}>📝</div>
              <p style={{ ...pMutedStyle, fontSize: tokens.font.size.sm, margin: 0 }}>
                {t(clockCopy.manualEntry.no_requests, lang)}
              </p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: tokens.spacing.sm }}>
              {myRequests.map(r => <RequestRow key={r.id} req={r} lang={lang} />)}
            </div>
          )}
        </div>
      </div>
    </Page>
  );
}

// =============== UI helpers ===============

function Page({ children }: { children: React.ReactNode }) {
  return (
    <div style={{
      minHeight: '100vh',
      background: '#0F172A',
      color: tokens.colors.darkText,
      fontFamily: tokens.font.family,
    }}>
      {children}
    </div>
  );
}

function Header({ lang }: { lang: Lang }) {
  return (
    <div style={{
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      padding: `${tokens.spacing.lg}px ${tokens.spacing['2xl']}px`,
      borderBottom: '1px solid rgba(255,255,255,0.06)',
      maxWidth: 1200,
      margin: '0 auto',
    }}>
      <div style={{ fontSize: tokens.font.size.sm, fontWeight: 700, letterSpacing: 1, opacity: 0.85 }}>
        ATLAS EIP
      </div>
      <a href="/" style={{
        fontSize: tokens.font.size.sm,
        color: tokens.colors.darkText,
        opacity: 0.7,
        textDecoration: 'none',
        display: 'flex',
        alignItems: 'center',
        gap: tokens.spacing.xs,
      }}>
        <span>←</span>
        <span>{lang === 'zh' ? '回首頁' : 'Home'}</span>
      </a>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: tokens.spacing.lg }}>
      <label style={{ display: 'block', fontSize: tokens.font.size.sm, fontWeight: 600, color: tokens.colors.darkText, marginBottom: tokens.spacing.xs, opacity: 0.85 }}>
        {label}
      </label>
      {children}
    </div>
  );
}

function CheckBadge() {
  return (
    <div style={{
      width: 80, height: 80, borderRadius: '50%', background: tokens.colors.success,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      boxShadow: '0 8px 24px rgba(5,150,105,0.35)',
    }}>
      <svg width="44" height="44" viewBox="0 0 24 24" fill="none">
        <path d="M5 13l4 4L19 7" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </div>
  );
}

function RequestRow({ req, lang }: { req: MyRequest; lang: Lang }) {
  const statusCopy = {
    pending: clockCopy.manualEntry.status_pending,
    approved: clockCopy.manualEntry.status_approved,
    rejected: clockCopy.manualEntry.status_rejected,
    cancelled: clockCopy.manualEntry.status_pending,
  };
  const statusColors: Record<string, string> = {
    pending: tokens.colors.warning,
    approved: tokens.colors.success,
    rejected: tokens.colors.danger,
    cancelled: tokens.colors.textMuted,
  };
  const reasonLabels: Record<ReasonCode, { zh: string; en: string }> = {
    forgot: clockCopy.manualEntry.reason_forgot,
    phone_dead: clockCopy.manualEntry.reason_phone_dead,
    travel: clockCopy.manualEntry.reason_travel,
    system_issue: clockCopy.manualEntry.reason_system,
    other: clockCopy.manualEntry.reason_other,
  };
  return (
    <div style={{
      background: 'rgba(255,255,255,0.04)',
      border: '1px solid rgba(255,255,255,0.08)',
      borderRadius: tokens.radii.md,
      padding: `${tokens.spacing.md}px ${tokens.spacing.lg}px`,
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      gap: tokens.spacing.md,
    }}>
      <div style={{ minWidth: 0, flex: 1 }}>
        <div style={{ fontSize: tokens.font.size.base, fontWeight: 600 }}>{req.work_date}</div>
        <div style={{ fontSize: tokens.font.size.sm, opacity: 0.6, marginTop: 2 }}>
          {formatTaipeiTime(req.requested_clock_in)} – {formatTaipeiTime(req.requested_clock_out)}
          {' · '}
          {t(reasonLabels[req.reason_code], lang)}
        </div>
      </div>
      <div style={{
        fontSize: tokens.font.size.xs,
        fontWeight: 700,
        color: statusColors[req.status] ?? tokens.colors.textMuted,
        padding: '4px 12px',
        background: 'rgba(255,255,255,0.06)',
        borderRadius: tokens.radii.full,
        whiteSpace: 'nowrap',
      }}>
        {t(statusCopy[req.status] ?? statusCopy.pending, lang)}
      </div>
    </div>
  );
}

function formatTaipeiTime(iso: string | null): string {
  if (!iso) return '—';
  return new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Taipei', hour: '2-digit', minute: '2-digit', hour12: false,
  }).format(new Date(iso));
}

function renderErrorMessage(
  code: string,
  details: Record<string, unknown> | undefined,
  lang: Lang,
  windowDays: number,
): string {
  const errors = clockCopy.errors as Record<string, { zh: string; en: string }>;
  const entry = errors[code] ?? errors.UNKNOWN;
  let msg = entry[lang];
  msg = msg.replace('{days}', String((details?.window_days as number) ?? windowDays));
  return msg;
}

// =============== styles ===============

const contentContainerStyle: React.CSSProperties = {
  width: '100%',
  maxWidth: 480,
  margin: '0 auto',
  padding: `${tokens.spacing['3xl']}px ${tokens.spacing['2xl']}px`,
};

const centeredContentStyle: React.CSSProperties = {
  width: '100%',
  maxWidth: 480,
  margin: '0 auto',
  padding: `${tokens.spacing['4xl']}px ${tokens.spacing['2xl']}px`,
  textAlign: 'center',
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
};

const h1Style: React.CSSProperties = {
  fontSize: tokens.font.size['2xl'],
  fontWeight: 700,
  marginBottom: tokens.spacing.xs,
  margin: 0,
};

const pMutedStyle: React.CSSProperties = {
  opacity: 0.65,
  fontSize: tokens.font.size.base,
  marginBottom: tokens.spacing.lg,
  lineHeight: 1.5,
};

const brandLabelStyle: React.CSSProperties = {
  fontSize: tokens.font.size.sm,
  opacity: 0.5,
  letterSpacing: 1,
  marginBottom: tokens.spacing.sm,
};

const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: `${tokens.spacing.md}px ${tokens.spacing.lg}px`,
  background: 'rgba(255,255,255,0.06)',
  border: '1px solid rgba(255,255,255,0.12)',
  borderRadius: tokens.radii.md,
  color: tokens.colors.darkText,
  fontSize: tokens.font.size.base,
  fontFamily: tokens.font.family,
  outline: 'none',
  boxSizing: 'border-box',
};

const helperStyle: React.CSSProperties = {
  fontSize: tokens.font.size.xs,
  opacity: 0.5,
  marginTop: tokens.spacing.xs,
};

const primaryButtonStyle: React.CSSProperties = {
  width: '100%',
  padding: '18px',
  background: tokens.colors.primary,
  color: tokens.colors.textInverse,
  border: 'none',
  borderRadius: tokens.radii.lg,
  fontSize: tokens.font.size.lg,
  fontWeight: 700,
  cursor: 'pointer',
  marginTop: tokens.spacing.md,
};

const errorBoxStyle: React.CSSProperties = {
  padding: `${tokens.spacing.md}px ${tokens.spacing.lg}px`,
  background: 'rgba(220,38,38,0.15)',
  border: '1px solid rgba(220,38,38,0.4)',
  borderRadius: tokens.radii.md,
  color: '#FCA5A5',
  fontSize: tokens.font.size.sm,
  marginBottom: tokens.spacing.md,
  lineHeight: 1.5,
};

const historySectionStyle: React.CSSProperties = {
  marginTop: tokens.spacing['4xl'],
  paddingTop: tokens.spacing['2xl'],
  borderTop: '1px solid rgba(255,255,255,0.06)',
};

const historyTitleStyle: React.CSSProperties = {
  fontSize: tokens.font.size.md,
  fontWeight: 700,
  color: tokens.colors.darkText,
  marginBottom: tokens.spacing.lg,
  margin: `0 0 ${tokens.spacing.lg}px`,
};

const emptyStateStyle: React.CSSProperties = {
  background: 'rgba(255,255,255,0.02)',
  border: '1px dashed rgba(255,255,255,0.08)',
  borderRadius: tokens.radii.md,
  padding: `${tokens.spacing['2xl']}px ${tokens.spacing.lg}px`,
  textAlign: 'center',
};