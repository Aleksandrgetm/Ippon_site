(function () {
  if (window.__ipponLangSwitcherInit) return;
  window.__ipponLangSwitcherInit = true;

  function setCookie(name, value, days, domain) {
    var expires = "";
    if (days) {
      var date = new Date();
      date.setTime(date.getTime() + days * 24 * 60 * 60 * 1000);
      expires = "; expires=" + date.toUTCString();
    }
    var cookie = name + "=" + value + expires + "; path=/";
    if (domain) cookie += "; domain=" + domain;
    document.cookie = cookie;
  }

  function deleteCookie(name) {
    document.cookie = name + "=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/";
    if (location.hostname.indexOf(".") > -1) {
      document.cookie = name + "=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/; domain=." + location.hostname.replace(/^www\./, "");
      document.cookie = name + "=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/; domain=" + location.hostname.replace(/^www\./, "");
    }
  }

  function getCurrentLang() {
    var m = document.cookie.match(/(?:^|;\s*)googtrans=([^;]+)/);
    if (!m) return "lv";
    var val = decodeURIComponent(m[1] || "").toLowerCase();
    if (val.indexOf("/ru") !== -1) return "ru";
    if (val.indexOf("/en") !== -1) return "en";
    return "lv";
  }

  function applyLang(lang) {
    // Clear previous values first to avoid conflicting googtrans cookies.
    deleteCookie("googtrans");

    if (lang === "lv") {
      location.reload();
      return;
    }

    var value = "/auto/" + lang;
    setCookie("googtrans", value, 365);
    if (location.hostname.indexOf(".") > -1) {
      var d = location.hostname.replace(/^www\./, "");
      setCookie("googtrans", value, 365, "." + d);
      setCookie("googtrans", value, 365, d);
    }

    setTimeout(function () {
      location.reload();
    }, 30);
  }

  
  function normalizeButtonLabels(root) {
    var buttons = (root || document).querySelectorAll('.ippon-lang-btn');
    buttons.forEach(function (b) {
      var fixed = b.getAttribute('data-fixed-label');
      if (fixed && b.textContent !== fixed) {
        b.textContent = fixed;
      }
    });
  }
function ensureTranslateElement() {
    if (!document.getElementById("google_translate_element")) {
      var hidden = document.createElement("div");
      hidden.id = "google_translate_element";
      hidden.className = "ippon-google-translate-hidden";
      document.body.appendChild(hidden);
    }
  }

  function mountSwitcher() {
    if (document.querySelector(".ippon-lang-switcher")) return;
    var mainMenu = document.querySelector(".elementor-nav-menu--main");
    var navHost =
      document.querySelector(".elementor-location-header .elementor-element-ad27a2f .elementor-nav-menu--main") ||
      document.querySelector(".elementor-location-header .elementor-nav-menu--main") ||
      null;
    if (!mainMenu || !navHost) return;

    var wrap = document.createElement("div");
    wrap.className = "ippon-lang-switcher";

    var langs = [
      { code: "lv", label: "LV" },
      { code: "ru", label: "RU" },
      { code: "en", label: "EN" }
    ];

    var current = getCurrentLang();
    langs.forEach(function (item, idx) {
      var btn = document.createElement("button");
      btn.type = "button";
      btn.className = "ippon-lang-btn notranslate" + (current === item.code ? " is-active" : "");
      btn.textContent = item.label;
      btn.setAttribute("data-fixed-label", item.label);
      btn.setAttribute("translate", "no");
      btn.setAttribute("aria-label", "Switch language to " + item.label);
      btn.addEventListener("click", function () {
        applyLang(item.code);
      });
      wrap.appendChild(btn);

      if (idx < langs.length - 1) {
        var sep = document.createElement("span");
        sep.className = "ippon-lang-sep";
        sep.textContent = "|";
        wrap.appendChild(sep);
      }
    });

    // Add compact Google Translate note near the language buttons.
    var note = document.createElement("span");
    note.className = "ippon-lang-note notranslate";
    note.textContent = "Google Translate";
    note.setAttribute("translate", "no");

    // Cleanup old mount mode (inside nav <li>) if present.
    var oldLi = document.querySelector(".ippon-lang-menu-item");
    if (oldLi && oldLi.parentElement) oldLi.parentElement.removeChild(oldLi);

    // Mount as standalone block inside main nav row to avoid affecting menu-item separators/hover.
    var host = document.createElement("div");
    host.className = "ippon-lang-host";
    host.appendChild(wrap);
    host.appendChild(note);
    navHost.appendChild(host);

    normalizeButtonLabels(host);

    var mo = new MutationObserver(function () {
      normalizeButtonLabels(host);
    });
    mo.observe(host, { childList: true, subtree: true, characterData: true });
  }

  function bindLogoHome() {
    var logoTitle = Array.from(
      document.querySelectorAll(".elementor-location-header .elementor-heading-title")
    ).find(function (el) {
      return /^ippon\./i.test((el.textContent || "").trim());
    });

    if (!logoTitle) return;

    if (logoTitle.closest("a")) {
      logoTitle.closest("a").setAttribute("href", "/");
      return;
    }

    logoTitle.style.cursor = "pointer";
    logoTitle.addEventListener("click", function () {
      window.location.href = "/";
    });
  }

  function initMobileHeader() {
    var widgets = document.querySelectorAll(".elementor-location-header .elementor-element-ad27a2f");
    if (!widgets.length) return;

    function isMobile() {
      return window.innerWidth <= 768;
    }

    widgets.forEach(function (widget) {
      if (widget.__ipponMobileHeaderInit) return;
      widget.__ipponMobileHeaderInit = true;

      var toggle = widget.querySelector(".elementor-menu-toggle");
      var dropdown = widget.querySelector(".elementor-nav-menu--dropdown.elementor-nav-menu__container");
      if (!toggle || !dropdown) return;

      var backdrop = document.createElement("button");
      backdrop.type = "button";
      backdrop.className = "ippon-mobile-backdrop";
      backdrop.setAttribute("aria-label", "Aizvert mobilo izvelni");
      widget.appendChild(backdrop);

      function setOpen(nextOpen) {
        var open = !!nextOpen && isMobile();
        widget.classList.toggle("ippon-mobile-open", open);
        toggle.setAttribute("aria-expanded", open ? "true" : "false");
        dropdown.setAttribute("aria-hidden", open ? "false" : "true");
        document.body.classList.toggle("ippon-menu-open", open);

        if (!open) {
          widget.querySelectorAll(".menu-item-has-children.ippon-submenu-open").forEach(function (item) {
            item.classList.remove("ippon-submenu-open");
            var trigger = item.querySelector(":scope > .elementor-item");
            if (trigger) trigger.setAttribute("aria-expanded", "false");
          });
        }
      }

      toggle.addEventListener("click", function (event) {
        if (!isMobile()) return;
        event.preventDefault();
        event.stopPropagation();
        setOpen(!widget.classList.contains("ippon-mobile-open"));
      });

      toggle.addEventListener("keydown", function (event) {
        if (!isMobile()) return;
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          setOpen(!widget.classList.contains("ippon-mobile-open"));
        }
      });

      backdrop.addEventListener("click", function () {
        setOpen(false);
      });

      dropdown.querySelectorAll(".menu-item-has-children").forEach(function (item) {
        var trigger = item.querySelector(":scope > .elementor-item");
        var submenu = item.querySelector(":scope > .sub-menu");
        if (!trigger || !submenu) return;

        trigger.setAttribute("aria-expanded", "false");
        trigger.addEventListener("click", function (event) {
          if (!isMobile()) return;
          var href = (trigger.getAttribute("href") || "").trim();
          if (!href || href === "#") {
            event.preventDefault();
          }
          event.stopPropagation();

          var willOpen = !item.classList.contains("ippon-submenu-open");
          item.parentElement.querySelectorAll(":scope > .menu-item-has-children.ippon-submenu-open").forEach(function (openItem) {
            if (openItem !== item) {
              openItem.classList.remove("ippon-submenu-open");
              var openTrigger = openItem.querySelector(":scope > .elementor-item");
              if (openTrigger) openTrigger.setAttribute("aria-expanded", "false");
            }
          });

          item.classList.toggle("ippon-submenu-open", willOpen);
          trigger.setAttribute("aria-expanded", willOpen ? "true" : "false");
        });
      });

      dropdown.querySelectorAll("a[href]").forEach(function (link) {
        link.addEventListener("click", function () {
          var href = (link.getAttribute("href") || "").trim();
          if (!isMobile()) return;
          if (!href || href === "#") return;
          setOpen(false);
        });
      });

      document.addEventListener("click", function (event) {
        if (!isMobile()) return;
        if (!widget.classList.contains("ippon-mobile-open")) return;
        if (widget.contains(event.target)) return;
        setOpen(false);
      });

      document.addEventListener("keydown", function (event) {
        if (event.key === "Escape") {
          setOpen(false);
        }
      });

      window.addEventListener("resize", function () {
        if (!isMobile()) {
          setOpen(false);
        }
      });
    });
  }

  window.__ipponInitGoogleTranslate = function () {
    if (window.google && window.google.translate && window.google.translate.TranslateElement) {
      new window.google.translate.TranslateElement(
        {
          pageLanguage: "lv",
          includedLanguages: "lv,ru,en",
          autoDisplay: false
        },
        "google_translate_element"
      );
    }
  };

  function loadGoogleTranslate() {
    if (document.querySelector('script[data-ippon-translate="1"]')) return;
    var s = document.createElement("script");
    s.src = "https://translate.google.com/translate_a/element.js?cb=__ipponInitGoogleTranslate";
    s.async = true;
    s.defer = true;
    s.setAttribute("data-ippon-translate", "1");
    document.head.appendChild(s);
  }

  function init() {
    ensureTranslateElement();
    mountSwitcher();
    bindLogoHome();
    initMobileHeader();
    loadGoogleTranslate();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();


