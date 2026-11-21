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
})();
