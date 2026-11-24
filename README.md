# Mapbender Advanced Digitizer

Erweiterung des Mapbender-Digitizers (Winkel-Einrasten, Längeneingabe, Live-Messung,
Teile von Multipolygonen hinzufügen/entfernen, Kurzanleitung).

- Neues Element „Datenerfassung erweitert (Advanced Digitizer)“, abgeleitet von
  `mapbender/digitizer`. Es wird wie der normale Digitizer über das Feld „Schemes“
  konfiguriert.
- Getestet mit Mapbender 5.0.2 (`mapbender/digitizer` 3.0.0, OpenLayers 10.10).
- Das Bundle ändert keinen Code von `mapbender/digitizer` oder Mapbender, es erweitert nur
  durch Ableiten und Überschreiben.

## Installation

Voraussetzung: Mapbender ^5.0 mit `mapbender/digitizer` ^3.0.

### Variante A: Docker-Image (erprobt)

Das Bundle nach `/var/mapbender/advanced-digitizer` kopieren und `docker/install-bundle.sh`
ausführen. Das Skript trägt den Autoloader in die `composer.json` und das Bundle in
`config/bundles.php` ein, leert den Symfony-Cache und prüft, dass das Element
`mapbender.element.AdvancedDigitizer` registriert ist. Sonst bricht der Build ab.

```dockerfile
FROM mapbender/mapbender:v5.0.2
USER www-data
COPY --chown=www-data:www-data composer.json /var/mapbender/advanced-digitizer/composer.json
COPY --chown=www-data:www-data src /var/mapbender/advanced-digitizer/src
COPY --chown=www-data:www-data docker/install-bundle.sh /tmp/install-bundle.sh
RUN sh /tmp/install-bundle.sh && rm /tmp/install-bundle.sh
```

### Variante B: Composer (nicht getestet)

Zuerst `name` in der `composer.json` des Bundles anpassen. Dann das Repository als
Path-Repository (oder nach der Veröffentlichung als VCS-Repository) in die Mapbender-Anwendung
einbinden:

```bash
composer config repositories.advdig path /pfad/zu/mapbender-advanced-digitizer
composer require stadt-bruehl/mapbender-advanced-digitizer:@dev
```

Danach das Bundle in `config/bundles.php` eintragen und den Cache leeren:

```php
Mapbender\AdvancedDigitizerBundle\MapbenderAdvancedDigitizerBundle::class => ['all' => true],
```

```bash
php bin/console cache:clear
php bin/console debug:container mapbender.element.AdvancedDigitizer
```

Danach Assets neu erzeugen, falls nötig (`php bin/console assets:install`).

## Zeichnen mit Winkelraster und Längeneingabe

Gilt für „Linie erstellen“, „Fläche erstellen“ und „Teil hinzufügen“.

- Am Mauszeiger zeigt ein Feld Segmentlänge, Gesamtlänge bzw. Umfang und Winkel.
- Winkelraster: Die Richtung rastet in festen Schritten ein, wenn sie höchstens um die
  Toleranz abweicht (Vorgabe 15° und 5°). Ein ✓ am Winkel zeigt das Einrasten. Nahe an
  den Punkten, mit denen sich die Skizze abschließen lässt, rastet kein Winkel ein.
- Einrasten auf vorhandene Stützpunkte und Kanten (Objekt-Snap) hat Vorrang vor dem
  Winkelraster.
- `F8` schaltet das Winkelraster ein/aus, `F9` wechselt zwischen absolutem Winkel und
  Winkel relativ zum vorigen Segment.
- Absolute Winkel zählen ab Norden im Uhrzeigersinn (90° = Osten), relative Winkel sind
  bei einem Knick nach rechts positiv. Mit `angleReference: east` zählen sie ab Osten
  gegen den Uhrzeigersinn, relative Winkel sind dann bei einem Knick nach links positiv.
- Längeneingabe nach dem ersten Punkt: Zahl tippen und `Enter`, z. B. `12,5`. Der
  nächste Punkt liegt in diesem Abstand in Richtung des Mauszeigers. `12,5<90` setzt ihn
  in Richtung 90°. Beim ersten Segment gilt immer der absolute Winkel. Komma oder Punkt
  als Dezimaltrenner, `Backspace` löscht ein Zeichen, `Esc` verwirft die Eingabe.
- `Esc` ohne angefangene Eingabe beendet das Zeichenwerkzeug, die Skizze geht verloren.
- Der Knopf mit dem Fragezeichen rechts neben den Zeichenwerkzeugen öffnet eine
  Kurzanleitung (siehe unten).

Einstellungen stehen in der Element-Konfiguration unter `advancedDrawing`. Das
Backend-Formular hat dafür kein Feld (es kennt nur „Schemes“). Setzen lassen sie sich in
einer YAML-Anwendung unter `config/mapbender/applications` beim Element. Ohne Angabe
gelten die Vorgaben aus `AdvancedDigitizer::getDefaultDrawingConfiguration()`:

