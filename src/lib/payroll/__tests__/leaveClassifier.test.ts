// src/lib/payroll/__tests__/leaveClassifier.test.ts
//
// Functional tests for the leaveClassifier module.
// Covers:
//   - Direct alias matching (every leave type)
//   - Normalization (case, whitespace, mixed CJK + Latin)
//   - Unclassified handling (unknown strings)
//   - Ambiguity detection (multi-match strings)
//   - The classifyOrThrow / LeaveClassificationError contract
//   - The classifyMany batch helper
//
// The companion file leaveClassifier.parity.test.ts asserts behavioral
// divergence from the legacy getLeaveColumn() function per
// divergence-analysis.md.

import { describe, it, expect } from "vitest";
import {
  classify,
  classifyOrThrow,
  classifyMany,
  LeaveClassificationError,
  type ClassificationResult,
} from "../leaveClassifier";

// ── Helpers ──────────────────────────────────────────────────────────

function expectOk(
  result: ClassificationResult,
  expectedKey: string,
): void {
  expect(result.ok).toBe(true);
  if (result.ok === true) {
    expect(result.definition.canonicalKey).toBe(expectedKey);
  }
}

function expectAmbiguous(
  result: ClassificationResult,
  expectedCandidates: string[],
): void {
  expect(result.ok).toBe(false);
  // Use explicit discriminator check rather than negation, so strict narrowing works
  if (result.ok === false && result.reason === "ambiguous") {
    expect(result.candidates.slice().sort()).toEqual(
      expectedCandidates.slice().sort(),
    );
  } else {
    // If we got here, narrowing didn't match expectations — fail with a clearer message
    expect(result.ok).toBe(false);
    if (result.ok === false) {
      expect(result.reason).toBe("ambiguous");
    }
  }
}

function expectUnclassified(result: ClassificationResult): void {
  expect(result.ok).toBe(false);
  if (result.ok === false) {
    expect(result.reason).toBe("unclassified");
  }
}

// ── Direct alias matching tests ──────────────────────────────────────

describe("classify — direct alias matching for all 16 leave types", () => {
  // Each leave type tested with: 繁中 canonical, 繁中 alias, EN alias

  it.each([
    // [input, expectedCanonicalKey, description]
    ["特休", "annual_leave", "繁中 短稱"],
    ["特別休假", "annual_leave", "繁中 全稱"],
    ["annual leave", "annual_leave", "EN full"],
    ["PTO", "annual_leave", "EN abbreviation (case)"],

    ["事假", "personal_leave", "繁中"],
    ["personal", "personal_leave", "EN"],

    ["家庭照顧假", "family_care_leave", "繁中 全稱"],
    ["family care", "family_care_leave", "EN"],

    ["婚假", "marriage_leave", "繁中"],
    ["marriage", "marriage_leave", "EN"],
    ["wedding leave", "marriage_leave", "EN colloquial"],

    ["喪假", "bereavement_leave", "繁中"],
    ["bereavement", "bereavement_leave", "EN"],
    ["funeral", "bereavement_leave", "EN colloquial"],

    ["陪產檢及陪產假", "paternity_leave", "繁中 全稱 (current law)"],
    ["陪產假", "paternity_leave", "繁中 短稱 (legacy)"],
    ["paternity", "paternity_leave", "EN"],

    ["產檢假", "prenatal_check_leave", "繁中"],
    ["prenatal check", "prenatal_check_leave", "EN"],

    ["公假", "official_leave", "繁中"],
    ["official", "official_leave", "EN"],

    ["補休", "comp_time", "繁中"],
    ["comp time", "comp_time", "EN"],
    ["換休", "comp_time", "繁中 alt"],
    ["調休", "comp_time", "繁中 alt"],

    ["公傷病假", "occupational_injury_leave", "繁中"],
    ["工傷", "occupational_injury_leave", "繁中 alt"],
    ["occupational injury", "occupational_injury_leave", "EN"],

    ["安胎休養", "pregnancy_rest_leave", "繁中"],
    ["bedrest", "pregnancy_rest_leave", "EN colloquial"],

    ["生理假", "menstrual_leave", "繁中"],
    ["menstrual", "menstrual_leave", "EN"],

    ["育嬰留職停薪", "parental_leave", "繁中 全稱"],
    ["育嬰留停", "parental_leave", "繁中 短稱"],
    ["parental", "parental_leave", "EN"],

    ["住院傷病假", "sick_hospitalized", "繁中 (full term)"],
    ["hospitalized sick", "sick_hospitalized", "EN"],
  ])("%s → %s (%s)", (input, expectedKey) => {
    const result = classify(input);
    expectOk(result, expectedKey);
  });
});

