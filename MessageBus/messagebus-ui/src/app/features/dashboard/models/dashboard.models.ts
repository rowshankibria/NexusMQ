export type HealthLevel = 'Healthy' | 'Warning' | 'Critical' | 'Unknown';
export type QueueStatus = 'active' | 'idle' | 'disabled' | 'poison';

export interface SystemHealth {
  overallStatus: HealthLevel;
  totalServices: number;
  activeConversations: number;
  totalQueueDepth: number;
  criticalIssues: number;
  warnings: number;
  checkTimestamp: Date;
  recommendation: string;
}

export interface QueueHealth {
  queueName: string;
  displayName: string;
  status: QueueStatus;
  statusLevel: HealthLevel;
  messageCount: number;
  oldestMessageAge: number | null;
  isReceiveEnabled: boolean;
  isActivationEnabled: boolean;
  throughputPerMinute: number;
  errors: number;
}

export interface ThroughputData {
  timestamp: Date;
  messagesReceived: number;
  messagesSent: number;
  messagesProcessed: number;
}

export interface ThroughputSummary {
  timeRange: TimeRange;
  dataPoints: ThroughputData[];
  totalReceived: number;
  totalSent: number;
  totalProcessed: number;
  averageThroughput: number;
  peakThroughput: number;
}

export type TimeRange = '1h' | '6h' | '24h';

export interface DeadLetterSummary {
  poisonMessageCount: number;
  deadLetterCount: number;
  oldestPoisonAge: number | null;
  oldestDeadLetterAge: number | null;
  recentPoisonMessages: PoisonMessageInfo[];
}

export interface PoisonMessageInfo {
  id: string;
  queueName: string;
  errorMessage: string;
  timestamp: Date;
  retryCount: number;
}

export interface BrokerStatus {
  databaseName: string;
  brokerGuid: string;
  status: string;
  statusLevel: HealthLevel;
  serverName: string;
  isEnabled: boolean;
  warnings: string[];
}

export interface DashboardState {
  systemHealth: SystemHealth | null;
  queueHealthList: QueueHealth[];
  throughput: ThroughputSummary | null;
  deadLetterSummary: DeadLetterSummary | null;
  brokerStatus: BrokerStatus | null;
  loading: boolean;
  error: string | null;
  lastUpdated: Date | null;
}

export interface DashboardMetrics {
  queueDepth: MetricSnapshot;
  throughput: MetricSnapshot;
  errorRate: MetricSnapshot;
  avgProcessingTime: MetricSnapshot;
}

export interface MetricSnapshot {
  current: number;
  previous: number;
  trend: 'up' | 'down' | 'stable';
  percentChange: number;
}
