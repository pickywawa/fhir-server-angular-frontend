import { CommonModule } from '@angular/common';
import { Component, HostListener, Input, OnChanges, OnInit, SimpleChanges } from '@angular/core';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { ConnectedPractitionerResolverService } from '../../../../../core/services/connected-practitioner-resolver.service';
import { ChatAssistantStateService } from '../../../../../core/services/chat-assistant-state.service';
import { BubbleCardComponent } from '../../../../../shared/components/bubble-card/bubble-card.component';
import { ButtonPrimaryComponent } from '../../../../../core/components/button/button-primary.component';
import { ModalComponent } from '../../../../../core/components/modal/modal.component';
import {
  PatientDocumentHistoryItem,
  PatientDocumentItem,
  XDS_CLASS_OPTIONS,
  XDS_TYPE_OPTIONS
} from '../models/patient-document.model';
import { DocumentAiSummaryService } from '../services/document-ai-summary.service';
import { FhirPatientDocumentService } from '../services/fhir-patient-document.service';
import { TranslateModule, TranslateService } from '@ngx-translate/core';

@Component({
  selector: 'app-patient-documents',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, BubbleCardComponent, ButtonPrimaryComponent, ModalComponent, TranslateModule],
  templateUrl: './patient-documents.component.html',
  styleUrl: './patient-documents.component.scss'
})
export class PatientDocumentsComponent implements OnChanges, OnInit {
  @Input() patientId?: string;
  @Input() embeddedInRightDock = false;
  @Input() initialDocumentId?: string;

  readonly documentsForm: FormGroup;
  readonly classOptions = XDS_CLASS_OPTIONS;
  readonly typeOptions = XDS_TYPE_OPTIONS;

  documents: PatientDocumentItem[] = [];
  loading = false;
  saving = false;
  error = '';
  showAddModal = false;
  selectedFile: File | null = null;
  isFileDragOver = false;
  isMobileLayout = false;
  showMobileViewer = false;
  viewerLoading = false;
  viewerError = '';
  viewerType: 'pdf' | 'image' | 'text' | 'unsupported' = 'unsupported';
  viewerResourceUrl: SafeResourceUrl | null = null;
  viewerImageUrl = '';
  viewerTextContent = '';
  viewerDownloadUrl = '';
  selectedDocument: PatientDocumentItem | null = null;
  activeViewerTab: 'preview' | 'details' | 'history' = 'preview';
  isViewerFullscreen = false;
  summaryLoading = false;
  summarySaving = false;
  summaryError = '';
  summaryValue = '';
  summaryOriginalValue = '';
  historyLoading = false;
  historyError = '';
  historyItems: PatientDocumentHistoryItem[] = [];
  replacingDocument = false;
  replacementError = '';
  showSavePdfVersionConfirm = false;
  private viewerBinaryData = '';
  private viewerBinaryContentType = '';

  constructor(
    private readonly fb: FormBuilder,
    private readonly documentService: FhirPatientDocumentService,
    private readonly summaryService: DocumentAiSummaryService,
    private readonly sanitizer: DomSanitizer,
    private readonly connectedPractitionerResolver: ConnectedPractitionerResolverService,
    private readonly translateService: TranslateService,
    private readonly utilityDockState: ChatAssistantStateService
  ) {
    this.documentsForm = this.fb.group({
      title: ['', [Validators.required, Validators.maxLength(120)]],
      classCode: [this.classOptions[0].code, Validators.required],
      typeCode: [this.typeOptions[0].code, Validators.required],
      file: [null, Validators.required]
    });
  }

