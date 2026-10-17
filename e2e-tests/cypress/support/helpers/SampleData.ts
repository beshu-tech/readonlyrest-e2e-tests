import { esApiClient } from './EsApiClient';

export class SampleData {
  static createSampleData = (index: string) => {
    esApiClient.addDocument(index, '1', {
      name: 'Jane Smith',
      age: 25,
      occupation: 'Designer',
      '@timestamp': new Date().toISOString()
    });
  };
}
