#!/usr/bin/env python3
"""
REPLICATOR 2 — Declenchement par detecteur d'appui
Festival du Peu 2026 — Le Broc

Surveille un pin GPIO du Raspberry Pi.
Un appui declenche automatiquement une choreographie via l'API OctoPrint.

Branchement : capteur entre GPIO 17 et GND
"""

import RPi.GPIO as GPIO
import requests
import time
import json

# ─── CONFIGURATION ───────────────────────────────────────────
OCTOPRINT_URL  = "http://localhost"        # OctoPrint tourne sur le Pi
API_KEY        = "VOTRE_CLE_API_ICI"       # Cle API OctoPrint
GPIO_PIN       = 17                        # Pin GPIO du capteur
DEBOUNCE_MS    = 500                       # Anti-rebond en millisecondes
CHOREO_FILE    = "/home/pi/choreo_1.gcode" # Fichier G-code a lancer
# ─────────────────────────────────────────────────────────────

HEADERS = {
    "Content-Type": "application/json",
    "X-Api-Key": API_KEY
}

def send_gcode(commands):
    """Envoie des commandes G-code a OctoPrint."""
    try:
        res = requests.post(
            f"{OCTOPRINT_URL}/api/printer/command",
            headers=HEADERS,
            json={"commands": commands},
            timeout=5
        )
        if res.status_code == 204:
            print(f"[OK] Commandes envoyees : {commands}")
        else:
            print(f"[ERREUR] Status {res.status_code}")
    except Exception as e:
        print(f"[ERREUR] Connexion OctoPrint : {e}")

def on_press(channel):
    """Callback declenche a chaque appui sur le capteur."""
    print("[APPUI] Capteur detecte — lancement choreographie")
    send_gcode([
        "G28 XYZ",
        "G1 Z20 F500",
        "G1 X150 F1500",
        "G4 P2000",
        "G1 X0 Y0 Z0 F2000"
    ])

def main():
    print("REPLICATOR 2 — Detecteur d'appui actif")
    print(f"Pin GPIO : {GPIO_PIN}")
    print("En attente d'un appui...\n")

    GPIO.setmode(GPIO.BCM)
    GPIO.setup(GPIO_PIN, GPIO.IN, pull_up_down=GPIO.PUD_UP)
    GPIO.add_event_detect(
        GPIO_PIN,
        GPIO.FALLING,
        callback=on_press,
        bouncetime=DEBOUNCE_MS
    )

    try:
        while True:
            time.sleep(0.1)
    except KeyboardInterrupt:
        print("\nArret du script.")
    finally:
        GPIO.cleanup()

if __name__ == "__main__":
    main()
