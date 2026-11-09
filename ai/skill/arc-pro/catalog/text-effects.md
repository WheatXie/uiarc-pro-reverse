# Text effects

## `in-view-title` · In-view title (Free, component)

Bring a section title in as it scrolls into view.

When to use:
- Section headings that should animate once they scroll into view.
- Feature pages where each section title needs a consistent entrance style.

When not to use:
- Use text-reveal for hero copy that animates on load.
- Use scroll-highlight for a paragraph that follows scroll progress.

Keywords: text, motion, heading, react scroll animation title, animate on scroll heading, in view text animation, section title reveal, scroll reveal text, framer motion heading

Files: src/components/arc/in-view-title/in-view-title.module.css, src/components/arc/in-view-title/in-view-title.tsx

## `text-morph` · Text morph (Free, component)

Morph a label into its next state, letter by letter.

When to use:
- Status words that change a few letters at a time, such as Follow and Following.
- Custom buttons or badges that need a morphing label without the rest of the button.

When not to use:
- Use word-rotate for a sentence with one cycling word.
- Use button or action-swap when you want the morph plus button behaviour.

Keywords: text, motion, status, react text morph, morphing text, animated label, text transition, letter morph animation, shared letter animation

Files: src/components/arc/text-morph/text-morph.module.css, src/components/arc/text-morph/text-morph.tsx

## `text-reveal` · Text reveal (Free, component)

Reveal a short piece of content with restrained motion.

When to use:
- Above-the-fold hero headlines that animate on page load.
- Landing page intros where text must appear on first paint even if scripts are slow.

When not to use:
- Use in-view-title for section titles further down the page.
- Use scroll-highlight for a key paragraph that reveals with scroll.

Keywords: text, motion, content, react text reveal, headline animation, hero text animation, word by word reveal, blur text reveal, css text animation

Files: src/components/arc/text-reveal/text-reveal.module.css, src/components/arc/text-reveal/text-reveal.tsx

## `text-shimmer` · Text shimmer (Free, component)

Show ongoing work with a calm light across the words.

When to use:
- AI thinking or loading labels such as Generating summary.
- Short status lines that should show ongoing work and settle when done.

When not to use:
- Use text-stream for the response text itself.
- Use skeleton for content placeholders and progress for measurable progress.

Keywords: text, motion, loading, react text shimmer, shimmer text, ai thinking text, loading text animation, shiny text, gradient text sweep

Files: src/components/arc/text-shimmer/text-shimmer.module.css, src/components/arc/text-shimmer/text-shimmer.tsx
