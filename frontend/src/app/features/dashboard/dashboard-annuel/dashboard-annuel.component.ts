import { Component, inject, signal, computed, OnInit, effect } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { SelectModule } from 'primeng/select';
import { SelectButtonModule } from 'primeng/selectbutton';
import { TableModule } from 'primeng/table';
import { ChartModule } from 'primeng/chart';
import { SkeletonModule } from 'primeng/skeleton';
import { CardModule } from 'primeng/card';
import { TagModule } from 'primeng/tag';
import { ButtonModule } from 'primeng/button';
import { forkJoin } from 'rxjs';
import { ContexteService } from '../../../core/services/contexte.service';
import { ProjectionService } from '../../../core/services/projection.service';
import { CategorieService, CompteService } from '../../../core/services/referentiel.service';
import { PosteService, ObjectifService } from '../../../core/services/scenario-poste.service';
import { DecompositionService, VentilationLike } from '../../../core/services/decomposition.service';
import {
  ProjectionAnnuelleDto, AggregatDto, VentilationsDto, VentilationAggregatDto, VentilationSplitDto,
  CategorieDto, CompteDto, PosteDto, ObjectifDto, TypeCategorie,
} from '../../../core/models/api.models';
import { MontantPipe } from '../../../core/pipes/format.pipes';
import { I18nService } from '../../../core/i18n/i18n.service';
import { CarteBilanComponent, LigneDecomposition } from '../../../shared/components/carte-bilan/carte-bilan.component';

