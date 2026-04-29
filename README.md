# REPLICATOR 2

Installation interactive — Festival du Peu 2026
Le Broc, Alpes-Maritimes (06) — 29 mai au 21 juin 2026

---

## Concept

Une imprimante 3D Creality CR10S devient une oeuvre interactive.
Les visiteurs pilotent ses mouvements depuis une tablette tactile ou leur telephone.
La machine ne produit rien. Elle performe.

---

## Stack

| Composant | Technologie |
|---|---|
| Cerveau | Raspberry Pi 3B+ |
| Controle imprimante | OctoPrint (OctoPi) |
| Imprimante | Creality CR10S |
| Interface visiteur | PWA HTML/JS (ce repo) |
| Acces distant | Tailscale + VPS |
| Coordination | Discord |

---

## Structure

```
replicator2/
├── app/
│   └── replicator2.html     # App PWA complete (visiteur + admin)
├── gcode/
│   ├── choreo_1.gcode       # Choreographie 1
│   ├── choreo_2.gcode       # Choreographie 2
│   ├── choreo_3.gcode       # Choreographie 3
│   └── choreo_4.gcode       # Choreographie 4
├── scripts/
│   └── gpio_trigger.py      # Declenchement par detecteur d'appui
├── docs/
│   └── cahier-des-charges.docx
├── .gitignore
└── README.md
```

---

## Configuration

Ouvrir `app/replicator2.html` et modifier le bloc `CONFIG` en haut du fichier :

```javascript
const CONFIG = {
  OCTOPRINT_URL:  "http://192.168.1.42",  // IP du Raspberry Pi
  API_KEY:        "VOTRE_CLE_API",         // Cle API OctoPrint
  ADMIN_PASSWORD: "mot-de-passe",          // Acces mode admin
  DEFAULT_FEED:   1500,                    // Vitesse par defaut mm/min
  DEFAULT_STEP:   10,                      // Pas de jog par defaut mm
}
```

---

## Deploiement

### Sur le Raspberry Pi (tablette kiosk)

```bash
# Copier l'app sur le Pi
scp app/replicator2.html pi@IP-DU-PI:/home/pi/

# Lancer Chromium en mode kiosk au demarrage
# Ajouter dans /etc/rc.local :
chromium-browser --kiosk --noerrdialogs file:///home/pi/replicator2.html
```

### Sur le VPS (acces distant)

```bash
scp app/replicator2.html user@VPS:/var/www/html/replicator2/index.html
```

---

## Acces

| Surface | URL | Profil |
|---|---|---|
| Tablette sur place | fichier local kiosk | Visiteur |
| Telephone visiteur | http://IP-PI ou VPS | Visiteur |
| Admin Vietnam | https://VPS/replicator2 + mot de passe | Admin |
| Admin Nice | idem ou Tailscale direct | Admin |

---

## Reseau (Tailscale)

Tailscale cree un tunnel direct entre Vietnam et le Pi a Nice.

```bash
# Installation sur le Pi (une seule fois)
curl -fsSL https://tailscale.com/install.sh | sh
sudo tailscale up

# Depuis Vietnam : acceder au Pi via son IP Tailscale
ssh pi@100.64.0.XX
```

---

## Equipe

- Artiste : Nice, France
- Technique : Da Nang, Vietnam (remote)

---

## Statut

- [x] Cahier des charges
- [x] Proto app PWA
- [ ] Installation OctoPrint sur Pi
- [ ] Connexion CR10S
- [ ] Tailscale configure
- [ ] Choreographies testees sur machine
- [ ] Deploy VPS
- [ ] Tests complets
- [ ] Ouverture festival 29 mai 2026
