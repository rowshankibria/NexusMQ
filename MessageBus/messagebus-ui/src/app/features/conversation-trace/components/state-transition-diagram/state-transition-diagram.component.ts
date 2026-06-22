import { Component, Input, OnChanges, SimpleChanges } from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  Conversation,
  ConversationState,
  conversationStateLabels,
  conversationStateColors
} from '../../models';

interface DiagramNode {
  id: ConversationState | 'START';
  label: string;
  x: number;
  y: number;
  isStart?: boolean;
  isCurrent?: boolean;
  isPotential?: boolean;
  isError?: boolean;
  isEnd?: boolean;
}

interface DiagramEdge {
  from: string;
  to: string;
  label?: string;
  isActive?: boolean;
  isPotential?: boolean;
}

@Component({
  selector: 'app-state-transition-diagram',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './state-transition-diagram.component.html',
  styleUrls: ['./state-transition-diagram.component.scss']
})
export class StateTransitionDiagramComponent implements OnChanges {
  @Input() conversation: Conversation | null = null;
  @Input() currentState: ConversationState | null = null;

  stateLabels = conversationStateLabels;
  stateColors = conversationStateColors;

  nodes: DiagramNode[] = [];
  edges: DiagramEdge[] = [];

  // Diagram dimensions
  readonly diagramWidth = 500;
  readonly diagramHeight = 280;
  readonly nodeWidth = 100;
  readonly nodeHeight = 36;

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['conversation'] || changes['currentState']) {
      this.buildDiagram();
    }
  }

  private buildDiagram(): void {
    const state = this.currentState || this.conversation?.state || null;

    // Define all possible states and their positions
    this.nodes = [
      { id: 'START', label: 'Start', x: 30, y: 120, isStart: true },
      { id: 'SO', label: 'Started Outbound', x: 150, y: 60, isCurrent: state === 'SO' },
      { id: 'SI', label: 'Started Inbound', x: 150, y: 180, isCurrent: state === 'SI' },
      { id: 'CO', label: 'Conversing', x: 280, y: 120, isCurrent: state === 'CO' },
      { id: 'DO', label: 'Disconn. Out', x: 400, y: 60, isCurrent: state === 'DO' },
      { id: 'DI', label: 'Disconn. In', x: 400, y: 180, isCurrent: state === 'DI' },
      { id: 'CD', label: 'Closed', x: 500, y: 120, isCurrent: state === 'CD', isEnd: true },
      { id: 'ER', label: 'Error', x: 500, y: 240, isCurrent: state === 'ER', isError: true, isEnd: true }
    ];

    // Mark potential next states
    this.markPotentialStates(state);

    // Define edges (state transitions)
    this.edges = [
      { from: 'START', to: 'SO', label: 'Begin Dialog', isActive: !state || state === 'SO' },
      { from: 'START', to: 'SI', label: 'Receive Dialog', isActive: !state || state === 'SI' },
      { from: 'SO', to: 'CO', isActive: this.isTransitionActive(['SO'], 'CO', state) },
      { from: 'SI', to: 'CO', isActive: this.isTransitionActive(['SI'], 'CO', state) },
      { from: 'CO', to: 'DO', isActive: this.isTransitionActive(['CO'], 'DO', state) },
      { from: 'CO', to: 'DI', isActive: this.isTransitionActive(['CO'], 'DI', state) },
      { from: 'DO', to: 'CD', isActive: this.isTransitionActive(['DO'], 'CD', state) },
      { from: 'DI', to: 'CD', isActive: this.isTransitionActive(['DI'], 'CD', state) },
      { from: 'SO', to: 'ER', isPotential: state === 'SO' },
      { from: 'SI', to: 'ER', isPotential: state === 'SI' },
      { from: 'CO', to: 'ER', isPotential: state === 'CO' },
      { from: 'DO', to: 'ER', isPotential: state === 'DO' },
      { from: 'DI', to: 'ER', isPotential: state === 'DI' }
    ];
  }

  private markPotentialStates(currentState: ConversationState | null): void {
    if (!currentState) return;

    const potentialNextStates: Record<ConversationState, ConversationState[]> = {
      'SO': ['CO', 'ER'],
      'SI': ['CO', 'ER'],
      'CO': ['DO', 'DI', 'ER'],
      'DO': ['CD', 'ER'],
      'DI': ['CD', 'ER'],
      'CD': [],
      'ER': []
    };

    const nextStates = potentialNextStates[currentState] || [];
    this.nodes.forEach(node => {
      if (nextStates.includes(node.id as ConversationState)) {
        node.isPotential = true;
      }
    });
  }

  private isTransitionActive(fromStates: ConversationState[], toState: ConversationState, currentState: ConversationState | null): boolean {
    if (!currentState) return false;

    // Check if we've passed this transition (currentState is toState or later)
    const stateOrder: ConversationState[] = ['SO', 'SI', 'CO', 'DO', 'DI', 'CD', 'ER'];
    const currentIndex = stateOrder.indexOf(currentState);
    const toIndex = stateOrder.indexOf(toState);

    return fromStates.includes(currentState) || (currentIndex >= toIndex && toState !== 'ER');
  }

  getNodeClass(node: DiagramNode): string {
    const classes: string[] = ['diagram-node'];

    if (node.isStart) classes.push('start-node');
    if (node.isCurrent) classes.push('current-node');
    if (node.isPotential && !node.isCurrent) classes.push('potential-node');
    if (node.isError) classes.push('error-node');
    if (node.isEnd) classes.push('end-node');

    return classes.join(' ');
  }

  getEdgePath(edge: DiagramEdge): string {
    const fromNode = this.nodes.find(n => n.id === edge.from);
    const toNode = this.nodes.find(n => n.id === edge.to);

    if (!fromNode || !toNode) return '';

    const fromX = fromNode.x + (fromNode.isStart ? 20 : this.nodeWidth / 2);
    const fromY = fromNode.y + this.nodeHeight / 2;
    const toX = toNode.x;
    const toY = toNode.y + this.nodeHeight / 2;

    // Create a curved path
    const midX = (fromX + toX) / 2;
    const curve = Math.abs(fromY - toY) > 50 ? 20 : 0;

    return `M ${fromX} ${fromY} C ${midX + curve} ${fromY}, ${midX - curve} ${toY}, ${toX} ${toY}`;
  }

  getEdgeClass(edge: DiagramEdge): string {
    const classes: string[] = ['diagram-edge'];

    if (edge.isActive) classes.push('active-edge');
    if (edge.isPotential) classes.push('potential-edge');

    return classes.join(' ');
  }

  getEdgeLabelPosition(edge: DiagramEdge): { x: number; y: number } {
    const fromNode = this.nodes.find(n => n.id === edge.from);
    const toNode = this.nodes.find(n => n.id === edge.to);

    if (!fromNode || !toNode) return { x: 0, y: 0 };

    return {
      x: (fromNode.x + toNode.x) / 2 + 20,
      y: (fromNode.y + toNode.y) / 2 + this.nodeHeight / 2 - 5
    };
  }

  getStateDescription(state: ConversationState): string {
    const descriptions: Record<ConversationState, string> = {
      'SO': 'Dialog initiated, waiting for response',
      'SI': 'Dialog received, ready to respond',
      'CO': 'Active conversation in progress',
      'DO': 'Initiated close, waiting for confirmation',
      'DI': 'Received close request',
      'CD': 'Conversation completed successfully',
      'ER': 'Conversation ended with error'
    };
    return descriptions[state] || '';
  }
}
