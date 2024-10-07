import { RorMenu } from './RorMenu';
import { SecuritySettings } from './SecuritySettings';
import { Loader } from './Loader';
import authMocks from '../../fixtures/authMocks.json';
import { userCredentials } from '../helpers';
import { rorApiClient } from '../helpers/RorApiClient';
import { debug } from 'console';

export class Impersonate {
  static open() {
    cy.log('Open Impersonate');
    RorMenu.openRorMenu();
    RorMenu.openEditSecuritySettings();
    Impersonate.clickImpersonateTab();
  }

  static clickImpersonateTab() {
    cy.log('Click impersonate tab');
    SecuritySettings.getIframeBody().find('[class=euiTabs]').find('#impersonate').click();
  }

  static getServiceByIndex(index: number) {
    cy.log('Get service by index');
    return SecuritySettings.getIframeBody().find('[data-testid=service-item]').eq(index);
  }

  static assertServiceType(index: number, type: string) {
    cy.log('Check service type');
    Impersonate.getServiceByIndex(index).as('service');
    cy.get('@service').contains(type);
  }

  static assertServiceColumns(index: number, columns: string[]) {
    cy.log('Check service columns');
    Impersonate.getServiceByIndex(index).as('service');
    cy.get('@service').find('[class=euiTableHeaderCell]').as('tableColumns');
    const additionalActionColumn = 1;
    cy.get('@tableColumns').should('have.length', columns.length + additionalActionColumn);
    for (const column of columns) {
      cy.get('@tableColumns').contains(column);
    }
  }

  static assertServiceName(index: number, name: string) {
    cy.log('Check service name');
    Impersonate.getServiceByIndex(index).as('service');
    cy.get('@service').contains(name);
  }

  static assertUser(index: number, rowIndex, username: string, groups?: string[], hasImpersonateButton = true) {
    cy.log('Check user');
    Impersonate.getServiceByIndex(index).as('service');
    cy.get('@service').findAllByRole('rowgroup').eq(1).findAllByRole('row').eq(rowIndex).as('rowIndex');
    cy.get('@rowIndex').findByText(username);
    cy.get('@rowIndex')
      .contains('Impersonate')
      .should(hasImpersonateButton ? 'exist' : 'not.exist');

    if (!groups) {
      return;
    }

    if (groups.length > 0) {
      for (const group of groups) {
        cy.get('@rowIndex').contains(group);
      }
    } else {
      cy.get('@rowIndex').contains('-');
    }
  }

  static openConfigureServiceDialog(index) {
    cy.log('Open Configure Service Dialog');
    Impersonate.getServiceByIndex(index).as('service');
    cy.get('@service').contains('Configure').click();
  }

  static openEditAuthMockDialog(index) {
    cy.log('Open Edit Auth mock dialog');
    Impersonate.getServiceByIndex(index).as('service');
    cy.get('@service').find('[data-testid=edit-auth-mock-service-icon]').click({ force: true });
  }

  static addEditMockUser(username: string, groups: string[] = []) {
    cy.log('Fill Edit Mock Service');
    cy.intercept('POST', '/pkp/api/authmock').as('PostAuthMock');
    SecuritySettings.getIframeBody().contains('Add user').click();
    SecuritySettings.getIframeBody().find('[data-testid=confirm-button]').as('confirmButton');
    cy.get('@confirmButton').should('be.disabled');
    SecuritySettings.getIframeBody().find('[data-testid=user-name-field]').last().type(username);

    if (groups.length > 0) {
      SecuritySettings.getIframeBody().find('[data-testid=user-group-field]').last().as('userGroupInput');
      cy.get('@userGroupInput').type(
        groups
          .map(group => `${group}{enter}`)
          .join(', ')
          .replace(',', '')
      );
    }
  }

  static saveEditMockUsers() {
    cy.intercept('POST', '/pkp/api/test/authmock').as('authMockSave');
    cy.get('@confirmButton').should('not.be.disabled');
    cy.get('@confirmButton').click();
    cy.wait('@authMockSave');
  }

  static backFromInitializeTestSettings() {
    cy.log('Back from initialize Test ACL');
    SecuritySettings.getIframeBody().contains('Back').click();
  }

  static initializeTestSettings() {
    cy.log('Initialize Test ACL');
    SecuritySettings.getIframeBody().find('[data-testid=confirm-button]').click();
  }

  static checkIfExpiredModal() {
    cy.log('Check if expired modal');
    SecuritySettings.getIframeBody().contains('Test ACL expired').click();
  }

  static backFromExpiredTestSettings() {
    cy.log('Back from initialize Test ACL');
    SecuritySettings.getIframeBody().contains('Back').click();
  }

  static reactivateOldTestSettings() {
    cy.log('Reactivate old Test ACL');
    SecuritySettings.getIframeBody().contains('Reactivate old Test ACL').click();
  }

  static startOverFromCurrentSettings() {
    cy.log('Start over from current settings');
    SecuritySettings.getIframeBody().find('[data-testid=confirm-button]').click();
  }

  static openImpersonateDialog() {
    cy.log('Open impersonate dialog');
    SecuritySettings.getIframeBody().findByTestId('impersonate-button').click();
  }

  static freeTypeImpersonateUser(username) {
    cy.log('Free type impersonate user');
    Impersonate.openImpersonateDialog();
    SecuritySettings.getIframeBody().find('[data-testid=confirm-button]').as('confirm-button');
    cy.get('@confirm-button').should('be.disabled');
    SecuritySettings.getIframeBody().find('[data-testid=name-field]').type(username);
    cy.get('@confirm-button').click();
    Impersonate.verifyImpersonation(username);
  }

  static impersonateUserFromTheList(index: number, rowIndex: number, username: string) {
    cy.log('impersonation user from the list');
    Impersonate.getServiceByIndex(index).as('service');
    cy.get('@service').find('[class=euiTableRow]').eq(rowIndex).as('rowIndex');
    cy.get('@rowIndex').contains('Impersonate').click();
    Impersonate.verifyImpersonation(username);
  }

  static verifyImpersonation(username: string) {
    cy.log('verify impersonation');
    Loader.loading();
    RorMenu.openRorMenu();
    cy.get('[data-testid=identity-impersonating]').contains(username);
    cy.get('[data-testid=automatically-deactivate]').should('be.visible');
    RorMenu.closeRorMenu();
  }

  static finishImpersonation() {
    cy.log('finish impersonation');
    RorMenu.openRorMenu();
    cy.contains('Finish impersonation').click();
    Loader.loading();
    RorMenu.openRorMenu();
    cy.get('[data-testid=identity-logged-in-as]').contains('admin');
    cy.get('[data-testid=identity-impersonating]').should('not.exist');
    cy.get('[data-testid=automatically-deactivate]').should('not.exist');
  }

  static setTestSettingsData(): Cypress.Chainable<void> {
    cy.log('Initialize Test ACL data');
    rorApiClient.configureRorIndexTestSettings('testSettings.yaml', 30 * 60);
    return rorApiClient.configureRorAuthMockSettings('authMocks.json');
  }
}
