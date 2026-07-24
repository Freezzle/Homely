import { Component, inject, signal, computed, OnInit, input, effect, ViewChild, ElementRef } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { CommonModule } from '@angular/common';
import { FormBuilder, Validators, ReactiveFormsModule, FormArray, FormsModule } from '@angular/forms';
import { startWith } from 'rxjs';
import { TableModule } from 'primeng/table';
import { ButtonModule } from 'primeng/button';
import { DialogModule } from 'primeng/dialog';
import { InputTextModule } from 'primeng/inputtext';
import { InputNumberModule } from 'primeng/inputnumber';
import { SelectModule } from 'primeng/select';
import { MultiSelectModule } from 'primeng/multiselect';
import { DatePickerModule } from 'primeng/datepicker';
import { TagModule } from 'primeng/tag';
import { TooltipModule } from 'primeng/tooltip';
import { CardModule } from 'primeng/card';
import { MessageModule } from 'primeng/message';
import { ConfirmDialogModule } from 'primeng/confirmdialog';
import { SkeletonModule } from 'primeng/skeleton';
import { DrawerModule } from 'primeng/drawer';
import { CheckboxModule } from 'primeng/checkbox';
import { MenuModule } from 'primeng/menu';
import { SelectButtonModule } from 'primeng/selectbutton';
import { MessageService, ConfirmationService, MenuItem } from 'primeng/api';
import { ContexteService } from '../../../core/services/contexte.service';
import { PosteService } from '../../../core/services/scenario-poste.service';
import { CategorieService, CompteService } from '../../../core/services/referentiel.service';
import { PosteDto, CategorieDto, CompteDto, MembreDto, VentilationCompteDto, TypePoste, TypeRepartition } from '../../../core/models/api.models';
import { MontantPipe, PeriodicitePipe } from '../../../core/pipes/format.pipes';
import { I18nService } from '../../../core/i18n/i18n.service';
import { TagComponent } from '../../../shared/components/tag/tag.component';
import { toIsoDateLocal, parseIsoDateLocal } from '../../../core/utils/date.util';

/**
 * Poste enrichi de métadonnées d'affichage calculées côté front pour le regroupement
 * en chaîne de révisions (voir `postesVisibles`). Champs purement transitoires, non
 * envoyés à l'API.
 */
interface PosteAffiche extends PosteDto {
  _estChaine?: boolean;
  _premierDuBloc?: boolean;
  _estActifChaine?: boolean;
  _nbVersions?: number;
  _clefSeparateur?: string;
  _labelSeparateur?: string;
}

/** Options de l'action rapide « Terminer » (clôture d'un poste). */
type OptionCloture = 'MOIS_COURANT' | 'PROCHAIN_PERIODIQUE' | 'PERSONNALISEE';

