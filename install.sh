#!/bin/bash
# =============================================================
#  REPLICATOR 2 — Script d'installation automatique
#  Festival du Peu 2026 — Le Broc (06)
# =============================================================
#  Usage : bash install.sh
#  A exécuter sur un Raspberry Pi 3B+ sous Raspberry Pi OS Lite
# =============================================================

set -e  # Stoppe le script si une commande échoue

# --- Couleurs pour les messages ---
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

ok()   { echo -e "${GREEN}[OK]${NC} $1"; }
info() { echo -e "${YELLOW}[INFO]${NC} $1"; }
err()  { echo -e "${RED}[ERREUR]${NC} $1"; exit 1; }

# =============================================================
# CONFIGURATION — Modifier ces valeurs si besoin
# =============================================================

WIFI_SSID="REPLICATOR2"
WIFI_PASSWORD="replicator2026"   # Changer pour l'expo
STATIC_IP="10.0.0.1"
DHCP_RANGE_START="10.0.0.10"
DHCP_RANGE_END="10.0.0.50"
PROJECT_DIR="/home/pi/replicator2"
OCTOPRINT_PORT="5000"

# =============================================================
echo ""
echo "=================================================="
echo "   REPLICATOR 2 — Installation automatique"
echo "=================================================="
echo ""
# =============================================================

# --- Vérification : on est bien sur un Raspberry Pi ? ---
if ! grep -q "Raspberry" /proc/cpuinfo 2>/dev/null; then
  info "Pas de Raspberry Pi détecté — on continue quand même (mode test)."
fi

# --- Vérification : exécuté en tant que pi (pas root) ---
if [ "$EUID" -eq 0 ]; then
  err "Ne pas exécuter ce script en root. Utiliser : bash install.sh"
fi

# =============================================================
# ÉTAPE 1 — Mise à jour du système
# =============================================================
info "Étape 1/8 — Mise à jour du système..."
sudo apt update -y && sudo apt upgrade -y
ok "Système à jour."

# =============================================================
# ÉTAPE 2 — Installation des paquets nécessaires
# =============================================================
info "Étape 2/8 — Installation des logiciels..."

sudo apt install -y \
  nginx \
  git \
  python3-pip \
  python3-gpiozero \
  hostapd \
  dnsmasq \
  curl \
  wget \
  ufw

ok "Logiciels installés."

# --- Dépendances Python pour le contrôle GPIO ---
pip3 install RPi.GPIO gpiozero --break-system-packages 2>/dev/null || \
pip3 install RPi.GPIO gpiozero

ok "Dépendances Python installées."

# =============================================================
# ÉTAPE 3 — Copie des fichiers du projet
# =============================================================
info "Étape 3/8 — Mise en place des fichiers du projet..."

mkdir -p "$PROJECT_DIR"

