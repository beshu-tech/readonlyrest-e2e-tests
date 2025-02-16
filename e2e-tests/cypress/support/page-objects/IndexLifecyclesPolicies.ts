import { KibanaNavigation } from './KibanaNavigation';

export class IndexLifecyclesPolicies {
  static openIndexLifecyclePolicy() {
    cy.log('open index lifecycle policy page');
    KibanaNavigation.openKibanaNavigation();
    KibanaNavigation.openPage('Stack Management');
    KibanaNavigation.openSubPage('Index Lifecycle Policies');
  }

  static verifyIndexLifecyclePolicy() {
    cy.log('verify index lifecycle policy');
    cy.get('[data-test-subj="policyTableRow-kibana-reporting"]')
      .find('[data-test-subj="viewIndexTemplates"]')
      .contains(1);
    cy.get('[data-test-subj="policyTableRow-kibana-reporting"]').find('[data-test-subj="policy-indices"]').contains(2);
  }
}
