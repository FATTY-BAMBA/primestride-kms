// src/lib/payroll/__tests__/payrollPersistence.test.ts
//
// Tests for payrollPersistence.ts.
//
// These tests cover the PURE parts of the module: payload assembly,
// line item shape, totals aggregation, soft-replace bookkeeping.
// The actual RPC call requires a real DB and is exercised by the smoke
// test (scripts/smoke-phase-3d-persist.ts).

import { describe, it, expect } from "vitest";
import { buildPersistPayload } from "../payrollPersistence";
import type {
  LeaveDeductionRunResult,
  EmployeeLeaveDeductionResult,
  LeaveOccurrenceResult,
} from "../leaveDeduction";
import type { PayTreatmentResult } from "../payTreatment";
import type { AttendanceBonusResult } from "../attendanceBonusCalc";
import type { EmployeeProfileSnapshot } from "../leaveAggregator";
import type { YtdSummary } from "../ytdCaps";

// ── Fixture helpers ──────────────────────────────────────────────────

function makeProfile(
  partial: Partial<EmployeeProfileSnapshot> = {},
): EmployeeProfileSnapshot {
  return {
    userId: "user-test",
    fullName: "Test User",
    nationalId: null,
    employeeId: null,
    department: null,
    jobTitle: null,
    salaryBase: 45000,
    salaryCurrency: "TWD",
    attendanceBonusMonthly: 3000,
    laborInsuredSalary: 45000,
    nhiInsuredSalary: 45000,
    pensionContributionWage: 45000,
    voluntaryPensionRate: 0,
    nhiDependents: 0,
    bankCode: null,
    bankAccount: null,
    hireDate: new Date("2024-01-15T00:00:00Z"),
    gender: "female",
    terminationDate: null,
    ...partial,
  };
}

function makeYtdSummary(): YtdSummary {
  return {
    byCanonicalKey: {},
    sickHalfPayDaysUsed: 0,
    menstrualSeparateDaysUsed: 0,
    menstrualTotalDaysUsed: 0,
    unclassifiedRecords: [],
    ambiguousRecords: [],
    classifiedRecordCount: 0,
    unclassifiedRecordCount: 0,
  };
}

function makePayTreatment(
  partial: Partial<PayTreatmentResult> = {},
): PayTreatmentResult {
  return {
    deductionAmount: 1500,
    fullPayDays: 0,
    halfPayDays: 1,
    unpaidDays: 0,
    treatmentKind: "half_pay",
    dailyRateUsed: 1500,
    calculationDetail: "Test calculation",
    notes: ["test note"],
    attendanceBonusInteraction: {
      protected: false,
      proportionalDeduction: true,
      note: "test interaction",
    },
    ...partial,
  };
}

function makeOccurrence(
  partial: Partial<LeaveOccurrenceResult> = {},
): LeaveOccurrenceResult {
  return {
    sourceWorkflowSubmissionId: "ws-123",
    leaveTypeRaw: "事假",
    classification: {
      ok: true,
      canonicalKey: "personal_leave",
      canonicalNameZh: "事假",
    },
    daysClaimed: 1,
    daysInPeriod: 1,
    effectiveStart: "2026-04-15",
    payTreatment: makePayTreatment(),
    filteredAsSkipFromPayroll: false,
    ...partial,
  };
}

function makeAttendanceBonus(
  partial: Partial<AttendanceBonusResult> = {},
): AttendanceBonusResult {
  return {
    originalBonus: 3000,
    totalDeduction: 100,
    netBonus: 2900,
    breakdown: [
      {
        sourceWorkflowSubmissionId: "ws-123",
        leaveTypeRaw: "事假",
        canonicalKey: "personal_leave",
        daysInPeriod: 1,
        deductibleDays: 1,
        deductedAmount: 100,
        reason: "Proportional deduction",
      },
    ],
    notes: [],
    calculatorVersion: "phase-3c-v1.0",
    ...partial,
  };
}

