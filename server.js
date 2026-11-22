/* ============================================================
   Поднебесная — локальный сервер
   Статика + API для ленты новостей + вход в админку.
   Без внешних зависимостей: node server.js
   ============================================================ */

"use strict";

const http = require("http");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const ROOT = __dirname;
const DATA_FILE = path.join(ROOT, "data", "news.json");
const PORT = Number(process.env.PORT) || 8000;
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "admin123";
const SESSION_TTL = 4 * 60 * 60 * 1000; // 4 часа
const LOGIN_WINDOW = 10 * 60 * 1000; // окно ограничения попыток
const LOGIN_LIMIT = 8; // попыток за окно
const MAX_BODY = 100 * 1024; // 100 КБ

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".gif": "image/gif",
  ".ico": "image/x-icon",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
  ".txt": "text/plain; charset=utf-8",
  ".map": "application/json; charset=utf-8"
};

const sessions = new Map(); // token -> expires
const loginAttempts = new Map(); // ip -> { count, first }

class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

/* ---------- ответы ---------- */

function sendJson(res, status, payload, headers) {
  const body = JSON.stringify(payload);
  res.writeHead(
    status,
    Object.assign(
      {
        "Content-Type": "application/json; charset=utf-8",
        "Content-Length": Buffer.byteLength(body),
        "Cache-Control": "no-store"
      },
      headers || {}
    )
  );
  res.end(body);
}

function sendText(res, status, text, headers) {
  res.writeHead(
    status,
    Object.assign(
      {
        "Content-Type": "text/plain; charset=utf-8",
        "Content-Length": Buffer.byteLength(text)
      },
      headers || {}
    )
  );
  res.end(text);
}

/* ---------- работа с новостями ---------- */

function normalizeNews(item) {
  return {
    id: String(item && item.id ? item.id : ""),
    date: String(item && item.date ? item.date : ""),
    tag: String(item && item.tag ? item.tag : ""),
    title: String(item && item.title ? item.title : ""),
    text: String(item && item.text ? item.text : "")
  };
}

function readNews() {
  let raw;
  try {
    raw = fs.readFileSync(DATA_FILE, "utf8");
  } catch (err) {
    if (err.code === "ENOENT") return [];
    throw err;
  }

  let data;
  try {
    data = JSON.parse(raw);
  } catch (err) {
    throw new HttpError(500, "Файл data/news.json повреждён");
  }

  if (!Array.isArray(data)) {
    throw new HttpError(500, "Файл data/news.json должен содержать массив");
  }

  return data
    .filter(function (item) {
      return item && typeof item === "object";
    })
    .map(normalizeNews)
    .filter(function (item) {
      return item.id && item.date && item.title;
    });
}

function saveNews(news) {
  fs.mkdirSync(path.dirname(DATA_FILE), { recursive: true });
  const tmp = DATA_FILE + ".tmp";
  fs.writeFileSync(tmp, JSON.stringify(news, null, 2) + "\n", "utf8");
  fs.renameSync(tmp, DATA_FILE);
}

function sortNews(news) {
  return news.slice().sort(function (a, b) {
    if (a.date === b.date) return 0;
    return a.date < b.date ? 1 : -1;
  });
}

function createId() {
  return Date.now().toString(36) + "-" + crypto.randomBytes(4).toString("hex");
}

function validateNews(input) {
  const date = String(input.date || "").trim();
  const tag = String(input.tag || "").trim();
  const title = String(input.title || "").trim();
  const text = String(input.text || "").trim();

  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || Number.isNaN(Date.parse(date))) {
    throw new HttpError(400, "Укажите дату в формате ГГГГ-ММ-ДД");
  }
  if (tag.length < 2 || tag.length > 40) {
    throw new HttpError(400, "Тег: от 2 до 40 символов");
  }
  if (title.length < 5 || title.length > 160) {
    throw new HttpError(400, "Заголовок: от 5 до 160 символов");
  }
  if (text.length < 10 || text.length > 600) {
    throw new HttpError(400, "Текст: от 10 до 600 символов");
  }

  return { date: date, tag: tag, title: title, text: text };
}

/* ---------- авторизация ---------- */

