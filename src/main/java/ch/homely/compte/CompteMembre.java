package ch.homely.compte;

import ch.homely.membre.Membre;
import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

/**
 * Entité d'association compte ↔ membre (table {@code compte_membre}), portant en plus
 * du rattachement le drapeau {@link #estPrimaire} : ce compte est-il le compte
 * "primaire" de ce membre (celui qui finance les virements entrants planifiés/de
 * comblement de ses autres comptes) ? Un membre ne peut avoir qu'un seul
 * {@code estPrimaire = true} à la fois (validé en service + contrainte unique
 * partielle en base sur {@code membre_id WHERE est_primaire}).
 */
@Entity
@Table(name = "compte_membre")
@IdClass(CompteMembreId.class)
@Getter @Setter @NoArgsConstructor
public class CompteMembre {

    @Id
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "compte_id")
    private Compte compte;

    @Id
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "membre_id")
    private Membre membre;

    @Column(name = "est_primaire", nullable = false)
    private boolean estPrimaire = false;

    public CompteMembre(Compte compte, Membre membre) {
        this.compte = compte;
        this.membre = membre;
    }
}
