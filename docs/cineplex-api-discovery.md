# Reverse Engineering the Cineplex Showtimes API

**Date:** January 2026
**Author:** Claude (with human guidance)
**Status:** Working API discovered

## The Problem

We wanted to add Cineplex theatre showtimes (Fifth Avenue Cinemas, International Village) to Van Kino Calendar. Unlike the indie venues we already scrape (VIFF, Rio, Cinematheque), Cineplex is a major chain with a modern React/Next.js website that loads data dynamically.

## What Didn't Work

### 1. The Old REST API (Dead)

Multiple GitHub projects from 2018-2022 referenced a `www.cineplex.com/api/v1/` endpoint:

```
https://www.cineplex.com/api/v1/theatres
https://www.cineplex.com/api/v1/movies
```

These all return **404 Not Found** now. Cineplex rebuilt their site and killed the old API.

### 2. Direct Page Scraping

The Cineplex website is a Next.js app. When you load a theatre page like `/theatre/fifth-avenue-cinemas-age-restricted-19`, the `__NEXT_DATA__` JSON contains movie posters and theatre info, but **not showtimes**. Showtimes load dynamically via JavaScript when you click "Get Tickets".

### 3. Guessing API Endpoints

We tried many variations:
- `/api/showtimes`
- `/bff/showtimes`
- `/_next/data/.../showtimes.json`
- `/Showtimes/movie-slug/theatre-slug`

All returned 404.

## The Breakthrough: JavaScript Analysis

The key insight was that **the API keys and endpoints must be embedded in the client-side JavaScript** since the browser needs them to make requests.

### Step 1: Find the JS Bundles

From the page HTML, we found Next.js chunk files:
```
/_next/static/chunks/pages/_app-7f9419a7b924c1de.js
/_next/static/chunks/9786-25e06b4d8b618810.js
```

### Step 2: Search for API Patterns

We searched the JS for patterns like `apis.cineplex.com` and `Ocp-Apim-Subscription-Key`:

```bash
curl -s "https://www.cineplex.com/_next/static/chunks/9786-*.js" | \
  grep -o '.\{0,80\}theatrical.\{0,80\}'
```

### Step 3: The Discovery

In chunk 9786, we found the entire API client configuration:

```javascript
let i="https://apis.cineplex.com/prod/cpx/theatrical/api",
r={
  credentials:"include",
  headers:{
    "Ocp-Apim-Subscription-Key":"dcdac5601d864addbc2675a2e96cb1f8"
  }
}

// Endpoints:
// /v1/theatres
// /v1/movies/bookable
// /v1/dates/bookable
// /v1/showtimes        <-- The one we need!
// /v2/filters
```

## The Working API

### Base URL
```
https://apis.cineplex.com/prod/cpx/theatrical/api
```

### Authentication
Azure API Management subscription key in header:
```
Ocp-Apim-Subscription-Key: dcdac5601d864addbc2675a2e96cb1f8
```

No cookies or login required - this key is embedded in public JavaScript.

### Key Endpoints

#### Get Theatres
```
GET /v1/theatres?language=en-us
```
Returns all theatres with IDs, names, addresses, coordinates.

#### Get Bookable Movies
```
GET /v1/movies/bookable?language=en-us
```
Returns movies currently showing with poster URLs, runtime, genres.

#### Get Showtimes (The Important One)
```
GET /v1/showtimes?language=en-us&LocationId=1149
```
Parameters:
- `LocationId` - Theatre ID (required, or use FilmId)
- `FilmId` - Movie ID (optional)
- `date` - YYYY-MM-DD (optional)

Returns:
```json
{
  "theatre": "Fifth Avenue Cinemas (age restricted 19+)",
  "theatreId": 1149,
  "dates": [{
    "startDate": "2026-01-12T00:00:00",
    "movies": [{
      "id": 27408,
      "name": "Avatar: Fire and Ash",
      "filmUrl": "avatar-fire-and-ash",
      "runtimeInMinutes": 197,
      "genres": ["Action", "Adventure", "Science Fiction"],
      "localRating": "PG",
      "experiences": [{
        "experienceTypes": ["3D"],
        "sessions": [{
          "showStartDateTime": "2026-01-12T18:30:00",
          "seatsRemaining": 96,
          "isSoldOut": false,
          "auditorium": "Aud #5"
        }]
      }]
    }]
  }]
}
```

#### Get Bookable Dates
```
GET /v1/dates/bookable?language=en-us&LocationId=1149
```
Returns array of dates with available showtimes.

## Vancouver Theatre IDs

| Theatre | ID |
|---------|-----|
| Fifth Avenue Cinemas (19+) | 1149 |
| International Village | 1147 |
| Scotiabank Theatre Vancouver | 1422 |

## Implementation Notes

1. **No Puppeteer needed** - Direct HTTP requests work fine
2. **No cookies needed** - The API key alone is sufficient
3. **Rate limiting unknown** - Be respectful, consider caching
4. **API key is "public"** - It's in client-side JS, but could change with site updates
5. **Build ID changes** - The JS chunk filenames change on deploys, but the API itself is stable

## Lessons Learned

1. **Modern SPAs hide APIs behind JS** - The data isn't in the HTML, it's fetched client-side
2. **Azure API Management keys are often in headers** - Look for `Ocp-Apim-Subscription-Key`
3. **Search JS bundles for API patterns** - `grep` for domain names, "api", "fetch", "subscription"
4. **Error messages are helpful** - The 400 errors told us exactly which parameters were required
5. **Don't give up on 404s** - The old API was dead, but a new one existed at a different path

## Files Created During Investigation

```
scripts/cineplex-test.ts          # Initial endpoint probing
scripts/explore-cineplex.ts       # Puppeteer exploration
scripts/analyze-cineplex-js.ts    # JS bundle analysis
scripts/probe-new-endpoints.ts    # Testing discovered endpoints
scripts/test-theatrical-api.ts    # Final working API tests
scripts/get-cineplex-showtimes.ts # Complete showtime fetcher
```

## Future Considerations

- The API key could rotate - monitor for 401 errors
- Cineplex could add additional authentication - would need to revisit
- Consider caching responses to reduce API calls
- The theatrical API also has user-specific features (favorites) that require login
