// SEO: shared helpers for static pages and client-rendered detail views.
(function () {
  const DEFAULT_KEYWORDS = 'karate Riga, karate bērniem Riga, karate treniņi, cīņas māksla Latvija, sporta klubs Rīga';
  const DEFAULT_OG_IMAGE = 'https://ippon.lv/uploads/footer/footer.png';

  function ensureMeta(attr, key) {
    let node = document.head.querySelector(`meta[${attr}="${key}"]`);
    if (!node) {
      node = document.createElement('meta');
      node.setAttribute(attr, key);
      document.head.appendChild(node);
    }
    return node;
  }

  function ensureCanonical() {
    let node = document.head.querySelector('link[rel="canonical"]');
    if (!node) {
      node = document.createElement('link');
      node.setAttribute('rel', 'canonical');
      document.head.appendChild(node);
    }
    return node;
  }

  function toAbsoluteUrl(url) {
    if (!url) return '';
    try {
      return new URL(url, window.location.origin).toString();
    } catch {
      return url;
    }
  }

  function normalizeText(value) {
    return String(value || '').replace(/\s+/g, ' ').trim();
  }

  function setMetaContent(attr, key, value) {
    if (!value) return;
    ensureMeta(attr, key).setAttribute('content', value);
  }

  // SEO: keep title/meta/OG in sync when a client-rendered detail page loads content.
  function update(config) {
    const title = normalizeText(config && config.title);
    const description = normalizeText(config && config.description);
    const keywords = normalizeText((config && config.keywords) || DEFAULT_KEYWORDS);
    const image = toAbsoluteUrl((config && config.image) || DEFAULT_OG_IMAGE);
    const canonical = toAbsoluteUrl((config && config.url) || window.location.href);

    if (title) {
      document.title = title;
      setMetaContent('property', 'og:title', title);
    }
    if (description) {
      setMetaContent('name', 'description', description);
      setMetaContent('property', 'og:description', description);
    }
    setMetaContent('name', 'keywords', keywords);
    setMetaContent('property', 'og:image', image);
    setMetaContent('property', 'og:type', 'website');
    setMetaContent('property', 'og:url', canonical);
    ensureCanonical().setAttribute('href', canonical);
  }

  function guessAltText(img) {
    const src = img.getAttribute('src') || '';
    const heading = normalizeText((img.closest('article, section, main, div') || document).querySelector('h1, h2')?.textContent);
    if (/\/uploads\/footer\//i.test(src)) {
      return 'IPPON.LV sporta klubs Rīga logo';
    }
    if (heading) {
      return `${heading} attēls`;
    }
    const fileName = src.split('/').pop() || '';
    const stem = normalizeText(fileName.replace(/\.[a-z0-9]+$/i, '').replace(/[-_]+/g, ' '));
    if (stem) {
      return `${stem} - IPPON.LV`;
    }
    return `${normalizeText(document.title || 'IPPON.LV')} attēls`;
  }

  // SEO: fill empty alt attributes without changing page logic or markup structure.
  function enhanceImageAlts(root) {
    (root || document).querySelectorAll('img').forEach((img) => {
      const currentAlt = img.getAttribute('alt');
      if (currentAlt != null && currentAlt.trim()) return;
      img.setAttribute('alt', guessAltText(img));
    });
  }

  // SEO: lightweight heading audit for public pages.
  function auditHeadings() {
    const h1Count = document.querySelectorAll('h1').length;
    if (h1Count !== 1) {
      console.warn(`[seo] Expected 1 h1, found ${h1Count} on ${window.location.pathname}`);
    }
  }

  document.addEventListener('DOMContentLoaded', () => {
    enhanceImageAlts(document);
    auditHeadings();
  });

  const observer = new MutationObserver((mutations) => {
    for (const mutation of mutations) {
      if (mutation.type === 'childList' && mutation.addedNodes.length) {
        mutation.addedNodes.forEach((node) => {
          if (node && node.nodeType === 1) {
            enhanceImageAlts(node);
          }
        });
      }
    }
  });

  if (document.documentElement) {
    observer.observe(document.documentElement, { childList: true, subtree: true });
  }

  window.__ipponSeo = {
    update
  };
})();
