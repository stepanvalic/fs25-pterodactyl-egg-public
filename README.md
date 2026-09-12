# FS25 Pterodactyl Egg - Stepan Valic

Vlastni MIT fork [nn-home-com/farming-simulator-25-egg](https://github.com/nn-home-com/farming-simulator-25-egg), vychozi revize `3ad302f2a67726567a534c964cc423c76d2d1d88`.
Windows dedicated server bezi pres WineHQ a Xvfb. Repo ani image neobsahuji hru, instalator, hesla nebo licencni klice. Puvodni autorstvi a MIT licence jsou zachovany v LICENSE.

## Import a image

1. Pockej na uspesny workflow **Validate and publish FS25 image** v GitHub Actions.
2. V Pterodactyl administraci importuj `egg-farming-simulator-25.json` do vlastniho nestu.
3. Pouzij image `ghcr.io/stepanvalic/fs25-pterodactyl-egg-public:latest`. Pro stabilni nasazeni lze pouzit tag konkretniho commitu.
4. Pridel primarni herni port (napr. 10823) a dalsi allocation pro web (napr. 7999). Nastav WEB_PORT na webovou allocation. SERVER_PORT dodava Pterodactyl z primarni allocation.
5. Nastav vlastni WEB_PASSWORD, pri prvni instalaci GAME_SERIAL a ostatni pocatecni hodnoty. Herni a herni administratorske heslo maji maximalne 16 znaku.

Verejny GitHub repozitar sam o sobe nezarucuje verejny GHCR image. Po prvnim uspesnem buildu vlastnik nastavi v GitHub Packages viditelnost balicku `fs25-pterodactyl-egg-public` na Public. Teprve pak jej Wings muze stahovat bez tokenu. Workflow viditelnost balicku sam nemeni.

## Instalator bez opakovanych stazeni

Vychozi nastaveni je `AUTO_DOWNLOAD=false`, `DOWNLOAD_DLC=false`, `KEEP_INSTALLER=true`, `INSTALLER_POLICY=current`.

### Ponechat aktualni

Nahraj vlastni oficialni `FarmingSimulator25_*_ESD.img` nebo kompletni `Setup.exe` a odpovidajici `Setup-*.bin` do `installer/`. Existujici instalace se pri restartu znovu neinstaluje. Pri vypnutem AUTO_DOWNLOAD se portal vubec nekontaktuje.

### Jednorazove ziskat nejnovejsi dostupny instalator

Nastav `AUTO_DOWNLOAD=true`, `INSTALLER_POLICY=latest`, `INSTALLER_REFRESH_ID=release-1` a svuj GAME_SERIAL. Pri startu probehne nejvyse jeden POST klice na portal pro tento identifikator. Odpoved zustane v `data/.download-state/`; preruseny prenos z CDN se obnovuje z `.part`, bez dalsiho POSTu klice.

Po dokonceni zustane instalator a SHA256 v `installer/releases/<hash-identifikatoru>/`. Soubor `installer/selected-installer` vybira tuto verzi pro budouci cerstvou instalaci. Starsi soubory se neprepisuji. Dalsi restarty se stejnym ID a vypnutym DOWNLOAD_DLC neprovadeji ani kontrolu CDN.

Pro dalsi vyzadany refresh zmen ID na `release-2`. Nemen ho automaticky pri kazdem startu. Po dokonceni muzes AUTO_DOWNLOAD zase vypnout. Nedojde k automaticke reinstalaci ani upgradu bezici hry. "Nejnovejsi" znamena instalator aktualne nabizeny oficialnim portalem; nemusi obsahovat posledni herni patch.

Pokud selze samotny POST, ochrana dalsi pokus zablokuje. Nahraj instalator rucne; nemaz ochranu jen kvuli opakovanemu zkouseni. Cache je soukroma a muze obsahovat licencovane odkazy, nepatri do Gitu. Je vazana na tento server a licenci; nesdilej ji mezi ruznymi licencemi.

KEEP_INSTALLER=true ponechava instalacni media. U explicitnich refreshu se archivovane releases ponechavaji i pri false, aby se nezrusila zvolena verze; starsi releases lze odstranit rucne po overeni zalohy. Pocatej s prostorem pro IMG, rozbaleny instalator, nainstalovanou hru, mody i zalohy. Kazdy dalsi refresh potrebuje dalsi misto.

## Sprava a restarty

- Web: `http://ADRESA:WEB_PORT`. Pouzivej duveryhodnou sit/VPN nebo HTTPS proxy, nikoli verejne nezabezpecene prihlaseni.
- Mody: `data/mods/`, ulozene hry: `data/savegameN/`.
- Herni konfigurace: `data/dedicated_server/dedicatedServerConfig.xml`.
- Pri restartu zustavaji herni nastaveni, mapa, slot a vybrane mody z GIANTS panelu zachovane. Herni Startup promenne jsou pouze pro prvni vytvoreni konfigurace.
- WEB_USERNAME, WEB_PASSWORD a WEB_PORT se aplikuji pri startu do konfigurace webserveru; uzivatele dodatecne zalozene v GIANTS panelu spravuj tam.
- REGENERATE_CONFIG=true je pouze pro administratora: zazalohuje a prepise herni konfiguraci z promennych, vcetne ztraty vyberu modu. Po pouziti vrat false.
- Pri zmene primarni allocation uprav take herni port v GIANTS panelu; zachovana konfigurace se automaticky neprepise.
- Stav Running v Pterodactyl znamena bezici web manager, ne dokoncenou mapu. Dokonceni hledej jako `Entered Gameplay` v `data/log_*.txt`.
- CPU se prideluje v Pterodactyl limitem serveru (600 % odpovida sestici CPU). Neni to rezervace jader ani nastaveni poctu fyzikalnich vlaken hry.
- Herni UDP port musi byt dostupny z internetu. Samotne SSH `-R` prenasi TCP, nikoli herni UDP. Egg nenastavuje router ani verejnou IP.

## Prenos stavajici instalace

Nejdriv uloz hru a zastav puvodni server. Prenes obsah jeho `/home/container` (vcetne skryte `.fs25prefix` a `data/`) do serveroveho volume Wings a nastav spravne vlastnictvi. Zachovej symlink dokumentu na `/home/container/data`. Nastav AUTO_DOWNLOAD=false a REGENERATE_CONFIG=false. Jde o presun jedne licencovane instance, ne provoz vice serveru na jedne licenci. Presun licence muze vyzadovat oficialni reaktivaci; egg ji neobchazi.

Instalacni media ulozena mimo serverove volume prenes samostatne do `installer/`. Tento repozitar zadny existujici server automaticky nemigruje.

## Vyvoj a overeni

```bash
node --test tests/*.test.mjs
find yolk -name '*.sh' -exec bash -n {} \;
docker build -f yolk/Dockerfile.winehq -t fs25-local yolk
```

CI testuje konfiguraci a ochranu stahovani bez skutecne licence a bez kontaktovani GIANTS. Image se sestavuje z Debianu a WineHQ, ne z hernich souboru. Prvni realna instalace a test importu ve tvem Pterodactyl panelu vyzaduji samostatne overeni.

Viz take [COMPLIANCE.md](COMPLIANCE.md), [ACTIVATION.md](ACTIVATION.md) a [LICENSE](LICENSE).
