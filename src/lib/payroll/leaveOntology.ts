// src/lib/payroll/leaveOntology.ts
//
// Atlas EIP — Leave Type Ontology
// ──────────────────────────────────────────────────────────────────────
// The single source of truth for every leave type Atlas EIP supports.
//
// Used by:
//   - leaveClassifier.ts: resolves a leave_type string to a canonical entry
//   - leaveDeduction.ts: applies pay treatment using each entry's rules
//   - leaveAudit.ts: emits verbatim 繁中 LSA citations into audit records
//   - workflows/route.ts (eventual refactor): replaces getLeaveColumn()
//
// Design principles (per Doc A § 2.1):
//   - Verbatim 繁中 legal text (sourced from law.moj.gov.tw) — never paraphrase
//   - Bilingual canonical names (繁中 primary, EN as supporting)
//   - Structured pay treatment so the calculator can switch on `kind`
//   - Aliases capture every observed variant in production data
//   - Notes carry edge-case context the calculator/agent need
//
// Effective period: 2026-01-01 (民國 115 年). Citations reflect 勞工請假規則
// as amended by 勞動部 114年12月9日 勞動條4字第1140149214號令, effective
// 民國 115年1月1日.

// ── Type definitions ─────────────────────────────────────────────────

/**
 * Source of legal authority for a leave type.
 *  - LSA: 勞動基準法
 *  - LeaveRules: 勞工請假規則
 *  - GenderEquality: 性別平等工作法 (renamed from 性別工作平等法 in 2023)
 *  - OccupationalAccident: 職業災害勞工保護法 / 職業安全衛生法
 *  - Other: residual category (e.g., 民法 for marriage definition)
 */
export type LegalSource =
  | "LSA"
  | "LeaveRules"
  | "GenderEquality"
  | "OccupationalAccident"
  | "MOLInterpretation"
  | "Other";

export type LegalCitation = {
  source: LegalSource;
  /** Article reference, e.g., '第43條', '第7條' */
  article: string;
  /** Canonical URL on law.moj.gov.tw */
  url: string;
  /** Verbatim 繁中 text from the source. NEVER paraphrase. */
  textZh: string;
};

/**
 * Pay treatment variants. Each variant maps to a calculator branch
 * in payTreatment.ts (Phase 3b).
 */
export type PayTreatment =
  | { kind: "full_pay" }
  | { kind: "unpaid" }
  | { kind: "half_pay" }
  | {
      kind: "half_pay_with_ytd_cap";
      capDays: number;
      thenTreatment: PayTreatment;
    }
  | {
      kind: "tenure_dependent";
      ifTenureMonthsAtLeast: number;
      thenFullPay: true;
      elseHalfPay: true;
    }
  | { kind: "employer_full_pay_with_insurance_offset" }
  /**
   * Menstrual leave (生理假) — three-bucket treatment per
   * GEAW Art. 14 + 勞動部 函釋 勞動條4字第1040131594號令 (104年09月08日).
   *
   * Bucket 1 (separate): first `separateBucketDays` days/year
   *   → half pay, NEVER counts toward the sick leave cap
   *
   * Bucket 2 (merged): days beyond bucket 1, while combined
   *   sick + menstrual_overflow ≤ `sharedCapDays`
   *   → half pay, MERGED into the sick leave half-pay cap
   *
   * Bucket 3 (beyond cap): days where combined sick + menstrual_overflow
   *   > `sharedCapDays`
   *   → `thenTreatment` (currently `unpaid` per 勞動部 函釋:
   *      雇主應給假，但得不給薪)
   *
   * The third bucket only triggers when the employee has exhausted the
   * statutory 33-day combined ceiling (3 separate menstrual + 30
   * sick/menstrual-merged). The 函釋 explicitly affirms the leave must
   * still be granted; only the wage obligation lapses.
   */
  | {
      kind: "menstrual_leave_treatment";
      separateBucketDays: number; // 3 per GEAW Art. 14
      sharedCapDays: number; // 30 per 勞工請假規則 第4條
      thenTreatment: PayTreatment;
    }
  /** Special: employee is suspended from payroll entirely. */
  | { kind: "skip_from_payroll" };

export type AnnualCap = {
  daysPerYear: number;
  countingWindow:
    | "calendar_year"
    | "rolling_2_years"
    | "lifetime_per_event"
    | "per_event"
    | "monthly";
  overflowBehavior:
    | "deny"
    | "convert_to_annual_leave"
    | "become_unpaid_with_consent"
    | "become_unpaid_unconditional"
    | "merge_into_other_leave_type";
  /** For 喪假 / 生理假 / 安胎: per-relation or special caps may differ; document here */
  specialNotes?: string;
};

/**
 * 全勤獎金 (perfect attendance bonus) protection rules per
 * 勞工請假規則 第9條 + 性別平等工作法 第21條.
 */
export type PerfectAttendanceProtection = {
  /** True if this leave type cannot affect 全勤獎金 (i.e., protected) */
  protected: boolean;
  /** Citation for the protection rule, when applicable */
  legalBasis?: string;
  /** True for 病假: 全勤獎金 may be reduced proportionally per Art. 9(2) */
  proportionalDeduction?: boolean;
};

export type DocumentRequirement = {
  /** Plain-language condition under which the document is required */
  whenRequired: string;
  documentType:
    | "medical_certificate"
    | "death_certificate"
    | "marriage_certificate"
    | "pregnancy_diagnosis"
    | "official_summons"
    | "child_birth_certificate"
    | "spouse_pregnancy_proof"
    | "employer_discretion"
    | "other";
};

export type CountingUnit = "days" | "hours" | "half_days";

export type LeaveTypeDefinition = {
  // ── Identity ──
  /** Stable machine-readable key. Once set, NEVER change — audit records reference it. */
  canonicalKey: string;
  /** 繁中 official name (Taiwanese 正體字) */
  canonicalNameZh: string;
  /** English name */
  canonicalNameEn: string;
  /** Strings that resolve to this entry. Lowercase, substring-match. */
  aliases: string[];

  // ── Legal basis ──
  /** Every entry MUST cite at least one source. Verbatim 繁中. */
  legalBasis: LegalCitation[];

  // ── Pay treatment ──
  payTreatment: PayTreatment;

  // ── Caps ──
  /** null = no statutory cap (e.g., 公假, 公傷病假) */
  annualCap: AnnualCap | null;

  // ── 全勤獎金 ──
  perfectAttendanceProtected: PerfectAttendanceProtection;

  // ── Documents ──
  documentRequirement: DocumentRequirement | null;

  // ── Insurance offset (only true for 公傷病假) ──
  insuranceOffsetAllowed: boolean;

  // ── Counting units ──
  countingUnits: CountingUnit[];

  // ── Edge-case notes for calculator/agent consumers ──
  notes?: { zh: string; en: string };
};

