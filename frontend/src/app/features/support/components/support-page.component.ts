import { CommonModule } from '@angular/common';
import { Component, inject } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { TranslateModule } from '@ngx-translate/core';
import { ModuleShellComponent } from '../../../shared/components/module-shell/module-shell.component';
import { BubbleCardComponent } from '../../../shared/components/bubble-card/bubble-card.component';
import { ToastService } from '../../../core/services/toast.service';

interface QuickAction {
  id: string;
  title: string;
  description: string;
  hint: string;
}

interface FaqItem {
  question: string;
  answer: string;
}

@Component({
  selector: 'app-support-page',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, TranslateModule, ModuleShellComponent, BubbleCardComponent],
  templateUrl: './support-page.component.html',
  styleUrl: './support-page.component.scss'
})
export class SupportPageComponent {
  private readonly fb = inject(FormBuilder);
  private readonly toastService = inject(ToastService);

  readonly breadcrumbs = [{ label: 'support.title' }];

  readonly quickActions: QuickAction[] = [
    {
      id: 'incident',
      title: 'Signaler un incident',
      description: 'Une fonctionnalite est bloquee ou renvoie une erreur recurrente.',
      hint: 'Priorite elevee'
    },
    {
      id: 'account',
      title: 'Aide acces et compte',
      description: 'Problemes de connexion, droits manquants, ou profil incomplet.',
      hint: 'Support administratif'
    },
    {
      id: 'workflow',
      title: 'Aide utilisation',
      description: 'Besoin d accompagnement sur agenda, patients, ou parcours metier.',
      hint: 'Accompagnement produit'
    }
  ];

  readonly faq: FaqItem[] = [
    {
      question: 'Comment retrouver rapidement un patient ?',
      answer: 'Utilisez le module Rechercher puis tapez nom et prenom. Le filtre local complete les resultats si votre serveur FHIR ne supporte pas certains index.'
    },
    {
      question: 'Pourquoi un rendez-vous n apparait pas dans le planning ?',
      answer: 'Verifiez la date/heure du RDV et la semaine selectionnee dans l agenda. Le planning affiche la semaine active autour du jour choisi dans le calendrier.'
    },
    {
      question: 'Comment demander une correction de donnees ?',
      answer: 'Utilisez le formulaire ci-dessous en choisissant la priorite et en decrivant le contexte (id patient/praticien, date, etapes reproduites).' 
    }
  ];

  readonly ticketForm = this.fb.group({
    subject: ['', [Validators.required, Validators.minLength(5), Validators.maxLength(120)]],
    category: ['incident', Validators.required],
    priority: ['medium', Validators.required],
    message: ['', [Validators.required, Validators.minLength(20), Validators.maxLength(2000)]]
  });

  submitting = false;

  submitTicket(): void {
    if (this.ticketForm.invalid) {
      this.ticketForm.markAllAsTouched();
      return;
    }

    this.submitting = true;

    // Simulated submit for now: keeps UX flow until backend ticketing is connected.
    setTimeout(() => {
      this.submitting = false;
      this.toastService.success('Votre demande support a ete envoyee.');
      this.ticketForm.reset({
        subject: '',
        category: 'incident',
        priority: 'medium',
        message: ''
      });
    }, 450);
  }
}