| Schlüssel | Vorgabe | Bedeutung |
|---|---|---|
| `angleSnapEnabled` | `true` | Winkelraster beim Start eingeschaltet |
| `angleStep` | `15` | Rasterschritt in Grad |
| `angleTolerance` | `5` | maximale Abweichung zum Einrasten in Grad |
| `angleMode` | `absolute` | `absolute` oder `relative` (zum vorigen Segment) beim Start |
| `angleReference` | `north` | `north` (Azimut, im Uhrzeigersinn) oder `east` (mathematisch) |
| `toggleKey` | `F8` | Taste für Winkelraster ein/aus |
| `modeKey` | `F9` | Taste für absolut/relativ |
| `calcSrs` | `EPSG:25832` | Koordinatensystem für Längen und Winkel, wenn die Karte nicht metrisch ist |
| `useMapSrsIfMetric` | `true` | metrisches Kartensystem (außer Web-Mercator) direkt verwenden |
| `decimals` | `2` | Nachkommastellen in der Anzeige |
| `unit` | `m` | angezeigte Einheit |
| `finishTolerance` | `12` | Abstand in Pixeln zum Abschlusspunkt, in dem kein Winkel einrastet |

```yaml
advancedDrawing:
    angleStep: 10
    angleTolerance: 3
```

## Mehrteilige Flächen: „Teil hinzufügen“ und „Teil entfernen“

Zwei Werkzeuge für Schemas, deren `featureType` `geomType: multipolygon` hat
(genau so, kleingeschrieben). In allen anderen Schemas erscheinen sie nicht.

| Werkzeugname (`toolset`) | Schaltfläche | Wirkung |
|---|---|---|
| `addPart` | Teil hinzufügen | zeichnet ein Polygon und hängt es als weiteren Teil an das ausgewählte Objekt an |
| `removePart` | Teil entfernen | Klick in einen Teil entfernt ihn; der letzte Teil bleibt immer erhalten |

Bedienung „Teil hinzufügen“:

1. „Bearbeiten“ aktivieren und ein gespeichertes Objekt anklicken. Es wird als in
   Bearbeitung markiert (Stützpunkte sichtbar).
2. „Teil hinzufügen“ anklicken. Ist kein Objekt ausgewählt, erscheint nur ein Hinweis.
3. Den Teil zeichnen wie mit „Fläche erstellen“: Winkelraster (`F8` an/aus, `F9`
   absolut/relativ), Längeneingabe `L` bzw. `L<α` mit `Enter`, Einrasten auf vorhandene
   Stützpunkte. Doppelklick oder Klick auf den Startpunkt schließt den Teil ab. Das Objekt
   bleibt ausgewählt, weitere Teile können sofort folgen.
4. Speichern mit dem Speichern-Knopf der Tabellenzeile oder „Alle Objekte speichern“.
   Danach endet das Werkzeug (außer bei `continueDrawingAfterSave: true`).

`Esc` wirkt stufenweise: löscht eine angefangene Längeneingabe, bricht dann den
angefangenen Teil ab (das Objekt bleibt unverändert) und beendet beim nächsten Druck das
Werkzeug. Angehängte, noch nicht gespeicherte Teile lassen sich nach Verlassen des
Werkzeugs per Rechtsklick auf das Objekt → „Geometrieänderung zurücknehmen“ verwerfen.
Das nimmt alle ungespeicherten Geometrieänderungen des Objekts zurück.

„Teil entfernen“: Objekt mit „Bearbeiten“ auswählen, Werkzeug wählen, in den zu
entfernenden Teil klicken, speichern.

Der Knopf mit dem Fragezeichen rechts neben den Zeichenwerkzeugen öffnet eine
Kurzanleitung. Sie zeigt nur die Abschnitte, die zu den Werkzeugen des gewählten Themas
passen, und nennt die eingestellten Tasten und Werte (Winkelschritt, Toleranz, Einheit).
Das Fenster lässt sich verschieben und bleibt beim Zeichnen offen.

Toolset im Backend (Element bearbeiten → Feld „Schemes“, YAML):

- Ohne `toolset` zeigt der Digitizer alle Werkzeuge, die zum `geomType` passen, bei
  `multipolygon` also auch `addPart` und `removePart`.
- Mit eigenem `toolset` erscheinen nur die eingetragenen Werkzeuge in der eingetragenen
  Reihenfolge. `modifyFeature` muss dann ebenfalls drinstehen, sonst lässt sich kein Objekt
  auswählen.
- Beide Werkzeuge brauchen `allowEdit` und `allowDigitize` (Vorgabe jeweils `true`).
- Ein Eintrag kann statt des Namens auch `{ type: addPart, label: <Übersetzungsschlüssel> }`
  sein.

