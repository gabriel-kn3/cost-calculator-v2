/**
 * The datastore abstraction.
 *
 * Mirrors the pattern the Python backend already used
 * (hmbb-backend/models/base.py: get_backend_repo(supabase_cls, local_cls)),
 * but typed. SQLite is the default; Supabase satisfies the same interface.
 *
 * Rules that keep both backends honestly interchangeable:
 *   - IDs are app-minted strings, never database-generated.
 *   - Timestamps are ISO-8601 UTC strings, set here, never by the client.
 *   - Methods return DOMAIN objects, never driver rows.
 *   - Operations are intention-shaped rather than chatty CRUD, so the same
 *     surface can later be exposed as agent tools without rewriting handlers.
 *
 * One shared contract test suite runs against every implementation, so the
 * Supabase adapter cannot silently drift out of date.
 */
import type {
  Material, MaterialInput, Product, ProductInput, Settings, FeeRecord,
} from "../../shared/types.js";

export interface BulkResult {
  created: number;
  updated: number;
  deleted: number;
}

export interface MaterialsRepo {
  list(): Promise<Material[]>;
  get(id: string): Promise<Material | null>;
  create(input: MaterialInput): Promise<Material>;
  update(id: string, patch: Partial<MaterialInput>): Promise<Material | null>;
  /** Resolves false when the id did not exist, so routes can 404 honestly. */
  delete(id: string): Promise<boolean>;
  /** Materials whose name carries the "*" convention. */
  listCommon(): Promise<Material[]>;
  /**
   * Transactional replace-all, backing Import. v2 emulated this with an N+1
   * loop of sequential DELETE/PUT/POST that could half-apply on failure.
   */
  replaceAll(items: MaterialInput[]): Promise<BulkResult>;
}

export interface ProductsRepo {
  list(): Promise<Product[]>;
  get(id: string): Promise<Product | null>;
  create(input: ProductInput): Promise<Product>;
  update(id: string, patch: Partial<ProductInput>): Promise<Product | null>;
  delete(id: string): Promise<boolean>;
  /** Honours the normalised-name uniqueness rule ported from v2. */
  upsertByName(input: ProductInput): Promise<Product>;
  replaceAll(items: ProductInput[]): Promise<BulkResult>;
}

export interface SettingsRepo {
  get(): Promise<Settings>;
  update(patch: Partial<Settings>): Promise<Settings>;
  listFees(): Promise<FeeRecord[]>;
  saveFee(fee: Partial<FeeRecord> & { label: string }): Promise<FeeRecord>;
  deleteFee(id: string): Promise<boolean>;
}

export interface BackupBundle {
  kind: "backup";
  version: 1;
  exported_at: string;
  materials: unknown[];
  products: unknown[];
  /** BOM rows. Without these a restore silently loses every line item. */
  product_materials: unknown[];
  settings: unknown;
  fees: unknown[];
}

export interface BackupRepo {
  dump(): Promise<BackupBundle>;
  restore(bundle: BackupBundle): Promise<{ materials: number; products: number }>;
}

export interface DataStore {
  readonly mode: "sqlite" | "supabase";
  materials: MaterialsRepo;
  products: ProductsRepo;
  settings: SettingsRepo;
  backup: BackupRepo;
  health(): Promise<{ ok: boolean; latencyMs: number }>;
  close(): Promise<void>;
}
