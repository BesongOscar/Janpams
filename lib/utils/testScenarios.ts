/**
 * Test Scenarios
 * 
 * Predefined test scenarios for manual and automated testing
 */

import { initDB, deleteDB } from '../db/database';
import { SyncManager } from '../syncManager';
import { createAddress } from '../db/addresses';
import { performanceMonitor } from './performanceMonitor';
import type { Address } from '../db/schemas';

export interface TestScenario {
  name: string;
  description: string;
  steps: Array<{
    action: string;
    execute: () => Promise<void> | void;
    expected?: string;
  }>;
}

/**
 * Scenario 1: Online Address Creation
 */
export const onlineAddressCreationScenario: TestScenario = {
  name: 'Online Address Creation',
  description: 'Create an address when device is online',
  steps: [
    {
      action: 'Initialize database',
      execute: async () => {
        await deleteDB();
        await initDB();
        await SyncManager.init();
      },
    },
    {
      action: 'Create address',
      execute: async () => {
        const address: Omit<Address, 'id' | 'local_id' | 'created_at' | 'updated_at'> = {
          house_number: 123,
          street_name: 'Test Street',
          city: 'Test City',
          region: 'Test Region',
          country: 'CM',
          latitude: 4.1594,
          longitude: 9.2356,
          plus_code: 'TEST1234+56',
          property_category: 'residential',
          property_type: 'House',
          status: 'pending',
          sync_status: 'pending',
        };

        await performanceMonitor.measure('create-address-online', async () => {
          await SyncManager.createAddress(address);
        });
      },
      expected: 'Address created with sync_status="pending", should sync automatically',
    },
  ],
};

/**
 * Scenario 2: Offline Address Creation
 */
export const offlineAddressCreationScenario: TestScenario = {
  name: 'Offline Address Creation',
  description: 'Create multiple addresses when device is offline',
  steps: [
    {
      action: 'Initialize database',
      execute: async () => {
        await deleteDB();
        await initDB();
        await SyncManager.init();
      },
    },
    {
      action: 'Create 5 addresses offline',
      execute: async () => {
        for (let i = 1; i <= 5; i++) {
          const address: Omit<Address, 'id' | 'local_id' | 'created_at' | 'updated_at'> = {
            house_number: 100 + i,
            street_name: `Offline Street ${i}`,
            city: 'Offline City',
            region: 'Offline Region',
            country: 'CM',
            latitude: 4.1594 + i * 0.001,
            longitude: 9.2356 + i * 0.001,
            plus_code: `OFFL${i}234+56`,
            property_category: 'residential',
            property_type: 'House',
            status: 'pending',
            sync_status: 'pending',
          };

          await SyncManager.createAddress(address);
        }
      },
      expected: 'All 5 addresses created with sync_status="pending"',
    },
  ],
};

/**
 * Scenario 3: Large Dataset Performance
 */
export const largeDatasetScenario: TestScenario = {
  name: 'Large Dataset Performance',
  description: 'Test performance with large number of addresses',
  steps: [
    {
      action: 'Initialize database',
      execute: async () => {
        await deleteDB();
        await initDB();
        await SyncManager.init();
      },
    },
    {
      action: 'Create 100 addresses',
      execute: async () => {
        await performanceMonitor.measure('create-100-addresses', async () => {
          const promises = [];
          for (let i = 1; i <= 100; i++) {
            const address: Omit<Address, 'id' | 'local_id' | 'created_at' | 'updated_at'> = {
              house_number: i,
              street_name: `Street ${i}`,
              city: 'Test City',
              region: 'Test Region',
              country: 'CM',
              latitude: 4.1594 + (i % 10) * 0.001,
              longitude: 9.2356 + (i % 10) * 0.001,
              plus_code: `LARG${i}234+56`,
              property_category: 'residential',
              property_type: 'House',
              status: 'pending',
              sync_status: 'pending',
            };
            promises.push(SyncManager.createAddress(address));
          }
          await Promise.all(promises);
        });
      },
      expected: '100 addresses created in <10 seconds',
    },
    {
      action: 'Query all addresses',
      execute: async () => {
        await performanceMonitor.measure('query-all-addresses', async () => {
          await SyncManager.getAllAddresses();
        });
      },
      expected: 'Query completes in <500ms',
    },
  ],
};

/**
 * Run a test scenario
 */
export async function runScenario(scenario: TestScenario): Promise<{
  success: boolean;
  errors: string[];
  duration: number;
}> {
  const startTime = Date.now();
  const errors: string[] = [];

  console.log(`\nRunning scenario: ${scenario.name}`);
  console.log(`Description: ${scenario.description}\n`);

  for (let i = 0; i < scenario.steps.length; i++) {
    const step = scenario.steps[i];
    console.log(`Step ${i + 1}: ${step.action}`);

    try {
      await step.execute();
      if (step.expected) {
        console.log(`  Expected: ${step.expected}`);
      }
      console.log('  ✓ Success\n');
    } catch (error: any) {
      const errorMsg = `Step ${i + 1} failed: ${error.message}`;
      errors.push(errorMsg);
      console.log(`  ✗ Error: ${errorMsg}\n`);
    }
  }

  const duration = Date.now() - startTime;
  const success = errors.length === 0;

  console.log(`Scenario ${success ? 'completed' : 'failed'} in ${duration}ms`);
  if (errors.length > 0) {
    console.log('Errors:', errors);
  }

  return { success, errors, duration };
}

/**
 * Run all test scenarios
 */
export async function runAllScenarios(): Promise<void> {
  const scenarios = [
    onlineAddressCreationScenario,
    offlineAddressCreationScenario,
    largeDatasetScenario,
  ];

  console.log('='.repeat(50));
  console.log('Running All Test Scenarios');
  console.log('='.repeat(50));

  for (const scenario of scenarios) {
    await runScenario(scenario);
    console.log('-'.repeat(50));
  }

  // Generate performance report
  console.log('\n' + performanceMonitor.generateReport());
}
