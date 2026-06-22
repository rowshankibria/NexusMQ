export type QueueStatus = 'active' | 'idle' | 'disabled' | 'poison';
export type HealthLevel = 'Healthy' | 'Warning' | 'Critical' | 'Unknown';
export type MessageStatus = 'ready' | 'retained' | 'received' | 'poison';
export type SortDirection = 'asc' | 'desc';
export type QueueSortField = 'name' | 'messageCount' | 'age';

export interface Queue {
  queueId: number;
  queueName: string;
  displayName: string;
  serviceName: string;
  status: QueueStatus;
  statusLevel: HealthLevel;
  messageCount: number;
  poisonMessageCount: number;
  oldestMessageAge: number | null;
  averageMessageAge: number | null;
  isReceiveEnabled: boolean;
  isEnqueueEnabled: boolean;
  isActivationEnabled: boolean;
  activationProcedure: string | null;
  maxReaders: number;
  throughputPerMinute: number;
  createdAt: Date;
}

export interface QueueStatistics {
  queueName: string;
  totalMessages: number;
  readyMessages: number;
  retainedMessages: number;
  receivedMessages: number;
  poisonMessages: number;
  oldestMessageAge: number | null;
  averageMessageAge: number | null;
  messagesReceivedPerMinute: number;
  messagesSentPerMinute: number;
  averageProcessingTime: number | null;
}

export interface QueueMessage {
  conversationHandle: string;
  conversationGroupId: string;
  sequenceNumber: number;
  messageTypeName: string;
  messageBody: string | null;
  messageBodyPreview: string;
  priority: number;
  status: MessageStatus;
  validation: string;
  messageSize: number;
  enqueuedTime: Date;
  age: number;
  serviceName: string;
}

export interface QueueFilter {
  searchTerm: string;
  status: QueueStatus | 'all';
  sortField: QueueSortField;
  sortDirection: SortDirection;
}

export interface MessageFilter {
  messageType: string;
  status: MessageStatus | 'all';
}

export interface MessagePageRequest {
  queueName: string;
  page: number;
  pageSize: number;
  sortColumn: string;
  sortDirection: SortDirection;
  messageType?: string;
  status?: MessageStatus | 'all';
}

export interface MessagePageResponse {
  messages: QueueMessage[];
  totalCount: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export interface QueueExplorerState {
  queues: Queue[];
  filteredQueues: Queue[];
  selectedQueue: Queue | null;
  selectedQueueStats: QueueStatistics | null;
  messages: QueueMessage[];
  totalMessages: number;
  currentPage: number;
  pageSize: number;
  selectedMessages: QueueMessage[];
  filter: QueueFilter;
  messageFilter: MessageFilter;
  loading: boolean;
  messagesLoading: boolean;
  error: string | null;
  lastUpdated: Date | null;
}

export interface BulkMessageAction {
  action: 'delete' | 'markReceived' | 'exportJson';
  conversationHandles: string[];
}

export interface BulkActionResult {
  success: boolean;
  processedCount: number;
  failedCount: number;
  errors: string[];
}

export interface PurgeQueueRequest {
  queueName: string;
  confirm: boolean;
}

export interface PurgeQueueResult {
  success: boolean;
  messagesDeleted: number;
  message: string;
}

export const initialQueueFilter: QueueFilter = {
  searchTerm: '',
  status: 'all',
  sortField: 'name',
  sortDirection: 'asc'
};

export const initialMessageFilter: MessageFilter = {
  messageType: '',
  status: 'all'
};

export const initialQueueExplorerState: QueueExplorerState = {
  queues: [],
  filteredQueues: [],
  selectedQueue: null,
  selectedQueueStats: null,
  messages: [],
  totalMessages: 0,
  currentPage: 0,
  pageSize: 25,
  selectedMessages: [],
  filter: initialQueueFilter,
  messageFilter: initialMessageFilter,
  loading: false,
  messagesLoading: false,
  error: null,
  lastUpdated: null
};
