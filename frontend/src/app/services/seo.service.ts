import { Injectable, inject } from '@angular/core';
import { Meta, Title } from '@angular/platform-browser';
import { DOCUMENT } from '@angular/common';

const SITE_NAME = 'Loterías de Hoy';
const BASE_URL = 'https://loteriasdehoy.pro';
const DEFAULT_IMAGE = `${BASE_URL}/og-image.png`;

@Injectable({ providedIn: 'root' })
export class SeoService {
  private meta = inject(Meta);
  private title = inject(Title);
  private doc = inject(DOCUMENT);

  update(config: {
    title: string;
    description: string;
    url?: string;
    image?: string;
    type?: string;
    jsonLd?: Record<string, unknown>;
  }): void {
    const fullTitle = `${config.title} | ${SITE_NAME}`;
    const url = config.url ? `${BASE_URL}${config.url}` : BASE_URL;
    const image = config.image || DEFAULT_IMAGE;

    // Title
    this.title.setTitle(fullTitle);

    // Standard meta
    this.meta.updateTag({ name: 'description', content: config.description });
    this.meta.updateTag({ name: 'robots', content: 'index, follow' });

    // Canonical
    this.updateCanonical(url);

    // Open Graph
    this.meta.updateTag({ property: 'og:title', content: fullTitle });
    this.meta.updateTag({ property: 'og:description', content: config.description });
    this.meta.updateTag({ property: 'og:url', content: url });
    this.meta.updateTag({ property: 'og:image', content: image });
    this.meta.updateTag({ property: 'og:type', content: config.type || 'website' });

    // Twitter
    this.meta.updateTag({ name: 'twitter:title', content: fullTitle });
    this.meta.updateTag({ name: 'twitter:description', content: config.description });
    this.meta.updateTag({ name: 'twitter:image', content: image });

    // JSON-LD
    if (config.jsonLd) {
      this.updateJsonLd(config.jsonLd);
    }
  }

  private updateCanonical(url: string): void {
    let link = this.doc.querySelector('link[rel="canonical"]') as HTMLLinkElement;
    if (!link) {
      link = this.doc.createElement('link');
      link.setAttribute('rel', 'canonical');
      this.doc.head.appendChild(link);
    }
    link.setAttribute('href', url);
  }

  private updateJsonLd(data: Record<string, unknown>): void {
    // Remove previous dynamic JSON-LD (keep the static one in index.html)
    const existing = this.doc.querySelector('script[data-seo="dynamic"]');
    if (existing) existing.remove();

    const script = this.doc.createElement('script');
    script.type = 'application/ld+json';
    script.setAttribute('data-seo', 'dynamic');
    script.textContent = JSON.stringify({ '@context': 'https://schema.org', ...data });
    this.doc.head.appendChild(script);
  }
}
