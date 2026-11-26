# Personal Portfolio Website

A clean, minimalist personal portfolio website built with React and Vite, featuring smooth animations and responsive design.

## Features

- **Modern React Components**: Built with functional components and hooks
- **Smooth Animations**: Fade-slide animations using Framer Motion
- **Responsive Design**: Optimized for all screen sizes
- **Interactive Elements**: Hover effects on navigation links
- **GitHub Pages Ready**: Configured for easy deployment
- **Clean UI**: Minimalist design with professional typography

## Tech Stack

- **React 19** - Modern UI library
- **Vite** - Fast build tool and dev server
- **Framer Motion** - Smooth animations and transitions
- **Lucide React** - Beautiful, customizable icons
- **CSS3** - Custom styling with modern features

## Getting Started

### Prerequisites

- Node.js (version 16 or higher)
- npm or yarn

### Installation

1. Clone the repository
2. Install dependencies:
   ```bash
   npm install
   ```

3. Start the development server:
   ```bash
   npm run dev
   ```

4. Open [http://localhost:5173](http://localhost:5173) in your browser

## Available Scripts

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run preview` - Preview production build
- `npm run lint` - Lint with ESLint
- `npm test` - Run the Vitest suite

## Content

Content is assembled at build time by `build/content-plugin.js`. Any problem below stops the build with a message naming the file or repo.

- **Blog posts**: one file per post in `posts/<slug>.md` at the repository root (outside `code/`, so the dev server can never serve a post file with its frontmatter). The file name is the URL slug (lowercase words joined by hyphens; `index` is reserved). Each file starts with frontmatter holding exactly these fields:

  ```markdown
  ---
  title: my post title
  date: 2026-04-25
  description: one sentence shown in the RSS feed and link previews
  ---

  # The post body
  ```

  Quote a value that contains `: `, ` #` or looks like a number, e.g. `title: "finance: year one"`. YAML comments are rejected because they would silently cut a value short. While `npm run dev` runs, adding, editing or deleting a post reloads the page; a broken post (or a folder inside `posts/`) shows its error in the terminal and the browser overlay until it is fixed.
- **Devlogs**: dated takes on a project, kept in this repository (never in the project's own repo) as `devlogs/<project-slug>/<YYYY-MM-DD>.md` at the repository root, beside `posts/`. The folder name must be the slug of a project on the projects page (a GitHub repo's slug is its name in lowercase; hand-kept projects use their `slug`), in any status. The file name date must equal the frontmatter `date`, and the frontmatter is exactly `title`, `date` and `description` with the same rules as posts. Anything else in `devlogs/` (a stray file, a folder inside a project folder, a folder that is not a project slug) fails the build; dotfiles are ignored, and a missing `devlogs/` folder just means no entries. The one exception: when `PORTFOLIO_REPOS_TOKEN` is unset or empty (pull-request CI, local builds without it), private repos are not listed, so a folder whose name matches no listed project is skipped with a build warning naming it instead of failing; its entries are left out of the site, the feed and the static pages. Its files are still checked like any other, so a broken entry in a skipped folder still fails the build. With the token set, an unknown folder fails as above. Each entry's body is published at `/devlogs/<project>/<date>.md`, the entry appears in `rss.xml` as "<project title> devlog: <title>" linking to `/projects/<project>/<date>`, and the build writes static pages for `/projects/<project>` (projects with at least one entry), `/projects/<project>/<date>` and `/now`. `npm run dev` reloads on any change under `devlogs/`, including creating or deleting the folder, and shows errors like posts do.
- **Projects**: repos of `thewhitelisted` that carry the GitHub topic `portfolio` are fetched from the GitHub API. Each tagged repo needs a description, and its homepage must be empty or an https URL. The repo's language and other topics become its tags, its creation month its date, and its last push its "last updated" date. Projects that are not repos live in `src/projectsData.js`; their links must be https URLs or files that exist in `public/`.
- **Status**: a tagged repo that also carries the topic `in-progress` shows as In progress; an archived repo shows as Archived; any other is Complete. An archived repo tagged `in-progress` fails the build. Hand-kept projects take an optional `status` of `in-progress`, `complete` (the default) or `archived`. They may also set `updated` (`YYYY-MM` or `YYYY-MM-DD`), shown as "Last updated" on an in-progress project's note. The page lists in-progress projects first.
- **Stats**: for each in-progress GitHub project the build also calls `/repos/thewhitelisted/<repo>/languages` and `/repos/thewhitelisted/<repo>/stats/commit_activity`, with the same token as the repo listing, and gives the project `stats`: its languages as percentages of bytes (largest first, rounded to 0.1, zero-byte languages dropped) and its commit activity, being 52 weekly commit counts (oldest first, the last one the week, Sunday to Saturday UTC, containing the build, or GitHub's newest week if GitHub has already started it; weeks GitHub has not counted, because its cached stats predate them, are 0) and `last30Days`, the commits on the build's UTC date and the 29 days before it. Counts are GitHub's: default branch only, no merge commits, and days bucketed by GitHub (its week starts can sit an hour off UTC midnight; each is taken as the nearest UTC Sunday). GitHub answers 202 while it computes the statistics; the build asks up to 5 times, waiting 1, 2, 4 and 8 seconds, then builds with `activity: null` and a warning, as it also does on a 204 (no activity). Any other error from either endpoint fails the build. Complete, archived and hand-kept projects get `stats: null`. Private repos get the same counts and percentages; no commit messages or other repo content are fetched.
- **Private repos**: when `PORTFOLIO_REPOS_TOKEN` is set, the build lists repos through `/user/repos` with that token instead of the public listing, so private repos tagged `portfolio` appear too. They are marked private and get no code link; only their name, description, language, topics, created and last-push dates and homepage reach the site (plus, when tagged `in-progress`, the language percentages and commit counts above), so check the description and topics before tagging. An untagged private repo never appears. The token must belong to `thewhitelisted` (the build fails if it lists anyone else's repos) and needs only read access to repository metadata. A rejected token fails the build; an unset or empty one falls back to public repos only, so removing the secret quietly drops the private projects. CI passes the secret on pushes, nightly and manual runs, never on pull requests.
- If no repo carries the `portfolio` topic, the build fails rather than ship a projects page without them. Set `ALLOW_NO_GITHUB_PROJECTS=1` to build anyway (CI does this for pull requests only).
- Both `npm run dev` and `npm run build` call the GitHub API, so they need network access to api.github.com. There is no offline mode: `ALLOW_NO_GITHUB_PROJECTS=1` only permits zero tagged repos, it does not skip the request. The API is called without a token locally (60 requests an hour) unless `PORTFOLIO_REPOS_TOKEN` is set, and in CI with `PORTFOLIO_REPOS_TOKEN` when the secret exists, otherwise the workflow's `GITHUB_TOKEN`.
- The build also writes `rss.xml` and a static HTML page per route (`about.html` and `about/index.html`, `blog/<slug>.html` and `blog/<slug>/index.html`, ...) carrying that page's title, description, Open Graph and Twitter tags, so link previews work without JavaScript.

## Deployment

`.github/workflows/deploy.yml` runs lint, tests and build on every pull request and push, and nightly at 07:23 UTC so the projects list follows GitHub. On a push to `master`, the nightly run, or a manual run on `master`, it then uploads `code/dist` and deploys it to GitHub Pages. The repository's Pages source must be set to "GitHub Actions". Build output is not committed; `code/dist` is gitignored.

The custom domain is configured in the repository's Pages settings; `public/CNAME` ships the same domain in the build.

## Customization

To customize the portfolio for your own use:

1. Update the name and content in `src/App.jsx`
2. Modify social media links and company information
3. Customize colors and styling in `src/App.css`
4. Replace placeholder links with your actual social media profiles

## License

This project is open source and available under the [MIT License](LICENSE).
