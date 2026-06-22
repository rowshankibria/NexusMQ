import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { DiagnosticsService } from '../../services';
import { DialogError, DialogErrorFilter } from '../../models';

@Component({
  selector: 'app-dialog-errors',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './dialog-errors.component.html',
  styleUrls: ['./dialog-errors.component.scss']
})
export class DialogErrorsComponent {
  @Input() errors: DialogError[] = [];
  @Input() filter: DialogErrorFilter | undefined;
  @Input() loading = false;

  selectedError: DialogError | null = null;
  showDetailModal = false;

  constructor(private diagnosticsService: DiagnosticsService) {}

  onServiceNameChange(value: string): void {
    this.diagnosticsService.setDialogErrorFilter({ serviceName: value });
    this.diagnosticsService.loadDialogErrors().subscribe();
  }

  onMinAgeChange(value: number): void {
    this.diagnosticsService.setDialogErrorFilter({ minAgeMinutes: value });
    this.diagnosticsService.loadDialogErrors().subscribe();
  }

  endConversation(error: DialogError): void {
    if (confirm(`End conversation ${error.conversationHandle}? This will terminate the dialog.`)) {
      this.diagnosticsService.endConversation(error.conversationHandle).subscribe();
    }
  }

  deleteError(error: DialogError): void {
    if (confirm(`Delete this dialog error entry? This action cannot be undone.`)) {
      this.diagnosticsService.deleteDialogError(error.id).subscribe();
    }
  }

  viewDetails(error: DialogError): void {
    this.selectedError = error;
    this.showDetailModal = true;
  }

  closeModal(): void {
    this.showDetailModal = false;
    this.selectedError = null;
  }

  formatDuration(minutes: number): string {
    if (minutes < 60) {
      return `${minutes} min`;
    }
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    if (hours < 24) {
      return `${hours}h ${mins}m`;
    }
    const days = Math.floor(hours / 24);
    const remainingHours = hours % 24;
    return `${days}d ${remainingHours}h`;
  }

  getDialogStateClass(state: string): string {
    const lowerState = state.toLowerCase();
    if (lowerState.includes('error') || lowerState.includes('disconnect')) {
      return 'state-error';
    }
    if (lowerState.includes('conversing') || lowerState.includes('active')) {
      return 'state-active';
    }
    return 'state-default';
  }

  trackByError(index: number, error: DialogError): string {
    return error.id;
  }
}
