const express=require('express');
const http=require('http');
const {Server}=require('socket.io');
const app=express(),server=http.createServer(app),io=new Server(server);
app.use(express.static(__dirname));
const rooms=new Map();
const Track=require('./track.js');
const TRACK=6000,LAPS=3,MAX=92,TICK=50;
const COLORS=['#ff3048','#318aff','#ffd43b','#aa72ff','#f0f0f0','#ff8b2b','#111111'];
const clean=s=>String(s||'').replace(/[<>]/g,'').trim().slice(0,16);
const randCode=()=>Array.from({length:6},()=> 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'[Math.floor(Math.random()*32)]).join('');
function code(){let c;do{c=randCode()}while(rooms.has(c));return c}
function curve(d){return Track.curvature(d)}
function snapshot(r){return {code:r.code,host:r.host,state:r.state,flag:r.flag,flagUntil:r.flagUntil,startAt:r.startAt,players:[...r.players.values()].map(p=>({id:p.id,name:p.name,color:p.color,ready:p.ready,dist:p.dist,x:p.x,speed:p.speed,lap:Math.min(LAPS,1+Math.floor(p.dist/TRACK)),finished:p.finished,dnf:p.dnf,total:p.total,best:p.best,pit:p.pit,pitUsed:p.pitUsed,pitUntil:p.pitUntil})),results:r.results||[]}}
function emit(r){io.to(r.code).emit('room',snapshot(r))}
function leave(s){const r=rooms.get(s.data.room);if(!r)return;r.players.delete(s.id);s.leave(r.code);s.data.room=null;if(!r.players.size){rooms.delete(r.code);return}if(r.host===s.id)r.host=r.players.keys().next().value;emit(r)}
function join(s,r,name,color){leave(s);const p={id:s.id,name:clean(name)||'DRIVER',color:COLORS.includes(color)?color:COLORS[0],ready:false,dist:0,x:0,speed:0,gas:false,brake:false,steer:0,finished:false,dnf:false,total:null,best:null,lapStart:0,offroad:0,pit:false,pitUntil:0,pitUsed:false};r.players.set(s.id,p);s.join(r.code);s.data.room=r.code;s.emit('joined',{code:r.code,id:s.id});emit(r)}
function flag(r,now){if(r.flag==='safety')return;r.flag='safety';r.flagUntil=now+12000;io.to(r.code).emit('notice','YELLOW FLAG — SAFETY CAR DEPLOYED · NO OVERTAKING')}
function results(r){const ps=[...r.players.values()];r.results=ps.map(p=>({id:p.id,name:p.name,color:p.color,finished:p.finished,dnf:p.dnf,total:p.total,dist:p.dist,best:p.best})).sort((a,b)=>Number(b.finished)-Number(a.finished)||(a.finished?a.total-b.total:b.dist-a.dist));r.state='results';emit(r)}
io.on('connection',s=>{
 s.on('create',({name,color}={})=>{const c=code(),r={code:c,host:s.id,state:'lobby',flag:'green',flagUntil:0,startAt:0,players:new Map(),results:[],lastBroadcast:0};rooms.set(c,r);join(s,r,name,color)});
 s.on('join',({code:raw,name,color}={})=>{const r=rooms.get(String(raw||'').trim().toUpperCase());if(!r)return s.emit('errorMsg','Room Code를 찾을 수 없어요.');if(r.state!=='lobby')return s.emit('errorMsg','이미 시작한 레이스예요.');if(r.players.size>=8)return s.emit('errorMsg','최대 8명까지 참가할 수 있어요.');join(s,r,name,color)});
 s.on('ready',()=>{const r=rooms.get(s.data.room),p=r?.players.get(s.id);if(!p||r.state!=='lobby')return;p.ready=!p.ready;emit(r)});
 s.on('start',()=>{const r=rooms.get(s.data.room);if(!r||r.host!==s.id||r.state!=='lobby')return;r.state='countdown';r.flag='green';r.startAt=Date.now()+4000;for(const p of r.players.values())Object.assign(p,{dist:0,x:0,speed:0,finished:false,dnf:false,total:null,best:null,lapStart:r.startAt,offroad:0,pit:false,pitUntil:0,pitUsed:false});emit(r)});
 s.on('input',({gas,brake,steer}={})=>{const r=rooms.get(s.data.room),p=r?.players.get(s.id);if(!p||r.state!=='racing'||p.dnf||p.finished)return;p.gas=!!gas;p.brake=!!brake;p.steer=Math.max(-1,Math.min(1,Number(steer)||0))});
 s.on('pit',()=>{const r=rooms.get(s.data.room),p=r?.players.get(s.id);if(!p||r.state!=='racing'||p.dnf||p.finished||p.pit||p.pitUsed)return;if(r.flag!=='safety')return s.emit('errorMsg','피트스톱은 Safety Car 상황에서만 사용할 수 있어요.');if(p.speed>20)return s.emit('errorMsg','피트인하려면 먼저 속도를 72 km/h 이하로 줄이세요.');p.pit=true;p.pitUsed=true;p.pitUntil=Date.now()+5000;p.speed=0;io.to(r.code).emit('notice',p.name+' — PIT STOP (5 SEC)');emit(r)});
 s.on('disconnect',()=>leave(s));
});
let last=Date.now();setInterval(()=>{const now=Date.now(),dt=Math.min(.08,(now-last)/1000);last=now;for(const r of rooms.values()){
 if(r.state==='countdown'&&now>=r.startAt){r.state='racing';emit(r)}
 if(r.state!=='racing')continue;
 if(r.flag==='safety'&&now>=r.flagUntil){r.flag='green';io.to(r.code).emit('notice','GREEN FLAG — RACE RESTART');}
 const ps=[...r.players.values()];
 for(const p of ps){
  if(p.finished||p.dnf)continue;
  if(p.pit){if(now>=p.pitUntil){p.pit=false;p.x=0;io.to(r.code).emit('notice',p.name+' — PIT EXIT')}else continue}
  p.speed+=(p.gas?23:p.brake?-48:-9)*dt;
  if(Math.abs(p.x)>1)p.speed-=24*dt;
  p.speed=Math.max(0,Math.min(r.flag==='safety'?28:MAX,p.speed));
  // Track curvature is derived from the exact same circuit geometry drawn by the client.
  // Steering is relative to the road; at speed the car drifts to the outside of bends.
  p.x+=p.steer*dt*(.65+p.speed/MAX*1.8)-curve(p.dist)*p.speed*p.speed*dt*.0045;
  p.x=Math.max(-2.6,Math.min(2.6,p.x));
  // Only a sustained, severe off-track excursion triggers DNF.
  if(Math.abs(p.x)>2.3&&p.speed>8)p.offroad+=dt;else p.offroad=Math.max(0,p.offroad-dt*2);
  if(p.offroad>=1.7){p.dnf=true;p.speed=0;flag(r,now);io.to(r.code).emit('notice',p.name+' — DNF · SAFETY CAR');continue}
  const before=p.dist;p.dist+=p.speed*dt;
  if(Math.floor(before/TRACK)<Math.floor(p.dist/TRACK)){
   const t=(now-p.lapStart)/1000;p.best=p.best===null?t:Math.min(p.best,t);p.lapStart=now;
   if(p.dist>=TRACK*LAPS){p.finished=true;p.total=(now-r.startAt)/1000;p.speed=0}
  }
 }
 // Simplified contact detection: significant overlap at race speed may cause a safety car.
 if(r.flag==='green')for(let i=0;i<ps.length;i++)for(let j=i+1;j<ps.length;j++){
  const a=ps[i],b=ps[j];if(a.dnf||b.dnf||a.finished||b.finished||a.pit||b.pit)continue;
  if(now-r.startAt>7000&&Math.abs(a.dist-b.dist)<7&&Math.abs(a.x-b.x)<.17&&Math.max(a.speed,b.speed)>25){
   const victim=a.speed>=b.speed?a:b;victim.dnf=true;victim.speed=0;flag(r,now);io.to(r.code).emit('notice','CONTACT — '+victim.name+' DNF');break;
  }
 }
 if(ps.every(p=>p.finished||p.dnf)||now-r.startAt>15*60*1000){for(const p of ps)if(!p.finished&&!p.dnf){p.dnf=true;p.speed=0}results(r);continue}
 if(now-r.lastBroadcast>=100){r.lastBroadcast=now;emit(r)}
 }
},TICK);
server.listen(process.env.PORT||3000,()=>console.log('Formula 1 game server listening'));
