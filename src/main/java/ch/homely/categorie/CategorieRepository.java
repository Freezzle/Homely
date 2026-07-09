package ch.homely.categorie;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface CategorieRepository extends JpaRepository<Categorie, UUID> {

    List<Categorie> findAllByFoyerIdAndActifTrueOrderByTypePosteAscOrdreAsc(UUID foyerId);

    List<Categorie> findAllByFoyerIdAndTypePosteAndActifTrueOrderByOrdre(UUID foyerId, TypeCategorie typePoste);

    Optional<Categorie> findByIdAndFoyerId(UUID id, UUID foyerId);
}
