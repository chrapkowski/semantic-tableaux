# Tablice semantyczne w rachunku zdań – metoda dokładna, aplikacja

## Opis

Aplikacja umożliwia dla zadanej formuły rachunku zdań zbudować
tablicę semantyczną w postaci drzewa. Pozwala na wizualizację
domkniętych i otwartych gałęzi takiego drzewa.

## Edytor formuł

Formuły wpisuje się w sposób naturalny, tzn. identyfikatory są literami
alfabetu łacińskiego, do grupowania używa się nawiasów okrągłych.
Funktory zdaniotwórcze odpowiadają następującym słowom kluczowym:

- `not` - negacja (¬)
- `imp` - implikacja (⇒)
- `equ` - równoważność (⇔)
- `and` - koniunkcja (∧)
- `or`  - alternatywa (∨)

Parser zachowuje pierwszeństwo funktorów.
