import { Routes } from '@angular/router';

export const QUEUE_EXPLORER_ROUTES: Routes = [
  {
    path: '',
    loadComponent: () => import('./queue-explorer.component').then(m => m.QueueExplorerComponent)
  }
];
