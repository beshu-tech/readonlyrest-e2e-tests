import semver from 'semver';
import { getKibanaVersion } from '../helpers';

export class SubHeader {
  static readonlyBadgeVisible() {
    cy.log('Read-only badge visible');
    cy.get('[data-test-badge-label="Read only"]').should('be.visible');
  }

  static readonlyDiscoverBadgeVisible() {
    if (semver.gte(getKibanaVersion(), '9.4.0')) {
      cy.log('Discover Read-only badge visible');
      cy.getByDataTestSubj('discover-readonly-badge').should('be.visible');
    } else {
      SubHeader.readonlyBadgeVisible();
    }
  }

  static breadcrumbsLastItem(text: string) {
    cy.get('[data-test-subj="breadcrumb last"]').within(() => {
      cy.findByText(text);
    });
  }
}