@Component({
  selector: 'app-dashboard-annuel',
  standalone: true,
  imports: [CommonModule, FormsModule, SelectModule, SelectButtonModule, TableModule, ChartModule,
            SkeletonModule, CardModule, TagModule, ButtonModule, MontantPipe, CarteBilanComponent],
  template: `
      <div class="flex flex-col gap-6">

          <!-- ── En-tête ───────────────────────────────────────────────────────── -->
          <div class="flex flex-col sm:flex-row sm:items-center gap-3">
              <div class="flex-1 min-w-0">
                  <h1 class="text-2xl font-bold">{{ t.nav.dashboardAnnuel }}</h1>
                  <p class="text-sm text-surface-500 mt-0.5">{{ anneeSelectionnee }}</p>
              </div>
              <div class="flex gap-2 shrink-0">
                  <p-button icon="pi pi-chevron-left" [text]="true" [rounded]="true"
                            [disabled]="!peutReculer()" (onClick)="anneePrecedente()"
                            [ariaLabel]="t.projection.anneePrecedente"/>
                  <p-select appendTo="body" [options]="annees" [(ngModel)]="anneeSelectionnee"
                            (onChange)="charger()" class="w-32 shrink-0"/>
                  <p-button icon="pi pi-chevron-right" [text]="true" [rounded]="true"
                            [disabled]="!peutAvancer()" (onClick)="anneeSuivante()"
                            [ariaLabel]="t.projection.anneeSuivante"/>
              </div>
          </div>

          <!-- ── Skeletons ─────────────────────────────────────────────────────── -->
          @if (chargement()) {
              <div class="grid grid-cols-2 lg:grid-cols-4 gap-4">
                  @for (i of [1, 2, 3, 4]; track i) {
                      <p-skeleton height="104px" borderRadius="12px"/>
                  }
              </div>
              <div class="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                  @for (i of [1, 2, 3]; track i) {
                      <p-skeleton height="260px" borderRadius="12px"/>
                  }
              </div>
              <p-skeleton height="340px" borderRadius="12px"/>
              <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                  @for (i of [1, 2]; track i) {
                      <p-skeleton height="260px" borderRadius="12px"/>
                  }
              </div>
              <p-skeleton height="400px" borderRadius="12px"/>

          } @else if (projection()) {
              <!-- ①bis Cartes membre + foyer (revenus/charges/réserves/solde annuels, décomposition) -->
              @if (ventilationAnnuelle()) {
                  <div class="flex items-center justify-between gap-2 mb-1">
                      <p-selectbutton [options]="vueDecompositionOptions" [ngModel]="vueDecomposition()"
                                      (ngModelChange)="vueDecomposition.set($event)"
                                      optionLabel="label" optionValue="value" [allowEmpty]="false"/>
                      @if (afficherParMembre()) {
                          <p-selectbutton [options]="vueOptions" [ngModel]="vue()" (ngModelChange)="vue.set($event)"
                                          optionLabel="label" optionValue="value" [allowEmpty]="false"
                                          class="shrink-0"/>
                      }
                  </div>
                  @if (vueEffective() !== 'MEMBRE') {
                      <div class="grid grid-cols-1 gap-4 mb-4">
                          <app-carte-bilan variante="foyer" [nom]="t.projection.foyer"
                                           [sousTitre]="foyerSousTitreAnnuel()"
                                           [initiales]="foyerInitiales()"
                                           [montantPrincipalLabel]="t.projection.resteAVivreAnnee"
                                           [montantPrincipal]="ventilationAnnuelle()!.agregat.soldeDisponible"
                                           [devise]="deviseBase()" [lignes]="foyerLignesActuellesAnnuel()"
                                           [tauxEffort]="tauxEffortAnnuel()"/>
                      </div>
                  }

                  @if (afficherParMembre() && vueEffective() !== 'FOYER') {
                      <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                          @for (mc of membresDataAnnuel(); track mc.id) {
                              <app-carte-bilan variante="membre" [nom]="mc.nom" [sousTitre]="mc.sousTitre"
                                               [couleur]="mc.couleur" [initiales]="mc.initiales"
                                               [montantPrincipalLabel]="t.projection.resteAVivreAnnee"
                                               [montantPrincipal]="mc.agregat.soldeDisponible"
                                               [devise]="deviseBase()" [lignes]="lignesMembreAnnuel(mc)"
                                               [tauxEffort]="mc.tauxEffort"/>
                          }
                      </div>
                  }
              }

              @if (vueEffective() !== 'MEMBRE') {
                  <!-- Flux mensuel ────────────────────────── -->
                  <p-card>
                      <ng-template #header>
                          <div class="px-5 pt-5 pb-0 flex flex-col sm:flex-row sm:items-start gap-2 sm:gap-4">
                              <div class="flex-1">
                                  <div class="font-semibold text-base">{{ t.projection.fluxMensuels }} {{ anneeSelectionnee }}</div>
                                  <div class="text-xs text-surface-400 mt-0.5">{{ t.projection.legendeGraphiqueMixte }}</div>
                              </div>
                              <div class="flex flex-wrap gap-3 text-xs text-surface-500 shrink-0">
                 <span class="flex items-center gap-1.5">
                   <span class="inline-block w-3 h-3 rounded bg-red-400 opacity-80"></span>{{ t.projection.charges }}
                 </span>
                                  <span class="flex items-center gap-1.5">
                   <span class="inline-block w-3 h-3 rounded bg-blue-400 opacity-80"></span>{{ t.projection.reserves }}
                 </span>
                                  <span class="flex items-center gap-1.5">
                   <span class="inline-block w-5 h-0.5 bg-green-500 rounded mt-px"></span>{{ t.projection.revenus }}
                 </span>
                              </div>
                          </div>
                      </ng-template>
                      <div class="pt-4">
                          <p-chart type="bar" [data]="$any(mixedChartData())" [options]="mixedChartOptions"
                                   class="w-full block" style="height:320px"/>
                      </div>
                  </p-card>
                  <!-- Tableau mensuel ─────────────────────────────────────── -->
                  <p-card>
                      <ng-template #header>
                          <div class="px-5 pt-5 pb-3 flex items-center gap-2">
                              <i class="pi pi-table text-surface-400"></i>
                              <span class="font-semibold text-base">{{ t.projection.detailMensuel }} {{ anneeSelectionnee }}</span>
                          </div>
                      </ng-template>

                      <!-- Desktop / tablette : table scrollable -->
                      <div class="hidden sm:block overflow-x-auto">
                          <p-table [value]="projection()!.mois" class="p-datatable-sm p-datatable-striped" scrollable>
                              <ng-template #header>
                                  <tr>
                                      <th class="min-w-16">{{ t.projection.mois }}</th>
                                      <th class="text-right">{{ t.projection.revenus }}</th>
                                      <th class="text-right">{{ t.projection.charges }}</th>
                                      <th class="text-right">{{ t.projection.reserves }}</th>
                                      <th class="text-right">{{ t.projection.solde }}</th>
                                  </tr>
                              </ng-template>
                              <ng-template #body let-m>
                                  <tr>
                                      <td class="font-medium">{{ t.mois[m.numero - 1] }}</td>
                                      <td class="text-right text-green-600 tabular-nums">{{ m.agregat.revenus | montant }}</td>
                                      <td class="text-right text-red-500 tabular-nums">{{ m.agregat.charges | montant }}</td>
                                      <td class="text-right text-blue-500 tabular-nums">{{ m.agregat.reserves | montant }}</td>
                                      <td class="text-right font-semibold tabular-nums"
                                          [class.text-emerald-600]="m.agregat.soldeDisponible >= 0"
                                          [class.text-red-500]="m.agregat.soldeDisponible < 0">
                                          {{ m.agregat.soldeDisponible | montant }}
                                      </td>
                                  </tr>
                              </ng-template>
                              <ng-template #footer>
                                  <tr class="font-bold bg-surface-100 dark:bg-surface-800">
                                      <td>{{ t.projection.totalAnnee }}</td>
                                      <td class="text-right text-green-600 tabular-nums">{{ projection()!.totalAnnuel.revenus | montant }}</td>
                                      <td class="text-right text-red-500 tabular-nums">{{ projection()!.totalAnnuel.charges | montant }}</td>
                                      <td class="text-right text-blue-500 tabular-nums">{{ projection()!.totalAnnuel.reserves | montant }}</td>
                                      <td class="text-right tabular-nums"
                                          [class.text-emerald-600]="projection()!.totalAnnuel.soldeDisponible >= 0"
                                          [class.text-red-500]="projection()!.totalAnnuel.soldeDisponible < 0">
                                          {{ projection()!.totalAnnuel.soldeDisponible | montant }}
                                      </td>
                                  </tr>
                              </ng-template>
                          </p-table>
                      </div>
                  </p-card>
              }

              <!-- Flux mensuel par membre ──────────── -->
              @if (afficherParMembre() && vueEffective() !== 'FOYER') {
                  <p-card>
                      <div>
                          <div class="flex items-center gap-3 mb-4">
                              <div class="h-px flex-1 bg-surface-200 dark:bg-surface-700"></div>
                              <span class="text-xs font-bold text-surface-400 uppercase tracking-widest flex items-center gap-2">
                                    <i class="pi pi-users text-sm"></i>&nbsp;Contribution par membre
                                  </span>
                              <div class="h-px flex-1 bg-surface-200 dark:bg-surface-700"></div>
                          </div>
                          <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                              @for (mc of membreChartsData(); track mc.membreId) {
                                  <p-card>
                                      <ng-template #header>
                                          <div class="px-5 pt-4 pb-2 flex items-center gap-3">
                     <span class="inline-block w-4 h-4 rounded-full border-2 border-surface-0 shadow"
                           [style.background-color]="mc.couleur"></span>
                                              <span class="font-semibold">{{ mc.nom }}</span>
                                              <span class="ml-auto text-xs text-surface-400">{{ anneeSelectionnee }}</span>
                                          </div>
                                      </ng-template>
                                      <p-chart type="bar" [data]="$any(mc.data)" [options]="mixedChartOptions"
                                               class="w-full block" style="height:220px"/>

                                      <!-- Détail mensuel par membre -->
                                      <div class="mt-4">
                                          <div class="text-xs font-semibold text-surface-400 uppercase tracking-wide mb-2 flex items-center gap-1.5">
                                              <i class="pi pi-table text-xs"></i>{{ t.projection.detailMensuelParMembre }}
                                          </div>

                                          <!-- Desktop / tablette : table scrollable -->
                                          <div class="hidden sm:block overflow-x-auto">
                                              <p-table [value]="mc.mois" class="p-datatable-sm p-datatable-striped"
                                                       scrollable>
                                                  <ng-template #header>
                                                      <tr>
                                                          <th class="min-w-14">{{ t.projection.mois }}</th>
                                                          <th class="text-right">{{ t.projection.revenus }}</th>
                                                          <th class="text-right">{{ t.projection.charges }}</th>
                                                          <th class="text-right">{{ t.projection.reserves }}</th>
                                                          <th class="text-right">{{ t.projection.solde }}</th>
                                                      </tr>
                                                  </ng-template>
                                                  <ng-template #body let-m>
                                                      <tr>
                                                          <td class="font-medium">{{ t.mois[m.numero - 1] }}</td>
                                                          <td class="text-right text-green-600 tabular-nums">{{ m.agregat.revenus | montant }}</td>
                                                          <td class="text-right text-red-500 tabular-nums">{{ m.agregat.charges | montant }}</td>
                                                          <td class="text-right text-blue-500 tabular-nums">{{ m.agregat.reserves | montant }}</td>
                                                          <td class="text-right font-semibold tabular-nums"
                                                              [class.text-emerald-600]="m.agregat.soldeDisponible >= 0"
                                                              [class.text-red-500]="m.agregat.soldeDisponible < 0">
                                                              {{ m.agregat.soldeDisponible | montant }}
                                                          </td>
                                                      </tr>
                                                  </ng-template>
                                                  <ng-template #footer>
                                                      <tr class="font-bold bg-surface-100 dark:bg-surface-800">
                                                          <td>{{ t.projection.totalAnnee }}</td>
                                                          <td class="text-right text-green-600 tabular-nums">{{ mc.total.revenus | montant }}</td>
                                                          <td class="text-right text-red-500 tabular-nums">{{ mc.total.charges | montant }}</td>
                                                          <td class="text-right text-blue-500 tabular-nums">{{ mc.total.reserves | montant }}</td>
                                                          <td class="text-right tabular-nums"
                                                              [class.text-emerald-600]="mc.total.soldeDisponible >= 0"
                                                              [class.text-red-500]="mc.total.soldeDisponible < 0">
                                                              {{ mc.total.soldeDisponible | montant }}
                                                          </td>
                                                      </tr>
                                                  </ng-template>
                                              </p-table>
                                          </div>

                                          <!-- Mobile : cartes compactes par mois -->
                                          <div class="sm:hidden space-y-2">
                                              @for (m of mc.mois; track m.numero) {
                                                  <div class="rounded-xl bg-surface-50 dark:bg-surface-800 p-3">
                                                      <div class="flex items-center justify-between mb-2">
                                                          <span class="font-semibold text-sm w-10">{{ t.mois[m.numero - 1] }}</span>
                                                          <span class="text-sm font-bold tabular-nums"
                                                                [class.text-emerald-600]="m.agregat.soldeDisponible >= 0"
                                                                [class.text-red-500]="m.agregat.soldeDisponible < 0">
                            {{ m.agregat.soldeDisponible | montant }}
                          </span>
                                                      </div>
                                                      <div class="grid grid-cols-3 gap-1 text-center">
                                                          <div>
                                                              <div class="text-xs text-surface-400">{{ t.projection.revenus }}</div>
                                                              <div class="text-xs font-semibold text-green-600 tabular-nums">{{ m.agregat.revenus | montant }}</div>
                                                          </div>
                                                          <div>
                                                              <div class="text-xs text-surface-400">{{ t.projection.charges }}</div>
                                                              <div class="text-xs font-semibold text-red-500 tabular-nums">{{ m.agregat.charges | montant }}</div>
                                                          </div>
                                                          <div>
                                                              <div class="text-xs text-surface-400">{{ t.projection.reserves }}</div>
                                                              <div class="text-xs font-semibold text-blue-500 tabular-nums">{{ m.agregat.reserves | montant }}</div>
                                                          </div>
                                                      </div>
                                                  </div>
                                              }
                                              <div class="rounded-xl bg-surface-100 dark:bg-surface-700 p-3 border border-surface-200 dark:border-surface-600">
                                                  <div class="flex items-center justify-between mb-2">
                                                      <span class="font-bold text-sm">{{ t.projection.totalAnnee }}</span>
                                                      <span class="font-bold text-sm tabular-nums"
                                                            [class.text-emerald-600]="mc.total.soldeDisponible >= 0"
                                                            [class.text-red-500]="mc.total.soldeDisponible < 0">
                          {{ mc.total.soldeDisponible | montant }}
                        </span>
                                                  </div>
                                                  <div class="grid grid-cols-3 gap-1 text-center">
                                                      <div>
                                                          <div class="text-xs text-surface-400">{{ t.projection.revenus }}</div>
                                                          <div class="text-xs font-semibold text-green-600 tabular-nums">{{ mc.total.revenus | montant }}</div>
                                                      </div>
                                                      <div>
                                                          <div class="text-xs text-surface-400">{{ t.projection.charges }}</div>
                                                          <div class="text-xs font-semibold text-red-500 tabular-nums">{{ mc.total.charges | montant }}</div>
                                                      </div>
                                                      <div>
                                                          <div class="text-xs text-surface-400">{{ t.projection.reserves }}</div>
                                                          <div class="text-xs font-semibold text-blue-500 tabular-nums">{{ mc.total.reserves | montant }}</div>
                                                      </div>
                                                  </div>
                                              </div>
                                          </div>
                                      </div>
                                  </p-card>
                              }
                          </div>
                      </div>
                  </p-card>
                  <!-- Prorata mois par mois ─────────────────────────── -->
                  <p-card>
                      <div>
                          <div class="flex items-center gap-3 mb-4">
                              <div class="h-px flex-1 bg-surface-200 dark:bg-surface-700"></div>
                              <span class="text-xs font-bold text-surface-400 uppercase tracking-widest flex items-center gap-2">
              <i class="pi pi-percentage text-sm"></i>&nbsp;{{ t.projection.prorataTitre }}
            </span>
                              <div class="h-px flex-1 bg-surface-200 dark:bg-surface-700"></div>
                          </div>

                          @for (pd of prorataData(); track pd.membreId) {
                              <p-card class="mb-4">
                                  <ng-template #title>{{ t.projection.prorataTitre }}</ng-template>
                                  <ng-template #subtitle>{{ t.projection.prorataSousTitre }}</ng-template>

                                  <!-- Bande des périodes de répartition -->
                                  <div class="flex w-full rounded-md overflow-hidden mb-2"
                                       style="padding-left: 50px">
                                      @for (tag of periodeTags(); track tag.id; let index = $index) {
                                          <div [style.flex-basis.%]="tag.largeurPct" class="shrink-0 min-w-0">
                                              <p-tag [value]="tag.libelle"
                                                     [severity]="index % 2 == 0  ? 'contrast' : 'secondary'"
                                                     class="w-full justify-center rounded-none"/>
                                          </div>
                                      }
                                  </div>

                                  <p-chart type="line" [data]="$any(pd.chartData)" [options]="prorataChartOptions"
                                           class="w-full"/>

                                  <ng-template #footer>
                                      <p class="text-sm text-surface-400">
                                          {{ t.projection.prorataMoyenneReelle }} : <span
                                              class="font-bold text-surface-700 dark:text-surface-200">{{ formatPct1(pd.moyenneReelle) }}
                                          %</span>
                                          ·
                                          {{ t.projection.prorataConvenuPondere }} : <span
                                              class="font-bold text-surface-700 dark:text-surface-200">{{ formatPct1(pd.convenuPondere) }}
                                          %</span>
                                          · <span
                                              class="font-bold text-red-500">{{ formatMontantSansDevise(pd.ecartMontant) }} {{ deviseBase() }}</span>
                                          {{ pd.sens === 'sur' ? t.projection.prorataSurpaiement : t.projection.prorataSouspaiement }}
                                          {{ t.projection.prorataApproximatifPour }} {{ pd.nom }}.
                                      </p>
                                  </ng-template>
                              </p-card>
                          }
                      </div>

                      <!-- Mobile : cartes compactes par mois -->
                      <div class="sm:hidden space-y-2">
                          @for (m of projection()!.mois; track m.numero) {
                              <div class="rounded-xl bg-surface-50 dark:bg-surface-800 p-3">
                                  <div class="flex items-center justify-between mb-2">
                                      <span class="font-semibold text-sm w-10">{{ t.mois[m.numero - 1] }}</span>
                                      <span class="text-sm font-bold tabular-nums"
                                            [class.text-emerald-600]="m.agregat.soldeDisponible >= 0"
                                            [class.text-red-500]="m.agregat.soldeDisponible < 0">
                    {{ m.agregat.soldeDisponible | montant }}
                  </span>
                                  </div>
                                  <div class="grid grid-cols-3 gap-1 text-center">
                                      <div>
                                          <div class="text-xs text-surface-400">{{ t.projection.revenus }}</div>
                                          <div class="text-xs font-semibold text-green-600 tabular-nums">{{ m.agregat.revenus | montant }}</div>
                                      </div>
                                      <div>
                                          <div class="text-xs text-surface-400">{{ t.projection.charges }}</div>
                                          <div class="text-xs font-semibold text-red-500 tabular-nums">{{ m.agregat.charges | montant }}</div>
                                      </div>
                                      <div>
                                          <div class="text-xs text-surface-400">{{ t.projection.reserves }}</div>
                                          <div class="text-xs font-semibold text-blue-500 tabular-nums">{{ m.agregat.reserves | montant }}</div>
                                      </div>
                                  </div>
                              </div>
                          }
                          <div class="rounded-xl bg-surface-100 dark:bg-surface-700 p-3 border border-surface-200 dark:border-surface-600">
                              <div class="flex items-center justify-between mb-2">
                                  <span class="font-bold text-sm">{{ t.projection.totalAnnee }}</span>
                                  <span class="font-bold text-sm tabular-nums"
                                        [class.text-emerald-600]="projection()!.totalAnnuel.soldeDisponible >= 0"
                                        [class.text-red-500]="projection()!.totalAnnuel.soldeDisponible < 0">
                  {{ projection()!.totalAnnuel.soldeDisponible | montant }}
                </span>
                              </div>
                              <div class="grid grid-cols-3 gap-1 text-center">
                                  <div>
                                      <div class="text-xs text-surface-400">{{ t.projection.revenus }}</div>
                                      <div class="text-xs font-semibold text-green-600 tabular-nums">{{ projection()!.totalAnnuel.revenus | montant }}</div>
                                  </div>
                                  <div>
                                      <div class="text-xs text-surface-400">{{ t.projection.charges }}</div>
                                      <div class="text-xs font-semibold text-red-500 tabular-nums">{{ projection()!.totalAnnuel.charges | montant }}</div>
                                  </div>
                                  <div>
                                      <div class="text-xs text-surface-400">{{ t.projection.reserves }}</div>
                                      <div class="text-xs font-semibold text-blue-500 tabular-nums">{{ projection()!.totalAnnuel.reserves | montant }}</div>
                                  </div>
                              </div>
                          </div>
                      </div>
                  </p-card>
              }
          }
      </div>
  `,
})
export class DashboardAnnuelComponent implements OnInit {
  private readonly i18n = inject(I18nService);
  readonly t = this.i18n.translations();
  private contexte     = inject(ContexteService);
  private projSvc      = inject(ProjectionService);
  private categorieSvc = inject(CategorieService);
  private compteSvc    = inject(CompteService);
  private posteSvc     = inject(PosteService);
  private objectifSvc  = inject(ObjectifService);
  private decomp       = inject(DecompositionService);

