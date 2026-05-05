#!/bin/bash
# =============================================================
#  REPLICATOR 2 — Script d'installation automatique
#  Festival du Peu 2026 — Le Broc (06)
# =============================================================
#  Usage : bash install.sh
#  A exécuter sur un Raspberry Pi 3B+ sous Raspberry Pi OS Lite
# =============================================================

set -e

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

ok()   { echo -e "${GREEN}[OK]${NC} $1"; }
info() { echo -e "${YELLOW}[INFO]${NC} $1"; }
err()  { echo -e "${RED}[ERREUR]${NC} $1"; exit 1; }

# =============================================================
# CONFIGURATION — Modifier ces valeurs si besoin
# =============================================================

WIFI_SSID="REPLICATOR2"
WIFI_PASSWORD="replicator2026"
STATIC_IP="10.0.0.1"
DHCP_RANGE_START="10.0.0.10"
DHCP_RANGE_END="10.0.0.50"
PROJECT_DIR="/home/flt/replicator2"
OCTOPRINT_PORT="5000"
API_PORT="8080"

# =============================================================
echo ""
echo "=================================================="
echo "   REPLICATOR 2 — Installation automatique"
echo "=================================================="
echo ""
# =============================================================

if [ "$EUID" -eq 0 ]; then
  err "Ne pas exécuter ce script en root. Utiliser : bash install.sh"
fi

# =============================================================
# ÉTAPE 1 — Mise à jour du système
# =============================================================
info "Étape 1/9 — Mise à jour du système..."
sudo apt update -y && sudo apt upgrade -y
ok "Système à jour."

# =============================================================
# ÉTAPE 2 — Installation des paquets
# =============================================================
info "Étape 2/9 — Installation des logiciels..."

sudo apt install -y \
  nginx \
  git \
  python3-pip \
  python3-venv \
  python3-gpiozero \
  hostapd \
  dnsmasq \
  curl \
  wget \
  ufw

ok "Logiciels installés."

# =============================================================
# ÉTAPE 3 — Copie des fichiers du projet
# =============================================================
info "Étape 3/9 — Mise en place des fichiers du projet..."

mkdir -p "$PROJECT_DIR/app"
mkdir -p "$PROJECT_DIR/gcode"
mkdir -p "$PROJECT_DIR/scripts"
mkdir -p "$PROJECT_DIR/api"

