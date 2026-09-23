/* klar-embed.js — the drop-in ordering + booking surface for a Klar client site.
 *
 * One file, no build step, no dependencies. Copy it into the site (static sites:
 * next to index.html; Next.js: public/) and add ONE element:
 *
 *   <div data-klar-slug="ravintola-ani" data-klar-phone="09 622 2797"></div>
 *   <script src="/klar-embed.js" defer></script>
 *
 * It generalises the hand-built surface in sites/ravintola-ani/index.html, which
 * is wired to that site's element ids and Finnish copy. Nothing here is
 * per-restaurant: the slug, the surfaces, the phone number and the language all
 * come off the mount element.
 *
 * Public API it talks to (apps/booking):
 *   GET  /api/<orderSlug>/menu           orderable menu; item ids the server prices from
 *   POST /api/<orderSlug>/order          places the order (Idempotency-Key header)
 *   GET  /api/<bookSlug>/availability    real free slots for a date + party size
 *   POST /api/<bookSlug>/book            creates the booking
 *
 * TWO KEYSPACES, DELIBERATELY. Ordering is keyed by the console's clients.slug;
 * booking is keyed by booking's restaurants.slug. They are usually equal
 * (ravintola-ani) but not always — 16 Boom is "boom16" for ordering and
 * "boom-16" for booking. data-klar-slug sets both; data-klar-order-slug and
 * data-klar-book-slug override one side. Crossing them 404s both surfaces.
 *
 * Prices are never sent from the browser. The server prices the order from the
 * database by menu-item id and returns the total.
 *
 * CORS: the API answers a cross-origin request only for an origin on its
 * per-slug allowlist (apps/booking/src/lib/cors.ts). A newly wired site fetches
 * nothing until an operator adds its production origin there. When that has not
 * happened the embed shows its unavailable panel and logs the reason — it never
 * renders an empty box.
 *
 * HOST-MENU MODE — data-klar-menu="host". A site that already has a designed
 * menu section must not grow a second one: the embed then renders the cart and
 * checkout ONLY, and the site's own markup does the adding. The contract is
 * four DOM events on the mount element (all bubble, so document works too):
 *
 *   klar:menu         out  { categories, currency, allowsEatIn, client }
 *   klar:menu-failed  out  { reason }            the surface is dark; hide buttons
 *   klar:cart         out  { lines, count, totalCents, currency }
 *   klar:add          in   { id, qty }           qty defaults 1, may be negative
 *   klar:sync         in   —  (on document) re-emits the last menu and cart
 *
 * klar:sync exists because the host's listener and the embed's fetch race: a
 * host that mounts late asks for a replay instead of waiting forever. An id the
 * loaded menu does not carry is refused and logged — a host whose names have
 * drifted from the database gets a visibly missing button, never a silent one.
 *
 * Prices still come from the server in host-menu mode. The host sends ids.
 */