function makeEmployee(
  partial: Partial<EmployeeLeaveDeductionResult> = {},
): EmployeeLeaveDeductionResult {
  return {
    userId: "user-test",
    fullName: "Test User",
    profileSnapshot: makeProfile(),
    totalLeaveDeductionAmount: 1500,
    totalUnpaidLeaveDays: 0,
    totalHalfPayLeaveDays: 1,
    totalFullPayLeaveDays: 0,
    ytdSummary: makeYtdSummary(),
    leaveOccurrences: [makeOccurrence()],
    attendanceBonusFlags: {
      anyProtectedLeave: false,
      proportionallyDeductibleDays: 1,
      sickDaysInPeriod: 0,
      perLeaveNotes: [],
    },
    attendanceBonus: makeAttendanceBonus(),
    warnings: [],
    errors: [],
    ...partial,
  };
}

function makeRunResult(
  partial: Partial<LeaveDeductionRunResult> = {},
): LeaveDeductionRunResult {
  return {
    organizationId: "org-test-uuid",
    periodYear: 2026,
    periodMonth: 4,
    periodStartDate: "2026-04-01",
    periodEndDate: "2026-05-01",
    employees: [makeEmployee()],
    runWarnings: [],
    computeTimeMs: 1234,
    calculatorVersion: "phase-3c-v1.0",
    ...partial,
  };
}

// ── 1. Payload top-level fields ──────────────────────────────────────

describe("buildPersistPayload — top-level fields", () => {
  it("populates all required top-level fields", () => {
    const payload = buildPersistPayload({
      runResult: makeRunResult(),
      triggeredBy: "user-trigger",
      triggeredByName: "Trigger Person",
    });

    expect(payload.organization_id).toBe("org-test-uuid");
    expect(payload.period_year).toBe(2026);
    expect(payload.period_month).toBe(4);
    expect(payload.period_start_date).toBe("2026-04-01");
    expect(payload.period_end_date).toBe("2026-05-01");
    expect(payload.calculator_version).toBe("phase-3c-v1.0");
    expect(payload.triggered_by).toBe("user-trigger");
    expect(payload.triggered_by_name).toBe("Trigger Person");
    expect(payload.compute_time_ms).toBe(1234);
  });

  it("derives started_at by back-dating from completed_at + compute_time_ms", () => {
    const fixedCompletedAt = "2026-04-29T10:00:00.000Z";
    const payload = buildPersistPayload({
      runResult: makeRunResult({ computeTimeMs: 5000 }),
      triggeredBy: null,
      triggeredByName: null,
      completedAt: fixedCompletedAt,
    });

    expect(payload.completed_at).toBe(fixedCompletedAt);
    // started_at = completedAt - 5000ms
    expect(payload.started_at).toBe("2026-04-29T09:59:55.000Z");
  });

  it("uses caller-supplied started_at and completed_at if both provided", () => {
    const payload = buildPersistPayload({
      runResult: makeRunResult(),
      triggeredBy: null,
      triggeredByName: null,
      startedAt: "2026-04-29T10:00:00.000Z",
      completedAt: "2026-04-29T10:00:05.000Z",
    });
    expect(payload.started_at).toBe("2026-04-29T10:00:00.000Z");
    expect(payload.completed_at).toBe("2026-04-29T10:00:05.000Z");
  });

  it("accepts null triggered_by and triggered_by_name", () => {
    const payload = buildPersistPayload({
      runResult: makeRunResult(),
      triggeredBy: null,
      triggeredByName: null,
    });
    expect(payload.triggered_by).toBeNull();
    expect(payload.triggered_by_name).toBeNull();
  });

  it("includes run_warnings", () => {
    const payload = buildPersistPayload({
      runResult: makeRunResult({
        runWarnings: ["warning A", "warning B"],
      }),
      triggeredBy: null,
      triggeredByName: null,
    });
    expect(payload.run_warnings).toEqual(["warning A", "warning B"]);
  });
});

// ── 2. Aggregated totals ────────────────────────────────────────────

