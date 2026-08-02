import mongoose from 'mongoose';

const conversationSchema = new mongoose.Schema(
  {
    // We never store the JWT itself — only the identifiers we need to
    // scope memory correctly (multi-tenant safe).
    userId: { type: String, required: true, index: true },
    tenantId: { type: String, required: true, index: true },

    title: { type: String, default: 'محادثة جديدة' },

    // Rolling summary of older messages, refreshed by memory/summaryService.js
    // once the conversation grows past the "last N messages" window.
    summary: { type: String, default: '' },

    lastActivityAt: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

conversationSchema.index({ userId: 1, tenantId: 1, lastActivityAt: -1 });

export const Conversation = mongoose.model('Conversation', conversationSchema);
