#!/usr/bin/env python3
"""
REPLICATOR 2 — Serveur API Flask
Pont entre la PWA et OctoPrint / GPIO
Port : 8080
"""

from flask import Flask, jsonify, request
from flask_cors import CORS
from octoprint_client import OctoPrintClient
from gpio_controller import GPIOController
import os
import threading

app = Flask(__name__)
CORS(app)

# --- Config ---
OCTOPRINT_URL = os.environ.get("OCTOPRINT_URL", "http://127.0.0.1:5000")
OCTOPRINT_KEY = os.environ.get("OCTOPRINT_KEY", "VOTRE_CLE_API")
GCODE_DIR     = os.environ.get("GCODE_DIR", "/home/flt/replicator2/gcode")

octo = OctoPrintClient(OCTOPRINT_URL, OCTOPRINT_KEY)
gpio = GPIOController()
choreo_lock = threading.Lock()

# =============================================================
# Utilitaire
# =============================================================

def ok(msg="OK"):
    return jsonify({"status": "ok", "message": msg})

def err(msg, code=500):
    return jsonify({"status": "error", "message": msg}), code

def printer_is_busy(printer):
    state = str(printer.get("state", "")).lower()
    return state not in ("operational", "ready", "idle", "")

# =============================================================
# Statut général
# =============================================================

@app.route("/api/status", methods=["GET"])
def status():
    printer = octo.get_printer_state()
    return jsonify({
        "status": "ok",
        "octoprint": printer,
        "busy": printer_is_busy(printer),
        "fans": gpio.get_states(),
    })

# =============================================================
# Moteurs — M17 (on) / M18 (off)
# =============================================================

MOTOR_AXES = {"1": "X", "2": "Y", "3": "Z", "4": "E"}

PLATEAU_SPEEDS = {
    "slow": 450,
    "medium": 900,
    "fast": 1500,
}

def plateau_units_per_90(plateau_id):
    raw = os.environ.get(f"PLATEAU_{plateau_id}_UNITS_PER_90", "10")
    try:
        value = float(raw)
    except ValueError:
        value = 10.0
    return max(value, 0.01)

@app.route("/api/motor/<motor_id>/<action>", methods=["POST"])
def motor(motor_id, action):
    axis = MOTOR_AXES.get(motor_id)
    if not axis:
        return err(f"Moteur {motor_id} inconnu. Valeurs : 1, 2, 3, 4")
    if action not in ("on", "off"):
        return err("Action invalide. Valeurs : on, off")

    cmd = f"M17 {axis}" if action == "on" else f"M18 {axis}"
    result = octo.send_gcode(cmd)
    if result:
        return ok(f"Moteur {motor_id} ({axis}) -> {action.upper()}")
    return err("Erreur communication OctoPrint")

@app.route("/api/plateau/<plateau_id>/rotate", methods=["POST"])
def plateau_rotate(plateau_id):
    axis = MOTOR_AXES.get(plateau_id)
    if not axis:
        return err(f"Plateau {plateau_id} inconnu. Valeurs : 1, 2, 3, 4")

    data = request.get_json(silent=True) or {}
    try:
        angle = int(data.get("angle", 90))
    except (TypeError, ValueError):
        return err("Angle invalide", 400)

    if angle not in (-180, -90, 90, 180):
        return err("Angle invalide. Valeurs : -180, -90, 90, 180", 400)

    speed_key = str(data.get("speed", "medium"))
    feedrate = PLATEAU_SPEEDS.get(speed_key)
    if feedrate is None:
        return err("Vitesse invalide. Valeurs : slow, medium, fast", 400)

    units = plateau_units_per_90(plateau_id)
    delta = round((angle / 90) * units, 4)

    if axis == "E":
        commands = ["M83", f"G1 E{delta} F{feedrate}", "M82"]
    else:
        commands = ["G91", f"G1 {axis}{delta} F{feedrate}", "G90"]

    result = octo.send_gcode_commands(commands)
    if result:
        return jsonify({
            "status": "ok",
            "message": f"Plateau {plateau_id} -> {angle} degres",
            "axis": axis,
            "angle": angle,
            "speed": speed_key,
            "feedrate": feedrate,
            "units": delta,
        })
    return err("Erreur communication OctoPrint")

