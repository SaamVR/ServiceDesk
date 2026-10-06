export interface InboundMessageChannelOperationsDTO {
  channel: "WHATSAPP" | "EMAIL";
  receivedCount: number;
  appliedCount: number;
  duplicateCount: number;
  ignoredCount: number;
  unresolvedIdentityCount: number;
  latestReceivedAt?: string;
}

export interface InboundVoiceOperationsDTO {
  capturedCount: number;
  pendingCallbackCount: number;
  resolvedCallbackCount: number;
  latestOccurredAt?: string;
}

export interface InboundOperationsSnapshotDTO {
  workspaceId: string;
  windowHours: number;
  windowStartedAt: string;
  generatedAt: string;
  messageChannels: InboundMessageChannelOperationsDTO[];
  voice: InboundVoiceOperationsDTO;
}
