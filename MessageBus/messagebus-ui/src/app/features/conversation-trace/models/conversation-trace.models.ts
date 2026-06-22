export type ConversationState = 'CO' | 'SO' | 'SI' | 'DI' | 'DO' | 'CD' | 'ER';
export type MessageDirection = 'sent' | 'received';
export type SortDirection = 'asc' | 'desc';
export type ConversationSortField = 'conversationHandle' | 'initiatorService' | 'targetService' | 'state' | 'createdAt' | 'lastActivity' | 'messageCount';

export const conversationStateLabels: Record<ConversationState, string> = {
  'CO': 'Conversing',
  'SO': 'Started Outbound',
  'SI': 'Started Inbound',
  'DI': 'Disconnected Inbound',
  'DO': 'Disconnected Outbound',
  'CD': 'Closed',
  'ER': 'Error'
};

export const conversationStateColors: Record<ConversationState, string> = {
  'CO': 'info',
  'SO': 'info',
  'SI': 'info',
  'DI': 'warning',
  'DO': 'warning',
  'CD': 'success',
  'ER': 'danger'
};

export interface Conversation {
  conversationHandle: string;
  conversationId: string;
  conversationGroupId: string;
  initiatorService: string;
  targetService: string;
  contractName: string;
  state: ConversationState;
  stateDescription: string;
  isInitiator: boolean;
  farService: string;
  lifetime: number | null;
  createdAt: Date;
  lastActivity: Date | null;
  messageCount: number;
  dialogTimer: Date | null;
}

export interface ConversationMessage {
  id: string;
  sequenceNumber: number;
  messageType: string;
  messageBody: string | null;
  messageBodyPreview: string;
  messageSize: number;
  direction: MessageDirection;
  sentTimestamp: Date;
  receivedTimestamp: Date | null;
  processingDuration: number | null;
  priority: number;
  validation: string;
  status: 'pending' | 'sent' | 'received' | 'processed' | 'error';
  errorMessage: string | null;
}

export interface ConversationTimeline {
  conversation: Conversation;
  messages: ConversationMessage[];
  stateTransitions: StateTransition[];
}

export interface StateTransition {
  fromState: ConversationState | null;
  toState: ConversationState;
  transitionTime: Date;
  triggeredBy: string | null;
  messageSequenceNumber: number | null;
}

export interface ConversationFilter {
  state: ConversationState | 'all' | 'active' | 'closed' | 'error';
  dateFrom: Date | null;
  dateTo: Date | null;
  searchTerm: string;
  initiatorService: string;
  targetService: string;
  sortField: ConversationSortField;
  sortDirection: SortDirection;
}

export interface ConversationStats {
  totalConversations: number;
  activeConversations: number;
  closedConversations: number;
  errorConversations: number;
  averageMessageCount: number;
  averageDuration: number | null;
}

export interface ConversationTraceState {
  conversations: Conversation[];
  selectedConversation: Conversation | null;
  timeline: ConversationTimeline | null;
  selectedMessage: ConversationMessage | null;
  stats: ConversationStats | null;
  filter: ConversationFilter;
  loading: boolean;
  timelineLoading: boolean;
  error: string | null;
  totalConversations: number;
  currentPage: number;
  pageSize: number;
  lastUpdated: Date | null;
}

export interface ExportOptions {
  format: 'json' | 'csv';
  includeMessageBodies: boolean;
  includeStateTransitions: boolean;
}

export const initialConversationFilter: ConversationFilter = {
  state: 'all',
  dateFrom: null,
  dateTo: null,
  searchTerm: '',
  initiatorService: '',
  targetService: '',
  sortField: 'lastActivity',
  sortDirection: 'desc'
};

export const initialConversationTraceState: ConversationTraceState = {
  conversations: [],
  selectedConversation: null,
  timeline: null,
  selectedMessage: null,
  stats: null,
  filter: initialConversationFilter,
  loading: false,
  timelineLoading: false,
  error: null,
  totalConversations: 0,
  currentPage: 0,
  pageSize: 25,
  lastUpdated: null
};