// ──────────────────────────────────────────────────────────────────────
// Ontology entries
// ──────────────────────────────────────────────────────────────────────
//
// Each entry below is a complete, audit-defensible specification.
// Verbatim 繁中 citations are reproduced from law.moj.gov.tw.
// Do not paraphrase. Do not abbreviate. Do not "clean up" the text.
//
// Order roughly mirrors Doc A § 2.4 for ease of cross-reference.

/**
 * 特別休假 — Annual Leave (Paid Time Off)
 * ──────────────────────────────────────────────────────────────
 * Tenure-based cap. Engine v1 does not enforce the tenure-based
 * day count here (employee profile carries the YTD allotment
 * separately); this entry only confirms full pay treatment.
 */
export const annual_leave: LeaveTypeDefinition = {
  canonicalKey: "annual_leave",
  canonicalNameZh: "特別休假",
  canonicalNameEn: "Annual Leave",
  aliases: [
    "特休",
    "特別休假",
    "annual",
    "annual leave",
    "pto",
    "paid time off",
    "年假",
  ],

  legalBasis: [
    {
      source: "LSA",
      article: "第38條",
      url: "https://law.moj.gov.tw/LawClass/LawSingle.aspx?pcode=N0001000&flno=38",
      textZh:
        "勞工在同一雇主或事業單位，繼續工作滿一定期間者，應依下列規定給予特別休假：一、六個月以上一年未滿者，三日。二、一年以上二年未滿者，七日。三、二年以上三年未滿者，十日。四、三年以上五年未滿者，每年十四日。五、五年以上十年未滿者，每年十五日。六、十年以上者，每一年加給一日，加至三十日為止。",
    },
  ],

  payTreatment: { kind: "full_pay" },

  annualCap: {
    daysPerYear: 30,
    countingWindow: "calendar_year",
    overflowBehavior: "deny",
    specialNotes:
      "Tenure-based: 6mo–1yr→3, 1–2yr→7, 2–3yr→10, 3–5yr→14, 5–10yr→15, ≥10yr→15+1/yr (max 30). Engine v1 does not compute tenure dynamically; relies on profiles.annual_total.",
  },

  perfectAttendanceProtected: {
    protected: true,
    legalBasis: "勞工請假規則 第9條 (implicitly — paid leave; LSA Art. 9 protection)",
  },

  documentRequirement: null,
  insuranceOffsetAllowed: false,
  countingUnits: ["days", "half_days"],

  notes: {
    zh: "特別休假應由勞工排定，雇主基於企業經營急迫需求得協商調整。年度終結未休完之特休應依《勞動基準法》第 38 條第 4 項規定發給工資。",
    en:
      "Annual leave is scheduled by the employee; the employer may negotiate adjustments for urgent business needs. Unused days at year-end must be paid out per LSA Art. 38(4).",
  },
};

/**
 * 事假 — Personal Leave
 * ──────────────────────────────────────────────────────────────
 * LSA-strict default: unpaid. Configurable to paid via per-org
 * leave_policy_config.overrides.personalLeavePaidDays (Phase 3c).
 */
export const personal_leave: LeaveTypeDefinition = {
  canonicalKey: "personal_leave",
  canonicalNameZh: "事假",
  canonicalNameEn: "Personal Leave",
  aliases: ["事假", "personal", "personal leave", "private affairs"],

  legalBasis: [
    {
      source: "LeaveRules",
      article: "第7條",
      url: "https://law.moj.gov.tw/LawClass/LawSingle.aspx?pcode=N0030006&flno=7",
      textZh:
        "勞工因有事故必須親自處理，得請事假，一年內合計不得超過十四日。事假期間不給工資。勞工為親自照顧家庭成員，除本法或其他法律另有規定者外，得依前項規定請事假，並得擇定以小時為請假單位。",
    },
  ],

  payTreatment: { kind: "unpaid" },

  annualCap: {
    daysPerYear: 14,
    countingWindow: "calendar_year",
    overflowBehavior: "deny",
  },

  perfectAttendanceProtected: {
    protected: false,
    legalBasis:
      "勞工請假規則 第9條 (事假 not in protected list — exception: 家庭照顧假 per 第9條第1項第3款)",
    proportionalDeduction: true,
  },

  documentRequirement: {
    whenRequired: "employer discretion",
    documentType: "employer_discretion",
  },

  insuranceOffsetAllowed: false,
  countingUnits: ["days", "half_days"],

  notes: {
    zh: "本系統預設事假為無薪（勞基法最低標準）。各公司若欲將事假作為福利給薪，可於 leave_policy_config 設定 personalLeavePaidDays（0–14 日）。",
    en:
      "System default: 事假 is unpaid (LSA minimum). Companies offering paid 事假 as a benefit can configure personalLeavePaidDays (0–14 days) in leave_policy_config.",
  },
};

/**
 * 家庭照顧假 — Family Care Leave
 * ──────────────────────────────────────────────────────────────
 * Pay treatment is unpaid (treated as 事假) per 性別平等工作法
 * 第20條, BUT 全勤獎金 is protected (different from 事假).
 * Counts within the 14-day 事假 cap with a 7-day sub-cap.
 */
export const family_care_leave: LeaveTypeDefinition = {
  canonicalKey: "family_care_leave",
  canonicalNameZh: "家庭照顧假",
  canonicalNameEn: "Family Care Leave",
  aliases: [
    "家庭照顧假",
    "家庭照顧",
    "家庭",
    "family care",
    "family-care",
    "family care leave",
    "family",
  ],

  legalBasis: [
    {
      source: "GenderEquality",
      article: "第20條",
      url: "https://law.moj.gov.tw/LawClass/LawSingle.aspx?pcode=N0030014&flno=20",
      textZh:
        "受僱者於其家庭成員預防接種、發生嚴重之疾病或其他重大事故須親自照顧時，得請家庭照顧假；其請假日數併入事假計算，全年以七日為限。家庭照顧假薪資之計算，依各該事假相關規定辦理。",
    },
    {
      source: "LeaveRules",
      article: "第7條第2項",
      url: "https://law.moj.gov.tw/LawClass/LawSingle.aspx?pcode=N0030006&flno=7",
      textZh:
        "勞工為親自照顧家庭成員，除本法或其他法律另有規定者外，得依前項規定請事假，並得擇定以小時為請假單位。",
    },
  ],

  payTreatment: { kind: "unpaid" },

  annualCap: {
    daysPerYear: 7,
    countingWindow: "calendar_year",
    overflowBehavior: "merge_into_other_leave_type",
    specialNotes:
      "Counted within 事假's 14-day cap. After 7 days/year of 家庭照顧假, additional family-care requests must use plain 事假 (still unpaid, but loses 全勤獎金 protection).",
  },

  perfectAttendanceProtected: {
    protected: true,
    legalBasis:
      "勞工請假規則 第9條第1項第3款 + 性別平等工作法 第21條",
  },

  documentRequirement: null,
  insuranceOffsetAllowed: false,
  countingUnits: ["days", "hours"],

  notes: {
    zh: "家庭照顧假與事假薪資計算相同（預設無薪），但全勤獎金受保護。本系統會將該假別獨立分類，以便正確套用全勤獎金保護。各公司可透過 leave_policy_config.familyCareLeavePaid 將家庭照顧假設為有薪。",
    en:
      "Family care leave has the same pay treatment as 事假 (unpaid by default), but enjoys 全勤獎金 protection that 事假 does not. Engine classifies it separately to apply the protection correctly. Configurable to paid via leave_policy_config.familyCareLeavePaid.",
  },
};

