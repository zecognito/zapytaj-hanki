
// Match the existing directory notices to the dark theme without CSS overrides.
(() => {
  if (!location.pathname.startsWith('/palcem-po-mapie/')) return;
  const updateNotices = () => {
    document.querySelectorAll('div[style*="background:#fffaf8"]').forEach(notice => {
      if (!notice.textContent.trim().startsWith('Ważne:')) return;
      notice.style.background = '#292b30';
      notice.style.borderColor = '#44464d';
      notice.style.color = '#c9cbd1';
      notice.style.borderRadius = '12px';
      const heading = notice.querySelector('strong');
      if (heading) heading.style.color = '#f078a8';
      if (location.pathname.includes('/polskie-parafie/')) {
        const outdated = 'adres, godziny otwarcia i oferta mogą się zmieniać. Przed wizytą sprawdź aktualne informacje bezpośrednio na stronie sklepu lub w jego bieżących kanałach informacyjnych.';
        if (notice.textContent.includes(outdated)) {
          const textNode = [...notice.childNodes].find(n => n.nodeType === 3 && n.textContent.includes(outdated));
          if (textNode) textNode.textContent = textNode.textContent.replace(outdated, 'godziny Mszy Świętych i informacje parafialne mogą się zmieniać. Przed wizytą sprawdź aktualny porządek nabożeństw na oficjalnej stronie parafii.');
        }
      }
    });
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', updateNotices, {once:true});
  else updateNotices();
})();


// Simple hierarchy navigation: homepage keeps the full menu; hubs go home;
// guides return to their parent hub. News and recipe article templates
// already provide their own back links and do not load this script.
(() => {
  const path = location.pathname.split('/').filter(Boolean);
  if (path.length === 0) return;
  const header = document.querySelector('body > header.topbar');
  const nav = header?.querySelector('nav#siteNav');
  const button = header?.querySelector('button.menu');
  if (!header || !nav || !button) return;
  const excluded = new Set(['szukaj', 'kalkulatory']);
  if (excluded.has(path[0])) return;
  const isHub = path.length === 1;
  const isArticle = path.length >= 2 && (!!document.querySelector('main.article') || ['narzedzia', 'palcem-po-mapie', 'testy'].includes(path[0]));
  if (!isHub && !isArticle) return;
  const parent = '/' + path[0] + '/';
  const names = {
    'pieniadze':'Pieniądze','dom':'Dom','samochod':'Samochód',
    'praca':'Praca','zdrowie':'Zdrowie','dzieci-i-rodzina':'Dzieci i rodzina',
    'emerytura':'Emerytura','podatki':'Podatki','illinois':'Illinois',
    'california':'Kalifornia','new-york':'Nowy Jork','pennsylvania':'Pensylwania',
    'wisconsin':'Wisconsin','indiana':'Indiana','michigan':'Michigan',
    'ohio':'Ohio','florida':'Floryda','texas':'Teksas',
    'palcem-po-mapie':'Palcem po mapie','narzedzia':'Narzędzi Hanki','testy':'Testów obywatelskich'
  };
  const back = document.createElement('a');
  back.className = 'zh-hierarchy-back';
  back.href = isHub ? '/' : parent;
  back.textContent = isHub ? '← Wróć do strony głównej' : '← Wróć do ' + (names[path[0]] || path[0].replace(/-/g, ' '));
  back.setAttribute('aria-label', back.textContent);
  const css = document.createElement('style');
  css.textContent = '.topbar .zh-hierarchy-back{display:inline-flex!important;align-items:center!important;margin-left:auto!important;padding:9px 0!important;color:#f078a8!important;text-decoration:none!important;font-size:14px!important;font-weight:650!important;line-height:1.3!important;white-space:nowrap!important;background:none!important;border:0!important}.topbar .zh-hierarchy-back:hover,.topbar .zh-hierarchy-back:focus-visible{text-decoration:underline!important}@media(max-width:640px){.topbar .zh-hierarchy-back{font-size:12px!important;white-space:normal!important;text-align:right!important;max-width:45%!important}}';
  document.head.appendChild(css);
  nav.remove();
  button.remove();
  const bar = header.querySelector('.shell.nav');
  if (bar) bar.appendChild(back);
})();

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
  footer.innerHTML = '<div class="hx-shell"><div class="hbf-main"><div class="hbf-brand"><img src="/favicon.png" alt="" width="38" height="38"><div><strong>Zapytaj Hanki</strong><span>Ameryka po polsku.</span></div></div><nav aria-label="Stopka">' + nav + '</nav></div><div class="hbf-copy">© 2026 Zapytaj Hanki</div></div>';
})();

