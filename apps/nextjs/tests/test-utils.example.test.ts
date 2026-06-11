/**
 * Example test file demonstrating how to use @pasosdejesus/m test-utils
 *
 * This file shows practical examples of mocking different parts of a Next.js + Hardhat application.
 * Include it in your project as a reference when writing tests.
 *
 * "Y todo lo que hagáis, hacedlo de corazón, como para el Señor y no para los hombres" (Colosenses 3:23)
 */

import { describe, it, expect, beforeEach, beforeAll, afterAll, vi } from 'vitest';
import { createFsMocks } from '@pasosdejesus/m/test-utils/fs-mocks';
import { createMockKysely } from '@pasosdejesus/m/test-utils/kysely-mocks';
import { createAuthMocks } from '@pasosdejesus/m/test-utils/rainbowkit-mocks';
import { viemMocks } from '@pasosdejesus/m/test-utils/viem-mocks';
// radix-mocks is a side-effect import that mocks radix-ui components globally
import '@pasosdejesus/m/test-utils/radix-mocks';

describe('Example: Using test-utils in your project', () => {
  // Example 1: Mocking filesystem operations
  describe('fs-mocks: Mocking filesystem', () => {
    let fsMocks;

    beforeAll(() => {
      fsMocks = createFsMocks();
      fsMocks.setupFsMocks();
    });

    afterAll(() => {
      vi.clearAllMocks();
    });

    it('should mock readFile operations', () => {
      // Setup mock to return specific content
      fsMocks.mockReadFile.mockResolvedValue('{"data": "test"}');

      // In your actual code, this would be called by the function you're testing
      // Example: await readFile('/config.json', 'utf-8')
      // The mock will return the content we set above
      expect(fsMocks.mockReadFile).toBeDefined();
    });

    it('should mock readFile with custom content', () => {
      const customFsMocks = createFsMocks({
        readFileContent: '# Custom content',
      });
      // The mock is already configured with the custom content
      expect(customFsMocks.mockReadFile).toBeDefined();
    });
  });

  // Example 2: Mocking database operations with Kysely
  describe('kysely-mocks: Mocking database queries', () => {
    let dbMocks;

    beforeAll(() => {
      dbMocks = createMockKysely();
      dbMocks.setupMocks();
      dbMocks.setupCommonResponses();
    });

    it('should mock SELECT queries', () => {
      // Configure mock to return specific data
      dbMocks.mockExecuteTakeFirst.mockResolvedValue({ id: 1, name: 'John' });

      // In your actual code, when a Kysely query executes, it will use the mock
      // Example: await db.selectFrom('users').selectAll().executeTakeFirst()
      // The mock will return { id: 1, name: 'John' }
      expect(dbMocks.mockExecuteTakeFirst).toBeDefined();
    });

    it('should mock INSERT queries', () => {
      dbMocks.mockExecute.mockResolvedValue([{ id: 3, name: 'Bob' }]);
      expect(dbMocks.mockExecute).toBeDefined();
    });
  });

  // Example 3: Mocking authentication and wallet state
  describe('rainbowkit-mocks: Mocking authentication', () => {
    let authMocks;

    beforeAll(() => {
      authMocks = createAuthMocks({
        address: '0x1234567890123456789012345678901234567890',
        isConnected: true,
        chainId: 1,
      });
      authMocks.setupMocks();
      authMocks.setupDefaultImplementations();
    });

    it('should mock useAccount hook', () => {
      // The mock is already configured with the address above
      // In your React component test, useAccount() will return the mocked data
      expect(authMocks.mocks.mockUseAccount).toBeDefined();
    });

    it('should mock useSession hook', () => {
      expect(authMocks.mocks.mockUseSession).toBeDefined();
    });

    it('should update configuration dynamically', () => {
      authMocks.updateConfig({ isConnected: false });
      // Now useAccount() will return isConnected: false
      expect(authMocks.updateConfig).toBeDefined();
    });
  });

  // Example 4: Mocking blockchain interactions
  describe('viem-mocks: Mocking blockchain', () => {
    beforeAll(() => {
      // viemMocks are already defined, no setup needed
    });

    it('should mock public client', () => {
      // Configure the mock
      viemMocks.createPublicClient.mockReturnValue({
        getBlockNumber: vi.fn().mockResolvedValue(123456n),
      });

      const client = viemMocks.createPublicClient();
      expect(client.getBlockNumber).toBeDefined();
      expect(viemMocks.createPublicClient).toHaveBeenCalled();
    });

    it('should mock wallet client', () => {
      viemMocks.createWalletClient.mockReturnValue({
        sendTransaction: vi.fn().mockResolvedValue('0xabc...'),
      });

      const client = viemMocks.createWalletClient();
      expect(client.sendTransaction).toBeDefined();
    });
  });

  // Example 5: Cleanup and teardown
  describe('Setup and teardown patterns', () => {
    let fsMocks;

    beforeEach(() => {
      fsMocks = createFsMocks();
      fsMocks.setupFsMocks();
    });

    afterEach(() => {
      vi.clearAllMocks();
    });

    it('should demonstrate proper mock cleanup', () => {
      fsMocks.mockReadFile.mockResolvedValue('test');
      // Test that mock can be called
      expect(fsMocks.mockReadFile).toBeDefined();
    });
  });
});

// Helper: TypeScript types for the mocks (for reference)
/**
 * Type imports for reference (not executed):
 *
 * import type {
 *   FsMocks,
 *   MockKysely,
 *   AuthMocks,
 *   ViemMocks
 * } from '@pasosdejesus/m/test-utils';
 *
 * These types are automatically available when you import the mocks.
 */