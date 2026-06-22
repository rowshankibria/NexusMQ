export type PoisonMessageStatus = 'poison' | 'pending_retry' | 'dead_letter';
export type DeadLetterReason = 'max_retries_exceeded' | 'manual_purge' | 'queue_disabled' | 'invalid_message' | 'processing_error';
export type SortDirection = 'asc' | 'desc';
export type PoisonMessageSortField = 'queueName' | 'messageType' | 'movedToPoisonAt' | 'retryCount' | 'lastRetryAt';
export type DeadLetterSortField = 'queueName' | 'messageType' | 'createdAt' | 'reason';

export interface PoisonMessage {
  id: number;
  queueName: string;
  conversationHandle: string;
  conversationGroupId: string;
  messageTypeName: string;
  messageBody: string | null;
  messageBodyPreview: string;
  messageSize: number;
  errorMessage: string;
  errorTrace: string | null;
  retryCount: number;
  maxRetries: number;
  movedToPoisonAt: Date;
  lastRetryAt: Date | null;
  originalEnqueueTime: Date;
  serviceName: string;
  priority: number;
  status: PoisonMessageStatus;
}

export interface DeadLetterMessage {
  id: number;
  queueName: string;
  conversationHandle: string;
  messageTypeName: string;
  messageBody: string | null;
  messageBodyPreview: string;
  messageSize: number;
  reason: DeadLetterReason;
  reasonDescription: string;
  resolutionNotes: string | null;
  createdAt: Date;
  originalEnqueueTime: Date;
  serviceName: string;
  errorMessage: string | null;
  errorTrace: string | null;
}

export interface RetryHistoryEntry {
  attemptNumber: number;
  attemptedAt: Date;
  errorMessage: string;
  errorTrace: string | null;
  success: boolean;
}

export interface PoisonMessageDetail extends PoisonMessage {
  retryHistory: RetryHistoryEntry[];
  queueStatus: QueueStatusInfo;
}

export interface QueueStatusInfo {
  isReceiveEnabled: boolean;
  isEnqueueEnabled: boolean;
  messageCount: number;
  poisonMessageCount: number;
}

export interface PoisonMessageFilter {
  searchTerm: string;
  queueName: string;
  messageType: string;
  sortField: PoisonMessageSortField;
  sortDirection: SortDirection;
}

export interface DeadLetterFilter {
  searchTerm: string;
  queueName: string;
  messageType: string;
  reason: DeadLetterReason | 'all';
  sortField: DeadLetterSortField;
  sortDirection: SortDirection;
}

export interface PoisonMessageStats {
  totalPoisonMessages: number;
  totalDeadLetterMessages: number;
  messagesAwaitingRetry: number;
  oldestPoisonMessageAge: number | null;
  queuesWithPoisonMessages: number;
  recentRetrySuccessRate: number | null;
}

export interface PoisonMessagesState {
  poisonMessages: PoisonMessage[];
  deadLetterMessages: DeadLetterMessage[];
  selectedPoisonMessage: PoisonMessageDetail | null;
  selectedDeadLetterMessage: DeadLetterMessage | null;
  selectedMessages: PoisonMessage[];
  selectedDeadLetters: DeadLetterMessage[];
  stats: PoisonMessageStats | null;
  activeTab: 'poison' | 'dead-letter';
  poisonFilter: PoisonMessageFilter;
  deadLetterFilter: DeadLetterFilter;
  loading: boolean;
  detailLoading: boolean;
  operationLoading: boolean;
  error: string | null;
  totalPoisonMessages: number;
  totalDeadLetterMessages: number;
  currentPage: number;
  pageSize: number;
  lastUpdated: Date | null;
}

export interface BulkRetryResult {
  success: boolean;
  totalRequested: number;
  successCount: number;
  failedCount: number;
  errors: BulkOperationError[];
}

export interface BulkPurgeResult {
  success: boolean;
  totalRequested: number;
  purgedCount: number;
  failedCount: number;
  errors: BulkOperationError[];
}

export interface BulkOperationError {
  id: number;
  conversationHandle: string;
  errorMessage: string;
}

export interface RetryResult {
  success: boolean;
  message: string;
  queueReEnabled: boolean;
}

export interface ResolveDeadLetterRequest {
  resolutionNotes: string;
}

export interface ResolveDeadLetterResult {
  success: boolean;
  message: string;
}

export const deadLetterReasonLabels: Record<DeadLetterReason, string> = {
  'max_retries_exceeded': 'Max Retries Exceeded',
  'manual_purge': 'Manually Purged',
  'queue_disabled': 'Queue Disabled',
  'invalid_message': 'Invalid Message',
  'processing_error': 'Processing Error'
};

export const initialPoisonMessageFilter: PoisonMessageFilter = {
  searchTerm: '',
  queueName: '',
  messageType: '',
  sortField: 'movedToPoisonAt',
  sortDirection: 'desc'
};

export const initialDeadLetterFilter: DeadLetterFilter = {
  searchTerm: '',
  queueName: '',
  messageType: '',
  reason: 'all',
  sortField: 'createdAt',
  sortDirection: 'desc'
};

export const initialPoisonMessagesState: PoisonMessagesState = {
  poisonMessages: [],
  deadLetterMessages: [],
  selectedPoisonMessage: null,
  selectedDeadLetterMessage: null,
  selectedMessages: [],
  selectedDeadLetters: [],
  stats: null,
  activeTab: 'poison',
  poisonFilter: initialPoisonMessageFilter,
  deadLetterFilter: initialDeadLetterFilter,
  loading: false,
  detailLoading: false,
  operationLoading: false,
  error: null,
  totalPoisonMessages: 0,
  totalDeadLetterMessages: 0,
  currentPage: 0,
  pageSize: 25,
  lastUpdated: null
};
