export type ModelKey = `${string}:${string}`;

export class MonacoService {
  private readonly models = new Map<ModelKey, { dispose: () => void }>();

  register(key: ModelKey, model: { dispose: () => void }) { this.models.set(key, model); return model; }
  dispose(key: ModelKey) { const model = this.models.get(key); model?.dispose(); this.models.delete(key); }
  has(key: ModelKey) { return this.models.has(key); }
}
