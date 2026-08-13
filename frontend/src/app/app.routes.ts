import { Routes } from '@angular/router';
import { authGuard, roleGuard } from './core/guards/auth.guard';
import { redirectToCurrentYearGuard, dashboardLegacyRedirectGuard } from './features/dashboard/redirect-current-year.guard';

export const routes: Routes = [
  // ── Public ─────────────────────────────────────────────────────────────────
  {
    path: 'login',
    loadComponent: () => import('./features/auth/login/login.component').then(m => m.LoginComponent),
  },
  {
    path: 'register',
    loadComponent: () => import('./features/auth/register/register.component').then(m => m.RegisterComponent),
  },

  // ── Shell protégé ───────────────────────────────────────────────────────────
  {
    path: '',
    canActivate: [authGuard],
    loadComponent: () => import('./shell/shell.component').then(m => m.ShellComponent),
    children: [
      // Choix du foyer
      { path: '', redirectTo: 'foyers', pathMatch: 'full' },
      {
        path: 'foyers',
        loadComponent: () => import('./features/foyer/foyer-liste/foyer-liste.component').then(m => m.FoyerListeComponent),
      },
      {
        path: 'foyers/nouveau',
        loadComponent: () => import('./features/foyer/foyer-creation/foyer-creation.component').then(m => m.FoyerCreationComponent),
      },
      // Foyer courant
      {
        path: 'f/:foyerId',
        children: [
          { path: '', redirectTo: 'dashboard', pathMatch: 'full' },
          {
            path: 'dashboard',
            canActivate: [redirectToCurrentYearGuard],
            children: [],
          },
          {
            path: 'dashboard/:sujetId',
            canActivate: [redirectToCurrentYearGuard],
            children: [],
          },
          {
            path: 'dashboard/:sujetId/:annee',
            canActivate: [dashboardLegacyRedirectGuard],
            loadComponent: () => import('./features/dashboard/dashboard.component').then(m => m.DashboardComponent),
          },
          {
            path: 'dashboard/:sujetId/:annee/:mois',
            canActivate: [dashboardLegacyRedirectGuard],
            loadComponent: () => import('./features/dashboard/dashboard.component').then(m => m.DashboardComponent),
          },
          {
            path: 'revenus',
            loadComponent: () => import('./features/postes/postes-liste/postes-liste.component').then(m => m.PostesListeComponent),
            data: { type: 'REVENU' },
          },
          {
            path: 'charges',
            loadComponent: () => import('./features/postes/postes-liste/postes-liste.component').then(m => m.PostesListeComponent),
            data: { type: 'CHARGE' },
          },
          {
            path: 'reserves',
            loadComponent: () => import('./features/postes/postes-liste/postes-liste.component').then(m => m.PostesListeComponent),
            data: { type: 'RESERVE' },
          },
          {
            path: 'scenarios',
            loadComponent: () => import('./features/scenarios/scenarios-liste/scenarios-liste.component').then(m => m.ScenariosListeComponent),
          },
          {
            path: 'objectifs',
            loadComponent: () => import('./features/objectifs/objectifs.component').then(m => m.ObjectifsComponent),
          },
          {
            path: 'argent-poche',
            loadComponent: () => import('./features/argent-poche/argent-poche.component').then(m => m.ArgentPocheComponent),
          },
          {
            path: 'referentiels/membres',
            loadComponent: () => import('./features/referentiels/membres/membres.component').then(m => m.MembresComponent),
          },
          {
            path: 'referentiels/comptes',
            loadComponent: () => import('./features/referentiels/comptes/comptes.component').then(m => m.ComptesComponent),
          },
          {
            path: 'referentiels/categories',
            loadComponent: () => import('./features/referentiels/categories/categories.component').then(m => m.CategoriesComponent),
          },
          {
            path: 'referentiels/taux',
            loadComponent: () => import('./features/referentiels/taux/taux.component').then(m => m.TauxComponent),
          },
          {
            path: 'parametres',
            loadComponent: () => import('./features/parametres/parametres.component').then(m => m.ParametresComponent),
          },
          {
            path: 'acces',
            canActivate: [roleGuard('OWNER')],
            loadComponent: () => import('./features/parametres/acces/acces.component').then(m => m.AccesComponent),
          },
        ],
      },
    ],
  },
  { path: '**', redirectTo: 'login' },
];
