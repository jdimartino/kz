import { fixOpenOrdersCustomerIds } from '../src/services/orderService.js';

async function migrate() {
  try {
    console.log('Ejecutando migración de órdenes abiertas para asignar customerId...');
    let fixedCount;
    do {
      fixedCount = await fixOpenOrdersCustomerIds();
      console.log(`Órdenes corregidas en esta ejecución: ${fixedCount}`);
    } while (fixedCount > 0);
    console.log('Migración completada. No quedan órdenes sin customerId.');
    process.exit(0);
  } catch (err) {
    console.error('Error durante migración:', err);
    process.exit(1);
  }
}

migrate();
