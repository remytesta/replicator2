# REPLICATOR 2 - Brief atelier pour demain

Ce document sert a guider les tests en atelier, sans supposer que tout le monde connait Git, OctoPrint ou le Raspberry Pi.

## 1. Ce qui est deja dans le projet

Les fichiers principaux sont toujours presents :

- `app/index.html` : interface PWA principale.
- `app/replicator2.html` : ancienne interface / prototype precedent.
- `api/server.py` : petit serveur Flask qui sert de pont entre la PWA, OctoPrint et les GPIO.
- `api/octoprint_client.py` : communication avec OctoPrint.
- `api/gpio_controller.py` : controle des ventilateurs / sorties Raspberry.
- `gcode/choreo_*.gcode` : sequences G-code de test.
- `install.sh` : installation Raspberry actuelle, a simplifier pour la phase atelier.

Les fichiers PWA suivants existent aussi localement mais doivent encore etre valides puis ajoutes a Git :

- `app/manifest.json`
- `app/sw.js`
- `app/icon-192.png`
- `app/icon-512.png`

## 2. Objectif de demain

Ne pas essayer de tout faire en meme temps.

Objectif de demain :

1. Raspberry Pi demarre.
2. SSH fonctionne.
3. OctoPrint fonctionne.
4. La PWA s'affiche sur un ecran ou une tablette en HDMI.
5. La CR-10S est vue par OctoPrint via USB.

Le hotspot WiFi public vient apres. L'ecran integre de l'imprimante vient encore apres.

## 3. Installer Git sur le Mac de l'atelier

Sur le Mac, ouvrir Terminal.

Installer Git :

```bash
xcode-select --install
```

Verifier :

```bash
git --version
```

Recuperer le projet :

```bash
cd ~/Desktop
git clone https://github.com/remytesta/replicator2.git
cd replicator2
```

Plus tard, pour recuperer les mises a jour :

```bash
cd ~/Desktop/replicator2
git pull
```

## 4. Activer SSH sur le Raspberry

Le plus simple est de le faire dans Raspberry Pi Imager, avant de flasher la carte SD.

Dans Raspberry Pi Imager :

1. Choisir Raspberry Pi OS.
2. Ouvrir les options avancees.
3. Activer SSH.
4. Definir un utilisateur et un mot de passe.
5. Configurer le WiFi de l'atelier si besoin.
6. Flasher la carte SD.

Ensuite, depuis le Mac :

```bash
ssh pi@raspberrypi.local
```

Si ca ne marche pas, trouver l'adresse IP du Raspberry sur la box ou le routeur, puis :

```bash
ssh pi@ADRESSE_IP_DU_RASPBERRY
```

## 5. Cle API OctoPrint

Important : on ne peut pas generer une vraie cle OctoPrint maintenant depuis le projet GitHub.

La cle est generee par OctoPrint sur le Raspberry, apres installation et creation du compte admin.

Il ne faut pas mettre cette cle dans GitHub. Une cle API est comme une cle de maison : si elle est publique, n'importe qui peut commander l'imprimante.

### Methode recommandee demain

1. Ouvrir OctoPrint dans le navigateur.
2. Se connecter avec le compte admin.
3. Aller dans les reglages OctoPrint.
4. Chercher la partie `Application Keys` ou `API`.
5. Generer une cle pour l'application `replicator2`.
6. Copier la cle.
7. La mettre sur le Raspberry dans la configuration locale du service API.

Exemple avec systemd :

```bash
sudo systemctl edit replicator-api
```

Coller :

```ini
[Service]
Environment=OCTOPRINT_KEY=COLLER_LA_CLE_ICI
```

Puis :

```bash
sudo systemctl daemon-reload
sudo systemctl restart replicator-api
sudo journalctl -u replicator-api -f
```

### Test rapide de la cle

Depuis le Raspberry :

```bash
curl -H "X-Api-Key: COLLER_LA_CLE_ICI" http://127.0.0.1:5000/api/version
```

