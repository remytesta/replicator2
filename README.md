# REPLICATOR 2

Installation interactive — Festival du Peu 2026
Le Broc, Alpes-Maritimes (06) — 29 mai au 21 juin 2026

---

## C'est quoi ce projet ?

Une imprimante 3D Creality CR10S transformée en œuvre d'art interactive.

Les visiteurs pilotent ses mouvements depuis leur téléphone ou une tablette.

Un Raspberry Pi fait tourner tout le système, **sans internet**, en créant son propre réseau WiFi dans la chapelle.

---

## Ce que le public peut faire

- Se connecter au WiFi **REPLICATOR2** avec son téléphone
- Ouvrir `http://10.0.0.1` dans son navigateur (aucune appli à télécharger)
- Lancer une chorégraphie de la machine
- Activer / désactiver les ventilateurs

---

## Ce que l'admin peut faire (en plus)

- Contrôler les axes X / Y / Z manuellement
- Envoyer du G-code directement
- Régler les paramètres de l'installation
- Programmer des chorégraphies artistiques

---

## Les composants physiques

| Élément | Rôle |
|---|---|
| Raspberry Pi 3B+ | Le cerveau : gère tout |
| Creality CR10S | L'imprimante 3D transformée en performeuse |
| 4 moteurs | Déplacent les axes de la machine |
| Plateau chauffant | Chauffé jusqu'à température artistique |
| Tête chauffante | L'extrudeur de la CR10S, très haute température |
| 2 ventilateurs | Contrôlables depuis l'appli (ON/OFF) |
| Carte SD (32 Go min) | Contient tout le système du Raspberry |

---

---

## Pourquoi GitHub et pas le NAS ?

> **Pour Thierry** — avant de commencer, 5 minutes pour comprendre pourquoi on travaille comme ça.

### Le problème avec le glisser-déposer

Imaginons que Rémy t'envoie `index.html` sur le NAS aujourd'hui.
Demain il corrige un bug et t'envoie une nouvelle version.
Après-demain il ajoute une fonctionnalité, nouvelle version encore.

Au bout d'une semaine tu te retrouves avec :
```
index.html
index_final.html
index_final_v2.html
index_BONNE_VERSION.html
index_BONNE_VERSION_corrigé.html
```

Tu ne sais plus laquelle utiliser. Tu ne sais pas ce qui a changé entre deux versions. Si quelque chose casse, tu ne peux pas revenir en arrière facilement.

---

### Ce que Git change

Git c'est un **système qui garde l'historique complet de chaque modification**, avec la date, qui l'a faite, et pourquoi.

Il n'y a **qu'un seul fichier** `index.html`. Toujours le bon. Toujours à jour.

Quand Rémy modifie quelque chose, tu tapes une commande et tu as la dernière version en 5 secondes :

```bash
git pull
```

C'est tout. Pas de NAS, pas de fichiers qui traînent, pas de doute sur quelle version utiliser.

---

### Comparaison directe

| NAS + glisser-déposer | GitHub + git pull |
|---|---|
| Rémy t'envoie un fichier | Tu récupères toi-même quand tu veux |
| Tu ne sais pas ce qui a changé | Tu vois exactement chaque modification |
| Plusieurs versions qui s'accumulent | Un seul fichier, toujours à jour |
| Si ça casse, impossible de revenir en arrière | On revient à n'importe quelle version en une commande |
| Rémy doit penser à t'envoyer | Tu fais `git pull`, c'est à jour |

---

### Ce que tu as besoin de savoir faire

Une seule commande pour récupérer les mises à jour :

```bash
git pull
```

C'est littéralement tout ce que tu auras à faire au quotidien.

---

Prérequis — Installer Git sur Mac (Mac Studio M2)
1. Installer Git
Ouvre le Terminal (CMD + Espace → "Terminal") et tape :
bashxcode-select --install
Une fenêtre s'ouvre, clique Installer. Ça prend 2-3 minutes.
Vérifie que c'est bien installé :
bashgit --version
# doit afficher : git version 2.x.x

2. Se configurer une seule fois
bashgit config --global user.name "Ton Prénom"
git config --global user.email "ton@email.com"

3. Récupérer le projet (une seule fois)
bashcd ~/Desktop
git clone https://github.com/remytesta/replicator2.git
cd replicator2
Le dossier replicator2/ apparaît sur le Bureau.

4. Mettre à jour le projet (à chaque fois que je push)
bashcd ~/Desktop/replicator2
git pull
C'est tout. Pas besoin de télécharger des fichiers ou de passer par le NAS.

5. Les 3 commandes Git à connaître
CommandeCe que ça faitgit pullRécupère les dernières modificationsgit statusVoir ce qui a changégit log --onelineVoir l'historique des modifications

Florent  n'a pas besoin de pusher, seulement de pull pour rester à jour.

```

## Architecture (comment tout se parle)

```
[ Raspberry Pi ]
      |
      ├── OctoPrint (port 5000)  → parle à la CR10S via câble USB
      ├── Nginx    (port 80)     → sert l'interface web aux visiteurs
      ├── GPIO                   → contrôle les ventilateurs et relais
      └── Hotspot WiFi           → crée le réseau REPLICATOR2
             |
             ├── Tablette (mode plein écran, fixée sur le meuble)
             └── Téléphones des visiteurs
