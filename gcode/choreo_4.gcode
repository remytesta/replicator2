; REPLICATOR 2 — Choreographie 4
; Festival du Peu 2026 — Le Broc
; ---
; Sequence : survol lent de trois points (positions des vases)
; Adapter X Y selon la position reelle des vases dans le meuble

G28 XYZ          ; Homing
G1 Z30 F300      ; Monter haut et lentement

; Vase 1
G1 X50  Y80  F600
G4 P2000         ; Pause au-dessus

; Vase 2
G1 X130 Y80  F600
G4 P2000

; Vase 3
G1 X200 Y120 F600
G4 P2000

; Retour centre
G1 X100 Y100 Z10 F800
G4 P1000

G1 X0 Y0 Z0 F2000 ; Retour origine
