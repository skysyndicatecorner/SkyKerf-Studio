# Сборка SkyKerf_Studio через GitHub — полная инструкция

Эта инструкция для тех, кто хочет получить готовые установщики для **Windows** (`.exe`) и **Linux** (`.AppImage`, `.deb`), ничего не устанавливая на свой компьютер. Всю работу делают бесплатные серверы GitHub Actions. Понадобятся только браузер и аккаунт GitHub.

Время: первый раз — 20–30 минут, дальше — 2 минуты на запуск и 10–15 минут ожидания.

---

## 0. Как это устроено

В репозитории лежат два «рецепта» (workflow) в папке `.github/workflows`:

| Файл | Название в GitHub | Когда запускается | Что делает |
|---|---|---|---|
| `ci.yml` | **Tests** | сам, при каждой загрузке изменений (push) и pull request | проверяет синтаксис и запускает автотесты (`node --test`) |
| `build.yml` | **Build desktop** | вручную кнопкой или при публикации релиза | снова прогоняет тесты, затем на двух серверах (Windows и Ubuntu) собирает установщики |

Результат сборки — **артефакты** (zip-архивы с файлами) на странице запуска, а при релизе — файлы, прикреплённые к самому релизу.

Секреты и пароли для этого **не нужны**: сборка не подписывается сертификатом, токен для прикрепления файлов к релизу GitHub выдаёт автоматически.

---

## 1. Репозиторий

Адрес проекта: `https://github.com/skysyndicatecorner/SkyKerf_Studio`.

- **Если репозиторий уже есть под старым именем** (например, `Kerf-Studio`) — не создавайте новый, а переименуйте старый: так сохранятся звёзды, задачи, релизы и перенаправление старых ссылок. Пошагово — в [RENAME.md](RENAME.md).
- **Если репозитория ещё нет:**
  1. Откройте <https://github.com/new>.
  2. **Owner** — `skysyndicatecorner` (проверьте, что выбран нужный владелец — личный аккаунт или организация).
  3. **Repository name** — `SkyKerf_Studio`.
  4. **Public** (для бесплатных минут Actions без ограничений) или Private.
  5. **Не** ставьте галочки «Add a README», «.gitignore», «license» — они уже есть в архиве.
  6. **Create repository**.

---

## 2. Загрузка файлов

Распакуйте архив `SkyKerf_Studio-0.3.0.zip`. Внутри — папка `SkyKerf_Studio` с файлами `package.json`, `main.js`, папками `src`, `docs`, `tests`, `.github` и др.

> Папка `.github` начинается с точки. В Windows и macOS такие папки бывают скрыты. Включите показ скрытых файлов: Windows — Проводник → «Вид» → «Показать» → «Скрытые элементы»; macOS — `Cmd + Shift + .`.

Выберите **один** из способов.

### Способ А. Через браузер (проще всего)

1. На странице пустого репозитория нажмите **uploading an existing file** (или **Add file → Upload files**).
2. Откройте папку `SkyKerf_Studio` и выделите **её содержимое** (не саму папку): `package.json`, `main.js`, `preload.js`, `src`, `docs`, `tests`, `build`, `licenses`, `.github`, `README.md` и остальное. Перетащите в окно браузера.
3. Дождитесь окончания загрузки, внизу напишите сообщение, например `SkyKerf_Studio 0.3.0`, и нажмите **Commit changes**.
4. **Проверьте, что загрузилась папка `.github`.** Откройте в репозитории `.github/workflows/` — там должны быть `build.yml` и `ci.yml`. Браузер иногда пропускает папки с точкой.

Если `.github` не загрузилась — создайте файлы вручную:

1. **Add file → Create new file**.
2. В поле имени введите `.github/workflows/build.yml` (слеши сами создадут папки).
3. Скопируйте содержимое файла `build.yml` из архива (откройте его Блокнотом) и вставьте.
4. **Commit changes**. Повторите для `.github/workflows/ci.yml`.

Шаблоны задач (`.github/ISSUE_TEMPLATE/*`) и `pull_request_template.md` для сборки не нужны, но их можно добавить так же.

### Способ Б. Через git (если git установлен)

```bash
git clone https://github.com/skysyndicatecorner/SkyKerf_Studio.git
cd SkyKerf_Studio
# скопируйте сюда содержимое распакованной папки SkyKerf_Studio, включая .github
git add -A
git commit -m "SkyKerf_Studio 0.3.0"
git push
```

