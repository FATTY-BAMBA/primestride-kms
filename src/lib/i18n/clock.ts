// src/lib/i18n/clock.ts
// Bilingual strings for the clock-in feature.

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
    invalid_body:    { zh: '此連結缺少 QR token,請重新掃描。', en: 'Missing QR token. Please rescan.' },
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
      zh: '⚠️ 您 {date} 未打卡下班,請聯絡主管補登。',
      en: '⚠️ You did not clock out on {date}. Please ask your manager to correct the record.',
    },
  },
  manualEntry: {
    page_title:        { zh: '補登打卡', en: 'Submit Manual Entry' },
    subtitle:          { zh: '忘記打卡?手機沒電?請填寫以下表單', en: 'Forgot to punch? Phone died? Fill out the form below.' },
    work_date_label:   { zh: '工作日期',     en: 'Work date' },
    work_date_help:    { zh: '可補登 {days} 天內的記錄', en: 'You can submit entries within {days} days' },
    clock_in_label:    { zh: '上班時間',     en: 'Clock-in time' },
    clock_out_label:   { zh: '下班時間',     en: 'Clock-out time' },
    times_help:        { zh: '至少需填寫一個時間',  en: 'At least one time required' },
    reason_label:      { zh: '原因',         en: 'Reason' },
    reason_phone_dead: { zh: '手機沒電',     en: 'Phone died' },
    reason_forgot:     { zh: '忘記打卡',     en: 'Forgot to punch' },
    reason_travel:     { zh: '出差',         en: 'Travel / out of office' },
    reason_system:     { zh: '系統問題',     en: 'System issue' },
    reason_other:      { zh: '其他',         en: 'Other' },
    note_label:        { zh: '說明 (選填)',  en: 'Note (optional)' },
    note_placeholder:  { zh: '請補充說明...', en: 'Add additional context...' },
    submit_button:     { zh: '提交申請',     en: 'Submit request' },
    submitting:        { zh: '提交中…',     en: 'Submitting…' },
    submitted_title:   { zh: '已送出補登申請', en: 'Request submitted' },
    submitted_body:    { zh: '主管會在收到通知後審核', en: 'Your manager has been notified and will review' },
    submit_another:    { zh: '提交另一筆',   en: 'Submit another' },
    my_requests_title: { zh: '我的補登申請', en: 'My requests' },
    no_requests:       { zh: '尚未送出任何申請', en: 'No requests submitted yet' },
    status_pending:    { zh: '審核中',       en: 'Pending' },
    status_approved:   { zh: '已通過',       en: 'Approved' },
    status_rejected:   { zh: '已退回',       en: 'Rejected' },
  },
  errors: {
    QR_EXPIRED:      { zh: 'QR Code 已過期,請重新掃描',        en: 'QR code expired — please rescan' },
    QR_INVALID:      { zh: 'QR Code 無效',                       en: 'Invalid QR code' },
    NOT_MEMBER:      { zh: '您不是此組織的成員',                en: 'You are not a member of this organization' },
    RATE_LIMITED:    { zh: '請稍候再試',                         en: 'Please wait a moment before trying again' },
    ALREADY_OUT:     { zh: '今日已完成打卡',                     en: 'Already clocked out for today' },
    ADMIN_REQUIRED:  { zh: '需要管理員權限',                    en: 'Admin permission required' },
    UNAUTHENTICATED: { zh: '請先登入',                          en: 'Please sign in' },
    UNKNOWN:         { zh: '發生錯誤,請聯絡人資',              en: 'An error occurred — please contact HR' },
    INVALID_INPUT:           { zh: '輸入資料有誤',                en: 'Invalid input' },
    WORK_DATE_TOO_OLD:       { zh: '無法補登超過 {days} 天前的記錄', en: 'Cannot submit entries older than {days} days' },
    WORK_DATE_IN_FUTURE:     { zh: '不能補登未來日期',            en: 'Cannot submit a future date' },
    MISSING_TIMES:           { zh: '請填寫上班或下班時間',         en: 'Please enter clock-in or clock-out time' },
    CLOCK_IN_NOT_BEFORE_OUT: { zh: '上班時間必須早於下班時間',      en: 'Clock-in must be before clock-out' },
    RECORD_ALREADY_COMPLETE: { zh: '當日已有完整打卡記錄',         en: 'A complete record already exists for that date' },
    UNMERGEABLE_CONFLICT:    { zh: '與既有記錄衝突,請聯絡主管',   en: 'Conflicts with existing record — please contact your manager' },
    DUPLICATE_PENDING:       { zh: '當日已有待審核的補登申請',     en: 'You already have a pending request for this date' },
  },
  // ── PR 3b: Sidebar + home page strings ──
  sidebar: {
    section_hr:        { zh: '人資',          en: 'HR' },
    my_clock:          { zh: '我的打卡',       en: 'My Clock-in' },
    attendance_review: { zh: '出勤審核',       en: 'Attendance Review' },
  },
  home: {
    // Employee strings
    employee_status_in:        { zh: '已打卡上班',                  en: 'Clocked in' },
    employee_status_out:       { zh: '今日打卡完成',                en: "Today's clock-in complete" },
    employee_status_not_in:    { zh: '今天還沒打卡',                en: 'Not yet clocked in today' },
    employee_clock_in_at:      { zh: '上班 {time}',                en: 'Clocked in {time}' },
    employee_clock_in_now:     { zh: '立即打卡 →',                  en: 'Clock in now →' },
    employee_clock_out_now:    { zh: '打卡下班 →',                  en: 'Clock out →' },
    employee_view_today:       { zh: '查看今日 →',                  en: 'View today →' },
    employee_total_today:      { zh: '今日工時 {hours}',            en: '{hours} today' },
    employee_late_today:       { zh: '遲到 {minutes} 分鐘',         en: '{minutes} min late' },
    employee_monthly_days:     { zh: '本月打卡天數',                en: 'Days clocked this month' },
    employee_incomplete_alert: { zh: '您 {date} 未打卡下班，請補登', en: 'You did not clock out on {date} — please submit a manual entry' },
    // Admin strings
    admin_summary_in:          { zh: '在崗',                        en: 'In' },
    admin_summary_late:        { zh: '遲到',                        en: 'Late' },
    admin_summary_not_in:      { zh: '未到',                        en: 'Not in' },
    admin_summary_overtime:    { zh: '加班中',                      en: 'OT' },
    admin_summary_total:       { zh: '應到',                        en: 'Expected' },
    admin_attendance_rate:     { zh: '今日出勤率',                  en: "Today's attendance" },
    admin_view_details:        { zh: '查看詳情 →',                  en: 'View details →' },
    admin_pending_requests:    { zh: '{count} 件補登申請待您審核',   en: '{count} manual entries awaiting your review' },
    admin_employees_not_in:    { zh: '{count} 名員工今天還沒打卡',   en: '{count} employees not clocked in today' },
  },
  // ── PR 3c.3: Approval queue UI strings ──
  approval: {
    // Tab + page-level
    tab_attendance:           { zh: '出勤審核',           en: 'Attendance Review' },
    page_subtitle:            { zh: '審核員工的補登打卡申請', en: 'Review and resolve manual clock-in requests' },
    refresh:                  { zh: '重新整理',           en: 'Refresh' },
    refreshing:               { zh: '更新中…',           en: 'Refreshing…' },
    last_updated:             { zh: '最後更新 {time}',    en: 'Last updated {time}' },

    // Today's overview panel
    today_overview_title:     { zh: '今日出勤總覽',       en: "Today's attendance overview" },
    view_history:             { zh: '查看歷史記錄 →',    en: 'View history →' },

    // Empty state
    empty_state_title:        { zh: '所有申請已處理完畢',  en: 'All requests resolved' },
    empty_state_body:         { zh: '目前沒有待審核的補登打卡申請', en: 'No pending manual entries to review' },
    empty_state_emoji:        { zh: '🎉',                en: '🎉' },

    // Pending queue header
    queue_title:              { zh: '待審核申請',         en: 'Pending requests' },
    queue_count:              { zh: '共 {count} 件',     en: '{count} pending' },

    // Card content
    card_employee:            { zh: '員工',               en: 'Employee' },
    card_work_date:           { zh: '工作日期',           en: 'Work date' },
    card_clock_in:            { zh: '上班',               en: 'Clock-in' },
    card_clock_out:           { zh: '下班',               en: 'Clock-out' },
    card_reason:              { zh: '原因',               en: 'Reason' },
    card_note:                { zh: '說明',               en: 'Note' },
    card_submitted_at:        { zh: '送出時間 {time}',   en: 'Submitted {time}' },
    card_no_clock_in:         { zh: '無',                 en: '—' },
    card_no_clock_out:        { zh: '無',                 en: '—' },
    card_no_note:             { zh: '無說明',             en: 'No note' },

    // Per-card actions
    card_approve:             { zh: '批准',               en: 'Approve' },
    card_reject:              { zh: '拒絕',               en: 'Reject' },
    card_select:              { zh: '選擇',               en: 'Select' },
    card_approving:           { zh: '處理中…',           en: 'Approving…' },
    card_rejecting:           { zh: '處理中…',           en: 'Rejecting…' },

    // Reject modal
    reject_modal_title:       { zh: '拒絕補登申請',       en: 'Reject manual entry' },
    reject_modal_subtitle:    { zh: '請說明拒絕原因,員工會收到此說明', en: 'Provide a reason — the employee will see this' },
    reject_note_label:        { zh: '拒絕原因',           en: 'Reason for rejection' },
    reject_note_placeholder:  { zh: '例如:時間記錄不符,請確認後重新提交', en: 'e.g., Times do not match logs, please verify and resubmit' },
    reject_note_required:     { zh: '必填',               en: 'Required' },
    reject_submit:            { zh: '提交拒絕',           en: 'Submit rejection' },
    reject_cancel:            { zh: '取消',               en: 'Cancel' },
    reject_submitting:        { zh: '提交中…',           en: 'Submitting…' },

    // Bulk action bar
    bulk_selected:            { zh: '已選 {count} 項',   en: '{count} selected' },
    bulk_select_all:          { zh: '全選',               en: 'Select all' },
    bulk_clear:               { zh: '取消選擇',           en: 'Clear' },
    bulk_approve:             { zh: '批准全部',           en: 'Approve selected' },
    bulk_approving:           { zh: '批准中…',           en: 'Approving…' },

    // Confirm dialog
    confirm_bulk_title:       { zh: '確認批准 {count} 件申請?', en: 'Approve {count} requests?' },
    confirm_bulk_body:        { zh: '此操作會建立員工的打卡記錄並寄送通知信。', en: 'This will create attendance records and send notification emails.' },
    confirm_yes:              { zh: '確認批准',           en: 'Confirm' },
    confirm_no:               { zh: '取消',               en: 'Cancel' },

    // Success/error toast messages
    toast_approved_one:       { zh: '已批准補登申請',     en: 'Request approved' },
    toast_rejected_one:       { zh: '已拒絕補登申請',     en: 'Request rejected' },
    toast_bulk_success:       { zh: '已批准 {count} 件申請', en: '{count} requests approved' },
    toast_bulk_partial:       { zh: '已批准 {ok} 件,{fail} 件失敗', en: 'Approved {ok}, {fail} failed' },
    toast_error_generic:      { zh: '操作失敗,請稍後再試', en: 'Action failed — please try again' },
    toast_error_already:      { zh: '此申請已被處理',     en: 'Request already resolved' },
    toast_error_not_found:    { zh: '找不到此申請',       en: 'Request not found' },
    toast_dismiss:            { zh: '關閉',               en: 'Dismiss' },

    // Failure reasons (used in the failed list of bulk response)
    fail_not_pending:         { zh: '已被處理',           en: 'Already resolved' },
    fail_not_found:           { zh: '找不到',             en: 'Not found' },
    fail_conflict_complete:   { zh: '當日已有完整記錄',   en: 'Complete record exists' },
    fail_conflict_unmergeable:{ zh: '記錄衝突',           en: 'Record conflict' },
    fail_db_error:            { zh: '資料庫錯誤',         en: 'Database error' },
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