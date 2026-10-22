# 05 — Lås upp belöningar permanent från kursmedaljer

**What to build:** Studentens befintliga och nya kursmedaljer öppnar permanenta köpmöjligheter i restaurangen. Studenten kan se vad som låsts upp och hitta till nästa relevanta studiekapitel utan att upplåsning förväxlas med ett genomfört köp.

**Blocked by:** 03 — Skapa och återöppna den personliga restaurangen

**Status:** ready-for-agent

- [ ] Backend härleder upplåsningar från sparade kursframsteg med den befintliga medaljberäkningen, utan avrundade visningsprocent eller extra provkrav. Brons öppnar huvudfunktion, silver recept/variant och guld dekoration.
- [ ] Vid första restauranginitieringen tilldelas alla upplåsningar som stöds av befintliga sparade framsteg. Nya berättigade upplåsningar tillkommer när senare kursframsteg finns sparade; tilldelningen är säker att upprepa.
- [ ] Det etablerade studieflödet samordnar lokal och molnsparad progression före bedömning. Det går att skilja bekräftad molnsynkning från fel eller pågående skrivning; restaurangflödet gör inte ett tyst synkfel till bevis på saknade framsteg.
- [ ] Redan tilldelade upplåsningar bevaras vid senare lägre medalj eller avmarkerad kunskap. Historiska medaljer som inte stöds av bevarade data påstås inte kunna återställas.
- [ ] Kapitel kopplas genom kursdatans lektionsnummer, inklusive kapitel 9 som motsvarar week-4. Ett spelanrops påstådda medalj eller upplåsningsflagga accepteras inte som auktoritet.
- [ ] Gränssnittet visar permanenta upplåsningar, återstående krav och länk till relevant befintlig studieövning. Upplåsning ger varken gratis föremål eller direkt yenbelöning.
- [ ] Den accepterade tilliten till klientrapporterade kursframsteg och befintliga medaljtrösklar bevaras. Tester täcker första besöket, senare framsteg, minskad progression, kapiteltillhörighet, synkfel och återförsök.
