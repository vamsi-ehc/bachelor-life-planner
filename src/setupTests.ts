import '@testing-library/jest-dom';

class MockIntersectionObserver implements IntersectionObserver {
  readonly root: Element | Document | null = null;
  readonly rootMargin: string = '';
  readonly thresholds: ReadonlyArray<number> = [];
  observe() {}
  unobserve() {}
  disconnect() {}
  takeRecords(): IntersectionObserverEntry[] {
    return [];
  }
}

if (typeof window !== 'undefined' && !window.IntersectionObserver) {
  window.IntersectionObserver = MockIntersectionObserver as unknown as typeof IntersectionObserver;
}