function safeEqual(a, b) {
  const bufA = Buffer.from(String(a), "utf8");
  const bufB = Buffer.from(String(b), "utf8");

  if (bufA.length !== bufB.length) {
    // выравниваем время сравнения для разных длин
    crypto.timingSafeEqual(bufA, bufA);
    return false;
  }

  return crypto.timingSafeEqual(bufA, bufB);
}

function parseCookies(req) {
  const header = req.headers.cookie || "";
  const result = {};

  header.split(";").forEach(function (pair) {
    const index = pair.indexOf("=");
    if (index < 0) return;

    const key = pair.slice(0, index).trim();
    const value = pair.slice(index + 1).trim();
    if (!key) return;

    try {
      result[key] = decodeURIComponent(value);
    } catch (err) {
      result[key] = value;
    }
  });

  return result;
}

function getSessionToken(req) {
  const token = parseCookies(req).admin_session;
  if (!token) return null;

  const expires = sessions.get(token);
  if (!expires) return null;

  if (Date.now() > expires) {
    sessions.delete(token);
    return null;
  }

  return token;
}

function getIp(req) {
  return req.socket.remoteAddress || "unknown";
}

function isBlocked(ip) {
  const entry = loginAttempts.get(ip);
  if (!entry) return false;

  if (Date.now() - entry.first > LOGIN_WINDOW) {
    loginAttempts.delete(ip);
    return false;
  }

  return entry.count >= LOGIN_LIMIT;
}

function registerFailure(ip) {
  const now = Date.now();
  const entry = loginAttempts.get(ip) || { count: 0, first: now };

  if (now - entry.first > LOGIN_WINDOW) {
    entry.count = 0;
    entry.first = now;
  }

  entry.count += 1;
  loginAttempts.set(ip, entry);
}

function checkOrigin(req) {
  const origin = req.headers.origin;
  if (!origin) return;

  let host;
  try {
    host = new URL(origin).host;
  } catch (err) {
    throw new HttpError(403, "Некорректный заголовок Origin");
  }

  if (host !== req.headers.host) {
    throw new HttpError(403, "Запрос с чужого домена отклонён");
  }
}

/* ---------- тело запроса ---------- */

function readJsonBody(req) {
  return new Promise(function (resolve, reject) {
    let size = 0;
    let settled = false;
    const chunks = [];

    req.on("data", function (chunk) {
      if (settled) return;

      size += chunk.length;
      if (size > MAX_BODY) {
        settled = true;
        reject(new HttpError(413, "Слишком большой запрос"));
        return;
      }

      chunks.push(chunk);
    });

    req.on("end", function () {
      if (settled) return;
      settled = true;

      if (!chunks.length) return resolve({});

      try {
        const parsed = JSON.parse(Buffer.concat(chunks).toString("utf8"));
        if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
          return reject(new HttpError(400, "Ожидается JSON-объект"));
        }
        resolve(parsed);
      } catch (err) {
        reject(new HttpError(400, "Некорректный JSON"));
      }
    });

    req.on("error", function (err) {
      if (settled) return;
      settled = true;
      reject(err);
    });
  });
}

/* ---------- API ---------- */

