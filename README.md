# Happy Décors — site de location de décors gonflables

Site **statique** (aucune compilation), rapide et gratuit à héberger. Pensé pour mettre en avant le catalogue et déclencher des **demandes de contact**.

- **Code** : GitHub
- **Hébergement** : Netlify (publication automatique à chaque modif)
- **Formulaire** : Netlify Forms → les demandes arrivent dans le tableau Netlify (et par email si tu actives la notification)

---

## 1. Modifier le catalogue (le plus courant)

Tout le catalogue est dans **`assets/decors.js`**. Chaque décor est une ligne :

```js
{ id: "DG_023", name: "Pégase / Licorne ailée", theme: "Animaux", u: "animaux", price: 250, featured: true },
```

- `name` : le nom affiché.
- `theme` : le petit badge sur la photo.
- `u` : l'univers (sert au filtre). Clés possibles : `amour`, `animaux`, `gourmandises`, `villes`, `espace`, `halloween`, `fetes`, `pop`, `ete`, `ambiance`.
- `price` : prix en € pour 48h. Mettre `0` = affiche **« Sur devis »**.
- `featured: true` (facultatif) : met le décor en avant.
- **Photo attendue** : `assets/decors/<id>.jpg` (carré, idéalement 600×600 ou plus).

### Ajouter un décor
1. Dépose la photo dans `assets/decors/` (ex. `assets/decors/DG_200.jpg`).
2. Ajoute une ligne dans `assets/decors.js` avec le même `id`.

### Remplacer une photo
Écrase simplement le fichier `assets/decors/<id>.jpg` par la nouvelle (même nom).

---

## 2. Modifier les textes / coordonnées

- Accroche, étapes, contact : directement dans **`index.html`**.
- Email du formulaire : se configure côté **Netlify** (voir ci-dessous), pas dans le code.

---

## 3. Mise en ligne (déploiement)

1. **GitHub** : pousser ce dossier dans un dépôt (ex. `happydecors-site`).
2. **Netlify** : « Add new site » → « Import from GitHub » → choisir le dépôt.
   - Build command : *(vide)*
   - Publish directory : `.`
3. **Recevoir les demandes par email** : Netlify → *Site settings → Forms → Form notifications → Add notification → Email* → `contact@happydecors.fr`.
4. **Nom de domaine** : Netlify → *Domain settings* → ajouter `happydecors.fr` et faire pointer le DNS (Netlify donne les enregistrements à mettre chez ton registrar).

Une fois branché, **chaque modification poussée sur GitHub republie le site automatiquement** en ~1 min.

---

## Structure

```
index.html            page principale
merci.html            page de remerciement (après envoi sans JS)
mentions-legales.html
assets/
  styles.css          design
  app.js              filtres, recherche, lightbox, formulaire
  decors.js           LE CATALOGUE (à éditer)
  decors/             les 106 visuels
  favicon.svg
netlify.toml          config de déploiement
```
