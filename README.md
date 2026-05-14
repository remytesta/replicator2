# REPLICATOR 2

Installation interactive pour le Festival du Peu 2026, Le Broc.

Objectif : piloter une Creality CR-10S avec un Raspberry Pi, OctoPrint et une PWA museale affichee en kiosk sur ecran tactile.

---

## Etat valide au 14 mai 2026

Cette section est la reference atelier actuelle.

### Machine

```text
Raspberry hostname : replicator2
Utilisateur        : flt
Projet             : /home/flt/replicator2
PWA servie par     : Nginx
OctoPrint          : service octoprint, port 5000
API Replicator     : service replicator-api, port 8080
Kiosk ecran        : service replicator-kiosk
Cle OctoPrint      : /etc/replicator2.env
```

### URLs

Remplacer `192.168.8.101` par l'IP actuelle du Raspberry si elle change.

```text
PWA Replicator      : http://192.168.8.101/
API status          : http://192.168.8.101/api/status
OctoPrint direct    : http://192.168.8.101:5000/
OctoPrint via nginx : http://192.168.8.101/octoprint/
```

Depuis le Raspberry :

```bash
curl -s http://localhost/api/status
curl -s http://127.0.0.1:5000/api/version
```

### Branche atelier actuelle

La branche poussee avec les corrections kiosk/cache/install est :

```text
msueal-v5
```

Mise a jour sur le Raspberry :

```bash
cd /home/flt/replicator2
git pull origin msueal-v5
sudo systemctl restart nginx
sudo systemctl stop replicator-kiosk
rm -rf /home/flt/.cache/chromium
rm -rf /home/flt/.config/chromium
sudo systemctl start replicator-kiosk
```

Verifier que la PWA n'est plus une vieille version :

```bash
curl -s http://localhost/index.html | grep 'v='
```

La version valide apres le fix bouton/cache est `v18`.

---

## Runbook interventions du 14 mai 2026

Cette section resume les corrections validees pendant la session atelier.

### Probleme 1 : cle API OctoPrint confuse

Ancienne doc :

```bash
sudo systemctl edit replicator-api
```

Cette methode a ete abandonnee parce qu'elle ouvre un override systemd fragile. La methode validee est :

```bash
echo 'OCTOPRINT_KEY=COLLER_LA_CLE_ICI' | sudo tee /etc/replicator2.env
sudo chmod 600 /etc/replicator2.env
sudo systemctl restart replicator-api
```

### Probleme 2 : OctoPrint direct OK, proxy `/octoprint/` KO

OctoPrint marchait sur :

```text
http://192.168.8.101:5000/
```

Le proxy Nginx `/octoprint/` a ete corrige avec les headers :

```nginx
proxy_set_header X-Script-Name /octoprint;
proxy_set_header X-Scheme $scheme;
proxy_set_header Upgrade $http_upgrade;
proxy_set_header Connection "upgrade";
proxy_redirect off;
```

### Probleme 3 : API Flask OK en direct, KO via Nginx

Symptome :

```text
405 Not Allowed
```

La commande directe marchait :

```bash
curl -X POST http://127.0.0.1:8080/api/gcode -H "Content-Type: application/json" -d '{"command":"M105"}'
```

La config Nginx a ete reecrite pour que `/api/` proxy bien vers Flask :

```nginx
location /api/ {
    proxy_pass http://127.0.0.1:8080/api/;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
}
```

Validation :

```bash
curl -X POST http://localhost/api/gcode -H "Content-Type: application/json" -d '{"command":"M105"}'
```

Reponse valide :

```json
{"message":"G-code envoye: M105","status":"ok"}
```

### Probleme 4 : kiosk et autologin

Le Raspberry arrivait sur le login console. L'autologin `flt` et le service kiosk ont ete valides avec :

```text
replicator-kiosk.service
/home/flt/.xinitrc
/etc/systemd/system/getty@tty1.service.d/autologin.conf
```

### Probleme 5 : orientation ecran et tactile

La rotation validee en fin de session etait :

```bash
xrandr -o right
xinput set-prop "WaveShare WS170120" "Coordinate Transformation Matrix" 0 1 0 -1 0 1 0 0 1 || true
```

### Probleme 6 : Google Translate revient dans Chromium

