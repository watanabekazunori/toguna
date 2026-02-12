/**
 * OpenAI API Integration Module (Backward Compatibility)
 * Now re-exports from Gemini API for transparent migration
 */

export {
  generateAIResponse,
  generateAIJSON,
  generateCallScript,
  analyzeCallTranscription,
  generateStrategyFromDocuments,
} from './gemini'
