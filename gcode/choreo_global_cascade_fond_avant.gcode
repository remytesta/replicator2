; Global cascade fond avant
; Les mouvements partent du fond vers l'avant, chaque effet repond au precedent
G91
M17 X Y Z E
G1 X28 F420
G4 P450
G1 Z28 F420
M106 S90
G4 P450
G1 Y28 F520
M140 S46
G4 P450
G1 E10 F120
M104 S190
G4 P700
M106 S0
M140 S0
M104 S0
G90
