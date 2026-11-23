# Поднебесная — сайт-визитка

Одностраничный сайт-визитка о Китае: баннер, блок «О сайте», лента новостей
со скроллингом, информация об авторе и контакты. Форум сообщества работает
на NodeBB и запускается рядом с сайтом через Docker Compose вместе с MongoDB.
Версия только для десктопа.

## Структура проекта

```text
chinese-site/
├── public/                    # всё, что отдаётся браузеру
│   ├── index.html             # главная страница
│   ├── admin.html             # страница админки
│   ├── forum.html             # редирект на /forum/
│   ├── css/
│   │   ├── styles.css         # общие стили сайта
│   │   └── admin.css          # стили админки
│   └── js/
│       ├── main.js            # интерактив главной
│       └── admin.js           # логика админки
├── data/
│   └── news.json              # данные ленты новостей
├── forum/
│   └── mongo-init/
│       └── 01-nodebb-user.js  # пользователь MongoDB для NodeBB
├── docker-compose.yml         # NodeBB + MongoDB
├── .env.example               # пароли и адрес форума
├── server.js                  # статика + API + прокси форума
└── README.md
```

Сервер раздаёт статику из `public/`, поэтому в браузере адреса остаются
прежними: `/`, `/admin.html`, `/forum.html`, а стили и скрипты подключаются
из `css/` и `js/` соответственно. Форум доступен по адресу `/forum/`:
`server.js` проксирует эти запросы (включая WebSocket) на NodeBB.

## Состав

| Файл | Назначение |
| --- | --- |
| `public/index.html` | Главная страница со всеми секциями |
| `public/css/styles.css` | Все стили, палитра и типографика |
| `public/js/main.js` | Анимации появления, активное меню, форма, кнопка «наверх», загрузка новостей |
| `public/forum.html` | Редирект на работающий форум `/forum/` |
| `data/news.json` | Лента новостей — единственный источник данных для главной |
| `server.js` | Статика из `public/` + API новостей + вход в админку + прокси форума |
| `public/admin.html` | Страница админки (вход по паролю) |
| `public/css/admin.css` | Стили админки |
| `public/js/admin.js` | Логика админки: вход, добавление и удаление новостей |
| `docker-compose.yml` | NodeBB, MongoDB и одноразовая установка форума |
| `.env.example` | Переменные окружения для Docker Compose |
| `forum/mongo-init/01-nodebb-user.js` | Создание пользователя MongoDB для NodeBB |

Сам сайт по-прежнему без внешних зависимостей: сервер работает на встроенном
модуле `http`, устанавливать пакеты не нужно. Шрифты подключаются с Google
Fonts, при отсутствии сети используется системный fallback. Форум — отдельный
сервис: NodeBB и MongoDB запускаются в Docker (см. раздел «Форум NodeBB и
MongoDB»).

## Запуск

1. Поднимите форум и MongoDB (нужен Docker Desktop):

   ```bash
   docker compose up -d
   ```

   Первый запуск занимает несколько минут: NodeBB устанавливается и собирает
   ассеты. Прогресс видно в `docker compose logs -f nodebb`.

2. Запустите сайт (нужен Node.js 18 или новее):

   ```bash
   node server.js
   ```

После этого:

- сайт — `http://localhost:8000`;
- форум — `http://localhost:8000/forum/`;
- админка сайта — `http://localhost:8000/admin.html`;
- админка форума — `http://localhost:8000/forum/admin`;
- пароль админки сайта по умолчанию — `admin123` (обязательно смените,
  см. раздел «Админка»);
- логин и пароль администратора форума — из `.env` (по умолчанию `admin` /
  `Podnebesnaya-Forum-2026!`).

Порт сайта можно изменить переменной `PORT`:

```bash
set PORT=8080 && node server.js
```

При смене порта обновите `FORUM_PUBLIC_URL` в `.env` до первого запуска
форума. Если нужен только сайт без форума, достаточно `node server.js`:
ссылки на `/forum/` будут возвращать `502`, пока NodeBB не запущен.

Если нужна только статическая версия без админки, достаточно открыть
`public/index.html` или поднять любой статический сервер из папки `public`
(`python -m http.server 8000 --directory public`).
В этом случае на главной останутся карточки, встроенные в HTML, изменения
через админку работать не будут, а форум будет недоступен.

## Структура главной

1. **Баннер** — SVG-пейзаж с горами, солнцем и туманом, заголовок, кнопки
   и три показателя.
2. **О сайте** (`#about`) — три карточки: язык, культура, практика.
3. **Лента новостей** (`#news`) — блок фиксированной высоты с собственной
   прокруткой; слева «прилипающий» заголовок раздела.
