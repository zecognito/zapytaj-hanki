/* Poradniki feed: articles are published through /poradniki/articles.json.
   Each item: {title,slug,date,summary,image,alt}. Newest first.
   Each article must exist at /poradniki/<slug>/ before adding it here. */
(()=>{'use strict';
const stream=document.querySelector('.news-stream');
if(!stream)return;
const status=document.getElementById('guide-status');
const more=document.getElementById('guide-more');
const pageSize=8;let items=[],shown=0,loading=false;
const safePath=s=>typeof s==='string'&&/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(s);
const safeImage=s=>typeof s==='string'&&s.startsWith('/')&&!s.startsWith('//')&&!/[?#\\]/.test(s);
const setStatus=s=>{if(status)status.textContent=s};
function card(item){
const article=document.createElement('article');article.className='news-card';
const link=document.createElement('a');link.className='news-card-link';link.href='/poradniki/'+item.slug+'/';
if(item.image){const img=document.createElement('img');img.className='news-card-image';img.src=item.image;img.alt=item.alt||'';img.loading='lazy';img.decoding='async';link.append(img)}
const meta=document.createElement('div');meta.className='news-card-date';const date=document.createElement('time');date.dateTime=item.date;date.textContent=new Intl.DateTimeFormat('pl-PL',{day:'numeric',month:'long',year:'numeric',timeZone:'UTC'}).format(new Date(item.date+'T12:00:00Z'));meta.append(date);link.append(meta);
const h=document.createElement('h3');h.textContent=item.title;link.append(h);
if(item.summary){const p=document.createElement('p');p.textContent=item.summary;link.append(p)}
const read=document.createElement('span');read.className='news-read';read.textContent='Czytaj więcej →';link.append(read);article.append(link);return article
}
function loadMore(){if(loading)return;loading=true;const slice=items.slice(shown,shown+pageSize);const frag=document.createDocumentFragment();slice.forEach(x=>frag.append(card(x)));stream.append(frag);shown+=slice.length;more.hidden=shown>=items.length;loading=false}
fetch('/poradniki/articles.json',{cache:'no-cache'}).then(r=>{if(!r.ok)throw Error('feed');return r.json()}).then(data=>{
items=(Array.isArray(data.articles)?data.articles:[]).filter(x=>x&&safePath(x.slug)&&typeof x.title==='string'&&x.title.trim()&&/^\d{4}-\d{2}-\d{2}$/.test(x.date)&&(!x.image||safeImage(x.image))).sort((a,b)=>b.date.localeCompare(a.date));
if(!items.length){setStatus('Pierwsze wiadomości już wkrótce.');return}
shown=stream.querySelectorAll(':scope > .news-card').length;
setStatus('');if(shown<items.length)loadMore();else more.hidden=true;
if('IntersectionObserver'in window){const observer=new IntersectionObserver(entries=>{if(entries.some(e=>e.isIntersecting)&&!more.hidden)loadMore()},{rootMargin:'500px'});observer.observe(more)}
}).catch(()=>setStatus('Nie udało się załadować wiadomości. Spróbuj ponownie później.'));
more.addEventListener('click',loadMore);
})();