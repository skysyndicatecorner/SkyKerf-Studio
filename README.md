# Kerf Studio

Открытая CAD/CAM-программа для лазерных граверов и фрезерных ЧПУ. Одно окно в стиле современных слайсеров: чертёж → траектории → симуляция G-кода → управление станком. Интерфейс на русском и английском, простой и профессиональный режимы.

*Open-source CAD/CAM for laser cutters and CNC routers — design, toolpaths, G-code simulation and machine control in one window. Russian and English UI, Simple and Pro modes. English summary below.*

![Kerf Studio](build/icon.png)

## Возможности

- **CAD:** фигуры, текст в контуры (5 шрифтов с кириллицей), импорт SVG и DXF, трассировка картинок, булевы операции, смещение, массивы (сеткой и по кругу), группы, рулетка, слои-операции.
- **Листы на столе:** проект создаётся с реальным листом материала; несколько листов (пластин), автоматическая раскладка деталей по реальной форме с поворотами и вложением в отверстия.
- **3D-модель → слои:** STL/OBJ режется на детали из листа — стопкой (горизонтально или вертикально) или решёткой с пазами (прямо или под 45°); штифты-крепления (можно отключить), разметка следующего слоя, номера деталей, 3D-предпросмотр сборки.
- **Генераторы:** многослойная картина 1–10 слоёв, коробка с шипами, пазл, табличка, шестерня, QR-бейдж, гибкий шарнир, тест материала.
- **Лазер:** резка, заливка, фото с дизерингом (Jarvis, Floyd–Steinberg, Stucki, Atkinson, Байер, оттенки серого), перемычки, компенсация реза, перебег, обдув.
- **Фрезер:** снаружи / внутри / по линии, карман, гравировка, V-резьба, сверление, перемычки, калькулятор подачи.
- **G-код:** 2D/3D-симуляция с плеером, раскраска по слоям, скорости, мощности или глубине, редактор, открытие чужих .nc.
- **Станок:** GRBL по USB (Web Serial), джойстик, ноль, рамка, консоль, макросы, демо-станок.

## Скачать

Готовые сборки — на странице **Releases**:

| Система | Файл |
|---|---|
| Windows 10/11 x64 | `KerfStudio-Setup-<версия>.exe` (установщик) или `KerfStudio-Portable-<версия>.exe` (без установки) |
| Linux x64 | `KerfStudio-<версия>-x86_64.AppImage` (любой дистрибутив) или `KerfStudio-<версия>-amd64.deb` (Ubuntu, Debian, Mint) |

- Windows может показать предупреждение SmartScreen, потому что сборка не подписана сертификатом: «Подробнее» → «Выполнить в любом случае».
- AppImage: `chmod +x KerfStudio-*.AppImage` и запустить.
- Linux и USB: чтобы видеть порт станка, добавьте себя в группу `dialout`: `sudo usermod -aG dialout $USER`, затем перезайдите в систему.

**macOS** официально не собирается. Код кроссплатформенный (Electron), поэтому порт должен быть несложным — если возьмётесь, присылайте pull request: нужна цель `mac` в `package.json`, иконка `.icns`, подпись и нотаризация.

## Сборка через GitHub (ничего не нужно ставить)

1. Загрузите репозиторий на GitHub. Файл `.github/workflows/build.yml` проще создать через **Add file → Create new file** (при загрузке перетаскиванием папки с точкой в начале имени иногда пропускаются).
2. **Actions → Build desktop → Run workflow.** Через 5–10 минут готовые файлы появятся внизу страницы запуска в разделе **Artifacts**.
3. Чтобы файлы сами прикреплялись к релизу: **Releases → Draft a new release**, тег вроде `v0.2.0`, **Publish**. Номер версии берётся из `package.json` — меняйте его перед релизом.

## Сборка у себя

Нужен [Node.js](https://nodejs.org/) 22 или новее.

```bash
npm install
npm start            # запустить из исходников (F12 — инструменты разработчика)
npm run dist:win     # на Windows → dist/*.exe
npm run dist:linux   # на Linux → dist/*.AppImage, dist/*.deb
```

## Структура

```
main.js, preload.js     оболочка Electron: окно, сохранение файлов, выбор USB-порта
src/index.html          интерфейс и стили
src/js/core.js          модель проекта, геометрия, материалы, трассировка, шрифты
src/js/cad.js           холст, листы, редактирование, импорт SVG/DXF/фото, раскладка
src/js/cam.js           траектории, G-код (лазер и фрезер), разбор и симуляция
src/js/gen.js           генераторы (коробка, многослойная картина, пазл и др.)
src/js/slicer.js        слайсер 3D-моделей и 3D-просмотр
src/js/ui.js            панели, режимы, станок, события
src/vendor, src/fonts   сторонние библиотеки и шрифты (см. THIRD_PARTY_NOTICES.md)
```

Проект сохраняется в файл `.kerf` (JSON). Двойной клик по `.kerf` открывает его в программе.

## Безопасность

Лазер и фрезер опасны. Работайте в защитных очках, с вытяжкой, не оставляйте станок без присмотра. Режимы материалов в программе ориентировочные — сначала делайте тест на обрезке. Программа предоставляется «как есть» (см. лицензию).

## Лицензия

Код Kerf Studio — [MIT](LICENSE). Сторонние библиотеки и шрифты сохраняют свои лицензии — список в [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md), полные тексты в папке [licenses](licenses).

---

## English

**Kerf Studio** is an MIT-licensed CAD/CAM app for laser engravers/cutters and CNC routers: drawing, sheet nesting, a 3D-model slicer (stacked layers with alignment dowels or interlocked slotted grids), generators (layered picture, finger-joint box, jigsaw, sign, gear, QR tag, living hinge, material test), photo engraving with dithering, V-carving, G-code simulation in 2D/3D and GRBL machine control over USB.

- **Download:** see Releases — Windows installer/portable `.exe`, Linux `.AppImage`/`.deb`.
- **Build on GitHub:** Actions → *Build desktop* → *Run workflow*, or publish a Release to get the files attached.
- **Build locally:** Node.js 22+, then `npm install`, `npm start`, `npm run dist:win` / `npm run dist:linux`.
- **macOS:** not built officially; ports are welcome via pull request.
- **Third-party code and fonts:** see [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md).
