const $=id=>document.getElementById(id);

const palettes={Mocha:['#1e1e2e','#181825','#313244','#45475a','#cdd6f4','#7f849c',['#f5e0dc','#f38ba8','#fab387','#f9e2af','#a6e3a1','#94e2d5','#89b4fa','#cba6f7']],Macchiato:['#24273a','#1e2030','#363a4f','#494d64','#cad3f5','#8087a2',['#f4dbd6','#ed8796','#f5a97f','#eed49f','#a6da95','#8bd5ca','#8aadf4','#c6a0f6']],Frappe:['#303446','#292c3c','#414559','#51576d','#c6d0f5','#838ba7',['#f2d5cf','#e78284','#ef9f76','#e5c890','#a6d189','#81c8be','#8caaee','#ca9ee6']],Latte:['#eff1f5','#e6e9ef','#ccd0da','#bcc0cc','#4c4f69','#8c8fa1',['#dc8a78','#d20f39','#fe640b','#df8e1d','#40a02b','#179299','#1e66f5','#8839ef']]};

const extraColors={Mocha:['#f2cdcd','#f5c2e7','#eba0ac','#89dceb','#74c7ec','#b4befe'],Macchiato:['#f0c6c6','#f5bde6','#ee99a0','#91d7e3','#7dc4e4','#b7bdf8'],Frappe:['#eebebe','#f4b8e4','#ea999c','#99d1db','#85c1dc','#babbf1'],Latte:['#dd7878','#ea76cb','#e64553','#04a5e5','#209fb5','#7287fd']};

for(const [key,colors] of Object.entries(extraColors))palettes[key][6].push(...colors);

const names=['Rosewater','Red','Peach','Yellow','Green','Teal','Blue','Mauve','Flamingo','Pink','Maroon','Sky','Sapphire','Lavender'];

const visualizers=['Spectrum','Wave','Orbit','Mirror','Mountains','Ribbon','Rings','Spiral','Particles','Flower','Lissajous','Waterfall','Aurora','Equalizer','Pulse','Starfield','Helix','Dots'];

let theme='Mocha',accent=9,style='Spectrum',playing=false,sensitivity=.65,ctx,analyser,gain,mediaSource,stream,micSource,oscillators=[],demoTimer,source='demo',start=0,offset=0,url;

let thickness=1,spread=1,bass=0,waveSmooth=.8;const filteredWave=new Float32Array(512);

let smoothing=.8,speed=1,detail=64,glow=.4,popup=null,popCanvas=null,popContext=null,phase=0,lastFrame=0;

const audio=new Audio();audio.crossOrigin='anonymous';

try{const p=JSON.parse(localStorage.getItem('melo-v2')||'{}');if(palettes[p.theme])theme=p.theme;if(Number.isInteger(p.accent)&&p.accent>=0&&p.accent<14)accent=p.accent;if(visualizers.includes(p.style))style=p.style}catch{}

