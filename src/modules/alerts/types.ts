export type AlertSenderDto = {
  avatar?: string | null
  id: string
  name: string
}

export type AlertRecipientDto = {
  id: string
  name: string
}

export type AlertDto = {
  createdAt: Date | string
  id: string
  message: string
  read: boolean
  sender?: AlertSenderDto | null
  title: string
  type: string
}

export type CreateAlertDto = {
  message: string
  recipientId: string
  title: string
  type?: string
}

export type MarkAlertReadDto = {
  alertId: string
}
