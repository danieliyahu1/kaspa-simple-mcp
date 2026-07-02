const BASE_URL = "https://api.kaspa.org";
const TIMEOUT_MS = 10_000;

export interface BalanceResponse {
  balance: number;
}

export interface TransactionOutput {
  amount: number;
  script_public_key_address: string;
}

export interface TransactionResponse {
  transaction_id: string;
  is_accepted: boolean;
  block_time?: number;
  outputs: TransactionOutput[];
}

export interface OutpointModel {
  transactionId: string;
  index: number;
}

export interface UtxoModel {
  amount: string;
  blockDaaScore: string;
  isCoinbase: boolean;
}

export interface UtxoResponse {
  address?: string;
  outpoint: OutpointModel;
  utxoEntry: UtxoModel;
}

export interface FeeEstimateResponse {
  priorityBucket: {
    feerate: number;
  };
}

export interface TransactionCount {
  total: number;
}

export interface UtxoCountResponse {
  count: number;
}

export interface BalancesByAddressEntry {
  address: string;
  balance: number;
}

export interface TxOutput {
  transaction_id: string;
  index: number;
  amount: number;
  script_public_key_address: string;
  script_public_key_type: string;
}

export interface TxModelResponse {
  transaction_id: string;
  hash: string;
  is_accepted: boolean;
  block_time?: number;
  outputs: TxOutput[];
  mass?: string;
  version?: number;
  accepting_block_blue_score?: number;
  accepting_block_time?: number;
}

export interface AddressBalanceHistoryEntry {
  timestamp: number;
  amount: number;
}

export interface AddressesActiveResponse {
  address: string;
  active: boolean;
  lastTxBlockTime?: number;
}

export interface TransactionsPageResponse {
  transactions: TxModelResponse[];
  nextBefore?: string;
  nextAfter?: string;
}

export class KaspaClientError extends Error {
  constructor(
    message: string,
    public statusCode?: number,
  ) {
    super(message);
    this.name = "KaspaClientError";
  }
}

