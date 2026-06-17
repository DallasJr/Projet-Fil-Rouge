-- AlterTable
ALTER TABLE "Delivery" ADD COLUMN     "acceptedByDeliverer" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "isSuspended" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "suspendedReason" TEXT;