4. **Об авторе** (`#author`) — портрет-плейсхолдер, биография, факты, теги.
5. **Контакты** (`#contacts`) — карточки контактов и форма, которая
   формирует письмо через `mailto:`.
6. **Подвал** — навигация и кнопка «наверх».

## Что заменить на своё

- **Тексты и имя** — `public/index.html`, блоки `#about`, `#author`, `#contacts`,
  а также подвал.
- **Контакты** — e-mail, Telegram, WeChat в `#contacts` и в `public/js/main.js`
  (адрес в `mailto:`).
- **Новости** — через админку `http://localhost:8000/admin.html` (записи
  сохраняются в `data/news.json`). Карточки в `public/index.html` — статический
  fallback на случай, если сайт открыт без сервера.
- **Фото автора** — в `public/css/styles.css` у класса `.author-photo`
  раскомментируйте и настройте:

  ```css
  background-image: url("img/author.jpg");
  background-size: cover;
  background-position: center;
  ```

  После этого можно скрыть `.author-glyph` и `.author-photo-hint`.
- **Баннер** — замените инлайн-SVG `.hero-art` на своё изображение:
  `<img src="img/banner.jpg" alt="">` внутри `.hero-media` либо задайте
  `background-image` для `.hero`.
- **Палитра** — переменные `--gold`, `--bg`, `--text` и другие в начале
  `public/css/styles.css`.

## Лента новостей

Данные хранятся в `data/news.json` — массив объектов:

```json
{
  "id": "n-hsk-4-0",
  "date": "2026-11-18",
  "tag": "Язык",
  "title": "HSK 4.0: что меняется в экзамене",
  "text": "Короткое описание заметки."
}
```

При загрузке главной `public/js/main.js` запрашивает `GET /api/news`, сортирует
записи по дате (сначала новые) и перерисовывает `.news-feed`. Если сервер
недоступен (например, страница открыта через `file://`), остаются статические
карточки из `public/index.html`.

Прокрутка реализована на CSS: `.news-feed` имеет `max-height: 640px`
и `overflow-y: auto`, плюс кастомный скроллбар. Чтобы изменить высоту,
поправьте `max-height` в `public/css/styles.css`. Количество новостей
не ограничено — лента растёт вниз внутри блока.

## Админка

`public/admin.html` позволяет войти по паролю, добавлять и удалять новости.
Данные пишутся в `data/news.json` атомарно (через временный файл), поэтому
ленту можно править и вручную.

### Пароль

Пароль задаётся переменной окружения `ADMIN_PASSWORD` при запуске сервера.

Windows (cmd):

```bash
set ADMIN_PASSWORD=мой-сложный-пароль && node server.js
```

PowerShell:

```powershell
$env:ADMIN_PASSWORD="мой-сложный-пароль"; node server.js
```

Linux/macOS:

```bash
ADMIN_PASSWORD="мой-сложный-пароль" node server.js
```

Если переменная не задана, используется `admin123` — это только для локальной
разработки. Сессии живут 4 часа и хранятся в памяти процесса (после
перезапуска сервера нужно войти заново). После 8 неудачных попыток входа
с одного адреса вход блокируется на 10 минут.

### API

| Метод | Адрес | Доступ | Назначение |
| --- | --- | --- | --- |
| `GET` | `/api/news` | публично | список новостей |
| `POST` | `/api/login` | публично | вход, `{ "password": "…" }` |
| `POST` | `/api/logout` | сессия | выход |
| `GET` | `/api/session` | публично | проверка сессии |
| `POST` | `/api/news` | сессия | добавить запись |
| `DELETE` | `/api/news/:id` | сессия | удалить запись |

Авторизация — HttpOnly-cookie `admin_session` с `SameSite=Strict`. Для
публикации в интернете обязательно используйте HTTPS и reverse-proxy
(nginx, Caddy): сервер рассчитан на локальный запуск и сам TLS не терминирует.

## Форум NodeBB и MongoDB

Форум вынесен в отдельный сервис: NodeBB и MongoDB запускаются в Docker,
а `server.js` проксирует запросы `/forum/*` (включая WebSocket Socket.IO)
на NodeBB. Ссылки на сайте остаются относительными — форум выглядит частью
того же сайта и работает на том же домене.

### Состав

| Сервис | Образ | Назначение |
| --- | --- | --- |
| `mongo` | `mongo:7` | база данных NodeBB |
| `nodebb` | `ghcr.io/nodebb/nodebb:latest` | форум; при первом старте сам выполняет установку |

При первом запуске контейнер `nodebb` неинтерактивно устанавливает NodeBB
(создаёт `config.json` и администратора, наполняет базу, собирает ассеты),
а затем запускает форум. Повторно установка не выполняется, пока существует
том `nodebb-config`.