# Si on est déjà dans le dossier du projet cloné depuis GitHub :
if [ -d "./app" ]; then
  cp -r ./app/*     "$PROJECT_DIR/" 2>/dev/null || true
  cp -r ./gcode     "$PROJECT_DIR/" 2>/dev/null || true
  cp -r ./scripts   "$PROJECT_DIR/" 2>/dev/null || true
  ok "Fichiers copiés depuis le dépôt local."
else
  info "Dossier app/ non trouvé — à copier manuellement dans $PROJECT_DIR"
fi

# =============================================================
# ÉTAPE 4 — Configuration de Nginx (serveur web)
# =============================================================
info "Étape 4/8 — Configuration de Nginx..."

sudo bash -c "cat > /etc/nginx/sites-available/default << 'EOF'
server {
    listen 80;
    server_name _;
    root $PROJECT_DIR;
    index index.html;

    # Interface PWA principale
    location / {
        try_files \$uri \$uri/ /index.html;
    }

    # Proxy vers OctoPrint (pour éviter les problèmes CORS)
    location /octoprint/ {
        proxy_pass http://127.0.0.1:$OCTOPRINT_PORT/;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
    }
}
EOF"

sudo nginx -t && sudo systemctl enable nginx && sudo systemctl restart nginx
ok "Nginx configuré et démarré."

# =============================================================
# ÉTAPE 5 — Configuration de l'IP statique
# =============================================================
info "Étape 5/8 — Configuration de l'adresse IP fixe ($STATIC_IP)..."

# Backup de la config existante
sudo cp /etc/dhcpcd.conf /etc/dhcpcd.conf.backup 2>/dev/null || true

# Supprimer un bloc replicator2 existant s'il y en a un
sudo sed -i '/# REPLICATOR2 START/,/# REPLICATOR2 END/d' /etc/dhcpcd.conf

# Ajouter la config IP statique
sudo bash -c "cat >> /etc/dhcpcd.conf << EOF

# REPLICATOR2 START
interface wlan0
  static ip_address=$STATIC_IP/24
  nohook wpa_supplicant
# REPLICATOR2 END
EOF"

ok "IP statique configurée."

# =============================================================
# ÉTAPE 6 — Configuration du Hotspot WiFi (REPLICATOR2)
# =============================================================
info "Étape 6/8 — Configuration du hotspot WiFi '$WIFI_SSID'..."

# --- hostapd : crée le point d'accès WiFi ---
sudo bash -c "cat > /etc/hostapd/hostapd.conf << EOF
interface=wlan0
driver=nl80211
ssid=$WIFI_SSID
hw_mode=g
channel=6
wmm_enabled=0
macaddr_acl=0
auth_algs=1
ignore_broadcast_ssid=0
wpa=2
wpa_passphrase=$WIFI_PASSWORD
wpa_key_mgmt=WPA-PSK
wpa_pairwise=TKIP
rsn_pairwise=CCMP
EOF"

sudo bash -c 'echo "DAEMON_CONF=\"/etc/hostapd/hostapd.conf\"" >> /etc/default/hostapd'

# --- dnsmasq : distribue des adresses IP aux appareils connectés ---
sudo mv /etc/dnsmasq.conf /etc/dnsmasq.conf.backup 2>/dev/null || true
sudo bash -c "cat > /etc/dnsmasq.conf << EOF
interface=wlan0
dhcp-range=$DHCP_RANGE_START,$DHCP_RANGE_END,255.255.255.0,24h
domain=local
address=/replicator.local/$STATIC_IP
EOF"

# --- Activer les services au démarrage ---
sudo systemctl unmask hostapd
sudo systemctl enable hostapd
sudo systemctl enable dnsmasq

ok "Hotspot WiFi '$WIFI_SSID' configuré (mdp: $WIFI_PASSWORD)."

# =============================================================
# ÉTAPE 7 — Installation d'OctoPrint
# =============================================================
info "Étape 7/8 — Installation d'OctoPrint..."

# Créer un environnement virtuel Python pour OctoPrint
python3 -m venv /home/pi/oprint
/home/pi/oprint/bin/pip install --upgrade pip
/home/pi/oprint/bin/pip install octoprint

ok "OctoPrint installé."

# --- Service systemd pour OctoPrint ---
sudo bash -c "cat > /etc/systemd/system/octoprint.service << EOF
[Unit]
Description=OctoPrint — Replicator 2
After=network.target

[Service]
Type=simple
User=pi
ExecStart=/home/pi/oprint/bin/octoprint serve --port $OCTOPRINT_PORT
Restart=on-failure
RestartSec=5

[Install]
WantedBy=multi-user.target
EOF"

sudo systemctl daemon-reload
sudo systemctl enable octoprint
ok "OctoPrint configuré comme service (démarrage automatique)."

# --- Accès au port USB (imprimante) pour l'utilisateur pi ---
sudo usermod -aG dialout pi
ok "Accès port USB (CR10S) accordé à l'utilisateur pi."

# =============================================================
# ÉTAPE 8 — Script GPIO pour les ventilateurs
# =============================================================
info "Étape 8/8 — Script de contrôle des ventilateurs (GPIO)..."

mkdir -p "$PROJECT_DIR/scripts"
cat > "$PROJECT_DIR/scripts/gpio_trigger.py" << 'PYEOF'
#!/usr/bin/env python3
"""
REPLICATOR 2 — Contrôle GPIO
Ventilateurs : GPIO 17 (ventilateur 1), GPIO 27 (ventilateur 2)
Usage : python3 gpio_trigger.py [fan1|fan2] [on|off]
"""
import sys
import RPi.GPIO as GPIO

# Configuration des broches GPIO (numérotation BCM)
PINS = {
    "fan1": 17,
    "fan2": 27,
}

def control(device, state):
    GPIO.setmode(GPIO.BCM)
    GPIO.setwarnings(False)
    pin = PINS.get(device)
    if pin is None:
        print(f"Erreur : appareil '{device}' inconnu. Disponibles : {list(PINS.keys())}")
        sys.exit(1)
    GPIO.setup(pin, GPIO.OUT)
    GPIO.output(pin, GPIO.HIGH if state == "on" else GPIO.LOW)
    print(f"{device} -> {state.upper()} (GPIO {pin})")
    GPIO.cleanup()

if __name__ == "__main__":
    if len(sys.argv) != 3:
        print("Usage : python3 gpio_trigger.py [fan1|fan2] [on|off]")
        sys.exit(1)
    control(sys.argv[1], sys.argv[2])
PYEOF

chmod +x "$PROJECT_DIR/scripts/gpio_trigger.py"
ok "Script GPIO ventilateurs créé."

# =============================================================
# RÉSUMÉ FINAL
# =============================================================
echo ""
echo "=================================================="
echo -e "${GREEN}  INSTALLATION TERMINÉE${NC}"
echo "=================================================="
echo ""
echo "  Réseau WiFi  : $WIFI_SSID"
echo "  Mot de passe : $WIFI_PASSWORD"
echo "  IP Raspberry : $STATIC_IP"
echo ""
echo "  Interface web  : http://$STATIC_IP"
echo "  OctoPrint      : http://$STATIC_IP:$OCTOPRINT_PORT"
echo ""
echo "  Prochaines étapes :"
echo "  1. Redémarrer le Raspberry : sudo reboot"
echo "  2. Se connecter au WiFi REPLICATOR2"
echo "  3. Ouvrir http://$STATIC_IP dans un navigateur"
echo "  4. Ouvrir OctoPrint sur http://$STATIC_IP:$OCTOPRINT_PORT"
echo "     → Récupérer la clé API dans Paramètres > API"
echo "     → Coller la clé dans app/index.html (CONFIG.API_KEY)"
echo "  5. Connecter la CR10S en USB au Raspberry"
echo "  6. Tester le contrôle des ventilateurs :"
echo "     python3 $PROJECT_DIR/scripts/gpio_trigger.py fan1 on"
echo ""
echo "  En cas de problème :"
echo "  - Logs Nginx    : sudo journalctl -u nginx -f"
echo "  - Logs OctoPrint: sudo journalctl -u octoprint -f"
echo "  - Logs hotspot  : sudo journalctl -u hostapd -f"
echo ""
echo "  Redémarrer maintenant ? (recommandé)"
read -p "  [o/n] : " REBOOT
if [[ "$REBOOT" =~ ^[Oo]$ ]]; then
  sudo reboot
fi
