import { Component, inject, signal, computed, OnInit, effect } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { SelectModule } from 'primeng/select';
import { SelectButtonModule } from 'primeng/selectbutton';
import { ChartModule } from 'primeng/chart';
import { CardModule } from 'primeng/card';
import { SkeletonModule } from 'primeng/skeleton';
import { forkJoin } from 'rxjs';
import { ContexteService } from '../../../core/services/contexte.service';
import { ProjectionService } from '../../../core/services/projection.service';
import { CategorieService, CompteService } from '../../../core/services/referentiel.service';
import { PosteService } from '../../../core/services/scenario-poste.service';
import { VentilationsDto, VentilationAggregatDto, CategorieDto, CompteDto, TypeCategorie, PosteDto } from '../../../core/models/api.models';
import { MontantPipe } from '../../../core/pipes/format.pipes';
import { FR } from '../../../core/i18n/fr';

@Component({
  selector: 'app-dashboard-mensuel',
  standalone: true,
  imports: [CommonModule, FormsModule, SelectModule, SelectButtonModule, ChartModule, CardModule, SkeletonModule, MontantPipe],
  template: `
    <div class="flex flex-col gap-6">

      <!-- ── En-tête + sélecteurs ──────────────────────────────────────────── -->
      <div class="flex flex-col sm:flex-row sm:items-center gap-3">
        <div class="flex-1 min-w-0">
          <h1 class="text-2xl font-bold">{{ t.nav.dashboardMensuel }}</h1>
          <p class="text-sm text-surface-500 mt-0.5">
            Ventilation détaillée de {{ t.mois[mois - 1] }} {{ annee }}
          </p>
        </div>
        <div class="flex gap-2 shrink-0">
          @if (afficherParMembre()) {
            <p-selectButton [options]="vueOptions" [ngModel]="vue()" (ngModelChange)="vue.set($event)"
                            optionLabel="label" optionValue="value" [allowEmpty]="false" />
          }
          <p-select appendTo="body" [options]="annees" [(ngModel)]="annee"
                    (onChange)="charger()" styleClass="w-28" />
          <p-select appendTo="body" [options]="moisOptions" [(ngModel)]="mois"
                    optionLabel="label" optionValue="value"
                    (onChange)="charger()" styleClass="w-36" />
        </div>
      </div>

      <!-- ── Skeletons ─────────────────────────────────────────────────────── -->
      @if (chargement()) {
        <div class="grid grid-cols-2 lg:grid-cols-4 gap-4">
          @for (i of [1,2,3,4]; track i) { <p-skeleton height="104px" borderRadius="12px" /> }
        </div>
        <p-skeleton height="80px" borderRadius="12px" />
        <div class="grid grid-cols-1 sm:grid-cols-3 gap-4">
          @for (i of [1,2,3]; track i) { <p-skeleton height="260px" borderRadius="12px" /> }
        </div>
        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
          @for (i of [1,2]; track i) { <p-skeleton height="240px" borderRadius="12px" /> }
        </div>

      } @else if (ventilations()) {

        <!-- ① KPI foyer — 2 cols mobile · 4 cols desktop ───────────────────── -->
        @if (vueEffective() !== 'MEMBRE') {
        <div class="grid grid-cols-2 lg:grid-cols-4 gap-4">

          <p-card styleClass="border-l-4 border-green-500">
            <div class="flex items-start justify-between gap-2">
              <div class="min-w-0">
                <div class="text-xs font-semibold text-surface-400 uppercase tracking-wide mb-2">{{ t.projection.revenus }}</div>
                <div class="text-xl font-bold text-green-600 truncate">{{ ventilations()!.agregat.revenus | montant }}</div>
              </div>
              <span class="w-9 h-9 rounded-full bg-green-100 dark:bg-green-900/20 flex items-center justify-center shrink-0 mt-0.5">
                <i class="pi pi-arrow-up text-green-600 text-xs"></i>
              </span>
            </div>
          </p-card>

          <p-card styleClass="border-l-4 border-red-500">
            <div class="flex items-start justify-between gap-2">
              <div class="min-w-0">
                <div class="text-xs font-semibold text-surface-400 uppercase tracking-wide mb-2">{{ t.projection.charges }}</div>
                <div class="text-xl font-bold text-red-500 truncate">{{ ventilations()!.agregat.charges | montant }}</div>
              </div>
              <span class="w-9 h-9 rounded-full bg-red-100 dark:bg-red-900/20 flex items-center justify-center shrink-0 mt-0.5">
                <i class="pi pi-arrow-down text-red-500 text-xs"></i>
              </span>
            </div>
          </p-card>

          <p-card styleClass="border-l-4 border-blue-500">
            <div class="flex items-start justify-between gap-2">
              <div class="min-w-0">
                <div class="text-xs font-semibold text-surface-400 uppercase tracking-wide mb-2">{{ t.projection.reserves }}</div>
                <div class="text-xl font-bold text-blue-500 truncate">{{ ventilations()!.agregat.reserves | montant }}</div>
              </div>
              <span class="w-9 h-9 rounded-full bg-blue-100 dark:bg-blue-900/20 flex items-center justify-center shrink-0 mt-0.5">
                <i class="pi pi-wallet text-blue-500 text-xs"></i>
              </span>
            </div>
          </p-card>

          <p-card [styleClass]="'border-l-4 ' + soldeCardBorder()">
            <div class="flex items-start justify-between gap-2">
              <div class="min-w-0">
                <div class="text-xs font-semibold text-surface-400 uppercase tracking-wide mb-2">{{ t.projection.solde }}</div>
                <div class="text-xl font-bold truncate"
                     [class.text-emerald-600]="ventilations()!.agregat.soldeDisponible >= 0"
                     [class.text-red-500]="ventilations()!.agregat.soldeDisponible < 0">
                  {{ ventilations()!.agregat.soldeDisponible | montant }}
                </div>
              </div>
              <span class="w-9 h-9 rounded-full flex items-center justify-center shrink-0 mt-0.5"
                    [ngClass]="ventilations()!.agregat.soldeDisponible >= 0
                      ? 'bg-emerald-100 dark:bg-emerald-900/20'
                      : 'bg-red-100 dark:bg-red-900/20'">
                <i class="pi text-xs"
                   [ngClass]="ventilations()!.agregat.soldeDisponible >= 0
                     ? 'pi-check-circle text-emerald-600'
                     : 'pi-exclamation-triangle text-red-500'"></i>
              </span>
            </div>
          </p-card>
        </div>

        <!-- ② Taux d'effort — barre de progression visuelle ─────────────────── -->
        <p-card>
          <div class="flex flex-col gap-2">
            <div class="flex items-center justify-between">
              <div>
                <span class="text-sm font-semibold text-surface-700 dark:text-surface-200">Taux d'effort du foyer</span>
                <span class="text-xs text-surface-400 ml-2">charges / revenus du mois</span>
              </div>
               <span class="text-base font-bold px-2.5 py-0.5 rounded-lg"
                     [class.text-green-700]="tauxEffort() < 50"
                     [class.bg-green-100]="tauxEffort() < 50"
                     [class.text-amber-700]="tauxEffort() >= 50 && tauxEffort() < 75"
                     [class.bg-amber-100]="tauxEffort() >= 50 && tauxEffort() < 75"
                     [class.text-red-700]="tauxEffort() >= 75"
                     [class.bg-red-100]="tauxEffort() >= 75">
                 {{ tauxEffortStr() }}&thinsp;%
              </span>
            </div>
            <div class="w-full h-3 bg-surface-100 dark:bg-surface-700 rounded-full overflow-hidden">
              <div class="h-full rounded-full transition-all duration-500"
                     [style.width.%]="tauxEffort()"
                    [class.bg-green-500]="tauxEffort() < 50"
                    [class.bg-amber-400]="tauxEffort() >= 50 && tauxEffort() < 75"
                    [class.bg-red-500]="tauxEffort() >= 75">
              </div>
            </div>
            <div class="flex justify-between text-xs text-surface-400">
              <span>0 %</span>
              <span class="text-amber-500 font-medium">50 %</span>
              <span class="text-red-500 font-medium">75 %</span>
              <span>100 %</span>
            </div>
          </div>
        </p-card>

        <!-- ③ Ventilations par catégorie — 1 col mobile · 3 cols sm+ ─────────── -->
        <div class="grid grid-cols-1 sm:grid-cols-3 gap-4">

          <!-- Revenus -->
          <p-card>
            <ng-template pTemplate="header">
              <div class="px-4 pt-4 pb-2 flex items-center justify-between">
                <div class="flex items-center gap-2">
                  <span class="w-2.5 h-2.5 rounded-full bg-green-500 inline-block shrink-0"></span>
                  <span class="font-semibold text-green-600">{{ t.projection.revenus }}</span>
                </div>
                <span class="text-xs text-surface-400">{{ t.mois[mois - 1] }} {{ annee }}</span>
              </div>
            </ng-template>
            <div class="space-y-0.5">
              @for (row of categoriesParType().revenus; track row.libelle) {
                <div class="flex justify-between items-center text-sm py-1.5 border-b border-surface-100 dark:border-surface-800 last:border-0">
                  <span class="truncate mr-3 text-surface-700 dark:text-surface-200">{{ row.libelle }}</span>
                  <span class="font-semibold text-green-600 shrink-0 tabular-nums">{{ row.montant | montant }}</span>
                </div>
              }
              @if (categoriesParType().revenus.length === 0) {
                <div class="text-xs text-surface-400 italic text-center py-4">{{ t.commun.aucunResultat }}</div>
              } @else {
                <div class="flex justify-between text-sm font-bold pt-2 mt-1 border-t-2 border-green-200 dark:border-green-900">
                  <span>Total</span>
                  <span class="text-green-600 tabular-nums">{{ totalParType().revenus | montant }}</span>
                </div>
              }
            </div>
          </p-card>

          <!-- Charges -->
          <p-card>
            <ng-template pTemplate="header">
              <div class="px-4 pt-4 pb-2 flex items-center justify-between">
                <div class="flex items-center gap-2">
                  <span class="w-2.5 h-2.5 rounded-full bg-red-500 inline-block shrink-0"></span>
                  <span class="font-semibold text-red-500">{{ t.projection.charges }}</span>
                </div>
                <span class="text-xs text-surface-400">{{ t.mois[mois - 1] }} {{ annee }}</span>
              </div>
            </ng-template>
            <div class="space-y-0.5">
              @for (row of categoriesParType().charges; track row.libelle) {
                <div class="flex justify-between items-center text-sm py-1.5 border-b border-surface-100 dark:border-surface-800 last:border-0">
                  <span class="truncate mr-3 text-surface-700 dark:text-surface-200">{{ row.libelle }}</span>
                  <span class="font-semibold text-red-500 shrink-0 tabular-nums">{{ row.montant | montant }}</span>
                </div>
              }
              @if (categoriesParType().charges.length === 0) {
                <div class="text-xs text-surface-400 italic text-center py-4">{{ t.commun.aucunResultat }}</div>
              } @else {
                <div class="flex justify-between text-sm font-bold pt-2 mt-1 border-t-2 border-red-200 dark:border-red-900">
                  <span>Total</span>
                  <span class="text-red-500 tabular-nums">{{ totalParType().charges | montant }}</span>
                </div>
              }
            </div>
          </p-card>

          <!-- Réserves -->
          <p-card>
            <ng-template pTemplate="header">
              <div class="px-4 pt-4 pb-2 flex items-center justify-between">
                <div class="flex items-center gap-2">
                  <span class="w-2.5 h-2.5 rounded-full bg-blue-500 inline-block shrink-0"></span>
                  <span class="font-semibold text-blue-500">{{ t.projection.reserves }}</span>
                </div>
                <span class="text-xs text-surface-400">{{ t.mois[mois - 1] }} {{ annee }}</span>
              </div>
            </ng-template>
            <div class="space-y-0.5">
              @for (row of categoriesParType().reserves; track row.libelle) {
                <div class="flex justify-between items-center text-sm py-1.5 border-b border-surface-100 dark:border-surface-800 last:border-0">
                  <span class="truncate mr-3 text-surface-700 dark:text-surface-200">{{ row.libelle }}</span>
                  <span class="font-semibold text-blue-500 shrink-0 tabular-nums">{{ row.montant | montant }}</span>
                </div>
              }
              @if (categoriesParType().reserves.length === 0) {
                <div class="text-xs text-surface-400 italic text-center py-4">{{ t.commun.aucunResultat }}</div>
              } @else {
                <div class="flex justify-between text-sm font-bold pt-2 mt-1 border-t-2 border-blue-200 dark:border-blue-900">
                  <span>Total</span>
                  <span class="text-blue-500 tabular-nums">{{ totalParType().reserves | montant }}</span>
                </div>
              }
            </div>
          </p-card>
        </div>
        }

        <!-- ③ bis · Cascade de trésorerie ──────────────────────── -->
        @if (cascadeFoyer()) {
        <div>
          <div class="flex items-center gap-3 mb-4">
            <div class="h-px flex-1 bg-surface-200 dark:bg-surface-700"></div>
            <span class="text-xs font-bold text-surface-400 uppercase tracking-widest flex items-center gap-2">
              <i class="pi pi-chart-bar text-sm"></i>&nbsp;{{ t.projection.cascade }}
            </span>
            <div class="h-px flex-1 bg-surface-200 dark:bg-surface-700"></div>
          </div>

          <!-- Cascade foyer (vue FOYER, TOUT, ou mono-membre) -->
          @if (vueEffective() !== 'MEMBRE') {
            <p-card>
              <p-chart type="bar"
                       [data]="cascadeFoyer()!.chartData"
                       [options]="cascadeOptionsFor(cascadeXMaxFoyer())"
                       [style.height.px]="cascadeFoyer()!.chartHeight"
                       class="w-full block" />
            </p-card>
          }

          <!-- Cascades par membre (vue MEMBRE ou TOUT, multi-membres) -->
          @if (afficherParMembre() && vueEffective() !== 'FOYER') {
            <div class="grid grid-cols-1 md:grid-cols-2 gap-4" [class.mt-4]="vueEffective() === 'TOUT'">
              @for (mc of cascadeMembreData(); track mc.membreId) {
                <p-card>
                  <ng-template pTemplate="header">
                    <div class="px-4 pt-4 pb-2 flex items-center gap-2">
                      <span class="inline-block w-3.5 h-3.5 rounded-full shrink-0"
                            [style.background-color]="mc.couleur"></span>
                      <span class="font-semibold">{{ mc.nom }}</span>
                    </div>
                  </ng-template>
                  <p-chart type="bar"
                           [data]="mc.chartData"
                           [options]="cascadeOptionsFor(mc.xMax)"
                           [style.height.px]="mc.chartHeight"
                           class="w-full block" />
                </p-card>
              }
            </div>
          }
        </div>
        }

        <!-- ④ Détail par membre — toutes les catégories visibles ────────────── -->
        @if (afficherParMembre() && vueEffective() !== 'FOYER') {
        <div>
          <div class="flex items-center gap-3 mb-4">
            <div class="h-px flex-1 bg-surface-200 dark:bg-surface-700"></div>
            <span class="text-xs font-bold text-surface-400 uppercase tracking-widest flex items-center gap-2">
              <i class="pi pi-users text-sm"></i>&nbsp;{{ t.projection.contributionCategorieMembre }}
            </span>
            <div class="h-px flex-1 bg-surface-200 dark:bg-surface-700"></div>
          </div>

          <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
            @for (mc of membresData(); track mc.id) {
              <p-card>
                <ng-template pTemplate="header">
                  <div class="px-4 pt-4 pb-2 flex items-center justify-between">
                    <div class="flex items-center gap-2">
                      <span class="inline-block w-4 h-4 rounded-full border-2 border-surface-0 shadow"
                            [style.background-color]="mc.couleur"></span>
                      <span class="font-semibold text-base">{{ mc.nom }}</span>
                    </div>
                    @if (mc.agregat.revenus > 0) {
                      <span class="text-xs px-2.5 py-0.5 rounded-full font-semibold"
                            [class.bg-green-100]="mc.tauxEffort < 50"
                            [class.text-green-700]="mc.tauxEffort < 50"
                            [class.bg-amber-100]="mc.tauxEffort >= 50 && mc.tauxEffort < 75"
                            [class.text-amber-700]="mc.tauxEffort >= 50 && mc.tauxEffort < 75"
                            [class.bg-red-100]="mc.tauxEffort >= 75"
                            [class.text-red-700]="mc.tauxEffort >= 75">
                        Effort {{ mc.tauxEffortStr }}&thinsp;%
                      </span>
                    }
                  </div>
                </ng-template>

                <div class="grid grid-cols-1 gap-3">
                  <div class="rounded-lg bg-surface-50 dark:bg-surface-800 p-3">
                    <div class="flex items-center justify-between mb-2">
                      <div class="text-xs font-semibold uppercase tracking-wide text-green-600">{{ t.projection.revenus }}</div>
                      <div class="text-sm font-bold text-green-600 tabular-nums">{{ mc.agregat.revenus | montant }}</div>
                    </div>
                    @for (row of mc.categorieDetail.revenus; track row.id) {
                      <div class="flex justify-between items-center text-xs py-1 border-b border-surface-100 dark:border-surface-700 last:border-0">
                        <span class="truncate mr-2 text-surface-600 dark:text-surface-300">{{ row.libelle }}</span>
                        <span class="font-semibold text-green-600 shrink-0 tabular-nums">{{ row.montant | montant }}</span>
                      </div>
                    }
                    @if (mc.categorieDetail.revenus.length === 0) {
                      <div class="text-xs text-surface-400 italic text-center py-2">{{ t.commun.aucunResultat }}</div>
                    }
                  </div>

                  <div class="rounded-lg bg-surface-50 dark:bg-surface-800 p-3">
                    <div class="flex items-center justify-between mb-2">
                      <div class="text-xs font-semibold uppercase tracking-wide text-red-500">{{ t.projection.charges }}</div>
                      <div class="text-sm font-bold text-red-500 tabular-nums">{{ mc.agregat.charges | montant }}</div>
                    </div>
                    @for (row of mc.categorieDetail.charges; track row.id) {
                      <div class="flex justify-between items-center text-xs py-1 border-b border-surface-100 dark:border-surface-700 last:border-0">
                        <span class="truncate mr-2 text-surface-600 dark:text-surface-300">{{ row.libelle }}</span>
                        <span class="font-semibold text-red-500 shrink-0 tabular-nums">{{ row.montant | montant }}</span>
                      </div>
                    }
                    @if (mc.categorieDetail.charges.length === 0) {
                      <div class="text-xs text-surface-400 italic text-center py-2">{{ t.commun.aucunResultat }}</div>
                    }
                  </div>

                  <div class="rounded-lg bg-surface-50 dark:bg-surface-800 p-3">
                    <div class="flex items-center justify-between mb-2">
                      <div class="text-xs font-semibold uppercase tracking-wide text-blue-500">{{ t.projection.reserves }}</div>
                      <div class="text-sm font-bold text-blue-500 tabular-nums">{{ mc.agregat.reserves | montant }}</div>
                    </div>
                    @for (row of mc.categorieDetail.reserves; track row.id) {
                      <div class="flex justify-between items-center text-xs py-1 border-b border-surface-100 dark:border-surface-700 last:border-0">
                        <span class="truncate mr-2 text-surface-600 dark:text-surface-300">{{ row.libelle }}</span>
                        <span class="font-semibold text-blue-500 shrink-0 tabular-nums">{{ row.montant | montant }}</span>
                      </div>
                    }
                    @if (mc.categorieDetail.reserves.length === 0) {
                      <div class="text-xs text-surface-400 italic text-center py-2">{{ t.commun.aucunResultat }}</div>
                    }
                  </div>
                </div>
              </p-card>
            }
          </div>
        </div>
        }

        <!-- ④ bis · Répartition par compte et par membre ────────────────────── -->
        @if (afficherParMembre() && vueEffective() !== 'FOYER') {
        <div>
          <div class="flex items-center gap-3 mb-4">
            <div class="h-px flex-1 bg-surface-200 dark:bg-surface-700"></div>
            <span class="text-xs font-bold text-surface-400 uppercase tracking-widest flex items-center gap-2">
              <i class="pi pi-chart-bar text-sm"></i>&nbsp;{{ t.projection.repartitionCompteMembre }}
            </span>
            <div class="h-px flex-1 bg-surface-200 dark:bg-surface-700"></div>
          </div>

          <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
            @for (mc of membresData(); track mc.id) {
              <p-card>
                <ng-template pTemplate="header">
                  <div class="px-4 pt-4 pb-2 flex items-center justify-between">
                    <div class="flex items-center gap-2">
                      <span class="inline-block w-4 h-4 rounded-full border-2 border-surface-0 shadow"
                            [style.background-color]="mc.couleur"></span>
                      <span class="font-semibold text-base">{{ mc.nom }}</span>
                    </div>
                    @if (mc.agregat.revenus > 0) {
                      <span class="text-xs px-2.5 py-0.5 rounded-full font-semibold"
                     [class.bg-green-100]="mc.tauxEffort < 50"
                             [class.text-green-700]="mc.tauxEffort < 50"
                             [class.bg-amber-100]="mc.tauxEffort >= 50 && mc.tauxEffort < 75"
                             [class.text-amber-700]="mc.tauxEffort >= 50 && mc.tauxEffort < 75"
                             [class.bg-red-100]="mc.tauxEffort >= 75"
                             [class.text-red-700]="mc.tauxEffort >= 75">
                         Effort {{ mc.tauxEffortStr }}&thinsp;%
                      </span>
                    }
                  </div>
                </ng-template>

                <!-- KPI 2×2 -->
                <div class="grid grid-cols-2 gap-2 mb-4">
                  <div class="text-center p-2 rounded-lg bg-surface-50 dark:bg-surface-800">
                    <div class="text-xs text-surface-400 mb-0.5">Revenus</div>
                    <div class="text-sm font-bold text-green-600 tabular-nums">{{ mc.agregat.revenus | montant }}</div>
                  </div>
                  <div class="text-center p-2 rounded-lg bg-surface-50 dark:bg-surface-800">
                    <div class="text-xs text-surface-400 mb-0.5">Charges</div>
                    <div class="text-sm font-bold text-red-500 tabular-nums">{{ mc.agregat.charges | montant }}</div>
                  </div>
                  <div class="text-center p-2 rounded-lg bg-surface-50 dark:bg-surface-800">
                    <div class="text-xs text-surface-400 mb-0.5">Réserves</div>
                    <div class="text-sm font-bold text-blue-500 tabular-nums">{{ mc.agregat.reserves | montant }}</div>
                  </div>
                  <div class="text-center p-2 rounded-lg bg-surface-50 dark:bg-surface-800">
                    <div class="text-xs text-surface-400 mb-0.5">Solde</div>
                    <div class="text-sm font-bold tabular-nums"
                         [class.text-emerald-600]="mc.agregat.soldeDisponible >= 0"
                         [class.text-red-500]="mc.agregat.soldeDisponible < 0">
                      {{ mc.agregat.soldeDisponible | montant }}
                    </div>
                  </div>
                </div>

                <!-- Graphique charges par compte -->
                @if (mc.chargesParCompte.length > 0) {
                  <div class="text-xs font-semibold text-surface-400 uppercase tracking-wide mb-2">
                    Charges par compte
                  </div>
                  <p-chart type="bar" [data]="mc.chartData" [options]="membreChartOptions"
                           [style]="'height:' + mc.chartHeight + 'px'" class="w-full block" />
                } @else {
                  <div class="text-xs text-surface-400 italic text-center py-3">
                    Aucune charge ce mois
                  </div>
                }
              </p-card>
            }
          </div>
        </div>
        }
      }
    </div>
  `,
})
export class DashboardMensuelComponent implements OnInit {
  readonly t = FR;
  private contexte     = inject(ContexteService);
  private projSvc      = inject(ProjectionService);
  private categorieSvc = inject(CategorieService);
  private compteSvc    = inject(CompteService);
  private posteSvc     = inject(PosteService);

