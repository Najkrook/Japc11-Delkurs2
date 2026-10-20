# 02 — Dölj facitläckor och rätta lathund i て-form Dojo

**What to build:** Studieövningen i て-form Dojo låter studenten svara utan att det rätta svaret avslöjas på förhand i vare sig textfältets hjälptext eller verbkortets faktaruta, och grammatiklathunden visar genomgående korrekt hiragana.

**Blocked by:** 01 — Grön baslinje för CI, formatering och E2E-filtertest

**Status:** ready-for-agent

- [ ] I skrivläget i Dojon visar inmatningsfältets hjälptext (placeholder) ett statiskt eller neutralt exempel istället för det aktuella verbets rätta böjningsform
- [ ] På verbkortet i Dojon är den böjningsform som för närvarande testas (inklusive ない-form i vecka 3 och た-form i vecka 4) dold tills studenten har skickat in sitt svar och kortet har avslöjats
- [ ] Lathunden för böjningsregler visar korrekt hiragana för ぐ-verb (`ぐ → いで` utan latinska tecken)
- [ ] Automatiserat test verifierar att det förväntade svaret inte förekommer i inmatningsfältets placeholder eller synlig kortmetadata före avslöjande
