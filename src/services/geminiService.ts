
import { Product, Sale } from "../types";

export class RateLimitError extends Error {
  constructor(message: string = "AI service temporarily unavailable") {
    super(message);
    this.name = "RateLimitError";
  }
}

export const getAIInsights = async (sales: Sale[], products: Product[]) => {
  console.warn("AI Insights service is currently disabled.");
  return null;
};

export const processHandwrittenLedger = async (base64Image: string) => {
  console.warn("AI Ledger processing is currently disabled.");
  return null;
};
