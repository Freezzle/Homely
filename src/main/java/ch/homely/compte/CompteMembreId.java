package ch.homely.compte;

import java.io.Serializable;
import java.util.Objects;
import java.util.UUID;

/** Clé composite de {@link CompteMembre} (compte_id + membre_id). */
public class CompteMembreId implements Serializable {

    private UUID compte;
    private UUID membre;

    public CompteMembreId() {}

    public CompteMembreId(UUID compte, UUID membre) {
        this.compte = compte;
        this.membre = membre;
    }

    public UUID getCompte() { return compte; }
    public void setCompte(UUID compte) { this.compte = compte; }

    public UUID getMembre() { return membre; }
    public void setMembre(UUID membre) { this.membre = membre; }

    @Override
    public boolean equals(Object o) {
        if (this == o) return true;
        if (!(o instanceof CompteMembreId that)) return false;
        return Objects.equals(compte, that.compte) && Objects.equals(membre, that.membre);
    }

    @Override
    public int hashCode() {
        return Objects.hash(compte, membre);
    }
}
