import fs from "node:fs";import path from "node:path";
export const ROOT=path.resolve(import.meta.dirname,"../../..");
export const TOOL=path.resolve(import.meta.dirname,"..");
export const STAGING=path.join(TOOL,"staging");
export const slug=s=>s.normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase().replace(/[^a-z0-9]+/g,"-").replace(/^-|-$/g,"");
export function walk(dir,out=[]){if(!fs.existsSync(dir))return out;for(const e of fs.readdirSync(dir,{withFileTypes:true})){const p=path.join(dir,e.name);e.isDirectory()?walk(p,out):e.name.endsWith(".json")&&out.push(p)}return out}
export function existingIds(){const ids=new Set;for(const f of walk(path.join(ROOT,"brain"))){try{const j=JSON.parse(fs.readFileSync(f,"utf8"));if(j.id)ids.add(j.id)}catch{}}return ids}
export function writeJson(file,obj){fs.mkdirSync(path.dirname(file),{recursive:true});fs.writeFileSync(file,JSON.stringify(obj,null,2)+"\n")}