  ventilations = signal<VentilationsDto | null>(null);
  categories   = signal<CategorieDto[]>([]);
  comptes      = signal<CompteDto[]>([]);
  postes       = signal<PosteDto[]>([]);
  chargement   = signal(false);

  // membres provient du contexte global (chargé par le Shell)
  readonly membres = this.contexte.membres;

  // ── Vue Foyer / Par membre / Les deux ────────────────────────────────────────
  vue = signal<'FOYER' | 'MEMBRE' | 'TOUT'>('MEMBRE');
  afficherParMembre = computed(() => this.membres().length > 1);
  vueEffective = computed<'FOYER' | 'MEMBRE' | 'TOUT'>(() =>
    this.afficherParMembre() ? this.vue() : 'FOYER'
  );
  readonly vueOptions = [
    { label: this.t.projection.vueFoyer,     value: 'FOYER'  },
    { label: this.t.projection.vueParMembre, value: 'MEMBRE' },
    { label: this.t.projection.vueTout,      value: 'TOUT'   },
  ];

  private etaitMonoMembre = false;

  annee = new Date().getFullYear();
  mois  = new Date().getMonth() + 1;

  annees: number[]  = Array.from({ length: 9 }, (_, i) => new Date().getFullYear() + i);
  moisOptions       = FR.mois.map((label, i) => ({ label, value: i + 1 }));

