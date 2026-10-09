(() => {
  const button = document.querySelector('.menu');
  const nav = document.querySelector('.links');
  if (!button || !nav) return;

  const close = () => {
    nav.classList.remove('is-open');
    button.setAttribute('aria-expanded', 'false');
    button.textContent = 'Menu';
  };

  button.addEventListener('click', () => {
    const open = !nav.classList.contains('is-open');
    nav.classList.toggle('is-open', open);
    button.setAttribute('aria-expanded', String(open));
    button.textContent = open ? 'Zamknij' : 'Menu';
  });

  nav.addEventListener('click', (event) => {
    if (event.target.closest('a')) close();
  });

  document.addEventListener('pointerdown', (event) => {
    if (nav.classList.contains('is-open') && !nav.contains(event.target) && !button.contains(event.target)) close();
  });

  let lastScrollY = scrollY;
  addEventListener('scroll', () => {
    if (nav.classList.contains('is-open') && Math.abs(scrollY - lastScrollY) > 8) close();
    lastScrollY = scrollY;
  }, { passive: true });

  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') close();
  });

  addEventListener('resize', () => {
    if (innerWidth > 820) close();
  });
})();

(() => {
  const addDisclaimer = () => {
  const pathsRequiringDisclaimer = new Set([
    '/dom/closing-costs/',
    '/dom/down-payment/',
    '/dom/escrow/',
    '/dom/mortgage/',
    '/dom/pmi/',
    '/dom/preapproval/',
    '/emerytura/401k/',
    '/emerytura/polska-usa/',
    '/emerytura/roth-ira/',
    '/emerytura/social-security/',
    '/emerytura/social-security-credits/',
    '/illinois/podatek-dochodowy/',
    '/illinois/property-tax/',
    '/illinois/minimum-wage/',
    '/illinois/overtime/',
    '/illinois/unemployment/',
    '/illinois/medicaid/',
    '/illinois/ubezpieczenie-samochodu/',
    '/new-york/ubezpieczenie-samochodu/',
    '/pieniadze/checking-vs-savings/',
    '/pieniadze/credit-history/',
    '/pieniadze/credit-report/',
    '/pieniadze/credit-score/',
    '/pieniadze/credit-utilization/',
    '/pieniadze/konto-bankowe/',
    '/pieniadze/pierwsza-karta-kredytowa/',
    '/pieniadze/secured-credit-card/',
    '/podatki/jak-dzialaja-podatki/',
    '/praca/overtime/',
    '/praca/w2-vs-1099/',
    '/praca/wyplata/',
    '/samochod/apr/',
    '/samochod/finansowanie/',
    '/samochod/kupno-samochodu/',
    '/samochod/leasing-vs-financing/',
    '/samochod/rodzaje-ubezpieczenia/',
    '/samochod/ubezpieczenie/'
  ]);

  const canonical = document.querySelector('link[rel="canonical"]');
  let path = location.pathname;
  if (canonical) {
    try { path = new URL(canonical.href).pathname; } catch (_) {}
  }
  if (!path.endsWith('/')) path += '/';
  if (!pathsRequiringDisclaimer.has(path)) return;

  const main = document.querySelector('main');
  if (!main || document.querySelector('.content-disclaimer')) return;

  const note = document.createElement('aside');
  note.className = 'content-disclaimer';
  note.setAttribute('aria-label', 'Informacja prawna');
  note.innerHTML = '<strong>Informacja:</strong> Ten materiał ma wyłącznie charakter informacyjny i edukacyjny. Nie stanowi indywidualnej porady finansowej, inwestycyjnej, podatkowej, prawnej ani ubezpieczeniowej. Przepisy, limity, stawki i warunki produktów mogą się zmieniać. Przed podjęciem decyzji sprawdź aktualne źródła urzędowe, dokumenty produktu i — gdy sytuacja tego wymaga — skonsultuj się z odpowiednio licencjonowanym specjalistą.';
  main.insertAdjacentElement('afterend', note);
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', addDisclaimer, { once: true });
  } else {
    addDisclaimer();
  }
})();


(() => {
  const footer = document.querySelector('footer.footer');
  if (!footer || footer.querySelector('.footer-trust')) return;

  // Some pages already include the approved trust links as static footer markup.
  // Treat that existing block as authoritative instead of injecting a duplicate.
  const trustPaths = ['/o-nas/', '/kontakt/', '/zrodla/', '/prywatnosc/'];
  const existingTrustLinks = Array.from(footer.querySelectorAll('a[href]'));
  const hasStaticTrustLinks = trustPaths.every((path) =>
    existingTrustLinks.some((link) => {
      try { return new URL(link.href, location.origin).pathname === path; } catch (_) { return false; }
    })
  );
  if (hasStaticTrustLinks) {
    const hasTerms = existingTrustLinks.some((link) => { try { return new URL(link.href, location.origin).pathname === '/regulamin/'; } catch (_) { return false; } });
    if (!hasTerms) footer.querySelector('.wrap')?.insertAdjacentHTML('beforeend', ' · <a href="/regulamin/">Regulamin</a>');
    return;
  }

  const wrap = footer.querySelector('.wrap');
  if (!wrap) return;
  const nav = document.createElement('div');
  nav.className = 'footer-trust';
  nav.setAttribute('aria-label', 'Informacje o serwisie');
  nav.innerHTML = '<a href="/o-nas/">O nas</a><span aria-hidden="true">·</span><a href="/kontakt/">Kontakt</a><span aria-hidden="true">·</span><a href="/zrodla/">Źródła</a><span aria-hidden="true">·</span><a href="/prywatnosc/">Prywatność</a><span aria-hidden="true">·</span><a href="/regulamin/">Regulamin</a>';
  wrap.appendChild(nav);
})();


// Zapytaj Hanki favicon — use a new URL to bypass stale browser favicon caches.
(() => {
  const href = '/hanka-favicon.png';
  let icon = document.querySelector('link[rel~="icon"]');
  if (!icon) {
    icon = document.createElement('link');
    icon.rel = 'icon';
    document.head.appendChild(icon);
  }
  icon.type = 'image/png';
  icon.href = href;
})();


// Accessible, automatically generated table of contents for substantial guides.
(() => {
  const article = document.querySelector('main.article .article-layout > article.prose');
  if (!article || article.querySelector('.guide-toc')) return;
  const headings = Array.from(article.querySelectorAll('h2')).filter(h =>
    !h.closest('.answer, .summary, .sources, .related, .warning, .guide-toc') &&
    !/^powiązane przewodniki$/i.test(h.textContent.trim())
  );
  if (headings.length < 4) return;
  const toc = document.createElement('details');
  toc.className = 'guide-toc';
  const summary = document.createElement('summary');
  summary.textContent = 'W tym przewodniku';
  toc.appendChild(summary);
  const list = document.createElement('ol');
  headings.forEach((heading, i) => {
    if (!heading.id) {
      let id = 'sekcja-' + (i + 1);
      while (document.getElementById(id)) id += '-a';
      heading.id = id;
    }
    const item = document.createElement('li');
    const link = document.createElement('a');
    link.href = '#' + heading.id;
    link.textContent = heading.textContent.trim();
    item.appendChild(link);
    list.appendChild(item);
  });
  toc.appendChild(list);
  const anchor = article.querySelector('.summary') || article.querySelector('.answer');
  if (anchor) anchor.insertAdjacentElement('afterend', toc);
  else article.prepend(toc);
  toc.addEventListener('click', event => {
    if (event.target.closest('a[href^="#"]')) toc.open = false;
  });
})();
