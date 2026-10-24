# Restaurangens bildstil — beslut och bildkällor

Produktägaren valde 2026-10-24: **Illustrerad 2D framifrån, som ett tvärsnitt av restaurangen**.

## Utförande

En lugn sushibar med trä, gräddvit puts, dämpad turkos och korallfärgade detaljer. Illustrationerna har gemensamma konturer och en fast koordinatyta. Gränssnittet använder systemets sans-serif för läsbar text och Georgia för bildens korta rubrik. Bilden ligger ovanför kassan; text och interaktiva kontroller ligger utanför bilden.

## Ursprung och användning

Alla vektorformer i `src/course/sushi-game/restaurant-scene.ts` skapades direkt av Codex för detta projekt. Inga externa bilder, bildbibliotek, logotyper, typsnittsfiler eller tredjepartstillgångar används. Projektet kan redigera och distribuera dessa originaltillgångar med sin kod; inga externa bildlicenser eller tillskrivningskrav tillkommer. Detta påstår inte exklusiv upphovsrätt till AI-genererat material.

Bildlager:

- Bas: restaurangens väggar, trästomme, fönster, gardin, grundkök, serveringsdisk och pallar.
- Beredningsbänk: extra arbetsyta, skärbräda, kniv och förvaring när prep_counter ägs.
- Transportband: band och tallrikar när conveyor_belt ägs; en dekorativ CSS-rörelse på bandets yta.
- Laxnigiri: extra uppläggning när salmon_nigiri ägs.
- Väggplats: antingen papperslykta eller vågmotiv, enbart om föremålet ägs och är valt.
- Golvplats: krukväxt, enbart om den ägs och är vald.

SVG:n är inline i den separat laddade sushi-modulen. Inga bildanrop görs från studieappen. Rörelse stängs av med prefers-reduced-motion och pausas när dokumentet döljs. När spelvyn lämnas tas scenen bort. Bilden har en svensk textbeskrivning för hjälpmedel och påverkar ingen ekonomisk beräkning.
