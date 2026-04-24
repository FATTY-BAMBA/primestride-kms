// src/app/clock/page.tsx
'use client';

import { useEffect, useState, useMemo, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { useUser } from '@clerk/nextjs';
import { tokens } from '@/lib/tokens';
import { clockCopy, t, tf, type Lang } from '@/lib/i18n/clock';

type PunchResponse =
  | {
      ok: true;
      action: 'clock_in';
      clockInTime: string;
      lateMinutes: number;
      incompletePriorDate: string | null;
    }
  | {
      ok: true;
      action: 'clock_out';
      clockOutTime: string;
      totalHours: number;
      overtimeHours: number;
      incompletePriorDate: string | null;
    }
  | { ok: false; code: keyof typeof clockCopy.errors; message: string; details?: unknown };

export default function ClockPageWrapper() {
  return (
    <Suspense fallback={<Screen><p style={{ opacity: 0.6 }}>Loading…</p></Screen>}>
      <ClockPage />
    </Suspense>
  );
}

function ClockPage() {
  const params = useSearchParams();
  const token = params.get('token') ?? '';
  const { isLoaded, isSignedIn, user } = useUser();

  // Language from user prefs — fetch once
  const [lang, setLang] = useState<Lang>('zh');
  useEffect(() => {
    fetch('/api/profile')
      .then(r => r.json())
      .then(d => { if (d.language === 'en' || d.language === 'zh') setLang(d.language); })
      .catch(() => {});
  }, []);

  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<PunchResponse | null>(null);
  const [errorCode, setErrorCode] = useState<keyof typeof clockCopy.errors | null>(null);

  const displayName = useMemo(() => {
    if (!user) return '';
    return user.fullName || user.firstName || user.primaryEmailAddress?.emailAddress || '';
  }, [user]);

  async function handlePunch() {
    if (!token) {
      setErrorCode('QR_INVALID');
      return;
    }
    setSubmitting(true);
    setErrorCode(null);
    try {
      const res = await fetch('/api/clock/punch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token }),
      });
      const data = (await res.json()) as PunchResponse;
      if (!res.ok || !data.ok) {
        const code = ('code' in data ? data.code : 'UNKNOWN') as keyof typeof clockCopy.errors;
        setErrorCode(code in clockCopy.errors ? code : 'UNKNOWN');
      } else {
        setResult(data);
      }
    } catch {
      setErrorCode('UNKNOWN');
    } finally {
      setSubmitting(false);
    }
  }

  if (!isLoaded) {
    return <Screen><p style={{ opacity: 0.6 }}>{t(clockCopy.mobile.loading, lang)}</p></Screen>;
  }

  if (!isSignedIn) {
    const redirectUrl = typeof window !== 'undefined' ? window.location.href : '/clock';
    return (
      <Screen>
        <h1 style={{ fontSize: tokens.font.size['2xl'], marginBottom: tokens.spacing.md }}>
          {t(clockCopy.mobile.signin_required, lang)}
        </h1>
        <p style={{ opacity: 0.7, marginBottom: tokens.spacing['2xl'], maxWidth: 340 }}>
          {t(clockCopy.mobile.signin_body, lang)}
        </p>
        <a href={`/sign-in?redirect_url=${encodeURIComponent(redirectUrl)}`} style={buttonStyle(tokens.colors.primary)}>
          {t(clockCopy.mobile.signin_button, lang)}
        </a>
      </Screen>
    );
  }

  if (!token) {
    return (
      <Screen>
        <h1 style={{ fontSize: tokens.font.size.xl, marginBottom: tokens.spacing.md }}>
          {t(clockCopy.mobile.invalid_link, lang)}
        </h1>
        <p style={{ opacity: 0.7 }}>{t(clockCopy.mobile.invalid_body, lang)}</p>
      </Screen>
    );
  }

  if (result && result.ok) {
    const isIn = result.action === 'clock_in';
    return (
      <Screen>
        <div style={{ fontSize: 56, marginBottom: tokens.spacing.lg }}>✅</div>
        <h1 style={{ fontSize: tokens.font.size['2xl'], marginBottom: tokens.spacing.sm }}>
          {isIn ? t(clockCopy.mobile.success_in, lang) : t(clockCopy.mobile.success_out, lang)}
        </h1>
        <p style={{ opacity: 0.75, marginBottom: tokens.spacing['2xl'], maxWidth: 360 }}>
          {isIn
            ? `${t(clockCopy.mobile.clock_in_at, lang)} ${formatTaipei(result.clockInTime)}${
                result.lateMinutes > 0
                  ? ` · ${t(clockCopy.mobile.late, lang)} ${result.lateMinutes} ${t(clockCopy.mobile.minutes, lang)}`
                  : ''
              }`
            : `${t(clockCopy.mobile.clock_out_at, lang)} ${formatTaipei(result.clockOutTime)} · ${t(clockCopy.mobile.total_hours, lang)} ${result.totalHours} ${t(clockCopy.mobile.hours, lang)}${
                result.overtimeHours > 0
                  ? ` · ${t(clockCopy.mobile.overtime, lang)} ${result.overtimeHours} ${t(clockCopy.mobile.hours, lang)}`
                  : ''
              }`}
        </p>
        {result.incompletePriorDate && (
          <div style={warningBoxStyle}>
            {tf(clockCopy.mobile.incomplete_warning, lang, { date: result.incompletePriorDate })}
          </div>
        )}
      </Screen>
    );
  }

  return (
    <Screen>
      <div style={{ fontSize: tokens.font.size.sm, opacity: 0.6, marginBottom: tokens.spacing.sm }}>
        Atlas EIP
      </div>
      <h1 style={{ fontSize: tokens.font.size.xl, marginBottom: tokens.spacing.xs }}>{displayName}</h1>
      <p style={{ opacity: 0.7, marginBottom: tokens.spacing['3xl'] }}>
        {t(clockCopy.mobile.tap_to_punch, lang)}
      </p>

      <button
        onClick={handlePunch}
        disabled={submitting}
        style={{
          ...buttonStyle(tokens.colors.success),
          width: '100%',
          maxWidth: 320,
          fontSize: tokens.font.size.xl,
          padding: `${tokens.spacing.xl}px`,
          cursor: submitting ? 'not-allowed' : 'pointer',
          opacity: submitting ? 0.6 : 1,
        }}
      >
        {submitting ? t(clockCopy.mobile.processing, lang) : t(clockCopy.mobile.punch_button, lang)}
      </button>

      {errorCode && (
        <div
          style={{
            marginTop: tokens.spacing['2xl'],
            color: '#FCA5A5',
            fontSize: tokens.font.size.base,
            textAlign: 'center',
            maxWidth: 340,
          }}
        >
          {t(clockCopy.errors[errorCode], lang)}
        </div>
      )}
    </Screen>
  );
}

function Screen({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        minHeight: '100vh',
        background: tokens.colors.darkBg,
        color: tokens.colors.darkText,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: tokens.spacing['2xl'],
        fontFamily: tokens.font.family,
        textAlign: 'center',
      }}
    >
      {children}
    </div>
  );
}

function buttonStyle(bg: string): React.CSSProperties {
  return {
    display: 'inline-block',
    background: bg,
    color: tokens.colors.textInverse,
    padding: `${tokens.spacing.md}px ${tokens.spacing.xl}px`,
    borderRadius: tokens.radii.lg,
    fontWeight: tokens.font.weight.semibold,
    border: 'none',
    textDecoration: 'none',
  };
}

const warningBoxStyle: React.CSSProperties = {
  marginTop: tokens.spacing.lg,
  padding: `${tokens.spacing.md}px ${tokens.spacing.lg}px`,
  background: tokens.colors.warning,
  color: tokens.colors.textInverse,
  borderRadius: tokens.radii.md,
  fontSize: tokens.font.size.base,
  maxWidth: 340,
};

function formatTaipei(iso: string): string {
  return new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Taipei',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(new Date(iso));
}