Beispiel für das Schema `flaechen` (Tabelle `public.flaechen`, Doctrine-Verbindung `default`):

```yaml
flaechen:
    label: Flächen
    featureType:
        connection: default
        table: public.flaechen
        uniqueId: id
        geomField: geom
        geomType: multipolygon
    toolset:
        - drawPolygon
        - modifyFeature
        - moveFeature
        - addPart
        - removePart
    table:
        columns:
            - { data: id, label: ID }
            - { data: bezeichnung, label: Bezeichnung }
    formItems:
        - { type: input, name: bezeichnung, title: Bezeichnung }
```

Beim Speichern wendet der Digitizer serverseitig `ST_MakeValid` an. Teile, die sich
überlappen oder eine gemeinsame Kante haben, ergeben kein gültiges MultiPolygon und werden
dabei verändert, z. B. zu einem Teil zusammengelegt. Die Karte zeigt nach dem Speichern die
Geometrie aus der Datenbank. Teile daher nicht überlappend zeichnen und sich höchstens in
einzelnen Punkten berühren lassen. Prüfen:

```sql
SELECT id, ST_NumGeometries(geom), ST_IsValid(geom) FROM public.flaechen;
```

## Schemes für Digitizer 3.0.0: Fallstricke

Ältere Digitizer-Konfigurationen enthalten Schlüssel, die 3.0.0 anders oder gar nicht
auswertet (geprüft im Quellcode von 3.0.0):

| Schlüssel | Verhalten in 3.0.0 | Stattdessen |
|---|---|---|
| `tableFields` als Zuordnung `spalte: { label: … }` | Tabelle zeigt nur die Standardspalte | `table.columns` als Liste: `- { data: spalte, label: … }` |
| `allowEditData` | alter Name, überschreibt `allowEdit` | nur `allowEdit` |
| `allowCreate` | wird immer auf den Wert von `allowEdit` gesetzt | weglassen |
| `zoomScaleDenominator` | wird nicht gelesen | `zoomBuffer` (Vorgabe 10) |
| eigenes `toolset` | zeigt nur die eingetragenen Werkzeuge, auch Bearbeiten/Verschieben nicht automatisch (anders als im Upstream-README) | `modifyFeature`, `moveFeature` mit eintragen |

`geomType` steht im `featureType`, wird nur im Browser ausgewertet und bestimmt die
angebotenen Werkzeuge (`point`/`multipoint`, `line`/`multiline`, `polygon`/`multipolygon`).
Den tatsächlichen Spaltentyp zeigt:

```sql
SELECT f_table_schema, f_table_name, type, srid FROM geometry_columns;
```

## Korrektur gegenüber dem Digitizer: Formular per X schließen

Im Digitizer 3.0.0 mit Mapbender 5.0.2 blieben nach dem Schließen des Attributformulars
über das X alle Werkzeugknöpfe gesperrt, und ein ungespeichertes neues Objekt blieb auf
der Karte. Der Digitizer wartet auf das Ereignis `dialogclose`, das `Mapbender.Popup` nie
auslöst. `MbAdvancedDigitizer._openEditDialog()` leitet deshalb das `close` des Popups
als `dialogclose` weiter. Fällt das Problem in einer neueren Digitizer-Version weg, kann
die Methode entfallen.

## Aufbau des Bundles

| Datei (`src/`) | Inhalt |
|---|---|
| `Element/AdvancedDigitizer.php` | Element, erbt vom Digitizer; Assets, Vorgaben für `advancedDrawing` |
| `Resources/public/MbAdvancedDigitizer.js` | Widget: Werkzeugleiste, Auswahl für Teil-Werkzeuge, Hilfe-Knopf, X-Korrektur |
| `Resources/public/AdvancedFeatureEditor.js` | Werkzeuge: Winkel/Länge an Draw hängen, „Teil hinzufügen“, `Esc` |
| `Resources/public/AngleLengthInteraction.js` | Winkelraster, Längeneingabe, Messanzeige |
| `Resources/public/AdvancedToolset.js` | Werkzeugnamen `addPart`/`removePart`, Icons, Rechte |
| `Resources/public/RemovePartInteraction.js` | „Teil entfernen“ (optional) |
| `Resources/public/HelpDialog.js` | Kurzanleitung |
| `Resources/translations/messages.{de,en}.yaml` | alle Texte, Präfix `mb.advanced_digitizer.` |
| `Resources/public/sass/advanced-digitizer.scss` | Messanzeige, Icons, Hilfe |

## Lizenz

MIT, siehe [LICENSE](LICENSE). Mapbender und `mapbender/digitizer` stehen ebenfalls unter
der MIT-Lizenz, das Bundle ist damit ohne Einschränkung kombinierbar.
