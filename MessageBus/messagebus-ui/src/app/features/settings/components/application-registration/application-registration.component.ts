import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import { DataTableComponent, TableColumn, ConfirmDialogComponent } from '../../../../shared/components';
import { ApplicationService, Application } from '../../services';
import { AddApplicationDialogComponent } from '../add-application-dialog/add-application-dialog.component';
import { EditPermissionsDialogComponent } from '../edit-permissions-dialog/edit-permissions-dialog.component';

@Component({
  selector: 'app-application-registration',
  standalone: true,
  imports: [
    CommonModule,
    DataTableComponent,
    ConfirmDialogComponent,
    AddApplicationDialogComponent,
    EditPermissionsDialogComponent
  ],
  templateUrl: './application-registration.component.html',
  styleUrls: ['./application-registration.component.scss']
})
export class ApplicationRegistrationComponent implements OnInit, OnDestroy {
  applications: Application[] = [];
  loading = false;
  showAddDialog = false;
  showEditDialog = false;
  showDeleteDialog = false;
  showRegenerateDialog = false;
  showApiKeyDialog = false;
  selectedApplication: Application | null = null;
  newApiKey = '';
  message = '';
  messageType: 'success' | 'error' = 'success';

  columns: TableColumn[] = [
    { key: 'name', header: 'Application Name', sortable: true },
    { key: 'apiKeyMasked', header: 'API Key', sortable: false },
    { key: 'permissions', header: 'Permissions', sortable: false },
    { key: 'isActive', header: 'Status', sortable: true },
    { key: 'lastUsedAt', header: 'Last Used', sortable: true },
    { key: 'actions', header: 'Actions', sortable: false, width: '200px' }
  ];

  private destroy$ = new Subject<void>();

  constructor(private applicationService: ApplicationService) {}

  ngOnInit(): void {
    this.applicationService.state$
      .pipe(takeUntil(this.destroy$))
      .subscribe(state => {
        this.applications = state.applications;
        this.loading = state.loading;
      });

    this.loadApplications();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  loadApplications(): void {
    this.applicationService.loadApplications().subscribe();
  }

  openAddDialog(): void {
    this.showAddDialog = true;
  }

  closeAddDialog(): void {
    this.showAddDialog = false;
  }

  onApplicationCreated(result: { apiKey: string }): void {
    this.showAddDialog = false;
    this.newApiKey = result.apiKey;
    this.showApiKeyDialog = true;
    this.showMessage('Application registered successfully', 'success');
  }

  openEditDialog(app: Application): void {
    this.selectedApplication = app;
    this.showEditDialog = true;
  }

  closeEditDialog(): void {
    this.showEditDialog = false;
    this.selectedApplication = null;
  }

  onApplicationUpdated(): void {
    this.showEditDialog = false;
    this.selectedApplication = null;
    this.showMessage('Application updated successfully', 'success');
  }

  openDeleteDialog(app: Application): void {
    this.selectedApplication = app;
    this.showDeleteDialog = true;
  }

  closeDeleteDialog(): void {
    this.showDeleteDialog = false;
    this.selectedApplication = null;
  }

  confirmDelete(): void {
    if (!this.selectedApplication) return;

    this.applicationService.deleteApplication(this.selectedApplication.id)
      .subscribe(success => {
        this.closeDeleteDialog();
        if (success) {
          this.showMessage('Application deleted successfully', 'success');
        } else {
          this.showMessage('Failed to delete application', 'error');
        }
      });
  }

  openRegenerateDialog(app: Application): void {
    this.selectedApplication = app;
    this.showRegenerateDialog = true;
  }

  closeRegenerateDialog(): void {
    this.showRegenerateDialog = false;
    this.selectedApplication = null;
  }

  confirmRegenerate(): void {
    if (!this.selectedApplication) return;

    this.applicationService.regenerateApiKey(this.selectedApplication.id)
      .subscribe(result => {
        this.closeRegenerateDialog();
        if (result) {
          this.newApiKey = result.apiKey;
          this.showApiKeyDialog = true;
          this.showMessage('API key regenerated successfully', 'success');
        } else {
          this.showMessage('Failed to regenerate API key', 'error');
        }
      });
  }

  closeApiKeyDialog(): void {
    this.showApiKeyDialog = false;
    this.newApiKey = '';
  }

  copyApiKey(): void {
    navigator.clipboard.writeText(this.newApiKey).then(() => {
      this.showMessage('API key copied to clipboard', 'success');
    });
  }

  toggleActive(app: Application): void {
    this.applicationService.updateApplication(app.id, { isActive: !app.isActive })
      .subscribe(updated => {
        if (updated) {
          this.showMessage(`Application ${updated.isActive ? 'activated' : 'deactivated'}`, 'success');
        } else {
          this.showMessage('Failed to update application', 'error');
        }
      });
  }

  formatPermissions(permissions: string[]): string {
    if (!permissions || permissions.length === 0) return 'None';
    if (permissions.includes('*')) return 'Full Access';
    return permissions.join(', ');
  }

  formatDate(dateString?: string): string {
    if (!dateString) return 'Never';
    const date = new Date(dateString);
    return date.toLocaleDateString() + ' ' + date.toLocaleTimeString();
  }

  private showMessage(message: string, type: 'success' | 'error'): void {
    this.message = message;
    this.messageType = type;
    setTimeout(() => {
      this.message = '';
    }, 3000);
  }
}
