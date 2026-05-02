import { useEffect } from 'react';

interface PageMeta {
  title: string;
  description?: string;
}

const DEFAULT_DESCRIPTION =
  'OpenBento allows power users to build custom, high-performance dashboards for watching multiple streams simultaneously. Optimized for desktop.';

type MetaAttr = 'name' | 'property';

const setMetaTagContent = (
  attr: MetaAttr,
  key: string,
  value: string,
): string | null => {
  if (typeof document === 'undefined') return null;
  let el = document.head.querySelector<HTMLMetaElement>(
    `meta[${attr}="${key}"]`,
  );
  if (!el) {
    el = document.createElement('meta');
    el.setAttribute(attr, key);
    document.head.appendChild(el);
  }
  const previous = el.getAttribute('content');
  el.setAttribute('content', value);
  return previous;
};

/**
 * Sets the document title plus matching og:title / twitter:title
 * (and optional description meta tags) for the current page.
 *
 * Pass a `title` like "Privacy Policy" — the hook formats it as
 * "Privacy Policy | OpenBento". Pass an empty string to use the site default.
 *
 * On unmount, restores the previous values so navigation between pages doesn't
 * leak stale meta tag content from the prior route.
 */
export function usePageMeta({ title, description }: PageMeta) {
  useEffect(() => {
    if (typeof document === 'undefined') return;

    const fullTitle = title ? `${title} | OpenBento` : 'OpenBento | The Ultimate Multi-Stream Personal Dashboard';
    const desc = description ?? DEFAULT_DESCRIPTION;

    const previousTitle = document.title;
    document.title = fullTitle;

    const tags: Array<[MetaAttr, string, string]> = [
      ['name', 'title', fullTitle],
      ['name', 'description', desc],
      ['property', 'og:title', fullTitle],
      ['property', 'og:description', desc],
      ['name', 'twitter:title', fullTitle],
      ['name', 'twitter:description', desc],
    ];

    const previousValues = tags.map(([attr, key, value]) => ({
      attr,
      key,
      previous: setMetaTagContent(attr, key, value),
    }));

    return () => {
      document.title = previousTitle;
      previousValues.forEach(({ attr, key, previous }) => {
        if (previous !== null) {
          setMetaTagContent(attr, key, previous);
        }
      });
    };
  }, [title, description]);
}