async function handleApi(req, res, pathname) {
  const method = req.method || "GET";

  if (pathname === "/api/news" && method === "GET") {
    sendJson(res, 200, sortNews(readNews()));
    return;
  }

  if (pathname === "/api/news" && method === "POST") {
    checkOrigin(req);
    if (!getSessionToken(req)) throw new HttpError(401, "Требуется вход в админку");

    const body = await readJsonBody(req);
    const item = validateNews(body);
    const news = readNews();
    const created = Object.assign({ id: createId() }, item);

    news.push(created);
    saveNews(sortNews(news));

    sendJson(res, 201, created);
    return;
  }

  const deleteMatch = pathname.match(/^\/api\/news\/([^/]+)$/);
  if (deleteMatch && method === "DELETE") {
    checkOrigin(req);
    if (!getSessionToken(req)) throw new HttpError(401, "Требуется вход в админку");

    const id = decodeURIComponent(deleteMatch[1]);
    const news = readNews();
    const index = news.findIndex(function (item) {
      return item.id === id;
    });

    if (index === -1) throw new HttpError(404, "Запись не найдена");

    const removed = news.splice(index, 1)[0];
    saveNews(news);

    sendJson(res, 200, { ok: true, removed: removed });
    return;
  }

  if (pathname === "/api/login" && method === "POST") {
    checkOrigin(req);

    const ip = getIp(req);
    if (isBlocked(ip)) {
      throw new HttpError(429, "Слишком много попыток входа. Повторите через 10 минут");
    }

    const body = await readJsonBody(req);
    const password = String(body.password || "");

    if (!safeEqual(password, ADMIN_PASSWORD)) {
      registerFailure(ip);
      throw new HttpError(401, "Неверный пароль");
    }

    loginAttempts.delete(ip);

    const token = crypto.randomBytes(32).toString("hex");
    sessions.set(token, Date.now() + SESSION_TTL);

    sendJson(
      res,
      200,
      { ok: true },
      {
        "Set-Cookie":
          "admin_session=" +
          token +
          "; HttpOnly; Path=/; SameSite=Strict; Max-Age=" +
          Math.floor(SESSION_TTL / 1000)
      }
    );
    return;
  }

  if (pathname === "/api/logout" && method === "POST") {
    checkOrigin(req);

    const token = getSessionToken(req);
    if (token) sessions.delete(token);

    sendJson(
      res,
      200,
      { ok: true },
      {
        "Set-Cookie": "admin_session=; HttpOnly; Path=/; SameSite=Strict; Max-Age=0"
      }
    );
    return;
  }

  if (pathname === "/api/session" && method === "GET") {
    sendJson(res, 200, { authorized: Boolean(getSessionToken(req)) });
    return;
  }

  throw new HttpError(404, "Неизвестный метод API");
}

/* ---------- статика ---------- */

function serveStatic(req, res, pathname) {
  if (req.method !== "GET" && req.method !== "HEAD") {
    sendText(res, 405, "Метод не поддерживается", { Allow: "GET, HEAD" });
    return;
  }

  const relative = pathname === "/" ? "index.html" : pathname.replace(/^\/+/, "");
  const filePath = path.resolve(ROOT, relative);

  if (filePath !== ROOT && !filePath.startsWith(ROOT + path.sep)) {
    sendText(res, 403, "Доступ запрещён");
    return;
  }

  fs.stat(filePath, function (err, stat) {
    if (err || !stat.isFile()) {
      sendText(res, 404, "Страница не найдена");
      return;
    }

    const type = MIME[path.extname(filePath).toLowerCase()] || "application/octet-stream";

    res.writeHead(200, {
      "Content-Type": type,
      "Content-Length": stat.size,
      "Cache-Control": "no-cache"
    });

    if (req.method === "HEAD") {
      res.end();
      return;
    }

    const stream = fs.createReadStream(filePath);
    stream.on("error", function () {
      res.destroy();
    });
    stream.pipe(res);
  });
}

/* ---------- сервер ---------- */

const server = http.createServer(function (req, res) {
  let pathname;

  try {
    pathname = decodeURIComponent(new URL(req.url, "http://localhost").pathname);
  } catch (err) {
    sendText(res, 400, "Некорректный адрес");
    return;
  }

  const isApi = pathname === "/api" || pathname.startsWith("/api/");

  Promise.resolve(isApi ? handleApi(req, res, pathname) : serveStatic(req, res, pathname)).catch(
    function (err) {
      const status = err instanceof HttpError ? err.status : 500;

      if (status === 500) console.error(err);

      if (res.headersSent) {
        res.destroy();
        return;
      }

      sendJson(res, status, {
        error: err instanceof HttpError ? err.message : "Внутренняя ошибка сервера"
      });
    }
  );
});

setInterval(function () {
  const now = Date.now();

  sessions.forEach(function (expires, token) {
    if (now > expires) sessions.delete(token);
  });

  loginAttempts.forEach(function (entry, ip) {
    if (now - entry.first > LOGIN_WINDOW) loginAttempts.delete(ip);
  });
}, 60 * 1000).unref();

server.listen(PORT, function () {
  console.log("");
  console.log("  Поднебесная — сервер запущен");
  console.log("  Сайт:    http://localhost:" + PORT + "/");
  console.log("  Админка: http://localhost:" + PORT + "/admin.html");

  if (process.env.ADMIN_PASSWORD) {
    console.log("  Пароль:  из переменной окружения ADMIN_PASSWORD");
  } else {
    console.log("  Пароль:  admin123 (значение по умолчанию — смените через ADMIN_PASSWORD)");
  }

  console.log("");
});