// Keep the ZH brand mark square in every footer; leave the Hanka chat avatar round.
(() => {
  const apply = () => {
    document.querySelectorAll('footer .hbf-brand img, footer .zh-footer-brand img, footer .zh-footer-brand-text img').forEach(img => {
      img.style.setProperty('border-radius', '0', 'important');
      img.style.setProperty('clip-path', 'none', 'important');
    });
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', apply, { once: true });
  else apply();
})();

// Zapytaj Hanki favicon — use a new URL to bypass stale browser favicon caches.
(() => {
  const href = '/favicon.png?v=zh-20261014';
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

/* Upgrade existing social groups without rebuilding the footer or duplicating icons. */
(()=>{const upgrade=()=>{const path='https://x.com/ZapytajHanki';document.querySelectorAll('footer .zh-social-footer-icons, footer .zh-footer-social').forEach(bar=>{if(bar.querySelector('a[href*="x.com/ZapytajHanki"]'))return;const a=document.createElement('a');a.href=path;a.target='_blank';a.rel='noopener noreferrer';a.setAttribute('aria-label','X — Zapytaj Hanki');a.style.cssText='color:#f17ca9;display:inline-flex;align-items:center;justify-content:center;width:28px;height:28px;flex-shrink:0';a.innerHTML='<svg aria-hidden="true" width="22" height="22" viewBox="0 0 24 24" fill="currentColor"><path d="M18.9 2H22l-6.78 7.75L23.2 22h-6.25l-4.9-7.44L5.55 22H2.4l7.25-8.3L1.8 2h6.4l4.43 6.77L18.9 2Zm-1.1 18h1.73L7.25 3.9H5.39L17.8 20Z"/></svg>';bar.appendChild(a);if(bar.style.maxWidth==='60px'||bar.style.width==='60px'||bar.style.minWidth==='60px'){bar.style.setProperty('width','96px','important');bar.style.setProperty('min-width','96px','important');bar.style.setProperty('max-width','96px','important')}bar.style.setProperty('display','flex','important');bar.style.setProperty('flex-direction','row','important')})};if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',upgrade,{once:true});else upgrade()})();
/* Shared social icons: keep the original footer layout intact. */
(()=>{const init=()=>{const footer=document.querySelector('footer');if(!footer||footer.querySelector('.zh-social-footer-icons')||footer.querySelector('.zh-footer-social'))return;const brand=footer.querySelector('.hbf-brand,.zh-footer-brand-text,.footer-brand,.state-footer-brand')||footer.querySelector('.wrap,.shell,.zh-footer-inner');if(!brand)return;const bar=document.createElement('div');bar.className='zh-social-footer-icons';bar.setAttribute('aria-label','Obserwuj nas w social mediach');bar.style.cssText='display:flex!important;flex-direction:row!important;align-items:center!important;justify-content:flex-end!important;gap:4px!important;width:96px!important;min-width:96px!important;max-width:96px!important;justify-content:space-between!important;margin-left:auto!important;flex-shrink:0!important';const items=[['Facebook','https://www.facebook.com/zapytajhanki','<path fill="currentColor" d="M22 12a10 10 0 1 0-11.56 9.88v-6.99H7.9V12h2.54V9.8c0-2.5 1.49-3.89 3.77-3.89 1.09 0 2.23.19 2.23.19v2.46h-1.26c-1.24 0-1.63.77-1.63 1.56V12h2.78l-.44 2.89h-2.34v6.99A10 10 0 0 0 22 12Z"/>'],['Instagram','https://www.instagram.com/zapytajhanki/','<rect x="2" y="2" width="20" height="20" rx="5"/><circle cx="12" cy="12" r="4"/><circle cx="17.5" cy="6.5" r="1" fill="currentColor" stroke="none"/>'],['X','https://x.com/ZapytajHanki','<path d="M18.9 2H22l-6.78 7.75L23.2 22h-6.25l-4.9-7.44L5.55 22H2.4l7.25-8.3L1.8 2h6.4l4.43 6.77L18.9 2Zm-1.1 18h1.73L7.25 3.9H5.39L17.8 20Z"/>']];for(const [name,url,shape] of items){const a=document.createElement('a');a.href=url;a.target='_blank';a.rel='noopener noreferrer';a.setAttribute('aria-label',name+' — Zapytaj Hanki');a.style.cssText='color:#f17ca9!important;display:inline-flex!important;align-items:center!important;justify-content:center!important;width:28px!important;height:28px!important';a.innerHTML='<svg aria-hidden="true" width="22" height="22" viewBox="0 0 24 24" style="color:#f17ca9!important;display:block!important" '+(name==='Instagram'?'fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"':'fill="currentColor"')+'>'+shape+'</svg>';bar.append(a)}const directBrand=brand.matches('.hbf-brand,.zh-footer-brand-text,.footer-brand,.state-footer-brand');if(directBrand){brand.style.setProperty('display','flex','important');brand.style.setProperty('flex-direction','row','important');brand.style.setProperty('align-items','center','important');brand.style.setProperty('width','100%','important');const brandGroup=document.createElement('div');brandGroup.style.cssText='display:flex!important;flex-direction:row!important;align-items:center!important;gap:11px!important;min-width:0!important';const logo=brand.querySelector(':scope > img');const text=brand.querySelector(':scope > div');if(logo)brandGroup.appendChild(logo);if(text){text.style.setProperty('display','flex','important');text.style.setProperty('flex-direction','column','important');brandGroup.appendChild(text)}while(brand.firstChild)brandGroup.appendChild(brand.firstChild);brand.append(brandGroup,bar)}else{const row=document.createElement('div');row.style.cssText='display:flex;flex-direction:row;align-items:center;justify-content:space-between;width:100%';const first=brand.querySelector('strong');if(first){const label=document.createElement('div');label.style.cssText='display:flex;flex-direction:column';const next=first.nextSibling;label.append(first);if(next&&next.nodeName==='BR'){next.remove();if(brand.firstChild)label.append(brand.firstChild)}row.append(label,bar);brand.prepend(row)}else brand.prepend(bar)}};if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init()})();

/* Google Analytics 4 — Zapytaj Hanki */
(()=>{if(window.__hankaGa4Loaded)return;window.__hankaGa4Loaded=true;const s=document.createElement('script');s.async=true;s.src='https://www.googletagmanager.com/gtag/js?id=G-JNT6FGGSKL';document.head.appendChild(s);window.dataLayer=window.dataLayer||[];window.gtag=function(){dataLayer.push(arguments)};gtag('js',new Date());gtag('config','G-JNT6FGGSKL')})();
