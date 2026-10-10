let routeCount = 0;

/**
 * Registers a route for the requests sent after this call, and returns the alias to wait on.
 *
 * cy.wait('@x') takes the first request not yet waited on, from every route with the alias x.
 * When a page object registers the same alias again in one test, each request goes into each of
 * those routes, so a later wait gets a copy of an old request and does not wait. A new alias for
 * each route prevents that.
 */
export const interceptNext = (method: string, url: string | RegExp, name: string): `@${string}` => {
  routeCount += 1;
  const alias = `${name}-${routeCount}`;
  cy.intercept(method, url).as(alias);
  return `@${alias}`;
};
