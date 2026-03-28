import { Component, Input, inject } from '@angular/core';

import { RouterLink } from '@angular/router';
import { TranslateModule } from '@ngx-translate/core';
import { MenuStateService } from '../../../core/services/menu-state.service';

export interface ModuleBreadcrumb {
  label: string;
  route?: string;
}

@Component({
  selector: 'app-module-shell',
  standalone: true,
    imports: [RouterLink, TranslateModule],
  templateUrl: './module-shell.component.html',
  styleUrl: './module-shell.component.scss'
})
export class ModuleShellComponent {
  private readonly menuState = inject(MenuStateService);

  @Input() breadcrumbs: ModuleBreadcrumb[] = [];

  toggleMenu(): void {
    this.menuState.toggle();
  }
}
