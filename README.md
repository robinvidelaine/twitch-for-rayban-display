# Twitch for Ray-Ban Display

**Twitch for Ray-Ban Display** est une Web App non officielle conçue pour utiliser Twitch sur les **Meta Ray-Ban Display** avec une interface adaptée à leur écran **600×600** et à la navigation avec le **Meta Neural Band**.

L'objectif est simple : conserver les services Twitch officiels tout en proposant une interface beaucoup plus adaptée aux lunettes.

> **Projet indépendant et non officiel.** Ce projet n'est ni affilié, ni approuvé, ni sponsorisé par Twitch ou Meta.

---

## Utiliser l'application

Aucune installation n'est nécessaire.

### ➜ [Ouvrir Twitch for Ray-Ban Display](URL_GITHUB_PAGES)

1. Ouvrez la Web App.
2. Sélectionnez **Se connecter à Twitch**.
3. Suivez les instructions d'autorisation Twitch.
4. Connectez-vous avec votre propre compte Twitch.
5. Retrouvez vos chaînes suivies, parcourez Twitch ou recherchez un stream.
6. Sélectionnez un stream pour commencer à regarder.

Chaque utilisateur se connecte avec **son propre compte Twitch**.

Aucun mot de passe Twitch n'est demandé ou stocké par l'application.

---

## Pourquoi ce projet ?

Le site Twitch classique est principalement conçu pour un ordinateur, un smartphone ou une télévision.

Sur un écran de lunettes connectées de 600×600, l'interface classique devient beaucoup moins pratique :

- navigation complexe ;
- beaucoup d'informations affichées simultanément ;
- contrôles peu adaptés à une navigation directionnelle ;
- recherche de streams fastidieuse ;
- chat prenant beaucoup de place ;
- interface non pensée pour le Meta Neural Band.

Twitch for Ray-Ban Display propose donc une interface spécifique aux contraintes des lunettes plutôt qu'une simple reproduction de Twitch Desktop.

---

## Interface

L'application est organisée autour de trois sections principales :

### Suivis

Affiche les chaînes que votre compte Twitch suit et qui sont actuellement en direct.

Chaque stream présente de manière compacte :

- miniature ;
- nom du streamer ;
- titre ;
- catégorie ;
- nombre de spectateurs.

### Parcourir

Permet de parcourir les catégories Twitch et les streams actuellement disponibles.

### Recherche

Permet de rechercher des chaînes et catégories Twitch depuis l'interface adaptée au petit écran.

---

## Lecteur

Le projet utilise le **lecteur officiel Twitch**.

Une barre de contrôle simplifiée permet d'accéder à :

**Menu · Chat · Lecture/Pause · Volume · Qualité**

L'interface privilégie la vidéo et conserve un affichage 16:9 lorsque le chat est visible.

### Volume

Lorsque **Volume** est sélectionné :

- `↑` augmente le volume ;
- `↓` diminue le volume ;
- `Entrée` active ou désactive le son.

### Qualité

Lorsque **Qualité** est sélectionnée :

- `↑` augmente la qualité ;
- `↓` diminue la qualité ;
- `Entrée` revient en mode automatique lorsque Twitch le permet.

Les qualités proposées proviennent directement du lecteur Twitch.

### Chat

Le chat peut être affiché ou masqué pendant le visionnage.

Cela permet de privilégier la vidéo lorsque le chat n'est pas nécessaire et de l'afficher rapidement lorsqu'on souhaite suivre les réactions du stream.

---

## Navigation

L'interface est conçue pour une navigation directionnelle adaptée au Meta Neural Band.

| Commande | Action |
| --- | --- |
| `←` `→` | Navigation horizontale |
| `↑` `↓` | Navigation verticale / réglage |
| `Entrée` | Sélection / action |
| `Retour` / `Échap` | Retour |

Les éléments sélectionnés sont volontairement très visibles afin de faciliter l'utilisation sur le petit écran des lunettes.

---

## Connexion Twitch

La connexion est réalisée directement avec Twitch.

```text
Utilisateur
    │
    ▼
Twitch for Ray-Ban Display
    │
    ▼
Services officiels Twitch
```

L'application utilise une application Twitch OAuth de type **Public**.

Il n'y a pas de serveur d'authentification appartenant au projet entre l'utilisateur et Twitch.

