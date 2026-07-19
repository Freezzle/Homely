import { Component, inject, signal, computed, OnInit, input, effect } from '@angular/core';
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
import { CheckboxModule } from 'primeng/checkbox';
import { MenuModule } from 'primeng/menu';
import { MessageService, ConfirmationService, MenuItem } from 'primeng/api';
import { ContexteService } from '../../../core/services/contexte.service';
import { PosteService } from '../../../core/services/scenario-poste.service';
import { CategorieService, CompteService } from '../../../core/services/referentiel.service';
import { PosteDto, CategorieDto, CompteDto, MembreDto, VentilationCompteDto, TypePoste, TypeRepartition } from '../../../core/models/api.models';
import { MontantPipe, PeriodicitePipe } from '../../../core/pipes/format.pipes';
import { FR } from '../../../core/i18n/fr';

@Component({
  selector: 'app-postes-liste',
  standalone: true,
  providers: [ConfirmationService],
  imports: [CommonModule, FormsModule, ReactiveFormsModule, TableModule, ButtonModule, DialogModule,
    InputTextModule, InputNumberModule, SelectModule, MultiSelectModule, DatePickerModule,
    TagModule, TooltipModule, CardModule, MessageModule, ConfirmDialogModule, SkeletonModule, CheckboxModule,
    MenuModule,
    MontantPipe, PeriodicitePipe],
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
                                    styleClass="shrink-0"/>
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
                                styleClass="min-w-52 text-sm"/>
                  </div>

                  <div class="flex justify-end">
                      <p-button icon="pi pi-sliders-h"
                                [ariaLabel]="t.commun.actions"
                                severity="secondary"
                                [text]="true"
                                (click)="menuVisibilite.toggle($event)"/>
                      <p-menu #menuVisibilite [popup]="true" [model]="visibiliteMenuItems" appendTo="body"
                              styleClass="w-72">
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
                                 styleClass="w-full text-sm"/>

                  <!-- Filtre comptes -->
                  <p-multiselect appendTo="body"
                                 [ngModel]="filtreCompteIds()"
                                 (ngModelChange)="filtreCompteIds.set($event)"
                                 [options]="comptes()"
                                 optionLabel="libelle" optionValue="id"
                                 [placeholder]="t.poste.filtreComptes"
                                 [showClear]="true"
                                 styleClass="w-full text-sm">
                      <ng-template #item let-compte>
                          <div class="flex items-center gap-2 flex-wrap">
                              <span>{{ compte.libelle }}</span>
                              @for (m of membresForCompte(compte); track m.id) {
                                  <span class="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium leading-none"
                                        [style.background-color]="normaliserCouleur(m.couleur)"
                                        [style.color]="couleurTexteContraste(normaliserCouleur(m.couleur))">
                    {{ m.nom }}
                  </span>
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
                                 styleClass="w-full text-sm"/>
              </div>
          </div>

          <!-- ── État chargement (skeletons) ──────────────────────── -->
          @if (chargement()) {
              <div class="flex flex-col gap-2">
                  @for (_ of [1, 2, 3]; track $index) {
                      <div class="flex items-center gap-3 px-4 py-3 rounded-xl border border-surface-200
                        dark:border-surface-700 bg-white dark:bg-surface-900">
                          <p-skeleton width="3px" height="48px" styleClass="rounded-full shrink-0"/>
                          <div class="flex-1 flex flex-col gap-2">
                              <p-skeleton width="35%" height="1rem"/>
                              <p-skeleton width="55%" height="0.75rem"/>
                          </div>
                          <p-skeleton width="90px" height="1.25rem" styleClass="shrink-0"/>
                          <p-skeleton width="72px" height="2rem" styleClass="shrink-0 rounded-lg"/>
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
                          <div class="grid grid-cols-[minmax(0,1fr)_auto] gap-3 px-4 py-3
                          border border-surface-200 dark:border-surface-700
                          bg-white dark:bg-surface-900
                          hover:border-primary/40 hover:shadow-sm
                          transition-all duration-150">

                              <!-- Colonne 1 : contenu -->
                              <div class="min-w-0 flex flex-col gap-2">
                                  <div class="grid gap-2 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-start">
                                      <div class="min-w-0 flex items-start gap-2 flex-wrap">
                      <span class="font-medium text-surface-900 dark:text-surface-100 leading-snug wrap-break-word">
                        {{ p.description }}
                      </span>
                                          @if (categorieLabel(p.categorieId) !== '–' && triActuel() !== 'CATEGORIE') {
                                              <p-tag [value]="categorieLabel(p.categorieId)"
                                                     severity="secondary"
                                                     styleClass="text-[10px] py-0.5 shrink-0"/>
                                          }
                                      </div>

                                      <div class="min-w-0 flex flex-wrap items-center justify-start gap-2 text-left sm:justify-end sm:text-right">
                                          @if (p.nature === 'ESTIMATION') {
                                              <p-tag [value]="natureAffichee(p)"
                                                     [severity]="'warn'"
                                                     styleClass="text-[10px] py-0.5 shrink-0"/>
                                          }
                                          <span class="font-semibold text-surface-700 dark:text-surface-200 whitespace-nowrap">
                        {{ p.montant | montant:p.devise }}
                      </span>
                                      </div>
                                  </div>

                                  <div class="grid gap-2 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-start">
                                      <div class="min-w-0 flex items-center flex-wrap gap-x-2 gap-y-1 text-sm text-surface-500 dark:text-surface-400">
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
                          <span class="truncate">{{ formatPeriode(p.debut) }}&nbsp;–&nbsp;{{ formatPeriode(p.fin) }}</span>
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
                                                             styleClass="text-xs py-1 px-2 border-none max-w-full"/>
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
                [modal]="true" styleClass="w-full max-w-2xl">
          <form [formGroup]="form" class="flex flex-col gap-4 pt-2">

              <!-- Ligne 1 : Description pleine largeur -->
              <div class="flex flex-col gap-1">
                  <label class="text-sm font-medium">{{ t.poste.description }} *</label>
                  <input pInputText formControlName="description" class="w-full"/>
              </div>

              <!-- Ligne 2 : Catégorie + Montant -->
              <div class="grid grid-cols-2 gap-4">
                  <div class="flex flex-col gap-1">
                      <label class="text-sm font-medium">{{ t.poste.categorie }}</label>
                      <p-select appendTo="body" formControlName="categorieId" [options]="categories()"
                                optionLabel="libelle" optionValue="id" [showClear]="true" styleClass="w-full"/>
                  </div>
                  <div class="flex flex-col gap-1">
                      <label class="text-sm font-medium">{{ t.poste.montant }} *</label>
                      <p-inputnumber formControlName="montant" mode="decimal" [minFractionDigits]="2" class="w-full"/>
                  </div>
              </div>

              <!-- Ligne 3 : Périodicité | Mode | Moment
                   D=0 → one-shot, pas de mode/moment (uniquement début)
                   D=1 → 1 col (mode et moment cachés)
                   D>1 → 3 col (Mode toujours visible ; Moment toujours visible) -->
              <div class="grid gap-4"
                   [class.grid-cols-1]="(form.value.periodiciteMois ?? 1) === 0 || (form.value.periodiciteMois ?? 1) === 1"
                   [class.grid-cols-3]="(form.value.periodiciteMois ?? 1) > 1">
                  <!-- Périodicité -->
                  <div class="flex flex-col gap-1">
                      <label class="text-sm font-medium">{{ t.poste.periodicite }}</label>
                      <p-select appendTo="body" formControlName="periodiciteMois"
                                [options]="periodiciteOptions" optionLabel="label" optionValue="value"
                                styleClass="w-full"/>
                  </div>
                  <!-- Moment : visible dès que D>1, quel que soit le mode -->
                  @if ((form.value.periodiciteMois ?? 1) > 1) {
                      <div class="flex flex-col gap-1">
                          <label class="text-sm font-medium"
                                 [pTooltip]="t.poste.momentTooltip">{{ t.poste.moment }}</label>
                          <p-select appendTo="body" formControlName="moment" [options]="momentOptions"
                                    optionLabel="label" optionValue="value" styleClass="w-full"/>
                      </div>
                  }
                  <!-- Mode : caché si D=0 ou D=1 (toujours mensualisé) -->
                  @if ((form.value.periodiciteMois ?? 1) > 1) {
                      <div class="flex flex-col gap-1">
                          <label class="text-sm font-medium" [pTooltip]="t.poste.modeTooltip">{{ t.poste.mode }}</label>
                          <p-select appendTo="body" formControlName="mode" [options]="modeOptions"
                                    optionLabel="label" optionValue="value" styleClass="w-full"/>
                      </div>
                  }
              </div>

              <!-- Ligne 4 : Début + Fin (ou seulement Début si one-shot) -->
              @if ((form.value.periodiciteMois ?? 1) === 0) {
                  <!-- One-shot : uniquement Début (obligatoire) -->
                  <div class="flex flex-col gap-1">
                      <label class="text-sm font-medium">{{ t.poste.debut }} *</label>
                      <p-datepicker appendTo="body" formControlName="debut" dateFormat="dd/mm/yy"
                                    [showButtonBar]="true" styleClass="w-full"></p-datepicker>
                  </div>
              } @else {
                  <!-- Normal : Début + Fin (optionnels) -->
                  <div class="grid grid-cols-2 gap-4">
                      <div class="flex flex-col gap-1">
                          <label class="text-sm font-medium">{{ t.poste.debut }}</label>
                          <p-datepicker appendTo="body" formControlName="debut" dateFormat="dd/mm/yy"
                                        [showButtonBar]="true" styleClass="w-full"></p-datepicker>
                      </div>
                      <div class="flex flex-col gap-1">
                          <label class="text-sm font-medium">{{ t.poste.fin }}</label>
                          <p-datepicker appendTo="body" formControlName="fin" dateFormat="dd/mm/yy"
                                        [showButtonBar]="true" styleClass="w-full"></p-datepicker>
                      </div>
                  </div>
              }


              <!-- Ligne 5 : Nature (pleine largeur) -->
              <div class="grid grid-cols-{{ form.value.nature === 'ESTIMATION' ? '2' : '1' }} gap-4">
                  <div class="flex flex-col gap-1">
                      <label class="text-sm font-medium" [pTooltip]="t.poste.natureTooltip">{{ t.poste.nature }}</label>
                      <p-select appendTo="body" formControlName="nature" [options]="natureOptions"
                                optionLabel="label" optionValue="value" styleClass="w-full"/>
                  </div>
                  <!-- Ligne 5b : Pourcentage d'estimation (visible si nature=ESTIMATION) -->
                  @if (form.value.nature === 'ESTIMATION') {
                      <div class="flex flex-col gap-1">
                          <label class="text-sm font-medium" [pTooltip]="t.poste.estimationTooltip">
                              {{ t.poste.estimationPourcentage }} *
                          </label>
                          <p-inputnumber formControlName="estimPourcentage"
                                         [min]="0" [max]="100"
                                         [minFractionDigits]="1" [maxFractionDigits]="1"
                                         suffix="%" styleClass="w-full"
                                         placeholder="Ex: 10.0"/>
                      </div>
                  }
              </div>


              <!-- Ligne 6 : Mode répartition (masqué si mono-membre) -->
              @if (membres().length > 1) {
                  <div class="flex flex-col gap-1">
                      <label class="text-sm font-medium" [pTooltip]="t.poste.typeRepartitionTooltip">
                          {{ t.poste.typeRepartition }}
                      </label>
                      <p-select appendTo="body" formControlName="typeRepartition"
                                [options]="typeRepartitionOptions"
                                optionLabel="label" optionValue="value" styleClass="w-full"/>
                  </div>
              }

              <!-- Répartition + Comptes (uniquement pour CUSTOM multi-membres) -->
              @if (estCustomMultiMembre()) {
                  <div class="flex flex-col gap-2">
                      <div class="flex items-center justify-between">
                          <label class="text-sm font-medium">
                              {{ t.poste.repartition }}
                              <span class="text-sm"
                                    [class.text-green-600]="sommeRepartition === 100"
                                    [class.text-red-500]="sommeRepartition !== 100 && repartitionsArray.length > 0">
                  {{ sommeRepartition }}%
                </span></label>
                      </div>
                      @if (sommeRepartition !== 100 && repartitionsArray.length > 0) {
                          <p-message severity="warn">{{ t.commun.repartitionInvalide }}</p-message>
                      }
                      @if (repartitionsArray.length > 0) {
                          <div class="w-full grid grid-cols-12 items-center gap-3 text-xs text-surface-400 font-medium px-0">
                              <span class="col-span-4 truncate">{{ t.referentiels.membre.nom }}</span>
                              <span class="col-span-3 text-center">{{ t.poste.repartition }}</span>
                              <span class="col-span-5">{{ t.poste.ventilation }}</span>
                          </div>
                      }
                      <div formArrayName="repartitions" class="flex flex-col gap-2">
                          @for (ctrl of repartitionsArray.controls; track ctrl; let i = $index) {
                              <div [formGroupName]="i" class="w-full grid grid-cols-12 items-center gap-3">
                                  <span class="col-span-4 text-sm truncate">{{ membres()[i]?.nom }}</span>
                                  <div class="col-span-3 min-w-[7.5rem]">
                                      <p-inputnumber formControlName="quotePart" [min]="0" [max]="100"
                                                     suffix="%" [minFractionDigits]="0" class="w-full"
                                                     inputStyleClass="w-full"
                                                     (onInput)="onQuotePartChange(i)"></p-inputnumber>
                                  </div>
                                  <div class="col-span-5 min-w-0">
                                      <p-select appendTo="body" formControlName="compteId"
                                                [options]="comptes()" optionLabel="libelle"
                                                optionValue="id"
                                                [placeholder]="t.poste.ventilation" styleClass="w-full"
                                                [showClear]="true"
                                                [disabled]="(ctrl.get('quotePart')?.value ?? 0) === 0">
                                      <ng-template #selectedItem let-compte>
                                          @if (compte) {
                                              <div class="flex items-center gap-1.5 flex-wrap">
                                                  <span>{{ compte.libelle }}</span>
                                                  @for (m of membresForCompte(compte); track m.id) {
                                                      <span class="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium leading-none"
                                                            [style.background-color]="normaliserCouleur(m.couleur)"
                                                            [style.color]="couleurTexteContraste(normaliserCouleur(m.couleur))">
                                                        {{ m.nom }}
                                                      </span>
                                                  }
                                              </div>
                                          }
                                      </ng-template>
                                      <ng-template #item let-compte>
                                          <div class="flex items-center gap-1.5 flex-wrap">
                                              <span>{{ compte.libelle }}</span>
                                              @for (m of membresForCompte(compte); track m.id) {
                                                  <span class="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium leading-none"
                                                        [style.background-color]="normaliserCouleur(m.couleur)"
                                                        [style.color]="couleurTexteContraste(normaliserCouleur(m.couleur))">
                                                    {{ m.nom }}
                                                  </span>
                                              }
                                          </div>
                                      </ng-template>
                                      </p-select>
                                  </div>
                              </div>
                          }
                      </div>
                  </div>
              } @else if (membres().length > 0) {
                  <!-- Ventilation comptes uniquement (sans parts pour AUTO/REVERSE_AUTO) -->
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
                                                [placeholder]="t.poste.ventilation" styleClass="w-full"
                                                [showClear]="true">
                                      <ng-template #selectedItem let-compte>
                                          @if (compte) {
                                              <div class="flex items-center gap-1.5 flex-wrap">
                                                  <span>{{ compte.libelle }}</span>
                                                  @for (m of membresForCompte(compte); track m.id) {
                                                      <span class="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium leading-none"
                                                            [style.background-color]="normaliserCouleur(m.couleur)"
                                                            [style.color]="couleurTexteContraste(normaliserCouleur(m.couleur))">
                                                        {{ m.nom }}
                                                      </span>
                                                  }
                                              </div>
                                          }
                                      </ng-template>
                                      <ng-template #item let-compte>
                                          <div class="flex items-center gap-1.5 flex-wrap">
                                              <span>{{ compte.libelle }}</span>
                                              @for (m of membresForCompte(compte); track m.id) {
                                                  <span class="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium leading-none"
                                                        [style.background-color]="normaliserCouleur(m.couleur)"
                                                        [style.color]="couleurTexteContraste(normaliserCouleur(m.couleur))">
                                                    {{ m.nom }}
                                                  </span>
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
          </form>
          <ng-template #footer>
              <p-button [label]="t.commun.annuler" severity="secondary" (click)="fermerDialogPoste()"/>
              <p-button [label]="t.commun.enregistrer" (click)="enregistrer()"
                        [disabled]="!isFormValid()"/>
          </ng-template>
      </p-dialog>

      <!-- Dialog aperçu mensuel -->
      <p-dialog [(visible)]="apercuVisible" [header]="t.poste.apercu" [modal]="true" styleClass="w-96">
          @if (apercuData()) {
              <p-table [value]="apercuData()!.contributions" styleClass="p-datatable-sm">
                  <ng-template #header>
                      <tr>
                          <th>{{ t.projection.mois }}</th>
                          <th class="text-right">Contribution</th>
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
  `,
})
export class PostesListeComponent implements OnInit {
  readonly t = FR;
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

  modeOptions = [
    { label: FR.poste.modeOptions.MENSUALISE, value: 'MENSUALISE' },
    { label: FR.poste.modeOptions.PERIODIQUE, value: 'PERIODIQUE' },
  ];

  momentOptions = [
    { label: FR.poste.momentOptions.DEBUT_PERIODE, value: 'DEBUT_PERIODE' },
    { label: FR.poste.momentOptions.FIN_PERIODE,   value: 'FIN_PERIODE' },
  ];

  natureOptions = [
    { label: FR.poste.natureOptions.EFFECTIF,  value: 'EFFECTIF' },
    { label: FR.poste.natureOptions.ESTIMATION, value: 'ESTIMATION' },
  ];

  typeRepartitionOptions = [
    { label: FR.poste.typeRepartitionOptions.AUTO,         value: 'AUTO' as TypeRepartition },
    { label: FR.poste.typeRepartitionOptions.REVERSE_AUTO, value: 'REVERSE_AUTO' as TypeRepartition },
    { label: FR.poste.typeRepartitionOptions.CUSTOM,       value: 'CUSTOM' as TypeRepartition },
  ];

  periodiciteOptions = [
    { label: FR.poste.periodiciteLabels[0], value: 0 },
    ...FR.poste.periodiciteLabels.slice(1).map((label, i) => ({ label, value: i + 1 }))
  ];

  triActuel = signal<'DATE' | 'CATEGORIE' | 'DESCRIPTION'>('CATEGORIE');
  cacherInactifs = signal(true);
  cacherFuturs = signal(false);
  filtreCompteIds = signal<string[]>([]);
  filtreMembreIds = signal<string[]>([]);
  filtreCategorieIds = signal<string[]>([]);

  triOptions = [
    { label: FR.poste.triOptions.DATE,        value: 'DATE' as const },
    { label: FR.poste.triOptions.CATEGORIE,   value: 'CATEGORIE' as const },
    { label: FR.poste.triOptions.DESCRIPTION, value: 'DESCRIPTION' as const },
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

  postesTries = computed(() => {
    const list = [...this.postes()];
    switch (this.triActuel()) {
      case 'DATE':
        return list.sort((a, b) => {
          const da = a.debut ?? '9999-12'; const db = b.debut ?? '9999-12';
          if (da !== db) return da.localeCompare(db);
          return (a.fin ?? '9999-12').localeCompare(b.fin ?? '9999-12');
        });
      case 'CATEGORIE':
        return list.sort((a, b) => {
          const ca = this.categorieLabel(a.categorieId); const cb = this.categorieLabel(b.categorieId);
          if (ca !== cb) return ca.localeCompare(cb, 'fr');
          if (a.description !== b.description) return a.description.localeCompare(b.description, 'fr');
          return b.montant - a.montant;
        });
      case 'DESCRIPTION':
        return list.sort((a, b) => {
          if (a.description !== b.description) return a.description.localeCompare(b.description, 'fr');
          return b.montant - a.montant;
        });
      default: return list;
    }
  });

  // ── Séparateurs de groupe ─────────────────────────────────
  /** Type discriminant : un élément de la liste est soit un poste, soit un séparateur. */
  isSeparator(item: PosteDto | { separator: string }): item is { separator: string } {
    return 'separator' in item;
  }

  /** Cast sûr côté template après discrimination par isSeparator(). */
  asPoste(item: PosteDto | { separator: string }): PosteDto {
    return item as PosteDto;
  }

  /**
   * Liste affichée avec séparateurs de groupe insérés selon le tri actuel :
   *  - DATE        → [mois.année] selon p.debut
   *  - CATÉGORIE   → [nom catégorie]
   *  - DESCRIPTION → [première lettre majuscule]
   */
  postesAvecSeparateurs = computed<(PosteDto | { separator: string })[]>(() => {
    const result: (PosteDto | { separator: string })[] = [];
    let lastKey: string | null = null;
    const tri = this.triActuel();

    for (const p of this.postesVisibles()) {
      let key: string;
      let label: string;

      switch (tri) {
        case 'DATE':
          key   = p.debut?.substring(0, 7) ?? '–';
          label = this.formatPeriode(p.debut ?? null);
          break;
        case 'CATEGORIE':
          key   = this.categorieLabel(p.categorieId);
          label = key;
          break;
        case 'DESCRIPTION':
          key   = p.description.charAt(0).toUpperCase();
          label = key;
          break;
        default:
          key   = '';
          label = '';
      }

      if (key !== lastKey) {
        result.push({ separator: label });
        lastKey = key;
      }
      result.push(p);
    }
    return result;
  });

  /** Liste finale affichée : triée + filtrée selon les options de masquage et les filtres comptes/membres/catégories. */
  postesVisibles = computed(() => {
    const compteIds     = this.filtreCompteIds();
    const membreIds     = this.filtreMembreIds();
    const categorieIds  = this.filtreCategorieIds();
    const tousMembreIds = this.membres().map(m => m.id);

    return this.postesTries().filter(p => {
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
      return `${this.t.poste.natureOptions.ESTIMATION} ± ${this.formatEstimationPourcentage(p.estimPourcentage)}%`;
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

    if (this.contexte.estEditor()) {
      items.push(
        { label: this.t.commun.modifier, icon: 'pi pi-pencil', command: () => this.ouvrirEdition(p) },
        { label: this.t.commun.supprimer, icon: 'pi pi-trash', command: () => this.supprimer(p) },
      );
    }

    return items;
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
      debut: p.debut ? new Date(p.debut) : null,
      fin: p.fin ? new Date(p.fin) : null,
    });
    // Initialiser les parts seulement pour CUSTOM
    if (p.typeRepartition === 'CUSTOM') {
      this.initialiserRepartitions(p.repartitions, p.ventilations);
    } else {
      this.initialiserRepartitions(undefined, p.ventilations);
    }
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
        summary: FR.commun.erreur,
        detail: `${FR.poste.debut} requis pour ${FR.poste.oneShot}`,
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
      this.toast.add({ severity: 'warn', summary: FR.commun.erreur, detail: FR.commun.repartitionInvalide });
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
        this.toast.add({ severity: 'success', summary: FR.commun.succes });
        this.dialogVisible = false;
        this.charger();
      },
      error: (err) => this.toast.add({ severity: 'error', summary: FR.commun.erreur, detail: err?.error?.message }),
    });
  }

  supprimer(p: PosteDto): void {
    this.confirm.confirm({
      message: FR.commun.confirmerSuppression,
      accept: () => {
        const foyerId = this.contexte.foyerId()!;
        const scenarioId = this.contexte.scenarioId()!;
        this.posteSvc.supprimer(foyerId, scenarioId, p.id).subscribe({
          next: () => { this.toast.add({ severity: 'success', summary: FR.commun.succes }); this.charger(); },
          error: () => this.toast.add({ severity: 'error', summary: FR.commun.erreur }),
        });
      },
    });
  }

  private toIso(d: Date): string { return d.toISOString().substring(0, 10); }

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
}