  private readonly palette = [
    '#6366f1','#22c55e','#ef4444','#f59e0b',
    '#3b82f6','#ec4899','#14b8a6','#8b5cf6',
    '#f97316','#84cc16','#06b6d4','#a855f7',
  ];

  private readonly fmtCompact = (v: number) =>
    Intl.NumberFormat('fr-CH', { notation: 'compact', maximumFractionDigits: 1 }).format(v);

  formatPct(v: number): string {
    return Intl.NumberFormat('fr-CH', { minimumFractionDigits: 0, maximumFractionDigits: 1 }).format(v);
  }

  // ── Helpers ─────────────────────────────────────────────────────────────────

  soldeCardBorder = computed(() =>
    (this.ventilations()?.agregat.soldeDisponible ?? 0) >= 0
      ? 'border-emerald-500'
      : 'border-red-500'
  );

  private compteLibelle(id: string): string {
    return this.comptes().find(c => c.id === id)?.libelle ?? id.substring(0, 8) + '…';
  }

  private compteLibellePourMembre(compteId: string, membreId: string): string {
    const compte = this.comptes().find(c => c.id === compteId);
    const libelle = compte?.libelle ?? this.compteLibelle(compteId);
    if (!compte || compte.membreIds?.includes(membreId)) return libelle;

    const mapMembres = new Map(this.membres().map(m => [m.id, m.nom]));
    const nomsMembres = (compte.membreIds ?? [])
      .map(id => mapMembres.get(id))
      .filter((nom): nom is string => !!nom)
      .join(', ');

    return nomsMembres ? `${libelle} ${this.t.commun.de} ${nomsMembres}` : libelle;
  }

