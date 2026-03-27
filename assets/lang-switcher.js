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
    var val = decodeURIComponent(m[1] || "");
    if (val.indexOf("/lv/ru") !== -1) return "ru";
    if (val.indexOf("/lv/en") !== -1) return "en";
    return "lv";
  }

  function applyLang(lang) {
    if (lang === "lv") {
      deleteCookie("googtrans");
      location.reload();
      return;
    }

    var value = "/lv/" + lang;
    setCookie("googtrans", value, 365);
    if (location.hostname.indexOf(".") > -1) {
      var d = location.hostname.replace(/^www\./, "");
      setCookie("googtrans", value, 365, "." + d);
      setCookie("googtrans", value, 365, d);
    }
    location.reload();
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
      btn.className = "ippon-lang-btn" + (current === item.code ? " is-active" : "");
      btn.textContent = item.label;
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

    // Cleanup old mount mode (inside nav <li>) if present.
    var oldLi = document.querySelector(".ippon-lang-menu-item");
    if (oldLi && oldLi.parentElement) oldLi.parentElement.removeChild(oldLi);

    // Mount as standalone block inside main nav row to avoid affecting menu-item separators/hover.
    var host = document.createElement("div");
    host.className = "ippon-lang-host";
    host.appendChild(wrap);
    navHost.appendChild(host);
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
    loadGoogleTranslate();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
