import { TENANCY_QUERY_STRING_KEY } from '../types';

export class Tenancy {
  public static encryptedTenancyWithTemplateGroup =
    'U2FsdGVkX1%2F2QDRQtHSEHR4AnGRbrsQBNtxpMsWZrFa8X7KeMq%2BbAcui06tQUiAzuTzpFqqoxFpH6pUeK%2B0AcMQ%2FgWXwHH%2FH%2B5wm8o2eupXtFVTjFdhnOLIQp2aoZxvY';

  public static encryptedTenancyWithNotAvailableTenancy =
    'U2FsdGVkX197uwv1cT%2FMyPLmvG4iloWQpLAxJy5wW1csXa2eqLbF0JcQihdWNfpOJ5k2d%2FH%2BtUaW7%2BSMr4MW77AyMaHd4hRz3WyTOW9RsgQ%3D';

  public static encryptedInfosecGroup =
    'U2FsdGVkX19NA4zo3j%2BFfqlrhGwAoRnqfKlt4mELK8JYITdrBgNrxNAkXTvRn%2FAUmarKlnZBqKBK0592NX%2FWyer%2B2CvTOaL1T1PH0FoUWvEJEu7L1crZPcYG1WMike82';

  static checkTenancyNameInBadge(tenancyName: string, kibanaAccess: 'a' | 'rw' | 'ro' | 'ro_strict') {
    cy.get('[data-testid="tenant-indicator"]').as('tenancyIndicator').trigger('mouseover');
    cy.get('@tenancyIndicator').should('have.text', `${tenancyName}${kibanaAccess}`);
  }

  static getTenancyFromUrl() {
    return cy
      .location('search')
      .then(search => new RegExp(`[?&]${TENANCY_QUERY_STRING_KEY}=([^&#]*)`).exec(search)?.[1] ?? null);
  }
}
