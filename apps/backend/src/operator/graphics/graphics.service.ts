import { Injectable } from '@nestjs/common';
import { Resvg } from '@resvg/resvg-js';
import {
  renderSlideSvg,
  type SlideSpec,
  type BrandTheme,
  CANVAS,
} from './slide-templates';

/**
 * Turns slide specs into real PNG images. The SVG we build is always
 * pixel-crisp and correctly spelled; this service just rasterizes it.
 */
@Injectable()
export class GraphicsService {
  /** Render one slide spec to a PNG buffer (1080×1080). */
  renderSlide(spec: SlideSpec, theme: BrandTheme): Buffer {
    const svg = renderSlideSvg(spec, theme);
    const resvg = new Resvg(svg, {
      fitTo: { mode: 'width', value: CANVAS },
      font: { loadSystemFonts: true },
      background: 'rgba(0,0,0,0)',
    });
    return Buffer.from(resvg.render().asPng());
  }

  /** Render a multi-slide Instagram carousel — one PNG per slide, in order. */
  renderCarousel(specs: SlideSpec[], theme: BrandTheme): Buffer[] {
    return specs.map((s) => this.renderSlide(s, theme));
  }
}
