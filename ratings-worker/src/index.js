const ALLOWED = new Set(["buffalo-wings","deep-fried-turkey","pumpkin-cheesecake-sernik-dyniowy","halloween-mummy-hot-dogs","rice-krispies-treats","halloween-punch"]);
const ORIGIN = "https://zapytajhanki.com";
function cors(origin) { return {"Access-Control-Allow-Origin":origin===ORIGIN?ORIGIN:"null","Access-Control-Allow-Methods":"GET,POST,OPTIONS","Access-Control-Allow-Headers":"Content-Type","Vary":"Origin"}; }
function json(data,status=200,origin="") {return new Response(JSON.stringify(data),{status,headers:{"Content-Type":"application/json; charset=utf-8","Cache-Control":"no-store",...cors(origin)}});}
async function digest(value){const bytes=await crypto.subtle.digest("SHA-256",new TextEncoder().encode(value));return Array.from(new Uint8Array(bytes),x=>x.toString(16).padStart(2,"0")).join("");}
export default {async fetch(request,env){
 const origin=request.headers.get("Origin")||"";
 if(request.method==="OPTIONS")return new Response(null,{status:204,headers:cors(origin)});
 if(origin && origin!==ORIGIN)return json({error:"Forbidden origin"},403,origin);
 const url=new URL(request.url);
 if(url.pathname!=="/api/ratings")return json({error:"Not found"},404,origin);
 if(!["GET","POST"].includes(request.method))return json({error:"Method not allowed"},405,origin);
 if(!env.DB || !env.RATING_SALT)return json({error:"Service unavailable"},503,origin);
 let slug=url.searchParams.get("slug");
 let payload;
 if(request.method==="POST"){
   if(origin!==ORIGIN)return json({error:"Forbidden origin"},403,origin);
   if(Number(request.headers.get("content-length")||0)>1024)return json({error:"Payload too large"},413,origin);
   try {payload=await request.json();}catch{return json({error:"Invalid JSON"},400,origin);}
   slug=payload?.slug;
 }
 if(!ALLOWED.has(slug))return json({error:"Unknown recipe"},400,origin);
 try{
   if(request.method==="POST"){
     const rating=payload?.rating;
     if(!Number.isInteger(rating)||rating<1||rating>5)return json({error:"Rating must be 1–5"},400,origin);
     const ip=request.headers.get("CF-Connecting-IP")||"unknown";
     const day=new Date().toISOString().slice(0,10);
     const voter=await digest(env.RATING_SALT+":"+ip+":"+request.headers.get("User-Agent"));
     const ipHash=await digest(env.RATING_SALT+":"+ip);
     const limit=await env.DB.prepare("SELECT count FROM recipe_rating_limits WHERE day=? AND ip_hash=?").bind(day,ipHash).first();
     if((limit?.count||0)>=20)return json({error:"Daily rating limit reached"},429,origin);
     await env.DB.prepare("INSERT INTO recipe_votes(slug,voter_hash,rating,updated_at) VALUES(?,?,?,datetime('now')) ON CONFLICT(slug,voter_hash) DO UPDATE SET rating=excluded.rating,updated_at=datetime('now')").bind(slug,voter,rating).run();
     await env.DB.prepare("INSERT INTO recipe_rating_limits(day,ip_hash,count) VALUES(?,?,1) ON CONFLICT(day,ip_hash) DO UPDATE SET count=count+1").bind(day,ipHash).run();
   }
   const result=await env.DB.prepare("SELECT COUNT(*) AS count, ROUND(AVG(rating),1) AS average FROM recipe_votes WHERE slug=?").bind(slug).first();
   return json({slug,count:result?.count||0,average:result?.average||null},200,origin);
 }catch{return json({error:"Database error"},500,origin);}
}};