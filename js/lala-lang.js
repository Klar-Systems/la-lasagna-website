/* La Lasagna — self-contained EN/FI language switcher (replaces Weglot).
   Walks visible text nodes and swaps English<->Finnish from an embedded dictionary
   captured from the live site. Choice persists across pages via localStorage. */
(function(){
  var DICT = {"Skip to Content":"Siirry sisältöön","Home":"Etusivu","Lunch":"Lounas","Lasagnas":"Lasagnat","Pizzas":"Pizzat","Salads":"Salaatit","Desserts":"Jälkiruoat","Drinks":"Juomat","Who we are":"Keitä me olemme","Book now":"Varaa nyt","Open Menu":"Avaa valikko","Close Menu":"Sulje valikko","Back":"Takaisin","Everyday from 14-17":"Joka päivä klo 14–17","Book":"Varaa","Welcome to our family-run restaurant and feel the warmth, rich aromas, kind people, and dishes crafted to feel like home.":"Tervetuloa perheyrityksemme ravintolaan ja nauti lämpimästä tunnelmasta, herkullisista tuoksuista, ystävällisestä henkilökunnasta sekä ruoista, jotka on valmistettu niin, että tunnet olosi kotoisaksi.","Learn more":"Lue lisää","Our suppliers":"Toimittajamme","400+ Reviews":"Yli 400 arvostelua","Location":"Sijainti","Contact & Book":"Yhteystiedot ja varaukset","Opening hours":"Aukioloajat","Monday-Thursday 10:30am-9:00pm":"Maanantai–torstai klo 10.30–21.00","Friday 10:30am-11:30pm":"Perjantai klo 10.30–23.30","Saturday 12:00am-11:30pm":"Lauantai klo 00.00–23.30","Sunday - Closed":"Sunnuntai – Suljettu","Service in languages":"Kielivalikoima","& Sign language":"& Viittomakieli","Our lunch set includes the salad of the day, delicious Italian starters, our special lasagna sauce, the best Sicilian coffee (Ionia il caffe), and the desserts of the day!":"Lounasmenuumme sisältää päivän salaatin, herkullisia italialaisia alkupaloja, erityisen lasagnekastikkeemme, parasta sisilialaista kahvia (Ionia il caffe) sekä päivän jälkiruokia!","Play":"Toista","Unmute":"Poista mykistys","Mute":"Mykistä","Settings":"Asetukset","Speed":"Nopeus","Normal":"Normaali","Go back to previous menu":"Palaa edelliseen valikkoon","Exit fullscreen":"Poistu koko näytön tilasta","Enter fullscreen":"Siirry koko näytön tilaan","% buffered":"% puskuroitu","The price includes a salad of the day, a dessert of the day, and coffee":"Hintaan sisältyy päivän salaatti, päivän jälkiruoka ja kahvi","Pizzas are finally here!":"Pizzat ovat vihdoin saapuneet!","Crisp, soft, and made the Sicilian way.":"Rapea, pehmeä ja sisilialaisella tavalla valmistettu.","Mozzarella, cherry tomatoes, Italian olive oil and fresh basil added after baking":"Mozzarella, kirsikkatomaatit, italialainen oliiviöljy ja tuore basilika lisätään paistamisen jälkeen","Mozzarella, N'duja, pepperoni, chilli honey and parmesan cheese added after baking":"Mozzarella, n’duja, pepperoni, chilihunaja ja parmesanjuusto lisätään paistamisen jälkeen","Mozzarella, chicken, bacon, roasted onion and smoky BBQ sauce added after baking":"Mozzarellaa, kanaa, pekonia, paistettua sipulia ja savuista BBQ-kastiketta lisätään paistamisen jälkeen","Mozzarella, tuna, shrimp, mussels, capers, mushroom, lemon-olive oil and arugula added after baking":"Mozzarella, tonnikala, katkaravut, simpukat, kaprikset, sienet, sitruuna-oliiviöljy ja rucola lisätään paistamisen jälkeen","Mozzarella, grilled artichoke, grilled eggplant, grilled zucchini, grilled bell pepper, goat cheese, Italian olive oil added after baking":"Mozzarellaa, grillattua artisokkaa, grillattua munakoisoa, grillattua kesäkurpitsaa, grillattua paprikaa, vuohenjuustoa sekä italialaista oliiviöljyä, joka lisätään paistamisen jälkeen","Mozzarella, mixed olives, feta cheese, sun-dried cherry tomatoes, olive oil and arugula added after baking":"Mozzarella, oliiviseos, fetajuusto, aurinkokuivatut kirsikkatomaatit, oliiviöljy ja rucola lisätään paistamisen jälkeen","Mozzarella, N'duja, pepperoni, chicken, bacon, roasted onion added after baking":"Mozzarella, n’duja, pepperoni, kana, pekoni ja paistettu sipuli lisätään paistamisen jälkeen","Mozzarella, sun-dried cherry tomatoes, goat cheese, Parma ham, arugula, parmesan and olive oil added after baking":"Mozzarellaa, aurinkokuivattuja kirsikkatomaatteja, vuohenjuustoa, parmankinkkua, rucolaa, parmesaania ja oliiviöljyä lisätään paistamisen jälkeen","Mozzarella, goat cheese, chicken, cherry tomatoes, devil's chilli jam, arugula and olive oil added after baking":"Mozzarellaa, vuohenjuustoa, kanaa, kirsikkatomaatteja, tulista chilihilloa, rucolaa ja oliiviöljyä lisätään paistamisen jälkeen","Mozzarella, goat cheese, gorgonzola, walnut, arugula, honey and parmesan cheese added after baking":"Mozzarella, vuohenjuusto, gorgonzola, pähkinä, rucola, hunaja ja parmesanjuusto lisätään paistamisen jälkeen","Mozzarella, smoked reindeer crumble, minced beef, fresh red onion, arugula added after baking":"Mozzarellaa, savustettua poronlihaa muruna, jauhettua naudanlihaa, tuoretta punasipulia ja rucolaa, jotka lisätään paistamisen jälkeen","Side Salads":"Lisäsalaatit","(included in main course)":"(sisältyy pääruokaan)","or":"tai","1. Insalata Caesar":"1. Caesar-salaatti","Toppings (choose one):":"Lisukkeet (valitse yksi):","Tuna fish":"Tonnikala","Chicken":"Kana","Original (vegetarian)":"Alkuperäinen (kasvissyöjä)","Mixed greens, house Caesar sauce, parmesan, olive oil.":"Salaattiseos, talon oma Caesar-kastike, parmesaania, oliiviöljyä.","2. Insalata di cavolo rosso":"2. Punakaalisalaatti","Red cabbage, olive oil, red onion, balsamico, parsley, tomatoes, lingonberry.":"Punakaali, oliiviöljy, punasipuli, balsamiviinietikka, persilja, tomaatit, puolukka.","3. Insalata mediterranea":"3. Välimeren salaatti","Mixed greens, tomatoes, red onion, olives, feta cheese, Italian salad sauce.":"Salaattiseosta, tomaatteja, punasipulia, oliiveja, fetajuustoa, italialaista salaattikastiketta.","4. Insalata italiana":"4. Italialainen salaatti","Mixed greens, tomatoes, red onion, lemon juice, Italian olive oil, balsamico.":"Salaattiseosta, tomaatteja, punasipulia, sitruunamehua, italialaista oliiviöljyä, balsamiviinietikkaa.","1. Gelato Siviera Maria from Bologna":"1. Gelato Siviera Maria, Bologna","(Ask staff about our flavor selection)":"(Kysy henkilökunnalta makuvalikoimastamme)","2. La Lasagna's Tiramisu":"2. La Lasagnan tiramisu","Panna Cotta":"Panna cotta","Choose from:":"Valitse seuraavista:","Move left":"Siirry vasemmalle","Move right":"Siirry oikealle","Move up":"Siirry ylöspäin","Move down":"Siirry alaspäin","Zoom in":"Lähennä","Zoom out":"Pienennä näkymää","Jump left by 75%":"Lasku vasemmalle 75 %:lla","End":"Loppu","Jump right by 75%":"Hyppää suoraan 75 %:lla","Page Up":"Sivu ylös","Jump up by 75%":"Kasvu 75 %:lla","Jump down by 75%":"Lasku 75 %:lla","Map Data":"Karttatiedot","Map data ©2026 Google":"Karttatiedot ©2026 Google","Click to toggle between metric and imperial units":"Napsauta vaihtaaksesi metrijärjestelmän ja englantilaisen mittayksikköjärjestelmän välillä","Terms":"Ehdot","A curated selection of cocktails, beers, and Italian aperitivi.":"Huolellisesti valikoitu valikoima cocktaileja, oluita ja italialaisia aperitiiveja.","A hidden Italian gem in the heart of Punavuori, Helsinki.":"Piilotettu italialainen helmi Helsingin Punavuoren sydämessä.","Our signature lasagna is made from a 400-year-old authentic Sicilian recipe, passed down through generations. Each piece of lasagna is crafted with fresh ingredients and traditional techniques, offering a rich, flavorful journey to Sicily with every bite.":"Tunnettu lasagnemme valmistetaan 400 vuotta vanhan, aidon sisilialaisen reseptin mukaan, joka on periytynyt sukupolvelta toiselle. Jokainen lasagnapala valmistetaan tuoreista raaka-aineista perinteisiä menetelmiä noudattaen, ja jokainen suupala vie sinut makurikkaalle matkalle Sisiliaan.","Perfect for a romantic dinner, or a vibrant gathering with friends, our restaurant blends historic flavors with warm Italian hospitality. Experience the taste of Sicily, right here in Helsinki.":"Ravintolamme sopii erinomaisesti niin romanttiseen illalliseen kuin vilkkaaseen ystävien kokoontumiseenkin, ja siinä yhdistyvät perinteiset makuelämykset ja lämmin italialainen vieraanvaraisuus. Koe Sisilian makumaailma täällä Helsingissä.","Contact us":"Ota yhteyttä","Book a table!":"Varaa pöytä!","We'll be in touch ASAP!":"Otamme yhteyttä mahdollisimman pian!","Name":"Nimi","For reservations please include: Date, Time and Persons":"Ilmoita varauksessa seuraavat tiedot: päivämäärä, kellonaika ja henkilömäärä","For parties of 8 or more guests, a reservation deposit of 12€ per guest is required to confirm the booking. The deposit will either be deducted from the final bill when the party arrives or refunded after the reservation has been honored.":"Kun seurueessa on vähintään 8 vierasta, varauksen vahvistamiseksi vaaditaan 12 euron varausmaksu vierasta kohden. Varausmaksu joko vähennetään lopullisesta laskusta seurueen saapuessa tai palautetaan, kun varaus on toteutunut.","Cancellations and changes in party size must be made at least 4 hours before the reservation time. For no-shows, late cancellations, or changes in party size made after this timeframe, the deposit for the missing guests will be retained.":"Peruutukset ja ryhmäkokoonpanon muutokset on tehtävä vähintään 4 tuntia ennen varausajankohtaa. Jos asiakas ei saavu paikalle, peruutus tehdään liian myöhään tai ryhmäkokoonpanon muutoksia tehdään tämän määräajan jälkeen, puuttuvien vieraiden varausmaksu pidätetään.","You can also book by calling us":"Voit varata myös soittamalla meille"};
  var KEY = 'lala-lang';
  function norm(s){ return s.replace(/\s+/g,' ').trim(); }
  function skip(p){
    while(p){
      var tn=p.nodeName;
      if(tn==='SCRIPT'||tn==='STYLE'||tn==='NOSCRIPT'||tn==='TEMPLATE') return true;
      if(p.classList && p.classList.contains('lala-no-translate')) return true;
      p=p.parentElement;
    }
    return false;
  }
  function textNodes(){
    var w=document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, null);
    var a=[],n;
    while(n=w.nextNode()){ if(n.nodeValue && n.nodeValue.trim() && !skip(n.parentElement)) a.push(n); }
    return a;
  }
  function toFI(){
    textNodes().forEach(function(n){
      var t=n.nodeValue, tr=t.trim(), fi=DICT[norm(tr)];
      if(fi){ if(n.__en==null) n.__en=t; n.nodeValue=t.replace(tr, fi); }
    });
  }
  function toEN(){ textNodes().forEach(function(n){ if(n.__en!=null) n.nodeValue=n.__en; }); }
  function label(l){ return l==='fi' ? 'Suomi' : 'English'; }
  function updateUI(l){
    var names=document.querySelectorAll('.current-language-name');
    for(var i=0;i<names.length;i++) names[i].textContent=label(l);
    var opts=document.querySelectorAll('.lala-lang-opt');
    for(var j=0;j<opts.length;j++)
      opts[j].setAttribute('aria-selected', opts[j].getAttribute('data-lang')===l ? 'true':'false');
  }
  function setLang(l, save){
    if(l==='fi') toFI(); else toEN();
    document.documentElement.setAttribute('lang', l==='fi' ? 'fi':'en');
    if(save!==false){ try{ localStorage.setItem(KEY,l); }catch(e){} }
    updateUI(l);
  }
  var openMenu=null;
  function closeMenu(){ if(openMenu){ openMenu.classList.remove('open'); openMenu=null; } }
  function options(makeEl){
    return [['fi','Suomi'],['en','English']].map(function(o){
      var el=makeEl(); el.className=(el.className+' lala-lang-opt').trim();
      el.setAttribute('data-lang',o[0]); el.textContent=o[1];
      el.addEventListener('click', function(ev){ ev.preventDefault(); ev.stopPropagation(); setLang(o[0]); closeMenu(); });
      return el;
    });
  }
  function buildDesktop(){
    var p=document.getElementById('multilingual-language-picker-desktop'); if(!p) return;
    p.classList.add('lala-no-translate');
    var menu=document.createElement('div'); menu.className='lala-lang-menu';
    options(function(){ var b=document.createElement('button'); b.type='button'; return b; })
      .forEach(function(b){ menu.appendChild(b); });
    p.appendChild(menu);
    p.addEventListener('click', function(ev){
      ev.stopPropagation();
      var willOpen=!menu.classList.contains('open'); closeMenu();
      if(willOpen){ menu.classList.add('open'); openMenu=menu; p.setAttribute('aria-expanded','true'); }
      else p.setAttribute('aria-expanded','false');
    });
  }
  function buildMobile(){
    var m=document.getElementById('multilingual-language-picker-mobile'); if(!m) return;
    m.classList.add('lala-no-translate');
    var c=m.querySelector('.language-picker-content')||m;
    options(function(){ var a=document.createElement('a'); a.href='#'; a.className='lala-lang-opt-mobile'; return a; })
      .forEach(function(a){ c.appendChild(a); });
  }
  function buildStyle(){
    var css=''
      +'.lala-lang-menu{display:none;position:absolute;top:100%;left:0;margin-top:4px;background:none;'
      +'border:0;box-shadow:none;z-index:99999;white-space:nowrap;}'
      +'.lala-lang-menu.open{display:block;}'
      +'.lala-lang-menu .lala-lang-opt{display:block;width:auto;text-align:left;padding:1.6px 0;background:none;'
      +'border:0;font-family:inherit;font-weight:700;font-size:16px;line-height:1.2;color:rgb(249,252,224);cursor:pointer;}'
      +'.lala-lang-menu .lala-lang-opt:hover{opacity:.72;}'
      +'#multilingual-language-picker-desktop{position:relative;cursor:pointer;}'
      +'#multilingual-language-picker-mobile .lala-lang-opt-mobile{display:block;padding:1.6px 0;color:inherit;'
      +'text-decoration:none;font-weight:700;font-size:1em;}';
    var st=document.createElement('style'); st.textContent=css; (document.head||document.body).appendChild(st);
  }
  document.addEventListener('click', closeMenu);
  function init(){
    buildStyle(); buildDesktop(); buildMobile();
    var saved='en'; try{ saved=localStorage.getItem(KEY)||'en'; }catch(e){}
    setLang(saved==='fi' ? 'fi':'en', false);
  }
  if(document.readyState!=='loading') init();
  else document.addEventListener('DOMContentLoaded', init);
})();
