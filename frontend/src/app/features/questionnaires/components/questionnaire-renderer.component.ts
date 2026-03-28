import { Component, ElementRef, Input, OnChanges, SimpleChanges, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TranslateModule } from '@ngx-translate/core';
import { BubbleCardComponent } from '../../../shared/components/bubble-card/bubble-card.component';
import { QuestionnaireItem, QuestionnaireProfile } from '../models/questionnaire.model';

@Component({
  selector: 'app-questionnaire-renderer',
  standalone: true,
  imports: [CommonModule, FormsModule, TranslateModule, BubbleCardComponent],
  templateUrl: './questionnaire-renderer.component.html',
  styleUrl: './questionnaire-renderer.component.scss'
})
export class QuestionnaireRendererComponent implements OnChanges {
  @Input() questionnaire: QuestionnaireProfile | null = null;
  @Input() initialAnswers: Record<string, string | number | boolean | string[]> | null = null;

  @ViewChild('previewScrollContainer') previewScrollContainer?: ElementRef<HTMLDivElement>;

  answers: Record<string, string | number | boolean | string[]> = {};

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['questionnaire'] || changes['initialAnswers']) {
      this.answers = { ...(this.initialAnswers || {}) };
      this.pruneAnswers();
    }
  }

  getAnswerSnapshot(): Record<string, string | number | boolean | string[]> {
    return { ...this.answers };
  }

  get visibleRootItems(): QuestionnaireItem[] {
    return this.getVisibleItems(this.questionnaire?.items || []);
  }

  getVisibleItems(items: QuestionnaireItem[]): QuestionnaireItem[] {
    return items.filter((item) => this.isItemEnabled(item));
  }

  isItemEnabled(item: QuestionnaireItem): boolean {
    if (!item.enableWhen.length) {
      return true;
    }

    return item.enableWhen.every((condition) => {
      const actualAnswer = this.answers[condition.questionLinkId];
      const expectedAnswer = condition.answer;

      if (condition.operator === 'exists') {
        const exists = actualAnswer !== undefined && actualAnswer !== null && actualAnswer !== '';
        const expectedExists = expectedAnswer === '' ? true : expectedAnswer === 'true';
        return exists === expectedExists;
      }

      if (Array.isArray(actualAnswer)) {
        return actualAnswer.some((value) => this.compareValues(String(value), expectedAnswer, condition.operator));
      }

      return this.compareValues(actualAnswer, expectedAnswer, condition.operator);
    });
  }

  toggleChoice(item: QuestionnaireItem, option: string, checked: boolean): void {
    this.updateAnswersWithScrollPreserved(() => {
      const current = Array.isArray(this.answers[item.linkId]) ? [...(this.answers[item.linkId] as string[])] : [];
      const next = checked ? Array.from(new Set([...current, option])) : current.filter((value) => value !== option);
      this.answers[item.linkId] = next;
      this.clearDisabledAnswers();
    });
  }

  updateAnswer(linkId: string, value: string | number | boolean): void {
    this.updateAnswersWithScrollPreserved(() => {
      this.answers[linkId] = value;
      this.clearDisabledAnswers();
    });
  }

  hasChoiceSelected(item: QuestionnaireItem, option: string): boolean {
    const current = this.answers[item.linkId];
    return Array.isArray(current) ? current.includes(option) : false;
  }

  private clearDisabledAnswers(): void {
    const validLinkIds = new Set<string>();
    this.collectVisibleLinkIds(this.questionnaire?.items || [], validLinkIds);

    Object.keys(this.answers).forEach((key) => {
      if (!validLinkIds.has(key)) {
        delete this.answers[key];
      }
    });
  }

  private collectVisibleLinkIds(items: QuestionnaireItem[], target: Set<string>): void {
    for (const item of this.getVisibleItems(items)) {
      target.add(item.linkId);
      if (item.items.length > 0) {
        this.collectVisibleLinkIds(item.items, target);
      }
    }
  }

  private pruneAnswers(): void {
    this.answers = { ...this.answers };
    this.clearDisabledAnswers();
  }

  private updateAnswersWithScrollPreserved(update: () => void): void {
    const container = this.previewScrollContainer?.nativeElement;
    const previousScrollTop = container?.scrollTop ?? 0;

    update();

    if (!container) {
      return;
    }

    requestAnimationFrame(() => {
      container.scrollTop = previousScrollTop;
    });
  }

  private compareValues(actual: unknown, expected: string, operator: string): boolean {
    const actualString = actual === undefined || actual === null ? '' : String(actual);
    const actualNumber = Number(actualString);
    const expectedNumber = Number(expected);
    const numericComparison = !Number.isNaN(actualNumber) && !Number.isNaN(expectedNumber);

    switch (operator) {
      case '=':
        return actualString === expected;
      case '!=':
        return actualString !== expected;
      case '>':
        return numericComparison ? actualNumber > expectedNumber : actualString > expected;
      case '<':
        return numericComparison ? actualNumber < expectedNumber : actualString < expected;
      case '>=':
        return numericComparison ? actualNumber >= expectedNumber : actualString >= expected;
      case '<=':
        return numericComparison ? actualNumber <= expectedNumber : actualString <= expected;
      default:
        return false;
    }
  }
}
