import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { ConfirmDialogComponent } from '../../../../shared/components/confirm-dialog/confirm-dialog.component';
import { Queue } from '../../models';

@Component({
  selector: 'app-queue-actions',
  standalone: true,
  imports: [CommonModule, RouterModule, ConfirmDialogComponent],
  templateUrl: './queue-actions.component.html',
  styleUrls: ['./queue-actions.component.scss']
})
export class QueueActionsComponent {
  @Input() queue: Queue | null = null;
  @Input() loading: boolean = false;

  @Output() sendMessage = new EventEmitter<void>();
  @Output() receiveMessage = new EventEmitter<void>();
  @Output() togglePause = new EventEmitter<boolean>();
  @Output() purgeQueue = new EventEmitter<void>();
  @Output() viewPoisonMessages = new EventEmitter<void>();
  @Output() refresh = new EventEmitter<void>();

  showPurgeConfirm: boolean = false;

  get isPaused(): boolean {
    return this.queue ? !this.queue.isReceiveEnabled : false;
  }

  get hasPoisonMessages(): boolean {
    return this.queue ? this.queue.poisonMessageCount > 0 : false;
  }

  get hasMessages(): boolean {
    return this.queue ? this.queue.messageCount > 0 : false;
  }

  onSendMessage(): void {
    this.sendMessage.emit();
  }

  onReceiveMessage(): void {
    this.receiveMessage.emit();
  }

  onTogglePause(): void {
    this.togglePause.emit(!this.isPaused);
  }

  onPurgeClick(): void {
    this.showPurgeConfirm = true;
  }

  onConfirmPurge(): void {
    this.showPurgeConfirm = false;
    this.purgeQueue.emit();
  }

  onCancelPurge(): void {
    this.showPurgeConfirm = false;
  }

  onViewPoisonMessages(): void {
    this.viewPoisonMessages.emit();
  }

  onRefresh(): void {
    this.refresh.emit();
  }

  getPauseButtonLabel(): string {
    return this.isPaused ? 'Resume Queue' : 'Pause Queue';
  }

  getPauseButtonIcon(): string {
    return this.isPaused ? '▶' : '⏸';
  }
}
