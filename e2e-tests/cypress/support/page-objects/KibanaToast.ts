export class KibanaToast {
  public static closeToastMessage() {
    cy.log('Close toast message');
    cy.getByDataTestSubj('toastCloseButton').click();
  }
}
