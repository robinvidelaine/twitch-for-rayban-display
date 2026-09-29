# Étape suivante — connexion et navigation Twitch

Préparation vérifiée le 29 septembre 2026. Aucun OAuth ni EventSub implémenté à ce stade : attendre le Client ID de l’application enregistrée. Le player existant reste opérationnel ; le Chat Embed reste uniquement le témoin temporaire du POC jusqu’au remplacement connecté.

## Configuration Twitch Developer

Dans https://dev.twitch.tv/console/apps, avec adresse email vérifiée et 2FA : Register Your Application.

- Nom proposé : `Ray Display Viewer POC` (doit être unique ; ajouter un suffixe si indisponible).
- Client Type : **Public**, pas Confidential.
- Catégorie : **Website Integration** si proposée ; sinon la catégorie correspondant à une application web.
- OAuth Redirect URL : le Device Code Grant n’utilise pas de callback. Si le formulaire exige une URL, ajouter `http://localhost:5500/` comme URL locale de développement ; aucune route OAuth à créer. Pour une future URL publique, utiliser l’URL HTTPS réelle du site, sans en inventer une.
- Create, puis Manage : récupérer uniquement le **Client ID public**. Aucun secret à générer ou communiquer.
- Les scopes sont demandés lors de l’autorisation, pas ajoutés comme permissions dans le dépôt : `user:read:follows user:read:chat`.

