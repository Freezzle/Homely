import { Component, inject, signal, effect } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MessageModule } from 'primeng/message';
import { SkeletonModule } from 'primeng/skeleton';
import { ConfirmDialogModule } from 'primeng/confirmdialog';
import { MenuModule } from 'primeng/menu';
import { MessageService, ConfirmationService, MenuItem } from 'primeng/api';
import { ContexteService } from '../../../core/services/contexte.service';
import { RepartitionPeriodeService } from '../../../core/services/scenario-poste.service';
import { RepartitionPeriodeDto } from '../../../core/models/api.models';
import { PctPipe } from '../../../core/pipes/format.pipes';
import { I18nService } from '../../../core/i18n/i18n.service';
import { ButtonComponent } from '../../../shared/components/button/button.component';
import { TagComponent } from '../../../shared/components/tag/tag.component';
import { toIsoDateLocal, parseIsoDateLocal } from '../../../core/utils/date.util';
import { notifierSucces, notifierErreur } from '../../../core/utils/toast.util';
import { PeriodeFormDialogComponent, RepartitionPeriodeRequest } from './periode-form-dialog/periode-form-dialog.component';
import { PeriodeRevisionDialogComponent } from './periode-revision-dialog/periode-revision-dialog.component';
import { PeriodeDecalageDialogComponent } from './periode-decalage-dialog/periode-decalage-dialog.component';

/**
 * Écran <b>Prorata des membres</b> — gestion des périodes de répartition (prorata)
 * du scénario courant. Reprend la logique de l'ancien {@code RepartitionPeriodesComponent}
 * (auparavant affiché en dialog depuis la liste des scénarios), désormais en page pleine
 * à l'instar de {@code ArgentPocheComponent} : en-tête + créer, états chargement/vide, liste.
 * Le formulaire de création/édition d'une période reste en dialog.
 */
@Component({
  selector: 'app-prorata-membres',
  standalone: true,
  providers: [ConfirmationService],
  imports: [CommonModule, ButtonComponent,
    MessageModule, SkeletonModule, ConfirmDialogModule, MenuModule,
    PctPipe, TagComponent,
    PeriodeFormDialogComponent, PeriodeRevisionDialogComponent, PeriodeDecalageDialogComponent],
  templateUrl: './prorata-membres.component.html',
})
export class ProrataMembresComponent {
  private readonly i18n = inject(I18nService);
  readonly t = this.i18n.translations();

  contexte = inject(ContexteService);
  private periodeSvc = inject(RepartitionPeriodeService);
  private toast = inject(MessageService);
  private confirm = inject(ConfirmationService);

  periodes = signal<RepartitionPeriodeDto[]>([]);
  chargement = signal(false);
  membres = this.contexte.membres;
  scenarioCourant = this.contexte.scenarioCourant;
  formVisible = false;
  periodeEnEdition: RepartitionPeriodeDto | null = null;

  /** Foyer mono-membre : le prorata ne se pose pas. */
  get monoMembre(): boolean {
    return this.membres().length === 1;
  }

  private readonly _chargerEffect = effect(() => {
    const foyerId = this.contexte.foyerId();
    const scenario = this.scenarioCourant();
    if (foyerId && scenario && !this.monoMembre) this.chargerPeriodes();
  });

  private chargerPeriodes(): void {
    const foyerId = this.contexte.foyerId();
    const scenario = this.scenarioCourant();
    if (!foyerId || !scenario) return;
    this.chargement.set(true);
    this.periodeSvc.lister(foyerId, scenario.id).subscribe({
      next: p => { this.periodes.set(p); this.chargement.set(false); },
      error: (err) => { this.chargement.set(false); notifierErreur(this.toast, this.t.commun.erreur, err); },
    });
  }

  ouvrirCreation(): void {
    this.periodeEnEdition = null;
    this.formVisible = true;
  }

  ouvrirEdition(p: RepartitionPeriodeDto): void {
    this.periodeEnEdition = p;
    this.formVisible = true;
  }

  /** La popin a validé sa saisie : il ne reste qu'à persister et recharger. */
  enregistrer(req: RepartitionPeriodeRequest): void {
    const foyerId = this.contexte.foyerId()!;
    const scenarioId = this.scenarioCourant()!.id;

    const obs = this.periodeEnEdition
      ? this.periodeSvc.modifier(foyerId, scenarioId, this.periodeEnEdition.id, req)
      : this.periodeSvc.creer(foyerId, scenarioId, req);

    obs.subscribe({
      next: () => {
        notifierSucces(this.toast, this.t.commun.succes);
        this.formVisible = false;
        this.chargerPeriodes();
      },
      error: (err) => notifierErreur(this.toast, this.t.commun.erreur, err),
    });
  }

  confirmerSuppression(p: RepartitionPeriodeDto): void {
    this.confirm.confirm({
      message: this.t.commun.confirmerSuppression,
      accept: () => {
        const foyerId = this.contexte.foyerId()!;
        const scenarioId = this.scenarioCourant()!.id;
        this.periodeSvc.supprimer(foyerId, scenarioId, p.id).subscribe({
          next: () => {
            notifierSucces(this.toast, this.t.commun.succes);
            this.chargerPeriodes();
          },
          error: (err) => notifierErreur(this.toast, this.t.commun.erreur, err),
        });
      },
    });
  }

  private toIso(d: Date): string { return toIsoDateLocal(d); }

