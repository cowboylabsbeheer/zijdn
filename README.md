# ZIJDN website

Een scroll-site voor ZIJDN (Floor van der Zijden), gehost als Cloudflare Worker met een contactformulier dat mails naar haar inbox stuurt.

```
zijdn/
├── public/          ← de site zelf (statische bestanden)
│   ├── index.html
│   ├── 404.html
│   └── floor.jpg
├── src/index.js     ← de Worker: serveert de site + verwerkt /api/contact
└── wrangler.jsonc   ← configuratie
```

## 1. In je bestaande project zetten

- Vervang `src/index.js` door deze versie.
- Zet de map `public/` naast `src/`.
- Neem de onderdelen `assets`, `send_email` en `vars` over in je eigen `wrangler.jsonc` (of gebruik dit bestand en zet je eigen `name` en `compatibility_date` terug).

## 2. Mail instellen (Cloudflare Email Routing)

1. Ga in het Cloudflare-dashboard naar **zijdn.nl → Email → Email Routing** en zet het aan, als dat nog niet gebeurd is.
2. Bij **Destination addresses** moet de echte inbox van Floor staan (bijv. haar Gmail) en die moet **geverifieerd** zijn.
3. Stel de catch-all (of in elk geval `info@zijdn.nl`) in om door te sturen naar die inbox.
4. Vul in `wrangler.jsonc` op **twee plekken** dat geverifieerde adres in (`destination_address` en `MAIL_TO`).

Let op: de Worker mag alleen mailen naar een geverifieerd adres. `info@zijdn.nl` werkt daar dus niet; gebruik het echte inbox-adres. De mail komt binnen van `website@zijdn.nl` (daar hoeft geen mailbox achter te zitten), met de bezoeker als Reply-To. Als Floor op **Beantwoorden** klikt, gaat haar antwoord dus direct naar de afzender.

## 3. Testen en live zetten

```bash
npm run dev      # lokaal: http://localhost:8787 (mail wordt lokaal gesimuleerd)
npm run deploy   # live
```

Domein koppelen: haal de `//` weg bij `routes` in `wrangler.jsonc`, of ga naar **Workers → zijdn → Settings → Domains & Routes** en voeg `zijdn.nl` en `www.zijdn.nl` toe.

## Spambescherming

- Een verborgen honeypot-veld (bots vullen het in, mensen niet)
- Formulieren die binnen 2,5 seconden worden ingestuurd, worden genegeerd
- Alleen POSTs vanaf het eigen domein worden geaccepteerd

Komt er toch spam binnen, dan is Cloudflare Turnstile de volgende stap.

## Nog doen

- **KvK-nummer**: zet het in de footer van `public/index.html` (daar staat een commentaarregel voor). Een zakelijke website hoort het KvK-nummer te tonen.
- **Teksten**: alle teksten staan gewoon in `public/index.html`, en Floor kan ze zelf aanpassen.

## Leuk om te weten

- De discobal is klikbaar: dan volgt er een feestje met confetti. Dat gebeurt ook als het formulier verstuurd is.
- De klok linksonder loopt mee met het scrollen, van 12:00 load-in tot 04:30 afterparty.
- Wie in zijn systeem "minder beweging" aan heeft staan, krijgt een rustige versie zonder animaties.
