// Blog posts metadata and content loader
export const blogPosts = [
  {
    title: "creating my new website",
    date: "17 June, 2025",
    description: "how i built my new personal website.",
    slug: "new-website"
  }
]

// Function to load markdown content
export const loadMarkdownContent = async (slug) => {
  try {
    // Use dynamic imports to load markdown as raw text
    const markdownModule = await import(`../public/posts/${slug}.md?raw`)
    return markdownModule.default
  } catch (error) {
    console.error(`Failed to load markdown for ${slug}:`, error)
    throw error
  }
}
