import { Routes } from '@angular/router';

export const DIAGNOSTICS_ROUTES: Routes = [
  {
    path: '',
    loadComponent: () => import('./diagnostics.component').then(m => m.DiagnosticsComponent)
  }
];
