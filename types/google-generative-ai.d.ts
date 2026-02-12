// Type declarations for @google/generative-ai
// Install the actual package on deployment: npm install @google/generative-ai

declare module '@google/generative-ai' {
  export interface GenerateContentResult {
    response: {
      text(): string
      candidates?: Array<{
        content: {
          parts: Array<{ text: string }>
        }
      }>
    }
  }

  export interface GenerativeModel {
    generateContent(
      prompt: string | Array<{ role: string; parts: Array<{ text: string }> }>
    ): Promise<GenerateContentResult>
  }

  export interface GenerativeModelParams {
    model: string
    systemInstruction?: string
    generationConfig?: {
      temperature?: number
      maxOutputTokens?: number
      topP?: number
      topK?: number
    }
  }

  export class GoogleGenerativeAI {
    constructor(apiKey: string)
    getGenerativeModel(params: GenerativeModelParams): GenerativeModel
  }
}
