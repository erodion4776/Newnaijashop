
import { GoogleGenAI, Type } from "@google/genai";
import { Product, Sale } from "../types";

// Guideline: Complex Text Tasks (e.g., advanced reasoning, coding, math, and STEM) use 'gemini-3-pro-preview'
const MODEL_NAME = 'gemini-3-pro-preview';

/**
 * Custom error class for rate limiting to provide specific UI feedback
 */
export class RateLimitError extends Error {
  constructor(message: string = "AI is busy. Please wait 60 seconds and try again.") {
    super(message);
    this.name = "RateLimitError";
  }
}

/**
 * Strips markdown code blocks and other conversational noise from AI responses
 */
const cleanJsonResponse = (responseText: string): string => {
  return responseText
    .replace(/```json/g, '')
    .replace(/```/g, '')
    .trim();
};

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

  // Always use new GoogleGenAI({apiKey: process.env.API_KEY});
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  
  const contents = `
    Analyze this store data:
    Products: ${JSON.stringify(products.map(p => ({ name: p.name, stock: p.stock_qty, price: p.price })))}
    Recent Sales: ${JSON.stringify(sales.slice(-20).map(s => ({ total: s.total_amount, date: new Date(s.timestamp).toLocaleDateString() })))}
  `;

  try {
    // Guideline: Always use ai.models.generateContent to query GenAI with both the model name and prompt.
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

    // Guideline: The GenerateContentResponse object features a text property (not a method, so do not call text())
    const jsonStr = cleanJsonResponse(response.text || "");
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

  // Always use new GoogleGenAI({apiKey: process.env.API_KEY});
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  
  try {
    // Guideline: Always use ai.models.generateContent to query GenAI with both the model name and prompt.
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
          { text: "Act as a data entry clerk for a Nigerian retail shop. Analyze this image of a handwritten ledger. Extract the Product Name, Price, and Quantity. Return the data ONLY as a valid JSON array. Do not include any conversational text, markdown formatting, or explanations. Example format: [{\"name\": \"Milo 500g\", \"price\": 2500, \"stock\": 10}]." }
        ]
      },
      config: {
        systemInstruction: "You are a professional retail data entry clerk. Your goal is to extract structured data from handwritten shop notebooks. Ensure prices and quantities are returned as clean numbers. If you see 'k' (e.g., 2k), convert it to 1000s (e.g., 2000). Always return JSON.",
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
                required: ['name', 'price', 'stock_qty']
              }
            }
          }
        }
      }
    });

    // Guideline: The GenerateContentResponse object features a text property (not a method, so do not call text())
    const text = response.text || "";
    const jsonStr = cleanJsonResponse(text);
    
    if (!jsonStr) {
      console.warn("Empty response from AI");
      return null;
    }

    const parsed = JSON.parse(jsonStr);
    
    // Fallback normalization: map 'stock' from AI example to 'stock_qty' if schema was ignored
    const normalizedProducts = (parsed.products || parsed).map((p: any) => ({
      name: p.name || "Unknown Product",
      price: Number(p.price) || 0,
      cost_price: Number(p.cost_price || (p.price * 0.85)) || 0, // Fallback cost price estimation
      stock_qty: Number(p.stock_qty || p.stock) || 0,
      category: p.category || "General"
    }));

    return normalizedProducts;
  } catch (error) {
    return handleGenAIError(error);
  }
};
