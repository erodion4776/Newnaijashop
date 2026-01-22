
import { GoogleGenAI, Type } from "@google/genai";
import { Product, Sale } from "../types";

const MODEL_NAME = 'gemini-3-flash-preview';

/**
 * Custom error class for rate limiting to provide specific UI feedback
 */
export class RateLimitError extends Error {
  constructor(message: string = "AI is busy. Please wait 60 seconds and try again.") {
    super(message);
    this.name = "RateLimitError";
  }
}

const handleGenAIError = (error: any) => {
  console.error("GenAI Error:", error);
  const errorMessage = error?.message || "";
  if (errorMessage.includes("429") || errorMessage.toLowerCase().includes("too many requests")) {
    throw new RateLimitError();
  }
  throw error;
};

export const getAIInsights = async (sales: Sale[], products: Product[]) => {
  if (!process.env.API_KEY) {
    console.error('API Key is missing from Environment Variables');
    return null;
  }

  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  
  const contents = `
    Analyze this store data:
    Products: ${JSON.stringify(products.map(p => ({ name: p.name, stock: p.stock_qty, price: p.price })))}
    Recent Sales: ${JSON.stringify(sales.slice(-20).map(s => ({ total: s.total_amount, date: new Date(s.timestamp).toLocaleDateString() })))}
  `;

  try {
    const response = await ai.models.generateContent({
      model: MODEL_NAME,
      contents: contents,
      config: {
        systemInstruction: "Act as 'NaijaShop Guru'. Provide 3 direct, actionable retail insights for a Nigerian trader. Be brief. Use JSON format.",
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            insights: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  title: { type: Type.STRING },
                  description: { type: Type.STRING },
                  priority: { type: Type.STRING }
                },
                required: ['title', 'description', 'priority']
              }
            }
          }
        }
      }
    });

    const jsonStr = response.text?.trim();
    if (!jsonStr) return null;
    return JSON.parse(jsonStr).insights;
  } catch (error) {
    return handleGenAIError(error);
  }
};

export const processHandwrittenLedger = async (base64Image: string) => {
  if (!process.env.API_KEY) {
    console.error('API Key is missing from Environment Variables');
    return null;
  }

  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  
  try {
    const response = await ai.models.generateContent({
      model: MODEL_NAME,
      contents: {
        parts: [
          { 
            inlineData: { 
              data: base64Image.split(',')[1], 
              mimeType: 'image/jpeg' 
            } 
          },
          { text: "Act as an OCR expert. Extract product names, prices (convert 'k' to thousands), cost prices, and quantities from this image. Return ONLY a JSON array." }
        ]
      },
      config: {
        systemInstruction: "Extract product data from store notebooks. Ensure prices and quantities are numbers. Ignore currency symbols.",
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            products: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  name: { type: Type.STRING },
                  price: { type: Type.NUMBER },
                  cost_price: { type: Type.NUMBER },
                  stock_qty: { type: Type.NUMBER },
                  category: { type: Type.STRING }
                },
                required: ['name', 'price', 'cost_price', 'stock_qty']
              }
            }
          }
        }
      }
    });

    const jsonStr = response.text?.trim();
    if (!jsonStr) return null;
    return JSON.parse(jsonStr).products;
  } catch (error) {
    return handleGenAIError(error);
  }
};