if [ -d "./app" ]; then
  cp -r ./app/*   "$PROJECT_DIR/app/"   2>/dev/null || true
  ok "Dossier app/ copié."
fi

if [ -d "./gcode" ]; then
  cp -r ./gcode/* "$PROJECT_DIR/gcode/" 2>/dev/null || true
  ok "Dossier gcode/ copié."
fi

if [ -d "./api" ]; then
  cp -r ./api/*   "$PROJECT_DIR/api/"   2>/dev/null || true
  ok "Dossier api/ copié."
fi

if [ -d "./scripts" ]; then
  cp -r ./scripts/* "$PROJECT_DIR/scripts/" 2>/dev/null || true
  ok "Dossier scripts/ copié."
fi

# =============================================================
# ÉTAPE 4 — Environnement Python + dépendances Flask
# =============================================================
info "Étape 4/9 — Installation de Flask et dépendances Python..."

python3 -m venv "$PROJECT_DIR/venv"
"$PROJECT_DIR/venv/bin/pip" install --upgrade pip
"$PROJECT_DIR/venv/bin/pip" install \
  flask \
  flask-cors \
  requests \
  RPi.GPIO

ok "Flask et dépendances installés dans l'environnement virtuel."

# =============================================================
# ÉTAPE 5 — Service systemd pour l'API Flask
# =============================================================
info "Étape 5/9 — Configuration du service API Flask..."

sudo bash -c "cat > /etc/systemd/system/replicator-api.service << EOF
[Unit]
Description=Replicator 2 — API Flask
After=network.target octoprint.service
Requires=octoprint.service

[Service]
Type=simple
User=flt
WorkingDirectory=$PROJECT_DIR/api
Environment=OCTOPRINT_URL=http://127.0.0.1:$OCTOPRINT_PORT
Environment=GCODE_DIR=$PROJECT_DIR/gcode
ExecStart=$PROJECT_DIR/venv/bin/python server.py
Restart=on-failure
RestartSec=5

[Install]
WantedBy=multi-user.target
EOF"

sudo systemctl daemon-reload
sudo systemctl enable replicator-api
ok "Service API Flask configuré (démarrage automatique)."

# =============================================================
# ÉTAPE 6 — Configuration de Nginx
# =============================================================
info "Étape 6/9 — Configuration de Nginx..."

sudo bash -c "cat > /etc/nginx/sites-available/default << EOF
server {
    listen 80;
    server_name _;
    root $PROJECT_DIR/app;
    index index.html;

    # PWA
    location / {
        try_files \\\$uri \\\$uri/ /index.html;
    }

    # Proxy API Flask
    location /api/ {
        proxy_pass http://127.0.0.1:$API_PORT/api/;
        proxy_set_header Host \\\$host;
        proxy_set_header X-Real-IP \\\$remote_addr;
    }

    # Proxy OctoPrint (accès technique)
    location /octoprint/ {
        proxy_pass http://127.0.0.1:$OCTOPRINT_PORT/;
        proxy_set_header Host \\\$host;
        proxy_set_header X-Real-IP \\\$remote_addr;
    }
}
EOF"

sudo nginx -t && sudo systemctl enable nginx && sudo systemctl restart nginx
ok "Nginx configuré."

# =============================================================
# ÉTAPE 7 — IP statique
# =============================================================
info "Étape 7/9 — Configuration de l'adresse IP fixe ($STATIC_IP)..."

sudo cp /etc/dhcpcd.conf /etc/dhcpcd.conf.backup 2>/dev/null || true
sudo sed -i '/# REPLICATOR2 START/,/# REPLICATOR2 END/d' /etc/dhcpcd.conf

sudo bash -c "cat >> /etc/dhcpcd.conf << EOF

# REPLICATOR2 START
interface wlan0
  static ip_address=$STATIC_IP/24
  nohook wpa_supplicant
# REPLICATOR2 END
EOF"

ok "IP statique configurée ($STATIC_IP)."

# =============================================================
# ÉTAPE 8 — Hotspot WiFi
# =============================================================
info "Étape 8/9 — Configuration du hotspot WiFi '$WIFI_SSID'..."

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

# Eviter la ligne en double
grep -q 'DAEMON_CONF' /etc/default/hostapd || \
  sudo bash -c 'echo "DAEMON_CONF=\"/etc/hostapd/hostapd.conf\"" >> /etc/default/hostapd'

sudo mv /etc/dnsmasq.conf /etc/dnsmasq.conf.backup 2>/dev/null || true
sudo bash -c "cat > /etc/dnsmasq.conf << EOF
interface=wlan0
dhcp-range=$DHCP_RANGE_START,$DHCP_RANGE_END,255.255.255.0,24h
domain=local
address=/replicator.local/$STATIC_IP
EOF"

sudo systemctl unmask hostapd
sudo systemctl enable hostapd
sudo systemctl enable dnsmasq
ok "Hotspot WiFi '$WIFI_SSID' configuré."

# =============================================================
# ÉTAPE 9 — OctoPrint
# =============================================================
info "Étape 9/9 — Installation d'OctoPrint..."

python3 -m venv /home/flt/oprint
/home/flt/oprint/bin/pip install --upgrade pip
/home/flt/oprint/bin/pip install octoprint

sudo bash -c "cat > /etc/systemd/system/octoprint.service << EOF
[Unit]
Description=OctoPrint — Replicator 2
After=network.target

[Service]
Type=simple
User=flt
ExecStart=/home/flt/oprint/bin/octoprint serve --port $OCTOPRINT_PORT
Restart=on-failure
RestartSec=5

[Install]
WantedBy=multi-user.target
EOF"

sudo systemctl daemon-reload
sudo systemctl enable octoprint
sudo usermod -aG dialout flt
ok "OctoPrint installé et configuré."

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
echo "  API Flask      : http://$STATIC_IP/api/"
echo "  OctoPrint      : http://$STATIC_IP/octoprint/"
echo ""
echo "  Prochaines étapes après redémarrage :"
echo "  1. Connecter la CR10S en USB"
echo "  2. Ouvrir OctoPrint : http://$STATIC_IP/octoprint/"
echo "     → Paramètres > API > copier la clé"
echo "     → Coller dans api/server.py (variable OCTOPRINT_KEY)"
echo "     → Ou via variable d'environnement :"
echo "       sudo systemctl edit replicator-api"
echo "       Ajouter : Environment=OCTOPRINT_KEY=VOTRE_CLE"
echo "  3. Tester l'interface : http://$STATIC_IP"
echo "  4. Tester un ventilateur :"
echo "     curl -X POST http://$STATIC_IP/api/fan/1/on"
echo ""
echo "  Logs en temps réel :"
echo "  - API Flask  : sudo journalctl -u replicator-api -f"
echo "  - OctoPrint  : sudo journalctl -u octoprint -f"
echo "  - Nginx      : sudo journalctl -u nginx -f"
echo "  - Hotspot    : sudo journalctl -u hostapd -f"
echo ""
read -p "  Redémarrer maintenant ? [o/n] : " REBOOT
if [[ "$REBOOT" =~ ^[Oo]$ ]]; then
  sudo reboot
fi