describe("buildPersistPayload — aggregated totals", () => {
  it("counts total_employees correctly", () => {
    const payload = buildPersistPayload({
      runResult: makeRunResult({
        employees: [
          makeEmployee({ userId: "emp1" }),
          makeEmployee({ userId: "emp2" }),
          makeEmployee({ userId: "emp3" }),
        ],
      }),
      triggeredBy: null,
      triggeredByName: null,
    });
    expect(payload.total_employees).toBe(3);
  });

  it("sums total_leave_deduction_amount across employees", () => {
    const payload = buildPersistPayload({
      runResult: makeRunResult({
        employees: [
          makeEmployee({ totalLeaveDeductionAmount: 1500 }),
          makeEmployee({ totalLeaveDeductionAmount: 750 }),
          makeEmployee({ totalLeaveDeductionAmount: 0 }),
        ],
      }),
      triggeredBy: null,
      triggeredByName: null,
    });
    expect(payload.total_leave_deduction_amount).toBe(2250);
  });

  it("sums total_attendance_bonus_deduction across employees", () => {
    const payload = buildPersistPayload({
      runResult: makeRunResult({
        employees: [
          makeEmployee({
            attendanceBonus: makeAttendanceBonus({ totalDeduction: 100 }),
          }),
          makeEmployee({
            attendanceBonus: makeAttendanceBonus({ totalDeduction: 200 }),
          }),
        ],
      }),
      triggeredBy: null,
      triggeredByName: null,
    });
    expect(payload.total_attendance_bonus_deduction).toBe(300);
  });

  it("handles empty employees array", () => {
    const payload = buildPersistPayload({
      runResult: makeRunResult({ employees: [] }),
      triggeredBy: null,
      triggeredByName: null,
    });
    expect(payload.total_employees).toBe(0);
    expect(payload.total_leave_deduction_amount).toBe(0);
    expect(payload.total_attendance_bonus_deduction).toBe(0);
    expect(payload.line_items).toEqual([]);
  });
});

// ── 3. Leave line items ──────────────────────────────────────────────

describe("buildPersistPayload — leave line items", () => {
  it("creates one line per leave occurrence", () => {
    const payload = buildPersistPayload({
      runResult: makeRunResult({
        employees: [
          makeEmployee({
            leaveOccurrences: [
              makeOccurrence({ sourceWorkflowSubmissionId: "ws-1" }),
              makeOccurrence({ sourceWorkflowSubmissionId: "ws-2" }),
              makeOccurrence({ sourceWorkflowSubmissionId: "ws-3" }),
            ],
          }),
        ],
      }),
      triggeredBy: null,
      triggeredByName: null,
    });

    const leaveLines = payload.line_items.filter(
      (l) => l.line_type === "leave_deduction",
    );
    expect(leaveLines).toHaveLength(3);
    expect(leaveLines.map((l) => l.source_workflow_submission_id)).toEqual([
      "ws-1",
      "ws-2",
      "ws-3",
    ]);
  });

  it("populates leave line item fields from PayTreatmentResult", () => {
    const payload = buildPersistPayload({
      runResult: makeRunResult({
        employees: [
          makeEmployee({
            userId: "user-A",
            leaveOccurrences: [
              makeOccurrence({
                sourceWorkflowSubmissionId: "ws-99",
                leaveTypeRaw: "病假",
                daysInPeriod: 3,
                payTreatment: makePayTreatment({
                  deductionAmount: 2250,
                  halfPayDays: 3,
                  fullPayDays: 0,
                  unpaidDays: 0,
                  treatmentKind: "half_pay_with_ytd_cap",
                  calculationDetail: "3 days half-pay sick",
                  notes: ["legal note"],
                }),
                classification: {
                  ok: true,
                  canonicalKey: "sick_unhospitalized",
                  canonicalNameZh: "普通傷病假",
                },
              }),
            ],
          }),
        ],
      }),
      triggeredBy: null,
      triggeredByName: null,
    });

    const line = payload.line_items[0];
    expect(line.line_type).toBe("leave_deduction");
    expect(line.user_id).toBe("user-A");
    expect(line.amount).toBe(2250);
    expect(line.days).toBe(3);
    expect(line.half_pay_days).toBe(3);
    expect(line.unpaid_days).toBe(0);
    expect(line.full_pay_days).toBe(0);
    expect(line.source_workflow_submission_id).toBe("ws-99");
    expect(line.leave_type_raw).toBe("病假");
    expect(line.canonical_key).toBe("sick_unhospitalized");
    expect(line.audit_payload.calculation_detail).toBe("3 days half-pay sick");
    expect(line.audit_payload.treatment_kind).toBe("half_pay_with_ytd_cap");
    expect(line.audit_payload.notes).toEqual(["legal note"]);
  });

  it("emits 'leave_filtered' line for filtered records (e.g., parental_leave)", () => {
    const payload = buildPersistPayload({
      runResult: makeRunResult({
        employees: [
          makeEmployee({
            leaveOccurrences: [
              makeOccurrence({
                leaveTypeRaw: "育嬰留停",
                filteredAsSkipFromPayroll: true,
                payTreatment: null,
                classification: { ok: true, canonicalKey: "parental_leave", canonicalNameZh: "育嬰留停" },
              }),
            ],
          }),
        ],
      }),
      triggeredBy: null,
      triggeredByName: null,
    });

    const leaveLines = payload.line_items.filter((l) =>
      l.line_type === "leave_filtered",
    );
    expect(leaveLines).toHaveLength(1);
    expect(leaveLines[0].amount).toBe(0);
    expect(leaveLines[0].source_workflow_submission_id).toBeTruthy();
    expect(leaveLines[0].canonical_key).toBe("parental_leave");
  });

  it("handles unclassified leave (canonicalKey = null)", () => {
    const payload = buildPersistPayload({
      runResult: makeRunResult({
        employees: [
          makeEmployee({
            leaveOccurrences: [
              makeOccurrence({
                leaveTypeRaw: "garbage type",
                classification: { ok: false, reason: "unclassified" },
                payTreatment: null,
              }),
            ],
          }),
        ],
      }),
      triggeredBy: null,
      triggeredByName: null,
    });

    const line = payload.line_items[0];
    expect(line.canonical_key).toBeNull();
    expect(line.amount).toBe(0);
  });
});

