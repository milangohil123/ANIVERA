/**
 * Ambient type declarations for Dexie.js.
 */
declare module 'dexie' {
  export interface Collection<T = any, TKey = any> {
    toArray(): Promise<T[]>;
    filter(fn: (item: T) => boolean): Collection<T, TKey>;
    sortBy(keyPath: string): Promise<T[]>;
    primaryKeys(): Promise<TKey[]>;
    modify(changes: Partial<T> | ((item: T) => void)): Promise<number>;
    delete(): Promise<number>;
    count(): Promise<number>;
    first(): Promise<T | undefined>;
    last(): Promise<T | undefined>;
  }

  export interface WhereClause<T = any, TKey = any> {
    equals(value: any): Collection<T, TKey>;
    anyOf(...values: any[]): Collection<T, TKey>;
    anyOf(values: any[]): Collection<T, TKey>;
    anyOfIgnoreCase(...values: string[]): Collection<T, TKey>;
    anyOfIgnoreCase(values: string[]): Collection<T, TKey>;
    above(value: any): Collection<T, TKey>;
    aboveOrEqual(value: any): Collection<T, TKey>;
    below(value: any): Collection<T, TKey>;
    belowOrEqual(value: any): Collection<T, TKey>;
    between(lower: any, upper: any, includeLower?: boolean, includeUpper?: boolean): Collection<T, TKey>;
    startsWith(prefix: string): Collection<T, TKey>;
    startsWithIgnoreCase(prefix: string): Collection<T, TKey>;
    noneOf(...values: any[]): Collection<T, TKey>;
    noneOf(values: any[]): Collection<T, TKey>;
    notEqual(value: any): Collection<T, TKey>;
  }

  export interface Table<T = any, TKey = any> {
    get(key: TKey): Promise<T | undefined>;
    where(index: string): WhereClause<T, TKey>;
    filter(fn: (item: T) => boolean): Collection<T, TKey>;
    add(item: T, key?: TKey): Promise<TKey>;
    put(item: T, key?: TKey): Promise<TKey>;
    update(key: TKey, changes: Partial<T>): Promise<number>;
    delete(key: TKey): Promise<void>;
    bulkAdd(items: T[], keys?: TKey[]): Promise<TKey>;
    bulkPut(items: T[], keys?: TKey[]): Promise<TKey>;
    bulkDelete(keys: TKey[]): Promise<void>;
    toArray(): Promise<T[]>;
    clear(): Promise<void>;
    count(): Promise<number>;
    toCollection(): Collection<T, TKey>;
  }

  export interface Version {
    stores(schema: Record<string, string>): Version;
    upgrade(fn: (trans: any) => Promise<any> | void): Version;
  }

  export class Dexie {
    constructor(databaseName: string);
    version(versionNumber: number): Version;
    table<T = any, TKey = any>(tableName: string): Table<T, TKey>;
    open(): Promise<Dexie>;
    close(): void;
  }

  export default Dexie;
}
