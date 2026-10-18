/* Shared circuit geometry. Loaded by both Node.js server and browser. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;root.F1Track=api})(typeof globalThis!=='undefined'?globalThis:this,function(){
'use strict';
const LENGTH=6000;
// Closed, hand-shaped GP circuit: straight, fast sweepers, esses and a tight hairpin.
const knots=[[0,0],[270,-30],[650,-25],[990,30],[1180,170],[1200,350],[1100,510],[920,530],[820,390],[850,220],[700,125],[490,220],[370,410],[140,490],[-100,435],[-250,285],[-255,95],[-155,-10]];
function cat(a,b,c,d,t){return .5*((2*b)+(-a+c)*t+(2*a-5*b+4*c-d)*t*t+(-a+3*b-3*c+d)*t*t*t)}
const raw=[];const per=90;
for(let k=0;k<knots.length;k++)for(let j=0;j<per;j++){const i=(q)=>(q+knots.length)%knots.length,t=j/per;raw.push({x:cat(knots[i(k-1)][0],knots[k][0],knots[i(k+1)][0],knots[i(k+2)][0],t),y:cat(knots[i(k-1)][1],knots[k][1],knots[i(k+1)][1],knots[i(k+2)][1],t)})}
const lengths=[0];for(let i=0;i<raw.length;i++){const a=raw[i],b=raw[(i+1)%raw.length];lengths.push(lengths[i]+Math.hypot(b.x-a.x,b.y-a.y))}
const total=lengths[lengths.length-1],scale=LENGTH/total;
function pos(d){let q=((d%LENGTH)+LENGTH)%LENGTH/scale,lo=0,hi=raw.length;while(lo+1<hi){let m=(lo+hi)>>1;if(lengths[m]<=q)lo=m;else hi=m}const a=raw[lo],b=raw[(lo+1)%raw.length],t=(q-lengths[lo])/(lengths[lo+1]-lengths[lo]||1);return {x:(a.x+(b.x-a.x)*t)*scale,y:(a.y+(b.y-a.y)*t)*scale}}
function direction(d){const a=pos(d-4),b=pos(d+4);return Math.atan2(b.y-a.y,b.x-a.x)}
function curvature(d){const a=direction(d-15),b=direction(d+15);return Math.atan2(Math.sin(b-a),Math.cos(b-a))/30}
function label(d){const q=((d%LENGTH)+LENGTH)%LENGTH;if(q<950)return 'START / MAIN STRAIGHT';if(q<2050)return 'FAST SWEEPERS';if(q<3300)return 'HAIRPIN COMPLEX';if(q<4650)return 'S-CURVES';return 'FINAL SECTOR'}
return {LENGTH,pos,direction,curvature,label};
});
