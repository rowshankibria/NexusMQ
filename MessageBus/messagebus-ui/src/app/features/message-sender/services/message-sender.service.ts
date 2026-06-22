import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable, of, forkJoin } from 'rxjs';
import { catchError, map, tap } from 'rxjs/operators';
import { ApiService } from '../../../core/services/api.service';
import {
  MessageSenderState,
  MessageSenderForm,
  ServiceInfo,
  ContractInfo,
  MessageTypeInfo,
  MessageTemplate,
  SendMessageRequest,
  SendMessageResponse,
  BulkSendRequest,
  BulkSendResponse,
  ValidationError,
  MessageBodyFormat,
  initialMessageSenderState,
  initialMessageSenderForm,
  defaultTemplates
} from '../models';

@Injectable({
  providedIn: 'root'
})
export class MessageSenderService {
  private state = new BehaviorSubject<MessageSenderState>(initialMessageSenderState);
  state$ = this.state.asObservable();

  constructor(private apiService: ApiService) {
    this.loadTemplates();
  }

  private updateState(partialState: Partial<MessageSenderState>): void {
    this.state.next({ ...this.state.value, ...partialState });
  }

  loadInitialData(): void {
    this.updateState({ loading: true, error: null });

    forkJoin({
      services: this.apiService.get<ServiceInfo[]>('services'),
      contracts: this.apiService.get<ContractInfo[]>('contracts'),
      messageTypes: this.apiService.get<MessageTypeInfo[]>('message-types')
    })
      .pipe(
        tap(({ services, contracts, messageTypes }) => {
          this.updateState({
            services,
            contracts,
            messageTypes,
            loading: false
          });
        }),
        catchError(error => {
          this.updateState({
            loading: false,
            error: error.message || 'Failed to load initial data'
          });
          return of(null);
        })
      )
      .subscribe();
  }

  private loadTemplates(): void {
    this.updateState({ templates: defaultTemplates });
  }

  updateFormField<K extends keyof MessageSenderForm>(
    field: K,
    value: MessageSenderForm[K]
  ): void {
    const updatedForm = { ...this.state.value.form, [field]: value };
    this.updateState({ form: updatedForm });

    if (field === 'initiatorService' || field === 'targetService') {
      this.filterContracts();
    }

    if (field === 'contractName') {
      this.filterMessageTypes();
    }

    this.validateForm();
  }

  private filterContracts(): void {
    const { initiatorService, targetService } = this.state.value.form;
    const { contracts } = this.state.value;

    let filtered = contracts;

    if (initiatorService) {
      filtered = filtered.filter(c => c.initiatorService === initiatorService);
    }

    if (targetService) {
      filtered = filtered.filter(c => c.targetService === targetService);
    }

    this.updateState({ filteredContracts: filtered });

    if (this.state.value.form.contractName) {
      const contractStillValid = filtered.some(
        c => c.contractName === this.state.value.form.contractName
      );
      if (!contractStillValid) {
        this.updateFormField('contractName', '');
      }
    }
  }

  private filterMessageTypes(): void {
    const { contractName } = this.state.value.form;
    const { messageTypes } = this.state.value;

    const filtered = contractName
      ? messageTypes.filter(mt => mt.contractName === contractName)
      : messageTypes;

    this.updateState({ filteredMessageTypes: filtered });

    if (this.state.value.form.messageTypeName) {
      const typeStillValid = filtered.some(
        mt => mt.messageTypeName === this.state.value.form.messageTypeName
      );
      if (!typeStillValid) {
        this.updateFormField('messageTypeName', '');
      }
    }
  }

  validateForm(): ValidationError[] {
    const errors: ValidationError[] = [];
    const { form } = this.state.value;

    if (!form.initiatorService) {
      errors.push({ field: 'initiatorService', message: 'Initiator service is required' });
    }

    if (!form.targetService) {
      errors.push({ field: 'targetService', message: 'Target service is required' });
    }

    if (!form.contractName) {
      errors.push({ field: 'contractName', message: 'Contract is required' });
    }

    if (!form.messageTypeName) {
      errors.push({ field: 'messageTypeName', message: 'Message type is required' });
    }

    if (form.bodyFormat === 'json' && form.messageBody) {
      try {
        JSON.parse(form.messageBody);
      } catch {
        errors.push({ field: 'messageBody', message: 'Invalid JSON format' });
      }
    }

    if (form.bodyFormat === 'xml' && form.messageBody) {
      if (!this.isValidXml(form.messageBody)) {
        errors.push({ field: 'messageBody', message: 'Invalid XML format' });
      }
    }

    if (form.sendMode === 'bulk' && (form.bulkCopyCount < 1 || form.bulkCopyCount > 1000)) {
      errors.push({ field: 'bulkCopyCount', message: 'Bulk copy count must be between 1 and 1000' });
    }

    if (form.dialogLifetime !== null && form.dialogLifetime < 0) {
      errors.push({ field: 'dialogLifetime', message: 'Dialog lifetime must be positive' });
    }

    this.updateState({ validationErrors: errors });
    return errors;
  }

