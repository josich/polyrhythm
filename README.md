# Polyrhythm Circle — installing it on a phone

Two copies, for two different jobs.

## 1. `polyrhythm-offline.html` — the one that cannot break

One file, nothing outside it: the icons and both typefaces are embedded, so it
needs no server and no connection, ever. Copy it to the phone and open it from
Files or Downloads.

What you give up: a browser can only install an app from a real address, so this
one opens in a browser tab rather than as its own app with an icon. Keep it as
the copy that always works.

## 2. `pwa/` — the installable app

Upload this folder to a host that serves it over https, open the address on the
phone, then use Install.

**The address has to keep working.** Netlify Drop links expire unless the site is
claimed into an account, and once the address dies the app can no longer update.
Somewhere permanent and free:

- **GitHub Pages** — make a repository, put these files at its root, then
  Settings → Pages → Deploy from branch → `main` / root. The address
  `https://<user>.github.io/<repo>/` does not expire.
- **Netlify** — sign in first, then drag the folder in, so the site belongs to
  your account rather than being an anonymous drop.
- **Cloudflare Pages** — same idea, connect a repository.

### After every rebuild

`sh build-pwa.sh` writes `pwa/index.html`, then bump `CACHE` in `pwa/sw.js`
(`polyrhythm-v10` → `v11`) and re-upload. Installed phones pick the new version
up on the next launch.

### Why a dead link used to break the installed app

The service worker asked the network for the page first, so a fix appeared
without waiting for a cache bump. But a host that has expired still *answers* —
with its own "site not found" page, which is a perfectly valid HTTP response.
The worker took it at face value: it served the error instead of the app and
overwrote the offline copy with it, so the installed app died along with the
address.

It now only accepts a response as the app if it arrives with a success status,
is HTML, and contains a string only this app contains. Anything else falls back
to the cached copy, so a dead or misconfigured host can no longer take the app
with it.
