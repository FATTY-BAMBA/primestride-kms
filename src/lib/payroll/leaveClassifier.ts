// src/lib/payroll/leaveClassifier.ts
//
// Atlas EIP — Leave Type Classifier
// ──────────────────────────────────────────────────────────────────────
// Pure function: resolves a raw leave_type string (from
// workflow_submissions.form_data.leave_type) to a canonical
// LeaveTypeDefinition from the ontology — or refuses if the string is
// unrecognized or matches multiple entries.
//
// Used by:
//   - leaveDeduction.ts (Phase 3b): resolves every approved leave
//     record's leave_type before applying pay treatment.
//   - workflows/route.ts (Phase 3f, future): replaces the inline
//     getLeaveColumn() function. See divergence-analysis.md.
//
// Design principles (per Doc A § 3.2 — "engine never silently guesses"):
//   - Multiple matches → ambiguous (raise to admin)
//   - Zero matches → unclassified (raise to admin)
//   - One match → ok with the canonical definition
//
// The classifier is a pure function: no DB access, no side effects,
// no I/O. Same input → same output, always.

import { leaveOntology, type LeaveTypeDefinition } from "./leaveOntology";

// ── Result type ──────────────────────────────────────────────────────

export type ClassificationResult =
  | {
      ok: true;
      definition: LeaveTypeDefinition;
      /** Which alias from the matched entry produced the match. Useful for audit. */
      aliasMatched: string;
    }
  | {
      ok: false;
      reason: "unclassified";
      /** The original input (after normalization) for diagnostic display. */
      input: string;
    }
  | {
      ok: false;
      reason: "ambiguous";
      input: string;
      /** canonicalKeys of the matching entries, for admin to choose from. */
      candidates: string[];
    };

// ── Custom error type for thrown failures ────────────────────────────

export class LeaveClassificationError extends Error {
  constructor(
    public readonly result: Extract<ClassificationResult, { ok: false }>,
  ) {
    const message =
      result.reason === "unclassified"
        ? `Unclassified leave type: "${result.input}"`
        : `Ambiguous leave type: "${result.input}" matches [${result.candidates.join(", ")}]`;
    super(message);
    this.name = "LeaveClassificationError";
  }
}

// ── Normalization (per default #5 + #6) ──────────────────────────────

/**
 * Normalizes a raw leave_type string for comparison:
 *   1. Trim leading/trailing whitespace (including \n, \r, \t)
 *   2. Collapse runs of whitespace into a single space
 *   3. Lowercase (for ASCII; CJK is already case-invariant)
 *
 * Note: Does NOT remove internal whitespace. "病  假" stays as "病  假"
 * (we don't want to silently fix what could be a real typo).
 */
function normalize(input: string): string {
  return input.trim().replace(/\s+/g, " ").toLowerCase();
}

// ── Classification ──────────────────────────────────────────────────

/**
 * Classify a raw leave_type string against the ontology.
 *
 * Returns a discriminated union:
 *   - { ok: true, definition, aliasMatched }: exactly one match
 *   - { ok: false, reason: 'unclassified', input }: zero matches
 *   - { ok: false, reason: 'ambiguous', input, candidates }: >1 matches
 *
 * This function NEVER throws. Call classifyOrThrow() to convert
 * unclassified/ambiguous results into thrown errors.
 *
 * @example
 *   classify("特休 Annual")
 *   // → { ok: true, definition: <annual_leave>, aliasMatched: "特休" }
 *
 * @example
 *   classify("病假或事假")
 *   // → { ok: false, reason: 'ambiguous', input: '病假或事假',
 *   //     candidates: ['sick_unhospitalized', 'personal_leave'] }
 *
 * @example
 *   classify("unknown")
 *   // → { ok: false, reason: 'unclassified', input: 'unknown' }
 */