  private isValidXml(xml: string): boolean {
    try {
      const parser = new DOMParser();
      const doc = parser.parseFromString(xml, 'application/xml');
      return !doc.querySelector('parsererror');
    } catch {
      return false;
    }
  }

  sendMessage(): Observable<SendMessageResponse | null> {
    const errors = this.validateForm();
    if (errors.length > 0) {
      return of(null);
    }

    const { form } = this.state.value;

    const request: SendMessageRequest = {
      initiatorService: form.initiatorService,
      targetService: form.targetService,
      contractName: form.contractName,
      messageTypeName: form.messageTypeName,
      messageBody: form.messageBody,
      priority: form.priority,
      dialogHandle: form.dialogHandle || undefined,
      conversationGroupId: form.conversationGroupId || undefined,
      dialogLifetime: form.dialogLifetime || undefined
    };

    this.updateState({ isSending: true, error: null });

    return this.apiService.post<SendMessageResponse>('messages/send', request)
      .pipe(
        tap(response => {
          this.updateState({
            isSending: false,
            lastSendResult: response
          });
        }),
        catchError(error => {
          this.updateState({
            isSending: false,
            error: error.message || 'Failed to send message'
          });
          return of(null);
        })
      );
  }

  sendBulkMessages(): Observable<BulkSendResponse | null> {
    const errors = this.validateForm();
    if (errors.length > 0) {
      return of(null);
    }

    const { form } = this.state.value;

    const request: BulkSendRequest = {
      request: {
        initiatorService: form.initiatorService,
        targetService: form.targetService,
        contractName: form.contractName,
        messageTypeName: form.messageTypeName,
        messageBody: form.messageBody,
        priority: form.priority,
        dialogHandle: form.dialogHandle || undefined,
        conversationGroupId: form.conversationGroupId || undefined,
        dialogLifetime: form.dialogLifetime || undefined
      },
      copyCount: form.bulkCopyCount
    };

    this.updateState({ isSending: true, error: null });

    return this.apiService.post<BulkSendResponse>('messages/send-bulk', request)
      .pipe(
        tap(response => {
          this.updateState({
            isSending: false,
            lastSendResult: response
          });
        }),
        catchError(error => {
          this.updateState({
            isSending: false,
            error: error.message || 'Failed to send bulk messages'
          });
          return of(null);
        })
      );
  }

  applyTemplate(template: MessageTemplate): void {
    this.updateFormField('messageBody', template.content);
    this.updateFormField('bodyFormat', template.format);
  }

  formatMessageBody(): void {
    const { messageBody, bodyFormat } = this.state.value.form;

    if (!messageBody) return;

    let formatted = messageBody;

    if (bodyFormat === 'json') {
      try {
        formatted = JSON.stringify(JSON.parse(messageBody), null, 2);
      } catch {
        return;
      }
    } else if (bodyFormat === 'xml') {
      formatted = this.formatXml(messageBody);
    }

    this.updateFormField('messageBody', formatted);
  }

  private formatXml(xml: string): string {
    let formatted = '';
    let indent = '';
    const tab = '  ';

    xml.split(/>\s*</).forEach(node => {
      if (node.match(/^\/\w/)) {
        indent = indent.substring(tab.length);
      }
      formatted += indent + '<' + node + '>\n';
      if (node.match(/^<?\w[^>]*[^\/]$/) && !node.startsWith('?')) {
        indent += tab;
      }
    });

    return formatted.substring(1, formatted.length - 2);
  }

  togglePreview(): void {
    this.updateState({ showPreview: !this.state.value.showPreview });
  }

  resetForm(): void {
    this.updateState({
      form: initialMessageSenderForm,
      validationErrors: [],
      lastSendResult: null,
      error: null
    });
  }

  getCharacterCount(): number {
    return this.state.value.form.messageBody.length;
  }

  getMessageSizeWarning(): string | null {
    const size = new Blob([this.state.value.form.messageBody]).size;
    if (size > 2 * 1024 * 1024) {
      return 'Message exceeds 2MB limit';
    }
    if (size > 1 * 1024 * 1024) {
      return 'Large message (over 1MB)';
    }
    return null;
  }

  checkTargetServiceExists(serviceName: string): Observable<boolean> {
    return this.apiService.get<{ exists: boolean }>(`services/${serviceName}/exists`)
      .pipe(
        map(response => response.exists),
        catchError(() => of(false))
      );
  }

  hasFieldError(fieldName: string): boolean {
    return this.state.value.validationErrors.some(e => e.field === fieldName);
  }

  getFieldError(fieldName: string): string | null {
    const error = this.state.value.validationErrors.find(e => e.field === fieldName);
    return error?.message || null;
  }
}
