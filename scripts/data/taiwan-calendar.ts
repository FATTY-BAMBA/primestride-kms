// scripts/data/taiwan-calendar.ts
//
// Atlas EIP — Taiwan Calendar Seed Data
// ──────────────────────────────────────────────────────────────────────
// Authoritative 行政院人事行政總處 (DGPA) 行事曆 entries for 2024–2026.
//
// SOURCE OF TRUTH: 行政院 published 政府行政機關辦公日曆表
//   2024 (113年): https://www.dgpa.gov.tw/information?uid=82&pid=11398
//   2025 (114年): https://www.dgpa.gov.tw/information?uid=30&pid=12572
//                 (revised after 2025-05-28 +3 holidays via 紀念日及節日實施條例)
//   2026 (115年): https://www.dgpa.gov.tw/information?uid=30&pid=12685
//                 (published 2025-06-13)
//
// Each entry:
//   - is one row that becomes a non-default calendar day
//   - cites the specific DGPA page in source_url
//   - has is_working_day consistent with day_type (validated by seed script)
//
// DEFAULT (rows omitted from this list):
//   - Mon-Fri = workday
//   - Saturday = 休息日 (rest day, not working)
//   - Sunday = 例假 (mandatory rest day, not working)
//
// We only encode EXCEPTIONS to that default. A typical date like
// 2026-04-15 (Wednesday) has no row here and defaults to "workday."
//
// ANNUAL UPDATE PROCESS:
//   - DGPA publishes next year's calendar by June 30 of current year
//     (or by August 31 with special exception)
//   - In June/July of each year, add the next year's entries below
//   - Keep entries for past years (audit trail for back-corrections)
//   - Update updateProcess() jsdoc with new-year reference URL
//
// WorkingDayService throws TaiwanCalendarMissingDataError on queries
// for years not present here. That's the alert mechanism — fail loud
// rather than silently miscalculate.
//
// 2025 REFORM NOTE (effective 2025-06-13):
//   The 紀念日及節日實施條例 amendment removed all 補班日 (catch-up workdays)
//   for 2026+. Pre-reform years (2024, 2025) still have adjustment_workday
//   entries because that was the rule then.

export type CalendarDayInput = {
  date: string;              // 'YYYY-MM-DD'
  day_type:
    | "national_holiday"
    | "compensatory_off"
    | "adjustment_workday"
    | "memorial_day"
    | "typhoon_day"
    | "regular_workday";
  is_working_day: boolean;
  name_zh: string;
  name_en: string;
  notes?: string;
  source_url: string;
  source_published_at?: string;
};

// ── 2024 (民國113年) ─────────────────────────────────────────────────
// Total non-working days: 115. 4 long weekends.
// Special: ONE adjustment_workday (Feb 17 Sat to compensate for Feb 8 除夕前一日).