  projection  = signal<ProjectionAnnuelleDto | null>(null);
  chargement  = signal(false);
  membres     = this.contexte.membres;

  // ── Décomposition annuelle (catégorie/type-poste/compte, cascade perso/partagé) ──
  // Sommée côté client à partir des 12 ventilations mensuelles de l'année sélectionnée
  // (aucun endpoint annuel dédié à la décomposition côté backend).
  categories        = signal<CategorieDto[]>([]);
  comptes           = signal<CompteDto[]>([]);
  postes            = signal<PosteDto[]>([]);
  objectifs         = signal<ObjectifDto[]>([]);
  ventilationAnnuelle = signal<VentilationLike | null>(null);

  readonly deviseBase = this.contexte.deviseBase;

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

  // ── Vue Catégorie / Type de poste (perso vs partagé) / Compte pour la décomposition ───
  vueDecomposition = signal<'CATEGORIE' | 'TYPE_POSTE' | 'COMPTE'>('TYPE_POSTE');
  readonly vueDecompositionOptions = [
    { label: this.t.projection.vueCategorie,  value: 'CATEGORIE'  },
    { label: this.t.projection.vueTypePoste,  value: 'TYPE_POSTE' },
    { label: this.t.projection.vueCompte,     value: 'COMPTE'     },
  ];