Solution la plus forte ajoutee au runbook : policy systeme Chromium dans :

```text
/etc/chromium/policies/managed/replicator-no-translate.json
```

Avec :

```json
{
  "TranslateEnabled": false,
  "DefaultBrowserSettingEnabled": false,
  "BrowserSignin": 0,
  "SyncDisabled": true
}
```

### Probleme 7 : PWA encore en cache `v17`

Le fix PWA est en `v18`. Apres `git pull`, il faut vider Chromium :

```bash
sudo systemctl stop replicator-kiosk
rm -rf /home/flt/.cache/chromium
rm -rf /home/flt/.config/chromium
sudo systemctl start replicator-kiosk
```

---

## Services

### Verifier les services

```bash
sudo systemctl status nginx --no-pager
sudo systemctl status octoprint --no-pager
sudo systemctl status replicator-api --no-pager
sudo systemctl status replicator-kiosk --no-pager
```

### Redemarrer les services

```bash
sudo systemctl restart nginx
sudo systemctl restart octoprint
sudo systemctl restart replicator-api
sudo systemctl restart replicator-kiosk
```

### Logs utiles

```bash
sudo journalctl -u nginx -n 80 --no-pager
sudo journalctl -u octoprint -n 80 --no-pager
sudo journalctl -u replicator-api -n 80 --no-pager
sudo journalctl -u replicator-kiosk -n 80 --no-pager
```

---

## OctoPrint et G-code

Les G-code marchent seulement si OctoPrint est lance, si la cle API est bonne, et si l'imprimante est connectee dans OctoPrint.

### Ouvrir OctoPrint

Depuis un ordinateur sur le meme reseau :

```text
http://ADRESSE_IP_DU_RASPBERRY:5000/
```

Exemple atelier :

```text
http://192.168.8.101:5000/
```

### Connecter la CR-10S

Dans OctoPrint, panneau `Connection` :

```text
Serial Port : /dev/ttyUSB0
Baudrate    : 115200
```

Activer aussi :

```text
Auto-connect to printer on server startup
```

Si `115200` ne marche pas, tester `250000`.

Verifier que le Raspberry voit l'imprimante :

```bash
ls -l /dev/ttyUSB* /dev/ttyACM* 2>/dev/null
```

Sur le prototype, le bon port etait :

```text
/dev/ttyUSB0
```

### Tester la chaine G-code

Tester OctoPrint directement :

```bash
curl -H "X-Api-Key: COLLER_LA_CLE_ICI" http://127.0.0.1:5000/api/version
```

Tester l'API Flask directe :

```bash
curl -X POST http://127.0.0.1:8080/api/gcode -H "Content-Type: application/json" -d '{"command":"M105"}'
```

Tester l'API via Nginx, comme le fait la PWA :

```bash
curl -X POST http://localhost/api/gcode -H "Content-Type: application/json" -d '{"command":"M105"}'
```

Reponse attendue :

```json
{"message":"G-code envoye: M105","status":"ok"}
```

Tester une choregraphie :

```bash
curl -X POST http://localhost/api/choreo/run/maquette_respiration
```

Verifier les fichiers G-code :

```bash
ls -1 /home/flt/replicator2/gcode/choreo_*.gcode | wc -l
ls -1 /home/flt/replicator2/gcode | grep "choreo_global"
```

### Si OctoPrint bouge mais pas l'app

Tester l'API via Nginx :

```bash
curl -X POST http://localhost/api/gcode -H "Content-Type: application/json" -d '{"command":"M105"}'
```

Si ca renvoie `405 Not Allowed`, Nginx ne proxy pas `/api/` vers Flask. Revoir la config Nginx plus bas.

Si ca renvoie `ok`, vider Chromium :

```bash
sudo systemctl stop replicator-kiosk
rm -rf /home/flt/.cache/chromium
rm -rf /home/flt/.config/chromium
sudo systemctl start replicator-kiosk
```

---

## Cle API OctoPrint

### Generer la cle

Dans OctoPrint :

```text
Settings
-> Application Keys ou API
-> creer une cle pour replicator2
-> copier la cle
```

### Installer la cle sur le Raspberry

Ne plus utiliser `sudo systemctl edit replicator-api`.

Methode simple :

