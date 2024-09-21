// invoices.ts

function generateInvoice(id: number): object {
  const month = Math.floor((id - 1) / 31) + 1; // Distribute dates across months
  const day = ((id - 1) % 31) + 1; // Ensure day is within 1-31 range

  // Ensure month and day are within valid ranges
  const validMonth = month > 12 ? 12 : month;
  const validDay = day > 28 ? 28 : day; // Simplified to avoid invalid dates

  return {
    id: id,
    number: `INV${ id.toString().padStart(3, '0') }`,
    date: `2024-${ validMonth.toString().padStart(2, '0') }-${ validDay.toString().padStart(2, '0') }`,
    amount: (Math.random() * 1000).toFixed(2),
    currency: ['USD', 'EUR', 'GBP', 'JPY', 'CAD', 'AUD', 'CHF', 'SEK', 'NZD', 'DKK', 'NOK', 'ZAR', 'BRL', 'INR', 'RUB', 'CNY', 'MXN', 'KRW', 'TRY', 'IDR', 'ARS', 'THB', 'PLN', 'PHP', 'CZK', 'HUF', 'MYR', 'ILS', 'SAR', 'AED', 'COP', 'CLP', 'EGP', 'VND', 'UAH', 'KES', 'NGN', 'PKR'][Math.floor(Math.random() * 37)],
    customerName: `Customer ${ id }`,
    customerEmail: `customer${ id }example.com`,
    status: ['Paid', 'Unpaid', 'Pending'][Math.floor(Math.random() * 3)],
    description: `Invoice for service ${ id }`,
    address: `${ id } Main St, City, Country`,
    phoneNumber: `1-555-${ id.toString().padStart(4, '0') }`,
    taxId: `${ id.toString().padStart(3, '0') }-45-6789`,
    paymentMethod: ['Credit Card', 'Bank Transfer', 'PayPal', 'Cash'][Math.floor(Math.random() * 4)],
    notes: ['Paid in full', 'Awaiting payment', 'Pending approval'][Math.floor(Math.random() * 3)]
  };
}

function generateInvoices(count: number): object[] {
  const invoices = [];
  for (let i = 1; i <= count; i++) {
    invoices.push({create: {}});
    invoices.push(generateInvoice(i));
  }
  return invoices;
}

function chunkArray(array: any[], chunkSize: number): any[][] {
  const chunks = [];
  for (let i = 0; i < array.length; i += chunkSize) {
    chunks.push(array.slice(i, i + chunkSize));
  }
  return chunks;
}

function handleBulkResponse(response: string | undefined): void {
  if (response === undefined) {
    console.error('Response is undefined');
    return;
  }

  try {
    const parsedResponse = JSON.parse(response);
    const items = parsedResponse.items;

    items.forEach((item: any) => {
      const createResult = item.create;
      if (createResult.status === 201) {
        console.log(`Invoice ${createResult._id} created successfully.`);
      } else {
        console.error(`Failed to create invoice ${createResult._id}: ${createResult.error.reason}`);
      }
    });
  } catch (error) {
    console.error('Failed to parse response:', error);
  }
}

function calculateSizeInBytes(object: any): number {
  return Buffer.byteLength(JSON.stringify(object), 'utf8');
}

function checkBulkSizeLimit(invoices: object[], chunkSize: number): void {
  const chunks = chunkArray(invoices, chunkSize);
  const maxSizeInBytes = 100 * 1024 * 1024; // 100 MB

  chunks.forEach((chunk, index) => {
    const chunkSizeInBytes = calculateSizeInBytes(chunk);
    if (chunkSizeInBytes > maxSizeInBytes) {
      console.error(`Chunk ${ index + 1 } exceeds the 100 MB limit with size: ${ chunkSizeInBytes } bytes`);
    } else {
      console.log(`Chunk ${ index + 1 } is within the limit with size: ${ chunkSizeInBytes } bytes`);
    }
  });
}

function checkIndexExists(indexName: string): Cypress.Chainable<boolean> {
  const elasticsearchUrl = Cypress.env('elasticsearchUrl');
  return cy.getRequest({
    url: `${ elasticsearchUrl }/${ indexName }`,
    user: 'kibana:kibana'
  }).then(response => {
    return response.status !== 404;
  });
}

function createIndex(indexName: string): Cypress.Chainable<void> {
  const elasticsearchUrl = Cypress.env('elasticsearchUrl');
  return cy.put({
    url: `${ elasticsearchUrl }/${ indexName }`,
    user: 'kibana:kibana',
    payload: {}
  }).then((response: any) => {
    handleIndexCreationResponse(response);
  });
}

export async function dataPut(count: number, indexName: string, chunkSize: number = 300): Promise<void> {
  chunkSize = chunkSize * 2;
  if (typeof cy.put !== 'function') {
    throw new Error('cy.put is not defined');
  }

  const elasticsearchUrl = Cypress.env('elasticsearchUrl');
  if (!elasticsearchUrl) {
    throw new Error('Cypress.env().elasticsearchUrl is not defined');
  }

  const invoices = generateInvoices(count);
  checkBulkSizeLimit(invoices, chunkSize); // Check size limit
  const chunks = chunkArray(invoices, chunkSize);

  const processChunk = async (chunk: any[], index: number) => {
    return cy.put({
      user: 'kibana:kibana',
      url: `${elasticsearchUrl}/${indexName}/_bulk`,
      payload: chunk // Pass the chunk array directly
    }).then((response: any) => {
      handleBulkResponse(response.stdout);
      if ((index + 1) % 100 === 0) {
        cy.log(`Chunk ${index + 1} processed successfully.`);
      }
    });
  };

  const processChunksInBatches = async (chunks: any[][], batchSize: number) => {
    const threads = 50;
    for (let i = 0; i < chunks.length; i += batchSize * threads) {
      const batch = chunks.slice(i, i + batchSize * threads);
      await Promise.all(batch.map((chunk, index) => processChunk(chunk, i + index)));
    }
  };
  const [indexExists] = await Promise.all([checkIndexExists(indexName)]);
  cy.log(`Index ${indexName} exists: ${indexExists}`);
  if (!indexExists) {
    await createIndex(indexName);
  }

  const startTime = Date.now();
  await processChunksInBatches(chunks, 500);
  const endTime = Date.now();
  const duration = (endTime - startTime) / 1000; // Convert to seconds
  cy.log(`All requests completed in ${duration} seconds.`);
}

function handleIndexCreationResponse(response: any): void {
  if (!response || !response.stdout) {
    console.error('Response or response.stdout is undefined');
    return;
  }

  try {
    const parsedResponse = JSON.parse(response.stdout);
    if (parsedResponse.acknowledged) {
      console.log('Index creation acknowledged.');
    } else {
      console.error('Index creation not acknowledged.');
    }
  } catch (error) {
    console.error('Failed to parse response:', error);
  }
}