@Component({
  selector: 'app-postes-liste',
  standalone: true,
  providers: [ConfirmationService],
  imports: [CommonModule, FormsModule, ReactiveFormsModule, TableModule, ButtonModule, DialogModule,
            InputTextModule, InputNumberModule, SelectModule, MultiSelectModule, DatePickerModule,
            TagModule, TooltipModule, CardModule, MessageModule, ConfirmDialogModule, SkeletonModule, DrawerModule, CheckboxModule,
            MenuModule, SelectButtonModule,
            MontantPipe, PeriodicitePipe, TagComponent],
  template: `
      <p-confirmdialog/>
      <div class="flex flex-col gap-4">

          <!-- ── En-tête ─────────────────────────────────────────── -->
          <div class="flex flex-col gap-3">

              <!-- Ligne 1 : titre à gauche, créer à droite -->
              <div class="grid gap-3 grid-cols-[minmax(0,1fr)_auto] md:items-center">
                  <div class="flex items-baseline gap-2 min-w-0">
                      <h1 class="text-2xl font-bold leading-tight truncate">
                          {{ type() === 'REVENU' ? t.nav.revenus : type() === 'CHARGE' ? t.nav.charges : t.nav.reserves }}
                      </h1>
                  </div>

                  <div class="flex justify-end">
                      @if (contexte.estEditor()) {
                          <p-button icon="pi pi-plus" [label]="t.commun.creer" (click)="ouvrirCreation()"
                                    class="shrink-0"/>
                      }
                  </div>
              </div>

              <!-- Ligne 2 : tri à gauche, menu à droite -->
              <div class="grid gap-3 grid-cols-[minmax(0,1fr)_auto] md:items-center">
                  <div class="flex justify-start">
                      <p-select appendTo="body"
                                [ngModel]="triActuel()"
                                (onChange)="triActuel.set($event.value)"
                                [options]="triOptions"
                                optionLabel="label" optionValue="value"
                                class="min-w-52 text-sm"/>
                  </div>

                  <div class="flex justify-end">
                      <div>
                          <p-button icon="pi pi-sliders-h"
                                    [ariaLabel]="t.commun.actions"
                                    severity="secondary"
                                    [text]="true"
                                    (click)="menuVisibilite.toggle($event)"/>
                          <p-menu #menuVisibilite [popup]="true" [model]="visibiliteMenuItems" appendTo="body"
                                  class="w-72">
                              <ng-template #item let-item>
                                  <div class="flex items-center gap-3 px-2 py-1.5" (click)="$event.stopPropagation()">
                                      <p-checkbox [binary]="true"
                                                  [inputId]="item.data"
                                                  [ngModel]="item.data === 'cacher-inactifs' ? cacherInactifs() : cacherFuturs()"
                                                  (onChange)="item.data === 'cacher-inactifs' ? cacherInactifs.set($event.checked) : cacherFuturs.set($event.checked)"
                                                  (click)="$event.stopPropagation()"/>
                                      <label class="cursor-pointer text-sm text-surface-600 dark:text-surface-300 select-none"
                                             [for]="item.data">
                                          {{ item.label }}
                                      </label>
                                  </div>
                              </ng-template>
                          </p-menu>
                      </div>
                  </div>
              </div>

              <!-- Ligne 3 : les 3 filtres -->
              <div class="grid gap-3 lg:grid-cols-3">
                  <!-- Filtre catégories -->
                  <p-multiselect appendTo="body"
                                 [ngModel]="filtreCategorieIds()"
                                 (ngModelChange)="filtreCategorieIds.set($event)"
                                 [options]="categories()"
                                 optionLabel="libelle" optionValue="id"
                                 [placeholder]="t.poste.filtreCategories"
                                 [showClear]="true"
                                 class="w-full text-sm"/>

                  <!-- Filtre comptes -->
                  <p-multiselect appendTo="body"
                                 [ngModel]="filtreCompteIds()"
                                 (ngModelChange)="filtreCompteIds.set($event)"
                                 [options]="comptes()"
                                 optionLabel="libelle" optionValue="id"
                                 [placeholder]="t.poste.filtreComptes"
                                 [showClear]="true"
                                 class="w-full text-sm">
                      <ng-template #item let-compte>
                          <div class="flex items-center gap-2 flex-wrap">
                              <span>{{ compte.libelle }}</span>
                              @for (m of membresForCompte(compte); track m.id) {
                                  <app-tag [couleur]="m.couleur" [texte]="m.nom"/>
                              }
                          </div>
                      </ng-template>
                  </p-multiselect>

                  <!-- Filtre membres -->
                  <p-multiselect appendTo="body"
                                 [ngModel]="filtreMembreIds()"
                                 (ngModelChange)="filtreMembreIds.set($event)"
                                 [options]="membres()"
                                 optionLabel="nom" optionValue="id"
                                 [placeholder]="t.poste.filtreMembres"
                                 [showClear]="true"
                                 class="w-full text-sm"/>
              </div>
          </div>

          <!-- ── État chargement (skeletons) ──────────────────────── -->
          @if (chargement()) {
              <div class="flex flex-col gap-2">
                  @for (_ of [1, 2, 3]; track $index) {
                      <div class="flex items-center gap-3 px-4 py-3 rounded-xl border border-surface-200
                        dark:border-surface-700 bg-white dark:bg-surface-900">
                          <p-skeleton width="3px" height="48px" class="rounded-full shrink-0"/>
                          <div class="flex-1 flex flex-col gap-2">
                              <p-skeleton width="35%" height="1rem"/>
                              <p-skeleton width="55%" height="0.75rem"/>
                          </div>
                          <p-skeleton width="90px" height="1.25rem" class="shrink-0"/>
                          <p-skeleton width="72px" height="2rem" class="shrink-0 rounded-lg"/>
                      </div>
                  }
              </div>

              <!-- ── État vide ────────────────────────────────────────── -->
          } @else if (postesVisibles().length === 0) {
              <div class="flex flex-col items-center justify-center gap-3 py-16
                    rounded-xl border border-dashed border-surface-300 dark:border-surface-700
                    bg-surface-50 dark:bg-surface-900 text-surface-400">
                  <i class="pi pi-inbox text-5xl opacity-30"></i>
                  <span class="text-sm">{{ t.commun.aucunResultat }}</span>
                  @if (contexte.estEditor()) {
                      <p-button icon="pi pi-plus" [label]="t.commun.creer" severity="secondary"
                                size="small" (click)="ouvrirCreation()"/>
                  }
              </div>

              <!-- ── Liste de cartes ──────────────────────────────────── -->
          } @else {
              <div class="flex flex-col gap-1">
                  @for (item of postesAvecSeparateurs(); track $index) {

                      @if (isSeparator(item)) {
                          <!-- ── Séparateur de groupe ── -->
                          <div class="text-xs font-bold uppercase tracking-wider bg-surface-700 text-surface-0
                          px-3 pt-3 pb-3 select-none">
                              {{ item.separator }}
                          </div>

                      } @else {
                          @let p = asPoste(item);
                          <!-- ── Maillon d'une chaîne de révisions : cartes fusionnées verticalement,
                               reliées par une bordure gauche continue (« spine »). Le maillon actif
                               a une spine pleine opacité, les maillons historiques une spine atténuée. ── -->
                          <div [id]="'poste-' + p.id"
                               class="grid grid-cols-[minmax(0,1fr)_auto] gap-3 px-4 py-3
                          border-y border-r border-surface-200 dark:border-surface-700
                          bg-white dark:bg-surface-900
                          hover:shadow-sm
                          transition-all duration-300"
                               [class.border-l]="!p._estChaine"
                               [class.border-surface-200]="!p._estChaine"
                               [class.dark:border-surface-700]="!p._estChaine"
                               [class.hover:border-primary/40]="!p._estChaine"
                               [class.border-l-4]="p._estChaine"
                               [class.border-l-primary]="p._estChaine"
                               [class.dark:border-l-primary/80]="p._estChaine"
                               [class.border-t-0]="p._estChaine && !p._premierDuBloc"
                                [class.border-b-0]="p._estChaine && !p._estActifChaine"
                               [class.-mt-1]="p._estChaine && !p._premierDuBloc"
                               [class.ring-2]="posteEnSurbrillanceId() === p.id"
                               [class.ring-primary]="posteEnSurbrillanceId() === p.id">

                              <!-- Colonne 1 : contenu -->
                              <div class="min-w-0 flex flex-col gap-2">
                                  <div class="grid gap-2 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-start">
                                      <div class="min-w-0 flex items-start gap-2 flex-wrap">
                      <span class="font-medium leading-snug wrap-break-word">
                        {{ p.description }}
                      </span>
                                          @if (categorieLabel(p.categorieId) !== '–' && triActuel() !== 'CATEGORIE') {
                                              <p-tag [value]="categorieLabel(p.categorieId)"
                                                     severity="secondary"
                                                     class="text-[10px] py-0.5 shrink-0"/>
                                          }
                                      </div>

                                      <div
                                              class="min-w-0 flex flex-wrap items-center justify-start gap-2 text-left sm:justify-end sm:text-right">
                                          @if (p.nature === 'ESTIMATION') {
                                              <p-tag [value]="natureAffichee(p)"
                                                     [severity]="'warn'"
                                                     class="text-[10px] py-0.5 shrink-0"/>
                                          }
                                          <span class="font-semibold whitespace-nowrap">
                        {{ p.montant | montant:p.devise }}
                      </span>
                                      </div>
                                  </div>

                                  <div class="grid gap-2 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-start">
                                      <div
                                              class="min-w-0 flex items-center flex-wrap gap-x-2 gap-y-1 text-sm text-surface-500 dark:text-surface-400">
                                          @if (p.periodiciteMois === 0) {
                                              <span class="flex items-center gap-1 min-w-0">
                          <i class="pi pi-calendar text-xs text-surface-400"></i>
                          <span class="truncate">{{ formatPeriode(p.debut) }}</span>
                        </span>
                                              <span class="text-surface-300 dark:text-surface-600 select-none">·</span>
                                              <span class="flex items-center gap-1">
                          <i class="pi pi-bolt text-xs text-purple-500" [pTooltip]="t.poste.oneShot"></i>
                                                  {{ t.poste.oneShot }}
                        </span>
                                          } @else {
                                              <span class="flex items-center gap-1 min-w-0">
                          <i class="pi pi-calendar text-xs text-surface-400"></i>
                          <span
                                  class="truncate">{{ formatPeriode(p.debut) }}&nbsp;–&nbsp;{{ formatPeriode(p.fin) }}</span>
                        </span>
                                              <span class="text-surface-300 dark:text-surface-600 select-none">·</span>
                                              <span class="flex items-center gap-1">
                          @if (p.mode === 'MENSUALISE' || p.periodiciteMois <= 1) {
                              <i class="pi pi-calendar-clock text-xs text-blue-400"
                                 [pTooltip]="t.poste.modeOptions.MENSUALISE"></i>
                          } @else {
                              <i class="pi pi-bolt text-xs text-amber-500"
                                 [pTooltip]="t.poste.modeOptions.PERIODIQUE + ' · ' + (p.moment === 'FIN_PERIODE' ? t.poste.momentOptions.FIN_PERIODE : t.poste.momentOptions.DEBUT_PERIODE)"></i>
                          }
                                                  {{ p.periodiciteMois | periodicite }}
                        </span>
                                          }
                                      </div>

                                      <div class="min-h-5 text-left sm:text-right text-sm text-surface-400">
                                          @if (afficheMontantMensualise(p)) {
                                              <span class="whitespace-nowrap">{{ p.montantMensualise | montant:p.devise }}&thinsp;/mois</span>
                                          }
                                      </div>
                                  </div>

                                  <div class="grid gap-2 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-start">
                                      <div class="min-w-0">
                                          @let membresAffiches = membresAffichesPoste(p);
                                          @if (membresAffiches.length > 0) {
                                              <div class="flex items-center gap-2 flex-wrap">
                                                  @for (rep of membresAffiches; track rep.membreId) {
                                                      <p-tag [value]="rep.label"
                                                             [style]="{ 'background-color': rep.couleur, color: rep.couleurTexte }"
                                                             class="text-xs py-1 px-2 border-none max-w-full"/>
                                                  }
                                              </div>
                                          }
                                      </div>

                                      <div></div>
                                  </div>
                              </div>

                              <!-- Colonne 2 : actions -->
                              <div class="flex items-center justify-end shrink-0">
                                  <p-button icon="pi pi-cog"
                                            [rounded]="true"
                                            [text]="true"
                                            severity="secondary"
                                            size="small"
                                            [ariaLabel]="t.commun.actions"
                                            [pTooltip]="t.commun.actions"
                                            (click)="menuActions.toggle($event)"/>
                                  <p-menu #menuActions [popup]="true" [model]="actionItemsFor(p)" appendTo="body"/>
                              </div>
                          </div>
                      }
                  }
              </div>
          }
      </div>

      <!-- ── Dialog formulaire poste ──────────────────────────────── -->
      <p-dialog [(visible)]="dialogVisible" [header]="posteEnEdition ? t.commun.modifier : t.commun.creer"
                [modal]="true" class="w-full max-w-2xl">
          <form [formGroup]="form" class="flex flex-col gap-4 pt-2">

              <!-- ── Quel nom de poste ? (Description + Catégorie + Montant, toujours visibles en tête) ── -->
              <div class="flex flex-col gap-2">
                  <label class="text-sm font-medium">{{ t.poste.questionnaire.nomTitre }}</label>
                  <div class="flex flex-col gap-1">
                      <input #descriptionInput pInputText formControlName="description" class="w-full"
                             [placeholder]="t.poste.description"/>
                  </div>
                  <div class="grid grid-cols-2 gap-4">
                      <div class="flex flex-col gap-1">
                          <label class="text-sm font-medium">{{ t.poste.categorie }}</label>
                          <p-select appendTo="body" formControlName="categorieId" [options]="categories()"
                                    optionLabel="libelle" optionValue="id" [showClear]="true" class="w-full"/>
                      </div>
                      <div class="flex flex-col gap-1">
                          <label class="text-sm font-medium">{{ t.poste.montant }} *</label>
                          <p-inputnumber formControlName="montant" mode="decimal" [minFractionDigits]="2" class="w-full"/>
                      </div>
                  </div>
              </div>

              <!-- ── Q1 : Ce poste est... (Ponctuel / Récurrent + fréquence) ──────
                   Détermine periodiciteMois. Toujours modifiable, aucun champ existant ne disparaît. -->
              <div class="flex flex-col gap-2">
                  <label class="text-sm font-medium">{{ t.poste.questionnaire.freqTitre }}</label>
                  <p-selectbutton [options]="frequenceOptions" optionLabel="label" optionValue="value"
                                  [ngModel]="frequenceChoisie()" [ngModelOptions]="{standalone: true}"
                                  (ngModelChange)="choisirFrequence($event)"/>

                  @if (frequenceChoisie() === 'RECURRENT') {
                      <div class="flex items-center gap-2">
                          <p-selectbutton [options]="sousFrequenceOptions" optionLabel="label" optionValue="value"
                                          [ngModel]="sousFrequence()" [ngModelOptions]="{standalone: true}"
                                          (ngModelChange)="choisirSousFrequence($event)"/>
                          @if (sousFrequence() === 'AUTRE') {
                              <p-select appendTo="body" formControlName="periodiciteMois"
                                        [options]="periodiciteOptionsAutre" optionLabel="label" optionValue="value"
                                        class="w-full"/>
                          }
                      </div>
                  }
              </div>

              <!-- ── Q2 : Date(s) du poste — libellé et champs dépendent de Ponctuel / Récurrent ──
                   Masqué tant que Q1 n'est pas résolu (fréquence + sous-fréquence si récurrent). -->
              @if (questionnaireFrequenceResolue()) {
              <div class="flex flex-col gap-2">
                  @if ((form.value.periodiciteMois ?? 1) === 0) {
                      <!-- One-shot : uniquement la date du poste (obligatoire), pas de titre de question -->
                      <div class="flex flex-col gap-1">
                          <label class="text-sm font-medium">{{ t.poste.questionnaire.datePosteLabel }} *</label>
                          <p-datepicker appendTo="body" formControlName="debut" dateFormat="dd/mm/yy"
                                        [showButtonBar]="true" class="w-full"></p-datepicker>
                      </div>
                  } @else {
                      <label class="text-sm font-medium">{{ t.poste.questionnaire.periodeValiditeTitre }}</label>

                      <!-- Récurrent : Début + Fin (optionnels) -->
                      <div class="grid grid-cols-2 gap-4">
                          <div class="flex flex-col gap-1">
                              <label class="text-sm font-medium">{{ t.poste.debut }}</label>
                              <p-datepicker appendTo="body" formControlName="debut" dateFormat="dd/mm/yy"
                                            [showButtonBar]="true" class="w-full"></p-datepicker>
                          </div>
                          <div class="flex flex-col gap-1">
                              <label class="text-sm font-medium">{{ t.poste.fin }}</label>
                              <p-datepicker appendTo="body" formControlName="fin" dateFormat="dd/mm/yy"
                                            [showButtonBar]="true" class="w-full"></p-datepicker>
                          </div>
                      </div>

                      <!-- Moment + Mode : visibles seulement si la fréquence "Autre" est choisie -->
                      @if (sousFrequence() === 'AUTRE') {
                          <div class="grid grid-cols-2 gap-4">
                              <div class="flex flex-col gap-1">
                                  <label class="text-sm font-medium"
                                         [pTooltip]="t.poste.momentTooltip">{{ t.poste.moment }}</label>
                                  <p-select appendTo="body" formControlName="moment" [options]="momentOptions"
                                            optionLabel="label" optionValue="value" class="w-full"/>
                              </div>
                              <div class="flex flex-col gap-1">
                                  <label class="text-sm font-medium" [pTooltip]="t.poste.modeTooltip">{{ t.poste.mode }}</label>
                                  <p-select appendTo="body" formControlName="mode" [options]="modeOptions"
                                            optionLabel="label" optionValue="value" class="w-full"/>
                              </div>
                          </div>
                      }
                  }
              </div>
              }

              <!-- ── Q3 : Qui est concerné ? (masqué si mono-membre) ── -->
              @if (membres().length > 1) {
                  <div class="flex flex-col gap-2">
                      <label class="text-sm font-medium">{{ t.poste.questionnaire.quiTitre }}</label>
                      <p-selectbutton [options]="quiConcerneOptions" optionLabel="label" optionValue="value"
                                      [ngModel]="quiConcerneChoice()" [ngModelOptions]="{standalone: true}"
                                      (ngModelChange)="choisirQuiConcerne($event)"/>

                      @if (quiConcerneChoice() === 'MEMBRE_UNIQUE') {
                          <p-selectbutton [options]="membres()" optionLabel="nom" optionValue="id"
                                          [ngModel]="membreUniqueId()" [ngModelOptions]="{standalone: true}"
                                          (ngModelChange)="choisirMembreUnique($event)"/>
                      }

                      @if (quiConcerneChoice() === 'TOUS') {
                          <label class="text-sm font-medium">{{ t.poste.questionnaire.quellesRepartitions }}</label>
                          <p-selectbutton [options]="quiRepartitionOptions" optionLabel="label" optionValue="value"
                                          [ngModel]="quiRepartition()" [ngModelOptions]="{standalone: true}"
                                          (ngModelChange)="choisirQuiRepartition($event)"/>
                      }
                  </div>
              }

              <!-- Liste des membres avec pourcentages (uniquement pour Personnalisé) -->
              @if (afficherListeRepartition()) {
                  <div class="flex flex-col gap-2">
                      <div class="flex items-center justify-between">
                          <label class="text-sm font-medium">
                              {{ t.poste.repartition }}
                              <span class="text-sm"
                                    [class.text-green-600]="sommeRepartition === 100"
                                    [class.text-red-500]="sommeRepartition !== 100 && repartitionsArray.length > 0">
                    {{ sommeRepartition }}%
                  </span>
                          </label>
                      </div>
                      @if (sommeRepartition !== 100 && repartitionsArray.length > 0) {
                          <p-message severity="warn">{{ t.commun.repartitionInvalide }}</p-message>
                      }
                      <div formArrayName="repartitions" class="flex flex-col gap-2">
                          @for (ctrl of repartitionsArray.controls; track ctrl; let i = $index) {
                              <div [formGroupName]="i" class="w-full grid grid-cols-12 items-center gap-3">
                                  <span class="col-span-7 text-sm truncate">{{ membres()[i]?.nom }}</span>
                                  <div class="col-span-5 min-w-[7.5rem]">
                                      <p-inputnumber formControlName="quotePart" [min]="0" [max]="100"
                                                     suffix="%" [minFractionDigits]="0" class="w-full"
                                                     inputStyleClass="w-full"
                                                     (onInput)="onQuotePartChange(i)"></p-inputnumber>
                                  </div>
                              </div>
                          }
                      </div>
                  </div>
              }

              <!-- ── Sur quels comptes à ventiler ? (choix « Tous », quel que soit le type de répartition) ── -->
              @if (afficherComptesTous()) {
                  <div class="flex flex-col gap-2">
                      <label class="text-sm font-medium">{{ t.poste.questionnaire.comptesTitre }}</label>
                      <div formArrayName="repartitions" class="flex flex-col gap-2">
                          @for (ctrl of repartitionsArray.controls; track ctrl; let i = $index) {
                              <div [formGroupName]="i" class="w-full grid grid-cols-12 items-center gap-3">
                                  <span class="col-span-4 text-sm truncate">{{ membres()[i]?.nom }}</span>
                                  <div class="col-span-8 min-w-0">
                                      <p-select appendTo="body" formControlName="compteId"
                                                [options]="comptes()" optionLabel="libelle"
                                                optionValue="id"
                                                [placeholder]="t.poste.ventilation" class="w-full"
                                                [showClear]="true"
                                                [disabled]="repartitionEditable() && (ctrl.get('quotePart')?.value ?? 0) === 0">
                                          <ng-template #selectedItem let-compte>
                                              @if (compte) {
                                                  <div class="flex items-center gap-1.5 flex-wrap">
                                                      <span>{{ compte.libelle }}</span>
                                                      @for (m of membresForCompte(compte); track m.id) {
                                                          <app-tag [couleur]="m.couleur" [texte]="m.nom"/>
                                                      }
                                                  </div>
                                              }
                                          </ng-template>
                                          <ng-template #item let-compte>
                                              <div class="flex items-center gap-1.5 flex-wrap">
                                                  <span>{{ compte.libelle }}</span>
                                                  @for (m of membresForCompte(compte); track m.id) {
                                                      <app-tag [couleur]="m.couleur" [texte]="m.nom"/>
                                                  }
                                              </div>
                                          </ng-template>
                                      </p-select>
                                  </div>
                              </div>
                          }
                      </div>
                  </div>
              }

              @if (!afficherListeRepartition() && !afficherComptesTous() && quiConcerneChoice() === 'MEMBRE_UNIQUE' && membreUniqueId()) {
                  <!-- Un seul membre concerné (100%) : juste le compte qui reçoit la ventilation -->
                  <div class="flex flex-col gap-2">
                      <label class="text-sm font-medium">{{ t.poste.ventilation }}</label>
                      <div formArrayName="repartitions">
                          @for (ctrl of repartitionsArray.controls; track ctrl; let i = $index) {
                              @if (ctrl.get('membreId')?.value === membreUniqueId()) {
                                  <div [formGroupName]="i">
                                      <p-select appendTo="body" formControlName="compteId"
                                                [options]="comptes()" optionLabel="libelle"
                                                optionValue="id"
                                                [placeholder]="t.poste.ventilation" class="w-full"
                                                [showClear]="true">
                                          <ng-template #selectedItem let-compte>
                                              @if (compte) {
                                                  <div class="flex items-center gap-1.5 flex-wrap">
                                                      <span>{{ compte.libelle }}</span>
                                                      @for (m of membresForCompte(compte); track m.id) {
                                                          <app-tag [couleur]="m.couleur" [texte]="m.nom"/>
                                                      }
                                                  </div>
                                              }
                                          </ng-template>
                                          <ng-template #item let-compte>
                                              <div class="flex items-center gap-1.5 flex-wrap">
                                                  <span>{{ compte.libelle }}</span>
                                                  @for (m of membresForCompte(compte); track m.id) {
                                                      <app-tag [couleur]="m.couleur" [texte]="m.nom"/>
                                                  }
                                              </div>
                                          </ng-template>
                                      </p-select>
                                  </div>
                              }
                          }
                      </div>
                  </div>
              } @else if (membres().length === 1) {
                  <!-- Foyer mono-membre : ventilation comptes uniquement (pas de notion de répartition) -->
                  <div class="flex flex-col gap-2">
                      <label class="text-sm font-medium">{{ t.poste.ventilation }}</label>
                      <div formArrayName="repartitions" class="flex flex-col gap-2">
                          @for (ctrl of repartitionsArray.controls; track ctrl; let i = $index) {
                              <div [formGroupName]="i" class="w-full grid grid-cols-12 items-center gap-3">
                                  <span class="col-span-5 text-sm truncate">{{ membres()[i]?.nom }}</span>
                                  <div class="col-span-7 min-w-0">
                                      <p-select appendTo="body" formControlName="compteId"
                                                [options]="comptes()" optionLabel="libelle"
                                                optionValue="id"
                                                [placeholder]="t.poste.ventilation" class="w-full"
                                                [showClear]="true">
                                          <ng-template #selectedItem let-compte>
                                              @if (compte) {
                                                  <div class="flex items-center gap-1.5 flex-wrap">
                                                      <span>{{ compte.libelle }}</span>
                                                      @for (m of membresForCompte(compte); track m.id) {
                                                          <app-tag [couleur]="m.couleur" [texte]="m.nom"/>
                                                      }
                                                  </div>
                                              }
                                          </ng-template>
                                          <ng-template #item let-compte>
                                              <div class="flex items-center gap-1.5 flex-wrap">
                                                  <span>{{ compte.libelle }}</span>
                                                  @for (m of membresForCompte(compte); track m.id) {
                                                      <app-tag [couleur]="m.couleur" [texte]="m.nom"/>
                                                  }
                                              </div>
                                          </ng-template>
                                      </p-select>
                                  </div>
                              </div>
                          }
                      </div>
                  </div>
              }

              <!-- ── Q5 : Le montant du poste est-il une estimation ? ── -->
              <div class="flex flex-col gap-2">
                  <label class="text-sm font-medium" [pTooltip]="t.poste.natureTooltip">
                      {{ t.poste.questionnaire.estimationTitre }}
                  </label>
                  <p-selectbutton [options]="estimationOptions" optionLabel="label" optionValue="value"
                                  formControlName="nature"/>
                  @if (form.value.nature === 'ESTIMATION') {
                      <div class="flex flex-col gap-1 max-w-xs">
                          <label class="text-sm font-medium" [pTooltip]="t.poste.estimationTooltip">
                              {{ t.poste.estimationPourcentage }} *
                          </label>
                          <p-inputnumber formControlName="estimPourcentage"
                                         [min]="0" [max]="100"
                                         [minFractionDigits]="1" [maxFractionDigits]="1"
                                         suffix="%" class="w-full"
                                         [placeholder]="t.poste.estimationPlaceholder"/>
                      </div>
                  }
              </div>
          </form>
          <ng-template #footer>
              <p-button [label]="t.commun.annuler" severity="secondary" (click)="fermerDialogPoste()"/>
              <p-button [label]="t.commun.enregistrer" (click)="enregistrer()"
                        [disabled]="!isFormValid()"/>
          </ng-template>
      </p-dialog>

      <!-- Dialog mini-formulaire : révision de montant planifiée -->
      <p-dialog [(visible)]="revisionDialogVisible"
                [header]="i18n.instant('poste.revisionTitre', { description: posteEnRevision?.description ?? '' })"
                [modal]="true" class="w-full max-w-md">
          @if (posteEnRevision) {
              <form [formGroup]="revisionForm" class="flex flex-col gap-4 pt-2">
                  <div class="flex flex-col gap-1">
                      <label class="text-sm font-medium text-surface-500">{{ t.poste.revisionMontantActuel }}</label>
                      <span class="text-sm">{{ posteEnRevision.montant | montant:posteEnRevision.devise }}</span>
                  </div>

                  <div class="flex flex-col gap-1">
                      <label class="text-sm font-medium">{{ t.poste.revisionNouveauMontant }} *</label>
                      <p-inputnumber formControlName="nouveauMontant" mode="decimal" [minFractionDigits]="2"
                                     class="w-full"/>
                  </div>

                  <div class="flex flex-col gap-1">
                      <label class="text-sm font-medium">{{ t.poste.revisionDateEffet }} *</label>
                      <p-datepicker appendTo="body" formControlName="dateEffet" view="month" dateFormat="mm/yy"
                                    [showButtonBar]="true" class="w-full"></p-datepicker>
                  </div>

                  <div class="text-sm rounded-md border border-primary/30 bg-primary/5 px-3 py-2 text-primary-700 dark:text-primary-300">
                      {{ resumeRevision() }}
                  </div>
              </form>
          }
          <ng-template #footer>
              <p-button [label]="t.commun.annuler" severity="secondary" (click)="fermerDialogRevision()"/>
              <p-button [label]="t.commun.enregistrer" (click)="enregistrerRevision()"
                        [disabled]="!revisionValide()"/>
          </ng-template>
      </p-dialog>

      <!-- Dialog mini-formulaire : décaler la date d'effet entre un maillon et son prédécesseur -->
      <p-dialog [(visible)]="decalerDialogVisible"
                [header]="i18n.instant('poste.decalerDateEffetTitre', { description: posteEnDecalage?.description ?? '' })"
                [modal]="true" class="w-full max-w-md">
          @if (posteEnDecalage && precedentEnDecalage(); as precedent) {
              <form [formGroup]="decalerForm" class="flex flex-col gap-4 pt-2">
                  @if (intervalleDecalageVide()) {
                      <p class="text-sm text-red-600 dark:text-red-400">{{ t.poste.decalerDateEffetAucunMoisDisponible }}</p>
                  } @else {
                      <div class="flex flex-col gap-1">
                          <label class="text-sm font-medium">{{ t.poste.decalerDateEffetLabel }} *</label>
                          <p-datepicker appendTo="body" formControlName="nouvelleDateEffet" view="month" dateFormat="mm/yy"
                                        [minDate]="borneDecalageMin()" [maxDate]="borneDecalageMax()"
                                        [showButtonBar]="true" class="w-full"></p-datepicker>
                      </div>

                      <div class="text-sm rounded-md border border-primary/30 bg-primary/5 px-3 py-2 text-primary-700 dark:text-primary-300">
                          {{ resumeDecalage() }}
                      </div>
                  }
              </form>
          }
          <ng-template #footer>
              <p-button [label]="t.commun.annuler" severity="secondary" (click)="fermerDialogDecalage()"/>
              <p-button [label]="t.commun.enregistrer" (click)="enregistrerDecalage()"
                        [disabled]="!decalageValide()"/>
          </ng-template>
      </p-dialog>

      <!-- Dialog mini-formulaire : clôture rapide d'un poste (action « Terminer ») -->
      <p-dialog [(visible)]="clotureDialogVisible"
                [header]="i18n.instant('poste.clotureTitre', { description: posteEnCloture()?.description ?? '' })"
                [modal]="true" class="w-full max-w-md">
          @if (posteEnCloture(); as p) {
              <form [formGroup]="clotureForm" class="flex flex-col gap-4 pt-2">
                  <p-selectbutton [options]="clotureOptions()" formControlName="option"
                                   optionLabel="label" optionValue="value"
                                   styleClass="flex flex-col items-stretch gap-1"/>

                  @if (clotureForm.value.option === 'PERSONNALISEE') {
                      <div class="flex flex-col gap-1">
                          <label class="text-sm font-medium">{{ t.poste.clotureDateLabel }} *</label>
                          <p-datepicker appendTo="body" formControlName="datePersonnalisee" view="month" dateFormat="mm/yy"
                                        [showButtonBar]="true" class="w-full"></p-datepicker>
                      </div>
                  }

                  <div class="text-sm rounded-md border border-primary/30 bg-primary/5 px-3 py-2 text-primary-700 dark:text-primary-300">
                      {{ resumeCloture() }}
                  </div>
              </form>
          }
          <ng-template #footer>
              <p-button [label]="t.commun.annuler" severity="secondary" (click)="fermerDialogCloture()"/>
              <p-button [label]="t.poste.clotureValider" (click)="enregistrerCloture()"
                        [disabled]="!clotureValide()"/>
          </ng-template>
      </p-dialog>

      <!-- Dialog aperçu mensuel -->
      <p-dialog [(visible)]="apercuVisible" [header]="t.poste.apercu" [modal]="true" class="w-96">
          @if (apercuData()) {
              <p-table [value]="apercuData()!.contributions" class="p-datatable-sm">
                  <ng-template #header>
                      <tr>
                          <th>{{ t.projection.mois }}</th>
                          <th class="text-right">{{ t.poste.contribution }}</th>
                      </tr>
                  </ng-template>
                  <ng-template #body let-c>
                      <tr>
                          <td>{{ t.mois[c.mois - 1] }}</td>
                          <td class="text-right">{{ c.contribution | montant }}</td>
                      </tr>
                  </ng-template>
              </p-table>
          }
      </p-dialog>

      <!-- ── Drawer historique de la chaîne de révisions (lecture seule) ── -->
      <p-drawer [(visible)]="historiqueDrawerVisible" position="right"
                [header]="i18n.instant('poste.historiqueTitre', { description: historiquePosteDescription() })"
                styleClass="w-full sm:w-96">
          @if (historiqueEvolutionGlobale(); as evolution) {
              <div class="mb-4 px-3 py-2 rounded-lg bg-surface-100 dark:bg-surface-800 text-sm font-medium text-center"
                   [class.text-green-600]="evolution.signe === '+'"
                   [class.text-red-500]="evolution.signe !== '+'">
                  {{ i18n.instant('poste.historiqueEvolutionGlobale', { signe: evolution.signe, pct: evolution.pct }) }}
              </div>
          }

          <div class="flex flex-col">
              @for (m of historiqueMaillons(); track m.poste.id; let first = $first; let last = $last) {
                  @if (!first) {
                      <div class="flex justify-center -my-0.5">
                          <div class="w-px h-3" [class.bg-primary]="last" [class.bg-surface-300]="!last" [class.dark:bg-surface-600]="!last"></div>
                      </div>
                  }
                  <button type="button"
                          class="text-left rounded-lg border px-3 py-2.5 transition-colors duration-150 cursor-pointer"
                          [class.border-primary]="last"
                          [class.bg-primary-50]="last"
                          [class.dark:bg-primary-950]="last"
                          [class.border-surface-200]="!last"
                          [class.dark:border-surface-700]="!last"
                          [class.hover:border-primary-400]="!last"
                          (click)="navigerVersPoste(m.poste.id)">
                      <div class="flex items-center justify-between gap-2">
                          <span class="text-xs text-surface-500 dark:text-surface-400">
                              {{ formatPeriode(m.poste.debut) }} –
                              {{ m.poste.fin ? formatPeriode(m.poste.fin) : (last ? t.poste.historiquePeriodeEnCours : '–') }}
                          </span>
                          @if (last) {
                              <p-tag [value]="t.poste.historiqueActif" severity="info" class="text-[10px] py-0.5"/>
                          }
                      </div>
                      <div class="font-semibold mt-1" [class.text-surface-900]="last" [class.dark:text-surface-100]="last"
                           [class.text-surface-600]="!last" [class.dark:text-surface-300]="!last">
                          {{ m.poste.montant | montant:m.poste.devise }}
                      </div>
                      <div class="text-xs mt-0.5"
                           [class.text-green-600]="m.ecartMontant !== null && m.ecartMontant >= 0"
                           [class.text-red-500]="m.ecartMontant !== null && m.ecartMontant < 0"
                           [class.text-surface-400]="m.ecartMontant === null">
                          @if (m.ecartMontant === null) {
                              {{ t.poste.historiqueMontantOrigine }}
                          } @else {
                              {{ i18n.instant('poste.historiqueEcart', {
                                  signe: m.ecartMontant >= 0 ? '+' : '',
                                  montant: formaterMontant(m.ecartMontant, m.poste.devise),
                                  pct: m.ecartPourcentage !== null ? m.ecartPourcentage.toFixed(1) : '–'
                              }) }}
                          }
                      </div>
                  </button>
              }
          </div>
      </p-drawer>
  `,
})
export class PostesListeComponent implements OnInit {
  readonly i18n = inject(I18nService);
  readonly t = this.i18n.translations();
  readonly type = input<TypePoste>('REVENU');
  readonly Math = Math; // Exposition pour le template
  contexte = inject(ContexteService);
  private posteSvc = inject(PosteService);
  private categorieSvc = inject(CategorieService);
  private compteSvc = inject(CompteService);
  private toast = inject(MessageService);
  private confirm = inject(ConfirmationService);
  private fb = inject(FormBuilder);

