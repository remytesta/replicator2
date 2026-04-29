; REPLICATOR 2 — Choreographie 2
; Festival du Peu 2026 — Le Broc
; ---
; Sequence : pendule gauche/droite, 3 allers-retours lents

G28 XYZ          ; Homing
G1 Z10 F500      ; Lever legerement
G4 P500

G1 X200 F800     ; Aller droite (lent)
G4 P1000
G1 X0 F800       ; Retour gauche
G4 P1000
G1 X200 F800
G4 P1000
G1 X0 F800
G4 P1000
G1 X200 F800
G4 P1000
G1 X0 F800
G4 P1000

G1 Z0 F500       ; Descendre
G1 X0 Y0 F2000   ; Retour origine
