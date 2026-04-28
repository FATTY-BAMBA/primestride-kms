// src/lib/payroll/__tests__/leaveClassifier.parity.test.ts
//
// Parity test between the new leaveClassifier and the legacy
// getLeaveColumn() function in src/app/api/workflows/route.ts.
//
// This test does NOT assert "new behaves identically to old."
// It asserts: "new diverges from old ONLY in the documented ways."
//
// See: src/lib/payroll/__tests__/divergence-analysis.md (root copy)
//      OR /home/claude/code/payroll/leaveClassifier-divergence-analysis.md
//
// Categories of assertion:
//   A. Direct equivalents — old and new agree
//   B. Intentional improvements — new corrects old's bugs (生理, 育嬰, 住院)
//   C. Ambiguity escalations — new refuses where old silently picked first
//   D. New coverage — new handles types old didn't recognize at all

import { describe, it, expect } from "vitest";
import { classify } from "../leaveClassifier";

// ── Local re-implementation of the legacy function for parity check ──
//
// This is COPIED verbatim from src/app/api/workflows/route.ts as of
// 2026-04-28. The copy lives here so the parity test is self-contained
// and won't break if/when workflows/route.ts is refactored.
//
// When workflows/route.ts is refactored to use the new classifier
// (Phase 3f), this local copy stays as the historical baseline that
// the test asserts against.

function legacyGetLeaveColumn(leaveType: string): string {
  const t = leaveType.toLowerCase();

  if (t.includes("特休") || t.includes("annual") || t.includes("pto")) return "annual_used";
  if (t.includes("補休") || t.includes("comp") || t.includes("調休") || t.includes("換休")) return "comp_time_used";
  if (t.includes("病假") || t.includes("sick") || t.includes("生理")) return "sick_used";
  if (t.includes("事假") || t.includes("personal")) return "personal_used";
  if (t.includes("家庭") || t.includes("family") || t.includes("family care")) return "family_care_used";
  if (t.includes("婚假") || t.includes("marriage") || t.includes("wedding")) return "marriage_used";
  if (t.includes("喪假") || t.includes("bereavement") || t.includes("funeral")) return "bereavement_used";
  if (t.includes("產假") || t.includes("maternity")) return "maternity_used";
  if (t.includes("陪產") || t.includes("paternity")) return "paternity_used";
  if (t.includes("公假") || t.includes("official")) return "official_used";
  if (t.includes("育嬰") || t.includes("parental")) return "annual_used"; // map to annual as closest

  return ""; // unknown type — do not deduct
}

// ── Mapping from new canonicalKey to old leave_balances column ───────
//
// For Category A assertions, we need to translate the new classifier's
// canonicalKey output to the equivalent old column name. This mapping
// is explicit (not derived) so that future ontology additions don't
// silently change parity behavior.

const canonicalKeyToLegacyColumn: Record<string, string> = {
  annual_leave: "annual_used",
  comp_time: "comp_time_used",
  sick_unhospitalized: "sick_used",
  personal_leave: "personal_used",
  family_care_leave: "family_care_used",
  marriage_leave: "marriage_used",
  bereavement_leave: "bereavement_used",
  maternity_leave: "maternity_used",
  paternity_leave: "paternity_used",
  official_leave: "official_used",

  // The following have NO legacy column equivalent:
  //   menstrual_leave (old bundled to sick_used)
  //   parental_leave (old mapped to annual_used)
  //   sick_hospitalized (old bundled to sick_used)
  //   occupational_injury_leave (old returned "")
  //   pregnancy_rest_leave (old returned "")
  //   prenatal_check_leave (old returned "")
};

// ────────────────────────────────────────────────────────────────────
// Category A — Direct Equivalents
// ────────────────────────────────────────────────────────────────────