  private categorieMontantParMembre(categorieId: string, membreId: string): number {
    return (this.ventilations()?.parCategorieMembre ?? {})[categorieId]?.[membreId] ?? 0;
  }

  // ── Options Chart.js ─────────────────────────────────────────────────────────

  readonly membreChartOptions = {
    indexAxis: 'y' as const,
    responsive: true, maintainAspectRatio: false,
    plugins: { legend: { display: false } },
    scales: {
      x: {
        ticks: { callback: (v: any) => this.fmtCompact(Number(v)) },
        grid:  { color: 'rgba(128,128,128,0.08)' },
      },
      y: { grid: { display: false } },
    },
  };

  // ── Computed ─────────────────────────────────────────────────────────────────

  tauxEffort = computed(() => {
    const ag = this.ventilations()?.agregat;
    if (!ag || ag.revenus <= 0) return 0;
    return Math.min((ag.charges / ag.revenus) * 100, 100);
  });

  tauxEffortStr = computed(() => this.formatPct(this.tauxEffort()));

  categoriesParType = computed(() => {
    const v    = this.ventilations();
    const cats = this.categories();
    const makeList = (type: TypeCategorie) =>
      cats
        .filter(c => c.typePoste === type)
        .map(c => ({ libelle: c.libelle, montant: (v?.parCategorie as Record<string, number>)?.[c.id] ?? 0 }))
        .filter(r => r.montant !== 0)
        .sort((a, b) => b.montant - a.montant);
    return {
      revenus:  makeList('REVENU'),
      charges:  makeList('CHARGE'),
      reserves: makeList('RESERVE'),
    };
  });

