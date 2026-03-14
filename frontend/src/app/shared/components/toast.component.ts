import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ToastService, Toast } from '../../core/services/toast.service';

@Component({
  selector: 'app-toast',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="toast-container">
      <div
        *ngFor="let toast of toasts"
        class="toast"
        [class.success]="toast.type === 'success'"
        [class.error]="toast.type === 'error'"
        [class.info]="toast.type === 'info'"
      >
        <span class="icon">
          <ng-container *ngIf="toast.type === 'success'">✓</ng-container>
          <ng-container *ngIf="toast.type === 'error'">✕</ng-container>
          <ng-container *ngIf="toast.type === 'info'">ℹ</ng-container>
        </span>
        <span class="message">{{ toast.message }}</span>
      </div>
    </div>
  `,
  styles: [`
    .toast-container {
      position: fixed;
      bottom: 20px;
      right: 20px;
      z-index: 9999;
      display: flex;
      flex-direction: column;
      gap: 10px;
      max-width: 400px;
    }

    .toast {
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 16px 24px;
      border-radius: 8px;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
      min-width: 300px;
      animation: slideInFromBottom 0.3s ease-out;
      font-size: 1rem;
      color: white;
      font-weight: 500;

      &.success {
        background: linear-gradient(135deg, #4caf50 0%, #45a049 100%);
      }

      &.error {
        background: linear-gradient(135deg, #f44336 0%, #d32f2f 100%);
      }

      &.info {
        background: linear-gradient(135deg, #2196f3 0%, #1976d2 100%);
      }

      .icon {
        font-size: 1.5rem;
        font-weight: bold;
        flex-shrink: 0;
      }

      .message {
        flex: 1;
        line-height: 1.4;
      }
    }

    @keyframes slideInFromBottom {
      from {
        transform: translateY(100px);
        opacity: 0;
      }
      to {
        transform: translateY(0);
        opacity: 1;
      }
    }
  `]
})
export class ToastComponent implements OnInit {
  toasts: Toast[] = [];

  constructor(private toastService: ToastService) {}

  ngOnInit(): void {
    this.toastService.toast$.subscribe(toast => {
      this.toasts.push(toast);
      setTimeout(() => {
        this.toasts = this.toasts.filter(t => t !== toast);
      }, toast.duration || 3000);
    });
  }
}
