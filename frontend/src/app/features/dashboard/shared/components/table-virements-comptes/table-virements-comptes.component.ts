import { ChangeDetectionStrategy, Component, computed, inject, input, output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TableModule } from 'primeng/table';
import { AvatarModule } from 'primeng/avatar';
import { AvatarGroupModule } from 'primeng/avatargroup';
import { TagModule } from 'primeng/tag';
import { SkeletonModule } from 'primeng/skeleton';
import { CheckboxComponent } from '../../../../../shared/components/form-fields/checkbox/checkbox.component';
import { I18nService } from '../../../../../core/i18n/i18n.service';
import { DecompositionService } from '../../../../../core/services/decomposition.service';
import { MontantPipe } from '../../../../../core/pipes/format.pipes';
import { CompteDto, MembreDto, VirementCompteDto } from '../../../../../core/models/api.models';

/** Compte enrichi de ses propriétaires effectifs (résolus depuis `comptes`/`membres`). */
interface CompteAvecProprietaires {
  id: string;
  libelle: string;
  proprietaires: MembreDto[];
}

/** Un virement enrichi de ses comptes source/destination résolus + statut "fait" local. */
interface VirementEnrichi {
  id: string;
  source: CompteAvecProprietaires;
  destination: CompteAvecProprietaires;
  montant: number;
  fait: boolean;
  interMembres: boolean;
  /** Vrai si le membre actuellement affiché n'est pas co-titulaire du compte source : il ne
   *  fait alors que "recevoir" ce virement (il ne peut pas le déclencher), la case "fait" est
   *  donc désactivée pour lui — seul un co-titulaire de la source peut la basculer. */
  basculeDesactivee: boolean;
}

interface SourceGroup {
  compteSource: CompteAvecProprietaires;
  virements: VirementEnrichi[];
  total: number;
}

/** Union des lignes affichées dans la `p-table` : soit un sous-en-tête de groupe (compte
 *  source), soit une ligne de virement. */
type LigneTable =
  | { type: 'subheader'; groupe: SourceGroup }
  | { type: 'data'; virement: VirementEnrichi };

/**
 * Table des virements inter-comptes à sous-en-têtes, groupée par compte source (1 source → N
 * destinations) — remplace l'ancienne vue hub/satellite (`ComptesHubRecapComponent`). Chaque
 * ligne se lit comme une phrase directionnelle (source → destination → montant) ; le statut
 * "fait/pas fait" est un drapeau cliquable purement binaire.
 *
 * <p>Composant standalone, réactif via signaux, sans dépendance à un contexte de page précis
 * (utilisable dans le dashboard mensuel/annuel comme dans un drawer d'indicateur). Le parent
 * est responsable de la source de vérité de l'état "fait" — voir {@link virementBascule} :
 * cet état n'est jamais persisté côté backend (le projet reste une prévision, pas un suivi du
 * réalisé), il vit en signal local côté parent et est remis à zéro à chaque rechargement des
 * données.</p>
 */