  ngOnInit(): void {
    this.updateLayoutMode();
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['patientId'] || changes['initialDocumentId']) {
      this.loadDocuments();
    }
  }

  get showInlineDesktopViewer(): boolean {
    return this.embeddedInRightDock && !this.isMobileLayout;
  }

  onDocumentRowClick(document: PatientDocumentItem): void {
    if (this.isMobileLayout || this.embeddedInRightDock) {
      this.openDocumentViewer(document);
      return;
    }

    if (!this.patientId) {
      this.error = this.translateService.instant('myPatients.documents.errors.patientNotFound');
      return;
    }

    this.utilityDockState.startDocumentDraft(this.patientId, document.id);
  }

  openAddModal(): void {
    this.showAddModal = true;
  }

  closeAddModal(): void {
    this.showAddModal = false;
    this.selectedFile = null;
    this.isFileDragOver = false;
    this.documentsForm.reset({
      classCode: this.classOptions[0].code,
      typeCode: this.typeOptions[0].code,
      file: null,
      title: ''
    });
  }

  onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0] ?? null;
    this.selectedFile = file;
    this.isFileDragOver = false;
    this.documentsForm.patchValue({ file });
    this.documentsForm.get('file')?.markAsTouched();
  }

  onFileDragOver(event: DragEvent): void {
    event.preventDefault();
    this.isFileDragOver = true;
  }

  onFileDragLeave(event: DragEvent): void {
    event.preventDefault();
    this.isFileDragOver = false;
  }

  onFileDrop(event: DragEvent): void {
    event.preventDefault();
    this.isFileDragOver = false;

    const file = event.dataTransfer?.files?.[0] ?? null;
    this.selectedFile = file;
    this.documentsForm.patchValue({ file });
    this.documentsForm.get('file')?.markAsTouched();
  }

  submitDocument(): void {
    if (!this.patientId) {
      this.error = this.translateService.instant('myPatients.documents.errors.patientNotFound');
      return;
    }
    const patientId = this.patientId;

    if (this.documentsForm.invalid || !this.selectedFile) {
      this.documentsForm.markAllAsTouched();
      return;
    }
    const selectedFile = this.selectedFile;

    const classCode = this.classOptions.find((item) => item.code === this.documentsForm.value.classCode);
    const typeCode = this.typeOptions.find((item) => item.code === this.documentsForm.value.typeCode);

    if (!classCode || !typeCode) {
      this.error = this.translateService.instant('myPatients.documents.errors.invalidClassType');
      return;
    }

    this.saving = true;
    this.error = '';

    this.connectedPractitionerResolver.resolveReference().subscribe({
      next: (authorReference) => {
        if (!authorReference) {
          this.error = this.translateService.instant('myPatients.documents.errors.authorNotFound');
          this.saving = false;
          return;
        }

        this.documentService
          .uploadPatientDocument(
            patientId,
            selectedFile,
            String(this.documentsForm.value.title || '').trim(),
            classCode,
            typeCode,
            authorReference
          )
          .subscribe({
            next: (document) => {
              this.documents = [document, ...this.documents];
              if (!this.isMobileLayout) {
                this.openDocumentViewer(document);
              }
              this.saving = false;
              this.closeAddModal();
            },
            error: (error: unknown) => {
              this.error = this.formatError(error, this.translateService.instant('myPatients.documents.errors.save'));
              this.saving = false;
            }
          });
      },
      error: () => {
        this.error = this.translateService.instant('myPatients.documents.errors.authorNotFound');
        this.saving = false;
      }
    });
  }

  openDocumentViewer(document: PatientDocumentItem): void {
    this.selectedDocument = document;
    this.showMobileViewer = this.isMobileLayout;
    this.activeViewerTab = 'preview';
    this.viewerLoading = true;
    this.viewerError = '';
    this.viewerType = 'unsupported';
    this.viewerResourceUrl = null;
    this.viewerImageUrl = '';
    this.viewerTextContent = '';
    this.viewerDownloadUrl = '';
    this.viewerBinaryData = '';
    this.viewerBinaryContentType = '';
    this.summaryLoading = false;
    this.summarySaving = false;
    this.summaryError = '';
    this.summaryOriginalValue = document.aiSummaryDescription || '';
    this.summaryValue = this.summaryOriginalValue;
    this.historyLoading = false;
    this.historyError = '';
    this.historyItems = [];
    this.replacingDocument = false;
    this.replacementError = '';
    this.showSavePdfVersionConfirm = false;

    if (document.authorReference && (!document.authorLabel || document.authorLabel === document.authorReference)) {
      this.documentService.resolveReferenceDisplay(document.authorReference).subscribe({
        next: (display) => {
          if (this.selectedDocument?.id === document.id) {
            this.selectedDocument = {
              ...this.selectedDocument,
              authorLabel: display
            };
          }
        }
      });
    }

    if (!document.binaryUrl) {
      this.viewerError = this.translateService.instant('myPatients.documents.errors.noBinary');
      this.viewerLoading = false;
      return;
    }

    this.documentService.getBinaryContent(document.binaryUrl).subscribe({
      next: ({ contentType, data }) => {
        this.viewerBinaryData = data;
        this.viewerBinaryContentType = contentType;
        const dataUrl = `data:${contentType};base64,${data}`;
        this.viewerDownloadUrl = dataUrl;

        if (contentType.includes('pdf')) {
          this.viewerType = 'pdf';
          this.viewerResourceUrl = this.sanitizer.bypassSecurityTrustResourceUrl(dataUrl);
        } else if (contentType.startsWith('image/')) {
          this.viewerType = 'image';
          this.viewerImageUrl = dataUrl;
        } else if (contentType.startsWith('text/') || contentType.includes('json') || contentType.includes('xml')) {
          this.viewerType = 'text';
          this.viewerTextContent = this.decodeBase64ToText(data);
        } else {
          this.viewerType = 'unsupported';
        }

        this.viewerLoading = false;
        this.loadDocumentHistory();
      },
      error: (error: unknown) => {
        this.viewerError = this.formatError(error, this.translateService.instant('myPatients.documents.errors.loadViewer'));
        this.viewerLoading = false;
        this.loadDocumentHistory();
      }
    });
  }

  closeViewerModal(): void {
    if (document.fullscreenElement) {
      document.exitFullscreen().catch(() => undefined);
    }
    this.isViewerFullscreen = false;
    this.showMobileViewer = false;
    this.viewerLoading = false;
    this.viewerError = '';
    this.viewerResourceUrl = null;
    this.viewerImageUrl = '';
    this.viewerTextContent = '';
    this.viewerDownloadUrl = '';
    this.viewerBinaryData = '';
    this.viewerBinaryContentType = '';
    this.summaryLoading = false;
    this.summarySaving = false;
    this.summaryError = '';
    this.summaryValue = '';
    this.summaryOriginalValue = '';
    this.historyLoading = false;
    this.historyError = '';
    this.historyItems = [];
    this.replacingDocument = false;
    this.replacementError = '';
    this.showSavePdfVersionConfirm = false;
    this.selectedDocument = null;
  }

  backToDocumentsList(): void {
    this.showMobileViewer = false;
  }

  onViewerTabChange(tab: string): void {
    if (tab === 'preview' || tab === 'details' || tab === 'history') {
      this.activeViewerTab = tab;
      if (tab === 'history' && this.selectedDocument && !this.historyLoading && !this.historyItems.length) {
        this.loadDocumentHistory();
      }
    }
  }

  isPdfViewerReadyForVersionSave(): boolean {
    return this.viewerType === 'pdf' && !!this.selectedDocument && !this.viewerLoading && !this.viewerError;
  }

  requestSavePdfVersion(): void {
    if (!this.isPdfViewerReadyForVersionSave()) {
      return;
    }
    this.showSavePdfVersionConfirm = true;
  }

  closeSavePdfVersionConfirm(): void {
    this.showSavePdfVersionConfirm = false;
  }

  confirmSavePdfVersion(): void {
    this.showSavePdfVersionConfirm = false;
    if (!this.selectedDocument || !this.isPdfViewerReadyForVersionSave()) {
      return;
    }

    this.ensureViewerBinaryLoaded(() => {
      const contentType = this.viewerBinaryContentType || this.selectedDocument?.contentType || 'application/pdf';
      const blob = this.base64ToBlob(this.viewerBinaryData, contentType);
      const fallbackName = this.buildDownloadFileName(this.selectedDocument?.title || 'document', contentType) || 'document.pdf';
      const file = new File([blob], fallbackName, { type: contentType });
      this.replaceWithFile(file);
    });
  }

  downloadCurrentDocument(): void {
    if (!this.viewerDownloadUrl || !this.selectedDocument) {
      return;
    }

    const fileName = this.buildDownloadFileName(this.selectedDocument.title, this.selectedDocument.contentType);
    this.triggerDownload(this.viewerDownloadUrl, fileName);
  }

  onReplaceDocumentFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0] ?? null;
    input.value = '';

    if (!file) {
      return;
    }

    this.replaceWithFile(file);
  }

  private replaceWithFile(file: File): void {
    if (!this.selectedDocument) {
      return;
    }

    this.replacingDocument = true;
    this.replacementError = '';

    this.documentService.replaceDocumentBinary(this.selectedDocument.id, file).subscribe({
      next: (updatedDocument) => {
        this.replacingDocument = false;
        this.updateDocumentInList(updatedDocument);
        this.openDocumentViewer(updatedDocument);
      },
      error: (error: unknown) => {
        this.replacingDocument = false;
        this.replacementError = this.formatError(
          error,
          this.translateService.instant('myPatients.documents.errors.replace')
        );
      }
    });
  }

  downloadHistoryItem(item: PatientDocumentHistoryItem): void {
    if (!item.binaryUrl) {
      return;
    }

    this.documentService.getBinaryContent(item.binaryUrl).subscribe({
      next: ({ contentType, data }) => {
        const dataUrl = `data:${contentType};base64,${data}`;
        const fileName = this.buildDownloadFileName(item.title, contentType, item.versionId);
        this.triggerDownload(dataUrl, fileName);
      },
      error: (error: unknown) => {
        this.historyError = this.formatError(
          error,
          this.translateService.instant('myPatients.documents.history.errors.download')
        );
      }
    });
  }

  toggleViewerFullscreen(): void {
    if (this.isMobileLayout) {
      return;
    }

    const shell = document.getElementById('patient-document-viewer-shell');
    if (!shell) {
      return;
    }

    if (!document.fullscreenElement) {
      shell.requestFullscreen().then(() => {
        this.isViewerFullscreen = true;
      }).catch(() => {
        this.isViewerFullscreen = false;
      });
      return;
    }

    document.exitFullscreen().then(() => {
      this.isViewerFullscreen = false;
    }).catch(() => {
      this.isViewerFullscreen = !!document.fullscreenElement;
    });
  }

  onSummaryInput(event: Event): void {
    const target = event.target as HTMLTextAreaElement;
    this.summaryValue = target.value;
  }

  get summaryDirty(): boolean {
    return this.summaryValue.trim() !== this.summaryOriginalValue.trim();
  }

  get hasPersistedSummary(): boolean {
    return this.summaryOriginalValue.trim().length > 0;
  }

  get showSummaryCard(): boolean {
    return this.summaryValue.trim().length > 0;
  }

  generateDocumentSummary(): void {
    if (!this.selectedDocument) {
      return;
    }

    console.info('[DocumentSummary] generation requested', {
      documentId: this.selectedDocument.id,
      title: this.selectedDocument.title,
      patientId: this.patientId,
      contentType: this.selectedDocument.contentType,
      hasExistingSummary: this.hasPersistedSummary
    });

    this.summaryLoading = true;
    this.summaryError = '';

    this.documentService.getDocumentReferenceById(this.selectedDocument.id).subscribe({
      next: (documentReference) => {
        console.info('[DocumentSummary] DocumentReference loaded', {
          id: documentReference?.id,
          resourceType: documentReference?.resourceType,
          relatedToCount: Array.isArray(documentReference?.relatedTo) ? documentReference.relatedTo.length : 0
        });

        this.ensureViewerBinaryLoaded(() => {
          const blob = this.base64ToBlob(
            this.viewerBinaryData,
            this.viewerBinaryContentType || this.selectedDocument?.contentType || 'application/octet-stream'
          );

          console.info('[DocumentSummary] Binary prepared for summary API', {
            size: blob.size,
            type: blob.type,
            binaryBase64Length: this.viewerBinaryData.length
          });

          this.summaryService.generateSummary({
            file: blob,
            fileName: this.selectedDocument?.title || 'document',
            metadata: {
              patientId: this.patientId,
              practitionerId: this.selectedDocument?.authorReference || undefined,
              documentReference
            }
          }).subscribe({
            next: (response) => {
              console.info('[DocumentSummary] summary generated', {
                responseTitle: response?.title,
                resumeLength: String(response?.resume || '').length,
                descriptionLength: String(response?.description || '').length,
                rawJsonLength: String(response?.rawJson || '').length
              });
              this.summaryValue = String(response.resume || '').trim();
              this.summaryLoading = false;
            },
            error: (error: unknown) => {
              console.error('[DocumentSummary] generateSummary API error', error);
              this.summaryError = this.formatError(
                error,
                this.translateService.instant('myPatients.documents.summary.errors.generate')
              );
              this.summaryLoading = false;
            }
          });
        });
      },
      error: (error: unknown) => {
        console.error('[DocumentSummary] failed to load DocumentReference', error);
        this.summaryError = this.formatError(
          error,
          this.translateService.instant('myPatients.documents.summary.errors.loadDocumentReference')
        );
        this.summaryLoading = false;
      }
    });
  }

  saveDocumentSummary(): void {
    if (!this.selectedDocument || this.summarySaving || !this.summaryDirty) {
      return;
    }

    this.summarySaving = true;
    this.summaryError = '';
    const summary = this.summaryValue.trim();

    this.documentService.getDocumentReferenceById(this.selectedDocument.id).subscribe({
      next: (documentReference) => {
        const content = Array.isArray(documentReference?.content) ? [...documentReference.content] : [];
        const firstContent = content[0] || {};
        const attachment = firstContent.attachment || {};
        const safeTitle = String(this.selectedDocument?.title || attachment.title || '').trim();

        if (safeTitle) {
          content[0] = {
            ...firstContent,
            attachment: {
              ...attachment,
              title: safeTitle
            }
          };
          documentReference.content = content;
        }

        const relatedTo = Array.isArray(documentReference?.relatedTo) ? [...documentReference.relatedTo] : [];
        if (!relatedTo.length) {
          relatedTo.push({});
        }

        if (summary) {
          documentReference.description = summary;
          relatedTo[0] = { ...relatedTo[0], description: summary };
        } else {
          documentReference.description = '';
          const { description, ...rest } = relatedTo[0] || {};
          relatedTo[0] = rest;
        }

        documentReference.relatedTo = relatedTo;

        this.documentService.updateDocumentReference(this.selectedDocument!.id, documentReference).subscribe({
          next: () => {
            this.summaryOriginalValue = summary;
            this.summarySaving = false;
            this.updateDocumentSummaryInList(this.selectedDocument!.id, summary);
          },
          error: (error: unknown) => {
            this.summaryError = this.formatError(
              error,
              this.translateService.instant('myPatients.documents.summary.errors.save')
            );
            this.summarySaving = false;
          }
        });
      },
      error: (error: unknown) => {
        this.summaryError = this.formatError(
          error,
          this.translateService.instant('myPatients.documents.summary.errors.loadDocumentReference')
        );
        this.summarySaving = false;
      }
    });
  }

  cancelDocumentSummaryEdit(): void {
    this.summaryValue = this.summaryOriginalValue;
    this.summaryError = '';
  }

  get showSummaryEditor(): boolean {
    return this.hasPersistedSummary || this.summaryValue.trim().length > 0;
  }

  @HostListener('window:resize')
  onWindowResize(): void {
    this.updateLayoutMode();
  }

  private loadDocuments(): void {
    if (!this.patientId) {
      this.documents = [];
      return;
    }

    this.loading = true;
    this.error = '';

    this.documentService.listPatientDocuments(this.patientId).subscribe({
      next: (documents) => {
        this.documents = documents;
        if (this.embeddedInRightDock) {
          const requestedId = String(this.initialDocumentId || '').trim();
          if (requestedId) {
            const target = documents.find((item) => item.id === requestedId);
            if (target && this.selectedDocument?.id !== target.id) {
              this.openDocumentViewer(target);
            }
          }
        }
        this.loading = false;
      },
      error: (error: unknown) => {
        this.error = this.formatError(error, this.translateService.instant('myPatients.documents.errors.load'));
        this.loading = false;
      }
    });
  }

  private formatError(error: unknown, fallback: string): string {
    if (error instanceof Error) {
      return error.message;
    }
    if (typeof error === 'string') {
      return error;
    }
    if (error && typeof error === 'object' && 'message' in error) {
      return String((error as { message: unknown }).message);
    }
    return fallback;
  }

  private decodeBase64ToText(value: string): string {
    try {
      return decodeURIComponent(escape(atob(value)));
    } catch {
      return this.translateService.instant('myPatients.documents.errors.textDecode');
    }
  }

  private ensureViewerBinaryLoaded(onReady: () => void): void {
    if (this.viewerBinaryData && this.viewerBinaryContentType) {
      onReady();
      return;
    }

    if (!this.selectedDocument?.binaryUrl) {
      this.summaryError = this.translateService.instant('myPatients.documents.errors.noBinary');
      this.summaryLoading = false;
      return;
    }

    this.documentService.getBinaryContent(this.selectedDocument.binaryUrl).subscribe({
      next: ({ contentType, data }) => {
        this.viewerBinaryData = data;
        this.viewerBinaryContentType = contentType;
        onReady();
      },
      error: (error: unknown) => {
        this.summaryError = this.formatError(
          error,
          this.translateService.instant('myPatients.documents.summary.errors.loadBinary')
        );
        this.summaryLoading = false;
      }
    });
  }

  private base64ToBlob(base64Data: string, contentType: string): Blob {
    const byteCharacters = atob(base64Data);
    const byteArrays: ArrayBuffer[] = [];

    for (let offset = 0; offset < byteCharacters.length; offset += 1024) {
      const slice = byteCharacters.slice(offset, offset + 1024);
      const byteNumbers = new Array(slice.length);
      for (let i = 0; i < slice.length; i++) {
        byteNumbers[i] = slice.charCodeAt(i);
      }
      byteArrays.push(new Uint8Array(byteNumbers).buffer);
    }

    return new Blob(byteArrays, { type: contentType });
  }

  private updateDocumentSummaryInList(documentId: string, summary: string): void {
    this.documents = this.documents.map((item) =>
      item.id === documentId ? { ...item, aiSummaryDescription: summary } : item
    );

    if (this.selectedDocument?.id === documentId) {
      this.selectedDocument = { ...this.selectedDocument, aiSummaryDescription: summary };
    }
  }

  private loadDocumentHistory(): void {
    const documentId = String(this.selectedDocument?.id || '').trim();
    if (!documentId) {
      this.historyItems = [];
      return;
    }

    this.historyLoading = true;
    this.historyError = '';

    this.documentService.getDocumentReferenceHistory(documentId).subscribe({
      next: (items) => {
        this.historyItems = items;
        this.historyLoading = false;
      },
      error: (error: unknown) => {
        this.historyError = this.formatError(
          error,
          this.translateService.instant('myPatients.documents.history.errors.load')
        );
        this.historyLoading = false;
      }
    });
  }

  private updateDocumentInList(document: PatientDocumentItem): void {
    this.documents = this.documents.map((item) => (item.id === document.id ? document : item));
    if (this.selectedDocument?.id === document.id) {
      this.selectedDocument = document;
    }
  }

  private triggerDownload(dataUrl: string, fileName: string): void {
    const link = document.createElement('a');
    link.href = dataUrl;
    link.download = fileName;
    link.rel = 'noopener';
    document.body.appendChild(link);
    link.click();
    link.remove();
  }

  private buildDownloadFileName(title: string, contentType: string, versionSuffix?: string): string {
    const baseRaw = String(title || 'document').trim() || 'document';
    const base = baseRaw.replace(/[\\/:*?"<>|]+/g, '_');
    const extension = this.extensionFromContentType(contentType);
    const suffix = versionSuffix ? `-v${String(versionSuffix).replace(/[^a-zA-Z0-9._-]/g, '')}` : '';
    return `${base}${suffix}${extension}`;
  }

  private extensionFromContentType(contentType: string): string {
    const ct = String(contentType || '').toLowerCase();
    if (ct.includes('pdf')) return '.pdf';
    if (ct.includes('png')) return '.png';
    if (ct.includes('jpeg') || ct.includes('jpg')) return '.jpg';
    if (ct.includes('gif')) return '.gif';
    if (ct.includes('json')) return '.json';
    if (ct.includes('xml')) return '.xml';
    if (ct.startsWith('text/')) return '.txt';
    return '';
  }

  private updateLayoutMode(): void {
    this.isMobileLayout = window.innerWidth <= 900;
    if (!this.isMobileLayout) {
      this.showMobileViewer = false;
    }
  }
}