async function postJson<T>(path: string, body: unknown): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const response = await fetch(`${BASE_URL}${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: controller.signal,
    });

    if (!response.ok) {
      throw new KaspaClientError(
        `Kaspa API error: ${response.status} ${response.statusText}`,
        response.status,
      );
    }

    return (await response.json()) as T;
  } catch (err) {
    if (err instanceof KaspaClientError) throw err;
    if (err instanceof DOMException && err.name === "AbortError") {
      throw new KaspaClientError("Kaspa API request timed out");
    }
    throw new KaspaClientError(
      err instanceof Error ? err.message : "Unknown network error",
    );
  } finally {
    clearTimeout(timer);
  }
}

async function fetchJson<T>(path: string): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const response = await fetch(`${BASE_URL}${path}`, {
      signal: controller.signal,
    });

    if (!response.ok) {
      throw new KaspaClientError(
        `Kaspa API error: ${response.status} ${response.statusText}`,
        response.status,
      );
    }

    return (await response.json()) as T;
  } catch (err) {
    if (err instanceof KaspaClientError) throw err;
    if (err instanceof DOMException && err.name === "AbortError") {
      throw new KaspaClientError("Kaspa API request timed out");
    }
    throw new KaspaClientError(
      err instanceof Error ? err.message : "Unknown network error",
    );
  } finally {
    clearTimeout(timer);
  }
}

export async function getBalance(address: string): Promise<BalanceResponse> {
  return fetchJson<BalanceResponse>(`/addresses/${address}/balance`);
}

export async function getTransaction(txId: string): Promise<TransactionResponse> {
  return fetchJson<TransactionResponse>(
    `/transactions/${txId}?inputs=false&outputs=true`,
  );
}

export async function getFeeEstimate(): Promise<FeeEstimateResponse> {
  return fetchJson<FeeEstimateResponse>("/info/fee-estimate");
}

export async function getAddressUtxos(address: string): Promise<UtxoResponse[]> {
  return fetchJson<UtxoResponse[]>(`/addresses/${address}/utxos`);
}

export async function getAddressTransactions(
  address: string,
  limit = 50,
  offset = 0,
): Promise<TxModelResponse[]> {
  return fetchJson<TxModelResponse[]>(
    `/addresses/${address}/full-transactions?limit=${limit}&offset=${offset}`,
  );
}

export async function getAddressTransactionCount(
  address: string,
): Promise<TransactionCount> {
  return fetchJson<TransactionCount>(`/addresses/${address}/transactions-count`);
}

export async function getAddressUtxoCount(
  address: string,
): Promise<UtxoCountResponse> {
  return fetchJson<UtxoCountResponse>(`/addresses/${address}/utxos/count`);
}

export async function getBalancesBatch(
  addresses: string[],
): Promise<BalancesByAddressEntry[]> {
  return postJson<BalancesByAddressEntry[]>("/addresses/balances", { addresses });
}

export async function getAddressBalanceHistory(
  address: string,
  dayOrMonth: string,
): Promise<AddressBalanceHistoryEntry[]> {
  return fetchJson<AddressBalanceHistoryEntry[]>(
    `/addresses/${address}/balance/${dayOrMonth}`,
  );
}

export async function getUtxosBatch(
  addresses: string[],
): Promise<UtxoResponse[]> {
  return postJson<UtxoResponse[]>("/addresses/utxos", { addresses });
}

export async function getAddressTransactionsPage(
  address: string,
  limit = 50,
  before = 0,
  after = 0,
): Promise<TransactionsPageResponse> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    let path = `/addresses/${address}/full-transactions-page?limit=${limit}`;
    if (before > 0) path += `&before=${before}`;
    if (after > 0) path += `&after=${after}`;

    const response = await fetch(`${BASE_URL}${path}`, {
      signal: controller.signal,
    });

    if (!response.ok) {
      throw new KaspaClientError(
        `Kaspa API error: ${response.status} ${response.statusText}`,
        response.status,
      );
    }

    const transactions = (await response.json()) as TxModelResponse[];
    const nextBefore = response.headers.get("X-Next-Page-Before");
    const nextAfter = response.headers.get("X-Next-Page-After");

    return { transactions, nextBefore: nextBefore ?? undefined, nextAfter: nextAfter ?? undefined };
  } catch (err) {
    if (err instanceof KaspaClientError) throw err;
    if (err instanceof DOMException && err.name === "AbortError") {
      throw new KaspaClientError("Kaspa API request timed out");
    }
    throw new KaspaClientError(
      err instanceof Error ? err.message : "Unknown network error",
    );
  } finally {
    clearTimeout(timer);
  }
}

export async function getAddressesActive(
  addresses: string[],
): Promise<AddressesActiveResponse[]> {
  return postJson<AddressesActiveResponse[]>("/addresses/active", { addresses });
}

// --- Low-priority address tools ---

export interface AddressNameResponse {
  name: string;
}

export async function getAddressName(address: string): Promise<AddressNameResponse | null> {
  try {
    return await fetchJson<AddressNameResponse>(`/addresses/${address}/name`);
  } catch (err) {
    if (err instanceof KaspaClientError && err.statusCode === 404) {
      return null;
    }
    throw err;
  }
}

export interface TopAddressEntry {
  rank: number;
  address: string;
  amount: number;
}

export interface TopAddressesResponse {
  timestamp: number;
  ranking: TopAddressEntry[];
}

export async function getTopAddresses(): Promise<TopAddressesResponse[]> {
  return fetchJson<TopAddressesResponse[]>("/addresses/top");
}

export interface DistributionTier {
  tier: number;
  count: number;
  amount: number;
}

export interface AddressDistributionResponse {
  timestamp: number;
  tiers: DistributionTier[];
}

export async function getAddressDistribution(): Promise<AddressDistributionResponse[]> {
  return fetchJson<AddressDistributionResponse[]>("/addresses/distribution");
}

export interface ActiveAddressesCountResponse {
  timestamp: number;
  dateTime: string;
  count: number;
}

export async function getActiveAddressesCount(): Promise<ActiveAddressesCountResponse> {
  return fetchJson<ActiveAddressesCountResponse>("/addresses/active/count/");
}

export interface ActiveAddressesCountHistoryEntry {
  timestamp: number;
  dateTime: string;
  count: number;
}

export async function getActiveAddressesCountHistory(
  dayOrMonth: string,
): Promise<ActiveAddressesCountHistoryEntry[]> {
  return fetchJson<ActiveAddressesCountHistoryEntry[]>(
    `/addresses/active/count/${dayOrMonth}`,
  );
}

export interface AddressNameEntry {
  address: string;
  name: string;
}

export async function getAddressNames(): Promise<AddressNameEntry[]> {
  return fetchJson<AddressNameEntry[]>("/addresses/names");
}
