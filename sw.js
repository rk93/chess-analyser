const CACHE='chess-analyser-pages-v84';
const CORE=['./','./index.html','./css/styles.css','./css/fixes.css','./review-experience.css','./review-pro.css','./css/analytics.css','./css/top-players.css','./explorer.css','./puzzles.css','./ux-shell.css','./js/app.js','./js/enhancements.js','./js/pgn-analyzer.js','./js/ux-shell.js','./js/settings-fix.js','./js/lab.js','./js/auto-analysis.js','./js/analysis-recovery.js','./js/opening-insights.js','./js/game-review.js','./js/review-tactics.js','./js/review-quality.js','./js/review-scoring.js','./js/review-v2-core.js','./js/review-display.js','./js/review-corrections.js','./js/local-stockfish.js','./js/lichess-review.js','./js/review-summary-navigation.js','./js/review-context.js','./js/review-reliability.js','./js/review-pro.js','./js/review-polish.js','./js/review-perspective-fix.js','./js/import-fix.js','./js/position-setup.js','./js/analytics.js','./js/top-players.js','./js/explorer.js','./js/puzzles.js','./js/analysis-store.js','./engine/stockfish-19-lite-single.js','./engine/stockfish-19-lite-single.wasm','./engine/stockfish.wasm','./manifest.webmanifest','./icons/icon-192.svg','./icons/icon-512.svg','./icons/icon-maskable-192.svg','./icons/icon-maskable-512.svg'];
const SHELL=['./','./index.html','./css/styles.css','./ux-shell.css','./js/app.js','./js/ux-shell.js'];
self.addEventListener('install',event=>{
  // Shell failure must not prevent the updated worker from installing.
  event.waitUntil(caches.open(CACHE).then(async cache=>{
    await Promise.allSettled(SHELL.map(path=>cache.add(path)));
    // Download remaining files opportunistically; failures stay retryable
    // through the runtime cache rather than breaking the entire install.
    const optional=CORE.filter(path=>!SHELL.includes(path));
    for(let i=0;i<optional.length;i+=6){
      await Promise.allSettled(optional.slice(i,i+6).map(path=>cache.add(path)));
    }
    await self.skipWaiting();
  }));
});
self.addEventListener('activate',event=>event.waitUntil((async()=>{
  await Promise.all((await caches.keys()).filter(k=>k.startsWith('chess-analyser-pages-')&&k!==CACHE).map(k=>caches.delete(k)));
  await self.clients.claim();
})()));
self.addEventListener('fetch',event=>{
  const req=event.request;
  if(req.method!=='GET')return;
  const url=new URL(req.url);
  // Never intercept or cache Chess.com/Lichess/CDN/API responses; their
  // privacy, permissions, freshness and error handling belong to the caller.
  if(url.origin!==self.location.origin)return;
  if(req.mode==='navigate'){
    event.respondWith((async()=>{
      try{
        const response=await fetch(req);
        if(response.ok){const cache=await caches.open(CACHE);void cache.put(req,response.clone()).catch(()=>{});}
        return response;
      }catch{
        return (await caches.match(req))||(await caches.match('./index.html'))||
          new Response('Offline: reopen Chess Analyser after connecting to the internet.',{status:503,headers:{'Content-Type':'text/plain'}});
      }
    })());
    return;
  }
  // Cache-first for versioned engine binaries and image assets. JS/CSS must
  // revalidate online to avoid running stale code after a GitHub Pages deploy.
  const revalidate=/\\.(?:js|css|html)$/i.test(url.pathname);
  event.respondWith((async()=>{
    const cached=await caches.match(req);
    if(!revalidate&&cached)return cached;
    try{
      const response=await fetch(req,revalidate?{cache:'no-cache'}:{});
      if(response.ok&&response.type==='basic'){
        const cache=await caches.open(CACHE);
        void cache.put(req,response.clone()).catch(()=>{});
      }
      return response;
    }catch{
      return cached||new Response('Offline asset unavailable',{status:503});
    }
  })());
});
