/**
 * Regenerates the sample posts shown on the marketing site.
 *
 * Three deliberate kinds, because the honest answer to "what do you make?" is
 * "it depends on the post":
 *   photo     — the owner's photo goes out as-is; our work is the caption.
 *   composed  — a real photo with type composed over it by the graphics engine.
 *   graphic   — pure design, no photograph (quote cards, tip cards).
 *
 * The composed/graphic images come from the SAME engine that serves customers,
 * so the homepage is an honest preview rather than a mockup.
 *
 * Captions follow the distribution playbook in
 * apps/backend/src/operator/llm/playbook.ts — hook inside the first 125
 * characters, plain search keywords early, a send/save CTA, 3-5 niche tags.
 *
 * Usage:  npm run build:backend && node scripts/make-samples.js
 */
const { writeFileSync, unlinkSync } = require('node:fs');
const { execFileSync } = require('node:child_process');
const { join } = require('node:path');
const {
  GraphicsService,
} = require('../apps/backend/dist/operator/graphics/graphics.service');

const OUT = join(__dirname, '..', 'apps', 'web', 'public', 'samples');
const LIB = join(__dirname, '..', 'apps', 'web', 'app', '_lib');

const photoUrl = (id, w = 1400) =>
  `https://images.unsplash.com/photo-${id}?auto=format&fit=crop&w=${w}&q=80`;
/** Square crop, for the photo-only posts that ship straight to the feed. */
const squareUrl = (id) =>
  `https://images.unsplash.com/photo-${id}?auto=format&fit=crop&w=1080&h=1080&q=80`;

const COFFEE = {
  primary: '#6B3A24',
  secondary: '#E8B27D',
  brandName: "Rosa's Coffee",
  style: 'bold',
};
const FLORAL = {
  primary: '#2E4B3C',
  secondary: '#F0B429',
  brandName: 'Fieldnote Florals',
  style: 'luxe',
};

const SAMPLES = [
  {
    file: 'photo-cortados.jpg',
    kind: 'photo',
    label: 'Your photo, our words',
    photoId: '1509042239860-f550ce710b93',
    brand: "Rosa's Coffee",
    alt: 'Three cortados with latte art on a wooden table at a Pasadena coffee shop',
    caption: `Three cortados, one table, zero laptops open. That's the goal.

Our espresso is pulled on beans roasted twelve miles from here — which is why it tastes like something instead of just caffeine.

Send this to the person you owe a coffee.

#pasadenacoffee #oldtownpasadena #espressobar #coffeeshopsnearme`,
  },
  {
    file: 'photo-window.jpg',
    kind: 'photo',
    label: 'Your photo, our words',
    photoId: '1445116572660-236099ec97a0',
    brand: "Rosa's Coffee",
    alt: 'Cozy window table with a french press inside a plant-filled Pasadena cafe',
    caption: `The corner table by the window is open. It won't be in twenty minutes.

Rainy-day rules at our Pasadena coffee shop: french press, no rush, stay as long as your book lasts.

Save this for the next grey afternoon.

#pasadenacafe #rainydayreads #frenchpress #cozycoffeeshop`,
  },
  {
    file: 'composed-promo.jpg',
    kind: 'composed',
    label: 'Photo + graphic',
    photoId: '1541167760496-1628856ab772',
    layout: 'full',
    theme: COFFEE,
    spec: { kind: 'promo', headline: '50% OFF', body: 'Every latte, this Friday only.' },
    brand: "Rosa's Coffee",
    alt: 'Milk being poured into a latte, with 50% off Friday offer text over the photo',
    caption: `Half-price lattes this Friday. That's the whole post.

Every latte, all day, 7am–4pm at our Old Town Pasadena shop. Oat milk included, no minimum, no catch.

Send this to whoever you're dragging along.

#pasadenacoffee #lattedeals #oldtownpasadena #coffeespecials`,
  },
  {
    file: 'composed-bouquet.jpg',
    kind: 'composed',
    label: 'Photo + graphic',
    photoId: '1490750967868-88aa4486c946',
    layout: 'band',
    theme: FLORAL,
    spec: {
      kind: 'title',
      headline: 'The Spring Bouquet',
      body: 'Fresh stems, arranged the morning you order.',
    },
    brand: 'Fieldnote Florals',
    alt: 'Field of yellow poppies above a green panel announcing a spring bouquet launch',
    caption: `Peonies are back, and they're only here for about three weeks.

Our spring bouquet is cut and arranged the morning you order it, with local Pasadena delivery before noon.

Save this so you don't miss the window.

#pasadenaflorist #springbouquet #peonyseason #flowerdelivery`,
  },
  {
    file: 'graphic-quote.jpg',
    kind: 'graphic',
    label: 'Pure graphic',
    theme: { ...COFFEE, style: 'editorial' },
    spec: { kind: 'quote', headline: 'The best ideas are brewed, not forced.' },
    brand: "Rosa's Coffee",
    alt: 'Quote card reading the best ideas are brewed not forced, in cream on deep brown',
    caption: `"The best ideas are brewed, not forced."

Written on our chalkboard this morning by a regular who's been coming in since we opened. She's not wrong.

Send this to someone who needs to slow down today.

#pasadenacoffee #slowmornings #coffeeshopquotes #shoplocal`,
  },
  {
    file: 'graphic-tips.jpg',
    kind: 'graphic',
    label: 'Pure graphic',
    theme: FLORAL,
    spec: {
      kind: 'title',
      headline: 'Make your bouquet last twice as long',
      body: 'Re-cut the stems every other day · Actually change the water · Keep them away from the fruit bowl',
    },
    brand: 'Fieldnote Florals',
    alt: 'Green tip card listing three ways to make a fresh flower bouquet last longer',
    caption: `Your bouquet can last twice as long. Three things, none of them complicated.

1. Re-cut the stems at an angle every other day
2. Change the water — actually change it, don't top it up
3. Keep them off the counter next to the fruit bowl. Ripening fruit gives off ethylene and wilts flowers fast

Save this for your next bunch.

#pasadenaflorist #flowercare #bouquettips #freshflowers`,
  },
];

