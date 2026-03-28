import { CommonModule } from '@angular/common';
import { Component, Input, OnChanges, SimpleChanges } from '@angular/core';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { ConnectedPractitionerResolverService } from '../../../../../core/services/connected-practitioner-resolver.service';
import { BubbleCardComponent } from '../../../../../shared/components/bubble-card/bubble-card.component';
import { ButtonPrimaryComponent } from '../../../../../core/components/button/button-primary.component';
import { ModalComponent } from '../../../../../core/components/modal/modal.component';
import {
  PatientDocumentItem,
  XDS_CLASS_OPTIONS,
  XDS_TYPE_OPTIONS
} from '../models/patient-document.model';
import { FhirPatientDocumentService } from '../services/fhir-patient-document.service';
import { TranslateModule, TranslateService } from '@ngx-translate/core';

@Component({
  selector: 'app-patient-documents',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, BubbleCardComponent, ButtonPrimaryComponent, ModalComponent, TranslateModule],
  templateUrl: './patient-documents.component.html',
  styleUrl: './patient-documents.component.scss'
})
export class PatientDocumentsComponent implements OnChanges {
  @Input() patientId?: string;

  readonly documentsForm: FormGroup;
  readonly classOptions = XDS_CLASS_OPTIONS;
  readonly typeOptions = XDS_TYPE_OPTIONS;

  documents: PatientDocumentItem[] = [];
  loading = false;
  saving = false;
  error = '';
  showAddModal = false;
  selectedFile: File | null = null;
  showViewerModal = false;
  viewerLoading = false;
  viewerError = '';
  viewerType: 'pdf' | 'image' | 'text' | 'unsupported' = 'unsupported';
  viewerResourceUrl: SafeResourceUrl | null = null;
  viewerImageUrl = '';
  viewerTextContent = '';
  viewerDownloadUrl = '';
  selectedDocument: PatientDocumentItem | null = null;
  activeViewerTab: 'preview' | 'details' = 'preview';
  isViewerFullscreen = false;

  constructor(
    private readonly fb: FormBuilder,
    private readonly documentService: FhirPatientDocumentService,
    private readonly sanitizer: DomSanitizer,
    private readonly connectedPractitionerResolver: ConnectedPractitionerResolverService,
    private readonly translateService: TranslateService
  ) {
    this.documentsForm = this.fb.group({
      title: ['', [Validators.required, Validators.maxLength(120)]],
      classCode: [this.classOptions[0].code, Validators.required],
      typeCode: [this.typeOptions[0].code, Validators.required],
      file: [null, Validators.required]
    });
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['patientId']) {
      this.loadDocuments();
    }
  }

  openAddModal(): void {
    this.showAddModal = true;
  }

  closeAddModal(): void {
    this.showAddModal = false;
    this.selectedFile = null;
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
    this.showViewerModal = true;
    this.activeViewerTab = 'preview';
    this.viewerLoading = true;
    this.viewerError = '';
    this.viewerType = 'unsupported';
    this.viewerResourceUrl = null;
    this.viewerImageUrl = '';
    this.viewerTextContent = '';
    this.viewerDownloadUrl = '';

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
      },
      error: (error: unknown) => {
        this.viewerError = this.formatError(error, this.translateService.instant('myPatients.documents.errors.loadViewer'));
        this.viewerLoading = false;
      }
    });
  }

  closeViewerModal(): void {
    if (document.fullscreenElement) {
      document.exitFullscreen().catch(() => undefined);
    }
    this.isViewerFullscreen = false;
    this.showViewerModal = false;
    this.viewerLoading = false;
    this.viewerError = '';
    this.viewerResourceUrl = null;
    this.viewerImageUrl = '';
    this.viewerTextContent = '';
    this.viewerDownloadUrl = '';
    this.selectedDocument = null;
  }

  onViewerTabChange(tab: string): void {
    if (tab === 'preview' || tab === 'details') {
      this.activeViewerTab = tab;
    }
  }

  toggleViewerFullscreen(): void {
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
}
