# Third-party notices / Сторонние компоненты

SkyKerf_Studio is MIT-licensed. This file lists **only third-party code and assets that are actually included** in the source or the built application. Products that merely inspired features or UI (no code taken) are not listed — ideas, workflows and feature sets are not copyrighted.

SkyKerf_Studio распространяется по MIT. Здесь перечислено **только то стороннее, что реально входит** в исходники или сборку: код и шрифты. Программы, у которых мы подсмотрели идеи или подход к интерфейсу без заимствования кода, сюда не входят.

## Code / Код

| Component | Version | Used for | License | Full text |
|---|---|---|---|---|
| [three.js](https://github.com/mrdoob/three.js) — © 2010-2021 three.js authors | r128 | 3D view of the slicer, assemblies, relief preview | MIT | [licenses/three.js-MIT.txt](licenses/three.js-MIT.txt) |
| [Clipper](http://www.angusj.com/) — © 2010-2017 Angus Johnson; JavaScript translation ([clipper-lib](https://github.com/junmer/clipper-lib)) by Timo | 6.4.2.2 | Offsets, booleans, pockets, kerf compensation, nesting footprints | Boost Software License 1.0 | [licenses/Clipper-BSL-1.0.txt](licenses/Clipper-BSL-1.0.txt) |
| JSBN (inside clipper.js) — © 2003-2005 Tom Wu | — | 128-bit integer math in Clipper | MIT-style, notice must be retained | [licenses/jsbn-Tom-Wu.txt](licenses/jsbn-Tom-Wu.txt) |
| [qrcode-generator](https://github.com/kazuhikoarase/qrcode-generator) — © 2009 Kazuhiko Arase | master @ 83b7e8f (2025-08-07) | QR code generator | MIT | [licenses/qrcode-generator-MIT.txt](licenses/qrcode-generator-MIT.txt) |
| [UTIF.js](https://github.com/photopea/UTIF.js) — © 2017 Photopea | master @ 5883510 (2026-05-04) | Reading TIFF images on import | MIT | [licenses/UTIF.js-MIT.txt](licenses/UTIF.js-MIT.txt) |
| [Draradech/jigsaw](https://github.com/Draradech/jigsaw) — jigsaw edge-shape formulas, ported in `src/js/gen.js` | — | Jigsaw puzzle generator | CC0 1.0 (attribution not required, credited voluntarily) | [CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/) |

“QR Code” is a registered trademark of DENSO WAVE INCORPORATED.

## Fonts (bundled in `src/fonts`) / Шрифты

All fonts are used unmodified under the SIL Open Font License 1.1.

| Font | Copyright | License text |
|---|---|---|
| IBM Plex Sans | © 2017 IBM Corp., Reserved Font Name “Plex” | [licenses/OFL-IBM-Plex-Sans.txt](licenses/OFL-IBM-Plex-Sans.txt) |
| JetBrains Mono | © 2020 The JetBrains Mono Project Authors | [licenses/OFL-JetBrains-Mono.txt](licenses/OFL-JetBrains-Mono.txt) |
| Unbounded | © 2022 The Unbounded Project Authors | [licenses/OFL-Unbounded.txt](licenses/OFL-Unbounded.txt) |
| PT Serif | © 2010 ParaType Ltd., Reserved Font Names “PT Sans”, “PT Serif”, “ParaType” | [licenses/OFL-PT-Serif.txt](licenses/OFL-PT-Serif.txt) |
| Caveat | © 2014 The Caveat Project Authors | [licenses/OFL-Caveat.txt](licenses/OFL-Caveat.txt) |

System fonts chosen by the user in the text tool are read from the user's computer at run time and are not distributed with SkyKerf_Studio. Their outlines become part of the user's own project.

## File format references / Описания форматов

The CorelDRAW (.cdr) reader in `src/js/cdr.js` was written from the publicly documented structure of the format as implemented by [libcdr](https://wiki.documentfoundation.org/DLP/Libraries/libcdr) (MPL 2.0). No libcdr source code is included or translated line by line. The PDF, HPGL and LightBurn readers were written for this project from the public specifications. No third-party drawings are included in the repository or the tests.

Читатель CorelDRAW написан по открытому описанию формата (libcdr, MPL 2.0) без копирования кода. Читатели PDF, HPGL и LightBurn написаны для проекта по открытым спецификациям. Чужие чертежи в репозиторий и тесты не входят.

## Desktop runtime / Оболочка

The Windows and Linux builds are packaged with [Electron](https://github.com/electron/electron) (MIT). Electron ships its own license and the Chromium credits (`LICENSE.electron.txt`, `LICENSES.chromium.html`) inside every build; electron-builder adds them automatically. Electron is not part of the source repository.

## Not included / Что не входит

No proprietary machine models, icons, interface assets, materials data or postprocessors of other products are included. Built-in material values and postprocessor profiles were written for this project and are marked “unverified” until tested on real hardware.

Проприетарные модели станков, иконки, интерфейсы, таблицы материалов и постпроцессоры других программ не используются. Встроенные значения материалов и профили постпроцессоров написаны для этого проекта и помечены «не проверено», пока их не испытают на реальном станке.

## Trademarks / Товарные знаки

Names of other products mentioned in documentation (CorelDRAW, Adobe Illustrator, LightBurn, Bambu Studio, Creality Print, Fusion, Easel, xTool, GRBL and others) belong to their owners. SkyKerf_Studio is not affiliated with them.
