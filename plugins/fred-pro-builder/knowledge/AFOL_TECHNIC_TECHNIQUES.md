# AFOL & Technic Ingenieur-Handbuch für Fred (Gemini Edition)

Dieses Wissensdokument vermittelt Fred die wichtigsten modernen Profi-Klemmbausteintechniken für große, extrem stabile und fotorealistisch glatte Displaymodelle.

## 1. Das 5:2-SNOT-Verhältnis (Studs Not On Top)
- **Exakte Geometrie:** `2 Noppen Breite (40 LDU)` entsprechen exakt `5 gestapelten Platten Höhe (40 LDU)`.
- **Regel für seitliche Verkleidungen:** Wenn eine glatte Außenhaut seitlich (90° gedreht) an einem Innenkern befestigt wird, muss die vertikale Höhe der Sektion ein Vielfaches von **5 Platten (40 LDU)** sein, damit obere und untere Abschlüsse spannungsfrei und fugenlos ins Raster passen.

## 2. Technic-Trägerskelett & Torsionsbox (Teil `64179.dat` 5×7 Open Center Frame)
- **Kein massiver Klotz-Kern:** Große Modelle (> 500 Teile, z. B. Schiffe, Raumschiffe, Fahrzeuge) erhalten ein leichtes, verwindungssteifes **Technic-Trägerskelett** aus `64179.dat` (5×7 Open-Center-Rahmen) und `32524.dat` (Technic Liftarm 1×7 Thick).
- **Torsionsbox-Sandwich:** Zwei parallele Rahmen-Ebenen, verbunden durch Abstandshalter und Pins (`2780.dat`), verhindern Durchbiegen und Verdrehen (Torsion) bei langen Rümpfen (z. B. 90-Noppen-Titanic).
- **Pythagoreische Dreiecks-Verstrebung:** Diagonale Liftarme (z. B. `3-4-5`-Dreieck im 20-LDU-Lochraster) sperren rechteckige Rahmenfelder gegen seitliches Abscheren.

## 3. Nahtlose Außenhaut-Verkleidung (Brackets & abnehmbare Kachel-Panels)
- **Technic-zu-System-Brücke:** Über `4274.dat` (Technic Pin 1/2 mit Noppe) und `99781.dat` (Bracket 1×2–1×2 Inverted) sowie `87087.dat` (SNOT-Stein 1×1 mit Seitennoppe) werden nach außen gerichtete Montagepunkte direkt am Technic-Skelett geschaffen.
- **Detachable Cladding Panels:** Glatte Außenhaut-Segmente werden flach aus Platten + großen glatten Kacheln (`2431.dat`, `3069b.dat`, `3068b.dat`) vorgebaut und als große, bündige Hüllen-Panels auf die Brackets gedrückt. Sie wirken gleichzeitig als zusätzliche Schubversteifung.

## 4. Legaler Halbnoppen-Feinversatz (`15573.dat` Jumper Plate 1×2)
- Für zentrierte Masten, zurückgesetzte Fensterreihen oder symmetrische Bugspitzen wird niemals illegal „zwischen“ Noppen geklemmt, sondern ausschließlich über offizielle **Jumper Plates (`15573.dat`)** legal um 10 LDU versetzt.
