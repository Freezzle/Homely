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

  // ── Thème dark/light ──────────────────────────────────────────────────────
  private readonly _dark = signal<boolean>(false);
  readonly isDark = this._dark.asReadonly();

  setFoyer(foyer: FoyerDto | null): void {
    this._foyer.set(foyer);
    if (!foyer) {
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