При первом `git push` GitHub попросит войти. Используйте вход через браузер (Git Credential Manager) или **Personal access token** вместо пароля. Токен **никогда** не записывайте в файлы репозитория.

### Способ В. GitHub Desktop

**File → Clone repository** → выберите `SkyKerf_Studio` → скопируйте файлы в папку клона → в программе впишите сообщение → **Commit to main** → **Push origin**.

---

## 3. Разрешения Actions (один раз)

**Settings → Actions → General**:

1. **Actions permissions** — «Allow all actions and reusable workflows» (или разрешите хотя бы `actions/*` и `softprops/action-gh-release`).
2. **Workflow permissions** — выберите **Read and write permissions** и нажмите **Save**. Это нужно, чтобы сборка могла прикрепить файлы к релизу. Для обычной ручной сборки достаточно и «Read».

В приватных репозиториях организаций эти настройки иногда задаёт администратор организации.

---

## 4. Автотесты (проверка, что всё загрузилось правильно)

Сразу после загрузки откройте вкладку **Actions**. Там должен появиться запуск **Tests**.

- Зелёная галочка — тесты пройдены: геометрия, раскладка, постпроцессоры, открытие старых проектов, проверка переименования.
- Красный крестик — откройте запуск → шаг **Unit tests** и посмотрите, какой тест упал (строки `not ok`). Чаще всего причина — загружены не все файлы (например, нет папки `tests/fixtures` или `src/vendor`).

Значок статуса тестов виден в README.

---

## 5. Сборка вручную

1. **Actions** → слева **Build desktop** → справа кнопка **Run workflow** → ветка `main` → **Run workflow**.
2. Через несколько секунд появится новый запуск. Внутри три задачи: `test`, затем `build (windows-latest, --win)` и `build (ubuntu-latest, --linux)`, которые идут параллельно.
3. Ждите 8–15 минут. Первая сборка дольше: GitHub скачивает Electron.
4. Когда всё зелёное, прокрутите страницу запуска вниз до **Artifacts**:
   - `SkyKerf_Studio-Windows` — внутри `SkyKerf_Studio-Setup-0.3.0.exe` и `SkyKerf_Studio-Portable-0.3.0.exe`;
   - `SkyKerf_Studio-Linux` — внутри `SkyKerf_Studio-0.3.0-x86_64.AppImage` и `SkyKerf_Studio-0.3.0-amd64.deb`.
5. Скачайте и распакуйте zip. Артефакты хранятся 90 дней (настраивается в **Settings → Actions → General → Artifact and log retention**).

> Скачивать артефакты может только вошедший в GitHub пользователь. Чтобы раздать программу всем, используйте релиз (следующий шаг).

---

## 6. Релиз с автоматической сборкой

1. **Обновите номер версии** в двух местах (они должны совпадать — это проверяет автотест):
   - `package.json` → `"version": "0.3.0"`;
   - `src/js/core.js` → `const APP_VERSION = '0.3.0';`.
   Через браузер: откройте файл → значок карандаша → исправьте → **Commit changes**.
2. Допишите изменения в `CHANGELOG.md` (необязательно, но полезно).
3. **Releases** (справа на главной странице репозитория) → **Draft a new release**.
4. **Choose a tag** → впишите `v0.3.0` → **Create new tag: v0.3.0 on publish**. Ветка — `main`.
5. **Release title** — например `SkyKerf_Studio 0.3.0`. В описание можно вставить раздел из `CHANGELOG.md`.
6. **Publish release**.
7. Публикация запускает **Build desktop**. Через 10–15 минут файлы `.exe`, `.AppImage`, `.deb` появятся внизу страницы релиза в разделе **Assets**.

Если нужно пересобрать релиз — откройте **Actions → Build desktop** → упавший или старый запуск → **Re-run all jobs**. Файлы с теми же именами заменятся.

---

## 7. Что получится и как запускать

