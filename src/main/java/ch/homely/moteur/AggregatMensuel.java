package ch.homely.moteur;

/**
 * Agrégats d'un mois pour un périmètre donné (foyer ou un membre).
 *
 * @param revenus          total des postes REVENU (en devise de base)
 * @param charges          total des postes CHARGE
 * @param reserves         total des postes RESERVE
 * @param soldeDisponible  revenus - charges - reserves
 */
public record AggregatMensuel(
        double revenus,
        double charges,
        double reserves,
        double soldeDisponible
) {
    public static AggregatMensuel zero() {
        return new AggregatMensuel(0, 0, 0, 0);
    }

    public AggregatMensuel plus(AggregatMensuel other) {
        return new AggregatMensuel(
                this.revenus + other.revenus,
                this.charges + other.charges,
                this.reserves + other.reserves,
                this.soldeDisponible + other.soldeDisponible
        );
    }
}
