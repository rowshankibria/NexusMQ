// Health and Status Types
export type HealthLevel = 'Healthy' | 'Warning' | 'Critical' | 'Unknown';
export type TransmissionStatus = 'Pending' | 'Scheduled' | 'Retrying' | 'Failed';
export type AlertSeverity = 'Info' | 'Warning' | 'Critical';
export type AlertAction = 'Email' | 'Webhook' | 'Slack';
export type MetricType = 'QueueDepth' | 'MessageAge' | 'ErrorRate' | 'PoisonCount' | 'ThroughputRate';
export type TimeRange = '1h' | '6h' | '24h' | '7d';

// Broker Status
export interface BrokerStatusInfo {
  databaseName: string;
  brokerGuid: string;
  status: string;
  statusLevel: HealthLevel;
  serverName: string;
  isEnabled: boolean;
  warnings: string[];
  lastChecked: Date;
}

export interface DatabaseBrokerStatus {
  databaseName: string;
  isEnabled: boolean;
  brokerGuid: string;
  serviceCount: number;
  queueCount: number;
  activeConversations: number;
}

export interface BrokerStatusSummary {
  overallHealth: HealthLevel;
  databases: DatabaseBrokerStatus[];
  warnings: ConfigurationWarning[];
  lastChecked: Date;
}

export interface ConfigurationWarning {
  level: 'Warning' | 'Critical';
  category: string;
  message: string;
  recommendation: string;
}

// Transmission Queue
export interface TransmissionQueueEntry {
  id: string;
  targetServiceName: string;
  transmissionStatus: TransmissionStatus;
  timeStuckMinutes: number;
  errorDescription: string | null;
  retryCount: number;
  messageSize: number;
  enqueuedTime: Date;
  lastRetryTime: Date | null;
  conversationHandle: string;
}

export interface TransmissionQueueFilter {
  stuckOnly: boolean;
  targetService: string;
  status: TransmissionStatus | 'All';
  minStuckMinutes: number;
}

// Dialog Errors
export interface DialogError {
  id: string;
  conversationHandle: string;
  initiatorServiceName: string;
  targetServiceName: string;
  errorDescription: string;
  errorCode: number;
  timeSinceErrorMinutes: number;
  errorTime: Date;
  dialogState: string;
}

export interface DialogErrorFilter {
  serviceName: string;
  minAgeMinutes: number;
}

// Performance Metrics
export interface MetricDataPoint {
  timestamp: Date;
  value: number;
}

export interface MessageRateMetric {
  timeRange: TimeRange;
  dataPoints: MetricDataPoint[];
  averageRate: number;
  peakRate: number;
  currentRate: number;
}

export interface QueueDepthTrend {
  timeRange: TimeRange;
  dataPoints: MetricDataPoint[];
  currentDepth: number;
  maxDepth: number;
  minDepth: number;
  trend: 'Increasing' | 'Decreasing' | 'Stable';
}

export interface QueueProcessingTime {
  queueName: string;
  averageProcessingMs: number;
  maxProcessingMs: number;
  messageCount: number;
}

export interface ServiceActivity {
  serviceName: string;
  messagesReceived: number;
  messagesSent: number;
  activeConversations: number;
  lastActivity: Date;
}

export interface ConversationAgeDistribution {
  ageRangeMinutes: string;
  count: number;
  percentage: number;
}

export interface PerformanceMetrics {
  messageRate: MessageRateMetric;
  queueDepthTrend: QueueDepthTrend;
  slowestQueues: QueueProcessingTime[];
  mostActiveServices: ServiceActivity[];
  conversationAgeDistribution: ConversationAgeDistribution[];
}

// Alert Rules
export interface AlertRule {
  id: string;
  name: string;
  description: string;
  metricType: MetricType;
  condition: AlertCondition;
  threshold: number;
  duration: number; // minutes
  severity: AlertSeverity;
  isEnabled: boolean;
  actions: AlertActionConfig[];
  createdAt: Date;
  updatedAt: Date;
  lastTriggered: Date | null;
}

export interface AlertCondition {
  operator: 'GreaterThan' | 'LessThan' | 'Equals' | 'GreaterOrEqual' | 'LessOrEqual';
  value: number;
}

export interface AlertActionConfig {
  type: AlertAction;
  config: EmailConfig | WebhookConfig | SlackConfig;
}

export interface EmailConfig {
  recipients: string[];
  subject?: string;
}

export interface WebhookConfig {
  url: string;
  method: 'POST' | 'PUT';
  headers?: Record<string, string>;
}

export interface SlackConfig {
  webhookUrl: string;
  channel?: string;
  username?: string;
}

export interface AlertRuleFormData {
  name: string;
  description: string;
  metricType: MetricType;
  operator: AlertCondition['operator'];
  threshold: number;
  duration: number;
  severity: AlertSeverity;
  isEnabled: boolean;
  actions: AlertActionConfig[];
}

