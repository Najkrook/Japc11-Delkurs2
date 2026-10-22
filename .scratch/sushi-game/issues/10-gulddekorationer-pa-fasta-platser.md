# 10 — Köp och placera gulddekorationer i fasta platser

**What to build:** Studenten kan köpa några upplåsta dekorationer och välja vilka ägda föremål som visas på restaurangens fasta dekorationsplatser. Valen sparas utan att påverka restaurangens ekonomi.

**Blocked by:** 06 — Köp den första förbättringen efter kapitel 6-brons

**Status:** ready-for-agent

- [ ] En liten uppsättning provisoriska dekorationer följer guldpolicyn och det servervaliderade köpflödet. Nödvändig funktionell progression kräver inte dessa guldbelöningar.
- [ ] Val av en fast dekorationsplats öppnar ett tillgängligt val bland föremål som studenten äger och som är tillåtna på platsen. Det går att byta eller ta bort vald dekoration utan att köpa den igen.
- [ ] Backend validerar ägare, ägda föremål och giltig plats. Godtyckliga föremål eller fria koordinater kan inte sparas genom manipulerade anrop.
- [ ] Valda dekorationer visas i scenen och sparas per fast plats. Omladdning återställer valen; fel och sena svar efter kontobyte kan inte skriva över en annan restaurang eller visa ett falskt lyckat val.
- [ ] Köp och placering av dekorationer ger ingen bonus till kapacitet, intäkt, efterfrågan eller kundbeteende. Placering varken hämtar pengar eller återställer intäktsperioden.
- [ ] Mus, touch och tangentbord kan genomföra hela valflödet med synligt fokus och begripliga etiketter. Tester täcker ägandekrav, ogiltig plats, sparning, byte/borttagning och oförändrad produktion.
