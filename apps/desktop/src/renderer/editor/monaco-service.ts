export type ModelKey = `${string}:${string}`;
export type MonacoModelLike = { dispose(): void; getValue(): string; setValue(value: string): void };

export class MonacoService {
  private readonly models = new Map<ModelKey, MonacoModelLike>();

  register(key: ModelKey, model: MonacoModelLike) { this.models.set(key, model); return model; }
  dispose(key: ModelKey) { const model = this.models.get(key); model?.dispose(); this.models.delete(key); }
  has(key: ModelKey) { return this.models.has(key); }
}
