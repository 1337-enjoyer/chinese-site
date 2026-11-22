/* ============================================================
   Поднебесная — интерактив главной страницы
   ============================================================ */

(function () {
  "use strict";

  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  /* ---------- появление блоков при прокрутке ---------- */

  const revealItems = document.querySelectorAll(".reveal");

  if (reduceMotion || !("IntersectionObserver" in window)) {
    revealItems.forEach(function (item) {
      item.classList.add("is-visible");
    });
  } else {
    const revealObserver = new IntersectionObserver(
      function (entries, observer) {
        entries.forEach(function (entry) {
          if (!entry.isIntersecting) return;
          entry.target.classList.add("is-visible");
          observer.unobserve(entry.target);
        });
      },
      { threshold: 0.15, rootMargin: "0px 0px -60px 0px" }
    );

    revealItems.forEach(function (item, index) {
      item.style.transitionDelay = (index % 3) * 90 + "ms";
      revealObserver.observe(item);
    });
  }

  /* ---------- активный пункт меню ---------- */

  const navLinks = Array.from(document.querySelectorAll('.nav a[href^="#"]'));
  const sections = navLinks
    .map(function (link) {
      return document.querySelector(link.getAttribute("href"));
    })
    .filter(Boolean);

  if (sections.length && "IntersectionObserver" in window) {
    const setActive = function (id) {
      navLinks.forEach(function (link) {
        link.classList.toggle("is-active", link.getAttribute("href") === "#" + id);
      });
    };

    const sectionObserver = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (entry) {
          if (entry.isIntersecting) setActive(entry.target.id);
        });
      },
      { rootMargin: "-45% 0px -50% 0px", threshold: 0 }
    );

    sections.forEach(function (section) {
      sectionObserver.observe(section);
    });
  }

  /* ---------- кнопка «наверх» ---------- */

  const toTop = document.getElementById("toTop");

  if (toTop) {
    const toggleToTop = function () {
      toTop.classList.toggle("is-visible", window.scrollY > 620);
    };

    window.addEventListener("scroll", toggleToTop, { passive: true });
    toggleToTop();

    toTop.addEventListener("click", function () {
      window.scrollTo({ top: 0, behavior: reduceMotion ? "auto" : "smooth" });
    });
  }

  /* ---------- год в подвале ---------- */

  const yearEl = document.getElementById("year");
  if (yearEl) {
    yearEl.textContent = String(new Date().getFullYear());
  }

  /* ---------- форма обратной связи ---------- */

  const form = document.getElementById("contactForm");
  const note = document.getElementById("formNote");

  if (form && note) {
    const nameInput = form.elements.namedItem("name");
    const emailInput = form.elements.namedItem("email");
    const messageInput = form.elements.namedItem("message");
    const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

    const setNote = function (text, type) {
      note.textContent = text;
      note.classList.remove("is-error", "is-success");
      if (type) note.classList.add(type);
    };

    const markInvalid = function (input, invalid) {
      input.classList.toggle("is-invalid", invalid);
    };

    [nameInput, emailInput, messageInput].forEach(function (input) {
      if (!input) return;
      input.addEventListener("input", function () {
        markInvalid(input, false);
        setNote("", null);
      });
    });

    form.addEventListener("submit", function (event) {
      event.preventDefault();

      const name = (nameInput.value || "").trim();
      const email = (emailInput.value || "").trim();
      const message = (messageInput.value || "").trim();

      const nameInvalid = name.length < 2;
      const emailInvalid = !emailPattern.test(email);
      const messageInvalid = message.length < 10;

      markInvalid(nameInput, nameInvalid);
      markInvalid(emailInput, emailInvalid);
      markInvalid(messageInput, messageInvalid);

      if (nameInvalid || emailInvalid || messageInvalid) {
        setNote("Проверьте поля: имя, корректный e-mail и сообщение от 10 символов.", "is-error");
        return;
      }

      const subject = "Сообщение с сайта «Поднебесная» — " + name;
      const body = "Имя: " + name + "\nE-mail: " + email + "\n\n" + message;
      const mailto =
        "mailto:hello@podnebesnaya.ru?subject=" +
        encodeURIComponent(subject) +
        "&body=" +
        encodeURIComponent(body);

      window.location.href = mailto;
      setNote("Открываю почтовый клиент — останется только нажать «Отправить».", "is-success");
      form.reset();
    });
  }

  /* ---------- лента новостей из data/news.json ---------- */

  const MONTHS = [
    "января", "февраля", "марта", "апреля", "мая", "июня",
    "июля", "августа", "сентября", "октября", "ноября", "декабря"
  ];

  function formatNewsDate(iso) {
    const parts = String(iso || "").split("-").map(Number);

    if (parts.length !== 3 || parts.some(function (value) { return Number.isNaN(value); })) {
      return iso;
    }

    const month = MONTHS[parts[1] - 1];
    if (!month) return iso;

    return parts[2] + " " + month + " " + parts[0];
  }

  function renderNews(items) {
    const feed = document.querySelector(".news-feed");
    if (!feed) return;

    const fragment = document.createDocumentFragment();

    if (!items.length) {
      const empty = document.createElement("p");
      empty.className = "news-empty";
      empty.textContent = "Пока новостей нет.";
      fragment.appendChild(empty);
    }

    items.forEach(function (item) {
      const card = document.createElement("article");
      card.className = "news-card";

      const meta = document.createElement("div");
      meta.className = "news-meta";

      const time = document.createElement("time");
      time.dateTime = item.date;
      time.textContent = formatNewsDate(item.date);

      const tag = document.createElement("span");
      tag.className = "tag";
      tag.textContent = item.tag;

      meta.append(time, tag);

      const title = document.createElement("h3");
      title.textContent = item.title;

      const text = document.createElement("p");
      text.textContent = item.text;

      card.append(meta, title, text);
      fragment.appendChild(card);
    });

    feed.replaceChildren(fragment);
  }

  const newsFeed = document.querySelector(".news-feed");

  function loadNews() {
    if (!newsFeed || typeof window.fetch !== "function") return;
    if (location.protocol !== "http:" && location.protocol !== "https:") return;

    return fetch("/api/news", {
      headers: { Accept: "application/json" },
      cache: "no-store"
    })
      .then(function (response) {
        if (!response.ok) throw new Error("HTTP " + response.status);
        return response.json();
      })
      .then(function (items) {
        if (Array.isArray(items)) renderNews(items);
      })
      .catch(function () {
        // сервер недоступен — остаются статические карточки из index.html
      });
  }

  if (newsFeed) {
    loadNews();

    // Лента перезапрашивается при возврате на вкладку: записи, добавленные
    // в админке, появляются без перезагрузки страницы.
    let lastLoad = Date.now();

    document.addEventListener("visibilitychange", function () {
      if (document.hidden) return;
      if (Date.now() - lastLoad < 2000) return;

      lastLoad = Date.now();
      loadNews();
    });

    window.addEventListener("pageshow", function (event) {
      // страница восстановлена из кеша браузера (кнопка «назад», bfcache)
      if (event.persisted) {
        lastLoad = Date.now();
        loadNews();
      }
    });
  }
})();
