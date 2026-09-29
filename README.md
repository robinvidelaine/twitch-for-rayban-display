# Twitch for Ray-Ban Display

POC expérimental français pour **Meta Ray-Ban Display**, écran logique **600×600**, et **Meta Neural Band**. Vidéo d’abord ; commandes temporaires, lecteur Twitch et Chat Embed officiels. HTML/CSS/JavaScript natifs, frontend-only, compatible GitHub Pages. Aucun backend applicatif, BDD, proxy, analytics, secret ou dépendance de build. Twitch conserve ses propres services et cookies. Aucune licence choisie.

La chaîne actuelle est `kamet0`, conservée dans `CHANNEL` (`app.js`). Sa disponibilité en direct n’est pas garantie. La prochaine étape connectée est préparée dans [ARCHITECTURE.md](ARCHITECTURE.md) : configuration Twitch Developer, OAuth Public, chat EventSub, Suivis / Parcourir / Recherche. L’implémentation OAuth attend le Client ID ; le Chat Embed reste un témoin POC temporaire pendant cette transition.

## Test local Windows / VS Code

1. Ouvrir ce dossier dans VS Code. Utiliser **Live Server** de Ritwick Dey (`ritwickdey.LiveServer`, installé lors de la préparation).
2. Clic droit sur `index.html` → **Open with Live Server**.
3. Ouvrir **http://127.0.0.1:5500/** dans Chrome externe ; **http://localhost:5500/** convient aussi. Ni `file://`, ni Simple Browser ou prévisualisation imbriquée.
4. `F12`, `Ctrl+Maj+M`, Responsive, **600×600 pixels CSS**, type Desktop pour commencer. Cliquer dans la page pour quitter le focus DevTools.
5. Après modification, **Ctrl+R**. Le rechargement automatique de Live Server est désactivé pour préserver les mesures de continuité.
6. Arrêter avec `Ctrl+Maj+P` → **Live Server: Stop Live Server**. Si 5500 est occupé, utiliser le port annoncé.

Aucun Node.js ou Python à installer séparément. Le serveur de développement sert uniquement les fichiers statiques. Les deux embeds utilisent **`location.hostname`** comme `parent`, sans protocole, port ou chemin : `localhost` ou `127.0.0.1` en local, hostname GitHub Pages en production.