function appearance(){const p=palettes[theme];['base','mantle','surface','overlay','text','muted'].forEach((v,i)=>document.documentElement.style.setProperty('--'+v,p[i]));document.documentElement.style.setProperty('--accent',p[6][accent]);$('themes').innerHTML=Object.keys(palettes).map(t=>`<button class="theme ${theme===t?'active':''}" data-theme="${t}" aria-pressed="${theme===t}"><span class="mini" style="background:${palettes[t][0]};border-color:${palettes[t][6][9]}"></span>${t==='Frappe'?'Frappé':t}</button>`).join('');$('accents').innerHTML=names.map((n,i)=>`<button class="swatch ${accent===i?'active':''}" style="--c:${p[6][i]}" data-accent="${i}" title="${n}" aria-label="${n}" aria-pressed="${accent===i}"></button>`).join('');$('styles').innerHTML=visualizers.map((s,i)=>`<button class="style ${s===style?'active':''}" data-style="${s}" aria-pressed="${s===style}"><svg viewBox="0 0 30 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round">${['<path d="M3 9v6m6-11v16m6-18v20m6-16v12m6-9v6"/>','<path d="M1 12c5-22 8 22 14 0s8 22 14 0"/>','<circle cx="15" cy="12" r="9"/><circle cx="15" cy="12" r="4"/>','<path d="M2 12h26M4 7v10m6-14v18m6-16v14m6-11v8"/>','<path d="M1 20L7 8l5 7 6-13 11 18Z"/>','<path d="M1 8q7-9 14 0t14 0M1 16q7-9 14 0t14 0"/>','<circle cx="15" cy="12" r="10"/><circle cx="15" cy="12" r="6"/><circle cx="15" cy="12" r="2"/>','<path d="M15 12c-6-8-12 6-3 9s18-10 9-17S-2 6 3 18"/>','<circle cx="6" cy="7" r="2"/><circle cx="20" cy="5" r="1"/><circle cx="14" cy="16" r="3"/><circle cx="26" cy="19" r="2"/>','<path d="M15 12C-7-7 0 30 15 12C37-7 30 30 15 12C-7 31 0-6 15 12C37 31 30-6 15 12"/>','<path d="M15 12C-5-9-5 33 15 12S35-9 15 12S-5 33 15 12S35-9 15 12"/>','<path d="M3 4h24M3 9h24M3 14h24M3 19h24"/>'][i%12]}</svg>${s}</button>`).join('');$('accentName').textContent=names[accent];$('paletteLabel').textContent=theme.toUpperCase()+' / '+names[accent].toUpperCase();$('modeLabel').textContent=style.toUpperCase();try{localStorage.setItem('melo-v2',JSON.stringify({theme,accent,style}))}catch{}}

$('themes').onclick=e=>{const b=e.target.closest('[data-theme]');if(b){theme=b.dataset.theme;appearance()}};$('accents').onclick=e=>{const b=e.target.closest('[data-accent]');if(b){accent=+b.dataset.accent;appearance()}};$('styles').onclick=e=>{const b=e.target.closest('[data-style]');if(b){style=b.dataset.style;appearance()}};appearance();

function setup(){if(!ctx){ctx=new AudioContext();analyser=ctx.createAnalyser();analyser.fftSize=2048;analyser.smoothingTimeConstant=.82;gain=ctx.createGain();gain.gain.value=+$('volume').value;analyser.connect(gain);gain.connect(ctx.destination);mediaSource=ctx.createMediaElementSource(audio);mediaSource.connect(analyser)}return ctx.resume()}

function demo(){const notes=[130.81,164.81,196,261.63,329.63,392];notes.forEach((f,i)=>{const o=ctx.createOscillator(),g=ctx.createGain();o.type='sine';o.frequency.value=f;g.gain.value=.035;o.connect(g);g.connect(analyser);o.start();oscillators.push({o,g})});start=ctx.currentTime-offset;demoTimer=setInterval(()=>{oscillators.forEach(({o,g},i)=>{o.frequency.setTargetAtTime(notes[i]*([1,1,1.125,.89][Math.floor((ctx.currentTime-start)/8)%4]),ctx.currentTime,1.8);g.gain.setTargetAtTime(.025+Math.random()*.02,ctx.currentTime,1)})},1500)}

function stopDemo(){clearInterval(demoTimer);oscillators.forEach(({o})=>o.stop());oscillators=[]}

function updatePlay(){ $('play').textContent=playing?'Ⅱ':'▶';$('play').setAttribute('aria-label',playing?'Pause audio':'Play audio');$('stateLabel').textContent=playing?(source==='mic'?'MICROPHONE LIVE':'NOW PLAYING'):'PAUSED'}