  postes = signal<PosteDto[]>([]);
  categories = signal<CategorieDto[]>([]);
  comptes = signal<CompteDto[]>([]);
  chargement = signal(false);
  dialogVisible = false;
  apercuVisible = false;
  posteEnEdition: PosteDto | null = null;
  apercuData = signal<{ annee: number; contributions: { mois: number; contribution: number; }[] } | null>(null);
  membres = this.contexte.membres;
  sommeRepartition = 0;

  // ── Révision de montant planifiée ─────────────────────────
  revisionDialogVisible = false;
  posteEnRevision: PosteDto | null = null;
  revisionForm = this.fb.group({
    nouveauMontant: [0, [Validators.required, Validators.min(0.01)]],
    dateEffet:      [null as Date | null, Validators.required],
  });

  private readonly _revisionMontantValue = toSignal(
    this.revisionForm.get('nouveauMontant')!.valueChanges.pipe(
      startWith(this.revisionForm.get('nouveauMontant')!.value)
    ),
    { initialValue: 0 }
  );
  private readonly _revisionDateValue = toSignal(
    this.revisionForm.get('dateEffet')!.valueChanges.pipe(
      startWith(this.revisionForm.get('dateEffet')!.value)
    ),
    { initialValue: null as Date | null }
  );

  /** Résumé live « 1'800 → 1'950 CHF (+8.3 %), dès janvier 2027 ». */
  resumeRevision = computed(() => {
    const p = this.posteEnRevision;
    if (!p) return '';
    const avant = p.montant;
    const apres = this._revisionMontantValue() ?? 0;
    const date = this._revisionDateValue();
    const pct = avant > 0 ? ((apres - avant) / avant) * 100 : 0;
    const signe = pct >= 0 ? '+' : '';
    return this.i18n.instant('poste.revisionResume', {
      avant: this.formaterMontant(avant, p.devise),
      apres: this.formaterMontant(apres, p.devise),
      signe,
      pct: pct.toFixed(1),
      date: date ? this.formatPeriode(this.toIso(date)) : '–',
    });
  });

