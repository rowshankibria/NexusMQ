import { Component, Input, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { DiagnosticsService } from '../../services';
import {
  AlertRule,
  AlertRuleFormData,
  AlertActionConfig,
  MetricType,
  AlertSeverity,
  AlertAction,
  metricTypeLabels,
  alertSeverityLabels,
  alertActionLabels
} from '../../models';

@Component({
  selector: 'app-alert-rules',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './alert-rules.component.html',
  styleUrls: ['./alert-rules.component.scss']
})
export class AlertRulesComponent implements OnInit {
  @Input() rules: AlertRule[] = [];
  @Input() editingRule: AlertRule | null = null;
  @Input() loading = false;

  showFormModal = false;
  formMode: 'create' | 'edit' = 'create';

  formData: AlertRuleFormData = this.getEmptyFormData();

  metricTypes: { value: MetricType; label: string }[] = [
    { value: 'QueueDepth', label: metricTypeLabels['QueueDepth'] },
    { value: 'MessageAge', label: metricTypeLabels['MessageAge'] },
    { value: 'ErrorRate', label: metricTypeLabels['ErrorRate'] },
    { value: 'PoisonCount', label: metricTypeLabels['PoisonCount'] },
    { value: 'ThroughputRate', label: metricTypeLabels['ThroughputRate'] }
  ];

  operators = [
    { value: 'GreaterThan', label: '>' },
    { value: 'GreaterOrEqual', label: '>=' },
    { value: 'LessThan', label: '<' },
    { value: 'LessOrEqual', label: '<=' },
    { value: 'Equals', label: '=' }
  ];

  severities: { value: AlertSeverity; label: string }[] = [
    { value: 'Info', label: alertSeverityLabels['Info'] },
    { value: 'Warning', label: alertSeverityLabels['Warning'] },
    { value: 'Critical', label: alertSeverityLabels['Critical'] }
  ];

  actionTypes: { value: AlertAction; label: string }[] = [
    { value: 'Email', label: alertActionLabels['Email'] },
    { value: 'Webhook', label: alertActionLabels['Webhook'] },
    { value: 'Slack', label: alertActionLabels['Slack'] }
  ];

  constructor(private diagnosticsService: DiagnosticsService) {}

  ngOnInit(): void {
    if (this.editingRule) {
      this.editRule(this.editingRule);
    }
  }

  private getEmptyFormData(): AlertRuleFormData {
    return {
      name: '',
      description: '',
      metricType: 'QueueDepth',
      operator: 'GreaterThan',
      threshold: 100,
      duration: 5,
      severity: 'Warning',
      isEnabled: true,
      actions: []
    };
  }

  openCreateForm(): void {
    this.formMode = 'create';
    this.formData = this.getEmptyFormData();
    this.showFormModal = true;
  }

  editRule(rule: AlertRule): void {
    this.formMode = 'edit';
    this.formData = {
      name: rule.name,
      description: rule.description,
      metricType: rule.metricType,
      operator: rule.condition.operator,
      threshold: rule.threshold,
      duration: rule.duration,
      severity: rule.severity,
      isEnabled: rule.isEnabled,
      actions: [...rule.actions]
    };
    this.diagnosticsService.setEditingRule(rule);
    this.showFormModal = true;
  }

  closeForm(): void {
    this.showFormModal = false;
    this.diagnosticsService.setEditingRule(null);
  }

  saveRule(): void {
    if (this.formMode === 'create') {
      this.diagnosticsService.createAlertRule(this.formData).subscribe(result => {
        if (result) {
          this.closeForm();
        }
      });
    } else if (this.editingRule) {
      this.diagnosticsService.updateAlertRule(this.editingRule.id, this.formData).subscribe(result => {
        if (result) {
          this.closeForm();
        }
      });
    }
  }

  deleteRule(rule: AlertRule): void {
    if (confirm(`Delete alert rule "${rule.name}"? This action cannot be undone.`)) {
      this.diagnosticsService.deleteAlertRule(rule.id).subscribe();
    }
  }

  toggleRule(rule: AlertRule): void {
    this.diagnosticsService.toggleAlertRule(rule.id, !rule.isEnabled).subscribe();
  }

  addAction(type: AlertAction): void {
    const newAction: AlertActionConfig = {
      type,
      config: this.getDefaultConfigForType(type)
    };
    this.formData.actions = [...this.formData.actions, newAction];
  }

  removeAction(index: number): void {
    this.formData.actions = this.formData.actions.filter((_, i) => i !== index);
  }

  private getDefaultConfigForType(type: AlertAction): AlertActionConfig['config'] {
    switch (type) {
      case 'Email':
        return { recipients: [] };
      case 'Webhook':
        return { url: '', method: 'POST' };
      case 'Slack':
        return { webhookUrl: '' };
    }
  }

  getMetricLabel(type: MetricType): string {
    return metricTypeLabels[type] || type;
  }

  getSeverityLabel(severity: AlertSeverity): string {
    return alertSeverityLabels[severity] || severity;
  }

  getSeverityClass(severity: AlertSeverity): string {
    switch (severity) {
      case 'Info': return 'severity-info';
      case 'Warning': return 'severity-warning';
      case 'Critical': return 'severity-critical';
      default: return '';
    }
  }

  getOperatorLabel(operator: string): string {
    const op = this.operators.find(o => o.value === operator);
    return op?.label || operator;
  }

  formatDate(date: Date | null): string {
    if (!date) return 'Never';
    return new Date(date).toLocaleString();
  }

  trackByRule(index: number, rule: AlertRule): string {
    return rule.id;
  }

  trackByAction(index: number, action: AlertActionConfig): number {
    return index;
  }
}
