# The European Football MacGuffin

A made-up title belt that has passed from club to club across the top five leagues and Europe since August 1992. Beat the holder and it’s yours.

Inspired by Tyler Budge’s College Football MacGuffin. This is an independent project and isn’t affiliated with or endorsed by him. Match data from FBref. Club crests belong to their clubs.

## Folder contents

- `index.html`, `styles.css`, `app.js`: the site itself
- `data/chain.js`, `data/details.js`: the belt’s path and the match details (made by `build_site_data.py`)
- `data/logos.js` and the `logos` folder: club crests (made by `download_logos.py`). Without them the site just shows no crests.

## Preview on your computer

Double-click `index.html`.

## Putting it online (GitHub Pages)

1. Sign in at github.com and create a new public repository named `european-football-macguffin`.
2. On the new repository page, click "uploading an existing file".
3. First batch: drag in everything except the `logos` folder (the three site files, the `data` folder and this README). Commit.
4. Second batch: click Add file, then Upload files, and drag in the `logos` folder. Commit. (GitHub’s web uploader takes about 100 files at a time, which is why this is split.)
5. Open the repository’s Settings, then Pages. Under "Build and deployment", set Source to "Deploy from a branch", pick `main` and `/ (root)`, and save.
6. After a minute or two the site is live at `https://YOUR-USERNAME.github.io/european-football-macguffin/`.

## Updating

1. Update your CSV files, then run `build_site_data.py` in Jupyter. It rewrites `data/chain.js` and `data/details.js`.
2. On the repository page, open the `data` folder, click Add file, then Upload files, drop in the two new files, and commit.
