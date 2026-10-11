import type { Result } from "../../contracts";
import type { AiService } from "./types";
import type { ApprovedKnowledgeIndex } from "./knowledge";
import {
  type AiPersistedMessageLookup,
} from "./postgres-conversation-store";
import { createPostgresConfiguredAiService } from "./postgres-configured-service";
import { createFetchAiModelTransport, type AiFetchPort } from "./fetch-transport";
import { readConfiguredAiRuntimeConfig, type AiEnvironment } from "./runtime-config";

export interface OperationalAiRuntimeDependencies {
  /** Server-only scoped DB client, not a client-provided workspace selector. */
  messages: AiPersistedMessageLookup;
  /** Must be loaded from trusted, approved tenant knowledge data. */
  knowledge: ApprovedKnowledgeIndex;
  env?: AiEnvironment;
  fetchPort?: AiFetchPort;
  promptVersion: string;
}

/**
 * Complete non-fixture AI runtime assembly. This factory has no side effects:
 * neither a database lookup nor provider request occurs until respond() is
 * invoked by an authorized backend caller with an already persisted message.
 */
export function createOperationalAiRuntime(
  deps: OperationalAiRuntimeDependencies,
): Result<AiService> {
  const config = readConfiguredAiRuntimeConfig(deps.env);
  if (!config.ok) return config;
  if (typeof deps.promptVersion !== "string" ||
      deps.promptVersion.length < 3 || deps.promptVersion.length > 128 ||
      !/^[A-Za-z0-9._:-]+$/.test(deps.promptVersion)) {
    return { ok: false, code: "AI_RUNTIME_PROMPT_VERSION_INVALID",
      message: "Configured AI requires a controlled prompt version." };
  }
  return { ok: true, value: createPostgresConfiguredAiService(deps.messages, {
    knowledge: deps.knowledge,
    promptVersion: deps.promptVersion,
    modelConfig: config.value,
    http: createFetchAiModelTransport(deps.fetchPort),
  }) };
}
