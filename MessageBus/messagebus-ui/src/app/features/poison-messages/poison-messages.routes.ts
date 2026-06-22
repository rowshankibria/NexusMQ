import { Routes } from '@angular/router';

export const POISON_MESSAGES_ROUTES: Routes = [
  {
    path: '',
    loadComponent: () => import('./poison-messages.component').then(m => m.PoisonMessagesComponent)
  }
];