  membresParType = computed(() => {
    const v    = this.ventilations();
    const mems = this.membres();
    const makeList = (type: keyof VentilationAggregatDto) =>
      mems
        .map(m => ({ id: m.id, libelle: m.nom, montant: (v?.parMembre as Record<string, VentilationAggregatDto>)?.[m.id]?.[type] ?? 0 }))
        .filter(r => r.montant !== 0)
        .sort((a, b) => b.montant - a.montant);
    return {
      revenus:  makeList('revenus'),
      charges:  makeList('charges'),
      reserves: makeList('reserves'),
    };
  });

  totalParType = computed(() => {
    const d   = this.categoriesParType();
    const sum = (rows: { montant: number }[]) => rows.reduce((s, r) => s + r.montant, 0);
    return { revenus: sum(d.revenus), charges: sum(d.charges), reserves: sum(d.reserves) };
  });

  totalParMembreType = computed(() => {
    const d   = this.membresParType();
    const sum = (rows: { montant: number }[]) => rows.reduce((s, r) => s + r.montant, 0);
    return { revenus: sum(d.revenus), charges: sum(d.charges), reserves: sum(d.reserves) };
  });

  // ── Cascade de trésorerie ──────────────────────────────────────────────────

  private buildCascadeChartData(
    etapes: { label: string; valeur: number; couleur: string; isSummary: boolean }[]
  ) {
    const spacers: number[] = [];
    const bars: number[]    = [];
    const couleurs           = etapes.map(e => e.couleur);
    let running              = 0;

    for (const e of etapes) {
      if (e.isSummary) {
        spacers.push(0);
        bars.push(Math.abs(e.valeur));
      } else if (e.valeur >= 0) {
        spacers.push(running);
        bars.push(e.valeur);
        running += e.valeur;
      } else {
        const abs = Math.abs(e.valeur);
        spacers.push(Math.max(0, running - abs));
        bars.push(abs);
        running -= abs;
      }
    }

    return {
      labels: etapes.map(e => e.label),
      datasets: [
        { data: spacers, backgroundColor: 'rgba(0,0,0,0)', borderColor: 'rgba(0,0,0,0)', borderWidth: 0, stack: 'cascade' },
        { data: bars, backgroundColor: couleurs, borderRadius: 4, borderWidth: 0, stack: 'cascade' },
      ],
    };
  }