/**
 * 婚假 — Marriage Leave
 * ──────────────────────────────────────────────────────────────
 * Already documented in Pass 1.
 */
export const marriage_leave: LeaveTypeDefinition = {
  canonicalKey: "marriage_leave",
  canonicalNameZh: "婚假",
  canonicalNameEn: "Marriage Leave",
  aliases: ["婚假", "marriage", "marriage leave", "wedding leave", "wedding"],

  legalBasis: [
    {
      source: "LeaveRules",
      article: "第2條",
      url: "https://law.moj.gov.tw/LawClass/LawSingle.aspx?pcode=N0030006&flno=2",
      textZh: "勞工結婚者給予婚假八日，工資照給。",
    },
  ],

  payTreatment: { kind: "full_pay" },

  annualCap: {
    daysPerYear: 8,
    countingWindow: "lifetime_per_event",
    overflowBehavior: "deny",
  },

  perfectAttendanceProtected: {
    protected: true,
    legalBasis: "勞工請假規則 第9條第1項第1款",
  },

  documentRequirement: {
    whenRequired: "always",
    documentType: "marriage_certificate",
  },

  insuranceOffsetAllowed: false,
  countingUnits: ["days"],

  notes: {
    zh: "婚假應自結婚日前 10 日起 3 個月內請畢；經雇主同意者，得於 1 年內請畢（勞動部 88 年函釋）。本系統不限制請假時程，由人資審核時自行確認是否符合期限。",
    en:
      "Marriage leave should be taken within 3 months from 10 days before the wedding date; with employer agreement, may extend to 1 year (Labor Ministry 1999 interpretation). The system does not enforce the timing window — HR confirms timing during approval.",
  },
};

/**
 * 喪假 — Bereavement Leave
 * ──────────────────────────────────────────────────────────────
 * Special: per-relation cap (8/6/3 days). The annualCap.daysPerYear
 * encodes the maximum (8); specialNotes documents per-relation
 * variations. The classifier returns this entry; the per-event
 * day allotment is determined by HR at request time, not by the
 * engine.
 */
export const bereavement_leave: LeaveTypeDefinition = {
  canonicalKey: "bereavement_leave",
  canonicalNameZh: "喪假",
  canonicalNameEn: "Bereavement Leave",
  aliases: ["喪假", "bereavement", "funeral", "mourning"],

  legalBasis: [
    {
      source: "LeaveRules",
      article: "第3條",
      url: "https://law.moj.gov.tw/LawClass/LawSingle.aspx?pcode=N0030006&flno=3",
      textZh:
        "勞工喪假依左列規定：一、父母、養父母、繼父母、配偶喪亡者，給予喪假八日，工資照給。二、祖父母、子女、配偶之父母、配偶之養父母或繼父母喪亡者，給予喪假六日，工資照給。三、曾祖父母、兄弟姊妹、配偶之祖父母喪亡者，給予喪假三日，工資照給。",
    },
  ],

  payTreatment: { kind: "full_pay" },

  annualCap: {
    daysPerYear: 8,
    countingWindow: "per_event",
    overflowBehavior: "deny",
    specialNotes:
      "Per-relation: 父母/配偶 = 8 days; 祖父母/子女/配偶之父母 = 6 days; 曾祖父母/兄弟姊妹/配偶之祖父母 = 3 days. Each death is a separate event.",
  },

  perfectAttendanceProtected: {
    protected: true,
    legalBasis: "勞工請假規則 第9條第1項第1款",
  },

  documentRequirement: {
    whenRequired: "always",
    documentType: "death_certificate",
  },

  insuranceOffsetAllowed: false,
  countingUnits: ["days", "half_days"],

  notes: {
    zh: "喪假日數依與亡者親屬關係而定（8/6/3 日）。本系統依 form_data 中之親屬關係欄位確定可請日數；若未填寫，預設為最大值 8 日，由人資審核時調整。",
    en:
      "Bereavement leave days depend on relationship to the deceased (8/6/3 days). Engine reads relationship from form_data; if missing, defaults to max 8 days for HR adjustment at approval.",
  },
};

/**
 * 普通傷病假（未住院）— Ordinary Sick Leave (Unhospitalized)
 * ──────────────────────────────────────────────────────────────
 * Already documented in Pass 1.
 */
