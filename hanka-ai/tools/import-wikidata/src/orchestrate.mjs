import fs from "node:fs";import path from "node:path";import {spawnSync} from "node:child_process";import {TOOL} from "./lib.mjs";
const manifest=JSON.parse(fs.readFileSync(path.join(TOOL,"profiles/manifest.json"),"utf8"));
const requested=process.argv.slice(2);const profiles=manifest.profiles.filter(p=>p.enabled&&(!requested.length||requested.includes(p.name)||requested.includes(p.family)));
if(!profiles.length)throw new Error("No enabled profiles matched.");
const summaries=[];
for(const p of profiles){let pages=0;for(let offset=0;pages<p.maxPages;offset+=p.batchSize,pages++){const args=p.runner==="import.mjs"?[path.join(TOOL,"src",p.runner),p.name,String(p.batchSize),String(offset)]:[path.join(TOOL,"src",p.runner),String(p.batchSize),String(offset)];const r=spawnSync(process.execPath,args,{encoding:"utf8",stdio:["ignore","pipe","pipe"]});if(r.stdout)process.stdout.write(r.stdout);if(r.stderr)process.stderr.write(r.stderr);if(r.status!==0)throw new Error(p.name+" failed at offset "+offset);let last=null;for(const line of r.stdout.trim().split(/\n/).reverse()){try{last=JSON.parse(line);break}catch{}}summaries.push({profile:p.name,offset,status:"ok"});if(r.stdout.includes('"rowsReceived": 0')||r.stdout.includes('"received": 0'))break;}}
console.log(JSON.stringify({orchestrated:profiles.map(p=>p.name),runs:summaries.length},null,2));
