import type { AiService } from "./types";
import { createConfiguredAiService, type ConfiguredAiServiceDependencies } from "./configured-service";
import {
  createPostgresVerifiedAiConversationStore,
  type AiPersistedMessageLookup,
} from "./postgres-conversation-store";

/**
 * Use only after a trusted Core inbound RPC has committed the customer
 * message. The backing Supabase client must be built server-side and
 * authorized for the current workspace. Neither an untrusted visitor
 * actor nor a model-supplied workspace identifier can trigger this path.
 */
export function createPostgresConfiguredAiService(
  client: AiPersistedMessageLookup,
  deps: Omit<ConfiguredAiServiceDependencies, "store">,
): AiService {
  return createConfiguredAiService({
    ...deps,
    store: createPostgresVerifiedAiConversationStore(client),
  });
}
