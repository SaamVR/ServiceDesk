import type { ServiceDeskFacade } from "./facade";
import { applyVerifiedPaymentWithRepository } from "./payment-application";
import type { PaymentApplicationRepository } from "./payment-application-repository";

export interface PaymentApplicationFacadeDependencies {
  paymentApplicationRepository: PaymentApplicationRepository;
}

export function createPaymentApplicationFacadeMethods(
  deps: PaymentApplicationFacadeDependencies,
): Pick<ServiceDeskFacade, "applyVerifiedPayment"> {
  return {
    applyVerifiedPayment: (event) => applyVerifiedPaymentWithRepository(deps.paymentApplicationRepository, event),
  };
}