// Health Checks
export type HealthCheckType =
  | 'BrokerEnabled'
  | 'OrphanedConversations'
  | 'OldMessages'
  | 'ServiceQueues'
  | 'ContractValidity'
  | 'MessageTypeDefinitions';

export interface HealthCheckResult {
  checkType: HealthCheckType;
  name: string;
  status: HealthLevel;
  message: string;
  details: HealthCheckDetail[];
  executedAt: Date;
  durationMs: number;
}

export interface HealthCheckDetail {
  item: string;
  status: HealthLevel;
  message: string;
  metadata?: Record<string, unknown>;
}

export interface HealthCheckRequest {
  checkType: HealthCheckType;
  parameters?: Record<string, unknown>;
}

// State Management
export interface DiagnosticsState {
  // Broker status
  brokerStatus: BrokerStatusSummary | null;
  brokerStatusLoading: boolean;

  // Transmission queue
  transmissionQueue: TransmissionQueueEntry[];
  transmissionQueueFilter: TransmissionQueueFilter;
  transmissionQueueLoading: boolean;

  // Dialog errors
  dialogErrors: DialogError[];
  dialogErrorFilter: DialogErrorFilter;
  dialogErrorsLoading: boolean;

  // Performance metrics
  performanceMetrics: PerformanceMetrics | null;
  metricsTimeRange: TimeRange;
  metricsLoading: boolean;

  // Alert rules
  alertRules: AlertRule[];
  alertRulesLoading: boolean;
  editingRule: AlertRule | null;

  // Health checks
  healthCheckResults: HealthCheckResult[];
  healthCheckRunning: HealthCheckType | null;

  // General
  activeTab: DiagnosticsTab;
  error: string | null;
  lastUpdated: Date | null;
}

export type DiagnosticsTab =
  | 'broker-status'
  | 'transmission-queue'
  | 'dialog-errors'
  | 'performance'
  | 'alerts'
  | 'health-checks';

// Initial State
export const initialDiagnosticsState: DiagnosticsState = {
  brokerStatus: null,
  brokerStatusLoading: false,
  transmissionQueue: [],
  transmissionQueueFilter: {
    stuckOnly: false,
    targetService: '',
    status: 'All',
    minStuckMinutes: 0
  },
  transmissionQueueLoading: false,
  dialogErrors: [],
  dialogErrorFilter: {
    serviceName: '',
    minAgeMinutes: 0
  },
  dialogErrorsLoading: false,
  performanceMetrics: null,
  metricsTimeRange: '1h',
  metricsLoading: false,
  alertRules: [],
  alertRulesLoading: false,
  editingRule: null,
  healthCheckResults: [],
  healthCheckRunning: null,
  activeTab: 'broker-status',
  error: null,
  lastUpdated: null
};

// Labels and Display Maps
export const healthLevelLabels: Record<HealthLevel, string> = {
  Healthy: 'Healthy',
  Warning: 'Warning',
  Critical: 'Critical',
  Unknown: 'Unknown'
};

export const healthLevelColors: Record<HealthLevel, string> = {
  Healthy: '#28a745',
  Warning: '#ffc107',
  Critical: '#dc3545',
  Unknown: '#6c757d'
};

export const transmissionStatusLabels: Record<TransmissionStatus, string> = {
  Pending: 'Pending',
  Scheduled: 'Scheduled',
  Retrying: 'Retrying',
  Failed: 'Failed'
};

export const metricTypeLabels: Record<MetricType, string> = {
  QueueDepth: 'Queue Depth',
  MessageAge: 'Message Age',
  ErrorRate: 'Error Rate',
  PoisonCount: 'Poison Message Count',
  ThroughputRate: 'Throughput Rate'
};

export const alertSeverityLabels: Record<AlertSeverity, string> = {
  Info: 'Info',
  Warning: 'Warning',
  Critical: 'Critical'
};

export const alertActionLabels: Record<AlertAction, string> = {
  Email: 'Email',
  Webhook: 'Webhook',
  Slack: 'Slack'
};

export const healthCheckTypeLabels: Record<HealthCheckType, string> = {
  BrokerEnabled: 'Verify Service Broker Enabled',
  OrphanedConversations: 'Check for Orphaned Conversations',
  OldMessages: 'Scan for Old Messages',
  ServiceQueues: 'Verify Service Queues',
  ContractValidity: 'Check Contract Validity',
  MessageTypeDefinitions: 'Validate Message Type Definitions'
};

export const diagnosticsTabLabels: Record<DiagnosticsTab, string> = {
  'broker-status': 'Broker Status',
  'transmission-queue': 'Transmission Queue',
  'dialog-errors': 'Dialog Errors',
  'performance': 'Performance Metrics',
  'alerts': 'Alert Rules',
  'health-checks': 'Health Checks'
};
