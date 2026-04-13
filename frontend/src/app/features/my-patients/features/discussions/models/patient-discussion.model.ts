export interface PatientDiscussionMessage {
  id: string;
  resourceId: string;
  discussionId: string;
  discussionTitle: string;
  senderReference: string;
  recipientReferences: string[];
  subjectReference: string;
  sent: string;
  content: string;
}

export interface PatientDiscussionThread {
  id: string;
  discussionId: string;
  title: string;
  patientReference?: string;
  recipientReference?: string;
  lastMessage: string;
  lastSent: string;
  messageCount: number;
}
