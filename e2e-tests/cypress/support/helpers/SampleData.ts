import { SmartEsClient } from "./SmartEsClient"

export class SampleData {

  static createSampleData = (index: string, docsCount: number) => {
    for (let i = 1; i <= docsCount; i++) {
      SmartEsClient.addDocument(
        index, 
        i.toString(), 
        {
          name: 'Jane Smith',
          age: 25,
          occupation: 'Designer',
          '@timestamp': new Date().toISOString()
        }
      ); 
    }
  }
}