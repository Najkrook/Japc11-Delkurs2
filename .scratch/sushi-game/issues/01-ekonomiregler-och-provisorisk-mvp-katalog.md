# 01 — Bestäm ekonomiregler och provisorisk MVP-katalog

**What to build:** Ett beslutat och verifierbart regelverk för restaurangens intäktsperioder och en liten provisorisk katalog som gör MVP:n möjlig att implementera utan att öppna designfrågor tyst blir slutgiltiga produktbeslut. Detta är en beslutsuppgift före ekonomins implementation.

**Blocked by:** None — can start immediately

**Status:** done

- [x] Produktägaren har godkänt och speldesignen dokumenterar hur en ändrad produktionshastighet påverkar redan intjänade och framtida ohämtade intäkter, inklusive köp när kassan redan nått sitt tak. Den senaste hastigheten tillämpas inte retroaktivt på hela perioden.
- [x] Produktägaren har godkänt när ett köpt högre tidstak börjar gälla och hur redan använd produktionstid och eventuell väntetid över det tidigare taket behandlas. Köpet varken hämtar intäkter automatiskt eller återställer perioden.
- [x] Räkneexempel anger förväntade belopp och använd produktionstid för ett vanligt köp, ett köp vid full kassa, ett höjt tak och efterföljande manuell hämtning. Avrundning av yen och delminuter är definierad.
- [x] Den provisoriska katalogen anger startproduktion, priser, effekter, medaljkrav och eventuella köpnivåer för kapitel 6:s första förbättring, kapitel 9:s transportband, minst en takuppgradering, en silverbelöning och några gulddekorationer.
- [x] Åttatimmarstaket från start, kök/service som enda flaskhalsar och brons/silver/guld-policy bevaras. Nödvändig funktionell progression kräver inte guld. Alla obekräftade balansvärden och föremålsval märks som provisoriska.
- [x] Slutlig bildstil, ytterligare belöningar och kapitel 12:s exakta slutmål hålls uttryckligen öppna där de ännu inte beslutats. Beslut och kvarvarande frågor är åtskilda; uppgiften är klar först när de blockerande ekonomireglerna är avgjorda.

## Beslut och verifiering — 2026-10-22

Produktägaren godkände ändrad produktion från köptillfället, omedelbart högre tak utan retroaktiv ersättning för stopptid och bevarade delar av yen vid hämtning. Planen med provisorisk katalog godkändes därefter för genomförande.

- [Speldesignens avsnitt 5.4–5.5](../../../sushigame.md#54-accrual-and-collection-rules) dokumenterar de beslutade ekonomireglerna, millisekundprecision och exakt intern yenräkning.
- [Avsnitt 5.6–5.7](../../../sushigame.md#56-provisional-mvp-catalog) innehåller den provisoriska katalogen och räkneexempel med disponibelt saldo, ohämtade intäkter och använd produktionstid.
- Räkneexemplen verifierades med fristående Node-assertioner för första köp, köp under pågående/full period, takköp före/vid/efter det gamla taket, efterföljande hämtning, bortkastad stopptid, exakta prisavdrag och bevarade bråkdelar. Samtliga kontroller passerade.
- Dokumentet granskades för konsekvens: kapitel 7:s provisoriska belöning och hänvisningar till tidigare olösta ekonomifrågor uppdaterades. Slutbalans, ytterligare belöningar, bildstil och kapitel 12:s slutmål förblir öppna i avsnitt 14.

Leveransen är dokumentation. Ingen spelkod, backend eller API har införts; emulator- och gränssnittstester hör till senare implementationstickets.