  private etaitMonoMembre = false;

  anneeSelectionnee = new Date().getFullYear();
  annees: number[]  = Array.from({ length: 9 }, (_, i) => new Date().getFullYear() + i);

  /** Peut-on reculer d'une année sans sortir de l'horizon du scénario (années disponibles) ? */
  peutReculer(): boolean {
    return this.anneeSelectionnee > this.annees[0];
  }

  /** Peut-on avancer d'une année sans sortir de l'horizon du scénario (années disponibles) ? */
  peutAvancer(): boolean {
    return this.anneeSelectionnee < this.annees[this.annees.length - 1];
  }

  /** Navigue vers l'année précédente. */
  anneePrecedente(): void {
    if (!this.peutReculer()) return;
    this.anneeSelectionnee -= 1;
    this.charger();
  }

  /** Navigue vers l'année suivante. */
  anneeSuivante(): void {
    if (!this.peutAvancer()) return;
    this.anneeSelectionnee += 1;
    this.charger();
  }

  // ── Helpers formatage ──────────────────────────────────────��────────────────
  private readonly fmtCompact = (v: number) =>
    Intl.NumberFormat('fr-CH', { notation: 'compact', maximumFractionDigits: 1 }).format(v);

  readonly fmtMensuel = (v: number) =>
    Intl.NumberFormat('fr-CH', { notation: 'compact', maximumFractionDigits: 0 }).format(v / 12);

