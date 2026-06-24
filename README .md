# CS Dashboard

Touchpoint generator + Kanban board za Customer Success.

## Što radi

- **Generiraj touchpoint** — opišeš situaciju slobodnim tekstom, Claude strukturira touchpoint koji možeš kopirati u Totango
- **Kanban board** — prati otvorene probleme klijenata po statusu (To do / Čeka odgovor / U tijeku / Riješeno)
- **Automatsko dodavanje** — touchpoint se jednim klikom dodaje kao task u board
- Upozorenje za prekoračene rokove
- Radi u browseru, podaci se čuvaju lokalno (localStorage)

## Deploy na GitHub Pages

### 1. Napravi GitHub repozitorij

Idi na [github.com/new](https://github.com/new) i napravi novi repozitorij:
- Ime: `cs-dashboard` (ili što god hoćeš)
- Visibility: **Private** (preporučeno — sadrži API pozive)
- Klikni "Create repository"

### 2. Postavi GitHub Pages

U repozitoriju idi na **Settings → Pages**:
- Source: **Deploy from a branch**
- Branch: `main` / `root`
- Klikni Save

### 3. Upload fileova

Najlakše: u repozitoriju klikni **"uploading an existing file"** i dodaj:
- `index.html`
- `style.css`
- `app.js`

Ili ako koristiš Git:
```bash
git init
git add .
git commit -m "Initial deploy"
git remote add origin https://github.com/TVOJE_IME/cs-dashboard.git
git push -u origin main
```

### 4. Stranica je živa

Nakon ~1 minutu dostupna je na:
`https://TVOJE_IME.github.io/cs-dashboard/`

## Anthropic API ključ

Kod prvog generiranja touchpointa, stranica će te pitati za API ključ:
1. Idi na [console.anthropic.com/settings/keys](https://console.anthropic.com/settings/keys)
2. Klikni "Create Key"
3. Kopiraj ključ i unesi u stranicu

Ključ se čuva samo u tvom browseru (localStorage), nikuda se ne šalje osim direktno Anthropic API-ju.

## Datoteke

```
cs-dashboard/
├── index.html   — struktura stranice
├── style.css    — stilovi (dark mode uključen)
├── app.js       — logika aplikacije
└── README.md    — ove upute
```
