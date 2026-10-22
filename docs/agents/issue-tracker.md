# Lokal issue-tracker

Användaren bekräftade 2026-10-22 att arbetet ska följas i en lokal tracker. Projektets befintliga lokala tickets behålls.

Skriv en Markdown-fil per ticket under `.scratch/<feature-slug>/issues/<NN>-<slug>.md`, med tvåsiffrigt nummer i beroendeordning. Varje fil innehåller titel, `What to build`, `Blocked by`, `Status` och verifierbara acceptanskriterier som kryssrutor. Ange blockerarnas nummer och titlar, eller `None — can start immediately`.

Nya godkända tickets får status `ready-for-agent`. Bara tickets vars blockerare är klara får påbörjas; statusen upphäver inte beroenden eller uttryckligt öppna produktbeslut. Färdiga och verifierade tickets markeras `done` enligt projektets befintliga praxis.

Sushi Game följs i [sin lokala översikt](../../.scratch/sushi-game/README.md). Ticketfilerna är sanningskällan för respektive uppgifts status. Skapa inga externa tracker-issues om användaren inte begär det.
