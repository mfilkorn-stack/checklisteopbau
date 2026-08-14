import React, { useState, useRef, useMemo } from "react";
import { Download, Upload, Copy, Plus, Trash2, CopyPlus, CheckCircle2, AlertTriangle, Circle, FileText } from "lucide-react";

/* =====================================================================
   OP-Bau Erfassung – Stufe 1 (MVP)
   Datenbasis: medifa Fragenkatalog V3.1 DE + OP Playbook 2.1 (Gates)
   Architektur: Katalog als Daten, generischer Renderer, Prefill aus Gates
   ===================================================================== */

const C = {
  ink: "#17414E",
  paper: "#FAFBFB",
  line: "#DDE5E7",
  grey: "#5B6B70",
  accent: "#E8830C",
  ok: "#3D7A34",
  warn: "#B08A2E",
  bad: "#B03A2E",
  soft: "#EEF3F4",
};

const PB = ["0,5 mm Pb", "1,0 mm Pb", "1,5 mm Pb", "2,0 mm Pb", "3,0 mm Pb"];

/* ---------------- Katalogdefinition (medifa V3.1) ---------------- */

const doorQs = (pfx) => [
  { id: pfx + "_breite", t: "num", unit: "mm", label: "Türbreite (Außenmaß inkl. Zarge)", req: true },
  { id: pfx + "_licht", t: "num", unit: "mm", label: "Gewünschte lichte Öffnungsbreite" },
  { id: pfx + "_ausb", t: "num", unit: "mm", label: "Bauseitiges Ausschnittmaß – Breite" },
  { id: pfx + "_aush", t: "num", unit: "mm", label: "Bauseitiges Ausschnittmaß – Höhe" },
  { id: pfx + "_fluegel", t: "choice", label: "Türblätter", opts: ["Einflügelig", "Zweiflügelig"] },
  { id: pfx + "_auto", t: "choice", label: "Türöffnung", opts: ["Automatisch", "Manuell"] },
  { id: pfx + "_fenster", t: "bool", label: "Türfenster" },
  { id: pfx + "_fgr", t: "choice", label: "Türfenstergröße", opts: ["500x600 mm", "250x1800 mm"], showIf: (a) => a[pfx + "_fenster"] === true },
  { id: pfx + "_pb", t: "pb", label: "Strahlenschutz erforderlich", gate: "c_bogen" },
  { id: pfx + "_jal", t: "bool", label: "Jalousie gewünscht (nur Fenster 500x600 mm)", showIf: (a) => a[pfx + "_fenster"] === true },
  { id: pfx + "_milch", t: "bool", label: "Fenster elektrisch schaltbar auf milchig", showIf: (a) => a[pfx + "_fenster"] === true },
  { id: pfx + "_herm", t: "bool", label: "Hermetische Schließung erforderlich" },
  { id: pfx + "_wandst", t: "num", unit: "mm", label: "Bauseitige Wandstärke" },
  { id: pfx + "_schalter", t: "choice", label: "Schalter", opts: ["Schalter in der Zarge (Standard)", "Kontaktlos / Sensor", "Elektrische Schlagleiste"] },
  { id: pfx + "_schleuse", t: "bool", label: "Schleusenfunktion notwendig" },
  { id: pfx + "_bem", t: "area", label: "Bemerkungen" },
];

