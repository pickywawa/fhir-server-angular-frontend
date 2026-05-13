import { CommonModule } from '@angular/common';
import { AfterViewInit, Component, ElementRef, HostBinding, Input, OnDestroy, OnInit, ViewChild, inject } from '@angular/core';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { TranslateModule } from '@ngx-translate/core';
import { FullCalendarComponent, FullCalendarModule } from '@fullcalendar/angular';
import { CalendarOptions, DatesSetArg, EventClickArg, EventInput } from '@fullcalendar/core';
import frLocale from '@fullcalendar/core/locales/fr';
import dayGridPlugin from '@fullcalendar/daygrid';
import interactionPlugin, { DateClickArg } from '@fullcalendar/interaction';
import listPlugin from '@fullcalendar/list';
import timeGridPlugin from '@fullcalendar/timegrid';
import { Subject, debounceTime, distinctUntilChanged, forkJoin, map, of, switchMap, takeUntil } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { ModuleShellComponent } from '../../../shared/components/module-shell/module-shell.component';
import { ModalComponent } from '../../../core/components/modal/modal.component';
import { AuthService } from '../../../core/services/auth.service';
import {
  AgendaAppointment,
  APPOINTMENT_MODEL_OPTIONS,
  APPOINTMENT_STATUS_OPTIONS,
  APPOINTMENT_TYPE_OPTIONS,
  RECURRENCE_OPTIONS,
  ResourceOption
} from '../models/agenda-appointment.model';
import { FhirAppointmentService } from '../services/fhir-appointment.service';

type AgendaViewMode = 'dayGridMonth' | 'timeGridWeek' | 'timeGridDay' | 'listWeek';

@Component({
  selector: 'app-agenda-page',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    TranslateModule,
    FullCalendarModule,
    ModuleShellComponent,
    ModalComponent
  ],
  templateUrl: './agenda-page.component.html',
  styleUrl: './agenda-page.component.scss'
})
export class AgendaPageComponent implements OnInit, AfterViewInit, OnDestroy {
  @Input() embedded = false;
  @Input() compact = false;
  readonly breadcrumbs = [{ label: 'agenda.title' }];
  readonly statusOptions = APPOINTMENT_STATUS_OPTIONS;
  readonly typeOptions = APPOINTMENT_TYPE_OPTIONS;
  readonly modelOptions = APPOINTMENT_MODEL_OPTIONS;
  readonly recurrenceOptions = RECURRENCE_OPTIONS;
  readonly viewButtons: Array<{ mode: AgendaViewMode; labelKey: string }> = [
    { mode: 'dayGridMonth', labelKey: 'agenda.views.month' },
    { mode: 'timeGridWeek', labelKey: 'agenda.views.week' },
    { mode: 'timeGridDay', labelKey: 'agenda.views.day' },
    { mode: 'listWeek', labelKey: 'agenda.views.list' }
  ];

  readonly appointmentForm: FormGroup;

  loading = false;
  saving = false;
  error = '';
  showCreateModal = false;
  selectedAppointment: AgendaAppointment | null = null;
  appointmentModalMode: 'create' | 'view' | 'edit' = 'create';
  currentViewMode: AgendaViewMode = 'dayGridMonth';
  currentTitle = '';

  appointments: AgendaAppointment[] = [];

  patientQuery = '';
  practitionerQuery = '';
  patientSearchResults: ResourceOption[] = [];
  practitionerSearchResults: ResourceOption[] = [];
  selectedPatients: ResourceOption[] = [];
  selectedPractitioners: ResourceOption[] = [];
  calendarOptions: CalendarOptions;

  @ViewChild('calendar') calendarComponent?: FullCalendarComponent;
  private readonly host = inject(ElementRef<HTMLElement>);

  private readonly destroy$ = new Subject<void>();
  private readonly patientSearch$ = new Subject<string>();
  private readonly practitionerSearch$ = new Subject<string>();
  private connectedPractitionerReference = '';
  private visibleRangeStart: Date | null = null;
  private visibleRangeEnd: Date | null = null;
  private resizeObserver?: ResizeObserver;

  @HostBinding('class.embedded-mode')
  get embeddedMode(): boolean {
    return this.embedded;
  }

