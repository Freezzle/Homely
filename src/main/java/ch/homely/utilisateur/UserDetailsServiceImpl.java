package ch.homely.utilisateur;

import org.springframework.security.core.userdetails.User;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.security.core.userdetails.UserDetailsService;
import org.springframework.security.core.userdetails.UsernameNotFoundException;
import org.springframework.stereotype.Service;

/**
 * Chargement de l'utilisateur par email pour Spring Security.
 */
@Service
public class UserDetailsServiceImpl implements UserDetailsService {

    private final UtilisateurRepository utilisateurRepo;

    public UserDetailsServiceImpl(UtilisateurRepository utilisateurRepo) {
        this.utilisateurRepo = utilisateurRepo;
    }

    @Override
    public UserDetails loadUserByUsername(String email) throws UsernameNotFoundException {
        return utilisateurRepo.findByEmail(email)
                .map(u -> User.builder()
                        .username(u.getEmail())
                        .password(u.getMotDePasseHash())
                        .roles("USER")
                        .accountExpired(false)
                        .accountLocked(!u.isActif())
                        .credentialsExpired(false)
                        .disabled(!u.isActif())
                        .build())
                .orElseThrow(() -> new UsernameNotFoundException(
                        "Utilisateur introuvable : " + email));
    }
}
