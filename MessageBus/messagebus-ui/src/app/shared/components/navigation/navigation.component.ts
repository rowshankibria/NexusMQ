import { Component, OnInit, OnDestroy, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, Router, NavigationEnd } from '@angular/router';
import { Subject } from 'rxjs';
import { takeUntil, filter } from 'rxjs/operators';
import { UserModeService, UserMode } from '../../../core/services';

export interface NavItem {
  path: string;
  label: string;
  icon: string;
  modes: UserMode[]; // Which modes this item is visible in
  badge?: string;
  readOnly?: boolean; // For simple mode, show read-only indicator
}

@Component({
  selector: 'app-navigation',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './navigation.component.html',
  styleUrls: ['./navigation.component.scss']
})
export class NavigationComponent implements OnInit, OnDestroy {
  @Output() sidebarToggled = new EventEmitter<boolean>();

  currentMode: UserMode = 'simple';
  currentPath = '';
  isSidebarCollapsed = false;
  private destroy$ = new Subject<void>();

  readonly navItems: NavItem[] = [
    {
      path: '/dashboard',
      label: 'Dashboard',
      icon: 'M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6',
      modes: ['simple', 'advanced']
    },
    {
      path: '/queue-explorer',
      label: 'Queue Explorer',
      icon: 'M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10',
      modes: ['simple', 'advanced'],
      readOnly: true
    },
    {
      path: '/message-inspector',
      label: 'Message Inspector',
      icon: 'M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z',
      modes: ['advanced']
    },
    {
      path: '/message-sender',
      label: 'Message Sender',
      icon: 'M12 19l9 2-9-18-9 18 9-2zm0 0v-8',
      modes: ['advanced']
    },
    {
      path: '/poison-messages',
      label: 'Poison Messages',
      icon: 'M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z',
      modes: ['advanced']
    },
    {
      path: '/conversation-trace',
      label: 'Conversation Trace',
      icon: 'M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z',
      modes: ['advanced']
    },
    {
      path: '/diagnostics',
      label: 'Diagnostics',
      icon: 'M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z',
      modes: ['simple', 'advanced'],
      readOnly: true
    },
    {
      path: '/settings',
      label: 'Settings',
      icon: 'M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z',
      modes: ['simple', 'advanced']
    }
  ];

  constructor(
    private userModeService: UserModeService,
    private router: Router
  ) {}

  ngOnInit(): void {
    // Subscribe to mode changes
    this.userModeService.mode$
      .pipe(takeUntil(this.destroy$))
      .subscribe(mode => {
        this.currentMode = mode;
        // If current route is not available in new mode, redirect to dashboard
        this.checkRouteAccess();
      });

    // Track current route
    this.router.events
      .pipe(
        filter(event => event instanceof NavigationEnd),
        takeUntil(this.destroy$)
      )
      .subscribe((event: NavigationEnd) => {
        this.currentPath = event.urlAfterRedirects;
      });

    // Set initial path
    this.currentPath = this.router.url;
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  get visibleNavItems(): NavItem[] {
    return this.navItems.filter(item => item.modes.includes(this.currentMode));
  }

  isActive(path: string): boolean {
    return this.currentPath.startsWith(path);
  }

  toggleSidebar(): void {
    this.isSidebarCollapsed = !this.isSidebarCollapsed;
    this.sidebarToggled.emit(this.isSidebarCollapsed);
  }

  private checkRouteAccess(): void {
    const currentItem = this.navItems.find(item =>
      this.currentPath.startsWith(item.path)
    );

    if (currentItem && !currentItem.modes.includes(this.currentMode)) {
      this.router.navigate(['/dashboard']);
    }
  }

  getModeLabel(): string {
    return this.currentMode === 'simple' ? 'Simple Mode' : 'Advanced Mode';
  }

  getModeIcon(): string {
    return this.currentMode === 'simple'
      ? 'M15 12a3 3 0 11-6 0 3 3 0 016 0z M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z'
      : 'M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z M15 12a3 3 0 11-6 0 3 3 0 016 0z';
  }
}
