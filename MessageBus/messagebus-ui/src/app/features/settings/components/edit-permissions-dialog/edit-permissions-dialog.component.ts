import { Component, Input, Output, EventEmitter, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ApplicationService, Application, UpdateApplicationRequest } from '../../services';

@Component({
  selector: 'app-edit-permissions-dialog',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './edit-permissions-dialog.component.html',
  styleUrls: ['./edit-permissions-dialog.component.scss']
})
export class EditPermissionsDialogComponent implements OnInit {
  @Input() application!: Application;
  @Output() close = new EventEmitter<void>();
  @Output() updated = new EventEmitter<void>();

  name = '';
  description = '';
  contactEmail = '';
  expiresAt = '';
  permissions = {
    read: false,
    write: false,
    admin: false,
    full: false
  };
  allowAllQueues = true;
  allowedQueues = '';

  loading = false;
  error = '';

  constructor(private applicationService: ApplicationService) {}

  ngOnInit(): void {
    // Initialize form with application data
    this.name = this.application.name;
    this.description = this.application.description || '';
    this.contactEmail = this.application.contactEmail || '';

    if (this.application.expiresAt) {
      const date = new Date(this.application.expiresAt);
      this.expiresAt = date.toISOString().split('T')[0];
    }

    // Set permissions
    const perms = this.application.permissions;
    if (perms.includes('*')) {
      this.permissions.full = true;
    } else {
      this.permissions.read = perms.includes('read');
      this.permissions.write = perms.includes('write');
      this.permissions.admin = perms.includes('admin');
    }

    // Set queue access
    const queues = this.application.allowedQueues;
    if (queues.includes('*')) {
      this.allowAllQueues = true;
    } else {
      this.allowAllQueues = false;
      this.allowedQueues = queues.join(', ');
    }
  }

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

    const request: UpdateApplicationRequest = {
      name: this.name.trim(),
      description: this.description.trim() || undefined,
      contactEmail: this.contactEmail.trim() || undefined,
      expiresAt: this.expiresAt || undefined,
      permissions,
      allowedQueues
    };

    this.applicationService.updateApplication(this.application.id, request).subscribe({
      next: (result) => {
        this.loading = false;
        if (result) {
          this.updated.emit();
        } else {
          this.error = 'Failed to update application';
        }
      },
      error: (err) => {
        this.loading = false;
        this.error = err.message || 'Failed to update application';
      }
    });
  }
}
