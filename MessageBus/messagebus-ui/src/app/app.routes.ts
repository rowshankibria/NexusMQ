import { Routes } from '@angular/router';

export const routes: Routes = [
  {
    path: '',
    redirectTo: 'dashboard',
    pathMatch: 'full'
  },
  {
    path: 'dashboard',
    loadChildren: () => import('./features/dashboard/dashboard.routes').then(m => m.DASHBOARD_ROUTES)
  },
  {
    path: 'queue-explorer',
    loadChildren: () => import('./features/queue-explorer/queue-explorer.routes').then(m => m.QUEUE_EXPLORER_ROUTES)
  },
  {
    path: 'message-inspector',
    loadChildren: () => import('./features/message-inspector/message-inspector.routes').then(m => m.MESSAGE_INSPECTOR_ROUTES)
  },
  {
    path: 'message-sender',
    loadChildren: () => import('./features/message-sender/message-sender.routes').then(m => m.MESSAGE_SENDER_ROUTES)
  },
  {
    path: 'poison-messages',
    loadChildren: () => import('./features/poison-messages/poison-messages.routes').then(m => m.POISON_MESSAGES_ROUTES)
  },
  {
    path: 'conversation-trace',
    loadChildren: () => import('./features/conversation-trace/conversation-trace.routes').then(m => m.CONVERSATION_TRACE_ROUTES)
  },
  {
    path: 'diagnostics',
    loadChildren: () => import('./features/diagnostics/diagnostics.routes').then(m => m.DIAGNOSTICS_ROUTES)
  },
  {
    path: 'settings',
    loadChildren: () => import('./features/settings/settings.routes').then(m => m.SETTINGS_ROUTES)
  },
  {
    path: '**',
    redirectTo: 'dashboard'
  }
];
