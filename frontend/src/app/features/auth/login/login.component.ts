import { Component, inject, signal } from '@angular/core';
import { FormBuilder, Validators, ReactiveFormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { CommonModule } from '@angular/common';
import { InputTextModule } from 'primeng/inputtext';
import { ButtonModule } from 'primeng/button';
import { MessageModule } from 'primeng/message';
import { CardModule } from 'primeng/card';
import { AuthService } from '../../../core/services/auth.service';
import { FR } from '../../../core/i18n/fr';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterLink,
    CardModule, InputTextModule, ButtonModule, MessageModule],
  template: `
    <div class="min-h-screen flex items-center justify-center bg-surface-50 dark:bg-surface-950">
      <p-card styleClass="w-full max-w-sm shadow-xl">
        <ng-template pTemplate="header">
          <div class="text-center pt-6 pb-2">
            <span class="text-4xl">🏠</span>
            <h1 class="text-2xl font-bold text-primary mt-2">Homely</h1>
          </div>
        </ng-template>
        <form [formGroup]="form" (ngSubmit)="submit()" class="flex flex-col gap-4">
          <div class="flex flex-col gap-1">
            <label class="text-sm font-medium">{{ t.auth.email }}</label>
            <input pInputText formControlName="email" type="email" class="w-full" />
          </div>
          <div class="flex flex-col gap-1">
            <label class="text-sm font-medium">{{ t.auth.password }}</label>
            <input pInputText formControlName="password" type="password" class="w-full" />
          </div>
          @if (erreur()) {
            <p-message severity="error" [text]="erreur()!" />
          }
          <p-button type="submit" [label]="t.auth.loginBtn" styleClass="w-full"
                    [loading]="chargement()" [disabled]="form.invalid" />
          <div class="text-center text-sm text-surface-500">
            {{ t.auth.noAccount }}
            <a routerLink="/register" class="text-primary hover:underline ml-1">{{ t.auth.registerBtn }}</a>
          </div>
        </form>
      </p-card>
    </div>
  `,
})
export class LoginComponent {
  readonly t = FR;
  private auth = inject(AuthService);
  private router = inject(Router);
  private fb = inject(FormBuilder);

  form = this.fb.group({
    email: ['', [Validators.required, Validators.email]],
    password: ['', Validators.required],
  });

  erreur = signal<string | null>(null);
  chargement = signal(false);

  submit(): void {
    if (this.form.invalid) return;
    this.chargement.set(true);
    this.erreur.set(null);
    const { email, password } = this.form.value;
    this.auth.login({ email: email!, motDePasse: password! }).subscribe({
      next: () => this.router.navigate(['/']),
      error: () => {
        this.erreur.set(FR.auth.loginError);
        this.chargement.set(false);
      },
    });
  }
}