export const sick_unhospitalized: LeaveTypeDefinition = {
  canonicalKey: "sick_unhospitalized",
  canonicalNameZh: "普通傷病假（未住院）",
  canonicalNameEn: "Ordinary Sick Leave (Unhospitalized)",
  aliases: [
    "病假",
    "病假 sick",
    "sick",
    "sick leave",
    "ordinary sick",
    "sick unhospitalized",
    "普通傷病假",
  ],

  legalBasis: [
    {
      source: "LeaveRules",
      article: "第4條",
      url: "https://law.moj.gov.tw/LawClass/LawSingle.aspx?pcode=N0030006&flno=4",
      textZh:
        "勞工因普通傷害、疾病或生理原因必須治療或休養者，得在左列規定範圍內請普通傷病假：一、未住院者，一年內合計不得超過三十日。二、住院者，二年內合計不得超過一年。三、未住院傷病假與住院傷病假二年內合計不得超過一年。經醫師診斷，罹患癌症（含原位癌）採門診方式治療或懷孕期間需安胎休養者，其治療或休養期間，併入住院傷病假計算。普通傷病假一年內未超過三十日部分，工資折半發給，其領有勞工保險普通傷病給付未達工資半數者，由雇主補足之。",
    },
    {
      source: "LSA",
      article: "第43條",
      url: "https://law.moj.gov.tw/LawClass/LawSingle.aspx?pcode=N0001000&flno=43",
      textZh:
        "勞工因婚、喪、疾病或其他正當事由得請假；請假應給之假期及事假以外期間內工資給付之最低標準，由中央主管機關定之。",
    },
    {
      source: "LeaveRules",
      article: "第10條",
      url: "https://law.moj.gov.tw/LawClass/LawSingle.aspx?pcode=N0030006&flno=10",
      textZh:
        "勞工請假時，應於事前親自以口頭或書面敘明請假理由及日數。但遇有急病或緊急事故，得委託他人代辦請假手續。辦理請假手續時，雇主得要求勞工提出有關證明文件。",
    },
  ],

  payTreatment: {
    kind: "half_pay_with_ytd_cap",
    capDays: 30,
    thenTreatment: { kind: "unpaid" },
  },

  annualCap: {
    daysPerYear: 30,
    countingWindow: "calendar_year",
    overflowBehavior: "become_unpaid_with_consent",
  },

  perfectAttendanceProtected: {
    protected: false,
    legalBasis: "勞工請假規則 第9條第2項",
    proportionalDeduction: true,
  },

  documentRequirement: {
    whenRequired: "consecutive >= 3 days",
    documentType: "medical_certificate",
  },

  insuranceOffsetAllowed: false,
  countingUnits: ["days", "half_days"],

  notes: {
    zh:
      "勞保普通傷病給付未達工資半數時，由雇主補足。實務上月薪制勞工請假當月，雇主先給半薪；勞保給付數月後到帳時，若不足半薪由雇主補差。本系統 v1 不處理勞保抵充記帳，由會計師於勞保給付到期後另行調整。",
    en:
      "When the employee receives 勞保 ordinary injury/sickness benefit less than half-wages, the employer must top up to half. Monthly-salaried employees typically receive employer half-pay first; the 勞保 benefit arrives months later, with employer covering any shortfall. Engine v1 does not perform 勞保 offset accounting — accountant adjusts when 勞保 disbursement arrives.",
  },
};

/**
 * 普通傷病假（住院）— Ordinary Sick Leave (Hospitalized)
 * ──────────────────────────────────────────────────────────────
 * Half pay, no 30-day half-pay cap. Cumulative cap of 1 year per
 * 2-year window (combined with unhospitalized portion).
 */
export const sick_hospitalized: LeaveTypeDefinition = {
  canonicalKey: "sick_hospitalized",
  canonicalNameZh: "普通傷病假（住院）",
  canonicalNameEn: "Ordinary Sick Leave (Hospitalized)",
  aliases: [
    "住院傷病假",
    "住院",
    "hospitalized sick",
    "inpatient sick",
    "hospitalized",
  ],

  legalBasis: [
    {
      source: "LeaveRules",
      article: "第4條",
      url: "https://law.moj.gov.tw/LawClass/LawSingle.aspx?pcode=N0030006&flno=4",
      textZh:
        "勞工因普通傷害、疾病或生理原因必須治療或休養者，得在左列規定範圍內請普通傷病假：一、未住院者，一年內合計不得超過三十日。二、住院者，二年內合計不得超過一年。三、未住院傷病假與住院傷病假二年內合計不得超過一年。經醫師診斷，罹患癌症（含原位癌）採門診方式治療或懷孕期間需安胎休養者，其治療或休養期間，併入住院傷病假計算。普通傷病假一年內未超過三十日部分，工資折半發給，其領有勞工保險普通傷病給付未達工資半數者，由雇主補足之。",
    },
    {
      source: "LeaveRules",
      article: "第5條",
      url: "https://law.moj.gov.tw/LawClass/LawSingle.aspx?pcode=N0030006&flno=5",
      textZh:
        "勞工普通傷病假超過前條第一項規定之期限，經以事假或特別休假抵充後仍未痊癒者，得予留職停薪。但留職停薪期間以一年為限。",
    },
  ],

  payTreatment: { kind: "half_pay" },

  annualCap: {
    daysPerYear: 365,
    countingWindow: "rolling_2_years",
    overflowBehavior: "become_unpaid_with_consent",
    specialNotes:
      "1 year cumulative cap within rolling 2-year window. Combined unhospitalized + hospitalized must not exceed 1 year per 2 years. Beyond cap → 留職停薪 per LeaveRules Art. 5.",
  },

  perfectAttendanceProtected: {
    protected: false,
    legalBasis: "勞工請假規則 第9條第2項",
    proportionalDeduction: true,
  },

  documentRequirement: {
    whenRequired: "always",
    documentType: "medical_certificate",
  },

  insuranceOffsetAllowed: false,
  countingUnits: ["days"],

  notes: {
    zh: "住院傷病假之半薪適用於整個假期（不受未住院傷病假之 30 日上限限制）。罹患癌症採門診治療或懷孕期間需安胎休養者，併入住院傷病假計算。",
    en:
      "Half-pay applies for the entire hospitalized sick leave period (no 30-day cap on the half-pay portion). Cancer outpatient treatment and pregnancy bedrest are counted under hospitalized sick leave per Art. 4.",
  },
};

/**
 * 公傷病假 — Occupational Injury Leave
 * ──────────────────────────────────────────────────────────────
 * Special: employer pays full salary indefinitely. Insurance offset
 * is permitted but deferred to v2 (per Doc A § 7.5).
 */
export const occupational_injury_leave: LeaveTypeDefinition = {
  canonicalKey: "occupational_injury_leave",
  canonicalNameZh: "公傷病假",
  canonicalNameEn: "Occupational Injury / Sickness Leave",
  aliases: [
    "公傷病假",
    "工傷假",
    "工傷",
    "公傷",
    "occupational injury",
    "work injury",
    "workplace injury",
  ],

  legalBasis: [
    {
      source: "LeaveRules",
      article: "第6條",
      url: "https://law.moj.gov.tw/LawClass/LawSingle.aspx?pcode=N0030006&flno=6",
      textZh: "勞工因職業災害而致失能、傷害或疾病者，其治療、休養期間，給予公傷病假。",
    },
    {
      source: "LSA",
      article: "第59條",
      url: "https://law.moj.gov.tw/LawClass/LawSingle.aspx?pcode=N0001000&flno=59",
      textZh:
        "勞工因遭遇職業災害而致死亡、失能、傷害或疾病時，雇主應依下列規定予以補償。但如同一事故，依勞工保險條例或其他法令規定，已由雇主支付費用補償者，雇主得予以抵充之：一、勞工受傷或罹患職業病時，雇主應補償其必需之醫療費用。二、勞工在醫療中不能工作時，雇主應按其原領工資數額予以補償。但醫療期間屆滿二年仍未能痊癒，經指定之醫院診斷，審定為喪失原有工作能力，且不合第三款之失能給付標準者，雇主得一次給付四十個月之平均工資後，免除此項工資補償責任。",
    },
  ],

  payTreatment: { kind: "employer_full_pay_with_insurance_offset" },

  annualCap: null, // No statutory cap — until medically discharged or LSA Art. 59 limit

  perfectAttendanceProtected: {
    protected: true,
    legalBasis: "勞工請假規則 第9條第1項第1款",
  },

  documentRequirement: {
    whenRequired: "always",
    documentType: "medical_certificate",
  },

  insuranceOffsetAllowed: true,
  countingUnits: ["days"],

  notes: {
    zh: "公傷病假期間雇主應按原領工資數額補償；勞保普通傷病給付到期後可依勞基法第 59 條規定抵充。本系統 v1 對公傷病假之扣款一律為 0（雇主全額支付），勞保抵充由會計師於給付到期後另行調整。預期最長 2 年內治療期間。",
    en:
      "During 公傷病假, employer pays original wages; 勞保 ordinary injury/sickness benefit can offset per LSA Art. 59 once disbursed. Engine v1 always returns zero deduction for 公傷病假 (employer pays full salary); accountant handles 勞保 offset reconciliation when benefit disbursement arrives. Treatment typically up to 2 years.",
  },
};

