# Movie Marathon Optimizer

Calculates the maximum number of movies you can see in a single day.

## Algorithm

Greedy interval scheduling: sort by end time, pick greedily with travel buffer.

```
1. Take all movies from filtered venues for the day
2. Sort by end time (start + runtime)
3. Pick first movie
4. For each remaining movie:
   - Same venue as last: can start when last ends
   - Different venue: need 20 min buffer after last ends
   - If movie starts after threshold, pick it
5. Return picked movies + stats
```

## UI

**Trigger:** Button in header ("MAX MODE" or similar)

**Modal contents:**
- Header: "MAXIMUM MOVIE DAY"
- Stats: film count, screen time, total commitment, venue changes
- Schedule list with time slots, titles, venue badges
- Travel notes between venue changes
- Close button

Inherits current theme styling.

## Implementation

**New file:** `src/utils/movie-marathon.ts`
- `calculateMarathon(events, travelBuffer)` → `{ schedule, stats }`
- Pure function, easy to test

**UI in `index.tsx`:**
- `showMarathonModal` state
- Header button
- `<MarathonModal>` component
- Uses `filteredData` (respects venue filters)

**Constants:**
- Travel buffer: 20 minutes

**Edge cases:**
- No movies → "No movies today"
- Single movie → shows it
- All overlap → picks earliest-ending