Данные хранятся в именованных томах Docker: `mongo-data` (база),
`nodebb-config` (`config.json`), `nodebb-modules`, `nodebb-build`,
`nodebb-uploads` (вложения). При `docker compose down` тома сохраняются.

### Переменные окружения

Скопируйте `.env.example` в `.env` и смените пароли:

```bash
copy .env.example .env
```

| Переменная | По умолчанию | Назначение |
| --- | --- | --- |
| `FORUM_PUBLIC_URL` | `http://localhost:8000/forum` | публичный адрес форума |
| `MONGO_ROOT_USERNAME` / `MONGO_ROOT_PASSWORD` | `root` / `rootpass` | суперпользователь MongoDB |
| `NODEBB_DB_NAME` | `nodebb` | имя базы данных |
| `NODEBB_DB_USER` / `NODEBB_DB_PASSWORD` | `nodebb` / `nodebbpass` | пользователь БД для NodeBB |
| `NODEBB_ADMIN_USERNAME` | `admin` | логин администратора форума |
| `NODEBB_ADMIN_PASSWORD` | `Podnebesnaya-Forum-2026!` | пароль администратора |
| `NODEBB_ADMIN_EMAIL` | `admin@example.com` | e-mail администратора |

`FORUM_PUBLIC_URL` записывается в `config.json` NodeBB при первой установке
и должен совпадать с адресом сайта. Если меняете `PORT` в `server.js`,
задайте новый адрес до первого запуска форума.

### Управление

```bash
docker compose up -d        # запустить MongoDB и NodeBB
docker compose logs -f nodebb
docker compose restart nodebb
docker compose down         # остановить, данные сохраняются
docker compose down -v      # удалить контейнеры, базу и настройки
```

Первый запуск занимает несколько минут: контейнер `nodebb` устанавливает
зависимости, создаёт администратора, наполняет базу и собирает ассеты,
а затем запускает форум. Повторно установка не выполняется, пока существует
том `nodebb-config`.

### Адреса

- форум через сайт — `http://localhost:8000/forum/`;
- админка NodeBB — `http://localhost:8000/forum/admin`;
- напрямую с этой машины — `http://localhost:4567/forum/`
  (порт опубликован только на `127.0.0.1`).

Старые ссылки `forum.html` не ломаются: страница `public/forum.html`
перенаправляет на `/forum/`.

### Прокси и production

`server.js` передаёт в NodeBB заголовки `X-Forwarded-For`,
`X-Forwarded-Proto` и `X-Forwarded-Host`, а также пробрасывает
WebSocket-соединения — поэтому работают уведомления и живое обновление тем.
Если форум не запущен, `/forum/` вернёт `502` с подсказкой.

Для публикации в интернете поставьте сайт и форум за HTTPS-reverse-proxy
(nginx или Caddy), задайте `FORUM_PUBLIC_URL` с `https://` и включите
в `config.json` NodeBB `"trust_proxy": true`.

### Резервная копия

```bash
docker compose exec mongo mongodump --username root --password rootpass \
  --authenticationDatabase admin --db nodebb --archive > nodebb-backup.archive
```

Восстановление:

```bash
docker compose exec -T mongo mongorestore --username root --password rootpass \
  --authenticationDatabase admin --archive < nodebb-backup.archive
```

## Технические заметки

- Ширина контента фиксирована (`1180px`), у `body` задан `min-width: 1080px` —
  мобильной вёрстки нет по требованию.
- Плавная прокрутка и отступ под фиксированную шапку — через
  `scroll-behavior` и `scroll-padding-top`.
- При `prefers-reduced-motion: reduce` анимации отключаются.
- Форма не отправляет данные на сервер: она валидирует поля и открывает
  почтовый клиент. Для реальной отправки подключите обработчик
  (Formspree, собственный backend и т. п.) в `public/js/main.js`.
- API валидирует длину полей, ограничивает размер тела запроса (100 КБ)
  и проверяет `Origin` у изменяющих запросов. HTML в новостях не поддерживается:
  текст выводится через `textContent`, поэтому вставка скриптов невозможна.
- `data/news.json` доступен по прямому адресу — это публичные данные ленты.
  Пароль и сессии в файлах не хранятся.
- `server.js` проксирует `/forum/*` на NodeBB (`FORUM_URL`, по умолчанию
  `http://127.0.0.1:4567`) и пробрасывает WebSocket. Ссылки на главной
  ведут на `/forum/`.
- Пароли форума и MongoDB хранятся в `.env` и в томе `nodebb-config`,
  а не в репозитории. Файл `.env` не коммитьте.