/**
 * 安胎休養假 — Pregnancy Rest Leave (Doctor-Ordered)
 * ──────────────────────────────────────────────────────────────
 * Treated as 住院傷病假 per 勞動部 函釋. Half pay. Cap counted
 * under 住院傷病假's window.
 */
export const pregnancy_rest_leave: LeaveTypeDefinition = {
  canonicalKey: "pregnancy_rest_leave",
  canonicalNameZh: "安胎休養假",
  canonicalNameEn: "Pregnancy Rest Leave (Doctor-Ordered)",
  aliases: [
    "安胎休養",
    "安胎假",
    "安胎",
    "pregnancy rest",
    "bedrest",
    "pregnancy bedrest",
  ],

  legalBasis: [
    {
      source: "GenderEquality",
      article: "第15條第3項",
      url: "https://law.moj.gov.tw/LawClass/LawSingle.aspx?pcode=N0030014&flno=15",
      textZh:
        "受僱者經醫師診斷需安胎休養者，其治療、照護或休養期間之請假及薪資計算，依相關法令之規定。",
    },
    {
      source: "LeaveRules",
      article: "第4條",
      url: "https://law.moj.gov.tw/LawClass/LawSingle.aspx?pcode=N0030006&flno=4",
      textZh:
        "經醫師診斷，罹患癌症（含原位癌）採門診方式治療或懷孕期間需安胎休養者，其治療或休養期間，併入住院傷病假計算。",
    },
  ],

  payTreatment: { kind: "half_pay" },

  annualCap: {
    daysPerYear: 365,
    countingWindow: "rolling_2_years",
    overflowBehavior: "become_unpaid_with_consent",
    specialNotes:
      "Counted under 住院傷病假's 1 year per 2 years cap (per LeaveRules Art. 4 explicit reference).",
  },

  perfectAttendanceProtected: {
    protected: true,
    legalBasis: "性別平等工作法 第21條",
  },

  documentRequirement: {
    whenRequired: "always",
    documentType: "medical_certificate",
  },

  insuranceOffsetAllowed: false,
  countingUnits: ["days"],

  notes: {
    zh: "安胎休養假依勞動部函釋，併入住院傷病假計算（半薪），且受性別平等工作法第 21 條全勤獎金保護。需檢附醫師診斷證明書。",
    en:
      "Per 勞動部 interpretation, pregnancy rest leave is counted under hospitalized sick leave (half pay) and enjoys 全勤獎金 protection per GEAW Art. 21. Medical certificate required.",
  },
};

/**
 * 生理假 — Menstrual Leave
 * ──────────────────────────────────────────────────────────────
 * Critical edge case: first 3 days/year are SEPARATE from 病假;
 * days 4+ count INTO the 病假 30-day cap. Both buckets pay half.
 *
 * The classifier returns this canonical entry; the YTD cap engine
 * (Phase 3b ytdCaps.ts) handles the bucket merging logic per
 * Doc A § 7.6.
 */
export const menstrual_leave: LeaveTypeDefinition = {
  canonicalKey: "menstrual_leave",
  canonicalNameZh: "生理假",
  canonicalNameEn: "Menstrual Leave",
  aliases: ["生理假", "menstrual", "menstrual leave", "生理"],

  legalBasis: [
    {
      source: "GenderEquality",
      article: "第14條",
      url: "https://law.moj.gov.tw/LawClass/LawSingle.aspx?pcode=N0030014&flno=14",
      textZh:
        "女性受僱者因生理日致工作有困難者，每月得請生理假一日，全年請假日數未逾三日，不併入病假計算，其餘日數併入病假計算。前項併入及不併入病假之生理假薪資，減半發給。",
    },
    {
      source: "MOLInterpretation",
      article: "勞動條4字第1040131594號令 (104年9月8日)",
      url: "https://www.mol.gov.tw/1607/1632/1640/19589/post",
      textZh:
        "受僱者年度內所請併入病假之生理假連同病假之日數，已屆受僱者所適用相關法令所定病假之日數上限者，如年度內仍有請生理假之需求時，雇主應給假，但得不給薪。",
    },
  ],

  // Three-bucket structure per GEAW Art. 14 + 勞動部 函釋 1040131594:
  //   Bucket 1 (first 3 days/year): half pay, separate from sick cap
  //   Bucket 2 (days 4+, within shared 30-day cap): half pay, merges into sick cap
  //   Bucket 3 (beyond shared cap): unpaid (employer "得不給薪")
  payTreatment: {
    kind: "menstrual_leave_treatment",
    separateBucketDays: 3,
    sharedCapDays: 30,
    thenTreatment: { kind: "unpaid" },
  },

  annualCap: {
    daysPerYear: 12, // 1/month × 12 months
    countingWindow: "calendar_year",
    overflowBehavior: "deny",
    specialNotes:
      "Three-bucket structure: first 3 days/year separate from 病假 (half pay); days 4+ count INTO 病假 30-day cap (half pay); beyond combined 33-day ceiling, employer may pay nothing per 勞動部 函釋 勞動條4字第1040131594號. ytdCaps.ts merges menstrual overflow into sickHalfPayDaysUsed; payTreatment.ts applies the three-bucket pay logic.",
  },

  perfectAttendanceProtected: {
    protected: true,
    legalBasis: "性別平等工作法 第21條",
  },

  documentRequirement: null, // 勞委會 80年函釋: no certificate required
  insuranceOffsetAllowed: false,
  countingUnits: ["days"], // 1 calendar day per request

  notes: {
    zh: "生理假三段結構：每年前 3 日不併入病假計算（獨立計算，半薪），第 4 日起併入病假之 30 日上限（半薪）；33 日合計上限耗盡後，雇主仍應給假，但得不給薪（勞動部函釋 勞動條4字第1040131594號令）。依勞委會 80 年函釋，生理假無需檢附醫師證明。",
    en:
      "Menstrual leave three-bucket structure: (1) first 3 days/year separate from sick leave (half pay); (2) days 4+ counted toward sick leave 30-day cap (half pay); (3) beyond the combined 33-day ceiling, employer must still grant the leave but may pay nothing per MOL Interpretation Letter 1040131594. Per Labor Council 1991 interpretation, no medical certificate required.",
  },
};

