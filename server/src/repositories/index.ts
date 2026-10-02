/**
 * Single import point for persistence.
 *
 * Services receive this object rather than importing repositories individually,
 * which keeps the dependency direction one-way (routes -> services ->
 * repositories) and makes swapping the storage backend a single-file change.
 *
 * The interface is declared explicitly rather than inferred so the emitted
 * declaration file stays nameable — an inferred `Object.freeze({...})` type would
 * leak the classes' private members and break `declaration: true`.
 */
import { actionRepository, ActionRepository } from "./actionRepository.js";
import {
  interactionReceiptRepository,
  InteractionReceiptRepository,
} from "./interactionReceiptRepository.js";
import { flowRepository, FlowRepository } from "./flowRepository.js";
import {
  botProfileRepository,
  BotProfileRepository,
  webhookProfileRepository,
  WebhookProfileRepository,
} from "./profileRepository.js";
import { templateRepository, TemplateRepository } from "./templateRepository.js";
import { userRepository, UserRepository } from "./userRepository.js";

export interface Repositories {
  users: UserRepository;
  templates: TemplateRepository;
  actions: ActionRepository;
  interactionReceipts: InteractionReceiptRepository;
  flows: FlowRepository;
  webhookProfiles: WebhookProfileRepository;
  botProfiles: BotProfileRepository;
}

export const repositories: Repositories = Object.freeze({
  users: userRepository,
  templates: templateRepository,
  actions: actionRepository,
  interactionReceipts: interactionReceiptRepository,
  flows: flowRepository,
  webhookProfiles: webhookProfileRepository,
  botProfiles: botProfileRepository,
});

export {
  actionRepository,
  ActionRepository,
  interactionReceiptRepository,
  InteractionReceiptRepository,
  botProfileRepository,
  BotProfileRepository,
  flowRepository,
  FlowRepository,
  templateRepository,
  TemplateRepository,
  userRepository,
  UserRepository,
  webhookProfileRepository,
  WebhookProfileRepository,
};

export default repositories;
