// ══════════════════════════════════════════════════════════════
// Taiwan HR Form Templates — Atlas EIP
// Renders structured professional forms matching Taiwan standards
// ══════════════════════════════════════════════════════════════

// ── Pay & compliance metadata per leave type ──
const LEAVE_META: Record<string, { pay: string; payColor: string; bonusProtected: boolean; proRata: boolean; maxDays?: string; requiresDoc?: string }> = {
  "特休":       { pay: "有薪", payColor: "#059669", bonusProtected: false, proRata: false, maxDays: "依年資" },
  "補休":       { pay: "有薪", payColor: "#059669", bonusProtected: false, proRata: false },
  "病假":       { pay: "半薪", payColor: "#D97706", bonusProtected: false, proRata: true,  maxDays: "30天/年", requiresDoc: "就診證明（選附）" },
  "事假":       { pay: "無薪", payColor: "#DC2626", bonusProtected: false, proRata: false, maxDays: "14天/年" },
  "家庭照顧假": { pay: "無薪", payColor: "#DC2626", bonusProtected: true,  proRata: false, maxDays: "7天/56小時/年", requiresDoc: "照顧對象說明" },
  "生理假":     { pay: "半薪", payColor: "#D97706", bonusProtected: false, proRata: true,  maxDays: "1天/月" },
  "婚假":       { pay: "有薪", payColor: "#059669", bonusProtected: true,  proRata: false, maxDays: "8天" },
  "喪假":       { pay: "有薪", payColor: "#059669", bonusProtected: true,  proRata: false, requiresDoc: "死亡證明或訃文" },
  "產假":       { pay: "有薪", payColor: "#059669", bonusProtected: true,  proRata: false, maxDays: "56天", requiresDoc: "診斷書/出生證明" },
  "陪產假":     { pay: "有薪", payColor: "#059669", bonusProtected: true,  proRata: false, maxDays: "7天" },
  "公假":       { pay: "有薪", payColor: "#059669", bonusProtected: true,  proRata: false, requiresDoc: "公文或通知函" },
  "育嬰假":     { pay: "依規", payColor: "#2563EB", bonusProtected: true,  proRata: false },
};

const OT_PAY_RATES: Record<string, { rate: string; desc: string }> = {
  "平日加班":     { rate: "前2h × 1.34 / 後2h × 1.67", desc: "平日延長工時" },
  "假日加班":     { rate: "前8h × 1.34 / 後延長 × 1.67", desc: "休息日加班" },
  "國定假日":     { rate: "× 2.0", desc: "國定假日出勤" },
};

// ── Shared row component ──
function FormRow({ label, value, highlight, small, full }: {
  label: string; value: string | React.ReactNode;
  highlight?: boolean; small?: boolean; full?: boolean;
}) {
  return (
    <div style={{
      display: full ? "block" : "flex",
      alignItems: "flex-start",
      padding: "8px 12px",
      borderBottom: "1px solid #F3F4F6",
      gap: 8,
      background: highlight ? "#FFFBEB" : "transparent",
    }}>
      <div style={{
        fontSize: 11, color: "#9CA3AF", fontWeight: 700,
        minWidth: full ? "auto" : 90, flexShrink: 0,
        textTransform: "uppercase", letterSpacing: "0.04em",
        marginBottom: full ? 4 : 0,
      }}>
        {label}
      </div>
      <div style={{ fontSize: small ? 11 : 13, color: "#111827", fontWeight: 500, flex: 1 }}>
        {value || "—"}
      </div>
    </div>
  );
}

