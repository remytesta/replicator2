; REPLICATOR 2 — Choreographie 3
; Festival du Peu 2026 — Le Broc
; ---
; Sequence : spirale montante XY + Z

G28 XYZ          ; Homing
G1 Z5 F500

G1 X50  Y50  F1200
G1 X150 Y50  Z10 F1200
G1 X150 Y150 Z20 F1200
G1 X50  Y150 Z30 F1200
G1 X50  Y50  Z40 F1200
G1 X100 Y100 Z50 F800
G4 P2000         ; Pause en haut

G1 X0 Y0 Z0 F2000 ; Retour rapide