  // ── Clôture rapide (action « Terminer ») ──────────────────
  clotureDialogVisible = false;
  posteEnCloture = signal<PosteDto | null>(null);
  clotureForm = this.fb.group({
    option: ['MOIS_COURANT' as OptionCloture],
    datePersonnalisee: [null as Date | null],
  });

  private readonly _clotureOptionValue = toSignal(
    this.clotureForm.get('option')!.valueChanges.pipe(
      startWith(this.clotureForm.get('option')!.value as OptionCloture)
    ),
    { initialValue: 'MOIS_COURANT' as OptionCloture }
  );
  private readonly _clotureDatePersonnaliseeValue = toSignal(
    this.clotureForm.get('datePersonnalisee')!.valueChanges.pipe(
      startWith(this.clotureForm.get('datePersonnalisee')!.value)
    ),
    { initialValue: null as Date | null }
  );

  /** Options proposées : « prochain mois périodique » uniquement si cycle > 2 mois. */
  clotureOptions = computed(() => {
    const p = this.posteEnCloture();
    const options: { label: string; value: OptionCloture }[] = [
      { label: this.t.poste.clotureOptionMoisCourant, value: 'MOIS_COURANT' },
    ];
    if (p && p.periodiciteMois > 2) {
      options.push({ label: this.t.poste.clotureOptionProchainPeriodique, value: 'PROCHAIN_PERIODIQUE' });
    }
    options.push({ label: this.t.poste.clotureOptionPersonnalisee, value: 'PERSONNALISEE' });
    return options;
  });

  /** Date de fin calculée selon l'option choisie (toujours le dernier jour du mois retenu). */
  finCloture = computed<Date | null>(() => {
    const p = this.posteEnCloture();
    if (!p) return null;
    const option = this._clotureOptionValue();
    if (option === 'MOIS_COURANT') return this.finDeMois(new Date());
    if (option === 'PROCHAIN_PERIODIQUE') return this.finDeMois(this.prochainMoisPeriodique(p));
    const date = this._clotureDatePersonnaliseeValue();
    return date ? this.finDeMois(date) : null;
  });

  /** Résumé live « Le poste sera actif jusqu'en septembre 2026 ». */
  resumeCloture = computed(() => {
    const fin = this.finCloture();
    if (!fin) return '';
    return this.i18n.instant('poste.clotureResume', { periode: this.formatPeriode(this.toIso(fin)) });
  });

  /** Bouton de validation activé seulement si une date de fin cohérente est déterminée. */
  clotureValide = computed(() => {
    const p = this.posteEnCloture();
    const fin = this.finCloture();
    if (!p || !fin) return false;
    const iso = this.toIso(fin);
    if (p.debut && iso < p.debut) return false;
    return true;
  });

  // ── Historique de la chaîne de révisions (lecture seule) ──
  historiqueDrawerVisible = signal(false);
  historiquePosteDescription = signal<string>('');
  historiqueMaillons = signal<{ poste: PosteDto; ecartMontant: number | null; ecartPourcentage: number | null }[]>([]);
  historiqueEvolutionGlobale = signal<{ signe: string; pct: string } | null>(null);
  /** Poste temporairement mis en surbrillance après navigation depuis le drawer d'historique. */
  posteEnSurbrillanceId = signal<string | null>(null);

  /** Bouton de validation activé seulement si montant > 0 et date d'effet cohérente. */
  revisionValide = computed(() => {
    const p = this.posteEnRevision;
    const montant = this._revisionMontantValue();
    const date = this._revisionDateValue();
    if (!p || !date || !(montant! > 0)) return false;
    const iso = this.toIso(date);
    if (p.debut && iso <= p.debut) return false;
    if (p.fin && iso > p.fin) return false;
    return true;
  });

  // ── Décaler la date d'effet (frontière entre un maillon et son prédécesseur) ──
  decalerDialogVisible = false;
  posteEnDecalage: PosteDto | null = null;
  decalerForm = this.fb.group({
    nouvelleDateEffet: [null as Date | null, Validators.required],
  });

  private readonly _decalerDateValue = toSignal(
    this.decalerForm.get('nouvelleDateEffet')!.valueChanges.pipe(
      startWith(this.decalerForm.get('nouvelleDateEffet')!.value)
    ),
    { initialValue: null as Date | null }
  );

  /** Prédécesseur immédiat du maillon en cours de décalage. */
  precedentEnDecalage = computed(() => {
    const p = this.posteEnDecalage;
    if (!p?.posteOrigineId) return null;
    return this.postes().find(x => x.id === p.posteOrigineId) ?? null;
  });

  /** Successeur éventuel (maillon suivant), qui fige la borne haute s'il existe. */
  private successeurEnDecalage = computed(() => {
    const p = this.posteEnDecalage;
    if (!p) return null;
    return this.postes().find(x => x.posteOrigineId === p.id) ?? null;
  });

  /** Borne basse exclusive : 1er jour du mois qui suit le début du prédécesseur. */
  borneDecalageMin = computed<Date | null>(() => {
    const precedent = this.precedentEnDecalage();
    if (!precedent?.debut) return null;
    const [year, month] = precedent.debut.split('-').map(Number);
    return new Date(year, month, 1); // month (0-based index de month) = mois suivant
  });

  /** Borne haute exclusive : 1er jour du mois de fin déjà figé par un successeur, s'il y en a un. */
  borneDecalageMax = computed<Date | null>(() => {
    const p = this.posteEnDecalage;
    const successeur = this.successeurEnDecalage();
    if (!p || !successeur || !p.fin) return null;
    const [year, month] = p.fin.split('-').map(Number);
    return new Date(year, month - 1, 1);
  });

  /** Vrai si l'intervalle de mois valides est vide (deux maillons collés sur un seul mois d'écart). */
  intervalleDecalageVide = computed(() => {
    const min = this.borneDecalageMin();
    const max = this.borneDecalageMax();
    if (!min || !max) return false;
    return min.getTime() > max.getTime();
  });

  /** Résumé live du nouveau découpage résultant. */
  resumeDecalage = computed(() => {
    const p = this.posteEnDecalage;
    const precedent = this.precedentEnDecalage();
    const date = this._decalerDateValue();
    if (!p || !precedent || !date) return '';
    const iso = this.toIso(date);
    const finPrecedente = new Date(date.getFullYear(), date.getMonth(), 0);
    return this.i18n.instant('poste.decalerDateEffetResume', {
      descriptionPrecedente: precedent.description,
      montantPrecedent: this.formaterMontant(precedent.montant, precedent.devise),
      finPrecedente: this.formatPeriode(this.toIso(finPrecedente)),
      montantActuel: this.formaterMontant(p.montant, p.devise),
      debutActuel: this.formatPeriode(iso),
    });
  });

  /** Bouton de validation activé seulement si une date est choisie et respecte l'intervalle autorisé. */
  decalageValide = computed(() => {
    if (this.intervalleDecalageVide()) return false;
    const date = this._decalerDateValue();
    if (!date) return false;
    const min = this.borneDecalageMin();
    const max = this.borneDecalageMax();
    if (min && date.getTime() < min.getTime()) return false;
    if (max && date.getTime() > max.getTime()) return false;
    return true;
  });

  modeOptions = [
    { label: this.t.poste.modeOptions.MENSUALISE, value: 'MENSUALISE' },
    { label: this.t.poste.modeOptions.PERIODIQUE, value: 'PERIODIQUE' },
  ];

  momentOptions = [
    { label: this.t.poste.momentOptions.DEBUT_PERIODE, value: 'DEBUT_PERIODE' },
    { label: this.t.poste.momentOptions.FIN_PERIODE,   value: 'FIN_PERIODE' },
  ];

