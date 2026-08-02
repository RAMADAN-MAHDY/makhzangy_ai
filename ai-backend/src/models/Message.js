import mongoose from 'mongoose';

const toolCallSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    args: { type: mongoose.Schema.Types.Mixed },
    result: { type: mongoose.Schema.Types.Mixed },
    latencyMs: { type: Number },
    error: { type: String },
  },
  { _id: false }
);

const messageSchema = new mongoose.Schema(
  {
    conversationId: { type: mongoose.Schema.Types.ObjectId, ref: 'Conversation', required: true, index: true },

    role: { type: String, enum: ['user', 'assistant', 'system', 'tool'], required: true },
    content: { type: String, default: '' },

    // Filled in when the assistant used Function Calling to answer.
    toolCalls: { type: [toolCallSchema], default: undefined },

    // Observability (per Sprint 7 — Logging, Metrics, Token Tracking)
    tokenUsage: {
      promptTokens: Number,
      completionTokens: Number,
      totalTokens: Number,
    },
    promptVersion: { type: String },
  },
  { timestamps: true }
);

export const Message = mongoose.model('Message', messageSchema);