// ── 4. Attendance bonus line items ──────────────────────────────────

describe("buildPersistPayload — attendance bonus line items", () => {
  it("emits TWO bonus lines (deduction + paid) when bonus > 0", () => {
    const payload = buildPersistPayload({
      runResult: makeRunResult({
        employees: [
          makeEmployee({
            attendanceBonus: makeAttendanceBonus({
              originalBonus: 3000,
              totalDeduction: 100,
              netBonus: 2900,
            }),
          }),
        ],
      }),
      triggeredBy: null,
      triggeredByName: null,
    });

    const bonusLines = payload.line_items.filter((l) =>
      l.line_type.startsWith("attendance_bonus"),
    );
    expect(bonusLines).toHaveLength(2);

    const deduction = bonusLines.find(
      (l) => l.line_type === "attendance_bonus_deduction",
    );
    const paid = bonusLines.find(
      (l) => l.line_type === "attendance_bonus_paid",
    );
    expect(deduction?.amount).toBe(100);
    expect(paid?.amount).toBe(2900);
  });

  it("emits ZERO bonus lines when originalBonus is 0", () => {
    const payload = buildPersistPayload({
      runResult: makeRunResult({
        employees: [
          makeEmployee({
            attendanceBonus: makeAttendanceBonus({
              originalBonus: 0,
              totalDeduction: 0,
              netBonus: 0,
            }),
          }),
        ],
      }),
      triggeredBy: null,
      triggeredByName: null,
    });

    const bonusLines = payload.line_items.filter((l) =>
      l.line_type.startsWith("attendance_bonus"),
    );
    expect(bonusLines).toHaveLength(0);
  });

  it("bonus line items carry full breakdown in audit_payload", () => {
    const payload = buildPersistPayload({
      runResult: makeRunResult({
        employees: [
          makeEmployee({
            attendanceBonus: makeAttendanceBonus({
              originalBonus: 3000,
              totalDeduction: 200,
              netBonus: 2800,
              breakdown: [
                {
                  sourceWorkflowSubmissionId: "ws-A",
                  leaveTypeRaw: "事假",
                  canonicalKey: "personal_leave",
                  daysInPeriod: 2,
                  deductibleDays: 2,
                  deductedAmount: 200,
                  reason: "Proportional",
                },
              ],
            }),
          }),
        ],
      }),
      triggeredBy: null,
      triggeredByName: null,
    });

    const line = payload.line_items.find(
      (l) => l.line_type === "attendance_bonus_deduction",
    );
    expect(line?.audit_payload.original_bonus).toBe(3000);
    const breakdown = line?.audit_payload.breakdown as unknown[];
    expect(breakdown).toHaveLength(1);
  });

  it("bonus deduction line carries no source_workflow_submission_id", () => {
    const payload = buildPersistPayload({
      runResult: makeRunResult(),
      triggeredBy: null,
      triggeredByName: null,
    });

    const bonusLines = payload.line_items.filter((l) =>
      l.line_type.startsWith("attendance_bonus"),
    );
    for (const line of bonusLines) {
      expect(line.source_workflow_submission_id).toBeNull();
      expect(line.canonical_key).toBeNull();
      expect(line.leave_type_raw).toBeNull();
    }
  });
});