/**
 * 產假 — Maternity Leave
 * ──────────────────────────────────────────────────────────────
 * Tenure-dependent pay: ≥6 months tenure → full pay; <6 months
 * → half pay. Calendar-day counting (8 weeks = 56 calendar days).
 * Includes miscarriage variants per GEAW Art. 15.
 */
export const maternity_leave: LeaveTypeDefinition = {
  canonicalKey: "maternity_leave",
  canonicalNameZh: "產假",
  canonicalNameEn: "Maternity Leave",
  aliases: ["產假", "maternity", "maternity leave", "生產假"],

  legalBasis: [
    {
      source: "GenderEquality",
      article: "第15條第1項",
      url: "https://law.moj.gov.tw/LawClass/LawSingle.aspx?pcode=N0030014&flno=15",
      textZh:
        "雇主於女性受僱者分娩前後，應使其停止工作，給予產假八星期；妊娠三個月以上流產者，應使其停止工作，給予產假四星期；妊娠二個月以上未滿三個月流產者，應使其停止工作，給予產假一星期；妊娠未滿二個月流產者，應使其停止工作，給予產假五日。",
    },
    {
      source: "LSA",
      article: "第50條",
      url: "https://law.moj.gov.tw/LawClass/LawSingle.aspx?pcode=N0001000&flno=50",
      textZh:
        "女工分娩前後，應停止工作，給予產假八星期；妊娠三個月以上流產者，應停止工作，給予產假四星期。前項女工受僱工作在六個月以上者，停止工作期間工資照給；未滿六個月者減半發給。",
    },
  ],

  payTreatment: {
    kind: "tenure_dependent",
    ifTenureMonthsAtLeast: 6,
    thenFullPay: true,
    elseHalfPay: true,
  },

  annualCap: {
    daysPerYear: 56, // 8 weeks normal; smaller for miscarriage
    countingWindow: "per_event",
    overflowBehavior: "deny",
    specialNotes:
      "Per pregnancy event: normal birth = 8 weeks (56 calendar days); miscarriage ≥3mo = 4 weeks; miscarriage 2-3mo = 1 week; miscarriage <2mo = 5 days. CALENDAR DAYS continuous, not work days.",
  },

  perfectAttendanceProtected: {
    protected: true,
    legalBasis: "性別平等工作法 第21條",
  },

  documentRequirement: {
    whenRequired: "always",
    documentType: "child_birth_certificate",
  },

  insuranceOffsetAllowed: false,
  countingUnits: ["days"], // calendar days

  notes: {
    zh: "產假以「曆日」連續計算（依勞動部 82年函釋及性別平等工作法施行細則第 6 條），含週末及國定假日。受僱工作未滿六個月者，產假薪資減半發給（勞動基準法第 50 條）。妊娠未滿三個月流產之產假（一週/五日），勞基法無明文薪資規定，雇主無給薪義務但不得影響全勤獎金。",
    en:
      "Maternity leave is calculated in CALENDAR DAYS continuously (per Labor Ministry 1993 interpretation and GEAW Implementation Rule Art. 6), including weekends and holidays. Employees with <6 months tenure receive half pay (LSA Art. 50). For miscarriages under 3 months, LSA does not specify pay; employer has no salary obligation but cannot affect 全勤獎金.",
  },
};

/**
 * 陪產檢及陪產假 — Paternity and Prenatal Check Leave (combined)
 * ──────────────────────────────────────────────────────────────
 * Renamed from 陪產假 in 民國 111 年 amendment. 7 days total,
 * employee chooses split between prenatal-check support and
 * post-birth.
 */
export const paternity_leave: LeaveTypeDefinition = {
  canonicalKey: "paternity_leave",
  canonicalNameZh: "陪產檢及陪產假",
  canonicalNameEn: "Paternity and Prenatal Check Leave (combined)",
  aliases: [
    "陪產假",
    "陪產檢及陪產假",
    "陪產檢",
    "陪產",
    "paternity",
    "paternity leave",
    "prenatal check support",
  ],

  legalBasis: [
    {
      source: "GenderEquality",
      article: "第15條第5項",
      url: "https://law.moj.gov.tw/LawClass/LawSingle.aspx?pcode=N0030014&flno=15",
      textZh:
        "受僱者陪伴其配偶妊娠產檢或其配偶分娩時，雇主應給予陪產檢及陪產假七日。",
    },
    {
      source: "GenderEquality",
      article: "第15條第6項",
      url: "https://law.moj.gov.tw/LawClass/LawSingle.aspx?pcode=N0030014&flno=15",
      textZh: "產檢假、陪產檢及陪產假期間，薪資照給。",
    },
  ],

  payTreatment: { kind: "full_pay" },

  annualCap: {
    daysPerYear: 7,
    countingWindow: "per_event",
    overflowBehavior: "deny",
    specialNotes:
      "7 days total per pregnancy event. Employee chooses split between prenatal-check support (during spouse's pregnancy) and post-birth (around delivery).",
  },

  perfectAttendanceProtected: {
    protected: true,
    legalBasis: "性別平等工作法 第21條",
  },

  documentRequirement: {
    whenRequired: "always",
    documentType: "spouse_pregnancy_proof",
  },

  insuranceOffsetAllowed: false,
  countingUnits: ["days", "half_days", "hours"],

  notes: {
    zh: "民國 111 年修法將原「陪產假」更名為「陪產檢及陪產假」，並由 5 日增為 7 日。受僱者可於配偶懷孕產檢及分娩前後總共 7 日內自行分配。雇主就其中超過 5 日部分之薪資得向中央主管機關申請補助。",
    en:
      "民國 111 年 (2022) amendment renamed 陪產假 to 陪產檢及陪產假 and increased it from 5 to 7 days. Employee can split the 7 days between spouse's prenatal checks and post-birth. Employer may apply to the central authority for reimbursement of salary for days exceeding 5.",
  },
};

/**
 * 產檢假 — Prenatal Check Leave
 * ──────────────────────────────────────────────────────────────
 * For the pregnant employee herself, distinct from 陪產檢及陪產假
 * (which is for the spouse). 7 days per pregnancy.
 */
