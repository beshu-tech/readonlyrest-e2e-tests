import { kibanaVersion, requiredBaseUrl } from '../helpers';
import { interceptNext } from '../helpers/interceptNext';
import { TENANCY_QUERY_STRING_KEY } from '../types';

type SharedApp = 'discover' | 'dashboards';

// The share menu of the top navigation, which Discover and Dashboard both have.
export class Share {
  static open() {
    cy.log('Open the share menu');
    cy.getByDataTestSubj('shareTopNavButton').click();
    if (kibanaVersion.lt('8.0.0')) {
      cy.getByDataTestSubj('sharePanel-Permalinks').click();
    }
  }

  /**
   * Copies the link and checks that it carries the tenancy. Kibana 8 and later copy a short URL
   * when the user can write, and create it with a request on the click. For a read-only user they
   * copy a Discover locator URL. Kibana 7 copies the full URL of the app.
   */
  static copyLinkAndCheck(app: SharedApp, tenancy: string, { canWrite }: { canWrite: boolean }) {
    cy.log('Copy the share link');
    const tenancyParam = `${TENANCY_QUERY_STRING_KEY}=${tenancy}`;
    const appUrl = `${requiredBaseUrl()}/s/default/app`;
    if (kibanaVersion.lt('8.0.0')) {
      cy.getByDataTestSubj('copyShareUrlButton').click();
      cy.getValueFromClipboard().should(
        'contain',
        `${appUrl}/${app}?${tenancyParam}#${app === 'dashboards' ? '/' : ''}`
      );
    } else if (canWrite) {
      const generateShortUrl = interceptNext('generateShortUrl', {
        method: 'POST',
        pathname: '/s/default/api/short_url'
      });
      cy.getByDataTestSubj('copyShareUrlButton').click();
      cy.wait(generateShortUrl);
      cy.getValueFromClipboard().should('contain', `${appUrl}/r/s`).should('contain', `?${tenancyParam}`);
    } else {
      cy.getByDataTestSubj('copyShareUrlButton').click();
      cy.getValueFromClipboard()
        .should('contain', `${appUrl}/r?l=DISCOVER_APP_LOCATOR`)
        .should('contain', `&${tenancyParam}`);
    }
  }

  // Run after copyLinkAndCheck: Kibana 7 shows the embed code one panel up from the permalinks.
  static copyDashboardEmbedCodeAndCheck(tenancy: string) {
    cy.log('Copy the embed code');
    const dashboardUrl = `${requiredBaseUrl()}/s/default/app/dashboards`;
    if (kibanaVersion.gte('8.0.0')) {
      cy.getByDataTestSubj('embed').click();
      cy.getByDataTestSubj('copyEmbedUrlButton').click();
      cy.getValueFromClipboard().should(
        'contain',
        `<iframe src="${dashboardUrl}?${TENANCY_QUERY_STRING_KEY}=${tenancy}#/view/`
      );
    } else {
      cy.getByDataTestSubj('contextMenuPanelTitleButton').click();
      cy.getByDataTestSubj('sharePanel-Embedcode').click();
      cy.getByDataTestSubj('copyShareUrlButton').click();
      cy.getValueFromClipboard().should(
        'contain',
        `<iframe src="${dashboardUrl}?embed=true&amp;${TENANCY_QUERY_STRING_KEY}=${tenancy}`
      );
    }
  }
}