Le **Client ID Twitch** présent dans le code est public et sert à identifier l'application auprès de Twitch.

---

## Vie privée

Le projet est conçu pour fonctionner entièrement côté client.

Il n'utilise pas de :

- base de données utilisateur ;
- backend applicatif ;
- proxy Twitch ;
- compte Twitch partagé ;
- système d'analytics ajouté par le projet.

Les informations d'authentification générées après votre connexion Twitch restent dans votre navigateur selon le fonctionnement de l'application.

Le dépôt GitHub ne contient pas les tokens Twitch des utilisateurs.

---

## Technologies

Le projet reste volontairement léger :

- HTML
- CSS
- JavaScript
- Twitch OAuth
- Twitch Helix API
- Twitch Player
- Twitch EventSub
- GitHub Pages

Aucun framework frontend ou serveur applicatif n'est nécessaire pour utiliser la Web App.

---

## Utilisation sur Meta Ray-Ban Display

La cible principale du projet est **Meta Ray-Ban Display + Meta Neural Band**.

La Web App est conçue autour :

- d'un viewport 600×600 ;
- d'une navigation directionnelle ;
- de gros éléments sélectionnables ;
- d'un nombre limité d'actions ;
- d'une interface compacte ;
- d'un lecteur donnant la priorité à la vidéo.

Le projet étant encore expérimental, certains comportements doivent encore être validés directement sur le matériel, notamment le focus, les interactions Neural Band et certains comportements du lecteur Twitch.

---

## Tester sur ordinateur

L'application peut également être testée dans Chrome.

Ouvrez simplement la version GitHub Pages puis utilisez les outils développeur :

1. `F12`
2. `Ctrl + Shift + M`
3. mode **Responsive**
4. résolution **600 × 600**

Les flèches du clavier et `Entrée` permettent alors de simuler une grande partie de la navigation directionnelle.

---

## Développement local

Pour modifier ou tester le projet localement :

```bash
git clone https://github.com/robinvidelaine/twitch-for-rayban-display.git
```

Ouvrez ensuite le projet dans Visual Studio Code.

Avec l'extension **Live Server** :

1. clic droit sur `index.html` ;
2. **Open with Live Server** ;
3. ouvrez l'adresse locale dans Chrome.

N'ouvrez pas directement `index.html` avec `file://`, car certaines fonctionnalités Web/Twitch nécessitent une origine HTTP(S).

---

## État du projet

🚧 **Projet en développement actif**

Les fonctionnalités principales sont déjà utilisables dans le navigateur :

- connexion Twitch ;
- chaînes suivies en direct ;
- navigation dans les catégories ;
- recherche ;
- lecture de streams Twitch ;
- lecture/pause ;
- volume et mute ;
- choix de qualité ;
- chat affichable/masquable ;
- navigation adaptée au 600×600 ;
- retour au menu avec conservation de la position.

Les prochaines validations concernent principalement l'utilisation réelle sur **Meta Ray-Ban Display**.

Les bugs et retours d'expérience peuvent être signalés via les Issues GitHub.

---

## Limitations

Certaines fonctionnalités dépendent directement de Twitch et du navigateur.

Par exemple :

- l'autoplay avec son peut être soumis aux règles du navigateur ;
- les publicités et restrictions Twitch restent gérées par Twitch ;
- certaines interactions avec le lecteur officiel Twitch peuvent dépendre de son iframe ;
- la compatibilité complète avec les gestes du Neural Band doit être validée sur le matériel.

Le projet ne cherche pas à contourner les restrictions ou protections de Twitch.

---

## Contributions

Le projet est actuellement publié principalement afin qu'il puisse être **utilisé et testé** par d'autres personnes disposant d'un environnement similaire.

Avant de proposer une modification ou une redistribution, consultez les conditions de licence du dépôt.

---

## Licence

**Aucune licence open source n'est actuellement accordée.**

Le code source est publiquement visible afin de permettre la transparence et l'utilisation de la version hébergée.

Sauf autorisation explicite, sa publication sur GitHub ne constitue pas une autorisation de copier, modifier, redistribuer, republier ou exploiter commercialement le code.

Les marques **Twitch**, **Meta**, **Ray-Ban** et les autres marques citées appartiennent à leurs propriétaires respectifs.
