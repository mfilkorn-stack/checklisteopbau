import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// GitHub Pages liefert das Projekt unter https://<user>.github.io/checklisteopbau/
// aus, deshalb der Unterpfad als base. Auch dev/preview laufen darunter, damit
// lokal exakt dieselben Pfade gelten wie in der Veröffentlichung.
export default defineConfig({
  base: "/checklisteopbau/",
  plugins: [react()],
});
