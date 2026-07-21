// Página de control que sirve el propio puente en http://localhost:4000
// Misma-origen: no hay bloqueos de HTTPS->localhost ni de CORS/PNA. Funciona en
// cualquier navegador y sistema operativo. Autónoma (no requiere el sitio en Vercel).
// IMPORTANTE: el <script> del cliente NO usa template literals (${}) para no chocar
// con este template literal exterior.

export const CONSOLE_HTML = `<!doctype html>
<html lang="es">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>GOCAS Live · Puente</title>
<style>
  :root{--olive:#3d4a2a;--olive-deep:#2b331d;--olive-soft:#6b7553;--amber:#d97a3c;--amber-soft:#e08b52;--bg:#f5f1e8;--surface:#fffdf9;--surface2:#efe9dc;--ink:#23301a;--muted:#6f7860;--line:#e2d9c6;--danger:#b0472c;}
  *{box-sizing:border-box;margin:0;padding:0}
  body{font-family:'Manrope',system-ui,Segoe UI,sans-serif;background:var(--bg);color:var(--ink);line-height:1.5;padding:0 0 60px}
  .wrap{max-width:1080px;margin:0 auto;padding:0 20px}
  header{border-bottom:1px solid var(--line);background:rgba(245,241,232,.85);backdrop-filter:blur(8px);position:sticky;top:0;z-index:5}
  .hrow{display:flex;align-items:center;justify-content:space-between;height:62px}
  .brand{font-family:ui-monospace,monospace;font-weight:600;font-size:17px;color:var(--olive);letter-spacing:.02em}
  .brand b{color:var(--amber);font-weight:600}
  .brand small{font-size:10px;letter-spacing:.22em;text-transform:uppercase;color:var(--muted);margin-left:6px}
  .conn{display:inline-flex;align-items:center;gap:7px;font-family:ui-monospace,monospace;font-size:11px;letter-spacing:.1em;text-transform:uppercase;color:var(--muted);border:1px solid var(--line);background:var(--surface2);padding:5px 11px;border-radius:999px}
  .dot{width:8px;height:8px;border-radius:50%;background:#b8ac93}
  .dot.on{background:var(--olive)}
  .dot.pulse{animation:p 1.5s ease-in-out infinite}
  @keyframes p{0%,100%{opacity:1}50%{opacity:.35}}
  h1{font-size:26px;color:var(--olive);letter-spacing:-.02em;margin:34px 0 6px}
  .lead{color:var(--muted);font-size:15px;max-width:640px;margin-bottom:26px}
  .card{background:var(--surface);border:1px solid var(--line);border-radius:18px;box-shadow:0 6px 20px rgba(43,51,29,.07);padding:22px;margin-bottom:20px}
  .card h2{font-size:18px;color:var(--olive)}
  .badge{display:inline-flex;align-items:center;gap:7px;font-family:ui-monospace,monospace;font-size:11px;letter-spacing:.08em;text-transform:uppercase;padding:5px 11px;border-radius:999px;border:1px solid var(--line);color:var(--muted);background:var(--surface2)}
  .badge.live{background:var(--danger);color:#fff;border-color:transparent}
  .badge.prev{background:var(--olive);color:#fff;border-color:transparent}
  .grid{display:grid;grid-template-columns:1fr 320px;gap:22px;align-items:start;margin-top:16px}
  @media(max-width:720px){.grid{grid-template-columns:1fr}}
  label{display:block;margin-bottom:12px}
  label span{display:block;font-size:12.5px;font-weight:600;color:var(--olive);margin-bottom:5px}
  input[type=text],input[type=password],select{width:100%;font-family:inherit;font-size:14px;color:var(--ink);background:var(--surface);border:1px solid var(--line);border-radius:9px;padding:10px 12px}
  input.mono{font-family:ui-monospace,monospace}
  input:focus,select:focus{outline:none;border-color:var(--amber)}
  input[type=range]{width:100%;accent-color:var(--amber)}
  .hint{font-size:12px;color:var(--muted);margin-top:4px}
  .frame{position:relative;width:100%;aspect-ratio:16/9;background:#14180d;border-radius:12px;overflow:hidden;border:1px solid var(--olive-deep)}
  .frame .ph{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;color:#8b9378;font-family:ui-monospace,monospace;font-size:11px;letter-spacing:.14em}
  .frame img.wm{position:absolute;pointer-events:none;height:auto}
  .frame video{position:absolute;inset:0;width:100%;height:100%;background:#000}
  .btns{display:flex;gap:9px;flex-wrap:wrap;margin-top:6px}
  button{font-family:inherit;font-weight:600;font-size:14px;padding:10px 17px;border-radius:999px;border:1px solid transparent;cursor:pointer;transition:.15s}
  button:disabled{opacity:.45;cursor:not-allowed}
  .b-amber{background:var(--amber);color:#fff}.b-amber:hover:not(:disabled){background:var(--amber-soft)}
  .b-olive{background:var(--olive);color:#f4efe2}.b-olive:hover:not(:disabled){background:var(--olive-deep)}
  .b-ghost{background:var(--surface);color:var(--olive);border-color:var(--line)}
  .b-danger{background:transparent;color:var(--danger);border-color:var(--line)}
  .msg{font-size:13px;margin-top:8px}
  .msg.err{color:var(--danger)}
  .log{font-family:ui-monospace,monospace;font-size:11.5px;line-height:1.5;background:var(--olive-deep);color:#cdd6bd;border-radius:9px;padding:11px 12px;max-height:150px;overflow:auto;white-space:pre-wrap;word-break:break-word;margin-top:12px}
  .thumb{max-width:120px;max-height:60px;margin-top:8px;border:1px solid var(--line);border-radius:6px;background:#222;padding:4px;display:none}
  footer{color:var(--muted);font-family:ui-monospace,monospace;font-size:11px;text-align:center;margin-top:30px}
</style>
</head>
<body>
<header><div class="wrap hrow">
  <span class="brand">[ <b>GOCAS</b> ] <small>puente</small></span>
  <span class="conn"><span class="dot" id="conndot"></span><span id="conntxt">Comprobando…</span></span>
</div></header>

<div class="wrap">
  <h1>Control de transmisión</h1>
  <p class="lead">Sube tu logo, pega la URL RTSP de tu cámara y la clave de retransmisión de tu YouTube Live, y transmite con tu marca de agua incrustada. Esta página corre en tu equipo; deja la ventana del puente abierta.</p>
  <div id="streams"></div>
  <footer>GOCAS Automations · el puente corre en tu equipo · las credenciales no se guardan</footer>
</div>

<template id="card-tpl">
  <div class="card">
    <div style="display:flex;align-items:center;justify-content:space-between;gap:12px">
      <h2 class="ctitle">Transmisión</h2>
      <span class="badge st">Detenido</span>
    </div>
    <div class="grid">
      <div class="col-left">
        <label><span>URL RTSP de la cámara</span>
          <input type="text" class="mono rtsp" placeholder="rtsp://usuario:clave@192.168.1.10:554/stream1" autocomplete="off" spellcheck="false"></label>
        <div style="display:flex;gap:10px">
          <label style="flex:1"><span>Clave de retransmisión de YouTube</span>
            <input type="password" class="mono ykey" placeholder="xxxx-xxxx-xxxx-xxxx" autocomplete="off" spellcheck="false"></label>
          <label style="width:130px"><span>Audio</span>
            <select class="audio"><option value="camera">De la cámara</option><option value="silent">Silencio</option></select></label>
        </div>
        <div class="btns">
          <button class="b-olive bprev">Preview local</button>
          <button class="b-amber bgo">Transmitir a YouTube</button>
          <button class="b-danger bstop" style="display:none">Detener</button>
        </div>
        <div class="msg"></div>
        <div class="log" style="display:none"></div>
      </div>
      <div class="col-right">
        <div class="frame">
          <div class="ph">TU VIDEO</div>
          <img class="wm" style="display:none" alt="">
          <video class="prevvid" controls autoplay muted playsinline style="display:none"></video>
        </div>
        <label style="margin-top:12px"><span>Marca de agua (PNG con transparencia)</span>
          <input type="file" class="wmfile" accept="image/png,image/webp,image/jpeg"></label>
        <img class="thumb">
        <label><span>Posición</span>
          <select class="pos"><option value="bottom-right">Abajo derecha</option><option value="bottom-left">Abajo izquierda</option><option value="top-right">Arriba derecha</option><option value="top-left">Arriba izquierda</option><option value="center">Centro</option></select></label>
        <label><span>Tamaño · <b class="szval">15</b>%</span>
          <input type="range" class="size" min="5" max="100" value="15"></label>
        <label><span>Opacidad · <b class="opval">85</b>%</span>
          <input type="range" class="op" min="20" max="100" step="5" value="85"></label>
        <label style="margin-bottom:0"><span>Margen · <b class="mgval">24</b>px</span>
          <input type="range" class="mg" min="0" max="120" step="2" value="24"></label>
      </div>
    </div>
  </div>
</template>

<script src="https://cdn.jsdelivr.net/npm/hls.js@1"></script>
<script>
(function(){
  var STREAMS=[{id:'stream-1',label:'Transmisión 1'},{id:'stream-2',label:'Transmisión 2'}];
  var tpl=document.getElementById('card-tpl');
  var host=document.getElementById('streams');

  function posStyle(pos,scale,op,mg){
    var w=Math.round(scale*100)+'%';
    var s='position:absolute;pointer-events:none;height:auto;width:'+w+';opacity:'+op+';';
    var m=mg+'px';
    if(pos==='top-left')return s+'top:'+m+';left:'+m+';';
    if(pos==='top-right')return s+'top:'+m+';right:'+m+';';
    if(pos==='bottom-left')return s+'bottom:'+m+';left:'+m+';';
    if(pos==='center')return s+'top:50%;left:50%;transform:translate(-50%,-50%);';
    return s+'bottom:'+m+';right:'+m+';';
  }

  function makeCard(stream){
    var card=tpl.content.firstElementChild.cloneNode(true);
    card.querySelector('.ctitle').textContent=stream.label;
    var q=function(sel){return card.querySelector(sel)};
    var state={wm:null,hls:null,active:false};

    var wmImg=q('.wm'),thumb=q('.thumb'),vid=q('.prevvid'),ph=q('.ph');
    function refreshWm(){
      var pos=q('.pos').value,scale=q('.size').value/100,op=q('.op').value/100,mg=Number(q('.mg').value);
      q('.szval').textContent=Math.round(scale*100);q('.opval').textContent=Math.round(op*100);q('.mgval').textContent=mg;
      if(state.wm){wmImg.src=state.wm;wmImg.setAttribute('style',posStyle(pos,scale,op,mg)+'display:block');}
      else{wmImg.style.display='none';}
    }
    ['.pos','.size','.op','.mg'].forEach(function(s){q(s).addEventListener('input',refreshWm)});

    q('.wmfile').addEventListener('change',function(){
      var f=q('.wmfile').files[0];
      if(!f){state.wm=null;thumb.style.display='none';refreshWm();return;}
      if(f.size>3*1024*1024){setMsg('La imagen supera 3 MB.',true);return;}
      var r=new FileReader();
      r.onload=function(){state.wm=r.result;thumb.src=r.result;thumb.style.display='block';refreshWm();};
      r.readAsDataURL(f);
    });

    function setMsg(t,err){var m=q('.msg');m.textContent=t||'';m.className='msg'+(err?' err':'');}

    function setBadge(status){
      var b=q('.st');var map={idle:['Detenido',''],starting:['Iniciando',''],preview:['Preview','prev'],live:['En vivo','live'],restarting:['Reconectando','prev'],error:['Error','']};
      var m=map[status]||map.idle;b.textContent=m[0];b.className='badge '+m[1];
    }

    function showPreview(on){
      if(on){
        vid.style.display='block';ph.style.display='none';wmImg.style.display='none';
        var url=location.origin+'/hls/'+stream.id+'/index.m3u8';
        if(window.Hls&&window.Hls.isSupported()){
          if(state.hls)state.hls.destroy();
          state.hls=new window.Hls({liveSyncDurationCount:3,manifestLoadingMaxRetry:12,manifestLoadingRetryDelay:1000});
          state.hls.loadSource(url);state.hls.attachMedia(vid);
        }else if(vid.canPlayType('application/vnd.apple.mpegurl')){vid.src=url;}
      }else{
        vid.style.display='none';ph.style.display='flex';
        if(state.hls){state.hls.destroy();state.hls=null;}
        vid.removeAttribute('src');refreshWm();
      }
    }

    function setActive(a,mode){
      state.active=a;
      q('.rtsp').disabled=a;q('.ykey').disabled=a;q('.audio').disabled=a;q('.wmfile').disabled=a;
      q('.bprev').style.display=a?'none':'';q('.bgo').style.display=a?'none':'';q('.bstop').style.display=a?'':'none';
      showPreview(a&&mode==='preview');
    }

    function start(mode){
      setMsg('');
      var rtsp=q('.rtsp').value.trim(),ykey=q('.ykey').value.trim();
      if(!rtsp){setMsg('Pega la URL RTSP de tu cámara.',true);return;}
      if(mode==='youtube'&&!ykey){setMsg('Pega la clave de retransmisión de YouTube.',true);return;}
      var body={mode:mode,rtspUrl:rtsp,streamKey:ykey,watermarkData:state.wm,position:q('.pos').value,opacity:q('.op').value/100,scale:q('.size').value/100,margin:Number(q('.mg').value),audio:q('.audio').value,videoBitrate:'4500k'};
      q('.bprev').disabled=true;q('.bgo').disabled=true;
      fetch('/api/streams/'+stream.id+'/start',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)})
        .then(function(r){return r.json().then(function(d){return{ok:r.ok,d:d}})})
        .then(function(res){
          q('.bprev').disabled=false;q('.bgo').disabled=false;
          if(!res.ok){setMsg(res.d.error||'No se pudo iniciar.',true);return;}
          setActive(true,mode);setBadge(res.d.status.status);
          setMsg(mode==='youtube'?'Transmitiendo a YouTube.':'Preview local iniciado.',false);
        }).catch(function(){q('.bprev').disabled=false;q('.bgo').disabled=false;setMsg('Error de conexión con el puente.',true);});
    }
    function stop(){
      fetch('/api/streams/'+stream.id+'/stop',{method:'POST'}).then(function(){setActive(false);setBadge('idle');setMsg('');});
    }
    q('.bprev').addEventListener('click',function(){start('preview')});
    q('.bgo').addEventListener('click',function(){start('youtube')});
    q('.bstop').addEventListener('click',stop);

    function poll(){
      fetch('/api/streams/'+stream.id+'/status').then(function(r){return r.json()}).then(function(d){
        var s=d.status;if(!s)return;
        setBadge(s.status);
        var a=s.status!=='idle'&&s.status!=='error';
        if(a!==state.active)setActive(a,s.mode);
        if(s.status==='error'&&s.lastError)setMsg(s.lastError,true);
        var log=q('.log');
        if(a&&s.logTail&&s.logTail.length){log.style.display='block';log.textContent=s.logTail.join('\\n');}
        else log.style.display='none';
      }).catch(function(){});
    }
    setInterval(poll,3000);
    refreshWm();
    host.appendChild(card);
  }
  STREAMS.forEach(makeCard);

  function health(){
    fetch('/health').then(function(r){return r.json()}).then(function(){
      document.getElementById('conndot').className='dot on pulse';
      document.getElementById('conntxt').textContent='Puente activo';
    }).catch(function(){
      document.getElementById('conndot').className='dot';
      document.getElementById('conntxt').textContent='Sin conexión';
    });
  }
  health();setInterval(health,5000);
})();
</script>
</body>
</html>`;