async function toggle(){try{await setup();if(source==='mic'){if(stream){stream.getTracks().forEach(t=>t.stop());micSource.disconnect();stream=null;$('mic').classList.remove('active')}source='demo';playing=false;$('title').textContent='A little daydream';$('artist').textContent='Melo sessions · ambient demo'}gain.gain.value=+$('volume').value;if(playing){if(source==='file')audio.pause();else{offset=ctx.currentTime-start;stopDemo()}playing=false}else{if(source==='file')await audio.play();else demo();playing=true}updatePlay();$('status').textContent=''}catch(e){$('status').textContent='Audio could not start. Try another file or check your browser permissions.'}}

$('play').onclick=toggle;document.addEventListener('keydown',e=>{if(e.code==='Space'&&!['INPUT','BUTTON','SELECT'].includes(document.activeElement.tagName)){e.preventDefault();toggle()}});$('volume').oninput=()=>{if(gain&&source!=='mic')gain.gain.value=+$('volume').value};$('sensitivity').oninput=()=>{sensitivity=+$('sensitivity').value/100;$('sensitivityValue').textContent=$('sensitivity').value+'%'};

function stopAll(){audio.pause();stopDemo();if(stream){stream.getTracks().forEach(t=>t.stop());micSource.disconnect();stream=null}$('mic').classList.remove('active');playing=false}

async function load(file){if(!file)return;if(!file.type.startsWith('audio/')&&!/\.(mp3|wav|ogg|flac|m4a|aac|opus)$/i.test(file.name)){$('status').textContent='Please choose an audio file.';return}stopAll();if(url)URL.revokeObjectURL(url);url=URL.createObjectURL(file);source='file';audio.src=url;$('title').textContent=file.name.replace(/\.[^.]+$/,'');$('artist').textContent='Local audio · on your device';$('status').textContent='';await toggle()}

$('upload').onclick=()=>$('file').click();$('file').onchange=e=>load(e.target.files[0]);document.addEventListener('dragover',e=>e.preventDefault());document.addEventListener('drop',e=>{e.preventDefault();load(e.dataTransfer.files[0])});audio.onended=()=>{playing=false;updatePlay()};audio.onerror=()=>{$('status').textContent='This audio format could not be played. Try an MP3 or WAV file.';playing=false;updatePlay()};$('seek').oninput=()=>{if(source==='file'&&Number.isFinite(audio.duration))audio.currentTime=audio.duration*$('seek').value/100};

$('mic').onclick=async()=>{if(source==='mic'){stopAll();source='demo';$('title').textContent='A little daydream';$('artist').textContent='Melo sessions · ambient demo';updatePlay();return}try{await setup();const s=await navigator.mediaDevices.getUserMedia({audio:true});stopAll();stream=s;micSource=ctx.createMediaStreamSource(s);micSource.connect(analyser);gain.gain.value=0;source='mic';playing=true;$('title').textContent='Your surroundings';$('artist').textContent='Microphone · live input';$('mic').classList.add('active');$('status').textContent='Microphone is active. Click Use microphone again to disconnect.';updatePlay()}catch{$('status').textContent='Microphone unavailable. Allow microphone access in your browser, or open an audio file.'}};

$('fullscreen').onclick=async()=>{try{if(document.fullscreenElement)await document.exitFullscreen();else await $('stage').requestFullscreen()}catch{$('status').textContent='Fullscreen is unavailable in this browser.'}};$('reset').onclick=()=>{theme='Mocha';accent=9;style='Spectrum';sensitivity=.65;$('sensitivity').value=65;$('sensitivityValue').textContent='65%';appearance()};

const canvas=$('canvas'),c=canvas.getContext('2d');let w,h;function resize(){const r=canvas.getBoundingClientRect();w=r.width;h=r.height;canvas.width=w*devicePixelRatio;canvas.height=h*devicePixelRatio;c.setTransform(devicePixelRatio,0,0,devicePixelRatio,0,0)}new ResizeObserver(resize).observe(canvas);const freq=new Uint8Array(1024),wave=new Uint8Array(2048);function fmt(t){return Math.floor(t/60)+':'+String(Math.floor(t%60)).padStart(2,'0')}