(function () {
  'use strict';

  var DEFAULT_API = 'https://booking.klarsystems.com';
  var LOCAL_API = 'http://localhost:3001';
  var PARTY_MAX_DEFAULT = 12;
  var BOOKING_HORIZON_DAYS = 90; /* the API's ceiling */

  var COUNTRIES = [
    ["FI","+358","Finland"],
    ["AF","+93","Afghanistan"],
    ["AL","+355","Albania"],
    ["DZ","+213","Algeria"],
    ["AD","+376","Andorra"],
    ["AO","+244","Angola"],
    ["AG","+1268","Antigua and Barbuda"],
    ["AR","+54","Argentina"],
    ["AM","+374","Armenia"],
    ["AU","+61","Australia"],
    ["AT","+43","Austria"],
    ["AZ","+994","Azerbaijan"],
    ["BS","+1242","Bahamas"],
    ["BH","+973","Bahrain"],
    ["BD","+880","Bangladesh"],
    ["BB","+1246","Barbados"],
    ["BY","+375","Belarus"],
    ["BE","+32","Belgium"],
    ["BZ","+501","Belize"],
    ["BJ","+229","Benin"],
    ["BT","+975","Bhutan"],
    ["BO","+591","Bolivia"],
    ["BA","+387","Bosnia and Herzegovina"],
    ["BW","+267","Botswana"],
    ["BR","+55","Brazil"],
    ["BN","+673","Brunei"],
    ["BG","+359","Bulgaria"],
    ["BF","+226","Burkina Faso"],
    ["BI","+257","Burundi"],
    ["KH","+855","Cambodia"],
    ["CM","+237","Cameroon"],
    ["CA","+1","Canada"],
    ["CV","+238","Cape Verde"],
    ["CF","+236","Central African Republic"],
    ["TD","+235","Chad"],
    ["CL","+56","Chile"],
    ["CN","+86","China"],
    ["CO","+57","Colombia"],
    ["KM","+269","Comoros"],
    ["CG","+242","Congo"],
    ["CD","+243","Congo (DRC)"],
    ["CR","+506","Costa Rica"],
    ["CI","+225","Côte d'Ivoire"],
    ["HR","+385","Croatia"],
    ["CU","+53","Cuba"],
    ["CY","+357","Cyprus"],
    ["CZ","+420","Czechia"],
    ["DK","+45","Denmark"],
    ["DJ","+253","Djibouti"],
    ["DM","+1767","Dominica"],
    ["DO","+1809","Dominican Republic"],
    ["EC","+593","Ecuador"],
    ["EG","+20","Egypt"],
    ["SV","+503","El Salvador"],
    ["GQ","+240","Equatorial Guinea"],
    ["ER","+291","Eritrea"],
    ["EE","+372","Estonia"],
    ["SZ","+268","Eswatini"],
    ["ET","+251","Ethiopia"],
    ["FJ","+679","Fiji"],
    ["FR","+33","France"],
    ["GA","+241","Gabon"],
    ["GM","+220","Gambia"],
    ["GE","+995","Georgia"],
    ["DE","+49","Germany"],
    ["GH","+233","Ghana"],
    ["GR","+30","Greece"],
    ["GD","+1473","Grenada"],
    ["GT","+502","Guatemala"],
    ["GN","+224","Guinea"],
    ["GW","+245","Guinea-Bissau"],
    ["GY","+592","Guyana"],
    ["HT","+509","Haiti"],
    ["HN","+504","Honduras"],
    ["HK","+852","Hong Kong"],
    ["HU","+36","Hungary"],
    ["IS","+354","Iceland"],
    ["IN","+91","India"],
    ["ID","+62","Indonesia"],
    ["IR","+98","Iran"],
    ["IQ","+964","Iraq"],
    ["IE","+353","Ireland"],
    ["IL","+972","Israel"],
    ["IT","+39","Italy"],
    ["JM","+1876","Jamaica"],
    ["JP","+81","Japan"],
    ["JO","+962","Jordan"],
    ["KZ","+7","Kazakhstan"],
    ["KE","+254","Kenya"],
    ["KI","+686","Kiribati"],
    ["KW","+965","Kuwait"],
    ["KG","+996","Kyrgyzstan"],
    ["LA","+856","Laos"],
    ["LV","+371","Latvia"],
    ["LB","+961","Lebanon"],
    ["LS","+266","Lesotho"],
    ["LR","+231","Liberia"],
    ["LY","+218","Libya"],
    ["LI","+423","Liechtenstein"],
    ["LT","+370","Lithuania"],
    ["LU","+352","Luxembourg"],
    ["MO","+853","Macau"],
    ["MG","+261","Madagascar"],
    ["MW","+265","Malawi"],
    ["MY","+60","Malaysia"],
    ["MV","+960","Maldives"],
    ["ML","+223","Mali"],
    ["MT","+356","Malta"],
    ["MH","+692","Marshall Islands"],
    ["MR","+222","Mauritania"],
    ["MU","+230","Mauritius"],
    ["MX","+52","Mexico"],
    ["FM","+691","Micronesia"],
    ["MD","+373","Moldova"],
    ["MC","+377","Monaco"],
    ["MN","+976","Mongolia"],
    ["ME","+382","Montenegro"],
    ["MA","+212","Morocco"],
    ["MZ","+258","Mozambique"],
    ["MM","+95","Myanmar"],
    ["NA","+264","Namibia"],
    ["NR","+674","Nauru"],
    ["NP","+977","Nepal"],
    ["NL","+31","Netherlands"],
    ["NZ","+64","New Zealand"],
    ["NI","+505","Nicaragua"],
    ["NE","+227","Niger"],
    ["NG","+234","Nigeria"],
    ["KP","+850","North Korea"],
    ["MK","+389","North Macedonia"],
    ["NO","+47","Norway"],
    ["OM","+968","Oman"],
    ["PK","+92","Pakistan"],
    ["PW","+680","Palau"],
    ["PS","+970","Palestine"],
    ["PA","+507","Panama"],
    ["PG","+675","Papua New Guinea"],
    ["PY","+595","Paraguay"],
    ["PE","+51","Peru"],
    ["PH","+63","Philippines"],
    ["PL","+48","Poland"],
    ["PT","+351","Portugal"],
    ["PR","+1787","Puerto Rico"],
    ["QA","+974","Qatar"],
    ["RO","+40","Romania"],
    ["RU","+7","Russia"],
    ["RW","+250","Rwanda"],
    ["KN","+1869","Saint Kitts and Nevis"],
    ["LC","+1758","Saint Lucia"],
    ["VC","+1784","Saint Vincent and the Grenadines"],
    ["WS","+685","Samoa"],
    ["SM","+378","San Marino"],
    ["ST","+239","São Tomé and Príncipe"],
    ["SA","+966","Saudi Arabia"],
    ["SN","+221","Senegal"],
    ["RS","+381","Serbia"],
    ["SC","+248","Seychelles"],
    ["SL","+232","Sierra Leone"],
    ["SG","+65","Singapore"],
    ["SK","+421","Slovakia"],
    ["SI","+386","Slovenia"],
    ["SB","+677","Solomon Islands"],
    ["SO","+252","Somalia"],
    ["ZA","+27","South Africa"],
    ["KR","+82","South Korea"],
    ["SS","+211","South Sudan"],
    ["ES","+34","Spain"],
    ["LK","+94","Sri Lanka"],
    ["SD","+249","Sudan"],
    ["SR","+597","Suriname"],
    ["SE","+46","Sweden"],
    ["CH","+41","Switzerland"],
    ["SY","+963","Syria"],
    ["TW","+886","Taiwan"],
    ["TJ","+992","Tajikistan"],
    ["TZ","+255","Tanzania"],
    ["TH","+66","Thailand"],
    ["TL","+670","Timor-Leste"],
    ["TG","+228","Togo"],
    ["TO","+676","Tonga"],
    ["TT","+1868","Trinidad and Tobago"],
    ["TN","+216","Tunisia"],
    ["TR","+90","Türkiye"],
    ["TM","+993","Turkmenistan"],
    ["TV","+688","Tuvalu"],
    ["UG","+256","Uganda"],
    ["UA","+380","Ukraine"],
    ["AE","+971","United Arab Emirates"],
    ["GB","+44","United Kingdom"],
    ["US","+1","United States"],
    ["UY","+598","Uruguay"],
    ["UZ","+998","Uzbekistan"],
    ["VU","+678","Vanuatu"],
    ["VA","+379","Vatican City"],
    ["VE","+58","Venezuela"],
    ["VN","+84","Vietnam"],
    ["YE","+967","Yemen"],
    ["ZM","+260","Zambia"],
    ["ZW","+263","Zimbabwe"]
  ];

  /* Flags are images, not emoji: a Windows browser renders a flag emoji as a
     "?" box, and an <option> cannot hold an image at all — which is why the
     picker is this small custom list and not a <select>. flagcdn is a static
     image host; if it is unreachable the flag is blank and the code still
     reads. */
  function flagUrl(iso) {
    return 'https://flagcdn.com/24x18/' + iso.toLowerCase() + '.png';
  }

  /* Every country, Finland first so the default is the house one. Built once
     at load. The API accepts any number either way, so a country this list is
     missing is never a blocked booking. */
  var DIAL_OPTIONS = COUNTRIES.map(function (c) {
    return '<button type="button" role="option" data-dial="' + c[1] + '" data-iso="' + c[0] + '">' +
      '<img src="' + flagUrl(c[0]) + '" alt="" loading="lazy">' +
      '<span class="klar-dial-name">' + esc(c[2]) + '</span>' +
      '<span class="klar-dial-code">' + c[1] + '</span></button>';
  }).join('');

  /* The picked code plus the typed national number, as one stored value. A
     full "+…" number typed over the picker wins, and a leading trunk zero is
     dropped because with an explicit country code it is not part of the
     number. */
  function combineDial(dial, local) {
    var v = (local || '').replace(/[^\d+]/g, '');
    if (v.charAt(0) === '+') return v;
    return (dial || '') + v.replace(/^0+/, '');
  }

  /* ---------------------------------------------------------------- copy --- */

  var COPY = {
    fi: {
      tabOrder: 'Tilaa',
      tabBook: 'Varaa pöytä',
      cartTitle: 'Tilauksesi',
      cartEmpty: 'Tilauksesi on tyhjä. Valitse ruokalistalta.',
      add: '+ Lisää',
      addMore: 'Lisää',
      eatIn: 'Syön täällä',
      takeaway: 'Nouto',
      name: 'Nimi',
      namePlaceholder: 'Nimi tilausta varten',
      phone: 'Puhelin',
      countryCode: 'Maakoodi',
      optional: '(vapaaehtoinen)',
      total: 'Yhteensä',
      send: 'Lähetä tilaus',
      sending: 'Lähetetään…',
      payAtVenue: 'Maksu ravintolassa. Hinnat lasketaan palvelimella.',
      payOnline: 'Maksu kortilla: siirryt maksusivulle kun lähetät tilauksen. Hinnat lasketaan palvelimella.',
      orderOk: 'Tilaus lähetetty',
      reference: 'Viite',
      /* `collect` and `table` name the room on purpose, even at a venue that
         takes card payments — see the note at their use below. */
      collect: 'Nouto tiskiltä. Maksu ravintolassa.',
      table: 'Tuomme annokset pöytään. Maksu ravintolassa.',
      orderAgain: 'Tilaa lisää',
      needName: 'Lisää nimi, jotta löydämme tilauksesi.',
      menuLoading: 'Ladataan ruokalistaa…',
      orderingOff: 'Verkkotilaus ei ole juuri nyt käytössä.',
      menuFailed: 'Ruokalistaa ei saatu ladattua. Päivitä sivu.',
      date: 'Päivä',
      party: 'Seurue',
      person: 'henkilö',
      people: 'henkilöä',
      time: 'Kellonaika',
      slotsLoading: 'Haetaan vapaita aikoja…',
      closed: 'Ravintola on suljettu tänä päivänä.',
      noSlots: 'Tälle päivälle ei ole vapaita aikoja. Kokeile toista päivää.',
      slotsFailed: 'Vapaita aikoja ei saatu haettua.',
      bookingOff: 'Pöytävaraus ei ole juuri nyt käytössä.',
      email: 'Sähköposti',
      requests: 'Toiveet',
      /* No facility is named here. The embed does not know which chairs, tables
         or rooms a restaurant actually has, and a placeholder naming one reads
         as an offer — La Lasagna has no high chairs, and the old
         "Korkea tuoli…" advertised them on their own booking form. */
      requestsPlaceholder: 'Ikkunapöytä, juhlat…',
      /* One collapsed line stands in for both optional boxes below it. They stay
         two separate fields, for the Art 9 reason set out at the markup — but a
         guest who wants neither now scrolls past one row, not four. */
      moreLabel: 'Toiveet tai allergiat (vapaaehtoinen)',
      dietary: 'Allergiat tai erityisruokavalio',
      dietaryPlaceholder: 'Esim. pähkinäallergia, keliakia',
      /* MUST match HEALTH_CONSENT_TEXT.fi in
         apps/booking/src/lib/health-consent-text.ts — the server stores that
         constant as the consent_text, so if these two drift the record proves
         wording the guest never saw. A test asserts they are identical:
         apps/booking/src/lib/__tests__/health-consent.test.ts. */
      dietaryConsent:
        'Annan ravintolalle luvan käsitellä yllä kertomiani allergia- ja ' +
        'erityisruokavaliotietoja tätä varausta varten. Tiedot ovat terveystietoja. ' +
        'Ne näkyvät vain keittiölle ja salille, ne poistetaan varauksen jälkeen, ja ' +
        'voit poistaa ne itse milloin tahansa vahvistussähköpostin linkistä.',
      dietaryConsentMissing: 'Rastita suostumus, tai tyhjennä allergiakenttä.',
      book: 'Varaa pöytä',
      booking: 'Varataan…',
      /* The deposit a large party pays before the table is confirmed. `{eur}`
         is per guest and `{total}` the whole party's — both filled in below,
         never concatenated in the caller, so a translation can put them in the
         order its own grammar needs. */
      depositNotice:
        'Vähintään {threshold} hengen seurueelta varausmaksu {eur} € / hlö — yhteensä {total} €. Pöytä vahvistuu maksun jälkeen.',
      depositPay: 'Maksa varausmaksu ja varaa',
      depositRedirect: 'Siirrytään maksuun…',
      depositFinishing: 'Vahvistetaan varausta…',
      depositFailed:
        'Maksua ei voitu vahvistaa. Jos rahat lähtivät tililtäsi, ne palautetaan.',
      bookOk: 'Pöytä varattu',
      bookConfirm: 'Vahvistus lähetettiin osoitteeseen {email}. Jos se ei näy, tarkista roskapostikansio.',
      bookAgain: 'Tee uusi varaus',
      /* A venue with email verification on (0076): Book mails a link and
         NOTHING is booked until the guest presses it. This must never read as
         "Pöytä varattu" — a guest who reads that closes the page and never
         verifies, and the table they believe they hold does not exist. */
      verifyTitle: 'Vahvista sähköpostisi',
      verifyBody:
        'Lähetimme vahvistuslinkin osoitteeseen {email}. Pöytäsi on varattu vasta, kun painat linkkiä.',
      verifySpam: 'Jos viestiä ei näy, tarkista roskapostikansio.',
      verifyClose: 'Selvä',
      /* `{fields}` is the list of the ones actually left empty, built at the
         click. The old copy named all five every time. */
      bookFields: 'Täytä vielä {fields}.',
      fieldDate: 'päivä',
      fieldTime: 'kellonaika',
      fieldName: 'nimi',
      fieldPhone: 'puhelin',
      fieldEmail: 'sähköposti',
      fieldAnd: 'ja',
      needDate: 'Valitse päivä.',
      needTime: 'Valitse kellonaika.',
      needName: 'Kirjoita nimesi.',
      needPhone: 'Kirjoita puhelinnumerosi.',
      needEmail: 'Kirjoita sähköpostiosoitteesi.',
      slotGone: 'Klo {time} ei ole enää vapaana tälle päivälle ja seurueelle. Valitse toinen aika.',
      at: 'klo',
      generic: 'Yhteys ei onnistunut. Yritä hetken päästä uudelleen.',
      callUs: 'Soita',
      badPhone: 'Tarkista puhelinnumero (esim. +358 40 123 4567).',
      tooMany: 'Liikaa yrityksiä. Odota hetki ja yritä uudelleen.',
      codes: {
        ORDER_REJECTED: 'Jokin valitsemasi annos ei ole juuri nyt saatavilla. Poista se tilauksesta.',
        VALIDATION_ERROR: 'Tarkista tilauksen tiedot.',
        IDEMPOTENCY_CONFLICT: 'Tämä tilaus on jo lähetetty.',
        PAYLOAD_TOO_LARGE: 'Tilaus on liian suuri verkkotilaukseen.'
      }
    },
    en: {
      tabOrder: 'Order',
      tabBook: 'Book a table',
      cartTitle: 'Your order',
      cartEmpty: 'Your order is empty. Pick something from the menu.',
      add: '+ Add',
      addMore: 'Add',
      eatIn: 'Eat in',
      takeaway: 'Takeaway',
      name: 'Name',
      namePlaceholder: 'Name for the order',
      phone: 'Phone',
      countryCode: 'Country code',
      optional: '(optional)',
      total: 'Total',
      send: 'Send order',
      sending: 'Sending…',
      payAtVenue: 'Pay at the restaurant. Prices are calculated on the server.',
      payOnline: 'Card payment: you will be taken to the payment page when you send the order. Prices are calculated on the server.',
      orderOk: 'Order sent',
      reference: 'Reference',
      /* `collect` and `table` name the room on purpose, even at a venue that
         takes card payments — see the note at their use below. */
      collect: 'Collect at the counter. Pay at the restaurant.',
      table: 'We will bring it to your table. Pay at the restaurant.',
      orderAgain: 'Order more',
      needName: 'Add a name so we can find your order.',
      menuLoading: 'Loading the menu…',
      orderingOff: 'Online ordering is not available right now.',
      menuFailed: 'The menu could not be loaded. Please refresh the page.',
      date: 'Date',
      party: 'Party',
      person: 'person',
      people: 'people',
      time: 'Time',
      slotsLoading: 'Looking for free times…',
      closed: 'The restaurant is closed on this day.',
      noSlots: 'No free times on this day. Try another date.',
      slotsFailed: 'Free times could not be loaded.',
      bookingOff: 'Table booking is not available right now.',
      email: 'Email',
      requests: 'Requests',
      requestsPlaceholder: 'Window table, a celebration…',
      moreLabel: 'Requests or allergies (optional)',
      dietary: 'Allergies or special diet',
      dietaryPlaceholder: 'E.g. nut allergy, coeliac',
      /* MUST match HEALTH_CONSENT_TEXT.en — see the Finnish note above. */
      dietaryConsent:
        'I allow the restaurant to process the allergy and special-diet information ' +
        'I have given above for this booking. This is health data. It is seen only ' +
        'by the kitchen and the floor, it is deleted after the visit, and you can ' +
        'delete it yourself at any time from the link in your confirmation email.',
      dietaryConsentMissing: 'Please tick the box, or clear the allergy field.',
      book: 'Book a table',
      booking: 'Booking…',
      depositNotice:
        'Parties of {threshold} or more pay a {eur} € deposit per guest — {total} € in total. The table is confirmed once it is paid.',
      depositPay: 'Pay the deposit and book',
      depositRedirect: 'Taking you to the payment…',
      depositFinishing: 'Confirming your booking…',
      depositFailed:
        'The payment could not be confirmed. If you were charged, the money is refunded.',
      bookOk: 'Table booked',
      bookConfirm: 'A confirmation was sent to {email}. If it does not arrive, check your spam folder.',
      bookAgain: 'Make another booking',
      verifyTitle: 'Please confirm your email',
      verifyBody:
        'We sent a confirmation link to {email}. Your table is booked only once you press it.',
      verifySpam: 'If it does not arrive, check your spam folder.',
      verifyClose: 'OK',
      bookFields: 'Still needed: {fields}.',
      fieldDate: 'the date',
      fieldTime: 'a time',
      fieldName: 'your name',
      fieldPhone: 'your phone number',
      fieldEmail: 'your email',
      fieldAnd: 'and',
      needDate: 'Choose a date.',
      needTime: 'Choose a time.',
      needName: 'Enter your name.',
      needPhone: 'Enter your phone number.',
      needEmail: 'Enter your email.',
      slotGone: '{time} is no longer free for this date and party size. Choose another time.',
      at: 'at',
      generic: 'The connection failed. Please try again in a moment.',
      callUs: 'Call',
      badPhone: 'Check the phone number (e.g. +358 40 123 4567).',
      tooMany: 'Too many attempts. Wait a moment and try again.',
      codes: {
        ORDER_REJECTED: 'One of the dishes you picked is not available right now. Remove it from the order.',
        VALIDATION_ERROR: 'Check the order details.',
        IDEMPOTENCY_CONFLICT: 'This order has already been sent.',
        PAYLOAD_TOO_LARGE: 'The order is too large for online ordering.'
      }
    }
  };

  /* --------------------------------------------------------------- styles --- */

  var CSS = [
    '.klar-embed{--klar-accent:#111;--klar-on-accent:#fff;--klar-line:#e4e0d8;',
    '--klar-muted:#6b6357;--klar-radius:12px;color:inherit;font:inherit;text-align:left}',
    '.klar-embed *{box-sizing:border-box}',
    '.klar-tabs{display:flex;gap:8px;margin-bottom:20px;flex-wrap:wrap}',
    '.klar-tabs button{flex:1 1 160px;padding:12px 16px;border:1px solid var(--klar-line);',
    'background:transparent;border-radius:var(--klar-radius);cursor:pointer;font:inherit;',
    'font-weight:600;color:inherit}',
    '.klar-tabs button.klar-on{background:var(--klar-accent);color:var(--klar-on-accent);',
    'border-color:var(--klar-accent)}',
    '.klar-panel{display:none}.klar-panel.klar-on{display:block}',
    '.klar-cats{display:flex;gap:8px;overflow-x:auto;padding-bottom:10px;margin-bottom:14px}',
    '.klar-cats button{white-space:nowrap;padding:8px 14px;border:1px solid var(--klar-line);',
    'background:transparent;border-radius:999px;cursor:pointer;font:inherit;color:inherit}',
    '.klar-cats button.klar-on{background:var(--klar-accent);color:var(--klar-on-accent);',
    'border-color:var(--klar-accent)}',
    '.klar-item{display:flex;gap:16px;justify-content:space-between;align-items:flex-start;',
    'padding:14px 0;border-bottom:1px solid var(--klar-line)}',
    '.klar-item h4{margin:0 0 4px;font-size:1rem}',
    '.klar-item p{margin:0;font-size:.875rem;color:var(--klar-muted)}',
    '.klar-side{display:flex;align-items:center;gap:12px;flex-shrink:0}',
    '.klar-price{font-variant-numeric:tabular-nums;white-space:nowrap}',
    '.klar-add,.klar-btn{padding:9px 16px;border:0;border-radius:var(--klar-radius);',
    'background:var(--klar-accent);color:var(--klar-on-accent);cursor:pointer;font:inherit;',
    'font-weight:600}',
    '.klar-btn[disabled],.klar-add[disabled]{opacity:.55;cursor:default}',
    '.klar-btn-full{display:block;width:100%;margin-top:16px}',
    '.klar-cart{margin-top:22px;padding:18px;border:1px solid var(--klar-line);',
    'border-radius:var(--klar-radius)}',
    '.klar-cart h3{margin:0 0 12px;font-size:1rem}',
    '.klar-line{display:flex;align-items:center;gap:10px;justify-content:space-between;',
    'padding:8px 0}',
    '.klar-ln{flex:1 1 auto}.klar-lp{font-variant-numeric:tabular-nums;white-space:nowrap}',
    '.klar-qty{display:flex;align-items:center;gap:8px}',
    '.klar-qty button{width:30px;height:30px;border:1px solid var(--klar-line);background:',
    'transparent;border-radius:8px;cursor:pointer;font:inherit;color:inherit;line-height:1}',
    '.klar-seg{display:flex;gap:8px;margin:14px 0}',
    '.klar-only-ful{margin:14px 0 0;font-size:.85rem;color:var(--klar-muted)}',
    '.klar-seg button{flex:1;padding:10px;border:1px solid var(--klar-line);background:',
    'transparent;border-radius:var(--klar-radius);cursor:pointer;font:inherit;color:inherit}',
    '.klar-seg button.klar-on{background:var(--klar-accent);color:var(--klar-on-accent);',
    'border-color:var(--klar-accent)}',
    '.klar-field{margin:12px 0}',
    /* Two fields to a row, but only where two genuinely fit. The min() keeps the
       pair from collapsing on a phone without a media query — the embed can sit
       in a column narrower than the viewport, so a viewport query would be
       measuring the wrong box. 220px, not 160px: a native date field and a party
       <select> both draw platform chrome, and on iOS Safari the date box refuses
       to shrink to a 160px track — it overran the select beside it and pushed
       the phone/email pair off the right edge. Under 452px of container the pair
       is a single column and every field is full width. */
    '.klar-pair{display:grid;gap:0 12px;grid-template-columns:',
    'repeat(auto-fit,minmax(min(100%,220px),1fr))}',
    /* A grid item's min-width defaults to its content's minimum, so a field with
       chrome wider than its track escapes the track instead of being clipped by
       it. These two lines are what stop that happening again at any width. */
    '.klar-pair>.klar-field{min-width:0}',
    '.klar-field input,.klar-field select,.klar-field textarea{max-width:100%}',
    /* Safari centres a date value in a box wider than the value; every other
       field in the form starts at the left edge, so this one does too.
       text-align on the input alone does not reach it: iOS draws the value in
       ::-webkit-date-and-time-value, and without appearance:none the native box
       keeps an intrinsic width that max-width cannot pull in — which is how the
       field ran past the card's right edge on a phone. */
    '.klar-field input[type=date]{-webkit-appearance:none;appearance:none;',
    'min-width:0;text-align:left}',
    '.klar-field input[type=date]::-webkit-date-and-time-value{text-align:left;',
    'margin:0}',
    /* The collapsed row used to be styled as one more field label, and read as
       a caption nobody could tell was tappable. It gets the outline and the
       chevron of a control now — dashed, so it still reads as secondary to
       Varaa pöytä rather than a second primary button. */
    '.klar-more{margin:12px 0}',
    '.klar-more summary{cursor:pointer;font-size:.75rem;text-transform:uppercase;',
    'letter-spacing:.08em;color:var(--klar-muted);padding:11px 12px;',
    'display:flex;align-items:center;gap:8px;min-height:44px;',
    'border:1px dashed var(--klar-line);border-radius:var(--klar-radius);',
    'list-style:none;-webkit-user-select:none;user-select:none}',
    /* Safari draws its own triangle and ignores list-style. */
    '.klar-more summary::-webkit-details-marker{display:none}',
    '.klar-more summary::after{content:"";flex:0 0 auto;margin-left:auto;',
    'width:7px;height:7px;border-right:1.5px solid currentColor;',
    'border-bottom:1.5px solid currentColor;transform:rotate(45deg);',
    'transition:transform .15s ease}',
    '.klar-more[open] summary::after{transform:rotate(-135deg)}',
    '.klar-more summary:hover,.klar-more summary:focus-visible{color:inherit;',
    'border-color:var(--klar-accent)}',
    '.klar-more[open] summary{margin-bottom:8px;color:inherit}',
    /* The Art 9 consent row: a normal-case, wrapping paragraph beside a
       checkbox, deliberately unlike the uppercase field labels above — it is
       wording to be read, not a caption to be skimmed. */
    '.klar-consent{display:flex;align-items:flex-start;gap:8px;margin-top:8px;',
    'font-size:.75rem;line-height:1.45;text-transform:none;letter-spacing:0;',
    'font-weight:400;cursor:pointer}',
    '.klar-consent input{width:auto;margin-top:2px;flex:0 0 auto}',
    '.klar-consent[hidden]{display:none}',
    '.klar-field label{display:block;font-size:.75rem;text-transform:uppercase;',
    'letter-spacing:.08em;margin-bottom:6px;color:var(--klar-muted)}',
    '.klar-field input,.klar-field select,.klar-field textarea{width:100%;padding:11px 12px;',
    'border:1px solid var(--klar-line);border-radius:var(--klar-radius);font:inherit;',
    'background:transparent;color:inherit}',
    /* Country button + number, with the flag list opening over the form.
       The picker itself is hidden on this site (2026-09-15): the operator wants
       the one plain box Ani has. The button, the hidden +358 dial input and the
       menu all stay in the DOM because the submit path binds to them, and
       combineDial() returns a typed +xx number verbatim — so a foreign guest
       still books by typing the country code, exactly as on Ani. */
    '.klar-phone{position:relative;display:flex;gap:8px}',
    '.klar-dial{display:flex;align-items:center;gap:6px;flex:0 0 auto;padding:0 10px;',
    'min-height:46px;border:1px solid var(--klar-line);border-radius:var(--klar-radius);',
    'background:transparent;color:inherit;font:inherit;cursor:pointer}',
    '.klar-dial img{width:20px;height:15px;object-fit:cover;display:block}',
    '.klar-caret{font-size:.7rem;color:var(--klar-muted)}',
    /* …and here it is switched off again, after the rules that draw it. */
    '.klar-dial,.klar-dial-menu{display:none}',
    '.klar-dial-menu{position:absolute;z-index:30;top:calc(100% + 4px);left:0;width:280px;',
    'max-width:92vw;border:1px solid var(--klar-line);border-radius:var(--klar-radius);',
    'background:#fff;color:#111;box-shadow:0 10px 30px rgba(0,0,0,.15)}',
    '.klar-dial-menu[hidden]{display:none}',
    '.klar-dial-search{width:100%;box-sizing:border-box;padding:10px 12px;border:0;',
    'border-bottom:1px solid var(--klar-line);font:inherit;color:inherit;background:transparent;outline:none}',
    '.klar-dial-list{max-height:240px;overflow:auto}',
    '.klar-dial-list button{display:flex;align-items:center;gap:8px;width:100%;padding:8px 12px;',
    'border:0;background:transparent;text-align:left;font:inherit;color:inherit;cursor:pointer}',
    '.klar-dial-list button:hover{background:rgba(0,0,0,.06)}',
    '.klar-dial-list button[hidden]{display:none}',
    '.klar-dial-list img{width:20px;height:15px;object-fit:cover;flex:0 0 auto}',
    '.klar-dial-name{flex:1 1 auto;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}',
    '.klar-dial-code{color:var(--klar-muted);flex:0 0 auto}',
    '.klar-phone input[type="tel"]{flex:1 1 auto;min-width:0;width:auto}',
    /* A native <select>, a date input and a text input each compute their own
       height from platform chrome, so identical padding still drew three
       different boxes — the date field beside the party select most visibly.
       One line-height and one min-height make the row square. */
    '.klar-field input,.klar-field select{line-height:1.4;min-height:46px}',
    '.klar-total{display:flex;justify-content:space-between;align-items:baseline;',
    'margin-top:14px;font-weight:700}',
    '.klar-tv{font-size:1.25rem;font-variant-numeric:tabular-nums}',
    '.klar-slots{display:flex;flex-wrap:wrap;gap:8px;min-height:42px;align-items:center}',
    '.klar-slots button{padding:9px 14px;border:1px solid var(--klar-line);background:',
    'transparent;border-radius:var(--klar-radius);cursor:pointer;font:inherit;color:inherit}',
    '.klar-slots button.klar-on{background:var(--klar-accent);color:var(--klar-on-accent);',
    'border-color:var(--klar-accent)}',
    '.klar-slots button[disabled]{opacity:.35;cursor:default;text-decoration:line-through}',
    '.klar-muted{color:var(--klar-muted);font-size:.9rem}',
    /* Touch sizing, and only on touch. Measured at 390px before this block
       existed: the text fields already came out 48-50px tall at a 16px font —
       big enough to hit, and 16px is what stops iOS zooming the page on focus,
       so neither is touched here. Two things did not measure well.

       The collapsed "requests or allergies" row was 32px, well under the 44px
       Apple asks for, because it is styled as a caption rather than a control.
       And a time chip was exactly 44 — the floor, not a margin — while sitting
       8px from its neighbours, where a mis-tap does not annoy the guest, it
       books them a different hour.

       `pointer: coarse` rather than a width query on purpose: it asks whether
       the guest is using a finger, which is the actual question. A narrow
       desktop window keeps the tighter sizes it always had. */
    '@media (pointer:coarse){',
    '.klar-slots button,.klar-seg button,.klar-cats button,.klar-tabs button{min-height:48px}',
    '.klar-more summary{min-height:44px;display:flex;align-items:center}',
    '.klar-qty button{width:44px;height:44px}',
    '.klar-btn,.klar-add{min-height:48px}',
    '}',
    '.klar-err{margin:12px 0 0;color:#a3341f;font-size:.9rem}',
    /* A field the guest still has to fill in: red border and its own line
       underneath, where the eye is, rather than only the summary above the
       button. The time grid has no border of its own, so it gets an outline. */
    '.klar-field.klar-missing input,.klar-field.klar-missing select,' +
    '.klar-field.klar-missing textarea{border-color:#a3341f;box-shadow:0 0 0 1px #a3341f}',
    '.klar-field.klar-missing .klar-slots{outline:1px solid #a3341f;outline-offset:6px;' +
    'border-radius:var(--klar-radius)}',
    '.klar-field-err{margin:6px 0 0;color:#a3341f;font-size:.85rem}',
    '.klar-field-err:empty{display:none}',
    '.klar-note{margin:10px 0 0;font-size:.78rem;color:var(--klar-muted)}',
    '.klar-ok{text-align:center;padding:26px 0}',
    '.klar-check{font-size:2rem;line-height:1}',
    '.klar-big{font-size:1.5rem;font-weight:700;margin:10px 0}',
    '.klar-unavailable{padding:22px;border:1px solid var(--klar-line);',
    'border-radius:var(--klar-radius);text-align:center}'
  ].join('');

  var stylesInjected = false;
  function injectStyles(doc) {
    if (stylesInjected) return;
    stylesInjected = true;
    var style = doc.createElement('style');
    style.setAttribute('data-klar-embed', 'styles');
    style.textContent = CSS;
    (doc.head || doc.documentElement).appendChild(style);
  }

  /* -------------------------------------------------------------- helpers --- */

  function esc(value) {
    return String(value == null ? '' : value).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  function money(cents, currency) {
    var amount = (cents / 100).toFixed(2);
    /* Finnish sites read a comma; everything else keeps the dot. */
    if (currency === 'EUR' || currency == null) return amount.replace('.', ',') + ' €';
    return amount + ' ' + currency;
  }

  function hhmm(value) {
    return String(value || '').slice(0, 5);
  }

  function warn(message, detail) {
    /* Every dark surface says why, in the console, with the slug in the text —
     * "it just doesn't show up" is the failure this prevents. */
    if (typeof console !== 'undefined' && console.error) {
      if (detail === undefined) console.error('[klar-embed] ' + message);
      else console.error('[klar-embed] ' + message, detail);
    }
  }

  function todayIn(timezone) {
    /* 'sv-SE' formats as YYYY-MM-DD. The API rejects a past date in the
     * restaurant's timezone, not the visitor's. */
    return new Date().toLocaleDateString('sv-SE', { timeZone: timezone });
  }

  function plusDays(iso, days) {
    var d = new Date(iso + 'T12:00:00Z');
    d.setUTCDate(d.getUTCDate() + days);
    return d.toISOString().slice(0, 10);
  }

  function newKey() {
    if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID();
    return 'klar-' + Date.now() + '-' + Math.random().toString(16).slice(2);
  }

  function readJson(response) {
    return response
      .json()
      .catch(function () {
        return {};
      })
      .then(function (body) {
        return { ok: response.ok, status: response.status, body: body || {} };
      });
  }

  /* ---------------------------------------------------------------- config --- */

  function defaultApi(loc) {
    var host = loc && loc.hostname;
    /* Served from localhost the calls point at a local booking app on :3001,
     * which is also the only origin the API's CORS allowlist accepts outside
     * production. */
    return host === 'localhost' || host === '127.0.0.1' ? LOCAL_API : DEFAULT_API;
  }

  function readConfig(mount, loc) {
    var data = mount.dataset || {};
    var slug = (data.klarSlug || '').trim();
    var surfaces = (data.klarSurfaces || 'order book').toLowerCase();
    var locale = (data.klarLocale || 'fi').toLowerCase();
    var partyMax = parseInt(data.klarPartyMax || '', 10);
    return {
      orderSlug: (data.klarOrderSlug || slug).trim(),
      bookSlug: (data.klarBookSlug || slug).trim(),
      order: surfaces.indexOf('order') !== -1,
      book: surfaces.indexOf('book') !== -1,
      /* "host" = the page already renders the menu; the embed contributes the
         cart and checkout only. Anything else keeps the embed's own list. */
      hostMenu: (data.klarMenu || '').trim().toLowerCase() === 'host',
      api: (data.klarApi || defaultApi(loc)).replace(/\/$/, ''),
      phone: (data.klarPhone || '').trim(),
      timezone: (data.klarTimezone || 'Europe/Helsinki').trim(),
      partyMax: partyMax > 0 ? partyMax : PARTY_MAX_DEFAULT,
      copy: COPY[locale] || COPY.fi,
      locale: COPY[locale] ? locale : 'fi'
    };
  }

  /* ------------------------------------------------------------ the surface --- */

  function mountKlar(mount, win) {
    var doc = mount.ownerDocument;
    var cfg = readConfig(mount, win.location);
    var t = cfg.copy;

    injectStyles(doc);
    mount.classList.add('klar-embed');
    if (cfg.hostMenu) mount.classList.add('klar-host-menu');

    /* The host-menu contract. Bubbling so a host can listen on document rather
     * than having to find the mount element it did not render itself. */
    function emit(name, detail) {
      try {
        mount.dispatchEvent(new win.CustomEvent(name, { detail: detail, bubbles: true }));
      } catch (error) {
        warn('could not dispatch ' + name + '.', error);
      }
    }

    function callUs() {
      return cfg.phone ? ' ' + t.callUs + ' ' + cfg.phone + '.' : '';
    }

    function unavailable(message) {
      mount.innerHTML =
        '<div class="klar-unavailable"><p class="klar-muted">' +
        esc(message + callUs()) +
        '</p></div>';
    }

    if (!cfg.orderSlug && !cfg.bookSlug) {
      warn('mount has no data-klar-slug — nothing to fetch.', mount);
      unavailable(t.generic);
      return;
    }
    if (!cfg.order && !cfg.book) {
      warn('data-klar-surfaces "' + (mount.dataset.klarSurfaces || '') + '" enables neither surface.');
      unavailable(t.generic);
      return;
    }

    /* ---- shell ---- */
    var showTabs = cfg.order && cfg.book;
    mount.innerHTML =
      (showTabs
        ? '<div class="klar-tabs">' +
          '<button type="button" class="klar-on" data-klar-tab="order">' + esc(t.tabOrder) + '</button>' +
          '<button type="button" data-klar-tab="book">' + esc(t.tabBook) + '</button>' +
          '</div>'
        : '') +
      (cfg.order
        ? '<div class="klar-panel klar-on" data-klar-panel="order">' +
          '<div data-klar="order-live">' +
          '<div class="klar-cats" data-klar="cats" hidden></div>' +
          /* In host-menu mode the page is already showing the menu, so this
             slot starts empty and hidden. It is un-hidden only to carry the
             fail-closed "call us" panel. */
          (cfg.hostMenu
            ? '<div data-klar="items" hidden></div>'
            : '<div data-klar="items"><p class="klar-muted">' + esc(t.menuLoading) + '</p></div>') +
          '<div class="klar-cart" data-klar="cart"></div>' +
          '</div><div data-klar="order-ok" class="klar-ok" hidden></div></div>'
        : '') +
      (cfg.book
        ? '<div class="klar-panel' + (cfg.order ? '' : ' klar-on') + '" data-klar-panel="book">' +
          '<div data-klar="book-live">' +
          /* Paired one to a row on anything wider than a phone. Six stacked
             full-width fields is the length the form was pulled up on; the
             pairs are the two that genuinely belong together — when and how
             many, then how to reach you. Narrow screens fall back to one
             column, so nothing is ever squeezed. */
          '<div class="klar-pair">' +
          '<div class="klar-field"><label>' + esc(t.date) + '</label>' +
          '<input type="date" data-klar="date"></div>' +
          '<div class="klar-field"><label>' + esc(t.party) + '</label>' +
          '<select data-klar="party"></select>' +
          '<p class="klar-note" data-klar="deposit-note" hidden></p></div></div>' +
          '<div class="klar-field"><label>' + esc(t.time) + '</label>' +
          '<div class="klar-slots" data-klar="slots"></div></div>' +
          '<div class="klar-field"><label>' + esc(t.name) + '</label>' +
          '<input type="text" autocomplete="name" data-klar="bname"></div>' +
          '<div class="klar-pair">' +
          '<div class="klar-field"><label>' + esc(t.phone) + '</label>' +
          '<div class="klar-phone">' +
          '<button type="button" class="klar-dial" data-klar="bphone-dial-btn" ' +
          'aria-haspopup="listbox" aria-expanded="false">' +
          '<img data-klar="bphone-dial-flag" src="' + flagUrl('FI') + '" alt="">' +
          '<span data-klar="bphone-dial-code">+358</span>' +
          '<span class="klar-caret" aria-hidden="true">\u25be</span></button>' +
          '<input type="hidden" data-klar="bphone-dial" value="+358">' +
          '<div class="klar-dial-menu" data-klar="bphone-dial-menu" hidden>' +
          '<input type="text" class="klar-dial-search" data-klar="bphone-dial-search" ' +
          'placeholder="' + esc(t.countryCode) + '" autocomplete="off">' +
          '<div class="klar-dial-list" role="listbox">' + DIAL_OPTIONS + '</div></div>' +
          '<input type="tel" autocomplete="tel" data-klar="bphone" ' +
          'placeholder="+358 40 123 4567"></div></div>' +
          '<div class="klar-field"><label>' + esc(t.email) + '</label>' +
          '<input type="email" autocomplete="email" data-klar="bemail"></div></div>' +
          /* Both optional boxes live behind one closed <details>. Native, so it
             works with no JS and keeps keyboard and screen-reader behaviour for
             free; the fields stay in the DOM, so every reader below is
             unchanged whether or not the guest ever opens it. */
          '<details class="klar-more" data-klar="bmore">' +
          '<summary>' + esc(t.moreLabel) + '</summary>' +
          '<div class="klar-field"><label>' + esc(t.requests) + '</label>' +
          '<textarea rows="2" data-klar="breq" placeholder="' + esc(t.requestsPlaceholder) + '"></textarea></div>' +
          /* The allergy field and its own consent tick, split from the requests
             box above for GDPR Art 9(2)(a): consent has to be specific to the
             health data, and a single box cannot tell "no nuts" from "window
             table". The tick is hidden until the field has something in it, so
             a guest asking for a window table is never asked to consent to
             health processing. The server refuses the write without it. */
          '<div class="klar-field"><label>' + esc(t.dietary) + '</label>' +
          '<textarea rows="2" data-klar="bdiet" placeholder="' + esc(t.dietaryPlaceholder) + '"></textarea>' +
          '<label class="klar-consent" data-klar="bdiet-consent-row" hidden>' +
          '<input type="checkbox" data-klar="bdiet-consent">' +
          '<span>' + esc(t.dietaryConsent) + '</span></label></div></details>' +
          '<p class="klar-err" data-klar="book-err" hidden></p>' +
          '<button type="button" class="klar-btn klar-btn-full" data-klar="book-submit">' +
          esc(t.book) + '</button>' +
          '</div><div data-klar="book-ok" class="klar-ok" hidden></div></div>'
        : '');

    function el(name) {
      return mount.querySelector('[data-klar="' + name + '"]');
    }

    if (showTabs) {
      var tabs = mount.querySelector('.klar-tabs');
      tabs.addEventListener('click', function (event) {
        var button = event.target.closest('button[data-klar-tab]');
        if (!button) return;
        var wanted = button.dataset.klarTab;
        tabs.querySelectorAll('button').forEach(function (other) {
          other.classList.toggle('klar-on', other === button);
        });
        mount.querySelectorAll('[data-klar-panel]').forEach(function (panel) {
          panel.classList.toggle('klar-on', panel.dataset.klarPanel === wanted);
        });
      });
    }

    /* ================================ ORDER ================================ */

    var catsWrap = el('cats');
    var itemsWrap = el('items');
    var cartWrap = el('cart');
    var categories = [];
    var activeCat = 0;
    var allowsEatIn = true;
    /* Whether a guest placing an order here will be sent to Stripe. The basket
       is drawn BEFORE any order exists, so it cannot read this off the order
       response — GET /menu carries it as `client.onlinePayment`, both halves of
       it (Stripe's charges_enabled AND the venue's own online_payment_enabled),
       the same pair POST /order prices against. `=== true` is the point: an
       older API names no such field, and a payment the payload did not state is
       one this embed must not announce. */
    var onlinePayment = false;
    var currency = 'EUR';
    var cart = [];
    var fulfilment = 'eat_in';
    var checkoutKey = null;
    var sending = false;
    var orderName = '';
    var orderPhone = '';
    var orderErr = '';
    /* Kept so klar:sync can replay them to a host that mounted late. */
    var lastMenu = null;
    var lastCart = null;

    function lineFor(id) {
      for (var i = 0; i < cart.length; i++) if (cart[i].id === id) return cart[i];
      return null;
    }

    function itemById(id) {
      for (var c = 0; c < categories.length; c++) {
        for (var i = 0; i < categories[c].items.length; i++) {
          if (categories[c].items[i].id === id) return categories[c].items[i];
        }
      }
      return null;
    }

    function renderItems() {
      if (cfg.hostMenu) return;
      var category = categories[activeCat];
      if (!category) return;
      itemsWrap.innerHTML = category.items
        .map(function (item) {
          var line = lineFor(item.id);
          var qty = line ? line.qty : 0;
          var disabled = item.available === false;
          return (
            '<div class="klar-item"><div><h4>' + esc(item.name) + '</h4>' +
            (item.description ? '<p>' + esc(item.description) + '</p>' : '') +
            '</div><div class="klar-side"><span class="klar-price">' +
            esc(money(item.priceCents, item.currency || currency)) + '</span>' +
            '<button type="button" class="klar-add" data-klar-add="' + esc(item.id) + '"' +
            (disabled ? ' disabled' : '') + '>' +
            (qty > 0 ? esc(t.addMore) + ' · ' + qty : esc(t.add)) +
            '</button></div></div>'
          );
        })
        .join('');
    }

    function renderCart() {
      if (!cartWrap) return;
      var count = cart.reduce(function (sum, line) { return sum + line.qty; }, 0);
      var total = cart.reduce(function (sum, line) { return sum + line.cents * line.qty; }, 0);
      lastCart = {
        lines: cart.map(function (line) {
          return { id: line.id, name: line.name, cents: line.cents, qty: line.qty };
        }),
        count: count,
        totalCents: total,
        currency: currency
      };
      emit('klar:cart', lastCart);
      if (cart.length === 0) {
        cartWrap.innerHTML =
          '<h3>' + esc(t.cartTitle) + '</h3><p class="klar-muted">' + esc(t.cartEmpty) + '</p>';
        return;
      }
      cartWrap.innerHTML =
        '<h3>' + esc(t.cartTitle) + ' · ' + count + '</h3>' +
        cart
          .map(function (line) {
            return (
              '<div class="klar-line"><span class="klar-ln">' + esc(line.name) + '</span>' +
              '<span class="klar-qty">' +
              '<button type="button" data-klar-qty="' + esc(line.id) + '" data-klar-to="' +
              (line.qty - 1) + '" aria-label="-">−</button><span>' + line.qty + '</span>' +
              '<button type="button" data-klar-qty="' + esc(line.id) + '" data-klar-to="' +
              (line.qty + 1) + '" aria-label="+">+</button></span>' +
              '<span class="klar-lp">' + esc(money(line.cents * line.qty, currency)) + '</span></div>'
            );
          })
          .join('') +
        /* A takeaway-only restaurant has nothing to choose between. Rendering
           the one option as a button made it look like a second call to action
           sitting above the real one — so a single option states itself. */
        (allowsEatIn
          ? '<div class="klar-seg">' +
            '<button type="button" data-klar-ful="eat_in" class="' +
            (fulfilment === 'eat_in' ? 'klar-on' : '') + '">' + esc(t.eatIn) + '</button>' +
            '<button type="button" data-klar-ful="takeaway" class="' +
            (fulfilment === 'takeaway' ? 'klar-on' : '') + '">' + esc(t.takeaway) + '</button>' +
            '</div>'
          : '<p class="klar-only-ful">' + esc(t.takeaway) + '</p>') +
        '<div class="klar-field"><label>' + esc(t.name) + '</label>' +
        '<input type="text" autocomplete="name" data-klar="oname" placeholder="' +
        esc(t.namePlaceholder) + '" value="' + esc(orderName) + '"></div>' +
        '<div class="klar-field"><label>' + esc(t.phone) + ' ' + esc(t.optional) + '</label>' +
        '<input type="tel" autocomplete="tel" data-klar="ophone" value="' + esc(orderPhone) + '"></div>' +
        '<div class="klar-total"><span class="klar-muted">' + esc(t.total) + '</span>' +
        '<span class="klar-tv">' + esc(money(total, currency)) + '</span></div>' +
        (orderErr ? '<p class="klar-err">' + esc(orderErr) + '</p>' : '') +
        '<button type="button" class="klar-btn klar-btn-full" data-klar="order-submit"' +
        (sending ? ' disabled' : '') + '>' + esc(sending ? t.sending : t.send) + '</button>' +
        '<p class="klar-note">' + esc(onlinePayment ? t.payOnline : t.payAtVenue) + '</p>';
    }

    /* Any change to what is being ordered starts a new checkout attempt: an
     * Idempotency-Key must never be reused for a different order (the API 409s). */
    function cartChanged() {
      checkoutKey = null;
    }

    function menuLoaded(data) {
      categories = (data.categories || []).filter(function (c) {
        return (c.items || []).length > 0;
      });
      allowsEatIn = data.client ? data.client.allowsEatIn !== false : true;
      if (!allowsEatIn) fulfilment = 'takeaway';
      onlinePayment = !!(data.client && data.client.onlinePayment === true);
      var first = categories[0] && categories[0].items[0];
      if (first && first.currency) currency = first.currency;
      if (categories.length === 0) {
        warn('menu for "' + cfg.orderSlug + '" has no orderable categories.');
        itemsWrap.hidden = false;
        itemsWrap.innerHTML = '<p class="klar-muted">' + esc(t.orderingOff + callUs()) + '</p>';
        if (cartWrap) cartWrap.hidden = true;
        emit('klar:menu-failed', { reason: 'empty' });
        return;
      }
      lastMenu = {
        categories: categories,
        currency: currency,
        allowsEatIn: allowsEatIn,
        client: data.client || null
      };
      emit('klar:menu', lastMenu);
      if (cfg.hostMenu) {
        renderCart();
        return;
      }
      catsWrap.hidden = false;
      catsWrap.innerHTML = categories
        .map(function (category, index) {
          return (
            '<button type="button" class="' + (index === 0 ? 'klar-on' : '') +
            '" data-klar-cat="' + index + '">' + esc(category.name) + '</button>'
          );
        })
        .join('');
      renderItems();
      renderCart();
    }

    function loadMenu() {
      win
        .fetch(cfg.api + '/api/' + encodeURIComponent(cfg.orderSlug) + '/menu', {
          headers: { Accept: 'application/json' }
        })
        .then(function (response) {
          if (!response.ok) throw new Error('menu ' + response.status);
          return response.json();
        })
        .then(menuLoaded)
        .catch(function (error) {
          /* A 404 here is the ordinary "this slug is not provisioned for
           * ordering" answer; a TypeError is the browser refusing to read a
           * cross-origin response the allowlist did not cover. Both are dark
           * surfaces, so both say so out loud. */
          warn(
            'menu request failed for ordering slug "' + cfg.orderSlug + '" at ' + cfg.api +
              ' — the surface stays unavailable.',
            error
          );
          if (catsWrap) catsWrap.hidden = true;
          /* Host-menu mode keeps this slot hidden while things work; the
             fail-closed panel is the one thing it must still show. */
          itemsWrap.hidden = false;
          itemsWrap.innerHTML =
            '<p class="klar-muted">' +
            esc((/ 404$/.test(error.message) ? t.orderingOff : t.menuFailed) + callUs()) +
            '</p>';
          if (cartWrap) cartWrap.hidden = true;
          emit('klar:menu-failed', { reason: error && error.message ? error.message : 'failed' });
        });
    }

    /* Online payment. The order API answers a placed order with
       `payment.checkoutUrl` when — and only when — the restaurant has both
       switched online payment on and had Stripe accept charges on its account.
       Until both are true the field is absent and this does nothing, so it is
       safe to ship long before any restaurant switches over.

       THE ORDER IS ALREADY PLACED WHEN WE GET HERE, by design: the kitchen has
       it before payment is offered, so a Stripe outage or a guest who closes the
       tab costs nobody their dinner — it leaves a placed order paid at the
       counter, exactly as every order works today. Never a gate in front of
       ordering, and a failure to reach Stripe must never look like a failed
       order.

       CALLED AFTER showOrderOk, DELIBERATELY — that call clears the basket and
       shows the confirmation, so by the time the browser leaves there is no live
       cart behind us and a guest who abandons the payment or presses Back does
       not find a basket inviting them to order the same food twice.

       THE URL IS CHECKED BEFORE WE NAVIGATE. It arrives from a network response,
       and sending a guest's browser wherever a response says to go is an open
       redirect. Stripe-hosted checkout is this feature's only destination, so
       anything else is dropped and the guest pays in the restaurant. */
    function stripeCheckoutUrl(payment) {
      if (!payment || typeof payment.checkoutUrl !== 'string') return '';
      var url;
      try { url = new URL(payment.checkoutUrl); } catch (error) { return ''; }
      if (url.protocol !== 'https:') return '';
      /* Exact host, or a subdomain of it — never a suffix match on the string,
         which would accept `checkout.stripe.com.example.net`. */
      if (url.hostname !== 'stripe.com' && url.hostname.slice(-11) !== '.stripe.com') return '';
      return url.href;
    }

    function goToPayment(payment) {
      var url = stripeCheckoutUrl(payment);
      if (!url) return;
      try { window.location.assign(url); } catch (error) { /* the order stands either way */ }
    }

    function showOrderOk(order) {
      var reference = order.orderId ? String(order.orderId).slice(0, 6).toUpperCase() : '';
      el('order-live').hidden = true;
      var ok = el('order-ok');
      ok.hidden = false;
      ok.innerHTML =
        '<div class="klar-check">✓</div><h3>' + esc(t.orderOk) + '</h3>' +
        (reference ? '<p class="klar-muted">' + esc(t.reference) + ' <b>' + esc(reference) + '</b></p>' : '') +
        (typeof order.totalCents === 'number'
          ? '<div class="klar-big">' + esc(money(order.totalCents, order.currency || currency)) + '</div>'
          : '') +
        /* These two name the room even where `onlinePayment` is true, and that
           is deliberate rather than an oversight. This embed keeps no order in
           storage, so the confirmation exists only during the visit the order
           was placed in — and when a card page was offered, goToPayment has
           already taken the browser to Stripe. A guest who is still here to
           read this is therefore a guest who did NOT reach a card page: the
           venue takes no online payment, or the redirect was refused or threw.
           In every one of those cases they pay in the room, so driving this off
           the venue's switch would promise a card payment to exactly the guest
           who has no way to make one. The basket note above is the one that
           follows the switch. */
        '<p class="klar-muted">' + esc(fulfilment === 'takeaway' ? t.collect : t.table) + '</p>' +
        '<button type="button" class="klar-btn" data-klar="order-again" style="margin-top:20px">' +
        esc(t.orderAgain) + '</button>';
      cart = [];
      orderName = '';
      orderPhone = '';
      orderErr = '';
      checkoutKey = null;
      renderItems();
      renderCart();
      el('order-again').addEventListener('click', function () {
        ok.hidden = true;
        el('order-live').hidden = false;
      });
    }

    function placeOrder() {
      if (sending) return;
      if (!orderName.trim()) {
        orderErr = t.needName;
        renderCart();
        return;
      }
      orderErr = '';
      sending = true;
      renderCart();
      if (!checkoutKey) checkoutKey = newKey();
      win
        .fetch(cfg.api + '/api/' + encodeURIComponent(cfg.orderSlug) + '/order', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Idempotency-Key': checkoutKey },
          body: JSON.stringify({
            guestName: orderName.trim(),
            guestPhone: orderPhone.trim() || undefined,
            fulfilmentType: fulfilment,
            items: cart.map(function (line) {
              return { menuItemId: line.id, qty: line.qty };
            })
          })
        })
        .then(readJson)
        .then(function (result) {
          sending = false;
          if (!result.ok) {
            warn('order rejected for "' + cfg.orderSlug + '" (' + result.status + ').', result.body);
            orderErr =
              result.status === 429
                ? t.tooMany
                : // Never `result.body.error`. The API writes that string in one
                  // language and this embed renders in another, so the fallback
                  // showed English "Order could not be placed" on a Finnish
                  // embed and Finnish "Liian monta tilausta" on an English one.
                  // An unmapped code gets the embed's own generic instead.
                  t.codes[result.body.code] || t.generic + callUs();
            renderCart();
            return;
          }
          showOrderOk(result.body.order || {});
          /* Only ever after showOrderOk — see goToPayment. Absent for every
             order until the restaurant switches online payment on. */
          goToPayment(result.body.payment);
        })
        .catch(function (error) {
          sending = false;
          warn('order request failed for "' + cfg.orderSlug + '".', error);
          orderErr = t.generic + callUs();
          renderCart();
        });
    }

    /* The one way anything enters the cart — the embed's own buttons and a
     * host site's klar:add both come through here, so an id the loaded menu
     * does not carry is refused once, in one place. */
    function addToCart(id, qty) {
      var step = typeof qty === 'number' && qty ? Math.round(qty) : 1;
      var item = itemById(id);
      if (!item) {
        warn(
          'klar:add refused — "' + id + '" is not an item on the loaded menu for "' +
            cfg.orderSlug + '".'
        );
        return false;
      }
      if (item.available === false) {
        warn('klar:add refused — "' + item.name + '" is not available.');
        return false;
      }
      var line = lineFor(id);
      if (line) {
        line.qty += step;
        if (line.qty <= 0) cart = cart.filter(function (other) { return other.id !== id; });
      } else if (step > 0) {
        cart.push({ id: item.id, name: item.name, cents: item.priceCents, qty: step });
      } else {
        return false;
      }
      cartChanged();
      renderItems();
      renderCart();
      return true;
    }

    if (cfg.order) {
      itemsWrap.addEventListener('click', function (event) {
        var button = event.target.closest('button[data-klar-add]');
        if (!button || button.disabled) return;
        addToCart(button.dataset.klarAdd, 1);
      });

      mount.addEventListener('klar:add', function (event) {
        var detail = event.detail || {};
        addToCart(detail.id, detail.qty);
      });

      /* A host that mounted after the menu landed asks for the state again
         rather than waiting for an event that has already been and gone. */
      doc.addEventListener('klar:sync', function () {
        if (lastMenu) emit('klar:menu', lastMenu);
        if (lastCart) emit('klar:cart', lastCart);
      });

      catsWrap.addEventListener('click', function (event) {
        var button = event.target.closest('button[data-klar-cat]');
        if (!button) return;
        activeCat = Number(button.dataset.klarCat);
        catsWrap.querySelectorAll('button').forEach(function (other) {
          other.classList.toggle('klar-on', other === button);
        });
        renderItems();
      });

      cartWrap.addEventListener('click', function (event) {
        var qtyButton = event.target.closest('button[data-klar-qty]');
        if (qtyButton) {
          var id = qtyButton.dataset.klarQty;
          var to = Number(qtyButton.dataset.klarTo);
          if (to <= 0) {
            cart = cart.filter(function (line) { return line.id !== id; });
          } else {
            var line = lineFor(id);
            if (line) line.qty = to;
          }
          cartChanged();
          renderItems();
          renderCart();
          return;
        }
        var fulButton = event.target.closest('button[data-klar-ful]');
        if (fulButton) {
          fulfilment = fulButton.dataset.klarFul;
          cartChanged();
          renderCart();
          return;
        }
        if (event.target.closest('[data-klar="order-submit"]')) placeOrder();
      });

      cartWrap.addEventListener('input', function (event) {
        var field = event.target.dataset ? event.target.dataset.klar : null;
        if (field === 'oname') orderName = event.target.value;
        if (field === 'ophone') orderPhone = event.target.value;
      });

      renderCart();
    }

    /* ================================= BOOK ================================= */

    var dateEl = el('date');
    var partyEl = el('party');
    var slotsEl = el('slots');
    var bookErrEl = el('book-err');
    var bookBtn = el('book-submit');

    /* Country dial picker: opens a searchable list of real flags; choosing one
       sets the hidden bphone-dial the submit combines with the number. */
    (function () {
      var dialBtn = el('bphone-dial-btn');
      var dialInput = el('bphone-dial');
      var dialFlag = el('bphone-dial-flag');
      var dialCode = el('bphone-dial-code');
      var dialMenu = el('bphone-dial-menu');
      var dialSearch = el('bphone-dial-search');
      if (!dialBtn || !dialMenu) return;

      function closeDial() {
        dialMenu.hidden = true;
        dialBtn.setAttribute('aria-expanded', 'false');
      }
      function filterDial(query) {
        var q = query.trim().toLowerCase();
        dialMenu.querySelectorAll('[data-dial]').forEach(function (option) {
          option.hidden = q.length > 0 && option.textContent.toLowerCase().indexOf(q) === -1;
        });
      }
      function chooseDial(option) {
        dialInput.value = option.getAttribute('data-dial');
        dialCode.textContent = option.getAttribute('data-dial');
        dialFlag.src = flagUrl(option.getAttribute('data-iso'));
        closeDial();
      }
      dialBtn.addEventListener('click', function () {
        if (!dialMenu.hidden) { closeDial(); return; }
        dialMenu.hidden = false;
        dialBtn.setAttribute('aria-expanded', 'true');
        dialSearch.value = '';
        filterDial('');
        dialSearch.focus();
      });
      dialSearch.addEventListener('input', function () { filterDial(dialSearch.value); });
      dialSearch.addEventListener('keydown', function (event) {
        if (event.key === 'Escape') { closeDial(); dialBtn.focus(); return; }
        if (event.key === 'Enter') {
          var first = dialMenu.querySelector('[data-dial]:not([hidden])');
          if (first) chooseDial(first);
        }
      });
      dialMenu.addEventListener('click', function (event) {
        var option = event.target.closest('[data-dial]');
        if (option) chooseDial(option);
      });
      document.addEventListener('click', function (event) {
        if (dialMenu.hidden) return;
        if (!dialMenu.contains(event.target) && !dialBtn.contains(event.target)) closeDial();
      });
    })();
    var chosenSlot = '';
    var booking = false;

    /**
     * Take the guest to the first thing they still have to fill in.
     *
     * `pairs` is [missing?, element] in the order the form reads. The time row
     * is a div of buttons rather than a field, so it is scrolled to and not
     * focused — calling focus() on it would do nothing and, on iOS, tossing up
     * the keyboard for a non-input is worse than leaving it alone. Wrapped
     * because scrollIntoView options are ignored on older Safari, where the
     * plain call is still correct.
     */
    function focusFirstMissing(pairs) {
      for (var i = 0; i < pairs.length; i += 1) {
        if (!pairs[i][0]) continue;
        var target = pairs[i][1];
        if (!target) return;
        try {
          target.scrollIntoView({ behavior: 'smooth', block: 'center' });
        } catch (error) {
          target.scrollIntoView();
        }
        if (typeof target.focus === 'function' && target.tagName !== 'DIV') {
          target.focus({ preventScroll: true });
        }
        return;
      }
    }

    /* The venue's deposit rule, as the availability answer last stated it:
       { amount_per_guest_eur, threshold } or null. Never inferred here — a
       widget that decided for itself which parties owe a deposit would be a
       second rule to disagree with the server's. */
    var depositRule = null;

    /** What this party owes, in euros, or null. Mirrors the server's rule. */
    function depositForParty() {
      var size = Number(partyEl.value);
      if (!depositRule || !size || size < depositRule.threshold) return null;
      return {
        perGuest: depositRule.amount_per_guest_eur,
        total: depositRule.amount_per_guest_eur * size
      };
    }

    /* The line under the party picker and the wording on the button, kept in
       one place: they are two halves of the same statement, and a button that
       says "book" under a line saying "pay first" is how a guest ends up
       surprised on Stripe's page. */
    function renderDeposit() {
      var note = el('deposit-note');
      var owed = depositForParty();
      if (!note) return;
      if (!owed) {
        note.hidden = true;
        note.textContent = '';
        if (!booking) bookBtn.textContent = t.book;
        return;
      }
      note.hidden = false;
      note.textContent = t.depositNotice
        .replace('{threshold}', String(depositRule.threshold))
        .replace('{eur}', String(owed.perGuest))
        .replace('{total}', String(owed.total));
      if (!booking) bookBtn.textContent = t.depositPay;
    }

    /**
     * The missing-field names as one sentence: "your email", "a time and your
     * email", "the date, a time and your email".
     *
     * Both languages join a list the same way — commas, and the last item
     * behind the word for "and" with no comma before it — so one function
     * serves both and the word itself comes from the dictionary.
     */
    function joinFields(names) {
      var list;
      if (names.length <= 1) list = names[0] || '';
      else list = names.slice(0, -1).join(', ') + ' ' + t.fieldAnd + ' ' + names[names.length - 1];
      return t.bookFields.replace('{fields}', list);
    }

    /* Every stop this form makes is a row Klar can count. A guest who was
       refused in the browser — a field left empty, a time the grid dropped,
       an API that never answered — used to leave nothing anywhere: no request,
       no row, no bell (La Lasagna, 2026-09-13; AUDIT-2026-09 F-002). So the
       form now says so, to the same endpoint the hosted widget's funnel uses:
       `form_blocked` with the NAMES of the fields it refused on, `widget_failed`
       with why, `booking_failed` with the server's status and code. Never what
       the guest typed — the server drops anything else anyway.

       Fire-and-forget: keepalive so a beacon sent as the page is left still
       goes, and every failure swallowed. A booking must never fail, slow down
       or show an error because a counter did not get through. */
    var funnelSession = 'klar-' + Date.now().toString(36) + Math.random().toString(36).slice(2, 10);
    function track(type, meta) {
      try {
        win
          .fetch(cfg.api + '/api/' + encodeURIComponent(cfg.bookSlug) + '/widget-events', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            keepalive: true,
            body: JSON.stringify({ session_id: funnelSession, event_type: type, metadata: meta || {} })
          })
          .catch(function () {});
      } catch (error) {
        /* a counter that cannot be sent is not a fault the guest should see */
      }
    }

    function showBookErr(message) {
      bookErrEl.textContent = message;
      bookErrEl.hidden = !message;
      /* An error about something the guest typed in the collapsed section has
         to be shown next to it. Only opens when that section holds an allergy —
         a missing name must not fling open two boxes nobody asked for. */
      var more = el('bmore');
      if (message && more && el('bdiet').value.trim()) more.open = true;
    }

    /* A fault is shown AT the field, not only in the line above the button.
       On a phone that line sits below the fold: a guest who pressed Book with
       no time chosen saw the page jump to the time grid and nothing else —
       no red, no message — and read it as "sent". Two such attempts were then
       reported as bookings that never got a confirmation (2026-09-13). So the
       field itself goes red and says what it needs, and the first one is
       scrolled into view. The note element is made on first use so the form
       template stays as it is. */
    function markField(target, message) {
      var field = target && target.closest ? target.closest('.klar-field') : null;
      if (!field) return;
      var note = field.querySelector('.klar-field-err');
      if (message) {
        if (!note) {
          note = doc.createElement('p');
          note.className = 'klar-field-err';
          field.appendChild(note);
        }
        note.textContent = message;
        field.classList.add('klar-missing');
      } else {
        if (note) note.textContent = '';
        field.classList.remove('klar-missing');
      }
    }

    /* How far the opening load will walk forward looking for a day that can
       actually be booked. A form that opens on "the restaurant is closed on
       this day" reads as broken rather than as closed — the guest is left to
       guess which day is not, and most will not guess, they will leave.
       Bounded because every step is one availability request, and a venue
       shut for longer than a fortnight is a phone call, not a form. Only the
       opening load searches: once the guest has picked a date, their date
       stands and a closed day is answered honestly. */
    var OPENING_SEARCH_DAYS = 14;

    function loadSlots(hunt) {
      var search = typeof hunt === 'number' ? hunt : 0;
      /* The time the guest already chose is kept across a party-size or date
         change when it is still free, and named when it is not. It used to be
         cleared silently on every reload: pick 20:00, then step the party
         from 2 to 4, and the choice was gone with nothing on screen to say
         so — Book then failed for "no time" on a form that looked complete. */
      var wanted = chosenSlot;
      chosenSlot = '';
      markField(slotsEl, '');
      if (!dateEl.value) {
        slotsEl.innerHTML = '<span class="klar-muted">—</span>';
        return;
      }
      slotsEl.innerHTML = '<span class="klar-muted">' + esc(t.slotsLoading) + '</span>';
      win
        .fetch(
          cfg.api + '/api/' + encodeURIComponent(cfg.bookSlug) + '/availability?date=' +
            encodeURIComponent(dateEl.value) + '&party_size=' + encodeURIComponent(partyEl.value)
        )
        .then(function (response) {
          if (!response.ok) throw new Error('availability ' + response.status);
          return response.json();
        })
        .then(function (data) {
          /* LA LASAGNA TAKES NO DEPOSIT — operator ruling 2026-09-10. The
             availability answer is ignored rather than read, so a
             `deposit_stripe` rule written on the tenant row later cannot arm
             this page unwatched. The rest of the deposit path is left in place
             so this fork stays close to the canonical embed. */
          depositRule = null;
          renderDeposit();
          var slots = data.slots || [];
          var bookable = slots.some(function (slot) { return slot.available; });
          if (!bookable && search > 0 && dateEl.value < dateEl.max) {
            dateEl.value = plusDays(dateEl.value, 1);
            loadSlots(search - 1);
            return;
          }
          if (slots.length === 0) {
            slotsEl.innerHTML = '<span class="klar-muted">' + esc(t.closed) + '</span>';
            return;
          }
          if (!bookable) {
            slotsEl.innerHTML = '<span class="klar-muted">' + esc(t.noSlots + callUs()) + '</span>';
            return;
          }
          slotsEl.innerHTML = slots
            .map(function (slot) {
              var kept = slot.available && slot.time === wanted;
              return (
                '<button type="button" data-klar-slot="' + esc(slot.time) + '"' +
                (slot.available ? '' : ' disabled') + (kept ? ' class="klar-on"' : '') + '>' +
                esc(hhmm(slot.time)) + '</button>'
              );
            })
            .join('');
          if (wanted) {
            var stillFree = slots.some(function (slot) {
              return slot.available && slot.time === wanted;
            });
            if (stillFree) chosenSlot = wanted;
            else markField(slotsEl, t.slotGone.replace('{time}', hhmm(wanted)));
          }
        })
        .catch(function (error) {
          warn(
            'availability request failed for booking slug "' + cfg.bookSlug + '" at ' + cfg.api +
              ' — no times can be offered.',
            error
          );
          var failed = /availability (\d+)$/.exec(String(error && error.message));
          track('widget_failed', { reason: 'availability', status: failed ? Number(failed[1]) : 0 });
          slotsEl.innerHTML =
            '<span class="klar-muted">' +
            esc((/ 404$/.test(error.message) ? t.bookingOff : t.slotsFailed) + callUs()) +
            '</span>';
        });
    }

    /* The 202 panel. Deliberately NOT showBookOk with different words: no tick,
       no date, no "book again" — every one of those reads as done. The guest has
       one job left and the screen says only that. Ported from the canonical
       embed (packages/pipeline/embeds/klar-embed.js), which this fork predates. */
    function showVerifyEmail(email) {
      el('book-live').hidden = true;
      var ok = el('book-ok');
      ok.hidden = false;
      ok.innerHTML =
        '<div class="klar-check">✉</div><h3>' + esc(t.verifyTitle) + '</h3>' +
        '<p class="klar-muted">' +
        esc(t.verifyBody.replace('{email}', email)) + '</p>' +
        '<p class="klar-muted">' + esc(t.verifySpam) + '</p>';
      /* Same reason as showBookOk: the form just collapsed above the guest, so
         on a phone this panel can render off-screen entirely. */
      try {
        ok.scrollIntoView({ behavior: 'smooth', block: 'center' });
      } catch (error) {
        ok.scrollIntoView();
      }
    }

    function showBookOk(name, confirmed) {
      el('book-live').hidden = true;
      var ok = el('book-ok');
      var people = Number(partyEl.value);
      ok.hidden = false;
      ok.innerHTML =
        '<div class="klar-check">✓</div><h3>' + esc(t.bookOk) + '</h3>' +
        '<p class="klar-muted">' + esc(name) + ' · ' + people + ' ' +
        esc(people === 1 ? t.person : t.people) + '</p>' +
        '<div class="klar-big">' + esc(confirmed.date || dateEl.value) + ' ' + esc(t.at) + ' ' +
        esc(hhmm(confirmed.time_slot || chosenSlot)) + '</div>' +
        /* The address is printed back so a typo is caught here, by the one
           person who can see it, and not a week later by a guest who "never
           got the email". */
        '<p class="klar-muted">' +
        esc(t.bookConfirm.replace('{email}', el('bemail').value.trim())) + '</p>' +
        '<button type="button" class="klar-btn" data-klar="book-again" style="margin-top:20px">' +
        esc(t.bookAgain) + '</button>';
      /* The form the guest was at the bottom of has just collapsed above them;
         on a phone that leaves whatever sat under the form on screen and the
         tick out of sight. Bring it into view so "booked" is what they read. */
      try {
        ok.scrollIntoView({ behavior: 'smooth', block: 'center' });
      } catch (error) {
        ok.scrollIntoView();
      }
      el('book-again').addEventListener('click', function () {
        ok.hidden = true;
        el('book-live').hidden = false;
        el('bname').value = '';
        el('bphone').value = '';
        el('bemail').value = '';
        el('breq').value = '';
        el('bdiet').value = '';
        el('bdiet-consent').checked = false;
        el('bdiet-consent-row').hidden = true;
        chosenSlot = '';
        loadSlots();
      });
    }

    if (cfg.book) {
      var today = todayIn(cfg.timezone);
      dateEl.min = today;
      dateEl.max = plusDays(today, BOOKING_HORIZON_DAYS);
      dateEl.value = today;
      for (var size = 1; size <= cfg.partyMax; size++) {
        var option = doc.createElement('option');
        option.value = String(size);
        option.textContent = size + ' ' + (size === 1 ? t.person : t.people);
        if (size === 2) option.selected = true;
        partyEl.appendChild(option);
      }

      slotsEl.addEventListener('click', function (event) {
        var button = event.target.closest('button[data-klar-slot]');
        if (!button || button.disabled) return;
        chosenSlot = button.dataset.klarSlot;
        showBookErr('');
        markField(slotsEl, '');
        slotsEl.querySelectorAll('button').forEach(function (other) {
          other.classList.toggle('klar-on', other === button);
        });
      });
      dateEl.addEventListener('change', loadSlots);
      /* The note follows the picker immediately, not on the availability answer
         coming back a moment later — a guest who steps 7 -> 8 and reads "no
         deposit" for a second has been told something untrue. */
      partyEl.addEventListener('change', function () {
        renderDeposit();
        loadSlots();
      });

      /* A missing-fields error stops being true the moment the guest starts
         filling one in, but it used to sit there until the next click — so the
         line still named four fields that were already typed, next to the
         browser's own tooltip about the one that was not. Clear it on the first
         keystroke and let the next click say what is actually left. */
      ['bname', 'bphone', 'bemail'].forEach(function (field) {
        el(field).addEventListener('input', function () {
          showBookErr('');
          markField(el(field), '');
        });
      });
      dateEl.addEventListener('change', function () {
        showBookErr('');
        markField(dateEl, '');
      });

      /* The tick appears only once there is an allergy to consent to, and an
         emptied field takes the tick away with it — otherwise a guest who
         typed and then deleted would leave a consent standing over nothing. */
      el('bdiet').addEventListener('input', function () {
        var has = el('bdiet').value.trim().length > 0;
        el('bdiet-consent-row').hidden = !has;
        if (!has) el('bdiet-consent').checked = false;
      });

      bookBtn.addEventListener('click', function () {
        if (booking) return;
        var name = el('bname').value.trim();
        /* The dial code alone is not a phone number. combineDial('+358', '')
           returns '+358', which is truthy, so an empty phone field used to pass
           this check and be refused by the server instead — with the refusal
           printed in the line above the button rather than at the field. */
        var phoneLocal = el('bphone').value.trim();
        var phone = combineDial(el('bphone-dial').value, phoneLocal);
        var email = el('bemail').value.trim();
        var requests = el('breq').value.trim();
        var diet = el('bdiet').value.trim();
        var dietConsent = el('bdiet-consent').checked;
        /* The fifth column is the field's name for the beacon — the same word
           on every form we serve, so "phone ×3" means the same thing whichever
           site it came from. */
        var required = [
          [!dateEl.value, dateEl, t.needDate, t.fieldDate, 'date'],
          [!chosenSlot, slotsEl, t.needTime, t.fieldTime, 'time'],
          [!name, el('bname'), t.needName, t.fieldName, 'name'],
          [!phoneLocal, el('bphone'), t.needPhone, t.fieldPhone, 'phone'],
          [!email, el('bemail'), t.needEmail, t.fieldEmail, 'email']
        ];
        /* Name only what is actually empty. The old line listed all five
           fields whatever the guest had already filled in, so someone who had
           typed everything but the email was told to fill in the date, the
           time and their own name — and went looking for a fault in the four
           fields that were fine. */
        var missing = [];
        var blocked = [];
        required.forEach(function (row) {
          markField(row[1], row[0] ? row[2] : '');
          if (row[0]) {
            missing.push(row[3]);
            blocked.push(row[4]);
          }
        });
        if (missing.length) {
          track('form_blocked', { fields: blocked });
          showBookErr(joinFields(missing));
          /* On a phone the error line sits just above the button, which is
             where the thumb already is — and the field it is about can be two
             screens up, off the fold, with nothing pointing at it. So the first
             thing missing is scrolled to and focused. Desktop shows the whole
             form at once and never needed this; a phone does. */
          focusFirstMissing(required);
          return;
        }
        /* Refused here as well as on the server. The server is what makes it
           true — a checkbox is a suggestion and a direct POST ignores it — but
           being turned away in the form costs the guest nothing. */
        if (diet && !dietConsent) {
          showBookErr(t.dietaryConsentMissing);
          track('form_blocked', { fields: ['diet_consent'] });
          return;
        }
        showBookErr('');
        var payload = {
          guest_name: name,
          guest_phone: phone,
          guest_email: email,
          party_size: Number(partyEl.value),
          date: dateEl.value,
          time_slot: chosenSlot,
          special_requests: requests || undefined,
          dietary_notes: diet || undefined,
          health_consent: diet ? dietConsent : undefined,
          health_consent_language: cfg.locale,
          source: 'widget'
        };

        /* A party the venue asks a deposit of never posts the booking from
           here. It goes to Stripe first and the booking is made on the way
           back — the server refuses this payload without a paid session, so
           posting it anyway would only produce a 402 the guest has to read. */
        if (depositForParty()) {
          startDeposit(payload);
          return;
        }
        submitBooking(payload);
      });

      /* Send the guest to Stripe, having first put the form they filled in
         somewhere it survives the trip. sessionStorage, not the URL: the
         allergy note is health data and a query string is written into
         history, logs and anything sitting in front of the site. It is read
         once on the way back and deleted immediately, whatever happened. */
      function startDeposit(payload) {
        booking = true;
        bookBtn.disabled = true;
        bookBtn.textContent = t.depositRedirect;
        win
          .fetch(cfg.api + '/api/' + encodeURIComponent(cfg.bookSlug) + '/book/deposit', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              date: payload.date,
              time_slot: payload.time_slot,
              party_size: payload.party_size,
              return_url: win.location.href.split('#')[0]
            })
          })
          .then(readJson)
          .then(function (result) {
            if (!result.ok || !result.body.checkout_url) {
              booking = false;
              bookBtn.disabled = false;
              renderDeposit();
              warn('deposit session refused for "' + cfg.bookSlug + '".', result.body);
              track('booking_failed', { status: result.status, error_code: result.body.code || null, form: 'deposit' });
              showBookErr(result.body.error || t.generic + callUs());
              if (result.body.code === 'SLOT_TAKEN') loadSlots();
              return;
            }
            try {
              win.sessionStorage.setItem(
                depositStoreKey(),
                JSON.stringify({ payload: payload, session: result.body.session_id })
              );
            } catch (storageError) {
              /* Private mode, or storage full. Nothing has been charged yet,
                 so the honest move is to stop before it is. */
              booking = false;
              bookBtn.disabled = false;
              renderDeposit();
              warn('the booking could not be held across the payment.', storageError);
              track('widget_failed', { reason: 'deposit_hold' });
              showBookErr(t.generic + callUs());
              return;
            }
            win.location.href = result.body.checkout_url;
          })
          .catch(function (error) {
            booking = false;
            bookBtn.disabled = false;
            renderDeposit();
            warn('deposit request failed for "' + cfg.bookSlug + '".', error);
            track('widget_failed', { reason: 'deposit_network' });
            showBookErr(t.generic + callUs());
          });
      }

      function submitBooking(payload, depositSession) {
        booking = true;
        bookBtn.disabled = true;
        bookBtn.textContent = depositSession ? t.depositFinishing : t.booking;
        win
          .fetch(cfg.api + '/api/' + encodeURIComponent(cfg.bookSlug) + '/book', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(
              depositSession
                ? Object.keys(payload).reduce(
                    function (out, key) {
                      out[key] = payload[key];
                      return out;
                    },
                    { deposit_session: depositSession }
                  )
                : payload
            )
          })
          .then(readJson)
          .then(function (result) {
            booking = false;
            bookBtn.disabled = false;
            renderDeposit();
            if (!result.ok) {
              warn('booking rejected for "' + cfg.bookSlug + '" (' + result.status + ').', result.body);
              track('booking_failed', { status: result.status, error_code: result.body.code || null });
              /* The API returns per-field messages — show them, they are more
               * useful than the summary. */
              var fields = result.body.fields;
              var detail = fields
                ? Object.keys(fields)
                    .map(function (key) {
                      return /invalid phone/i.test(fields[key]) ? t.badPhone : fields[key];
                    })
                    .join(' · ')
                : '';
              showBookErr(detail || result.body.error || t.generic + callUs());
              if (result.body.code === 'SLOT_TAKEN') loadSlots();
              return;
            }
            /* 202: the venue asks the guest to prove the address first. Nothing
               is booked yet, so this is NOT the "booked" panel. Before this
               branch existed the 202 fell through to showBookOk and the guest
               was told "Pöytä varattu" for a table that did not exist. */
            if (result.status === 202 && result.body.status === 'verification_required') {
              showVerifyEmail(result.body.email || el('bemail').value.trim());
              return;
            }
            showBookOk(payload.guest_name, result.body.booking || {});
          })
          .catch(function (error) {
            booking = false;
            bookBtn.disabled = false;
            renderDeposit();
            warn('booking request failed for "' + cfg.bookSlug + '".', error);
            track('widget_failed', { reason: 'book_network' });
            showBookErr(t.generic + callUs());
          });
      }

      /* Where the guest lands when Stripe is done. The session id is in the
         query string, the form is in sessionStorage, and the booking is made
         now — the payment on its own has bought nothing yet. The stored form
         is deleted before the request goes out, so a reload can never post the
         same guest twice, and the parameter is stripped from the URL so a
         shared or bookmarked link carries no payment reference. */
      function resumeFromDeposit() {
        var params;
        try {
          params = new win.URL(win.location.href).searchParams;
        } catch (urlError) {
          return false;
        }
        var sessionId = params.get('klar_deposit');
        if (!sessionId) return false;

        var stored = null;
        try {
          var raw = win.sessionStorage.getItem(depositStoreKey());
          win.sessionStorage.removeItem(depositStoreKey());
          if (raw) stored = JSON.parse(raw);
        } catch (storageError) {
          warn('the held booking could not be read back.', storageError);
        }

        try {
          var clean = new win.URL(win.location.href);
          clean.searchParams.delete('klar_deposit');
          win.history.replaceState({}, '', clean.toString());
        } catch (historyError) { /* a URL the browser will not rewrite is cosmetic */ }

        if (!stored || !stored.payload || stored.session !== sessionId) {
          /* Paid, but this browser cannot say what for — a different device, a
             cleared tab, a link forwarded to somebody else. Nothing is booked
             and nothing is charged twice; the venue is the only one who can
             sort it out, so the guest is pointed at them. */
          warn('returned from a deposit payment with no held booking.', sessionId);
          track('widget_failed', { reason: 'deposit_return_lost' });
          showBookErr(t.depositFailed + callUs());
          return true;
        }

        dateEl.value = stored.payload.date;
        partyEl.value = String(stored.payload.party_size);
        chosenSlot = stored.payload.time_slot;
        submitBooking(stored.payload, sessionId);
        return true;
      }

      function depositStoreKey() {
        return 'klar-deposit-' + cfg.bookSlug;
      }

      mount.klarResumeDeposit = resumeFromDeposit;
    }

    /* ---- lazy start: a visitor who never scrolls here pays for no request ---- */
    var started = false;
    function start() {
      if (started) return;
      started = true;
      if (cfg.order) loadMenu();
      if (cfg.book) {
        loadSlots(OPENING_SEARCH_DAYS);
        /* A guest coming back from Stripe has already paid, so this runs on
           start rather than waiting for the section to be scrolled to. */
        if (mount.klarResumeDeposit) mount.klarResumeDeposit();
      }
    }
    mount.klarStart = start; /* so a nav link or a test can force it */

    if (win.IntersectionObserver) {
      var observer = new win.IntersectionObserver(
        function (entries) {
          if (
            entries.some(function (entry) {
              return entry.isIntersecting;
            })
          ) {
            start();
            observer.disconnect();
          }
        },
        { rootMargin: '600px' }
      );
      observer.observe(mount);

      /* Warm it once the page is otherwise idle, so the section is ALREADY
         filled when the visitor reaches it. 600px of rootMargin still means the
         menu is fetched while they are scrolling towards it, and on a slow
         connection they arrive at "Loading the menu…" — which reads as broken
         rather than as loading. The observer stays: it is what catches a visitor
         who lands mid-page, and start() is idempotent. */
      if (win.requestIdleCallback) {
        win.requestIdleCallback(start, { timeout: 2000 });
      } else {
        win.setTimeout(start, 1200);
      }
    } else {
      start();
    }

    /* A direct #anchor link into the section must not wait for the observer. */
    function startOnHash() {
      var id = mount.id || (mount.closest('[id]') && mount.closest('[id]').id);
      if (id && win.location.hash === '#' + id) start();
    }
    startOnHash();
    win.addEventListener('hashchange', startOnHash);
  }

  /* ------------------------------------------------------------------ boot --- */

  function boot() {
    var win = typeof window !== 'undefined' ? window : null;
    if (!win || !win.document) return;
    if (!win.fetch) {
      warn('this browser has no fetch(); the ordering and booking surfaces cannot load.');
      return;
    }
    var mounts = win.document.querySelectorAll('[data-klar-slug],[data-klar-order-slug],[data-klar-book-slug]');
    if (mounts.length === 0) {
      warn('no mount element found — add <div data-klar-slug="your-slug"></div> to the page.');
      return;
    }
    mounts.forEach(function (mount) {
      if (mount.dataset.klarMounted === '1') return;
      mount.dataset.klarMounted = '1';
      try {
        mountKlar(mount, win);
      } catch (error) {
        /* One broken mount must never take the rest of the page with it. */
        warn('mount failed.', error);
      }
    });
  }

  if (typeof document !== 'undefined' && document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();