Si OctoPrint repond avec une version, la cle fonctionne.

## 6. Lancer la PWA sur l'ecran HDMI

Quand Nginx sert l'application en local :

```bash
chromium-browser --kiosk --noerrdialogs --disable-infobars http://localhost
```

Pour demain, on peut lancer cette commande a la main. L'autodemarrage viendra apres, quand tout est stable.

## 7. Hotspot WiFi : pas pour le premier test

Le hotspot consiste a transformer le Raspberry en mini-box WiFi.

Il diffusera par exemple :

```text
Nom du WiFi : REPLICATOR2
Adresse    : http://10.0.0.1
```

Les visiteurs se connecteront a ce WiFi avec leur telephone, puis ouvriront l'adresse locale.

Mais pour demain, il vaut mieux ne pas l'activer tout de suite. Le hotspot change la configuration reseau du Raspberry et peut compliquer le SSH si quelque chose est mal regle.

## 8. Ecran integre de la CR-10S

Ce point est possible a etudier, mais ce n'est pas un reglage simple comme changer une image sur une carte SD.

Sur une imprimante 3D, le petit ecran est generalement pilote par le firmware de l'imprimante. Sur les Creality CR-10S, ce firmware est souvent base sur Marlin ou sur une variante Creality de Marlin.

Pour changer le logo ou l'ecran de demarrage, il faut probablement :

1. Identifier exactement le modele de CR-10S.
2. Identifier la carte mere.
3. Identifier le type d'ecran.
4. Recuperer le firmware d'origine.
5. Compiler un firmware modifie.
6. Flasher la carte mere, et parfois l'ecran selon le modele.

Ce n'est pas impossible, mais ce n'est pas le bon chantier pour demain.

### Pourquoi c'est risque

Si on flashe le mauvais firmware :

- l'ecran peut rester noir ;
- l'imprimante peut ne plus demarrer correctement ;
- les moteurs peuvent etre mal configures ;
- les temperatures peuvent etre mal lues ;
- il faut alors reflasher avec le bon firmware pour revenir en arriere.

### Ce qu'on peut faire demain sans risque

Prendre des photos nettes :

- facade de l'imprimante ;
- ecran allume ;
- menu `About` ou `Info` si disponible ;
- carte mere, si le boitier est ouvert ;
- references imprimees sur la carte ;
- connecteurs de l'ecran.

Avec ces photos, on pourra chercher la bonne procedure.

### Ce qu'il ne faut pas faire demain

- Ne pas flasher de firmware au hasard.
- Ne pas utiliser un firmware CR-10S Pro si c'est une CR-10S classique.
- Ne pas supposer que tous les ecrans Creality fonctionnent pareil.
- Ne pas modifier l'ecran avant d'avoir une sauvegarde ou un firmware officiel de retour.

## 9. Resume pour ton frere

Demain, le but n'est pas de finaliser l'oeuvre.

Le but est de verifier la chaine de base :

```text
Mac -> SSH -> Raspberry -> OctoPrint -> CR-10S
                         -> PWA sur ecran HDMI
```

Une fois cette chaine validee, on pourra proprement ajouter :

1. le mode hotspot WiFi ;
2. les tests visiteurs sur telephone ;
3. les ventilateurs / GPIO ;
4. la recherche firmware pour l'ecran integre.

## 10. Sources utiles

- Documentation OctoPrint - API et authentification : https://docs.octoprint.org/en/master/api/general.html
- Documentation OctoPrint - Application Keys : https://docs.octoprint.org/en/dev/bundledplugins/appkeys.html
- Documentation Marlin - configuration LCD / bootscreen : https://marlinfw.org/docs/configuration/configuration.html
- Documentation Marlin - types de controleurs et d'ecrans : https://marlinfw.org/docs/hardware/controllers.html
- Firmware officiel Creality CR Series : https://www.crealitycloud.com/downloads/firmware/cr-series/cr-10s