const settings=[['smoothing','Smoothing',0,95,80,1,'Crisp','Fluid'],['speed','Motion speed',25,200,100,5,'Slow','Fast'],['detail','Detail',24,120,64,4,'Minimal','Dense'],['glow','Glow',0,100,40,5,'Off','Soft bloom'],['thickness','Line weight',50,250,100,10,'Fine','Bold'],['spread','Spread',50,100,100,5,'Compact','Wide'],['bass','Bass emphasis',0,100,0,5,'Balanced','Bass heavy'],['waveSmooth','Wave smoothing',0,95,80,5,'Detailed','Silky']];

$('extraSettings').innerHTML=settings.map(([id,label,min,max,value,step,lo,hi])=>`<div class="setting"><div class="section-label">${label}<span id="${id}Value">${id==='speed'?'1×':id==='detail'?value:value+'%'}</span></div><input type="range" id="${id}" aria-label="${label}" min="${min}" max="${max}" value="${value}" step="${step}"><div class="range-label"><span>${lo.toUpperCase()}</span><span>${hi.toUpperCase()}</span></div></div>`).join('');
let panelPreferences={};try{panelPreferences=JSON.parse(localStorage.getItem('melo-panels')||'{}')}catch{}
document.querySelectorAll('[data-panel]').forEach(panel=>{const id=panel.dataset.panel;if(typeof panelPreferences[id]==='boolean')panel.open=panelPreferences[id];panel.addEventListener('toggle',()=>{panelPreferences[id]=panel.open;try{localStorage.setItem('melo-panels',JSON.stringify(panelPreferences))}catch{}})});
settings.forEach(([id])=>$(id).oninput=()=>{const v=+$(id).value;if(id==='smoothing'){smoothing=v/100;if(analyser)analyser.smoothingTimeConstant=smoothing}if(id==='speed')speed=v/100;if(id==='detail')detail=v;if(id==='glow')glow=v/100;if(id==='thickness')thickness=v/100;if(id==='spread')spread=v/100;if(id==='bass')bass=v/100;if(id==='waveSmooth')waveSmooth=v/100;$(id+'Value').textContent=id==='speed'?speed.toFixed(2).replace(/0$/,'')+'×':id==='detail'?v:v+'%'});

const oldReset=$('reset').onclick;$('reset').onclick=()=>{oldReset();settings.forEach(([id,,,,value])=>{$(id).value=value;$(id).oninput()})};

function focusMode(on){document.body.classList.toggle('view-only',on);$('focus').textContent=on?'Show controls':'Hide controls';requestAnimationFrame(resize)}

$('focus').onclick=()=>focusMode(true);$('restore').onclick=()=>focusMode(false);document.addEventListener('keydown',e=>{if(['INPUT','SELECT','TEXTAREA'].includes(document.activeElement.tagName))return;if(e.key==='Escape')focusMode(false);if(e.key.toLowerCase()==='h')focusMode(!document.body.classList.contains('view-only'))});

$('popout').onclick=()=>{if(popup&&!popup.closed){popup.focus();return}popup=window.open('','melo-visualizer','popup=yes,width=960,height=600');if(!popup){$('status').textContent='Allow pop-ups for Melo to open the visualizer in its own window.';return}popup.document.write('<!doctype html><html><head><title>Melo · Visualizer</title><style>html,body{margin:0;overflow:hidden;width:100%;height:100%;background:#1e1e2e}canvas{width:100vw;height:100vh;display:block;object-fit:contain}button{position:fixed;right:18px;top:18px;border:1px solid #45475a;background:#181825;color:#cdd6f4;padding:10px 14px;border-radius:8px;font:12px sans-serif;opacity:0;transition:opacity .2s}body:hover button,button:focus{opacity:1}</style></head><body><canvas aria-label="Live audio visualization"></canvas><button>Fullscreen</button></body></html>');popup.document.close();popup.addEventListener('pagehide',()=>{popup=null;requestAnimationFrame(draw)},{once:true});popCanvas=popup.document.querySelector('canvas');popContext=popCanvas.getContext('2d');popup.document.querySelector('button').onclick=()=>popup.document.fullscreenElement?popup.document.exitFullscreen():popup.document.documentElement.requestFullscreen();$('status').textContent='Visualizer popped out. Keep this tab open for audio and controls.'};

