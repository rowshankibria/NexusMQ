import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { Subject, takeUntil, combineLatest } from 'rxjs';
import { MessageInspectorService } from './services';
import { MessageInspectorState, InspectedMessage, RelatedMessage } from './models';
import {
  MessageMetadataComponent,
  MessageBodyViewerComponent,
  ConversationContextComponent,
  RelatedMessagesComponent
} from './components';
import { LoadingSpinnerComponent } from '../../shared/components';

@Component({
  selector: 'app-message-inspector',
  standalone: true,
  imports: [
    CommonModule,
    RouterModule,
    MessageMetadataComponent,
    MessageBodyViewerComponent,
    ConversationContextComponent,
    RelatedMessagesComponent,
    LoadingSpinnerComponent
  ],
  templateUrl: './message-inspector.component.html',
  styleUrls: ['./message-inspector.component.scss']
})
export class MessageInspectorComponent implements OnInit, OnDestroy {
  state: MessageInspectorState | null = null;
  queueName: string = '';
  conversationHandle: string = '';

  private destroy$ = new Subject<void>();

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private inspectorService: MessageInspectorService
  ) {}

  ngOnInit(): void {
    this.inspectorService.state$
      .pipe(takeUntil(this.destroy$))
      .subscribe(state => {
        this.state = state;
      });

    combineLatest([
      this.route.params,
      this.route.queryParams
    ])
      .pipe(takeUntil(this.destroy$))
      .subscribe(([params, queryParams]) => {
        this.queueName = params['queueName'] || queryParams['queue'] || '';
        this.conversationHandle = params['conversationHandle'] || queryParams['handle'] || '';

        if (this.queueName && this.conversationHandle) {
          this.loadMessage();
        }
      });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
    this.inspectorService.clearCurrentMessage();
  }

  loadMessage(): void {
    this.inspectorService.loadMessage(this.queueName, this.conversationHandle);
  }

  onMessageSelected(message: RelatedMessage): void {
    if (this.queueName) {
      this.inspectorService.navigateToMessage(this.queueName, message);
    }
  }

  onNavigatePrevious(): void {
    this.inspectorService.navigateToPrevious();
  }

  onNavigateNext(): void {
    this.inspectorService.navigateToNext();
  }

  goBack(): void {
    if (this.queueName) {
      this.router.navigate(['/queue-explorer'], {
        queryParams: { queue: this.queueName }
      });
    } else {
      this.router.navigate(['/queue-explorer']);
    }
  }

  refreshMessage(): void {
    if (this.queueName && this.conversationHandle) {
      this.loadMessage();
    }
  }

  get currentMessage(): InspectedMessage | null {
    return this.state?.currentMessage ?? null;
  }

  get isLoading(): boolean {
    return this.state?.loading ?? false;
  }

  get error(): string | null {
    return this.state?.error ?? null;
  }

  get hasMessage(): boolean {
    return !!this.currentMessage;
  }
}