```bash
echo 'OCTOPRINT_KEY=COLLER_LA_CLE_ICI' | sudo tee /etc/replicator2.env
sudo chmod 600 /etc/replicator2.env
sudo systemctl restart replicator-api
```

Verifier :

```bash
sudo cat /etc/replicator2.env
curl -H "X-Api-Key: COLLER_LA_CLE_ICI" http://127.0.0.1:5000/api/version
curl -s http://localhost/api/status
```

---

## Nginx

### Root attendu

Nginx doit servir :

```text
/home/flt/replicator2/app
```

Verifier :

```bash
sudo nginx -T | grep "root"
```

Resultat attendu :

```text
root /home/flt/replicator2/app;
```

### Config Nginx valide

Si `/api/` ou `/octoprint/` casse, reecrire la config :

```bash
sudo tee /etc/nginx/sites-available/default >/dev/null <<'EOF'
server {
    listen 80;
    server_name _;
    root /home/flt/replicator2/app;
    index index.html;

    location = /sw.js {
        add_header Cache-Control "no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0" always;
        try_files $uri =404;
    }

    location = /manifest.json {
        add_header Cache-Control "no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0" always;
        try_files $uri =404;
    }

    location ~* \.(?:html|js|css)$ {
        add_header Cache-Control "no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0" always;
        try_files $uri =404;
    }

    location /api/ {
        proxy_pass http://127.0.0.1:8080/api/;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }

    location /octoprint/ {
        proxy_pass http://127.0.0.1:5000/;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Script-Name /octoprint;
        proxy_set_header X-Scheme $scheme;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_redirect off;
    }

    location / {
        try_files $uri $uri/ /index.html;
    }
}
EOF

sudo nginx -t
sudo systemctl restart nginx
```

Ne pas coller seulement le bloc `location /api/` dans le terminal : ce n'est pas une commande Bash.

---

## Kiosk ecran tactile

Le kiosk est gere par :

```text
replicator-kiosk.service
```

Il lance :

```text
/home/flt/.xinitrc
```

### Service kiosk

Verifier :

```bash
sudo systemctl status replicator-kiosk --no-pager
sudo systemctl cat replicator-kiosk.service
```

Redemarrer seulement l'ecran/PWA :

```bash
sudo systemctl restart replicator-kiosk
```

### Version .xinitrc valide

Version de base pour ecran Waveshare, Chromium kiosk, Google Translate desactive :

```bash
xset s off
xset -dpms
xset s noblank
xrandr -o right
xinput set-prop "WaveShare WS170120" "Coordinate Transformation Matrix" 0 1 0 -1 0 1 0 0 1 || true
unclutter -idle 0.2 &
openbox-session &
chromium --kiosk \
  --user-data-dir=/home/flt/.config/chromium \
  --no-first-run \
  --no-default-browser-check \
  --noerrdialogs \
  --disable-infobars \
  --disable-session-crashed-bubble \
  --disable-translate \
  --disable-features=Translate,TranslateUI,OptimizationHints \
  --disable-component-update \
  --lang=fr-FR \
  --accept-lang=fr-FR \
  http://localhost/index.html?v=103
```

### Rotation ecran et tactile

Normal :

```bash
xrandr -o normal
xinput set-prop "WaveShare WS170120" "Coordinate Transformation Matrix" 1 0 0 0 1 0 0 0 1 || true
```

180 degres :

```bash
xrandr -o inverted
xinput set-prop "WaveShare WS170120" "Coordinate Transformation Matrix" -1 0 1 0 -1 1 0 0 1 || true
```

90 degres gauche :

```bash
xrandr -o left
xinput set-prop "WaveShare WS170120" "Coordinate Transformation Matrix" 0 -1 1 1 0 0 0 0 1 || true
```

90 degres droite :

```bash
xrandr -o right
xinput set-prop "WaveShare WS170120" "Coordinate Transformation Matrix" 0 1 0 -1 0 1 0 0 1 || true
```

Identifier le nom exact du tactile :

```bash
DISPLAY=:0 xinput list
```

Sur le prototype :

```text
WaveShare WS170120
```

### Bloquer Google Translate

Chromium peut faire revenir Google Translate malgre les flags. Ajouter une policy systeme :

