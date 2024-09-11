import { Login } from '../support/page-objects/Login';
import { InteractiveApi } from '../support/page-objects/InteractiveApi';
import { SecuritySettings } from '../support/page-objects/SecuritySettings';

describe.skip('Interactive API', () => {
  beforeEach(() => {
    Login.initialization();
    InteractiveApi.open();
  });

  it('should be rendered', () => {
    SecuritySettings.getIframeBody().findByText(/readonlyrest api/i);
    SecuritySettings.getIframeBody().find('[class=link]').should('exist').should('not.be.visible');
    SecuritySettings.getIframeBody().find('[class=auth-wrapper]').should('exist').should('not.be.visible');
  });
});
