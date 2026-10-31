const NotebookToolsPromptLibrary = {
  slideDecks: [
    {
      id: "smart-editorial",
      title: "Smart editorial deck",
      badge: "Business media",
      category: "business",
      preview: "editorial",
      description: "Asymmetrical cover, yellow accents, magazine-style headlines.",
      prompt:
        "Build a slide deck from my notebook sources in a sharp digital business magazine style. Slide text must be plain text only with no markdown symbols. Cover slide: asymmetrical Swiss-style layout, a 2-5 word headline as the visual anchor, and a short subtitle that states the reader's problem. Colors: white or cool gray background, near-black text, electric yellow or red accents. Headlines should fill 30-50% of each slide with a 10:1 size jump over body copy. One message per slide. Use cutout-style photos and yellow marker highlights on key numbers. Ground every point in my sources."
    },
    {
      id: "architectural-minimal",
      title: "Architectural portfolio",
      badge: "Minimal",
      category: "business",
      preview: "minimal",
      description: "Grid-based whitespace, section labels, oversized numbers.",
      prompt:
        "Turn my sources into a refined minimal presentation. Tone: professional, grid-based, whitespace-heavy. Palette: light gray or white base, black typography, optional full-black slides for emphasis. Add a small section label on every slide (example: 01. INTRODUCTION). Favor asymmetrical splits, oversized numbers beside narrative text, thin divider lines, and vertical timelines. Sans-serif headings, airy body text. No clutter. Content must come only from my uploaded sources."
    },
    {
      id: "yellow-black",
      title: "Yellow and black feature",
      badge: "Editorial",
      category: "business",
      preview: "yellow-black",
      description: "Bold fashion-editorial contrast with dynamic serif type.",
      prompt:
        "Create slides from my notebook in a bold fashion-editorial style. Background: saturated yellow. Text: black in a large modern serif. Layout like a magazine spread with dynamic type placement. Use striking portrait photography and small handwritten-style accents or sticker-like details. High contrast, confident, visual-first. Plain text on slides, no markdown. Source-grounded content only."
    },
    {
      id: "creative-orange",
      title: "Creative studio orange",
      badge: "Agency",
      category: "business",
      preview: "agency",
      description: "Agency pitch look with blood-orange accents and clean type.",
      prompt:
        "Generate a slide deck from my sources that looks like a top creative agency pitch. White background, black text, blood-orange accent color. Mix dynamic photography with clean English display type. Confident spacing, strong hierarchy, one idea per slide. No markdown on slide faces. Keep claims tied to my notebook materials."
    },
    {
      id: "speaker-minimal",
      title: "Speaker minimal",
      badge: "Seminar",
      category: "business",
      preview: "seminar",
      description: "Conference slides with very little on-screen text.",
      prompt:
        "Build a conference-style deck from my sources with very little on-slide text. White background, black sans-serif type, red accent only for emphasis. One headline and at most two short lines per slide. Use a single high-quality portrait or abstract photo per slide. Let me talk; the slides should support, not replace, the narrative. Plain text only. Ground content in my sources."
    },
    {
      id: "comic-explainer",
      title: "Comic explainer",
      badge: "Manga",
      category: "pop",
      preview: "manga",
      description: "Panel layouts and speech bubbles for memorable teaching.",
      prompt:
        "Turn my notebook content into a manga-inspired slide story. Use panel-style layouts, speech bubbles, and a light narrative arc so ideas are easier to remember. Friendly tone, short dialogue, visual pacing between setup and payoff. Plain text in bubbles. Teach the core concepts from my sources through scenes and characters, not bullet walls."
    },
    {
      id: "dusty-pink",
      title: "Dusty pink editorial",
      badge: "Magazine",
      category: "pop",
      preview: "magazine",
      description: "Mature-cute magazine layout with numbered callouts.",
      prompt:
        "Compile my sources as a mature-cute magazine editorial deck. Matte dusty-pink background, charcoal text, cutout subject photo centered with movement. Numbered callouts (NO.1, NO.2) in the margins, vertical side copy, subtle crop marks in corners. Hand-drawn bubbles for key quotes. Landscape slides, polished and trendy. Plain text only. Content from my notebook."
    },
    {
      id: "neo-retro-dev",
      title: "Neo-retro builder",
      badge: "Dev deck",
      category: "pop",
      preview: "retro-dev",
      description: "Grid paper, pixel icons, modular color blocks for tech topics.",
      prompt:
        "Create a developer-focused slide deck from my sources in neo-retro editorial style. Light cream grid-paper background, thick black borders, modular color blocks (hot pink, bright yellow, cyan). Pixel-style icons for agents, code, browsers, and tools. Short declarative copy, no marketing fluff. Stacked layers for architecture slides, left-to-right evolution for timelines. Feels like annotated engineering notes, not corporate PPT."
    },
    {
      id: "pink-street",
      title: "Pink street collage",
      badge: "Street pop",
      category: "pop",
      preview: "street-pop",
      description: "Playful pink street style with flat illustrations.",
      prompt:
        "Design slides from my notebook in a pink street-pop style. Pink backgrounds, white and black text, thick-outline flat illustrations, soft trimmed photo shapes. Loose, playful, slightly rebellious energy. Flat colors, no gradients. One bold idea per slide. Plain text on slides. Keep facts tied to my sources."
    },
    {
      id: "watercolor",
      title: "Royal blue and red wash",
      badge: "Watercolor",
      category: "artistic",
      preview: "watercolor",
      description: "Painterly textures with minimal, elegant type.",
      prompt:
        "Build an artistic slide deck from my sources using wet watercolor textures in royal blue and red. Painterly backgrounds, elegant type, gallery-like pacing. Let visuals carry emotion while text stays minimal and precise. Vary brush intensity slide to slide. Plain text only. Ground narrative in my notebook."
    },
    {
      id: "constructivist",
      title: "Constructivist collage",
      badge: "Neon tech",
      category: "artistic",
      preview: "neon-tech",
      description: "Beige paper, neon yellow geometry, blueprint annotations.",
      prompt:
        "Turn my sources into a constructivist tech-art deck. Warm beige paper texture background, charcoal text, neon yellow geometric accents, ultra-thin draft lines. Monochrome cutout portraits masked inside circles and squares. Blueprint-style labels (Fig.1, Fig.2), radar charts with bold yellow plot lines. Intellectual, structural, future-facing. Plain slide text. Source-based content."
    },
    {
      id: "studio-mockup",
      title: "Studio device showcase",
      badge: "Mockup",
      category: "premium",
      preview: "mockup",
      description: "Premium device mockups on studio backgrounds.",
      prompt:
        "Create a premium product deck from my notebook sources. High-quality device mockups on white or light-gray studio backgrounds with soft shadows. Screens are the hero (70-80% of slide area). UI inside screens: bold sans-serif on black or vivid gradients, purple and acid-yellow accents. Spacious card layouts, oversized numbers, thin dividers. Clean, advanced, launch-ready. Plain text on slides. Facts from my sources only."
    },
    {
      id: "athletic-energy",
      title: "Athletic energy",
      badge: "Sports",
      category: "premium",
      preview: "sports",
      description: "High-energy sports broadcast with bold italic headlines.",
      prompt:
        "Generate a high-energy slide deck from my sources with a sports broadcast feel. Dark asphalt-black base, white italic headlines, bolt-lime and neon-orange accents. Dynamic action photography with motion blur, diagonal cuts, skewed shapes, scoreboard-style metrics. Passionate, fast, competitive tone. Plain text on slides. Ground stats and claims in my notebook."
    },
    {
      id: "anti-gravity",
      title: "Anti-gravity clarity",
      badge: "Calm product",
      category: "premium",
      preview: "calm-product",
      description: "Airy white canvas with soft gradient accents.",
      prompt:
        "Build a calm, premium product narrative deck from my sources. Pure white canvas, wide margins, left-aligned type. Soft blue-to-violet gradient accents only at slide edges, never behind text. Thin-line icons, rounded capability cards, realistic UI screenshots where helpful. Tone: precise, confident, no hype words. Show messy thinking becoming clean structure. One idea per slide. Plain text. Source-grounded."
    }
  ]
};
