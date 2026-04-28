import { describe, it, expect } from 'vitest';
import {
  calculateLaborInsuranceEmployee,
  calculateLaborInsuranceEmployer,
  calculateNhiEmployee,
  calculateNhiEmployer,
  calculatePensionEmployer,
  calculatePensionEmployeeVoluntary,
  roundHalfUp,
  type BracketFixture,
} from '../deductionCalc';
import {
  findLaborInsuranceBracket,
  type LaborInsuranceBracket,
} from '../bracketLookup';

const LABOR_TOTAL = 0.125;
const LABOR_EE = 0.20;
const LABOR_ER = 0.70;
const NHI_RATE = 0.0517;
const NHI_EE = 0.30;
const NHI_ER = 0.60;
const NHI_AVG_DEPS = 0.56;
const NHI_DEP_CAP = 3;

const LABOR_FIXTURES: BracketFixture[] = [
  { insurance_type: 'labor', level: 1, insured_amount: 29500, expected_employee_amount: 738, expected_employer_amount: 2582, expected_government_amount: 369, expected_employee_1_dep: null, expected_employee_2_dep: null, expected_employee_3_dep: null },
  { insurance_type: 'labor', level: 2, insured_amount: 30300, expected_employee_amount: 758, expected_employer_amount: 2651, expected_government_amount: 379, expected_employee_1_dep: null, expected_employee_2_dep: null, expected_employee_3_dep: null },
  { insurance_type: 'labor', level: 3, insured_amount: 31800, expected_employee_amount: 795, expected_employer_amount: 2783, expected_government_amount: 398, expected_employee_1_dep: null, expected_employee_2_dep: null, expected_employee_3_dep: null },
  { insurance_type: 'labor', level: 4, insured_amount: 33300, expected_employee_amount: 833, expected_employer_amount: 2914, expected_government_amount: 416, expected_employee_1_dep: null, expected_employee_2_dep: null, expected_employee_3_dep: null },
  { insurance_type: 'labor', level: 5, insured_amount: 34800, expected_employee_amount: 870, expected_employer_amount: 3045, expected_government_amount: 435, expected_employee_1_dep: null, expected_employee_2_dep: null, expected_employee_3_dep: null },
  { insurance_type: 'labor', level: 6, insured_amount: 36300, expected_employee_amount: 908, expected_employer_amount: 3176, expected_government_amount: 454, expected_employee_1_dep: null, expected_employee_2_dep: null, expected_employee_3_dep: null },
  { insurance_type: 'labor', level: 7, insured_amount: 38200, expected_employee_amount: 955, expected_employer_amount: 3342, expected_government_amount: 478, expected_employee_1_dep: null, expected_employee_2_dep: null, expected_employee_3_dep: null },
  { insurance_type: 'labor', level: 8, insured_amount: 40100, expected_employee_amount: 1002, expected_employer_amount: 3509, expected_government_amount: 501, expected_employee_1_dep: null, expected_employee_2_dep: null, expected_employee_3_dep: null },
  { insurance_type: 'labor', level: 9, insured_amount: 42000, expected_employee_amount: 1050, expected_employer_amount: 3675, expected_government_amount: 525, expected_employee_1_dep: null, expected_employee_2_dep: null, expected_employee_3_dep: null },
  { insurance_type: 'labor', level: 10, insured_amount: 43900, expected_employee_amount: 1098, expected_employer_amount: 3841, expected_government_amount: 549, expected_employee_1_dep: null, expected_employee_2_dep: null, expected_employee_3_dep: null },
  { insurance_type: 'labor', level: 11, insured_amount: 45800, expected_employee_amount: 1145, expected_employer_amount: 4008, expected_government_amount: 573, expected_employee_1_dep: null, expected_employee_2_dep: null, expected_employee_3_dep: null },
];