const ROOM_SECTIONS = [
  {
    id: "hoehen", title: "2 · Raumhöhen", types: ["op", "wasch", "awr", "steri", "lager", "flur", "sonst"],
    qs: [
      { id: "h_roh", t: "num", unit: "m", label: "Fertigfußboden zu Rohdecke", req: true },
      { id: "h_dec", t: "num", unit: "m", label: "Fertigfußboden zu abgehängter Decke" },
      { id: "h_bem", t: "area", label: "Bemerkungen (z. B. dwg vorhanden)" },
    ],
  },
  {
    id: "wand", title: "3 · Wandelemente", types: ["op", "wasch", "awr", "steri", "lager", "flur", "sonst"],
    qs: [
      { id: "w_typ", t: "choice", label: "Wandsystem", req: true, opts: ["1-teilig raumhoch (Raster max. 900 mm)", "2-teilig raumhoch (Raster max. 1.190 mm)", "3-teilig raumhoch (Raster max. 1.190 mm)"] },
      { id: "w_mat", t: "choice", label: "Material", req: true, opts: ["Edelstahl-pulverbeschichtet", "Edelstahl-geschliffen", "Stahlblech-pulverbeschichtet", "Glas", "HPL (nur 1-teilig)"] },
      { id: "w_pb", t: "pb", label: "3.4 Strahlenschutz Wand", gate: "c_bogen" },
      { id: "w_design", t: "bool", label: "3.5 Designelement (Digitaldruck) gewünscht" },
    ],
  },
  {
    id: "fensterin", title: "4 · Wandfenster (innen)", types: ["op", "awr", "steri"],
    qs: [
      { id: "fi_ja", t: "bool", label: "Wandfenster innen vorgesehen" },
      { id: "fi_gr", t: "choice", label: "4.1 Fenstergröße", opts: ["1.200x900 mm", "1.200x1000 mm", "1.200x1.800 mm", "1.200x2.700 mm"], showIf: (a) => a.fi_ja === true },
      { id: "fi_pb", t: "pb", label: "4.2 Strahlenschutz Fenster", gate: "c_bogen", showIf: (a) => a.fi_ja === true },
      { id: "fi_jal", t: "choice", label: "4.3 Innenliegende Jalousie", opts: ["Nein", "Elektrisch", "Manuell"], showIf: (a) => a.fi_ja === true },
      { id: "fi_milch", t: "bool", label: "4.4 Elektrisch schaltbar auf milchig", showIf: (a) => a.fi_ja === true },
    ],
  },
  {
    id: "fensterbau", title: "5 · Bauseitige Fenster", types: ["op", "awr", "steri", "sonst"],
    qs: [
      { id: "fb_vor", t: "bool", label: "5.1 Fenster vor das bauseitige Fenster verbauen" },
      { id: "fb_an", t: "bool", label: "5.2 Wandsystem an bauseitiges Fenster anschließen" },
      { id: "fb_bem", t: "area", label: "5.3 Bemerkungen (z. B. laut Plan)" },
    ],
  },
  {
    id: "decke", title: "6/7 · Decke & Raumbeleuchtung", types: ["op", "wasch", "awr", "steri", "lager", "flur", "sonst"],
    qs: [
      { id: "d_kass", t: "choice", label: "6.1 Größe Deckenkassetten", opts: ["600x600 mm", "1.200x600 mm"] },
      { id: "l_gr", t: "choice", label: "7.1 Größe Raumleuchten", opts: ["600x600 mm", "1.200x600 mm"] },
      { id: "l_anz", t: "text", label: "7.2 Anzahl Raumleuchten (oder Standard)" },
      { id: "l_typ", t: "choice", label: "7.3 Leuchtentyp", opts: ["LED", "LED-RGB-W"] },
      { id: "l_amb", t: "bool", label: "7.4 LED-Streifen als Ambientebeleuchtung" },
      { id: "l_dali", t: "bool", label: "7.5 DALI-Steuerung erforderlich" },
    ],
  },
  {
    id: "einbau", title: "10 · Einbauelemente", types: ["op"],
    qs: [
      { id: "e_integra", t: "bool", label: "10.1 OP-INTEGRA-Tableau" },
      { id: "e_ifn", t: "multi", label: "INTEGRA-Funktionen", showIf: (a) => a.e_integra === true, opts: ["Raumlicht An/Aus", "Raumlicht Farben (RGB)", "Raumtemperatur", "Jalousien Türen", "Jalousien Fenster", "Stoppuhr", "Alarm med. Gase", "Alarm Lüftung", "Hinweisleuchte (Röntgen/Laser)", "PACS/KIS-Anbindung", "Musik Player", "Video Streaming", "Steuerung OP-Leuchte", "Videokonferenz"] },
      { id: "e_doku", t: "choice", label: "10.3 OP-Dokumentationsplatz", opts: ["Nein", "27 Zoll", "32 Zoll", "55 Zoll"] },
      { id: "e_mon", t: "choice", label: "10.4 OP-Betrachtungsmonitor", opts: ["Nein", "43 Zoll", "55 Zoll"] },
      { id: "e_tast", t: "bool", label: "10.5 Tastatur für Betrachtungsmonitor" },
      { id: "e_sid", t: "bool", label: "10.6 Surgical Information Display (SID)" },
      { id: "e_uhr", t: "bool", label: "10.7 Digitale Uhr" },
      { id: "e_naht", t: "bool", label: "10.8 Nahtgutmaterialschrank" },
      { id: "e_s1", t: "qty", label: "10.9 Einbauschrank einflügelig (B 400/500/600)" },
      { id: "e_s2", t: "qty", label: "10.9 Einbauschrank zweiflügelig (B 800/1.000/1.200)" },
      { id: "e_sfen", t: "bool", label: "Schranktüren mit Fenstereinsatz" },
      { id: "e_sglas", t: "bool", label: "Zweiflügelig Vollglastür + LED" },
      { id: "e_siso", t: "bool", label: "Schrank mit ISO-Korbsystem" },
      { id: "e_skath", t: "bool", label: "Katheterauszüge erforderlich" },
      { id: "e_sabschl", t: "bool", label: "Türen abschließbar" },
      { id: "e_d1", t: "qty", label: "10.11 Durchreicheschrank einflügelig" },
      { id: "e_d2", t: "qty", label: "10.11 Durchreicheschrank zweiflügelig" },
      { id: "e_df1", t: "qty", label: "10.12 Durchreichefenster (Schiebefenster)" },
      { id: "e_df2", t: "qty", label: "10.12 Durchreichefenster (Drehflügel)" },
      { id: "e_schl", t: "qty", label: "10.12 Schleuse mit gegenseitiger Verriegelung" },
      { id: "e_schlpb", t: "pb", label: "10.13 Strahlenschutz Schleuse", gate: "c_bogen", showIf: (a) => a.e_schl && a.e_schl.ja },
      { id: "e_abl1", t: "qty", label: "10.15 Abluftkanäle Eckversion 135°" },
      { id: "e_abl2", t: "qty", label: "10.15 Abluftkanäle gerade hinter Wand" },
      { id: "e_tav", t: "choice", label: "10.17 TAV-Zuluftdecke", gate: "raumklasse", opts: ["Nein", "2.070x2.070 mm", "2.070x2.760 mm", "2.070x3.450 mm", "Andere Größe"] },
      { id: "e_tavand", t: "text", label: "TAV andere Größe (mm)", showIf: (a) => a.e_tav === "Andere Größe" },
      { id: "e_zul", t: "qty", label: "10.19 Zuluft-Rasterauslässe 610x610 mm" },
      { id: "e_h14", t: "qty", label: "10.19 Filter H14 erforderlich" },
      { id: "e_bem", t: "area", label: "10.14/10.16/10.20 Bemerkungen (z. B. zentrale Lagerung außerhalb, Rüstzone)" },
    ],
  },
  {
    id: "dve", title: "11 · Deckenversorgungseinheiten", types: ["op"],
    qs: [
      { id: "v_arm", t: "choice", label: "Armkonfiguration", req: true, opts: ["1 Arm", "2 Arme", "1 Arm motorisiert", "2 Arme motorisiert", "Tandemversion"] },
      { id: "v_kreis", t: "choice", label: "11.1.1 Stromkreise", opts: ["1er Stromkreis", "2er Stromkreis"] },
      { id: "v_230", t: "qty", label: "Steckdosen 230 V" },
      { id: "v_pot", t: "qty", label: "Potentialausgleich" },
      { id: "v_daten", t: "multi", label: "Daten-Anschlüsse", opts: ["RJ45", "HDMI", "DVI", "Display Port", "3G-SDI"] },
      { id: "v_o2", t: "qty", label: "Gas O₂" },
      { id: "v_n2o", t: "qty", label: "Gas N₂O" },
      { id: "v_agfs", t: "qty", label: "AGFS" },
      { id: "v_vac", t: "qty", label: "VAC" },
      { id: "v_a4", t: "qty", label: "Air 4 bar" },
      { id: "v_a7", t: "qty", label: "Air 7 bar" },
      { id: "v_abl", t: "qty", label: "Ablageböden" },
      { id: "v_schub", t: "qty", label: "Schubladen" },
      { id: "v_monh", t: "qty", label: "Monitorhalter" },
      { id: "v_inf", t: "qty", label: "Infusionsstange" },
      { id: "v_bef", t: "qty", label: "Befestigungsstange" },
      { id: "v_bem", t: "area", label: "11.2 Bemerkungen" },
    ],
  },
  {
    id: "leuchte", title: "12 · OP-Leuchte", types: ["op"],
    qs: [
      { id: "o_anz", t: "text", label: "Anzahl (oder Standard)", req: true },
      { id: "o_ab1", t: "num", unit: "cm", label: "Abstand Boden–Zwischendecke" },
      { id: "o_ab2", t: "num", unit: "cm", label: "Abstand Zwischendecke–Decke" },
      { id: "o_tav", t: "bool", label: "Zentrale Montage in TAV-Decke gewünscht" },
      { id: "o_achse", t: "choice", label: "12.2 Zentralachse", opts: ["Single", "Duo", "Trio"] },
      { id: "o_cfg", t: "choice", label: "12.3 Konfiguration", opts: ["1x Leuchte", "1x Monitorhalterung", "2x Leuchten", "2x Monitorhalterungen", "1x Leuchte + 1x Monitor", "3x Leuchten", "2x Leuchten + 1x Monitor"] },
      { id: "o_bed", t: "choice", label: "12.4 Bedienelement am Leuchtenkörper", opts: ["1,3 Zoll Display", "5 Zoll Display"] },
      { id: "o_wand", t: "choice", label: "12.5 Bedienelement in der Wand", opts: ["Nein", "Aufputz", "Unterputz"] },
      { id: "o_schatten", t: "bool", label: "12.6 Sensorgesteuertes Schattenmanagement" },
      { id: "o_kam", t: "choice", label: "12.7 Kamera", opts: ["Nein", "Full-HD", "4K"] },
      { id: "o_sig", t: "choice", label: "Signalübertragung", opts: ["kabelgebunden", "kabellos"], showIf: (a) => a.o_kam && a.o_kam !== "Nein" },
      { id: "o_mon", t: "bool", label: "12.8 Monitor (z. B. Kamera nachrüstbar)" },
      { id: "o_netz", t: "choice", label: "12.9 Netzteil", opts: ["230 V", "24 V"] },
      { id: "o_bem", t: "area", label: "12.10 Bemerkungen" },
    ],
  },
  {
    id: "wasch", title: "13 · Waschplatz", types: ["wasch", "op"],
    qs: [
      { id: "wp_prem", t: "bool", label: "13.1 Premium-Waschrinne für 2 Personen (Edelstahl/Mineralwerkstoff, Mischbatterie mit Spendern, Unterbau)" },
      { id: "wp_std", t: "bool", label: "13.2 Standard-Waschrinne (Edelstahl)" },
      { id: "wp_pl", t: "choice", label: "Anzahl Waschplätze", opts: ["1 Person", "2 Personen", "3 Personen"], showIf: (a) => a.wp_std === true },
      { id: "wp_ir", t: "bool", label: "Infrarot-Mischbatterie", showIf: (a) => a.wp_std === true },
      { id: "wp_seife", t: "bool", label: "Seifenspender", showIf: (a) => a.wp_std === true },
      { id: "wp_des", t: "bool", label: "Desinfektionsspender", showIf: (a) => a.wp_std === true },
      { id: "wp_buer", t: "bool", label: "Bürstenspender", showIf: (a) => a.wp_std === true },
      { id: "wp_sp", t: "bool", label: "Spiegel über Waschrinne", showIf: (a) => a.wp_std === true },
    ],
  },
];

const ROOM_TYPES = [
  { id: "op", label: "OP-Saal" },
  { id: "wasch", label: "Waschraum" },
  { id: "awr", label: "Aufwachraum" },
  { id: "steri", label: "Steri / AEMP" },
  { id: "lager", label: "Lagerraum" },
  { id: "flur", label: "Flur" },
  { id: "sonst", label: "Sonstiger Raum" },
];

const PORTFOLIO = ["Schulter", "Knie", "Hüfte", "Fuß/Sprunggelenk", "Hand", "Wirbelsäule", "Allgemeinchirurgie", "Gynäkologie", "Urologie", "Dermatologie", "Plastische Chirurgie"];