export const TAIWAN_CALENDAR_2024: CalendarDayInput[] = [
  // 元旦 — Mon Jan 1
  {
    date: "2024-01-01",
    day_type: "national_holiday",
    is_working_day: false,
    name_zh: "中華民國開國紀念日（元旦）",
    name_en: "Republic of China Founding Day (New Year's Day)",
    source_url: "https://www.dgpa.gov.tw/information?uid=82&pid=11398",
    source_published_at: "2023-05-19",
  },

  // 春節期間 — 除夕前一日 was 2/8 (Thu, normally workday) but flexed to off
  {
    date: "2024-02-08",
    day_type: "compensatory_off",
    is_working_day: false,
    name_zh: "農曆除夕前一日（彈性放假）",
    name_en: "Lunar New Year's Eve – 1 (flexed to off)",
    notes:
      "除夕前一日 (Thu) flexed to off; compensated by adjustment_workday on 2024-02-17 (Sat).",
    source_url: "https://www.dgpa.gov.tw/information?uid=82&pid=11398",
  },
  // 除夕 Fri 2/9
  {
    date: "2024-02-09",
    day_type: "national_holiday",
    is_working_day: false,
    name_zh: "農曆除夕",
    name_en: "Lunar New Year's Eve",
    source_url: "https://www.dgpa.gov.tw/information?uid=82&pid=11398",
  },
  // 春節 初一 Sat 2/10 — also weekend default but explicitly a holiday
  {
    date: "2024-02-10",
    day_type: "national_holiday",
    is_working_day: false,
    name_zh: "春節（農曆正月初一）",
    name_en: "Lunar New Year Day 1",
    source_url: "https://www.dgpa.gov.tw/information?uid=82&pid=11398",
  },
  // 初二 Sun 2/11
  {
    date: "2024-02-11",
    day_type: "national_holiday",
    is_working_day: false,
    name_zh: "春節（農曆正月初二）",
    name_en: "Lunar New Year Day 2",
    source_url: "https://www.dgpa.gov.tw/information?uid=82&pid=11398",
  },
  // 初三 Mon 2/12
  {
    date: "2024-02-12",
    day_type: "national_holiday",
    is_working_day: false,
    name_zh: "春節（農曆正月初三）",
    name_en: "Lunar New Year Day 3",
    source_url: "https://www.dgpa.gov.tw/information?uid=82&pid=11398",
  },
  // 春節補假 — 初一 (Sat) and 初二 (Sun) fell on weekend → 2/13, 2/14 補假
  {
    date: "2024-02-13",
    day_type: "compensatory_off",
    is_working_day: false,
    name_zh: "春節補假（初一補）",
    name_en: "Lunar New Year Day 1 (compensatory)",
    notes: "Initial 初一 fell on Saturday 2/10; compensatory off granted.",
    source_url: "https://www.dgpa.gov.tw/information?uid=82&pid=11398",
  },
  {
    date: "2024-02-14",
    day_type: "compensatory_off",
    is_working_day: false,
    name_zh: "春節補假（初二補）",
    name_en: "Lunar New Year Day 2 (compensatory)",
    notes: "Initial 初二 fell on Sunday 2/11; compensatory off granted.",
    source_url: "https://www.dgpa.gov.tw/information?uid=82&pid=11398",
  },
  // 補班 Sat 2/17 — to compensate for 2/8 being given off
  {
    date: "2024-02-17",
    day_type: "adjustment_workday",
    is_working_day: true,
    name_zh: "補行上班（春節彈性放假補班）",
    name_en: "Adjustment workday (compensating Lunar NY flex-off)",
    notes:
      "Compensates for 2024-02-08 being flexed off. Pre-2025 reform; this rule no longer applies for 2026+.",
    source_url: "https://www.dgpa.gov.tw/information?uid=82&pid=11398",
  },

  // 228 和平紀念日 — Wed Feb 28
  {
    date: "2024-02-28",
    day_type: "national_holiday",
    is_working_day: false,
    name_zh: "和平紀念日",
    name_en: "Peace Memorial Day (228)",
    source_url: "https://www.dgpa.gov.tw/information?uid=82&pid=11398",
  },

  // 兒童節 + 民族掃墓節 — same day this year (Thu Apr 4 → 兒童節 Wed Apr 3 + 清明 Thu Apr 4)
  // Per 紀念日及節日實施辦法: when 兒童節 and 民族掃墓節 fall on same day,
  // 兒童節 moves to PREVIOUS day. 2024: 清明 was 4/4 Thu. So 兒童節 → 4/3 Wed.
  {
    date: "2024-04-03",
    day_type: "national_holiday",
    is_working_day: false,
    name_zh: "兒童節",
    name_en: "Children's Day",
    notes:
      "Moved to 4/3 because Children's Day and Tomb Sweeping Day fell on the same day (4/4).",
    source_url: "https://www.dgpa.gov.tw/information?uid=82&pid=11398",
  },
  {
    date: "2024-04-04",
    day_type: "national_holiday",
    is_working_day: false,
    name_zh: "民族掃墓節（清明節）",
    name_en: "Tomb Sweeping Day",
    source_url: "https://www.dgpa.gov.tw/information?uid=82&pid=11398",
  },
  // 4/5 Fri — bridge day to weekend (this was added per 行事曆 for long weekend)
  {
    date: "2024-04-05",
    day_type: "compensatory_off",
    is_working_day: false,
    name_zh: "兒童節及民族掃墓節彈性放假",
    name_en: "Children's & Tomb Sweeping bridge day",
    notes:
      "Extended for long weekend connecting 4/4 Thu holiday to 4/6-4/7 weekend.",
    source_url: "https://www.dgpa.gov.tw/information?uid=82&pid=11398",
  },

  // 勞動節 — Wed May 1 (pre-2025 reform: gov workers DID NOT get this off,
  // but private sector DID per LSA Art. 37). Atlas EIP serves private sector.
  {
    date: "2024-05-01",
    day_type: "national_holiday",
    is_working_day: false,
    name_zh: "勞動節",
    name_en: "Labor Day",
    notes:
      "Pre-2025 reform: 勞動節 was a 勞工 holiday only (private sector). Government workers did NOT get this off until 2026 reform.",
    source_url: "https://www.mol.gov.tw/",
  },

  // 端午節 — Mon Jun 10 (luna 5/5)
  {
    date: "2024-06-10",
    day_type: "national_holiday",
    is_working_day: false,
    name_zh: "端午節",
    name_en: "Dragon Boat Festival",
    source_url: "https://www.dgpa.gov.tw/information?uid=82&pid=11398",
  },

  // 中秋節 — Tue Sep 17 (luna 8/15)
  {
    date: "2024-09-17",
    day_type: "national_holiday",
    is_working_day: false,
    name_zh: "中秋節",
    name_en: "Mid-Autumn Festival",
    source_url: "https://www.dgpa.gov.tw/information?uid=82&pid=11398",
  },

  // 國慶日 — Thu Oct 10
  {
    date: "2024-10-10",
    day_type: "national_holiday",
    is_working_day: false,
    name_zh: "國慶日",
    name_en: "National Day (Double Tenth)",
    source_url: "https://www.dgpa.gov.tw/information?uid=82&pid=11398",
  },
];

