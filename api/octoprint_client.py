#!/usr/bin/env python3
"""
REPLICATOR 2 — Client OctoPrint
Gère toute la communication avec OctoPrint via son API REST
"""

import requests
import os

class OctoPrintClient:

    def __init__(self, base_url, api_key):
        self.base_url = base_url.rstrip("/")
        self.headers  = {
            "X-Api-Key": api_key,
            "Content-Type": "application/json",
        }

    def _get(self, endpoint):
        try:
            r = requests.get(f"{self.base_url}{endpoint}", headers=self.headers, timeout=5)
            return r.json() if r.ok else None
        except Exception as e:
            print(f"[OctoPrint] GET {endpoint} — erreur : {e}")
            return None

    def _post(self, endpoint, data=None):
        try:
            r = requests.post(
                f"{self.base_url}{endpoint}",
                headers=self.headers,
                json=data or {},
                timeout=5
            )
            return r.ok
        except Exception as e:
            print(f"[OctoPrint] POST {endpoint} — erreur : {e}")
            return False

    # --- Etat de l'imprimante ---
    def get_printer_state(self):
        data = self._get("/api/printer")
        if not data:
            return {"connected": False}
        return {
            "connected": True,
            "state": data.get("state", {}).get("text", "Inconnu"),
            "bed_temp":    data.get("temperature", {}).get("bed", {}).get("actual", 0),
            "hotend_temp": data.get("temperature", {}).get("tool0", {}).get("actual", 0),
        }

    # --- Envoi d'une commande G-code ---
    def send_gcode(self, command):
        print(f"[OctoPrint] G-code -> {command}")
        return self._post("/api/printer/command", {"command": command})

    # --- Envoi de plusieurs commandes G-code ---
    def send_gcode_commands(self, commands):
        clean = [str(cmd).strip() for cmd in commands if str(cmd).strip()]
        print(f"[OctoPrint] G-code batch -> {clean}")
        return self._post("/api/printer/command", {"commands": clean})

    # --- Upload et lancement d'un fichier G-code ---
    def upload_and_print(self, filepath):
        filename = os.path.basename(filepath)
        try:
            with open(filepath, "rb") as f:
                r = requests.post(
                    f"{self.base_url}/api/files/local",
                    headers={"X-Api-Key": self.headers["X-Api-Key"]},
                    files={"file": (filename, f, "application/octet-stream")},
                    data={"print": "true"},
                    timeout=30
                )
            print(f"[OctoPrint] Upload {filename} -> {r.status_code}")
            return r.ok
        except Exception as e:
            print(f"[OctoPrint] Upload erreur : {e}")
            return False

    # --- Pause / Reprise ---
    def pause(self):
        return self._post("/api/job", {"command": "pause", "action": "pause"})

    def resume(self):
        return self._post("/api/job", {"command": "pause", "action": "resume"})

    # --- Etat du job en cours ---
    def get_job(self):
        return self._get("/api/job")
