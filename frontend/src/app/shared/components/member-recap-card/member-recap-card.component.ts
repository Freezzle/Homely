import { CommonModule } from '@angular/common';
import { Component, inject, input } from '@angular/core';
import { AvatarModule } from 'primeng/avatar';
import { I18nService } from '../../../core/i18n/i18n.service';
import { MontantPipe } from '../../../core/pipes/format.pipes';
import type { LigneDecomposition, MembreTagInfo } from '../carte-bilan/carte-bilan.component';

export type MemberRecapLine = LigneDecomposition;
export type MemberRecapTagInfo = MembreTagInfo;

@Component({
  selector: 'app-member-recap-card',
  standalone: true,
  imports: [CommonModule, AvatarModule, MontantPipe],
  templateUrl: './member-recap-card.component.html',
  styleUrl: './member-recap-card.component.scss',
})
export class MemberRecapCardComponent {
  private readonly i18n = inject(I18nService);

  readonly t = this.i18n.translations();

  readonly nom = input.required<string>();
  readonly sousTitre = input.required<string>();
  readonly couleur = input.required<string>();
  readonly initiales = input.required<string>();
  readonly rav = input.required<number>();
  readonly devise = input.required<string>();
  readonly lignes = input.required<LigneDecomposition[]>();
}