  constructor(
    private readonly fb: FormBuilder,
    private readonly authService: AuthService,
    private readonly appointmentService: FhirAppointmentService
  ) {
    this.appointmentForm = this.fb.group({
      typeCode: [this.typeOptions[0].code, Validators.required],
      modelCode: [this.modelOptions[0].code, Validators.required],
      title: ['', [Validators.required, Validators.maxLength(120)]],
      status: [this.statusOptions[2].value, Validators.required],
      start: ['', Validators.required],
      durationMinutes: [30, [Validators.required, Validators.min(5), Validators.max(720)]],
      recurrence: ['none', Validators.required],
      comment: ['']
    });

    this.calendarOptions = {
      plugins: [dayGridPlugin, timeGridPlugin, listPlugin, interactionPlugin],
      locale: frLocale,
      initialView: this.currentViewMode,
      headerToolbar: false,
      firstDay: 1,
      weekends: true,
      nowIndicator: true,
      selectable: true,
      dayMaxEvents: 3,
      height: '100%',
      contentHeight: '100%',
      expandRows: true,
      stickyHeaderDates: true,
      allDaySlot: true,
      slotMinTime: '06:00:00',
      slotMaxTime: '22:00:00',
      listDayFormat: { weekday: 'long', day: 'numeric', month: 'long' },
      listDaySideFormat: { year: 'numeric', month: 'short', day: 'numeric' },
      eventTimeFormat: {
        hour: '2-digit',
        minute: '2-digit',
        meridiem: false
      },
      slotLabelFormat: {
        hour: '2-digit',
        minute: '2-digit',
        meridiem: false
      },
      titleFormat: { year: 'numeric', month: 'long' },
      views: {
        timeGridWeek: { titleFormat: { month: 'short', day: 'numeric', year: 'numeric' } },
        timeGridDay: { titleFormat: { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' } },
        listWeek: { titleFormat: { month: 'short', day: 'numeric', year: 'numeric' } }
      },
      events: [],
      datesSet: (arg) => this.onDatesSet(arg),
      eventClick: (arg) => this.onEventClick(arg),
      dateClick: (arg) => this.onDateClick(arg)
    };
  }

  ngOnInit(): void {
    if (this.compact) {
      this.currentViewMode = 'timeGridDay';
      this.calendarOptions = {
        ...this.calendarOptions,
        initialView: 'timeGridDay'
      };
    }

    this.initializeConnectedPractitioner();
    this.initializeSearchStreams();
  }

  ngAfterViewInit(): void {
    if (!this.embedded || typeof ResizeObserver === 'undefined') {
      return;
    }

    this.resizeObserver = new ResizeObserver(() => {
      this.syncCalendarSize();
    });

    this.resizeObserver.observe(this.host.nativeElement);
    this.syncCalendarSize();
  }

  ngOnDestroy(): void {
    this.resizeObserver?.disconnect();
    this.destroy$.next();
    this.destroy$.complete();
  }

  previousRange(): void {
    this.calendarComponent?.getApi().prev();
  }

  nextRange(): void {
    this.calendarComponent?.getApi().next();
  }

  goToToday(): void {
    this.calendarComponent?.getApi().today();
  }

  setViewMode(mode: AgendaViewMode): void {
    if (mode === this.currentViewMode) {
      return;
    }
    this.calendarComponent?.getApi().changeView(mode);
  }

  isActiveView(mode: AgendaViewMode): boolean {
    return this.currentViewMode === mode;
  }

  private loadAppointments(start: Date, end: Date): void {
    this.loading = true;
    this.error = '';

    this.appointmentService.searchAppointments(start, end).pipe(
      takeUntil(this.destroy$)
    ).subscribe({
      next: (appointments) => {
        this.loading = false;
        this.appointments = appointments;
        this.updateCalendarEvents();
        this.resolveParticipantLabels(appointments);
      },
      error: (error: unknown) => {
        this.loading = false;
        this.error = this.formatError(error, 'Erreur lors du chargement des rendez-vous');
        this.calendarOptions = {
          ...this.calendarOptions,
          events: []
        };
      }
    });
  }

  private refreshVisibleRange(): void {
    if (this.visibleRangeStart && this.visibleRangeEnd) {
      this.loadAppointments(this.visibleRangeStart, this.visibleRangeEnd);
    }
  }

  private updateCalendarEvents(): void {
    const events: EventInput[] = this.appointments.map((appointment) => ({
      id: appointment.id,
      title: appointment.title,
      start: appointment.start,
      end: appointment.end,
      allDay: false,
      extendedProps: { appointment }
    }));

    this.calendarOptions = {
      ...this.calendarOptions,
      events
    };
  }

  openCreateModal(presetDate?: Date): void {
    this.appointmentModalMode = 'create';
    this.selectedAppointment = null;
    this.showCreateModal = true;
    this.error = '';
    this.resetAppointmentSelectionState();
    this.enableAppointmentForm();
    this.appointmentForm.reset({
      typeCode: this.typeOptions[0].code,
      modelCode: this.modelOptions[0].code,
      title: '',
      status: this.statusOptions[2].value,
      start: this.toDateTimeLocalInput(presetDate ?? new Date()),
      durationMinutes: 30,
      recurrence: 'none',
      comment: ''
    });
  }

  closeCreateModal(): void {
    this.showCreateModal = false;
    this.selectedAppointment = null;
    this.appointmentModalMode = 'create';
    this.resetAppointmentSelectionState();
    this.enableAppointmentForm();
    this.appointmentForm.reset({
      typeCode: this.typeOptions[0].code,
      modelCode: this.modelOptions[0].code,
      title: '',
      status: this.statusOptions[2].value,
      start: '',
      durationMinutes: 30,
      recurrence: 'none',
      comment: ''
    });
  }

  openAppointmentDetails(appointment: AgendaAppointment): void {
    this.selectedAppointment = appointment;
    this.appointmentModalMode = 'view';
    this.showCreateModal = true;
    this.error = '';
    this.applyAppointmentToForm(appointment);
    this.disableAppointmentForm();
  }

  startEditAppointment(): void {
    if (!this.selectedAppointment) {
      return;
    }
    this.appointmentModalMode = 'edit';
    this.enableAppointmentForm();
  }

  cancelAppointmentEdition(): void {
    if (this.isCreateMode()) {
      this.closeCreateModal();
      return;
    }
    if (this.selectedAppointment) {
      this.applyAppointmentToForm(this.selectedAppointment);
      this.appointmentModalMode = 'view';
      this.disableAppointmentForm();
    }
  }

  appointmentModalTitle(): string {
    if (this.isCreateMode()) {
      return 'Ajouter un rendez-vous';
    }
    if (this.isEditMode()) {
      return 'Modifier le rendez-vous';
    }
    return 'Rendez-vous';
  }

  isCreateMode(): boolean {
    return this.appointmentModalMode === 'create';
  }

  isViewMode(): boolean {
    return this.appointmentModalMode === 'view';
  }

  isEditMode(): boolean {
    return this.appointmentModalMode === 'edit';
  }

  canEditAppointment(): boolean {
    return this.appointmentModalMode !== 'view';
  }

  submitAppointment(): void {
    if (this.isViewMode()) {
      return;
    }

    if (this.appointmentForm.invalid) {
      this.appointmentForm.markAllAsTouched();
      return;
    }

    const formValue = this.appointmentForm.getRawValue();
    const type = this.typeOptions.find((item) => item.code === formValue.typeCode);
    const model = this.modelOptions.find((item) => item.code === formValue.modelCode);

    if (!type || !model) {
      this.error = 'Type ou modele de rendez-vous invalide.';
      return;
    }

    const practitionerReferences = this.selectedPractitioners.map((item) => item.reference);
    if (this.connectedPractitionerReference && !practitionerReferences.includes(this.connectedPractitionerReference)) {
      practitionerReferences.push(this.connectedPractitionerReference);
    }

    this.saving = true;
    this.error = '';

    const payload = {
      title: String(formValue.title || '').trim(),
      status: formValue.status,
      typeCode: type.code,
      typeLabel: type.label,
      modelCode: model.code,
      modelLabel: model.label,
      start: this.localDateTimeToIso(formValue.start),
      durationMinutes: Number(formValue.durationMinutes || 30),
      recurrence: formValue.recurrence,
      comment: String(formValue.comment || ''),
      patientReferences: this.selectedPatients.map((item) => item.reference),
      practitionerReferences
    };

    const request$ = this.isEditMode() && this.selectedAppointment
      ? this.appointmentService.updateAppointment({
        id: this.selectedAppointment.id,
        ...payload
      })
      : this.appointmentService.createAppointment(payload);

    request$.subscribe({
      next: (appointment) => {
        this.saving = false;
        this.upsertAppointment(appointment);
        this.updateCalendarEvents();
        if (this.isEditMode()) {
          this.selectedAppointment = appointment;
          this.appointmentModalMode = 'view';
          this.applyAppointmentToForm(appointment);
          this.disableAppointmentForm();
        } else {
          this.closeCreateModal();
        }
        this.resolveParticipantLabels([appointment]);
        setTimeout(() => this.refreshVisibleRange(), 250);
      },
      error: (error: unknown) => {
        this.saving = false;
        this.error = this.formatError(
          error,
          this.isEditMode() ? 'Impossible de modifier le rendez-vous' : 'Impossible de creer le rendez-vous'
        );
      }
    });
  }

  // Search streams for patients and practitioners
  onPatientQueryChanged(value: string): void {
    this.patientQuery = value;
    this.patientSearch$.next(value);
  }

  onPractitionerQueryChanged(value: string): void {
    this.practitionerQuery = value;
    this.practitionerSearch$.next(value);
  }

  addPatient(option: ResourceOption): void {
    if (this.selectedPatients.some((item) => item.reference === option.reference)) {
      return;
    }
    this.selectedPatients = [...this.selectedPatients, option];
    this.patientQuery = '';
    this.patientSearchResults = [];
  }

  removePatient(option: ResourceOption): void {
    this.selectedPatients = this.selectedPatients.filter((item) => item.reference !== option.reference);
  }

  addPractitioner(option: ResourceOption): void {
    if (this.selectedPractitioners.some((item) => item.reference === option.reference)) {
      return;
    }
    const isSelf = option.reference === this.connectedPractitionerReference;
    this.selectedPractitioners = [...this.selectedPractitioners, { ...option, isSelf }];
    this.practitionerQuery = '';
    this.practitionerSearchResults = [];
  }

  removePractitioner(option: ResourceOption): void {
    if (option.isSelf) {
      return;
    }
    this.selectedPractitioners = this.selectedPractitioners.filter((item) => item.reference !== option.reference);
  }

  // Formatting
  formatDateTime(value: string): string {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
      return '-';
    }
    return date.toLocaleString('fr-FR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  }

  formatParticipants(items: ResourceOption[]): string {
    if (!items.length) {
      return '-';
    }
    return items.map((item) => item.label).join(', ');
  }

  private onDatesSet(arg: DatesSetArg): void {
    this.currentViewMode = arg.view.type as AgendaViewMode;
    this.currentTitle = arg.view.title;
    this.visibleRangeStart = new Date(arg.start);
    this.visibleRangeEnd = new Date(arg.end);
    this.loadAppointments(arg.start, arg.end);
    this.syncCalendarSize();
  }

  private onEventClick(arg: EventClickArg): void {
    const appointment = arg.event.extendedProps['appointment'] as AgendaAppointment | undefined;
    if (appointment) {
      this.openAppointmentDetails(appointment);
    }
  }

  private onDateClick(arg: DateClickArg): void {
    this.openCreateModal(arg.date);
  }

  // Private helpers
  private initializeConnectedPractitioner(): void {
    const id = this.authService.getConnectedPractitionerId();
    if (!id) {
      return;
    }

    this.connectedPractitionerReference = `Practitioner/${id}`;
    this.appointmentService.resolveReferenceDisplay(this.connectedPractitionerReference)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (label) => {
          this.selectedPractitioners = [{
            id,
            reference: this.connectedPractitionerReference,
            label,
            isSelf: true
          }];
        },
        error: () => {
          this.selectedPractitioners = [{
            id,
            reference: this.connectedPractitionerReference,
            label: 'Moi',
            isSelf: true
          }];
        }
      });
  }

  private initializeSearchStreams(): void {
    this.patientSearch$
      .pipe(
        debounceTime(250),
        distinctUntilChanged(),
        map((query) => query.trim()),
        switchMap((query) => query.length >= 2 ? this.appointmentService.searchPatients(query, 12) : of([])),
        takeUntil(this.destroy$)
      )
      .subscribe((results) => {
        this.patientSearchResults = results.filter(
          (option) => !this.selectedPatients.some((selected) => selected.reference === option.reference)
        );
      });

    this.practitionerSearch$
      .pipe(
        debounceTime(250),
        distinctUntilChanged(),
        map((query) => query.trim()),
        switchMap((query) => query.length >= 2 ? this.appointmentService.searchPractitioners(query, 12) : of([])),
        takeUntil(this.destroy$)
      )
      .subscribe((results) => {
        this.practitionerSearchResults = results.filter(
          (option) => !this.selectedPractitioners.some((selected) => selected.reference === option.reference)
        );
      });
  }

  private resolveParticipantLabels(appointments: AgendaAppointment[]): void {
    const unresolvedReferences = this.collectUnresolvedReferences(appointments);
    if (!unresolvedReferences.length) {
      return;
    }

    forkJoin(
      unresolvedReferences.map((reference) =>
        this.appointmentService.resolveReferenceDisplay(reference).pipe(
          map((label) => ({ reference, label })),
          catchError(() => of({ reference, label: reference }))
        )
      )
    )
      .pipe(takeUntil(this.destroy$))
      .subscribe((labels) => {
        const labelMap = new Map(labels.map((item) => [item.reference, item.label]));
        this.appointments = this.appointments.map((appointment) => ({
          ...appointment,
          patientParticipants: appointment.patientParticipants.map((participant) => ({
            ...participant,
            label: labelMap.get(participant.reference) || participant.label
          })),
          practitionerParticipants: appointment.practitionerParticipants.map((participant) => ({
            ...participant,
            label: labelMap.get(participant.reference) || participant.label
          }))
        }));
        this.updateCalendarEvents();
      });
  }

  private collectUnresolvedReferences(appointments: AgendaAppointment[]): string[] {
    const references = new Set<string>();

    appointments.forEach((appointment) => {
      appointment.patientParticipants.forEach((participant) => {
        if (participant.label === participant.reference) {
          references.add(participant.reference);
        }
      });
      appointment.practitionerParticipants.forEach((participant) => {
        if (participant.label === participant.reference) {
          references.add(participant.reference);
        }
      });
    });

    return Array.from(references);
  }

  private applyAppointmentToForm(appointment: AgendaAppointment): void {
    this.resetAppointmentSelectionState();
    this.selectedPatients = appointment.patientParticipants.map((item) => ({ ...item }));
    this.selectedPractitioners = appointment.practitionerParticipants.map((item) => ({
      ...item,
      isSelf: item.reference === this.connectedPractitionerReference
    }));

    this.appointmentForm.patchValue({
      typeCode: appointment.typeCode || this.typeOptions[0].code,
      modelCode: appointment.modelCode || this.modelOptions[0].code,
      title: appointment.title || '',
      status: appointment.status || this.statusOptions[2].value,
      start: this.toDateTimeLocalInput(new Date(appointment.start)),
      durationMinutes: this.computeDurationMinutes(appointment),
      recurrence: appointment.recurrence || 'none',
      comment: appointment.comment || appointment.description || ''
    });
  }

  private computeDurationMinutes(appointment: AgendaAppointment): number {
    const start = new Date(appointment.start).getTime();
    const end = new Date(appointment.end).getTime();
    if (Number.isNaN(start) || Number.isNaN(end) || end <= start) {
      return 30;
    }
    return Math.max(5, Math.round((end - start) / 60000));
  }

  private resetAppointmentSelectionState(): void {
    this.patientQuery = '';
    this.practitionerQuery = '';
    this.patientSearchResults = [];
    this.practitionerSearchResults = [];
    this.selectedPatients = [];
    this.selectedPractitioners = this.connectedPractitionerReference
      ? this.selectedPractitioners.filter((item) => item.reference === this.connectedPractitionerReference && item.isSelf)
      : [];
  }

  private enableAppointmentForm(): void {
    this.appointmentForm.enable({ emitEvent: false });
  }

  private disableAppointmentForm(): void {
    this.appointmentForm.disable({ emitEvent: false });
  }

  private localDateTimeToIso(value: string): string {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
      return new Date().toISOString();
    }
    return date.toISOString();
  }

  private toDateTimeLocalInput(date: Date): string {
    const local = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
    return local.toISOString().slice(0, 16);
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

  private upsertAppointment(appointment: AgendaAppointment): void {
    const index = this.appointments.findIndex((item) => item.id === appointment.id);
    if (index < 0) {
      this.appointments = [...this.appointments, appointment];
      return;
    }

    const next = [...this.appointments];
    next[index] = appointment;
    this.appointments = next;
  }

  private syncCalendarSize(): void {
    requestAnimationFrame(() => {
      this.calendarComponent?.getApi().updateSize();
    });
  }
}

