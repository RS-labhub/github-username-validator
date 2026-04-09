![banner](https://raw.githubusercontent.com/RS-labhub/github-username-validator/master/public/og-image.png)

# GitHub Username Validator

Validate, detect duplicates, and identify invalid GitHub accounts in bulk. Built with Next.js 15, Tailwind CSS, and the GitHub API.

## Features

### File Support
- **CSV** — auto delimiter detection and column selection
- **Excel** — `.xlsx` / `.xls` with header detection
- **Word** — basic `.docx` processing
- **Text** — one username per line
- **Manual input** — paste directly into the UI

### Username Extraction
- Handles GitHub URLs (`https://github.com/username`), `@username`, `username#fragment`, and mixed formats in a single file
- Auto-detects the GitHub username column in structured files

### Validation Engine
- **GraphQL batch** (with PAT): 200 users per request, real progress tracking
- **REST parallel** (no token): 50 users per batch with concurrency control
- Up to **5,000 usernames** per session
- Pause / Resume / Cancel with real-time ETA
- Automatic retry with exponential backoff on rate limits

### Authentication
- **With PAT**: 5,000 req/hr, GraphQL batch processing
- **Without PAT**: 60 req/hr, REST sequential
- Token stays in browser memory only — never stored or sent to any server

### Repository Engagement Analysis
- **Stars check**: GraphQL per-user batch (8 users/query) or REST repo stargazer scan with early termination
- **Fork check**: GraphQL batch queries `{user}/{repo}` (15 users/query) or REST per-user — always O(users) calls
- **Check modes**: Stars only, Forks only, or Both
- Retry with backoff on 502/503 errors

### Filtering & Search
- **Status**: All, Valid, Fake (invalid + deleted + duplicate), Invalid, Deleted, Duplicate, Pending, Error
- **Engagement**: Starred, Forked, Any Engagement, No Engagement
- **Account age**: 2+ months, 3+ months, 6+ months, 1+ year
- Full-text search across usernames, profile names, and original values
- Multi-column sorting

### Export
- CSV export with selectable columns
- Exports respect all active filters
- Includes engagement data, account age, and profile info

### Statistics
- Total, Valid, Invalid, Deleted, Duplicates, Fake, Pending, Errors
- Repository Starred / Forked counts (when repo URL is provided)

## Privacy

- All processing happens client-side
- GitHub PAT tokens stay in browser session memory
- No analytics, no tracking, no data storage

## Meet the Author
<img  src="public/Author.jpg" alt="Author">

### Contact 
- Email: rs4101976@gmail.com
- Head over to my github handle from [here](https://github.com/RS-labhub)

&nbsp;

<p align="center">
    <a href="https://twitter.com/rrs00179" target="_blank">
    <img src="https://img.shields.io/badge/X-000000?style=for-the-badge&logo=x&logoColor=white" />
    </a>
    <a href="https://www.linkedin.com/in/rohan-sharma-9386rs/" target="_blank">
        <img src="https://img.shields.io/badge/LinkedIn-0077B5?style=for-the-badge&logo=linkedin&logoColor=white" />
    </a>
    <a href="https://www.instagram.com/r_rohan__._/" target="_blank">
        <img src="https://img.shields.io/badge/Instagram-E4405F?style=for-the-badge&logo=instagram&logoColor=white" />
    </a>
</p>

Thank you for visting this Repo
If you like it, [star](https://github.com/RS-labhub/github-username-validator) ⭐ it