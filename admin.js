/* ============================================================
   Поднебесная — админка ленты новостей
   ============================================================ */

(function () {
  "use strict";

  const MONTHS = [
    "января", "февраля", "марта", "апреля", "мая", "июня",
    "июля", "августа", "сентября", "октября", "ноября", "декабря"
  ];

  const loginView = document.getElementById("loginView");
  const panelView = document.getElementById("panelView");
  const loginForm = document.getElementById("loginForm");
  const loginNote = document.getElementById("loginNote");
  const newsForm = document.getElementById("newsForm");
  const newsNote = document.getElementById("newsNote");
  const newsList = document.getElementById("newsList");
  const newsCount = document.getElementById("newsCount");
  const newsEmpty = document.getElementById("newsEmpty");
  const logoutBtn = document.getElementById("logoutBtn");
  const reloadBtn = document.getElementById("reloadBtn");

  /* ---------- вспомогательное ---------- */

  function formatDate(iso) {
    const parts = String(iso || "").split("-").map(Number);

    if (parts.length !== 3 || parts.some(function (value) { return Number.isNaN(value); })) {
      return iso;
    }

    const month = MONTHS[parts[1] - 1];
    if (!month) return iso;

    return parts[2] + " " + month + " " + parts[0];
  }

  function todayIso() {
    const now = new Date();
    const month = String(now.getMonth() + 1).padStart(2, "0");
    const day = String(now.getDate()).padStart(2, "0");
    return now.getFullYear() + "-" + month + "-" + day;
  }

  function setNote(element, text, type) {
    if (!element) return;

    element.textContent = text || "";
    element.classList.remove("is-error", "is-success");

    if (type) element.classList.add(type);
  }

  async function api(path, options) {
    const opts = Object.assign(
      { method: "GET", credentials: "same-origin", cache: "no-store" },
      options || {}
    );

    opts.headers = Object.assign({ Accept: "application/json" }, opts.headers || {});

    if (opts.body) {
      opts.headers["Content-Type"] = "application/json";
    }

    const response = await fetch(path, opts);
    const text = await response.text();

    let data = null;
    if (text) {
      try {
        data = JSON.parse(text);
      } catch (err) {
        data = null;
      }
    }

    if (!response.ok) {
      const error = new Error(
        (data && data.error) || "Ошибка запроса (" + response.status + ")"
      );
      error.status = response.status;
      throw error;
    }

    return data;
  }

  function handleError(error, noteElement) {
    if (error && error.status === 401) {
      showLogin("Сессия истекла — войдите снова.");
      return;
    }

    setNote(noteElement, (error && error.message) || "Не удалось выполнить запрос.", "is-error");
  }

  /* ---------- переключение экранов ---------- */

  function showLogin(message) {
    if (loginView) loginView.hidden = false;
    if (panelView) panelView.hidden = true;

    if (message) {
      setNote(loginNote, message, "is-error");
    }
  }

  function showPanel() {
    if (loginView) loginView.hidden = true;
    if (panelView) panelView.hidden = false;

    setNote(loginNote, "", null);
    loadNews();
  }

  /* ---------- список новостей ---------- */

  function renderNews(items) {
    if (!newsList) return;

    newsList.textContent = "";
    if (newsCount) newsCount.textContent = String(items.length);
    if (newsEmpty) newsEmpty.hidden = items.length > 0;

    items.forEach(function (item) {
      const row = document.createElement("li");
      row.className = "admin-item";

      const top = document.createElement("div");
      top.className = "admin-item-top";

      const body = document.createElement("div");

      const meta = document.createElement("div");
      meta.className = "news-meta";

      const time = document.createElement("time");
      time.dateTime = item.date;
      time.textContent = formatDate(item.date);

      const tag = document.createElement("span");
      tag.className = "tag";
      tag.textContent = item.tag;

      meta.append(time, tag);

      const title = document.createElement("h3");
      title.textContent = item.title;

      const text = document.createElement("p");
      text.textContent = item.text;

      body.append(meta, title, text);

      const remove = document.createElement("button");
      remove.type = "button";
      remove.className = "btn btn-ghost btn-small btn-danger admin-delete";
      remove.textContent = "Удалить";
      remove.addEventListener("click", function () {
        removeNews(item, remove);
      });

      top.append(body, remove);
      row.append(top);
      newsList.append(row);
    });
  }

  async function loadNews() {
    try {
      const items = await api("/api/news");
      renderNews(Array.isArray(items) ? items : []);
    } catch (error) {
      handleError(error, newsNote);
    }
  }

  async function removeNews(item, button) {
    const confirmed = window.confirm("Удалить запись «" + item.title + "»?");
    if (!confirmed) return;

    if (button) button.disabled = true;

    try {
      await api("/api/news/" + encodeURIComponent(item.id), { method: "DELETE" });
      await loadNews();
      setNote(newsNote, "Запись удалена.", "is-success");
    } catch (error) {
      handleError(error, newsNote);
      if (button) button.disabled = false;
    }
  }

  /* ---------- вход ---------- */

  if (loginForm) {
    loginForm.addEventListener("submit", async function (event) {
      event.preventDefault();

      const passwordInput = loginForm.elements.namedItem("password");
      const password = (passwordInput.value || "").trim();
      const submitButton = loginForm.querySelector('button[type="submit"]');

      if (!password) {
        setNote(loginNote, "Введите пароль.", "is-error");
        return;
      }

      if (submitButton) submitButton.disabled = true;
      setNote(loginNote, "Проверяю пароль…", null);

      try {
        await api("/api/login", {
          method: "POST",
          body: JSON.stringify({ password: password })
        });

        loginForm.reset();
        setNote(loginNote, "", null);
        showPanel();
      } catch (error) {
        if (error.status === 401 || error.status === 429) {
          setNote(loginNote, error.message, "is-error");
        } else {
          setNote(
            loginNote,
            "Сервер недоступен. Запустите «node server.js» и откройте http://localhost:8000/admin.html",
            "is-error"
          );
        }
      } finally {
        if (submitButton) submitButton.disabled = false;
      }
    });
  }

  /* ---------- добавление новости ---------- */

  function validateItem(item) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(item.date)) {
      return "Укажите дату в формате ГГГГ-ММ-ДД.";
    }
    if (item.tag.length < 2 || item.tag.length > 40) {
      return "Тег: от 2 до 40 символов.";
    }
    if (item.title.length < 5 || item.title.length > 160) {
      return "Заголовок: от 5 до 160 символов.";
    }
    if (item.text.length < 10 || item.text.length > 600) {
      return "Текст: от 10 до 600 символов.";
    }
    return "";
  }

  if (newsForm) {
    const dateInput = newsForm.elements.namedItem("date");
    if (dateInput && !dateInput.value) dateInput.value = todayIso();

    newsForm.addEventListener("submit", async function (event) {
      event.preventDefault();

      const item = {
        date: (newsForm.elements.namedItem("date").value || "").trim(),
        tag: (newsForm.elements.namedItem("tag").value || "").trim(),
        title: (newsForm.elements.namedItem("title").value || "").trim(),
        text: (newsForm.elements.namedItem("text").value || "").trim()
      };

      const problem = validateItem(item);
      if (problem) {
        setNote(newsNote, problem, "is-error");
        return;
      }

      const submitButton = newsForm.querySelector('button[type="submit"]');
      if (submitButton) submitButton.disabled = true;
      setNote(newsNote, "Сохраняю…", null);

      try {
        await api("/api/news", {
          method: "POST",
          body: JSON.stringify(item)
        });

        newsForm.reset();
        if (dateInput) dateInput.value = todayIso();

        await loadNews();
        setNote(newsNote, "Запись добавлена — она уже видна на главной.", "is-success");
      } catch (error) {
        handleError(error, newsNote);
      } finally {
        if (submitButton) submitButton.disabled = false;
      }
    });
  }

  /* ---------- прочее ---------- */

  if (logoutBtn) {
    logoutBtn.addEventListener("click", async function () {
      try {
        await api("/api/logout", { method: "POST" });
      } catch (error) {
        // сессия могла уже истечь — всё равно показываем форму входа
      }

      showLogin("Вы вышли из админки.");
    });
  }

  if (reloadBtn) {
    reloadBtn.addEventListener("click", async function () {
      reloadBtn.disabled = true;
      await loadNews();
      reloadBtn.disabled = false;
    });
  }

  /* ---------- старт ---------- */

  async function init() {
    try {
      const data = await api("/api/session");

      if (data && data.authorized) {
        showPanel();
      } else {
        showLogin();
      }
    } catch (error) {
      showLogin(
        "Сервер не отвечает. Запустите «node server.js» и откройте http://localhost:8000/admin.html"
      );
    }
  }

  init();
})();
