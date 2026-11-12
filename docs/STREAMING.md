# Streaming: Apple Music and Spotify

**Short version: both can be played in the app. Neither can be mixed.**

This was researched on 2026-11-11. Terms and SDKs change, so the spike at the bottom re-checks
everything before any of this is built.

## Why a streamed song cannot go on a deck

Two separate walls, and either one alone would be enough.

### 1. The audio is locked

Both services send encrypted audio that the browser decrypts inside a protected path. A web
app can tell the player to start, stop and seek. It never receives the samples.

Everything a deck does needs the samples: EQ, effects, scratching, key lock, waveforms, BPM
detection, recording. Routing the protected player into the Web Audio API does not work; there
are long-standing WebKit bug reports of exactly that producing no effect on protected streams.

### 2. The terms forbid it

- **Spotify.** The Developer Policy lists DJ-style use among prohibited applications: an app
  must not "segue, mix, re-mix, or overlap any Spotify Content with any other audio content".
  That covers crossfading into another song and playing a sound pad over the top.
- **Apple.** The MusicKit terms in the Apple Developer Program License Agreement do not allow
  MusicKit content to be modified, or synchronised with other content, unless Apple's
  documentation permits it. Beat-matching is synchronising; EQ is modifying. (We read this
  wording in a third-party copy and in developer-forum threads quoting it. Confirm against the
  current agreement during the spike.)

### How the big DJ apps do it

They have licensing deals, not a better API.

- Apple launched "DJ with Apple Music" in March 2025 with rekordbox, Serato, Engine DJ, djay
  and hardware from several manufacturers.
- Spotify returned to DJ software in September 2025 for Premium users in rekordbox, Serato and
  djay.

Developers asking Apple on its forums whether the public MusicKit API offers two-deck control
or a way to feed subscription audio into their own engine have not been pointed to one.
Applying to those programmes is a business conversation for a finished product, not something
this codebase can assume.

## What we build instead: the jukebox

A listening tab beside the decks, the same for both services:

- Sign in, browse your own library and playlists, search.
- Play one song at a time through the service's own player: play, pause, seek, volume, next.
- While a jukebox song plays, the decks and pads are silent. The app enforces this
  (`overlap: false` in `src/sources/registry.ts`, guarded by a test).
- Every song shows why it cannot be loaded to a deck, and where a mixable copy can be bought.

It is useful for choosing what to play next and for kids who just want to hear a song. It is
not DJing, and the app should never pretend otherwise.

## What does get full decks

Files you own, which is more of a typical Apple library than people expect:

- **iTunes Store purchases.** Sold without copy protection since 2009; they are ordinary
  `.m4a` files.
- CD rips, and purchases from Bandcamp, Beatport, Amazon and similar shops.
- Your own recordings.

Not included: songs downloaded for offline listening with an Apple Music or Spotify
subscription. Those are protected files and will not decode.

Getting files into the app:

- **Mac or Windows:** drag them in from the Music / iTunes media folder, or use the file picker.
- **iPhone and iPad:** the file picker opens the Files app. A web app cannot see the Music
  app's library, so purchased songs need to be in Files or iCloud Drive first.
- **Android:** the file picker opens the device's storage.

## What each service needs

### Apple Music

- An Apple Developer Program membership (paid, yearly) to create a MusicKit identifier and key.
- A developer token: a short-lived signed token the web player presents to Apple. It is signed
  with a private key, so it is minted by a small server-side function
  (`services/apple-music-token`), never in the browser.
- Each listener signs in with their own Apple Music subscription.

### Spotify

- An app registered in the Spotify developer dashboard. Sign-in uses Authorization Code with
  PKCE, which needs no secret and therefore no backend.
- The app will live in Spotify's **Development Mode**, which as of 2026 means: the app owner
  must have Spotify Premium, and only **five** named Spotify accounts can use it. Lifting that
  limit is reserved for established businesses with a large audience, so for this project
  Spotify is a family-and-friends feature.
- Each listener needs Spotify Premium (the mobile-only plans do not work with the web player).
- Spotify's documentation lists Android and iOS mobile browsers as supported by the Web
  Playback SDK.

## Spike: answer these before building Milestone 7

Small throwaway pages, tested on the family's real devices.

1. **Apple Music on iPhone/iPad:** does volume control work? (Mobile Safari normally ignores
   volume set by a page.) Does playback continue with the screen locked in the installed app?
2. **Apple Music, everywhere:** how long does sign-in last, and what does a non-subscriber see?
3. **Spotify on Android Chrome, installed as an app:** does the Web Playback SDK start
   reliably, and what gesture does it need?
4. **Spotify Development Mode:** which library and playlist endpoints are still available
   after the 2026 changes?
5. **Both:** re-read the current terms. In particular, is a visualiser or a "song is playing"
   animation acceptable alongside playback?
6. **Decision:** given the answers, is the jukebox worth its upkeep? If not, cut it and put a
   "buy this song to mix it" link in its place.

## Sources

- Spotify Developer Policy: <https://developer.spotify.com/policy/>
- Spotify compliance guidance: <https://developer.spotify.com/compliance-tips>
- Spotify Web Playback SDK: <https://developer.spotify.com/documentation/web-playback-sdk>
- Spotify, February 2026 Development Mode changes:
  <https://developer.spotify.com/documentation/web-api/tutorials/february-2026-migration-guide>
- Spotify, July 2026 quota update: <https://developer.spotify.com/blog/2026-07-23-web-api-quota-updates>
- Spotify Premium in DJ software (September 2025):
  <https://newsroom.spotify.com/2025-09-24/dj-software-integration-premium>
- Apple agreements and guidelines: <https://developer.apple.com/terms/apple-music-api/>
- Apple Developer Forums, "Apple Music real-time DJ mixing: is there an API or entitlement
  beyond MusicKit?": <https://developer.apple.com/forums/thread/843627>
- Apple Developer Forums, MusicKit JS and section 3.3.6(D):
  <https://developer.apple.com/forums/thread/838157>
- DJ with Apple Music launch coverage: <https://macrumors.com/2025/03/25/dj-with-apple-music>
- WebKit bug 227388, Web Audio with protected streams: <https://bugs.webkit.org/show_bug.cgi?id=227388>
