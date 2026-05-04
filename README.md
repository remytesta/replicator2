# REPLICATOR 2

Installation interactive autour d'une imprimante 3D Creality CR-10S pilotee par un Raspberry Pi.

Ce depot sert de base commune pour preparer, installer et maintenir le projet a distance.

---

## Installer Git sur le Mac de l'atelier

Sur le Mac utilise a l'atelier, ouvrir le Terminal puis installer Git si besoin :

```bash
xcode-select --install
```

Verifier ensuite que Git repond :

```bash
git --version
```

Si Homebrew est deja installe sur le Mac, cette commande fonctionne aussi :

```bash
brew install git
```

Cloner ensuite le projet :

```bash
cd ~/Desktop
git clone https://github.com/remytesta/replicator2.git
cd replicator2
```

Pour recuperer les dernieres modifications plus tard :

```bash
git pull
```

---

## Objectif du projet

Transformer une Creality CR-10S en installation interactive.

Le Raspberry Pi sert de cerveau local :

- il heberge la PWA affichee sur tablette ou telephone ;
- il parle a OctoPrint pour commander l'imprimante ;
- il peut controler des sorties GPIO, par exemple ventilateurs ou relais ;
- il pourra, dans une phase suivante, creer son propre reseau WiFi local.

Le pilotage se fera a distance pendant la preparation : les personnes sur place assemblent, branchent et testent le materiel ; le developpement et les corrections sont pousses via GitHub.

---

## Phases de travail

### Phase 1 - Atelier, tablette en HDMI

Objectif immediat : faire tourner la PWA sur une tablette ou un ecran connecte en HDMI au Raspberry Pi.

Dans cette phase, on ne cherche pas encore a creer un hotspot WiFi. Le Raspberry peut etre connecte au reseau de l'atelier pour permettre le SSH et les mises a jour.

Ce qu'il faut valider :

- Raspberry Pi installe et demarrable ;
- SSH active dans Raspberry Pi Imager ;
- acces SSH depuis le Mac de l'atelier ;
- OctoPrint installe et accessible localement ;
- PWA servie en local par Nginx ;
- tablette ou ecran HDMI en mode kiosk ;
- premiers tests de communication avec la CR-10S.

Commande SSH typique :

```bash
ssh pi@raspberrypi.local
```

Si `raspberrypi.local` ne repond pas, recuperer l'adresse IP du Raspberry dans l'interface de la box ou du routeur, puis utiliser :

```bash
ssh pi@ADRESSE_IP_DU_RASPBERRY
```

### Phase 2 - Mode hotspot WiFi

Objectif : rendre le Raspberry autonome en exposition.

Le Raspberry devra creer son propre reseau WiFi local, par exemple :

```text
SSID : REPLICATOR2
IP   : 10.0.0.1
URL  : http://10.0.0.1
```

Les visiteurs pourront se connecter au WiFi `REPLICATOR2`, ouvrir l'adresse locale dans leur navigateur et utiliser la PWA sans internet.

Pour cette phase, le script d'installation devra probablement etre separe ou parameterise :

- un mode atelier simple, sans hotspot ;
- un mode exposition, avec hotspot, IP statique, DHCP et Nginx.

### Phase 3 - Ecran integre de la CR-10S

Objectif exploratoire : comprendre si l'ecran integre de la CR-10S peut etre personnalise, notamment pour changer le logo ou l'ecran de demarrage.

Cette phase est a traiter comme de la recherche firmware, pas comme une modification rapide :

- identifier exactement le modele de CR-10S et sa carte mere ;
- identifier le type d'ecran ;
- sauvegarder ou retrouver le firmware d'origine ;
- verifier si l'imprimante utilise Marlin stock, un firmware Creality modifie, ou un autre systeme ;
- tester uniquement si on a une procedure de retour arriere.

Risque principal : un mauvais flash firmware peut rendre l'ecran ou la carte inutilisable jusqu'a reflash complet.

---

## Architecture cible

```text
[ Tablette / telephone ]
          |
          v
[ PWA servie par Nginx ]
          |
          v
[ API Flask locale ]
          |
          +--> [ OctoPrint ] --> [ CR-10S via USB ]
          |
          +--> [ GPIO Raspberry ] --> [ ventilateurs / relais ]
```

Principe important : la PWA ne doit pas parler directement a OctoPrint avec une cle API visible dans le navigateur. La PWA doit appeler l'API Flask locale, et l'API Flask garde la cle OctoPrint cote Raspberry.

---

## Structure du depot

```text
replicator2/
|-- app/
|   |-- index.html          # Interface PWA principale
|   |-- manifest.json       # Configuration PWA
|   `-- sw.js               # Service worker
|-- api/
|   |-- server.py           # API Flask locale
|   |-- octoprint_client.py # Client OctoPrint
|   `-- gpio_controller.py  # Controle GPIO
|-- gcode/
|   |-- choreo_1.gcode
|   |-- choreo_2.gcode
|   |-- choreo_3.gcode
|   `-- choreo_4.gcode
|-- scripts/
|   `-- gpio_trigger.py
|-- install.sh              # Installation Raspberry actuelle
`-- README.md
```

---

## Installation Raspberry actuelle

Depuis le Raspberry Pi :

```bash
git clone https://github.com/remytesta/replicator2.git
cd replicator2
bash install.sh
```

Le script actuel installe :

- Nginx ;
- OctoPrint ;
- l'API Flask ;
- les dependances Python ;
- une configuration hotspot WiFi ;
- les services systemd.

Attention : ce script doit etre revu avant installation en atelier, car on veut d'abord un mode simple HDMI + SSH avant de basculer en mode hotspot.

---

## Variables importantes

L'API Flask lit ces variables d'environnement :

```bash
OCTOPRINT_URL=http://127.0.0.1:5000
OCTOPRINT_KEY=VOTRE_CLE_OCTOPRINT
GCODE_DIR=/home/pi/replicator2/gcode
```

La cle OctoPrint ne doit pas etre stockee dans le HTML public.

---

## Mode kiosk HDMI

Pour lancer Chromium en plein ecran sur le Raspberry :

```bash
chromium-browser --kiosk --noerrdialogs --disable-infobars http://localhost
```

Cette commande pourra ensuite etre ajoutee au demarrage automatique du Raspberry quand la phase 1 sera validee.

---

## Statut

- [x] Prototype PWA
- [x] API Flask de base
- [x] G-code de test
- [x] Revoir README pour installation atelier
- [ ] Corriger API/PWA pour passer uniquement par Flask
- [ ] Ajouter une route API pour le G-code manuel
- [ ] Separer installation atelier et installation hotspot
- [ ] Tester OctoPrint avec la CR-10S assemblee
- [ ] Tester mode kiosk HDMI
- [ ] Tester hotspot WiFi
- [ ] Etudier personnalisation de l'ecran CR-10S
