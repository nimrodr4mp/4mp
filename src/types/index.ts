export type UserRole = 'admin' | 'sales' | 'technician'

export interface AppUser {
  id: string
  email: string
  name: string
  role: UserRole
  is_active: boolean
  password_hash?: string
  password_salt?: string
  last_login?: string | null
  sales_person_id?: string | null
  report_permissions?: string[] | null
  created_at: string
}

export type LeadSource =
  | 'facebook'
  | 'instagram'
  | 'google_paid'
  | 'google_organic'
  | 'tiktok'
  | 'youtube'
  | 'whatsapp'
  | 'direct'
  | 'friend'
  | 'website'
  | 'phone'

export type LeadStatus =
  | 'new'
  | 'contacted'
  | 'meeting'
  | 'in_progress'
  | 'interested'
  | 'proposal'
  | 'won'
  | 'lost'
  | 'not_relevant'
  | 'double'

export interface Reminder {
  id: string
  date: string
  time?: string
  text: string
}

export type BusinessType = 'cosmetician' | 'doctor' | 'clinic'

export interface Lead {
  id: string
  name: string
  phone: string
  email?: string | null
  city?: string | null
  source: LeadSource
  status: LeadStatus
  score: number
  assigned_to?: string | null
  machines_interested: string[]
  business_type?: BusinessType | null
  conversation_summary?: string | null
  follow_up_date?: string | null
  reminders?: Reminder[]
  notes?: string | null
  origin_url?: string | null
  old_id?: string | null
  is_return?: boolean
  is_archived?: boolean
  created_at: string
  updated_at: string
}

export interface LeadInteraction {
  id: string
  lead_id: string
  type: 'note' | 'call' | 'whatsapp' | 'email' | 'log'
  content: string
  created_by: string
  created_at: string
}

export interface MachineVariation {
  id: string
  name: string
  price_modifier: number
}

export interface MachinePrice {
  id: string
  name: string
  amount: number
}

export interface MachineCategory {
  id: string
  name: string
  color: string
  sort_order: number
  created_at: string
}

export interface Machine {
  id: string
  name: string
  categories: string[]
  description?: string | null
  prices: MachinePrice[]
  image_url?: string | null
  variations: MachineVariation[]
  is_active: boolean
  created_at: string
  updated_at: string
  /** legacy single-value columns kept for backward-compatible reads */
  category?: string | null
  price?: number | null
}

export interface Customer {
  id: string
  name: string
  type: BusinessType
  contact_name?: string | null
  phone?: string | null
  email?: string | null
  city?: string | null
  address?: string | null
  notes?: string | null
  lead_id?: string | null
  created_at: string
  updated_at: string
}

export interface SaleMachine {
  machine_id: string
  variation_id?: string
  price_id?: string
  price_name?: string
  unit_price?: number
  quantity: number
  name?: string
  serial?: string
}

export interface SalePayment {
  type: 'cash' | 'credit' | 'transfer' | 'check'
  amount: number
  invoice_link?: string
}

export type SaleStatus = 'new' | 'confirmed' | 'paid' | 'delivered' | 'installed' | 'cancelled'
export type DeliveryType = 'pickup' | 'delivery' | 'delivery_and_install'

export interface Sale {
  id: string
  date: string
  customer_id?: string | null
  customer_name: string
  phone?: string | null
  email?: string | null
  city?: string | null
  address?: string | null
  machines: SaleMachine[]
  total_amount: number
  payments?: SalePayment[] | null
  sales_person?: string
  sales_person_id?: string | null
  lead_id?: string | null
  delivery_type: DeliveryType
  status: SaleStatus
  notes?: string | null
  created_at: string
  updated_at: string
}

export type MeetingType = 'in_person' | 'video' | 'phone'
export type MeetingStatus = 'scheduled' | 'completed' | 'cancelled' | 'no_show'

export interface Meeting {
  id: string
  lead_id?: string | null
  customer_id?: string | null
  sales_person_id?: string | null
  title?: string | null
  meeting_type: MeetingType
  scheduled_date?: string | null
  scheduled_time?: string | null
  location?: string | null
  status: MeetingStatus
  outcome?: string | null
  notes?: string | null
  created_at: string
  updated_at: string
}

export type InstallationStatus = 'pending' | 'scheduled' | 'completed' | 'cancelled'

export interface Installation {
  id: string
  sale_id?: string | null
  customer_id?: string | null
  customer_name: string
  phone?: string | null
  city?: string | null
  address?: string | null
  machine_id?: string | null
  machine_name?: string | null
  serial_number?: string | null
  technician_id?: string | null
  planned_date?: string | null
  actual_date?: string | null
  status: InstallationStatus
  notes?: string | null
  created_at: string
  updated_at: string
}

export interface SalesPerson {
  id: string
  name: string
  phone?: string | null
  email?: string | null
  is_active: boolean
  created_at: string
  updated_at: string
}
