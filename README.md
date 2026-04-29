# REPLICATOR 2

Installation interactive — Festival du Peu 2026  
Le Broc, Alpes-Maritimes (06) — 29 mai au 21 juin 2026

---

## Concept

Une imprimante 3D Creality CR10S devient une œuvre interactive.

Les visiteurs pilotent ses mouvements depuis une tablette tactile ou leur téléphone.  
La machine ne produit rien. Elle performe.

---

## Architecture

Système autonome, sans connexion internet.

```
Raspberry Pi (autonome)
├── OctoPrint (port 5000) → contrôle CR10S
├── Nginx (port 80)       → interface web (PWA)
├── App locale            → UI visiteurs/admin
└── Hotspot WiFi          → accès visiteurs

↓
Tablette HDMI (mode kiosk)
Téléphones visiteurs (WiFi local)
```

---

## Stack

| Composant | Technologie |
|---|---|
| Cerveau | Raspberry Pi 3B+ |
| Contrôle imprimante | OctoPrint (OctoPi) |
| Imprimante | Creality CR10S |
| Interface | PWA HTML / JS |
| Serveur local | Nginx |
| Réseau | Hotspot WiFi Raspberry Pi |
| Coordination | GitHub + Discord |

---

## Structure

```
replicator2/
├── app/
│   └── index.html
├── gcode/
│   ├── choreo_1.gcode
│   ├── choreo_2.gcode
│   ├── choreo_3.gcode
│   └── choreo_4.gcode
├── scripts/
│   └── gpio_trigger.py
├── docs/
│   └── cahier-des-charges.docx
├── .gitignore
└── README.md
```

---

## Configuration

Modifier dans `app/index.html` :

```javascript
const CONFIG = {
  OCTOPRINT_URL:  "http://10.0.0.1:5000",
  API_KEY:        "VOTRE_CLE_API",
  ADMIN_PASSWORD: "mot-de-passe",
  DEFAULT_FEED:   1500,
  DEFAULT_STEP:   10,
}
```

---

## Déploiement (Raspberry Pi)

### Copier les fichiers

```bash
mkdir -p /home/pi/replicator2
cp -r app/* /home/pi/replicator2/
```

### Installer Nginx

```bash
sudo apt install nginx -y
```

### Configurer Nginx

```bash
sudo nano /etc/nginx/sites-available/default
```

```nginx
server {
    listen 80;
    root /home/pi/replicator2;
    index index.html;

    location / {
        try_files $uri $uri/ =404;
    }
}
```

```bash
sudo systemctl restart nginx
```

---

## Mode Kiosk

```bash
chromium-browser --kiosk http://localhost
```

---

## Réseau (Mode Expo)

Le Raspberry Pi agit comme point d'accès WiFi.

SSID : REPLICATOR2  
Accès visiteurs : http://10.0.0.1  

Aucune connexion internet requise.

---

## Accès

| Surface | URL | Profil |
|---|---|---|
| Tablette (kiosk) | http://localhost | Visiteur |
| Téléphone visiteur | http://10.0.0.1 | Visiteur |
| Admin (local) | http://10.0.0.1 | Admin |

---

## Fonctionnalités

### Visiteur
- Lancer une chorégraphie
- Contrôle simplifié

### Admin
- Contrôle axes X/Y/Z
- Envoi G-code
- Paramétrage

---

## Statut

- [x] Concept validé
- [x] Prototype app PWA
- [ ] Installation OctoPrint
- [ ] Connexion CR10S
- [ ] Setup hotspot WiFi
- [ ] Intégration meuble
- [ ] Chorégraphies calibrées
- [ ] Mode kiosk tablette
- [ ] Tests visiteurs
- [ ] Installation chapelle

---

## Équipe

- Artiste : Nice, France  
- Technique : Da Nang, Vietnam (remote)

---

Replicator 2 — une machine qui ne fabrique rien, mais qui performe.