  /** Étapes foyer : 4 barres (revenus / charges / réserves / disponible) */
  private cascadeEtapesFromAgregat(ag: VentilationAggregatDto) {
    return [
      { label: FR.projection.revenus,               valeur:  ag.revenus,         couleur: '#22c55e', isSummary: false },
      { label: '\u2212\u2009' + FR.projection.charges,   valeur: -ag.charges,    couleur: '#ef4444', isSummary: false },
      { label: '\u2212\u2009' + FR.projection.reserves,  valeur: -ag.reserves,   couleur: '#3b82f6', isSummary: false },
      { label: '=\u2009' + FR.projection.solde,     valeur:  ag.soldeDisponible, couleur: ag.soldeDisponible >= 0 ? '#10b981' : '#ef4444', isSummary: true },
    ];
  }

  /** Un poste est actif dans le mois sélectionné. */
  private posteActifDansMois(p: PosteDto, moisStr: string): boolean {
    const debutM = p.debut ? String(p.debut).substring(0, 7) : null;
    const finM   = p.fin   ? String(p.fin).substring(0, 7)   : null;
    // One-shot : actif uniquement dans son mois de début
    if (p.periodiciteMois === 0) return debutM === moisStr;
    if (debutM && debutM > moisStr) return false;
    if (finM   && finM   < moisStr) return false;
    return true;
  }

  /** QuotePart du membre dans un poste AUTO / REVERSE_AUTO pour le mois courant. */
  private quotePartAutoMois(membreId: string, typeRep: string): number {
    const sc = this.contexte.scenarioCourant();
    if (!sc) return 0;
    const moisStr = `${this.annee}-${String(this.mois).padStart(2, '0')}`;

    // Trouver la période active (debut ≤ mois ≤ fin)
    const periodeActive = sc.periodes.find(p => {
      const d = p.debut?.substring(0, 7) ?? '0000-01';
      const f = p.fin?.substring(0, 7)   ?? '9999-12';
      return d <= moisStr && moisStr <= f;
    });

    const parts = periodeActive
      ? [...periodeActive.parts]
      : sc.repartitions.map((r, i) => ({ membreId: r.membreId, quotePart: r.quotePart, ordre: i }));

    if (typeRep === 'REVERSE_AUTO') {
      // Permuter les quoteParts dans l'ordre inverse (tri par ordre)
      const sorted = [...parts].sort((a, b) => (a as any).ordre - (b as any).ordre);
      const qps    = sorted.map(p => Number(p.quotePart));
      qps.reverse();
      const idx = sorted.findIndex(p => String(p.membreId) === membreId);
      return idx >= 0 ? qps[idx] : 0;
    }

    const part = parts.find(p => String(p.membreId) === membreId);
    return part ? Number(part.quotePart) : 0;
  }

  /** QuotePart effective du membre dans un poste (CUSTOM via repartitions[], AUTO/REVERSE_AUTO via périodes). */
  private quotePartMembre(p: PosteDto, membreId: string): number {
    if (p.typeRepartition === 'CUSTOM') {
      const rep = (p.repartitions ?? []).find(r => String(r.membreId) === membreId);
      return rep ? Number(rep.quotePart) : 0;
    }
    return this.quotePartAutoMois(membreId, p.typeRepartition);
  }

  /**
   * Un poste CUSTOM est personnel si le membre est le SEUL avec quotePart > 0.
   * Les postes AUTO/REVERSE_AUTO impliquent tous les membres → toujours partagé.
   */
  private estPersonnel(p: PosteDto, membreId: string): boolean {
    if (p.typeRepartition !== 'CUSTOM') return false;
    const nonZero = (p.repartitions ?? []).filter(r => Number(r.quotePart) > 0);
    return nonZero.length === 1 && String(nonZero[0].membreId) === membreId;
  }