// ── 2025 (民國114年) ─────────────────────────────────────────────────
// Total non-working days: 115 (after 5/28 amendment adding 3 more holidays).
// Special: ONE adjustment_workday (Feb 8 Sat to compensate for Jan 27 除夕前一日).
// Mid-year reform added: 9/28 教師節, 10/25 光復節, 12/25 行憲紀念日.

export const TAIWAN_CALENDAR_2025: CalendarDayInput[] = [
  // 元旦 — Wed Jan 1
  {
    date: "2025-01-01",
    day_type: "national_holiday",
    is_working_day: false,
    name_zh: "中華民國開國紀念日（元旦）",
    name_en: "Republic of China Founding Day (New Year's Day)",
    source_url: "https://www.dgpa.gov.tw/information?uid=30&pid=12572",
  },

  // 除夕前一日 — Mon Jan 27 (flexed to off)
  {
    date: "2025-01-27",
    day_type: "compensatory_off",
    is_working_day: false,
    name_zh: "農曆除夕前一日（彈性放假）",
    name_en: "Lunar New Year's Eve – 1 (flexed to off)",
    notes:
      "Mon flexed to off; compensated by adjustment_workday on 2025-02-08 (Sat).",
    source_url: "https://www.dgpa.gov.tw/information?uid=82&pid=11972",
  },
  // 除夕 Tue Jan 28
  {
    date: "2025-01-28",
    day_type: "national_holiday",
    is_working_day: false,
    name_zh: "農曆除夕",
    name_en: "Lunar New Year's Eve",
    source_url: "https://www.dgpa.gov.tw/information?uid=82&pid=11972",
  },
  // 春節 初一 Wed 1/29
  {
    date: "2025-01-29",
    day_type: "national_holiday",
    is_working_day: false,
    name_zh: "春節（農曆正月初一）",
    name_en: "Lunar New Year Day 1",
    source_url: "https://www.dgpa.gov.tw/information?uid=82&pid=11972",
  },
  // 初二 Thu 1/30
  {
    date: "2025-01-30",
    day_type: "national_holiday",
    is_working_day: false,
    name_zh: "春節（農曆正月初二）",
    name_en: "Lunar New Year Day 2",
    source_url: "https://www.dgpa.gov.tw/information?uid=82&pid=11972",
  },
  // 初三 Fri 1/31
  {
    date: "2025-01-31",
    day_type: "national_holiday",
    is_working_day: false,
    name_zh: "春節（農曆正月初三）",
    name_en: "Lunar New Year Day 3",
    source_url: "https://www.dgpa.gov.tw/information?uid=82&pid=11972",
  },

  // 補班 Sat Feb 8 — compensates Jan 27 flex-off
  {
    date: "2025-02-08",
    day_type: "adjustment_workday",
    is_working_day: true,
    name_zh: "補行上班（除夕前一日彈性放假補班）",
    name_en: "Adjustment workday (compensating Lunar NY Eve – 1 flex-off)",
    notes:
      "Compensates for 2025-01-27 being flexed off. Pre-mid-2025 reform; this rule no longer applies for 2026+.",
    source_url: "https://www.dgpa.gov.tw/information?uid=82&pid=11972",
  },

  // 228 — Fri Feb 28
  {
    date: "2025-02-28",
    day_type: "national_holiday",
    is_working_day: false,
    name_zh: "和平紀念日",
    name_en: "Peace Memorial Day (228)",
    source_url: "https://www.dgpa.gov.tw/information?uid=30&pid=12572",
  },

  // 兒童節 + 民族掃墓節 — same day Apr 4 Fri this year. Children's Day → previous day Apr 3 Thu.
  {
    date: "2025-04-03",
    day_type: "national_holiday",
    is_working_day: false,
    name_zh: "兒童節",
    name_en: "Children's Day",
    notes:
      "Moved to 4/3 (Thu) because 兒童節 and 清明 fell on same day (Fri 4/4). Per 紀念日及節日實施辦法 第5條第2項, when same day → 兒童節 moves to previous day.",
    source_url: "https://www.dgpa.gov.tw/information?uid=30&pid=12572",
  },
  {
    date: "2025-04-04",
    day_type: "national_holiday",
    is_working_day: false,
    name_zh: "民族掃墓節（清明節）",
    name_en: "Tomb Sweeping Day",
    source_url: "https://www.dgpa.gov.tw/information?uid=30&pid=12572",
  },

  // 勞動節 — Thu May 1 (still 勞工-only in early 2025, before mid-2025 reform)
  {
    date: "2025-05-01",
    day_type: "national_holiday",
    is_working_day: false,
    name_zh: "勞動節",
    name_en: "Labor Day",
    notes: "Private-sector holiday under LSA Art. 37 (pre-2026 reform).",
    source_url: "https://www.mol.gov.tw/",
  },

  // 端午節 — Sat May 31, 補假 Fri 5/30
  {
    date: "2025-05-30",
    day_type: "compensatory_off",
    is_working_day: false,
    name_zh: "端午節補假",
    name_en: "Dragon Boat Festival (compensatory)",
    notes: "Compensatory off because 端午節 (5/31) fell on Saturday.",
    source_url: "https://www.dgpa.gov.tw/information?uid=30&pid=12572",
  },
  {
    date: "2025-05-31",
    day_type: "national_holiday",
    is_working_day: false,
    name_zh: "端午節",
    name_en: "Dragon Boat Festival",
    source_url: "https://www.dgpa.gov.tw/information?uid=30&pid=12572",
  },

  // 中秋節 — Mon Oct 6
  {
    date: "2025-10-06",
    day_type: "national_holiday",
    is_working_day: false,
    name_zh: "中秋節",
    name_en: "Mid-Autumn Festival",
    source_url: "https://www.dgpa.gov.tw/information?uid=30&pid=12572",
  },

  // 國慶日 — Fri Oct 10
  {
    date: "2025-10-10",
    day_type: "national_holiday",
    is_working_day: false,
    name_zh: "國慶日",
    name_en: "National Day (Double Tenth)",
    source_url: "https://www.dgpa.gov.tw/information?uid=30&pid=12572",
  },

  // ── 2025-05-28 mid-year reform additions: 教師節, 光復節, 行憲紀念日 ──
  // Per 紀念日及節日實施條例 amendment (signed 2025-05-28).

  // 孔子誕辰紀念日（教師節）— Sun Sep 28 → 補假 Mon Sep 29
  {
    date: "2025-09-28",
    day_type: "national_holiday",
    is_working_day: false,
    name_zh: "孔子誕辰紀念日（教師節）",
    name_en: "Confucius's Birthday / Teacher's Day",
    notes:
      "Added by 紀念日及節日實施條例 amendment effective 2025-05-28.",
    source_url: "https://www.dgpa.gov.tw/information?uid=82&pid=12574",
    source_published_at: "2025-05-28",
  },
  {
    date: "2025-09-29",
    day_type: "compensatory_off",
    is_working_day: false,
    name_zh: "孔子誕辰紀念日（教師節）補假",
    name_en: "Teacher's Day (compensatory)",
    notes: "Compensatory off because 教師節 (9/28) fell on Sunday.",
    source_url: "https://www.dgpa.gov.tw/information?uid=82&pid=12574",
  },

  // 臺灣光復暨金門古寧頭大捷紀念日 — Sat Oct 25 → 補假 Fri Oct 24
  {
    date: "2025-10-24",
    day_type: "compensatory_off",
    is_working_day: false,
    name_zh: "臺灣光復暨金門古寧頭大捷紀念日補假",
    name_en: "Taiwan Restoration Day & Kuningtou Battle Memorial (compensatory)",
    notes: "Compensatory off because 光復節 (10/25) fell on Saturday.",
    source_url: "https://www.dgpa.gov.tw/information?uid=82&pid=12574",
  },
  {
    date: "2025-10-25",
    day_type: "national_holiday",
    is_working_day: false,
    name_zh: "臺灣光復暨金門古寧頭大捷紀念日",
    name_en: "Taiwan Restoration Day & Kuningtou Battle Memorial",
    notes:
      "Added by 紀念日及節日實施條例 amendment effective 2025-05-28.",
    source_url: "https://www.dgpa.gov.tw/information?uid=82&pid=12574",
    source_published_at: "2025-05-28",
  },

  // 行憲紀念日 — Thu Dec 25
  {
    date: "2025-12-25",
    day_type: "national_holiday",
    is_working_day: false,
    name_zh: "行憲紀念日",
    name_en: "Constitution Day",
    notes:
      "Added by 紀念日及節日實施條例 amendment effective 2025-05-28.",
    source_url: "https://www.dgpa.gov.tw/information?uid=82&pid=12574",
    source_published_at: "2025-05-28",
  },
];

