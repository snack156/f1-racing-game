const express=require('express');
const http=require('http');
const {Server}=require('socket.io');
const Track=require('./track');
const app=express(),server=http.createServer(app),io=new Server(server);
app.use(express.static(__dirname));
const rooms=new Map(),L=Track.LENGTH,ROAD=40,MAX=75;
const colors=['#ff3048','#318aff','#ffd43b','#aa72ff','#f0f0f0','#ff8b2b','#111111'];
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const angleDelta=(a,b)=>Math.atan2(Math.sin(a-b),Math.cos(a-b));
const code=()=>{let s;do{s=Array.from({length:6},()=> 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'[Math.floor(Math.random()*32)]).join('')}while(rooms.has(s));return s};
const safe=s=>String(s||'DRIVER').replace(/[<>]/g,'').trim().slice(0,16)||'DRIVER';
function view(r){return {code:r.code,host:r.host,state:r.state,startAt:r.startAt,flag:r.flag,players:[...r.players.values()].map(p=>({id:p.id,name:p.name,color:p.color,ready:p.ready,x:p.x,y:p.y,heading:p.heading,speed:p.speed,dist:p.dist,lane:p.lane,lap:Math.min(3,1+Math.floor(p.dist/L)),dnf:p.dnf,finished:p.finished,total:p.total,pit:p.pit,pitUsed:p.pitUsed})),results:r.results||[]}}
function emit(r){io.to(r.code).emit('room',view(r))}
function leave(s){const r=rooms.get(s.data.room);if(!r)return;r.players.delete(s.id);s.leave(r.code);s.data.room=null;if(!r.players.size){rooms.delete(r.code);return}if(r.host===s.id)r.host=r.players.keys().next().value;emit(r)}
function join(s,r,d){leave(s);const start=Track.pos(0),heading=Track.direction(0);const p={id:s.id,name:safe(d.name),color:colors.includes(d.color)?d.color:colors[0],ready:false,x:start.x,y:start.y,heading,speed:0,dist:0,lane:0,gas:false,brake:false,steer:0,off:0,dnf:false,finished:false,total:null,pit:false,pitUsed:false,pitUntil:0};r.players.set(s.id,p);s.join(r.code);s.data.room=r.code;s.emit('joined',{id:s.id,code:r.code});emit(r)}
// Find the closest position on the circuit centerline to the actual car position.
// The car does NOT snap to that line. This is only for lap timing and off-track checks.
const segments=[];
for(let i=0;i<1200;i++){const a=Track.pos(i*L/1200),b=Track.pos((i+1)*L/1200),dx=b.x-a.x,dy=b.y-a.y;segments.push({a,dx,dy,len:dx*dx+dy*dy,d:i*L/1200})}
function nearest(x,y,prev){let best=null,best2=Infinity;const index=Math.floor(((prev%L)+L)%L/L*1200);for(let offset=-35;offset<=35;offset++){const s=segments[(index+offset+1200)%1200],t=clamp(((x-s.a.x)*s.dx+(y-s.a.y)*s.dy)/s.len,0,1),px=s.a.x+s.dx*t,py=s.a.y+s.dy*t,d2=(x-px)**2+(y-py)**2;if(d2<best2){best2=d2;best={d:s.d+t*L/1200,side:(s.dx*(y-py)-s.dy*(x-px))/Math.sqrt(s.len),distance:Math.sqrt(d2)}}}return best}
function finish(r){r.state='results';r.results=[...r.players.values()].map(p=>({name:p.name,finished:p.finished,dnf:p.dnf,total:p.total,dist:p.dist})).sort((a,b)=>Number(b.finished)-Number(a.finished)||(a.finished?a.total-b.total:b.dist-a.dist));emit(r)}
io.on('connection',s=>{
 s.on('create',d=>{const c=code(),r={code:c,host:s.id,state:'lobby',startAt:0,flag:'green',players:new Map(),results:[],lastSend:0};rooms.set(c,r);join(s,r,d||{})});
 s.on('join',d=>{const r=rooms.get(String(d?.code||'').trim().toUpperCase());if(!r)return s.emit('errorMsg','Room code not found.');if(r.state!=='lobby')return s.emit('errorMsg','This race has already started.');if(r.players.size>=8)return s.emit('errorMsg','Maximum 8 drivers per room.');join(s,r,d||{})});
 s.on('ready',()=>{const r=rooms.get(s.data.room),p=r?.players.get(s.id);if(p&&r.state==='lobby'){p.ready=!p.ready;emit(r)}});
 s.on('start',()=>{const r=rooms.get(s.data.room);if(!r||r.host!==s.id||r.state!=='lobby')return;r.state='countdown';r.startAt=Date.now()+3500;let n=0;for(const p of r.players.values()){const d=n++*12,point=Track.pos(d),h=Track.direction(d);Object.assign(p,{x:point.x,y:point.y,heading:h,speed:0,dist:d,lane:0,off:0,dnf:false,finished:false,total:null,pit:false,pitUsed:false,gas:false,brake:false,steer:0})}emit(r)});
 s.on('input',d=>{const r=rooms.get(s.data.room),p=r?.players.get(s.id);if(!p||r.state!=='racing'||p.dnf||p.finished)return;p.gas=!!d?.gas;p.brake=!!d?.brake;p.steer=clamp(Number(d?.steer)||0,-1,1)});
 s.on('pit',()=>{const r=rooms.get(s.data.room),p=r?.players.get(s.id);if(!p||r.state!=='racing'||p.dnf||p.finished||p.pitUsed||p.pit||r.flag!=='safety'||p.speed>20)return;p.pit=true;p.pitUsed=true;p.pitUntil=Date.now()+5000;p.speed=0;emit(r)});
 s.on('disconnect',()=>leave(s));
});
let last=Date.now();setInterval(()=>{const now=Date.now(),dt=Math.min(.07,(now-last)/1000);last=now;for(const r of rooms.values()){
 if(r.state==='countdown'&&now>=r.startAt){r.state='racing';emit(r)}if(r.state!=='racing')continue;
 for(const p of r.players.values()){
 if(p.dnf||p.finished)continue;
 if(p.pit){if(now<p.pitUntil)continue;p.pit=false}
 const old=p.dist;
 p.speed=clamp(p.speed+(p.brake?-42:p.gas?22:-12)*dt,0,MAX);
 // Steering changes the car's WORLD heading. The track never steers the car.
 // Gentle manual steering: at 90 m/s, max 0.62 radians per second.
 // No rotation while stationary. Steering never auto-follows the track.
 const speedFactor=Math.min(1,p.speed/75);
 // Manual steering in radians/second, deliberately limited at high speed.
 // At racing speed, a 0.2-second key tap turns about 6 degrees, not 180.
 const turnRate=(0.85-0.34*speedFactor)*p.steer;
 p.heading+=turnRate*dt;
 p.x+=Math.cos(p.heading)*p.speed*dt;
 p.y+=Math.sin(p.heading)*p.speed*dt;
 const near=nearest(p.x,p.y,p.dist);
 p.lane=near.side/ROAD;
 // Only count forward progress when the car moves along the circuit.
 const tangent=Track.direction(near.d);
 const forward=Math.cos(angleDelta(p.heading,tangent));
 const delta=((near.d-(old%L)+L*1.5)%L)-L*.5;
 if(delta>0&&delta<25&&forward>.15)p.dist+=delta;
 if(near.distance>ROAD){p.speed=Math.max(0,p.speed-38*dt);p.off+=dt}else p.off=Math.max(0,p.off-dt*1.5);
 if(near.distance>ROAD*3&&p.off>2.5){p.dnf=true;p.speed=0;r.flag='safety';r.flagUntil=now+8000;io.to(r.code).emit('notice',p.name+' DNF · SAFETY CAR')}
 if(p.dist>=L*3){p.finished=true;p.total=(now-r.startAt)/1000;p.speed=0}
 }
 if(r.flag==='safety'&&now>r.flagUntil){r.flag='green';io.to(r.code).emit('notice','GREEN FLAG - RACING RESUMES')}
 if([...r.players.values()].every(p=>p.dnf||p.finished)||now-r.startAt>15*60*1000){finish(r);continue}
 if(now-r.lastSend>75){r.lastSend=now;emit(r)}
}},50);
server.listen(process.env.PORT||3000,()=>console.log('F1 POV manual steering server running'));