  soldeCardBorder = computed(() =>
    (this.projection()?.totalAnnuel.soldeDisponible ?? 0) >= 0
      ? 'border-emerald-500'
      : 'border-red-500'
  );

  // ── Options Chart.js ────────────────────────────────────────────────────────
  readonly mixedChartOptions = {
    responsive: true, maintainAspectRatio: false,
    plugins: { legend: { display: false } },
    scales: {
      x: { grid: { display: false } },
      y: {
        ticks: { callback: (v: any) => this.fmtCompact(Number(v)) },
        grid:  { color: 'rgba(128,128,128,0.08)' },
      },
    },
  };

  // ── Computed chart data ─────────────────────────────────────────────────────
  mixedChartData = computed(() => this.buildFoyerChartData(this.projection()?.mois));

  private buildFoyerChartData(mois: { agregat: AggregatDto }[] | undefined): object {
    if (!mois || !mois.length) return {};
    return {
      labels: this.t.mois,
      datasets: [
        {
          type: 'bar', label: this.t.projection.charges,
          backgroundColor: 'rgba(239,68,68,0.75)',
          data: mois.map(m => m.agregat.charges),
          stack: 'depenses',
        },
        {
          type: 'bar', label: this.t.projection.reserves,
          backgroundColor: 'rgba(59,130,246,0.75)',
          data: mois.map(m => m.agregat.reserves),
          stack: 'depenses',
        },
        {
          type: 'line', label: this.t.projection.revenus,
          borderColor: '#22c55e', backgroundColor: 'rgba(34,197,94,0.08)',
          data: mois.map(m => m.agregat.revenus),
          tension: 0.3, fill: false, pointRadius: 4, borderWidth: 2,
        },
      ],
    };
  }

  membreChartsData = computed(() => {
    const p = this.projection();
    if (!p) return [];
    return this.membres().map(m => {
      const moisData = p.moisParMembre[m.id];
      return {
        membreId: m.id,
        nom:      m.nom,
        couleur:  m.couleur,
        data:     this.buildMembreChartData(moisData),
        dataReel: this.buildMembreChartData(p.moisParMembreReel?.[m.id]),
        mois:     this.buildMembreMois(moisData),
        total:    this.buildMembreTotal(moisData),
      };
    });
  });

