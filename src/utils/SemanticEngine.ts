class SemanticEngine {
  private static instance: SemanticEngine;

  public static getInstance(): SemanticEngine {
    if (!SemanticEngine.instance) {
      SemanticEngine.instance = new SemanticEngine();
    }
    return SemanticEngine.instance;
  }

  public async init() {
    console.log('Semantic Engine neutralized.');
  }

  public isModelReady() {
    return false;
  }

  public async detectIntent(userInput: string): Promise<{ intent: string; score: number } | null> {
    return null;
  }
}

export default SemanticEngine.getInstance();