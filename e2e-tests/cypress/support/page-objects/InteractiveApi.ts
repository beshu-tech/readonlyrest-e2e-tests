import { SecuritySettings } from './SecuritySettings';

export class InteractiveApi {
  static open() {
    SecuritySettings.openTab('interactive_api');
  }
}