```

> **En clair :** Le Raspberry fait office de serveur, de routeur WiFi, et de cerveau de l'installation, tout en même temps. Pas besoin d'internet.

---

## Structure des fichiers du projet

```
replicator2/
├── app/
│   └── index.html          ← l'interface web (ce que le visiteur voit)
├── gcode/
│   ├── choreo_1.gcode      ← chorégraphie 1
│   ├── choreo_2.gcode      ← chorégraphie 2
│   ├── choreo_3.gcode      ← chorégraphie 3
│   └── choreo_4.gcode      ← chorégraphie 4
├── scripts/
│   └── gpio_trigger.py     ← contrôle les ventilateurs via les broches GPIO
├── docs/
│   └── cahier-des-charges.docx
├── install.sh              ← script d'installation automatique (voir ci-dessous)
├── .gitignore
└── README.md               ← ce fichier
```

---

## Installation sur le Raspberry Pi

### Pré-requis avant de commencer

- Un Raspberry Pi 3B+ avec Raspberry Pi OS Lite flashé sur une carte SD
- SSH activé (option dans Raspberry Pi Imager)
- Le Raspberry connecté au WiFi ou en Ethernet
- Un ordinateur pour se connecter en SSH

### Connexion au Raspberry (depuis ton ordi)

```bash
ssh pi@raspberrypi.local
```

> Le mot de passe par défaut est `raspberry`. **Change-le dès la première connexion.**

```bash
passwd
```

### Installation automatique (une seule commande)

```bash
git clone https://github.com/TON_COMPTE/replicator2.git && cd replicator2 && bash install.sh
```

**C'est tout.** Le script `install.sh` s'occupe du reste :
- Met à jour le système
- Installe Nginx, OctoPrint, les dépendances Python
- Configure le hotspot WiFi REPLICATOR2
- Configure Nginx pour servir l'interface
- Active tout au démarrage

---

## Configuration à personnaliser

Dans `app/index.html`, modifier ce bloc :

```javascript
const CONFIG = {
  OCTOPRINT_URL:  "http://10.0.0.1:5000",   // adresse OctoPrint (ne pas changer)
  API_KEY:        "VOTRE_CLE_API",           // clé générée dans OctoPrint
  ADMIN_PASSWORD: "mot-de-passe",            // mot de passe admin de l'interface
  DEFAULT_FEED:   1500,                      // vitesse de déplacement par défaut
  DEFAULT_STEP:   10,                        // pas de déplacement en mm
}
```

> La clé API OctoPrint se génère dans : **OctoPrint > Paramètres > API > Clé globale**

---

## Mode Kiosk (tablette plein écran)

Pour la tablette fixée sur le meuble :

```bash
chromium-browser --kiosk --noerrdialogs --disable-infobars http://localhost
```

Ajouter cette ligne dans `/etc/xdg/lxsession/LXDE-pi/autostart` pour que ça se lance automatiquement au démarrage.

---

## Réseau en mode exposition

Le Raspberry crée son propre WiFi. Aucun internet nécessaire.

| Paramètre | Valeur |
|---|---|
| Nom du réseau (SSID) | `REPLICATOR2` |
| Mot de passe | *(à définir dans install.sh)* |
| Adresse IP du Raspberry | `10.0.0.1` |
| Interface visiteur | `http://10.0.0.1` |
| Interface admin | `http://10.0.0.1` (avec mot de passe) |
| OctoPrint | `http://10.0.0.1:5000` |

---

## Accès résumé

| Qui | Depuis | URL |
|---|---|---|
| Visiteur (téléphone) | WiFi REPLICATOR2 | http://10.0.0.1 |
| Tablette (kiosk) | En local | http://localhost |
| Admin | WiFi REPLICATOR2 | http://10.0.0.1 (mdp requis) |
| OctoPrint (technique) | WiFi REPLICATOR2 | http://10.0.0.1:5000 |

---

## Statut du projet

- [x] Concept validé
- [x] Prototype app PWA
- [x] Script d'installation (install.sh)
- [ ] Installation OctoPrint + clé API
- [ ] Connexion CR10S testée
- [ ] Setup hotspot WiFi validé en atelier
- [ ] Contrôle ventilateurs via GPIO
- [ ] Intégration meuble
- [ ] Chorégraphies calibrées
- [ ] Mode kiosk tablette
- [ ] Tests visiteurs
- [ ] Installation chapelle

---

## Equipe

- Artiste / direction artistique : Nice, France
- Technique / développement : Da Nang, Vietnam (remote)
- Coordination : GitHub + Discord

---

## Lexique

| Mot | Définition simple |
|---|---|
| **Raspberry Pi** | Mini-ordinateur (taille d'une carte de crédit) qui fait tourner tout le système |
| **OctoPrint** | Logiciel qui pilote l'imprimante 3D à distance, via une interface web |
| **G-code** | Langage de commande des imprimantes 3D (ex: "avance de 10mm sur l'axe X") |
| **Nginx** | Logiciel qui sert les pages web aux téléphones des visiteurs |
| **PWA** | Application web qui s'ouvre dans un navigateur comme une vraie appli, sans installation |
| **GPIO** | Les petites broches de connexion du Raspberry Pi où on branche ventilateurs et relais |
| **Hotspot WiFi** | Le Raspberry crée lui-même un réseau WiFi, comme une box internet portable |
| **SSH** | Façon de se connecter à distance à un ordinateur en ligne de commande |
| **git clone** | Télécharger tout le projet depuis GitHub en une commande |
| **bash install.sh** | Exécuter le script d'installation automatique |
| **IP statique** | Adresse fixe du Raspberry sur le réseau (10.0.0.1), elle ne change jamais |
| **Mode kiosk** | Navigateur plein écran sans barre d'adresse ni bouton retour, pour la tablette expo |
| **Flasher** | Écrire le système d'exploitation du Raspberry sur une carte SD |
