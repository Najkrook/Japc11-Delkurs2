# 03 — Skapa och återöppna den personliga restaurangen

**What to build:** En inloggad student får omedelbart en enkel personlig restaurang med grundproduktion och kan återvända till samma sparade restaurang. Medalj krävs först för förbättringar, inte för att öppna restaurangen.

**Blocked by:** 01 — Bestäm ekonomiregler och provisorisk MVP-katalog; 02 — Öppna en separat spelvy med Google-inloggning

**Status:** done

- [x] Ett autentiserat backendflöde skapar restaurangen en gång även vid samtidiga första besök och återförsök. Identiteten kommer från autentiseringen, inte från ett godtyckligt användar-ID i anropet.
- [x] En enkel scen med bildlager visar grundrestaurangen. Servern fastställer dess köks- och servicekapacitet, grundintäkt, åttatimmarstak och första intäktsperiodens start vid skapandet, utan krav på kapitel 6-brons.
- [x] Restaurangen lagras separat från kursframstegen med schemaversion, åtskilt disponibelt saldo och ohämtade intäkter, köp/ägande, fasta dekorationsval, permanenta upplåsningar och bokföring som stödjer beslutet i 01.
- [x] Den tillagda betrodda backenden och åtkomstreglerna kan köras och verifieras lokalt i emulatorer. Endast ägaren har åtkomst genom det tillåtna flödet; klienten kan inte skriva saldo, upplåsningar eller slutförda köp direkt.
- [x] Omladdning, inloggning och återbesök öppnar samma restaurang utan att nollställa intäktsperioden. Två användares restauranger hålls separata, och sena svar efter kontobyte kan inte visas för fel användare.
- [x] Nätverksfel, nekad åtkomst och saknad restaurang skiljs åt. Ett fel visas med återförsök och ersätter inte en giltig restaurang med tom eller lokal speldata. Befintlig kurslagring lämnas funktionellt oförändrad.
- [x] Emulator- och flödestester verifierar samtidig initiering, sparning/återöppning, ägarisolering, nekade direkta klientskrivningar och återhämtning efter fel. Intäkterna kan hämtas först genom 04.
