import { Component, EventEmitter, Input, OnChanges, Output, SimpleChanges, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { BubbleCardComponent } from '../../../shared/components/bubble-card/bubble-card.component';
import { FormControlFieldComponent } from '../../../shared/components/form-control-field/form-control-field.component';
import {
  ENABLE_WHEN_OPERATORS,
  FHIR_QUESTIONNAIRE_STATUSES,
  QUESTION_ITEM_TYPES,
  QuestionnaireEnableWhen,
  QuestionnaireItem,
  QuestionnaireItemType,
  QuestionnaireProfile
} from '../models/questionnaire.model';
import { TranslateModule, TranslateService } from '@ngx-translate/core';

@Component({
  selector: 'app-questionnaire-form',
  standalone: true,
  imports: [CommonModule, FormsModule, BubbleCardComponent, FormControlFieldComponent, TranslateModule],
  templateUrl: './questionnaire-form.component.html',
  styleUrl: './questionnaire-form.component.scss'
})
export class QuestionnaireFormComponent implements OnChanges {
  @Input() questionnaire: QuestionnaireProfile | null = null;
  @Input() createMode = false;
  @Input() loading = false;

  @Output() save = new EventEmitter<QuestionnaireProfile>();
  @Output() questionnaireChange = new EventEmitter<QuestionnaireProfile>();

  readonly statuses = FHIR_QUESTIONNAIRE_STATUSES;
  readonly itemTypes = QUESTION_ITEM_TYPES;
  readonly enableWhenOperators = ENABLE_WHEN_OPERATORS;

  private readonly translateService = inject(TranslateService);

  editMode = false;

  model: QuestionnaireProfile = this.createEmptyQuestionnaire();

  get statusSelectOptions(): Array<{ value: string; label: string }> {
    return this.statuses.map((status) => ({
      value: status,
      label: this.translateService.instant('questionnaires.status.' + status)
    }));
  }

  ngOnChanges(changes: SimpleChanges): void {
    if ((changes['questionnaire'] && this.questionnaire) || changes['createMode']) {
      this.model = this.questionnaire ? this.cloneQuestionnaire(this.questionnaire) : this.createEmptyQuestionnaire();
      this.editMode = this.createMode;
      this.emitModelChange();
    }
  }

  toggleEdit(): void {
    if (this.createMode) {
      return;
    }
    this.editMode = true;
  }

  cancelEdit(): void {
    this.model = this.questionnaire ? this.cloneQuestionnaire(this.questionnaire) : this.createEmptyQuestionnaire();
    this.editMode = this.createMode;
    this.emitModelChange();
  }

  submit(): void {
    if (!this.editMode || !this.model.title.trim()) {
      return;
    }

    this.save.emit(this.normalizeQuestionnaire(this.model));
  }

  addRootQuestion(type: QuestionnaireItemType = 'string'): void {
    this.model.items.push(this.createItem(type));
    this.emitModelChange();
  }

  addRootGroup(): void {
    this.model.items.push(this.createItem('group'));
    this.emitModelChange();
  }

  addChildQuestion(group: QuestionnaireItem, type: QuestionnaireItemType = 'string'): void {
    group.items.push(this.createItem(type));
    this.emitModelChange();
  }

  addChildGroup(group: QuestionnaireItem): void {
    group.items.push(this.createItem('group'));
    this.emitModelChange();
  }

  removeItem(list: QuestionnaireItem[], index: number): void {
    list.splice(index, 1);
    this.emitModelChange();
  }

  moveItem(list: QuestionnaireItem[], index: number, direction: -1 | 1): void {
    const nextIndex = index + direction;
    if (nextIndex < 0 || nextIndex >= list.length) {
      return;
    }

    const temp = list[index];
    list[index] = list[nextIndex];
    list[nextIndex] = temp;
    this.emitModelChange();
  }

  onItemTypeChange(item: QuestionnaireItem): void {
    if (item.type !== 'choice') {
      item.answerOptions = [];
    }

    if (item.type !== 'group') {
      item.items = [];
    } else if (!Array.isArray(item.items)) {
      item.items = [];
    }

    if (item.type === 'quantity') {
      if (!item.unit) {
        item.unit = '';
      }
    } else {
      item.unit = undefined;
    }

    this.emitModelChange();
  }

  addAnswerOption(item: QuestionnaireItem): void {
    if (item.type !== 'choice') {
      return;
    }
    item.answerOptions.push('');
    this.emitModelChange();
  }

  removeAnswerOption(item: QuestionnaireItem, index: number): void {
    item.answerOptions.splice(index, 1);
    this.emitModelChange();
  }

  addEnableWhen(item: QuestionnaireItem): void {
    item.enableWhen.push({
      uid: this.createUid('ew'),
      questionLinkId: '',
      operator: '=',
      answer: ''
    });
    this.emitModelChange();
  }

  removeEnableWhen(item: QuestionnaireItem, index: number): void {
    item.enableWhen.splice(index, 1);
    this.emitModelChange();
  }

  regenerateLinkId(item: QuestionnaireItem): void {
    item.linkId = this.createUid('q');
    this.emitModelChange();
  }

  emitModelChange(): void {
    this.questionnaireChange.emit(this.normalizeQuestionnaire(this.model));
  }

  getQuestionReferences(currentItem: QuestionnaireItem): string[] {
    const links = this.collectQuestionLinks(this.model.items)
      .filter((linkId) => linkId !== currentItem.linkId);

    return Array.from(new Set(links));
  }

  private collectQuestionLinks(items: QuestionnaireItem[]): string[] {
    const refs: string[] = [];

    for (const item of items) {
      if (item.type !== 'group' && item.linkId.trim().length > 0) {
        refs.push(item.linkId.trim());
      }
      if (item.items.length > 0) {
        refs.push(...this.collectQuestionLinks(item.items));
      }
    }

    return refs;
  }

  private createItem(type: QuestionnaireItemType): QuestionnaireItem {
    return {
      uid: this.createUid('item'),
      linkId: this.createUid('q'),
      text: '',
      type,
      required: false,
      repeats: false,
      answerOptions: type === 'choice' ? [''] : [],
      enableWhen: [],
      items: type === 'group' ? [] : [],
      unit: type === 'quantity' ? '' : undefined
    };
  }

  private createEmptyQuestionnaire(): QuestionnaireProfile {
    return {
      title: '',
      description: '',
      status: 'draft',
      items: []
    };
  }

  private normalizeQuestionnaire(questionnaire: QuestionnaireProfile): QuestionnaireProfile {
    const cloned = this.cloneQuestionnaire(questionnaire);
    cloned.title = cloned.title.trim();
    cloned.description = cloned.description.trim();
    cloned.items = this.normalizeItems(cloned.items);
    return cloned;
  }

  private normalizeItems(items: QuestionnaireItem[]): QuestionnaireItem[] {
    return items.map((item) => {
      const normalized: QuestionnaireItem = {
        ...item,
        text: item.text.trim(),
        linkId: item.linkId.trim() || this.createUid('q'),
        answerOptions: item.type === 'choice'
          ? item.answerOptions.map((option) => option.trim()).filter(Boolean)
          : [],
        enableWhen: item.enableWhen
          .map((condition) => ({
            ...condition,
            questionLinkId: condition.questionLinkId.trim(),
            answer: String(condition.answer ?? '').trim()
          }))
          .filter((condition) => condition.questionLinkId.length > 0),
        items: item.type === 'group' ? this.normalizeItems(item.items) : []
      };

      return normalized;
    });
  }

  private cloneQuestionnaire(source: QuestionnaireProfile): QuestionnaireProfile {
    return {
      id: source.id,
      title: source.title,
      description: source.description,
      status: source.status,
      date: source.date,
      items: this.cloneItems(source.items)
    };
  }

  private cloneItems(items: QuestionnaireItem[]): QuestionnaireItem[] {
    return items.map((item) => ({
      uid: item.uid || this.createUid('item'),
      linkId: item.linkId,
      text: item.text,
      type: item.type,
      required: item.required,
      repeats: item.repeats,
      answerOptions: [...item.answerOptions],
      enableWhen: item.enableWhen.map((condition: QuestionnaireEnableWhen) => ({ ...condition, uid: condition.uid || this.createUid('ew') })),
      items: this.cloneItems(item.items)
    }));
  }

  private createUid(prefix: string): string {
    return `${prefix}-${Math.random().toString(36).slice(2, 10)}`;
  }
}
