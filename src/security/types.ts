export interface SecurityHeader {
  name: string;
  value: string;
  status: 'ACTIVE' | 'WARNING' | 'CONFIGURED';
  description: string;
  recommendation: string;
}

export type PenetrationVectorCategory =
  | 'IDOR_CROSS_TENANT'
  | 'IDOR_CROSS_BRANCH'
  | 'LEAST_PRIVILEGE_RBAC'
  | 'BRUTE_FORCE'
  | 'STORED_XSS'
  | 'AUDIT_TAMPERING'
  | 'RATE_LIMIT_FLOOD'
  | 'SESSION_HIJACK';

export interface PenetrationTestResult {
  id: string;
  category: PenetrationVectorCategory;
  name: string;
  targetEndpoint: string;
  payload: Record<string, any>;
  expectedStatus: number;
  receivedStatus: number;
  passed: boolean;
  blockedBy: string;
  remediation: string;
  executedAt: string;
  durationMs: number;
}

export interface RateLimitBucket {
  endpoint: string;
  limitPerMinute: number;
  currentRequests: number;
  blockedUntil: number | null;
  lastRequestTime: number;
}

export interface SecurityIncident {
  id: string;
  timestamp: string;
  severity: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
  threatType: string;
  sourceIp: string;
  targetedUserOrResource: string;
  actionTaken: string;
  details: string;
}
