-- AlterTable
ALTER TABLE "Delivery" ADD COLUMN     "confirmedByCustomer" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "confirmedByDeliverer" BOOLEAN NOT NULL DEFAULT false;
