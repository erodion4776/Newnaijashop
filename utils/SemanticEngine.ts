
import { pipeline, Pipeline, env } from '@xenova/transformers';

env.allowLocalModels = false;
env.useBrowserCache = true;
env.remoteHost = 'https://huggingface.co';
env.remotePathTemplate = '{model}/resolve/{revision}/';

/**
 * Semantic Engine using Xenova/all-MiniLM-L6-v2
 * Runs entirely in the browser for offline intelligence.
 */
class SemanticEngine {
  private static instance: SemanticEngine;
  private extractor: Pipeline | null = null;
  private isInitializing = false;
  private isLoaded = false;

  // Semantic Anchors for high-intent matching
  private anchors = {
    'PricingDetails': [
      'How much does it cost?',
      'What are your subscription plans?',
      'Tell me about the price',
      'How to pay for the license?',
      'Payment details and costs'
    ],
    'Theft': [
      'Can staff steal money?',
      'Security features for my shop',
      'Audit logs for staff fraud',
      'How to stop missing money',
      'Monitor employees and stock'
    ],
    'Data': [
      'Does it work without data?',
      'Is internet required to sell?',
      'No internet connection usage',
      'Offline mode capabilities',
      'Does it use many megabytes?'
    ],
    'Scanner': [
      'How to scan my notebooks',
      'AI stock entry from paper',
      'Handwriting recognition for inventory',
      'Input products with camera',
      'Stock taking using phone camera'
    ]
  };

  private anchorEmbeddings: Record<string, number[][]> = {};

  public static getInstance(): SemanticEngine {
    if (!SemanticEngine.instance) {
      SemanticEngine.instance = new SemanticEngine();
    }
    return SemanticEngine.instance;
  }

  public async init() {
    if (this.isLoaded || this.isInitializing) return;
    this.isInitializing = true;
    
    try {
      console.log('🧠 Loading Local Brain (Transformers.js)...');

      // Load the feature extraction pipeline
      this.extractor = await pipeline('feature-extraction', 'Xenova/all-MiniLM-L6-v2');
      
      // Pre-compute anchor embeddings
      for (const [intent, phrases] of Object.entries(this.anchors)) {
        this.anchorEmbeddings[intent] = await Promise.all(
          phrases.map(phrase => this.getEmbedding(phrase))
        );
      }

      this.isLoaded = true;
      console.log('🧠 Semantic Brain Loaded Successfully.');
    } catch (err) {
      console.error('Failed to load semantic engine:', err);
    } finally {
      this.isInitializing = false;
    }
  }

  public isModelReady() {
    return this.isLoaded;
  }

  private async getEmbedding(text: string): Promise<number[]> {
    if (!this.extractor) throw new Error('Semantic Engine not initialized');
    try {
      const output = await this.extractor(text, { pooling: 'mean', normalize: true });
      return Array.from(output.data);
    } catch (err) {
      console.error('Error generating embedding:', err);
      throw err;
    }
  }

  private cosineSimilarity(vecA: number[], vecB: number[]): number {
    let dotProduct = 0;
    let normA = 0;
    let normB = 0;
    for (let i = 0; i < vecA.length; i++) {
      dotProduct += vecA[i] * vecB[i];
      normA += vecA[i] * vecA[i];
      normB += vecB[i] * vecB[i];
    }
    const similarity = dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
    return isNaN(similarity) ? 0 : similarity;
  }

  public async detectIntent(userInput: string): Promise<{ intent: string; score: number } | null> {
    if (!this.isLoaded) return null;

    try {
      const userEmbedding = await this.getEmbedding(userInput);
      let bestIntent = '';
      let bestScore = 0;

      for (const [intent, embeddings] of Object.entries(this.anchorEmbeddings)) {
        for (const anchorVec of embeddings) {
          const similarity = this.cosineSimilarity(userEmbedding, anchorVec);
          if (similarity > bestScore) {
            bestScore = similarity;
            bestIntent = intent;
          }
        }
      }

      return { intent: bestIntent, score: bestScore };
    } catch (err) {
      console.error('Semantic inference error:', err);
      return null;
    }
  }
}

export default SemanticEngine.getInstance();
