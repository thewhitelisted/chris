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

- **Blog posts**: one file per post in `posts/<slug>.md`. The file name is the URL slug (lowercase words joined by hyphens; `index` is reserved). Each file starts with frontmatter holding exactly these fields:

  ```markdown
  ---
  title: my post title
  date: 2026-04-25
  description: one sentence shown in the RSS feed and link previews
  ---

  # The post body
  ```

  Quote a value that contains `: `, ` #` or looks like a number, e.g. `title: "finance: year one"`. YAML comments are rejected because they would silently cut a value short. While `npm run dev` runs, adding, editing or deleting a post takes effect on the next request; a broken post shows its error in the terminal and the browser overlay.
- **Projects**: public repos of `thewhitelisted` that carry the GitHub topic `portfolio` are fetched from the GitHub API and listed first. Each tagged repo needs a description, and its homepage must be empty or an https URL. The repo's language and other topics become its tags, and its creation month its date. Projects that are not public repos live in `src/projectsData.js`; their links must be https URLs or files that exist in `public/`.
- If no repo carries the `portfolio` topic, the build fails rather than ship a projects page without them. Set `ALLOW_NO_GITHUB_PROJECTS=1` to build anyway (CI does this for pull requests only).
- Both `npm run dev` and `npm run build` call the GitHub API, so they need network access to api.github.com. There is no offline mode: `ALLOW_NO_GITHUB_PROJECTS=1` only permits zero tagged repos, it does not skip the request. The API is called without a token locally (60 requests an hour) and with the workflow's `GITHUB_TOKEN` in CI.
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
