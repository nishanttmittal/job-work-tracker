/**
 * Plating Job Work — data access. Wires collections to the repository layer.
 */
import { createCollection, createSingleton } from '../../core/db/repository'
import { makeNormalizer } from '../../core/schema/field'
import { challanSchema, userSchema, incomingSchema } from './schema'
import { KEYS, DEFAULT_PARTIES, DEFAULT_PRODUCTS } from './config'

/** Challans collection — normalized against the current schema on every read. */
export const challansRepo = createCollection(KEYS.challans, {
  seed: () => [],
  normalize: makeNormalizer(challanSchema),
})

/** Audit log collection (newest actions appended). */
export const logsRepo = createCollection(KEYS.logs, { seed: () => [] })

/** App users (Manager/Admin) for role-based access. */
export const usersRepo = createCollection(KEYS.users, {
  seed: () => [],
  normalize: makeNormalizer(userSchema),
})

/** Incoming-from-Welder queue (local mirror; cloud is the live source). */
export const incomingRepo = createCollection('incoming', {
  seed: () => [],
  normalize: makeNormalizer(incomingSchema),
})

/** Singletons. */
export const counterStore  = createSingleton(KEYS.counter,  0) // last issued challan number
export const partiesStore  = createSingleton(KEYS.parties,  DEFAULT_PARTIES)
export const productsStore = createSingleton(KEYS.products, DEFAULT_PRODUCTS)
export const lastUsedStore = createSingleton(KEYS.lastUsed, {})