[Twitch autorise HTTP pour localhost/127.0.0.1](https://discuss.dev.twitch.com/t/twitch-embedded-player-updates-in-2020/23956/120). Hors boucle locale, utiliser HTTPS. Une IP LAN n’est pas localhost ; localhost sur les lunettes ne désigne pas le PC. Si le test local est refusé, vérifier Console/Réseau, domaine exact, chaîne et bloqueurs, puis essayer les mêmes fichiers sur GitHub Pages HTTPS. Aucun proxy, tunnel ou contournement des protections.

## Démarrage automatique et son

Au **READY**, une tentative `player.play()` avec son est envoyée. Le constructeur utilise `autoplay:false` pour éviter une tentative concurrente : l’application lance bien automatiquement la lecture dans READY. Si Twitch émet **PLAYBACK_BLOCKED** pendant cette tentative, le POC passe en muet et réessaie **une seule fois**. Si le runtime autorise le son, il est conservé. Aucun réglage du navigateur n’est contourné.

`PLAY` signifie démarrage/mise en tampon ; seul **PLAYING** annonce « Lecture en cours ». Si la tentative muette est elle aussi bloquée, les commandes sont affichées sans nouvelle relance. Un simple délai réseau ne suffit pas à conclure que l’autoplay sonore est interdit. Si le démarrage n’est pas confirmé, utiliser Lecture. Une action utilisateur Play/Pause annule le fallback en attente. Ouvrir/fermer la barre ne lance ni ne met en pause le stream.

READY et `isPaused() === false` seuls ne prouvent pas le démarrage : cette valeur a été observée avant le premier PLAY dans l’ancien POC. Le bouton tient compte des événements et de `isPaused()`, sans inverser optimistement son texte après un clic.

Le bouton audio interroge **getMuted() et getVolume() après READY**, puis toutes les 250 ms et après les commandes :

- réellement muet → **🔇 Muet**, même si le volume mémorisé est 100 % ;
- audio non muet, volume 100 % → **🔊 100%** ;
- audio non muet, volume 50 % → **🔊 50%** ;
- état pas encore disponible → **Son…**.

**Volume sélectionné : ↑ augmente et ↓ diminue par pas de 10 %, Entrée bascule Muet/Unmute sans modifier le niveau mémorisé.** Aucun mode édition. Modifier le niveau réactive le son comme auparavant. L’affichage vient toujours des getters Twitch ; le mute de l’onglet, du système ou des lunettes n’est pas exposé par cette API.

[Chrome autorise l’autoplay muet](https://developer.chrome.com/blog/autoplay) ; l’autoplay sonore dépend des autorisations et interactions. Le fallback muet est déclenché par le signal officiel Twitch, pas par une hypothèse sur le navigateur. Restrictions Twitch, publicité, compte, région, réseau et navigateur peuvent toujours intervenir.

### Meta : ce qui est documenté ou non

La [page officielle Meta Web Apps](https://developers.meta.com/wearables/web-apps/) confirme l’écran 600×600, les événements flèches/Entrée et les API Web standards. La [documentation détaillée](https://wearables.developer.meta.com/docs/develop/webapps/) renvoie « Not Logged In » dans l’environnement de vérification. Aucune différence d’autoplay avec Chrome desktop n’a pu être établie dans la documentation publique consultée. Ne pas extrapoler les réglages Android WebView/Quest au runtime Ray-Ban Display. Tester autoplay muet, activation sonore et focus sur le matériel ; aucun SDK Meta ajouté.

## Barre et navigation

**Chat | Lecture/Pause | Volume | Qualité**, toujours ancrée en bas à position fixe tant qu’elle est visible. Informations et bouton d’accès natif **au-dessus**. Aucun sous-menu. La barre réserve 112 pixels sous le lecteur et disparaît après six secondes sans interaction. Aucun élément ne recouvre l’iframe vidéo.

- Barre fermée : toute flèche ou Entrée **reçue par la page** la réaffiche sans déclencher d’action.
- **Gauche/droite en navigation** : bouton précédent/suivant, parmi les quatre boutons, en boucle.
- **Entrée sur Chat ou Lecture** : Chat ON/OFF ou Lecture/Pause.
- **Volume** : ↑/↓ ajustent directement ; Entrée bascule Muet sans forcer 100 %.
- **Qualité** : ↑ supérieure, ↓ inférieure, Entrée Auto uniquement si disponible. Tri des libellés réels par résolution puis fréquence ; pas de boucle aux extrémités. Depuis Auto : ↑ meilleure qualité fixe, ↓ plus basse. Les libellés non classables sont exclus du parcours vertical, sans inventer de résolution.
- Gauche/droite naviguent toujours ; aucun mode édition. Haut/bas sur les autres boutons ne font rien. Échap ferme la barre. Entrée maintenue ne répète pas l’action.

La qualité affichée est obtenue par **getQuality()** ; seuls les choix de **getQualities()** sont envoyés à **setQuality()**, y compris `auto` lorsqu’il existe. Aucun 1080p/720p inventé. Une demande peut prendre du temps ; le texte reste celui constaté par l’API. Un changement de qualité peut produire une brève transition interne PAUSE/PLAY sans recharger l’iframe.

## Focus : cause et correction

Diagnostic du précédent code sur flux réel : après `play()` via notre API, les flèches fonctionnaient encore dans le test automatisé. Après un **clic dans le lecteur natif**, `document.activeElement` devenait l’iframe ; les touches suivantes n’atteignaient plus la page, même après pause. Le diagnostic reproduit donc le transfert de focus cross-origin, pas une panne du gestionnaire clavier ni une perte systématique due à play seul.

En mode normal Web App, les événements standards **blur/focusin** détectent ce transfert ; la page redonne le focus à son contrôle sélectionné ou à `#app` lorsque la barre est fermée. Même vérification après les événements de lecture. Aucun accès au document Twitch, interception prétendue de touches cross-origin, polling de focus, CSS interne ou couche invisible. Un clic natif peut encore exécuter son action ; la récupération du focus n’annule pas ce clic.

Pour utiliser librement le lecteur ou le chat à la souris : cliquer **Contrôles Twitch** au-dessus de la barre (accessible aussi avec Tab). Dans ce mode explicite, aucun focus n’est repris et la barre reste visible pour offrir **Revenir aux commandes**, hors des iframes. Cliquer ce bouton réactive la navigation de l’application.

Une touche déjà envoyée à un document cross-origin n’est pas récupérable par le parent. Le mode natif ne promet donc pas de retour par flèche/Échap depuis Twitch. Les gestes Neural Band étant exposés comme événements clavier, cette frontière peut aussi les concerner ; valider le retour de focus standard sur lunettes avant de conclure à la compatibilité complète.

L’ancien autre bug (pause à l’ouverture du panneau) a été reproduit par recouvrement de la vidéo. La barre reste dans le flux **sous** le lecteur, conformément aux [exigences Twitch](https://dev.twitch.tv/docs/embed/). Aucune reprise forcée pour contourner ce comportement.

## Chat officiel restauré

`chat.js` crée le **Twitch Chat Embed** au premier passage en Compact avec le même hostname `parent`. Aucun login/OAuth applicatif requis pour demander l’affichage du chat public ; ses éventuelles restrictions restent celles de Twitch. Son header, ses menus et son champ d’envoi natifs restent intacts. L’envoi peut demander une connexion Twitch ; notre application n’ajoute aucune fonction d’écriture ou permission.

L’iframe du chat est conservée lors des bascules, comme celle du lecteur. Aucun scraping ni accès/modification du DOM interne. Le mode normal privilégie le clavier de l’application ; choisir Contrôles Twitch pour interagir librement avec le chat natif.

Sur le profil Chrome de test, Twitch a présenté son **consentement cookies** avant les messages. Utiliser Contrôles Twitch pour faire son choix dans l’iframe, puis Revenir aux commandes. Le POC ne choisit pas à votre place et ne masque pas cet écran. Ce consentement est distinct d’une connexion OAuth ; la lecture des messages après ce choix reste à confirmer dans votre session.

- Barre fermée, Chat OFF : vidéo **600×600**.
- Barre fermée, Chat ON : vidéo **600×337,5**, chat **600×262,5**.
- Barre ouverte, Chat ON : vidéo **600×337,5**, chat **600×150,5**, commandes **112 px**. Total : exactement 600 px.

En Compact, la vidéo utilise width:100% et aspect-ratio:16/9 ; le chat prend le reste par flex. Le ratio vidéo reste stable à l’ouverture de la barre. Celle-ci reste sous les embeds, car la superposer au chat masquerait ses contrôles Twitch. Le chat change donc temporairement de hauteur. Chat OFF, le comportement plein viewport est conservé. Toute bande interne résiduelle appartient au contenu ou au lecteur Twitch ; aucun étirement, recadrage ou espace mort ajouté. Le viewport de test reste 600×600 : à des largeurs inférieures à environ 534 px, un vrai 16:9 serait sous la hauteur minimale de 300 px exigée par Twitch.

Vérification de la documentation officielle Chat Embed : aucun paramètre documenté « messages uniquement », « lecture seule » ou masquant Bits, points, annonces et champ de saisie. Les paramètres documentés concernent l’URL/chaîne/parent, les dimensions et le sandbox. Le chat natif reste donc chargé, même avec davantage de hauteur ; aucune modification de l’iframe n’est tentée.

Pour afficher uniquement les messages, l’option propre envisagée est un rendu local alimenté par [EventSub WebSocket](https://dev.twitch.tv/docs/eventsub/handling-websocket-events/) et [channel.chat.message](https://dev.twitch.tv/docs/eventsub/eventsub-subscription-types/#channelchatmessage), avec authentification utilisateur et scope `user:read:chat`, sans permission d’écriture. Cela reste une décision ultérieure après essais lunettes : aucun OAuth/EventSub ajouté dans cette correction.

## Vérifications manuelles finales dans Chrome 600×600

Dernière vérification automatisée sur Chrome headless, avec un flux public temporaire de test : dimensions Compact 600×337,5 confirmées avec et sans barre ; chat 150,5/262,5 px ; retour à Auto confirmé par getQuality ; dix bascules sans changement d’iframe/source ni événement load. Le démarrage a produit PLAYING avec getMuted() vrai malgré la demande sonore, sans PLAYBACK_BLOCKED. Le fallback a été vérifié séparément avec des callbacks simulés : une seule relance muette, aucune boucle ni relance après PLAYING. Ce test simulé ne valide pas une politique réelle de navigateur.

Limites de ce dernier essai : les commandes audio ont été envoyées mais les getters sont restés muet/50 %. Une PAUSE sans commande applicative a été observée après ouverture du chat ; la demande de reprise par API n’a pas été confirmée avant un clic natif, qui a relancé la lecture. Le retour de focus et les flèches ont alors fonctionné. La cause de ces refus n’est pas établie ; ne pas attribuer automatiquement ces résultats à la publicité ou aux politiques d’autoplay. Refaire les étapes audio et Lecture/Pause dans Chrome interactif ; elles ne sont pas déclarées validées par cet essai. Aucun contournement ou reprise forcée ajouté.

La chaîne configurée peut être hors ligne ; distinguer les mesures de layout des validations sur flux réel. L’écoute humaine et les tests lunettes restent nécessaires.

1. **Ctrl+R**, sans interaction : vérifier la tentative sonore, puis le fallback muet si PLAYBACK_BLOCKED. Confirmer PLAYING et comparer le son aux getters. Hors ligne/blocage doit être signalé, jamais assimilé à une lecture.
2. Gauche/droite parcourent les quatre boutons. Sur Volume : ↑/↓ ajustent, Entrée mute/unmute ; vérifier que le niveau est conservé et comparer aux getters.
3. Tester Lecture/Pause après autoplay. En lecture puis en pause, ouvrir/fermer la barre et attendre son masquage : elle ne doit jamais changer la lecture.
4. Après démarrage, cliquer une fois la vidéo en mode Web App puis utiliser une flèche : la barre doit revenir. Le clic natif lui-même peut mettre en pause. Tester également après Pause.
5. Sur Qualité : ↑/↓ parcourent les résolutions/fréquences en ordre, sans boucle. Entrée revient à Auto si fourni, sinon signale son absence. Vérifier le focus et Entrée maintenue.
6. Chat ON/OFF dix fois : écouter la continuité. Vérifier vidéo 337,5 + chat 262,5 barre fermée, vidéo 337,5 + chat 150,5 + barre 112 ouverte ; vidéo 600 chat masqué et barre fermée. Aucun espace mort ni recréation.
7. Contrôles Twitch → interaction native → Revenir aux commandes → flèches. Vérifier le masquage automatique après le retour. Aucun fullscreen natif.

Diagnostic optionnel : ouvrir **http://127.0.0.1:5500/?debug=1**, reproduire, puis Console (contexte page principale) :

```js
console.table(pocDiagnostics());
({ paused: player.isPaused(), muted: player.getMuted(), volume: player.getVolume(), quality: player.getQuality(), focus: document.activeElement })
```

Le journal est uniquement en mémoire, limité à 200 entrées ; il distingue commandes (`autoplay-sound`, `autoplay-muted-fallback`, `user`), événements, focus et affichage. Aucun tracking, stockage ou envoi réseau.

Pour contrôler l’iframe, après son chargement et avant les bascules :

```js
window.pocFrame = document.querySelector('#player iframe');
window.pocSource = pocFrame.src;
window.pocLoads = 0;
pocFrame.addEventListener('load', () => pocLoads++);
```

Après les bascules (sans Ctrl+R) :

```js
({ sameFrame: pocFrame === document.querySelector('#player iframe'),
   sameSource: pocSource === pocFrame.src, loads: pocLoads,
   fullscreen: document.fullscreenElement })
```

Attendu : `true`, `true`, `0`, `null`. La continuité sonore/visuelle et le comportement matériel restent à vérifier humainement, indépendamment de l’identité de l’iframe.

Documentation officielle : [Player API](https://dev.twitch.tv/docs/embed/video-and-clips/), [Chat Embed](https://dev.twitch.tv/docs/embed/chat/). Aucun HLS direct ni appel à requestFullscreen.

Tests des nouvelles commandes : syntaxe et API Player simulée validées (volume, mute, touches, tri qualité, bornes, Auto présent/absent). Pas de nouvelle validation sur flux réel ni lunettes pour ces changements.

## Menu de démonstration — test sans compte

L’accueil affiche **Mode démo — Twitch non connecté**, avec **Suivis** sélectionné. Noms, titres, catégories et audiences sont fictifs ; toutes les cartes ouvrent la chaîne réelle de test définie dans CHANNEL (actuellement kamet0). Ce ne sont pas vos suivis Twitch. Aucun OAuth, Helix ou EventSub n’est appelé. Le SDK Embed se charge seulement à la première ouverture du lecteur ; les requêtes du player et du chat POC restent celles de Twitch.

`demo-data.js` fournit des méthodes asynchrones followed/categories/category/search et des éléments à identifiant stable. `menu.js` rend ces éléments et gère les écrans/focus. Ce contrat pourra être alimenté par Helix sans remplacer les composants visuels. La cible de lecture des exemples est volontairement unique pour préserver le POC ; la sélection multi-chaînes sera raccordée avec les données réelles.

1. Dans VS Code, clic droit sur index.html → Open with Live Server. Ouvrir http://127.0.0.1:5500/ dans Chrome, jamais file://.
2. F12 → Ctrl+Maj+M → Responsive, 600×600, type Desktop. Quitter le focus DevTools, puis Ctrl+R : Suivis doit avoir le focus jaune.
3. Sur les onglets, ←/→ change Suivis / Parcourir / Recherche. ↓ entre dans les résultats ; ↑/↓ parcourent les cartes. Depuis la première carte, ↑ revient aux onglets ; Échap y revient directement.
4. Suivis : descendre jusqu’à la sixième carte pour faire défiler. Entrée ouvre le player de test. Ses contrôles Volume/Qualité et son autoplay restent ceux du POC. La disponibilité du live n’est pas garantie.
5. Dans le lecteur, Échap revient directement au menu, même barre masquée, lorsque la page reçoit la touche. Le bouton « Menu · Échap » permet aussi le retour. En mode Contrôles Twitch avec focus dans une iframe, les touches cross-origin restent inaccessibles au parent : utiliser le bouton extérieur pour revenir.
6. Vérifier le même onglet, la même carte jaune et la même position de défilement. Entrée rouvre la même instance du player, sans remplacer son iframe. Le retour au menu n’envoie aucune commande play/pause ou audio ; Twitch peut réagir à sa propre visibilité, la continuité en arrière-plan n’est pas garantie.
7. Parcourir : ↓ puis Entrée sur une catégorie ; ↓ sélectionne ses lives. Échap revient aux catégories avec sélection et défilement restaurés.
8. Recherche : ↓ entre dans le champ facultatif, ↓ atteint Rechercher, ↓ atteint les propositions. Les flèches et Entrée suffisent pour explorer sans saisir. Sur PC, saisir un texte puis Entrée filtre les données locales ; aucun clavier virtuel ni API Meta ajouté.

Le menu conserve son état en mémoire pendant la page ; Ctrl+R réinitialise volontairement la démo. Le player est créé une seule fois, à la première sélection. Les anciens tests « Ctrl+R → autoplay » s’appliquent désormais après cette sélection.

## Mise à jour UI et diagnostic Chat/Pause

Cette section remplace les anciennes descriptions de barre de 112 px, panneau de statut et iframe redimensionnée avec le chat.

Le test Chrome 600×600 sur flux réel a reproduit PAUSE après le passage de l’iframe de 600×600 à 600×337,5, sans commande Pause applicative. Les rectangles mesurés ne montraient aucun recouvrement. Le même test avec iframe fixée au ratio 16:9, même position et mêmes dimensions avant/après Chat, a conservé la lecture et permis Pause puis Lecture. C’est le déclencheur observé ; le mécanisme interne cross-origin de Twitch n’est pas inspecté.

Le correctif conserve l’iframe à 600×337,5, ancrée en haut. Chat OFF laisse le bas noir ; Chat ON y affiche le chat local. Aucun déplacement DOM, changement de source ou commande vidéo/audio lors de la bascule. La barre occupe 68 px hors de la vidéo. Chat ON : chat 262,5 px sans barre, 194,5 px avec barre. Aucun panneau d’information ni hint sous la vidéo ; les détails de statut restent dans le titre du bouton Lecture pour le diagnostic.

Interface sombre, focus bleu clair à contraste élevé, cartes horizontales (aperçu Twitch 16:9 + informations), titres sur deux lignes, scrollbar fine. En Recherche, les résultats de chaînes live sont enrichis avec Get Streams pour obtenir la vraie miniature et le nombre de spectateurs ; l’image Search Channels est une image de profil et n’est donc pas utilisée comme aperçu vidéo. Une chaîne hors ligne affiche un emplacement « Hors ligne », sans miniature fictive.

Test manuel après lancement Live Server et connexion :
1. Chrome Responsive 600×600 : Suivis / Parcourir / Recherche, cartes et défilement uniquement au clavier.
2. Ouvrir une carte après défilement, puis Menu ou Échap : même carte, onglet, recherche/catégorie et position.
3. Sur un direct en lecture, dix bascules Chat avec Entrée : pas de pause, pas de changement de son, volume ou qualité ; vidéo immobile.
4. Pause puis Lecture après les bascules ; Volume haut/bas, Entrée mute/unmute ; Qualité haut/bas puis Entrée Auto.
5. Attendre le masquage de la barre puis la rappeler. Vérifier qu’aucune commande de lecture ne part de cette action et qu’aucune erreur JavaScript nouvelle n’apparaît.

Le flux réel de test est indépendant de votre compte ; les essais de navigation automatisés emploient des réponses de test uniquement dans le navigateur de test, jamais comme fallback dans l’application. Les tests lunettes restent manuels.

Résultats du test Chrome 600×600 après correctif : dix bascules Chat sur flux Twitch réel, isPaused=false, même iframe/source et zéro load ; Pause=true puis reprise=false ; volume demandé et lu à 60 %, mute=true ; qualité Auto lue après retour. Navigation testée avec données injectées uniquement dans le navigateur de test : trois cartes complètes et une partielle, retour à la sixième carte et scroll 353 px conservés. Ce test ne valide pas OAuth/Helix/EventSub avec un compte utilisateur ni le runtime lunettes.
