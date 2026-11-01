# Blog thumbnails

One 1200 x 630 image per post: a short benefit headline on the left, a
simplified piece of product UI on the right that shows the point. Used on the
blog cards, as each post's hero image, and as its og:image / twitter:image.

- `template.html`: every post's kicker, headline, subline and UI scene
  (the `POSTS` map, keyed by the post's file name). Real words only on the
  subject; grey bars for everything else.
- `render.js`: renders them with Playwright (`node scripts/blog-thumbs/render.js [id ...]`).
- `to-webp.py`: writes `website/assets/blog/<id>.webp` (cards, hero) and
  `website/assets/blog/og/<id>.jpg` (social previews).

New post: add an entry to `POSTS`, render it, convert it, then add the
`blog-card-thumb` image to its cards and the `blog-article-hero` figure and
og/twitter image to the post (copy any existing post).
