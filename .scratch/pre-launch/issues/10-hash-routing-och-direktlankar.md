# 10 — Hash-routing för bakåtknapp och delbara direktlänkar

**What to build:** Navigering mellan kursveckor, studievyn (Översikt, Glosor, Kanji, Grammatik, Dojo, Veckotest, Kurs-Arena, Extra studier) och arenarum speglas i sidans URL-hash så att webbläsarens bakåt-/framåtknappar fungerar och studenter kan dela direktlänkar med varandra.

**Blocked by:** 01 — Grön baslinje för CI, formatering och E2E-filtertest

**Status:** done

- [x] Byte av kursvecka och studievy uppdaterar webbläsarens URL-hash, och sidladdning med en befintlig hash öppnar motsvarande vecka och vy direkt
- [x] Webbläsarens bakåt- och framåtknappar navigerar mellan tidigare besökta vyer i applikationen istället för att lämna webbplatsen
- [x] En direktlänk till ett arenarum (t.ex. med rumskod i URL-hashen) förifyller eller öppnar rummet i Kurs-Arena
- [x] E2E- eller enhetstest verifierar synkronisering mellan URL-hash och aktiv vy samt bakåtnavigering