export const prenatal_check_leave: LeaveTypeDefinition = {
  canonicalKey: "prenatal_check_leave",
  canonicalNameZh: "產檢假",
  canonicalNameEn: "Prenatal Check Leave",
  aliases: ["產檢假", "產檢", "prenatal check", "prenatal exam"],

  legalBasis: [
    {
      source: "GenderEquality",
      article: "第15條第4項",
      url: "https://law.moj.gov.tw/LawClass/LawSingle.aspx?pcode=N0030014&flno=15",
      textZh: "受僱者妊娠期間，雇主應給予產檢假七日。",
    },
    {
      source: "GenderEquality",
      article: "第15條第6項",
      url: "https://law.moj.gov.tw/LawClass/LawSingle.aspx?pcode=N0030014&flno=15",
      textZh: "產檢假、陪產檢及陪產假期間，薪資照給。",
    },
  ],

  payTreatment: { kind: "full_pay" },

  annualCap: {
    daysPerYear: 7,
    countingWindow: "per_event",
    overflowBehavior: "deny",
    specialNotes:
      "Per pregnancy event. May be requested in half-day or hour increments per Labor Ministry interpretation. Distinct from 陪產檢及陪產假 (which is for the spouse).",
  },

  perfectAttendanceProtected: {
    protected: true,
    legalBasis: "性別平等工作法 第21條",
  },

  documentRequirement: {
    whenRequired: "always",
    documentType: "pregnancy_diagnosis",
  },

  insuranceOffsetAllowed: false,
  countingUnits: ["days", "half_days", "hours"],

  notes: {
    zh: "產檢假為孕婦本人之假別，與配偶之陪產檢及陪產假不同。可以半日或小時為單位請假（勞動部 函釋）。",
    en:
      "Prenatal check leave is for the pregnant employee herself, distinct from the spouse's 陪產檢及陪產假. May be requested in half-days or hours per Labor Ministry interpretation.",
  },
};

/**
 * 公假 — Official Leave
 * ──────────────────────────────────────────────────────────────
 * ALWAYS full pay. Employer cannot reduce — this is a hard rule
 * the engine enforces (configuration cannot override).
 */
export const official_leave: LeaveTypeDefinition = {
  canonicalKey: "official_leave",
  canonicalNameZh: "公假",
  canonicalNameEn: "Official Leave",
  aliases: [
    "公假",
    "official leave",
    "official duty",
    "official",
    "civic duty",
    "jury duty",
  ],

  legalBasis: [
    {
      source: "LeaveRules",
      article: "第8條",
      url: "https://law.moj.gov.tw/LawClass/LawSingle.aspx?pcode=N0030006&flno=8",
      textZh: "勞工依法令規定應給予公假者，工資照給，其假期視實際需要定之。",
    },
  ],

  payTreatment: { kind: "full_pay" },

  annualCap: null, // No cap — per occurrence, as long as legally required

  perfectAttendanceProtected: {
    protected: true,
    legalBasis: "勞工請假規則 第9條第1項第1款",
  },

  documentRequirement: {
    whenRequired: "always",
    documentType: "official_summons",
  },

  insuranceOffsetAllowed: false,
  countingUnits: ["days", "half_days"],

  notes: {
    zh: "公假事由須依法令規定（如兵役法、性別平等工作法第 27 條訴訟出庭、勞資會議出席等）。雇主一律給薪，且不得以員工從政府所獲補助（如役男薪餉、出庭費用）抵充薪資。本系統將任何試圖對公假扣款之設定視為違法並拒絕執行。",
    en:
      "Official leave grounds must be statutorily defined (e.g., military service per 兵役法, court testimony per GEAW Art. 27, labor-management meetings, etc.). Employer must always pay full salary and cannot offset against any government compensation the employee receives (military stipend, court appearance fees). The engine rejects any configuration attempting to reduce 公假 pay as legally invalid.",
  },
};

/**
 * 補休 — Compensatory Time Off
 * ──────────────────────────────────────────────────────────────
 * Special: substitutes worked overtime. Engine never deducts
 * for 補休 (the underlying OT was already paid). Validation must
 * ensure 補休 hours don't exceed accrued OT balance.
 */
export const comp_time: LeaveTypeDefinition = {
  canonicalKey: "comp_time",
  canonicalNameZh: "補休",
  canonicalNameEn: "Compensatory Time Off",
  aliases: ["補休", "comp", "comp time", "compensatory", "換休", "調休"],

  legalBasis: [
    {
      source: "LSA",
      article: "第32條之1",
      url: "https://law.moj.gov.tw/LawClass/LawSingle.aspx?pcode=N0001000&flno=32-1",
      textZh:
        "雇主依第三十二條第一項及第二項規定使勞工延長工作時間，或使勞工於第三十六條所定休息日工作後，依勞工意願選擇補休並經雇主同意者，應依勞工工作之時數計算補休時數。前項之補休，其補休期限由勞雇雙方協商；補休期限屆期或契約終止未補休之時數，應依延長工作時間或休息日工作當日之工資計算標準發給工資；未發給工資者，依違反第二十四條規定論處。",
    },
  ],

  payTreatment: { kind: "full_pay" },

  annualCap: null, // Limited by accrued OT balance, not a statutory cap

  perfectAttendanceProtected: {
    protected: true,
    legalBasis: "Treated as scheduled time off (employee was paid for the underlying OT)",
  },

  documentRequirement: null, // Sourced from attendance_records.overtime_hours

  insuranceOffsetAllowed: false,
  countingUnits: ["hours", "days"],

  notes: {
    zh: "補休為勞工選擇將加班時數轉為休假時數，引擎不對補休扣款（員工已就原加班時數獲薪）。但須驗證補休時數不超過累計加班餘額。補休期限屆期未補休之時數應發給加班費。",
    en:
      "Compensatory time off is the employee's choice to convert worked overtime hours into leave hours. Engine does not deduct for 補休 (employee was already paid for the underlying overtime). Must validate 補休 hours do not exceed accrued OT balance. Unused 補休 at expiry must be paid out as overtime wages.",
  },
};

/**
 * 育嬰留職停薪 — Parental Leave (Unpaid Employment Suspension)
 * ──────────────────────────────────────────────────────────────
 * Already documented in Pass 1.
 */
