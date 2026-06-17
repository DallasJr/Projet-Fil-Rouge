import { prisma } from '../index'

/**
 * Actions possibles dans l'audit log
 */
export type AuditAction =
  | 'STATUS_CHANGE'       // Changement de statut commande
  | 'DELIVERER_ASSIGNED'  // Livreur assigné manuellement
  | 'DELIVERER_REPLACED'  // Livreur remplacé (réassignation)
  | 'DELIVERY_CANCELLED'  // Livraison annulée

/**
 * Crée une entrée d'audit log pour une commande.
 * Centralise toute la logique d'historisation.
 */
export const createAuditLog = async (
  orderId: string,
  actorId: string,
  action: AuditAction,
  oldValue?: string | null,
  newValue?: string | null,
  note?: string | null
): Promise<void> => {
  try {
    await prisma.auditLog.create({
      data: {
        orderId,
        actorId,
        action,
        oldValue: oldValue ?? null,
        newValue: newValue ?? null,
        note: note ?? null
      }
    })
  } catch (err) {
    // On ne bloque jamais l'action principale si le log échoue
    console.error(`[AuditLog] Échec de la création du log (${action}):`, err)
  }
}