# =============================================================
# Plateau chauffant — M140
# =============================================================

@app.route("/api/bed/<action>", methods=["POST"])
def bed(action):
    data = request.get_json(silent=True) or {}
    if action == "on":
        temp = data.get("temp", 60)
        result = octo.send_gcode(f"M140 S{temp}")
        return ok(f"Plateau chauffant ON à {temp}°C") if result else err("Erreur OctoPrint")
    elif action == "off":
        result = octo.send_gcode("M140 S0")
        return ok("Plateau chauffant OFF") if result else err("Erreur OctoPrint")
    return err("Action invalide. Valeurs : on, off")

# =============================================================
# Tête chauffante — M104
# =============================================================

@app.route("/api/hotend/<action>", methods=["POST"])
def hotend(action):
    data = request.get_json(silent=True) or {}
    if action == "on":
        temp = data.get("temp", 200)
        result = octo.send_gcode(f"M104 S{temp}")
        return ok(f"Tête chauffante ON à {temp}°C") if result else err("Erreur OctoPrint")
    elif action == "off":
        result = octo.send_gcode("M104 S0")
        return ok("Tête chauffante OFF") if result else err("Erreur OctoPrint")
    return err("Action invalide. Valeurs : on, off")

# =============================================================
# Ventilateurs — GPIO
# =============================================================

@app.route("/api/fan/<fan_id>/<action>", methods=["POST"])
def fan(fan_id, action):
    if fan_id not in ("1", "2"):
        return err("Ventilateur inconnu. Valeurs : 1, 2")
    if action not in ("on", "off"):
        return err("Action invalide. Valeurs : on, off")
    result = gpio.set_fan(int(fan_id), action == "on")
    return ok(f"Ventilateur {fan_id} -> {action.upper()}") if result else err("Erreur GPIO")

# =============================================================
# G-code manuel
# =============================================================

@app.route("/api/gcode", methods=["POST"])
def gcode():
    data = request.get_json(silent=True) or {}
    command = str(data.get("command", "")).strip()
    if not command:
        return err("Commande G-code vide", 400)
    result = octo.send_gcode(command)
    return ok(f"G-code envoye: {command}") if result else err("Erreur OctoPrint")

# =============================================================
# Chorégraphies — envoi de fichier G-code complet
# =============================================================

@app.route("/api/choreo/run/<choreo_id>", methods=["POST"])
def choreo_run(choreo_id):
    gcode_path = os.path.join(GCODE_DIR, f"choreo_{choreo_id}.gcode")
    if not os.path.exists(gcode_path):
        return err(f"Fichier choreo_{choreo_id}.gcode introuvable")
    if not choreo_lock.acquire(blocking=False):
        return err("Une chorégraphie est déjà en cours de lancement", 409)

    try:
        printer = octo.get_printer_state()
        if not printer.get("connected"):
            return err("OctoPrint non connecté", 503)
        if printer_is_busy(printer):
            return err(f"Imprimante occupée : {printer.get('state', 'inconnu')}", 409)

        result = octo.upload_and_print(gcode_path)
        return ok(f"Chorégraphie {choreo_id} lancée") if result else err("Erreur OctoPrint")
    finally:
        choreo_lock.release()

@app.route("/api/choreo/stop", methods=["POST"])
def choreo_stop():
    # Stoppe l'impression + éteint les chauffages
    octo.send_gcode("M524")   # annule l'impression
    octo.send_gcode("M104 S0")
    octo.send_gcode("M140 S0")
    octo.send_gcode("M18")    # coupe tous les moteurs
    gpio.all_fans_off()
    return ok("Tout arrêté proprement")

# =============================================================
# Lancement
# =============================================================

if __name__ == "__main__":
    app.run(host="0.0.0.0", port=8080, debug=False)