  private buildMembreMois(moisData: AggregatDto[] | undefined): { numero: number; agregat: AggregatDto }[] {
    if (!moisData || !moisData.length) return [];
    return moisData.map((agregat, i) => ({ numero: i + 1, agregat }));
  }

  private buildMembreTotal(moisData: AggregatDto[] | undefined): AggregatDto {
    const zero: AggregatDto = { revenus: 0, charges: 0, reserves: 0, soldeDisponible: 0 };
    if (!moisData || !moisData.length) return zero;
    return moisData.reduce((acc, ag) => ({
      revenus:         acc.revenus + ag.revenus,
      charges:         acc.charges + ag.charges,
      reserves:        acc.reserves + ag.reserves,
      soldeDisponible: acc.soldeDisponible + ag.soldeDisponible,
    }), zero);
  }

  private buildMembreChartData(moisData: AggregatDto[] | undefined): object {
    if (!moisData || !moisData.length) return {};
    return {
      labels: this.t.mois,
      datasets: [
        {
          type: 'bar', label: this.t.projection.charges,
          backgroundColor: 'rgba(239,68,68,0.75)',
          data: moisData.map(ag => ag.charges),
          stack: 'depenses',
        },
        {
          type: 'bar', label: this.t.projection.reserves,
          backgroundColor: 'rgba(59,130,246,0.75)',
          data: moisData.map(ag => ag.reserves),
          stack: 'depenses',
        },
        {
          type: 'line', label: this.t.projection.revenus,
          borderColor: '#22c55e', backgroundColor: 'rgba(34,197,94,0.08)',
          data: moisData.map(ag => ag.revenus),
          tension: 0.3, fill: false, pointRadius: 4, borderWidth: 2,
        },
      ],
    };
  }

  // ── Le vrai prorata, mois par mois ──────────────────────────────────────────

  formatPct1(v: number): string {
    return Intl.NumberFormat('fr-CH', { minimumFractionDigits: 1, maximumFractionDigits: 1 }).format(v);
  }

