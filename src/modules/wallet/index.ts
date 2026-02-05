/**
 * Wallet Module - Main Export
 */

// Legacy single-collection model (kept for backwards compatibility)
export { Transaction } from './transaction.model.js';
export type { ITransaction, ITransactionDocument, WalletTransactionType, CreditSource, TransactionStatus } from './transaction.model.js';

// Monthly transaction utilities (recommended for new code)
export {
  getMonthlyCollectionName,
  getMonthlyTransactionModel,
  getCurrentTransactionModel,
  createTransaction,
  queryTransactions,
  getUserTransactions,
  getOrderTransactions,
  calculateUserBalanceFromTransactions,
  getExistingTransactionCollections,
  migrateExistingTransactions,
} from './monthly-transaction.util.js';
export type { CreateTransactionData, TransactionQueryOptions } from './monthly-transaction.util.js';

export { walletService, WalletError } from './wallet.service.js';
export type { TransactionFilters, AccountantTransactionFilters, TransactionResult, PaginatedTransactions } from './wallet.service.js';

export { walletController } from './wallet.controller.js';

export { creditSchema, debitSchema, transactionFiltersSchema, accountantTransactionFiltersSchema } from './wallet.validation.js';
export type { CreditInput, DebitInput } from './wallet.validation.js';

export { default as walletRoutes } from './wallet.routes.js';
