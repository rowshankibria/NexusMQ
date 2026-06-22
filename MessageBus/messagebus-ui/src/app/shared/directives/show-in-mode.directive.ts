import {
  Directive,
  Input,
  TemplateRef,
  ViewContainerRef,
  OnInit,
  OnDestroy
} from '@angular/core';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import { UserModeService, UserMode } from '../../core/services';

/**
 * Structural directive to conditionally show content based on user mode.
 *
 * Usage:
 *   <div *appShowInMode="'advanced'">Only visible in Advanced Mode</div>
 *   <div *appShowInMode="'simple'">Only visible in Simple Mode</div>
 *   <div *appShowInMode="['simple', 'advanced']">Visible in both modes</div>
 */
@Directive({
  selector: '[appShowInMode]',
  standalone: true
})
export class ShowInModeDirective implements OnInit, OnDestroy {
  private requiredModes: UserMode[] = [];
  private hasView = false;
  private destroy$ = new Subject<void>();

  @Input()
  set appShowInMode(modes: UserMode | UserMode[]) {
    this.requiredModes = Array.isArray(modes) ? modes : [modes];
    this.updateView();
  }

  constructor(
    private templateRef: TemplateRef<unknown>,
    private viewContainer: ViewContainerRef,
    private userModeService: UserModeService
  ) {}

  ngOnInit(): void {
    this.userModeService.mode$
      .pipe(takeUntil(this.destroy$))
      .subscribe(() => this.updateView());
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  private updateView(): void {
    const currentMode = this.userModeService.getMode();
    const shouldShow = this.requiredModes.includes(currentMode);

    if (shouldShow && !this.hasView) {
      this.viewContainer.createEmbeddedView(this.templateRef);
      this.hasView = true;
    } else if (!shouldShow && this.hasView) {
      this.viewContainer.clear();
      this.hasView = false;
    }
  }
}
