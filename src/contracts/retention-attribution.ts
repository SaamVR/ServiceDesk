export interface ReferralAttributionRowDTO {
  referralCodeId: string;
  code: string;
  label: string;
  active: boolean;
  touchCount: number;
  paidJobCount: number;
  firstTouchAt?: string;
  lastTouchAt?: string;
}

export interface ReferralAttributionSummaryDTO {
  from: string;
  to: string;
  rows: ReferralAttributionRowDTO[];
  disclosure: string;
}
