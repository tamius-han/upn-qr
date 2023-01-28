# UPN QR Generator

Generator za slovenske UPN (položnica) QR kode. Ima vaše društvo probleme s pobiranjem donacij, ker ljudje danes s seboj le zgolj poredko nosijo gotovino? Zdaj jih lahko fehtate tudi s QR kodami, brez da bi rabili iz interneta prenašati praviloma plačljive računovodske programe. Ne resno — če bi dobil na internetu izi generator QR kod za slovenske položnice, potem ne bi zdaj brali tega jamranja.

Stvar je na voljo [tukaj](http://tamius.net/upnqr/). 

## Kako uporabljati

1. Izpolni podatke
2. Klikni 'ustvari QR kode'
3. Klikni 'shrani SVG'

Stran ustvari dve kodi: eno za evropske banke (Revolut, N26), ter eno za Slovenske banke. Ja, imamo mi en 'posebna snežinka' sistem za QR kode. Ne, mobilne aplikacije slovenskih bank bolj ali manj ne znajo brati onega vsesplošnega standarda, ki ga uporabljajo bolj ali manj vse Evropske banke.

Tiste QR kode, ki jih rabiš, nato shraniš na računalnik in sprintaš na en (ali več) list(ov) papirja.

## Stvari, ki ne delajo

* Zgleda, da knjižnica za QR kode ne mara šumnikov. 
* Poleg 'posebna snežinka' formata QR kod imamo tudi 'posebna snežinka' format za reference. Slovenskih referenc ne validiram, ampak to verjetno ni kak problem. Ljudje, ki jim RF00 (prost vnos) in RF99 (prazna referenca) nista dovolj, verjetno uporabljajo proper računovodske programe. To ne bo nikoli delalo, ker se mi validacije referenc ne ljubi implementirat. 
* Ene par manjših hroščkov in nezglajenih kotov, ki niso dovolj nadležni da bi upravičevali čas, ki bi bil potreben, da se spucajo.

## HTTP? V letu 2023?

Ker se mi ne da s Cloudflare ukvarjat, pa ker se mi ne da z domenco ukvarjat.

## A ni fora README da poveš, kako to lokalno postaviti?

1. node 16
2. `npm i`
3. `npm run dev` (ampak HMR ne dela, rabiš pognat po vsaki spremembi na roke)
4. `npm run build` in prekopiraš iz `/dist` na "produkcijo"
