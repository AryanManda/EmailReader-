export interface RawEmail {
  id: string
  subject: string
  sender: string
  date: string
  body: string
}

export interface Meeting {
  description: string
  date_time: string
  location: string
  organizer: string
  attendees: string[]
}

export interface MoneyItem {
  description: string
  amount: string
  due_date: string
  payee?: string
  payer?: string
}

export interface SchedulingItem {
  description: string
  deadline: string
  action_needed: string
}

export interface AnalysisResult {
  emailId: string
  subject: string
  sender: string
  date: string
  summary: string
  is_important: boolean
  flags: string[]
  meetings: Meeting[]
  money_owed_by_me: MoneyItem[]
  money_owed_to_me: MoneyItem[]
  scheduling: SchedulingItem[]
  action_items: string[]
  error?: string
}
