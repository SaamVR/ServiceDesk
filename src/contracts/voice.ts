export type VoiceCallbackState = "PENDING" | "RESOLVED";

export interface MissedVoiceCallEvent {
  workspaceId: string;
  providerAccountId: string;
  providerCallId: string;
  callerRef: string;
  occurredAt: string;
  rawProviderEventRef: string;
  receivedAt: string;
}

export interface VoiceMissedCallCaptureDTO {
  intakeId: string;
  requestId: string;
  callbackState: VoiceCallbackState;
  duplicate: boolean;
}

export interface VoiceCallbackUpdateDTO {
  intakeId: string;
  requestId: string;
  callbackState: VoiceCallbackState;
  version: number;
  duplicate: boolean;
}
