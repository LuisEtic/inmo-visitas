/**
 * Datos de ejemplo idénticos a los de supabase/migrations/0002_seed_demo.sql.
 * Solo se usan en la pantalla de showcase de la Fase 1. En fases
 * posteriores estos datos vendrán de Supabase, no de este archivo.
 */

export type PropertyStatus = 'disponible' | 'reservado' | 'vendido'

export interface SeedProperty {
  reference: string
  address: string
  city: string
  price: number
  ownerName: string
  ownerPhone: string
  status: PropertyStatus
}

export interface SeedClient {
  fullName: string
  phone: string | null
  email: string | null
  isTemporary: boolean
}

export const seedProperties: SeedProperty[] = [
  {
    reference: 'V-18',
    address: 'Calle de Alcalá 120',
    city: 'Madrid',
    price: 230000,
    ownerName: 'Carlos Ruiz',
    ownerPhone: '+34 611 100 200',
    status: 'disponible',
  },
  {
    reference: 'V-22',
    address: 'Calle Serrano 45',
    city: 'Madrid',
    price: 450000,
    ownerName: 'Marta Gómez',
    ownerPhone: '+34 611 100 201',
    status: 'disponible',
  },
  {
    reference: 'V-07',
    address: 'Calle Goya 88',
    city: 'Madrid',
    price: 310000,
    ownerName: 'Javier López',
    ownerPhone: '+34 611 100 202',
    status: 'reservado',
  },
  {
    reference: 'V-31',
    address: 'Avenida de América 15',
    city: 'Madrid',
    price: 275000,
    ownerName: 'Lucía Fernández',
    ownerPhone: '+34 611 100 203',
    status: 'disponible',
  },
  {
    reference: 'V-12',
    address: 'Calle Bravo Murillo 200',
    city: 'Madrid',
    price: 195000,
    ownerName: 'Antonio Sánchez',
    ownerPhone: '+34 611 100 204',
    status: 'vendido',
  },
  {
    reference: 'V-45',
    address: 'Paseo de la Castellana 300',
    city: 'Madrid',
    price: 620000,
    ownerName: 'Elena Torres',
    ownerPhone: '+34 611 100 205',
    status: 'disponible',
  },
  {
    reference: 'V-09',
    address: 'Calle Toledo 55',
    city: 'Madrid',
    price: 215000,
    ownerName: 'Miguel Ángel Díaz',
    ownerPhone: '+34 611 100 206',
    status: 'disponible',
  },
  {
    reference: 'V-27',
    address: 'Calle Princesa 33',
    city: 'Madrid',
    price: 340000,
    ownerName: 'Sofía Martín',
    ownerPhone: '+34 611 100 207',
    status: 'reservado',
  },
]

export const seedClients: SeedClient[] = [
  {
    fullName: 'Ana García',
    phone: '+34 612 345 678',
    email: 'ana.garcia@gmail.com',
    isTemporary: false,
  },
  {
    fullName: 'Pedro Molina',
    phone: '+34 655 123 456',
    email: 'pedro.molina@hotmail.com',
    isTemporary: false,
  },
  {
    fullName: 'Laura Ortiz',
    phone: '+34 699 876 543',
    email: 'laura.ortiz@yahoo.es',
    isTemporary: false,
  },
  {
    fullName: 'David Romero',
    phone: '+34 611 222 333',
    email: null,
    isTemporary: false,
  },
  {
    fullName: 'Carmen Ibáñez',
    phone: '+34 622 333 444',
    email: 'carmen.ibanez@gmail.com',
    isTemporary: false,
  },
  {
    fullName: 'Jorge Navarro',
    phone: '+34 633 444 555',
    email: null,
    isTemporary: true,
  },
]