  natureOptions = [
    { label: this.t.poste.natureOptions.EFFECTIF,  value: 'EFFECTIF' },
    { label: this.t.poste.natureOptions.ESTIMATION, value: 'ESTIMATION' },
  ];

  // ── Mini-questionnaire structurel (façade UI au-dessus du form réactif) ──
  @ViewChild('descriptionInput') private descriptionInput?: ElementRef<HTMLInputElement>;

  frequenceChoisie = signal<'PONCTUEL' | 'RECURRENT' | null>(null);
  sousFrequence    = signal<'MENSUEL' | 'AUTRE' | null>(null);
  /** Q « Qui est concerné » : Tous les membres, ou un seul membre en particulier. */
  quiConcerneChoice = signal<'TOUS' | 'MEMBRE_UNIQUE' | null>(null);
  /** Sous-question affichée quand quiConcerneChoice = TOUS : quel type de répartition. */
  quiRepartition = signal<TypeRepartition | null>(null);
  membreUniqueId = signal<string | null>(null);
  private _focusDescriptionFait = false;

  frequenceOptions = [
    { label: this.t.poste.questionnaire.ponctuel,  value: 'PONCTUEL' as const },
    { label: this.t.poste.questionnaire.recurrent, value: 'RECURRENT' as const },
  ];

  sousFrequenceOptions = [
    { label: this.t.poste.questionnaire.chaqueMois,     value: 'MENSUEL' as const },
    { label: this.t.poste.questionnaire.autreFrequence, value: 'AUTRE' as const },
  ];

  quiConcerneOptions = [
    { label: this.t.poste.questionnaire.quiTous,         value: 'TOUS' as const },
    { label: this.t.poste.questionnaire.quiMembreUnique, value: 'MEMBRE_UNIQUE' as const },
  ];

  quiRepartitionOptions = [
    { label: this.t.poste.questionnaire.repartitionScenario,        value: 'AUTO' as TypeRepartition },
    { label: this.t.poste.questionnaire.repartitionScenarioInverse, value: 'REVERSE_AUTO' as TypeRepartition },
    { label: this.t.poste.questionnaire.repartitionPersonnalisee,   value: 'CUSTOM' as TypeRepartition },
  ];

  estimationOptions = [
    { label: this.t.commun.non, value: 'EFFECTIF' as const },
    { label: this.t.commun.oui, value: 'ESTIMATION' as const },
  ];

  /** Vrai si la liste des membres + pourcentages doit être affichée (choix « Tous » + « Personnalisé »). */
  afficherListeRepartition = computed(() =>
    this.quiConcerneChoice() === 'TOUS' && this.quiRepartition() === 'CUSTOM' && this.membres().length > 1
  );

  /** Vrai si le bloc « Sur quels comptes à ventiler ? » doit être affiché (choix « Tous », quel que soit le type). */
  afficherComptesTous = computed(() =>
    this.quiConcerneChoice() === 'TOUS' && this.quiRepartition() !== null && this.membres().length > 1
  );

  /** Vrai si les quotes-parts affichées sont éditables (uniquement pour Personnalisé). */
  repartitionEditable = computed(() => this.quiRepartition() === 'CUSTOM');

  /** Question 1 résolue : one-shot, ou récurrent avec une fréquence précisée. */
  questionnaireFrequenceResolue = computed(() =>
    this.frequenceChoisie() === 'PONCTUEL' ||
    (this.frequenceChoisie() === 'RECURRENT' && this.sousFrequence() !== null)
  );

  /** Question « Qui » résolue : mono-membre (question non posée), ou un choix complet fait. */
  private questionnaireQuiResolue = computed(() =>
    this.membres().length <= 1 ||
    (this.quiConcerneChoice() === 'MEMBRE_UNIQUE' && this.membreUniqueId() !== null) ||
    (this.quiConcerneChoice() === 'TOUS' && this.quiRepartition() !== null)
  );

  /** Focus automatique sur Description une fois le questionnaire résolu (une seule fois par ouverture). */
  private readonly _focusDescriptionApresQuestionnaire = effect(() => {
    if (this.questionnaireFrequenceResolue() && this.questionnaireQuiResolue() &&
        this.dialogVisible && !this._focusDescriptionFait) {
      this._focusDescriptionFait = true;
      setTimeout(() => this.descriptionInput?.nativeElement.focus());
    }
  });

  choisirFrequence(f: 'PONCTUEL' | 'RECURRENT'): void {
    this.frequenceChoisie.set(f);
    if (f === 'PONCTUEL') {
      this.sousFrequence.set(null);
      this.form.get('periodiciteMois')?.setValue(0);
    }
  }

  choisirSousFrequence(sf: 'MENSUEL' | 'AUTRE'): void {
    this.sousFrequence.set(sf);
    if (sf === 'MENSUEL') {
      this.form.get('periodiciteMois')?.setValue(1);
    } else {
      const actuel = this.form.get('periodiciteMois')?.value ?? 0;
      if (actuel === 0 || actuel === 1) {
        this.form.get('periodiciteMois')?.setValue(3);
      }
    }
  }

  choisirQuiConcerne(choix: 'TOUS' | 'MEMBRE_UNIQUE'): void {
    this.quiConcerneChoice.set(choix);
    if (choix === 'MEMBRE_UNIQUE') {
      this.quiRepartition.set(null);
      if (this.membreUniqueId()) {
        this.choisirMembreUnique(this.membreUniqueId()!);
      }
    } else {
      this.membreUniqueId.set(null);
      if (this.quiRepartition()) {
        this.choisirQuiRepartition(this.quiRepartition()!);
      }
    }
  }

  choisirQuiRepartition(qr: TypeRepartition): void {
    this.quiRepartition.set(qr);
    this.form.get('typeRepartition')?.setValue(qr);
    if (qr === 'CUSTOM') {
      this.appliquerRepartitionEgale();
    } else {
      this.appliquerRepartitionAffichageScenario(qr === 'REVERSE_AUTO');
    }
  }

  choisirMembreUnique(membreId: string): void {
    this.membreUniqueId.set(membreId);
    this.form.get('typeRepartition')?.setValue('CUSTOM');
    this.appliquerRepartitionMembreUnique(membreId);
  }

  /** Nom du membre retenu par le preset « Un membre en particulier ». */
  nomMembreUnique(): string {
    return this.membres().find(m => m.id === this.membreUniqueId())?.nom ?? '';
  }

  /** 100% pour le membre sélectionné, 0% pour les autres (et vide leur compte). */
  private appliquerRepartitionMembreUnique(membreId: string): void {
    this.repartitionsArray.controls.forEach(c => {
      const selectionne = c.get('membreId')?.value === membreId;
      c.patchValue({
        quotePart: selectionne ? 100 : 0,
        compteId: selectionne ? c.get('compteId')?.value : null,
      }, { emitEvent: false });
    });
    this.calculerSomme();
  }

  /** Parts égales entre tous les membres, même arrondi que la répartition par défaut d'un scénario. */
  private appliquerRepartitionEgale(): void {
    const n = this.repartitionsArray.length;
    if (!n) return;
    const part = Math.round(100 / n);
    const reste = 100 - part * (n - 1);
    this.repartitionsArray.controls.forEach((c, i) => {
      c.patchValue({ quotePart: i === n - 1 ? reste : part }, { emitEvent: false });
    });
    this.calculerSomme();
  }

  /**
   * Affichage (lecture seule) des quotes-parts effectives AUTO/REVERSE_AUTO, dérivées de la
   * répartition par défaut du scénario. Ces valeurs ne sont jamais envoyées à l'API pour ces
   * deux modes (seul CUSTOM stocke une répartition sur le poste) — c'est purement informatif.
   */
  private appliquerRepartitionAffichageScenario(inverse: boolean): void {
    const reps = this.contexte.scenarioCourant()?.repartitions ?? [];
    const n = this.membres().length;
    this.repartitionsArray.controls.forEach(c => {
      const membreId = c.get('membreId')?.value;
      const base = reps.find(r => r.membreId === membreId)?.quotePart ?? (n ? 1 / n : 0);
      const effective = (inverse && n > 1) ? (1 - base) / (n - 1) : base;
      c.patchValue({ quotePart: Math.round(effective * 100) }, { emitEvent: false });
    });
    this.calculerSomme();
  }

  periodiciteOptions = [
    { label: this.t.poste.periodiciteLabels[0], value: 0 },
    ...this.t.poste.periodiciteLabels.slice(1).map((label, i) => ({ label, value: i + 1 }))
  ];

  /** Options de périodicité pour le choix « Autre » : sans « Une seule fois » ni « Tous les mois »,
   *  déjà couverts par les choix rapides Ponctuel / Chaque mois. */
  periodiciteOptionsAutre = this.periodiciteOptions.filter(o => o.value !== 0 && o.value !== 1);

  triActuel = signal<'DATE' | 'CATEGORIE' | 'DESCRIPTION'>('CATEGORIE');
  cacherInactifs = signal(true);
  cacherFuturs = signal(false);
  filtreCompteIds = signal<string[]>([]);
  filtreMembreIds = signal<string[]>([]);
  filtreCategorieIds = signal<string[]>([]);

  triOptions = [
    { label: this.t.poste.triOptions.DATE,        value: 'DATE' as const },
    { label: this.t.poste.triOptions.CATEGORIE,   value: 'CATEGORIE' as const },
    { label: this.t.poste.triOptions.DESCRIPTION, value: 'DESCRIPTION' as const },
  ];

  visibiliteMenuItems: MenuItem[] = [
    { label: this.t.poste.cacherInactifs, data: 'cacher-inactifs' },
    { label: this.t.poste.cacherFuturs, data: 'cacher-futurs' },
  ];

  form = this.fb.group({
    description:     ['', Validators.required],
    categorieId:     [null as string | null],
    montant:         [0, [Validators.required, Validators.min(0)]],
    periodiciteMois: [0, Validators.min(0)],
    mode:            ['MENSUALISE'],
    moment:          ['DEBUT_PERIODE'],
    nature:          ['EFFECTIF'],
    estimPourcentage: [null as number | null, [Validators.min(0), Validators.max(100)]],  // Obligatoire si nature=ESTIMATION
    typeRepartition: ['AUTO' as TypeRepartition],
    debut:           [null as Date | null],
    fin:             [null as Date | null],
    repartitions:    this.fb.array([] as any[]),
  });

  get repartitionsArray() { return this.form.get('repartitions') as FormArray; }

  /** Signal réactif sur la valeur courante de typeRepartition (réagit aux changements du select) */
  private typeRepartitionValue = toSignal(
    this.form.get('typeRepartition')!.valueChanges.pipe(
      startWith(this.form.get('typeRepartition')!.value as TypeRepartition)
    ),
    { initialValue: 'AUTO' as TypeRepartition }
  );

  /** Signal réactif sur la nature du poste (bascule EFFECTIF ↔ ESTIMATION) */
  private natureValue = toSignal(
    this.form.get('nature')!.valueChanges.pipe(
      startWith(this.form.get('nature')!.value)
    ),
    { initialValue: 'EFFECTIF' }
  );

  /** Vrai si le mode de répartition courant nécessite des parts manuelles (CUSTOM multi-membres) */
  estCustomMultiMembre = computed(() =>
    this.typeRepartitionValue() === 'CUSTOM' && this.membres().length > 1
  );

  /** Vrai si le formulaire est valide, incluant la validation du pourcentage d'estimation. */
  isFormValid(): boolean {
    const isBaseValid = this.form.valid;
    const nature = this.form.value.nature;
    const estimPct = this.form.value.estimPourcentage;
    // Si nature=ESTIMATION, estimPourcentage doit être non-null
    const isEstimationValid = nature === 'ESTIMATION' ? estimPct !== null && estimPct !== undefined && estimPct > 0 : true;
    return isBaseValid && isEstimationValid && (!this.estCustomMultiMembre() || this.sommeRepartition === 100);
  }

  /** Effet : bascule Nature EFFECTIF→ESTIMATION pré-remplit 10%, ESTIMATION→EFFECTIF vide (null) */
  private readonly _initEstimPourcentageOnNatureChange = effect(() => {
    const nature = this.natureValue();
    if (nature === 'ESTIMATION') {
      // Ne mettre 10% que si le champ est actuellement vide
      if (this.form.get('estimPourcentage')?.value === null) {
        this.form.get('estimPourcentage')?.setValue(10.0, { emitEvent: false });
      }
    } else {
      // Vider si nature=EFFECTIF
      this.form.get('estimPourcentage')?.setValue(null, { emitEvent: false });
    }
  });

