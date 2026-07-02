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

export class KaspaClientError extends Error {
  constructor(
    message: string,
    public statusCode?: number,
  ) {
    super(message);
    this.name = "KaspaClientError";
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