  /**
   * Répartit le total serveur (parMembre[m][type]) en personnel vs partagé,
   * en utilisant les proportions des montantsMensualisés des postes actifs.
   * Le total reste toujours exactement égal au total serveur.
   */
  private splitPersonnelPartage(
    membreId: string,
    type: string,
    totalServeur: number,
    moisStr: string,
  ): { personnel: number; partage: number } {
    if (totalServeur === 0) return { personnel: 0, partage: 0 };

    let persoRaw = 0;
    let partageRaw = 0;

    for (const p of this.postes()) {
      if (p.type !== type) continue;
      if (!this.posteActifDansMois(p, moisStr)) continue;
      const qp = this.quotePartMembre(p, membreId);
      if (qp <= 0) continue;
      const montant = p.montantMensualise * qp;
      if (this.estPersonnel(p, membreId)) { persoRaw += montant; }
      else                                 { partageRaw += montant; }
    }

    const totalRaw = persoRaw + partageRaw;
    if (totalRaw <= 0) return { personnel: 0, partage: totalServeur };

    const personnel = totalServeur * (persoRaw / totalRaw);
    return { personnel, partage: totalServeur - personnel };
  }

  /**
   * Construit les étapes de la cascade pour un membre (multi-membres) :
   * jusqu'à 7 barres (rev perso, rev partagé, -chg perso, -chg partagé,
   * -res perso, -res partagé, = disponible). Les étapes à 0 sont omises.
   */
  private cascadeEtapesMembre(
    membreId: string,
    ag: VentilationAggregatDto,
  ): { label: string; valeur: number; couleur: string; isSummary: boolean }[] {
    const moisStr = `${this.annee}-${String(this.mois).padStart(2, '0')}`;
    const rev = this.splitPersonnelPartage(membreId, 'REVENU',  ag.revenus,  moisStr);
    const chg = this.splitPersonnelPartage(membreId, 'CHARGE',  ag.charges,  moisStr);
    const res = this.splitPersonnelPartage(membreId, 'RESERVE', ag.reserves, moisStr);

    const etapes: { label: string; valeur: number; couleur: string; isSummary: boolean }[] = [];
    const push = (label: string, valeur: number, couleur: string) => {
      if (Math.abs(valeur) >= 0.005) etapes.push({ label, valeur, couleur, isSummary: false });
    };

    push('Revenus perso.',         rev.personnel, '#22c55e');
    push('Revenus partagés',       rev.partage,   'rgba(34,197,94,0.55)');
    push('− Charges perso.',      -chg.personnel, '#ef4444');
    push('− Charges partagées',   -chg.partage,   'rgba(239,68,68,0.55)');
    push('− Réserves perso.',     -res.personnel, '#3b82f6');
    push('− Réserves partagées',  -res.partage,   'rgba(59,130,246,0.55)');

    etapes.push({
      label: '=\u2009' + FR.projection.solde,
      valeur: ag.soldeDisponible,
      couleur: ag.soldeDisponible >= 0 ? '#10b981' : '#ef4444',
      isSummary: true,
    });

    return etapes;
  }

  /**
   * Étapes foyer multi-membres : même structure que la cascade par membre
   * (perso / partagé par type), avec les TOTAUX foyer = somme de tous les membres.
   */
  private cascadeEtapesFoyerSplit(v: VentilationsDto) {
    const moisStr = `${this.annee}-${String(this.mois).padStart(2, '0')}`;
    const zero    = { revenus: 0, charges: 0, reserves: 0, soldeDisponible: 0 };

    let revPerso = 0, revPartage = 0;
    let chgPerso = 0, chgPartage = 0;
    let resPerso = 0, resPartage = 0;

    for (const m of this.membres()) {
      const ag  = (v.parMembre ?? {})[m.id] ?? zero;
      const rev = this.splitPersonnelPartage(m.id, 'REVENU',  ag.revenus,  moisStr);
      const chg = this.splitPersonnelPartage(m.id, 'CHARGE',  ag.charges,  moisStr);
      const res = this.splitPersonnelPartage(m.id, 'RESERVE', ag.reserves, moisStr);
      revPerso  += rev.personnel; revPartage  += rev.partage;
      chgPerso  += chg.personnel; chgPartage  += chg.partage;
      resPerso  += res.personnel; resPartage  += res.partage;
    }

    const etapes: { label: string; valeur: number; couleur: string; isSummary: boolean }[] = [];
    const push = (label: string, valeur: number, couleur: string) => {
      if (Math.abs(valeur) >= 0.005) etapes.push({ label, valeur, couleur, isSummary: false });
    };

    push('Revenus perso.',         revPerso,    '#22c55e');
    push('Revenus partagés',       revPartage,  'rgba(34,197,94,0.55)');
    push('− Charges perso.',      -chgPerso,    '#ef4444');
    push('− Charges partagées',   -chgPartage,  'rgba(239,68,68,0.55)');
    push('− Réserves perso.',     -resPerso,    '#3b82f6');
    push('− Réserves partagées',  -resPartage,  'rgba(59,130,246,0.55)');

    const solde = v.agregat.soldeDisponible;
    etapes.push({ label: '=\u2009' + FR.projection.solde, valeur: solde, couleur: solde >= 0 ? '#10b981' : '#ef4444', isSummary: true });
    return etapes;
  }

  /** Données + hauteur pour la cascade foyer. */
  cascadeFoyer = computed(() => {
    const v       = this.ventilations();
    const membres = this.membres();
    if (!v) return null;
    const etapes = membres.length > 1
      ? this.cascadeEtapesFoyerSplit(v)
      : this.cascadeEtapesFromAgregat(v.agregat);
    return {
      chartData:   this.buildCascadeChartData(etapes),
      chartHeight: Math.max(192, etapes.length * 46),
    };
  });

