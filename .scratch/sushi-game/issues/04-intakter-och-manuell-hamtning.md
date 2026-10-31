# 04 — Tjäna och hämta intäkter med åttatimmarstak

**What to build:** Studenten ser restaurangens ohämtade intäkter och hämtar dem uttryckligen till disponibla yen. Samma restaurang tjänar lika mycket när sidan är öppen som när den är stängd, upp till periodens produktionstidstak.

**Blocked by:** 03 — Skapa och återöppna den personliga restaurangen

**Status:** done

- [x] Serverstyrd förfluten tid och validerad restaurangkonfiguration bestämmer intäkten: minsta köks-/servicekapacitet multiplicerad med genomsnittlig intäkt per beställning. Manipulerad klienttid eller klientrapporterad hastighet påverkar inte det sparade beloppet.
- [x] Gränssnittet skiljer disponibla yen från ohämtade intäkter och visar ungefärlig intäkt per minut, aktuell flaskhals, tidstakets förbrukning och tydligt fullt/stoppat läge.
- [x] Startperioden ger högst åtta produktionstimmar. Återbesök, omladdning, inloggning och interna bokföringsuppdateringar varken hämtar intäkter eller återställer förbrukad produktionstid.
- [x] Endast en uttrycklig hämtning flyttar den upplupna summan till disponibelt saldo, tömmer kassan och startar en ny period. Väntetid över föregående tak ger ingen extra utbetalning i nästa period.
- [x] Hämtning är atomär och säker vid återförsök: samma operation, dubbelklick och samtidiga flikar kan inte betala ut samma intäkter flera gånger. Ett förlorat svar kan återhämtas utan att hämtningen utförs på nytt.
- [x] Klienten kan uppskatta intäkter mellan serversvar men sparar inte till databasen varje sekund. Ingen permanent simuleringsloop körs på servern. Fel visas utan att falskt rapportera lyckad hämtning.
- [x] Logik-, emulator- och webbläsartester täcker lika online/offline-intjäning, takgränsen, lång frånvaro, avrundning enligt 01, upprepade anrop och samtidig hämtning.