// ── 2026 (民國115年) ─────────────────────────────────────────────────
// Total non-working days: 120. 9 long weekends. ZERO 補班日 (post-reform).
// Per 2025-06-13 修正: 處理要點 deleted 補班 rules entirely.
// Now includes 小年夜 (除夕前一日) as a national holiday — no longer needs flex.

export const TAIWAN_CALENDAR_2026: CalendarDayInput[] = [
  // 元旦 — Thu Jan 1
  {
    date: "2026-01-01",
    day_type: "national_holiday",
    is_working_day: false,
    name_zh: "中華民國開國紀念日（元旦）",
    name_en: "Republic of China Founding Day (New Year's Day)",
    source_url: "https://www.dgpa.gov.tw/information?uid=30&pid=12685",
    source_published_at: "2025-06-13",
  },

  // 春節 cluster — Sat 2/14 to Sun 2/22 (9 days)
  // Layout: 例假日(2/14) → 小年夜(2/15) → 除夕(2/16) → 春節(2/17~2/19)
  //   → 小年夜逢例假補放假(2/20) → 例假日(2/21~2/22)

  // 小年夜 — Sun Feb 15 (now national holiday per 2025 reform — no longer requires 補班)
  {
    date: "2026-02-15",
    day_type: "national_holiday",
    is_working_day: false,
    name_zh: "小年夜",
    name_en: "Lunar New Year's Eve – 1",
    notes:
      "Per 紀念日及節日實施條例 amendment, 小年夜 is now a national holiday (no longer flexed with required 補班).",
    source_url: "https://www.dgpa.gov.tw/information?uid=30&pid=12685",
  },
  // 除夕 — Mon Feb 16
  {
    date: "2026-02-16",
    day_type: "national_holiday",
    is_working_day: false,
    name_zh: "農曆除夕",
    name_en: "Lunar New Year's Eve",
    source_url: "https://www.dgpa.gov.tw/information?uid=30&pid=12685",
  },
  // 初一 — Tue Feb 17
  {
    date: "2026-02-17",
    day_type: "national_holiday",
    is_working_day: false,
    name_zh: "春節（農曆正月初一）",
    name_en: "Lunar New Year Day 1",
    source_url: "https://www.dgpa.gov.tw/information?uid=30&pid=12685",
  },
  // 初二 — Wed Feb 18
  {
    date: "2026-02-18",
    day_type: "national_holiday",
    is_working_day: false,
    name_zh: "春節（農曆正月初二）",
    name_en: "Lunar New Year Day 2",
    source_url: "https://www.dgpa.gov.tw/information?uid=30&pid=12685",
  },
  // 初三 — Thu Feb 19
  {
    date: "2026-02-19",
    day_type: "national_holiday",
    is_working_day: false,
    name_zh: "春節（農曆正月初三）",
    name_en: "Lunar New Year Day 3",
    source_url: "https://www.dgpa.gov.tw/information?uid=30&pid=12685",
  },
  // 春節補假 — Fri Feb 20 (小年夜 fell on Sunday 2/15 → 補假)
  {
    date: "2026-02-20",
    day_type: "compensatory_off",
    is_working_day: false,
    name_zh: "小年夜補假",
    name_en: "Lunar New Year's Eve – 1 (compensatory)",
    notes: "Compensatory off because 小年夜 (2/15) fell on Sunday.",
    source_url: "https://www.dgpa.gov.tw/information?uid=30&pid=12685",
  },

  // 228 和平紀念日 — Sat Feb 28 → 補假 Fri Feb 27
  {
    date: "2026-02-27",
    day_type: "compensatory_off",
    is_working_day: false,
    name_zh: "和平紀念日補假",
    name_en: "Peace Memorial Day (compensatory)",
    notes: "Compensatory off because 228 (2/28) fell on Saturday.",
    source_url: "https://www.dgpa.gov.tw/information?uid=30&pid=12685",
  },
  {
    date: "2026-02-28",
    day_type: "national_holiday",
    is_working_day: false,
    name_zh: "和平紀念日",
    name_en: "Peace Memorial Day (228)",
    source_url: "https://www.dgpa.gov.tw/information?uid=30&pid=12685",
  },

  // 兒童節 + 民族掃墓節 — both Sat Apr 4 + Sun Apr 5 → 兒童節 prior workday Fri 4/3, 補假 Mon 4/6
  // Per 紀念日及節日實施條例 第6條第2項: when same day, 兒童節 moves to previous day
  // Note: 兒童節 4/4 (Sat) and 清明 4/5 (Sun). They're DIFFERENT days here.
  // Both fall on weekend → both get 補假.
  {
    date: "2026-04-03",
    day_type: "compensatory_off",
    is_working_day: false,
    name_zh: "兒童節補假",
    name_en: "Children's Day (compensatory)",
    notes: "Compensatory off because 兒童節 (4/4) fell on Saturday.",
    source_url: "https://www.dgpa.gov.tw/information?uid=30&pid=12685",
  },
  {
    date: "2026-04-04",
    day_type: "national_holiday",
    is_working_day: false,
    name_zh: "兒童節",
    name_en: "Children's Day",
    source_url: "https://www.dgpa.gov.tw/information?uid=30&pid=12685",
  },
  {
    date: "2026-04-05",
    day_type: "national_holiday",
    is_working_day: false,
    name_zh: "民族掃墓節（清明節）",
    name_en: "Tomb Sweeping Day",
    source_url: "https://www.dgpa.gov.tw/information?uid=30&pid=12685",
  },
  {
    date: "2026-04-06",
    day_type: "compensatory_off",
    is_working_day: false,
    name_zh: "民族掃墓節補假",
    name_en: "Tomb Sweeping Day (compensatory)",
    notes: "Compensatory off because 清明 (4/5) fell on Sunday.",
    source_url: "https://www.dgpa.gov.tw/information?uid=30&pid=12685",
  },

  // 勞動節 — Fri May 1 (now national holiday for everyone per 2025 reform!)
  {
    date: "2026-05-01",
    day_type: "national_holiday",
    is_working_day: false,
    name_zh: "勞動節",
    name_en: "Labor Day",
    notes:
      "Per 紀念日及節日實施條例 (effective 2026-01-01), 勞動節 is now a universal national holiday — applies to government workers, students, teachers, and private sector. Previously only LSA-covered workers.",
    source_url: "https://www.dgpa.gov.tw/information?uid=30&pid=12685",
  },

  // 端午節 — Fri Jun 19
  {
    date: "2026-06-19",
    day_type: "national_holiday",
    is_working_day: false,
    name_zh: "端午節",
    name_en: "Dragon Boat Festival",
    source_url: "https://www.dgpa.gov.tw/information?uid=30&pid=12685",
  },

  // 中秋節 — Fri Sep 25
  {
    date: "2026-09-25",
    day_type: "national_holiday",
    is_working_day: false,
    name_zh: "中秋節",
    name_en: "Mid-Autumn Festival",
    source_url: "https://www.dgpa.gov.tw/information?uid=30&pid=12685",
  },

  // 教師節（孔子誕辰）— Mon Sep 28
  {
    date: "2026-09-28",
    day_type: "national_holiday",
    is_working_day: false,
    name_zh: "孔子誕辰紀念日（教師節）",
    name_en: "Confucius's Birthday / Teacher's Day",
    source_url: "https://www.dgpa.gov.tw/information?uid=30&pid=12685",
  },

  // 國慶日 — Sat Oct 10 → 補假 Fri Oct 9
  {
    date: "2026-10-09",
    day_type: "compensatory_off",
    is_working_day: false,
    name_zh: "國慶日補假",
    name_en: "National Day (compensatory)",
    notes: "Compensatory off because 國慶日 (10/10) fell on Saturday.",
    source_url: "https://www.dgpa.gov.tw/information?uid=30&pid=12685",
  },
  {
    date: "2026-10-10",
    day_type: "national_holiday",
    is_working_day: false,
    name_zh: "國慶日",
    name_en: "National Day (Double Tenth)",
    source_url: "https://www.dgpa.gov.tw/information?uid=30&pid=12685",
  },

  // 光復節 — Sun Oct 25 → 補假 Mon Oct 26
  {
    date: "2026-10-25",
    day_type: "national_holiday",
    is_working_day: false,
    name_zh: "臺灣光復暨金門古寧頭大捷紀念日",
    name_en: "Taiwan Restoration Day & Kuningtou Battle Memorial",
    source_url: "https://www.dgpa.gov.tw/information?uid=30&pid=12685",
  },
  {
    date: "2026-10-26",
    day_type: "compensatory_off",
    is_working_day: false,
    name_zh: "臺灣光復暨金門古寧頭大捷紀念日補假",
    name_en: "Taiwan Restoration Day (compensatory)",
    notes: "Compensatory off because 光復節 (10/25) fell on Sunday.",
    source_url: "https://www.dgpa.gov.tw/information?uid=30&pid=12685",
  },

  // 行憲紀念日 — Fri Dec 25
  {
    date: "2026-12-25",
    day_type: "national_holiday",
    is_working_day: false,
    name_zh: "行憲紀念日",
    name_en: "Constitution Day",
    source_url: "https://www.dgpa.gov.tw/information?uid=30&pid=12685",
  },
];

// ── Combined export ──────────────────────────────────────────────────

/**
 * All authoritative DGPA calendar entries 2024-2026.
 *
 * Years covered: 2024, 2025, 2026.
 * Years NOT covered (intentionally — DGPA hasn't published yet): 2027+.
 *
 * The WorkingDayService throws TaiwanCalendarMissingDataError on queries
 * for years not present here. Update process: edit this file in
 * June/July of each year when DGPA publishes the next year's calendar,
 * then run `npx tsx scripts/seed-taiwan-calendar.ts`.
 */
export const ALL_CALENDAR_ENTRIES: CalendarDayInput[] = [
  ...TAIWAN_CALENDAR_2024,
  ...TAIWAN_CALENDAR_2025,
  ...TAIWAN_CALENDAR_2026,
];

/**
 * Years for which seed data is present. Used by WorkingDayService for
 * the "missing data" error message and by tests for boundary checks.
 */
export const SEEDED_YEARS = [2024, 2025, 2026] as const;
export const LATEST_SEEDED_YEAR = 2026;
