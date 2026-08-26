-- CreateTable
CREATE TABLE "ModelConfig" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "apiBaseUrl" TEXT NOT NULL,
    "apiKeyEncrypted" TEXT NOT NULL,
    "modelName" TEXT NOT NULL,
    "temperature" REAL NOT NULL DEFAULT 0.3,
    "maxOutputTokens" INTEGER NOT NULL DEFAULT 2000,
    "timeoutMs" INTEGER NOT NULL DEFAULT 60000,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

CREATE TABLE "Conversation" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "externalKey" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "cas" TEXT NOT NULL,
    "testProject" TEXT NOT NULL,
    "sampleName" TEXT,
    "sampleCode" TEXT,
    "confirmedContent" TEXT NOT NULL,
    "metadataJson" TEXT,
    "summary" TEXT,
    "summaryMessageCount" INTEGER NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'active',
    "currentModelConfigId" TEXT,
    "currentModelName" TEXT,
    "activeGenerationId" TEXT,
    "activeGenerationStarted" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "lastMessageAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE "Message" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "conversationId" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'completed',
    "modelConfigId" TEXT,
    "modelNameSnapshot" TEXT,
    "errorSummary" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Message_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "Conversation" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Message_modelConfigId_fkey" FOREIGN KEY ("modelConfigId") REFERENCES "ModelConfig" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE TABLE "AppSetting" (
    "id" TEXT NOT NULL PRIMARY KEY DEFAULT 'global',
    "globalSystemPrompt" TEXT NOT NULL,
    "contextMaxMessages" INTEGER NOT NULL DEFAULT 20,
    "contextMaxChars" INTEGER NOT NULL DEFAULT 40000,
    "updatedAt" DATETIME NOT NULL
);

CREATE UNIQUE INDEX "ModelConfig_name_key" ON "ModelConfig"("name");
CREATE INDEX "idx_model_configs_enabled_default" ON "ModelConfig"("enabled", "isDefault");
CREATE UNIQUE INDEX "Conversation_externalKey_key" ON "Conversation"("externalKey");
CREATE INDEX "idx_conversations_last_message_at" ON "Conversation"("lastMessageAt");
CREATE INDEX "idx_conversations_cas" ON "Conversation"("cas");
CREATE INDEX "idx_conversations_test_project" ON "Conversation"("testProject");
CREATE INDEX "idx_messages_conversation_created_at" ON "Message"("conversationId", "createdAt");
CREATE INDEX "idx_messages_conversation_role" ON "Message"("conversationId", "role");
