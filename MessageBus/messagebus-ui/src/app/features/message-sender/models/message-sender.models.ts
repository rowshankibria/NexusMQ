export type MessageBodyFormat = 'raw' | 'json' | 'xml';
export type SendMode = 'single' | 'bulk';

export interface ServiceInfo {
  serviceName: string;
  displayName: string;
  queueName: string;
  isEnabled: boolean;
}

export interface ContractInfo {
  contractName: string;
  displayName: string;
  initiatorService: string;
  targetService: string;
}

export interface MessageTypeInfo {
  messageTypeName: string;
  displayName: string;
  contractName: string;
  validation: string;
}

export interface SendMessageRequest {
  initiatorService: string;
  targetService: string;
  contractName: string;
  messageTypeName: string;
  messageBody: string;
  priority: number;
  dialogHandle?: string;
  conversationGroupId?: string;
  dialogLifetime?: number;
}

export interface BulkSendRequest {
  request: SendMessageRequest;
  copyCount: number;
  delayBetweenMs?: number;
}

export interface SendMessageResponse {
  success: boolean;
  conversationHandle: string;
  message: string;
  timestamp: Date;
}

export interface BulkSendResponse {
  success: boolean;
  totalSent: number;
  totalFailed: number;
  conversationHandles: string[];
  errors: string[];
}

export interface MessageTemplate {
  id: string;
  name: string;
  description: string;
  messageType: string;
  format: MessageBodyFormat;
  content: string;
}

export interface ValidationError {
  field: string;
  message: string;
}

export interface MessageSenderForm {
  initiatorService: string;
  targetService: string;
  contractName: string;
  messageTypeName: string;
  messageBody: string;
  bodyFormat: MessageBodyFormat;
  priority: number;
  dialogHandle: string;
  conversationGroupId: string;
  dialogLifetime: number | null;
  sendMode: SendMode;
  bulkCopyCount: number;
}

export interface MessageSenderState {
  services: ServiceInfo[];
  contracts: ContractInfo[];
  messageTypes: MessageTypeInfo[];
  templates: MessageTemplate[];
  filteredContracts: ContractInfo[];
  filteredMessageTypes: MessageTypeInfo[];
  form: MessageSenderForm;
  validationErrors: ValidationError[];
  isSending: boolean;
  lastSendResult: SendMessageResponse | BulkSendResponse | null;
  loading: boolean;
  error: string | null;
  showPreview: boolean;
}

export const initialMessageSenderForm: MessageSenderForm = {
  initiatorService: '',
  targetService: '',
  contractName: '',
  messageTypeName: '',
  messageBody: '',
  bodyFormat: 'raw',
  priority: 5,
  dialogHandle: '',
  conversationGroupId: '',
  dialogLifetime: null,
  sendMode: 'single',
  bulkCopyCount: 1
};

export const initialMessageSenderState: MessageSenderState = {
  services: [],
  contracts: [],
  messageTypes: [],
  templates: [],
  filteredContracts: [],
  filteredMessageTypes: [],
  form: initialMessageSenderForm,
  validationErrors: [],
  isSending: false,
  lastSendResult: null,
  loading: false,
  error: null,
  showPreview: false
};

export const defaultTemplates: MessageTemplate[] = [
  {
    id: 'json-basic',
    name: 'Basic JSON',
    description: 'Simple JSON object template',
    messageType: '',
    format: 'json',
    content: '{\n  "id": 1,\n  "message": "Hello World",\n  "timestamp": "2024-01-01T00:00:00Z"\n}'
  },
  {
    id: 'xml-basic',
    name: 'Basic XML',
    description: 'Simple XML document template',
    messageType: '',
    format: 'xml',
    content: '<?xml version="1.0" encoding="utf-8"?>\n<Message>\n  <Id>1</Id>\n  <Content>Hello World</Content>\n  <Timestamp>2024-01-01T00:00:00Z</Timestamp>\n</Message>'
  },
  {
    id: 'json-request',
    name: 'Request Message',
    description: 'Request/Response pattern template',
    messageType: '',
    format: 'json',
    content: '{\n  "requestId": "{{guid}}",\n  "action": "process",\n  "payload": {\n    "data": "value"\n  }\n}'
  }
];
