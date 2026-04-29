; REPLICATOR 2 — Choreographie 1
; Festival du Peu 2026 — Le Broc
; ---
; Sequence : retour a l'origine, lever lent, deplacement droit, retour

G28 XYZ          ; Homing tous les axes
G1 Z20 F500      ; Lever la tete lentement
G4 P1000         ; Pause 1s
G1 X150 F1500    ; Deplacement axe X
G4 P2000         ; Pause 2s
G1 X0 F1500      ; Retour X
G4 P1000         ; Pause 1s
G1 Z0 F500       ; Descendre
G1 X0 Y0 F2000   ; Retour origine