// ── Default 1: 病假 (without 住院 modifier) goes to unhospitalized ───

describe("classify — sick leave defaults to unhospitalized when not hospitalized", () => {
  it("classifies '病假' as sick_unhospitalized (default sub-type)", () => {
    expectOk(classify("病假"), "sick_unhospitalized");
  });

  it("classifies '病假 Sick' as sick_unhospitalized", () => {
    expectOk(classify("病假 Sick"), "sick_unhospitalized");
  });

  it("classifies 'sick' as sick_unhospitalized", () => {
    expectOk(classify("sick"), "sick_unhospitalized");
  });

  it("classifies '住院傷病假' as sick_hospitalized (when explicit)", () => {
    expectOk(classify("住院傷病假"), "sick_hospitalized");
  });
});

// ── Default 5 + 6: case insensitivity and whitespace normalization ───

describe("classify — normalization (case + whitespace)", () => {
  it("matches case-insensitively for ASCII inputs", () => {
    expectOk(classify("Annual"), "annual_leave");
    expectOk(classify("ANNUAL"), "annual_leave");
    expectOk(classify("annual"), "annual_leave");
    expectOk(classify("aNnUaL"), "annual_leave");
  });

  it("trims leading and trailing whitespace", () => {
    expectOk(classify("  特休  "), "annual_leave");
    expectOk(classify("\t病假\n"), "sick_unhospitalized");
    expectOk(classify("\n\nmarriage\r\n"), "marriage_leave");
  });

  it("collapses internal whitespace runs", () => {
    expectOk(classify("annual    leave"), "annual_leave");
    expectOk(classify("family   care"), "family_care_leave");
  });

  it("does NOT remove internal whitespace within CJK terms", () => {
    // "病  假" with internal space is intentionally NOT a match.
    // The classifier collapses runs to single space, but doesn't
    // remove the space entirely. "病  假" → "病 假" which still
    // does not contain the alias "病假".
    const result = classify("病  假");
    expectUnclassified(result);
  });
});

// ── Empty / whitespace-only inputs ───────────────────────────────────

describe("classify — empty and whitespace-only inputs", () => {
  it("returns unclassified for empty string", () => {
    expectUnclassified(classify(""));
  });

  it("returns unclassified for whitespace-only string", () => {
    expectUnclassified(classify("   "));
    expectUnclassified(classify("\t\n\r"));
  });
});

// ── Default 4: ambiguity detection (multi-type strings) ──────────────

describe("classify — ambiguous strings (multi-type matches)", () => {
  it("flags '病假或事假' as ambiguous between sick and personal", () => {
    expectAmbiguous(classify("病假或事假"), [
      "sick_unhospitalized",
      "personal_leave",
    ]);
  });

  it("flags '病假或事假，待確認' as ambiguous", () => {
    expectAmbiguous(classify("病假或事假，待確認"), [
      "sick_unhospitalized",
      "personal_leave",
    ]);
  });

  it("flags 'sick or personal' as ambiguous", () => {
    expectAmbiguous(classify("sick or personal"), [
      "sick_unhospitalized",
      "personal_leave",
    ]);
  });

  it("flags '婚假或喪假' as ambiguous", () => {
    expectAmbiguous(classify("婚假或喪假"), [
      "marriage_leave",
      "bereavement_leave",
    ]);
  });
});

// ── Unclassified inputs ──────────────────────────────────────────────

describe("classify — unclassified strings", () => {
  it.each([
    ["unknown"],
    ["休假"], // Generic "leave" — too vague, no alias matches
    ["day off"],
    ["break"],
    ["off"],
    ["休"], // Single character, ambiguous
    ["123"], // Numeric
  ])("'%s' → unclassified", (input) => {
    expectUnclassified(classify(input));
  });

  it("returns unclassified with the original normalized input", () => {
    const result = classify("totally unknown leave type");
    expectUnclassified(result);
    if (result.ok === false && result.reason === "unclassified") {
      expect(result.input).toBe("totally unknown leave type");
    }
  });
});

// ── 育嬰 vs 育嬰留停 vs parental cross-checks ────────────────────────

describe("classify — parental leave variants", () => {
  it("classifies all parental variants to parental_leave (NOT annual_leave)", () => {
    // This is the documented Category B.2 divergence — old function
    // mapped 育嬰 to annual; new classifier correctly identifies it.
    expectOk(classify("育嬰"), "parental_leave");
    expectOk(classify("育嬰假"), "parental_leave");
    expectOk(classify("育嬰留停"), "parental_leave");
    expectOk(classify("育嬰留職停薪"), "parental_leave");
    expectOk(classify("parental leave"), "parental_leave");
  });
});

