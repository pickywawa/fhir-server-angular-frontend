import { Location } from '@angular/common';
import { Component, ElementRef, HostListener, Input, OnDestroy, OnInit, inject } from '@angular/core';

import { Router, RouterLink } from '@angular/router';
import { TranslateModule } from '@ngx-translate/core';
import { Subject, of } from 'rxjs';
import { catchError, debounceTime, distinctUntilChanged, map, switchMap, takeUntil, tap } from 'rxjs/operators';
import { MenuStateService } from '../../../core/services/menu-state.service';
import { ChatAssistantStateService } from '../../../core/services/chat-assistant-state.service';
import { NotificationBellComponent } from '../notification-bell/notification-bell.component';
import { FhirSearchService } from '../../../features/search/services/fhir-search.service';
import { SearchResultItem, SearchResultType } from '../../../features/search/models/search-result.model';

export interface ModuleBreadcrumb {
  label: string;
  route?: string;
}

interface SearchResultGroup {
  type: SearchResultType;
  items: SearchResultItem[];
}

@Component({
  selector: 'app-module-shell',
  standalone: true,
  imports: [RouterLink, TranslateModule, NotificationBellComponent],
  templateUrl: './module-shell.component.html',
  styleUrl: './module-shell.component.scss'
})
export class ModuleShellComponent {
  private readonly location = inject(Location);
  private readonly menuState = inject(MenuStateService);
  private readonly router = inject(Router);
  private readonly searchService = inject(FhirSearchService);
  private readonly host = inject(ElementRef<HTMLElement>);
  private readonly destroy$ = new Subject<void>();
  private readonly searchInput$ = new Subject<string>();

  readonly chatState = inject(ChatAssistantStateService);

  @Input() breadcrumbs: ModuleBreadcrumb[] = [];
  @Input() lockBodyScroll = false;

  searchQuery = '';
  searchOpen = false;
  searchLoading = false;
  mobileSearchExpanded = false;
  isMobileViewport = window.innerWidth <= 900;
  groupedResults: SearchResultGroup[] = [];

  private readonly typePriority: SearchResultType[] = ['patient', 'practitioner', 'appointment', 'document'];

  ngOnInit(): void {
    this.searchInput$
      .pipe(
        map((value) => value.trim()),
        debounceTime(220),
        distinctUntilChanged(),
        tap((query) => {
          if (query.length < 2) {
            this.searchLoading = false;
            this.groupedResults = [];
            this.searchOpen = false;
          }
        }),
        switchMap((query) => {
          if (query.length < 2) {
            return of<SearchResultItem[]>([]);
          }

          this.searchLoading = true;
          this.searchOpen = true;

          return this.searchService.search(query).pipe(catchError(() => of<SearchResultItem[]>([])));
        }),
        takeUntil(this.destroy$)
      )
      .subscribe((results) => {
        this.searchLoading = false;
        this.groupedResults = this.groupByPriority(results);
        this.searchOpen = this.searchQuery.trim().length >= 2;
      });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  toggleMenu(): void {
    this.menuState.toggle();
  }

  get isMenuOpenOnMobile(): boolean {
    return this.isMobileViewport && this.menuState.isOpen();
  }

  get shouldShowBackButton(): boolean {
    return this.breadcrumbs.length > 1;
  }

  goBackFromBreadcrumb(): void {
    if (window.history.length > 1) {
      this.location.back();
      return;
    }

    const previousCrumbRoute = this.breadcrumbs[this.breadcrumbs.length - 2]?.route;
    if (previousCrumbRoute) {
      this.router.navigateByUrl(previousCrumbRoute);
      return;
    }

    this.router.navigate(['/']);
  }

  openChat(): void {
    this.chatState.open();
  }

  onSearchInput(value: string): void {
    this.searchQuery = value;
    this.searchInput$.next(value);
  }

  onSearchFocus(): void {
    this.mobileSearchExpanded = true;
    if (this.searchQuery.trim().length >= 2) {
      this.searchOpen = true;
    }
  }

  toggleMobileSearch(event: Event): void {
    event.stopPropagation();
    this.mobileSearchExpanded = !this.mobileSearchExpanded;
    if (!this.mobileSearchExpanded) {
      this.searchOpen = false;
      return;
    }

    queueMicrotask(() => {
      const input = this.host.nativeElement.querySelector('.module-header-search input') as HTMLInputElement | null;
      input?.focus();
    });
  }

  clearSearch(event: Event): void {
    event.stopPropagation();
    this.searchQuery = '';
    this.searchLoading = false;
    this.groupedResults = [];
    this.searchOpen = false;
  }

  onSearchKeydown(event: KeyboardEvent): void {
    if (event.key === 'Escape') {
      this.searchOpen = false;
    }
  }

  openResult(result: SearchResultItem): void {
    this.searchOpen = false;
    this.mobileSearchExpanded = false;
    this.router.navigate(result.routeCommands, { queryParams: result.queryParams });
  }

  trackGroup(index: number, group: SearchResultGroup): string {
    return `${group.type}-${index}`;
  }

  typeLabelKey(type: SearchResultType): string {
    return `search.quick.types.${type}`;
  }

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent): void {
    if (!this.searchOpen && !this.mobileSearchExpanded) {
      return;
    }

    const target = event.target as Node | null;
    if (!target) {
      return;
    }

    const searchShell = this.host.nativeElement.querySelector('.module-header-search');
    if (searchShell?.contains(target)) {
      return;
    }

    const searchToggle = this.host.nativeElement.querySelector('.search-toggle-btn');
    if (searchToggle?.contains(target)) {
      return;
    }

    this.searchOpen = false;
    this.mobileSearchExpanded = false;
  }

  @HostListener('window:resize')
  onWindowResize(): void {
    this.isMobileViewport = window.innerWidth <= 900;
  }

  private groupByPriority(items: SearchResultItem[]): SearchResultGroup[] {
    const byType = new Map<SearchResultType, SearchResultItem[]>();

    for (const item of items) {
      const existing = byType.get(item.type) ?? [];
      existing.push(item);
      byType.set(item.type, existing);
    }

    return this.typePriority
      .map((type) => ({
        type,
        items: (byType.get(type) ?? []).sort((a, b) => a.title.localeCompare(b.title, undefined, { sensitivity: 'base' }))
      }))
      .filter((group) => group.items.length > 0);
  }
}
