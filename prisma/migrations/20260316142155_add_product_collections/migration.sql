-- CreateTable
CREATE TABLE "ProductCollection" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "description" TEXT,
    "emoji" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProductCollection_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProductCollectionItem" (
    "id" TEXT NOT NULL,
    "collectionId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "ProductCollectionItem_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ProductCollection_slug_key" ON "ProductCollection"("slug");

-- CreateIndex
CREATE INDEX "ProductCollectionItem_collectionId_idx" ON "ProductCollectionItem"("collectionId");

-- CreateIndex
CREATE INDEX "ProductCollectionItem_productId_idx" ON "ProductCollectionItem"("productId");

-- CreateIndex
CREATE UNIQUE INDEX "ProductCollectionItem_collectionId_productId_key" ON "ProductCollectionItem"("collectionId", "productId");

-- AddForeignKey
ALTER TABLE "ProductCollectionItem" ADD CONSTRAINT "ProductCollectionItem_collectionId_fkey" FOREIGN KEY ("collectionId") REFERENCES "ProductCollection"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductCollectionItem" ADD CONSTRAINT "ProductCollectionItem_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;
