# OP-Bau Erfassung

Digitale Erfassungs-Checkliste für OP-Bauprojekte – Stufe 1 (MVP).

Datenbasis: **medifa Fragenkatalog V3.1 DE** + **OP Playbook 2.1** (Gate-Logik).
Architektur: Katalog als Daten, generischer Feld-Renderer, Vorbelegung aus den klinischen Gates.

**Live:** https://mfilkorn-stack.github.io/checklisteopbau/

## Funktionen

- **Module:** Projektkopf, Betten-Entscheidung (3 Gates), klinische Gates, Räume, OP-Tische, Arthroskopie, Schnittstellen & Bestand, Montage, Angebotsreife
- **Räume:** beliebig viele Räume in 7 Typen (OP-Saal, Waschraum, Aufwachraum, Steri/AEMP, Lager, Flur, Sonstige), duplizierbar, je Raum beliebig viele Schiebe-/Drehflügeltüren
- **Gate-Logik:** „C-Bogen = nein" belegt alle Strahlenschutzfragen vor, „Raumklasse Ia" markiert die TAV-Zuluftdecke zur Prüfung
- **Angebotsreife:** Live-Score über alle Pflichtfelder, offene Punkte als klickbare Sprungliste und als Text für die Follow-up-Mail
- **Datenhaltung:** JSON-Export/-Import, Druck-/PDF-Ausgabe. Kein automatisches Speichern – Zwischenstände über den JSON-Export sichern.
- **Beispieldatensatz** „Bielefeld" per Klick ladbar

## Lokale Entwicklung

```bash
npm install
npm run dev      # Dev-Server auf http://localhost:5173
npm run build    # Produktions-Build nach dist/
npm run preview  # Build lokal prüfen
```

## Deployment

Jeder Push auf `main` baut das Projekt und veröffentlicht es über GitHub Actions
(`.github/workflows/deploy.yml`) auf GitHub Pages.

Einmalige Einrichtung im Repository: **Settings → Pages → Build and deployment →
Source: „GitHub Actions"**.

Da die Seite unter dem Unterpfad `/checklisteopbau/` ausgeliefert wird, setzt
`vite.config.js` die passende `base` – nur für den Build, lokal bleibt es `/`.

## Technik

React 18 · Vite 5 · Tailwind CSS 3 · lucide-react
