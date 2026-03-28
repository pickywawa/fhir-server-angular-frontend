import { CommonModule } from '@angular/common';
import { Component, ElementRef, OnDestroy, OnInit, ViewChild } from '@angular/core';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { TranslateModule } from '@ngx-translate/core';
import { Subject, debounceTime, distinctUntilChanged, forkJoin, map, of, switchMap, takeUntil } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { ModuleShellComponent } from '../../../shared/components/module-shell/module-shell.component';
import { BubbleCardComponent } from '../../../shared/components/bubble-card/bubble-card.component';
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

interface CalendarDay {
  date: Date;
  dayOfMonth: number;
  isCurrentMonth: boolean;
  isSelected: boolean;
  isToday: boolean;
}

interface WeekDay {
  date: Date;
  label: string;
  dayOfMonth: number;
  isSelected: boolean;
}

interface TimeSlot {
  hour: number;
  appointments: AgendaAppointment[];
}

@Component({
  selector: 'app-agenda-page',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, TranslateModule, ModuleShellComponent, BubbleCardComponent, ModalComponent],
  templateUrl: './agenda-page.component.html',
  styleUrl: './agenda-page.component.scss'
})
export class AgendaPageComponent implements OnInit, OnDestroy {
  readonly breadcrumbs = [{ label: 'agenda.title' }];
  readonly statusOptions = APPOINTMENT_STATUS_OPTIONS;
  readonly typeOptions = APPOINTMENT_TYPE_OPTIONS;
  readonly modelOptions = APPOINTMENT_MODEL_OPTIONS;
  readonly recurrenceOptions = RECURRENCE_OPTIONS;
  readonly hours = Array.from({ length: 24 }, (_, i) => i);

  readonly appointmentForm: FormGroup;

  viewMode: 'list' | 'week' = 'week';
  loading = false;
  saving = false;
  error = '';
  showCreateModal = false;
  selectedAppointment: AgendaAppointment | null = null;
  appointmentModalMode: 'create' | 'view' | 'edit' = 'create';
  isMobileLayout = false;
  isCalendarCollapsedMobile = false;

  currentMonth = new Date();
  selectedDate = new Date();
  calendarDays: CalendarDay[] = [];
  weekDays: WeekDay[] = [];
  timeSlots: TimeSlot[] = [];

  appointments: AgendaAppointment[] = [];

  patientQuery = '';
  practitionerQuery = '';
  patientSearchResults: ResourceOption[] = [];
  practitionerSearchResults: ResourceOption[] = [];
  selectedPatients: ResourceOption[] = [];
  selectedPractitioners: ResourceOption[] = [];

  @ViewChild('planningContainer') planningContainer?: ElementRef<HTMLDivElement>;

