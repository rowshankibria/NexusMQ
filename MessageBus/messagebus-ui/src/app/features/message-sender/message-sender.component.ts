import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Subject, takeUntil } from 'rxjs';
import { MessageSenderService } from './services';
import {
  MessageSenderState,
  MessageBodyFormat,
  SendMode,
  MessageTemplate,
  ServiceInfo,
  ContractInfo,
  MessageTypeInfo
} from './models';
import { MessageBodyEditorComponent } from './components';
import { LoadingSpinnerComponent } from '../../shared/components';

@Component({
  selector: 'app-message-sender',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MessageBodyEditorComponent,
    LoadingSpinnerComponent
  ],
  templateUrl: './message-sender.component.html',
  styleUrls: ['./message-sender.component.scss']
})
export class MessageSenderComponent implements OnInit, OnDestroy {
  state: MessageSenderState | null = null;
  showAdvancedOptions: boolean = false;

  private destroy$ = new Subject<void>();

  constructor(private senderService: MessageSenderService) {}

  ngOnInit(): void {
    this.senderService.state$
      .pipe(takeUntil(this.destroy$))
      .subscribe(state => {
        this.state = state;
      });

    this.senderService.loadInitialData();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  get services(): ServiceInfo[] {
    return this.state?.services ?? [];
  }

  get filteredContracts(): ContractInfo[] {
    return this.state?.filteredContracts ?? [];
  }

  get filteredMessageTypes(): MessageTypeInfo[] {
    return this.state?.filteredMessageTypes ?? [];
  }

  get templates(): MessageTemplate[] {
    return this.state?.templates ?? [];
  }

  get isLoading(): boolean {
    return this.state?.loading ?? false;
  }

  get isSending(): boolean {
    return this.state?.isSending ?? false;
  }

  get error(): string | null {
    return this.state?.error ?? null;
  }

  get lastSendResult(): any {
    return this.state?.lastSendResult ?? null;
  }

  get isFormValid(): boolean {
    return (this.state?.validationErrors?.length ?? 0) === 0 &&
      !!this.state?.form.initiatorService &&
      !!this.state?.form.targetService &&
      !!this.state?.form.contractName &&
      !!this.state?.form.messageTypeName;
  }

  get messageSizeWarning(): string | null {
    return this.senderService.getMessageSizeWarning();
  }

  onInitiatorServiceChange(value: string): void {
    this.senderService.updateFormField('initiatorService', value);
  }

  onTargetServiceChange(value: string): void {
    this.senderService.updateFormField('targetService', value);
  }

  onContractChange(value: string): void {
    this.senderService.updateFormField('contractName', value);
  }

  onMessageTypeChange(value: string): void {
    this.senderService.updateFormField('messageTypeName', value);
  }

  onMessageBodyChange(value: string): void {
    this.senderService.updateFormField('messageBody', value);
  }

  onBodyFormatChange(value: MessageBodyFormat): void {
    this.senderService.updateFormField('bodyFormat', value);
  }

  onTemplateSelected(template: MessageTemplate): void {
    this.senderService.applyTemplate(template);
  }

  onPriorityChange(value: number): void {
    this.senderService.updateFormField('priority', value);
  }

  onDialogHandleChange(value: string): void {
    this.senderService.updateFormField('dialogHandle', value);
  }

  onConversationGroupIdChange(value: string): void {
    this.senderService.updateFormField('conversationGroupId', value);
  }

  onDialogLifetimeChange(value: string): void {
    const lifetime = value ? parseInt(value, 10) : null;
    this.senderService.updateFormField('dialogLifetime', lifetime);
  }

  onSendModeChange(mode: SendMode): void {
    this.senderService.updateFormField('sendMode', mode);
  }

  onBulkCopyCountChange(value: string): void {
    const count = parseInt(value, 10) || 1;
    this.senderService.updateFormField('bulkCopyCount', count);
  }

  toggleAdvancedOptions(): void {
    this.showAdvancedOptions = !this.showAdvancedOptions;
  }

  togglePreview(): void {
    this.senderService.togglePreview();
  }

  sendMessage(): void {
    if (this.state?.form.sendMode === 'bulk') {
      this.senderService.sendBulkMessages().subscribe();
    } else {
      this.senderService.sendMessage().subscribe();
    }
  }

  resetForm(): void {
    this.senderService.resetForm();
    this.showAdvancedOptions = false;
  }

  hasFieldError(fieldName: string): boolean {
    return this.senderService.hasFieldError(fieldName);
  }

  getFieldError(fieldName: string): string | null {
    return this.senderService.getFieldError(fieldName);
  }

  getPriorityLabel(priority: number): string {
    if (priority <= 2) return 'High';
    if (priority <= 4) return 'Medium-High';
    if (priority <= 6) return 'Medium';
    if (priority <= 8) return 'Medium-Low';
    return 'Low';
  }

  getPriorityClass(priority: number): string {
    if (priority <= 3) return 'priority--high';
    if (priority <= 6) return 'priority--medium';
    return 'priority--low';
  }
}
