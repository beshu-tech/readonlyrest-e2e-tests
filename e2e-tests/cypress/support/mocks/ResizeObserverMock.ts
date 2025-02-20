export class ResizeObserverMock {
  private callback: ResizeObserverCallback;
  private elements: Set<Element>;

  constructor(callback: ResizeObserverCallback) {
    // Debounce the callback to prevent ResizeObserver loops
    this.callback = Cypress._.debounce(callback, 200);
    this.elements = new Set();
  }

  observe(element: Element) {
    this.elements.add(element);

    // Simulate a resize event with a valid ResizeObserverEntry structure
    setTimeout(() => {
      if (this.elements.has(element)) {
        const entries: ResizeObserverEntry[] = [
          {
            target: element,
            contentRect: element.getBoundingClientRect(),
            borderBoxSize: [{ inlineSize: element.clientWidth, blockSize: element.clientHeight }],
            contentBoxSize: [{ inlineSize: element.clientWidth, blockSize: element.clientHeight }],
            devicePixelContentBoxSize: [{ inlineSize: element.clientWidth, blockSize: element.clientHeight }]
          } as ResizeObserverEntry
        ];
        this.callback(entries, this);
      }
    }, 200);
  }

  unobserve(element: Element) {
    this.elements.delete(element);
  }

  disconnect() {
    this.elements.clear();
  }
}
