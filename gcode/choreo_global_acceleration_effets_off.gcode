; Global acceleration effets off
; Tous les vases accelerent progressivement, les effets deviennent inactifs
G91
M17 X Y Z E
M106 S180
M104 S185
M140 S42
G1 X18 Y18 Z18 E6 F260
M106 S120
G1 X24 Y24 Z24 E8 F480
M106 S60
G1 X32 Y32 Z32 E10 F760
M106 S0
M104 S0
M140 S0
G1 X42 Y42 Z42 E12 F1050
G90