function SectionHeader({ title, color = "#7C3AED" }: { title: string; color?: string }) {
  return (
    <div style={{
      padding: "6px 12px",
      background: `${color}10`,
      borderBottom: `2px solid ${color}20`,
      fontSize: 10, fontWeight: 800, color,
      textTransform: "uppercase", letterSpacing: "0.08em",
    }}>
      {title}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════
// 請假單 Leave Form Template
// ══════════════════════════════════════════════════════════════
export function LeaveFormTemplate({ formData, submitterName, submittedAt, status, orgName }: {
  formData: Record<string, any>;
  submitterName: string;
  submittedAt: string;
  status: string;
  orgName?: string;
}) {
  const leaveType = formData.leave_type || "事假";
  const meta = LEAVE_META[leaveType.split(" ")[0]] || LEAVE_META["事假"];
  const days = formData.days;
  const hours = formData.hours;
  const isHourly = hours && !days;
  const duration = isHourly ? `${hours} 小時` : `${days || 1} 天`;

  // Format date range
  const dateRange = formData.start_date
    ? formData.end_date && formData.end_date !== formData.start_date
      ? `${formData.start_date} ～ ${formData.end_date}`
      : formData.start_date
    : "—";

  return (
    <div style={{ background: "white", borderRadius: 8, overflow: "hidden", border: "1px solid #E5E7EB", fontSize: 13 }}>
      {/* ── Form Header ── */}
      <div style={{
        padding: "12px 16px",
        background: "linear-gradient(135deg, #7C3AED08, #7C3AED03)",
        borderBottom: "2px solid #7C3AED20",
        display: "flex", alignItems: "center", justifyContent: "space-between",
      }}>
        <div>
          <div style={{ fontSize: 15, fontWeight: 800, color: "#111827" }}>📋 請 假 申 請 單</div>
          <div style={{ fontSize: 10, color: "#9CA3AF", marginTop: 1 }}>Leave Application Form · Atlas EIP</div>
        </div>
        <div style={{ textAlign: "right" }}>
          {orgName && <div style={{ fontSize: 11, color: "#6B7280", fontWeight: 600 }}>{orgName}</div>}
          <div style={{ fontSize: 10, color: "#9CA3AF" }}>
            申請日 {new Date(submittedAt).toLocaleDateString("zh-TW", { year: "numeric", month: "2-digit", day: "2-digit" })}
          </div>
        </div>
      </div>

      {/* ── Applicant Info ── */}
      <SectionHeader title="申請人資訊" />
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", borderBottom: "1px solid #F3F4F6" }}>
        <FormRow label="姓名" value={submitterName} />
        <FormRow label="申請狀態" value={
          <span style={{
            padding: "2px 8px", borderRadius: 4, fontSize: 11, fontWeight: 700,
            background: status === "approved" ? "#D1FAE5" : status === "rejected" ? "#FEE2E2" : "#FEF3C7",
            color: status === "approved" ? "#065F46" : status === "rejected" ? "#991B1B" : "#92400E",
          }}>
            {status === "approved" ? "✅ 已核准" : status === "rejected" ? "❌ 已駁回" : "⏳ 待審核"}
          </span>
        } />
      </div>

      {/* ── Leave Details ── */}
      <SectionHeader title="請假內容" />
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr" }}>
        <FormRow label="假別" value={
          <span style={{ fontWeight: 700, color: "#111827" }}>{leaveType}</span>
        } />
        <FormRow label="薪資類別" value={
          <span style={{ fontWeight: 700, color: meta.payColor }}>{meta.pay}</span>
        } />
        <FormRow label="請假期間" value={dateRange} />
        <FormRow label="請假時數/天數" value={
          <span style={{ fontWeight: 700, color: "#7C3AED" }}>{duration}</span>
        } />
        {formData.start_time && (
          <FormRow label="起訖時間" value={`${formData.start_time} ～ ${formData.end_time || "—"}`} />
        )}
        {meta.maxDays && (
          <FormRow label="法定上限" value={meta.maxDays} small />
        )}
      </div>
      <FormRow label="請假事由" value={formData.reason || "—"} full />
      {formData.proxy && (
        <FormRow label="職務代理人" value={formData.proxy} />
      )}
      {meta.requiresDoc && (
        <FormRow label="應附文件" value={
          <span style={{ color: "#D97706", fontWeight: 600 }}>📎 {meta.requiresDoc}</span>
        } />
      )}

      {/* ── 2026 Compliance Notes ── */}
      <SectionHeader title="2026 勞基法合規說明" color="#059669" />
      <div style={{ padding: "10px 12px", background: "#F8FAFC" }}>
        {meta.bonusProtected && (
          <div style={{ display: "flex", gap: 6, alignItems: "flex-start", marginBottom: 6 }}>
            <span style={{ color: "#059669", fontSize: 11, flexShrink: 0 }}>✅</span>
            <div style={{ fontSize: 11, color: "#374151" }}>
              <strong>{leaveType}</strong> 受法律完全保護 — 依勞基法第9-1條，此假別不得以任何方式扣發全勤獎金。
            </div>
          </div>
        )}
        {meta.proRata && (
          <div style={{ display: "flex", gap: 6, alignItems: "flex-start", marginBottom: 6 }}>
            <span style={{ color: "#D97706", fontSize: 11, flexShrink: 0 }}>⚠️</span>
            <div style={{ fontSize: 11, color: "#374151" }}>
              全勤獎金應<strong>按比例扣減</strong>，不得全額扣發。
              扣除公式：月全勤獎金 ÷ 30 × 請假天數。
            </div>
          </div>
        )}
        {leaveType.includes("家庭照顧") && (
          <div style={{ display: "flex", gap: 6, alignItems: "flex-start", marginBottom: 6 }}>
            <span style={{ color: "#2563EB", fontSize: 11, flexShrink: 0 }}>ℹ️</span>
            <div style={{ fontSize: 11, color: "#374151" }}>
              2026新制：家庭照顧假可以<strong>小時</strong>為單位請假（全年56小時上限）。
            </div>
          </div>
        )}
        {!meta.bonusProtected && !meta.proRata && (
          <div style={{ fontSize: 11, color: "#6B7280" }}>
            此假別無特殊全勤獎金限制，依公司規定辦理。
          </div>
        )}
      </div>

      {/* ── Approval Chain ── */}
      <SectionHeader title="簽核流程" color="#6B7280" />
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)" }}>
        {[
          { role: "申請人", name: submitterName, action: "申請" },
          { role: "直屬主管", name: "審核中", action: "核准/駁回" },
          { role: "人資/管理員", name: "待核備", action: "核備" },
        ].map((step, i) => (
          <div key={i} style={{
            padding: "10px 12px", textAlign: "center",
            borderRight: i < 2 ? "1px solid #F3F4F6" : "none",
          }}>
            <div style={{ fontSize: 10, color: "#9CA3AF", fontWeight: 700, marginBottom: 4, textTransform: "uppercase" }}>{step.role}</div>
            <div style={{ fontSize: 12, fontWeight: 600, color: "#374151", marginBottom: 2 }}>{step.name}</div>
            <div style={{ fontSize: 10, color: "#9CA3AF" }}>{step.action}</div>
            <div style={{ marginTop: 6, height: 24, borderBottom: "1px solid #D1D5DB", width: "80%", margin: "6px auto 0" }} />
          </div>
        ))}
      </div>

      {/* ── Footer ── */}
      <div style={{ padding: "6px 12px", background: "#F9FAFB", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div style={{ fontSize: 9, color: "#D1D5DB" }}>Atlas EIP · 首越人工智能有限公司 · 依勞工請假規則辦理</div>
        <div style={{ fontSize: 9, color: "#D1D5DB" }}>
          {new Date(submittedAt).toLocaleDateString("zh-TW")}
        </div>
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════
// 加班申請單 Overtime Form Template
// ══════════════════════════════════════════════════════════════
export function OvertimeFormTemplate({ formData, submitterName, submittedAt, status, orgName }: {
  formData: Record<string, any>;
  submitterName: string;
  submittedAt: string;
  status: string;
  orgName?: string;
}) {
  const otType = formData.overtime_type || "平日加班";
  const otMeta = OT_PAY_RATES[otType] || OT_PAY_RATES["平日加班"];
  const hours = parseFloat(formData.hours) || 0;
  // NT$196/hr base × rate
  const baseHourly = 196;
  const estimatedPay = otType.includes("假日")
    ? Math.round(hours <= 8 ? hours * baseHourly * 1.34 : (8 * baseHourly * 1.34) + ((hours - 8) * baseHourly * 1.67))
    : Math.round(hours <= 2 ? hours * baseHourly * 1.34 : (2 * baseHourly * 1.34) + Math.min(hours - 2, 2) * baseHourly * 1.67);

  return (
    <div style={{ background: "white", borderRadius: 8, overflow: "hidden", border: "1px solid #E5E7EB", fontSize: 13 }}>
      <div style={{
        padding: "12px 16px",
        background: "linear-gradient(135deg, #2563EB08, #2563EB03)",
        borderBottom: "2px solid #2563EB20",
        display: "flex", alignItems: "center", justifyContent: "space-between",
      }}>
        <div>
          <div style={{ fontSize: 15, fontWeight: 800, color: "#111827" }}>🕐 加 班 申 請 單</div>
          <div style={{ fontSize: 10, color: "#9CA3AF", marginTop: 1 }}>Overtime Application Form · Atlas EIP</div>
        </div>
        <div style={{ textAlign: "right" }}>
          {orgName && <div style={{ fontSize: 11, color: "#6B7280", fontWeight: 600 }}>{orgName}</div>}
          <div style={{ fontSize: 10, color: "#9CA3AF" }}>
            申請日 {new Date(submittedAt).toLocaleDateString("zh-TW", { year: "numeric", month: "2-digit", day: "2-digit" })}
          </div>
        </div>
      </div>

      <SectionHeader title="申請人資訊" color="#2563EB" />
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", borderBottom: "1px solid #F3F4F6" }}>
        <FormRow label="姓名" value={submitterName} />
        <FormRow label="申請狀態" value={
          <span style={{
            padding: "2px 8px", borderRadius: 4, fontSize: 11, fontWeight: 700,
            background: status === "approved" ? "#D1FAE5" : status === "rejected" ? "#FEE2E2" : "#FEF3C7",
            color: status === "approved" ? "#065F46" : status === "rejected" ? "#991B1B" : "#92400E",
          }}>
            {status === "approved" ? "✅ 已核准" : status === "rejected" ? "❌ 已駁回" : "⏳ 待審核"}
          </span>
        } />
      </div>

      <SectionHeader title="加班內容" color="#2563EB" />
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr" }}>
        <FormRow label="加班日期" value={formData.date || "—"} />
        <FormRow label="加班類別" value={
          <span style={{ fontWeight: 700, color: "#2563EB" }}>{otType}</span>
        } />
        <FormRow label="起訖時間" value={
          formData.start_time && formData.end_time
            ? `${formData.start_time} ～ ${formData.end_time}`
            : "—"
        } />
        <FormRow label="加班時數" value={
          <span style={{ fontWeight: 700, color: "#2563EB" }}>{hours} 小時</span>
        } />
        {formData.project && <FormRow label="專案名稱" value={formData.project} />}
      </div>
      <FormRow label="加班事由" value={formData.reason || "—"} full />

      <SectionHeader title="加班費試算 (2026 基本工資)" color="#2563EB" />
      <div style={{ padding: "10px 12px", background: "#EFF6FF" }}>
        <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 6 }}>
          <div style={{ fontSize: 11, color: "#374151" }}>
            <span style={{ color: "#9CA3AF" }}>費率：</span>
            <strong>{otMeta.rate}</strong>
          </div>
          <div style={{ fontSize: 11, color: "#374151" }}>
            <span style={{ color: "#9CA3AF" }}>基本時薪：</span>
            <strong>NT${baseHourly}/hr</strong>
          </div>
        </div>
        <div style={{ fontSize: 14, fontWeight: 800, color: "#2563EB" }}>
          預估加班費：NT${estimatedPay.toLocaleString()}
          <span style={{ fontSize: 10, fontWeight: 400, color: "#9CA3AF", marginLeft: 6 }}>
            （實際金額依公司薪資標準計算）
          </span>
        </div>
        <div style={{ fontSize: 10, color: "#6B7280", marginTop: 4 }}>
          ⚠️ 依勞基法第32條，每月加班上限46小時（書面同意可延至54小時），每季上限138小時。
        </div>
      </div>

      <SectionHeader title="補休或加班費選擇" color="#2563EB" />
      <div style={{ padding: "10px 12px", display: "flex", gap: 16 }}>
        {["□ 申請加班費", "□ 改為補休"].map(opt => (
          <div key={opt} style={{ fontSize: 12, color: "#374151", display: "flex", alignItems: "center", gap: 6 }}>{opt}</div>
        ))}
        <div style={{ fontSize: 10, color: "#9CA3AF", marginLeft: "auto" }}>（員工自選，依勞基法第32-1條）</div>
      </div>

      <SectionHeader title="簽核流程" color="#6B7280" />
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)" }}>
        {[
          { role: "申請人", name: submitterName, action: "申請" },
          { role: "直屬主管", name: "審核中", action: "核准/駁回" },
          { role: "人資/管理員", name: "待核備", action: "核備" },
        ].map((step, i) => (
          <div key={i} style={{ padding: "10px 12px", textAlign: "center", borderRight: i < 2 ? "1px solid #F3F4F6" : "none" }}>
            <div style={{ fontSize: 10, color: "#9CA3AF", fontWeight: 700, marginBottom: 4, textTransform: "uppercase" }}>{step.role}</div>
            <div style={{ fontSize: 12, fontWeight: 600, color: "#374151", marginBottom: 2 }}>{step.name}</div>
            <div style={{ fontSize: 10, color: "#9CA3AF" }}>{step.action}</div>
            <div style={{ marginTop: 6, height: 24, borderBottom: "1px solid #D1D5DB", width: "80%", margin: "6px auto 0" }} />
          </div>
        ))}
      </div>

      <div style={{ padding: "6px 12px", background: "#F9FAFB", display: "flex", justifyContent: "space-between" }}>
        <div style={{ fontSize: 9, color: "#D1D5DB" }}>Atlas EIP · 首越人工智能有限公司 · 依勞基法第24、32條辦理</div>
        <div style={{ fontSize: 9, color: "#D1D5DB" }}>{new Date(submittedAt).toLocaleDateString("zh-TW")}</div>
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════
// 出差申請單 Business Trip Form Template
// ══════════════════════════════════════════════════════════════
export function BusinessTripFormTemplate({ formData, submitterName, submittedAt, status, orgName }: {
  formData: Record<string, any>;
  submitterName: string;
  submittedAt: string;
  status: string;
  orgName?: string;
}) {
  const isInternational = formData.destination && !["高雄", "台中", "台南", "新竹", "花蓮", "台東", "桃園", "基隆", "嘉義", "屏東"].some(city => formData.destination.includes(city));

  return (
    <div style={{ background: "white", borderRadius: 8, overflow: "hidden", border: "1px solid #E5E7EB", fontSize: 13 }}>
      <div style={{
        padding: "12px 16px",
        background: "linear-gradient(135deg, #05966908, #05966903)",
        borderBottom: "2px solid #05966920",
        display: "flex", alignItems: "center", justifyContent: "space-between",
      }}>
        <div>
          <div style={{ fontSize: 15, fontWeight: 800, color: "#111827" }}>✈️ 出 差 申 請 單</div>
          <div style={{ fontSize: 10, color: "#9CA3AF", marginTop: 1 }}>Business Trip Application · Atlas EIP</div>
        </div>
        <div style={{ textAlign: "right" }}>
          {orgName && <div style={{ fontSize: 11, color: "#6B7280", fontWeight: 600 }}>{orgName}</div>}
          <div style={{ fontSize: 10, color: "#9CA3AF" }}>
            申請日 {new Date(submittedAt).toLocaleDateString("zh-TW", { year: "numeric", month: "2-digit", day: "2-digit" })}
          </div>
        </div>
      </div>

      <SectionHeader title="申請人資訊" color="#059669" />
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", borderBottom: "1px solid #F3F4F6" }}>
        <FormRow label="姓名" value={submitterName} />
        <FormRow label="申請狀態" value={
          <span style={{
            padding: "2px 8px", borderRadius: 4, fontSize: 11, fontWeight: 700,
            background: status === "approved" ? "#D1FAE5" : status === "rejected" ? "#FEE2E2" : "#FEF3C7",
            color: status === "approved" ? "#065F46" : status === "rejected" ? "#991B1B" : "#92400E",
          }}>
            {status === "approved" ? "✅ 已核准" : status === "rejected" ? "❌ 已駁回" : "⏳ 待審核"}
          </span>
        } />
      </div>

      <SectionHeader title="出差行程" color="#059669" />
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr" }}>
        <FormRow label="出差地點" value={
          <span style={{ fontWeight: 700, color: "#059669" }}>{formData.destination || "—"}</span>
        } />
        <FormRow label="出差類型" value={
          <span style={{ fontWeight: 600, color: isInternational ? "#7C3AED" : "#059669" }}>
            {isInternational ? "🌏 海外出差" : "🇹🇼 國內出差"}
          </span>
        } />
        <FormRow label="出差期間" value={
          formData.start_date && formData.end_date
            ? formData.start_date === formData.end_date
              ? formData.start_date
              : `${formData.start_date} ～ ${formData.end_date}`
            : formData.start_date || "—"
        } />
        <FormRow label="出差天數" value={
          <span style={{ fontWeight: 700, color: "#059669" }}>{formData.days || "—"} 天</span>
        } />
        <FormRow label="交通方式" value={formData.transport || "—"} />
        {formData.accommodation && <FormRow label="住宿安排" value={formData.accommodation} />}
      </div>
      <FormRow label="出差目的/任務" value={formData.purpose || "—"} full />

      <SectionHeader title="費用預估" color="#059669" />
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr" }}>
        <FormRow label="交通費" value={formData.budget ? `NT$${formData.budget}` : "待估"} />
        <FormRow label="住宿費" value="待估" />
        <FormRow label="其他費用" value="待估" />
      </div>
      <div style={{ padding: "8px 12px", background: "#F0FDF4", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div style={{ fontSize: 11, color: "#6B7280" }}>預估出差費用總計</div>
        <div style={{ fontSize: 14, fontWeight: 800, color: "#059669" }}>
          {formData.budget ? `NT$${parseInt(formData.budget).toLocaleString()} 起` : "返回後報銷"}
        </div>
      </div>

      <SectionHeader title="簽核流程" color="#6B7280" />
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)" }}>
        {[
          { role: "申請人", name: submitterName, action: "申請" },
          { role: "直屬主管", name: "審核中", action: "核准/駁回" },
          { role: "財務/管理員", name: "待核備", action: "核備" },
        ].map((step, i) => (
          <div key={i} style={{ padding: "10px 12px", textAlign: "center", borderRight: i < 2 ? "1px solid #F3F4F6" : "none" }}>
            <div style={{ fontSize: 10, color: "#9CA3AF", fontWeight: 700, marginBottom: 4, textTransform: "uppercase" }}>{step.role}</div>
            <div style={{ fontSize: 12, fontWeight: 600, color: "#374151", marginBottom: 2 }}>{step.name}</div>
            <div style={{ fontSize: 10, color: "#9CA3AF" }}>{step.action}</div>
            <div style={{ height: 24, borderBottom: "1px solid #D1D5DB", width: "80%", margin: "6px auto 0" }} />
          </div>
        ))}
      </div>

      <div style={{ padding: "6px 12px", background: "#F9FAFB", display: "flex", justifyContent: "space-between" }}>
        <div style={{ fontSize: 9, color: "#D1D5DB" }}>Atlas EIP · 首越人工智能有限公司 · 出差費用請於返回後5個工作日內報銷</div>
        <div style={{ fontSize: 9, color: "#D1D5DB" }}>{new Date(submittedAt).toLocaleDateString("zh-TW")}</div>
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════
// Main dispatcher — pick correct template by form_type
// ══════════════════════════════════════════════════════════════
export function FormTemplate({ submission, orgName }: {
  submission: {
    form_type: string;
    form_data: Record<string, any>;
    submitter_name: string;
    submitted_by: string;
    created_at: string;
    status: string;
  };
  orgName?: string;
}) {
  const props = {
    formData: submission.form_data,
    submitterName: submission.submitter_name || submission.submitted_by?.slice(0, 12) || "—",
    submittedAt: submission.created_at,
    status: submission.status,
    orgName,
  };

  if (submission.form_type === "leave") return <LeaveFormTemplate {...props} />;
  if (submission.form_type === "overtime") return <OvertimeFormTemplate {...props} />;
  if (submission.form_type === "business_trip") return <BusinessTripFormTemplate {...props} />;
  return null;
}