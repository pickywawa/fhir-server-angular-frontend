export interface PatientDiscussionMessage {
  id: string;
  discussionId: string;
  senderReference: string;
  recipientReferences: string[];
  sent: string;
  content: string;
}

export interface PatientDiscussionThread {
  id: string;
  lastMessage: string;
  lastSent: string;
  messageCount: number;
}