const NHI_SAMPLE_FIXTURES: BracketFixture[] = [
  { insurance_type: 'nhi', level: 1, insured_amount: 29500, expected_employee_amount: 458, expected_employer_amount: 1428, expected_government_amount: 238, expected_employee_1_dep: 916, expected_employee_2_dep: 1374, expected_employee_3_dep: 1832 },
  { insurance_type: 'nhi', level: 11, insured_amount: 45800, expected_employee_amount: 710, expected_employer_amount: 2216, expected_government_amount: 369, expected_employee_1_dep: 1420, expected_employee_2_dep: 2130, expected_employee_3_dep: 2840 },
  { insurance_type: 'nhi', level: 38, insured_amount: 150000, expected_employee_amount: 2327, expected_employer_amount: 7259, expected_government_amount: 1210, expected_employee_1_dep: 4654, expected_employee_2_dep: 6981, expected_employee_3_dep: 9308 },
  { insurance_type: 'nhi', level: 58, insured_amount: 313000, expected_employee_amount: 4855, expected_employer_amount: 15146, expected_government_amount: 2524, expected_employee_1_dep: 9710, expected_employee_2_dep: 14565, expected_employee_3_dep: 19420 },
];

const LABOR_BRACKETS: LaborInsuranceBracket[] = [
  { id: '1', effective_from: '2026-01-01', effective_to: null, level: 1, salary_floor: 0, salary_ceiling: 29500, insured_amount: 29500 },
  { id: '2', effective_from: '2026-01-01', effective_to: null, level: 2, salary_floor: 29501, salary_ceiling: 30300, insured_amount: 30300 },
  { id: '11', effective_from: '2026-01-01', effective_to: null, level: 11, salary_floor: 43901, salary_ceiling: null, insured_amount: 45800 },
];

describe('findLaborInsuranceBracket', () => {
  it('returns lowest bracket for salary at or below floor', () => {
    expect(findLaborInsuranceBracket(0, LABOR_BRACKETS)?.level).toBe(1);
    expect(findLaborInsuranceBracket(29500, LABOR_BRACKETS)?.level).toBe(1);
  });

  it('returns top bracket for salary above all ceilings', () => {
    expect(findLaborInsuranceBracket(60000, LABOR_BRACKETS)?.level).toBe(11);
    expect(findLaborInsuranceBracket(1000000, LABOR_BRACKETS)?.level).toBe(11);
  });

  it('returns correct mid-range bracket', () => {
    expect(findLaborInsuranceBracket(30000, LABOR_BRACKETS)?.level).toBe(2);
    expect(findLaborInsuranceBracket(30300, LABOR_BRACKETS)?.level).toBe(2);
    expect(findLaborInsuranceBracket(30301, LABOR_BRACKETS)?.level).toBe(11);
  });

  it('returns null for empty brackets array', () => {
    expect(findLaborInsuranceBracket(30000, [])).toBeNull();
  });

  it('handles unsorted input', () => {
    const reversed = [...LABOR_BRACKETS].reverse();
    expect(findLaborInsuranceBracket(30000, reversed)?.level).toBe(2);
  });
});

describe('calculateLaborInsuranceEmployee — fixture reconciliation', () => {
  for (const fixture of LABOR_FIXTURES) {
    it(`level ${fixture.level} (insured ${fixture.insured_amount}) employee = ${fixture.expected_employee_amount}`, () => {
      const result = calculateLaborInsuranceEmployee({
        insuredAmount: fixture.insured_amount,
        level: fixture.level,
        totalRate: LABOR_TOTAL,
        employeeShare: LABOR_EE,
        fixtures: LABOR_FIXTURES,
      });
      expect(result.amount).toBe(fixture.expected_employee_amount);
      expect(result.source).toBe('fixture');
    });
  }
});

describe('calculateLaborInsuranceEmployer — fixture reconciliation', () => {
  for (const fixture of LABOR_FIXTURES) {
    it(`level ${fixture.level} employer = ${fixture.expected_employer_amount}`, () => {
      const result = calculateLaborInsuranceEmployer({
        insuredAmount: fixture.insured_amount,
        level: fixture.level,
        totalRate: LABOR_TOTAL,
        employerShare: LABOR_ER,
        fixtures: LABOR_FIXTURES,
      });
      expect(result.amount).toBe(fixture.expected_employer_amount);
      expect(result.source).toBe('fixture');
    });
  }
});

describe('calculateLaborInsuranceEmployee — formula fallback', () => {
  it('uses formula when no fixtures provided', () => {
    const result = calculateLaborInsuranceEmployee({
      insuredAmount: 30300,
      level: 2,
      totalRate: LABOR_TOTAL,
      employeeShare: LABOR_EE,
    });
    expect(result.source).toBe('formula');
    expect(result.amount).toBe(758);
  });
});

