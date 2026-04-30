#!/usr/bin/env python3
"""
REPLICATOR 2 — Contrôleur GPIO
Gère les ventilateurs via les broches GPIO du Raspberry Pi
"""

# Numéros de broches GPIO (numérotation BCM)
FAN_PINS = {
    1: 17,
    2: 27,
}

# Etat interne des ventilateurs
_fan_states = {1: False, 2: False}

# Tentative d'import GPIO (fonctionne uniquement sur Raspberry Pi réel)
try:
    import RPi.GPIO as GPIO
    GPIO.setmode(GPIO.BCM)
    GPIO.setwarnings(False)
    for pin in FAN_PINS.values():
        GPIO.setup(pin, GPIO.OUT)
        GPIO.output(pin, GPIO.LOW)
    _GPIO_AVAILABLE = True
    print("[GPIO] Raspberry Pi GPIO initialisé.")
except (ImportError, RuntimeError):
    _GPIO_AVAILABLE = False
    print("[GPIO] RPi.GPIO non disponible — mode simulation activé.")


class GPIOController:

    def set_fan(self, fan_id: int, state: bool) -> bool:
        """
        Active ou désactive un ventilateur.
        fan_id : 1 ou 2
        state  : True = ON, False = OFF
        """
        pin = FAN_PINS.get(fan_id)
        if pin is None:
            print(f"[GPIO] Ventilateur {fan_id} inconnu")
            return False

        _fan_states[fan_id] = state
        label = "ON" if state else "OFF"

        if _GPIO_AVAILABLE:
            GPIO.output(pin, GPIO.HIGH if state else GPIO.LOW)
        else:
            print(f"[GPIO] SIMULATION — Ventilateur {fan_id} (GPIO {pin}) -> {label}")

        return True

    def all_fans_off(self):
        """Coupe tous les ventilateurs d'un coup."""
        for fan_id in FAN_PINS:
            self.set_fan(fan_id, False)

    def get_states(self) -> dict:
        """Retourne l'état actuel de tous les ventilateurs."""
        return {f"fan{k}": v for k, v in _fan_states.items()}