  formatMontantSansDevise(v: number): string {
    return Intl.NumberFormat('fr-CH', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(Math.abs(v));
  }

  /** Quote-part (en %) configurée pour un membre à un mois donné de l'année sélectionnée. */
  private quotePartConvenue(membreId: string, mois: number): number {
    const sc = this.contexte.scenarioCourant();
    if (!sc) return 0;
    const jour = new Date(Date.UTC(this.anneeSelectionnee, mois - 1, 15));
    const periode = sc.periodes.find(p => {
      const debutOk = !p.debut || new Date(p.debut) <= jour;
      const finOk = !p.fin || new Date(p.fin) >= jour;
      return debutOk && finOk;
    });
    if (periode) {
      return (periode.parts.find(p => p.membreId === membreId)?.quotePart ?? 0) * 100;
    }
    return (sc.repartitions.find(r => r.membreId === membreId)?.quotePart ?? 0) * 100;
  }

  /** Bande de tags des périodes de répartition, dimensionnée selon les mois couverts sur l'année sélectionnée. */
  periodeTags = computed(() => {
    const sc = this.contexte.scenarioCourant();
    if (!sc || !sc.periodes.length) return [];
    const anneeDebut = new Date(Date.UTC(this.anneeSelectionnee, 0, 1));
    const anneeFin = new Date(Date.UTC(this.anneeSelectionnee, 11, 31));
    return sc.periodes
      .map(p => {
        const debut = p.debut ? new Date(p.debut) : anneeDebut;
        const fin = p.fin ? new Date(p.fin) : anneeFin;
        const debutEff = debut < anneeDebut ? anneeDebut : debut;
        const finEff = fin > anneeFin ? anneeFin : fin;
        if (debutEff > finEff) return null;
        const moisDebut = debutEff.getUTCMonth() + 1;
        const moisFin = finEff.getUTCMonth() + 1;
        return {
          id: p.id,
          libelle: p.parts.map(part => this.formatPctEntier(part.quotePart * 100)).join(' / '),
          largeurPct: ((moisFin - moisDebut + 1) / 11) * 100,
        };
      })
      .filter((t): t is { id: string; libelle: string; largeurPct: number } => !!t);
  });

  private formatPctEntier(v: number): string {
    return Intl.NumberFormat('fr-CH', { maximumFractionDigits: 0 }).format(v);
  }

  readonly prorataChartOptions = {
    responsive: true, maintainAspectRatio: false,
    plugins: { legend: { display: true, position: 'top' as const, align: 'end' as const },
      tooltip: { callbacks: { label: (ctx: any) => `${ctx.dataset.label} : ${this.formatPct1(ctx.parsed.y)} %` } } },
    scales: {
      x: { grid: { display: false } },
      y: { min: 0, max: 100, ticks: { stepSize: 20, callback: (v: any) => `${v} %` }, grid: { color: 'rgba(128,128,128,0.08)' } },
    },
  };

  prorataData = computed(() => {
    const p = this.projection();
    if (!p) return [];
    return this.membres().map(m => {
      const revenusFoyer = p.mois.map(mo => mo.agregat.revenus);
      const revenusMembre = (p.moisParMembre[m.id] ?? []).map(ag => ag.revenus);
      const convenuSerie = Array.from({ length: 12 }, (_, i) => this.quotePartConvenue(m.id, i + 1));
      const reelSerie = revenusFoyer.map((total, i) => total > 0 ? (revenusMembre[i] ?? 0) / total * 100 : 0);

      const moyenneReelle = reelSerie.reduce((s, v) => s + v, 0) / (reelSerie.length || 1);
      const totalRevenusFoyer = revenusFoyer.reduce((s, v) => s + v, 0);
      const convenuPondere = totalRevenusFoyer > 0
        ? convenuSerie.reduce((s, v, i) => s + v * revenusFoyer[i], 0) / totalRevenusFoyer
        : convenuSerie.reduce((s, v) => s + v, 0) / (convenuSerie.length || 1);

      const ecartMontant = Math.abs(convenuPondere - moyenneReelle) / 100 * totalRevenusFoyer;
      const sens: 'sur' | 'sous' = convenuPondere >= moyenneReelle ? 'sur' : 'sous';

      return {
        membreId: m.id, nom: m.nom, couleur: m.couleur,
        moyenneReelle, convenuPondere, ecartMontant, sens,
        chartData: {
          labels: this.t.moisLettre,
          datasets: [
            {
              type: 'line', label: this.t.projection.prorataConvenu,
              data: convenuSerie, stepped: true,
              borderColor: 'var(--p-text-muted-color)', backgroundColor: 'transparent',
              borderWidth: 2, pointRadius: 0,
            },
            {
              type: 'line', label: this.t.projection.prorataReel,
              data: reelSerie, tension: 0,
              borderColor: m.couleur, backgroundColor: m.couleur,
              borderWidth: 2, pointRadius: 3,
            },
          ],
        },
      };
    });
  });

  // ── Cartes membre + foyer annuelles (décomposition catégorie/type-poste/compte) ──

  foyerInitiales = computed(() => this.decomp.initiales(this.contexte.foyerCourant()?.nom ?? this.t.projection.foyer));

  foyerSousTitreAnnuel = computed(() => {
    const nbMembres = this.membres().length;
    const scenarioNom = this.contexte.scenarioCourant()?.nom ?? '';
    return `${nbMembres} ${this.t.projection.membres} · ${this.t.projection.scenarioMot} ${scenarioNom}`;
  });

  tauxEffortAnnuel = computed(() => this.decomp.tauxEffort(this.ventilationAnnuelle()?.agregat ?? { revenus: 0, charges: 0, reserves: 0, soldeDisponible: 0 }));

  private compteLibelleAnnuel(id: string): string {
    return this.decomp.compteLibelle(id, this.comptes());
  }

  private categorieMontantParMembreAnnuel(categorieId: string, membreId: string): number {
    return (this.ventilationAnnuelle()?.parCategorieMembre ?? {})[categorieId]?.[membreId] ?? 0;
  }

  /** Décomposition foyer par catégorie/type de poste (agrégat annuel sommé). */
  foyerDecompositionAnnuel = computed<LigneDecomposition[]>(() => {
    const v = this.ventilationAnnuelle();
    if (!v) return [];
    const cats = this.categories();
    const makeList = (type: TypeCategorie) => this.decomp.listeParCategorie(type, cats, catId => v.parCategorie[catId] ?? 0);
    return this.decomp.construireDecomposition({
      revenus:  makeList('REVENU'),
      charges:  makeList('CHARGE'),
      reserves: makeList('RESERVE'),
    }, this.objectifs());
  });

  /** Décomposition foyer par compte : somme des contributions de tous les membres, par compte (agrégat annuel). */
  foyerCompteDecompositionAnnuel = computed<LigneDecomposition[]>(() => {
    const v = this.ventilationAnnuelle();
    if (!v) return [];
    return Object.entries(v.parCompteMembre ?? {})
      .map(([compteId, memMap]) => ({
        id: compteId,
        libelle: this.compteLibelleAnnuel(compteId),
        montantAbs: Object.values(memMap).reduce((s, m) => s + m, 0),
        signe: -1 as const,
        tags: this.decomp.membresTagsCompte(compteId, this.comptes(), this.membres()),
      }))
      .filter(c => c.montantAbs !== 0)
      .sort((a, b) => b.montantAbs - a.montantAbs);
  });

  foyerCascadeDecompositionAnnuel = computed<LigneDecomposition[]>(() => {
    const v = this.ventilationAnnuelle();
    if (!v) return [];
    return this.decomp.foyerCascadeDecomposition(v, this.membres());
  });

  /** Lignes affichées dans la carte foyer annuelle, selon le mode de décomposition sélectionné. */
  foyerLignesActuellesAnnuel = computed(() => {
    switch (this.vueDecomposition()) {
      case 'CATEGORIE':  return this.foyerDecompositionAnnuel();
      case 'COMPTE':     return this.foyerCompteDecompositionAnnuel();
      default:           return this.foyerCascadeDecompositionAnnuel();
    }
  });

  /** Lignes affichées dans la carte d'un membre annuelle, selon le mode de décomposition sélectionné. */
  lignesMembreAnnuel(mc: {
    decomposition: LigneDecomposition[];
    cascadeDecomposition: LigneDecomposition[];
    compteDecomposition: LigneDecomposition[];
  }): LigneDecomposition[] {
    switch (this.vueDecomposition()) {
      case 'CATEGORIE':  return mc.decomposition;
      case 'COMPTE':     return mc.compteDecomposition;
      default:           return mc.cascadeDecomposition;
    }
  }

  membresDataAnnuel = computed(() => {
    const v = this.ventilationAnnuelle();
    if (!v) return [];
    const zero: VentilationAggregatDto = { revenus: 0, charges: 0, reserves: 0, soldeDisponible: 0 };
    const cats = this.categories();
    const nbMembres = this.membres().length;
    const scenario = this.contexte.scenarioCourant();
    return this.membres().map(m => {
      const agregat: VentilationAggregatDto = (v.parMembre ?? {})[m.id] ?? zero;
      const tauxEffort = this.decomp.tauxEffort(agregat);
      const chargesParCompte = Object.entries(v.parCompteMembre ?? {})
        .map(([compteId, memMap]) => ({
          id: compteId,
          libelle: this.compteLibelleAnnuel(compteId),
          montant: memMap[m.id] ?? 0,
        }))
        .filter(c => c.montant > 0)
        .sort((a, b) => b.montant - a.montant);

      const makeList = (type: TypeCategorie) => cats
        .filter(c => c.typePoste === type)
        .map(c => ({ id: c.id, libelle: c.libelle, montant: this.categorieMontantParMembreAnnuel(c.id, m.id) }))
        .filter(r => r.montant !== 0)
        .sort((a, b) => b.montant - a.montant);

      return {
        id: m.id, nom: m.nom, couleur: m.couleur,
        initiales: this.decomp.initiales(m.nom),
        sousTitre: this.decomp.sousTitreQuotePartDefaut(scenario, m.id),
        decomposition: this.decomp.construireDecomposition({
          revenus: makeList('REVENU'),
          charges: makeList('CHARGE'),
          reserves: makeList('RESERVE'),
        }, this.objectifs()),
        cascadeDecomposition: this.decomp.construireCascadeDecomposition(m.id, agregat, v, nbMembres),
        compteDecomposition: chargesParCompte.map(c => ({
          id: c.id, libelle: c.libelle, montantAbs: c.montant, signe: -1 as const,
          tags: this.decomp.membresTagsCompte(c.id, this.comptes(), this.membres(), m.id),
        })),
        agregat, tauxEffort,
      };
    });
  });

  // ── Effets & chargement ─────────────────────────────────────────────────────

  private readonly _initEffect = effect(() => {
    const sc = this.contexte.scenarioCourant();
    const foyerId = this.contexte.foyerId();
    if (sc) {
      this.annees = Array.from({ length: sc.horizonAnnees }, (_, i) => sc.anneeDepart + i);
      this.anneeSelectionnee = sc.anneeDepart;
    }
    if (foyerId && sc) {
      forkJoin([
        this.categorieSvc.lister(foyerId),
        this.compteSvc.lister(foyerId),
        this.posteSvc.lister(foyerId, sc.id),
        this.objectifSvc.lister(foyerId, sc.id),
      ]).subscribe(([cats, cptes, postes, objectifs]) => {
        this.categories.set(cats);
        this.comptes.set(cptes);
        this.postes.set(postes);
        this.objectifs.set(objectifs);
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

  /**
   * Somme 12 ventilations mensuelles (`VentilationsDto`) en un agrégat annuel de même
   * forme — utilisé pour la décomposition catégorie/type-poste/compte des cartes membre
   * + foyer annuelles (pas d'endpoint backend dédié à cette décomposition annuelle).
   */
  private sommerVentilations(mois: VentilationsDto[]): VentilationLike {
    const agregat: VentilationAggregatDto = { revenus: 0, charges: 0, reserves: 0, soldeDisponible: 0 };
    const parMembre: Record<string, VentilationAggregatDto> = {};
    const parCategorie: Record<string, number> = {};
    const parCategorieMembre: Record<string, Record<string, number>> = {};
    const parCompteMembre: Record<string, Record<string, number>> = {};
    const parMembreSplit: Record<string, VentilationSplitDto> = {};

    for (const v of mois) {
      agregat.revenus         += v.agregat.revenus;
      agregat.charges         += v.agregat.charges;
      agregat.reserves        += v.agregat.reserves;
      agregat.soldeDisponible += v.agregat.soldeDisponible;

      for (const [mId, ag] of Object.entries(v.parMembre ?? {})) {
        const acc = parMembre[mId] ??= { revenus: 0, charges: 0, reserves: 0, soldeDisponible: 0 };
        acc.revenus += ag.revenus; acc.charges += ag.charges; acc.reserves += ag.reserves; acc.soldeDisponible += ag.soldeDisponible;
      }
      for (const [catId, montant] of Object.entries(v.parCategorie ?? {})) {
        parCategorie[catId] = (parCategorie[catId] ?? 0) + montant;
      }
      for (const [catId, memMap] of Object.entries(v.parCategorieMembre ?? {})) {
        const acc = parCategorieMembre[catId] ??= {};
        for (const [mId, montant] of Object.entries(memMap)) acc[mId] = (acc[mId] ?? 0) + montant;
      }
      for (const [compteId, memMap] of Object.entries(v.parCompteMembre ?? {})) {
        const acc = parCompteMembre[compteId] ??= {};
        for (const [mId, montant] of Object.entries(memMap)) acc[mId] = (acc[mId] ?? 0) + montant;
      }
      for (const [mId, split] of Object.entries(v.parMembreSplit ?? {})) {
        const acc = parMembreSplit[mId] ??= {
          revenusPerso: 0, revenusPartage: 0, chargesPerso: 0, chargesPartage: 0, reservesPerso: 0, reservesPartage: 0,
        };
        acc.revenusPerso    += split.revenusPerso;
        acc.revenusPartage  += split.revenusPartage;
        acc.chargesPerso    += split.chargesPerso;
        acc.chargesPartage  += split.chargesPartage;
        acc.reservesPerso   += split.reservesPerso;
        acc.reservesPartage += split.reservesPartage;
      }
    }

    return { agregat, parMembre, parCategorie, parCategorieMembre, parCompteMembre, parMembreSplit };
  }

  charger(): void {
    const foyerId    = this.contexte.foyerId();
    const scenarioId = this.contexte.scenarioId();
    if (!foyerId || !scenarioId) return;
    this.chargement.set(true);
    this.projSvc.annuelle(foyerId, scenarioId, this.anneeSelectionnee).subscribe({
      next: p => { this.projection.set(p); this.chargement.set(false); },
      error: () => this.chargement.set(false),
    });

    const requetesMois = Array.from({ length: 12 }, (_, i) =>
      this.projSvc.mensuelle(foyerId, scenarioId, this.anneeSelectionnee, i + 1)
    );
    forkJoin(requetesMois).subscribe({
      next: mois => this.ventilationAnnuelle.set(this.sommerVentilations(mois)),
      error: () => this.ventilationAnnuelle.set(null),
    });
  }
}
