// src/lib/payroll/deductionCalc.ts
export type DeductionResult = {
  amount: number;
  computation: string;
  source: 'fixture' | 'formula';
};

export type BracketFixture = {
  insurance_type: 'labor' | 'nhi' | 'pension';
  level: number;
  insured_amount: number;
  expected_employee_amount: number | null;
  expected_employer_amount: number | null;
  expected_government_amount: number | null;
  expected_employee_1_dep: number | null;
  expected_employee_2_dep: number | null;
  expected_employee_3_dep: number | null;
};

export function calculateLaborInsuranceEmployee(input: {
  insuredAmount: number;
  level: number;
  totalRate: number;
  employeeShare: number;
  fixtures?: BracketFixture[];
}): DeductionResult {
  const fixture = input.fixtures?.find(
    f => f.insurance_type === 'labor' && f.level === input.level,
  );
  if (fixture && fixture.expected_employee_amount !== null) {
    return {
      amount: fixture.expected_employee_amount,
      computation: `lookup: labor level ${input.level} (insured ${input.insuredAmount}) -> employee ${fixture.expected_employee_amount}`,
      source: 'fixture',
    };
  }
  const raw = input.insuredAmount * input.totalRate * input.employeeShare;
  const amount = roundHalfUp(raw);
  return {
    amount,
    computation: `formula: ${input.insuredAmount} * ${input.totalRate} * ${input.employeeShare} = ${raw.toFixed(4)} -> ${amount}`,
    source: 'formula',
  };
}

export function calculateLaborInsuranceEmployer(input: {
  insuredAmount: number;
  level: number;
  totalRate: number;
  employerShare: number;
  fixtures?: BracketFixture[];
}): DeductionResult {
  const fixture = input.fixtures?.find(
    f => f.insurance_type === 'labor' && f.level === input.level,
  );
  if (fixture && fixture.expected_employer_amount !== null) {
    return {
      amount: fixture.expected_employer_amount,
      computation: `lookup: labor level ${input.level} -> employer ${fixture.expected_employer_amount}`,
      source: 'fixture',
    };
  }
  const raw = input.insuredAmount * input.totalRate * input.employerShare;
  const amount = roundHalfUp(raw);
  return {
    amount,
    computation: `formula: ${input.insuredAmount} * ${input.totalRate} * ${input.employerShare} = ${raw.toFixed(4)} -> ${amount}`,
    source: 'formula',
  };
}

export function calculateNhiEmployee(input: {
  insuredAmount: number;
  level: number;
  rate: number;
  employeeShare: number;
  dependents: number;
  dependentCap: number;
  fixtures?: BracketFixture[];
}): DeductionResult {
  const cappedDeps = Math.min(input.dependents, input.dependentCap);
  const fixture = input.fixtures?.find(
    f => f.insurance_type === 'nhi' && f.level === input.level,
  );
  if (fixture) {
    let amount: number | null = null;
    if (cappedDeps === 0) amount = fixture.expected_employee_amount;
    else if (cappedDeps === 1) amount = fixture.expected_employee_1_dep;
    else if (cappedDeps === 2) amount = fixture.expected_employee_2_dep;
    else if (cappedDeps === 3) amount = fixture.expected_employee_3_dep;
    if (amount !== null) {
      return {
        amount,
        computation: `lookup: nhi level ${input.level}, ${cappedDeps} dep${cappedDeps !== 1 ? 's' : ''} -> ${amount}${input.dependents > input.dependentCap ? ` [capped from ${input.dependents}]` : ''}`,
        source: 'fixture',
      };
    }
  }
  const perPersonRaw = input.insuredAmount * input.rate * input.employeeShare;
  const perPerson = roundHalfUp(perPersonRaw);
  const peopleCount = 1 + cappedDeps;
  const amount = perPerson * peopleCount;
  return {
    amount,
    computation: `formula: round(${input.insuredAmount} * ${input.rate} * ${input.employeeShare}) = ${perPerson} * (1 + ${cappedDeps}) = ${amount}`,
    source: 'formula',
  };
}

export function calculateNhiEmployer(input: {
  insuredAmount: number;
  level: number;
  rate: number;
  employerShare: number;
  avgDependents: number;
  fixtures?: BracketFixture[];
}): DeductionResult {
  const fixture = input.fixtures?.find(
    f => f.insurance_type === 'nhi' && f.level === input.level,
  );
  if (fixture && fixture.expected_employer_amount !== null) {
    return {
      amount: fixture.expected_employer_amount,
      computation: `lookup: nhi level ${input.level} -> employer ${fixture.expected_employer_amount}`,
      source: 'fixture',
    };
  }
  const multiplier = 1 + input.avgDependents;
  const raw = input.insuredAmount * input.rate * input.employerShare * multiplier;
  const amount = roundHalfUp(raw);
  return {
    amount,
    computation: `formula: ${input.insuredAmount} * ${input.rate} * ${input.employerShare} * ${multiplier} = ${raw.toFixed(4)} -> ${amount}`,
    source: 'formula',
  };
}

export function calculatePensionEmployer(input: {
  contributionWage: number;
  employerRate: number;
}): DeductionResult {
  const raw = input.contributionWage * input.employerRate;
  const amount = roundHalfUp(raw);
  return {
    amount,
    computation: `${input.contributionWage} * ${input.employerRate} = ${raw.toFixed(4)} -> ${amount}`,
    source: 'formula',
  };
}

export function calculatePensionEmployeeVoluntary(input: {
  contributionWage: number;
  voluntaryRate: number;
}): DeductionResult {
  if (input.voluntaryRate < 0 || input.voluntaryRate > 0.06) {
    throw new Error(
      `Voluntary pension rate must be between 0 and 0.06, got ${input.voluntaryRate}`,
    );
  }
  const raw = input.contributionWage * input.voluntaryRate;
  const amount = roundHalfUp(raw);
  return {
    amount,
    computation: `${input.contributionWage} * ${input.voluntaryRate} (voluntary) = ${raw.toFixed(4)} -> ${amount}`,
    source: 'formula',
  };
}

export function roundHalfUp(value: number): number {
  return Math.floor(value + 0.5 + 1e-9);
}