const smoothBins=new Float32Array(128),history=[];let energy=0;

function render(target,width,height,time){const x=width/2,y=height/2,span=width*.8*spread,maxH=Math.min(height*.58,width*.58),radius=Math.min(width,height)*.23*spread,color=palettes[theme][6][accent],n=detail;

 target.clearRect(0,0,width,height);target.lineCap='round';target.lineJoin='round';target.strokeStyle=color;target.fillStyle=color;target.shadowColor=color;target.shadowBlur=glow*22;

 const a=i=>smoothBins[Math.min(127,Math.max(0,Math.floor(i*127/(n-1))))];

 const line=(points,alpha=1,lineWidth=2)=>{target.globalAlpha=alpha;target.lineWidth=lineWidth*thickness;target.beginPath();points.forEach(([px,py],i)=>i?target.lineTo(px,py):target.moveTo(px,py));target.stroke();target.globalAlpha=1};

 const bar=(px,py,bw,bh,alpha=1)=>{target.globalAlpha=alpha;target.beginPath();target.roundRect(px,py,bw,Math.max(2,bh),Math.min(bw/2,3));target.fill();target.globalAlpha=1};

 if(style==='Spectrum'||style==='Mirror'){const gap=span/n*.3,bw=(span-gap*(n-1))/n,left=x-span/2;for(let i=0;i<n;i++){let val=a(style==='Mirror'?Math.abs(i-(n-1)/2)*2:i),bh=Math.max(3,val*maxH);bar(left+i*(bw+gap),y-bh/2,bw,bh,.45+val*.55)}}

 else if(style==='Wave'){const points=[];for(let i=0;i<256;i++){let sample=0;const windowSize=1+Math.floor(waveSmooth*12);for(let j=-windowSize;j<=windowSize;j++)sample+=filteredWave[Math.max(0,Math.min(511,i*2+j))];sample/=windowSize*2+1;points.push([x-span/2+i/255*span,y+sample*maxH*sensitivity*.8])}target.lineWidth=2*thickness;target.beginPath();target.moveTo(...points[0]);for(let i=1;i<points.length-1;i++){const next=points[i+1];target.quadraticCurveTo(...points[i],(points[i][0]+next[0])/2,(points[i][1]+next[1])/2)}target.lineTo(...points[points.length-1]);target.stroke()}

 else if(style==='Orbit'){for(let i=0;i<n;i++){const theta=i/n*Math.PI*2-Math.PI/2,reach=a(i)*radius*.85;line([[x+Math.cos(theta)*(radius-reach*.25),y+Math.sin(theta)*(radius-reach*.25)],[x+Math.cos(theta)*(radius+reach),y+Math.sin(theta)*(radius+reach)]],.8,Math.max(2,radius/n*1.4))}target.shadowBlur=0;target.beginPath();target.arc(x,y,radius*.83,0,Math.PI*2);target.globalAlpha=.14;target.stroke();target.globalAlpha=1}

 else if(style==='Mountains'){for(let layer=3;layer>=0;layer--){const points=[];for(let i=0;i<n;i++){const px=x-span/2+i/(n-1)*span,py=y+maxH*.35-a(i)*maxH*(.6+layer*.16)-Math.sin(i*.15+time*.3+layer)*maxH*.06;points.push([px,py])}target.globalAlpha=.07;target.beginPath();target.moveTo(x-span/2,y+maxH*.35);points.forEach(p=>target.lineTo(...p));target.lineTo(x+span/2,y+maxH*.35);target.closePath();target.fill();line(points,.25+(3-layer)*.18,1.5)}}

 else if(style==='Ribbon'){for(let j=0;j<5;j++){const points=[];for(let i=0;i<180;i++){const f=i/179,env=Math.sin(f*Math.PI);points.push([x-span/2+f*span,y+Math.sin(f*Math.PI*4+time*.6+j*.35)*env*(maxH*.09+energy*maxH*.3)+(j-2)*9])}line(points,.2+j*.16,1.5)}}

 else if(style==='Rings'){for(let j=0;j<6;j++){let points=[];for(let i=0;i<=n;i++){const theta=i/n*Math.PI*2,r=radius*(.35+j*.15)+a(i%n)*radius*.25*Math.sin(theta*3+time*.3+j);points.push([x+Math.cos(theta)*r,y+Math.sin(theta)*r])}line(points,.2+j*.13,1.5)}}

 else if(style==='Spiral'){let points=[];for(let i=0;i<detail*7;i++){const f=i/(detail*7-1),theta=f*Math.PI*9+time*.2,r=radius*f*(1+a(i%n)*.3);points.push([x+Math.cos(theta)*r,y+Math.sin(theta)*r])}line(points,.85,2)}

 else if(style==='Particles'){for(let i=0;i<n*2;i++){const theta=i*2.39996+time*.07*(i%2?1:-1),r=Math.sqrt((i+.5)/(n*2))*radius*1.5*(1+energy*.25),val=a(i%n);target.globalAlpha=.2+val*.8;target.beginPath();target.arc(x+Math.cos(theta)*r,y+Math.sin(theta)*r,1+val*5,0,Math.PI*2);target.fill()}target.globalAlpha=1}

 else if(style==='Flower'){const points=[];for(let i=0;i<=detail*5;i++){const theta=i/(detail*5)*Math.PI*2,r=radius*(.65+.25*Math.cos(theta*6+time*.15))*(1+a(i%n)*.45);points.push([x+Math.cos(theta)*r,y+Math.sin(theta)*r])}line(points,1,2)}

 else if(style==='Lissajous'){for(let j=0;j<3;j++){const points=[];for(let i=0;i<=detail*6;i++){const theta=i/(detail*6)*Math.PI*2;points.push([x+Math.sin(theta*3+time*.15+j*.08)*radius*(1+energy*.4),y+Math.sin(theta*2)*radius*.8])}line(points,.25+j*.25,1.5)}}

 else if(style==='Waterfall'){const rows=history.slice(-32);target.shadowBlur=0;for(let j=0;j<rows.length;j++){const age=(rows.length-1-j)/32,points=[];for(let i=0;i<n;i++){const f=i/(n-1),value=rows[j][Math.floor(f*127)];points.push([x-span/2+f*span,y+maxH*.4-age*maxH*.8-value*maxH*.2])}line(points,.12+(1-age)*.65,1.3)}}

 else if(style==='Aurora'){for(let j=0;j<9;j++){const points=[];for(let i=0;i<160;i++){const f=i/159,env=Math.sin(f*Math.PI);points.push([x-span/2+f*span,y+Math.sin(f*6+time*.35+j*.15)*env*maxH*(.18+energy*.4)+(j-4)*7])}line(points,.12+j*.06,3)}}

 else if(style==='Equalizer'){const columns=Math.min(n,64),step=span/columns,bw=step*.6;for(let i=0;i<columns;i++){const height=Math.max(1,Math.round(a(i*n/columns)*16));for(let j=0;j<height;j++)bar(x-span/2+i*step,y+maxH*.35-j*maxH/20,bw,maxH/28,.25+j/20)}}

 else if(style==='Pulse'){for(let j=0;j<5;j++){const f=(time*.2+j/5)%1;target.beginPath();target.arc(x,y,radius*(.2+f*1.2+energy*.25),0,Math.PI*2);target.lineWidth=(1+energy*4)*thickness;target.globalAlpha=(1-f)*.7;target.stroke()}target.globalAlpha=1}

 else if(style==='Starfield'){for(let i=0;i<n*2;i++){const f=(i/(n*2)+time*.06)%1,theta=i*2.39996,r=f*f*radius*1.6;const px=x+Math.cos(theta)*r,py=y+Math.sin(theta)*r;line([[px,py],[px+Math.cos(theta)*(2+energy*20)*f,py+Math.sin(theta)*(2+energy*20)*f]],f,1+f)}}

 else if(style==='Helix'){for(let i=0;i<n;i++){const f=i/(n-1),theta=f*Math.PI*5+time*.5,dx=Math.sin(theta)*radius*.6*(.5+a(i)),py=y-maxH/2+f*maxH;line([[x-dx,py],[x+dx,py]],.18,1);for(let sign of [-1,1]){target.beginPath();target.arc(x+dx*sign,py,2+a(i)*3,0,Math.PI*2);target.fill()}}}

 else if(style==='Dots'){const cols=Math.ceil(Math.sqrt(n*2)),rows=8;for(let row=0;row<rows;row++)for(let col=0;col<cols;col++){const value=a(col*n/cols),on=row<value*rows;target.globalAlpha=on?.8:.1;target.beginPath();target.arc(x-span/2+col/(cols-1)*span,y+(row-(rows-1)/2)*Math.min(18,maxH/10),on?3.5:2,0,Math.PI*2);target.fill()}target.globalAlpha=1}

 target.globalAlpha=1;target.shadowBlur=0;

}

