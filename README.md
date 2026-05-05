# REPLICATOR 2

Installation interactive - Festival du Peu 2026  
Le Broc, Alpes-Maritimes - du 29 mai au 21 juin 2026

Projet : transformer une imprimante 3D Creality CR-10S en machine interactive pilotee par un Raspberry Pi.

Le but est que l'installation puisse fonctionner en local, sans internet, avec une interface web simple affichee sur tablette, ecran HDMI ou telephone.

---

## Ce qu'on fait today


Objectif realiste :

1. Demarrer le Raspberry Pi.
2. Verifier que SSH marche depuis le Mac de l'atelier.
3. Installer ou ouvrir OctoPrint.
4. Brancher la CR-10S en USB.
5. Verifier qu'OctoPrint voit bien l'imprimante.
6. Afficher la PWA (Progressive Web App, l'interface user) sur la tablette ou l'ecran branche en HDMI au Raspberry.
7. Recuperer les infos de l'ecran integre de la CR-10S pour preparer la phase 3.

La chaine a valider demain :

```text
Mac de l'atelier
      |
      v
SSH vers Raspberry
      |
      +--> OctoPrint -> CR-10S en USB
      |
      +--> PWA -> ecran/tablette HDMI
```

Le hotspot WiFi et la modification de l'ecran integre viennent apres.

---

## Installer Git sur le Mac de l'atelier

Sur le Mac, ouvrir Terminal.

Installer Git :

```bash
xcode-select --install
```

Verifier que Git est installe :

```bash
git --version
```

Recuperer le projet :

```bash
cd ~/Desktop
git clone https://github.com/remytesta/replicator2.git
cd replicator2
```

Plus tard, pour recuperer les mises a jour :

```bash
cd ~/Desktop/replicator2
git pull
```

---

## Activer SSH sur le Raspberry

Le plus simple est de le faire dans Raspberry Pi Imager avant de flasher la carte SD.

Dans Raspberry Pi Imager :

1. Choisir Raspberry Pi OS.
2. Ouvrir les options avancees.
3. Activer SSH.
4. Definir l'utilisateur et le mot de passe.
5. Configurer le WiFi de l'atelier si besoin.
6. Flasher la carte SD.

Depuis le Mac :

```bash
ssh pi@raspberrypi.local
```

Si `raspberrypi.local` ne marche pas, trouver l'adresse IP du Raspberry dans la box ou le routeur, puis :

```bash
ssh pi@ADRESSE_IP_DU_RASPBERRY
```

---

## Cle API OctoPrint

### Generer la cle demain

1. Ouvrir OctoPrint dans le navigateur.
2. Se connecter au compte admin.
3. Aller dans les reglages.
4. Chercher `Application Keys` ou `API`.
5. Creer une cle pour `replicator2`.
6. Copier la cle.

### Installer la cle sur le Raspberry

Sur le Raspberry :

```bash
sudo systemctl edit replicator-api
```

Coller :

```ini
[Service]
Environment=OCTOPRINT_KEY=COLLER_LA_CLE_ICI
```

Puis relancer :

```bash
sudo systemctl daemon-reload
sudo systemctl restart replicator-api
sudo journalctl -u replicator-api -f
```

### Tester la cle

Depuis le Raspberry :

```bash
curl -H "X-Api-Key: COLLER_LA_CLE_ICI" http://127.0.0.1:5000/api/version
```

Si OctoPrint repond avec une version, la cle fonctionne.

---

## Architecture cible

```text
[ Tablette / telephone / ecran HDMI ]
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

Principe important : la PWA ne doit pas parler directement a OctoPrint avec une cle visible dans le navigateur. La PWA doit appeler l'API Flask locale, et l'API Flask garde la cle OctoPrint cote Raspberry.

---

## Phase 1 - Atelier, ecran HDMI

Objectif : faire tourner l'installation en atelier avec le Raspberry branche au reseau de l'atelier et a un ecran ou une tablette en HDMI.

Ce qu'il faut valider :

- Raspberry Pi demarre correctement.
- SSH fonctionne.
- OctoPrint fonctionne.
- La CR-10S est visible dans OctoPrint.
- La PWA s'affiche en local.
- Le mode kiosk peut afficher la PWA en plein ecran.

Lancer Chromium en plein ecran :

```bash
chromium-browser --kiosk --noerrdialogs --disable-infobars http://localhost
```

On doit lancer cette commande a la main. L'autodemarrage viendra apres.

---

## Phase 2 - Hotspot WiFi

Objectif : rendre le Raspberry autonome en exposition.

Le Raspberry creera son propre WiFi :

```text
Nom du WiFi : REPLICATOR2
Adresse    : http://10.0.0.1
```

Les visiteurs se connecteront au WiFi `REPLICATOR2`, puis ouvriront `http://10.0.0.1` dans leur navigateur.

Pour cette phase, il faudra separer ou parameteriser l'installation :

- mode atelier : reseau normal, SSH facile, pas de hotspot ;
- mode exposition : hotspot, IP fixe, DHCP local, Nginx.

On ne l'active pas en premier demain, parce que le hotspot change la configuration reseau du Raspberry. Si on rate cette etape trop tot, on peut se compliquer l'acces SSH.

---

## Le script `install.sh` 🛑STAND BY🛑

Le fichier `install.sh` est le script d'installation automatique du Raspberry.

L'idee : au lieu de taper 50 commandes a la main, on lance un seul script, et il prepare le Raspberry.

Commande prevue :

```bash
git clone https://github.com/remytesta/replicator2.git
cd replicator2
bash install.sh
```

Important : le script actuel installe aussi le mode hotspot WiFi. Pour demain, il faut etre prudent, parce qu'on veut d'abord tester le mode atelier avec SSH et ecran HDMI.

### Ce que fait le script aujourd'hui

1. Met a jour le Raspberry :

```bash
sudo apt update
sudo apt upgrade
```

2. Installe les logiciels necessaires :

- `nginx` : sert la PWA dans le navigateur ;
- `git` : recupere le projet depuis GitHub ;
- `python3-pip` et `python3-venv` : installent l'API Flask ;
- `hostapd` : cree le WiFi `REPLICATOR2` ;
- `dnsmasq` : donne des adresses IP aux telephones connectes au hotspot ;
- `curl`, `wget` : outils de test et telechargement ;
- `ufw` : pare-feu.

3. Copie les fichiers du projet dans :

```text
/home/pi/replicator2
```

4. Cree un environnement Python pour l'API Flask :

```text
/home/pi/replicator2/venv
```

5. Installe les dependances Python :

- Flask ;
- Flask-CORS ;
- requests ;
- RPi.GPIO.

6. Cree un service systemd `replicator-api`.

Ce service lance automatiquement :

```text
/home/pi/replicator2/api/server.py
```

En clair : l'API Flask redemarre toute seule si le Raspberry redemarre.

7. Configure Nginx.

Nginx sert :

- la PWA sur `http://localhost` ou `http://10.0.0.1` ;
- l'API Flask via `/api/` ;
- OctoPrint via `/octoprint/`.

8. Configure une IP fixe :

```text
10.0.0.1
```

9. Configure le hotspot WiFi :

```text
SSID : REPLICATOR2
Mot de passe : replicator2026
```

10. Installe OctoPrint dans :

```text
/home/pi/oprint
```

11. Cree un service systemd `octoprint`.

OctoPrint pourra donc demarrer automatiquement avec le Raspberry.

### Pourquoi il faut le revoir

Le script actuel melange deux besoins :

- mode atelier : Raspberry connecte au reseau existant, SSH facile, ecran HDMI ;
- mode exposition : Raspberry autonome, hotspot WiFi, IP fixe.

Pour demain, on veut surtout le mode atelier. Donc le script doit probablement etre separe en deux scripts ou recevoir une option :

```bash
bash install.sh atelier
bash install.sh hotspot
```

Version ideale :

```text
install-atelier.sh
  -> installe Nginx, OctoPrint, Flask, PWA, mode kiosk
  -> ne touche pas au WiFi

install-hotspot.sh
  -> ajoute hostapd, dnsmasq, IP fixe, reseau REPLICATOR2
  -> seulement quand le mode atelier est valide
```

### A ne pas oublier apres installation

Apres installation, il faut encore generer la cle API OctoPrint dans OctoPrint, puis l'ajouter au service `replicator-api`.

Le script ne peut pas deviner cette cle a l'avance.

---

## Phase 3 - Modifier l'ecran integre de la CR-10S

Objectif : changer le logo ou l'ecran de demarrage de l'imprimante et l'interface

L'ecran est generalement un petit LCD monochrome type 128x64 avec bouton rotatif. Il est pilote par le firmware de l'imprimante, souvent base sur Marlin.

Donc on ne change pas juste une image comme sur un telephone. On modifie le firmware, puis on reflashe l'imprimante.

### Ce qu'on doit identifier avant de toucher au firmware

Demain, il faut prendre des photos nettes :

1. L'imprimante complete, pour confirmer le modele exact.
2. L'ecran allume.
3. Le menu `Info`, `About` ou `Version` si disponible.
4. La carte mere si le boitier est ouvert.
5. Les references imprimees sur la carte mere.
6. Les connecteurs qui vont vers l'ecran.
7. L'etiquette ou plaque signaletique de l'imprimante.

Pourquoi c'est important : `CR-10S`, `CR-10S Pro`, `CR-10 V2`, etc. ne se flashent pas forcement pareil. Les ecrans ne sont pas toujours les memes.

### Risques

Si on flashe le mauvais firmware :

- l'ecran peut rester bleu ou noir ;
- l'imprimante peut ne plus demarrer correctement ;
- les moteurs peuvent etre mal configures ;
- la chauffe peut etre mal geree ;
- il faudra reflasher avec le bon firmware pour reparer.

Donc on ne flashe rien demain sans avoir identifie le modele exact.

### Methode probable pour une CR-10S classique

Si c'est bien une CR-10S classique avec ecran LCD 12864, la piste la plus probable est :

1. Recuperer le firmware Marlin compatible CR-10S.
2. Recuperer la configuration CR-10S correspondante.
3. Creer une image de logo en noir et blanc, format 128 x 64 pixels.
4. Convertir cette image en donnees C pour Marlin.
5. Modifier le fichier `_Bootscreen.h` de Marlin.
6. Verifier que l'ecran CR-10 stock est bien active dans `Configuration.h`.
7. Compiler le firmware.
8. Flasher la carte mere.
9. Tester que l'imprimante demarre, chauffe et bouge normalement.

### Image du logo

Pour un ecran 12864 :

- taille : 128 pixels de large, 64 pixels de haut ;
- couleur : noir et blanc uniquement ;
- pas de degrade ;
- formes simples ;
- texte tres lisible ;
- exporter en BMP ou PNG noir et blanc.

Plus l'image est simple, plus elle sera lisible sur le petit ecran.

### Conversion de l'image

Marlin ne lit pas directement un PNG comme une page web. Il faut transformer l'image en tableau de bytes dans un fichier C/C++.

Workflow classique :

```text
logo 128x64 noir/blanc
        |
        v
conversion en donnees hexadecimales
        |
        v
_Bootscreen.h
        |
        v
compilation Marlin
        |
        v
flash de l'imprimante
```

Des outils comme LCDAssistant ou des scripts de conversion bitmap peuvent generer ces donnees pour les LCD 12864.

### Fichiers Marlin a regarder

Dans Marlin, les fichiers importants sont en general :

```text
Marlin/Configuration.h
Marlin/_Bootscreen.h
Marlin/_Statusscreen.h
```

Dans `Configuration.h`, il faut verifier le type d'ecran. Pour une CR-10 / CR-10S classique, on voit souvent une option du type :

```c
#define CR10_STOCKDISPLAY
```

Selon la version de Marlin et la carte mere, il peut aussi y avoir des options liees aux LCD 12864.

### Ce qu'on peut preparer demain sans risque

Demain, on peut faire ces choses-la :

1. Identifier le modele exact.
2. Faire les photos.
3. Noter la version firmware affichee par l'imprimante.
4. Chercher le firmware officiel de retour arriere.
5. Preparer un premier logo 128 x 64 en noir et blanc.

Ce qu'on ne fait pas demain :

- pas de flash firmware au hasard ;
- pas de firmware CR-10S Pro sur une CR-10S classique ;
- pas de firmware trouve au hasard sur un forum sans verifier ;
- pas de modification avant d'avoir une procedure de retour arriere.

### Plan concret pour plus tard

Quand on aura les photos et le modele exact :

1. Choisir la bonne base firmware.
2. Compiler une version non modifiee pour verifier que la chaine de compilation marche.
3. Flasher cette version seulement si elle correspond exactement au materiel.
4. Ensuite seulement, modifier le boot screen.
5. Compiler.
6. Flasher.
7. Tester les menus, les moteurs, la chauffe, les fins de course.

---

## Structure du depot

```text
replicator2/
|-- app/
|   |-- index.html
|   |-- manifest.json
|   |-- sw.js
|   |-- icon-192.png
|   `-- icon-512.png
|-- api/
|   |-- server.py
|   |-- octoprint_client.py
|   `-- gpio_controller.py
|-- gcode/
|   |-- choreo_1.gcode
|   |-- choreo_2.gcode
|   |-- choreo_3.gcode
|   `-- choreo_4.gcode
|-- scripts/
|   `-- gpio_trigger.py
|-- install.sh
`-- README.md
```

---

## Statut

- [x] Prototype PWA
- [x] API Flask de base
- [x] G-code de test
- [x] README atelier
- [ ] Corriger API/PWA pour passer uniquement par Flask
- [ ] Ajouter une route API pour le G-code manuel
- [ ] Separer installation atelier et installation hotspot
- [ ] Tester OctoPrint avec la CR-10S assemblee
- [ ] Tester mode kiosk HDMI
- [ ] Tester hotspot WiFi
- [ ] Identifier l'ecran et la carte mere CR-10S
- [ ] Preparer un logo 128x64 pour test firmware

---

## Sources utiles

- Documentation OctoPrint - API et authentification : https://docs.octoprint.org/en/master/api/general.html
- Documentation OctoPrint - Application Keys : https://docs.octoprint.org/en/dev/bundledplugins/appkeys.html
- Documentation Marlin - configuration generale et LCD : https://marlinfw.org/docs/configuration/configuration.html
- Documentation Marlin - types de controleurs et d'ecrans : https://marlinfw.org/docs/hardware/controllers.html
- Documentation Marlin - reglages LCD : https://marlinfw.org/docs/setting/lcd.html
- Firmware officiel Creality CR-10S : https://www.crealitycloud.com/downloads/firmware/cr-series/cr-10s
