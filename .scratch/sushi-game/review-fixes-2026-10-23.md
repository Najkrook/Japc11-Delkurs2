# Granskningsåtgärder 2026-10-23

- **P1, tickets 03–08:** Browserns lokala standardsparning har ersatts av callable `sushi`. Google-identitet hämtas från verifierad autentisering. Servern bestämmer tid, priser och kapacitet och beräknar medaljer från sparade kursframsteg. Firestore-transaktionen läser kursframsteg och restaurang tillsammans. Initiering, intäktshämtning och köp är atomära; upprepade anrop ger inte dubbla utbetalningar eller köp.
- **P2, tickets 04–05:** Visningens tidsbas uppdateras när medaljsynken lämnar ett nytt bokfört tillstånd. En minut ger 10 visade yen, inte 20. Misslyckad hämtning behåller tidigare tillstånd och tidsbas.
- **P2, ticket 03:** Laddning visar ingen lokal ersättningsrestaurang. Laddningsfel har en separat återförsöksknapp som laddar restaurangen på nytt. Sena svar avvisas även om samma konto återkommer efter att vyn stängts.

Verifierat lokalt:

- Alla 265 enhetstester passerar, inklusive regressioner, kursens synkningsbarriär och återförsök efter tidsgräns för offline-skrivningar.
- `npm run test:backend`: riktiga Auth-, Firestore- och Functions-emulatorer; samtidiga första besök, nekade klientvärden och direkta skrivningar, medaljer från kurslagring, idempotenta samtidiga hämtningar/köp, 12h-köp och återöppning i annan session.
- `npm run test:backend:e2e`: Chromium med riktig Firebase-autentisering och klientadapter; injicerat nätverksfel, återförsök och omladdning.
- 18 befintliga Playwright-kontroller för spelvyn och studieövningar i Chromium och mobil WebKit.
- Typkontroll av klient och funktioner samt produktionsbygge. Sushi och Functions-SDK ligger i separata, sent laddade resurser.
- Sammanlagt 11 emulator-/regeltester passerar när backendtestet körs tillsammans med befintliga Firestore-tester. Anrop som hör till ett tidigare konto avvisas även om autentiseringstoken byts medan anropet förbereds.

Ändrade kodfiler följer Prettier. Projektets fullständiga `npm run format:check` fallerar fortfarande på 26 oförändrade filer från tidigare arbete; den kvarvarande formateringen blockerar den fullständiga CI-kedjan.

Inget har publicerats. Produktionsingången är fortsatt spärrad och ticket 12 är öppen. Lokala prototypbelopp används inte som serverdata. Emulatorerna kördes med värddatorns Node 24; CI och deklarerad driftsruntime använder Node 22.
