# 05 — Tydlig gästhantering och inloggningsfeedback i Arenamatch & Kontovy

**What to build:** Studenter som använder plattformen som gäster får tydlig information om att gästrum i Kurs-Arena är lokala för den egna webbläsaren och hur de loggar in för att spela mot kurskamrater på andra enheter, samt omedelbar visuell återkoppling vid avbruten inloggning eller saknad japansk talsyntesröst.

**Blocked by:** 01 — Grön baslinje för CI, formatering och E2E-filtertest

**Status:** done

- [x] I Kurs-Arenas lobby och väntrum ser oinloggade gäster en tydlig upplysning om att gästläge endast fungerar lokalt i samma webbläsare, med en direktknapp för att logga in inför spel med kurskamrater
- [x] När en inloggning misslyckas eller avbryts visas återkopplingen i anslutning till kontoknappen/toppmenyn så att användaren ser den utan att skrolla till sidfoten
- [x] När en enhet saknar japansk röst för talsyntes visas ett begripligt meddelande vid försök att spela upp uttal istället för tyst misslyckande
- [x] Test verifierar att gästupplysningen renderas i Kurs-Arena när användaren är utloggad