Le [Device Code Grant officiel](https://dev.twitch.tv/docs/authentication/getting-tokens-oauth/#device-code-grant-flow) prend en charge les clients Public sans secret, y compris le renouvellement. Twitch réserve actuellement ce type de client à ce flux : ne pas utiliser Public + Implicit. Le flux convient aux lunettes : code/lien affiché, consentement sur téléphone ou PC, puis connexion des lunettes. L’inscription est décrite dans [Register Your App](https://dev.twitch.tv/docs/authentication/register-app/).

## Session locale prévue

`auth.js` : POST `/oauth2/device`, afficher code et verification_uri retournés ; interroger `/oauth2/token` à l’intervalle fourni, gérer attente, expiration, refus et ralentissement sans boucler agressivement. Aucun appel avant action Connexion Twitch. Valider client_id, user_id et scopes à réception et restauration. Rotation du refresh token public à chaque usage ; un seul renouvellement simultané. Ne jamais journaliser les réponses contenant des tokens.

Première version : access/refresh tokens en mémoire et sessionStorage pour survivre à Ctrl+R dans le même onglet. Effacement à la déconnexion, fermeture de session et révocation ; préférences non sensibles dans localStorage. Aucune persistance longue automatique. Tout stockage navigateur reste lisible par le JavaScript de l’origine : ce n’est pas un coffre-fort ; les cookies HttpOnly ne peuvent pas être créés par notre frontend statique. Aucun token dans URL, diagnostic, Git ou fichier de configuration.

[/validate](https://dev.twitch.tv/docs/authentication/validate-tokens/) au démarrage et toutes les heures, contrôle après reprise du runtime ; 401/révocation termine la session et ferme le chat. L’identité de base ne nécessite pas user:read:email : user_id/login via validate, profil via Get Users. Aucune permission email, écriture, bot ou modération demandée.

Premier essai après configuration : vérifier les appels directs device/token/validate/Helix et leurs réponses CORS dans Chrome puis le runtime Meta. La documentation de flux ne valide pas à elle seule ce runtime. Si un appel est refusé, diagnostiquer l’origine et la réponse ; aucun proxy ou backend de contournement.

## Chat minimal sans serveur

`eventsub.js` gérera une connexion sortante vers `wss://eventsub.wss.twitch.tv/ws`. Après session_welcome, POST Helix `/eventsub/subscriptions` dans le délai documenté (10 secondes par défaut), avec user access token, Client-Id et :

```json
{
  "type": "channel.chat.message",
  "version": "1",
  "condition": { "broadcaster_user_id": "ID_CHAINE", "user_id": "ID_UTILISATEUR_CONNECTE" },
  "transport": { "method": "websocket", "session_id": "ID_SESSION_RECU" }
}
```

user_id doit correspondre au token autorisé. Le [scope requis](https://dev.twitch.tv/docs/eventsub/eventsub-subscription-types/#channelchatmessage) est user:read:chat avec ce user token ; les exigences supplémentaires de bot concernent le chemin app token, qui n’est pas utilisé ici.

`chat.js` deviendra un rendu local `Pseudo : message`, texte via textContent, couleurs validées, emotes/badges officiels optionnels. Liste bornée (par exemple 100 messages), aucune saisie/envoi, aucun HTML Twitch injecté. Prévoir les événements de suppression/clear avec le même scope pour retirer les messages supprimés, et dédupliquer les notifications. Aucun historique antérieur garanti.

Gérer keepalive, revocation, session_reconnect (URL reçue, transfert sans recréer les abonnements), et coupure franche (nouvelle session + réabonnement avec temporisation). Voir [cycle WebSocket officiel](https://dev.twitch.tv/docs/eventsub/handling-websocket-events/). Le runtime doit rester actif ; une suspension peut perdre des messages, sans replay garanti.

Afficher/masquer le chat ne fait que modifier le DOM local ; conserver une connexion et un tampon borné pendant la session. Changer de chaîne supprime l’ancien abonnement, vide le tampon et souscrit au nouveau canal. Le module chat ne reçoit aucune référence au player et ne peut appeler ses méthodes.

Layout final connecté : player 600×337,5, chat 600×262,5. La barre pourra recouvrir seulement notre chat local (avec espace de lecture réservé pendant son affichage), jamais la vidéo ; dimensions des deux zones stables. Jusqu’au remplacement du Chat Embed, conserver la barre sous les embeds pour ne pas masquer les contrôles Twitch.

## Suivis / Parcourir / Recherche

Modules prévus, à créer progressivement sans refonte du player :

| Responsabilité | Contrat / API |
| --- | --- |
| `auth.js` | session locale, connexion, validation, renouvellement, déconnexion |
| `twitch-api.js` | fetch Helix direct, en-têtes, pagination cursor, annulation requêtes obsolètes, 401/429 |
| `navigation.js` | écran actif, onglet, focus et retour à la carte sélectionnée |
| vues Suivis | GET `/streams/followed?user_id=…`, user:read:follows ; éventuellement `/channels/followed` pour les suivis hors ligne |
| vues Parcourir | GET `/games/top`, `/streams`, `/streams?game_id=…` |
| vues Recherche | GET `/search/channels?query=…`, `/search/categories?query=…` |
| player existant | une instance ; sélection d’une chaîne via setChannel(login), événements/getters toujours source de vérité |
| chat local | EventSub et affichage seuls, sans commande vidéo |

Les endpoints de navigation acceptent le user token ; aucune permission supplémentaire pour parcourir/rechercher. [Référence Helix](https://dev.twitch.tv/docs/api/reference/). Search Channels n’est pas un annuaire exhaustif de comptes ; l’API vise les chaînes ayant diffusé dans les six derniers mois.

Écran Connexion Twitch, puis onglets Suivis (défaut), Parcourir, Recherche. À 600×600 : onglets horizontaux, liste verticale de cartes streamer/titre/catégorie avec miniature compacte et chargement paginé. Gauche/droite pour onglets quand leur ligne a le focus, bas entre dans la liste, haut revient depuis la première carte, Entrée sélectionne. Retour explicite + Échap, focus mémorisé. Dans le lecteur, conserver les commandes existantes ; un bouton Retour vers les listes sera placé hors iframe. Recherche : champ natif pour PC et clavier à l’écran navigable au D-pad pour les lunettes, sans supposer une API vocale Meta. Interfaces françaises, titres et noms Twitch conservés tels que reçus.

Étapes après réception du Client ID : vérifier DCF direct, identité et Suivis d’abord ; intégrer le chat lecture seule ; ajouter Parcourir puis Recherche. Tests réels OAuth/chat/navigation et lunettes restent à faire. Aucun backend, base, secret ou service intermédiaire.