// ── 5. Multi-employee scenarios ─────────────────────────────────────

describe("buildPersistPayload — multi-employee scenarios", () => {
  it("flattens line items across multiple employees", () => {
    const payload = buildPersistPayload({
      runResult: makeRunResult({
        employees: [
          makeEmployee({
            userId: "emp1",
            leaveOccurrences: [
              makeOccurrence({ sourceWorkflowSubmissionId: "ws-1a" }),
              makeOccurrence({ sourceWorkflowSubmissionId: "ws-1b" }),
            ],
          }),
          makeEmployee({
            userId: "emp2",
            leaveOccurrences: [
              makeOccurrence({ sourceWorkflowSubmissionId: "ws-2a" }),
            ],
          }),
        ],
      }),
      triggeredBy: null,
      triggeredByName: null,
    });

    // 3 leave lines + 2 bonus lines per employee × 2 employees = 4 bonus lines
    // = 7 total
    const leaveLines = payload.line_items.filter(
      (l) => l.line_type === "leave_deduction",
    );
    const bonusLines = payload.line_items.filter((l) =>
      l.line_type.startsWith("attendance_bonus"),
    );
    expect(leaveLines).toHaveLength(3);
    expect(bonusLines).toHaveLength(4);
    expect(payload.line_items).toHaveLength(7);
  });

  it("preserves user_id correctly across employees", () => {
    const payload = buildPersistPayload({
      runResult: makeRunResult({
        employees: [
          makeEmployee({
            userId: "emp1",
            leaveOccurrences: [makeOccurrence({ sourceWorkflowSubmissionId: "ws-emp1" })],
          }),
          makeEmployee({
            userId: "emp2",
            leaveOccurrences: [makeOccurrence({ sourceWorkflowSubmissionId: "ws-emp2" })],
          }),
        ],
      }),
      triggeredBy: null,
      triggeredByName: null,
    });

    const emp1Lines = payload.line_items.filter((l) => l.user_id === "emp1");
    const emp2Lines = payload.line_items.filter((l) => l.user_id === "emp2");
    expect(emp1Lines.length).toBeGreaterThan(0);
    expect(emp2Lines.length).toBeGreaterThan(0);

    // emp1 lines should all have ws-emp1 (or null for bonus lines)
    for (const line of emp1Lines) {
      if (line.line_type === "leave_deduction") {
        expect(line.source_workflow_submission_id).toBe("ws-emp1");
      }
    }
  });
});

// ── 6. JSON serialization (the payload must be JSON-safe) ──────────

describe("buildPersistPayload — JSON safety", () => {
  it("payload survives JSON.stringify + JSON.parse roundtrip", () => {
    const payload = buildPersistPayload({
      runResult: makeRunResult(),
      triggeredBy: "user-x",
      triggeredByName: "Test",
    });
    const roundtripped = JSON.parse(JSON.stringify(payload));
    expect(roundtripped).toEqual(payload);
  });

  it("audit_payload nested values survive serialization", () => {
    const payload = buildPersistPayload({
      runResult: makeRunResult({
        employees: [
          makeEmployee({
            leaveOccurrences: [
              makeOccurrence({
                payTreatment: makePayTreatment({
                  notes: ["note 1", "note 2", "note 3"],
                  attendanceBonusInteraction: {
                    protected: true,
                    proportionalDeduction: false,
                    note: "nested note",
                  },
                }),
              }),
            ],
          }),
        ],
      }),
      triggeredBy: null,
      triggeredByName: null,
    });

    const json = JSON.stringify(payload);
    const parsed = JSON.parse(json);
    const line = parsed.line_items[0];
    expect(line.audit_payload.notes).toEqual([
      "note 1",
      "note 2",
      "note 3",
    ]);
    expect(line.audit_payload.attendance_bonus_interaction.protected).toBe(
      true,
    );
  });
});
