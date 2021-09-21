import { Client, ResultIterator } from "ts-postgres";
import { SkvConfig, SkvInitOptions } from "./typings";
import { BASE64_PREFIX } from "./util.js";

export class Skv {
  private options: SkvConfig;
  private dbClient: Client;
  constructor(options: SkvInitOptions) {
    this.options = {
      dbConfig: options.dbConfig,
      tableName: options.tableName ?? "skv",
      prefix: options.prefix ?? "skv",
    };
    this.dbClient = new Client(this.options.dbConfig);
  }

  async connect() {
    await this.dbClient.connect();
    await this.dbClient.query(
      `CREATE TABLE IF NOT EXISTS ${this.options.tableName} (
      key VARCHAR(255) PRIMARY KEY NOT NULL,
      value TEXT
    )`
    );
  }
  /**
   * Serializes a data before putting in the DB
   */
  serialize(data: unknown): string {
    if (Buffer.isBuffer(data)) {
      return JSON.stringify(`${BASE64_PREFIX}${data.toString("base64")}`);
    } else {
      return JSON.stringify(data);
    }
  }
  /**
   * Deserializes data
   */
  deserialize(json: string): unknown {
    const raw = JSON.parse(json);
    if (new RegExp(`^${BASE64_PREFIX}`).test(raw)) {
      return Buffer.from(raw.substring(BASE64_PREFIX.length), "base64");
    } else {
      return raw;
    }
  }

  /**
   * Set KEY = VALUE in the database
   */
  async set(key: string, value: unknown): Promise<ResultIterator> {
    // Transform data into JSON
    const serialized = this.serialize(value);
    return this.dbClient.query(
      `INSERT INTO ${this.options.tableName} (key, value) VALUES ($1, $2) ON CONFLICT (key) DO UPDATE SET value = $2`,
      [key, serialized]
    );
  }
}
