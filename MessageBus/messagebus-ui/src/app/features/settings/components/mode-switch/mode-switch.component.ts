import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import { UserModeService, UserMode } from '../../../../core/services';

interface ModeOption {
  value: UserMode;
  label: string;
  description: string;
  features: string[];
}

@Component({
  selector: 'app-mode-switch',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './mode-switch.component.html',
  styleUrls: ['./mode-switch.component.scss']
})
export class ModeSwitchComponent implements OnInit, OnDestroy {
  currentMode: UserMode = 'simple';
  private destroy$ = new Subject<void>();

  readonly modeOptions: ModeOption[] = [
    {
      value: 'simple',
      label: 'Simple Mode',
      description: 'Streamlined interface for monitoring and basic queue viewing. Ideal for operators who need read-only access.',
      features: [
        'Dashboard with system health overview',
        'Queue overview (read-only)',
        'Alert notifications',
        'Simplified diagnostics'
      ]
    },
    {
      value: 'advanced',
      label: 'Advanced Mode',
      description: 'Full access to all features including message operations, conversation tracing, and diagnostic tools.',
      features: [
        'All Simple Mode features',
        'Send, receive, and delete messages',
        'Purge and pause queues',
        'Message Inspector with raw body access',
        'Conversation tracing',
        'Poison message handling',
        'Full diagnostics and health checks'
      ]
    }
  ];

  constructor(private userModeService: UserModeService) {}

  ngOnInit(): void {
    this.userModeService.mode$
      .pipe(takeUntil(this.destroy$))
      .subscribe(mode => {
        this.currentMode = mode;
      });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  onModeChange(mode: UserMode): void {
    this.userModeService.setMode(mode);
  }

  getModeOption(mode: UserMode): ModeOption | undefined {
    return this.modeOptions.find(opt => opt.value === mode);
  }
}