const SIEBE = ["Arthroskopiesieb – Standard", "Schultersieb – ROM-Naht", "Schultersieb – Instabilität", "Kniesieb – Meniskus", "Kniesieb – ACL-Rekonstruktion", "Sprunggelenksieb", "Hüftgelenksieb"];
const TURM = ["Premium Gerätewagen (vorkonfiguriert, 1 Monitorarm)", "Premium Plus Gerätewagen (2 Monitorarme)", "SONY 27 4K Display", "SONY 32 4K Display", "PIXA 4K HDR Kamerasystem", "PIXA HDR Tablet", "Werewolf+ HF-Generator", "Dyonics Power II System (Shaver)", "Dyonics Power II Handmotor", "Fluidmanagement Doppelrollensystem"];
const TOOLS = ["Schulter-/Knie-/Ellenbogen-/Fußlagerungstool", "Hüftlagerungstool", "Handlagerungstool"];

const GEWERKE = ["RLT-Anlage (Erzeuger)", "RLT-Kanalnetz", "MedGas-Zentrale + Netz", "Elektro inkl. SV/ZSV", "Brandschutznachweis", "Bauantrag / Statik", "AEMP-Technikanschlüsse", "IT / Netzwerk"];

const sieveDefaults = (portfolio) => {
  const m = {};
  m[SIEBE[0]] = 1;
  if (portfolio.includes("Schulter")) { m[SIEBE[1]] = 1; m[SIEBE[2]] = 1; }
  if (portfolio.includes("Knie")) { m[SIEBE[3]] = 1; m[SIEBE[4]] = 1; }
  if (portfolio.includes("Fuß/Sprunggelenk")) { m[SIEBE[5]] = 1; }
  if (portfolio.includes("Hüfte")) { m[SIEBE[6]] = 1; }
  return m;
};

/* ---------------- Ausgangszustand ---------------- */

const emptyDoor = (art) => ({ id: Math.random().toString(36).slice(2, 8), art, a: {} });
const emptyRoom = (typ, name) => ({ id: Math.random().toString(36).slice(2, 8), typ, name, linie: "classic", a: {}, tueren: [] });

const initial = () => ({
  kopf: { datum: new Date().toISOString().slice(0, 10), objekt: "", projekt: "", bauart: "", ort: "", n_op: "", raumnr: "", n_neben: "", nebennr: "", termin: "", arten: [], verantwortlich: "", budget: "", budgetRaeume: "", zeitraum: "", bem: "" },
  betten: { g1: null, g2: null, g3: null, m: "", trigger: "" },
  gates: { portfolio: [], faelleProSaal: "6-8", c_bogen: null, endo: null, raumklassen: "", p30: "", hygieniker: null, rltPlaner: null, dwg: null, bem: "" },
  raeume: [],
  tische: { anzahl: "", fach: [], antrieb: "", last: "", lagerung: null, bem: "" },
  arthro: { turm: {}, siebe: {}, tools: {}, bem: "" },
  schnitt: { zust: {}, statik: null, rohhoehe: null, transport: null, bem: "" },
  montage: { team: null, personen: "", supervisor: null, offen: "", checks: [] },
});

/* ---------------- Bielefeld-Beispieldatensatz ---------------- */

const bielefeld = () => {
  const d = initial();
  d.kopf = { ...d.kopf, datum: "2025-10-08", objekt: "ORTHO & CO", projekt: "OP Bau altes Fabrikgebäude", bauart: "Altbau/Renovierung", ort: "Bielefeld", n_op: "3", raumnr: "3x 1b fertig, 1x zum Ausbau 1a", n_neben: "4", termin: "Mitte/Ende 2026", arten: ["Operationsräume", "Waschräume", "Aufwachraum", "Steri", "Lagerraum", "Flure"], verantwortlich: "Dr. Colcuc + Besitzer Immobilie", budget: "Günstig wie möglich", bem: "Reines OP-Zentrum // 2 Behandlungsräume, 1 Büroraum, 1 Anästhesieraum, Aufenthalt. Räume 30 m² plus." };
  d.gates = { ...d.gates, portfolio: ["Schulter", "Knie", "Hüfte", "Fuß/Sprunggelenk", "Hand", "Wirbelsäule"], c_bogen: true, raumklassen: "3x Ib fertig, 1x Ausbau auf Ia vorbereiten", dwg: true };
  d.betten = { g1: null, g2: null, g3: null, m: "", trigger: "" };
  const op1 = emptyRoom("op", "OP 1");
  op1.a = { w_typ: "3-teilig raumhoch (Raster max. 1.190 mm)", w_mat: "Edelstahl-pulverbeschichtet", w_pb: { ja: true, pb: PB[0] }, w_design: true, h_bem: "dwg vorhanden; Räume 30 m² plus", d_kass: "600x600 mm", l_gr: "600x600 mm", l_anz: "Standard", l_typ: "LED", l_amb: false, l_dali: true, fi_ja: false, fb_vor: true, fb_an: true, fb_bem: "laut Plan", e_integra: true, e_ifn: ["Raumlicht An/Aus", "Raumtemperatur", "Jalousien Türen", "Jalousien Fenster", "Alarm med. Gase", "Alarm Lüftung", "PACS/KIS-Anbindung", "Musik Player"], e_doku: "32 Zoll", e_mon: "55 Zoll", e_tast: true, e_sid: true, e_uhr: true, e_naht: true, e_abl1: { ja: true, n: "4" }, e_tav: "Nein", e_zul: { ja: true, n: "" }, e_bem: "Zentrale Lagerung außerhalb, aber nah // Rüstzone?", v_arm: "1 Arm", v_kreis: "2er Stromkreis", v_230: { ja: true, n: "" }, v_pot: { ja: true, n: "" }, v_daten: ["RJ45", "HDMI"], v_o2: { ja: true, n: "" }, v_n2o: { ja: true, n: "" }, v_agfs: { ja: true, n: "" }, v_a4: { ja: true, n: "" }, v_abl: { ja: true, n: "" }, v_schub: { ja: true, n: "" }, o_anz: "Standard", o_achse: "Duo", o_cfg: "2x Leuchten", o_bed: "1,3 Zoll Display", o_wand: "Nein", o_schatten: false, o_kam: "Nein", o_mon: true, o_bem: "Kamera nachrüstbar", o_netz: "24 V" };
  const t = emptyDoor("schiebe");
  t.a = { schiebe_fluegel: "Einflügelig", schiebe_auto: "Automatisch", schiebe_fenster: true, schiebe_fgr: "500x600 mm", schiebe_pb: { ja: true, pb: PB[0] }, schiebe_jal: true, schiebe_milch: false, schiebe_herm: false, schiebe_schalter: "Schalter in der Zarge (Standard)", schiebe_schleuse: false };
  const t2 = emptyDoor("dreh");
  t2.a = { dreh_fluegel: "Einflügelig", dreh_auto: "Automatisch", dreh_fenster: true, dreh_fgr: "500x600 mm", dreh_pb: { ja: true, pb: PB[0] }, dreh_jal: true, dreh_milch: false, dreh_herm: false, dreh_schalter: "Schalter in der Zarge (Standard)" };
  op1.tueren = [t, t2];
  const op2 = { ...op1, id: "op2x", name: "OP 2", tueren: op1.tueren.map((x) => ({ ...x, id: x.id + "b" })) };
  const op3 = { ...op1, id: "op3x", name: "OP 3", tueren: op1.tueren.map((x) => ({ ...x, id: x.id + "c" })) };
  const shell = { ...op1, id: "op4x", name: "OP 4 (Shell, Ausbau Ia)", a: { ...op1.a, e_tav: "2.070x2.760 mm", h_bem: "Ausbau auf Raumklasse Ia vorbereiten" }, tueren: op1.tueren.map((x) => ({ ...x, id: x.id + "d" })) };
  d.raeume = [op1, op2, op3, shell];
  d.tische = { anzahl: "3", fach: ["Schulter", "Knie", "Hüfte", "Fuß/Sprunggelenk", "Hand", "Wirbelsäule"], antrieb: "elektrisch", last: "<160 kg", lagerung: true, bem: "" };
  d.arthro = { turm: { "Premium Plus Gerätewagen (2 Monitorarme)": 2 }, siebe: sieveDefaults(d.gates.portfolio), tools: {}, bem: "" };
  return d;
};

/* ---------------- Hilfskomponenten ---------------- */

const S = { fontFamily: "Archivo, system-ui, sans-serif" };

function Chip({ color, children }) {
  return <span style={{ background: color + "18", color, border: "1px solid " + color + "40" }} className="text-[11px] px-2 py-0.5 rounded-full font-semibold tracking-wide whitespace-nowrap">{children}</span>;
}