describe('calculateNhiEmployee — fixture reconciliation', () => {
  for (const fixture of NHI_SAMPLE_FIXTURES) {
    for (const deps of [0, 1, 2, 3]) {
      const expected =
        deps === 0 ? fixture.expected_employee_amount :
        deps === 1 ? fixture.expected_employee_1_dep :
        deps === 2 ? fixture.expected_employee_2_dep :
                     fixture.expected_employee_3_dep;
      it(`level ${fixture.level}, ${deps} dep${deps !== 1 ? 's' : ''} = ${expected}`, () => {
        const result = calculateNhiEmployee({
          insuredAmount: fixture.insured_amount,
          level: fixture.level,
          rate: NHI_RATE,
          employeeShare: NHI_EE,
          dependents: deps,
          dependentCap: NHI_DEP_CAP,
          fixtures: NHI_SAMPLE_FIXTURES,
        });
        expect(result.amount).toBe(expected);
        expect(result.source).toBe('fixture');
      });
    }
  }
});

describe('calculateNhiEmployee — dependent cap', () => {
  it('caps dependents at the legal limit (3)', () => {
    const result = calculateNhiEmployee({
      insuredAmount: 29500,
      level: 1,
      rate: NHI_RATE,
      employeeShare: NHI_EE,
      dependents: 5,
      dependentCap: 3,
      fixtures: NHI_SAMPLE_FIXTURES,
    });
    expect(result.amount).toBe(1832);
    expect(result.computation).toContain('capped from 5');
  });
});

describe('calculateNhiEmployer — fixture reconciliation', () => {
  for (const fixture of NHI_SAMPLE_FIXTURES) {
    it(`level ${fixture.level} employer = ${fixture.expected_employer_amount}`, () => {
      const result = calculateNhiEmployer({
        insuredAmount: fixture.insured_amount,
        level: fixture.level,
        rate: NHI_RATE,
        employerShare: NHI_ER,
        avgDependents: NHI_AVG_DEPS,
        fixtures: NHI_SAMPLE_FIXTURES,
      });
      expect(result.amount).toBe(fixture.expected_employer_amount);
      expect(result.source).toBe('fixture');
    });
  }
});

describe('calculatePensionEmployer', () => {
  it.each([
    [1500, 90],
    [29500, 1770],
    [45800, 2748],
    [72800, 4368],
    [92100, 5526],
    [115500, 6930],
    [150000, 9000],
  ])('contribution wage %i = %i', (wage, expected) => {
    const result = calculatePensionEmployer({
      contributionWage: wage,
      employerRate: 0.06,
    });
    expect(result.amount).toBe(expected);
  });
});

describe('calculatePensionEmployeeVoluntary', () => {
  it('returns 0 when voluntary rate is 0', () => {
    expect(calculatePensionEmployeeVoluntary({ contributionWage: 50000, voluntaryRate: 0 }).amount).toBe(0);
  });

  it('calculates 6% maximum voluntary correctly', () => {
    expect(calculatePensionEmployeeVoluntary({ contributionWage: 50000, voluntaryRate: 0.06 }).amount).toBe(3000);
  });

  it('throws on rate above legal max (0.06)', () => {
    expect(() =>
      calculatePensionEmployeeVoluntary({ contributionWage: 50000, voluntaryRate: 0.07 }),
    ).toThrow(/between 0 and 0.06/);
  });

  it('throws on negative rate', () => {
    expect(() =>
      calculatePensionEmployeeVoluntary({ contributionWage: 50000, voluntaryRate: -0.01 }),
    ).toThrow();
  });
});

describe('roundHalfUp', () => {
  it('rounds .5 up (half up rule)', () => {
    expect(roundHalfUp(2.5)).toBe(3);
    expect(roundHalfUp(737.5)).toBe(738);
  });

  it('rounds .49999... up (FP-safe)', () => {
    expect(roundHalfUp(45800 * 0.125 * 0.70)).toBe(4008);
  });

  it('rounds below .5 down', () => {
    expect(roundHalfUp(2.4)).toBe(2);
    expect(roundHalfUp(737.4)).toBe(737);
  });

  it('handles integer values', () => {
    expect(roundHalfUp(100)).toBe(100);
    expect(roundHalfUp(0)).toBe(0);
  });
});