// ── 生理 vs 病假 separation ──────────────────────────────────────────

describe("classify — menstrual leave is separate from sick leave", () => {
  it("classifies '生理假' as menstrual_leave (NOT sick_unhospitalized)", () => {
    // Documented Category B.1 divergence per GEAW Art. 14.
    expectOk(classify("生理假"), "menstrual_leave");
    expectOk(classify("menstrual"), "menstrual_leave");
  });

  it("does NOT bundle 生理 into 病假 (unlike the old function)", () => {
    const result = classify("生理假");
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.definition.canonicalKey).not.toBe("sick_unhospitalized");
    }
  });
});

// ── classifyOrThrow contract ─────────────────────────────────────────

describe("classifyOrThrow", () => {
  it("returns the resolved definition on success", () => {
    const { definition, aliasMatched } = classifyOrThrow("特休");
    expect(definition.canonicalKey).toBe("annual_leave");
    expect(aliasMatched).toBeTruthy();
  });

  it("throws LeaveClassificationError on unclassified", () => {
    expect(() => classifyOrThrow("unknown garbage")).toThrow(
      LeaveClassificationError,
    );
  });

  it("throws LeaveClassificationError on ambiguous", () => {
    expect(() => classifyOrThrow("病假或事假")).toThrow(
      LeaveClassificationError,
    );
  });

  it("attaches the unclassified result to the thrown error", () => {
    let caught: unknown = null;
    try {
      classifyOrThrow("totally unknown");
    } catch (err) {
      caught = err;
    }
    expect(caught).toBeInstanceOf(LeaveClassificationError);
    if (caught instanceof LeaveClassificationError) {
      expect(caught.result.ok).toBe(false);
      if (!caught.result.ok) {
        expect(caught.result.reason).toBe("unclassified");
      }
    }
  });

  it("attaches the ambiguous result with candidates to the thrown error", () => {
    let caught: unknown = null;
    try {
      classifyOrThrow("病假或事假");
    } catch (err) {
      caught = err;
    }
    expect(caught).toBeInstanceOf(LeaveClassificationError);
    if (caught instanceof LeaveClassificationError) {
      expect(caught.result.ok).toBe(false);
      if (!caught.result.ok && caught.result.reason === "ambiguous") {
        expect(caught.result.candidates).toContain("sick_unhospitalized");
        expect(caught.result.candidates).toContain("personal_leave");
      }
    }
  });
});

// ── classifyMany batch contract ──────────────────────────────────────

describe("classifyMany", () => {
  it("returns parallel array of results", () => {
    const inputs = ["特休", "病假", "unknown", "婚假"];
    const results = classifyMany(inputs);

    expect(results).toHaveLength(4);
    expectOk(results[0], "annual_leave");
    expectOk(results[1], "sick_unhospitalized");
    expectUnclassified(results[2]);
    expectOk(results[3], "marriage_leave");
  });

  it("does NOT throw on bad inputs (allows caller to surface all errors)", () => {
    const inputs = ["unknown", "病假或事假"];
    expect(() => classifyMany(inputs)).not.toThrow();
    const results = classifyMany(inputs);
    expectUnclassified(results[0]);
    expectAmbiguous(results[1], ["sick_unhospitalized", "personal_leave"]);
  });

  it("handles empty input array", () => {
    expect(classifyMany([])).toEqual([]);
  });
});

// ── Real-world variants (smoke test against the production data shape) ─

describe("classify — real-world variants from production data", () => {
  // Variants observed in the existing workflow_submissions table per
  // earlier investigation.
  it.each([
    ["特休 Annual", "annual_leave"],
    ["病假 Sick", "sick_unhospitalized"],
    ["特休", "annual_leave"],
  ])("'%s' → %s (matches existing prod data)", (input, expectedKey) => {
    expectOk(classify(input), expectedKey);
  });
});

// ── Returned alias is one of the entry's actual aliases ──────────────

describe("classify — aliasMatched is always a real alias from the entry", () => {
  it("returns the matched alias verbatim (not the input)", () => {
    const result = classify("  特休 Annual  ");
    expect(result.ok).toBe(true);
    if (result.ok) {
      // The aliasMatched should be one of the entry's defined aliases,
      // not the user's normalized input.
      expect(result.definition.aliases).toContain(result.aliasMatched);
    }
  });
});