function Field({ q, val, set, gates }) {
  const label = <div className="flex items-center gap-2 mb-1"><span className="text-[13px] font-semibold" style={{ color: C.ink }}>{q.label}</span>{q.req && <span style={{ color: C.accent }} className="text-[13px] font-bold">*</span>}{q.gate === "c_bogen" && gates.c_bogen === false && <Chip color={C.grey}>aus Gate C-Bogen: Nein</Chip>}{q.gate === "c_bogen" && gates.c_bogen === true && <Chip color={C.accent}>C-Bogen = ja → prüfen</Chip>}{q.gate === "raumklasse" && (gates.raumklassen || "").toLowerCase().includes("ia") && <Chip color={C.accent}>Raumklasse Ia → TAV prüfen</Chip>}</div>;
  const inp = "w-full text-[13px] rounded-lg px-3 py-2 outline-none bg-white";
  const bst = { border: "1px solid " + C.line };
  const btn = (active) => ({ border: "1px solid " + (active ? C.ink : C.line), background: active ? C.ink : "#fff", color: active ? "#fff" : C.grey });

  if (q.t === "text" || q.t === "num") {
    return <div className="mb-3">{label}<div className="flex items-center gap-2"><input className={inp} style={{ ...bst, maxWidth: q.t === "num" ? 160 : 420 }} value={val ?? ""} inputMode={q.t === "num" ? "decimal" : "text"} onChange={(e) => set(e.target.value)} />{q.unit && <span className="text-[12px]" style={{ color: C.grey }}>{q.unit}</span>}</div></div>;
  }
  if (q.t === "area") {
    return <div className="mb-3">{label}<textarea rows={2} className={inp} style={bst} value={val ?? ""} onChange={(e) => set(e.target.value)} /></div>;
  }
  if (q.t === "bool") {
    return <div className="mb-3">{label}<div className="flex gap-2">{[["Nein", false], ["Ja", true]].map(([t, v]) => <button key={t} onClick={() => set(v)} className="px-4 py-1.5 rounded-lg text-[13px] font-semibold" style={btn(val === v)}>{t}</button>)}</div></div>;
  }
  if (q.t === "choice") {
    return <div className="mb-3">{label}<div className="flex flex-wrap gap-2">{q.opts.map((o) => <button key={o} onClick={() => set(o)} className="px-3 py-1.5 rounded-lg text-[12.5px] font-medium" style={btn(val === o)}>{o}</button>)}</div></div>;
  }
  if (q.t === "multi") {
    const arr = val || [];
    return <div className="mb-3">{label}<div className="flex flex-wrap gap-2">{q.opts.map((o) => { const on = arr.includes(o); return <button key={o} onClick={() => set(on ? arr.filter((x) => x !== o) : [...arr, o])} className="px-3 py-1.5 rounded-lg text-[12.5px] font-medium" style={btn(on)}>{o}</button>; })}</div></div>;
  }
  if (q.t === "qty") {
    const v = val || {};
    return <div className="mb-3">{label}<div className="flex items-center gap-2"><button onClick={() => set({ ja: false })} className="px-4 py-1.5 rounded-lg text-[13px] font-semibold" style={btn(v.ja === false)}>Nein</button><button onClick={() => set({ ...v, ja: true })} className="px-4 py-1.5 rounded-lg text-[13px] font-semibold" style={btn(v.ja === true)}>Ja</button>{v.ja && <><input className={inp} style={{ ...bst, width: 90 }} placeholder="Stück" value={v.n ?? ""} onChange={(e) => set({ ...v, n: e.target.value })} /><span className="text-[12px]" style={{ color: C.grey }}>Stück</span></>}</div></div>;
  }
  if (q.t === "pb") {
    const auto = q.gate === "c_bogen" && gates.c_bogen === false;
    const v = val !== undefined ? val : auto ? { ja: false } : undefined;
    const eff = v || {};
    return <div className="mb-3">{label}<div className="flex flex-wrap items-center gap-2"><button onClick={() => set({ ja: false })} className="px-4 py-1.5 rounded-lg text-[13px] font-semibold" style={btn(eff.ja === false)}>Nein</button><button onClick={() => set({ ja: true, pb: eff.pb || PB[0] })} className="px-4 py-1.5 rounded-lg text-[13px] font-semibold" style={btn(eff.ja === true)}>Ja</button>{eff.ja && PB.map((p) => <button key={p} onClick={() => set({ ja: true, pb: p })} className="px-2.5 py-1.5 rounded-lg text-[12px] font-medium" style={btn(eff.pb === p)}>{p}</button>)}</div></div>;
  }
  return null;
}

function SectionCard({ title, children }) {
  return <div className="rounded-2xl mb-4 overflow-hidden" style={{ border: "1px solid " + C.line, background: "#fff" }}><div className="px-4 py-2.5 text-[12px] font-bold uppercase tracking-widest" style={{ background: C.soft, color: C.ink }}>{title}</div><div className="p-4">{children}</div></div>;
}

/* ---------------- Pflichtfeld-Logik ---------------- */

function computeMissing(d) {
  const miss = [];
  const need = (cond, label, mod) => { if (cond) miss.push({ label, mod }); };
  need(!d.kopf.objekt, "Projektkopf: Name des Objektes", "kopf");
  need(!d.kopf.ort, "Projektkopf: Ort/Stadt", "kopf");
  need(!d.kopf.bauart, "Projektkopf: Bauart (Altbau/Neubau)", "kopf");
  need(!d.kopf.n_op, "Projektkopf: Anzahl OPs", "kopf");
  need(!d.kopf.verantwortlich, "Projektkopf: Projektverantwortlicher", "kopf");
  need(d.betten.g1 === null, "Betten-Gate 1: Übernachtungseingriffe im Portfolio?", "betten");
  need(d.betten.g1 === true && d.betten.g2 === null, "Betten-Gate 2: Nachtfixkosten gedeckt?", "betten");
  need(d.betten.g1 === true && d.betten.g3 === null, "Betten-Gate 3: § 30 GewO / Brandschutz erreichbar?", "betten");
  need(d.gates.portfolio.length === 0, "Gates: Eingriffsspektrum/Portfolio", "gates");
  need(d.gates.c_bogen === null, "Gates: C-Bogen ja/nein (steuert alle Strahlenschutzfragen)", "gates");
  need(!d.gates.raumklassen, "Gates: Raumklasse je Saal (Ia/Ib)", "gates");
  need(!d.gates.p30, "Gates: § 30-GewO-Status", "gates");
  need(d.gates.dwg === null, "Gates: DWG-Pläne maßstabsgetreu vorhanden?", "gates");
  need(d.raeume.length === 0, "Räume: noch kein Raum angelegt", "raeume");
  d.raeume.forEach((r) => {
    ROOM_SECTIONS.filter((s) => s.types.includes(r.typ)).forEach((s) => s.qs.filter((q) => q.req).forEach((q) => {
      const vis = !q.showIf || q.showIf(r.a);
      need(vis && (r.a[q.id] === undefined || r.a[q.id] === ""), r.name + ": " + q.label, "raeume");
    }));
    r.tueren.forEach((t, i) => {
      const pfx = t.art === "schiebe" ? "schiebe" : "dreh";
      need(!t.a[pfx + "_breite"], r.name + " · Tür " + (i + 1) + " (" + (t.art === "schiebe" ? "Schiebetür" : "Drehflügeltür") + "): Türbreite", "raeume");
    });
    if (r.typ === "op") {
      const iaWanted = (d.gates.raumklassen || "").toLowerCase().includes("ia");
      need(iaWanted && r.a.e_tav === undefined, r.name + ": TAV-Zuluftdecke klären (Raumklasse Ia im Gate genannt)", "raeume");
    }
  });
  need(!d.tische.anzahl, "OP-Tische: Anzahl", "tische");
  GEWERKE.forEach((g) => need(!d.schnitt.zust[g], "Schnittstellen: " + g + " – Zuständigkeit offen", "schnitt"));
  need(d.schnitt.statik === null, "Bestand: Statik/Deckenlasten (DVE, OP-Leuchte) geprüft?", "schnitt");
  need(d.schnitt.transport === null, "Bestand: Transportweg für Wandelemente geprüft?", "schnitt");
  need(d.montage.team === null, "Montage: Montageteam ja/nein", "montage");
  return miss;
}

function countRequired(d) {
  let total = 15 + GEWERKE.length + 3;
  d.raeume.forEach((r) => {
    ROOM_SECTIONS.filter((s) => s.types.includes(r.typ)).forEach((s) => { total += s.qs.filter((q) => q.req && (!q.showIf || q.showIf(r.a))).length; });
    total += r.tueren.length;
  });
  return total;
}

/* ---------------- Hauptkomponente ---------------- */

