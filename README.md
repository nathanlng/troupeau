# Troupeau

Jeu d'ambiance mobile où il faut **répondre exactement la même chose que son équipe**, en même temps. Un seul téléphone, qu'on se passe entre équipes.

- 2 à 6 équipes de 2 ou 3 joueurs
- Cartes tirées au hasard : Doux (+1), Frisé (+2), Sauvage (+3)
- Cartes flash (+3) : 5 débuts de phrases à compléter en chœur, à la suite
- Mécanique tout ou rien : encaisser le pot ou tenter une autre carte
- Partie sauvegardée automatiquement, écran maintenu allumé

## Jouer en local

Site statique, sans dépendance ni build :

```bash
python3 -m http.server 5173
```

Puis ouvrir `http://localhost:5173`, ou `http://<IP-de-l-ordinateur>:5173` depuis un téléphone sur le même Wi-Fi.

## Structure

- `index.html` : page et mascotte SVG
- `css/style.css` : direction artistique et animations
- `js/app.js` : moteur du jeu
- `js/prompts.js` : thèmes et cartes flash (à modifier librement)
- `DESIGN.md` : direction artistique et plan du jeu
