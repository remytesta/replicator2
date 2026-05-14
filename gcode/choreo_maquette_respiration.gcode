; Maquette respiration mecanique
; Axe X: acceleration progressive puis ralentissement
G91
M17 X
G1 X20 F500
G1 X30 F900
G1 X40 F1400
G4 P300
G1 X-40 F1400
G1 X-30 F900
G1 X-20 F500
G4 P500
G90