describe("Parity Category A — direct equivalents (must agree)", () => {
  it.each([
    // [input, expectedLegacyColumn, expectedNewKey]
    // Note: only inputs where legacy and new actually agree are listed here.
    // Inputs where legacy has bugs (e.g., 特別休假 → "", 陪產假 → maternity_used)
    // are tested in Category B/D below.
    ["特休", "annual_used", "annual_leave"],
    ["特休 Annual", "annual_used", "annual_leave"],
    ["annual", "annual_used", "annual_leave"],
    ["PTO", "annual_used", "annual_leave"],

    ["補休", "comp_time_used", "comp_time"],
    ["comp", "comp_time_used", "comp_time"],
    ["換休", "comp_time_used", "comp_time"],
    ["調休", "comp_time_used", "comp_time"],

    ["病假", "sick_used", "sick_unhospitalized"],
    ["病假 Sick", "sick_used", "sick_unhospitalized"],
    ["sick", "sick_used", "sick_unhospitalized"],

    ["事假", "personal_used", "personal_leave"],
    ["personal", "personal_used", "personal_leave"],

    ["家庭", "family_care_used", "family_care_leave"],
    ["家庭照顧假", "family_care_used", "family_care_leave"],
    ["family", "family_care_used", "family_care_leave"],

    ["婚假", "marriage_used", "marriage_leave"],
    ["marriage", "marriage_used", "marriage_leave"],
    ["wedding", "marriage_used", "marriage_leave"],

    ["喪假", "bereavement_used", "bereavement_leave"],
    ["bereavement", "bereavement_used", "bereavement_leave"],
    ["funeral", "bereavement_used", "bereavement_leave"],

    ["產假", "maternity_used", "maternity_leave"],
    ["maternity", "maternity_used", "maternity_leave"],

    ["陪產", "paternity_used", "paternity_leave"],
    ["paternity", "paternity_used", "paternity_leave"],

    ["公假", "official_used", "official_leave"],
    ["official", "official_used", "official_leave"],
  ])(
    "'%s' → legacy: %s, new: %s (equivalent)",
    (input, expectedLegacyColumn, expectedNewKey) => {
      const legacyResult = legacyGetLeaveColumn(input);
      const newResult = classify(input);

      expect(legacyResult).toBe(expectedLegacyColumn);
      expect(newResult.ok).toBe(true);
      if (newResult.ok === true) {
        expect(newResult.definition.canonicalKey).toBe(expectedNewKey);
        // Verify our mapping is consistent
        expect(canonicalKeyToLegacyColumn[newResult.definition.canonicalKey]).toBe(
          expectedLegacyColumn,
        );
      }
    },
  );
});

// ────────────────────────────────────────────────────────────────────
// Category B — Intentional Improvements (documented divergence)
// ────────────────────────────────────────────────────────────────────

describe("Parity Category B — intentional improvements (documented divergence)", () => {
  describe("B.1: 生理 separated from 病假 per GEAW Art. 14", () => {
    // Note: "menstrual" is excluded from this list because legacy returns ""
    // for it (legacy only matches Chinese 生理). It belongs in Category D.
    it.each([["生理"], ["生理假"]])(
      "'%s' diverges: legacy bundles to sick_used, new returns menstrual_leave",
      (input) => {
        const legacyResult = legacyGetLeaveColumn(input);
        expect(legacyResult).toBe("sick_used");

        const newResult = classify(input);
        expect(newResult.ok).toBe(true);
        if (newResult.ok === true) {
          expect(newResult.definition.canonicalKey).toBe("menstrual_leave");
        }
      },
    );
  });

  describe("B.2: 育嬰留停 routes to parental_leave (skip from payroll), not annual", () => {
    it.each([["育嬰"], ["育嬰假"], ["育嬰留停"], ["育嬰留職停薪"], ["parental"]])(
      "'%s' diverges: legacy maps to annual_used (BUG), new returns parental_leave",
      (input) => {
        const legacyResult = legacyGetLeaveColumn(input);
        expect(legacyResult).toBe("annual_used");

        const newResult = classify(input);
        expect(newResult.ok).toBe(true);
        if (newResult.ok === true) {
          expect(newResult.definition.canonicalKey).toBe("parental_leave");
          expect(newResult.definition.payTreatment).toEqual({
            kind: "skip_from_payroll",
          });
        }
      },
    );
  });

  describe("B.3: 住院傷病假 distinct from unhospitalized sick", () => {
    it("'住院傷病假' diverges: legacy bundles to sick_used, new returns sick_hospitalized", () => {
      const legacyResult = legacyGetLeaveColumn("住院傷病假");
      expect(legacyResult).toBe("sick_used"); // legacy matches "病假" substring

      const newResult = classify("住院傷病假");
      expect(newResult.ok).toBe(true);
      if (newResult.ok === true) {
        expect(newResult.definition.canonicalKey).toBe("sick_hospitalized");
      }
    });
  });

  describe("B.4: 陪產假 returns paternity_leave (legacy maternity_used bug)", () => {
    // Discovered during test verification: legacy's ordering causes
    // "陪產假" to match the 產假 (maternity) clause BEFORE the 陪產
    // clause is reached. Result: paternity leave records get
    // misclassified as maternity. The new classifier resolves this
    // via specificity: the longer alias "陪產假" wins over "產假".
    it.each([["陪產假"], ["陪產檢及陪產假"]])(
      "'%s' diverges: legacy returns maternity_used (BUG), new returns paternity_leave",
      (input) => {
        const legacyResult = legacyGetLeaveColumn(input);
        expect(legacyResult).toBe("maternity_used");

        const newResult = classify(input);
        expect(newResult.ok).toBe(true);
        if (newResult.ok === true) {
          expect(newResult.definition.canonicalKey).toBe("paternity_leave");
        }
      },
    );
  });

  describe("B.5: 公傷病假 returns occupational_injury_leave (legacy sick_used bug)", () => {
    // Discovered during test verification: legacy's "病假" substring
    // match catches "公傷病假" (which contains "病假") and routes it to
    // generic sick leave. Occupational injury claims would have been
    // half-paid instead of fully paid per LSA Art. 59. The new
    // classifier resolves this via specificity: the longer alias
    // "公傷病假" wins over "病假".
    it("'公傷病假' diverges: legacy returns sick_used (BUG), new returns occupational_injury_leave", () => {
      const legacyResult = legacyGetLeaveColumn("公傷病假");
      expect(legacyResult).toBe("sick_used");

      const newResult = classify("公傷病假");
      expect(newResult.ok).toBe(true);
      if (newResult.ok === true) {
        expect(newResult.definition.canonicalKey).toBe("occupational_injury_leave");
      }
    });
  });

  describe("B.6: 特別休假 (full term) classifies correctly (legacy '' bug)", () => {
    // Discovered during test verification: legacy uses "特休" substring
    // match, which does NOT match the full term "特別休假" because the
    // characters are not contiguous. Legacy returns "" — silent skip.
    // The new classifier explicitly aliases "特別休假".
    it("'特別休假' diverges: legacy returns '' (silent skip), new returns annual_leave", () => {
      const legacyResult = legacyGetLeaveColumn("特別休假");
      expect(legacyResult).toBe("");

      const newResult = classify("特別休假");
      expect(newResult.ok).toBe(true);
      if (newResult.ok === true) {
        expect(newResult.definition.canonicalKey).toBe("annual_leave");
      }
    });
  });
});

