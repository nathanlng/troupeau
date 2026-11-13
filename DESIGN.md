# TROUPEAU — DA & plan de la version mobile

> Jeu d'ambiance « pensez pareil » pour équipes de 2–3 joueurs, sur **un seul téléphone** qu'on se passe.
> Inspiré du principe « répondre la même chose en même temps », avec un nom, une identité visuelle et des thèmes **originaux** (aucune carte du jeu papier n'est reprise).

---

## 1. Adaptation du concept

| Jeu papier | Version mobile |
|---|---|
| Une pioche de cartes au centre | Le téléphone **est** la pioche : il tire un thème au hasard, sans répétition |
| L'équipe suivante lit un thème | L'équipe suivante devient le **Berger** : elle tient le téléphone, lit et arbitre |
| 3 thèmes par carte (★ ✖ ♥) | Difficulté **tirée au hasard** : **Doux +1**, **Frisé +2**, **Sauvage +3** |
| Cartes bleues (expressions à compléter) | **Cartes flash +3** (~1 carte sur 5) : 5 débuts de phrases lus à la suite, réponse en chœur, tout doit être identique |
| On compte « 1, 2, 3 » | Le troupeau compte à voix haute, sans écran de décompte |
| Variante « tenter une autre carte » | Mécanique **tout ou rien** : après une réussite, encaisser le pot ou rejouer en risquant tout |
| Points de pénalité | Score positif : le premier troupeau à 10 / 15 / 20 points gagne |
| Équipe plus nombreuse → un joueur dispensé | Gardé dans les règles : le Berger désigne qui se tait |

### Boucle d'un tour

```
Passation ─► Carte au hasard (Berger lit + juge sur le même écran)
   ▲                ▲                         │
   │                └── Encore une carte ◄── Même réponse (pot +1/+2/+3)
   │                    (tout ou rien)        │
   └──── Troupeau suivant ◄── Encaisser le pot / Pas pareil
```

- **1 joker par tour** : le Berger peut changer de carte une fois (avant la 1re phrase pour une flash).
- Le troupeau ne voit jamais le thème avant qu'il soit lu : le téléphone est chez le Berger.
- La partie est sauvegardée en continu (fermeture d'onglet, appel entrant…) → bouton « Reprendre ».

### Écrans

1. **Accueil** — logo, Nouvelle partie / Reprendre / Comment jouer
2. **Troupeaux** — 2 à 6 équipes, nom libre (placeholder rigolo), objectif 10/15/20
3. **Passation** — « Au tour de X — passe le téléphone au Berger : Y » + scores
4. **Carte** — le thème en très grand + verdict Même réponse / Pas pareil + joker
5. **Carte flash** — carte bleue à 5 lignes ; la ligne en cours grossit, Pareil / Raté fait avancer
6. **Réussite** — troupeau qui saute en rythme, pot, Encaisser / Encore une carte
7. **Échec** — les moutons se dispersent, pot perdu
8. **Victoire** — mouton couronné, classement, Revanche
+ **Menu** (feuille du bas) : scores, son, règles, abandonner

---

## 2. Direction artistique

**Mots-clés :** laine, bande dessinée, sticker, gros boutons qu'on tape sans viser, lisible à 1 m de distance.

### Palette

| Token | Hex | Usage |
|---|---|---|
| `--wool` | `#FFF3E2` | Fond crème « laine », motif de pois discret |
| `--ink` | `#1B1714` | Texte, contours 3 px, ombres portées dures, bouton principal |
| `--paper` | `#FFFFFF` | Cartes, boutons secondaires, laine du mouton |
| `--lvl1` | `#8EDB6A` | Laine Doux · réussite |
| `--lvl2` | `#FFC93C` | Laine Frisé · accent « BÊÊ ! » |
| `--lvl3` | `#FF5C7A` | Laine Sauvage · échec |
| `--flash` / `--flash-row` | `#5B8DFF` / `#A9C4FF` | Carte flash et ses lignes |
| Équipes | `#FF5C7A #4D9FFF #8EDB6A #FFC93C #B57CFF #FF9A3C` | Pastilles et barres de score |

### Typographie

- **Lilita One** (titres, boutons, thèmes) — ronde, épaisse, « gonflée » comme de la laine, lisible de loin.
- **Rubik** 400–800 (texte courant, consignes).
- Le thème s'affiche en `clamp(28px, 8.5vw, 40px)` : on le lit à voix haute sans plisser les yeux.

### Formes

- Néo-brutalisme doux : contour `3px` encre, coins `18–28px`, **ombre portée pleine** `0 5px 0` encre.
- Appui = le bouton s'enfonce (translateY 4px, ombre réduite) → retour tactile visuel.
- Cartes légèrement inclinées (−1,5°) comme posées sur la table.

### Mascotte

Mouton original en SVG : nuage de laine blanche à contour noir, tête noire, joues roses, regard vers la gauche.
Il porte les émotions du jeu :
- **Réussite** : trois moutons sautent en même temps (on pense pareil).
- **Échec** : les trois moutons s'éparpillent.
- **Victoire** : mouton couronné.

### Motion, son, haptique

- Transitions d'écran courtes (300 ms, montée + fondu), cartes qui arrivent en rebond.
- Carte flash : bip montant à chaque ligne réussie + petite vibration.
- Réussite : pluie de pelotes de laine + arpège + « BÊÊ » synthétisé (dents de scie + vibrato) ; échec : deux notes descendantes + vibration longue.
- `prefers-reduced-motion` respecté ; son coupable dans le menu.

---

## 3. Technique

- **Statique, sans build** : `index.html`, `css/style.css`, `js/prompts.js`, `js/app.js`.
- Rendu par écrans (template strings) + délégation d'événements `data-action`.
- État unique sérialisé dans `localStorage` (try/catch, le jeu marche sans).
- Paquet tiré sans remise par niveau, mémorisé entre les parties.
- **Wake Lock API** : l'écran ne s'éteint pas pendant une partie.
- Mobile-first : max 480 px centré, `100dvh`, safe-areas iPhone, cibles tactiles ≥ 56 px, `manifest.webmanifest` pour « Ajouter à l'écran d'accueil ».

### Lancer en local

```bash
python3 -m http.server 5173
```
puis ouvrir `http://localhost:5173` (ou l'IP du Mac depuis le téléphone, même Wi-Fi).

## 4. Pistes suivantes

- Mode 3 joueurs (Berger tournant, points de pénalité).
- Paquets thématiques (Pimenté, Enfants, Ciné…) et ajout de thèmes perso.
- Minuteur de réflexion optionnel.
- Réglage de la fréquence des cartes flash.
- Icônes PNG pour l'écran d'accueil iOS.
