import { Injectable, signal, computed } from '@angular/core';
import { FoyerDto, ScenarioDto, MembreDto } from '../models/api.models';

/**
 * T9.2 — Contexte global de l'application (signals).
 * foyerCourant / scenarioCourant / membres du foyer courant.
 * Interdit : localStorage/sessionStorage pour l'état métier.
 */
@Injectable({ providedIn: 'root' })
export class ContexteService {
  // ── Foyer courant ─────────────────────────────────────────────────────────
  private readonly _foyer = signal<FoyerDto | null>(null);
  readonly foyerCourant = this._foyer.asReadonly();
  readonly foyerId = computed(() => this._foyer()?.id ?? null);
  readonly deviseBase = computed(() => this._foyer()?.deviseBase ?? 'CHF');
  readonly monRole = computed(() => this._foyer()?.monRole ?? null);

  // ── Computed signals de rôle — réactifs dans les templates ────────────────
  /** Vrai si EDITOR ou OWNER (peut créer/modifier/supprimer) */
  readonly estEditor = computed(() => {
    const r = this.monRole();
    return r === 'EDITOR' || r === 'OWNER';
  });
  /** Vrai si OWNER uniquement */
  readonly estOwner = computed(() => this.monRole() === 'OWNER');

  // ── Scénario courant ──────────────────────────────────────────────────────
  private readonly _scenario = signal<ScenarioDto | null>(null);
  readonly scenarioCourant = this._scenario.asReadonly();
  readonly scenarioId = computed(() => this._scenario()?.id ?? null);

  // ── Membres ───────────────────────────────────────────────────────────────
  private readonly _membres = signal<MembreDto[]>([]);
  readonly membres = this._membres.asReadonly();

  // Version incrémentale pour notifier les composants shell/topbar d'un refresh.
  private readonly _refreshVersion = signal<number>(0);
  readonly refreshVersion = this._refreshVersion.asReadonly();

  // ── Thème dark/light ──────────────────────────────────────────────────────
  private readonly _dark = signal<boolean>(false);
  readonly isDark = this._dark.asReadonly();

  /**
   * État d'ouverture de la sidebar (utilisé par le nouveau composant
   * `p-sidebar` v22 en mode `offcanvas`). Ouverte par défaut : visible
   * en desktop, et bascule en overlay sur mobile via `ViewportService`.
   */
  readonly sidebarOuverte = signal<boolean>(true);

  /** Bascule l'ouverture de la sidebar (utilisé par la topbar en mobile). */
  toggleSidebar(): void {
    this.sidebarOuverte.update(v => !v);
  }

  setFoyer(foyer: FoyerDto | null): void {
    const foyerAvant = this._foyer();
    this._foyer.set(foyer);
    // En cas de changement de foyer (ou suppression), vider le sous-contexte lié.
    if (!foyer || foyerAvant?.id !== foyer.id) {
      this._scenario.set(null);
      this._membres.set([]);
    }
  }

  setScenario(scenario: ScenarioDto | null): void {
    this._scenario.set(scenario);
  }

  setMembres(membres: MembreDto[]): void {
    this._membres.set(membres);
  }

  /** Force le rafraichissement des listes dépendantes (foyers/scenarios) dans le shell. */
  notifierRefresh(): void {
    this._refreshVersion.update(v => v + 1);
  }

  /** Réinitialise tout le contexte métier lors d'un changement de session. */
  reset(): void {
    this._foyer.set(null);
    this._scenario.set(null);
    this._membres.set([]);
    this.notifierRefresh();
  }

  toggleDark(): void {
    const dark = !this._dark();
    this._dark.set(dark);
    document.documentElement.classList.toggle('dark', dark);
  }

  /** Rétrocompatibilité — préférer estEditor()/estOwner() dans les templates */
  aLeRole(roleMinimum: 'OWNER' | 'EDITOR' | 'VIEWER'): boolean {
    const role = this.monRole();
    if (!role) return false;
    if (roleMinimum === 'VIEWER') return true;
    if (roleMinimum === 'EDITOR') return role === 'EDITOR' || role === 'OWNER';
    return role === 'OWNER';
  }
}
