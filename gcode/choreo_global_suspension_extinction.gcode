; Global suspension extinction
; Ralentissement jusqu'a suspension, effets maintenus puis extinction nette
G91
M17 X Y Z E
M106 S150
M104 S190
M140 S48
G1 X30 Y30 Z30 E10 F700
G1 X18 Y18 Z18 E6 F420
G1 X8 Y8 Z8 E3 F180
G4 P1800
M106 S0
M104 S0
M140 S0
G4 P300
G90