| Файл | Для чего |
|---|---|
| `SkyKerf_Studio-Setup-0.3.0.exe` | установщик Windows 10/11 x64; можно выбрать папку, создаёт ярлыки, связывает файлы `.kerf` |
| `SkyKerf_Studio-Portable-0.3.0.exe` | запуск без установки (например, с флешки) |
| `SkyKerf_Studio-0.3.0-x86_64.AppImage` | любой современный Linux x64: `chmod +x SkyKerf_Studio-*.AppImage`, затем запустить |
| `SkyKerf_Studio-0.3.0-amd64.deb` | Ubuntu, Debian, Mint: `sudo apt install ./SkyKerf_Studio-0.3.0-amd64.deb` |

- **Windows SmartScreen** («Система Windows защитила ваш компьютер»): сборка не подписана сертификатом. **Подробнее → Выполнить в любом случае**.
- **AppImage не запускается на Ubuntu 22.04+**: нужна библиотека FUSE 2 — `sudo apt install libfuse2` (на Ubuntu 24.04 пакет называется `libfuse2t64`).
- **Станок по USB в Linux**: `sudo usermod -aG dialout $USER`, затем выйти из системы и войти снова.
- **Обновление с Kerf Studio 0.2**: настройки и проекты переносятся при первом запуске, старая папка настроек не удаляется. Подробнее — [RENAME.md](RENAME.md).

---

## 8. Частые проблемы

| Симптом | Причина и решение |
|---|---|
| Во вкладке Actions нет **Build desktop** | Нет файла `.github/workflows/build.yml` в ветке по умолчанию. Создайте его (шаг 2). |
| Кнопки **Run workflow** нет | Файл есть, но не в ветке по умолчанию, или у вас нет прав на запись в репозиторий. |
| Упала задача `test`, сборка не началась | Так задумано: сборка идёт только после успешных тестов. Откройте шаг **Unit tests** и посмотрите `not ok`. |
| `Resource not accessible by integration` / ошибка 403 на шаге «Attach files to the release» | Включите **Read and write permissions** (шаг 3) и перезапустите задачу. |
| `npm install` долго или с предупреждениями `deprecated` | Нормально: предупреждения не мешают. Ошибка сети — просто перезапустите задачу. |
| `No files were found with the provided path: dist/*.exe` | Сборщик упал раньше. Откройте шаг **Build installers** и найдите первую строку с `error`. |
| Тест «no leftover Kerf Studio branding» упал после ваших правок | Вы добавили старое название в код или документацию. Замените на SkyKerf_Studio или используйте его только в заметках о переходе. |
| Тест версии упал | `package.json` и `APP_VERSION` в `src/js/core.js` различаются — исправьте. |
| Закончились бесплатные минуты (приватный репозиторий) | Сделайте репозиторий публичным или дождитесь нового месяца. Сборка Windows расходует минуты быстрее. |

---

## 9. Необязательно: подпись кода

Подписанная сборка не вызывает предупреждения SmartScreen. Если у вас появится сертификат:

1. **Settings → Secrets and variables → Actions → New repository secret**:
   - `CSC_LINK` — сертификат `.p12/.pfx` в base64 или ссылка на него;
   - `CSC_KEY_PASSWORD` — пароль сертификата.
2. В `build.yml` в шаге **Build installers** уберите строку `CSC_IDENTITY_AUTO_DISCOVERY: false` и добавьте:
   ```yaml
   CSC_LINK: ${{ secrets.CSC_LINK }}
   CSC_KEY_PASSWORD: ${{ secrets.CSC_KEY_PASSWORD }}
   ```

**Никогда** не загружайте сертификат, пароли и токены в файлы репозитория — только в Secrets.

---

## 10. Сборка на своём компьютере (если всё же хочется)

Нужен [Node.js](https://nodejs.org/) 22 или новее.

```bash
npm install
npm test
npm start            # запуск из исходников
npm run dist:win     # на Windows → dist/*.exe
npm run dist:linux   # на Linux → dist/*.AppImage, dist/*.deb
```

Собирать Windows-версию лучше на Windows, Linux-версию — на Linux: кросс-сборка возможна, но требует дополнительных пакетов.

---

## 11. macOS

Официально не собирается. Если хотите портировать: добавьте в `package.json` раздел `"mac"` (цели `dmg`/`zip`), иконку `build/icon.icns`, задачу `macos-latest` в `build.yml` и, для распространения, подпись и нотаризацию Apple (секреты — только в Settings → Secrets). Pull request приветствуется — см. [CONTRIBUTING.md](../CONTRIBUTING.md).