  /**
   * Quand l'utilisateur bascule vers CUSTOM et que le FormArray n'est pas encore peuplé
   * (cas d'une ouverture en création), on initialise les parts à 0.
   */
  private readonly _initPartsOnCustom = effect(() => {
    if (this.typeRepartitionValue() === 'CUSTOM' && this.repartitionsArray.length === 0) {
      this.initialiserRepartitions(undefined);
    }
  });

  // ── Helpers fenêtre de validité ──────────────────────────
  private readonly _now = new Date();
  private readonly _moisCourant = (() => {
    const d = this._now;
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  })();
  private readonly _aujourdHuiIso = this.toIso(this._now);

  /** Comparateur de tri appliqué au « représentant » d'un poste isolé ou d'une chaîne. */
  private comparerPostes = (a: PosteDto, b: PosteDto): number => {
    switch (this.triActuel()) {
      case 'DATE': {
        const da = a.debut ?? '9999-12'; const db = b.debut ?? '9999-12';
        if (da !== db) return da.localeCompare(db);
        return (a.fin ?? '9999-12').localeCompare(b.fin ?? '9999-12');
      }
      case 'CATEGORIE': {
        const ca = this.categorieLabel(a.categorieId); const cb = this.categorieLabel(b.categorieId);
        if (ca !== cb) return ca.localeCompare(cb, 'fr');
        if (a.description !== b.description) return a.description.localeCompare(b.description, 'fr');
        return b.montant - a.montant;
      }
      case 'DESCRIPTION': {
        if (a.description !== b.description) return a.description.localeCompare(b.description, 'fr');
        return b.montant - a.montant;
      }
      default: return 0;
    }
  };

  /** Clé + libellé de séparateur pour un poste « représentant » selon le tri actuel. */
  private clefSeparateur(p: PosteDto): { clef: string; label: string } {
    switch (this.triActuel()) {
      case 'DATE':
        return { clef: p.debut?.substring(0, 7) ?? '–', label: this.formatPeriode(p.debut ?? null) };
      case 'CATEGORIE': {
        const label = this.categorieLabel(p.categorieId);
        return { clef: label, label };
      }
      case 'DESCRIPTION': {
        const label = p.description.charAt(0).toUpperCase();
        return { clef: label, label };
      }
      default:
        return { clef: '', label: '' };
    }
  }

  /**
   * Racine (id du tout premier maillon) de la chaîne de révisions à laquelle appartient p.
   * Remonte via posteOrigineId sur la liste complète (non filtrée) du scénario.
   */
  private racineChaine(p: PosteDto, index: Map<string, PosteDto>): string {
    let courant = p;
    const visites = new Set<string>();
    while (courant.posteOrigineId && index.has(courant.posteOrigineId) && !visites.has(courant.id)) {
      visites.add(courant.id);
      courant = index.get(courant.posteOrigineId)!;
    }
    return courant.id;
  }

  /** Liste filtrée (avant tri/regroupement) selon les options de masquage et les filtres actifs. */
  private postesFiltres = computed(() => {
    const compteIds     = this.filtreCompteIds();
    const membreIds     = this.filtreMembreIds();
    const categorieIds  = this.filtreCategorieIds();
    const tousMembreIds = this.membres().map(m => m.id);

    return this.postes().filter(p => {
      const estInactif = !!p.fin && p.fin.substring(0, 7) < this._moisCourant;
      const estFutur   = !!p.debut && p.debut.substring(0, 7) > this._moisCourant;

      if (this.cacherInactifs() && estInactif) return false;
      if (this.cacherFuturs()   && estFutur)   return false;

      // Filtre catégories
      if (categorieIds.length > 0 && !categorieIds.includes(p.categorieId ?? '')) return false;

      // Filtre comptes : au moins une ventilation rattachée à un compte sélectionné
      if (compteIds.length > 0) {
        const match = (p.ventilations ?? []).some(v => compteIds.includes(v.compteId));
        if (!match) return false;
      }

      // Filtre membres (AND) :
      //   CUSTOM       → tous les membres sélectionnés doivent avoir quotePart > 0
      //   AUTO / REVERSE_AUTO → tous les membres actifs sont implicitement concernés ;
      //                         conserver si chaque membre sélectionné appartient au foyer
      if (membreIds.length > 0) {
        let match: boolean;
        if (p.typeRepartition === 'CUSTOM') {
          match = membreIds.every(id => (p.repartitions ?? []).some(r => r.quotePart > 0 && r.membreId === id));
        } else {
          // AUTO / REVERSE_AUTO : tous les membres du foyer sont concernés
          match = membreIds.every(id => tousMembreIds.includes(id));
        }
        if (!match) return false;
      }

      return true;
    });
  });

  // ── Séparateurs de groupe ─────────────────────────────────
  /** Type discriminant : un élément de la liste est soit un poste, soit un séparateur. */
  isSeparator(item: PosteAffiche | { separator: string }): item is { separator: string } {
    return 'separator' in item;
  }

  /** Cast sûr côté template après discrimination par isSeparator(). */
  asPoste(item: PosteAffiche | { separator: string }): PosteAffiche {
    return item as PosteAffiche;
  }

  /**
   * Liste finale affichée : filtrée, regroupée par chaîne de révisions (bloc contigu
   * trié chronologiquement en interne, positionné selon le tri actuel appliqué au
   * maillon actif) puis enrichie de métadonnées d'affichage (_estChaine, _estActifChaine…).
   */
  postesVisibles = computed<PosteAffiche[]>(() => {
    const filtres = this.postesFiltres();
    const indexComplet = new Map(this.postes().map(p => [p.id, p]));

    const groupes = new Map<string, PosteDto[]>();
    for (const p of filtres) {
      const racine = this.racineChaine(p, indexComplet);
      const liste = groupes.get(racine) ?? [];
      liste.push(p);
      groupes.set(racine, liste);
    }

    const blocs = Array.from(groupes.values()).map(membres => {
      const tries = [...membres].sort((a, b) => (a.debut ?? '').localeCompare(b.debut ?? ''));
      const actif = tries.find(p => !p.posteSuivantId) ?? tries[tries.length - 1];
      return { membres: tries, representant: actif };
    });

    blocs.sort((a, b) => this.comparerPostes(a.representant, b.representant));

    const resultat: PosteAffiche[] = [];
    for (const bloc of blocs) {
      const estChaine = bloc.membres.length > 1;
      const { clef, label } = this.clefSeparateur(bloc.representant);
      bloc.membres.forEach((p, i) => {
        resultat.push({
          ...p,
          _estChaine: estChaine,
          _premierDuBloc: i === 0,
          _estActifChaine: !p.posteSuivantId,
          _nbVersions: (!p.posteSuivantId && estChaine) ? bloc.membres.length : undefined,
          _clefSeparateur: clef,
          _labelSeparateur: label,
        });
      });
    }
    return resultat;
  });

  /** Liste affichée avec séparateurs de groupe insérés (clé/libellé du représentant de chaque bloc). */
  postesAvecSeparateurs = computed<(PosteAffiche | { separator: string })[]>(() => {
    const result: (PosteAffiche | { separator: string })[] = [];
    let lastKey: string | null = null;

    for (const p of this.postesVisibles()) {
      const key = p._clefSeparateur ?? '';
      if (key !== lastKey) {
        result.push({ separator: p._labelSeparateur ?? '' });
        lastKey = key;
      }
      result.push(p);
    }
    return result;
  });


  private readonly _chargerEffect = effect(() => {
    const foyerId = this.contexte.foyerId();
    const scenarioId = this.contexte.scenarioId();
    if (foyerId && scenarioId) {
      this.posteSvc.lister(foyerId, scenarioId).subscribe({
        next: all => this.postes.set(all.filter(p => p.type === this.type())),
        error: () => {},
      });
      this.categorieSvc.lister(foyerId, this.type() as any).subscribe(c => this.categories.set(c));
      this.compteSvc.lister(foyerId).subscribe(c => this.comptes.set(c));
    }
  });

  ngOnInit(): void {}

  charger(): void {
    const foyerId = this.contexte.foyerId();
    const scenarioId = this.contexte.scenarioId();
    if (!foyerId || !scenarioId) return;
    this.chargement.set(true);
    this.posteSvc.lister(foyerId, scenarioId).subscribe({
      next: all => { this.postes.set(all.filter(p => p.type === this.type())); this.chargement.set(false); },
      error: () => this.chargement.set(false),
    });
  }

  categorieLabel(id?: string): string {
    return this.categories().find(c => c.id === id)?.libelle ?? '–';
  }

  natureAffichee(p: PosteDto): string {
    if (p.nature === 'ESTIMATION' && p.estimPourcentage !== null && p.estimPourcentage !== undefined) {
      return `± ${this.formatEstimationPourcentage(p.estimPourcentage)}%`;
    }
    return p.nature === 'ESTIMATION'
      ? this.t.poste.natureOptions.ESTIMATION
      : this.t.poste.natureOptions.EFFECTIF;
  }

  afficheMontantMensualise(p: PosteDto): boolean {
    return p.periodiciteMois !== 0 && p.periodiciteMois !== 1 && p.mode === 'MENSUALISE';
  }

  actionItemsFor(p: PosteDto): MenuItem[] {
    const items: MenuItem[] = [
      { label: this.t.poste.apercu, icon: 'pi pi-eye', command: () => this.ouvrirApercu(p) },
    ];

    if (this.estDansChaine(p)) {
      items.push({ label: this.t.poste.voirHistorique, icon: 'pi pi-history', command: () => this.ouvrirHistorique(p) });
    }

    if (this.contexte.estEditor()) {
      items.push({ label: this.t.commun.modifier, icon: 'pi pi-pencil', command: () => this.ouvrirEdition(p) });
      if (this.estRevisable(p)) {
        items.push({ label: this.t.poste.reviserMontant, icon: 'pi pi-sync', command: () => this.ouvrirRevision(p) });
      }
      if (this.estFusionnable(p)) {
        items.push({ label: this.t.poste.annulerRevision, icon: 'pi pi-replay', command: () => this.annulerRevision(p) });
      }
      if (this.estDecalable(p)) {
        items.push({ label: this.t.poste.decalerDateEffet, icon: 'pi pi-arrows-h', command: () => this.ouvrirDecalage(p) });
      }
      if (this.estActionClotureApplicable(p)) {
        if (this.estPosteTermine(p)) {
          items.push({ label: this.t.poste.reactiver, icon: 'pi pi-play', command: () => this.reactiverPoste(p) });
        } else {
          items.push({ label: this.t.poste.terminer, icon: 'pi pi-stop-circle', command: () => this.ouvrirCloture(p) });
        }
      }
      items.push({ label: this.t.commun.supprimer, icon: 'pi pi-trash', command: () => this.supprimer(p) });
    }

    return items;
  }

  /** Un poste appartient à une chaîne de révisions s'il a un prédécesseur ou un successeur. */
  estDansChaine(p: PosteDto): boolean {
    return !!p.posteOrigineId || !!p.posteSuivantId;
  }

  /** Un poste est révisable s'il est récurrent (périodicité != 0) et pas déjà terminé dans le passé. */
  estRevisable(p: PosteDto): boolean {
    return p.periodiciteMois !== 0 && !(p.fin != null && p.fin < this._aujourdHuiIso);
  }

  /** Un poste est fusionnable (annulation de révision) s'il est le dernier maillon d'une chaîne. */
  estFusionnable(p: PosteDto): boolean {
    return !!p.posteOrigineId && !p.posteSuivantId;
  }

  /**
   * Un poste est décalable (frontière avec son prédécesseur) s'il a lui-même un
   * prédécesseur — y compris un maillon intermédiaire, contrairement à la fusion qui
   * est réservée au dernier maillon.
   */
  estDecalable(p: PosteDto): boolean {
    return !!p.posteOrigineId;
  }

  /**
   * Les actions rapides « Terminer »/« Réactiver » ne s'appliquent qu'à un poste isolé ou
   * au dernier maillon actif d'une chaîne de révisions (pas encore remplacé) : un maillon
   * intermédiaire ou d'origine a des dates déjà figées par sa position dans la chaîne.
   */
  estActionClotureApplicable(p: PosteDto): boolean {
    return !p.posteSuivantId;
  }