function draw(t){(popup&&!popup.closed?popup:window).requestAnimationFrame(draw);const dt=Math.min(.05,(t-lastFrame)/1000||.016);lastFrame=t;if(playing)phase+=dt*speed;

 if(analyser&&playing){analyser.smoothingTimeConstant=smoothing;analyser.getByteFrequencyData(freq);analyser.getByteTimeDomainData(wave)}

 for(let i=0;i<512;i++){const value=playing?(wave[i*3]/128-1):Math.sin(i*.025+phase*.6)*.1;filteredWave[i]+=(value-filteredWave[i])*Math.max(.04,1-waveSmooth*.95)}

 let total=0;for(let i=0;i<128;i++){const bin=Math.min(900,Math.floor(2*Math.pow(400,i/127)));let sum=0,count=0;for(let j=bin;j<=Math.min(1023,bin+Math.max(1,Math.floor(bin*.08)));j++){sum+=freq[j]||0;count++}const val=playing?Math.min(1,Math.pow(sum/count/255,.85)*(sensitivity*2+.25)*(1+bass*(1-i/127)*1.5)):.045+Math.pow(Math.sin(i*.13),2)*.09;smoothBins[i]+=(val-smoothBins[i])*Math.min(1,dt*(playing?16:7));total+=smoothBins[i]}energy=total/128;

 if(!draw.lastHistory||t-draw.lastHistory>50/Math.max(.25,speed)){history.push(Float32Array.from(smoothBins));if(history.length>32)history.shift();draw.lastHistory=t}

 if(w&&h)render(c,w,h,phase);

 if(popup&&!popup.closed&&popCanvas){const pw=popup.innerWidth,ph=popup.innerHeight,dpr=Math.min(2,popup.devicePixelRatio||1);if(popCanvas.width!==Math.round(pw*dpr)||popCanvas.height!==Math.round(ph*dpr)){popCanvas.width=Math.round(pw*dpr);popCanvas.height=Math.round(ph*dpr)}popContext.setTransform(dpr,0,0,dpr,0,0);popup.document.body.style.background=palettes[theme][0];render(popContext,pw,ph,phase)}

 if(playing){const time=source==='file'?audio.currentTime:source==='demo'?ctx.currentTime-start:0;$('elapsed').textContent=fmt(time);if(source==='file'&&Number.isFinite(audio.duration)){$('duration').textContent=fmt(audio.duration);$('seek').value=audio.currentTime/audio.duration*100}else{$('duration').textContent=(source==='mic')?'LIVE':'∞';$('seek').value=0}}

}requestAnimationFrame(draw);