  cascadeMembreData = computed(() => {
    const v       = this.ventilations();
    const multiM  = this.membres().length > 1;
    const zero: VentilationAggregatDto = { revenus: 0, charges: 0, reserves: 0, soldeDisponible: 0 };
    if (!v) return [];
    return this.membres().map(m => {
      const ag     = (v.parMembre ?? {})[m.id] ?? zero;
      const etapes = multiM
        ? this.cascadeEtapesMembre(m.id, ag)
        : this.cascadeEtapesFromAgregat(ag);
      return {
        membreId:    m.id,
        nom:         m.nom,
        couleur:     m.couleur,
        chartData:   this.buildCascadeChartData(etapes),
        chartHeight: Math.max(192, etapes.length * 46),
        xMax:        ag.revenus > 0 ? ag.revenus : 100,
      };
    });
  });

  cascadeXMax = computed(() => {
    const v = this.ventilations();
    if (!v) return 100;
    let max = v.agregat.revenus;
    for (const ag of Object.values(v.parMembre ?? {})) {
      max = Math.max(max, (ag as VentilationAggregatDto).revenus);
    }
    return max > 0 ? max * 1.1 : 100;
  });

  /** Échelle X pour la cascade foyer (= total revenus foyer). */
  cascadeXMaxFoyer = computed(() => {
    const rev = this.ventilations()?.agregat.revenus ?? 0;
    return rev > 0 ? rev : 100;
  });

  /** Options Chart.js pour un max X donné (utilisé par les cascades foyer et membres séparément). */
  cascadeOptionsFor(max: number) {
    const fmt = this.fmtCompact;
    return {
      indexAxis: 'y' as const,
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          filter: (item: any) => item.datasetIndex === 1,
          callbacks: {
            label: (ctx: any) => {
              const v = Number(ctx.raw);
              return ' ' + Intl.NumberFormat('fr-CH', { maximumFractionDigits: 0 }).format(v) + ' CHF';
            },
          },
        },
      },
      scales: {
        x: {
          stacked: true, min: 0, max,
          ticks: { callback: (v: any) => fmt(Number(v)) },
          grid: { color: 'rgba(128,128,128,0.08)' },
        },
        y: { stacked: true, grid: { display: false } },
      },
    };
  }

  membresData = computed(() => {
    const v = this.ventilations();
    if (!v) return [];
    const zero: VentilationAggregatDto = { revenus: 0, charges: 0, reserves: 0, soldeDisponible: 0 };
    const cats = this.categories();
    return this.membres().map(m => {
      const agregat: VentilationAggregatDto = (v.parMembre ?? {})[m.id] ?? zero;
        const tauxEffort = agregat.revenus > 0
        ? Math.min((agregat.charges / agregat.revenus) * 100, 100)
        : 0;
      const tauxEffortStr = this.formatPct(tauxEffort);
      const chargesParCompte = Object.entries(v.parCompteMembre ?? {})
        .map(([compteId, memMap]) => ({
          libelle: this.compteLibellePourMembre(compteId, m.id),
          montant: memMap[m.id] ?? 0,
        }))
        .filter(c => c.montant > 0)
        .sort((a, b) => b.montant - a.montant);

      const makeList = (type: TypeCategorie) => cats
        .filter(c => c.typePoste === type)
        .map(c => ({ id: c.id, libelle: c.libelle, montant: this.categorieMontantParMembre(c.id, m.id) }))
        .filter(r => r.montant !== 0)
        .sort((a, b) => b.montant - a.montant);

      return {
        id: m.id, nom: m.nom, couleur: m.couleur,
        agregat, tauxEffort, tauxEffortStr, chargesParCompte,
        categorieDetail: {
          revenus: makeList('REVENU'),
          charges: makeList('CHARGE'),
          reserves: makeList('RESERVE'),
        },
        chartHeight: Math.max(chargesParCompte.length * 38 + 16, 56),
        chartData: {
          labels: chargesParCompte.map(c => c.libelle),
          datasets: [{
            data: chargesParCompte.map(c => c.montant),
            backgroundColor: this.palette.slice(0, chargesParCompte.length),
            borderRadius: 4, borderWidth: 0,
          }],
        },
      };
    });
  });

  // ── Effets & chargement ──────────────────────────────────────────────────────

  private readonly _initEffect = effect(() => {
    const sc      = this.contexte.scenarioCourant();
    const foyerId = this.contexte.foyerId();
    if (sc) {
      this.annees = Array.from({ length: sc.horizonAnnees }, (_, i) => sc.anneeDepart + i);
      this.annee  = sc.anneeDepart;
    }
    if (foyerId && sc) {
      forkJoin([
        this.categorieSvc.lister(foyerId),
        this.compteSvc.lister(foyerId),
        this.posteSvc.lister(foyerId, sc.id),
      ]).subscribe(([cats, cptes, postes]) => {
        this.categories.set(cats);
        this.comptes.set(cptes);
        this.postes.set(postes);
        this.charger();
      });
    }
  });

  private readonly _normaliserVueEffect = effect(() => {
    const multiMembres = this.afficherParMembre();
    if (!multiMembres) {
      this.etaitMonoMembre = true;
      if (this.vue() !== 'FOYER') this.vue.set('FOYER');
      return;
    }
    if (this.etaitMonoMembre) {
      this.etaitMonoMembre = false;
      if (this.vue() !== 'MEMBRE') this.vue.set('MEMBRE');
    }
  });

  ngOnInit(): void {}

  charger(): void {
    const foyerId    = this.contexte.foyerId();
    const scenarioId = this.contexte.scenarioId();
    if (!foyerId || !scenarioId) return;
    this.chargement.set(true);
    this.projSvc.mensuelle(foyerId, scenarioId, this.annee, this.mois).subscribe({
      next: v => { this.ventilations.set(v); this.chargement.set(false); },
      error: () => this.chargement.set(false),
    });
  }
}
