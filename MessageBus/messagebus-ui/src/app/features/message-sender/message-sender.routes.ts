import { Routes } from '@angular/router';

export const MESSAGE_SENDER_ROUTES: Routes = [
  {
    path: '',
    loadComponent: () => import('./message-sender.component').then(m => m.MessageSenderComponent)
  }
];
