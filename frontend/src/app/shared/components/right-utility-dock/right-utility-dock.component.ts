import { CommonModule } from '@angular/common';
import { Component, HostListener, OnInit, effect, inject } from '@angular/core';
import { TranslateModule } from '@ngx-translate/core';
import { ChatAssistantStateService, UtilityDockView } from '../../../core/services/chat-assistant-state.service';
import { ChatAssistantComponent } from '../chat-assistant/chat-assistant.component';
import { AgendaPageComponent } from '../../../features/agenda/components/agenda-page.component';
import { PatientDiscussionsComponent } from '../../../features/my-patients/features/discussions/components/patient-discussions.component';
import { PatientProcedurePageComponent } from '../../../features/my-patients/features/procedures/components/patient-procedure-page.component';
import { PatientObservationPageComponent } from '../../../features/my-patients/features/observations/components/patient-observation-page.component';
import { PatientDocumentsComponent } from '../../../features/my-patients/features/documents/components/patient-documents.component';
import { PatientAnalysisComponent } from '../../../features/my-patients/features/patient-analysis/components/patient-analysis.component';

const UTILITY_DOCK_WIDTH_STORAGE_KEY = 'utilityDock.panelWidth';

@Component({
  selector: 'app-right-utility-dock',
  standalone: true,
  imports: [
    CommonModule,
    TranslateModule,
    ChatAssistantComponent,
    AgendaPageComponent,
    PatientDiscussionsComponent,
    PatientProcedurePageComponent,
    PatientObservationPageComponent,
    PatientDocumentsComponent,
    PatientAnalysisComponent
  ],
  templateUrl: './right-utility-dock.component.html',
  styleUrl: './right-utility-dock.component.scss'
})
export class RightUtilityDockComponent implements OnInit {
  readonly dock = inject(ChatAssistantStateService);
  panelWidth = 470;
  isResizing = false;
  private readonly loadedViews = new Set<UtilityDockView>();
  private documentWidthInitialized = false;

  private readonly _docWidthEffect = effect(() => {
    const active = this.dock.activeView();
    this.markViewAsLoaded(active);

    if (active === 'document' && !this.documentWidthInitialized) {
      this.documentWidthInitialized = true;
      if (this.panelWidth < 680) {
        this.setPanelWidth(680);
      }
    }
  });

  private readonly minPanelWidth = 340;
  private readonly maxPanelWidth = 860;
  private resizeStartX = 0;
  private resizeStartWidth = 470;

  readonly itemsBase: Array<{ view: UtilityDockView; label: string; title: string }> = [
    { view: 'chat', label: 'IA Assistant', title: 'IA Assistant' },
    { view: 'agenda', label: 'Agenda', title: 'Agenda' },
    { view: 'discussions', label: 'Discussions', title: 'Discussions' }
  ];

  get items(): Array<{ view: UtilityDockView; label: string; title: string }> {
    const items = [...this.itemsBase];
    if (this.dock.hasProcedureDraft()) {
      items.push({ view: 'procedure', label: 'Acte', title: 'Acte en cours' });
    }
    if (this.dock.hasObservationDraft()) {
      items.push({ view: 'observation', label: 'Observation', title: 'Observation en cours' });
    }
    if (this.dock.hasDocumentDraft()) {
      items.push({ view: 'document', label: 'Document', title: 'Document en cours' });
    }
    if (this.dock.hasPatientAnalysisDraft()) {
      items.push({ view: 'patient-analysis', label: 'Analyse', title: 'Analyse patient' });
    }
    return items;
  }

  ngOnInit(): void {
    this.panelWidth = this.loadInitialWidth();
    this.markViewAsLoaded(this.dock.activeView());
  }

  select(view: UtilityDockView): void {
    this.dock.toggle(view);
    this.markViewAsLoaded(this.dock.activeView());
  }

  close(): void {
    this.dock.close();
  }

  closeProcedure(): void {
    this.loadedViews.delete('procedure');
    this.dock.clearProcedureDraft();
  }

  closeObservation(): void {
    this.loadedViews.delete('observation');
    this.dock.clearObservationDraft();
  }

  closeDocument(): void {
    this.loadedViews.delete('document');
    this.dock.clearDocumentDraft();
  }

  closePatientAnalysis(): void {
    this.loadedViews.delete('patient-analysis');
    this.dock.clearPatientAnalysisDraft();
  }

  shouldRender(view: UtilityDockView): boolean {
    return this.loadedViews.has(view);
  }

  startResize(event: MouseEvent): void {
    event.preventDefault();
    this.isResizing = true;
    this.resizeStartX = event.clientX;
    this.resizeStartWidth = this.panelWidth;
    document.body.style.userSelect = 'none';
    document.body.style.cursor = 'col-resize';
  }

  onResizerKeyDown(event: KeyboardEvent): void {
    const step = 24;
    if (event.key === 'ArrowLeft') {
      event.preventDefault();
      this.setPanelWidth(this.panelWidth + step);
      return;
    }

    if (event.key === 'ArrowRight') {
      event.preventDefault();
      this.setPanelWidth(this.panelWidth - step);
    }
  }

  isActive(view: UtilityDockView): boolean {
    return this.dock.isViewActive(view);
  }

  @HostListener('document:mousemove', ['$event'])
  onDocumentMouseMove(event: MouseEvent): void {
    if (!this.isResizing) {
      return;
    }

    const deltaX = this.resizeStartX - event.clientX;
    this.setPanelWidth(this.resizeStartWidth + deltaX);
  }

  @HostListener('document:mouseup')
  onDocumentMouseUp(): void {
    if (!this.isResizing) {
      return;
    }

    this.isResizing = false;
    document.body.style.removeProperty('user-select');
    document.body.style.removeProperty('cursor');
  }

  @HostListener('window:resize')
  onWindowResize(): void {
    this.setPanelWidth(this.panelWidth);
  }

  panelTitle(): string {
    const active = this.dock.activeView();
    if (active === 'agenda') {
      return 'Agenda';
    }
    if (active === 'discussions') {
      return 'Discussions';
    }
    if (active === 'procedure') {
      return 'Acte en cours';
    }
    if (active === 'observation') {
      return 'Observation en cours';
    }
    if (active === 'document') {
      return 'Document en cours';
    }
    if (active === 'patient-analysis') {
      return 'Analyse patient';
    }
    return 'IA Assistant';
  }

  private markViewAsLoaded(view: UtilityDockView | null): void {
    if (!view) {
      return;
    }
    this.loadedViews.add(view);
  }

  private clampPanelWidth(width: number): number {
    const viewportMax = Math.floor(window.innerWidth * 0.7);
    const max = Math.max(this.minPanelWidth, Math.min(this.maxPanelWidth, viewportMax));
    return Math.min(max, Math.max(this.minPanelWidth, width));
  }

  private setPanelWidth(width: number): void {
    this.panelWidth = this.clampPanelWidth(width);
    this.persistWidth(this.panelWidth);
  }

  private loadInitialWidth(): number {
    if (typeof window === 'undefined') {
      return this.panelWidth;
    }

    const raw = window.localStorage.getItem(UTILITY_DOCK_WIDTH_STORAGE_KEY);
    const parsed = Number(raw);
    if (!Number.isFinite(parsed) || parsed <= 0) {
      return this.clampPanelWidth(this.panelWidth);
    }
    return this.clampPanelWidth(parsed);
  }

  private persistWidth(width: number): void {
    if (typeof window === 'undefined') {
      return;
    }
    window.localStorage.setItem(UTILITY_DOCK_WIDTH_STORAGE_KEY, String(width));
  }
}
