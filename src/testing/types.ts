export type TestType = 'UNIT' | 'INTEGRATION' | 'E2E';

export type TestStatus = 'PENDING' | 'RUNNING' | 'PASSED' | 'FAILED';

export interface TestAssertion {
  description: string;
  expected: any;
  actual: any;
  passed: boolean;
}

export interface TestCase {
  id: string;
  suiteId: string;
  type: TestType;
  name: string;
  description: string;
  tags: string[];
  status: TestStatus;
  durationMs?: number;
  assertions: TestAssertion[];
  errorMessage?: string;
  logs?: string[];
  scenarioSteps?: string[];
}

export interface TestSuite {
  id: string;
  title: string;
  type: TestType;
  description: string;
  cases: TestCase[];
}

export interface TestRunSummary {
  totalSuites: number;
  totalTests: number;
  totalAssertions: number;
  passed: number;
  failed: number;
  durationMs: number;
  executedAt: string;
}
