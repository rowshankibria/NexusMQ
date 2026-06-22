import { Component, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ApplicationService, RegisterApplicationRequest } from '../../services';

@Component({
  selector: 'app-add-application-dialog',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './add-application-dialog.component.html',
  styleUrls: ['./add-application-dialog.component.scss']
})
export class AddApplicationDialogComponent {
  @Output() close = new EventEmitter<void>();
  @Output() created = new EventEmitter<{ apiKey: string }>();

  name = '';
  description = '';
  contactEmail = '';
  expiresAt = '';
  permissions = {
    read: true,
    write: false,
    admin: false,
    full: false
  };
  allowAllQueues = true;
  allowedQueues = '';

  loading = false;
  error = '';

  constructor(private applicationService: ApplicationService) {}

  onClose(): void {
    this.close.emit();
  }

  onPermissionChange(type: string): void {
    if (type === 'full' && this.permissions.full) {
      this.permissions.read = false;
      this.permissions.write = false;
      this.permissions.admin = false;
    } else if (type !== 'full' && (this.permissions.read || this.permissions.write || this.permissions.admin)) {
      this.permissions.full = false;
    }
  }

  getPermissionsList(): string[] {
    if (this.permissions.full) return ['*'];

    const perms: string[] = [];
    if (this.permissions.read) perms.push('read');
    if (this.permissions.write) perms.push('write');
    if (this.permissions.admin) perms.push('admin');
    return perms;
  }

  getAllowedQueuesList(): string[] {
    if (this.allowAllQueues) return ['*'];

    return this.allowedQueues
      .split(',')
      .map(q => q.trim())
      .filter(q => q.length > 0);
  }

  submit(): void {
    if (!this.name.trim()) {
      this.error = 'Application name is required';
      return;
    }

    const permissions = this.getPermissionsList();
    if (permissions.length === 0) {
      this.error = 'At least one permission is required';
      return;
    }

    const allowedQueues = this.getAllowedQueuesList();
    if (allowedQueues.length === 0) {
      this.error = 'At least one queue must be allowed';
      return;
    }

    this.loading = true;
    this.error = '';

    const request: RegisterApplicationRequest = {
      name: this.name.trim(),
      description: this.description.trim() || undefined,
      contactEmail: this.contactEmail.trim() || undefined,
      expiresAt: this.expiresAt || undefined,
      permissions,
      allowedQueues
    };

    this.applicationService.registerApplication(request).subscribe({
      next: (result) => {
        this.loading = false;
        if (result) {
          this.created.emit({ apiKey: result.apiKey });
        } else {
          this.error = 'Failed to register application';
        }
      },
      error: (err) => {
        this.loading = false;
        this.error = err.message || 'Failed to register application';
      }
    });
  }
}