```bash
sudo systemctl stop replicator-kiosk

sudo mkdir -p /etc/chromium/policies/managed

sudo tee /etc/chromium/policies/managed/replicator-no-translate.json >/dev/null <<'EOF'
{
  "TranslateEnabled": false,
  "DefaultBrowserSettingEnabled": false,
  "BrowserSignin": 0,
  "SyncDisabled": true
}
EOF

rm -rf /home/flt/.cache/chromium
rm -rf /home/flt/.config/chromium

sudo systemctl start replicator-kiosk
```

Verifier dans Chromium :

```text
chrome://policy
```

On veut voir :

```text
TranslateEnabled = false
```

### Si le kiosk demande encore login

Forcer l'autologin console :

```bash
sudo mkdir -p /etc/systemd/system/getty@tty1.service.d

sudo tee /etc/systemd/system/getty@tty1.service.d/autologin.conf >/dev/null <<'EOF'
[Service]
ExecStart=
ExecStart=-/sbin/agetty --autologin flt --noclear %I $TERM
EOF

sudo systemctl set-default multi-user.target
sudo systemctl daemon-reload
sudo reboot
```

---

## Installation neuve apres carte SD cassee

### 1. Flasher la carte SD

Avec Raspberry Pi Imager :

```text
OS       : Raspberry Pi OS Lite 64-bit
Hostname : replicator2
User     : flt
SSH      : active
WiFi     : reseau atelier si besoin
Locale   : France / clavier FR
```

### 2. Premier demarrage

Depuis l'ordinateur atelier :

```bash
ssh flt@replicator2.local
```

Si ca ne marche pas, chercher l'IP dans la box puis :

```bash
ssh flt@ADRESSE_IP_DU_RASPBERRY
```

### 3. Installer Git et cloner

```bash
sudo apt update
sudo apt install -y git curl

cd /home/flt
git clone -b msueal-v5 https://github.com/remytesta/replicator2.git replicator2
cd /home/flt/replicator2
```

Si le dossier existe mais est casse :

```bash
cd /home/flt
mv replicator2 replicator2_broken_$(date +%Y%m%d_%H%M%S)
git clone -b msueal-v5 https://github.com/remytesta/replicator2.git replicator2
cd /home/flt/replicator2
```

### 4. Lancer install.sh

Ne pas lancer avec `sudo`.

```bash
bash install.sh
```

Le script demande si la cle API OctoPrint existe deja :

```text
Avez-vous deja la cle API OctoPrint ? [o/n]
```

Si OctoPrint n'est pas encore configure, repondre `n`, puis ajouter la cle plus tard dans `/etc/replicator2.env`.

### 5. Apres install

```bash
sudo systemctl status nginx --no-pager
sudo systemctl status octoprint --no-pager
sudo systemctl status replicator-api --no-pager
sudo systemctl status replicator-kiosk --no-pager
curl -s http://localhost/api/status
```

---

## Alimentation Raspberry

OctoPrint peut signaler une sous-alimentation. Dans ce cas, l'USB peut devenir instable et la CR-10S peut se deconnecter.

Verifier :

```bash
vcgencmd get_throttled
```

Resultat ideal :

```text
throttled=0x0
```

Si autre chose apparait :

```text
utiliser une alimentation Raspberry officielle ou 5V / 3A stable
eviter cable USB trop long ou trop fin
eviter les hubs USB faibles
debrancher le clavier/dongle USB si possible
```

Preferer SSH depuis l'ordinateur :

```bash
ssh flt@192.168.8.101
```

---

## Backup carte SD

Le plus fiable est une image complete de la carte SD.

### Depuis Windows

1. Eteindre proprement :

```bash
sudo shutdown now
```

2. Retirer la carte SD.
3. Utiliser Win32 Disk Imager.
4. Choisir la lettre de la carte SD.
5. Choisir un fichier de sortie :

```text
replicator2-backup-2026-05-14.img
```

6. Cliquer sur `Read`.

### Sauvegarde rapide des configs

Sur le Raspberry :

