export type MessageFormat = 'text' | 'json' | 'xml' | 'binary';
export type DialogState = 'conversing' | 'disconnected_inbound' | 'disconnected_outbound' | 'error' | 'closed';
export type ConversationState = 'active' | 'ended' | 'error';

export interface MessageMetadata {
  conversationHandle: string;
  conversationId: string;
  conversationGroupId: string;
  messageTypeName: string;
  sequenceNumber: number;
  priority: number;
  status: string;
  enqueuedTime: Date;
  messageSize: number;
  validation: string;
  serviceName: string;
  queueName: string;
}

export interface MessageBody {
  content: string | null;
  format: MessageFormat;
  isBase64Encoded: boolean;
  rawBytes: number[] | null;
}

export interface ConversationContext {
  conversationHandle: string;
  conversationId: string;
  conversationGroupId: string;
  initiatorServiceName: string;
  targetServiceName: string;
  dialogState: DialogState;
  dialogLifetime: number | null;
  sendSequenceNumber: number;
  receiveSequenceNumber: number;
  farServiceName: string;
  farBrokerId: string | null;
  createdAt: Date;
  isInitiator: boolean;
}

export interface RelatedMessage {
  conversationHandle: string;
  sequenceNumber: number;
  messageTypeName: string;
  priority: number;
  status: string;
  enqueuedTime: Date;
  messageSize: number;
  messageBodyPreview: string;
}

export interface ConversationMessages {
  conversationHandle: string;
  messages: RelatedMessage[];
  totalCount: number;
  currentIndex: number;
}

export interface InspectedMessage {
  metadata: MessageMetadata;
  body: MessageBody;
  conversationContext: ConversationContext | null;
  relatedMessages: ConversationMessages | null;
}

export interface MessageInspectorState {
  currentMessage: InspectedMessage | null;
  loading: boolean;
  error: string | null;
  bodyViewMode: 'formatted' | 'raw';
  showBinaryView: boolean;
}

export const initialMessageInspectorState: MessageInspectorState = {
  currentMessage: null,
  loading: false,
  error: null,
  bodyViewMode: 'formatted',
  showBinaryView: false
};

export const dialogStateLabels: Record<DialogState, string> = {
  'conversing': 'Conversing',
  'disconnected_inbound': 'Disconnected (Inbound)',
  'disconnected_outbound': 'Disconnected (Outbound)',
  'error': 'Error',
  'closed': 'Closed'
};

export const dialogStateColors: Record<DialogState, string> = {
  'conversing': '#28a745',
  'disconnected_inbound': '#ffc107',
  'disconnected_outbound': '#ffc107',
  'error': '#dc3545',
  'closed': '#6c757d'
};
