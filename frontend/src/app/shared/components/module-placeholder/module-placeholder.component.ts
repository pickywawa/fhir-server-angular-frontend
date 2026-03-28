import { Component, inject } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { ModuleShellComponent } from '../module-shell/module-shell.component';

@Component({
  selector: 'app-module-placeholder',
  standalone: true,
  imports: [ModuleShellComponent],
  template: `
    <app-module-shell [breadcrumbs]="[{ label: title }]">
      <section class="placeholder-card">
        <h2>{{ title }}</h2>
        <p>Ce module est en cours de preparation.</p>
      </section>
    </app-module-shell>
  `,
  styles: [
    `
      .placeholder-card {
        border: 1px dashed #cbd5e1;
        border-radius: 14px;
        padding: 1.2rem;
        background: #f8fafc;
      }

      h2 {
        margin: 0 0 0.45rem;
        color: #0f172a;
      }

      p {
        margin: 0;
        color: #334155;
      }
    `
  ]
})
export class ModulePlaceholderComponent {
  private readonly route = inject(ActivatedRoute);

  get title(): string {
    return (this.route.snapshot.data['title'] as string | undefined) ?? 'Module';
  }
}
