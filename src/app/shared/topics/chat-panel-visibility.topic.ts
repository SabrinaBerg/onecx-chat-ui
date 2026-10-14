import { Topic } from '@onecx/accelerator'

// Shares panel visibility between the separately bootstrapped toggle and panel components.
export class ChatPanelVisibilityTopic extends Topic<boolean> {
  constructor() {
    super('onecx-chat-panel-visibility', 1)
  }
}
