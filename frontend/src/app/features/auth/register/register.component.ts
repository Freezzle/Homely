import { Component, inject, signal } from '@angular/core';
import { FormBuilder, Validators, ReactiveFormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { CommonModule } from '@angular/common';
import { InputTextModule } from 'primeng/inputtext';
import { ButtonModule } from 'primeng/button';
import { MessageModule } from 'primeng/message';
import { CardModule } from 'primeng/card';
import { AuthService } from '../../../core/services/auth.service';
import { I18nService } from '../../../core/i18n/i18n.service';

@Component({
  selector: 'app-register',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterLink,
    CardModule, InputTextModule, ButtonModule, MessageModule],
  templateUrl: './register.component.html',
})
export class RegisterComponent {
  private readonly i18n = inject(I18nService);
  readonly t = this.i18n.translations();
  private auth = inject(AuthService);
  private router = inject(Router);
  private fb = inject(FormBuilder);

  form = this.fb.group({
    nomComplet: ['', Validators.required],
    email: ['', [Validators.required, Validators.email]],
    password: ['', [Validators.required, Validators.minLength(8)]],
  });

  erreur = signal<string | null>(null);
  chargement = signal(false);

  submit(): void {
    if (this.form.invalid || this.chargement()) return;
    this.chargement.set(true);
    this.erreur.set(null);
    const { email, password, nomComplet } = this.form.value;
    this.auth.register({ email: email!, motDePasse: password!, nomComplet: nomComplet! }).subscribe({
      next: () => this.router.navigate(['/login']),
      error: (err) => {
        this.erreur.set(err?.error?.message ?? 'Erreur lors de l\'inscription.');
        this.chargement.set(false);
      },
    });
  }
}