export function classify(rawInput: string): ClassificationResult {
  const normalized = normalize(rawInput);

  // Empty input is unclassified (defensive — should never happen
  // since workflow_submissions.form_data.leave_type is NOT NULL).
  if (normalized === "") {
    return { ok: false, reason: "unclassified", input: normalized };
  }

  // Find the BEST (longest) matching alias for each entry. We scan all
  // aliases of each entry, not just the first match, because aliases are
  // not ordered by specificity. For example, paternity_leave has both
  // "陪產假" and "陪產檢及陪產假" — for input "陪產檢及陪產假" we need
  // to pick the longer alias to give the specificity-resolution step
  // accurate length information.
  const matches: Array<{ entry: LeaveTypeDefinition; aliasMatched: string }> = [];

  for (const entry of leaveOntology) {
    let bestAlias: string | null = null;
    for (const alias of entry.aliases) {
      const aliasNormalized = alias.trim().toLowerCase();
      if (normalized.includes(aliasNormalized)) {
        if (!bestAlias || alias.length > bestAlias.length) {
          bestAlias = alias;
        }
      }
    }
    if (bestAlias !== null) {
      matches.push({ entry, aliasMatched: bestAlias });
    }
  }

  if (matches.length === 0) {
    return { ok: false, reason: "unclassified", input: normalized };
  }

  // Specificity resolution: when multiple entries match, drop any whose
  // matched alias is a STRICT SUBSTRING of another matched alias.
  //
  // Rationale: in CJK leave terminology, longer compound terms typically
  // contain shorter generic terms.
  //   "陪產假" matches "產假" (maternity) AND "陪產假" (paternity)
  //   "公傷病假" matches "病假" (sick) AND "公傷病假" (occupational)
  //   "住院傷病假" matches "住院" + "病假" + "住院傷病假"
  //
  // The most specific match (longest alias that is itself a superstring of
  // any other matched alias) wins. If there is no clear specificity hierarchy
  // (e.g., "病假或事假" matches "病假" and "事假" — neither contains the other),
  // we fall through to ambiguous, which is correct per Doc A § 3.2.
  const filteredMatches = matches.filter((candidate) => {
    const candidateAliasLower = candidate.aliasMatched.trim().toLowerCase();
    // Drop this candidate if any OTHER candidate has a strictly longer
    // alias that contains this candidate's alias.
    return !matches.some((other) => {
      if (other === candidate) return false;
      const otherAliasLower = other.aliasMatched.trim().toLowerCase();
      return (
        otherAliasLower.length > candidateAliasLower.length &&
        otherAliasLower.includes(candidateAliasLower)
      );
    });
  });

  // After filtering, deduplicate by entry (in case multiple aliases of the
  // same entry survived). Pick the one with the longest matched alias.
  const dedupedByEntry = new Map<
    string,
    { entry: LeaveTypeDefinition; aliasMatched: string }
  >();
  for (const m of filteredMatches) {
    const existing = dedupedByEntry.get(m.entry.canonicalKey);
    if (
      !existing ||
      m.aliasMatched.length > existing.aliasMatched.length
    ) {
      dedupedByEntry.set(m.entry.canonicalKey, m);
    }
  }
  const finalMatches = Array.from(dedupedByEntry.values());

  if (finalMatches.length === 1) {
    return {
      ok: true,
      definition: finalMatches[0].entry,
      aliasMatched: finalMatches[0].aliasMatched,
    };
  }

  // Multiple distinct entries still match after specificity resolution
  // → genuinely ambiguous. Per Doc A § 3.2: engine never silently guesses.
  return {
    ok: false,
    reason: "ambiguous",
    input: normalized,
    candidates: finalMatches.map((m) => m.entry.canonicalKey),
  };
}

/**
 * Classify a leave_type string, or throw a LeaveClassificationError
 * if the string cannot be unambiguously classified.
 *
 * Use this from contexts where ambiguity is unrecoverable (e.g.,
 * inside the payroll deduction pipeline, where every leave record
 * MUST resolve to a canonical type before deductions can be calculated).
 *
 * The agent layer (Doc B) catches this error and presents it to the
 * admin for clarification.
 */
export function classifyOrThrow(rawInput: string): {
  definition: LeaveTypeDefinition;
  aliasMatched: string;
} {
  const result = classify(rawInput);
  if (result.ok === false) {
    throw new LeaveClassificationError(result);
  }
  return {
    definition: result.definition,
    aliasMatched: result.aliasMatched,
  };
}

/**
 * Convenience: classify many leave records at once. Returns parallel
 * arrays so the caller can handle ok/error per record. Useful when
 * the calculator processes a batch and wants to surface ALL
 * classification failures at once (rather than throwing on the first).
 */
export function classifyMany(inputs: string[]): ClassificationResult[] {
  return inputs.map(classify);
}
