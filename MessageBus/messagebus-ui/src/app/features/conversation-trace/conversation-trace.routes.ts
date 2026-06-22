import { Routes } from '@angular/router';

export const CONVERSATION_TRACE_ROUTES: Routes = [
  {
    path: '',
    loadComponent: () => import('./conversation-trace.component').then(m => m.ConversationTraceComponent)
  }
];
