import { Component, Input, OnChanges, SimpleChanges, ElementRef, ViewChild, AfterViewInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MessageBody, MessageFormat, InspectedMessage } from '../../models';
import { MessageInspectorService } from '../../services';

declare var Prism: any;

@Component({
  selector: 'app-message-body-viewer',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './message-body-viewer.component.html',
  styleUrls: ['./message-body-viewer.component.scss']
})
export class MessageBodyViewerComponent implements OnChanges, AfterViewInit {
  @Input() message: InspectedMessage | null = null;

  @ViewChild('codeBlock') codeBlockRef!: ElementRef;

  formattedContent: string = '';
  detectedFormat: MessageFormat = 'text';
  viewMode: 'formatted' | 'raw' = 'formatted';
  showBinaryView: boolean = false;
  copySuccess: boolean = false;

  constructor(private inspectorService: MessageInspectorService) {}

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['message'] && this.message?.body) {
      this.processContent();
    }
  }

  ngAfterViewInit(): void {
    this.highlightCode();
  }

  private processContent(): void {
    if (!this.message?.body?.content) {
      this.formattedContent = '';
      this.detectedFormat = 'text';
      return;
    }

    this.detectedFormat = this.message.body.format ||
      this.inspectorService.detectMessageFormat(this.message.body.content);

    this.formattedContent = this.viewMode === 'formatted'
      ? this.inspectorService.formatMessageBody(this.message.body.content, this.detectedFormat)
      : this.message.body.content;

    setTimeout(() => this.highlightCode(), 0);
  }

  private highlightCode(): void {
    if (this.codeBlockRef?.nativeElement && typeof Prism !== 'undefined') {
      Prism.highlightElement(this.codeBlockRef.nativeElement);
    }
  }

  toggleViewMode(): void {
    this.viewMode = this.viewMode === 'formatted' ? 'raw' : 'formatted';
    this.processContent();
  }

  toggleBinaryView(): void {
    this.showBinaryView = !this.showBinaryView;
  }

  async copyToClipboard(): Promise<void> {
    if (!this.message?.body?.content) return;

    try {
      await this.inspectorService.copyToClipboard(this.message.body.content);
      this.copySuccess = true;
      setTimeout(() => this.copySuccess = false, 2000);
    } catch (error) {
      console.error('Failed to copy:', error);
    }
  }

  exportToFile(): void {
    if (!this.message) return;
    this.inspectorService.exportToFile(this.message);
  }

  getPrismLanguage(): string {
    switch (this.detectedFormat) {
      case 'json':
        return 'language-json';
      case 'xml':
        return 'language-xml';
      default:
        return 'language-plaintext';
    }
  }

  getFormatIcon(): string {
    switch (this.detectedFormat) {
      case 'json':
        return 'JSON';
      case 'xml':
        return 'XML';
      case 'binary':
        return 'BIN';
      default:
        return 'TXT';
    }
  }

  formatBytes(bytes: number): string {
    return this.inspectorService.formatBytes(bytes);
  }

  getBinaryHexView(): string {
    if (!this.message?.body?.rawBytes) {
      return this.convertToHex(this.message?.body?.content || '');
    }
    return this.bytesToHex(this.message.body.rawBytes);
  }

  private convertToHex(content: string): string {
    const lines: string[] = [];
    const bytes = new TextEncoder().encode(content);

    for (let i = 0; i < bytes.length; i += 16) {
      const chunk = bytes.slice(i, i + 16);
      const hex = Array.from(chunk)
        .map(b => b.toString(16).padStart(2, '0'))
        .join(' ');
      const ascii = Array.from(chunk)
        .map(b => (b >= 32 && b <= 126) ? String.fromCharCode(b) : '.')
        .join('');
      const offset = i.toString(16).padStart(8, '0');
      lines.push(`${offset}  ${hex.padEnd(48)}  ${ascii}`);
    }

    return lines.join('\n');
  }

  private bytesToHex(bytes: number[]): string {
    const lines: string[] = [];

    for (let i = 0; i < bytes.length; i += 16) {
      const chunk = bytes.slice(i, i + 16);
      const hex = chunk.map(b => b.toString(16).padStart(2, '0')).join(' ');
      const ascii = chunk.map(b => (b >= 32 && b <= 126) ? String.fromCharCode(b) : '.').join('');
      const offset = i.toString(16).padStart(8, '0');
      lines.push(`${offset}  ${hex.padEnd(48)}  ${ascii}`);
    }

    return lines.join('\n');
  }

  getCharacterCount(): number {
    return this.message?.body?.content?.length || 0;
  }

  getLineCount(): number {
    if (!this.message?.body?.content) return 0;
    return this.message.body.content.split('\n').length;
  }
}
