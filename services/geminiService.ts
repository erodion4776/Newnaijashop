
import { GoogleGenAI, Type } from "@google/genai";
import { Product, Sale } from "../types";

export const getAIInsights = async (sales: Sale[], products: Product[]) => {
  // Always create a new instance right before use to ensure correct configuration
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  
  const prompt = `
    Act as a retail expert for Nigerian businesses. 
    Analyze this data and provide 3 actionable business insights.
    Products: ${JSON.stringify(products.map(p => ({ name: p.name, stock: p.stock_qty, price: p.price })))}
    Recent Sales: ${JSON.stringify(sales.slice(-10).map(s => ({ total: s.total_amount, items: s.items.length })))}
    
    Return the response as JSON with a list of insights, each having a 'title', 'description', and 'priority' (High, Medium, Low).
  `;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-pro-preview',
      contents: prompt,
      config: {
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

    // The text property returns the string output directly
    const jsonStr = response.text?.trim();
    if (!jsonStr) return null;
    return JSON.parse(jsonStr).insights;
  } catch (error) {
    console.error("AI Insights Error:", error);
    return null;
  }
};

export const processHandwrittenLedger = async (base64Image: string) => {
  // Always create a new instance right before use to ensure correct configuration
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  
  const prompt = `
    Extract products from this handwritten ledger image. 
    Look for product names, selling prices, cost prices, and quantities.
    If prices use 'k' suffix, convert to thousands (e.g. 5k = 5000).
    Respond in JSON format.
  `;

  try {
    const response = await ai.models.generateContent({
      // Upgraded to gemini-3-pro-preview for better complex reasoning and extraction from images
      model: 'gemini-3-pro-preview',
      // Multi-part content must be wrapped in a parts array within a Content object
      contents: {
        parts: [
          { 
            inlineData: { 
              data: base64Image.split(',')[1], 
              mimeType: 'image/jpeg' 
            } 
          },
          { text: prompt }
        ]
      },
      config: {
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

    // The text property returns the string output directly
    const jsonStr = response.text?.trim();
    if (!jsonStr) return null;
    return JSON.parse(jsonStr).products;
  } catch (error) {
    console.error("Ledger Migration Error:", error);
    return null;
  }
};
