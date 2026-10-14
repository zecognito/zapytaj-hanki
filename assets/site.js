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
  // Reuse the homepage footer markup on all pages that load site.js.
  const footer = document.querySelector('footer');
  if (!footer) return;
  const nav = '<a href="/o-nas/">O nas</a><a href="/kontakt/">Kontakt</a><a href="/zrodla/">Źródła</a><a href="/prywatnosc/">Prywatność</a><a href="/regulamin/">Regulamin</a>';
  footer.className = 'hb-footer';
  footer.innerHTML = '<div class="hx-shell"><div class="hbf-main"><div class="hbf-brand"><img src="/hanka-favicon-usa.png" alt="" width="38" height="38"><div><strong>Zapytaj Hanki</strong><span>Ameryka po polsku.</span></div></div><nav aria-label="Stopka">' + nav + '</nav></div><div class="hbf-copy">© 2026 Zapytaj Hanki</div></div>';
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


// Upgrade existing editorial tables of contents into compact native dropdowns.
(() => {
  document.querySelectorAll('main.article .article-layout > article.prose nav[aria-label="Spis treści"]').forEach(nav => {
    if (nav.querySelector('details')) return;
    const heading = Array.from(nav.children).find(el => /^H[2-6]$/.test(el.tagName) && /^w tym przewodniku$/i.test(el.textContent.trim()));
    const list = Array.from(nav.children).find(el => el.tagName === 'OL');
    if (!heading || !list) return;
    const details = document.createElement('details');
    details.className = 'guide-toc';
    const summary = document.createElement('summary');
    summary.textContent = heading.textContent.trim();
    details.append(summary, list);
    heading.remove();
    nav.append(details);
    nav.classList.add('guide-toc-container');
    nav.addEventListener('click', event => {
      if (event.target.closest('a[href^="#"]')) details.open = false;
    });
  });
})();

