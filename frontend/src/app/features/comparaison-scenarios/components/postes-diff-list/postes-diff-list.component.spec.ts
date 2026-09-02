import { TestBed } from '@angular/core/testing';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { TranslateService } from '@ngx-translate/core';
import { I18nService } from '../../../../core/i18n/i18n.service';
import { PosteDiffRow } from '../../data/comparaison-scenarios.models';
import { PostesDiffListComponent } from './postes-diff-list.component';

const LIGNES: PosteDiffRow[] = [
  { cle: 'a', description: 'Loyer', type: 'CHARGE', periodiciteMois: 1, mode: 'MENSUALISE', moment: 'DEBUT_PERIODE', nature: 'EFFECTIF', statut: 'INCHANGE', estRevision: false, montantAnnuelA: 12000, montantAnnuelB: 12000, montantAvant: 1000, montantApres: 1000, effetNet: 0 },
  { cle: 'b', description: 'Nouvelle charge', type: 'CHARGE', periodiciteMois: 1, mode: 'MENSUALISE', moment: 'DEBUT_PERIODE', nature: 'EFFECTIF', statut: 'AJOUTE', estRevision: false, montantAnnuelA: null, montantAnnuelB: 960, montantAvant: null, montantApres: 80, effetNet: -960 },
  { cle: 'c', description: 'Vieil abonnement', type: 'CHARGE', periodiciteMois: 1, mode: 'MENSUALISE', moment: 'DEBUT_PERIODE', nature: 'EFFECTIF', statut: 'SUPPRIME', estRevision: false, montantAnnuelA: 600, montantAnnuelB: null, montantAvant: 50, montantApres: null, effetNet: 600 },
  { cle: 'd', description: 'Assurance', type: 'CHARGE', periodiciteMois: 1, mode: 'MENSUALISE', moment: 'DEBUT_PERIODE', nature: 'EFFECTIF', statut: 'MODIFIE', estRevision: true, montantAnnuelA: 1000, montantAnnuelB: 1200, montantAvant: 1000, montantApres: 1200, effetNet: -200 },
];

const TRANSLATIONS = {
  comparaisonScenarios: {
    postesDiff: {
      filtreChangements: 'Changements uniquement',
      filtreTout: 'Tous les postes',
      filtreAjoutes: 'Ajoutés',
      filtreSupprimes: 'Supprimés',
      filtreModifies: 'Modifiés',
      statutAjoute: 'Ajouté',
      statutSupprime: 'Supprimé',
      statutModifie: 'Modifié',
      statutInchange: 'Inchangé',
      revision: 'Révision',
      aucunePoste: 'Aucun poste ne correspond à ce filtre.',
      compteur: '{ajoute} {mAjoute} · {supprime} {mSupprime} · {modifie} {mModifie} · {inchange} {mInchange}',
      mAjouteSingulier: 'ajouté', mAjoutePluriel: 'ajoutés',
      mSupprimeSingulier: 'supprimé', mSupprimePluriel: 'supprimés',
      mModifieSingulier: 'modifié', mModifiePluriel: 'modifiés',
      mInchangeSingulier: 'inchangé', mInchangePluriel: 'inchangés',
      periodicitePonctuel: 'ponctuel', periodiciteMensuel: 'mensuel',
      periodicitePeriodique: '{n} mois · échéance {moment}',
      periodiciteMensualise: '{n} mois · mensualisé',
      momentDebut: 'début', momentFin: 'fin',
      des: 'dès {date}', jusquAu: 'jusqu\'au {date}',
      estimation: 'estimation',
      montantChange: 'montant {ancien} → {nouveau} {devise}',
      effetAn: '/ an', sansEffet: 'sans effet',
    },
  },
};

describe('PostesDiffListComponent', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [PostesDiffListComponent],
      providers: [
        provideNoopAnimations(),
        { provide: TranslateService, useValue: { currentLang: () => 'fr' } },
        { provide: I18nService, useValue: { currentLang: () => 'fr', translations: () => TRANSLATIONS } },
      ],
    }).compileComponents();
  });

  it('filtre "changements uniquement" par défaut, en excluant les postes inchangés', () => {
    const fixture = TestBed.createComponent(PostesDiffListComponent);
    fixture.componentRef.setInput('lignes', LIGNES);
    fixture.detectChanges();
    const cmp = fixture.componentInstance as unknown as { lignesFiltrees: () => PosteDiffRow[] };
    expect(cmp.lignesFiltrees().some(l => l.statut === 'INCHANGE')).toBe(false);
    expect(cmp.lignesFiltrees().length).toBe(3);
  });

  it('affiche tous les postes (y compris inchangés) quand le filtre "TOUT" est actif', () => {
    const fixture = TestBed.createComponent(PostesDiffListComponent);
    fixture.componentRef.setInput('lignes', LIGNES);
    fixture.detectChanges();
    const cmp = fixture.componentInstance as unknown as {
      filtre: { set: (v: string) => void };
      lignesFiltrees: () => PosteDiffRow[];
    };
    cmp.filtre.set('TOUS');
    expect(cmp.lignesFiltrees().length).toBe(4);
  });

  it('filtre uniquement les postes ajoutés', () => {
    const fixture = TestBed.createComponent(PostesDiffListComponent);
    fixture.componentRef.setInput('lignes', LIGNES);
    fixture.detectChanges();
    const cmp = fixture.componentInstance as unknown as {
      filtre: { set: (v: string) => void };
      lignesFiltrees: () => PosteDiffRow[];
    };
    cmp.filtre.set('AJOUT');
    expect(cmp.lignesFiltrees().every(l => l.statut === 'AJOUTE')).toBe(true);
    expect(cmp.lignesFiltrees().length).toBe(1);
  });
});