export default function OpChecklist() {
  const [d, setD] = useState(initial());
  const [mod, setMod] = useState("kopf");
  const [roomId, setRoomId] = useState(null);
  const fileRef = useRef(null);

  const up = (path, val) => setD((prev) => {
    const n = JSON.parse(JSON.stringify(prev));
    let o = n;
    for (let i = 0; i < path.length - 1; i++) o = o[path[i]];
    o[path[path.length - 1]] = val;
    return n;
  });

  const missing = useMemo(() => computeMissing(d), [d]);
  const totalReq = useMemo(() => countRequired(d), [d]);
  const score = totalReq === 0 ? 0 : Math.round(((totalReq - missing.length) / totalReq) * 100);
  const scoreColor = score >= 90 ? C.ok : score >= 60 ? C.warn : C.bad;

  const kurzliegerErgebnis = d.betten.g1 === false ? "nein" : d.betten.g1 === true && d.betten.g2 === true && d.betten.g3 === true ? "ja" : d.betten.g1 === true && (d.betten.g2 === "unsicher" || d.betten.g3 === "offen" || d.betten.g2 === null || d.betten.g3 === null) ? "vorruesten" : d.betten.g1 === true && (d.betten.g2 === false || d.betten.g3 === false) ? "nein" : null;

  const exportJson = () => {
    const blob = new Blob([JSON.stringify({ version: "stufe1-1.0", katalog: "medifa_3.1", playbook: "2.1", exportiert: new Date().toISOString(), daten: d }, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = (d.kopf.objekt || "op-projekt").replace(/\s+/g, "_") + "_erfassung.json"; a.click();
    URL.revokeObjectURL(url);
  };
  const importJson = (e) => {
    const f = e.target.files[0]; if (!f) return;
    const r = new FileReader();
    r.onload = () => { try { const j = JSON.parse(r.result); setD(j.daten || j); } catch (err) { alert("Datei konnte nicht gelesen werden."); } };
    r.readAsText(f); e.target.value = "";
  };
  const copyOpen = () => {
    const lines = ["Offene Punkte – " + (d.kopf.objekt || "Projekt") + " (" + new Date().toLocaleDateString("de-DE") + ")", ""].concat(missing.map((m, i) => (i + 1) + ". " + m.label));
    navigator.clipboard && navigator.clipboard.writeText(lines.join("\n"));
  };

  const addRooms = () => {
    const n = parseInt(d.kopf.n_op || "0", 10);
    if (!n) return;
    const rs = [];
    for (let i = 1; i <= n; i++) rs.push(emptyRoom("op", "OP " + i));
    up(["raeume"], [...d.raeume, ...rs]);
  };

  const MODS = [
    { id: "kopf", label: "0 · Projektkopf" },
    { id: "betten", label: "0b · Betten-Entscheidung" },
    { id: "gates", label: "1 · Klinische Gates" },
    { id: "raeume", label: "2 · Räume (" + d.raeume.length + ")" },
    { id: "tische", label: "3 · OP-Tische" },
    { id: "arthro", label: "4 · Arthroskopie (S+N)" },
    { id: "schnitt", label: "5 · Schnittstellen & Bestand" },
    { id: "montage", label: "6 · Montage & Abschluss" },
    { id: "reife", label: "7 · Angebotsreife" },
  ];

  const room = d.raeume.find((r) => r.id === roomId) || d.raeume[0];
  const gateChips = [];
  if (d.gates.c_bogen === true) gateChips.push(["C-Bogen: ja → Pb-Fragen aktiv", C.accent]);
  if (d.gates.c_bogen === false) gateChips.push(["C-Bogen: nein → Pb vorbelegt", C.grey]);
  if ((d.gates.raumklassen || "").toLowerCase().includes("ia")) gateChips.push(["Ia genannt → TAV je Saal prüfen", C.accent]);
  if (kurzliegerErgebnis === "nein") gateChips.push(["Kurzlieger: nein → Same-Day + Verlegungspfad", C.grey]);
  if (kurzliegerErgebnis === "ja") gateChips.push(["Kurzlieger: ja (m = " + (d.betten.m || "?") + ")", C.ok]);
  if (kurzliegerErgebnis === "vorruesten") gateChips.push(["Kurzlieger: vorrüsten (Realoption)", C.warn]);

  const btnGhost = { border: "1px solid " + C.line, color: C.ink, background: "#fff" };

  return (
    <div style={{ ...S, background: C.paper, minHeight: "100vh", color: C.ink }}>
      <style>{"@import url('https://fonts.googleapis.com/css2?family=Archivo:wdth,wght@75..125,400..800&display=swap'); *{box-sizing:border-box} button{cursor:pointer;font-family:inherit} input,textarea{font-family:inherit} button:focus-visible,input:focus-visible,textarea:focus-visible{outline:2px solid " + C.accent + ";outline-offset:1px}"}</style>

      {/* Kopfzeile */}
      <div className="sticky top-0 z-20 px-4 py-3" style={{ background: C.ink, color: "#fff" }}>
        <div className="max-w-6xl mx-auto flex flex-wrap items-center gap-3">
          <div className="min-w-0">
            <div className="text-[10px] uppercase tracking-[0.2em] opacity-70">OP-Bau Erfassung · medifa V3.1 + Playbook 2.1</div>
            <div className="text-[17px] font-bold truncate" style={{ fontStretch: "112%" }}>{d.kopf.objekt || "Neues Projekt"}{d.kopf.ort ? " · " + d.kopf.ort : ""}</div>
          </div>
          <div className="flex-1" />
          <div className="flex items-center gap-2">
            <div className="text-right">
              <div className="text-[10px] uppercase tracking-widest opacity-70">Angebotsreife</div>
              <div className="text-[18px] font-extrabold" style={{ color: scoreColor === C.bad ? "#F2A196" : scoreColor === C.warn ? "#EFD48A" : "#A8DBA0" }}>{score} %</div>
            </div>
            <div className="w-28 h-2 rounded-full overflow-hidden" style={{ background: "#ffffff30" }}><div className="h-full" style={{ width: score + "%", background: C.accent, transition: "width .3s" }} /></div>
            <button onClick={exportJson} title="JSON exportieren" className="p-2 rounded-lg" style={{ background: "#ffffff18" }}><Download size={16} /></button>
            <button onClick={() => fileRef.current && fileRef.current.click()} title="JSON importieren" className="p-2 rounded-lg" style={{ background: "#ffffff18" }}><Upload size={16} /></button>
            <input ref={fileRef} type="file" accept=".json" className="hidden" onChange={importJson} />
          </div>
        </div>
        {gateChips.length > 0 && <div className="max-w-6xl mx-auto mt-2 flex flex-wrap gap-1.5">{gateChips.map(([t, c], i) => <span key={i} className="text-[10.5px] px-2 py-0.5 rounded-full font-semibold" style={{ background: "#ffffff14", color: "#fff", border: "1px solid #ffffff30" }}>{t}</span>)}</div>}
      </div>

      <div className="max-w-6xl mx-auto flex gap-4 p-4 items-start">
        {/* Navigation */}
        <div className="w-52 shrink-0 sticky top-24 hidden md:block">
          {MODS.map((m) => {
            const open = missing.filter((x) => x.mod === m.id).length;
            const active = mod === m.id;
            return <button key={m.id} onClick={() => setMod(m.id)} className="w-full text-left px-3 py-2 rounded-xl mb-1 flex items-center gap-2 text-[13px] font-semibold" style={{ background: active ? C.ink : "transparent", color: active ? "#fff" : C.ink, border: "1px solid " + (active ? C.ink : "transparent") }}>
              <span className="flex-1">{m.label}</span>
              {m.id !== "reife" && (open > 0 ? <span className="text-[10px] font-bold px-1.5 rounded-full" style={{ background: active ? "#ffffff25" : C.bad + "18", color: active ? "#fff" : C.bad }}>{open}</span> : <CheckCircle2 size={14} color={active ? "#A8DBA0" : C.ok} />)}
            </button>;
          })}
          <button onClick={() => setD(bielefeld())} className="w-full mt-3 px-3 py-2 rounded-xl text-[12px] font-semibold" style={btnGhost}>Beispiel Bielefeld laden</button>
          <button onClick={() => setD(initial())} className="w-full mt-1 px-3 py-2 rounded-xl text-[12px] font-semibold" style={{ ...btnGhost, color: C.bad }}>Zurücksetzen</button>
        </div>

        {/* Inhalt */}
        <div className="flex-1 min-w-0">
          {/* Mobile Nav */}
          <div className="md:hidden flex gap-1.5 overflow-x-auto pb-2 mb-2">{MODS.map((m) => <button key={m.id} onClick={() => setMod(m.id)} className="px-3 py-1.5 rounded-full text-[12px] font-semibold whitespace-nowrap" style={{ background: mod === m.id ? C.ink : "#fff", color: mod === m.id ? "#fff" : C.ink, border: "1px solid " + C.line }}>{m.label}</button>)}</div>

          {mod === "kopf" && <SectionCard title="1 · Allgemeine Informationen (medifa)">
            <div className="grid md:grid-cols-2 gap-x-6">
              <Field q={{ id: "objekt", t: "text", label: "Name des Objektes", req: true }} val={d.kopf.objekt} set={(v) => up(["kopf", "objekt"], v)} gates={d.gates} />
              <Field q={{ id: "projekt", t: "text", label: "Projektbezeichnung" }} val={d.kopf.projekt} set={(v) => up(["kopf", "projekt"], v)} gates={d.gates} />
              <Field q={{ t: "choice", label: "Bauart", req: true, opts: ["Altbau/Renovierung", "Neubau"] }} val={d.kopf.bauart} set={(v) => up(["kopf", "bauart"], v)} gates={d.gates} />
              <Field q={{ t: "text", label: "Ort/Stadt", req: true }} val={d.kopf.ort} set={(v) => up(["kopf", "ort"], v)} gates={d.gates} />
              <Field q={{ t: "num", label: "Anzahl anzubietender OPs (n)", req: true }} val={d.kopf.n_op} set={(v) => up(["kopf", "n_op"], v)} gates={d.gates} />
              <Field q={{ t: "text", label: "Stück/Raumnummer(n)" }} val={d.kopf.raumnr} set={(v) => up(["kopf", "raumnr"], v)} gates={d.gates} />
              <Field q={{ t: "num", label: "Anzahl anzubietender Nebenräume" }} val={d.kopf.n_neben} set={(v) => up(["kopf", "n_neben"], v)} gates={d.gates} />
              <Field q={{ t: "text", label: "Geplantes Ausführungsdatum" }} val={d.kopf.termin} set={(v) => up(["kopf", "termin"], v)} gates={d.gates} />
              <Field q={{ t: "text", label: "Projektverantwortlicher / Entscheider", req: true }} val={d.kopf.verantwortlich} set={(v) => up(["kopf", "verantwortlich"], v)} gates={d.gates} />
              <Field q={{ t: "text", label: "Projektbudget gesamt" }} val={d.kopf.budget} set={(v) => up(["kopf", "budget"], v)} gates={d.gates} />
              <Field q={{ t: "text", label: "Projektbudget Räume" }} val={d.kopf.budgetRaeume} set={(v) => up(["kopf", "budgetRaeume"], v)} gates={d.gates} />
              <Field q={{ t: "text", label: "Geplanter Ausführungszeitraum" }} val={d.kopf.zeitraum} set={(v) => up(["kopf", "zeitraum"], v)} gates={d.gates} />
            </div>
            <Field q={{ t: "multi", label: "Art der Räume", opts: ["Operationsräume", "Waschräume", "Einleitungsräume", "Aufwachraum", "Steri", "ITS", "Lagerraum", "Flure"] }} val={d.kopf.arten} set={(v) => up(["kopf", "arten"], v)} gates={d.gates} />
            <Field q={{ t: "area", label: "Bemerkungen" }} val={d.kopf.bem} set={(v) => up(["kopf", "bem"], v)} gates={d.gates} />
          </SectionCard>}

          {mod === "betten" && <>
            <SectionCard title="Betten-Entscheidung · drei Gates (Playbook 1.2a)">
              <Field q={{ t: "bool", label: "Gate 1 · Portfolio: Eingriffe mit geplanter Übernachtung? (Hybrid-DRG, komplexe Rekonstruktionen, Endoprothetik)", req: true }} val={d.betten.g1} set={(v) => up(["betten", "g1"], v)} gates={d.gates} />
              {d.betten.g1 === true && <>
                <Field q={{ t: "choice", label: "Gate 2 · Wirtschaftlichkeit: Nachtfixkosten im konservativen Erlösszenario gedeckt?", opts: ["Ja", "Nein", "Unsicher"], req: true }} val={d.betten.g2 === true ? "Ja" : d.betten.g2 === false ? "Nein" : d.betten.g2 === "unsicher" ? "Unsicher" : undefined} set={(v) => up(["betten", "g2"], v === "Ja" ? true : v === "Nein" ? false : "unsicher")} gates={d.gates} />
                <Field q={{ t: "choice", label: "Gate 3 · Regulatorik: § 30-GewO-Konzession + Brandschutz Nachtbetrieb erreichbar?", opts: ["Ja", "Nein", "Offen"], req: true }} val={d.betten.g3 === true ? "Ja" : d.betten.g3 === false ? "Nein" : d.betten.g3 === "offen" ? "Offen" : undefined} set={(v) => up(["betten", "g3"], v === "Ja" ? true : v === "Nein" ? false : "offen")} gates={d.gates} />
              </>}
              <div className="rounded-xl p-3 mt-2 flex items-start gap-2" style={{ background: kurzliegerErgebnis === "ja" ? C.ok + "12" : kurzliegerErgebnis === "vorruesten" ? C.warn + "14" : kurzliegerErgebnis === "nein" ? C.soft : C.soft, border: "1px solid " + C.line }}>
                {kurzliegerErgebnis === "ja" ? <CheckCircle2 size={18} color={C.ok} /> : kurzliegerErgebnis === "vorruesten" ? <AlertTriangle size={18} color={C.warn} /> : <Circle size={18} color={C.grey} />}
                <div className="text-[13px]">
                  <b>Ergebnis: </b>
                  {kurzliegerErgebnis === "ja" && "Kurzlieger = JA. Bettenzahl m nach Formel unten; Phasierungsoption (Nachtbetrieb ab Trigger) möglich."}
                  {kurzliegerErgebnis === "vorruesten" && "Zwischenweg: baulich vorrüsten (Realoption), Nachtbetrieb erst nach Klärung Gate 2/3 aktivieren. Konzessionsvoraussetzungen mitbauen."}
                  {kurzliegerErgebnis === "nein" && "Kurzlieger = NEIN. Same-Day-Modell: erweiterte Phase 2, kein § 30 GewO, kein Nachtbetrieb. Verlegungspfad zur Partnerklinik verpflichtend definieren."}
                  {kurzliegerErgebnis === null && "Gates beantworten, um die Empfehlung zu erhalten."}
                </div>
              </div>
              {(kurzliegerErgebnis === "ja" || kurzliegerErgebnis === "vorruesten") && <div className="grid md:grid-cols-2 gap-x-6 mt-3">
                <Field q={{ t: "num", label: "Bettenzahl m (Formel 1.2b: F × q(Übernachtung) × Ø-Nächte + 1 Reserve)" }} val={d.betten.m} set={(v) => up(["betten", "m"], v)} gates={d.gates} />
                <Field q={{ t: "text", label: "Trigger für Nachtbetrieb (Belegung/Fallzahl)" }} val={d.betten.trigger} set={(v) => up(["betten", "trigger"], v)} gates={d.gates} />
              </div>}
            </SectionCard>
          </>}

          {mod === "gates" && <SectionCard title="Klinisch-regulatorische Gates (Playbook Kapitel 0/1) – steuern die Vorbelegung">
            <Field q={{ t: "multi", label: "Eingriffsspektrum / Portfolio", req: true, opts: PORTFOLIO }} val={d.gates.portfolio} set={(v) => up(["gates", "portfolio"], v)} gates={d.gates} />
            <div className="grid md:grid-cols-2 gap-x-6">
              <Field q={{ t: "text", label: "Zielfallzahl je Saal und Tag (F = n × …)" }} val={d.gates.faelleProSaal} set={(v) => up(["gates", "faelleProSaal"], v)} gates={d.gates} />
              <Field q={{ t: "bool", label: "C-Bogen im Einsatz (StrlSchG!) – steuert alle Pb-Fragen", req: true }} val={d.gates.c_bogen} set={(v) => up(["gates", "c_bogen"], v)} gates={d.gates} />
              <Field q={{ t: "text", label: "Raumklasse je Saal (Ib / Ib+Ia-ready / Ia)", req: true }} val={d.gates.raumklassen} set={(v) => up(["gates", "raumklassen"], v)} gates={d.gates} />
              <Field q={{ t: "bool", label: "Endoprothetik-Readiness gewünscht (≥ 40 m², Ia-Vorrüstung)" }} val={d.gates.endo} set={(v) => up(["gates", "endo"], v)} gates={d.gates} />
              <Field q={{ t: "choice", label: "§ 30-GewO-Status (bei Kurzlieger)", req: true, opts: ["Nicht relevant (kein Kurzlieger)", "Behördlich geklärt", "In Klärung", "Offen"] }} val={d.gates.p30} set={(v) => up(["gates", "p30"], v)} gates={d.gates} />
              <Field q={{ t: "bool", label: "Krankenhaushygieniker benannt / eingebunden" }} val={d.gates.hygieniker} set={(v) => up(["gates", "hygieniker"], v)} gates={d.gates} />
              <Field q={{ t: "bool", label: "RLT-Fachplaner eingebunden" }} val={d.gates.rltPlaner} set={(v) => up(["gates", "rltPlaner"], v)} gates={d.gates} />
              <Field q={{ t: "bool", label: "DWG-Pläne maßstabsgetreu vorhanden (medifa-Pflicht)", req: true }} val={d.gates.dwg} set={(v) => up(["gates", "dwg"], v)} gates={d.gates} />
            </div>
            <Field q={{ t: "area", label: "Bemerkungen" }} val={d.gates.bem} set={(v) => up(["gates", "bem"], v)} gates={d.gates} />
          </SectionCard>}

          {mod === "raeume" && <>
            <div className="flex flex-wrap items-center gap-2 mb-3">
              {d.raeume.map((r) => <button key={r.id} onClick={() => setRoomId(r.id)} className="px-3 py-1.5 rounded-full text-[12.5px] font-semibold" style={{ background: room && room.id === r.id ? C.ink : "#fff", color: room && room.id === r.id ? "#fff" : C.ink, border: "1px solid " + C.line }}>{r.name}</button>)}
              <select className="px-2 py-1.5 rounded-lg text-[12.5px]" style={{ border: "1px solid " + C.line, background: "#fff" }} value="" onChange={(e) => { if (!e.target.value) return; const t = ROOM_TYPES.find((x) => x.id === e.target.value); const nr = emptyRoom(t.id, t.label + " " + (d.raeume.filter((x) => x.typ === t.id).length + 1)); up(["raeume"], [...d.raeume, nr]); setRoomId(nr.id); }}>
                <option value="">+ Raum hinzufügen…</option>
                {ROOM_TYPES.map((t) => <option key={t.id} value={t.id}>{t.label}</option>)}
              </select>
              {d.raeume.length === 0 && d.kopf.n_op && <button onClick={addRooms} className="px-3 py-1.5 rounded-lg text-[12.5px] font-semibold" style={{ background: C.accent, color: "#fff" }}>OP-Räume aus n = {d.kopf.n_op} anlegen</button>}
            </div>

            {room && <>
              <div className="flex flex-wrap items-center gap-2 mb-3">
                <input className="text-[14px] font-bold px-3 py-1.5 rounded-lg" style={{ border: "1px solid " + C.line, background: "#fff", color: C.ink, width: 240 }} value={room.name} onChange={(e) => up(["raeume", d.raeume.indexOf(room), "name"], e.target.value)} />
                <Field q={{ t: "choice", label: "", opts: ["classic", "comfort"] }} val={room.linie} set={(v) => up(["raeume", d.raeume.indexOf(room), "linie"], v)} gates={d.gates} />
                <div className="flex-1" />
                <button onClick={() => { const cp = JSON.parse(JSON.stringify(room)); cp.id = Math.random().toString(36).slice(2, 8); cp.name = room.name + " (Kopie)"; cp.tueren.forEach((t) => (t.id = Math.random().toString(36).slice(2, 8))); up(["raeume"], [...d.raeume, cp]); setRoomId(cp.id); }} className="px-3 py-1.5 rounded-lg text-[12px] font-semibold flex items-center gap-1" style={btnGhost}><CopyPlus size={14} /> Duplizieren</button>
                <button onClick={() => { const rest = d.raeume.filter((r) => r.id !== room.id); up(["raeume"], rest); setRoomId(rest.length ? rest[0].id : null); }} className="px-3 py-1.5 rounded-lg text-[12px] font-semibold flex items-center gap-1" style={{ ...btnGhost, color: C.bad }}><Trash2 size={14} /> Entfernen</button>
              </div>

              {ROOM_SECTIONS.filter((s) => s.types.includes(room.typ)).map((s) => <SectionCard key={s.id} title={s.title + (room.linie === "comfort" ? " · Comfort" : " · Classic")}>
                <div className="grid md:grid-cols-2 gap-x-6">
                  {s.qs.map((q) => (!q.showIf || q.showIf(room.a)) && <Field key={q.id} q={q} val={room.a[q.id]} set={(v) => up(["raeume", d.raeume.indexOf(room), "a", q.id], v)} gates={d.gates} />)}
                </div>
              </SectionCard>)}

              <SectionCard title={"8/9 · Türen (" + room.tueren.length + ")"}>
                <div className="flex gap-2 mb-3">
                  <button onClick={() => up(["raeume", d.raeume.indexOf(room), "tueren"], [...room.tueren, emptyDoor("schiebe")])} className="px-3 py-1.5 rounded-lg text-[12.5px] font-semibold flex items-center gap-1" style={btnGhost}><Plus size={14} /> Schiebetür</button>
                  <button onClick={() => up(["raeume", d.raeume.indexOf(room), "tueren"], [...room.tueren, emptyDoor("dreh")])} className="px-3 py-1.5 rounded-lg text-[12.5px] font-semibold flex items-center gap-1" style={btnGhost}><Plus size={14} /> Drehflügeltür</button>
                </div>
                {room.tueren.map((t, ti) => {
                  const pfx = t.art === "schiebe" ? "schiebe" : "dreh";
                  return <div key={t.id} className="rounded-xl p-3 mb-3" style={{ border: "1px solid " + C.line, background: C.paper }}>
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-[13px] font-bold">{t.art === "schiebe" ? "Schiebetür" : "Drehflügeltür"} {ti + 1}</span>
                      <div className="flex-1" />
                      <button onClick={() => up(["raeume", d.raeume.indexOf(room), "tueren"], room.tueren.filter((x) => x.id !== t.id))} className="p-1.5 rounded-lg" style={{ ...btnGhost, color: C.bad }}><Trash2 size={13} /></button>
                    </div>
                    <div className="grid md:grid-cols-2 gap-x-6">
                      {doorQs(pfx).map((q) => (!q.showIf || q.showIf(t.a)) && <Field key={q.id} q={q} val={t.a[q.id]} set={(v) => { const rooms = JSON.parse(JSON.stringify(d.raeume)); rooms[d.raeume.indexOf(room)].tueren[ti].a[q.id] = v; up(["raeume"], rooms); }} gates={d.gates} />)}
                    </div>
                  </div>;
                })}
                {room.tueren.length === 0 && <div className="text-[13px]" style={{ color: C.grey }}>Noch keine Türen erfasst – jeder Raum braucht mindestens eine Türdefinition für das Angebot.</div>}
              </SectionCard>
            </>}
            {!room && <div className="rounded-2xl p-8 text-center text-[14px]" style={{ border: "1px dashed " + C.line, color: C.grey }}>Noch keine Räume angelegt. Oben Raumtyp wählen oder OP-Räume aus n erzeugen.</div>}
          </>}

          {mod === "tische" && <SectionCard title="14 · OP-Tische (projektweit)">
            <div className="grid md:grid-cols-2 gap-x-6">
              <Field q={{ t: "num", label: "Anzahl OP-Tische", req: true }} val={d.tische.anzahl} set={(v) => up(["tische", "anzahl"], v)} gates={d.gates} />
              <Field q={{ t: "choice", label: "Antriebstechnik", opts: ["mechanisch", "elektrisch"] }} val={d.tische.antrieb} set={(v) => up(["tische", "antrieb"], v)} gates={d.gates} />
              <Field q={{ t: "choice", label: "Dynamische Patientenbelastung", opts: ["<160 kg", ">160 kg"] }} val={d.tische.last} set={(v) => up(["tische", "last"], v)} gates={d.gates} />
              <Field q={{ t: "bool", label: "Positionierungskissen / Lagerungsmaterial gewünscht" }} val={d.tische.lagerung} set={(v) => up(["tische", "lagerung"], v)} gates={d.gates} />
            </div>
            <div className="flex items-center gap-2 mb-1"><span className="text-[13px] font-semibold">14.1 OP-Anforderung (Fachrichtungen)</span>{d.gates.portfolio.length > 0 && <Chip color={C.accent}>aus Portfolio vorbelegt</Chip>}</div>
            <Field q={{ t: "multi", label: "", opts: PORTFOLIO }} val={d.tische.fach.length ? d.tische.fach : d.gates.portfolio} set={(v) => up(["tische", "fach"], v)} gates={d.gates} />
            <Field q={{ t: "area", label: "14.3 Bemerkungen" }} val={d.tische.bem} set={(v) => up(["tische", "bem"], v)} gates={d.gates} />
          </SectionCard>}

          {mod === "arthro" && <>
            <SectionCard title="15.1 · Arthroskopieturm – Bedarfsermittlung">
              {TURM.map((t) => <div key={t} className="flex items-center gap-2 mb-2">
                <span className="text-[13px] flex-1">{t}</span>
                <input className="w-16 text-[13px] rounded-lg px-2 py-1.5 text-center" style={{ border: "1px solid " + C.line, background: "#fff" }} placeholder="0" value={d.arthro.turm[t] ?? ""} onChange={(e) => up(["arthro", "turm", t], e.target.value)} />
                <span className="text-[11px]" style={{ color: C.grey }}>Stück</span>
              </div>)}
            </SectionCard>
            <SectionCard title="15.2 · Arthroskopiesiebe">
              <div className="mb-2 flex items-center gap-2"><Chip color={C.accent}>aus Portfolio vorbelegt</Chip><button onClick={() => up(["arthro", "siebe"], sieveDefaults(d.gates.portfolio))} className="px-2.5 py-1 rounded-lg text-[11.5px] font-semibold" style={btnGhost}>Vorbelegung anwenden</button></div>
              {SIEBE.map((t) => <div key={t} className="flex items-center gap-2 mb-2">
                <span className="text-[13px] flex-1">{t}</span>
                <input className="w-16 text-[13px] rounded-lg px-2 py-1.5 text-center" style={{ border: "1px solid " + C.line, background: "#fff" }} placeholder="0" value={d.arthro.siebe[t] ?? ""} onChange={(e) => up(["arthro", "siebe", t], e.target.value)} />
                <span className="text-[11px]" style={{ color: C.grey }}>Stück</span>
              </div>)}
            </SectionCard>
            <SectionCard title="15.3 · Lagerungstools">
              {TOOLS.map((t) => <div key={t} className="flex items-center gap-2 mb-2">
                <span className="text-[13px] flex-1">{t}</span>
                <input className="w-16 text-[13px] rounded-lg px-2 py-1.5 text-center" style={{ border: "1px solid " + C.line, background: "#fff" }} placeholder="0" value={d.arthro.tools[t] ?? ""} onChange={(e) => up(["arthro", "tools", t], e.target.value)} />
                <span className="text-[11px]" style={{ color: C.grey }}>Stück</span>
              </div>)}
              <Field q={{ t: "area", label: "Bemerkungen" }} val={d.arthro.bem} set={(v) => up(["arthro", "bem"], v)} gates={d.gates} />
            </SectionCard>
          </>}

          {mod === "schnitt" && <>
            <SectionCard title="Schnittstellen · Wer liefert was? (Playbook-Ergänzung – verhindert Nachträge)">
              {GEWERKE.map((g) => <div key={g} className="flex flex-wrap items-center gap-2 mb-2">
                <span className="text-[13px] flex-1 min-w-[200px] font-medium">{g}</span>
                {["medifa/S+N", "bauseits", "offen"].map((o) => <button key={o} onClick={() => up(["schnitt", "zust", g], o)} className="px-3 py-1.5 rounded-lg text-[12px] font-semibold" style={{ border: "1px solid " + (d.schnitt.zust[g] === o ? (o === "offen" ? C.bad : C.ink) : C.line), background: d.schnitt.zust[g] === o ? (o === "offen" ? C.bad : C.ink) : "#fff", color: d.schnitt.zust[g] === o ? "#fff" : C.grey }}>{o}</button>)}
              </div>)}
            </SectionCard>
            <SectionCard title="Bestand (Altbau-kritisch)">
              <Field q={{ t: "bool", label: "Statik / Deckenlasten für DVE + OP-Leuchte geprüft", req: true }} val={d.schnitt.statik} set={(v) => up(["schnitt", "statik"], v)} gates={d.gates} />
              <Field q={{ t: "bool", label: "Rohdeckenhöhen in allen Räumen gemessen (nicht nur dwg)" }} val={d.schnitt.rohhoehe} set={(v) => up(["schnitt", "rohhoehe"], v)} gates={d.gates} />
              <Field q={{ t: "bool", label: "Transportweg für Wandelemente geprüft (Treppenhaus/Aufzug/Fenster)", req: true }} val={d.schnitt.transport} set={(v) => up(["schnitt", "transport"], v)} gates={d.gates} />
              <Field q={{ t: "area", label: "Bemerkungen" }} val={d.schnitt.bem} set={(v) => up(["schnitt", "bem"], v)} gates={d.gates} />
            </SectionCard>
          </>}

          {mod === "montage" && <>
            <SectionCard title="16 · Montage">
              <Field q={{ t: "bool", label: "Montageteam durch medifa", req: true }} val={d.montage.team} set={(v) => up(["montage", "team"], v)} gates={d.gates} />
              {d.montage.team === true && <Field q={{ t: "num", label: "Anzahl Personen" }} val={d.montage.personen} set={(v) => up(["montage", "personen"], v)} gates={d.gates} />}
              <Field q={{ t: "bool", label: "Supervisor" }} val={d.montage.supervisor} set={(v) => up(["montage", "supervisor"], v)} gates={d.gates} />
            </SectionCard>
            <SectionCard title="17 · Offene Punkte & medifa-Pflichten">
              <Field q={{ t: "area", label: "Offene Punkte / weitere Wünsche" }} val={d.montage.offen} set={(v) => up(["montage", "offen"], v)} gates={d.gates} />
              <Field q={{ t: "multi", label: "Vor Versand an das Werk prüfen", opts: ["Planübersicht angehängt", "Anzubietende Räume in Plänen markiert", "Pläne maßstabsgetreu (bevorzugt DWG)", "Fragebogen vollständig", "Nicht Zutreffendes durchgestrichen/als n. a. markiert"] }} val={d.montage.checks} set={(v) => up(["montage", "checks"], v)} gates={d.gates} />
            </SectionCard>
          </>}

          {mod === "reife" && <>
            <SectionCard title={"Angebotsreife: " + score + " % · " + missing.length + " offene Pflichtpunkte"}>
              <div className="flex gap-2 mb-4 flex-wrap">
                <button onClick={exportJson} className="px-3 py-2 rounded-lg text-[12.5px] font-semibold flex items-center gap-1.5" style={{ background: C.ink, color: "#fff" }}><Download size={14} /> JSON exportieren</button>
                <button onClick={copyOpen} className="px-3 py-2 rounded-lg text-[12.5px] font-semibold flex items-center gap-1.5" style={btnGhost}><Copy size={14} /> Offene Punkte kopieren (Follow-up-Mail)</button>
                <button onClick={() => window.print()} className="px-3 py-2 rounded-lg text-[12.5px] font-semibold flex items-center gap-1.5" style={btnGhost}><FileText size={14} /> Drucken / PDF</button>
              </div>
              {missing.length === 0 && <div className="flex items-center gap-2 text-[14px] font-semibold" style={{ color: C.ok }}><CheckCircle2 size={18} /> Alle Pflichtpunkte erfasst – angebotsreif.</div>}
              {missing.map((m, i) => <button key={i} onClick={() => setMod(m.mod)} className="w-full text-left flex items-start gap-2 py-1.5 text-[13px] rounded-lg px-2 hover:bg-black/5">
                <AlertTriangle size={14} color={C.bad} className="mt-0.5 shrink-0" />
                <span>{m.label}</span>
              </button>)}
            </SectionCard>
            <SectionCard title="Hinweis">
              <div className="text-[12.5px] leading-relaxed" style={{ color: C.grey }}>Stufe 1 (MVP): Kein automatisches Speichern – Zwischenstände über JSON-Export sichern und per Import fortsetzen. Stufe 2 ergänzt Offline-Persistenz (IndexedDB, PWA auf Hetzner/Coolify) und den PDF-Export im medifa-Layout. Katalogbasis: medifa Fragenkatalog V3.1 DE; Gate-Logik: OP Playbook 2.1.</div>
            </SectionCard>
          </>}
        </div>
      </div>
    </div>
  );
}