/**
 * The engine emits PNG (right for the product — crisp text, no compression
 * fuzz). For the website copies we convert: a photo PNG is ~1 MB versus ~150 KB
 * as a JPEG. Uses macOS `sips`; if unavailable we keep the PNG and say so.
 */
function toJpeg(pngPath, jpgPath) {
  try {
    execFileSync(
      'sips',
      ['-s', 'format', 'jpeg', '-s', 'formatOptions', '82', pngPath, '--out', jpgPath],
      { stdio: 'ignore' },
    );
    unlinkSync(pngPath);
    return true;
  } catch {
    return false;
  }
}

async function main() {
  const gfx = new GraphicsService();
  const manifest = [];

  for (const s of SAMPLES) {
    process.stdout.write(`${s.kind.padEnd(9)} ${s.file} … `);

    if (s.kind === 'photo') {
      // No rendering — the owner's own photo is the post.
      const res = await fetch(squareUrl(s.photoId));
      if (!res.ok) throw new Error(`photo fetch ${res.status} for ${s.file}`);
      const bytes = Buffer.from(await res.arrayBuffer());
      writeFileSync(join(OUT, s.file), bytes);
      console.log(`${(bytes.length / 1024).toFixed(0)} KB (unmodified photo)`);
    } else {
      const spec = { ...s.spec };
      if (s.kind === 'composed') {
        spec.photo = await gfx.fetchPhoto(photoUrl(s.photoId));
        spec.photoLayout = s.layout;
      }
      const png = gfx.renderSlide(spec, s.theme);
      const pngPath = join(OUT, s.file.replace(/\.jpg$/, '.png'));
      writeFileSync(pngPath, png);
      const converted = toJpeg(pngPath, join(OUT, s.file));
      console.log(
        converted
          ? `${(png.length / 1024).toFixed(0)} KB png → jpg`
          : `${(png.length / 1024).toFixed(0)} KB png (sips unavailable)`,
      );
    }

    manifest.push({
      file: s.file,
      kind: s.kind,
      label: s.label,
      brand: s.brand,
      alt: s.alt,
      caption: s.caption,
    });
  }

  // Single source of truth for the site — typed, so the page can't drift.
  const ts = `// GENERATED by scripts/make-samples.js — do not edit by hand.
// Captions follow the distribution playbook in
// apps/backend/src/operator/llm/playbook.ts.

export type SampleKind = 'photo' | 'composed' | 'graphic';

export interface Sample {
  file: string;
  kind: SampleKind;
  label: string;
  brand: string;
  alt: string;
  caption: string;
}

export const SAMPLES: readonly Sample[] = ${JSON.stringify(manifest, null, 2)} as const;
`;
  writeFileSync(join(LIB, 'samples.ts'), ts);
  writeFileSync(join(OUT, 'manifest.json'), JSON.stringify(manifest, null, 2) + '\n');
  console.log(`\ndone → ${SAMPLES.length} samples, plus app/_lib/samples.ts`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
