-- Slide deck prompts with example images.
--   public.slide_deck_prompts         one row per prompt (style), with a cover image
--   public.slide_deck_prompt_images   example slides for a prompt, in order
--   storage bucket slide-deck-images  the image files (public read)
-- Anyone can read published prompts; only admins (profiles.is_admin) can write.

-- Admin flag on the existing profiles table
alter table public.profiles add column if not exists is_admin boolean not null default false;

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce((select p.is_admin from public.profiles p where p.id = auth.uid()), false);
$$;

revoke all on function public.is_admin() from public;
grant execute on function public.is_admin() to anon, authenticated;

-- Prompts
create table if not exists public.slide_deck_prompts (
  id           text primary key check (id ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  title        text not null,
  badge        text,
  category     text not null default 'business',
  preview      text,
  description  text,
  prompt       text not null,
  tags         text[] not null default '{}',
  cover_path   text,            -- object path in the slide-deck-images bucket
  sort_order   integer not null default 0,
  published    boolean not null default true,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create index if not exists slide_deck_prompts_published_idx
  on public.slide_deck_prompts (published, category, sort_order);

-- Example slide images for each prompt
create table if not exists public.slide_deck_prompt_images (
  id          uuid primary key default gen_random_uuid(),
  prompt_id   text not null references public.slide_deck_prompts (id) on delete cascade,
  path        text not null,    -- object path in the slide-deck-images bucket
  caption     text,
  width       integer,
  height      integer,
  sort_order  integer not null default 0,
  created_at  timestamptz not null default now(),
  unique (prompt_id, path)
);

create index if not exists slide_deck_prompt_images_prompt_idx
  on public.slide_deck_prompt_images (prompt_id, sort_order);

-- updated_at
create or replace function public.touch_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists slide_deck_prompts_touch on public.slide_deck_prompts;
create trigger slide_deck_prompts_touch
  before update on public.slide_deck_prompts
  for each row execute function public.touch_updated_at();

-- Row-level security
alter table public.slide_deck_prompts enable row level security;
alter table public.slide_deck_prompt_images enable row level security;

drop policy if exists "Published prompts are public" on public.slide_deck_prompts;
create policy "Published prompts are public" on public.slide_deck_prompts
  for select to anon, authenticated
  using (published or (select public.is_admin()));

drop policy if exists "Admins manage prompts" on public.slide_deck_prompts;
create policy "Admins manage prompts" on public.slide_deck_prompts
  for all to authenticated
  using ((select public.is_admin()))
  with check ((select public.is_admin()));

drop policy if exists "Images of published prompts are public" on public.slide_deck_prompt_images;
create policy "Images of published prompts are public" on public.slide_deck_prompt_images
  for select to anon, authenticated
  using (exists (
    select 1 from public.slide_deck_prompts p
    where p.id = prompt_id and (p.published or (select public.is_admin()))
  ));

drop policy if exists "Admins manage prompt images" on public.slide_deck_prompt_images;
create policy "Admins manage prompt images" on public.slide_deck_prompt_images
  for all to authenticated
  using ((select public.is_admin()))
  with check ((select public.is_admin()));

-- Storage bucket: public read, images only, 5 MB each
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('slide-deck-images', 'slide-deck-images', true, 5242880,
        array['image/png', 'image/jpeg', 'image/webp', 'image/avif'])
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "Admins upload slide deck images" on storage.objects;
create policy "Admins upload slide deck images" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'slide-deck-images' and (select public.is_admin()));

drop policy if exists "Admins update slide deck images" on storage.objects;
create policy "Admins update slide deck images" on storage.objects
  for update to authenticated
  using (bucket_id = 'slide-deck-images' and (select public.is_admin()))
  with check (bucket_id = 'slide-deck-images' and (select public.is_admin()));

drop policy if exists "Admins delete slide deck images" on storage.objects;
create policy "Admins delete slide deck images" on storage.objects
  for delete to authenticated
  using (bucket_id = 'slide-deck-images' and (select public.is_admin()));

-- Seed: the 14 styles that ship in the extension (prompt-library-data.js)
insert into public.slide_deck_prompts (id, title, badge, category, preview, description, prompt, sort_order)
values
  ($q$smart-editorial$q$, $q$Smart editorial deck$q$, $q$Business media$q$, $q$business$q$, $q$editorial$q$, $q$Asymmetrical cover, yellow accents, magazine-style headlines.$q$, $q$Build a slide deck from my notebook sources in a sharp digital business magazine style. Slide text must be plain text only with no markdown symbols. Cover slide: asymmetrical Swiss-style layout, a 2-5 word headline as the visual anchor, and a short subtitle that states the reader's problem. Colors: white or cool gray background, near-black text, electric yellow or red accents. Headlines should fill 30-50% of each slide with a 10:1 size jump over body copy. One message per slide. Use cutout-style photos and yellow marker highlights on key numbers. Ground every point in my sources.$q$, 10),
  ($q$architectural-minimal$q$, $q$Architectural portfolio$q$, $q$Minimal$q$, $q$business$q$, $q$minimal$q$, $q$Grid-based whitespace, section labels, oversized numbers.$q$, $q$Turn my sources into a refined minimal presentation. Tone: professional, grid-based, whitespace-heavy. Palette: light gray or white base, black typography, optional full-black slides for emphasis. Add a small section label on every slide (example: 01. INTRODUCTION). Favor asymmetrical splits, oversized numbers beside narrative text, thin divider lines, and vertical timelines. Sans-serif headings, airy body text. No clutter. Content must come only from my uploaded sources.$q$, 20),
  ($q$yellow-black$q$, $q$Yellow and black feature$q$, $q$Editorial$q$, $q$business$q$, $q$yellow-black$q$, $q$Bold fashion-editorial contrast with dynamic serif type.$q$, $q$Create slides from my notebook in a bold fashion-editorial style. Background: saturated yellow. Text: black in a large modern serif. Layout like a magazine spread with dynamic type placement. Use striking portrait photography and small handwritten-style accents or sticker-like details. High contrast, confident, visual-first. Plain text on slides, no markdown. Source-grounded content only.$q$, 30),
  ($q$creative-orange$q$, $q$Creative studio orange$q$, $q$Agency$q$, $q$business$q$, $q$agency$q$, $q$Agency pitch look with blood-orange accents and clean type.$q$, $q$Generate a slide deck from my sources that looks like a top creative agency pitch. White background, black text, blood-orange accent color. Mix dynamic photography with clean English display type. Confident spacing, strong hierarchy, one idea per slide. No markdown on slide faces. Keep claims tied to my notebook materials.$q$, 40),
  ($q$speaker-minimal$q$, $q$Speaker minimal$q$, $q$Seminar$q$, $q$business$q$, $q$seminar$q$, $q$Conference slides with very little on-screen text.$q$, $q$Build a conference-style deck from my sources with very little on-slide text. White background, black sans-serif type, red accent only for emphasis. One headline and at most two short lines per slide. Use a single high-quality portrait or abstract photo per slide. Let me talk; the slides should support, not replace, the narrative. Plain text only. Ground content in my sources.$q$, 50),
  ($q$comic-explainer$q$, $q$Comic explainer$q$, $q$Manga$q$, $q$pop$q$, $q$manga$q$, $q$Panel layouts and speech bubbles for memorable teaching.$q$, $q$Turn my notebook content into a manga-inspired slide story. Use panel-style layouts, speech bubbles, and a light narrative arc so ideas are easier to remember. Friendly tone, short dialogue, visual pacing between setup and payoff. Plain text in bubbles. Teach the core concepts from my sources through scenes and characters, not bullet walls.$q$, 60),
  ($q$dusty-pink$q$, $q$Dusty pink editorial$q$, $q$Magazine$q$, $q$pop$q$, $q$magazine$q$, $q$Mature-cute magazine layout with numbered callouts.$q$, $q$Compile my sources as a mature-cute magazine editorial deck. Matte dusty-pink background, charcoal text, cutout subject photo centered with movement. Numbered callouts (NO.1, NO.2) in the margins, vertical side copy, subtle crop marks in corners. Hand-drawn bubbles for key quotes. Landscape slides, polished and trendy. Plain text only. Content from my notebook.$q$, 70),
  ($q$neo-retro-dev$q$, $q$Neo-retro builder$q$, $q$Dev deck$q$, $q$pop$q$, $q$retro-dev$q$, $q$Grid paper, pixel icons, modular color blocks for tech topics.$q$, $q$Create a developer-focused slide deck from my sources in neo-retro editorial style. Light cream grid-paper background, thick black borders, modular color blocks (hot pink, bright yellow, cyan). Pixel-style icons for agents, code, browsers, and tools. Short declarative copy, no marketing fluff. Stacked layers for architecture slides, left-to-right evolution for timelines. Feels like annotated engineering notes, not corporate PPT.$q$, 80),
  ($q$pink-street$q$, $q$Pink street collage$q$, $q$Street pop$q$, $q$pop$q$, $q$street-pop$q$, $q$Playful pink street style with flat illustrations.$q$, $q$Design slides from my notebook in a pink street-pop style. Pink backgrounds, white and black text, thick-outline flat illustrations, soft trimmed photo shapes. Loose, playful, slightly rebellious energy. Flat colors, no gradients. One bold idea per slide. Plain text on slides. Keep facts tied to my sources.$q$, 90),
  ($q$watercolor$q$, $q$Royal blue and red wash$q$, $q$Watercolor$q$, $q$artistic$q$, $q$watercolor$q$, $q$Painterly textures with minimal, elegant type.$q$, $q$Build an artistic slide deck from my sources using wet watercolor textures in royal blue and red. Painterly backgrounds, elegant type, gallery-like pacing. Let visuals carry emotion while text stays minimal and precise. Vary brush intensity slide to slide. Plain text only. Ground narrative in my notebook.$q$, 100),
  ($q$constructivist$q$, $q$Constructivist collage$q$, $q$Neon tech$q$, $q$artistic$q$, $q$neon-tech$q$, $q$Beige paper, neon yellow geometry, blueprint annotations.$q$, $q$Turn my sources into a constructivist tech-art deck. Warm beige paper texture background, charcoal text, neon yellow geometric accents, ultra-thin draft lines. Monochrome cutout portraits masked inside circles and squares. Blueprint-style labels (Fig.1, Fig.2), radar charts with bold yellow plot lines. Intellectual, structural, future-facing. Plain slide text. Source-based content.$q$, 110),
  ($q$studio-mockup$q$, $q$Studio device showcase$q$, $q$Mockup$q$, $q$premium$q$, $q$mockup$q$, $q$Premium device mockups on studio backgrounds.$q$, $q$Create a premium product deck from my notebook sources. High-quality device mockups on white or light-gray studio backgrounds with soft shadows. Screens are the hero (70-80% of slide area). UI inside screens: bold sans-serif on black or vivid gradients, purple and acid-yellow accents. Spacious card layouts, oversized numbers, thin dividers. Clean, advanced, launch-ready. Plain text on slides. Facts from my sources only.$q$, 120),
  ($q$athletic-energy$q$, $q$Athletic energy$q$, $q$Sports$q$, $q$premium$q$, $q$sports$q$, $q$High-energy sports broadcast with bold italic headlines.$q$, $q$Generate a high-energy slide deck from my sources with a sports broadcast feel. Dark asphalt-black base, white italic headlines, bolt-lime and neon-orange accents. Dynamic action photography with motion blur, diagonal cuts, skewed shapes, scoreboard-style metrics. Passionate, fast, competitive tone. Plain text on slides. Ground stats and claims in my notebook.$q$, 130),
  ($q$anti-gravity$q$, $q$Anti-gravity clarity$q$, $q$Calm product$q$, $q$premium$q$, $q$calm-product$q$, $q$Airy white canvas with soft gradient accents.$q$, $q$Build a calm, premium product narrative deck from my sources. Pure white canvas, wide margins, left-aligned type. Soft blue-to-violet gradient accents only at slide edges, never behind text. Thin-line icons, rounded capability cards, realistic UI screenshots where helpful. Tone: precise, confident, no hype words. Show messy thinking becoming clean structure. One idea per slide. Plain text. Source-grounded.$q$, 140)
on conflict (id) do nothing;