```bash
mkdir -p /home/flt/backup-replicator2

sudo cp /etc/nginx/sites-available/default /home/flt/backup-replicator2/nginx-default.conf
sudo cp /etc/replicator2.env /home/flt/backup-replicator2/replicator2.env
sudo cp /etc/systemd/system/replicator-api.service /home/flt/backup-replicator2/
sudo cp /etc/systemd/system/octoprint.service /home/flt/backup-replicator2/
sudo cp /etc/systemd/system/replicator-kiosk.service /home/flt/backup-replicator2/
cp /home/flt/.xinitrc /home/flt/backup-replicator2/xinitrc

tar -czf /home/flt/backup-replicator2.tar.gz -C /home/flt backup-replicator2
```

---

## Hotspot WiFi

Le mode hotspot existe mais il est a utiliser prudemment, car il modifie le reseau et peut compliquer SSH.

Configuration prevue :

```text
SSID          : REPLICATOR2
Mot de passe  : replicator2026
IP Raspberry  : 10.0.0.1
URL PWA       : http://10.0.0.1/
```

Pour la mise au point atelier, preferer le WiFi/routeur existant, par exemple le routeur Huawei.

---

## Architecture

```text
[ PWA Chromium kiosk / tablette / ordinateur ]
                 |
                 v
[ Nginx : http://raspberry/ ]
                 |
                 +--> /api/        -> [ API Flask replicator-api : 127.0.0.1:8080 ]
                 |                         |
                 |                         v
                 |                  [ OctoPrint : 127.0.0.1:5000 ]
                 |                         |
                 |                         v
                 |                  [ CR-10S via USB ]
                 |
                 +--> /octoprint/  -> [ OctoPrint via proxy ]
```

Principe : la PWA ne parle pas directement a OctoPrint avec une cle visible dans le navigateur. Elle appelle l'API Flask locale. L'API garde la cle OctoPrint cote Raspberry dans `/etc/replicator2.env`.

---

## Structure du depot

```text
replicator2/
|-- app/
|   |-- index.html
|   |-- styles.css
|   |-- app.js
|   |-- vases-data.js
|   |-- sw.js
|   |-- manifest.json
|   |-- main/
|   |-- vase/
|   `-- diapo/
|-- api/
|   |-- server.py
|   |-- octoprint_client.py
|   `-- gpio_controller.py
|-- gcode/
|   `-- choreo_*.gcode
|-- scripts/
|   `-- gpio_trigger.py
|-- install.sh
`-- README.md
```

---

## Phase 3 - ecran integre CR-10S

Cette partie n'a pas encore ete faite. Ne pas flasher l'imprimante sans identifier exactement le modele et la carte mere.

Avant toute modification firmware :

```text
1. Photo de l'imprimante complete.
2. Photo de l'ecran allume.
3. Version firmware affichee.
4. Photo carte mere.
5. References carte mere.
6. Type exact d'ecran.
7. Firmware officiel de retour arriere.
```

Risques si mauvais firmware :

```text
ecran noir
moteurs mal configures
chauffe mal geree
imprimante bloquee
```

---

## Statut

- [x] PWA museale
- [x] API Flask Replicator
- [x] Cle API OctoPrint via `/etc/replicator2.env`
- [x] Nginx `/api/` vers Flask
- [x] Nginx `/octoprint/` vers OctoPrint
- [x] Kiosk Chromium via `replicator-kiosk`
- [x] Autologin console
- [x] Rotation ecran/tactile Waveshare
- [x] Cache PWA `v18`
- [x] G-code manuel via API Flask
- [ ] Tester toutes les choregraphies une par une sur machine surveillee
- [ ] Faire image backup carte SD
- [ ] Stabiliser alimentation Raspberry
- [ ] Decider si hotspot exposition doit etre active
- [ ] Identifier ecran/carte mere CR-10S pour phase firmware

---

## Sources utiles

- Documentation OctoPrint - API et authentification : https://docs.octoprint.org/en/master/api/general.html
- Documentation OctoPrint - Application Keys : https://docs.octoprint.org/en/dev/bundledplugins/appkeys.html
- Documentation Marlin - configuration generale et LCD : https://marlinfw.org/docs/configuration/configuration.html
- Documentation Marlin - types de controleurs et d'ecrans : https://marlinfw.org/docs/hardware/controllers.html
- Documentation Marlin - reglages LCD : https://marlinfw.org/docs/setting/lcd.html
- Firmware officiel Creality CR-10S : https://www.crealitycloud.com/downloads/firmware/cr-series/cr-10s
