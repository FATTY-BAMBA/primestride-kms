// src/lib/i18n/clock.ts
// Bilingual strings for the clock-in feature.
// Matches Phase 1's { _zh, _en } convention from WorkflowsPage/ComplianceConflictScanner.

export type Lang = 'zh' | 'en';

export const clockCopy = {
  display: {
    subtitle:     { zh: '掃描 QR Code 打卡',            en: 'Scan QR code to clock in/out' },
    auto_refresh: { zh: 'QR Code 每 45 秒自動更新',      en: 'QR code refreshes every 45 seconds' },
    error:        { zh: '載入失敗',                     en: 'Failed to load' },
  },
  mobile: {
    loading:         { zh: '載入中…',                  en: 'Loading…' },
    signin_required: { zh: '需要登入',                 en: 'Sign in required' },
    signin_body:     { zh: '請先登入 Atlas EIP 再掃描 QR Code。', en: 'Please sign in to Atlas EIP before scanning.' },
    signin_button:   { zh: '前往登入',                 en: 'Sign in' },
    invalid_link:    { zh: '無效連結',                 en: 'Invalid link' },
    invalid_body:    { zh: '此連結缺少 QR token，請重新掃描。', en: 'Missing QR token. Please rescan.' },
    tap_to_punch:    { zh: '點擊下方按鈕打卡',         en: 'Tap the button to clock in or out' },
    punch_button:    { zh: '打卡',                    en: 'Clock in / out' },
    processing:      { zh: '處理中…',                  en: 'Processing…' },
    success_in:      { zh: '已打卡上班',               en: 'Clocked in' },
    success_out:     { zh: '已打卡下班',               en: 'Clocked out' },
    clock_in_at:     { zh: '上班時間',                 en: 'Clocked in at' },
    clock_out_at:    { zh: '下班時間',                 en: 'Clocked out at' },
    total_hours:     { zh: '工時',                    en: 'Hours worked' },
    overtime:        { zh: '加班',                    en: 'Overtime' },
    late:            { zh: '遲到',                    en: 'Late' },
    minutes:         { zh: '分鐘',                    en: 'min' },
    hours:           { zh: '小時',                    en: 'hr' },
    incomplete_warning: {
      zh: '⚠️ 您 {date} 未打卡下班，請聯絡主管補登。',
      en: '⚠️ You did not clock out on {date}. Please ask your manager to correct the record.',
    },
  },
  errors: {
    QR_EXPIRED:      { zh: 'QR Code 已過期，請重新掃描',        en: 'QR code expired — please rescan' },
    QR_INVALID:      { zh: 'QR Code 無效',                       en: 'Invalid QR code' },
    NOT_MEMBER:      { zh: '您不是此組織的成員',                en: 'You are not a member of this organization' },
    RATE_LIMITED:    { zh: '請稍候再試',                         en: 'Please wait a moment before trying again' },
    ALREADY_OUT:     { zh: '今日已完成打卡',                     en: 'Already clocked out for today' },
    ADMIN_REQUIRED:  { zh: '需要管理員權限',                    en: 'Admin permission required' },
    UNAUTHENTICATED: { zh: '請先登入',                          en: 'Please sign in' },
    UNKNOWN:         { zh: '發生錯誤，請聯絡人資',              en: 'An error occurred — please contact HR' },
  },
} as const;

export function t<K extends { zh: string; en: string }>(entry: K, lang: Lang): string {
  return entry[lang];
}

export function tf(
  entry: { zh: string; en: string },
  lang: Lang,
  vars: Record<string, string | number>,
): string {
  let s = entry[lang];
  for (const [k, v] of Object.entries(vars)) {
    s = s.replace(`{${k}}`, String(v));
  }
  return s;
}