  private readonly destroy$ = new Subject<void>();
  private readonly patientSearch$ = new Subject<string>();
  private readonly practitionerSearch$ = new Subject<string>();
  private connectedPractitionerReference = '';

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
  }

  ngOnInit(): void {
    this.syncMobileLayout();
    this.initializeConnectedPractitioner();
    this.initializeSearchStreams();
    this.buildCalendar();
    this.loadWeekAppointments();
    this.schedulePlanningScroll();

    if (typeof window !== 'undefined') {
      window.addEventListener('resize', this.onWindowResize);
    }
  }

  ngOnDestroy(): void {
    if (typeof window !== 'undefined') {
      window.removeEventListener('resize', this.onWindowResize);
    }

    this.destroy$.next();
    this.destroy$.complete();
  }

  toggleCalendarMobile(): void {
    if (!this.isMobileLayout) {
      return;
    }
    this.isCalendarCollapsedMobile = !this.isCalendarCollapsedMobile;
  }

  private readonly onWindowResize = (): void => {
    this.syncMobileLayout();
    if (this.viewMode === 'week') {
      this.schedulePlanningScroll();
    }
  };

  private syncMobileLayout(): void {
    if (typeof window === 'undefined') {
      return;
    }
    const mobile = window.innerWidth <= 860;
    if (this.isMobileLayout !== mobile) {
      this.isMobileLayout = mobile;
      this.isCalendarCollapsedMobile = mobile;
    }
  }

  setViewMode(mode: 'list' | 'week'): void {
    if (mode === this.viewMode) {
      return;
    }
    this.viewMode = mode;
    if (mode === 'week') {
      this.schedulePlanningScroll();
    }
  }

  // Calendar navigation and building
  previousMonth(): void {
    const prev = new Date(this.currentMonth);
    prev.setMonth(prev.getMonth() - 1);
    this.currentMonth = prev;
    this.buildCalendar();
  }

  nextMonth(): void {
    const next = new Date(this.currentMonth);
    next.setMonth(next.getMonth() + 1);
    this.currentMonth = next;
    this.buildCalendar();
  }

  selectDay(day: CalendarDay): void {
    if (day.isCurrentMonth) {
      this.selectedDate = new Date(day.date);
      this.buildCalendar();
      this.loadWeekAppointments();
    }
  }

  monthYearLabel(): string {
    return this.currentMonth.toLocaleString('fr-FR', { month: 'long', year: 'numeric' });
  }

  buildCalendar(): void {
    const year = this.currentMonth.getFullYear();
    const month = this.currentMonth.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const daysInMonth = lastDay.getDate();
    const startingDayOfWeek = firstDay.getDay();

    this.calendarDays = [];
    const today = new Date();

    // Previous month's days
    const prevMonthLastDay = new Date(year, month, 0).getDate();
    for (let i = startingDayOfWeek - 1; i > 0; i--) {
      const date = new Date(year, month - 1, prevMonthLastDay - i + 1);
      this.calendarDays.push({
        date,
        dayOfMonth: prevMonthLastDay - i + 1,
        isCurrentMonth: false,
        isSelected: false,
        isToday: false
      });
    }

    // Current month's days
    for (let day = 1; day <= daysInMonth; day++) {
      const date = new Date(year, month, day);
      const isSelected = this.isSameDay(date, this.selectedDate);
      const isToday = this.isSameDay(date, today);
      this.calendarDays.push({
        date,
        dayOfMonth: day,
        isCurrentMonth: true,
        isSelected,
        isToday
      });
    }

    // Next month's days
    const remainingDays = 42 - this.calendarDays.length;
    for (let day = 1; day <= remainingDays; day++) {
      const date = new Date(year, month + 1, day);
      this.calendarDays.push({
        date,
        dayOfMonth: day,
        isCurrentMonth: false,
        isSelected: false,
        isToday: false
      });
    }
  }

  // Week display and appointments
  buildWeekDisplay(): void {
    const startOfWeek = this.getStartOfWeek(this.selectedDate);
    this.weekDays = [];

    const labels = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'];
    for (let i = 0; i < 7; i++) {
      const date = new Date(startOfWeek);
      date.setDate(date.getDate() + i);
      this.weekDays.push({
        date,
        label: labels[i],
        dayOfMonth: date.getDate(),
        isSelected: this.isSameDay(date, this.selectedDate)
      });
    }
  }

  loadWeekAppointments(): void {
    this.buildWeekDisplay();
    const startOfWeek = this.getStartOfWeek(this.selectedDate);
    const endOfWeek = new Date(startOfWeek);
    endOfWeek.setDate(endOfWeek.getDate() + 7);

    this.loading = true;
    this.error = '';

    this.appointmentService.searchAppointments(startOfWeek, endOfWeek).pipe(
      takeUntil(this.destroy$)
    ).subscribe({
      next: (appointments) => {
        this.loading = false;
        this.appointments = appointments;
        this.buildTimeSlots();
        this.resolveParticipantLabels(appointments);
        if (this.viewMode === 'week') {
          this.schedulePlanningScroll();
        }
      },
      error: (error: unknown) => {
        this.loading = false;
        this.error = this.formatError(error, 'Erreur lors du chargement des rendez-vous');
      }
    });
  }

  buildTimeSlots(): void {
    this.timeSlots = [];
    for (let hour = 0; hour < 24; hour++) {
      this.timeSlots.push({
        hour,
        appointments: this.getAppointmentsForHour(hour)
      });
    }
  }

  getAppointmentsForHour(hour: number, dayIndex?: number): AgendaAppointment[] {
    return this.appointments.filter((apt) => {
      const start = new Date(apt.start);
      if (start.getHours() !== hour) return false;
      if (dayIndex !== undefined) {
        return this.appointmentDayIndex(apt) === dayIndex;
      }
      return true;
    });
  }

  getAppointmentStyle(appointment: AgendaAppointment, hour: number): any {
    const start = new Date(appointment.start);
    const end = new Date(appointment.end);
    
    if (start.getHours() !== hour) {
      return {};
    }

    const durationMs = end.getTime() - start.getTime();
    const durationHours = Math.max(0.25, durationMs / (1000 * 60 * 60));
    const heightPercent = Math.max(5, durationHours * 100);
    const topPercent = (start.getMinutes() / 60) * 100;

    return {
      height: heightPercent + '%',
      top: topPercent + '%'
    };
  }

  appointmentDayIndex(appointment: AgendaAppointment): number {
    const start = new Date(appointment.start);
    const startOfWeek = this.getStartOfWeek(this.selectedDate);
    const diffDays = Math.floor((start.getTime() - startOfWeek.getTime()) / (1000 * 60 * 60 * 24));
    return Math.max(0, Math.min(6, diffDays));
  }

  getAppointmentsForDay(dateInput: Date | number): AgendaAppointment[] {
    if (typeof dateInput === 'number') {
      const day = this.weekDays[dateInput];
      if (!day) return [];
      return this.appointments.filter((apt) => {
        const aptDate = new Date(apt.start);
        return this.isSameDay(aptDate, day.date);
      });
    }
    return this.appointments.filter((apt) => {
      const aptDate = new Date(apt.start);
      return this.isSameDay(aptDate, dateInput);
    });
  }

  // Modal operations
  openCreateModal(): void {
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
      start: '',
      durationMinutes: 30,
      recurrence: 'none',
      comment: ''
    });
    if (!this.appointmentForm.value.start) {
      this.appointmentForm.patchValue({ start: this.toDateTimeLocalInput(new Date()) });
    }
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
        if (this.isEditMode()) {
          this.selectedAppointment = appointment;
          this.appointmentModalMode = 'view';
          this.applyAppointmentToForm(appointment);
          this.disableAppointmentForm();
        } else {
          this.showCreateModal = false;
          this.closeCreateModal();
          this.loadWeekAppointments();
        }
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
        this.buildTimeSlots();
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

  private upsertAppointment(appointment: AgendaAppointment): void {
    const merged = new Map<string, AgendaAppointment>();
    this.appointments.forEach((item) => merged.set(item.id, item));
    merged.set(appointment.id, appointment);
    this.appointments = Array.from(merged.values()).sort(
      (a, b) => new Date(a.start).getTime() - new Date(b.start).getTime()
    );
  }

  private isSameDay(date1: Date, date2: Date): boolean {
    return date1.getFullYear() === date2.getFullYear() &&
      date1.getMonth() === date2.getMonth() &&
      date1.getDate() === date2.getDate();
  }

  private getStartOfWeek(date: Date): Date {
    const d = new Date(date);
    const day = d.getDay();
    const diff = d.getDate() - day + (day === 0 ? -6 : 1);
    return new Date(d.setDate(diff));
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

  private schedulePlanningScroll(): void {
    if (typeof window === 'undefined') {
      return;
    }

    // Trigger twice to handle async layout changes (appointments, responsive rows).
    window.setTimeout(() => this.scrollPlanningToWorkingHours(), 0);
    window.setTimeout(() => this.scrollPlanningToWorkingHours(), 120);
  }

  private scrollPlanningToWorkingHours(): void {
    const container = this.planningContainer?.nativeElement;
    if (!container) {
      return;
    }

    const hourLabel = container.querySelector<HTMLElement>('.hour-label');
    const hourHeight = hourLabel?.offsetHeight || 60;
    const targetTop = Math.max(0, hourHeight * 8);
    container.scrollTop = targetTop;
  }
}