@Component({
  selector: 'app-table-virements-comptes',
  standalone: true,
  imports: [CommonModule, FormsModule, TableModule, AvatarModule, AvatarGroupModule, TagModule, SkeletonModule, CheckboxComponent, MontantPipe],
  templateUrl: './table-virements-comptes.component.html',
  styleUrl: './table-virements-comptes.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TableVirementsComptesComponent {
  private readonly i18n = inject(I18nService);
  private readonly decomp = inject(DecompositionService);
  protected readonly t = this.i18n.translations();

  /** Virements à afficher, non triés — le composant s'occupe du groupement par compte source. */
  readonly virements = input.required<readonly VirementCompteDto[]>();
  /** Référentiel des comptes du foyer (pour résoudre libellé + co-titulaires). */
  readonly comptes = input.required<readonly CompteDto[]>();
  /** Référentiel des membres du foyer (pour résoudre nom/couleur/initiales des co-titulaires). */
  readonly membres = input.required<readonly MembreDto[]>();
  /** Statut "fait" par virement (clé = `compteSourceId::compteDestinationId`), état local non
   *  persisté tenu par le parent. */
  readonly virementsFaits = input<ReadonlySet<string>>(new Set());
  /** Id du membre actuellement affiché (vue membre) — utilisé pour désactiver la case "fait"
   *  quand ce membre n'est pas co-titulaire du compte source du virement (il ne peut alors que
   *  constater le virement, pas le déclencher). `null` en vue foyer : rien n'est désactivé. */
  readonly membreActuelId = input<string | null>(null);
  /** Devise à afficher dans les montants. */
  readonly devise = input<string>('CHF');
  /** Affiche un état de chargement (squelette) à la place de la table. */
  readonly chargement = input<boolean>(false);

  /** Émis quand l'utilisateur clique sur le drapeau d'un virement — le parent tient l'état. */
  readonly virementBascule = output<{ virementId: string; fait: boolean }>();

  /** Clé stable d'un virement (pas d'id serveur — la paire source/destination l'identifie). */
  protected cleVirement(v: Pick<VirementCompteDto, 'compteSourceId' | 'compteDestinationId'>): string {
    return `${v.compteSourceId}::${v.compteDestinationId}`;
  }

  private readonly comptesEnrichis = computed<Map<string, CompteAvecProprietaires>>(() => {
    const membresParId = new Map(this.membres().map((m) => [m.id, m]));
    const map = new Map<string, CompteAvecProprietaires>();
    for (const c of this.comptes()) {
      map.set(c.id, {
        id: c.id,
        libelle: c.libelle,
        proprietaires: c.membreIds.map((id) => membresParId.get(id)).filter((m): m is MembreDto => !!m),
      });
    }
    return map;
  });

  private readonly virementsEnrichis = computed<VirementEnrichi[]>(() => {
    const comptes = this.comptesEnrichis();
    const faits = this.virementsFaits();
    const membreActuelId = this.membreActuelId();
    return this.virements().map((v) => {
      const source = comptes.get(v.compteSourceId) ?? { id: v.compteSourceId, libelle: v.libelleCompteSource, proprietaires: [] };
      const destination = comptes.get(v.compteDestinationId) ?? { id: v.compteDestinationId, libelle: v.libelleCompteDestination, proprietaires: [] };
      const cle = this.cleVirement(v);
      return {
        id: cle,
        source, destination,
        montant: v.montant,
        fait: faits.has(cle),
        interMembres: this.estInterMembres(source, destination),
        basculeDesactivee: membreActuelId != null && !source.proprietaires.some((m) => m.id === membreActuelId),
      };
    });
  });

  /** Groupes calculés (source → liste de virements sortants + total) — l'ordre des groupes
   *  suit l'ordre naturel des `virements()` reçus (le service trie en amont, pas le composant). */
  protected readonly groupes = computed<SourceGroup[]>(() => {
    const parSource = new Map<string, SourceGroup>();
    for (const v of this.virementsEnrichis()) {
      let groupe = parSource.get(v.source.id);
      if (!groupe) {
        groupe = { compteSource: v.source, virements: [], total: 0 };
        parSource.set(v.source.id, groupe);
      }
      groupe.virements.push(v);
      groupe.total += v.montant;
    }
    return [...parSource.values()];
  });

  /** Aplatit les groupes en une seule liste ordonnée exploitable par `p-table`. */
  protected readonly lignes = computed<LigneTable[]>(() => {
    const resultat: LigneTable[] = [];
    for (const groupe of this.groupes()) {
      resultat.push({ type: 'subheader', groupe });
      for (const virement of groupe.virements) {
        resultat.push({ type: 'data', virement });
      }
    }
    return resultat;
  });

  protected readonly aucunVirement = computed(() => !this.chargement() && this.virements().length === 0);

  /** Vrai si la source et la destination n'ont aucun propriétaire commun (remboursement
   *  inter-membres) — intersection des propriétaires des deux comptes. */
  private estInterMembres(source: CompteAvecProprietaires, destination: CompteAvecProprietaires): boolean {
    const ownersSource = new Set(source.proprietaires.map((m) => m.id));
    return destination.proprietaires.every((m) => !ownersSource.has(m.id));
  }

  protected initiales(membre: MembreDto): string {
    return this.decomp.initiales(membre.nom);
  }

  protected onBasculerStatut(v: VirementEnrichi, fait: boolean): void {
    if (v.basculeDesactivee) return;
    this.virementBascule.emit({ virementId: v.id, fait });
  }
}
