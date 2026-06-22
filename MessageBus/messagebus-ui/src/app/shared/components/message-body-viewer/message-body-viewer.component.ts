import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';

export type ViewMode = 'formatted' | 'raw' | 'hex';
export type ContentType = 'json' | 'xml' | 'text' | 'binary';

@Component({
  selector: 'app-message-body-viewer',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './message-body-viewer.component.html',
  styleUrls: ['./message-body-viewer.component.scss']
})
export class MessageBodyViewerComponent {
  @Input() messageBody: string | null = null;
  @Input() messageType: string = '';

  viewMode: ViewMode = 'formatted';
  copied: boolean = false;
  expandedPaths: Set<string> = new Set();

  get contentType(): ContentType {
    if (!this.messageBody) return 'text';

    const trimmed = this.messageBody.trim();

    if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
      try {
        JSON.parse(trimmed);
        return 'json';
      } catch {
        return 'text';
      }
    }

    if (trimmed.startsWith('<') && trimmed.endsWith('>')) {
      return 'xml';
    }

    // Check for binary content (non-printable characters)
    if (/[\x00-\x08\x0E-\x1F]/.test(this.messageBody)) {
      return 'binary';
    }

    return 'text';
  }

  get formattedContent(): string {
    if (!this.messageBody) return '';

    switch (this.contentType) {
      case 'json':
        try {
          return JSON.stringify(JSON.parse(this.messageBody), null, 2);
        } catch {
          return this.messageBody;
        }
      case 'xml':
        return this.formatXml(this.messageBody);
      default:
        return this.messageBody;
    }
  }

  get hexContent(): string {
    if (!this.messageBody) return '';

    const bytes = new TextEncoder().encode(this.messageBody);
    const lines: string[] = [];
    const bytesPerLine = 16;

    for (let i = 0; i < bytes.length; i += bytesPerLine) {
      const lineBytes = bytes.slice(i, i + bytesPerLine);
      const hex = Array.from(lineBytes)
        .map(b => b.toString(16).padStart(2, '0'))
        .join(' ');
      const ascii = Array.from(lineBytes)
        .map(b => (b >= 32 && b <= 126) ? String.fromCharCode(b) : '.')
        .join('');

      const offset = i.toString(16).padStart(8, '0');
      const hexPadded = hex.padEnd(bytesPerLine * 3 - 1, ' ');
      lines.push(`${offset}  ${hexPadded}  |${ascii}|`);
    }

    return lines.join('\n');
  }

  get displayContent(): string {
    switch (this.viewMode) {
      case 'formatted':
        return this.formattedContent;
      case 'hex':
        return this.hexContent;
      default:
        return this.messageBody || '';
    }
  }

  get isEmpty(): boolean {
    return !this.messageBody || this.messageBody.trim() === '';
  }

  get byteSize(): number {
    if (!this.messageBody) return 0;
    return new TextEncoder().encode(this.messageBody).length;
  }

  setViewMode(mode: ViewMode): void {
    this.viewMode = mode;
  }

  copyToClipboard(): void {
    if (!this.messageBody) return;

    navigator.clipboard.writeText(this.messageBody).then(() => {
      this.copied = true;
      setTimeout(() => {
        this.copied = false;
      }, 2000);
    });
  }

  exportToFile(): void {
    if (!this.messageBody) return;

    const extension = this.contentType === 'json' ? 'json' : this.contentType === 'xml' ? 'xml' : 'txt';
    const filename = `message-body-${Date.now()}.${extension}`;
    const blob = new Blob([this.messageBody], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);

    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  private formatXml(xml: string): string {
    let formatted = '';
    let indent = '';
    const tab = '  ';

    xml.split(/>\s*</).forEach(node => {
      if (node.match(/^\/\w/)) {
        indent = indent.substring(tab.length);
      }
      formatted += indent + '<' + node + '>\n';
      if (node.match(/^<?\w[^>]*[^\/]$/) && !node.startsWith('?')) {
        indent += tab;
      }
    });

    return formatted.substring(1, formatted.length - 2);
  }

  formatBytes(bytes: number): string {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }
}
