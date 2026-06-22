import { Routes } from '@angular/router';

export const MESSAGE_INSPECTOR_ROUTES: Routes = [
  {
    path: '',
    loadComponent: () => import('./message-inspector.component').then(m => m.MessageInspectorComponent)
  }
];