// Accessible, automatically generated table of contents for substantial guides.
(() => {
  const article = document.querySelector('main.article .article-layout > article.prose');
  if (!article || article.querySelector('.guide-toc')) return;
  // Respect an editorially authored table of contents. Never show two.
  if (Array.from(article.querySelectorAll('h2, h3, summary')).some(h => /^w tym przewodniku\s*$/i.test(h.textContent.trim()))) return;
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


/* State article navigation: portal the menu outside legacy positioned ancestors. */
(() => {
  const header = document.querySelector('header.topbar');
  const nav = header?.querySelector('nav.zh-home-nav-test');
  if (!nav) return;
  const mobile = () => window.matchMedia('(max-width: 820px)').matches;
  const parent = nav.parentNode;
  const anchor = document.createComment('state guide nav original position');
  parent.insertBefore(anchor,nav);
  const props = ['color','font-size','font-weight','position','inset','left','right','top','width','max-width','min-width','transform','display','flex-direction','align-items','grid-template-columns','gap','margin','padding','border','border-radius','background','box-shadow','z-index','box-sizing','max-height','overflow-y','overflow-x'];
  const apply = () => {
    if (!mobile()) {
      if (nav.parentNode !== parent) parent.insertBefore(nav,anchor.nextSibling);
      for (const prop of props) nav.style.removeProperty(prop);
      return;
    }
    if (nav.parentNode !== document.body) document.body.appendChild(nav);
    const open = nav.classList.contains('is-open');
    const bottom = Math.max(0,Math.round(header.getBoundingClientRect().bottom));
    const values = {
      color:'#fff','font-size':'16px','font-weight':'700',position:'fixed',inset:'auto',left:'auto',right:'16px',top:bottom+'px',
      width:'min(330px, calc(100vw - 32px))','max-width':'calc(100vw - 32px)',
      'min-width':'0',transform:'none',display:open?'flex':'none',
      'flex-direction':'column','align-items':'stretch','grid-template-columns':'none',
      gap:'0',margin:'0',padding:'8px 14px',border:'1px solid #45484e',
      'border-radius':'0',background:'#292c30','box-shadow':'0 18px 40px #0008',
      'z-index':'2147483000','box-sizing':'border-box',
      'max-height':Math.max(120,window.innerHeight-bottom-12)+'px',
      'overflow-y':'auto','overflow-x':'hidden'
    };
    for(const [prop,value] of Object.entries(values)) nav.style.setProperty(prop,value,'important');
  };
  const style = document.createElement('style');
  style.textContent = '@media(max-width:820px){body>nav.zh-home-nav-test{visibility:visible!important;opacity:1!important}body>nav.zh-home-nav-test>a{display:flex!important;align-items:center!important;justify-content:space-between!important;position:relative!important;min-height:48px!important;padding:12px 12px!important;margin:0!important;width:100%!important;box-sizing:border-box!important;background:#292c30!important;color:#fff!important;border:0!important;border-bottom:1px solid #45484e!important;border-radius:0!important;text-decoration:none!important;font-weight:750!important;font-size:16px!important;transform:none!important}body>nav.zh-home-nav-test>a:before{content:none!important}body>nav.zh-home-nav-test>a:after{content:"→"!important;position:static!important;color:#ed5f91!important;background:none!important}body>nav.zh-home-nav-test>a.zh-all-topics{color:#ed5f91!important}}';
  document.head.appendChild(style);
  new MutationObserver(apply).observe(nav,{attributes:true,attributeFilter:['class']});
  window.addEventListener('resize',apply,{passive:true});
  window.addEventListener('scroll',()=>{if(nav.classList.contains('is-open'))apply()},{passive:true});
  apply();
})();

/* Charcoal site-wide rollout. Homepage and approved pilot already own their styles. */
(() => {
  const path = location.pathname.replace(/\/+/g, '/');
  if (path === '/' || path === '/index.html' || path === '/pieniadze/credit-score/' || path === '/pieniadze/credit-score/index.html') return;
  const header = document.querySelector('header.topbar,header.site-header');
  if (!header) return;
  const brand = header.querySelector('a.brand');
  if (brand) {
    brand.classList.add('zh-global-brand');
    brand.setAttribute('aria-label', 'Zapytaj Hanki — strona główna');
    brand.replaceChildren();
    const title = document.createElement('span');
    title.append('Zapytaj ');
    const pink = document.createElement('b');
    pink.append('Hanki');
    const heart = document.createElement('span');
    heart.textContent = '♥';
    heart.setAttribute('aria-hidden','true');
    pink.append(heart);
    title.append(pink);
    const tagline = document.createElement('small');
    tagline.textContent = 'AMERYKA PO POLSKU';
    brand.append(title,tagline);
  }
  const sheet = document.createElement('link');
  sheet.rel = 'stylesheet';
  sheet.href = '/assets/hanka-charcoal-theme.css?v=20261012-v2';
  document.head.append(sheet);
})();

// Floating Hanka chat launcher v1
(() => {const install=()=>{if(document.querySelector('.zh-chat-float'))return;const a=document.createElement('a');a.className='zh-chat-float';a.href='https://hanka.zapytajhanki.com/';a.setAttribute('aria-label','Porozmawiaj z Hanką AI');a.title='Zapytaj Hankę';const img=document.createElement('img');img.src='/hanka-favicon-usa.png';img.alt='';img.width=60;img.height=60;a.appendChild(img);document.body.appendChild(a)};if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',install,{once:true});else install()})();

/* Reversible social links in shared footer */
(()=>{const install=()=>{const footer=document.querySelector('footer');if(!footer||footer.querySelector('.zh-social-footer-icons')||footer.querySelector('.zh-footer-social'))return;const bar=document.createElement('div');bar.className='zh-social-footer-icons';bar.style.cssText='display:flex;justify-content:center;align-items:center;gap:18px;margin:12px auto';bar.setAttribute('aria-label','Obserwuj nas w social mediach');const items=[['Facebook','https://www.facebook.com/zapytajhanki','<path fill="currentColor" d="M22 12a10 10 0 1 0-11.56 9.88v-6.99H7.9V12h2.54V9.8c0-2.5 1.49-3.89 3.77-3.89 1.09 0 2.23.19 2.23.19v2.46h-1.26c-1.24 0-1.63.77-1.63 1.56V12h2.78l-.44 2.89h-2.34v6.99A10 10 0 0 0 22 12Z"/>'],['Instagram','https://www.instagram.com/zapytajhanki/','<rect x="2" y="2" width="20" height="20" rx="5"/><circle cx="12" cy="12" r="4"/><circle cx="17.5" cy="6.5" r="1" fill="currentColor" stroke="none"/>']];for(const [name,url,shape] of items){const a=document.createElement('a');a.href=url;a.target='_blank';a.rel='noopener noreferrer';a.title=name;a.setAttribute('aria-label',name+' — Zapytaj Hanki');a.style.cssText='color:#f17ca9;display:inline-flex;align-items:center;justify-content:center;width:26px;height:26px';a.innerHTML='<svg aria-hidden="true" width="22" height="22" viewBox="0 0 24 24" '+(name==='Instagram'?'fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"':'')+'>'+shape+'</svg>';bar.appendChild(a)}const copy=footer.querySelector('.zh-footer-copy,.hbf-copy,.footer-bottom');if(copy&&copy.parentNode)copy.parentNode.insertBefore(bar,copy);else footer.appendChild(bar)};if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',install,{once:true});else install()})();
