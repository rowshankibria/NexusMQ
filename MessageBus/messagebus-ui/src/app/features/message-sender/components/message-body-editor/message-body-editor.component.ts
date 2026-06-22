import {
  Component,
  Input,
  Output,
  EventEmitter,
  OnChanges,
  SimpleChanges,
  ViewChild,
  ElementRef
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MessageBodyFormat, MessageTemplate } from '../../models';

@Component({
  selector: 'app-message-body-editor',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './message-body-editor.component.html',
  styleUrls: ['./message-body-editor.component.scss']
})
export class MessageBodyEditorComponent implements OnChanges {
  @Input() content: string = '';
  @Input() format: MessageBodyFormat = 'raw';
  @Input() templates: MessageTemplate[] = [];
  @Input() error: string | null = null;
  @Input() disabled: boolean = false;

  @Output() contentChange = new EventEmitter<string>();
  @Output() formatChange = new EventEmitter<MessageBodyFormat>();
  @Output() templateSelected = new EventEmitter<MessageTemplate>();

  @ViewChild('editorTextarea') editorTextarea!: ElementRef<HTMLTextAreaElement>;

  showTemplateDropdown: boolean = false;
  validationMessage: string | null = null;
  validationStatus: 'valid' | 'invalid' | 'none' = 'none';

  formats: { value: MessageBodyFormat; label: string }[] = [
    { value: 'raw', label: 'Raw' },
    { value: 'json', label: 'JSON' },
    { value: 'xml', label: 'XML' }
  ];

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['content'] || changes['format']) {
      this.validateContent();
    }
  }

  onContentChange(value: string): void {
    this.contentChange.emit(value);
    this.validateContent();
  }

  onFormatChange(format: MessageBodyFormat): void {
    this.formatChange.emit(format);
    this.validateContent();
  }

  validateContent(): void {
    if (!this.content) {
      this.validationStatus = 'none';
      this.validationMessage = null;
      return;
    }

    if (this.format === 'json') {
      try {
        JSON.parse(this.content);
        this.validationStatus = 'valid';
        this.validationMessage = 'Valid JSON';
      } catch (e: any) {
        this.validationStatus = 'invalid';
        this.validationMessage = `Invalid JSON: ${e.message}`;
      }
    } else if (this.format === 'xml') {
      if (this.isValidXml(this.content)) {
        this.validationStatus = 'valid';
        this.validationMessage = 'Valid XML';
      } else {
        this.validationStatus = 'invalid';
        this.validationMessage = 'Invalid XML format';
      }
    } else {
      this.validationStatus = 'none';
      this.validationMessage = null;
    }
  }

  private isValidXml(xml: string): boolean {
    try {
      const parser = new DOMParser();
      const doc = parser.parseFromString(xml, 'application/xml');
      return !doc.querySelector('parsererror');
    } catch {
      return false;
    }
  }

  formatContent(): void {
    if (!this.content) return;

    let formatted = this.content;

    if (this.format === 'json') {
      try {
        formatted = JSON.stringify(JSON.parse(this.content), null, 2);
        this.contentChange.emit(formatted);
      } catch {
        // Invalid JSON, cannot format
      }
    } else if (this.format === 'xml') {
      formatted = this.formatXml(this.content);
      this.contentChange.emit(formatted);
    }
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

  toggleTemplateDropdown(): void {
    this.showTemplateDropdown = !this.showTemplateDropdown;
  }

  selectTemplate(template: MessageTemplate): void {
    this.templateSelected.emit(template);
    this.showTemplateDropdown = false;
  }

  clearContent(): void {
    this.contentChange.emit('');
  }

  getCharacterCount(): number {
    return this.content.length;
  }

  getLineCount(): number {
    if (!this.content) return 0;
    return this.content.split('\n').length;
  }

  getByteSize(): string {
    const bytes = new Blob([this.content]).size;
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

  insertAtCursor(text: string): void {
    const textarea = this.editorTextarea?.nativeElement;
    if (!textarea) return;

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const before = this.content.substring(0, start);
    const after = this.content.substring(end);

    const newContent = before + text + after;
    this.contentChange.emit(newContent);

    setTimeout(() => {
      textarea.selectionStart = textarea.selectionEnd = start + text.length;
      textarea.focus();
    }, 0);
  }

  handleKeyDown(event: KeyboardEvent): void {
    if (event.key === 'Tab') {
      event.preventDefault();
      this.insertAtCursor('  ');
    }
  }
}
