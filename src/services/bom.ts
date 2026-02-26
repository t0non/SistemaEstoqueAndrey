import {
  runTransaction,
  doc,
  collection,
  Timestamp,
} from '@/firebase';
import type { Product } from '@/lib/types';

export async function processBomExplosionSale(
  firestore: any,
  ownerId: string,
  finalProductId: string,
  quantitySold: number
) {
  // Transaction to ensure atomicity of stock updates
  await runTransaction(firestore, async (tx: any) => {
    const finalRef = doc(firestore, 'products', finalProductId);
    const finalSnap = await tx.get(finalRef);
    if (!finalSnap.exists()) {
      throw new Error('Produto final não encontrado');
    }
    const finalData = finalSnap.data() as Product;
    if (!Array.isArray(finalData.bom) || finalData.bom.length === 0) {
      throw new Error('Ficha Técnica não definida para o produto final');
    }

    // Check availability of all components (gargalo) server-side
    const componentSnaps: Array<{ ref: any; snap: any; required: number }> = [];
    for (const comp of finalData.bom) {
      const compRef = doc(firestore, 'products', comp.productId);
      const compSnap = await tx.get(compRef);
      if (!compSnap.exists()) {
        throw new Error(`Insumo não encontrado: ${comp.productId}`);
      }
      const required = quantitySold * comp.quantity;
      const available = (compSnap.data() as any).currentStock || 0;
      if (required > available) {
        const name = (compSnap.data() as any).name || comp.productId;
        throw new Error(
          `Estoque insuficiente de "${name}". Necessário ${required}, disponível ${available}.`
        );
      }
      componentSnaps.push({ ref: compRef, snap: compSnap, required });
    }

    // Persist transaction record (optional, useful for audit)
    const txnId = doc(collection(firestore, 'transactions')).id;
    const txnRef = doc(firestore, 'transactions', txnId);
    tx.set(txnRef, {
      id: txnId,
      ownerId,
      type: 'IN',
      status: 'COMPLETED',
      date: Timestamp.now(),
      totalValue: 0,
      discountValue: 0,
      netTotal: 0,
      notes: 'Baixa por Explosão (BOM)',
    });

    // Register consumed materials and update stock of each component
    for (const c of componentSnaps) {
      const itemRef = doc(collection(firestore, 'transaction_items'));
      const compCost = (c.snap.data() as any).costPrice || 0;
      tx.set(itemRef, {
        id: itemRef.id,
        transactionId: txnId,
        ownerId,
        productId: c.ref.id,
        productName: (c.snap.data() as any).name || c.ref.id,
        quantity: c.required,
        price: 0,
        costPrice: compCost,
      });
      const newStock = (c.snap.data() as any).currentStock - c.required;
      tx.update(c.ref, { currentStock: newStock });
    }

    // Do NOT modify final product stock (assembled on demand)
  });
}

export async function processAssemblyToStock(
  firestore: any,
  ownerId: string,
  finalProductId: string,
  quantityToAssemble: number
) {
  await runTransaction(firestore, async (tx: any) => {
    const finalRef = doc(firestore, 'products', finalProductId);
    const finalSnap = await tx.get(finalRef);
    if (!finalSnap.exists()) {
      throw new Error('Produto final não encontrado');
    }
    const finalData = finalSnap.data() as Product;
    if (!Array.isArray(finalData.bom) || finalData.bom.length === 0) {
      throw new Error('Ficha Técnica não definida para o produto final');
    }

    const componentSnaps: Array<{ ref: any; snap: any; required: number }> = [];
    for (const comp of finalData.bom) {
      const compRef = doc(firestore, 'products', comp.productId);
      const compSnap = await tx.get(compRef);
      if (!compSnap.exists()) {
        throw new Error(`Insumo não encontrado: ${comp.productId}`);
      }
      const required = quantityToAssemble * comp.quantity;
      const available = (compSnap.data() as any).currentStock || 0;
      if (required > available) {
        const name = (compSnap.data() as any).name || comp.productId;
        throw new Error(
          `Insumo insuficiente "${name}". Necessário ${required}, disponível ${available}.`
        );
      }
      componentSnaps.push({ ref: compRef, snap: compSnap, required });
    }

    const txnId = doc(collection(firestore, 'transactions')).id;
    const txnRef = doc(firestore, 'transactions', txnId);
    tx.set(txnRef, {
      id: txnId,
      ownerId,
      type: 'ASSEMBLY',
      status: 'COMPLETED',
      date: Timestamp.now(),
      totalValue: 0,
      discountValue: 0,
      netTotal: 0,
      notes: 'Montagem para estoque (BOM)',
    });

    // Consome insumos
    for (const c of componentSnaps) {
      const itemRef = doc(collection(firestore, 'transaction_items'));
      const compCost = (c.snap.data() as any).costPrice || 0;
      tx.set(itemRef, {
        id: itemRef.id,
        transactionId: txnId,
        ownerId,
        productId: c.ref.id,
        productName: (c.snap.data() as any).name || c.ref.id,
        quantity: c.required,
        price: 0,
        costPrice: compCost,
      });
      const newStock = (c.snap.data() as any).currentStock - c.required;
      tx.update(c.ref, { currentStock: newStock });
    }

    // Credita estoque do produto final
    const newFinalStock = (finalSnap.data() as any).currentStock + quantityToAssemble;
    tx.update(finalRef, { currentStock: newFinalStock });

    // Registra item do produto final (informativo)
    const finalItemRef = doc(collection(firestore, 'transaction_items'));
    tx.set(finalItemRef, {
      id: finalItemRef.id,
      transactionId: txnId,
      ownerId,
      productId: finalRef.id,
      productName: finalData.name,
      quantity: quantityToAssemble,
      price: 0,
      costPrice: 0,
    });
  });
}
