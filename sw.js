/* Offline cache for Polyorbit.
   Bump CACHE whenever you redeploy, or phones will keep serving the old app. */
var CACHE = "polyrhythm-v112";
/* proof that a response really is this app and not a host's error page */
var MARK = "polyrhythm-circle:session";
var ASSETS = [
  "./",
  "./index.html",
  "./manifest.json",
  "./icon-192.png",
  "./icon-512.png",
  "./icon-512-maskable.png",
  "./apple-touch-icon.png"
];

self.addEventListener("install", function(e){
  e.waitUntil(
    caches.open(CACHE)
      .then(function(c){ return c.addAll(ASSETS); })
      .then(function(){ return self.skipWaiting(); })
  );
});

self.addEventListener("activate", function(e){
  e.waitUntil(
    caches.keys()
      .then(function(keys){
        return Promise.all(keys.filter(function(k){ return k !== CACHE; })
                              .map(function(k){ return caches.delete(k); }));
      })
      .then(function(){ return self.clients.claim(); })
  );
});

self.addEventListener("fetch", function(e){
  var req = e.request;
  if(req.method !== "GET") return;

  /* The page itself goes network-first, so a redeploy appears on the next launch
     instead of waiting for a cache-version bump; the cache is the offline
     fallback. (Cache-first here is the classic "I uploaded a fix and my phone
     still shows the old app" trap.) */
  /* Only the app's own page gets the app-shell treatment. Claiming every
     document on the origin meant any other page hosted alongside it was
     answered with the app instead of itself. */
  var isAppPage = false;
  try{
    var u = new URL(req.url);
    var sc = new URL(self.registration.scope);
    isAppPage = (u.origin === sc.origin) &&
      (u.pathname === sc.pathname || u.pathname === sc.pathname + "index.html");
  } catch(err){ isAppPage = true; }   /* if in doubt, behave as before */

  if(isAppPage && (req.mode === "navigate" || req.destination === "document")){
    /* Cache first, refresh behind: the installed copy answers at once and the
       network copy, checked in the background, replaces it for the NEXT launch.
       It used to be network-first with no time limit, and on a phone whose
       connection is slow or half-asleep the launch waited on a 700 KB download
       while Android showed the splash screen - Oscar had to kill the app and
       reopen it. A redeploy still arrives by itself: the cache-name bump installs
       a new worker that fetches the new page, and a same-version upload is picked
       up one launch later. */
    var refresh = fetch(req.url, {cache:"no-cache", credentials:"same-origin"}).then(function(res){
      /* A host that has expired, been deleted or misconfigured still answers -
         with ITS error page, which is a perfectly valid HTTP response. Taking
         that at face value served the error instead of the app AND overwrote
         the offline copy with it, so the installed app died along with the
         link. Nothing replaces the cache unless it really is the app. */
      if(!res || !res.ok) throw new Error("http " + (res && res.status));
      var type = res.headers.get("content-type") || "";
      if(type.indexOf("html") < 0) throw new Error("not html");
      return res.text().then(function(body){
        if(body.indexOf(MARK) < 0) throw new Error("not this app");
        var make = function(){ return new Response(body, {headers: {"Content-Type": "text/html; charset=utf-8"}}); };
        return caches.open(CACHE).then(function(c){ return c.put("./index.html", make()); }).catch(function(){}).then(make);
      });
    });
    e.respondWith(
      caches.match("./index.html").then(function(hit){
        if(hit){ e.waitUntil(refresh.catch(function(){})); return hit; }
        return refresh.catch(function(){ return caches.match("./"); });
      })
    );
    return;
  }

  /* Everything else is cache-first: icons, and the Google Fonts files, so the
     type survives going offline after one online run. */
  e.respondWith(
    caches.match(req).then(function(hit){
      if(hit) return hit;
      return fetch(req).then(function(res){
        var copy = res.clone();
        caches.open(CACHE).then(function(c){ c.put(req, copy); }).catch(function(){});
        return res;
      }).catch(function(){
        return caches.match("./index.html");
      });
    })
  );
});