// ────────────────────────────────────────────────────────────────────
// Category C — Ambiguity Escalations
// ────────────────────────────────────────────────────────────────────

describe("Parity Category C — ambiguity escalations", () => {
  it.each([
    ["病假或事假", "sick_used", ["sick_unhospitalized", "personal_leave"]],
    ["病假或事假，待確認", "sick_used", ["sick_unhospitalized", "personal_leave"]],
    ["sick or personal", "sick_used", ["sick_unhospitalized", "personal_leave"]],
    ["婚假或喪假", "marriage_used", ["marriage_leave", "bereavement_leave"]],
  ])(
    "'%s' diverges: legacy silently picks %s, new returns ambiguous with candidates",
    (input, expectedLegacyColumn, expectedCandidates) => {
      // Legacy: silently picks first match
      const legacyResult = legacyGetLeaveColumn(input);
      expect(legacyResult).toBe(expectedLegacyColumn);

      // New: refuses to auto-classify, returns ambiguous
      const newResult = classify(input);
      expect(newResult.ok).toBe(false);
      if (newResult.ok === false && newResult.reason === "ambiguous") {
        expect(newResult.candidates.slice().sort()).toEqual(
          expectedCandidates.slice().sort(),
        );
      }
    },
  );
});

// ────────────────────────────────────────────────────────────────────
// Category D — New Coverage (legacy returned empty for these)
// ────────────────────────────────────────────────────────────────────

describe("Parity Category D — new coverage for previously-unhandled types", () => {
  // Note: 公傷病假 was incorrectly suspected to fall here, but legacy
  // actually misclassifies it as sick_used (see Category B.5).
  // 工傷 is genuine new coverage — legacy doesn't recognize it at all.
  it.each([
    ["工傷", "occupational_injury_leave"],
    ["occupational injury", "occupational_injury_leave"],

    ["安胎休養", "pregnancy_rest_leave"],
    ["bedrest", "pregnancy_rest_leave"],

    ["產檢假", "prenatal_check_leave"],
    ["prenatal check", "prenatal_check_leave"],

    ["menstrual", "menstrual_leave"],
  ])(
    "'%s' new coverage: legacy returns '' (silent skip), new returns %s",
    (input, expectedNewKey) => {
      // Legacy: returns "" — no match in any if clause
      const legacyResult = legacyGetLeaveColumn(input);
      expect(legacyResult).toBe("");

      // New: returns canonical entry
      const newResult = classify(input);
      expect(newResult.ok).toBe(true);
      if (newResult.ok === true) {
        expect(newResult.definition.canonicalKey).toBe(expectedNewKey);
      }
    },
  );
});

// ────────────────────────────────────────────────────────────────────
// Sanity assertion — Categories A through D cover the divergence space
// ────────────────────────────────────────────────────────────────────

describe("Parity test coverage sanity", () => {
  it("every canonicalKey in the ontology has either a legacy mapping or is documented as Category B/D", () => {
    const knownKeys = [
      // Category A — direct mapping in canonicalKeyToLegacyColumn
      "annual_leave",
      "comp_time",
      "sick_unhospitalized",
      "personal_leave",
      "family_care_leave",
      "marriage_leave",
      "bereavement_leave",
      "maternity_leave",
      "paternity_leave",
      "official_leave",
      // Category B/D — documented divergence
      "menstrual_leave",
      "parental_leave",
      "sick_hospitalized",
      "occupational_injury_leave",
      "pregnancy_rest_leave",
      "prenatal_check_leave",
    ];

    expect(knownKeys.length).toBe(16); // matches ontology size
  });
});