export const parental_leave: LeaveTypeDefinition = {
  canonicalKey: "parental_leave",
  canonicalNameZh: "育嬰留職停薪",
  canonicalNameEn: "Parental Leave (Unpaid Employment Suspension)",
  aliases: [
    "育嬰留停",
    "育嬰假",
    "育嬰留職停薪",
    "育嬰",
    "parental leave",
    "parental",
    "childcare leave",
  ],

  legalBasis: [
    {
      source: "GenderEquality",
      article: "第16條",
      url: "https://law.moj.gov.tw/LawClass/LawSingle.aspx?pcode=N0030014&flno=16",
      textZh:
        "受僱者任職滿六個月後，於每一子女滿三歲前，得申請育嬰留職停薪，期間至該子女滿三歲止，但不得逾二年。同時撫育子女二人以上者，其育嬰留職停薪期間應合併計算，最長以最幼子女受撫育二年為限。",
    },
  ],

  payTreatment: { kind: "skip_from_payroll" },

  annualCap: {
    daysPerYear: 730, // up to 2 years per child, in days
    countingWindow: "lifetime_per_event",
    overflowBehavior: "deny",
  },

  perfectAttendanceProtected: {
    protected: true,
    legalBasis: "性別平等工作法 第21條",
  },

  documentRequirement: {
    whenRequired: "always",
    documentType: "child_birth_certificate",
  },

  insuranceOffsetAllowed: false,
  countingUnits: ["days"],

  notes: {
    zh: "育嬰留職停薪期間員工為「停薪」狀態，非一般請假。本系統處理方式：runPayroll 階段須檢查員工是否處於 parental_leave 狀態，若是則完全跳過該員工之薪資計算（不計算應發、不計算扣款、不產生薪資單）。員工於停薪期間之勞保育嬰留職停薪津貼由就業保險另行給付，不在本系統處理範圍內。",
    en:
      "During parental leave, the employee is in 'suspended employment' status, not regular leave. System handling: runPayroll must check whether the employee is in parental_leave status and, if so, skip the employee entirely from payroll calculation (no gross, no deductions, no payslip). The employee's 勞保 parental leave subsidy is paid separately by employment insurance and is outside this system's scope.",
  },
};

// ──────────────────────────────────────────────────────────────────────
// Index of all entries
// ──────────────────────────────────────────────────────────────────────
//
// Order: roughly mirrors Doc A § 2.4 for ease of cross-reference.
// All 16 leave types Atlas EIP supports in Phase 3 are listed here.

export const leaveOntology: readonly LeaveTypeDefinition[] = [
  annual_leave,
  personal_leave,
  family_care_leave,
  sick_unhospitalized,
  sick_hospitalized,
  occupational_injury_leave,
  pregnancy_rest_leave,
  menstrual_leave,
  marriage_leave,
  bereavement_leave,
  maternity_leave,
  paternity_leave,
  prenatal_check_leave,
  official_leave,
  comp_time,
  parental_leave,
] as const;

/**
 * Returns all canonical keys currently defined in the ontology.
 * Used by tests to assert coverage and by the agent layer to validate
 * that no out-of-ontology key is referenced.
 */
export function getAllCanonicalKeys(): string[] {
  return leaveOntology.map((entry) => entry.canonicalKey);
}

/**
 * Looks up a leave type definition by canonical key.
 * Returns undefined if no entry matches.
 *
 * NOTE: Callers should NOT use this for classification (resolving a
 * raw leave_type string). Use leaveClassifier.ts for that, which
 * handles aliases, ambiguity, and unclassified cases.
 */
export function getLeaveDefinitionByKey(
  canonicalKey: string,
): LeaveTypeDefinition | undefined {
  return leaveOntology.find((entry) => entry.canonicalKey === canonicalKey);
}

// ──────────────────────────────────────────────────────────────────────
// Sanity assertions (run at module load to catch authoring mistakes)
// ──────────────────────────────────────────────────────────────────────
//
// These checks fire ONCE at import time. They validate properties that
// any well-formed ontology must satisfy. If any fails, you have a bug
// in this file before any code runs.

(function validateOntology() {
  // 1. No duplicate canonical keys
  const keys = new Set<string>();
  for (const entry of leaveOntology) {
    if (keys.has(entry.canonicalKey)) {
      throw new Error(
        `[leaveOntology] Duplicate canonicalKey: ${entry.canonicalKey}`,
      );
    }
    keys.add(entry.canonicalKey);
  }

  // 2. Every entry has at least one citation
  for (const entry of leaveOntology) {
    if (entry.legalBasis.length === 0) {
      throw new Error(
        `[leaveOntology] Entry ${entry.canonicalKey} has no legal basis. Every leave type must cite at least one source.`,
      );
    }
  }

  // 3. Every citation has non-empty verbatim text
  for (const entry of leaveOntology) {
    for (const citation of entry.legalBasis) {
      if (!citation.textZh || citation.textZh.trim().length < 10) {
        throw new Error(
          `[leaveOntology] Entry ${entry.canonicalKey} has empty or too-short citation text for ${citation.source} ${citation.article}.`,
        );
      }
    }
  }

  // 4. Aliases are non-empty
  for (const entry of leaveOntology) {
    if (entry.aliases.length === 0) {
      throw new Error(
        `[leaveOntology] Entry ${entry.canonicalKey} has no aliases. Provide at least one.`,
      );
    }
  }

  // 5. Insurance offset is true ONLY for occupational_injury_leave
  for (const entry of leaveOntology) {
    if (entry.insuranceOffsetAllowed && entry.canonicalKey !== "occupational_injury_leave") {
      throw new Error(
        `[leaveOntology] Entry ${entry.canonicalKey} has insuranceOffsetAllowed=true; only occupational_injury_leave should.`,
      );
    }
  }

  // 6. No two entries share the same alias (after normalization).
  //    Rationale: If two entries have an identical alias, an input
  //    matching exactly that alias would match BOTH entries, the
  //    specificity-resolution step in leaveClassifier (which prefers
  //    longer-substring matches) cannot break the tie because the
  //    matched aliases are identical, and the classifier returns
  //    `ambiguous`. The correctness of the classifier therefore
  //    depends on this invariant, and the consequence of violating
  //    it is silent breakage of a previously-working classification.
  //    This validator catches the bug at module-load time so that
  //    a future ontology contributor cannot ship an unintended
  //    cross-entry alias collision.
  const aliasOwnership = new Map<string, string>();
  for (const entry of leaveOntology) {
    for (const alias of entry.aliases) {
      const normalized = alias.trim().toLowerCase();
      const existingOwner = aliasOwnership.get(normalized);
      if (existingOwner && existingOwner !== entry.canonicalKey) {
        throw new Error(
          `[leaveOntology] Duplicate alias "${alias}" found in both ` +
            `${existingOwner} and ${entry.canonicalKey}. Aliases must be ` +
            `unique across entries — otherwise the classifier silently ` +
            `returns ambiguous for inputs matching this alias.`,
        );
      }
      aliasOwnership.set(normalized, entry.canonicalKey);
    }
  }
})();
