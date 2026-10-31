# 02 — Öppna en separat spelvy med Google-inloggning

**What to build:** Studenten kan öppna restaurangens egen sida och gå tillbaka till studierna med bibehållen identitet och kurskontext. En utloggad besökare får ett begripligt inloggningsflöde utan tillgång till en spelbar restaurang.

**Blocked by:** None — can start immediately

**Status:** done

- [x] Restaurangen har en egen hash-route och ett eget gränssnitt utan studiernas sidomeny eller studiemenyer, med en tydlig väg tillbaka till studierna och en ingång från studieappen.
- [x] Befintlig Google-inloggning återanvänds. Utloggade och eventuella anonyma sessioner får varken spelbar restaurang, personliga restaurangdata eller gästdemo, även vid direktlänk och omladdning.
- [x] Direktlänk, bakåt/framåt, inloggning, utloggning och kontobyte fungerar utan att föregående användares innehåll blir kvar eller kurskontexten förloras.
- [x] Spelkod, spelstilar och bildresurser laddas först när spelvyn öppnas. Befintlig TypeScript/lit-html/CSS används utan ny spelmotor eller renderingsbibliotek.
- [x] Laddnings- och inloggningsfel visar återförsök och tillåter återgång till studierna. Personlig restaurang och ekonomi ansluts i efterföljande tickets; ingen produktionsmock skapas här.
- [x] Webbläsartester verifierar navigering, åtkomstspärr, isolerad laddning och att befintliga studievyer fortfarande fungerar. Produktionsingången hålls otillgänglig tills backend och åtkomstregler är publicerade enligt releaseuppgiften.