  /** Vrai si le poste est actuellement terminé (date de fin déjà passée). */
  estPosteTermine(p: PosteDto): boolean {
    return !!p.fin && p.fin < this._aujourdHuiIso;
  }

  repartitionsAffichees(p: PosteDto): { membreId: string; quotePart: number; nomMembre: string; couleur: string; couleurTexte: string }[] {
    return p.repartitions
      .filter(r => r.quotePart > 0)
      .map(r => {
        const membre = this.membres().find(m => m.id === r.membreId);
        const couleur = this.normaliserCouleur(membre?.couleur);
        return {
          membreId: r.membreId,
          quotePart: r.quotePart,
          nomMembre: membre?.nom ?? '',
          couleur,
          couleurTexte: this.couleurTexteContraste(couleur),
        };
      })
      .filter(r => r.nomMembre);
  }

  /**
   * Tags membres à afficher dans la liste des postes.
   * AUTO / REVERSE_AUTO → "Nom · Compte" (tous les membres actifs).
   * CUSTOM              → "Nom · XX% · Compte" (uniquement les membres avec quotePart > 0).
   * Mono-membre         → aucun tag (inutile d'afficher l'unique membre).
   * Si aucune ventilation pour le membre, le compte est omis du label.
   */
  membresAffichesPoste(p: PosteDto): { membreId: string; label: string; couleur: string; couleurTexte: string }[] {
    const membres = this.membres();
    // Mono-membre : inutile d'afficher un tag
    if (membres.length <= 1) return [];

    /** Helper : libellé du compte ventilé pour un membre donné (ou '' si absent). */
    const compteLabel = (membreId: string): string => {
      const ventilation = p.ventilations?.find(v => v.membreId === membreId);
      if (!ventilation) return '';
      return this.libelleCompteVentilationPourMembre(ventilation, membreId);
    };

    if (p.typeRepartition === 'CUSTOM') {
      // Parts explicites stockées → afficher avec pourcentage + compte
      return this.repartitionsAffichees(p).map(r => {
        const compte = compteLabel(r.membreId);
        const label = compte
          ? `${r.nomMembre} · ${Math.round(r.quotePart * 100)}% · ${compte}`
          : `${r.nomMembre} · ${Math.round(r.quotePart * 100)}%`;
        return { membreId: r.membreId, label, couleur: r.couleur, couleurTexte: r.couleurTexte };
      });
    }

    // AUTO ou REVERSE_AUTO (ou null = AUTO) → tous les membres actifs, nom + compte
    return membres.map(m => {
      const couleur = this.normaliserCouleur(m.couleur);
      const couleurTexte = this.couleurTexteContraste(couleur);
      const compte = compteLabel(m.id);
      const label = compte ? `${m.nom} · ${compte}` : m.nom;
      return { membreId: m.id, label, couleur, couleurTexte };
    });
  }

  /** Membres rattachés à un compte (pour l'affichage dans le filtre). */
  membresForCompte(compte: CompteDto): MembreDto[] {
    return this.membres().filter(m => compte.membreIds?.includes(m.id));
  }


  private libelleCompteVentilationPourMembre(ventilation: VentilationCompteDto, membreId: string): string {
    const compte = this.comptes().find(c => c.id === ventilation.compteId);
    const libelle = ventilation.libelleCompte || compte?.libelle || '';
    if (!compte || compte.membreIds?.includes(membreId)) return libelle;
    const nomsMembres = this.nomsMembresDuCompte(compte.membreIds ?? []);
    return nomsMembres ? `${libelle} ${this.t.commun.de} ${nomsMembres}` : libelle;
  }

  private nomsMembresDuCompte(membreIds: string[]): string {
    if (!membreIds.length) return '';
    const mapMembres = new Map(this.membres().map(m => [m.id, m.nom]));
    return membreIds
      .map(id => mapMembres.get(id))
      .filter((nom): nom is string => !!nom)
      .join(', ');
  }

  normaliserCouleur(couleur?: string): string {
    if (!couleur) return '#64748b';
    return couleur.startsWith('#') ? couleur : `#${couleur}`;
  }

  // Lisibilité minimale des tags, quelle que soit la couleur du membre.
  couleurTexteContraste(hexColor: string): string {
    const hex = hexColor.replace('#', '');
    if (hex.length !== 6 || /[^0-9a-f]/i.test(hex)) return '#ffffff';
    const r = parseInt(hex.substring(0, 2), 16);
    const g = parseInt(hex.substring(2, 4), 16);
    const b = parseInt(hex.substring(4, 6), 16);
    const luminance = (0.299 * r) + (0.587 * g) + (0.114 * b);
    return luminance > 170 ? '#111827' : '#ffffff';
  }

  ouvrirCreation(): void {
    this.posteEnEdition = null;
    this.form.reset({ mode: 'MENSUALISE', moment: 'DEBUT_PERIODE', nature: 'EFFECTIF',
                      periodiciteMois: 0, typeRepartition: 'AUTO', estimPourcentage: null });
    this.initialiserRepartitions(undefined);
    this.frequenceChoisie.set(null);
    this.sousFrequence.set(null);
    this.quiConcerneChoice.set(null);
    this.quiRepartition.set(null);
    this.membreUniqueId.set(null);
    this._focusDescriptionFait = false;
    this.dialogVisible = true;
  }

  ouvrirEdition(p: PosteDto): void {
    this.posteEnEdition = p;
    this.form.patchValue({
      description: p.description, categorieId: p.categorieId,
      montant: p.montant, periodiciteMois: p.periodiciteMois ?? 0,
      mode: p.mode, moment: p.moment, nature: p.nature ?? 'EFFECTIF',
      estimPourcentage: p.estimPourcentage ?? null,
      typeRepartition: p.typeRepartition ?? 'AUTO',
      debut: p.debut ? parseIsoDateLocal(p.debut) : null,
      fin: p.fin ? parseIsoDateLocal(p.fin) : null,
    });
    // Initialiser les parts seulement pour CUSTOM
    if (p.typeRepartition === 'CUSTOM') {
      this.initialiserRepartitions(p.repartitions, p.ventilations);
    } else {
      this.initialiserRepartitions(undefined, p.ventilations);
    }

    // Déduction des réponses du mini-questionnaire à partir du poste existant, sans
    // rien changer aux valeurs réelles du formulaire.
    const periodicite = p.periodiciteMois ?? 0;
    this.frequenceChoisie.set(periodicite === 0 ? 'PONCTUEL' : 'RECURRENT');
    this.sousFrequence.set(
      periodicite === 0 ? null :
      periodicite === 1 ? 'MENSUEL' : 'AUTRE'
    );
    this.membreUniqueId.set(null);
    if (p.typeRepartition === 'CUSTOM') {
      const nonZero = this.repartitionsArray.controls.filter(c => (c.get('quotePart')?.value ?? 0) > 0);
      if (nonZero.length === 1) {
        this.quiConcerneChoice.set('MEMBRE_UNIQUE');
        this.quiRepartition.set(null);
        this.membreUniqueId.set(nonZero[0].get('membreId')?.value ?? null);
      } else {
        this.quiConcerneChoice.set('TOUS');
        this.quiRepartition.set('CUSTOM');
      }
    } else {
      const tr = (p.typeRepartition ?? 'AUTO') as TypeRepartition;
      this.quiConcerneChoice.set('TOUS');
      this.quiRepartition.set(tr);
      this.appliquerRepartitionAffichageScenario(tr === 'REVERSE_AUTO');
    }
    this._focusDescriptionFait = true; // pas d'autofocus surprise en édition, le formulaire est déjà rempli
    this.dialogVisible = true;
  }

  ouvrirApercu(p: PosteDto): void {
    const foyerId = this.contexte.foyerId()!;
    const scenarioId = this.contexte.scenarioId()!;
    const sc = this.contexte.scenarioCourant();
    this.posteSvc.apercu(foyerId, scenarioId, p.id, sc?.anneeDepart ?? new Date().getFullYear())
      .subscribe(a => { this.apercuData.set(a); this.apercuVisible = true; });
  }

  private defaultCompteId(): string | null {
    const comptes = this.comptes();
    return comptes[0]?.id ?? null;
  }

  /** Comptes accessibles pour un membre donné (filtre sur membreIds). */
  comptesForMembre(membreId: string | undefined): CompteDto[] {
    if (!membreId) return this.comptes();
    return this.comptes().filter(c => c.membreIds?.includes(membreId));
  }

  /** Compte par défaut pour un membre : premier compte qui lui est rattaché. */
  private defaultCompteIdForMembre(membreId: string | undefined): string | null {
    if (!membreId) return this.defaultCompteId();
    const rattaches = this.comptesForMembre(membreId);
    return rattaches[0]?.id ?? this.defaultCompteId();
  }

  private initialiserRepartitions(
    existantes?: { membreId: string; quotePart: number; nomMembre: string }[],
    ventilationsExistantes?: VentilationCompteDto[],
  ): void {
    const membres = this.membres();

    // Supprimer les contrôles en surplus (ex : changement de foyer)
    while (this.repartitionsArray.length > membres.length) {
      this.repartitionsArray.removeAt(this.repartitionsArray.length - 1);
    }

    membres.forEach((m, i) => {
      const rep       = existantes?.find(r => r.membreId === m.id);
      const vent      = ventilationsExistantes?.find(v => v.membreId === m.id);
      const quotePart = rep ? Math.round(rep.quotePart * 100) : 0;
      const compteId  = vent?.compteId ?? this.defaultCompteIdForMembre(m.id);

      if (i < this.repartitionsArray.length) {
        // Mettre à jour en place : le même FormGroup est conservé,
        // les directives Angular gardent leurs liaisons → les valeurs s'affichent bien.
        this.repartitionsArray.at(i).patchValue({ membreId: m.id, quotePart, compteId });
      } else {
        this.repartitionsArray.push(this.fb.group({
          membreId:  [m.id],
          quotePart: [quotePart],
          compteId:  [compteId],
        }));
      }
    });

    this.calculerSomme();
  }


  fermerDialogPoste(): void {
    this.dialogVisible = false;
    this.posteEnEdition = null;
  }

  calculerSomme(): void {
    this.sommeRepartition = this.repartitionsArray.controls
      .reduce((s, c) => s + (c.get('quotePart')?.value ?? 0), 0);
  }

  /**
   * Appelé à chaque modification de quotePart dans le bloc CUSTOM.
   * Si le membre passe à 0%, on vide automatiquement son compte sélectionné.
   */
  onQuotePartChange(index: number): void {
    const ctrl = this.repartitionsArray.at(index);
    if ((ctrl.get('quotePart')?.value ?? 0) === 0) {
      ctrl.get('compteId')?.setValue(null, { emitEvent: false });
    }
    this.calculerSomme();
  }

  enregistrer(): void {
    const foyerId = this.contexte.foyerId()!;
    const scenarioId = this.contexte.scenarioId()!;
    const v = this.form.value;
    const periodicite = v.periodiciteMois ?? 0;
    const estOneShot = periodicite === 0;

    if (estOneShot && !v.debut) {
      this.toast.add({
        severity: 'warn',
        summary: this.t.commun.erreur,
        detail: this.i18n.instant('poste.debutRequisPourOneShot', { champ: this.t.poste.debut, type: this.t.poste.oneShot }),
      });
      return;
    }

    const typeRepartition = (v.typeRepartition ?? 'AUTO') as TypeRepartition;
    const isCustom = typeRepartition === 'CUSTOM';

    // Parts uniquement pour CUSTOM
    const repartitions = isCustom && this.repartitionsArray.length
      ? this.repartitionsArray.controls.map(c => ({
          membreId: c.get('membreId')!.value,
          quotePart: (c.get('quotePart')!.value ?? 0) / 100,
        })).filter(r => r.quotePart > 0)
      : undefined;

    // Validation somme seulement pour CUSTOM multi-membres
    if (isCustom && this.membres().length > 1 && this.sommeRepartition !== 100) {
      this.toast.add({ severity: 'warn', summary: this.t.commun.erreur, detail: this.t.commun.repartitionInvalide });
      return;
    }

    const ventilations = this.repartitionsArray.length
      ? this.repartitionsArray.controls
          .filter(c => c.get('compteId')?.value)
          .map(c => ({ membreId: c.get('membreId')!.value, compteId: c.get('compteId')!.value }))
      : undefined;

    const req = {
      type:            this.type(),
      description:     v.description!,
      categorieId:     v.categorieId ?? undefined,
      montant:         v.montant!,
      periodiciteMois: periodicite,
      mode:            (estOneShot ? 'MENSUALISE' : v.mode) as any,
      moment:          (estOneShot ? 'DEBUT_PERIODE' : v.moment) as any,
      nature:          (v.nature ?? 'EFFECTIF') as any,
      estimPourcentage: v.nature === 'ESTIMATION' ? v.estimPourcentage ?? undefined : undefined,
      typeRepartition: typeRepartition,
      debut:           v.debut ? this.toIso(v.debut) : undefined,
      fin:             estOneShot ? undefined : (v.fin ? this.toIso(v.fin) : undefined),
      ordre: 0,
      repartitions,
      ventilations,
    };

    const obs = this.posteEnEdition
      ? this.posteSvc.modifier(foyerId, scenarioId, this.posteEnEdition.id, req)
      : this.posteSvc.creer(foyerId, scenarioId, req);

    obs.subscribe({
      next: () => {
        this.toast.add({ severity: 'success', summary: this.t.commun.succes });
        this.dialogVisible = false;
        this.charger();
      },
      error: (err) => this.toast.add({ severity: 'error', summary: this.t.commun.erreur, detail: err?.error?.message }),
    });
  }