  /** Menu d'actions (icône + popup), sur le modèle de {@code PostesListeComponent}. */
  actionItemsFor(p: RepartitionPeriodeDto): MenuItem[] {
    const items: MenuItem[] = [];
    if (this.contexte.estEditor()) {
      items.push({ label: this.t.commun.modifier, icon: 'pi pi-pencil', command: () => this.ouvrirEdition(p) });
      if (this.estRevisable(p)) {
        items.push({ label: this.t.prorata.reviserTaux, icon: 'pi pi-sync', command: () => this.ouvrirRevision(p) });
      }
      if (this.estFusionnable(p)) {
        items.push({ label: this.t.prorata.annulerRevision, icon: 'pi pi-replay', command: () => this.annulerRevision(p) });
      }
      if (this.estDecalable(p)) {
        items.push({ label: this.t.prorata.decalerDateEffet, icon: 'pi pi-arrows-h', command: () => this.ouvrirDecalage(p) });
      }
      items.push({ label: this.t.commun.supprimer, icon: 'pi pi-trash', command: () => this.confirmerSuppression(p) });
    }
    return items;
  }

  // ── Chaîne de périodes (contiguïté par les dates, pas de posteOrigineId/posteSuivantId) ──

  private readonly _aujourdHuiIso = toIsoDateLocal(new Date());

  /** Lendemain (ISO) d'une date ISO — utilisé pour tester la contiguïté entre deux périodes. */
  private lendemainIso(iso: string): string {
    const d = parseIsoDateLocal(iso);
    d.setDate(d.getDate() + 1);
    return toIsoDateLocal(d);
  }

  /** Période immédiatement contiguë avant {@code p} (dont la fin + 1 jour == le début de {@code p}), s'il y en a une. */
  predecesseurDe(p: RepartitionPeriodeDto): RepartitionPeriodeDto | null {
    if (!p.debut) return null;
    return this.periodes().find(q => q.id !== p.id && !!q.fin && this.lendemainIso(q.fin) === p.debut) ?? null;
  }

  /** Période immédiatement contiguë après {@code p} (dont le début == la fin de {@code p} + 1 jour), s'il y en a une. */
  successeurDe(p: RepartitionPeriodeDto): RepartitionPeriodeDto | null {
    if (!p.fin) return null;
    return this.periodes().find(q => q.id !== p.id && q.debut === this.lendemainIso(p.fin!)) ?? null;
  }

  /** Une période est révisable si elle n'est pas déjà entièrement passée (même règle que côté postes). */
  estRevisable(p: RepartitionPeriodeDto): boolean {
    return !p.fin || p.fin >= this._aujourdHuiIso;
  }

  /** Décalable si elle a un prédécesseur contigu (frontière déplaçable), y compris un maillon intermédiaire. */
  estDecalable(p: RepartitionPeriodeDto): boolean {
    return this.predecesseurDe(p) !== null;
  }

  /** Fusionnable (« Annuler la révision ») seulement si c'est le dernier maillon (pas de successeur). */
  estFusionnable(p: RepartitionPeriodeDto): boolean {
    return this.predecesseurDe(p) !== null && this.successeurDe(p) === null;
  }

  // ── Réviser les taux ───────────────────────────────────────
  revisionDialogVisible = false;
  periodeEnRevision: RepartitionPeriodeDto | null = null;

  ouvrirRevision(p: RepartitionPeriodeDto): void {
    this.periodeEnRevision = p;
    this.revisionDialogVisible = true;
  }

  onRevisionVisibleChange(visible: boolean): void {
    this.revisionDialogVisible = visible;
    if (!visible) this.periodeEnRevision = null;
  }

  // ── Décaler la date d'effet ────────────────────────────────
  decalageDialogVisible = false;
  periodeEnDecalage: RepartitionPeriodeDto | null = null;

  /** Prédécesseur immédiat de la période en cours de décalage (résolu à l'ouverture du dialog). */
  get predecesseurEnDecalage(): RepartitionPeriodeDto | null {
    return this.periodeEnDecalage ? this.predecesseurDe(this.periodeEnDecalage) : null;
  }

  ouvrirDecalage(p: RepartitionPeriodeDto): void {
    this.periodeEnDecalage = p;
    this.decalageDialogVisible = true;
  }

  onDecalageVisibleChange(visible: boolean): void {
    this.decalageDialogVisible = visible;
    if (!visible) this.periodeEnDecalage = null;
  }

  /** Rafraîchit la liste après une action réussie effectuée par un dialog enfant autonome (révision/décalage). */
  onDialogEnregistre(): void {
    this.chargerPeriodes();
  }

  /**
   * Annule la révision d'une période : supprime le dernier maillon et étend son
   * prédécesseur immédiat sur la place libérée. La suppression est effectuée
   * *avant* l'extension du prédécesseur pour éviter un chevauchement transitoire
   * refusé côté serveur.
   */
  annulerRevision(p: RepartitionPeriodeDto): void {
    const precedent = this.predecesseurDe(p);
    if (!precedent) return;

    this.confirm.confirm({
      message: this.t.prorata.annulerRevisionConfirmation,
      header: this.t.prorata.annulerRevisionTitre,
      accept: () => {
        const foyerId = this.contexte.foyerId()!;
        const scenarioId = this.scenarioCourant()!.id;
        this.periodeSvc.supprimer(foyerId, scenarioId, p.id).subscribe({
          next: () => {
            const req = {
              debut: precedent.debut,
              fin: p.fin,
              parts: precedent.parts.map(pp => ({ membreId: pp.membreId, quotePart: pp.quotePart })),
            };
            this.periodeSvc.modifier(foyerId, scenarioId, precedent.id, req).subscribe({
              next: () => { notifierSucces(this.toast, this.t.commun.succes); this.chargerPeriodes(); },
              error: (err) => notifierErreur(this.toast, this.t.commun.erreur, err),
            });
          },
          error: (err) => notifierErreur(this.toast, this.t.commun.erreur, err),
        });
      },
    });
  }
}