  supprimer(p: PosteDto): void {
    this.confirm.confirm({
      message: this.t.commun.confirmerSuppression,
      accept: () => {
        const foyerId = this.contexte.foyerId()!;
        const scenarioId = this.contexte.scenarioId()!;
        this.posteSvc.supprimer(foyerId, scenarioId, p.id).subscribe({
          next: () => { this.toast.add({ severity: 'success', summary: this.t.commun.succes }); this.charger(); },
          error: () => this.toast.add({ severity: 'error', summary: this.t.commun.erreur }),
        });
      },
    });
  }

  private toIso(d: Date): string { return toIsoDateLocal(d); }

  /** Formater un pourcentage avec 1 décimale */
  formatEstimationPourcentage(pct: number): string {
    return new Intl.NumberFormat('fr-CH', { minimumFractionDigits: 1, maximumFractionDigits: 1 }).format(pct);
  }

  typeAccentClass = computed(() => {
    switch (this.type()) {
      case 'REVENU':  return 'bg-green-500';
      case 'CHARGE':  return 'bg-red-400';
      default:        return 'bg-indigo-400';
    }
  });

  formatPeriode(v?: string | null): string {
    if (!v) return '–';
    try {
      const [year, month] = v.split('-');
      const d = new Date(+year, +month - 1, 1);
      return new Intl.DateTimeFormat('fr-CH', { month: 'short', year: 'numeric' }).format(d);
    } catch { return v; }
  }

  formaterMontant(montant: number, devise?: string): string {
    return new Intl.NumberFormat('fr-CH', { minimumFractionDigits: 0, maximumFractionDigits: 2 }).format(montant)
      + (devise ? ` ${devise}` : '');
  }

  private formaterDateComplete(iso: string): string {
    const [year, month, day] = iso.split('-');
    const d = new Date(+year, +month - 1, +day);
    return new Intl.DateTimeFormat('fr-CH', { day: '2-digit', month: '2-digit', year: 'numeric' }).format(d);
  }

  /** 1er jour du mois qui suit le mois courant. */
  private premierJourMoisProchain(): Date {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth() + 1, 1);
  }

  /** Dernier jour du mois contenant la date donnée. */
  private finDeMois(d: Date): Date {
    return new Date(d.getFullYear(), d.getMonth() + 1, 0);
  }

  /**
   * Reproduit l'ancre de périodicité du moteur (doc 01 §3.4) : trouve, en index de mois
   * global (année*12+mois), le premier mois strictement après le mois courant qui tombe
   * sur le cycle du poste (ancré sur son mois de début), c-à-d le prochain mois où le
   * poste aurait normalement généré une contribution.
   */
  private prochainMoisPeriodique(p: PosteDto): Date {
    const d = p.periodiciteMois;
    const now = new Date();
    const debut = p.debut ? parseIsoDateLocal(p.debut) : now;
    const ancreGlobal = debut.getFullYear() * 12 + debut.getMonth();
    let candidat = now.getFullYear() * 12 + now.getMonth() + 1;
    while (((candidat - ancreGlobal) % d + d) % d !== 0) {
      candidat++;
    }
    return new Date(Math.floor(candidat / 12), (candidat % 12) -1, 1);
  }

  ouvrirCloture(p: PosteDto): void {
    this.posteEnCloture.set(p);
    this.clotureForm.reset({ option: 'MOIS_COURANT', datePersonnalisee: new Date() });
    this.clotureDialogVisible = true;
  }

  fermerDialogCloture(): void {
    this.clotureDialogVisible = false;
    this.posteEnCloture.set(null);
  }

  enregistrerCloture(): void {
    const p = this.posteEnCloture();
    const fin = this.finCloture();
    if (!p || !fin || !this.clotureValide()) return;

    const foyerId = this.contexte.foyerId()!;
    const scenarioId = this.contexte.scenarioId()!;
    this.posteSvc.cloturer(foyerId, scenarioId, p.id, { fin: this.toIso(fin) }).subscribe({
      next: () => {
        this.toast.add({ severity: 'success', summary: this.t.commun.succes });
        this.clotureDialogVisible = false;
        this.posteEnCloture.set(null);
        this.charger();
      },
      error: (err) => this.toast.add({ severity: 'error', summary: this.t.commun.erreur, detail: err?.error?.message }),
    });
  }

  /** Réactive un poste terminé : retire sa fin directement, sans popin. */
  reactiverPoste(p: PosteDto): void {
    const foyerId = this.contexte.foyerId()!;
    const scenarioId = this.contexte.scenarioId()!;
    this.posteSvc.reactiver(foyerId, scenarioId, p.id).subscribe({
      next: () => {
        this.toast.add({
          severity: 'success', summary: this.t.commun.succes,
          detail: this.i18n.instant('poste.reactiverConfirmation', { description: p.description }),
        });
        this.charger();
      },
      error: (err) => this.toast.add({ severity: 'error', summary: this.t.commun.erreur, detail: err?.error?.message }),
    });
  }

  ouvrirRevision(p: PosteDto): void {
    this.posteEnRevision = p;
    this.revisionForm.reset({
      nouveauMontant: p.montant,
      dateEffet: this.premierJourMoisProchain(),
    });
    this.revisionDialogVisible = true;
  }

  fermerDialogRevision(): void {
    this.revisionDialogVisible = false;
    this.posteEnRevision = null;
  }

  enregistrerRevision(): void {
    const p = this.posteEnRevision;
    if (!p || !this.revisionValide()) return;

    const foyerId = this.contexte.foyerId()!;
    const scenarioId = this.contexte.scenarioId()!;
    const v = this.revisionForm.value;
    const req = {
      nouveauMontant: v.nouveauMontant!,
      dateEffet: this.toIso(v.dateEffet!),
    };

    this.posteSvc.reviser(foyerId, scenarioId, p.id, req).subscribe({
      next: () => {
        this.toast.add({ severity: 'success', summary: this.t.commun.succes });
        this.revisionDialogVisible = false;
        this.posteEnRevision = null;
        this.charger();
      },
      error: (err) => this.toast.add({ severity: 'error', summary: this.t.commun.erreur, detail: err?.error?.message }),
    });
  }

  ouvrirDecalage(p: PosteDto): void {
    this.posteEnDecalage = p;
    this.decalerForm.reset({
      nouvelleDateEffet: p.debut ? parseIsoDateLocal(p.debut) : null,
    });
    this.decalerDialogVisible = true;
  }

  fermerDialogDecalage(): void {
    this.decalerDialogVisible = false;
    this.posteEnDecalage = null;
  }

  /**
   * Enregistre le décalage de la date d'effet. En cas d'échec côté serveur (situation de
   * concurrence non anticipée côté front), le dialog reste ouvert avec un message d'erreur.
   */
  enregistrerDecalage(): void {
    const p = this.posteEnDecalage;
    if (!p || !this.decalageValide()) return;

    const foyerId = this.contexte.foyerId()!;
    const scenarioId = this.contexte.scenarioId()!;
    const v = this.decalerForm.value;
    const req = { nouvelleDateEffet: this.toIso(v.nouvelleDateEffet!) };

    this.posteSvc.decalerDateEffet(foyerId, scenarioId, p.id, req).subscribe({
      next: () => {
        this.toast.add({ severity: 'success', summary: this.t.commun.succes });
        this.decalerDialogVisible = false;
        this.posteEnDecalage = null;
        this.charger();
      },
      error: (err) => this.toast.add({ severity: 'error', summary: this.t.commun.erreur, detail: err?.error?.message }),
    });
  }

  /**
   * Ouvre le drawer d'historique de la chaîne de révisions à laquelle appartient p.
   * Reconstruit la chaîne complète (racine → maillon actif) depuis la liste déjà
   * chargée en mémoire (this.postes()) : aucun appel réseau dédié n'est nécessaire.
   */
  ouvrirHistorique(p: PosteDto): void {
    const index = new Map(this.postes().map(x => [x.id, x]));
    const racineId = this.racineChaine(p, index);
    const membres = this.postes()
      .filter(x => this.racineChaine(x, index) === racineId)
      .sort((a, b) => (a.debut ?? '').localeCompare(b.debut ?? ''));

    if (membres.length === 0) return;

    const maillons = membres.map((m, i) => {
      if (i === 0) return { poste: m, ecartMontant: null, ecartPourcentage: null };
      const precedent = membres[i - 1];
      const ecartMontant = m.montant - precedent.montant;
      const ecartPourcentage = precedent.montant !== 0 ? (ecartMontant / precedent.montant) * 100 : null;
      return { poste: m, ecartMontant, ecartPourcentage };
    });

    const premier = membres[0];
    const dernier = membres[membres.length - 1];
    const evolutionGlobale = membres.length > 1 && premier.montant !== 0
      ? ((dernier.montant - premier.montant) / premier.montant) * 100
      : null;

    this.historiquePosteDescription.set(p.description);
    this.historiqueMaillons.set(maillons);
    this.historiqueEvolutionGlobale.set(
      evolutionGlobale !== null ? { signe: evolutionGlobale >= 0 ? '+' : '', pct: evolutionGlobale.toFixed(1) } : null
    );
    this.historiqueDrawerVisible.set(true);
  }

  /**
   * Navigation depuis un maillon du drawer vers sa carte dans la liste : ferme le
   * drawer, fait défiler jusqu'à la carte concernée et la met brièvement en surbrillance.
   */
  navigerVersPoste(posteId: string): void {
    this.historiqueDrawerVisible.set(false);
    setTimeout(() => {
      this.posteEnSurbrillanceId.set(posteId);
      document.getElementById('poste-' + posteId)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      setTimeout(() => this.posteEnSurbrillanceId.set(null), 2000);
    }, 200);
  }

  /**
   * Annule la révision d'un poste : fusionne le maillon actif avec son prédécesseur.
   * Affiche une confirmation concrète (montant et fin restaurés) avant d'exécuter
   * l'opération atomique côté serveur.
   */
  annulerRevision(p: PosteDto): void {
    const precedent = this.postes().find(x => x.id === p.posteOrigineId);
    if (!precedent) return;

    const montantActuel = this.formaterMontant(p.montant, p.devise);
    const montantPrecedent = this.formaterMontant(precedent.montant, precedent.devise);
    const message = precedent.fin
      ? this.i18n.instant('poste.annulerRevisionConfirmationAvecFin', {
          montant: montantActuel,
          description: precedent.description,
          montantPrecedent,
          finPrecedente: this.formaterDateComplete(precedent.fin),
        })
      : this.i18n.instant('poste.annulerRevisionConfirmationSansFin', {
          montant: montantActuel,
          description: precedent.description,
          montantPrecedent,
        });

    this.confirm.confirm({
      message,
      header: this.i18n.instant('poste.annulerRevisionTitre', { description: precedent.description }),
      accept: () => {
        const foyerId = this.contexte.foyerId()!;
        const scenarioId = this.contexte.scenarioId()!;
        this.posteSvc.annulerRevision(foyerId, scenarioId, p.id).subscribe({
          next: () => { this.toast.add({ severity: 'success', summary: this.t.commun.succes }); this.charger(); },
          error: (err) => this.toast.add({ severity: 'error', summary: this.t.commun.erreur, detail: err?.error?.message }),
        });
      },
    });
  }
}

